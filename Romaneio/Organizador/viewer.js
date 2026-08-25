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
  const FINISHED_KEY='romaneio_finished_stops_v1';
  const MANUAL_ORDER_KEY='romaneio_manual_route_order_v1';
  function loadFinished(){try{return JSON.parse(localStorage.getItem(FINISHED_KEY)||'[]')||[]}catch(e){return[]}}
  function saveFinished(v){localStorage.setItem(FINISHED_KEY,JSON.stringify(v))}
  function loadManualOrder(){try{return JSON.parse(localStorage.getItem(MANUAL_ORDER_KEY)||'[]')||[]}catch(e){return[]}}
  function saveManualOrder(v){localStorage.setItem(MANUAL_ORDER_KEY,JSON.stringify(v))}
  function stopKey(x){return String(x.originalIndex??'')+'|'+String(x.numero??'')+'|'+String(x.endereco??'')}
  function isFinished(x){return loadFinished().includes(stopKey(x))}
  function applyManualOrder(data){
    const order=loadManualOrder(); if(!order.length)return data;
    const pos=new Map(order.map((k,i)=>[k,i]));
    return data.map((x,i)=>({x,i,k:stopKey(x)})).sort((a,b)=>{
      const pa=pos.has(a.k)?pos.get(a.k):1000000+a.i;
      const pb=pos.has(b.k)?pos.get(b.k):1000000+b.i;
      return pa-pb;
    }).map(o=>o.x);
  }
  function finishStop(x){
    const key=stopKey(x), done=loadFinished();
    if(done.includes(key))return;
    saveFinished([...done,key]);
    render();
    showUndo([key],1);
  }
  function undoFinishedKeys(keys){
    const wanted=new Set((keys||[]).filter(Boolean));
    if(!wanted.size)return;
    saveFinished(loadFinished().filter(k=>!wanted.has(k)));
    render();
  }
  function showUndo(keys,count){
    let bar=$('routeUndoBar');
    if(!bar){
      bar=document.createElement('div');bar.id='routeUndoBar';bar.className='routeUndoBar';
      document.body.appendChild(bar);
    }
    const safeKeys=[...(keys||[])].filter(Boolean);
    bar.innerHTML=`<span>${count>1?count+' entregas finalizadas':'Entrega finalizada'}</span><button type="button" id="routeUndoBtn">↩ Voltar</button>`;
    bar.hidden=false;
    clearTimeout(window.__routeUndoTimer);
    window.__routeUndoTimer=setTimeout(()=>{bar.hidden=true},7000);
    const btn=$('routeUndoBtn');
    if(btn){btn.onclick=()=>{undoFinishedKeys(safeKeys);bar.hidden=true;};}
  }
  function addressGroupKey(x){
    const b=bairroKey(x.bairro||'Bairro não informado');
    const a=norm(x.endereco||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    return b+'|'+a;
  }
  function groupSameAddresses(data){
    const groups=[]; const map=new Map();
    data.forEach(x=>{
      const key=addressGroupKey(x);
      if(!map.has(key)){const g={key,items:[]};map.set(key,g);groups.push(g);}
      map.get(key).items.push(x);
    });
    return groups;
  }
  function finishGroup(group){
    const keys=group.items.map(stopKey).filter(k=>!loadFinished().includes(k));
    if(!keys.length)return;
    saveFinished([...new Set([...loadFinished(),...keys])]);
    render();
    showUndo(keys,keys.length);
  }
  function render(){
    const box=$('routeViewList'),empty=$('routeViewEmpty'),count=$('routeViewCount'),search=$('routeSearch'); if(!box)return;
    const state=load(),q=norm(search&&search.value).toLowerCase();
    let data=applyManualOrder((state.data||[]).filter(x=>!isFinished(x)));
    if(q)data=data.filter(x=>(x.endereco+' '+x.bairro+' '+x.sequencia).toLowerCase().includes(q));
    if(count)count.textContent=data.length;
    if(!data.length){box.innerHTML='';if(empty){empty.hidden=false;empty.querySelector('h2').textContent='Rota concluída';empty.querySelector('p').textContent='Não há entregas pendentes. As entregas finalizadas ficam removidas da lista.';}return;}
    if(empty){empty.hidden=true;empty.querySelector('h2').textContent='Nenhuma rota analisada ainda';}
    const palette=['#2563eb','#059669','#7c3aed','#ea580c','#0891b2','#db2777','#65a30d','#ca8a04','#4f46e5','#0f766e'];
    let lastKey='',groupIndex=-1,displayNames={};
    const groupCounts={};
    data.forEach(x=>{const k=bairroKey(x.bairro||'Bairro não informado');groupCounts[k]=(groupCounts[k]||0)+1;displayNames[k]=displayNames[k]||x.bairro||'Bairro não informado';});
    const groups=groupSameAddresses(data);
    box.innerHTML=groups.map((g,gi)=>{
      const x=g.items[0],bairro=x.bairro||'Bairro não informado',key=bairroKey(bairro);
      let sep='';
      if(lastKey!==key){
        groupIndex++;const letter=String.fromCharCode(65+(groupIndex%26)),color=palette[groupIndex%palette.length];
        sep=`<div class="routeViewGroup" style="--bairro-color:${color}"><div class="routeViewLetter">${letter}</div><div class="routeViewBairro"><div class="routeBairroName"><span>${escape(displayNames[key])}</span><strong>${groupCounts[key]} ${groupCounts[key]===1?'entrega':'entregas'}</strong></div><small>GRUPO ${letter}</small></div></div>`;
        lastKey=key;
      }
      const alertItem=g.items.find(item=>item.alerta);
      const alertTag=alertItem?`<button type="button" class="routeAdjustBtn" data-adjust-group="${gi}">${alertItem.pendenteBairro?'AJUSTAR BAIRRO':'AJUSTAR'}</button>`:'';
      const dragId=encodeURIComponent(g.items.map(stopKey).join('||'));
      const grouped=g.items.length>1;
      const lines=g.items.map(item=>`<div class="routeAddressLine"><strong><span class="routeSequenceInline">Ordem ${escape(item.sequencia||'—')}</span> — ${escape(item.endereco)}</strong></div>`).join('');
      const multiTag=grouped?`<div class="routeSameAddressTag">${g.items.length} entregas no mesmo endereço</div>`:'';
      return sep+`<div class="routeStop ${alertItem?'routeStopAlert ':''}${grouped?'routeStopGrouped':''}" data-drag-id="${dragId}" data-bairro-key="${escape(key)}" title="Segure o endereço para mover"><div class="routeStopNum">${grouped?g.items.length:escape(x.numero)}</div><div class="routeStopBody">${multiTag}${lines}<span>${escape(displayNames[key])}</span></div><div class="routeStopActions">${alertTag}<button type="button" class="routeFinishBtn" data-finish-group="${gi}" aria-label="Finalizar ${g.items.length} entrega${g.items.length===1?'':'s'}">✓</button></div></div>`;
    }).join('');
    box.querySelectorAll('[data-adjust-group]').forEach(btn=>btn.onclick=()=>{const g=groups[Number(btn.dataset.adjustGroup)];const item=g.items.find(x=>x.alerta)||g.items[0];openAdjust(item);});
    box.querySelectorAll('[data-finish-group]').forEach(btn=>btn.onclick=()=>finishGroup(groups[Number(btn.dataset.finishGroup)]));
    enableLongPressReorder(box);
  }
  function enableLongPressReorder(box){
    let drag=null;
    box.querySelectorAll('.routeStop[data-drag-id]').forEach(card=>{
      let timer=null,started=false,startX=0,startY=0,pointerId=null;
      const stopTimer=()=>{if(timer){clearTimeout(timer);timer=null}};
      const finish=()=>{
        stopTimer();
        if(started){started=false;card.classList.remove('routeDragging');card.style.touchAction='';try{if(pointerId!=null)card.releasePointerCapture(pointerId)}catch(e){}drag=null;persistDomOrder(box);}
        pointerId=null;
      };
      card.addEventListener('pointerdown',ev=>{
        if(ev.pointerType==='mouse'&&ev.button!==0)return;
        if(ev.target.closest('button,input,select,a'))return;
        startX=ev.clientX;startY=ev.clientY;pointerId=ev.pointerId;stopTimer();
        timer=setTimeout(()=>{started=true;drag=card;card.classList.add('routeDragging');card.style.touchAction='none';try{card.setPointerCapture(pointerId)}catch(e){}if(navigator.vibrate)navigator.vibrate(45);},420);
      },{passive:true});
      card.addEventListener('pointermove',ev=>{
        if(!started){if(Math.hypot(ev.clientX-startX,ev.clientY-startY)>14)stopTimer();return;}
        ev.preventDefault();
        const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.routeStop[data-drag-id]');
        if(!target||target===card||target.dataset.bairroKey!==card.dataset.bairroKey)return;
        const rect=target.getBoundingClientRect();
        if(ev.clientY<rect.top+rect.height/2)target.before(card);else target.after(card);
      },{passive:false});
      card.addEventListener('pointerup',finish,{passive:true});
      card.addEventListener('pointercancel',finish,{passive:true});
      card.addEventListener('lostpointercapture',()=>{if(started)finish();},{passive:true});
    });
  }
  function persistDomOrder(box){
    const current=[];
    [...box.querySelectorAll('.routeStop[data-drag-id]')].forEach(el=>decodeURIComponent(el.dataset.dragId||'').split('||').filter(Boolean).forEach(k=>current.push(k)));
    if(current.length)saveManualOrder(current);
  }

  function show(screen){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('activeScreen'));const el=$(screen);if(el)el.classList.add('activeScreen');document.querySelectorAll('.navItem').forEach(x=>x.classList.remove('active'));const nav=screen==='screenRoute'?'navRoute':screen==='screenCadastro'?'navCadastro':'navView';$(nav)?.classList.add('active');window.scrollTo(0,0);if(screen==='screenView')render();}
  window.addEventListener('load',()=>{
    ensureModal();
    const table=$('preview'); if(table){new MutationObserver(()=>saveFromProcessed()).observe(table.querySelector('tbody'),{childList:true,subtree:true});setTimeout(saveFromProcessed,500);}
    $('navRoute')?.addEventListener('click',()=>show('screenRoute'));$('navCadastro')?.addEventListener('click',()=>show('screenCadastro'));$('navView')?.addEventListener('click',()=>show('screenView'));$('routeSearch')?.addEventListener('input',render);$('refreshRouteView')?.addEventListener('click',()=>{saveFromProcessed();render();});render();
  });
})();
