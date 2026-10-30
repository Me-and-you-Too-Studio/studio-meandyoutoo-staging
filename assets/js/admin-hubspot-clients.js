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
  let data = null, changed = false, focusId = null;
  // Ce qui est coché ou ouvert survit aux rechargements de la liste.
  const picked = new Set(), pickedContacts = new Map(), openBoxes = new Set(), contactsCache = new Map();
  const STATUS = { existing: 'déjà un compte Studio', personal: 'adresse personnelle', no_email: 'sans e-mail', pending: '✓ repris — en attente du go', active: '✓ repris — compte actif', disabled: '✓ repris — compte désactivé' };
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

  const link = c => `<a href="${esc(c.hubspotUrl)}" target="_blank" rel="noopener">Fiche HubSpot ↗</a>`;
  const tool = (kind, c, label) => `<button type="button" class="button button-ghost hs-tool" data-hs-toggle="${kind}" data-company="${esc(c.id)}">${label} ▾</button>`;
  const box = (kind, c, inner = '') => `<div class="hs-box" data-hs-box="${kind}:${esc(c.id)}" ${openBoxes.has(kind + ':' + c.id) ? '' : 'hidden'}>${inner}</div>`;
  const linkBox = c => box('link', c, `<label>Rattacher « ${esc(c.name)} » au client du Studio :</label><div class="hs-inline"><select data-hs-org="${esc(c.id)}"><option value="">Choisir un client…</option>${data.unlinkedOrganizations.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select>
    <button type="button" class="button button-secondary" data-hs-link="${esc(c.id)}">Rattacher</button></div>`);
  const usersSummary = o => [o.pendingUsers ? `${plural(o.pendingUsers, 'contact')} en attente du go` : '', o.activeUsers ? `${plural(o.activeUsers, 'compte')} actif${o.activeUsers > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'Aucun contact repris';

  function render(message) {
    const all = data.companies;
    const suggested = all.filter(c => !c.organization && c.suggestion), fresh = all.filter(c => !c.organization && !c.suggestion), linked = all.filter(c => c.organization);
    const canLink = data.unlinkedOrganizations.length > 0;
    dialog.innerHTML = `<form method="dialog"><button type="button" class="admin-dialog-close" data-hs-close aria-label="Fermer">×</button>
      <h2>Importer les clients depuis HubSpot</h2>
      <p class="admin-dialog-intro">${all.length} entreprises au stade « Client » dans HubSpot. Une entreprise qui existe déjà dans le Studio se <strong>rattache</strong> ; les autres se <strong>créent</strong>.
        Les contacts repris restent <strong>en attente du go</strong> : personne ne reçoit d’e-mail avant la mise en production.</p>
      ${message ? `<p class="hs-clients-message">${message}</p>` : ''}
      ${suggested.length ? `<h3>À rattacher (${suggested.length})</h3><p class="hs-clients-hint">Un client du Studio ressemble à ces entreprises : rattachez-le plutôt que de créer un doublon.</p>
        <ul class="hs-clients-list">${suggested.map(c => `<li><div class="hs-row"><div><strong>${esc(c.name)}</strong> ${link(c)}<small>Proposé : ${esc(c.suggestion.name)} (même ${esc(c.suggestion.reason)})</small></div>
          <div class="hs-tools"><button type="button" class="button button-secondary" data-hs-link="${esc(c.id)}" data-org="${esc(c.suggestion.id)}">Rattacher à ${esc(c.suggestion.name)}</button></div></div></li>`).join('')}</ul>` : ''}
      <h3>Nouveaux clients (${fresh.length})</h3>
      ${fresh.length ? `<label class="hs-clients-all"><input type="checkbox" data-hs-all ${fresh.every(c => picked.has(c.id)) ? 'checked' : ''}> Tout cocher</label>
        <ul class="hs-clients-list">${fresh.map(c => `<li data-hs-row="${esc(c.id)}"><div class="hs-row"><label><input type="checkbox" data-hs-pick="${esc(c.id)}" ${picked.has(c.id) ? 'checked' : ''}> <span><strong>${esc(c.name)}</strong> ${link(c)}<small>${esc(c.sector)} · ${esc(c.countryCode)}${c.domain ? ' · ' + esc(c.domain) : ''}</small></span></label>
          <div class="hs-tools">${tool('contacts', c, 'Contacts')}${canLink ? tool('link', c, 'Rattacher à…') : ''}</div></div>${box('contacts', c)}${canLink ? linkBox(c) : ''}</li>`).join('')}</ul>`
        : '<p class="hs-clients-hint">Toutes les entreprises clientes de HubSpot existent déjà dans le Studio.</p>'}
      <details class="hs-clients-linked" ${focusId || openBoxes.has('linked') ? 'open' : ''}><summary>Déjà rattachés (${linked.length})</summary><ul class="hs-clients-list">${linked.map(c => `<li data-hs-row="${esc(c.id)}" class="${focusId === c.id ? 'is-focus' : ''}"><div class="hs-row"><div><strong>${esc(c.organization.name)}</strong> ← ${esc(c.name)} ${link(c)}<small>${esc(usersSummary(c.organization))}</small></div>
        <div class="hs-tools">${tool('contacts', c, 'Contacts')}<button type="button" class="button button-ghost hs-tool" data-hs-unlink="${esc(c.organization.id)}">Détacher</button></div></div>${box('contacts', c)}</li>`).join('')}</ul></details>
      <div class="admin-dialog-actions"><button type="button" class="button button-ghost" data-hs-close>Fermer</button>
        <button type="button" class="button button-primary" data-hs-create ${fresh.length ? '' : 'disabled'}>${createLabel(fresh)}</button></div></form>`;
    dialog.querySelectorAll('[data-hs-box^="contacts:"]:not([hidden])').forEach(b => fillContacts(b));
    if (focusId) { dialog.querySelector(`[data-hs-row="${focusId}"]`)?.scrollIntoView({ block: 'center' }); focusId = null; }
  }
  function createLabel(fresh) {
    const n = fresh.filter(c => picked.has(c.id)).length;
    return `Créer les clients cochés${n ? ` (${n})` : ''}`;
  }
  async function load(message) {
    const scroll = dialog.querySelector('form')?.scrollTop || 0, keepScroll = !focusId;
    if (!data) dialog.innerHTML = '<form method="dialog"><p class="admin-dialog-intro">Lecture des entreprises clientes dans HubSpot…</p></form>';
    try { data = await StudioAPI.request('/api/admin/hubspot/clients'); render(message); if (keepScroll) dialog.querySelector('form').scrollTop = scroll; }
    catch (e) { dialog.innerHTML = `<form method="dialog"><button type="button" class="admin-dialog-close" data-hs-close aria-label="Fermer">×</button><h2>Import HubSpot</h2><p class="hs-clients-message is-error">${esc(e.message)}</p></form>`; }
  }
  async function fillContacts(target) {
    const companyId = target.dataset.hsBox.split(':')[1];
    const linkedOrg = data.companies.find(c => c.id === companyId)?.organization;
    target.innerHTML = '<p class="hs-clients-hint">Lecture des contacts…</p>';
    try {
      if (!contactsCache.has(companyId)) contactsCache.set(companyId, (await StudioAPI.request(`/api/admin/hubspot/clients/${encodeURIComponent(companyId)}/contacts`)).contacts);
      const contacts = contactsCache.get(companyId), chosen = pickedContacts.get(companyId) || new Set();
      const selectable = contacts.filter(p => p.status === 'ok');
      target.innerHTML = contacts.length ? `<ul class="hs-contacts-list">${contacts.map(p => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Sans nom', ok = p.status === 'ok', done = ['pending', 'active', 'disabled'].includes(p.status);
        return `<li><label class="${ok ? '' : done ? 'is-done' : 'is-off'}"><input type="checkbox" data-hs-contact="${esc(p.id)}" data-company="${esc(companyId)}" ${ok ? '' : 'disabled'} ${(ok && chosen.has(p.id)) || done ? 'checked' : ''}>
          <span>${esc(name)}${p.jobTitle ? ' · ' + esc(p.jobTitle) : ''}<small>${esc(p.email || '')}${ok ? '' : ' — ' + esc(STATUS[p.status]) + (p.status === 'existing' && p.existingOrganization ? ' (' + esc(p.existingOrganization) + ')' : '')}</small></span></label></li>`;
      }).join('')}</ul>${linkedOrg && selectable.length ? `<button type="button" class="button button-secondary" data-hs-add="${esc(companyId)}">Reprendre les contacts cochés</button>` : ''}`
        : '<p class="hs-clients-hint">Aucun contact associé à cette entreprise dans HubSpot.</p>';
    } catch (e) { target.innerHTML = `<p class="hs-clients-message is-error">${esc(e.message)}</p>`; }
  }
  const addContacts = (companyId, contactIds) => StudioAPI.request(`/api/admin/hubspot/clients/${encodeURIComponent(companyId)}/contacts`, { method: 'POST', body: JSON.stringify({ contactIds }) });
  const linkTo = (organizationId, companyId) => StudioAPI.request('/api/admin/hubspot/clients/link', { method: 'POST', body: JSON.stringify({ organizationId, companyId }) });
  const refreshCreateLabel = () => { const b = dialog.querySelector('[data-hs-create]'); if (b && data) b.textContent = createLabel(data.companies.filter(c => !c.organization && !c.suggestion)); };

  button.onclick = () => { changed = false; data = null; [picked, pickedContacts, openBoxes, contactsCache].forEach(s => s.clear()); dialog.showModal(); load(); };
  dialog.addEventListener('close', () => { if (changed) location.reload(); });
  dialog.addEventListener('toggle', ev => { if (ev.target.matches?.('.hs-clients-linked')) ev.target.open ? openBoxes.add('linked') : openBoxes.delete('linked'); }, true);
  dialog.addEventListener('change', ev => {
    const t = ev.target;
    if (t.matches('[data-hs-all]')) dialog.querySelectorAll('[data-hs-pick]').forEach(c => { c.checked = t.checked; t.checked ? picked.add(c.dataset.hsPick) : picked.delete(c.dataset.hsPick); });
    if (t.matches('[data-hs-pick]')) t.checked ? picked.add(t.dataset.hsPick) : picked.delete(t.dataset.hsPick);
    if (t.matches('[data-hs-contact]')) {
      const set = pickedContacts.get(t.dataset.company) || new Set(); pickedContacts.set(t.dataset.company, set);
      t.checked ? set.add(t.dataset.hsContact) : set.delete(t.dataset.hsContact);
      const pick = dialog.querySelector(`[data-hs-pick="${t.dataset.company}"]`);
      if (pick && t.checked) { pick.checked = true; picked.add(t.dataset.company); }
    }
    refreshCreateLabel();
  });
  dialog.addEventListener('click', async ev => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-hs-close')) return dialog.close();
    if (t.dataset.hsToggle) {
      const key = `${t.dataset.hsToggle}:${t.dataset.company}`, target = dialog.querySelector(`[data-hs-box="${key}"]`);
      target.hidden = !target.hidden; target.hidden ? openBoxes.delete(key) : openBoxes.add(key);
      if (!target.hidden && t.dataset.hsToggle === 'contacts') fillContacts(target);
      return;
    }
    try {
      if (t.dataset.hsLink) {
        const companyId = t.dataset.hsLink, orgId = t.dataset.org || dialog.querySelector(`[data-hs-org="${companyId}"]`)?.value;
        if (!orgId) return window.StudioModal.alert({ title: 'Aucun client choisi', message: 'Choisissez le client du Studio à rattacher.' });
        const orgName = data.unlinkedOrganizations.find(o => o.id === orgId)?.name || '';
        t.disabled = true; await linkTo(orgId, companyId); changed = true;
        picked.delete(companyId); openBoxes.delete('link:' + companyId); focusId = companyId;
        return load(`${esc(orgName)} est rattaché à HubSpot. Il est maintenant dans « Déjà rattachés » ci-dessous : ouvrez « Contacts » pour reprendre ses contacts.`);
      }
      if (t.dataset.hsUnlink) { t.disabled = true; await linkTo(t.dataset.hsUnlink, null); changed = true; return load('Client détaché de HubSpot.'); }
      if (t.dataset.hsAdd) {
        const companyId = t.dataset.hsAdd, ids = [...(pickedContacts.get(companyId) || [])];
        if (!ids.length) return window.StudioModal.alert({ title: 'Aucun contact coché', message: 'Cochez au moins un contact à reprendre.' });
        t.disabled = true;
        const r = await addContacts(companyId, ids);
        changed = true; contactsCache.delete(companyId); pickedContacts.delete(companyId); focusId = companyId;
        return load(`${plural(r.added.length, 'contact')} repris pour ${esc(r.organization.name)}, en attente du go.` + (r.skipped.length ? ` Non repris : ${r.skipped.map(s => esc(s.email) + ' (' + esc(s.reason) + ')').join(', ')}.` : ''));
      }
      if (t.hasAttribute('data-hs-create')) {
        const ids = [...dialog.querySelectorAll('[data-hs-pick]:checked')].map(c => c.dataset.hsPick);
        if (!ids.length) return window.StudioModal.alert({ title: 'Aucune entreprise cochée', message: 'Cochez les nouveaux clients à créer. Une entreprise rattachée à un client existant n’a pas besoin d’être créée : elle est dans « Déjà rattachés ».' });
        t.disabled = true; t.textContent = 'Création…';
        const r = await StudioAPI.request('/api/admin/hubspot/clients/create', { method: 'POST', body: JSON.stringify({ companyIds: ids }) });
        changed = true;
        let added = 0; const failed = [];
        for (const org of r.created) {
          const companyId = String(org.hubspot_company_id), contactIds = [...(pickedContacts.get(companyId) || [])];
          picked.delete(companyId);
          if (!contactIds.length) continue;
          try { added += (await addContacts(companyId, contactIds)).added.length; pickedContacts.delete(companyId); contactsCache.delete(companyId); } catch (e) { failed.push(org.name); }
        }
        openBoxes.add('linked');
        load(`${plural(r.created.length, 'client')} créé${r.created.length > 1 ? 's' : ''}, ${plural(added, 'contact')} en attente du go. Ils sont dans « Déjà rattachés ».` +
          (r.skipped.length ? ` Non créés : ${r.skipped.map(s => esc(s.name) + ' (' + esc(s.reason) + ')').join(', ')}.` : '') +
          (failed.length ? ` Contacts non repris pour : ${failed.map(esc).join(', ')} (réessayez depuis « Déjà rattachés »).` : ''));
      }
    } catch (e) { t.disabled = false; window.StudioModal.alert({ title: 'Action impossible', message: e.message }); }
  });
})();
