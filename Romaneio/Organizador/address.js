(() => {
  const KEY='romaneio_manual_addresses_v1';
  const get=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')||[]}catch(e){return[]}};
  const set=v=>localStorage.setItem(KEY,JSON.stringify(v));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let supa=null;

  function addStyles(){
    if(document.getElementById('manualAddressStyles'))return;
    const s=document.createElement('style');s.id='manualAddressStyles';
    s.textContent=`.manualAddressBox{margin-top:16px}.manualAddressList{margin-top:12px;display:grid;gap:8px}.manualAddress{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #ddd;border-radius:10px}.manualAddress>div{flex:1}.manualAddress span{display:block;color:#666;font-size:.9em;margin-top:3px}.manualAddress button{border:0;border-radius:8px;padding:7px 9px}.manualModal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:18px;z-index:9999}.manualModal[hidden]{display:none}.manualModalCard{background:#fff;border-radius:16px;padding:20px;width:min(520px,100%);box-shadow:0 10px 40px rgba(0,0,0,.25)}.manualModalCard label{display:block;margin-top:12px;margin-bottom:5px;font-weight:600}.manualModalCard input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #ccc;border-radius:10px;font-size:16px}.manualModalCard .actions{margin-top:16px}`;
    document.head.appendChild(s);
  }

  function loadSupabase(){
    const cfg=window.ROMANEIO_SUPABASE||{};
    if(!cfg.url||!cfg.anonKey)return;
    const start=()=>{try{if(window.supabase?.createClient)supa=window.supabase.createClient(cfg.url,cfg.anonKey);if(supa)pullRemote()}catch(e){console.warn('Supabase:',e)}};
    if(window.supabase?.createClient){start();return}
    const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=start;s.onerror=()=>console.warn('Não foi possível carregar Supabase');document.head.appendChild(s);
  }

  async function pullRemote(){
    if(!supa)return;
    const table=(window.ROMANEIO_SUPABASE||{}).table||'romaneio_enderecos';
    const {data,error}=await supa.from(table).select('id,endereco,bairro,quadra,manual,created_at').order('created_at',{ascending:true});
    if(error){console.warn('Supabase select:',error);return}
    const local=get(),keys=new Set(local.map(x=>clean(x.endereco).toLowerCase()));
    (data||[]).forEach(x=>{const k=clean(x.endereco).toLowerCase();if(k&&!keys.has(k)){local.push({endereco:x.endereco,bairro:x.bairro||'',quadra:x.quadra||'',remoteId:x.id});keys.add(k)}});
    set(local);refresh();
  }

  async function pushRemote(item){
    if(!supa)return;
    const table=(window.ROMANEIO_SUPABASE||{}).table||'romaneio_enderecos';
    const {error}=await supa.from(table).insert({endereco:item.endereco,bairro:item.bairro||null,quadra:item.quadra||null,manual:true});
    if(error)console.warn('Supabase insert:',error);
  }

  function addManualRows(){
    if(!Array.isArray(window.rows))return;
    const existing=new Set(window.rows.map(r=>String(r['Endereço']||'').toLowerCase()));
    get().forEach(m=>{
      const addr=clean(m.endereco);if(!addr||existing.has(addr.toLowerCase()))return;
      window.rows.push({'Número':String(window.rows.length+1),'Sequência':m.quadra||'','Endereço':addr,'Bairro':clean(m.bairro)||'Não informado','_bairroOriginal':clean(m.bairro)||'Não informado','_bairroReconhecido':!!m.bairro,'_bairroSource':'manual','_pendenteBairro':!m.bairro,'_quadra':999999,'_numeroCasa':999999,'_originalIndex':window.rows.length,'_manual':true});
      existing.add(addr.toLowerCase());
    });
  }

  function refresh(){addManualRows();if(typeof window.analyze==='function')window.analyze();renderList()}
  function renderList(){
    const list=document.getElementById('manualAddressList');if(!list)return;
    const items=get();
    list.innerHTML=items.length?items.map((m,i)=>`<div class="manualAddress"><div><b>${esc(m.endereco)}</b><span>${esc(m.bairro||'Sem bairro')}${m.quadra?' • QD '+esc(m.quadra):''}</span></div><button data-remove-manual="${i}" type="button">Remover</button></div>`).join(''):'<span class="muted">Nenhum endereço adicionado manualmente.</span>';
    list.querySelectorAll('[data-remove-manual]').forEach(b=>b.onclick=()=>{const a=get();a.splice(Number(b.dataset.removeManual),1);set(a);refresh()});
  }

  function closeModal(){const m=document.getElementById('manualAddressModal');if(m)m.hidden=true}
  function openModal(){const m=document.getElementById('manualAddressModal');if(m){m.hidden=false;document.getElementById('manualEndereco').focus()}}
  async function save(){
    const endereco=clean(document.getElementById('manualEndereco').value),bairro=clean(document.getElementById('manualBairro').value),quadra=clean(document.getElementById('manualQuadra').value);
    if(!endereco){alert('Digite o endereço.');return}
    const item={endereco,bairro,quadra,createdAt:Date.now()},a=get();a.push(item);set(a);
    ['manualEndereco','manualBairro','manualQuadra'].forEach(id=>document.getElementById(id).value='');
    closeModal();refresh();await pushRemote(item);alert('Endereço adicionado à rota e à exportação.');
  }

  function mount(){
    addStyles();
    if(document.getElementById('manualAddressButton'))return;
    const analyze=document.getElementById('analyze');if(!analyze)return setTimeout(mount,200);
    const box=document.createElement('div');box.className='card manualAddressBox';box.innerHTML=`<div class="eyebrow">ENDEREÇO MANUAL</div><h2>Adicionar endereço</h2><p class="muted">Inclua uma entrega que não está na planilha.</p><button id="manualAddressButton" class="primary full" type="button">➕ Adicionar endereço</button><div id="manualAddressList" class="manualAddressList"></div>`;
    analyze.closest('.hero').after(box);
    const modal=document.createElement('div');modal.id='manualAddressModal';modal.hidden=true;modal.className='manualModal';modal.innerHTML=`<div class="manualModalCard"><h2>Adicionar endereço</h2><label>Endereço</label><input id="manualEndereco" placeholder="Rua, número, complemento"><label>Bairro</label><input id="manualBairro" placeholder="Ex.: Jarbas"><label>Quadra (opcional)</label><input id="manualQuadra" placeholder="Ex.: D5"><div class="actions"><button id="manualCancel" class="secondary" type="button">Cancelar</button><button id="manualSave" class="primary" type="button">Salvar</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('manualAddressButton').onclick=openModal;document.getElementById('manualCancel').onclick=closeModal;document.getElementById('manualSave').onclick=save;modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
    renderList();loadSupabase();
    document.getElementById('analyze').addEventListener('click',()=>setTimeout(refresh,50));
    document.getElementById('file').addEventListener('change',()=>setTimeout(refresh,100));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();