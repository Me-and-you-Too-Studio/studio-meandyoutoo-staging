(function () {
  if (!StudioAPI.requireAuth('admin')) return;
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr');
  let tags = [], busy = false;
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
      return `<tr><td><strong>${esc(t.tag)}</strong>${variants.get(norm(t.tag)) > 1 ? '<small class="tag-variant">Variante à vérifier</small>' : ''}</td><td>${t.count}</td><td>${t.themes.map(x => esc(x.title)).join(' · ')}</td><td><div class="tag-row-actions"><button type="button" class="button button-secondary button-small" data-tag-action="rename" data-tag-index="${index}">Renommer</button><button type="button" class="button button-secondary button-small" data-tag-action="merge" data-tag-index="${index}">Fusionner</button><button type="button" class="button button-danger-soft button-small" data-tag-action="delete" data-tag-index="${index}">Supprimer</button></div></td></tr>`;
    }).join('') : '<tr><td colspan="4">Aucun tag ne correspond à votre recherche.</td></tr>';
  }
  async function load() {
    if (busy) return;
    error('Chargement des tags…');
    try {
      const data = await StudioAPI.request('/api/admin/catalog/tags');
      tags = data.tags || [];
      const current = $('#tag-manager-theme').value;
      const themes = new Map(tags.flatMap(t => t.themes.map(x => [x.id,x.title])));
      $('#tag-manager-theme').innerHTML = '<option value="">Toutes les thématiques</option>' + [...themes].sort((a,b)=>a[1].localeCompare(b[1],'fr')).map(([id,title]) => `<option value="${esc(id)}">${esc(title)}</option>`).join('');
      if (themes.has(current)) $('#tag-manager-theme').value = current;
      render(); error('');
    } catch (e) { error(e.message); }
  }
  window.StudioTags = { load };
  $('#tag-manager-search').addEventListener('input',render);
  $('#tag-manager-theme').addEventListener('change',render);
  $('#tag-manager-duplicates').addEventListener('change',render);
  $('#tag-manager-refresh').onclick = load;
  let selection;
  $('#tag-manager-rows').onclick = e => {
    const button = e.target.closest('[data-tag-action]');
    if (!button || busy) return;
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
