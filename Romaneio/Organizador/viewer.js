(function(){
  const KEY='romaneio_last_route_view_v1';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').trim();
  function saveFromTable(){
    const table=$('preview'); if(!table) return;
    const data=[];
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const cells=[...tr.querySelectorAll('td')].map(td=>norm(td.textContent));
      if(cells.length===3 && cells.some(Boolean)) data.push({numero:cells[0],endereco:cells[1],bairro:cells[2],alerta:tr.classList.contains('routeUnmatched')});
    });
    if(data.length) localStorage.setItem(KEY,JSON.stringify({data,at:Date.now()}));
    render();
  }
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||{data:[]}}catch(e){return {data:[]}}}
  function render(){
    const box=$('routeViewList'),empty=$('routeViewEmpty'),count=$('routeViewCount'),search=$('routeSearch');
    if(!box)return;
    const state=load(), q=norm(search&&search.value).toLowerCase();
    let data=state.data||[];
    if(q) data=data.filter(x=>(x.endereco+' '+x.bairro).toLowerCase().includes(q));
    if(count) count.textContent=(state.data||[]).length;
    if(!data.length){box.innerHTML=''; if(empty) empty.hidden=false; return;}
    if(empty) empty.hidden=true;
    let last='';
    box.innerHTML=data.map(x=>{
      const sep=last!==x.bairro?`<div class="routeViewBairro"><span>${escapeHtml(x.bairro||'Bairro não informado')}</span></div>`:'';
      last=x.bairro;
      return sep+`<div class="routeStop ${x.alerta?'routeStopAlert':''}"><div class="routeStopNum">${escapeHtml(x.numero)}</div><div class="routeStopBody"><strong>${escapeHtml(x.endereco)}</strong><span>${escapeHtml(x.bairro||'Não informado')}</span></div>${x.alerta?'<div class="routeStopAlertTag">CONFERIR</div>':''}</div>`;
    }).join('');
  }
  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function show(screen){
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('activeScreen'));
    const el=$(screen); if(el) el.classList.add('activeScreen');
    document.querySelectorAll('.navItem').forEach(x=>x.classList.remove('active'));
    const nav=screen==='screenRoute'?'navRoute':screen==='screenCadastro'?'navCadastro':'navView';
    const n=$(nav); if(n)n.classList.add('active');
    window.scrollTo(0,0);
    if(screen==='screenView')render();
  }
  window.addEventListener('load',()=>{
    const table=$('preview');
    if(table){
      new MutationObserver(()=>saveFromTable()).observe(table.querySelector('tbody'),{childList:true,subtree:true});
      setTimeout(saveFromTable,500);
    }
    $('navRoute')?.addEventListener('click',()=>show('screenRoute'));
    $('navCadastro')?.addEventListener('click',()=>show('screenCadastro'));
    $('navView')?.addEventListener('click',()=>show('screenView'));
    $('routeSearch')?.addEventListener('input',render);
    $('refreshRouteView')?.addEventListener('click',()=>{saveFromTable();render();});
    render();
  });
})();
