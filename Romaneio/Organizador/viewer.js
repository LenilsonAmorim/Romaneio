(function(){
  const KEY='romaneio_last_route_view_v1';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').trim();
  function escape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function saveFromProcessed(){
    if(typeof processed==='undefined' || !Array.isArray(processed) || !processed.length)return;
    const data=processed.map((x,i)=>({
      numero:x['Número'],sequencia:x['Sequência'],endereco:x['Endereço'],bairro:x['Bairro'],
      alerta:x._quadraReconhecida===false || !!x._pendenteBairro,
      pendenteBairro:!!x._pendenteBairro,originalIndex:x._originalIndex,quadraAjustada:x._quadraAjustada||''
    }));
    localStorage.setItem(KEY,JSON.stringify({data,at:Date.now()}));
    render();
  }
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||{data:[]}}catch(e){return {data:[]}}}
  function bairroKey(v){return norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();}
  function ensureModal(){
    if($('adjustModal'))return;
    const d=document.createElement('div'); d.id='adjustModal'; d.className='adjustModal'; d.hidden=true;
    d.innerHTML=`<div class="adjustBackdrop"></div><div class="adjustDialog" role="dialog" aria-modal="true">
      <div class="adjustHead"><div><div class="eyebrow">AJUSTE DA ROTA</div><h2 id="adjustTitle">Ajustar</h2></div><button type="button" id="adjustClose" class="adjustClose">×</button></div>
      <div id="adjustAddress" class="adjustAddress"></div>
      <div id="adjustQuadraArea"><label><b>Quadra correta</b></label><input id="adjustQuadra" type="text" placeholder="Ex.: D65, A3, D10"><small>Digite somente a letra e o número. Ex.: D65 ou A3.</small></div>
      <div id="adjustBairroArea" hidden><label><b>Bairro correto</b></label><select id="adjustBairro"></select><small>Escolha o bairro correto. Depois de salvar, esta entrega será realocada automaticamente.</small></div>
      <div class="adjustActions"><button type="button" id="adjustSave" class="primary">💾 Salvar e realocar</button><button type="button" id="adjustCancel" class="secondary">Cancelar</button></div>
    </div>`;
    document.body.appendChild(d);
    $('adjustClose').onclick=closeModal; $('adjustCancel').onclick=closeModal; d.querySelector('.adjustBackdrop').onclick=closeModal;
    $('adjustSave').onclick=saveAdjustment;
  }
  let editing=null;
  function openAdjust(item){
    ensureModal(); editing=item;
    const pending=!!item.pendenteBairro;
    $('adjustTitle').textContent=pending?'Informar bairro correto':'Ajustar quadra';
    $('adjustAddress').innerHTML='<b>Endereço:</b> '+escape(item.endereco)+'<br><span>Bairro atual: '+escape(item.bairro||'Não informado')+'</span>';
    $('adjustQuadraArea').hidden=pending; $('adjustBairroArea').hidden=!pending;
    if(pending){
      const rules=loadRouteRules();
      $('adjustBairro').innerHTML='<option value="">Selecione o bairro</option>'+Object.values(rules).map(r=>'<option value="'+escape(r.bairro)+'">'+escape(r.bairro)+'</option>').join('');
    }else{
      $('adjustQuadra').value=item.quadraAjustada||''; setTimeout(()=>$('adjustQuadra').focus(),50);
    }
    $('adjustModal').hidden=false; document.body.classList.add('modalOpen');
  }
  function closeModal(){editing=null;if($('adjustModal'))$('adjustModal').hidden=true;document.body.classList.remove('modalOpen');}
  function saveAdjustment(){
    if(!editing)return;
    if(editing.pendenteBairro){
      const bairro=norm($('adjustBairro').value);
      if(!bairro){alert('Escolha o bairro correto.');return;}
      if(!saveAddressFix(editing.endereco,{bairro})){alert('Não foi possível salvar.');return;}
    }else{
      const q=norm($('adjustQuadra').value);
      if(!q){alert('Digite a quadra correta. Ex.: D65 ou A3.');return;}
      const token=routeToken(q);
      if(!token){alert('Digite uma quadra válida, como D65, A3 ou D10.');return;}
      if(!saveAddressFix(editing.endereco,{quadra:token})){alert('Não foi possível salvar.');return;}
    }
    closeModal();
    if(typeof analyze==='function') analyze();
    else render();
  }
  function render(){
    const box=$('routeViewList'),empty=$('routeViewEmpty'),count=$('routeViewCount'),search=$('routeSearch'); if(!box)return;
    const state=load(),q=norm(search&&search.value).toLowerCase(); let data=state.data||[];
    if(q)data=data.filter(x=>(x.endereco+' '+x.bairro+' '+x.sequencia).toLowerCase().includes(q));
    if(count)count.textContent=(state.data||[]).length;
    if(!data.length){box.innerHTML='';if(empty)empty.hidden=false;return;}
    if(empty)empty.hidden=true;
    const palette=['#2563eb','#059669','#7c3aed','#ea580c','#0891b2','#db2777','#65a30d','#ca8a04','#4f46e5','#0f766e'];
    let lastKey='',groupIndex=-1,displayNames={};
    box.innerHTML=data.map((x,i)=>{
      const bairro=x.bairro||'Bairro não informado',key=bairroKey(bairro); if(!displayNames[key])displayNames[key]=bairro; let sep='';
      if(lastKey!==key){groupIndex++;const letter=String.fromCharCode(65+(groupIndex%26)),color=palette[groupIndex%palette.length];sep=`<div class="routeViewGroup" style="--bairro-color:${color}"><div class="routeViewLetter">${letter}</div><div class="routeViewBairro"><span>${escape(displayNames[key])}</span><small>Grupo ${letter}</small></div></div>`;lastKey=key;}
      const alertTag=x.alerta?`<button type="button" class="routeAdjustBtn" data-adjust-index="${i}">${x.pendenteBairro?'AJUSTAR BAIRRO':'AJUSTAR'}</button>`:'';
      return sep+`<div class="routeStop ${x.alerta?'routeStopAlert':''}"><div class="routeStopNum">${escape(x.numero)}</div><div class="routeStopBody"><div class="routeAddressLine"><strong><span class="routeSequenceInline">Ordem ${escape(x.sequencia||'—')}</span> — ${escape(x.endereco)}</strong></div><span>${escape(displayNames[key])}</span></div>${alertTag}</div>`;
    }).join('');
    box.querySelectorAll('[data-adjust-index]').forEach(btn=>btn.onclick=()=>openAdjust(data[Number(btn.dataset.adjustIndex)]));
  }
  function show(screen){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('activeScreen'));const el=$(screen);if(el)el.classList.add('activeScreen');document.querySelectorAll('.navItem').forEach(x=>x.classList.remove('active'));const nav=screen==='screenRoute'?'navRoute':screen==='screenCadastro'?'navCadastro':'navView';$(nav)?.classList.add('active');window.scrollTo(0,0);if(screen==='screenView')render();}
  window.addEventListener('load',()=>{
    ensureModal();
    const table=$('preview'); if(table){new MutationObserver(()=>saveFromProcessed()).observe(table.querySelector('tbody'),{childList:true,subtree:true});setTimeout(saveFromProcessed,500);}
    $('navRoute')?.addEventListener('click',()=>show('screenRoute'));$('navCadastro')?.addEventListener('click',()=>show('screenCadastro'));$('navView')?.addEventListener('click',()=>show('screenView'));$('routeSearch')?.addEventListener('input',render);$('refreshRouteView')?.addEventListener('click',()=>{saveFromProcessed();render();});render();
  });
})();
