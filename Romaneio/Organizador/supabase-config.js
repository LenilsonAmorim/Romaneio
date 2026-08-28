window.ROMANEIO_SUPABASE = {
  url: 'https://kfjalmwlbgayyogiaanx.supabase.co',
  anonKey: 'sb_publishable_GXokf74ebXiWSQpv6iuWrg_DfY0cPfH',
  table: 'entregadores_localizacao'
};

// Configuração separada da Planilha Pronta.
// O rastreamento continua usando ROMANEIO_SUPABASE acima.
window.ROMANEIO_PLANILHA_SUPABASE = {
  url: 'https://kfjalmwlbgayyogiaanx.supabase.co',
  anonKey: 'sb_publishable_GXokf74ebXiWSQpv6iuWrg_DfY0cPfH',
  table: 'romaneio_pronta',
  rotaId: 'rota-principal'
};

// O restante do arquivo de sincronização do Cadastro permanece igual.
// Este bloco é carregado pelo site para sincronizar as regras salvas.
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
      .eq('id', ROW_ID).maybeSingle();

    if (error) { console.warn('[Romaneio] Config:', error.message); ready = true; return false; }

    if (data && (data.route_rules || data.address_fixes)) {
      syncing = true;
      localStorage.setItem(RULES_KEY, JSON.stringify(data.route_rules || {}));
      localStorage.setItem(FIXES_KEY, JSON.stringify(data.address_fixes || {}));
      localStorage.setItem(SYNC_KEY, String(Date.now()));
      syncing = false;
      if (!sessionStorage.getItem('romaneio_rules_reloaded')) {
        sessionStorage.setItem('romaneio_rules_reloaded', '1');
        location.reload();
        return true;
      }
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
    if (error) console.warn('[Romaneio] Falha ao salvar configurações:', error.message);
  }

  const originalSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    originalSet(key, value);
    if (ready && (key === RULES_KEY || key === FIXES_KEY)) {
      clearTimeout(window.__romaneioRulesSyncTimer);
      window.__romaneioRulesSyncTimer = setTimeout(pushRemote, 350);
    }
  };

  const originalRemove = localStorage.removeItem.bind(localStorage);
  localStorage.removeItem = function (key) {
    originalRemove(key);
    if (ready && (key === RULES_KEY || key === FIXES_KEY)) {
      clearTimeout(window.__romaneioRulesSyncTimer);
      window.__romaneioRulesSyncTimer = setTimeout(pushRemote, 350);
    }
  };

  pullRemote().then(() => {
    ready = true;
    pushRemote();
    sessionStorage.removeItem('romaneio_rules_reloaded');
  });
})();
