let rows=[],processed=[],sequenceDraft=[],currentBairro="";
const $=id=>document.getElementById(id);
const RULES_KEY="romaneio_bairro_sequences_v1";

function cleanText(v){return String(v??"").replace(/\s+/g," ").trim()}
function normKey(v){return cleanText(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function normalizeQuadras(text){
 let s=cleanText(text);
 s=s.replace(/\bquadra\s*[-.:]?\s*0*(\d+)\b/gi,"QD $1");
 s=s.replace(/\bq\s+d\s*[-.:]?\s*0*(\d+)\b/gi,"QD $1");
 s=s.replace(/\bq\s*d?\s*[-.:]?\s*0*(\d+)\b/gi,"QD $1");
 return s;
}
function extractQuadra(text){const m=normalizeQuadras(text).match(/\bQD\s+(\d+)\b/i);return m?Number(m[1]):999999}
function extractHouseNumber(text){let m=cleanText(text).match(/,\s*0*(\d+)\b/);if(m)return Number(m[1]);m=cleanText(text).match(/\b0*(\d+)\b/);return m?Number(m[1]):999999}
const BAIRRO_MAP_KEY="romaneio_bairro_map_v2";
function loadBairroMap(){try{return JSON.parse(localStorage.getItem(BAIRRO_MAP_KEY)||"{}")}catch(e){return {}}}
function saveBairroMap(map){localStorage.setItem(BAIRRO_MAP_KEY,JSON.stringify(map))}
function renderBairroMap(){
 const map=loadBairroMap(),box=$("bairroMapList");
 const keys=Object.keys(map);
 box.innerHTML=keys.length?'<b>Bairros cadastrados:</b> '+keys.map(k=>`<span class="ruleTag">${escapeHtml(map[k].canonical)}</span>`).join(" "):'<span class="muted">Nenhum bairro cadastrado ainda.</span>';
}
function registerBairro(canonical,aliases){
 const c=cleanText(canonical); if(!c)return;
 const map=loadBairroMap();
 const all=[c,...aliases.map(cleanText).filter(Boolean)];
 map[normKey(c)]={canonical:c,aliases:[...new Set(all.map(normKey))]};
 saveBairroMap(map); renderBairroMap();
}
function detectCanonicalBairroFromAddress(address){
 const textKey=normKey(address); if(!textKey)return "";
 const map=loadBairroMap(), matches=[];
 for(const item of Object.values(map)){
   for(const alias of item.aliases||[]){
     if(alias && textKey.includes(alias)) matches.push({canonical:item.canonical,len:alias.length});
   }
 }
 matches.sort((a,b)=>b.len-a.len);
 return matches.length?matches[0].canonical:"";
}
function getBairroList(){
 const typed=$("bairroList")?.value||"";
 const saved=localStorage.getItem("romaneio_bairro_list_v1")||"";
 const source=typed.trim()?typed:saved;
 return source.split(/\r?\n/).map(cleanText).filter(Boolean);
}
function saveBairroList(){
 const list=getBairroList();
 localStorage.setItem("romaneio_bairro_list_v1",list.join("\n"));
 return list;
}
function detectBairroFromAddress(address){
 const canonical=detectCanonicalBairroFromAddress(address);
 if(canonical)return canonical;
 const text=cleanText(address), list=getBairroList();
 if(!text||!list.length)return "";
 const key=normKey(text);
 const matches=list.map(name=>({name,key:normKey(name)})).filter(x=>x.key&&key.includes(x.key)).sort((a,b)=>b.key.length-a.key.length);
 return matches.length?matches[0].name:"";
}
function normalizeBairro(text){
 let s=cleanText(text);if(!s)return "";
 const rules=$("bairroRules").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 for(const line of rules){const p=line.split("=");if(p.length>=2&&normKey(p[0])===normKey(s))return cleanText(p.slice(1).join("="))}
 return s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
}
function findColumn(headers,patterns){
 const n=headers.map(normKey);
 for(const p of patterns){const i=n.findIndex(h=>h===normKey(p));if(i>=0)return i}
 for(const p of patterns){const i=n.findIndex(h=>h.includes(normKey(p)));if(i>=0)return i}
 return -1;
}
function addressKey(r){return normKey(normalizeQuadras(r["Endereço"])).replace(/[^a-z0-9]+/g," ")}
function loadRules(){try{return JSON.parse(localStorage.getItem(RULES_KEY)||"{}")}catch(e){return {}}}
function saveRules(x){localStorage.setItem(RULES_KEY,JSON.stringify(x))}
function populateBairros(){
 const names=[...new Map(rows.map(r=>[normKey(r["Bairro"]),r["Bairro"]])).values()].filter(Boolean).sort((a,b)=>a.localeCompare(b,"pt-BR"));
 $("bairroSelect").innerHTML=names.length
   ? '<option value="">Selecione o bairro...</option>'+names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("")
   : '<option value="">Nenhum bairro encontrado</option>';
 $("bairroSelect").disabled=!names.length;
 $("editSequence").disabled=true;
 if(!names.length && rows.length){
   $("fileInfo").textContent += " — Não foram encontrados nomes de bairro nas linhas importadas.";
 }
 renderSavedRules();
 populateQuadraBairros();
}
function renderSavedRules(){
 const rules=loadRules(), names=Object.keys(rules);
 $("savedRules").innerHTML=names.length?'<b>Regras salvas:</b> '+names.map(k=>`<span class="ruleTag">${escapeHtml(rules[k].bairro)}</span>`).join(" "):'<span class="muted">Nenhuma sequência salva ainda.</span>';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function findHeaderRow(data){
 const max=Math.min(data.length,20);
 for(let i=0;i<max;i++){
   const headers=(data[i]||[]).map(cleanText);
   const addr=findColumn(headers,["Destination Address","Endereço","Endereco","Address","Destino","Rua"]);
   const bairro=findColumn(headers,["Bairro","Neighborhood","Distrito","Região","Regiao","District"]);
   if(addr>=0&&bairro>=0)return i;
 }
 return 0;
}
function findHeaderRow(data){
 const max=Math.min(data.length,20);
 for(let i=0;i<max;i++){
   const headers=(data[i]||[]).map(cleanText);
   const addr=findColumn(headers,["Destination Address","Endereço","Endereco","Address","Destino","Rua"]);
   if(addr>=0)return i;
 }
 return 0;
}
function convertSheet(data){
 if(!data.length)throw new Error("A planilha está vazia.");
 const headerRow=findHeaderRow(data),headers=(data[headerRow]||[]).map(cleanText);
 const numIdx=findColumn(headers,["Stop","Sequence","Número","Numero","AT ID","Parada","Ordem"]);
 const addrIdx=findColumn(headers,["Destination Address","Endereço","Endereco","Address","Destino","Rua"]);
 const bairroIdx=findColumn(headers,["Bairro","Neighborhood","Distrito","Região","Regiao","District"]);
 if(addrIdx<0)throw new Error("Não encontrei a coluna de Endereço.");
 return data.slice(headerRow+1).map((r,idx)=>{
   const rawAddress=cleanText(r[addrIdx]);
   const explicitBairro=bairroIdx>=0?cleanText(r[bairroIdx]):"";
   // O endereço é a fonte principal: se houver um bairro reconhecido nele,
   // ele vence o bairro informado em outra coluna.
   const detected=detectBairroFromAddress(rawAddress);
   const bairro=normalizeBairro(detected||explicitBairro||"");
   return {
     Número:numIdx>=0&&cleanText(r[numIdx])&&cleanText(r[numIdx])!=="-"?cleanText(r[numIdx]):String(idx+1),
     Endereço:normalizeQuadras(rawAddress),
     Bairro:bairro,
     _quadra:extractQuadra(rawAddress),
     _numeroCasa:extractHouseNumber(rawAddress),
     _originalIndex:idx
   };
 }).filter(r=>r["Endereço"]||r["Bairro"]);
}

const QUADRA_RULES_KEY="romaneio_quadra_sequences_v1";
function loadQuadraRules(){try{return JSON.parse(localStorage.getItem(QUADRA_RULES_KEY)||"{}")}catch(e){return {}}}
function saveQuadraRules(x){localStorage.setItem(QUADRA_RULES_KEY,JSON.stringify(x))}
function normalizeQuadraToken(text){const m=normalizeQuadras(text).match(/\bQD\s*(\d+)\b/i);return m?String(Number(m[1])):""}
function renderQuadraRules(){
 const box=$("quadraRulesList"),rules=loadQuadraRules(),keys=Object.keys(rules);
 box.innerHTML=keys.length?'<b>Sequências salvas:</b> '+keys.map(k=>`<span class="ruleTag">${escapeHtml(rules[k].bairro)}: ${rules[k].sequence.map(x=>"QD "+x).join(" → ")}</span>`).join(" "):'<span class="muted">Nenhuma sequência de quadras salva ainda.</span>';
}
function populateQuadraBairros(){
 const names=[...new Map(rows.map(r=>[normKey(r.Bairro),r.Bairro])).values()].filter(Boolean).sort((a,b)=>a.localeCompare(b,"pt-BR"));
 $("quadraBairroSelect").innerHTML=names.length?'<option value="">Selecione o bairro...</option>'+names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join(""):'<option value="">Nenhum bairro encontrado</option>';
 renderQuadraRules();
}
function applyQuadraSequences(list){
 const rules=loadQuadraRules();
 return list.map(r=>({...r})).sort((a,b)=>{
  const nb=normKey(a.Bairro).localeCompare(normKey(b.Bairro),"pt-BR"); if(nb)return nb;
  const rule=rules[normKey(a.Bairro)];
  if(rule){
   const ia=rule.sequence.indexOf(normalizeQuadraToken(a.Endereço)),ib=rule.sequence.indexOf(normalizeQuadraToken(b.Endereço));
   if(ia>=0||ib>=0){if(ia<0)return 1;if(ib<0)return -1;if(ia!==ib)return ia-ib}
  }
  if(a._quadra!==b._quadra)return a._quadra-b._quadra;
  if(a._numeroCasa!==b._numeroCasa)return a._numeroCasa-b._numeroCasa;
  return a._originalIndex-b._originalIndex;
 });
}
function applySavedSequence(list){
 const rules=loadRules();
 return applyQuadraSequences(list).sort((a,b)=>{
  const nb=normKey(a["Bairro"]).localeCompare(normKey(b["Bairro"]),"pt-BR"); if(nb)return nb;
  const rule=rules[normKey(a["Bairro"])];
  if(rule){
   const ia=rule.keys.indexOf(addressKey(a)),ib=rule.keys.indexOf(addressKey(b));
   if(ia>=0||ib>=0){if(ia<0)return 1;if(ib<0)return -1;if(ia!==ib)return ia-ib}
  }
  if(a._quadra!==b._quadra)return a._quadra-b._quadra;
  if(a._numeroCasa!==b._numeroCasa)return a._numeroCasa-b._numeroCasa;
  return a._originalIndex-b._originalIndex;
 });
}
function rebuildUnknownList(){
 const box=$("unknownList"),items=[];
 rows.forEach((r,i)=>{
  if(!r.Bairro)items.push({type:"bairro",line:i+2,address:r.Endereço});
  if(r.Endereço && normalizeQuadraToken(r.Endereço)==="")items.push({type:"quadra",line:i+2,address:r.Endereço,bairro:r.Bairro});
 });
 const first=items.slice(0,10);
 if(!first.length){box.innerHTML='<span class="muted">Nenhum erro encontrado ainda.</span>';return;}
 const map=loadBairroMap();
 const opts=Object.values(map).map(v=>`<option value="${escapeHtml(v.canonical)}">${escapeHtml(v.canonical)}</option>`).join("");
 box.innerHTML=first.map((x,i)=>`<div class="unknownRow"><b>Linha ${x.line}</b> — ${x.type==="bairro"?"Bairro":"Quadra"} não reconhecido<br><span>${escapeHtml(x.address)}</span>
 <div class="unknownActions">${x.type==="bairro"
 ? `<select data-ub="${i}"><option value="">Escolha o bairro oficial...</option>${opts}</select>`
 : `<select data-uq="${i}"><option value="">É qual quadra?</option>${[...Array(50)].map((_,n)=>`<option value="${n+1}">Quadra ${n+1}</option>`).join("")}</select>`}
 <button type="button" data-ua="${i}">Adicionar variação</button></div></div>`).join("");
 first.forEach((x,i)=>{
  box.querySelector(`[data-ua="${i}"]`).onclick=()=>{
   if(x.type==="bairro"){
    const canonical=box.querySelector(`[data-ub="${i}"]`).value;if(!canonical){alert("Escolha o bairro oficial.");return;}
    const map=loadBairroMap(),k=normKey(canonical);if(!map[k])return;
    const candidate=cleanText(x.address.split(",").slice(-1)[0]||"");
    if(candidate)map[k].aliases=[...new Set([...(map[k].aliases||[]),normKey(candidate)])];
    saveBairroMap(map);alert("Variação adicionada a "+canonical+".");reimport();
   }else{
    const n=box.querySelector(`[data-uq="${i}"]`).value;if(!n){alert("Escolha a quadra.");return;}
    const bairro=x.bairro;if(!bairro){alert("Primeiro reconheça o bairro.");return;}
    const rules=loadQuadraRules(),k=normKey(bairro),r=rules[k]||{bairro,sequence:[]};
    r.sequence=[...new Set([...r.sequence,String(Number(n))])];rules[k]=r;saveQuadraRules(rules);organize();
   }
  };
 });
}
function reimport(){
 const f=$("file").files[0];if(!f)return;
 f.arrayBuffer().then(buf=>{const wb=XLSX.read(buf,{type:"array"});rows=convertSheet(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""}));populateBairros();organize();});
}
function organize(){
 processed=applySavedSequence(rows);
 processed.forEach((r,i)=>r["Número"]=String(i+1));
 render();
}
function render(){
 rebuildUnknownList();
 const tb=$("preview").querySelector("tbody");tb.innerHTML="";
 processed.forEach((r,i)=>{
   if(i>0&&normKey(processed[i-1]["Bairro"])!==normKey(r["Bairro"])){const sep=document.createElement("tr");sep.className="bairroSep";sep.innerHTML='<td colspan="3"></td>';tb.appendChild(sep)}
   const tr=document.createElement("tr");["Número","Endereço","Bairro"].forEach(k=>{const td=document.createElement("td");td.textContent=r[k];tr.appendChild(td)});tb.appendChild(tr);
 });
 $("count").textContent=processed.length;$("bairros").textContent=new Set(processed.map(r=>normKey(r["Bairro"])).filter(Boolean)).size;$("quadras").textContent=processed.filter(r=>r._quadra!==999999).length;
 $("download").disabled=!processed.length;$("downloadCsv").disabled=!processed.length;
}
function openEditor(){
 currentBairro=$("bairroSelect").value;if(!currentBairro)return;
 sequenceDraft=rows.filter(r=>normKey(r["Bairro"])===normKey(currentBairro)).map(r=>({...r}));
 const rules=loadRules()[normKey(currentBairro)];
 if(rules){const order=rules.keys;sequenceDraft.sort((a,b)=>order.indexOf(addressKey(a))-order.indexOf(addressKey(b)))}
 $("editorTitle").textContent="Sequência: "+currentBairro;$("editorHint").textContent=` (${sequenceDraft.length} entregas)`;$("sequenceEditor").classList.remove("hidden");renderEditor();
}
function renderEditor(){
 const box=$("sequenceList");box.innerHTML="";
 sequenceDraft.forEach((r,i)=>{
   const div=document.createElement("div");div.className="seqRow";
   div.innerHTML=`<div class="seqPos">${i+1}</div><div class="seqText"><b>${escapeHtml(r["Endereço"])}</b><span>${escapeHtml(r["Bairro"])}</span></div><div class="seqBtns"><button type="button" data-up="${i}" ${i===0?"disabled":""}>↑</button><button type="button" data-down="${i}" ${i===sequenceDraft.length-1?"disabled":""}>↓</button></div>`;
   box.appendChild(div);
 });
 box.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.up);[sequenceDraft[i-1],sequenceDraft[i]]=[sequenceDraft[i],sequenceDraft[i-1]];renderEditor()});
 box.querySelectorAll("[data-down]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.down);[sequenceDraft[i+1],sequenceDraft[i]]=[sequenceDraft[i],sequenceDraft[i+1]];renderEditor()});
}
function saveCurrentSequence(){
 if(!currentBairro||!sequenceDraft.length)return;
 const rules=loadRules();rules[normKey(currentBairro)]={bairro:currentBairro,keys:sequenceDraft.map(addressKey),updatedAt:new Date().toISOString()};saveRules(rules);renderSavedRules();$("sequenceEditor").classList.add("hidden");organize();
}
$("file").addEventListener("change",async e=>{saveBairroList();const f=e.target.files[0];if(!f)return;try{const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});rows=convertSheet(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""}));$("fileInfo").textContent=`${f.name} — ${rows.length} entregas carregadas.`;$("process").disabled=false;populateBairros();processed=[];render()}catch(err){alert(err.message||"Não foi possível ler a planilha.")}});
$("applyRules").onclick=()=>{if(!rows.length)return;rows=rows.map(r=>({...r,Bairro:normalizeBairro(r.Bairro)}));populateBairros();organize()};
$("editSequence").onclick=openEditor;$("closeEditor").onclick=()=>$("sequenceEditor").classList.add("hidden");$("saveSequence").onclick=saveCurrentSequence;
$("bairroSelect").onchange=()=>{$("editSequence").disabled=!$("bairroSelect").value};
$("process").onclick=organize;
function exportMatrix(){const out=[["Número","Endereço","Bairro"]];processed.forEach((r,i)=>{if(i>0&&normKey(processed[i-1].Bairro)!==normKey(r.Bairro))out.push(["","",""]);out.push([r.Número,r.Endereço,r.Bairro])});return out}
$("download").onclick=()=>{const ws=XLSX.utils.aoa_to_sheet(exportMatrix()),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Entregas");XLSX.writeFile(wb,"entregas_organizadas.xlsx")};
$("downloadCsv").onclick=()=>{const csv=XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(exportMatrix())),blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="entregas_organizadas.csv";a.click();URL.revokeObjectURL(a.href)};
renderSavedRules();

$("applyBairroList").onclick=()=>{saveBairroList();if(rows.length){rows=rows.map(r=>({...r,Bairro:detectBairroFromAddress(r.Endereço)||r.Bairro}));populateBairros();organize();}alert("Lista de bairros salva. O sistema agora procura esses nomes dentro do endereço.");};

$("saveBairroMap").onclick=()=>{
 const canonical=$("canonicalBairro").value;
 const aliases=$("bairroAliases").value.split(/\r?\n/);
 if(!cleanText(canonical)){alert("Digite o nome oficial do bairro.");return;}
 registerBairro(canonical,aliases);
 $("canonicalBairro").value="";
 $("bairroAliases").value="";
 if(rows.length){rows=rows.map(r=>({...r,Bairro:detectBairroFromAddress(r.Endereço)||r.Bairro}));populateBairros();organize();}
 alert("Bairro salvo: "+cleanText(canonical));
};
renderBairroMap();

$("quadraBairroSelect").onchange=()=>{
 const bairro=$("quadraBairroSelect").value,r=loadQuadraRules()[normKey(bairro)];
 $("quadraSequence").value=r?r.sequence.map(x=>"Quadra "+String(Number(x)).padStart(2,"0")).join("\n"):"";
};
$("saveQuadraSequence").onclick=()=>{
 const bairro=$("quadraBairroSelect").value;
 if(!bairro){alert("Selecione um bairro.");return;}
 const seq=[...new Set($("quadraSequence").value.split(/\r?\n/).map(normalizeQuadraToken).filter(Boolean))];
 if(!seq.length){alert("Digite pelo menos uma quadra.");return;}
 const rules=loadQuadraRules();rules[normKey(bairro)]={bairro,sequence:seq};
 saveQuadraRules(rules);renderQuadraRules();organize();
 alert("Sequência de quadras salva para "+bairro+".");
};
renderQuadraRules();
