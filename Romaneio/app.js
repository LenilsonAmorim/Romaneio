let rows = [];
let processed = [];

const $ = id => document.getElementById(id);

function cleanText(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function normKey(v) {
  return cleanText(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}

/*
  Normaliza quadras sem confundir números comuns:
  QD01, QD 01, QD-01, Q 01, Q01, Quadra 01 -> QD 1
*/
function normalizeQuadras(text) {
  let s = cleanText(text);

  // Quadra escrita por extenso.
  s = s.replace(/\bquadra\s*[-.:]?\s*0*(\d+)\b/gi, "QD $1");

  // QD e Q isolados/colados, com espaços ou hífen.
  s = s.replace(/\bq\s*d?\s*[-.:]?\s*0*(\d+)\b/gi, "QD $1");

  // Formas como "Q D 01" podem não casar dependendo da pontuação.
  s = s.replace(/\bq\s+d\s*[-.:]?\s*0*(\d+)\b/gi, "QD $1");

  return s;
}

function extractQuadra(text) {
  const s = normalizeQuadras(text);
  const m = s.match(/\bQD\s+(\d+)\b/i);
  return m ? Number(m[1]) : 999999;
}

function extractHouseNumber(text) {
  const s = cleanText(text);
  // Primeiro número após vírgula costuma ser o número do imóvel nas planilhas recebidas.
  let m = s.match(/,\s*0*(\d+)\b/);
  if (m) return Number(m[1]);
  // Fallback: último número antes de complemento.
  m = s.match(/\b0*(\d+)\b/);
  return m ? Number(m[1]) : 999999;
}

function normalizeBairro(text) {
  let s = cleanText(text);
  if (!s) return "";
  const rules = $("bairroRules").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const key = normKey(s);
  for (const line of rules) {
    const parts = line.split("=");
    if (parts.length >= 2 && normKey(parts[0]) === key) return cleanText(parts.slice(1).join("="));
  }
  // Capitalização simples, preservando palavras curtas.
  return s.toLowerCase().replace(/\b\w/g, c=>c.toUpperCase());
}

function findColumn(headers, patterns) {
  const normalized = headers.map(h => normKey(h));
  for (const p of patterns) {
    const i = normalized.findIndex(h => h === normKey(p));
    if (i >= 0) return i;
  }
  for (const p of patterns) {
    const i = normalized.findIndex(h => h.includes(normKey(p)));
    if (i >= 0) return i;
  }
  return -1;
}

function convertSheet(data) {
  if (!data.length) throw new Error("A planilha está vazia.");
  const headers = data[0].map(cleanText);

  const numIdx = findColumn(headers, ["Stop","Sequence","Número","Numero","AT ID"]);
  const addrIdx = findColumn(headers, ["Destination Address","Endereço","Endereco","Address"]);
  const bairroIdx = findColumn(headers, ["Bairro","Neighborhood"]);

  if (addrIdx < 0 || bairroIdx < 0) {
    throw new Error("Não encontrei as colunas de Endereço e Bairro.");
  }

  return data.slice(1).map((r, idx) => {
    const numero = numIdx >= 0 && cleanText(r[numIdx]) && cleanText(r[numIdx]) !== "-"
      ? cleanText(r[numIdx])
      : String(idx + 1);

    const endereco = normalizeQuadras(r[addrIdx]);
    const bairro = normalizeBairro(r[bairroIdx]);

    return {
      "Número": numero,
      "Endereço": endereco,
      "Bairro": bairro,
      _quadra: extractQuadra(endereco),
      _numeroCasa: extractHouseNumber(endereco),
      _originalIndex: idx
    };
  }).filter(r => r["Endereço"] || r["Bairro"]);
}

function organize() {
  processed = rows.map(r => ({...r}));

  // Primeiro bairro, depois quadra reconhecida, depois número do imóvel.
  processed.sort((a,b) => {
    const bairro = a["Bairro"].localeCompare(b["Bairro"], "pt-BR", {sensitivity:"base"});
    if (bairro) return bairro;
    if (a._quadra !== b._quadra) return a._quadra - b._quadra;
    if (a._numeroCasa !== b._numeroCasa) return a._numeroCasa - b._numeroCasa;
    return a._originalIndex - b._originalIndex;
  });

  // Renumera a sequência final.
  processed.forEach((r,i)=>r["Número"] = String(i+1));

  render();
}

function render() {
  const tbody = $("preview").querySelector("tbody");
  tbody.innerHTML = "";
  processed.slice(0,150).forEach(r=>{
    const tr = document.createElement("tr");
    for (const k of ["Número","Endereço","Bairro"]) {
      const td=document.createElement("td");
      td.textContent=r[k];
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  $("count").textContent = processed.length;
  $("bairros").textContent = new Set(processed.map(r=>normKey(r["Bairro"])).filter(Boolean)).size;
  $("quadras").textContent = processed.filter(r=>r._quadra !== 999999).length;
  $("download").disabled = !processed.length;
  $("downloadCsv").disabled = !processed.length;
}

$("file").addEventListener("change", async e=>{
  const file=e.target.files[0];
  if(!file)return;
  try {
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:"array"});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
    rows=convertSheet(data);
    $("fileInfo").textContent=`${file.name} — ${rows.length} entregas carregadas.`;
    $("process").disabled=false;
    processed=[];
    render();
  } catch(err) {
    alert(err.message || "Não foi possível ler a planilha.");
  }
});

$("process").addEventListener("click", organize);
$("applyRules").addEventListener("click", ()=>{
  if (!rows.length) return;
  rows = rows.map(r=>({...r,"Bairro":normalizeBairro(r["Bairro"])}));
  organize();
});

function outputRows() {
  return processed.map(r=>({
    "Número":r["Número"],
    "Endereço":r["Endereço"],
    "Bairro":r["Bairro"]
  }));
}

$("download").addEventListener("click", ()=>{
  const ws=XLSX.utils.json_to_sheet(outputRows());
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Entregas");
  XLSX.writeFile(wb,"entregas_organizadas.xlsx");
});

$("downloadCsv").addEventListener("click", ()=>{
  const ws=XLSX.utils.json_to_sheet(outputRows());
  const csv=XLSX.utils.sheet_to_csv(ws);
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="entregas_organizadas.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});
