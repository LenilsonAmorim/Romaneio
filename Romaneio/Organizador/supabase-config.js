window.ROMANEIO_SUPABASE = {
  url: 'https://kfjalmwlbgayyogiaanx.supabase.co',
  anonKey: 'sb_publishable_GXokf74ebXiWSQpv6iuWrg_DfY0cPfH',
  table: 'entregadores_localizacao'
};

// Configuração separada da Planilha Pronta.
window.ROMANEIO_PLANILHA_SUPABASE = {
  url: 'https://kfjalmwlbgayyogiaanx.supabase.co',
  anonKey: 'sb_publishable_GXokf74ebXiWSQpv6iuWrg_DfY0cPfH',
  table: 'romaneio_pronta',
  rotaId: 'rota-principal'
};

// Sincronização das regras do Cadastro com o Supabase.
// IMPORTANTE: não recarrega a página ao receber os dados remotos.
(function () {
  const RULES_KEY = 'romaneio_route_rules_v2';
  const FIXES_KEY = 'romaneio_address_fixes_v1';
  const SYNC_KEY = 'romaneio_rules_sync_v1';
  const ROW_ID = 'principal';

  if (!window.supabase || !window.ROMANEIO_SUPABASE) return;

  const client = window.supabase.createClient(
    window.ROMANEIO_SUPABASE.url,
    window.ROMANEIO_SUPABASE.anonKey
  );

  let syncing = false;
  let ready = false;

  function readLocal() {
    let rules = {};
    let fixes = {};
    try { rules = JSON.parse(localStorage.getItem(RULES_KEY) || '{}') || {}; } catch (_) {}
    try { fixes = JSON.parse(localStorage.getItem(FIXES_KEY) || '{}') || {}; } catch (_) {}
    return { rules, fixes };
  }

  async function pullRemote() {
    const { data, error } = await client.from('romaneio_config')
      .select('id,route_rules,address_fixes,updated_at')
      .eq('id', ROW_ID)
      .maybeSingle();

    if (error) {
      console.warn('[Romaneio] Config:', error.message);
      ready = true;
      return false;
    }

    if (data && (data.route_rules || data.address_fixes)) {
      syncing = true;
      try {
        localStorage.setItem(RULES_KEY, JSON.stringify(data.route_rules || {}));
        localStorage.setItem(FIXES_KEY, JSON.stringify(data.address_fixes || {}));
        localStorage.setItem(SYNC_KEY, String(Date.now()));
      } finally {
        syncing = false;
      }

      // Não usar location.reload().
      // Atualizamos os dados sem reiniciar a página, preservando
      // a tela atual e evitando o loop de atualização.
    }

    ready = true;
    return false;
  }

  async function pushRemote() {
    if (syncing || !ready) return;

    const local = readLocal();

    const { error } = await client.from('romaneio_config').upsert({
      id: ROW_ID,
      route_rules: local.rules,
      address_fixes: local.fixes,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) {
      console.warn('[Romaneio] Falha ao salvar configurações:', error.message);
    }
  }

  const originalSet = localStorage.setItem.bind(localStorage);

  localStorage.setItem = function (key, value) {
    originalSet(key, value);

    if (ready && !syncing && (key === RULES_KEY || key === FIXES_KEY)) {
      clearTimeout(window.__romaneioRulesSyncTimer);
      window.__romaneioRulesSyncTimer = setTimeout(pushRemote, 350);
    }
  };

  const originalRemove = localStorage.removeItem.bind(localStorage);

  localStorage.removeItem = function (key) {
    originalRemove(key);

    if (ready && !syncing && (key === RULES_KEY || key === FIXES_KEY)) {
      clearTimeout(window.__romaneioRulesSyncTimer);
      window.__romaneioRulesSyncTimer = setTimeout(pushRemote, 350);
    }
  };

  pullRemote().then(function () {
    ready = true;
    pushRemote();
  }).catch(function (err) {
    ready = true;
    console.warn('[Romaneio] Erro na sincronização:', err);
  });
})();
