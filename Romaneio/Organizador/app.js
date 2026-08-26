let rows=[],processed=[],currentFile=null;
let editingRouteKey="";
const $=id=>document.getElementById(id);
const ROUTE_RULES_KEY="romaneio_route_rules_v2";
const ADDRESS_FIXES_KEY="romaneio_address_fixes_v1";

function cleanText(v){return String(v??"").replace(/\s+/g," ").trim()}
function normKey(v){return cleanText(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function loadRouteRules(){try{return JSON.parse(localStorage.getItem(ROUTE_RULES_KEY)||"{}")}catch(e){return {}}}
function saveRouteRules(x){localStorage.setItem(ROUTE_RULES_KEY,JSON.stringify(x))}
function loadAddressFixes(){try{return JSON.parse(localStorage.getItem(ADDRESS_FIXES_KEY)||"{}")||{}}catch(e){return {}}}
function saveAddressFixes(x){localStorage.setItem(ADDRESS_FIXES_KEY,JSON.stringify(x))}
function addressFixKey(address){return normKey(address)}
function saveAddressFix(address,fix){
 const key=addressFixKey(address); if(!key)return false;
 const fixes=loadAddressFixes();
 fixes[key]={...(fixes[key]||{}),...fix,updatedAt:Date.now()};
 saveAddressFixes(fixes); return true;
}
function getAddressFix(address){return loadAddressFixes()[addressFixKey(address)]||null}
function autoQuadraVariants(n){
 const x=String(Number(n)),p=String(Number(n)).padStart(2,"0");
 return [`Quadra ${x}`,`Quadra ${p}`,`QD${x}`,`QD ${x}`,`QD${p}`,`QD ${p}`,`Q${x}`,`Q ${x}`,`Q${p}`,`Q ${p}`,`Q D ${p}`];
}
function quadraNumber(text){
 const s=cleanText(text);
 let m=s.match(/^\s*(?:Q\s*)?([A-Za-z])\s*0*(\d+)\s*$/i);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));
 m=s.match(/\bq\s*[-.:]?\s*([A-Za-z])\s*0*(\d+)\b/i);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));
 m=s.match(/\bqd\s*[-.:]?\s*([A-Za-z])\s*0*(\d+)\b/i);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));
 m=s.match(/\bqd\s*[-.:]?\s*0*(\d+)\b/i);
 if(m)return "D"+String(Number(m[1]));
 m=s.match(/\bquadra\s*[-.:]?\s*([A-Za-z])\s*0*(\d+)\b/i);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));
 m=s.match(/\bquadra\s*[-.:]?\s*0*(\d+)\b/i);
 if(m)return "D"+String(Number(m[1]));
 m=s.match(/\bq\s*[-.:]?\s*0*(\d+)\b/i);
 if(m)return "D"+String(Number(m[1]));
 m=s.match(/(?:^|[\s,;\/-])([A-Za-z])\s*0*(\d+)(?=$|[\s,;\/-])/);
 if(m)return m[1].toUpperCase()+String(Number(m[2]));
 return "";
}
function routeToken(text){const s=cleanText(text);if(!s)return "";const q=quadraNumber(s);return q||s}
function routeKey(text){const q=quadraNumber(text);return q?"Q:"+q:"T:"+normKey(text)}
function normalizeQuadras(text){return cleanText(text)}
function extractQuadra(text){const n=quadraNumber(text);return n?Number(n):999999}
function extractHouseNumber(text){let m=cleanText(text).match(/,\s*0*(\d+)\b/);if(m)return Number(m[1]);return 999999}

function registerBairro(canonical,aliases=[]){
 const c=cleanText(canonical);if(!c)return;
 const rules=loadRouteRules(),key=normKey(c);
 const old=rules[key]||{bairro:c,sequence:[],aliases:[]};
 const generated=[c,c.replace(/\bConjunto\b/gi,"Conj"),c.replace(/\bConjunto\b/gi,"Conj."),c.normalize("NFD").replace(/[\u0300-\u036f]/g,"")];
 const all=[...generated,...aliases.map(cleanText)].filter(Boolean);
 old.bairro=c;old.aliases=[...new Set([...(old.aliases||[]),...all.map(normKey)])];
 rules[key]=old;saveRouteRules(rules);renderRouteRules();
}
function saveRouteRule(){
 const bairro=cleanText($("routeBairroName").value);
 if(!bairro){alert("Digite o nome oficial do bairro.");return}
 const aliases=$("routeBairroAliases").value.split(/\r?\n/).map(cleanText).filter(Boolean);
 const seq=[...new Set($("routeSequence").value.split(/\r?\n/).map(routeToken).filter(Boolean))];
 const noQuadra=!!$("routeNoQuadra").checked;
 if(!seq.length&&!noQuadra){alert("Digite pelo menos uma quadra na sequência ou marque “não usa quadra”.");return}
 const rules=loadRouteRules(),key=normKey(bairro),existing=rules[key]||{};
 const generated=[bairro,bairro.replace(/\bConjunto\b/gi,"Conj"),bairro.replace(/\bConjunto\b/gi,"Conj."),bairro.normalize("NFD").replace(/[\u0300-\u036f]/g,"")];
 rules[key]={bairro,aliases:[...new Set([...(existing.aliases||[]),...generated.map(normKey),...aliases.map(normKey)])],sequence:seq,noQuadra,variants:Object.fromEntries(seq.map(n=>[n,autoQuadraVariants(n)]))};
 saveRouteRules(rules);renderRouteRules();renderSavedVariations();
 if(currentFile)reanalyzeCurrentFile();
 $("routeBairroName").value="";$("routeBairroAliases").value="";$("routeSequence").value="";$("routeNoQuadra").checked=false;
 alert("Bairro e sequência salvos para "+bairro+".");
}
function renderRouteRules(){
 const box=$("routeRulesList"),rules=loadRouteRules(),keys=Object.keys(rules);
 if(!keys.length){box.innerHTML='<span class="muted">Nenhuma regra salva ainda.</span>';return}
 box.innerHTML=keys.map(k=>{
   const r=rules[k],seq=(r.sequence||[]).map(n=>"QD "+n).join(" → ");
   const desc=r.noQuadra?"Sem quadras — nome do local é suficiente":(seq||"Sem sequência");
   return `<div class="savedRule"><div><strong>${escapeHtml(r.bairro)}</strong><div class="muted">${escapeHtml(desc)}</div></div><div class="ruleButtons"><button type="button" class="editBtn" data-edit-route="${encodeURIComponent(k)}">Editar</button><button type="button" class="deleteBtn" data-delete-route="${encodeURIComponent(k)}">Remover</button></div></div>`;
 }).join("");
 box.querySelectorAll("[data-edit-route]").forEach(btn=>btn.onclick=(e)=>{
   e.preventDefault();
   e.stopPropagation();
   const key=decodeURIComponent(btn.dataset.editRoute||"");
   openRouteEditor(key);
 });
 box.querySelectorAll("[data-delete-route]").forEach(btn=>btn.onclick=()=>{
   const key=btn.dataset.deleteRoute,rules=loadRouteRules(),r=rules[key];if(!r)return;
   if(!confirm(`Remover o bairro "${r.bairro}" e toda a sequência salva?`))return;
   delete rules[key];saveRouteRules(rules);if(editingRouteKey===key)closeRouteEditor();renderRouteRules();renderSavedVariations();if(rows.length)analyze();
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
 requestAnimationFrame(()=>{
   $("routeEditor").scrollIntoView({behavior:"smooth",block:"center"});
   $("editRouteBairro").focus();
 });
}
function closeRouteEditor(){editingRouteKey="";$("routeEditor").hidden=true}
function saveEditedRoute(){
 if(!editingRouteKey){alert("Selecione um bairro salvo para editar.");return}
 const oldKey=editingRouteKey;
 const bairro=cleanText($("editRouteBairro").value);
 if(!bairro){alert("Digite o nome oficial do bairro.");return}
 const aliases=$("editRouteAliases").value.split(/\r?\n/).map(cleanText).filter(Boolean);
 const seq=[...new Set($("editRouteSequence").value.split(/\r?\n/).map(routeToken).filter(Boolean))];
 const noQuadra=!!$("editRouteNoQuadra").checked;
 if(!seq.length&&!noQuadra){alert("Digite pelo menos uma quadra ou marque “não usa quadra”.");return}
 const rules=loadRouteRules(),old=rules[oldKey];
 if(!old){alert("A regra selecionada não foi encontrada. Atualize a lista e tente novamente.");closeRouteEditor();renderRouteRules();return}
 const key=normKey(bairro);
 const oldAliases=old.aliases||[];
 const generated=[bairro,bairro.replace(/\bConjunto\b/gi,"Conj"),bairro.replace(/\bConjunto\b/gi,"Conj."),bairro.normalize("NFD").replace(/[\u0300-\u036f]/g,"")];
 const finalAliases=[...new Set([...oldAliases,...aliases.map(normKey),...generated.map(normKey)])].filter(a=>normKey(a)!==key);
 delete rules[oldKey];
 rules[key]={bairro,aliases:finalAliases,sequence:seq,noQuadra,variants:Object.fromEntries(seq.map(n=>[n,autoQuadraVariants(n)]))};
 saveRouteRules(rules);
 closeRouteEditor();
 renderRouteRules();
 renderSavedVariations();
 if(currentFile) reanalyzeCurrentFile(); else if(rows.length)analyze();
 alert("Alterações salvas para "+bairro+".");
}
function clearEditRoute(){$("editRouteBairro").value="";$("editRouteAliases").value="";$("editRouteSequence").value="";$("editRouteNoQuadra").checked=false;$("editRouteBairro").focus()}

function renderSavedVariations(){
 const box=$("savedVariationsList");if(!box)return;
 const rules=loadRouteRules(),items=[];
 Object.entries(rules).forEach(([key,r])=>(r.aliases||[]).forEach(alias=>{const a=cleanText(alias);if(!a||normKey(a)===normKey(r.bairro))return;items.push({key,bairro:r.bairro,alias:a})}));
 if(!items.length){box.innerHTML='<span class="muted">Nenhuma variação salva ainda.</span>';return}
 box.innerHTML=items.map((x,i)=>`<div class="variationRow"><div class="variationText"><strong>${escapeHtml(x.alias)}</strong><span>→ ${escapeHtml(x.bairro)}</span></div><div class="variationActions"><button type="button" class="editBtn" data-edit-variation="${i}">Corrigir</button><button type="button" class="deleteBtn" data-delete-variation="${i}">Remover</button></div></div>`).join("");
 box.querySelectorAll("[data-edit-variation]").forEach(btn=>btn.onclick=()=>{
   const x=items[Number(btn.dataset.editVariation)],rules=loadRouteRules();
   const escolha=prompt(`Variação: ${x.alias}\nDigite o nome EXATO do bairro correto:\n\n${Object.values(rules).map(r=>r.bairro).join("\n")}`,x.bairro);
   if(escolha===null)return;
   const alvo=Object.values(rules).find(r=>normKey(r.bairro)===normKey(escolha));
   if(!alvo){alert("Bairro não encontrado. Digite o nome oficial exatamente como está cadastrado.");return}
   setBairroVariation(x.alias,alvo.bairro);renderRouteRules();renderSavedVariations();if(rows.length)analyze();alert(`Variação "${x.alias}" agora pertence a ${alvo.bairro}.`);
 });
 box.querySelectorAll("[data-delete-variation]").forEach(btn=>btn.onclick=()=>{
   const x=items[Number(btn.dataset.deleteVariation)],rules=loadRouteRules(),r=rules[x.key];if(!r)return;
   if(!confirm(`Remover a variação "${x.alias}" de ${r.bairro}?`))return;
   r.aliases=(r.aliases||[]).filter(a=>normKey(a)!==normKey(x.alias));saveRouteRules(rules);renderSavedVariations();if(currentFile)reanalyzeCurrentFile();else if(rows.length)analyze();
 });
}
function findColumn(headers,patterns){const n=headers.map(normKey);for(const p of patterns){const i=n.findIndex(h=>h===normKey(p));if(i>=0)return i}for(const p of patterns){const i=n.findIndex(h=>h.includes(normKey(p)));if(i>=0)return i}return -1}
function findHeaderRow(data){for(let i=0;i<Math.min(15,data.length);i++){const h=(data[i]||[]).map(normKey);if(h.some(x=>x.includes("endereco")||x.includes("destination address")||x.includes("address")))return i}return 0}
function findBairroInText(text){
 const key=normKey(text);if(!key)return "";
 const rules=loadRouteRules(),matches=[],strongMarkers=["citta","sitta"];
 for(const r of Object.values(rules)){const candidates=[r.bairro,...(r.aliases||[])].map(normKey).filter(Boolean);for(const a of candidates){if(!a||!key.includes(a))continue;const markerHits=strongMarkers.filter(m=>a.includes(m)&&key.includes(m)).length;matches.push({bairro:r.bairro,len:a.length,priority:markerHits?100000+markerHits*1000:0})}}
 matches.sort((a,b)=>b.priority-a.priority||b.len-a.len);
 return matches.length?matches[0].bairro:"";
}
function setBairroVariation(variation,canonical){
 const alias=normKey(variation),dest=normKey(canonical);if(!alias||!dest)return false;
 const rules=loadRouteRules(),target=rules[dest];if(!target)return false;
 Object.values(rules).forEach(r=>{r.aliases=(r.aliases||[]).filter(a=>normKey(a)!==alias)});
 if(normKey(target.bairro)!==alias)target.aliases=[...new Set([...(target.aliases||[]),alias])];
 saveRouteRules(rules);return true;
}
function convertSheet(data){
 if(!data.length)throw new Error("A planilha está vazia.");
 const hr=findHeaderRow(data),headers=(data[hr]||[]).map(cleanText);
 const addrIdx=findColumn(headers,["Endereço","Endereco","Destination Address","Address","Destino","Rua"]);
 const bairroIdx=findColumn(headers,["Bairro","Neighborhood","Distrito","Região","Regiao","District"]);
 const numIdx=findColumn(headers,["Número","Numero","Número da entrega","Stop","Parada","Ordem","AT ID"]);
 const seqIdx=findColumn(headers,["Sequence","Sequência","Sequencia","Seq"]);
 if(addrIdx<0)throw new Error("Não encontrei a coluna de Endereço.");
 return data.slice(hr+1).map((r,idx)=>{
   const address=cleanText(r[addrIdx]),columnBairro=bairroIdx>=0?cleanText(r[bairroIdx]):"";
   const fromAddress=findBairroInText(address),fromColumn=fromAddress?"":findBairroInText(columnBairro),bairro=fromAddress||fromColumn||"";
   return {"Número":numIdx>=0&&cleanText(r[numIdx])?cleanText(r[numIdx]):String(idx+1),"Sequência":seqIdx>=0&&cleanText(r[seqIdx])?cleanText(r[seqIdx]):(numIdx>=0&&cleanText(r[numIdx])?cleanText(r[numIdx]):""),"Endereço":normalizeQuadras(address),"Bairro":bairro||columnBairro||"Não informado","_bairroOriginal":columnBairro||"Não informado","_bairroReconhecido":!!bairro,"_bairroSource":fromAddress?"endereço":fromColumn?"coluna":"não reconhecido","_pendenteBairro":!bairro,"_quadra":extractQuadra(address),"_numeroCasa":extractHouseNumber(address),"_originalIndex":idx};
 }).filter(r=>r["Endereço"]||r["Bairro"]);
}
function applyRouteRules(list){
 const rules=loadRouteRules(),groups=new Map();
 list.forEach(r=>{
  const fix=getAddressFix(r["Endereço"]);
  if(fix?.bairro){const canonical=Object.values(rules).find(x=>normKey(x.bairro)===normKey(fix.bairro));if(canonical){r.Bairro=canonical.bairro;r._pendenteBairro=false;r._bairroReconhecido=true;r._bairroSource="ajuste"}}
  if(fix?.quadra)r._quadraAjustada=routeToken(fix.quadra);
  const key=normKey(r.Bairro)||"__NAO_RECONHECIDO__";if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...r});
 });
 const unresolved=[],resolvedGroups=[];
 [...groups.entries()].forEach(([key,items])=>{
  const isPending=items.some(r=>r._pendenteBairro);
  if(isPending){items.forEach(r=>{r._quadraReconhecida=false;r._sequenceIndex=-1});items.sort((a,b)=>a._originalIndex-b._originalIndex);unresolved.push(...items);return}
  const rule=rules[key],seq=rule?.sequence||[];
  if(rule?.noQuadra)items.forEach(r=>{r._sequenceIndex=0;r._quadraReconhecida=true});
  else items.forEach(r=>{const idx=seq.findIndex(x=>routeKey(x)===routeKey(r._quadraAjustada||r["Endereço"]));r._sequenceIndex=idx;r._quadraReconhecida=idx>=0});
  items.sort((a,b)=>{const am=a._quadraReconhecida?1:0,bm=b._quadraReconhecida?1:0;if(am!==bm)return am-bm;if(am===0){if(a._quadra!==b._quadra)return a._quadra-b._quadra;return a._originalIndex-b._originalIndex}if(a._sequenceIndex!==b._sequenceIndex)return a._sequenceIndex-b._sequenceIndex;if(a._numeroCasa!==b._numeroCasa)return a._numeroCasa-b._numeroCasa;return a._originalIndex-b._originalIndex});
  resolvedGroups.push(items);
 });
 const orderedGroups=resolvedGroups.sort((a,b)=>(a[0]?.Bairro||"").localeCompare(b[0]?.Bairro||"","pt-BR"));
 return [...unresolved,...orderedGroups.flat()];
}
async function reanalyzeCurrentFile(){
 if(!currentFile)return false;
 try{const wb=XLSX.read(await currentFile.arrayBuffer(),{type:"array"});rows=convertSheet(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""}));analyze();return true}
 catch(err){$("fileInfo").textContent="Erro: "+(err.message||"Não foi possível reanalisar a planilha.");alert(err.message||"Não foi possível reanalisar a planilha.");return false}
}
function analyze(){
 if(!rows.length)return;
 processed=applyRouteRules(rows);processed.forEach((r,i)=>r["Número"]=String(i+1));render();
 const unknown=rows.filter(r=>r._pendenteBairro).length;
 $("fileInfo").innerHTML=`<span class="statusOk">${escapeHtml(currentFile?.name||"Planilha")} analisada: ${rows.length} entregas.</span> ${unknown?`<span class="statusWarn">${unknown} não reconhecida(s).</span>`:"Todos os bairros foram reconhecidos."}`;
}
function render(){
 const tb=$("preview").querySelector("tbody");tb.innerHTML="";
 processed.forEach((r,i)=>{
  if(i>0&&normKey(processed[i-1].Bairro)!==normKey(r.Bairro)){const sep=document.createElement("tr");sep.className="bairroSep";sep.innerHTML="<td colspan='4'></td>";tb.appendChild(sep)}
  const tr=document.createElement("tr");if(r.Bairro&&r._quadraReconhecida===false)tr.className="routeUnmatched";
  ["Número","Sequência","Endereço","Bairro"].forEach(k=>{const td=document.createElement("td");td.textContent=r[k];tr.appendChild(td)});tb.appendChild(tr);
 });
 $("count").textContent=processed.length;$("bairros").textContent=new Set(processed.map(r=>normKey(r.Bairro)).filter(Boolean)).size;$("quadras").textContent=processed.filter(r=>r._quadra!==999999).length;
 $("download").disabled=!processed.length;$("downloadCsv").disabled=!processed.length;renderUnknown();
}
function renderUnknown(){
 const box=$("unknownList"),unknown=rows.filter(r=>r._pendenteBairro);
 if(!unknown.length){box.innerHTML='<span class="muted">Nenhum endereço pendente.</span>';return}
 const rules=loadRouteRules();
 box.innerHTML=unknown.slice(0,20).map((r,i)=>{const original=cleanText(r["_bairroOriginal"]);return `<div class="unknownRow"><b>PRIORIDADE ${i+1} • Linha ${r._originalIndex+2}</b><div class="addr"><b>Endereço:</b> ${escapeHtml(r["Endereço"])}</div><div class="addr"><b>Bairro informado:</b> ${escapeHtml(original||"Não informado")}</div><div class="unknownActions"><input id="unknownAlias${i}" type="text" value="${escapeHtml(original)}" placeholder="Variação do bairro (opcional)"><select id="unknownBairro${i}"><option value="">Deixar pendente</option>${Object.values(rules).map(x=>`<option value="${escapeHtml(x.bairro)}">${escapeHtml(x.bairro)}</option>`).join("")}</select><button type="button" data-unknown="${i}">Salvar correção</button></div><small class="muted">Se deixar o bairro vazio, nada é alterado e este endereço continuará nas primeiras linhas.</small></div>`}).join("");
 box.querySelectorAll("[data-unknown]").forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.unknown),canonical=cleanText($("unknownBairro"+i).value);if(!canonical){alert("Nada foi alterado. Este endereço continuará no topo para você corrigir depois.");return}const alias=cleanText($("unknownAlias"+i).value)||cleanText(unknown[i]["_bairroOriginal"]);if(!alias||alias==="Não informado"){alert("Digite a variação do bairro ou informe o bairro correto.");return}if(!setBairroVariation(alias,canonical)){alert("Não foi possível salvar a associação. Verifique se o bairro está cadastrado.");return}renderRouteRules();renderSavedVariations();if(currentFile)reanalyzeCurrentFile();else analyze();alert(`Correção salva: "${alias}" → ${canonical}. Agora a análise foi refeita.`)});
}
$("file").addEventListener("change",async e=>{
 const f=e.target.files[0];if(!f)return;currentFile=f;$("fileInfo").textContent=`Lendo ${f.name}...`;$("analyze").disabled=true;
 try{const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});rows=convertSheet(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""}));$("analyze").disabled=!rows.length;analyze()}
 catch(err){$("fileInfo").textContent="Erro: "+(err.message||"Não foi possível ler a planilha.");alert(err.message||"Não foi possível ler a planilha.")}
});
$("analyze").onclick=async()=>{if(!currentFile)return;$("fileInfo").textContent=`Reanalisando ${currentFile.name}...`;await reanalyzeCurrentFile()};
$("saveRouteRule").onclick=saveRouteRule;
$("saveEditedRoute").onclick=saveEditedRoute;
$("clearEditRoute").onclick=clearEditRoute;
$("cancelEditRoute").onclick=closeRouteEditor;
function exportMatrix(){
 const out=[["Número","Sequência","Endereço","Bairro"]];
 processed.forEach((r,i)=>{if(i>0&&normKey(processed[i-1].Bairro)!==normKey(r.Bairro))out.push(["","",""]);out.push([r["Número"],r["Sequência"],r["Endereço"],r["Bairro"]])});return out;
}
$("download").onclick=()=>{const ws=XLSX.utils.aoa_to_sheet(exportMatrix()),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Entregas");XLSX.writeFile(wb,"entregas_organizadas.xlsx")};
$("downloadCsv").onclick=()=>{const csv=XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(exportMatrix()));const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="entregas_organizadas.csv";a.click();URL.revokeObjectURL(a.href)};
renderRouteRules();renderSavedVariations();renderUnknown();
