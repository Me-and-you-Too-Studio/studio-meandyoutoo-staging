// Admin › Clients : écrire dans HubSpot la licence Studio et le pack de chaque client (fiche entreprise).
// Rien n'est écrit sans validation : la fenêtre montre la valeur HubSpot actuelle et la valeur Studio, fiche par fiche.
// Une fiche validée est ensuite tenue à jour chaque nuit. Les fiches partagées par plusieurs clients ne sont jamais écrites.
(function () {
  if (!StudioAPI.requireAuth('admin')) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const actions = document.querySelector('.hs-clients-actions');
  if (!actions) return;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'button button-secondary'; button.textContent = 'Synchroniser HubSpot';
  actions.insertBefore(button, actions.lastElementChild);

  const FORMULAS = { annuelle: 'Annuelle', mensuelle: 'Mensuelle', offerte_lancement: 'Offerte – lancement (1 an)' };
  const show = (field, v) => {
    if (v === null || v === undefined || v === '') return '<em>vide</em>';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return esc(String(v).split('-').reverse().join('/'));
    if (field === 'formule_studio') return esc(FORMULAS[v] || v);
    return esc(typeof v === 'number' ? v.toLocaleString('fr-FR') : v);
  };
  const hubspotUrl = id => `https://app-eu1.hubspot.com/contacts/139575435/company/${encodeURIComponent(id)}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'admin-dialog admin-dialog-wide hs-sync-dialog';
  document.body.appendChild(dialog);
  let rows = [];

  function render(message = '') {
    const changes = rows.filter(r => r.status === 'changes'), same = rows.filter(r => r.status === 'same');
    const shared = rows.filter(r => r.status === 'shared'), missing = rows.filter(r => r.status === 'missing');
    const names = r => r.organizations.map(o => esc(o.name)).join(', ');
    const company = r => `<a href="${hubspotUrl(r.companyId)}" target="_blank" rel="noopener">${esc(r.companyName || 'Fiche ' + r.companyId)} ↗</a>`;
    const check = r => `<input type="checkbox" data-sync-company="${esc(r.companyId)}" aria-label="Écrire ${esc(r.companyName || r.companyId)}">`;
    dialog.innerHTML = `<form method="dialog"><button type="button" class="admin-dialog-close" data-sync-close aria-label="Fermer">×</button>
      <p class="eyebrow">HubSpot</p><h2>Synchroniser la licence et le pack</h2>
      <p class="hs-clients-hint">Pour chaque entreprise HubSpot rattachée à un client du Studio : formule et dates de licence Studio, passations achetées et restantes, dates du pack. Seules les fiches cochées sont écrites ; elles sont ensuite tenues à jour chaque nuit.</p>
      ${message ? `<p class="hs-sync-message">${message}</p>` : ''}
      <h3>Écarts à écrire (${changes.length})</h3>
      ${changes.length ? `<p><button type="button" class="button button-ghost" data-sync-all>Tout cocher</button></p><div class="hs-sync-list">${changes.map(r => `<label class="hs-sync-row">${check(r)}<div><strong>${company(r)}</strong> <small>· ${names(r)}${r.validated ? ' · déjà synchronisée' : ''}</small>
        <ul>${r.changes.map(c => `<li>${esc(c.label)} : ${show(c.field, c.current)} → <strong>${show(c.field, c.next)}</strong></li>`).join('')}</ul></div></label>`).join('')}</div>` : '<p class="hs-clients-hint">Aucun écart : HubSpot est à jour.</p>'}
      ${same.length ? `<details><summary>Déjà à jour (${same.length})</summary><div class="hs-sync-list">${same.map(r => `<label class="hs-sync-row">${r.validated ? '<span>✓</span>' : check(r)}<div>${company(r)} <small>· ${names(r)}${r.validated ? ' · synchronisée chaque nuit' : ' · cocher pour la synchroniser chaque nuit'}</small></div></label>`).join('')}</div></details>` : ''}
      ${shared.length ? `<h3>Fiches partagées, non écrites (${shared.length})</h3><p class="hs-clients-hint">Plusieurs clients du Studio pointent vers la même entreprise HubSpot : à remplir à la main.</p><ul>${shared.map(r => `<li>${company(r)} : ${names(r)}</li>`).join('')}</ul>` : ''}
      ${missing.length ? `<h3>Fiches introuvables (${missing.length})</h3><ul>${missing.map(r => `<li>Fiche ${esc(r.companyId)} : ${names(r)}</li>`).join('')}</ul>` : ''}
      <div class="top-actions"><button type="button" class="button button-ghost" data-sync-close>Fermer</button><button type="button" class="button button-primary" data-sync-apply>Écrire dans HubSpot</button></div></form>`;
    dialog.querySelectorAll('[data-sync-close]').forEach(b => b.onclick = () => dialog.close());
    dialog.querySelector('[data-sync-all]')?.addEventListener('click', () => dialog.querySelectorAll('.hs-sync-list [data-sync-company]').forEach(c => { if (c.closest('details') === null) c.checked = true; }));
    dialog.querySelector('[data-sync-apply]').onclick = apply;
  }

  async function load(message) {
    dialog.innerHTML = '<p class="hs-clients-hint">Lecture des fiches HubSpot…</p>';
    if (!dialog.open) dialog.showModal();
    try {
      const data = await StudioAPI.request('/api/admin/hubspot/company-sync');
      if (!data.enabled) { dialog.innerHTML = '<form method="dialog"><h2>HubSpot non configuré</h2><p>La clé HubSpot est absente du serveur.</p><button class="button">Fermer</button></form>'; return; }
      rows = data.rows || [];
      render(message);
    } catch (e) {
      dialog.innerHTML = `<form method="dialog"><h2>Lecture impossible</h2><p>${esc(e.message)}</p><button class="button">Fermer</button></form>`;
    }
  }

  async function apply() {
    const ids = [...dialog.querySelectorAll('[data-sync-company]:checked')].map(c => c.dataset.syncCompany);
    if (!ids.length) return StudioModal.alert({ eyebrow: 'HubSpot', title: 'Aucune fiche cochée', message: 'Cochez les entreprises à écrire dans HubSpot.' });
    const ok = await StudioModal.confirm({ eyebrow: 'HubSpot', title: `Écrire ${ids.length} fiche${ids.length > 1 ? 's' : ''} dans HubSpot ?`,
      message: 'Les valeurs du Studio remplacent celles de HubSpot pour les champs listés. Ces fiches seront ensuite tenues à jour chaque nuit.', cancelLabel: 'Annuler', confirmLabel: 'Écrire' });
    if (!ok) return;
    try {
      const r = await StudioAPI.request('/api/admin/hubspot/company-sync', { method: 'POST', body: JSON.stringify({ companyIds: ids }) });
      await load(`${r.updated} fiche${r.updated > 1 ? 's' : ''} écrite${r.updated > 1 ? 's' : ''}${r.unchanged ? `, ${r.unchanged} déjà à jour` : ''}${r.failed ? `, ${r.failed} en échec` : ''}.`);
    } catch (e) { render(esc(e.message)); }
  }

  button.addEventListener('click', () => load());
})();
