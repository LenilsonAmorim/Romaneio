const KEY="roteirizador_v1";let deliveries=JSON.parse(localStorage.getItem(KEY)||"[]");const $=id=>document.getElementById(id);
function render(){ $("adminList").innerHTML=deliveries.length?deliveries.map((d,i)=>`<div class="delivery"><div class="number">${i+1}</div><div><strong>${d.address}, ${d.number}</strong><small>${d.district}</small></div><button class="delete" onclick="del(${i})">×</button></div>`).join(""):`<div class="empty">Nenhuma entrega.</div>`}
function del(i){deliveries.splice(i,1);localStorage.setItem(KEY,JSON.stringify(deliveries)); if(window.supabaseReady) pushDeliveries(deliveries).catch(console.warn); render()}
$("adminImport").onclick=()=>$("adminFile").click();
$("clearAll").onclick=()=>{if(confirm("Apagar todas as entregas?")){deliveries=[];localStorage.setItem(KEY,"[]"); if(window.supabaseReady) clearCloudDeliveries().catch(console.warn); render()}}
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")}
function pick(row,names){let keys=Object.keys(row),nk=keys.map(norm);for(let n of names){let i=nk.indexOf(norm(n));if(i>=0)return row[keys[i]]}for(let i=0;i<nk.length;i++)for(let n of names)if(nk[i].includes(norm(n)))return row[keys[i]];return ""}
$("adminFile").onchange=e=>{let f=e.target.files[0],r=new FileReader();r.onload=x=>{try{let wb=XLSX.read(x.target.result,{type:"array"}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""}),n=0;rows.forEach(row=>{let a=pick(row,["endereco","endereço","rua","logradouro"]),num=pick(row,["numero","nº","n","num"]),b=pick(row,["bairro"]);if(a&&num&&b){deliveries.push({address:String(a).trim(),number:String(num).trim(),district:String(b).trim()});n++}});localStorage.setItem(KEY,JSON.stringify(deliveries));async function cloudLoadAdmin(){
  if(!window.supabaseReady) return;
  try{
    const cloud=await pullDeliveries();
    if(cloud.length){deliveries=cloud;localStorage.setItem(KEY,JSON.stringify(deliveries)); if(window.supabaseReady) pushDeliveries(deliveries).catch(console.warn); render()}
  }catch(e){console.warn(e)}
}
const oldSet=(items)=>localStorage.setItem(KEY,JSON.stringify(items));
cloudLoadAdmin();
render();alert(`${n} endereços importados.`)}catch(e){alert("Erro ao ler planilha.")}};r.readAsArrayBuffer(f)}
render();