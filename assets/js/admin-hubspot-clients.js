// Admin › Clients : importer les entreprises « Client » de HubSpot.
// Rattache les clients du Studio à leur entreprise HubSpot, crée les autres, et reprend les contacts cochés.
// Les contacts repris restent en attente : aucun e-mail n'est envoyé avant le go de mise en production.
(function () {
  if (!StudioAPI.requireAuth('admin')) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const anchor = document.getElementById('new-org-clients');
  if (!anchor) return;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'button button-secondary'; button.textContent = 'Importer depuis HubSpot';
  const actions = document.createElement('div'); actions.className = 'hs-clients-actions';
  anchor.parentNode.insertBefore(actions, anchor); actions.append(button, anchor);

  const dialog = document.createElement('dialog');
  dialog.className = 'admin-dialog admin-dialog-wide hs-clients-dialog';
  document.body.appendChild(dialog);
  let data = null, changed = false;
  const contactsCache = new Map();
  const REASONS = { existing: 'déjà un compte Studio', personal: 'adresse personnelle', no_email: 'sans e-mail' };

  const link = c => `<a href="${esc(c.hubspotUrl)}" target="_blank" rel="noopener">Fiche HubSpot ↗</a>`;
  const contactsToggle = c => `<button type="button" class="button button-ghost hs-contacts-toggle" data-hs-contacts="${esc(c.id)}">Contacts ▾</button>`;
  const contactsBox = (c, withAdd) => `<div class="hs-contacts" data-hs-box="${esc(c.id)}" hidden>${withAdd ? `<button type="button" class="button button-secondary" data-hs-add="${esc(c.id)}">Ajouter les contacts cochés</button>` : ''}</div>`;
  function render(message) {
    const all = data.companies;
    const suggested = all.filter(c => !c.organization && c.suggestion), fresh = all.filter(c => !c.organization && !c.suggestion), linked = all.filter(c => c.organization);
    const orgOptions = '<option value="">ou rattacher à un client existant…</option>' + data.unlinkedOrganizations.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
    dialog.innerHTML = `<form method="dialog"><button type="button" class="admin-dialog-close" data-hs-close aria-label="Fermer">×</button>
      <h2>Importer les clients depuis HubSpot</h2>
      <p class="admin-dialog-intro">${all.length} entreprises au stade « Client » dans HubSpot. Cochez les contacts à reprendre avec chaque entreprise :
        leurs comptes restent <strong>en attente du go</strong>, personne ne reçoit d’e-mail avant la mise en production.</p>
      ${message ? `<p class="hs-clients-message">${message}</p>` : ''}
      ${suggested.length ? `<h3>À rattacher (${suggested.length})</h3><p class="hs-clients-hint">Un client du Studio ressemble à ces entreprises : rattachez-le plutôt que de créer un doublon.</p>
        <ul class="hs-clients-list">${suggested.map(c => `<li><div class="hs-row"><div><strong>${esc(c.name)}</strong> ${link(c)}<small>Proposé : ${esc(c.suggestion.name)} (même ${esc(c.suggestion.reason)})</small></div>
          <button type="button" class="button button-secondary" data-hs-link="${esc(c.id)}" data-org="${esc(c.suggestion.id)}">Rattacher</button></div></li>`).join('')}</ul>` : ''}
      <h3>Nouveaux clients (${fresh.length})</h3>
      ${fresh.length ? `<label class="hs-clients-all"><input type="checkbox" data-hs-all> Tout cocher</label>
        <ul class="hs-clients-list">${fresh.map(c => `<li><div class="hs-row"><label><input type="checkbox" data-hs-pick="${esc(c.id)}"> <span><strong>${esc(c.name)}</strong> ${link(c)}<small>${esc(c.sector)} · ${esc(c.countryCode)}${c.domain ? ' · ' + esc(c.domain) : ''}</small></span></label>
          ${contactsToggle(c)}${data.unlinkedOrganizations.length ? `<select data-hs-manual="${esc(c.id)}" aria-label="Rattacher ${esc(c.name)} à un client existant">${orgOptions}</select>` : ''}</div>${contactsBox(c, false)}</li>`).join('')}</ul>`
        : '<p class="hs-clients-hint">Toutes les entreprises clientes de HubSpot existent déjà dans le Studio.</p>'}
      <details class="hs-clients-linked" ${message && linked.length ? 'open' : ''}><summary>Déjà rattachés (${linked.length})</summary><ul class="hs-clients-list">${linked.map(c => `<li><div class="hs-row"><div><strong>${esc(c.organization.name)}</strong> ← ${esc(c.name)} ${link(c)}</div>
        ${contactsToggle(c)}<button type="button" class="button button-ghost" data-hs-unlink="${esc(c.organization.id)}">Détacher</button></div>${contactsBox(c, true)}</li>`).join('')}</ul></details>
      <div class="admin-dialog-actions"><button type="button" class="button button-ghost" data-hs-close>Fermer</button>
        <button type="button" class="button button-primary" data-hs-create ${fresh.length ? '' : 'disabled'}>Créer les clients cochés</button></div></form>`;
  }
  async function load(message) {
    dialog.innerHTML = '<form method="dialog"><p class="admin-dialog-intro">Lecture des entreprises clientes dans HubSpot…</p></form>';
    try { data = await StudioAPI.request('/api/admin/hubspot/clients'); render(message); }
    catch (e) { dialog.innerHTML = `<form method="dialog"><button type="button" class="admin-dialog-close" data-hs-close aria-label="Fermer">×</button><h2>Import HubSpot</h2><p class="hs-clients-message is-error">${esc(e.message)}</p></form>`; }
  }
  async function showContacts(companyId) {
    const box = dialog.querySelector(`[data-hs-box="${companyId}"]`);
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    const addButton = box.querySelector('[data-hs-add]');
    if (box.querySelector('.hs-contacts-list')) return;
    box.insertAdjacentHTML('afterbegin', '<p class="hs-clients-hint">Lecture des contacts…</p>');
    try {
      if (!contactsCache.has(companyId)) contactsCache.set(companyId, (await StudioAPI.request(`/api/admin/hubspot/clients/${encodeURIComponent(companyId)}/contacts`)).contacts);
      const contacts = contactsCache.get(companyId);
      box.firstElementChild.remove();
      box.insertAdjacentHTML('afterbegin', contacts.length ? `<ul class="hs-contacts-list">${contacts.map(p => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Sans nom';
        return `<li><label class="${p.status === 'ok' ? '' : 'is-off'}"><input type="checkbox" data-hs-contact="${esc(p.id)}" ${p.status === 'ok' ? '' : 'disabled'}>
          <span>${esc(name)}${p.jobTitle ? ' · ' + esc(p.jobTitle) : ''}<small>${esc(p.email || '')}${p.status === 'ok' ? '' : ' — ' + esc(REASONS[p.status]) + (p.existingOrganization ? ' (' + esc(p.existingOrganization) + ')' : '')}</small></span></label></li>`;
      }).join('')}</ul>` : '<p class="hs-clients-hint">Aucun contact associé à cette entreprise dans HubSpot.</p>');
      if (addButton && !contacts.some(p => p.status === 'ok')) addButton.hidden = true;
    } catch (e) { box.firstElementChild.textContent = e.message; }
  }
  const pickedContacts = companyId => [...dialog.querySelectorAll(`[data-hs-box="${companyId}"] [data-hs-contact]:checked`)].map(c => c.dataset.hsContact);
  const addContacts = (companyId, contactIds) => StudioAPI.request(`/api/admin/hubspot/clients/${encodeURIComponent(companyId)}/contacts`, { method: 'POST', body: JSON.stringify({ contactIds }) });
  const linkTo = (organizationId, companyId) => StudioAPI.request('/api/admin/hubspot/clients/link', { method: 'POST', body: JSON.stringify({ organizationId, companyId }) });
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

  button.onclick = () => { changed = false; contactsCache.clear(); dialog.showModal(); load(); };
  dialog.addEventListener('close', () => { if (changed) location.reload(); });
  dialog.addEventListener('change', async ev => {
    const t = ev.target;
    if (t.matches('[data-hs-all]')) dialog.querySelectorAll('[data-hs-pick]').forEach(c => { c.checked = t.checked; });
    if (t.matches('[data-hs-contact]') && t.checked) { const pick = dialog.querySelector(`[data-hs-pick="${t.closest('[data-hs-box]').dataset.hsBox}"]`); if (pick) pick.checked = true; }
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
    if (t.dataset.hsContacts) return showContacts(t.dataset.hsContacts);
    try {
      if (t.dataset.hsLink) { t.disabled = true; await linkTo(t.dataset.org, t.dataset.hsLink); changed = true; return load('Client rattaché : ouvrez « Déjà rattachés » pour reprendre ses contacts.'); }
      if (t.dataset.hsUnlink) { t.disabled = true; await linkTo(t.dataset.hsUnlink, null); changed = true; return load('Client détaché de HubSpot.'); }
      if (t.dataset.hsAdd) {
        const ids = pickedContacts(t.dataset.hsAdd);
        if (!ids.length) return window.StudioModal.alert({ title: 'Aucun contact coché', message: 'Cochez au moins un contact à reprendre.' });
        t.disabled = true;
        const r = await addContacts(t.dataset.hsAdd, ids);
        changed = true; contactsCache.delete(t.dataset.hsAdd);
        return load(`${plural(r.added.length, 'contact')} en attente du go pour ${esc(r.organization.name)}.` + (r.skipped.length ? ` Non repris : ${r.skipped.map(s => esc(s.email) + ' (' + esc(s.reason) + ')').join(', ')}.` : ''));
      }
      if (t.hasAttribute('data-hs-create')) {
        const ids = [...dialog.querySelectorAll('[data-hs-pick]:checked')].map(c => c.dataset.hsPick);
        if (!ids.length) return window.StudioModal.alert({ title: 'Aucune entreprise cochée', message: 'Cochez au moins une entreprise à créer.' });
        const contactsByCompany = new Map(ids.map(id => [id, pickedContacts(id)]));
        t.disabled = true; t.textContent = 'Création…';
        const r = await StudioAPI.request('/api/admin/hubspot/clients/create', { method: 'POST', body: JSON.stringify({ companyIds: ids }) });
        changed = true;
        let added = 0; const failed = [];
        for (const org of r.created) {
          const contactIds = contactsByCompany.get(String(org.hubspot_company_id)) || [];
          if (!contactIds.length) continue;
          try { added += (await addContacts(org.hubspot_company_id, contactIds)).added.length; } catch (e) { failed.push(org.name); }
        }
        load(`${plural(r.created.length, 'client')} créé${r.created.length > 1 ? 's' : ''}, ${plural(added, 'contact')} en attente du go.` +
          (r.skipped.length ? ` Non créés : ${r.skipped.map(s => esc(s.name) + ' (' + esc(s.reason) + ')').join(', ')}.` : '') +
          (failed.length ? ` Contacts non repris pour : ${failed.map(esc).join(', ')} (réessayez depuis « Déjà rattachés »).` : ''));
      }
    } catch (e) { t.disabled = false; window.StudioModal.alert({ title: 'Action impossible', message: e.message }); }
  });
})();
