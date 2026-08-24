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

 // Rota cadastrada: letra + número (D5, A1, QA3 -> A3).
 let m=s.match(/^\s*(?:Q\s*)?([A-Za-z])\s*0*(\d+)\s*$/i);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));

 // QA3 / Q A3 / Q-A3 / Q A 3 -> A3.
 m=s.match(/\bq\s*[-.:]?\s*([A-Za-z])\s*0*(\d+)\b/i);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));

 // QD-D5, QD-A1, QD-01, QD01, QD 01.
 m=s.match(/\bqd\s*[-.:]?\s*([A-Za-z])\s*0*(\d+)\b/i);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));
 m=s.match(/\bqd\s*[-.:]?\s*0*(\d+)\b/i);
 if(m)return "D"+String(Number(m[1]));

 // Quadra D5 / Quadra A1 / Quadra 01.
 m=s.match(/\bquadra\s*[-.:]?\s*([A-Za-z])\s*0*(\d+)\b/i);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));
 m=s.match(/\bquadra\s*[-.:]?\s*0*(\d+)\b/i);
 if(m)return "D"+String(Number(m[1]));

 // Q-3 / Q 3 / Q3 -> D3 (quando não há letra).
 m=s.match(/\bq\s*[-.:]?\s*0*(\d+)\b/i);
 if(m)return "D"+String(Number(m[1]));

 // Token isolado A3, D9 etc. dentro do endereço.
 m=s.match(/(?:^|[\s,;\/-])([A-Za-z])\s*0*(\d+)(?=$|[\s,;\/-])/);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));

 return "";
}
function routeToken(text){
 const s=cleanText(text);
 if(!s)return "";
 const q=quadraNumber(s);
 return q || s;
}
function routeKey(text){
 const q=quadraNumber(text);
 return q ? "Q:"+q : "T:"+normKey(text);
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
 const seq=[...new Set($("routeSequence").value.split(/\r?\n/).map(routeToken).filter(Boolean))];
 const noQuadra=!!$("routeNoQuadra").checked;
 if(!seq.length && !noQuadra){alert("Digite pelo menos uma quadra na sequência ou marque “não usa quadra”.");return}
 const rules=loadRouteRules(),key=normKey(bairro);
 const existing=rules[key]||{};
 const generated=[bairro,bairro.replace(/\bConjunto\b/gi,"Conj"),bairro.replace(/\bConjunto\b/gi,"Conj."),bairro.normalize("NFD").replace(/[\u0300-\u036f]/g,"")];
 rules[key]={
   bairro,
   aliases:[...new Set([...(existing.aliases||[]),...generated.map(normKey),...aliases.map(normKey)])],
   sequence:seq,
   noQuadra:!!$("routeNoQuadra").checked,
   variants:Object.fromEntries(seq.map(n=>[n,autoQuadraVariants(n)]))
 };
 saveRouteRules(rules);
 renderRouteRules();
 renderSavedVariations();
 $("routeBairroName").value="";
 $("routeBairroAliases").value="";
 $("routeSequence").value="";
 $("routeNoQuadra").checked=false;
 alert("Bairro e sequência salvos para "+bairro+".");
}
function renderRouteRules(){
 const box=$("routeRulesList"),rules=loadRouteRules(),keys=Object.keys(rules);
 if(!keys.length){box.innerHTML='<span class="muted">Nenhuma regra salva ainda.</span>';return}
 box.innerHTML=keys.map(k=>{
   const r=rules[k],seq=(r.sequence||[]).map(n=>"QD "+n).join(" → ");
   const desc=r.noQuadra?"Sem quadras — nome do local é suficiente":(seq||"Sem sequência");
   return `<div class="savedRule"><div><strong>${escapeHtml(r.bairro)}</strong><div class="muted">${escapeHtml(desc)}</div></div><div class="ruleButtons"><button type="button" class="editBtn" data-edit-route="${escapeHtml(k)}">Editar</button><button type="button" class="deleteBtn" data-delete-route="${escapeHtml(k)}">Remover</button></div></div>`;
 }).join("");
 box.querySelectorAll("[data-edit-route]").forEach(btn=>btn.onclick=()=>openRouteEditor(btn.dataset.editRoute));
 box.querySelectorAll("[data-delete-route]").forEach(btn=>btn.onclick=()=>{
   const key=btn.dataset.deleteRoute, rules=loadRouteRules(), r=rules[key];
   if(!r)return;
   if(!confirm(`Remover o bairro "${r.bairro}" e toda a sequência salva?`))return;
   delete rules[key];
   saveRouteRules(rules);
   if(editingRouteKey===key)closeRouteEditor();
   renderRouteRules();
   if(rows.length)analyze();
 });
}
function openRouteEditor(key){
 const rules=loadRouteRules(),r=rules[key];if(!r)return;
 editingRouteKey=key;
 $("editRouteBairro").value=r.bairro||"";
 $("editRouteAliases").value=(r.aliases||[]).join("\n");
 $("editRouteSequence").value=(r.sequence||[]).join("\n");
 $("editRouteNoQuadra").checked=!!r.noQuadra;
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
 const seq=[...new Set($("editRouteSequence").value.split(/\r?\n/).map(routeToken).filter(Boolean))];
 if(!bairro){alert("Digite o nome oficial do bairro.");return}
 const noQuadra=!!$("editRouteNoQuadra").checked;
 if(!seq.length && !noQuadra){alert("Digite pelo menos uma quadra ou marque “não usa quadra”.");return}
 const rules=loadRouteRules();
 delete rules[oldKey];
 const key=normKey(bairro);
 rules[key]={bairro,aliases:[...new Set(aliases.map(normKey))],sequence:seq,noQuadra,variants:Object.fromEntries(seq.map(n=>[n,autoQuadraVariants(n)]))};
 saveRouteRules(rules);
 closeRouteEditor();
 renderRouteRules();
 if(rows.length)analyze();
}
function clearEditRoute(){
 $("editRouteBairro").value="";
 $("editRouteAliases").value="";
 $("editRouteSequence").value="";
 $("editRouteNoQuadra").checked=false;
 $("editRouteBairro").focus();
}

function renderSavedVariations(){
 const box=$("savedVariationsList");
 if(!box)return;
 const rules=loadRouteRules(), items=[];
 Object.entries(rules).forEach(([key,r])=>{
   (r.aliases||[]).forEach(alias=>{
     const a=cleanText(alias); if(!a)return;
     if(normKey(a)===normKey(r.bairro))return;
     items.push({key,bairro:r.bairro,alias:a});
   });
 });
 if(!items.length){box.innerHTML='<span class="muted">Nenhuma variação salva ainda.</span>';return}
 box.innerHTML=items.map((x,i)=>`<div class="variationRow">
   <div class="variationText"><strong>${escapeHtml(x.alias)}</strong><span>→ ${escapeHtml(x.bairro)}</span></div>
   <div class="variationActions">
     <button type="button" class="editBtn" data-edit-variation="${i}">Corrigir</button>
     <button type="button" class="deleteBtn" data-delete-variation="${i}">Remover</button>
   </div>
 </div>`).join('');
 box.querySelectorAll('[data-edit-variation]').forEach(btn=>btn.onclick=()=>{
   const x=items[Number(btn.dataset.editVariation)];
   const rules=loadRouteRules();
   const options=Object.values(rules).map(r=>`<option value="${escapeHtml(r.bairro)}" ${normKey(r.bairro)===normKey(x.bairro)?'selected':''}>${escapeHtml(r.bairro)}</option>`).join('');
   const escolha=prompt(`Variação: ${x.alias}\nDigite o nome EXATO do bairro correto:\n\n${Object.values(rules).map(r=>r.bairro).join('\n')}`,x.bairro);
   if(escolha===null)return;
   const alvo=Object.values(rules).find(r=>normKey(r.bairro)===normKey(escolha));
   if(!alvo){alert('Bairro não encontrado. Digite o nome oficial exatamente como está cadastrado.');return}
   setBairroVariation(x.alias,alvo.bairro);
   renderRouteRules(); renderSavedVariations();
   if(rows.length)analyze();
   alert(`Variação "${x.alias}" agora pertence a ${alvo.bairro}.`);
 });
 box.querySelectorAll('[data-delete-variation]').forEach(btn=>btn.onclick=()=>{
   const x=items[Number(btn.dataset.deleteVariation)];
   const rules=loadRouteRules(),r=rules[x.key]; if(!r)return;
   if(!confirm(`Remover a variação "${x.alias}" de ${r.bairro}?`))return;
   r.aliases=(r.aliases||[]).filter(a=>normKey(a)!==normKey(x.alias));
   saveRouteRules(rules); renderSavedVariations();
   if(rows.length)analyze();
 });
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

 // Alguns conjuntos têm o mesmo nome-base de outro bairro/conjunto.
 // Ex.: "Citta Antônio Lins" contém "Antônio Lins", mas "Citta" é
 // a identificação específica e deve vencer a correspondência genérica.
 const strongMarkers=["citta"];

 for(const r of Object.values(rules)){
  const candidates=[r.bairro,...(r.aliases||[])].map(normKey).filter(Boolean);
  for(const a of candidates){
   if(!a || !key.includes(a))continue;
   const markerHits=strongMarkers.filter(m=>a.includes(m) && key.includes(m)).length;
   matches.push({
     bairro:r.bairro,
     len:a.length,
     priority:markerHits ? 100000 + markerHits*1000 : 0
   });
  }
 }
 matches.sort((a,b)=>
   b.priority-a.priority ||
   b.len-a.len
 );
 return matches.length?matches[0].bairro:"";
}

// Associa uma variação a um único bairro. Antes de salvar, remove a mesma
// variação de todos os outros bairros para evitar que uma nova análise
// continue mandando a linha para o bairro errado.
function setBairroVariation(variation,canonical){
 const alias=normKey(variation),dest=normKey(canonical);
 if(!alias||!dest)return false;
 const rules=loadRouteRules(),target=rules[dest];
 if(!target)return false;
 Object.values(rules).forEach(r=>{
   r.aliases=(r.aliases||[]).filter(a=>normKey(a)!==alias);
 });
 if(normKey(target.bairro)!==alias){
   target.aliases=[...new Set([...(target.aliases||[]),alias])];
 }
 saveRouteRules(rules);
 return true;
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
     "Bairro":bairro||columnBairro||"Não informado",
     "_bairroOriginal":columnBairro||"Não informado",
     "_bairroReconhecido":!!bairro,
     "_bairroSource":fromAddress?"endereço":fromColumn?"coluna":"não reconhecido",
     "_pendenteBairro":!bairro,
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
 const unresolved=[];
 const resolvedGroups=[];
 [...groups.entries()].forEach(([key,items])=>{
  const isPending=items.some(r=>r._pendenteBairro);
  if(isPending){
    // Tudo que ainda não foi associado fica no topo da rota, mantendo o
    // bairro original da planilha para você poder corrigir depois.
    items.forEach(r=>{r._quadraReconhecida=false;r._sequenceIndex=-1;});
    items.sort((a,b)=>a._originalIndex-b._originalIndex);
    unresolved.push(...items);
    return;
  }
  const rule=rules[key],seq=rule?.sequence||[];
  if(rule?.noQuadra){
    // Condomínios/bairros sem quadra: o reconhecimento do nome já basta.
    items.forEach((r,i)=>{
      r._sequenceIndex=0;
      r._quadraReconhecida=true;
    });
  }else{
    items.forEach(r=>{
      const idx=seq.findIndex(x=>routeKey(x)===routeKey(r["Endereço"]));
      r._sequenceIndex=idx;
      r._quadraReconhecida=idx>=0;
    });
  }
  // Dentro de cada bairro, quadras fora da sequência ficam primeiro e em vermelho.
  items.sort((a,b)=>{
    const am=a._quadraReconhecida?1:0,bm=b._quadraReconhecida?1:0;
    if(am!==bm)return am-bm;
    if(am===0){
      if(a._quadra!==b._quadra)return a._quadra-b._quadra;
      return a._originalIndex-b._originalIndex;
    }
    if(a._sequenceIndex!==b._sequenceIndex)return a._sequenceIndex-b._sequenceIndex;
    if(a._numeroCasa!==b._numeroCasa)return a._numeroCasa-b._numeroCasa;
    return a._originalIndex-b._originalIndex;
  });
  resolvedGroups.push(items);
 });
 // Pendências sempre são as primeiras linhas de tudo. Depois vêm os bairros.
 const orderedGroups=resolvedGroups.sort((a,b)=>{
   const aa=a[0]?.Bairro||"",bb=b[0]?.Bairro||"";
   return aa.localeCompare(bb,"pt-BR");
 });
 return [...unresolved,...orderedGroups.flat()];
}

function analyze(){
 if(!rows.length)return;
 processed=applyRouteRules(rows);
 processed.forEach((r,i)=>r["Número"]=String(i+1));
 render();
 const unknown=rows.filter(r=>r._pendenteBairro).length;
 $("fileInfo").innerHTML=`<span class="statusOk">${escapeHtml(currentFile?.name||"Planilha")} analisada: ${rows.length} entregas.</span> ${unknown?`<span class="statusWarn">${unknown} não reconhecida(s).</span>`:"Todos os bairros foram reconhecidos."}`;
}
function render(){
 const tb=$("preview").querySelector("tbody");tb.innerHTML="";
 processed.forEach((r,i)=>{
  if(i>0&&normKey(processed[i-1].Bairro)!==normKey(r.Bairro)){
   const sep=document.createElement("tr");sep.className="bairroSep";sep.innerHTML="<td colspan='3'></td>";tb.appendChild(sep);
  }
  const tr=document.createElement("tr");
  if(r.Bairro && r._quadraReconhecida===false) tr.className="routeUnmatched";
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
 const box=$("unknownList"),unknown=rows.filter(r=>r._pendenteBairro);
 if(!unknown.length){box.innerHTML='<span class="muted">Nenhum endereço pendente.</span>';return}
 const rules=loadRouteRules();
 box.innerHTML=unknown.slice(0,20).map((r,i)=>{
   const original=cleanText(r["_bairroOriginal"]);
   return `<div class="unknownRow">
   <b>PRIORIDADE ${i+1} • Linha ${r._originalIndex+2}</b>
   <div class="addr"><b>Endereço:</b> ${escapeHtml(r["Endereço"])}</div>
   <div class="addr"><b>Bairro informado:</b> ${escapeHtml(original||"Não informado")}</div>
   <div class="unknownActions">
     <input id="unknownAlias${i}" type="text" value="${escapeHtml(original)}" placeholder="Variação do bairro (opcional)">
     <select id="unknownBairro${i}">
       <option value="">Deixar pendente</option>
       ${Object.values(rules).map(x=>`<option value="${escapeHtml(x.bairro)}">${escapeHtml(x.bairro)}</option>`).join("")}
     </select>
     <button type="button" data-unknown="${i}">Salvar correção</button>
   </div>
   <small class="muted">Se deixar o bairro vazio, nada é alterado e este endereço continuará nas primeiras linhas.</small>
 </div>`;
 }).join("");
 box.querySelectorAll("[data-unknown]").forEach(btn=>btn.onclick=()=>{
   const i=Number(btn.dataset.unknown),canonical=cleanText($("unknownBairro"+i).value);
   if(!canonical){alert("Nada foi alterado. Este endereço continuará no topo para você corrigir depois.");return}
   const alias=cleanText($("unknownAlias"+i).value)||cleanText(unknown[i]["_bairroOriginal"]);
   if(!alias||alias==="Não informado"){alert("Digite a variação do bairro ou informe o bairro correto.");return}
   if(!setBairroVariation(alias,canonical)){alert("Não foi possível salvar a associação. Verifique se o bairro está cadastrado.");return}
   renderRouteRules();renderSavedVariations();analyze();
   alert(`Correção salva: "${alias}" → ${canonical}. Agora a análise foi refeita.`);
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
$("analyze").onclick=async ()=>{
 if(!currentFile)return;
 try{
  $("fileInfo").textContent=`Reanalisando ${currentFile.name}...`;
  const wb=XLSX.read(await currentFile.arrayBuffer(),{type:"array"});
  rows=convertSheet(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""}));
  analyze();
 }catch(err){
  $("fileInfo").textContent="Erro: "+(err.message||"Não foi possível reanalisar a planilha.");
  alert(err.message||"Não foi possível reanalisar a planilha.");
 }
};
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
renderSavedVariations();
renderUnknown();
