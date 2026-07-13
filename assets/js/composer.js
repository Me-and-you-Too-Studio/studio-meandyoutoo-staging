(() => {
  const params = new URLSearchParams(location.search);
  const themeSlug = params.get('theme') || 'sexisme';
  const projectId = params.get('projectId') || '';

  function resolveApiBase() {
    if (window.STUDIO_API_BASE) return String(window.STUDIO_API_BASE).replace(/\/$/, '');
    const hostname = String(location.hostname || '').toLowerCase();
    const pathname = String(location.pathname || '').toLowerCase();
    const isStaging = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('staging') || pathname.includes('/studio-meandyoutoo-staging/');
    return isStaging
      ? 'https://studio-meandyoutoo-api-staging.osc-fr1.scalingo.io'
      : 'https://studio-meandyoutoo-api.osc-fr1.scalingo.io';
  }

  const API_BASE = resolveApiBase();
  const state = { chapters: [], active: 0, project: null, library: [], libraryMode: 'add', replaceId: '' };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canonical = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const localKey = `studio_composer_${themeSlug}`;

  async function api(path, options = {}) {
    const response = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Erreur API ${response.status}`);
    return data;
  }

  function showMessage(message, tone = 'error') {
    const el = $('composer-alert');
    el.hidden = false;
    el.textContent = message;
    el.dataset.tone = tone;
  }

  function hideMessage() {
    const el = $('composer-alert');
    el.hidden = true;
    el.textContent = '';
  }

  function persistLocal() {
    if (projectId) return;
    localStorage.setItem(localKey, JSON.stringify({ chapters: state.chapters, active: state.active }));
  }

  function restoreLocal(chapters) {
    if (projectId) return chapters;
    try {
      const saved = JSON.parse(localStorage.getItem(localKey) || 'null');
      if (!saved || !Array.isArray(saved.chapters)) return chapters;
      const bySlug = new Map(saved.chapters.map(ch => [String(ch.slug || ch.id), ch]));
      return chapters.map(ch => bySlug.get(String(ch.slug || ch.id)) || ch);
    } catch (_) {
      return chapters;
    }
  }

  function totalSelected() {
    return state.chapters.reduce((sum, chapter) => sum + chapter.situations.filter(s => s.selected !== false).length, 0);
  }

  function renderNav() {
    const total = state.chapters.reduce((sum, chapter) => sum + chapter.situations.length, 0);
    const selected = totalSelected();
    $('catalog-summary').textContent = `${state.chapters.length} chapitres · ${total} situations disponibles`;
    $('catalog-count').innerHTML = `<strong>${selected} / ${total}</strong> situations retenues`;
    $('catalog-progress').style.width = (total ? Math.round(selected / total * 100) : 0) + '%';
    $('duration-estimate').textContent = `${Math.max(3, Math.round(selected * .35))} à ${Math.max(5, Math.round(selected * .45))} minutes · ${selected} situations retenues`;
    $('chapter-nav').innerHTML = state.chapters.map((chapter, index) => `
      <button class="composer-chapter-button ${index === state.active ? 'is-active' : ''}" data-chapter="${index}">
        <span><small>Chapitre ${index + 1}</small>${esc(chapter.title)}</span>
        <strong>${chapter.situations.filter(s => s.selected !== false).length}</strong>
      </button>`).join('');
    document.querySelectorAll('[data-chapter]').forEach(button => {
      button.onclick = () => { state.active = Number(button.dataset.chapter); persistLocal(); render(); };
    });
  }

  function answerHtml(answer) {
    return `<div class="composer-answer ${answer.is_best ? 'is-best' : ''}">
      <span class="composer-answer-text">${esc(answer.content)}</span>
      <span class="composer-score">Score ${Number(answer.score).toLocaleString('fr-FR')}</span>
      ${answer.is_best ? '<span class="composer-best">Réponse la plus juste</span>' : ''}
    </div>`;
  }

  function situationHtml(situation, index) {
    const chapter = state.chapters[state.active];
    const locked = Boolean(chapter.locked || situation.locked);
    return `<article class="composer-situation ${situation.selected === false ? 'is-unselected' : ''}" data-situation-card="${esc(situation.id)}">
      <div class="composer-situation-head">
        ${locked
          ? '<span class="composer-lock-chip">🔒 Contenu méthodologique obligatoire</span>'
          : '<span class="composer-position-chip">Situation ' + (index + 1) + '</span>'}
        <span class="composer-origin">Situation Me&YouToo</span>
      </div>
      <h3>${esc(situation.content)}</h3>
      <button class="composer-toggle" type="button" data-toggle="${esc(situation.id)}" aria-expanded="false">Voir les réponses et les scores <span>⌄</span></button>
      <div class="composer-answers" id="answers-${esc(situation.id)}" hidden>${(situation.answers || []).map(answerHtml).join('')}</div>
      ${!locked ? `<div class="composer-actions">
        <button class="button button-secondary" type="button" data-edit="${esc(situation.id)}">Modifier le texte</button>
        <button class="button button-secondary" type="button" data-replace="${esc(situation.id)}">Remplacer</button>
        <button class="button button-danger-soft" type="button" data-remove="${esc(situation.id)}">Supprimer du chapitre</button>
      </div>` : ''}
    </article>`;
  }

  function bindSituations() {
    document.querySelectorAll('[data-toggle]').forEach(button => {
      button.onclick = () => {
        const box = $(`answers-${button.dataset.toggle}`);
        const open = box.hidden;
        box.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        button.childNodes[0].textContent = open ? 'Masquer les réponses et les scores ' : 'Voir les réponses et les scores ';
      };
    });
    document.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => editSituation(button.dataset.edit));
    document.querySelectorAll('[data-replace]').forEach(button => button.onclick = () => openLibrary('replace', button.dataset.replace));
    document.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => removeSituation(button.dataset.remove));
  }

  function findSituation(id) {
    return state.chapters.flatMap(chapter => chapter.situations).find(s => String(s.id) === String(id));
  }

  async function editSituation(id) {
    const situation = findSituation(id);
    const value = prompt('Adaptez uniquement le texte de la situation. Les réponses et les scores restent inchangés :', situation.content);
    if (value === null || !value.trim()) return;
    try {
      if (projectId) await api(`/api/projects/${projectId}/situations/${id}`, { method: 'PATCH', body: JSON.stringify({ customContent: value.trim() }) });
      situation.content = value.trim();
      persistLocal();
      render();
      showMessage('Le texte de la situation a été mis à jour.', 'success');
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function removeSituation(id) {
    const chapter = state.chapters[state.active];
    const situation = chapter.situations.find(s => String(s.id) === String(id));
    if (!situation || !confirm('Supprimer cette situation du chapitre ?')) return;
    try {
      if (projectId) {
        await api(`/api/projects/${projectId}/situations/${id}`, { method: 'PATCH', body: JSON.stringify({ selected: false }) });
      }
      chapter.situations = chapter.situations.filter(s => String(s.id) !== String(id));
      persistLocal();
      render();
      showMessage('La situation a été retirée du chapitre.', 'success');
    } catch (error) {
      showMessage(error.message);
    }
  }

  function currentCatalogIds() {
    const chapter = state.chapters[state.active];
    return new Set(chapter.situations.flatMap(s => [
      String(s.catalog_situation_id || ''),
      String(s.source_id || ''),
      canonical(s.content)
    ]).filter(Boolean));
  }

  async function openLibrary(mode = 'add', replaceId = '') {
    const chapter = state.chapters[state.active];
    state.libraryMode = mode;
    state.replaceId = replaceId;
    try {
      const data = await api(`/api/catalog/themes/${themeSlug}/library?chapterId=${encodeURIComponent(chapter.catalog_chapter_id || chapter.id)}`);
      const existing = currentCatalogIds();
      state.library = (data.situations || []).filter(s => {
        const keys = [String(s.id || ''), String(s.source_id || ''), canonical(s.content)].filter(Boolean);
        return !keys.some(key => existing.has(key));
      });
      $('library-title').textContent = mode === 'replace' ? `Remplacer une situation · ${chapter.title}` : `Ajouter une situation · ${chapter.title}`;
      $('library-list').innerHTML = state.library.length ? state.library.map((s, index) => `
        <article class="composer-library-card tone-${(index % 4) + 1}">
          <div class="composer-library-number">${String(index + 1).padStart(2, '0')}</div>
          <div class="composer-library-content">
            <div class="composer-library-label">Situation disponible</div>
            <h3>${esc(s.content)}</h3>
            <details><summary>Consulter les réponses et les scores</summary>${(s.answers || []).map(answerHtml).join('')}</details>
            <button class="button button-primary" type="button" data-library-pick="${esc(s.id)}">${mode === 'replace' ? 'Remplacer par cette situation' : 'Ajouter au chapitre'}</button>
          </div>
        </article>`).join('') : '<div class="composer-library-empty"><strong>Aucune autre situation disponible</strong><p>Les situations déjà présentes dans ce chapitre ne sont pas affichées ici.</p></div>';
      $('library-backdrop').hidden = false;
      $('library-drawer').classList.add('is-open');
      $('library-drawer').setAttribute('aria-hidden', 'false');
      document.querySelectorAll('[data-library-pick]').forEach(button => button.onclick = () => {
        if (state.libraryMode === 'replace') replaceSituation(state.replaceId, button.dataset.libraryPick);
        else addSituation(button.dataset.libraryPick);
      });
    } catch (error) {
      showMessage(error.message);
    }
  }

  function closeLibrary() {
    $('library-backdrop').hidden = true;
    $('library-drawer').classList.remove('is-open');
    $('library-drawer').setAttribute('aria-hidden', 'true');
  }

  async function replaceSituation(projectSituationId, catalogSituationId) {
    try {
      const librarySituation = state.library.find(s => String(s.id) === String(catalogSituationId));
      if (!librarySituation) return;
      if (projectId) await api(`/api/projects/${projectId}/situations/${projectSituationId}/replace`, { method: 'PATCH', body: JSON.stringify({ catalogSituationId: Number(catalogSituationId) }) });
      const situation = findSituation(projectSituationId);
      situation.catalog_situation_id = librarySituation.id;
      situation.content = librarySituation.content;
      situation.answers = librarySituation.answers;
      persistLocal();
      closeLibrary();
      render();
      showMessage('La situation a été remplacée.', 'success');
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function addSituation(catalogSituationId) {
    const chapter = state.chapters[state.active];
    const librarySituation = state.library.find(s => String(s.id) === String(catalogSituationId));
    if (!librarySituation) return;
    try {
      let added = {
        ...librarySituation,
        id: `local-${Date.now()}`,
        catalog_situation_id: librarySituation.id,
        selected: true,
        source: 'library'
      };
      if (projectId) {
        const result = await api(`/api/projects/${projectId}/chapters/${chapter.id}/situations`, {
          method: 'POST',
          body: JSON.stringify({ catalogSituationId: Number(catalogSituationId) })
        });
        added = { ...librarySituation, ...(result.situation || {}), content: librarySituation.content, answers: librarySituation.answers, selected: true };
      }
      chapter.situations.push(added);
      persistLocal();
      closeLibrary();
      render();
      showMessage('La situation a été ajoutée au chapitre.', 'success');
    } catch (error) {
      showMessage(error.message.includes('404') ? 'L’ajout doit aussi être activé dans l’API pour les projets enregistrés.' : error.message);
    }
  }

  function render() {
    const chapter = state.chapters[state.active];
    if (!chapter) return;
    hideMessage();
    $('chapter-kicker').textContent = `Chapitre ${state.active + 1}`;
    $('chapter-title').textContent = chapter.title;
    $('chapter-desc').textContent = chapter.locked
      ? (chapter.lock_reason || 'Cette partie méthodologique Me&YouToo est obligatoire et non modifiable.')
      : `${chapter.situations.length} situations dans ce chapitre. Vous pouvez en ajouter, en supprimer ou en remplacer.`;
    $('library-button').hidden = Boolean(chapter.locked);
    $('library-button').textContent = 'Ajouter depuis la bibliothèque';
    $('situation-list').innerHTML = chapter.situations.map(situationHtml).join('');
    renderNav();
    bindSituations();
  }

  async function load() {
    try {
      let data;
      if (projectId) {
        data = await api(`/api/projects/${projectId}/composer`);
        state.project = data.project;
        state.chapters = data.chapters;
        state.chapters.forEach(chapter => chapter.situations.forEach(situation => situation.selected = situation.selected !== false));
        $('catalog-title').textContent = data.project.theme_title;
      } else {
        data = await api(`/api/catalog/themes/${themeSlug}/template`);
        const chapters = data.chapters.map(chapter => ({
          ...chapter,
          catalog_chapter_id: chapter.id,
          situations: chapter.situations.map(situation => ({ ...situation, catalog_situation_id: situation.id, selected: true }))
        }));
        state.chapters = restoreLocal(chapters);
        $('catalog-title').textContent = data.theme.title;
      }
      render();
    } catch (error) {
      showMessage(`Impossible de charger le catalogue : ${error.message}`);
      $('chapter-title').textContent = 'Catalogue indisponible';
    }
  }

  $('library-button').onclick = () => openLibrary('add');
  const next = $('composer-next');
  if (next) next.href = 'personnalisation.html?theme=' + encodeURIComponent(themeSlug) + (projectId ? '&projectId=' + encodeURIComponent(projectId) : '');
  $('library-close').onclick = closeLibrary;
  $('library-backdrop').onclick = closeLibrary;
  load();
})();
