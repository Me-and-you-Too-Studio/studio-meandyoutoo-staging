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
      <div class="hs-managers">${tool('managers', { id: 'all' }, 'Chargées de compte depuis HubSpot')}${box('managers', { id: 'all' })}</div>
      ${(data.orphanOrganizations || []).length ? `<h3>Rattachement à revoir (${data.orphanOrganizations.length})</h3><p class="hs-clients-hint">Ces clients du Studio sont rattachés à une entreprise HubSpot qui n’est plus au stade « Client » ou qui a été supprimée. Détachez-les : ils deviennent alors disponibles dans « Rattacher à… ».</p>
        <ul class="hs-clients-list">${data.orphanOrganizations.map(o => `<li><div class="hs-row"><div><strong>${esc(o.name)}</strong> <a href="${esc(o.hubspotUrl)}" target="_blank" rel="noopener">Ancienne fiche HubSpot ↗</a></div>
          <div class="hs-tools"><button type="button" class="button button-secondary" data-hs-unlink="${esc(o.id)}">Détacher</button></div></div></li>`).join('')}</ul>` : ''}
      ${suggested.length ? `<h3>À rattacher (${suggested.length})</h3><p class="hs-clients-hint">Un client du Studio ressemble à ces entreprises : rattachez-le plutôt que de créer un doublon.</p>
        <ul class="hs-clients-list">${suggested.map(c => `<li><div class="hs-row"><div><strong>${esc(c.name)}</strong> ${link(c)}<small>Proposé : ${esc(c.suggestion.name)} (même ${esc(c.suggestion.reason)})</small></div>
          <div class="hs-tools"><button type="button" class="button button-secondary" data-hs-link="${esc(c.id)}" data-org="${esc(c.suggestion.id)}">Rattacher à ${esc(c.suggestion.name)}</button><button type="button" class="button button-ghost hs-tool" data-hs-create-one="${esc(c.id)}" data-allow-similar="1" title="Créer une fiche distincte dans le Studio (ex. une filiale)">Créer quand même</button></div></div></li>`).join('')}</ul>` : ''}
      <h3>Nouveaux clients (${fresh.length})</h3>
      ${fresh.length ? `<label class="hs-clients-all"><input type="checkbox" data-hs-all ${fresh.every(c => picked.has(c.id)) ? 'checked' : ''}> Tout cocher</label>
        <ul class="hs-clients-list">${fresh.map(c => `<li data-hs-row="${esc(c.id)}"><div class="hs-row"><label><input type="checkbox" data-hs-pick="${esc(c.id)}" ${picked.has(c.id) ? 'checked' : ''}> <span><strong>${esc(c.name)}</strong> ${link(c)}<small>${esc(c.sector)} · ${esc(c.countryCode)}${c.domain ? ' · ' + esc(c.domain) : ''}</small></span></label>
          <div class="hs-tools">${tool('contacts', c, 'Contacts')}${canLink ? tool('link', c, 'Rattacher à…') : ''}<button type="button" class="button button-secondary hs-tool" data-hs-create-one="${esc(c.id)}" title="Créer la fiche de ce client dans le Studio, avec les contacts cochés">Créer dans le Studio</button></div></div>${box('contacts', c)}${canLink ? linkBox(c) : ''}</li>`).join('')}</ul>`
        : '<p class="hs-clients-hint">Toutes les entreprises clientes de HubSpot existent déjà dans le Studio.</p>'}
      <details class="hs-clients-linked" ${focusId || openBoxes.has('linked') ? 'open' : ''}><summary>Déjà rattachés (${linked.length})</summary><ul class="hs-clients-list">${linked.map(c => `<li data-hs-row="${esc(c.id)}" class="${focusId === c.id ? 'is-focus' : ''}"><div class="hs-row"><div><strong>${esc(c.organization.name)}</strong> ← ${esc(c.name)} ${link(c)}<small>${esc(usersSummary(c.organization))}${c.organization.mergedFrom ? ' · rattachement mis à jour après fusion dans HubSpot' : ''}</small></div>
        <div class="hs-tools">${tool('contacts', c, 'Contacts')}${tool('prestations', c, 'Prestations')}<button type="button" class="button button-ghost hs-tool" data-hs-unlink="${esc(c.organization.id)}">Détacher</button></div></div>${box('contacts', c)}${box('prestations', c)}</li>`).join('')}</ul></details>
      <div class="admin-dialog-actions"><button type="button" class="button button-ghost" data-hs-close>Fermer</button>
        <button type="button" class="button button-primary" data-hs-create ${fresh.length ? '' : 'disabled'}>${createLabel(fresh)}</button></div></form>`;
    dialog.querySelectorAll('[data-hs-box^="contacts:"]:not([hidden])').forEach(b => fillContacts(b));
    dialog.querySelectorAll('[data-hs-box^="prestations:"]:not([hidden])').forEach(b => fillPrestations(b));
    dialog.querySelectorAll('[data-hs-box="managers:all"]:not([hidden])').forEach(b => fillManagers(b));
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
  // Prestations HubSpot (transactions gagnées) proposées comme actions du Cockpit D&I, à valider avant import.
  const pickedPrestations = new Map(), prestationsCache = new Map();
  const day = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  async function fillPrestations(target) {
    const companyId = target.dataset.hsBox.split(':')[1];
    target.innerHTML = '<p class="hs-clients-hint">Lecture des transactions gagnées…</p>';
    try {
      if (!prestationsCache.has(companyId)) prestationsCache.set(companyId, await StudioAPI.request(`/api/admin/hubspot/clients/${encodeURIComponent(companyId)}/prestations`));
      const r = prestationsCache.get(companyId), chosen = pickedPrestations.get(companyId) || new Set();
      const open = r.proposals.filter(p => !p.imported), years = [...new Set(r.proposals.map(p => p.actionDate.slice(0, 4)))];
      const dealLink = d => `<a href="${esc(d.hubspotUrl)}" target="_blank" rel="noopener">${esc(d.dealName)} ↗</a>`;
      target.innerHTML = (r.proposals.length ? `<p class="hs-clients-hint">${plural(r.proposals.length, 'prestation')} trouvée${r.proposals.length > 1 ? 's' : ''} dans HubSpot, dont ${open.length} pas encore dans le Cockpit. Chaque date d’intervention devient une action « animée par Me&amp;YouToo ».</p>
        ${open.length ? `<label class="hs-clients-all"><input type="checkbox" data-hs-presta-all="${esc(companyId)}" ${open.every(p => chosen.has(p.key)) ? 'checked' : ''}> Tout cocher</label>` : ''}
        ${years.map(y => `<p class="hs-presta-year">${esc(y)}</p><ul class="hs-contacts-list">${r.proposals.filter(p => p.actionDate.startsWith(y)).map(p => `<li><label class="${p.imported ? 'is-done' : ''}">
          <input type="checkbox" data-hs-presta="${esc(p.key)}" data-company="${esc(companyId)}" ${p.imported ? 'checked disabled' : chosen.has(p.key) ? 'checked' : ''}>
          <span><strong>${esc(day(p.actionDate))}</strong> · ${esc(p.kindLabel)} · ${esc(p.title)}<small>${p.theme ? esc(p.theme) : '<em>thème à compléter</em>'} · ${p.status === 'done' ? 'réalisée' : 'prévue'}${p.imported ? ' — ✓ déjà dans le Cockpit' : ''}</small></span></label></li>`).join('')}</ul>`).join('')}
        ${open.length ? `<button type="button" class="button button-primary" data-hs-import="${esc(companyId)}">Ajouter au Cockpit${chosen.size ? ` (${chosen.size})` : ''}</button>` : ''}`
        : '<p class="hs-clients-hint">Aucune prestation datée à importer pour ce client.</p>') +
        (r.toComplete.length ? `<div class="hs-presta-warn"><strong>À compléter dans HubSpot (${r.toComplete.length})</strong> : transactions gagnées sans date de livraison/intervention.<ul>${r.toComplete.map(d => `<li>${dealLink(d)}</li>`).join('')}</ul></div>` : '') +
        (r.ignored.length ? `<details class="hs-presta-ignored"><summary>Non importées (${r.ignored.length})</summary><ul>${r.ignored.map(d => `<li>${dealLink(d)} — ${esc(d.categories.join(', ') || d.reason)}</li>`).join('')}</ul></details>` : '');
    } catch (e) { target.innerHTML = `<p class="hs-clients-message is-error">${esc(e.message)}</p>`; }
  }
  // Chargées de compte : propriétaire de la dernière transaction de chaque client rattaché, à appliquer aux clients qui n'en ont pas.
  async function fillManagers(target) {
    target.innerHTML = '<p class="hs-clients-hint">Lecture des propriétaires des transactions…</p>';
    try {
      const rows = (await StudioAPI.request('/api/admin/hubspot/account-managers')).rows, of = s => rows.filter(r => r.status === s);
      const assign = of('assign'), manual = of('manual'), noAdmin = of('no_admin'), noDeal = of('no_deal'), already = of('already');
      const list = (items, line) => `<ul class="hs-managers-list">${items.map(line).join('')}</ul>`;
      target.innerHTML = `<p class="hs-clients-hint">Pour chaque client rattaché sans chargée de compte, le Studio reprend la propriétaire de sa transaction HubSpot la plus récente. Les choix déjà faits ne sont pas modifiés.</p>
        ${assign.length ? `<p><strong>À attribuer (${assign.length})</strong></p>${list(assign, r => `<li>${esc(r.organizationName)} → <strong>${esc(r.adminName)}</strong></li>`)}
          <button type="button" class="button button-primary" data-hs-managers-apply>Attribuer ces ${plural(assign.length, 'chargée')} de compte</button>` : '<p class="hs-clients-hint">Aucun client à attribuer automatiquement.</p>'}
        ${manual.length ? `<details><summary>À faire à la main — ${esc(manual[0].ownerName)} (${manual.length})</summary>${list(manual, r => `<li>${esc(r.organizationName)}</li>`)}</details>` : ''}
        ${noAdmin.length ? `<details><summary>Propriétaire sans compte administratrice dans le Studio (${noAdmin.length})</summary>${list(noAdmin, r => `<li>${esc(r.organizationName)} — ${esc(r.ownerName)}</li>`)}</details>` : ''}
        ${noDeal.length ? `<details><summary>Sans transaction dans HubSpot (${noDeal.length})</summary>${list(noDeal, r => `<li>${esc(r.organizationName)}</li>`)}</details>` : ''}
        ${already.length ? `<p class="hs-clients-hint">${plural(already.length, 'client')} rattaché${already.length > 1 ? 's ont' : ' a'} déjà sa chargée de compte.</p>` : ''}`;
    } catch (e) { target.innerHTML = `<p class="hs-clients-message is-error">${esc(e.message)}</p>`; }
  }
  const refreshImportLabel = companyId => { const b = dialog.querySelector(`[data-hs-import="${companyId}"]`), n = (pickedPrestations.get(companyId) || new Set()).size; if (b) b.textContent = `Ajouter au Cockpit${n ? ` (${n})` : ''}`; };
  const addContacts = (companyId, contactIds) => StudioAPI.request(`/api/admin/hubspot/clients/${encodeURIComponent(companyId)}/contacts`, { method: 'POST', body: JSON.stringify({ contactIds }) });
  const linkTo = (organizationId, companyId) => StudioAPI.request('/api/admin/hubspot/clients/link', { method: 'POST', body: JSON.stringify({ organizationId, companyId }) });
  const refreshCreateLabel = () => { const b = dialog.querySelector('[data-hs-create]'); if (b && data) b.textContent = createLabel(data.companies.filter(c => !c.organization && !c.suggestion)); };

  button.onclick = () => { changed = false; data = null; [picked, pickedContacts, openBoxes, contactsCache, pickedPrestations, prestationsCache].forEach(s => s.clear()); dialog.showModal(); load(); };
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
    if (t.matches('[data-hs-presta], [data-hs-presta-all]')) {
      const companyId = t.dataset.company || t.dataset.hsPrestaAll, set = pickedPrestations.get(companyId) || new Set(); pickedPrestations.set(companyId, set);
      const boxes = t.matches('[data-hs-presta-all]') ? [...dialog.querySelectorAll(`[data-hs-presta][data-company="${companyId}"]:not(:disabled)`)] : [t];
      for (const c of boxes) { if (t.matches('[data-hs-presta-all]')) c.checked = t.checked; c.checked ? set.add(c.dataset.hsPresta) : set.delete(c.dataset.hsPresta); }
      refreshImportLabel(companyId);
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
      if (!target.hidden && t.dataset.hsToggle === 'prestations') fillPrestations(target);
      if (!target.hidden && t.dataset.hsToggle === 'managers') fillManagers(target);
      return;
    }
    try {
      if (t.hasAttribute('data-hs-managers-apply')) {
        t.disabled = true; t.textContent = 'Attribution…';
        const r = await StudioAPI.request('/api/admin/hubspot/account-managers', { method: 'POST' });
        changed = true;
        return load(`${plural(r.assigned, 'client')} ${r.assigned > 1 ? 'reçoivent leur' : 'reçoit sa'} chargée de compte depuis HubSpot.`);
      }
      if (t.dataset.hsImport) {
        const companyId = t.dataset.hsImport, keys = [...(pickedPrestations.get(companyId) || [])];
        if (!keys.length) return window.StudioModal.alert({ title: 'Aucune prestation cochée', message: 'Cochez les prestations à ajouter au Cockpit du client.' });
        t.disabled = true; t.textContent = 'Ajout…';
        const r = await StudioAPI.request(`/api/admin/hubspot/clients/${encodeURIComponent(companyId)}/prestations`, { method: 'POST', body: JSON.stringify({ keys }) });
        changed = true; prestationsCache.delete(companyId); pickedPrestations.delete(companyId); focusId = companyId;
        return load(`${plural(r.added, 'prestation')} ajoutée${r.added > 1 ? 's' : ''} au Cockpit de ${esc(r.organization.name)}.`);
      }
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
      // « Créer les clients cochés » en bas, ou « Créer dans le Studio » sur une seule entreprise.
      if (t.hasAttribute('data-hs-create') || t.dataset.hsCreateOne) {
        const ids = t.dataset.hsCreateOne ? [t.dataset.hsCreateOne] : [...dialog.querySelectorAll('[data-hs-pick]:checked')].map(c => c.dataset.hsPick);
        if (!ids.length) return window.StudioModal.alert({ title: 'Aucune entreprise cochée', message: 'Cochez les nouveaux clients à créer. Une entreprise rattachée à un client existant n’a pas besoin d’être créée : elle est dans « Déjà rattachés ».' });
        t.disabled = true; t.textContent = 'Création…';
        const r = await StudioAPI.request('/api/admin/hubspot/clients/create', { method: 'POST', body: JSON.stringify({ companyIds: ids, allowSimilar: t.dataset.allowSimilar === '1' }) });
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
