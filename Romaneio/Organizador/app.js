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
function convertSheet(data){
 if(!data.length)throw new Error("A planilha está vazia.");
 const headerRow=findHeaderRow(data),headers=(data[headerRow]||[]).map(cleanText);
 const numIdx=findColumn(headers,["Stop","Sequence","Número","Numero","AT ID","Parada","Ordem"]);
 const addrIdx=findColumn(headers,["Destination Address","Endereço","Endereco","Address","Destino","Rua"]);
 const bairroIdx=findColumn(headers,["Bairro","Neighborhood","Distrito","Região","Regiao","District"]);
 if(addrIdx<0)throw new Error("Não encontrei a coluna de Endereço.");
 if(bairroIdx<0)throw new Error("Não encontrei a coluna de Bairro. Confira se a planilha possui essa coluna.");
 return data.slice(headerRow+1).map((r,idx)=>({
   Número:numIdx>=0&&cleanText(r[numIdx])&&cleanText(r[numIdx])!=="-"?cleanText(r[numIdx]):String(idx+1),
   Endereço:normalizeQuadras(r[addrIdx]),
   Bairro:normalizeBairro(r[bairroIdx]),
   _quadra:extractQuadra(r[addrIdx]),
   _numeroCasa:extractHouseNumber(r[addrIdx]),
   _originalIndex:idx
 })).filter(r=>r["Endereço"]||r["Bairro"]);
}
function applySavedSequence(list){
 const rules=loadRules();
 return list.map(r=>({...r})).sort((a,b)=>{
   const nb=normKey(a["Bairro"]).localeCompare(normKey(b["Bairro"]),"pt-BR");
   if(nb)return nb;
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
function organize(){
 processed=applySavedSequence(rows);
 processed.forEach((r,i)=>r["Número"]=String(i+1));
 render();
}
function render(){
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
$("file").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});rows=convertSheet(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""}));$("fileInfo").textContent=`${f.name} — ${rows.length} entregas carregadas.`;$("process").disabled=false;populateBairros();processed=[];render()}catch(err){alert(err.message||"Não foi possível ler a planilha.")}});
$("applyRules").onclick=()=>{if(!rows.length)return;rows=rows.map(r=>({...r,Bairro:normalizeBairro(r.Bairro)}));populateBairros();organize()};
$("editSequence").onclick=openEditor;$("closeEditor").onclick=()=>$("sequenceEditor").classList.add("hidden");$("saveSequence").onclick=saveCurrentSequence;
$("bairroSelect").onchange=()=>{$("editSequence").disabled=!$("bairroSelect").value};
$("process").onclick=organize;
function exportMatrix(){const out=[["Número","Endereço","Bairro"]];processed.forEach((r,i)=>{if(i>0&&normKey(processed[i-1].Bairro)!==normKey(r.Bairro))out.push(["","",""]);out.push([r.Número,r.Endereço,r.Bairro])});return out}
$("download").onclick=()=>{const ws=XLSX.utils.aoa_to_sheet(exportMatrix()),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Entregas");XLSX.writeFile(wb,"entregas_organizadas.xlsx")};
$("downloadCsv").onclick=()=>{const csv=XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(exportMatrix())),blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="entregas_organizadas.csv";a.click();URL.revokeObjectURL(a.href)};
renderSavedRules();
