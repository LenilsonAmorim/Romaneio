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
    const palette=['#2563eb','#059669','#7c3aed','#ea580c','#0891b2','#db2777','#65a30d','#ca8a04','#4f46e5','#0f766e'];
    let last='', groupIndex=-1;
    box.innerHTML=data.map(x=>{
      const bairro=x.bairro||'Bairro não informado';
      let sep='';
      if(last!==bairro){
        groupIndex++;
        const letter=String.fromCharCode(65+(groupIndex%26));
        const color=palette[groupIndex%palette.length];
        sep=`<div class="routeViewGroup" style="--bairro-color:${color}">
          <div class="routeViewLetter">${letter}</div>
          <div class="routeViewBairro"><span>${escapeHtml(bairro)}</span><small>Grupo ${letter}</small></div>
        </div>`;
        last=bairro;
      }
      return sep+`<div class="routeStop ${x.alerta?'routeStopAlert':''}">
        <div class="routeStopNum">${escapeHtml(x.numero)}</div>
        <div class="routeStopBody"><strong>${escapeHtml(x.endereco)}</strong><span>${escapeHtml(bairro)}</span></div>
        ${x.alerta?'<div class="routeStopAlertTag">CONFERIR</div>':''}
      </div>`;
    }).join('');
  }
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
