const KEY="roteirizador_v1";
let deliveries=JSON.parse(localStorage.getItem(KEY)||"[]");
const $=id=>document.getElementById(id);

function render(){
  $("adminList").innerHTML=deliveries.length
    ? deliveries.map((d,i)=>`<div class="delivery"><div class="number">${i+1}</div><div><strong>${escapeHtml(d.address)}, ${escapeHtml(d.number)}</strong><small>${escapeHtml(d.district)}</small></div><button class="delete" onclick="del(${i})">×</button></div>`).join("")
    : `<div class="empty">Nenhuma entrega.</div>`;
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

async function saveAdmin(){
  localStorage.setItem(KEY,JSON.stringify(deliveries));
  if(window.supabaseReady){
    try{await replaceCloudDeliveries(deliveries)}
    catch(e){console.warn("Supabase:",e);alert("Os dados foram salvos no aparelho, mas não foi possível sincronizar com a nuvem.")}
  }
}
async function del(i){
  deliveries.splice(i,1);
  await saveAdmin();
  render();
}
$("adminImport").onclick=()=>$("adminFile").click();
$("clearAll").onclick=async()=>{
  if(!confirm("Apagar todas as entregas?"))return;
  deliveries=[];
  localStorage.setItem(KEY,"[]");
  try{if(window.supabaseReady)await clearCloudDeliveries()}catch(e){console.warn(e)}
  render();
};

function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")}
function pick(row,names){
  let keys=Object.keys(row),nk=keys.map(norm);
  for(let n of names){let i=nk.indexOf(norm(n));if(i>=0)return row[keys[i]]}
  for(let i=0;i<nk.length;i++)for(let n of names)if(nk[i].includes(norm(n)))return row[keys[i]];
  return ""
}
$("adminFile").onchange=e=>{
  let f=e.target.files[0];if(!f)return;
  let r=new FileReader();
  r.onload=async x=>{
    try{
      let wb=XLSX.read(x.target.result,{type:"array"});
      let rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      let n=0;
      rows.forEach(row=>{
        let a=pick(row,["endereco","endereço","rua","logradouro"]);
        let num=pick(row,["numero","nº","num","n"]);
        let b=pick(row,["bairro","district"]);
        if(a&&num&&b){deliveries.push({address:String(a).trim(),number:String(num).trim(),district:String(b).trim(),done:false});n++}
      });
      await saveAdmin();render();alert(`${n} endereços importados.`);
    }catch(e){console.error(e);alert("Erro ao ler planilha.")}
  };
  r.readAsArrayBuffer(f);
};

async function cloudLoadAdmin(){
  if(!window.supabaseReady)return;
  try{
    const cloud=await pullDeliveries();
    if(cloud.length){deliveries=cloud;localStorage.setItem(KEY,JSON.stringify(deliveries));render()}
  }catch(e){console.warn("Supabase:",e)}
}
render();
cloudLoadAdmin();