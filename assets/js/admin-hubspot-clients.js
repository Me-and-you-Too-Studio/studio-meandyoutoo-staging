// Admin › Clients : importer les entreprises « Client » de HubSpot.
// Rattache les clients du Studio à leur entreprise HubSpot et crée les autres sans contact (aucun e-mail d'invitation).
(function () {
  if (!StudioAPI.requireAuth('admin')) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const anchor = document.getElementById('new-org-clients');
  if (!anchor) return;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'button button-secondary'; button.textContent = 'Importer depuis HubSpot';
  anchor.before(button);
  const actions = document.createElement('div'); actions.className = 'hs-clients-actions';
  anchor.parentNode.insertBefore(actions, button); actions.append(button, anchor);

  const dialog = document.createElement('dialog');
  dialog.className = 'admin-dialog admin-dialog-wide hs-clients-dialog';
  document.body.appendChild(dialog);
  let data = null, changed = false;

  const link = c => `<a href="${esc(c.hubspotUrl)}" target="_blank" rel="noopener">Fiche HubSpot ↗</a>`;
  function render(message) {
    const all = data.companies;
    const suggested = all.filter(c => !c.organization && c.suggestion), fresh = all.filter(c => !c.organization && !c.suggestion), linked = all.filter(c => c.organization);
    const orgOptions = '<option value="">ou rattacher à un client existant…</option>' + data.unlinkedOrganizations.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
    dialog.innerHTML = `<form method="dialog"><button type="button" class="admin-dialog-close" data-hs-close aria-label="Fermer">×</button>
      <h2>Importer les clients depuis HubSpot</h2>
      <p class="admin-dialog-intro">${all.length} entreprises au stade « Client » dans HubSpot. Les clients créés ici n’ont <strong>aucun contact</strong> : personne ne reçoit d’e-mail tant que vous n’ajoutez pas d’utilisateur.</p>
      ${message ? `<p class="hs-clients-message">${message}</p>` : ''}
      ${suggested.length ? `<h3>À rattacher (${suggested.length})</h3><p class="hs-clients-hint">Un client du Studio ressemble à ces entreprises : rattachez-le plutôt que de créer un doublon.</p>
        <ul class="hs-clients-list">${suggested.map(c => `<li><div><strong>${esc(c.name)}</strong> ${link(c)}<small>Proposé : ${esc(c.suggestion.name)} (même ${esc(c.suggestion.reason)})</small></div>
          <button type="button" class="button button-secondary" data-hs-link="${esc(c.id)}" data-org="${esc(c.suggestion.id)}">Rattacher</button></li>`).join('')}</ul>` : ''}
      <h3>Nouveaux clients (${fresh.length})</h3>
      ${fresh.length ? `<label class="hs-clients-all"><input type="checkbox" data-hs-all> Tout cocher</label>
        <ul class="hs-clients-list">${fresh.map(c => `<li><label><input type="checkbox" data-hs-pick="${esc(c.id)}"> <span><strong>${esc(c.name)}</strong> ${link(c)}<small>${esc(c.sector)} · ${esc(c.countryCode)}${c.domain ? ' · ' + esc(c.domain) : ''}</small></span></label>
          ${data.unlinkedOrganizations.length ? `<select data-hs-manual="${esc(c.id)}" aria-label="Rattacher ${esc(c.name)} à un client existant">${orgOptions}</select>` : ''}</li>`).join('')}</ul>`
        : '<p class="hs-clients-hint">Toutes les entreprises clientes de HubSpot existent déjà dans le Studio.</p>'}
      <details class="hs-clients-linked"><summary>Déjà rattachés (${linked.length})</summary><ul class="hs-clients-list">${linked.map(c => `<li><div><strong>${esc(c.organization.name)}</strong> ← ${esc(c.name)} ${link(c)}</div>
        <button type="button" class="button button-ghost" data-hs-unlink="${esc(c.organization.id)}">Détacher</button></li>`).join('')}</ul></details>
      <div class="admin-dialog-actions"><button type="button" class="button button-ghost" data-hs-close>Fermer</button>
        <button type="button" class="button button-primary" data-hs-create ${fresh.length ? '' : 'disabled'}>Créer les clients cochés</button></div></form>`;
  }
  async function load(message) {
    dialog.innerHTML = '<form method="dialog"><p class="admin-dialog-intro">Lecture des entreprises clientes dans HubSpot…</p></form>';
    try { data = await StudioAPI.request('/api/admin/hubspot/clients'); render(message); }
    catch (e) { dialog.innerHTML = `<form method="dialog"><button type="button" class="admin-dialog-close" data-hs-close aria-label="Fermer">×</button><h2>Import HubSpot</h2><p class="hs-clients-message is-error">${esc(e.message)}</p></form>`; }
  }
  const linkTo = (organizationId, companyId) => StudioAPI.request('/api/admin/hubspot/clients/link', { method: 'POST', body: JSON.stringify({ organizationId, companyId }) });

  button.onclick = () => { changed = false; dialog.showModal(); load(); };
  dialog.addEventListener('close', () => { if (changed) location.reload(); });
  dialog.addEventListener('change', async ev => {
    const t = ev.target;
    if (t.matches('[data-hs-all]')) dialog.querySelectorAll('[data-hs-pick]').forEach(c => { c.checked = t.checked; });
    if (t.matches('[data-hs-manual]') && t.value) {
      const org = data.unlinkedOrganizations.find(o => o.id === t.value), company = data.companies.find(c => c.id === t.dataset.hsManual);
      if (!await window.StudioModal.confirm({ eyebrow: 'HubSpot', title: 'Rattacher ce client ?', message: `« ${org.name} » sera rattaché à l’entreprise HubSpot « ${company.name} ».`, confirmLabel: 'Rattacher' })) { t.value = ''; return; }
      try { await linkTo(t.value, t.dataset.hsManual); changed = true; load(`${esc(org.name)} est rattaché à ${esc(company.name)}.`); }
      catch (e) { t.value = ''; window.StudioModal.alert({ title: 'Rattachement impossible', message: e.message }); }
    }
  });
  dialog.addEventListener('click', async ev => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-hs-close')) return dialog.close();
    try {
      if (t.dataset.hsLink) { t.disabled = true; await linkTo(t.dataset.org, t.dataset.hsLink); changed = true; return load('Client rattaché.'); }
      if (t.dataset.hsUnlink) { t.disabled = true; await linkTo(t.dataset.hsUnlink, null); changed = true; return load('Client détaché de HubSpot.'); }
      if (t.hasAttribute('data-hs-create')) {
        const ids = [...dialog.querySelectorAll('[data-hs-pick]:checked')].map(c => c.dataset.hsPick);
        if (!ids.length) return window.StudioModal.alert({ title: 'Aucune entreprise cochée', message: 'Cochez au moins une entreprise à créer.' });
        t.disabled = true; t.textContent = 'Création…';
        const r = await StudioAPI.request('/api/admin/hubspot/clients/create', { method: 'POST', body: JSON.stringify({ companyIds: ids }) });
        changed = true;
        load(`${r.created.length} client${r.created.length > 1 ? 's' : ''} créé${r.created.length > 1 ? 's' : ''}, sans contact.` +
          (r.skipped.length ? ` Non créés : ${r.skipped.map(s => esc(s.name) + ' (' + esc(s.reason) + ')').join(', ')}.` : ''));
      }
    } catch (e) { t.disabled = false; window.StudioModal.alert({ title: 'Action impossible', message: e.message }); }
  });
})();
