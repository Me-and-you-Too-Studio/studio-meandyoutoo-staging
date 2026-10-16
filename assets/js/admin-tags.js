(function () {
  if (!StudioAPI.requireAuth('admin')) return;
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr');
  let tags = [], busy = false, pendingSaves = 0;
  let saveQueue = Promise.resolve();
  let coverageSituations = [], coverageLoaded = false, coveragePage = 0;
  const coveragePageSize = 30;
  const dialog = $('#tag-edit-dialog');
  function error(message) { $('#tag-manager-status').textContent = message; }
  function render() {
    const search = norm($('#tag-manager-search').value), theme = $('#tag-manager-theme').value;
    const variants = new Map();
    tags.forEach(t => variants.set(norm(t.tag), (variants.get(norm(t.tag)) || 0) + 1));
    const rows = tags.filter(t => norm(t.tag).includes(search) && (!theme || t.themes.some(x => x.id === theme)) &&
      (!$('#tag-manager-duplicates').checked || variants.get(norm(t.tag)) > 1));
    $('#tag-manager-count').textContent = `${rows.length} tag(s) affiché(s) sur ${tags.length}`;
    $('#tag-manager-rows').innerHTML = rows.length ? rows.map(t => {
      const index = tags.indexOf(t);
      return `<tr><td><input class="tag-name-input" data-tag-name="${index}" value="${esc(t.tag)}" maxlength="60" aria-label="Modifier le tag ${esc(t.tag)}"><small class="tag-save-state" data-tag-save-state="${index}" role="status"></small>${variants.get(norm(t.tag)) > 1 ? '<small class="tag-variant">Variante à vérifier</small>' : ''}</td><td><button type="button" class="tag-usage-button" data-tag-usage="${index}" aria-label="Voir les ${t.count} situations du tag ${esc(t.tag)}">${t.count}<span aria-hidden="true"> ↗</span></button></td><td>${t.themes.map(x => esc(x.title)).join(' · ')}</td><td><div class="tag-row-actions"><button type="button" class="button button-secondary button-small" data-tag-action="merge" data-tag-index="${index}">Fusionner</button><button type="button" class="button button-danger-soft button-small" data-tag-action="delete" data-tag-index="${index}">Supprimer</button></div></td></tr>`;
    }).join('') : '<tr><td colspan="4">Aucun tag ne correspond à votre recherche.</td></tr>';
  }
  async function load() {
    if (busy || pendingSaves) return;
    error('Chargement des tags…');
    try {
      const data = await StudioAPI.request('/api/admin/catalog/tags');
      tags = data.tags || [];
      const current = $('#tag-manager-theme').value;
      const themes = new Map(tags.flatMap(t => t.themes.map(x => [x.id,x.title])));
      $('#tag-manager-theme').innerHTML = '<option value="">Toutes les thématiques</option>' + [...themes].sort((a,b)=>a[1].localeCompare(b[1],'fr')).map(([id,title]) => `<option value="${esc(id)}">${esc(title)}</option>`).join('');
      if (themes.has(current)) $('#tag-manager-theme').value = current;
      render(); error('');
      if (coverageLoaded) await loadCoverage();
    } catch (e) { error(e.message); }
  }
  window.StudioTags = { load };
  $('#tag-manager-search').addEventListener('input',render);
  $('#tag-manager-theme').addEventListener('change',render);
  $('#tag-manager-duplicates').addEventListener('change',render);
  $('#tag-manager-refresh').onclick = load;
  function coverageLocations(si) {
    const theme = $('#tag-coverage-theme').value, placement = $('#tag-coverage-placement').value;
    return (si.locations || []).filter(l => (!theme || String(l.theme_id) === theme) && (!placement || l.placement === placement));
  }
  function coverageState(si) {
    return si.deleted_at ? 'deleted' : si.archived_at ? 'archived' : si.active === false ? 'inactive' : 'active';
  }
  function renderCoverage(resetPage = false) {
    if (resetPage) coveragePage = 0;
    const state = $('#tag-coverage-state').value, range = $('#tag-coverage-count').value, query = norm($('#tag-coverage-search').value);
    const pool = coverageSituations.filter(si => coverageLocations(si).length && (!state || coverageState(si) === state));
    const countMatch = n => !range || (range === '0-2' ? n <= 2 : range === '0' ? n === 0 : range === '1-2' ? n >= 1 && n <= 2 : range === '3-5' ? n >= 3 && n <= 5 : n >= 6);
    const rows = pool.filter(si => countMatch(si.tag_count) && (!query || norm([si.id,si.content,...si.admin_tags].join(' ')).includes(query)))
      .sort((a,b) => a.tag_count-b.tag_count || a.theme_title.localeCompare(b.theme_title,'fr') || String(a.id).localeCompare(String(b.id),'fr',{numeric:true}));
    const libraries = pool.filter(si => coverageLocations(si).some(l => l.placement === 'library'));
    $('#tag-coverage-summary').textContent = `${pool.length} situation(s) dans le périmètre : ${pool.filter(si => si.tag_count === 0).length} sans tag, ${pool.filter(si => si.tag_count >= 1 && si.tag_count <= 2).length} avec 1–2 tags. Bibliothèque complémentaire : ${libraries.length} situation(s), dont ${libraries.filter(si => si.tag_count === 0).length} sans tag. ${rows.length} résultat(s) pour les filtres de nombre et de recherche.`;
    const pages = Math.max(1,Math.ceil(rows.length/coveragePageSize));
    coveragePage = Math.min(coveragePage,pages-1);
    $('#tag-coverage-page').textContent = `Page ${coveragePage+1} / ${pages}`;
    $('#tag-coverage-prev').disabled = coveragePage === 0;
    $('#tag-coverage-next').disabled = coveragePage >= pages-1;
    $('#tag-coverage-results').innerHTML = rows.length ? rows.slice(coveragePage*coveragePageSize,(coveragePage+1)*coveragePageSize).map(si => {
      const params = new URLSearchParams({tab:'library',themeId:String(si.theme_id),chapterId:String(si.chapter_id),situationId:String(si.id)});
      return `<article class="tag-coverage-card"><div class="tag-coverage-card-head"><strong>Situation #${esc(si.id)}</strong><span class="tag-coverage-count ${si.tag_count === 0?'is-empty':''}">${si.tag_count} tag${si.tag_count>1?'s':''}</span></div><div class="tag-coverage-locations">${coverageLocations(si).map(l => `<span>${esc(l.theme_title)} · ${esc(l.chapter_title)} · <strong>${l.placement==='base'?'Base':'Bibliothèque complémentaire'}</strong></span>`).join('')}</div><p class="tag-coverage-content">${esc(si.content)}</p><div class="tag-coverage-keywords">${si.admin_tags.map(tag => `<span>${esc(tag)}</span>`).join('') || '<em>Aucun tag</em>'}</div><div class="tag-coverage-actions"><button type="button" class="button button-primary" data-coverage-edit="${esc(si.id)}">Modifier les tags</button><a class="button button-secondary" href="admin.html?${esc(params.toString())}" target="_blank" rel="noopener noreferrer">Ouvrir la situation ↗</a></div></article>`;
    }).join('') : '<p class="admin-library-empty-line">Aucune situation ne correspond à ces filtres.</p>';
  }
  async function loadCoverage() {
    $('#tag-coverage-status').textContent = 'Chargement du bilan des situations…';
    try {
      const data = await StudioAPI.request('/api/admin/catalog/tags/coverage');
      coverageSituations = data.situations || []; coverageLoaded = true;
      const current = $('#tag-coverage-theme').value;
      const themes = new Map(coverageSituations.flatMap(si => si.locations.map(l => [String(l.theme_id),l.theme_title])));
      $('#tag-coverage-theme').innerHTML = '<option value="">Toutes les thématiques</option>' + [...themes].sort((a,b)=>a[1].localeCompare(b[1],'fr')).map(([id,title])=>`<option value="${esc(id)}">${esc(title)}</option>`).join('');
      if (themes.has(current)) $('#tag-coverage-theme').value = current;
      renderCoverage(); $('#tag-coverage-status').textContent = '';
    } catch (err) { $('#tag-coverage-status').textContent = err.message; }
  }
  async function setTagView(view) {
    await saveQueue;
    const situations = view === 'situations';
    $('#tag-dictionary-panel').hidden = situations; $('#tag-coverage-panel').hidden = !situations;
    $('#tag-view-tags').setAttribute('aria-selected',String(!situations)); $('#tag-view-situations').setAttribute('aria-selected',String(situations));
    if (situations) await loadCoverage();
  }
  $('#tag-view-tags').onclick = () => setTagView('tags');
  $('#tag-view-situations').onclick = () => setTagView('situations');
  ['#tag-coverage-theme','#tag-coverage-placement','#tag-coverage-count','#tag-coverage-state'].forEach(selector => $(selector).addEventListener('change',()=>renderCoverage(true)));
  $('#tag-coverage-search').addEventListener('input',()=>renderCoverage(true));
  $('#tag-coverage-prev').onclick = () => { if (coveragePage > 0) { coveragePage--;renderCoverage(); } };
  $('#tag-coverage-next').onclick = () => { coveragePage++;renderCoverage(); };
  $('#tag-coverage-results').onclick = e => {
    const button = e.target.closest('[data-coverage-edit]'); if (!button) return;
    const si = coverageSituations.find(si => String(si.id) === button.dataset.coverageEdit);
    if (si) showUsage(null,{...si,admin_tags:[...si.admin_tags]});
  };
  function filterLock(locked) {
    ['#tag-manager-search','#tag-manager-theme','#tag-manager-duplicates','#tag-manager-refresh'].forEach(s => $(s).disabled = locked);
  }
  function saveName(input) {
    const index = Number(input.dataset.tagName), item = tags[index];
    if (!item || input.disabled) return;
    const target = input.value.trim().normalize('NFC');
    if (target === item.tag) { input.value = item.tag; return; }
    const status = $(`[data-tag-save-state="${index}"]`);
    if (!target || target.length > 60 || /[\u0000-\u001f,]/.test(target)) {
      input.setAttribute('aria-invalid','true'); status.textContent = 'Non enregistré : saisissez un libellé de 1 à 60 caractères, sans virgule.'; return;
    }
    input.disabled = true; pendingSaves++; filterLock(true);
    status.textContent = 'Enregistrement…'; input.removeAttribute('aria-invalid');
    saveQueue = saveQueue.then(async () => {
      try {
        const payload = {source:item.tag, target, action:'rename'};
        const preview = await StudioAPI.request('/api/admin/catalog/tags/change',{method:'POST',body:JSON.stringify({...payload,dryRun:true})});
        await StudioAPI.request('/api/admin/catalog/tags/change',{method:'POST',body:JSON.stringify({...payload,dryRun:false,fingerprint:preview.fingerprint})});
        item.tag = target; input.value = target; input.setAttribute('aria-label',`Modifier le tag ${target}`);
        status.textContent = `Enregistré · ${preview.count} situation(s)`;
        document.dispatchEvent(new Event('studio-catalog-tags-changed'));
      } catch (err) {
        input.setAttribute('aria-invalid','true'); status.textContent = `Non enregistré : ${err.message}`;
      } finally { input.disabled = false; pendingSaves--; if (!pendingSaves) filterLock(false); }
    });
  }
  $('#tag-manager-rows').addEventListener('focusout',e => {
    if (e.target.matches('[data-tag-name]')) saveName(e.target);
  });
  $('#tag-manager-rows').addEventListener('keydown',e => {
    const input = e.target;
    if (!input.matches('[data-tag-name]')) return;
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') {
      e.preventDefault(); input.value = tags[Number(input.dataset.tagName)].tag;
      input.removeAttribute('aria-invalid'); $(`[data-tag-save-state="${input.dataset.tagName}"]`).textContent = ''; input.blur();
    }
  });
  const usageDialog = $('#tag-usage-dialog');
  let usageRequest = 0, usageTag = '';
  let usageSituations = new Map();
  const info = (label,text) => `<span class="admin-info-dot" tabindex="0" role="note" aria-label="${esc(label)}" data-info="${esc(text)}">i</span>`;
  function usageEditor(si) {
    if (si.permanently_removed) return '';
    const id = String(si.id), current = si.admin_tags || [];
    return `<div class="tag-usage-editor" data-usage-editor="${esc(id)}"><div class="tag-usage-editor-label"><strong>Tags de cette situation</strong>${info('Portée du retrait d’un tag','La croix retire uniquement le tag de cette situation du catalogue et de ses éventuelles réutilisations. Les autres situations gardent ce tag. La suppression globale se fait dans la liste générale des tags.')}</div><div class="tag-usage-chips">${usageChips(si)}</div><label class="tag-usage-add-label" for="usage-add-${esc(id)}">Ajouter un tag ${info('Ajouter ou créer un tag','Recherchez un tag existant ou créez un nouveau mot-clé. Sélectionnez une suggestion ou appuyez sur Entrée. L’ajout est enregistré automatiquement sur cette situation. Aucun texte, réponse ou score n’est modifié.')}</label><input id="usage-add-${esc(id)}" type="search" data-usage-search autocomplete="off" maxlength="60" placeholder="Rechercher ou créer un tag…" aria-label="Rechercher ou créer un tag pour cette situation"><div class="tag-usage-suggestions" data-usage-suggestions hidden></div><p class="tag-usage-save-status" data-usage-save-status role="status"></p></div>`;
  }
  function usageChips(si) {
    return (si.admin_tags || []).map((tag,index) => `<span class="tag-usage-chip">${esc(tag)}<button type="button" data-usage-remove="${index}" aria-label="Retirer ${esc(tag)} de cette situation">×</button></span>`).join('') || '<span class="hint">Aucun tag sur cette situation.</span>';
  }
  function suggestUsage(editor) {
    const si = usageSituations.get(editor.dataset.usageEditor);
    if (!si || si.saving) return;
    const value = editor.querySelector('[data-usage-search]').value.trim(), key = norm(value);
    const used = new Set((si.admin_tags || []).map(norm));
    const all = tags.filter(t => !used.has(norm(t.tag)) && norm(t.tag).includes(key));
    const matches = all.slice(0,12);
    const exists = tags.some(t => norm(t.tag) === key);
    const canCreate = value && !exists && !used.has(key);
    const list = editor.querySelector('[data-usage-suggestions]');
    list.innerHTML = matches.map(t => `<button type="button" data-usage-add-tag="${esc(t.tag)}">${esc(t.tag)}</button>`).join('') +
      (canCreate ? `<button type="button" class="tag-usage-create" data-usage-add-tag="${esc(value)}">+ Créer et ajouter « ${esc(value)} »</button>` : '') +
      (used.has(key) ? '<span>Ce tag est déjà présent sur cette situation.</span>' : '') +
      (!matches.length && !canCreate && !used.has(key) ? '<span>Aucun tag à proposer.</span>' : '') +
      (all.length > 12 ? '<small>Précisez votre recherche pour voir les autres tags.</small>' : '');
    list.hidden = false;
  }
  async function changeUsage(editor,action,tag) {
    const si = usageSituations.get(editor.dataset.usageEditor);
    if (!si || si.saving) return;
    si.saving = true;
    const request = usageRequest, status = editor.querySelector('[data-usage-save-status]');
    status.textContent = 'Enregistrement…'; status.classList.remove('is-error');
    editor.querySelector('[data-usage-suggestions]').hidden = true;
    editor.querySelectorAll('button,input').forEach(el => el.disabled = true);
    try {
      const result = await StudioAPI.request('/api/admin/catalog/tags/situations/'+encodeURIComponent(si.id),{method:'POST',body:JSON.stringify({action,tag})});
      si.admin_tags = result.tags;
      if (request === usageRequest) {
        editor.querySelector('.tag-usage-chips').innerHTML = usageChips(si);
        editor.querySelector('[data-usage-search]').value = '';
        status.textContent = `Enregistré${usageTag && !si.admin_tags.includes(usageTag) ? ' · Le tag consulté a été retiré de cette situation.' : ''}`;
        const remaining = [...usageSituations.values()].filter(s => (s.admin_tags || []).includes(usageTag)).length;
        $('#tag-usage-membership').textContent = usageTag ? `${remaining} situation(s) de cette liste portent encore « ${usageTag} ». Les situations restent affichées pour poursuivre vos corrections.` : `${si.admin_tags.length} tag(s) sur cette situation. Le bilan sera actualisé automatiquement.`;
      }
      document.dispatchEvent(new Event('studio-catalog-tags-changed'));
      await load();
    } catch (err) { if (request === usageRequest) { status.textContent = 'Non enregistré : '+err.message; status.classList.add('is-error'); } }
    finally { si.saving = false; editor.querySelectorAll('button,input').forEach(el => el.disabled = false); }
  }
  $('#tag-usage-list').addEventListener('input',e => { if (e.target.matches('[data-usage-search]')) suggestUsage(e.target.closest('[data-usage-editor]')); });
  $('#tag-usage-list').addEventListener('focusin',e => { if (e.target.matches('[data-usage-search]')) suggestUsage(e.target.closest('[data-usage-editor]')); });
  $('#tag-usage-list').addEventListener('keydown',e => {
    if (!e.target.matches('[data-usage-search]')) return;
    const editor = e.target.closest('[data-usage-editor]');
    if (e.key === 'Escape') { editor.querySelector('[data-usage-suggestions]').hidden = true; e.stopPropagation(); e.preventDefault(); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = e.target.value.trim(); if (!value) return;
      const known = tags.find(t => norm(t.tag) === norm(value));
      changeUsage(editor,'add',known ? known.tag : value);
    }
  });
  $('#tag-usage-list').addEventListener('click',e => {
    const editor = e.target.closest('[data-usage-editor]'); if (!editor) return;
    const remove = e.target.closest('[data-usage-remove]'), add = e.target.closest('[data-usage-add-tag]');
    const si = usageSituations.get(editor.dataset.usageEditor);
    if (remove) changeUsage(editor,'remove',si.admin_tags[Number(remove.dataset.usageRemove)]);
    if (add) changeUsage(editor,'add',add.dataset.usageAddTag);
  });
  document.addEventListener('pointerdown',e => {
    usageDialog.querySelectorAll('[data-usage-suggestions]').forEach(list => { if (!e.target.closest('[data-usage-editor]') || !list.closest('[data-usage-editor]').contains(e.target)) list.hidden = true; });
  });
  $('#tag-usage-close').onclick = () => { usageRequest++; usageDialog.close(); };
  usageDialog.addEventListener('cancel',() => { usageRequest++; });
  async function showUsage(index,situation = null) {
    await saveQueue;
    const tag = tags[index];
    if ((!tag && !situation) || busy) return;
    const request = ++usageRequest;
    usageTag = situation ? '' : tag.tag; usageSituations = new Map();
    $('#tag-usage-title').textContent = situation ? `Modifier les tags · Situation #${situation.id}` : `Situations associées à « ${tag.tag} »`;
    $('#tag-usage-list').innerHTML = '<p role="status">Chargement des situations…</p>';
    usageDialog.showModal();
    try {
      const data = situation ? {situations:[situation]} : await StudioAPI.request('/api/admin/catalog/tags/situations?tag='+encodeURIComponent(tag.tag));
      if (request !== usageRequest) return;
      const situations = data.situations || [];
      usageSituations = new Map(situations.map(si => [String(si.id),si]));
      $('#tag-usage-list').innerHTML = `<p class="hint">${situations.length} situation(s). Chaque lien ouvre un nouvel onglet directement sur la situation dépliée.</p><div class="admin-library-note"><strong>Enregistrement automatique ${info('Portée des modifications','Chaque ajout ou retrait est enregistré immédiatement sur la situation concernée, y compris ses réutilisations dans le catalogue. Retirer ici ne supprime pas le tag des autres situations.')}</strong><span>Ajoutez et retirez les tags directement ci-dessous. La croix concerne la situation affichée ; « Supprimer » dans la gestion générale retire le tag partout.</span></div><p class="hint" id="tag-usage-membership"></p>` +
        (situations.length ? situations.map(si => {
          const params = new URLSearchParams({tab:'library',themeId:String(si.theme_id),chapterId:String(si.chapter_id),situationId:String(si.id)});
          const state = si.deleted_at?'Corbeille':si.archived_at?'Archivée':si.is_default?'Base du thème':'Bibliothèque complémentaire';
          const access = si.permanently_removed ? '<p class="hint">Situation retirée définitivement du catalogue : ouverture indisponible.</p>' : `<a class="button button-secondary" href="admin.html?${esc(params.toString())}" target="_blank" rel="noopener noreferrer">Ouvrir la situation ↗</a>`;
          return `<article class="tag-usage-item"><div class="tag-usage-meta"><strong>${esc(si.theme_title)}</strong><span>${esc(si.chapter_title)} · ${state}</span></div><p class="tag-usage-content">${esc(si.content)}</p>${usageEditor(si)}${access}</article>`;
        }).join('') : '<p>Ce tag n’est plus associé à une situation. Actualisez la liste des tags.</p>');
    } catch (err) { if (request === usageRequest) $('#tag-usage-list').innerHTML = `<p role="alert">${esc(err.message)}</p>`; }
  }
  let selection;
  $('#tag-manager-rows').onclick = async e => {
    const usage = e.target.closest('[data-tag-usage]');
    if (usage) { await showUsage(Number(usage.dataset.tagUsage)); return; }
    const button = e.target.closest('[data-tag-action]');
    if (!button || busy) return;
    await saveQueue;
    if (busy) return;
    const tag = tags[Number(button.dataset.tagIndex)];
    selection = {source:tag.tag, action:button.dataset.tagAction};
    const deleting = selection.action === 'delete', merging = selection.action === 'merge';
    $('#tag-edit-title').textContent = `${deleting?'Supprimer':merging?'Fusionner':'Renommer'} le tag « ${tag.tag} »`;
    $('#tag-edit-description').textContent = `Ce tag est associé à ${tag.count} situation(s). L’action sera globale, même si la liste est filtrée par thématique.`;
    $('#tag-edit-target-wrap').hidden = deleting;
    $('#tag-edit-target').hidden = merging;
    $('#tag-edit-merge').hidden = !merging;
    $('#tag-edit-target').value = tag.tag;
    $('#tag-edit-merge').innerHTML = '<option value="">Choisir le tag à conserver…</option>' + tags.filter(t=>t.tag!==tag.tag).map(t=>`<option value="${esc(t.tag)}">${esc(t.tag)}</option>`).join('');
    $('#tag-edit-error').textContent = '';
    dialog.showModal();
  };
  $('#tag-edit-cancel').onclick = () => dialog.close();
  $('#tag-edit-form').onsubmit = async e => {
    e.preventDefault();
    if (busy) return;
    const payload = {...selection, target: selection.action === 'merge' ? $('#tag-edit-merge').value : $('#tag-edit-target').value};
    busy = true; $('#tag-edit-submit').disabled = true;
    try {
      const preview = await StudioAPI.request('/api/admin/catalog/tags/change',{method:'POST',body:JSON.stringify({...payload,dryRun:true})});
      const description = payload.action === 'delete' ? `Retirer « ${payload.source} » de ${preview.count} situation(s) du catalogue ?` : `Remplacer « ${payload.source} » par « ${payload.target.trim()} » dans ${preview.count} situation(s) du catalogue ?`;
      if (!await StudioModal.confirm({title:'Confirmer la modification globale',message:description+' Les textes, réponses et scores restent inchangés.',type:payload.action==='delete'?'danger':'info',confirmLabel:'Confirmer',cancelLabel:'Annuler'})) return;
      await StudioAPI.request('/api/admin/catalog/tags/change',{method:'POST',body:JSON.stringify({...payload,dryRun:false,fingerprint:preview.fingerprint})});
      dialog.close();
      document.dispatchEvent(new Event('studio-catalog-tags-changed'));
      busy = false; await load(); error(`Modification enregistrée dans ${preview.count} situation(s).`);
    } catch (err) { $('#tag-edit-error').textContent = err.message; }
    finally { busy = false; $('#tag-edit-submit').disabled = false; }
  };
  if (new URLSearchParams(location.search).get('tab') === 'tags') load();
})();
