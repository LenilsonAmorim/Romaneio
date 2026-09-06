const KEY="roteirizador_v1";
const AREA="roteirizador_area_v1";
let deliveries=JSON.parse(localStorage.getItem(KEY)||"[]");
let route=[], current=0, map=null, markers=[];

const $=id=>document.getElementById(id);
function saveLocal(){localStorage.setItem(KEY,JSON.stringify(deliveries))}
async function save(){saveLocal(); if(window.supabaseReady){try{await syncCloud()}catch(e){console.warn("Supabase:",e);toast("Salvo no aparelho; nuvem indisponível.")}}}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function toast(t){$("toast").textContent=t;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",2200)}

function render(){
  $("count").textContent=deliveries.length;
  $("empty").style.display=deliveries.length?"none":"flex";
  $("routeBtn").disabled=!deliveries.length;
  $("deliveryList").innerHTML=deliveries.map((d,i)=>`<div class="delivery"><div class="number">${i+1}</div><div><strong>${esc(d.address)}, ${esc(d.number)}</strong><small>${esc(d.district)}</small></div><button class="delete" data-i="${i}">×</button></div>`).join("");
  document.querySelectorAll(".delete").forEach(b=>b.onclick=async()=>{deliveries.splice(+b.dataset.i,1);await save();render()});
}
function loadArea(){let a=JSON.parse(localStorage.getItem(AREA)||"{}");$("city").value=a.city||"";$("state").value=a.state||""}

$("addBtn").onclick=()=>{$("modal").classList.remove("hidden");$("mAddress").focus()};
$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("saveDelivery").onclick=async()=>{
  let address=$("mAddress").value.trim(),number=$("mNumber").value.trim(),district=$("mDistrict").value.trim();
  if(!address||!number||!district)return toast("Preencha os três campos.");
  deliveries.push({address,number,district,done:false});
  await save();render();["mAddress","mNumber","mDistrict"].forEach(x=>$(x).value="");$("modal").classList.add("hidden")
};
$("saveAreaBtn").onclick=()=>{let city=$("city").value.trim(),state=$("state").value.trim().toUpperCase();localStorage.setItem(AREA,JSON.stringify({city,state}));toast("Área salva.")};
$("importBtn").onclick=()=>$("fileInput").click();
$("fileInput").onchange=e=>importFile(e.target.files[0]);

function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")}
function pick(row,names){
  let keys=Object.keys(row),nk=keys.map(norm);
  for(let n of names){let i=nk.indexOf(norm(n));if(i>=0)return row[keys[i]]}
  for(let i=0;i<nk.length;i++)for(let n of names)if(nk[i].includes(norm(n)))return row[keys[i]];
  return ""
}
async function importFile(file){
  if(!file)return;
  let r=new FileReader();
  r.onload=async ev=>{
    try{
      let wb=XLSX.read(ev.target.result,{type:"array"});
      let rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      let added=0;
      rows.forEach(row=>{
        let address=pick(row,["endereco","endereço","rua","logradouro"]);
        let number=pick(row,["numero","nº","num","n"]);
        let district=pick(row,["bairro","district"]);
        if(address&&number&&district){deliveries.push({address:String(address).trim(),number:String(number).trim(),district:String(district).trim(),done:false});added++}
      });
      await save();render();toast(`${added} endereços importados.`);
    }catch(e){console.error(e);toast("Não consegui ler a planilha.")}
  };
  r.readAsArrayBuffer(file)
}

$("routeBtn").onclick=buildRoute;
$("backBtn").onclick=()=>show("homeView");
$("startBtn").onclick=()=>{current=0;show("runView");showStop()};
$("exitRunBtn").onclick=()=>show("routeView");
$("doneBtn").onclick=async()=>{
  if(current<route.length-1){current++;showStop()}
  else{toast("Rota concluída!");show("routeView")}
};
$("navBtn").onclick=()=>{
  let d=route[current];
  let q=encodeURIComponent(`${d.address}, ${d.number}, ${d.district}, ${$("city").value}, ${$("state").value}`);
  location.href=`https://www.google.com/maps/search/?api=1&query=${q}`
};

function show(id){["homeView","routeView","runView"].forEach(x=>$(x).classList.toggle("hidden",x!==id))}
function showStop(){
  let d=route[current];
  $("progressText").textContent=`Parada ${current+1} de ${route.length}`;
  $("stopAddress").textContent=`${d.address}, ${d.number}`;
  $("stopDistrict").textContent=`${d.district} • ${$("city").value||""} ${$("state").value||""}`;
  $("progressBar").style.width=`${((current+1)/route.length)*100}%`
}
async function geocode(d){
  let area=JSON.parse(localStorage.getItem(AREA)||"{}");
  let q=encodeURIComponent(`${d.address}, ${d.number}, ${d.district}, ${area.city||""}, ${area.state||""}, Brasil`);
  let u=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${q}`;
  let res=await fetch(u,{headers:{"Accept-Language":"pt-BR"}});
  let data=await res.json();
  return data[0]?{...d,lat:+data[0].lat,lon:+data[0].lon}:null
}
async function buildRoute(){
  if(!deliveries.length)return;
  let area=JSON.parse(localStorage.getItem(AREA)||"{}");
  if(!area.city||!area.state)return toast("Informe cidade e UF primeiro.");
  $("routeBtn").disabled=true;$("routeBtn").textContent="⏳ Localizando...";
  let points=[];
  for(let d of deliveries){let p=await geocode(d);if(p)points.push(p);await new Promise(r=>setTimeout(r,1100))}
  if(!points.length){$("routeBtn").disabled=false;return toast("Nenhum endereço foi localizado.")}
  if(points.length<deliveries.length)toast(`${deliveries.length-points.length} endereço(s) não localizado(s).`);
  route=await optimize(points);route=route.length?route:points;
  renderRoute();$("routeBtn").disabled=false;$("routeBtn").textContent="🚀 Roteirizar entregas";show("routeView")
}
async function optimize(points){
  if(points.length<2)return points;
  try{
    let coords=points.map(p=>`${p.lon},${p.lat}`).join(";");
    let u=`https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=false&overview=full&geometries=geojson`;
    let r=await fetch(u),j=await r.json();
    if(j.code!=="Ok")return points;
    return j.waypoints.sort((a,b)=>a.waypoint_index-b.waypoint_index).map(w=>points[w.waypoint_index])
  }catch(e){return points}
}
function renderRoute(){
  show("routeView");$("routeStatus").textContent=`${route.length} paradas`;
  $("routeList").innerHTML=route.map((d,i)=>`<div class="route-item"><div class="number">${i+1}</div><div><strong>${esc(d.address)}, ${esc(d.number)}</strong><small>${esc(d.district)}</small></div></div>`).join("");
  setTimeout(drawMap,50)
}
function drawMap(){
  if(map)map.remove();
  markers=[];
  map=L.map("map").setView([route[0].lat,route[0].lon],13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors"}).addTo(map);
  let latlngs=[];
  route.forEach((d,i)=>{let ll=[d.lat,d.lon];latlngs.push(ll);let m=L.marker(ll).addTo(map).bindPopup(`<b>Parada ${i+1}</b><br>${esc(d.address)}, ${esc(d.number)}<br>${esc(d.district)}`);markers.push(m)});
  if(latlngs.length>1)L.polyline(latlngs).addTo(map);
  map.fitBounds(L.latLngBounds(latlngs),{padding:[20,20]})
}

async function syncCloud(){
  if(window.replaceCloudDeliveries) await replaceCloudDeliveries(deliveries);
}
async function cloudLoad(){
  if(!window.supabaseReady)return;
  try{
    const cloud=await pullDeliveries();
    if(cloud.length){deliveries=cloud;saveLocal();render()}
  }catch(e){console.warn("Supabase:",e)}
}
let deferredPrompt;
$("installBtn").onclick=()=>deferredPrompt&&deferredPrompt.prompt();
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden")});
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
loadArea();render();cloudLoad();