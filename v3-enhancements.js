(function(){
  const cfg = (window.PEDALAPP_APP_CONFIG || {});
  const enabledPWA = cfg.enablePWA !== false;
  const enabledAudit = cfg.enableAuditLog !== false;
  const enabledBackup = cfg.enableBackupTools !== false;
  const enabledClientSearch = cfg.enableClientSearch !== false;
  let deferredInstallPrompt = null;
  let auditUnsubscribe = null;

  function q(id){ return document.getElementById(id); }
  function safe(fn, fallback=null){ try { return fn(); } catch(e){ return fallback; } }
  function getDb(){ return safe(() => db, null); }
  function nowIso(){ return new Date().toISOString(); }
  function currentRole(){
    if (safe(() => isDevLoggedIn, false)) return 'developer';
    if (safe(() => isAdminLoggedIn, false)) return 'admin';
    return 'public';
  }
  function currentClientSlug(){
    return safe(() => (clienteContexto && (clienteContexto.slug || clienteContexto.id)) || clienteSlugAtual || '', '');
  }
  function sanitizeForLog(value){
    if (value == null) return value;
    if (typeof value === 'string') return value.length > 180 ? value.slice(0, 180) + '…' : value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map(sanitizeForLog).slice(0, 8);
    if (value instanceof File) return { name: value.name, size: value.size, type: value.type };
    if (typeof value === 'object') {
      const out = {};
      Object.keys(value).slice(0, 12).forEach((k) => out[k] = sanitizeForLog(value[k]));
      return out;
    }
    return String(value);
  }

  async function logAudit(action, meta){
    if (!enabledAudit) return;
    const _db = getDb();
    if (!_db) return;
    try{
      await _db.collection('audit_logs').add({
        action,
        role: currentRole(),
        clientSlug: currentClientSlug(),
        meta: sanitizeForLog(meta || {}),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAtIso: nowIso(),
        source: 'v3-enhancements'
      });
    }catch(e){}
  }

  function wrapAction(name, label){
    const original = window[name];
    if (typeof original !== 'function' || original.__v3_wrapped) return;
    const wrapped = async function(...args){
      try{
        const result = await original.apply(this, args);
        logAudit(label || name, { args });
        return result;
      }catch(error){
        logAudit((label || name) + '_erro', { message: error && error.message ? error.message : String(error) });
        throw error;
      }
    };
    wrapped.__v3_wrapped = true;
    window[name] = wrapped;
  }

  function installActionWrappers(){
    [
      'salvarClienteDev',
      'excluirClienteAtualDev',
      'salvarPedal',
      'excluirPedalAtual',
      'salvarVestuarioEvento',
      'excluirVestuarioEventoAtual',
      'inscreverCiclista',
      'salvarEscolhaVestuarioPublica',
      'reabrirPedalPorId',
      'reabrirProdutoPorId'
    ].forEach((name) => wrapAction(name));
  }

  function installPWAButton(){
    if (!enabledPWA) return;
    const btn = document.createElement('button');
    btn.className = 'floating-install hidden';
    btn.id = 'btnInstalarPWA';
    btn.textContent = 'Instalar app';
    btn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => {});
      deferredInstallPrompt = null;
      btn.classList.add('hidden');
      logAudit('pwa_install_prompt');
    });
    document.body.appendChild(btn);

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      btn.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
      btn.classList.add('hidden');
      logAudit('pwa_installed');
    });
  }

  function registerServiceWorker(){
    if (!enabledPWA || !('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  function buildUtilityCard(){
    const host = q('devClientesCards');
    if (!host || q('v3UtilityCard')) return;

    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.id = 'v3UtilityCard';
    wrap.innerHTML = `
      <div class="section-title">
        <div>
          <h3>Utilitários V3</h3>
          <div class="muted">Backup, importação, exportação e auditoria da operação.</div>
        </div>
      </div>
      <div class="utility-grid">
        <div class="utility-card">
          <div class="pill">Backup operacional</div>
          <div class="utility-actions">
            <button class="btn mini" id="v3ExportBackupBtn" type="button">Exportar backup JSON</button>
            <button class="btn mini secondary" id="v3ImportBackupBtn" type="button">Importar backup JSON</button>
            <input type="file" id="v3ImportBackupFile" accept="application/json" class="hidden" />
          </div>
          <div class="file-hint">Exporta clientes, eventos, inscritos, produtos, pedidos e logs recentes.</div>
        </div>
        <div class="utility-card">
          <div class="pill">Base comercial</div>
          <div class="utility-actions">
            <button class="btn mini ghost" id="v3ExportClientsBtn" type="button">Exportar clientes CSV</button>
            <button class="btn mini ghost" id="v3RefreshAuditBtn" type="button">Atualizar auditoria</button>
          </div>
          <div class="file-hint">Ideal para controle comercial, migração e conferência rápida.</div>
        </div>
      </div>
      <div class="utility-actions" style="margin-top:14px">
        <div class="warning-badge" id="v3SystemHealth">Leitura da saúde do sistema carregando…</div>
      </div>
      <div id="v3UtilityMsg"></div>
    `;

    const logs = document.createElement('div');
    logs.className = 'card';
    logs.id = 'v3AuditCard';
    logs.innerHTML = `
      <div class="section-title">
        <div>
          <h3>Auditoria recente</h3>
          <div class="muted">Últimas ações registradas no Firestore.</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table-mini">
          <thead>
            <tr><th>Quando</th><th>Ação</th><th>Papel</th><th>Cliente</th></tr>
          </thead>
          <tbody id="v3AuditRows">
            <tr><td colspan="4" class="muted">Sem dados ainda.</td></tr>
          </tbody>
        </table>
      </div>
    `;

    host.prepend(logs);
    host.prepend(wrap);

    q('v3ExportBackupBtn')?.addEventListener('click', exportBackupJson);
    q('v3ImportBackupBtn')?.addEventListener('click', () => q('v3ImportBackupFile')?.click());
    q('v3ImportBackupFile')?.addEventListener('change', importBackupJson);
    q('v3ExportClientsBtn')?.addEventListener('click', exportClientsCsv);
    q('v3RefreshAuditBtn')?.addEventListener('click', startAuditListener);
  }

  function showUtilityMessage(text, error){
    const el = q('v3UtilityMsg');
    if (!el) return;
    el.innerHTML = text ? `<div class="notice${error ? ' error' : ''}">${text}</div>` : '';
  }

  async function readCollectionDocs(name){
    const _db = getDb();
    if (!_db) throw new Error('Firestore indisponível');
    const snap = await _db.collection(name).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function exportBackupJson(){
    if (!enabledBackup) return;
    showUtilityMessage('Gerando backup...');
    try{
      const _db = getDb();
      const payload = {
        exportedAt: nowIso(),
        version: 3,
        developer_clients: await readCollectionDocs('developer_clients'),
        events: [],
        vestuario_events: [],
        audit_logs_recent: []
      };
      const eventsSnap = await _db.collection('events').get();
      for (const doc of eventsSnap.docs) {
        const inscritosSnap = await doc.ref.collection('inscritos').get();
        payload.events.push({
          id: doc.id,
          ...doc.data(),
          inscritos: inscritosSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        });
      }
      const productsSnap = await _db.collection('vestuario_events').get();
      for (const doc of productsSnap.docs) {
        const ordersSnap = await doc.ref.collection('escolhas').get();
        payload.vestuario_events.push({
          id: doc.id,
          ...doc.data(),
          escolhas: ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        });
      }
      try{
        const logsSnap = await _db.collection('audit_logs').orderBy('createdAt', 'desc').limit(100).get();
        payload.audit_logs_recent = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }catch(e){}
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const name = `pedalapp-backup-v3-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
      downloadBlob(blob, name);
      showUtilityMessage('Backup exportado com sucesso.');
      logAudit('backup_exportado', { file: name });
    }catch(error){
      showUtilityMessage('Falha ao exportar backup.', true);
    }
  }

  async function importBackupJson(event){
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    showUtilityMessage('Importando backup...');
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      const _db = getDb();
      const batchSet = async (items, collection) => {
        for (const item of items || []) {
          const { id, ...rest } = item || {};
          if (!id) continue;
          await _db.collection(collection).doc(id).set(rest, { merge: true });
        }
      };
      await batchSet(data.developer_clients, 'developer_clients');

      for (const item of (data.events || [])) {
        const { id, inscritos = [], ...rest } = item;
        if (!id) continue;
        await _db.collection('events').doc(id).set(rest, { merge: true });
        for (const sub of inscritos) {
          const { id: subId, ...subRest } = sub;
          if (!subId) continue;
          await _db.collection('events').doc(id).collection('inscritos').doc(subId).set(subRest, { merge: true });
        }
      }

      for (const item of (data.vestuario_events || [])) {
        const { id, escolhas = [], ...rest } = item;
        if (!id) continue;
        await _db.collection('vestuario_events').doc(id).set(rest, { merge: true });
        for (const sub of escolhas) {
          const { id: subId, ...subRest } = sub;
          if (!subId) continue;
          await _db.collection('vestuario_events').doc(id).collection('escolhas').doc(subId).set(subRest, { merge: true });
        }
      }

      showUtilityMessage('Backup importado com sucesso.');
      logAudit('backup_importado', { file: file.name });
      safe(() => carregarClientes && carregarClientes());
      safe(() => carregarPedais && carregarPedais());
      safe(() => carregarVestuarioEventos && carregarVestuarioEventos());
    }catch(error){
      showUtilityMessage('Falha ao importar backup JSON.', true);
    }finally{
      event.target.value = '';
    }
  }

  function exportClientsCsv(){
    const rows = safe(() => cacheClientes, []) || [];
    const csv = [
      ['id','nome','slug','plano','status','validade','responsavel','whats','cidade','dominio']
    ].concat(rows.map((c) => [
      c.id || '', c.nome || '', c.slug || '', c.plano || '', c.status || '', c.validade || '',
      c.responsavel || '', c.whats || '', c.cidade || '', c.dominio || ''
    ]));
    const body = csv.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    downloadBlob(new Blob([body], { type:'text/csv;charset=utf-8;' }), 'clientes-pedalapp-v3.csv');
    logAudit('clientes_csv_exportado', { total: rows.length });
  }

  function downloadBlob(blob, fileName){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function injectClientSearch(){
    if (!enabledClientSearch) return;
    const table = q('listaClientesDev');
    const card = table && table.closest('.card');
    if (!card || q('v3ClientSearch')) return;
    const bar = document.createElement('div');
    bar.className = 'row';
    bar.style.marginTop = '10px';
    bar.innerHTML = `
      <div>
        <label>Buscar cliente</label>
        <input id="v3ClientSearch" placeholder="Nome, slug, plano, cidade..." />
      </div>
      <div>
        <label>Filtro rápido</label>
        <input value="Digite para filtrar a tabela abaixo" disabled />
      </div>
    `;
    const tableWrap = card.querySelector('.table-wrap');
    card.insertBefore(bar, tableWrap);

    q('v3ClientSearch').addEventListener('input', () => {
      const term = q('v3ClientSearch').value.trim().toLowerCase();
      Array.from(table.querySelectorAll('tr')).forEach((tr) => {
        tr.style.display = !term || tr.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    });
  }

  function updateHealthBadge(){
    const el = q('v3SystemHealth');
    if (!el) return;
    const clients = safe(() => cacheClientes, []) || [];
    const openEvents = safe(() => cachePedais.filter((p) => !safe(() => isPedalEncerrado(p), false)).length, 0);
    const openProducts = safe(() => cacheVestuarioEventos.filter((p) => !safe(() => isProdutoEncerrado(p), false)).length, 0);
    const expiringSoon = clients.filter((c) => {
      if (!c || !c.validade || c.plano === 'Vitalício') return false;
      const end = new Date(`${c.validade}T23:59:59`);
      const now = new Date();
      const diff = (end - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;
    const blocked = clients.filter((c) => (c.status || '') === 'Bloqueado').length;
    el.textContent = `Clientes: ${clients.length} • Vencendo em 7 dias: ${expiringSoon} • Bloqueados: ${blocked} • Pedais abertos: ${openEvents} • Produtos abertos: ${openProducts}`;
  }

  function startAuditListener(){
    const _db = getDb();
    const body = q('v3AuditRows');
    if (!_db || !body) return;
    if (auditUnsubscribe) auditUnsubscribe();
    try{
      auditUnsubscribe = _db.collection('audit_logs').orderBy('createdAt', 'desc').limit(30).onSnapshot((snap) => {
        const rows = snap.docs.map((doc) => {
          const d = doc.data() || {};
          const when = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleString('pt-BR') : (d.createdAtIso || '—');
          return `<tr><td>${escapeHtmlV3(when)}</td><td>${escapeHtmlV3(d.action || d.type || '')}</td><td>${escapeHtmlV3(d.role || '')}</td><td>${escapeHtmlV3(d.clientSlug || '')}</td></tr>`;
        });
        body.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="4" class="muted">Sem logs ainda.</td></tr>';
      }, () => {
        body.innerHTML = '<tr><td colspan="4" class="muted">Não foi possível ler auditoria agora.</td></tr>';
      });
    }catch(e){
      body.innerHTML = '<tr><td colspan="4" class="muted">Coleção de auditoria indisponível.</td></tr>';
    }
  }

  function escapeHtmlV3(str){
    return String(str || '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  }

  function patchMetrics(){
    const original = window.atualizarMetricasClientes;
    if (typeof original === 'function' && !original.__v3_wrapped) {
      const wrapped = function(...args){
        const result = original.apply(this, args);
        setTimeout(updateHealthBadge, 50);
        return result;
      };
      wrapped.__v3_wrapped = true;
      window.atualizarMetricasClientes = wrapped;
    }
    const original2 = window.atualizarMetricasOperacionaisV2;
    if (typeof original2 === 'function' && !original2.__v3_wrapped) {
      const wrapped = function(...args){
        const result = original2.apply(this, args);
        setTimeout(updateHealthBadge, 50);
        return result;
      };
      wrapped.__v3_wrapped = true;
      window.atualizarMetricasOperacionaisV2 = wrapped;
    }
  }

  function init(){
    installActionWrappers();
    installPWAButton();
    registerServiceWorker();
    buildUtilityCard();
    injectClientSearch();
    patchMetrics();
    updateHealthBadge();
    startAuditListener();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
