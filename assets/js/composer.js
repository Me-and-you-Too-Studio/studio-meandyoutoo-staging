(() => {
  const params = new URLSearchParams(location.search);
  const themeSlug = params.get('theme') || 'sexisme';
  let projectId = params.get('projectId') || '';
  const requestedChapter = Math.max(0, Number(params.get('chapter')||0));
  const state = { chapters: [], active: requestedChapter, project: null, library: [], libraryMode: 'add', replaceId: '' };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canonical = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const api = (path, options={}) => window.StudioAPI.request(path, options);

  function showMessage(message, tone='error') { const el=$('composer-alert'); el.hidden=false; el.textContent=message; el.dataset.tone=tone; }
  function totalSelected(){ return state.chapters.reduce((sum,ch)=>sum+ch.situations.length,0); }
  async function saveStep(step){ if(projectId) await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:step})}); }

  function renderNav(){
    const total=totalSelected();
    $('catalog-summary').textContent=`${state.chapters.length} chapitres · ${total} situations retenues`;
    $('catalog-count').innerHTML=`<strong>${total}</strong> situations dans votre autodiagnostic`;
    $('catalog-progress').style.width='100%';
    $('duration-estimate').textContent=`${Math.max(3,Math.round(total*.35))} à ${Math.max(5,Math.round(total*.45))} minutes · ${total} situations`;
    $('chapter-nav').innerHTML=state.chapters.map((ch,i)=>`<article class="creation-chapter-item ${i===state.active?'is-active':''}"><button class="creation-chapter-head" data-chapter="${i}" type="button"><span><small>Partie ${i+1}</small>${esc(ch.title)}</span><strong>${ch.situations.length}</strong></button><div class="creation-chapter-tabs"><button class="${i===state.active?'is-active':''}" data-chapter="${i}" type="button">Questions</button><a href="personnalisation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${i}">Profils</a></div></article>`).join('');
    document.querySelectorAll('[data-chapter]').forEach(button=>button.onclick=()=>{state.active=Number(button.dataset.chapter);history.replaceState(null,'',`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${state.active}`);render();window.scrollTo({top:0,behavior:'smooth'});});
  }

  function answerHtml(a){return `<div class="composer-answer ${a.is_best?'is-best':''}"><span class="composer-answer-text">${esc(a.content)}</span><span class="composer-score">Score ${Number(a.score).toLocaleString('fr-FR')}</span>${a.is_best?'<span class="composer-best">Réponse la plus juste</span>':''}</div>`;}

  function situationHtml(s,index){
    const ch=state.chapters[state.active]; const locked=Boolean(ch.locked||s.locked);
    return `<article class="composer-situation" data-situation-card="${esc(s.id)}"><div class="composer-situation-head">${locked?'<span class="composer-lock-chip">🔒 Contenu méthodologique obligatoire</span>':`<span class="composer-position-chip">Situation ${index+1}</span>`}<span class="composer-origin">Situation Me&YouToo</span></div><h3>${esc(s.content)}</h3><button class="composer-toggle" type="button" data-toggle="${esc(s.id)}" aria-expanded="false">Voir les réponses et les scores <span>⌄</span></button><div class="composer-answers" id="answers-${esc(s.id)}" hidden>${(s.answers||[]).map(answerHtml).join('')}</div>${!locked?`<div class="composer-actions"><button class="button button-secondary" type="button" data-edit="${esc(s.id)}">Modifier le texte</button><button class="button button-secondary" type="button" data-replace="${esc(s.id)}">Remplacer</button><button class="button button-danger-soft" type="button" data-remove="${esc(s.id)}">Supprimer du chapitre</button></div>`:''}</article>`;
  }

  function bindSituations(){
    document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{const box=$(`answers-${b.dataset.toggle}`);const open=box.hidden;box.hidden=!open;b.setAttribute('aria-expanded',String(open));b.childNodes[0].textContent=open?'Masquer les réponses et les scores ':'Voir les réponses et les scores ';});
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editSituation(b.dataset.edit));
    document.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>openLibrary('replace',b.dataset.replace));
    document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeSituation(b.dataset.remove));
  }

  function findSituation(id){return state.chapters.flatMap(ch=>ch.situations).find(s=>String(s.id)===String(id));}
  async function editSituation(id){const s=findSituation(id);const value=await window.StudioModal.prompt({eyebrow:'Personnalisation',title:'Modifier le texte de la situation',message:'Adaptez uniquement la mise en situation. Les réponses et les scores Me&YouToo resteront inchangés.',inputLabel:'Texte de la situation',value:s.content,required:true,requiredMessage:'Le texte de la situation ne peut pas être vide.',confirmLabel:'Enregistrer les modifications'});if(value===null)return;try{await api(`/api/projects/${projectId}/situations/${id}`,{method:'PATCH',body:JSON.stringify({customContent:value})});s.content=value;render();showMessage('Le texte de la situation a été enregistré.','success');}catch(e){showMessage(e.message);}}
  async function removeSituation(id){const ch=state.chapters[state.active],s=findSituation(id),linked=Boolean(s&&s.metadata&&s.metadata.link_group);const confirmed=await window.StudioModal.confirm({eyebrow:'Composition du diagnostic',title:linked?'Supprimer ces situations liées ?':'Supprimer cette situation ?',message:linked?'Cette situation fonctionne avec une autre mise en situation. Les deux seront retirées ensemble de ce chapitre. Cette action concerne uniquement ce brouillon.':'Cette mise en situation sera retirée de ce chapitre. Elle restera disponible dans le référentiel Me&YouToo.',type:'danger',cancelLabel:'Conserver',confirmLabel:linked?'Supprimer les situations':'Supprimer la situation'});if(!confirmed)return;try{const data=await api(`/api/projects/${projectId}/situations/${id}`,{method:'DELETE'});const deleted=new Set((data.deletedIds||[id]).map(String));ch.situations=ch.situations.filter(s=>!deleted.has(String(s.id)));render();showMessage(data.linked?'Les situations liées ont été supprimées ensemble.':'La situation a été supprimée du brouillon.','success');}catch(e){showMessage(e.message);}}

  function currentCatalogIds(){return new Set(state.chapters.flatMap(ch=>ch.situations).flatMap(s=>[String(s.catalog_situation_id||''),String(s.source_id||''),String(s.metadata?.duplicate_of_source_id||''),canonical(s.content)]).filter(Boolean));}
  async function openLibrary(mode='add',replaceId=''){
    const ch=state.chapters[state.active];state.libraryMode=mode;state.replaceId=replaceId;
    try{
      const data=await api(`/api/catalog/themes/${themeSlug}/library?chapterId=${encodeURIComponent(ch.catalog_chapter_id||ch.id)}&projectId=${encodeURIComponent(projectId)}`);
      const existing=currentCatalogIds();
      state.library=(data.situations||[]).filter(s=>![String(s.id||''),String(s.source_id||''),String(s.metadata?.duplicate_of_source_id||''),canonical(s.content)].filter(Boolean).some(k=>existing.has(k)));
      $('library-title').textContent=mode==='replace'?`Remplacer une situation · ${ch.title}`:`Ajouter une situation · ${ch.title}`;
      $('library-list').innerHTML=state.library.length?state.library.map((s,index)=>`<article class="composer-library-card tone-${index%4+1}"><div class="composer-library-number">${String(index+1).padStart(2,'0')}</div><div class="composer-library-content"><div class="composer-library-label">${s.metadata?.link_group?'Situations liées · ajoutées ensemble':'Situation disponible'}</div><h3>${esc(s.content)}</h3><details><summary>Consulter les réponses et les scores</summary>${(s.answers||[]).map(answerHtml).join('')}</details><button class="button button-primary" type="button" data-library-pick="${esc(s.id)}">${mode==='replace'?'Remplacer par cette situation':'Ajouter au chapitre'}</button></div></article>`).join(''):'<div class="composer-library-empty"><strong>Aucune autre situation disponible</strong><p>Les situations déjà présentes dans ce chapitre ne sont pas proposées ici.</p></div>';
      $('library-backdrop').hidden=false;$('library-drawer').classList.add('is-open');$('library-drawer').setAttribute('aria-hidden','false');
      document.querySelectorAll('[data-library-pick]').forEach(b=>b.onclick=()=>mode==='replace'?replaceSituation(replaceId,b.dataset.libraryPick):addSituation(b.dataset.libraryPick));
    }catch(e){showMessage(e.message);}
  }
  function closeLibrary(){$('library-backdrop').hidden=true;$('library-drawer').classList.remove('is-open');$('library-drawer').setAttribute('aria-hidden','true');}
  async function addSituation(catalogSituationId){const ch=state.chapters[state.active];try{const data=await api(`/api/projects/${projectId}/chapters/${ch.id}/situations`,{method:'POST',body:JSON.stringify({catalogSituationId:Number(catalogSituationId)})});ch.situations.push(...(data.situations||[data.situation]).filter(Boolean));closeLibrary();render();showMessage(data.linked?'Les situations liées ont été ajoutées et enregistrées ensemble.':'La situation a été ajoutée et enregistrée dans le brouillon.','success');}catch(e){showMessage(e.message);}}
  async function replaceSituation(projectSituationId,catalogSituationId){try{const data=await api(`/api/projects/${projectId}/situations/${projectSituationId}/replace`,{method:'PATCH',body:JSON.stringify({catalogSituationId:Number(catalogSituationId)})});closeLibrary();const refreshed=await api(`/api/projects/${projectId}/composer`);state.project=refreshed.project;state.chapters=refreshed.chapters;render();showMessage(data.linked?'La sélection liée a été remplacée et enregistrée ensemble.':'La situation a été remplacée et enregistrée.','success');}catch(e){showMessage(e.message);}}

  function render(){const ch=state.chapters[state.active];if(!ch)return;$('chapter-kicker').textContent=`Partie ${state.active+1} · Questions`;$('chapter-title').textContent=ch.title;$('chapter-desc').textContent=ch.locked?(ch.lock_reason||'Cette partie méthodologique est obligatoire et non modifiable.'):`${ch.situations.length} situations retenues · consultez les réponses et scores avant de modifier votre sélection.`;$('library-button').hidden=Boolean(ch.locked);$('situation-list').innerHTML=ch.situations.map(situationHtml).join('');$('sticky-part-label').textContent=`Partie ${state.active+1}/${state.chapters.length} · ${ch.title}`;const next=$('composer-next');if(next)next.href=`personnalisation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${state.active}`;renderNav();bindSituations();}

  async function ensureProject(){if(projectId)return;const project=await window.StudioProject.createNew(themeSlug);projectId=String(project.id);location.replace(`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}`);throw new Error('redirect');}
  async function load(){try{await ensureProject();const data=await api(`/api/projects/${projectId}/composer`);state.project=data.project;state.chapters=data.chapters;state.active=Math.min(state.active,Math.max(0,state.chapters.length-1));$('catalog-title').textContent=data.project.theme_title;const themeBack=$('composer-theme-back');if(themeBack)themeBack.href=`theme-${themeSlug}.html`;await saveStep('composer');render();}catch(e){if(e.message==='redirect')return;showMessage(`Impossible de charger le brouillon : ${e.message}`);$('chapter-title').textContent='Brouillon indisponible';}}

  $('library-button').onclick=()=>openLibrary('add');
  $('library-close').onclick=closeLibrary;$('library-backdrop').onclick=closeLibrary;
  document.body.classList.add('sidebar-collapsed');
  const collapseButton=document.querySelector('[data-sidebar-collapse]');if(collapseButton){collapseButton.setAttribute('aria-expanded','false');collapseButton.setAttribute('aria-label','Déployer le menu');collapseButton.setAttribute('title','Déployer le menu');}
  load();
})();
