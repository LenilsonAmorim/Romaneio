let rows=[],processed=[],currentFile=null;
const $=id=>document.getElementById(id);
const ROUTE_RULES_KEY="romaneio_route_rules_v2";

function cleanText(v){return String(v??"").replace(/\s+/g," ").trim()}
function normKey(v){return cleanText(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function loadRouteRules(){try{return JSON.parse(localStorage.getItem(ROUTE_RULES_KEY)||"{}")}catch(e){return {}}}
function saveRouteRules(x){localStorage.setItem(ROUTE_RULES_KEY,JSON.stringify(x))}
function autoQuadraVariants(n){
 const x=String(Number(n)),p=String(Number(n)).padStart(2,"0");
 return [`Quadra ${x}`,`Quadra ${p}`,`QD${x}`,`QD ${x}`,`QD${p}`,`QD ${p}`,`Q${x}`,`Q ${x}`,`Q${p}`,`Q ${p}`,`Q D ${p}`];
}
function quadraNumber(text){
 const s=cleanText(text);
 let m=s.match(/^\s*([A-Za-z])\s*0*(\d+)\s*$/);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));
 m=s.match(/\bquadra\s*([A-Za-z])\s*[-.:]?\s*0*(\d+)\b/i);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));
 m=s.match(/\bq\s*d?\s*[-.:]?\s*0*(\d+)\b/i);
 if(m)return "D"+String(Number(m[1]));
 return "";
}
function normalizeQuadras(text){
 return cleanText(text);
}
function extractQuadra(text){const n=quadraNumber(text);return n?Number(n):999999}
function extractHouseNumber(text){
 let m=cleanText(text).match(/,\s*0*(\d+)\b/);
 if(m)return Number(m[1]);
 return 999999;
}

function registerBairro(canonical,aliases=[]){
 const c=cleanText(canonical);if(!c)return;
 const rules=loadRouteRules(),key=normKey(c);
 const old=rules[key]||{bairro:c,sequence:[],aliases:[]};
 const generated=[c,c.replace(/\bConjunto\b/gi,"Conj"),c.replace(/\bConjunto\b/gi,"Conj."),c.normalize("NFD").replace(/[\u0300-\u036f]/g,"")];
 const all=[...generated,...aliases.map(cleanText)].filter(Boolean);
 old.bairro=c;
 old.aliases=[...new Set([...(old.aliases||[]),...all.map(normKey)])];
 rules[key]=old;saveRouteRules(rules);renderRouteRules();
}
function saveRouteRule(){
 const bairro=cleanText($("routeBairroName").value);
 if(!bairro){alert("Digite o nome oficial do bairro.");return}
 const aliases=$("routeBairroAliases").value.split(/\r?\n/).map(cleanText).filter(Boolean);
 const seq=[...new Set($("routeSequence").value.split(/\r?\n/).map(quadraNumber).filter(Boolean))];
 if(!seq.length){alert("Digite pelo menos uma quadra na sequência.");return}
 const rules=loadRouteRules(),key=normKey(bairro);
 const existing=rules[key]||{};
 const generated=[bairro,bairro.replace(/\bConjunto\b/gi,"Conj"),bairro.replace(/\bConjunto\b/gi,"Conj."),bairro.normalize("NFD").replace(/[\u0300-\u036f]/g,"")];
 rules[key]={
   bairro,
   aliases:[...new Set([...(existing.aliases||[]),...generated.map(normKey),...aliases.map(normKey)])],
   sequence:seq,
   variants:Object.fromEntries(seq.map(n=>[n,autoQuadraVariants(n)]))
 };
 saveRouteRules(rules);
 renderRouteRules();
 $("routeBairroName").value="";
 $("routeBairroAliases").value="";
 $("routeSequence").value="";
 alert("Bairro e sequência salvos para "+bairro+".");
}
function renderRouteRules(){
 const box=$("routeRulesList"),rules=loadRouteRules(),keys=Object.keys(rules);
 if(!keys.length){box.innerHTML='<span class="muted">Nenhuma regra salva ainda.</span>';return}
 box.innerHTML=keys.map(k=>{
   const r=rules[k],seq=(r.sequence||[]).map(n=>"QD "+n).join(" → ");
   return `<div class="savedRule"><div><strong>${escapeHtml(r.bairro)}</strong><div class="muted">${escapeHtml(seq||"Sem sequência")}</div></div><button type="button" class="editBtn" data-edit-route="${escapeHtml(k)}">Editar</button></div>`;
 }).join("");
 box.querySelectorAll("[data-edit-route]").forEach(btn=>btn.onclick=()=>openRouteEditor(btn.dataset.editRoute));
}
function openRouteEditor(key){
 const rules=loadRouteRules(),r=rules[key];if(!r)return;
 editingRouteKey=key;
 $("editRouteBairro").value=r.bairro||"";
 $("editRouteAliases").value=(r.aliases||[]).join("\n");
 $("editRouteSequence").value=(r.sequence||[]).join("\n");
 $("routeEditor").hidden=false;
}
function closeRouteEditor(){
 editingRouteKey="";
 $("routeEditor").hidden=true;
}
function saveEditedRoute(){
 if(!editingRouteKey)return;
 const oldKey=editingRouteKey;
 const bairro=cleanText($("editRouteBairro").value);
 const aliases=$("editRouteAliases").value.split(/\r?\n/).map(cleanText).filter(Boolean);
 const seq=[...new Set($("editRouteSequence").value.split(/\r?\n/).map(quadraNumber).filter(Boolean))];
 if(!bairro){alert("Digite o nome oficial do bairro.");return}
 if(!seq.length){alert("Digite pelo menos uma quadra.");return}
 const rules=loadRouteRules();
 delete rules[oldKey];
 const key=normKey(bairro);
 rules[key]={bairro,aliases:[...new Set(aliases.map(normKey))],sequence:seq,variants:Object.fromEntries(seq.map(n=>[n,autoQuadraVariants(n)]))};
 saveRouteRules(rules);
 closeRouteEditor();
 renderRouteRules();
 if(rows.length)analyze();
}
function clearEditRoute(){
 $("editRouteBairro").value="";
 $("editRouteAliases").value="";
 $("editRouteSequence").value="";
 $("editRouteBairro").focus();
}

function findColumn(headers,patterns){
 const n=headers.map(normKey);
 for(const p of patterns){const i=n.findIndex(h=>h===normKey(p));if(i>=0)return i}
 for(const p of patterns){const i=n.findIndex(h=>h.includes(normKey(p)));if(i>=0)return i}
 return -1;
}
function findHeaderRow(data){
 for(let i=0;i<Math.min(15,data.length);i++){
  const h=(data[i]||[]).map(normKey);
  if(h.some(x=>x.includes("endereco")||x.includes("destination address")||x.includes("address")))return i;
 }
 return 0;
}

function findBairroInText(text){
 const key=normKey(text);if(!key)return "";
 const rules=loadRouteRules(),matches=[];
 for(const r of Object.values(rules)){
  const candidates=[r.bairro,...(r.aliases||[])].map(normKey).filter(Boolean);
  for(const a of candidates)if(key.includes(a))matches.push({bairro:r.bairro,len:a.length});
 }
 matches.sort((a,b)=>b.len-a.len);
 return matches.length?matches[0].bairro:"";
}

function convertSheet(data){
 if(!data.length)throw new Error("A planilha está vazia.");
 const hr=findHeaderRow(data),headers=(data[hr]||[]).map(cleanText);
 const addrIdx=findColumn(headers,["Endereço","Endereco","Destination Address","Address","Destino","Rua"]);
 const bairroIdx=findColumn(headers,["Bairro","Neighborhood","Distrito","Região","Regiao","District"]);
 const numIdx=findColumn(headers,["Número","Numero","Número da entrega","Stop","Sequence","Parada","Ordem","AT ID"]);
 if(addrIdx<0)throw new Error("Não encontrei a coluna de Endereço.");
 const rules=loadRouteRules();
 return data.slice(hr+1).map((r,idx)=>{
   const address=cleanText(r[addrIdx]), columnBairro=bairroIdx>=0?cleanText(r[bairroIdx]):"";
   const fromAddress=findBairroInText(address);
   const fromColumn=fromAddress?"":findBairroInText(columnBairro);
   const bairro=fromAddress||fromColumn||"";
   return {
     "Número":numIdx>=0&&cleanText(r[numIdx])?cleanText(r[numIdx]):String(idx+1),
     "Endereço":normalizeQuadras(address),
     "Bairro":bairro,
     "_bairroSource":fromAddress?"endereço":fromColumn?"coluna":"não reconhecido",
     "_quadra":extractQuadra(address),
     "_numeroCasa":extractHouseNumber(address),
     "_originalIndex":idx
   };
 }).filter(r=>r["Endereço"]||r["Bairro"]);
}

function applyRouteRules(list){
 const rules=loadRouteRules(),groups=new Map();
 list.forEach(r=>{
  const key=normKey(r.Bairro)||"__NAO_RECONHECIDO__";
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push({...r});
 });
 const ordered=[...groups.entries()].sort((a,b)=>{
  if(a[0]==="__NAO_RECONHECIDO__")return 1;
  if(b[0]==="__NAO_RECONHECIDO__")return -1;
  return a[1][0].Bairro.localeCompare(b[1][0].Bairro,"pt-BR");
 });
 const out=[];
 ordered.forEach(([key,items])=>{
  if(key!=="__NAO_RECONHECIDO__"){
   const rule=rules[key],seq=rule?.sequence||[];
   items.sort((a,b)=>{
    if(seq.length){
     const ia=seq.indexOf(String(a._quadra)),ib=seq.indexOf(String(b._quadra));
     if(ia>=0||ib>=0){if(ia<0)return 1;if(ib<0)return -1;if(ia!==ib)return ia-ib}
    }
    if(a._quadra!==b._quadra)return a._quadra-b._quadra;
    if(a._numeroCasa!==b._numeroCasa)return a._numeroCasa-b._numeroCasa;
    return a._originalIndex-b._originalIndex;
   });
  }else items.sort((a,b)=>a._originalIndex-b._originalIndex);
  out.push(...items);
 });
 return out;
}

function analyze(){
 if(!rows.length)return;
 processed=applyRouteRules(rows);
 processed.forEach((r,i)=>r["Número"]=String(i+1));
 render();
 const unknown=rows.filter(r=>!r.Bairro).length;
 $("fileInfo").innerHTML=`<span class="statusOk">${escapeHtml(currentFile?.name||"Planilha")} analisada: ${rows.length} entregas.</span> ${unknown?`<span class="statusWarn">${unknown} não reconhecida(s).</span>`:"Todos os bairros foram reconhecidos."}`;
}
function render(){
 const tb=$("preview").querySelector("tbody");tb.innerHTML="";
 processed.forEach((r,i)=>{
  if(i>0&&normKey(processed[i-1].Bairro)!==normKey(r.Bairro)){
   const sep=document.createElement("tr");sep.className="bairroSep";sep.innerHTML="<td colspan='3'></td>";tb.appendChild(sep);
  }
  const tr=document.createElement("tr");
  ["Número","Endereço","Bairro"].forEach(k=>{const td=document.createElement("td");td.textContent=r[k];tr.appendChild(td)});
  tb.appendChild(tr);
 });
 $("count").textContent=processed.length;
 $("bairros").textContent=new Set(processed.map(r=>normKey(r.Bairro)).filter(Boolean)).size;
 $("quadras").textContent=processed.filter(r=>r._quadra!==999999).length;
 $("download").disabled=!processed.length;$("downloadCsv").disabled=!processed.length;
 renderUnknown();
}
function renderUnknown(){
 const box=$("unknownList"),unknown=rows.filter(r=>!r.Bairro).slice(0,10);
 if(!unknown.length){box.innerHTML='<span class="muted">Nenhum erro encontrado ainda.</span>';return}
 box.innerHTML=unknown.map((r,i)=>`<div class="unknownRow"><b>Linha ${r._originalIndex+2}</b><div class="addr">${escapeHtml(r["Endereço"])}</div><div class="unknownActions"><input id="unknownAlias${i}" type="text" placeholder="Variação do bairro que apareceu"><select id="unknownBairro${i}"><option value="">Escolha o bairro oficial...</option>${Object.values(loadRouteRules()).map(x=>`<option value="${escapeHtml(x.bairro)}">${escapeHtml(x.bairro)}</option>`).join("")}</select><button type="button" data-unknown="${i}">Adicionar variação</button></div></div>`).join("");
 box.querySelectorAll("[data-unknown]").forEach(btn=>btn.onclick=()=>{
  const i=Number(btn.dataset.unknown),canonical=$("unknownBairro"+i).value,alias=cleanText($("unknownAlias"+i).value);
  if(!canonical||!alias){alert("Escolha o bairro oficial e digite a variação.");return}
  const rules=loadRouteRules(),key=normKey(canonical);
  rules[key].aliases=[...new Set([...(rules[key].aliases||[]),normKey(alias)])];
  saveRouteRules(rules);analyze();alert("Variação adicionada a "+canonical+".");
 });
}

$("file").addEventListener("change",async e=>{
 const f=e.target.files[0];if(!f)return;
 currentFile=f;$("fileInfo").textContent=`Lendo ${f.name}...`;$("analyze").disabled=true;
 try{
  const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});
  rows=convertSheet(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""}));
  $("analyze").disabled=!rows.length;
  analyze();
 }catch(err){$("fileInfo").textContent="Erro: "+(err.message||"Não foi possível ler a planilha.");alert(err.message||"Não foi possível ler a planilha.");}
});
$("analyze").onclick=analyze;
$("saveRouteRule").onclick=saveRouteRule;
$("saveEditedRoute").onclick=saveEditedRoute;
$("clearEditRoute").onclick=clearEditRoute;
$("cancelEditRoute").onclick=closeRouteEditor;

function exportMatrix(){
 const out=[["Número","Endereço","Bairro"]];
 processed.forEach((r,i)=>{
  if(i>0&&normKey(processed[i-1].Bairro)!==normKey(r.Bairro))out.push(["","",""]);
  out.push([r["Número"],r["Endereço"],r["Bairro"]]);
 });
 return out;
}
$("download").onclick=()=>{
 const ws=XLSX.utils.aoa_to_sheet(exportMatrix()),wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,ws,"Entregas");XLSX.writeFile(wb,"entregas_organizadas.xlsx");
};
$("downloadCsv").onclick=()=>{
 const csv=XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(exportMatrix()));
 const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
 a.href=URL.createObjectURL(blob);a.download="entregas_organizadas.csv";a.click();URL.revokeObjectURL(a.href);
};
renderRouteRules();
renderUnknown();
