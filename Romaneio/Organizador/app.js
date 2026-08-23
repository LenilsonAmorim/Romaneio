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
 populateRouteBairros();
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
   const columnBairro=bairroIdx>=0?cleanText(r[bairroIdx]):"";
   // PRIORIDADE: 1) endereço, 2) coluna Bairro, 3) não reconhecido.
   const detectedFromAddress=detectBairroFromAddress(rawAddress);
   const bairro=normalizeBairro(detectedFromAddress||columnBairro||"");
   return {
     Número:numIdx>=0&&cleanText(r[numIdx])&&cleanText(r[numIdx])!=="-"?cleanText(r[numIdx]):String(idx+1),
     Endereço:normalizeQuadras(rawAddress),
     Bairro:bairro,
     _bairroSource:detectedFromAddress?"endereço":(columnBairro?"coluna":"não reconhecido"),
     _quadra:extractQuadra(rawAddress),
     _numeroCasa:extractHouseNumber(rawAddress),
     _originalIndex:idx
   };
 }).filter(r=>r["Endereço"]||r["Bairro"]);
}

function applyRouteRules(list){
 const rules=loadRouteRules();
 const groups=new Map();
 list.forEach(r=>{
   const key=normKey(r.Bairro)||"__NAO_RECONHECIDO__";
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push({...r});
 });
 const orderedGroups=[...groups.entries()].sort((a,b)=>{
   if(a[0]==="__NAO_RECONHECIDO__")return 1;
   if(b[0]==="__NAO_RECONHECIDO__")return -1;
   return a[1][0].Bairro.localeCompare(b[1][0].Bairro,"pt-BR");
 });
 const result=[];
 orderedGroups.forEach(([key,items])=>{
   if(key==="__NAO_RECONHECIDO__"){
     items.sort((a,b)=>a._originalIndex-b._originalIndex);
   }else{
     const rule=rules[key];
     items.sort((a,b)=>{
       if(rule){
         const ia=rule.sequence.indexOf(routeQuadraToken(a.Endereço));
         const ib=rule.sequence.indexOf(routeQuadraToken(b.Endereço));
         if(ia>=0||ib>=0){if(ia<0)return 1;if(ib<0)return -1;if(ia!==ib)return ia-ib}
       }
       if(a._quadra!==b._quadra)return a._quadra-b._quadra;
       if(a._numeroCasa!==b._numeroCasa)return a._numeroCasa-b._numeroCasa;
       return a._originalIndex-b._originalIndex;
     });
   }
   result.push(...items);
 });
 return result;
}

function applySavedSequence(list){
 return applyRouteRules(list);
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

$("routeBairroSelect").onchange=()=>{
 const bairro=$("routeBairroSelect").value,r=loadRouteRules()[normKey(bairro)];
 $("routeSequence").value=r?r.sequence.map(x=>"Quadra "+String(Number(x)).padStart(2,"0")).join("\n"):"";
};
$("saveRouteRule").onclick=()=>{
 const bairro=$("routeBairroSelect").value;
 if(!bairro){alert("Selecione o bairro.");return;}
 const seq=[...new Set($("routeSequence").value.split(/\r?\n/).map(routeQuadraToken).filter(Boolean))];
 if(!seq.length){alert("Digite pelo menos uma quadra.");return;}
 const rules=loadRouteRules();
 rules[normKey(bairro)]={bairro,sequence:seq,variants:Object.fromEntries(seq.map(n=>[n,autoQuadraVariants(n)]))};
 saveRouteRules(rules);renderRouteRules();organize();
 alert("Regra de roteirização salva para "+bairro+".");
};
renderRouteRules();
