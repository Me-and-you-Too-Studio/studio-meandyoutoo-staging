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
    $('chapter-nav').innerHTML=state.chapters.map((ch,i)=>{const blocking=firstInvalidIndex(i),blocked=blocking!==-1,st=chapterCountStatus(ch);return `<article class="creation-chapter-item ${i===state.active?'is-active':''} ${st.below||st.above?'is-incomplete':''}"><button class="creation-chapter-head" data-chapter="${i}" type="button"><span><small>Partie ${i+1}</small>${esc(ch.title)}</span><strong>${ch.situations.length}</strong></button><div class="creation-chapter-tabs"><button class="${i===state.active?'is-active':''}" data-chapter="${i}" type="button">Questions</button><button class="${blocked?'is-disabled':''}" data-profile-chapter="${i}" data-blocking-chapter="${blocking}" aria-disabled="${blocked}" type="button">Profils</button></div></article>`;}).join('');
    document.querySelectorAll('[data-chapter]').forEach(button=>button.onclick=()=>{state.active=Number(button.dataset.chapter);history.replaceState(null,'',`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${state.active}`);render();window.scrollTo({top:0,behavior:'smooth'});});
    document.querySelectorAll('[data-profile-chapter]').forEach(button=>button.onclick=async()=>{const blocking=Number(button.dataset.blockingChapter);if(blocking>=0){await showIncompleteChapterModal(blocking,'Complétez les situations avant de personnaliser les profils');return;}location.href=`personnalisation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${button.dataset.profileChapter}`;});
  }

  function isLegalChapter(ch=state.chapters[state.active]){return canonical(ch?.slug||ch?.title).includes('harcelement')||canonical(ch?.slug||ch?.title).includes('agression sexuelle');}
  function bestAnswerLabel(){return isLegalChapter()?'Réponse correcte':'Réponse la plus appropriée';}
  function isStereotypesChapter(ch=state.chapters[state.active]){return themeSlug==='sexisme'&&canonical(ch?.slug||ch?.title).includes('stereotype');}
  function isAggressionChapter(ch=state.chapters[state.active]){return canonical(ch?.slug||ch?.title).includes('agression sexuelle');}
  function chapterSituationRules(ch=state.chapters[state.active]){
    if(isStereotypesChapter(ch))return {min:null,max:null};
    return {min:isAggressionChapter(ch)?4:5,max:8};
  }
  function chapterCountStatus(ch=state.chapters[state.active]){
    const rules=chapterSituationRules(ch),count=ch?.situations?.length||0;
    return {rules,count,below:rules.min!=null&&count<rules.min,atMax:rules.max!=null&&count>=rules.max,above:rules.max!=null&&count>rules.max};
  }
  function firstInvalidIndex(limit=state.chapters.length-1){for(let i=0;i<=Math.min(limit,state.chapters.length-1);i++){const st=chapterCountStatus(state.chapters[i]);if(st.below||st.above)return i;}return -1;}
  async function showIncompleteChapterModal(index,title){
    const ch=state.chapters[index],status=chapterCountStatus(ch);if(!ch)return;
    state.active=index;history.replaceState(null,'',`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${index}`);render();window.scrollTo({top:0,behavior:'smooth'});
    if(status.below){const goLibrary=await window.StudioModal.confirm({eyebrow:'Composition du diagnostic',title:title||`Il vous faut ${status.rules.min} situations minimum`,message:`« ${ch.title} » contient ${status.count} situation${status.count>1?'s':''}. Ajoutez-en ${status.rules.min-status.count} avant de personnaliser les profils.`,type:'info',cancelLabel:'Rester sur le chapitre',confirmLabel:'Piocher dans la bibliothèque'});if(goLibrary)openLibrary('add');return;}
    await window.StudioModal.alert({eyebrow:'Composition du diagnostic',title:`Maximum de ${status.rules.max} situations`,message:`« ${ch.title} » contient plus de ${status.rules.max} situations. Supprimez-en une avant de personnaliser les profils.`,type:'warning',confirmLabel:'J’ai compris'});
  }
  function wordDiffHtml(original,current){
    const a=String(original||'').split(/(\s+|[.,;:!?'"()«»–—-])/).filter(Boolean),b=String(current||'').split(/(\s+|[.,;:!?'"()«»–—-])/).filter(Boolean);
    const n=a.length,m=b.length,dp=Array.from({length:n+1},()=>Array(m+1).fill(0));
    for(let i=n-1;i>=0;i--)for(let k=m-1;k>=0;k--)dp[i][k]=a[i]===b[k]?dp[i+1][k+1]+1:Math.max(dp[i+1][k],dp[i][k+1]);
    let i=0,k=0,out='';
    while(i<n||k<m){
      if(i<n&&k<m&&a[i]===b[k]){out+=esc(a[i]);i++;k++;}
      else if(k<m&&(i===n||dp[i][k+1]>=dp[i+1]?.[k])){out+=`<ins>${esc(b[k])}</ins>`;k++;}
      else if(i<n){out+=`<del>${esc(a[i])}</del>`;i++;}
    }
    return out;
  }
  function diffBlock(original,current,label){
    if(String(original||'')===String(current||''))return '';
    return `<div class="composer-diff"><div class="composer-diff-label">${esc(label)}</div><div class="composer-diff-text">${wordDiffHtml(original,current)}</div></div>`;
  }
  function answerHtml(a, editable=false, originalContent=''){
    const changed=editable&&String(originalContent||'')!==String(a.content||'');
    return `<div class="composer-answer ${a.is_best?'is-best':''} ${changed?'is-customized':''}">
      ${editable?`<textarea class="composer-inline-answer" data-answer-input="${esc(a.id)}" data-original-answer="${esc(originalContent||a.content)}" rows="2" aria-label="Modifier cette réponse">${esc(a.content)}</textarea>`:`<span class="composer-answer-text">${esc(a.content)}</span>`}
      <span class="composer-score">Score ${Number(a.score).toLocaleString('fr-FR')}</span>
      ${a.is_best?`<span class="composer-best">${bestAnswerLabel()}</span>`:''}
      <div data-live-answer-diff="${esc(a.id)}">${changed?diffBlock(originalContent,a.content,'Modifications par rapport à la réponse Me&YouToo'):''}</div>
    </div>`;
  }

  function linkedSituationLabel(s,index,situations){
    const group=s?.metadata?.link_group;if(!group)return '';
    const linkedNumbers=situations.map((item,i)=>item?.metadata?.link_group===group?i+1:null).filter(Boolean);
    const others=linkedNumbers.filter(number=>number!==index+1);
    return others.length?`Situation ${index+1} liée ${others.length>1?'aux situations':'à la situation'} ${others.join(' et ')}`:`Situation ${index+1} liée à une autre situation`;
  }

  function situationTone(s,index,ch){
    const group=s?.metadata?.link_group||'';
    if(group){
      const firstLinkedIndex=ch.situations.findIndex(item=>item?.metadata?.link_group===group);
      return `tone-${(Math.max(0,firstLinkedIndex)%4)+1}`;
    }
    return `tone-${(index%4)+1}`;
  }

  function situationHtml(s,index){
    const ch=state.chapters[state.active];
    const stereotypes=themeSlug==='sexisme'&&canonical(ch.slug||ch.title).includes('stereotype');
    const methodologyLocked=Boolean(ch.locked||s.locked||stereotypes);
    const adminCorrection=Boolean(state.project?.review_mode&&state.project?.can_edit===true);
    const locked=Boolean(methodologyLocked||(!adminCorrection&&state.project?.can_edit===false));
    const linkedLabel=linkedSituationLabel(s,index,ch.situations);
    const originalText=s.original_content||s.content||'';
    const customized=Boolean(s.has_customization||String(originalText)!==String(s.content||'')||(s.answers||[]).some(a=>{const o=(s.original_answers||[]).find(x=>String(x.id)===String(a.id));return o&&String(o.content)!==String(a.content);}));
    const originTag=s.from_library?'<span class="composer-library-choice-tag">✓ Choisie dans la bibliothèque</span>':'';
    const situationText=locked
      ?`<h3>${esc(s.content)}</h3>`
      :`<div class="composer-inline-field">
          <div class="composer-editor-label-row"><label for="situation-text-${esc(s.id)}">Texte de la mise en situation</label><span class="composer-context-tag">Contextualisation uniquement</span></div>
          <textarea id="situation-text-${esc(s.id)}" class="composer-inline-situation ${String(originalText)!==String(s.content||'')?'is-customized':''}" data-situation-input="${esc(s.id)}" data-original-situation="${esc(originalText)}" rows="3">${esc(s.content)}</textarea>
          <div data-live-situation-diff>${diffBlock(originalText,s.content,'Modifications par rapport à la situation Me&YouToo')}</div>
          <small class="composer-field-guidance">Adaptez un prénom, un métier, votre terminologie ou le contexte professionnel. Si le sens ne convient pas, utilisez « Remplacer » et choisissez une autre situation dans la bibliothèque.</small>
        </div>`;
    const answerRows=(s.answers||[]).map(a=>{const original=(s.original_answers||[]).find(o=>String(o.id)===String(a.id));return answerHtml(a,!locked,original?.content||a.content);}).join('');
    const tone=situationTone(s,index,ch);
    return `<article class="composer-situation ${tone} ${locked?'is-locked':''} ${customized?'has-customization':''}" data-situation-card="${esc(s.id)}">
      <div class="composer-situation-head">
        <div class="composer-situation-tags">${locked?'<span class="composer-lock-chip">🔒 Contenu méthodologique obligatoire</span>':`<span class="composer-position-chip">Situation ${index+1}</span>`}${originTag}${customized?'<span class="composer-customized-tag">✎ Personnalisée</span>':''}</div>
        <span class="composer-origin">Situation Me&YouToo</span>
      </div>
      ${linkedLabel?`<div class="composer-linked-chip">🔗 ${esc(linkedLabel)}</div>`:''}
      ${situationText}
      <button class="composer-toggle" type="button" data-toggle="${esc(s.id)}" aria-expanded="false"><span data-toggle-label>Voir les réponses et les scores</span> <span aria-hidden="true">⌄</span></button>
      <div class="composer-answers" id="answers-${esc(s.id)}" hidden>${answerRows}</div>
      ${!locked?`<div class="composer-inline-help composer-context-help"><strong>Réponses : contextualisation uniquement</strong><span>Adaptez les termes au contexte de votre organisation sans changer le sens ni le niveau de pertinence. Si le fond ne convient pas, remplacez la situation depuis la bibliothèque Me&YouToo. Les scores restent verrouillés et Me&YouToo validera les adaptations avant publication.</span></div>
      <div class="composer-save-row"><span class="composer-save-status is-saved" data-save-status="${esc(s.id)}"><span class="composer-save-check" aria-hidden="true">✓</span><span data-save-text>${customized?'Enregistré':'Enregistrement automatique'}</span></span></div>
      <div class="composer-actions">
        ${customized?`<button class="button button-ghost" type="button" data-reset="${esc(s.id)}">↶ Annuler mes modifications</button>`:''}
        <button class="button button-secondary" type="button" data-replace="${esc(s.id)}">Remplacer</button>
        <button class="button button-danger-soft" type="button" data-remove="${esc(s.id)}">Supprimer du chapitre</button>
      </div>`:''}
    </article>`;
  }

  const autosaveTimers=new Map();
  function setSaveStatus(card,stateName,message){
    const status=card?.querySelector('[data-save-status]'),text=status?.querySelector('[data-save-text]');
    if(!status)return;
    status.classList.remove('is-saving','is-saved','is-error');
    status.classList.add(stateName);
    if(text)text.textContent=message;
  }
  function scheduleAutosave(id){
    const card=document.querySelector(`[data-situation-card="${CSS.escape(String(id))}"]`);
    if(!card)return;
    setSaveStatus(card,'is-saving','Modifications en attente…');
    clearTimeout(autosaveTimers.get(String(id)));
    autosaveTimers.set(String(id),setTimeout(()=>saveInlineSituation(id),800));
  }
  function bindSituations(){
    document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{
      const box=$(`answers-${b.dataset.toggle}`),label=b.querySelector('[data-toggle-label]');
      if(!box)return;
      box.hidden=!box.hidden;
      b.setAttribute('aria-expanded',String(!box.hidden));
      if(label)label.textContent=box.hidden?'Voir les réponses et les scores':'Masquer les réponses et les scores';
    });
    document.querySelectorAll('[data-situation-input],[data-answer-input]').forEach(input=>{
      input.addEventListener('input',()=>scheduleAutosave(input.closest('[data-situation-card]')?.dataset.situationCard));
      input.addEventListener('blur',()=>{
        const id=input.closest('[data-situation-card]')?.dataset.situationCard;
        if(id&&autosaveTimers.has(String(id))){clearTimeout(autosaveTimers.get(String(id)));autosaveTimers.delete(String(id));saveInlineSituation(id);}
      });
    });
    document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>resetSituationCustomization(b.dataset.reset));
    document.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>openLibrary('replace',b.dataset.replace));
    document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeSituation(b.dataset.remove));
  }

  function findSituation(id){return state.chapters.flatMap(ch=>ch.situations).find(s=>String(s.id)===String(id));}
  function refreshLiveDiff(card,s,situationText,answers){
    const situationOriginal=String(s.original_content||card.querySelector('[data-situation-input]')?.dataset.originalSituation||'');
    const situationDiff=card.querySelector('[data-live-situation-diff]');
    const situationInput=card.querySelector('[data-situation-input]');
    const situationChanged=situationOriginal!==String(situationText||'');
    if(situationDiff)situationDiff.innerHTML=situationChanged?diffBlock(situationOriginal,situationText,'Modifications par rapport à la situation Me&YouToo'):'';
    if(situationInput)situationInput.classList.toggle('is-customized',situationChanged);

    let anyChanged=situationChanged;
    answers.forEach(item=>{
      const input=card.querySelector(`[data-answer-input="${CSS.escape(String(item.id))}"]`);
      if(!input)return;
      const answerState=(s.answers||[]).find(a=>String(a.id)===String(item.id));
      const originalState=(s.original_answers||[]).find(a=>String(a.id)===String(item.id));
      const original=String(originalState?.content||input.dataset.originalAnswer||answerState?.content||'');
      const changed=original!==String(item.content||'');
      anyChanged=anyChanged||changed;
      input.closest('.composer-answer')?.classList.toggle('is-customized',changed);
      const diff=card.querySelector(`[data-live-answer-diff="${CSS.escape(String(item.id))}"]`);
      if(diff)diff.innerHTML=changed?diffBlock(original,item.content,'Modifications par rapport à la réponse Me&YouToo'):'';
    });
    card.classList.toggle('has-customization',anyChanged);
    return anyChanged;
  }

  async function saveInlineSituation(id){
    if(!id)return;
    clearTimeout(autosaveTimers.get(String(id)));autosaveTimers.delete(String(id));
    const s=findSituation(id),card=document.querySelector(`[data-situation-card="${CSS.escape(String(id))}"]`);
    if(!s||!card)return;
    const situationInput=card.querySelector('[data-situation-input]');
    const answerInputs=[...card.querySelectorAll('[data-answer-input]')];
    const situationText=String(situationInput?.value||'').trim();
    const answers=answerInputs.map(input=>({id:Number(input.dataset.answerInput),content:String(input.value||'').trim()}));
    if(!situationText){setSaveStatus(card,'is-error','Non enregistré · le texte ne peut pas être vide');return;}
    if(answerInputs.some(input=>!String(input.value||'').trim())){setSaveStatus(card,'is-error','Non enregistré · une réponse est vide');return;}
    setSaveStatus(card,'is-saving','Enregistrement…');
    try{
      const saved=await api(`/api/projects/${projectId}/situations/${id}`,{method:'PATCH',body:JSON.stringify({customContent:situationText,customAnswers:answers})});
      if(!saved?.situation)throw new Error('La sauvegarde n’a pas été confirmée par le serveur.');
      const hasCustomization=refreshLiveDiff(card,s,situationText,answers);
      s.custom_content=saved.situation.custom_content;
      s.custom_answers=saved.situation.custom_answers;
      s.content=situationText;
      s.answers=(s.answers||[]).map(answer=>({...answer,content:answers.find(item=>String(item.id)===String(answer.id))?.content||answer.content}));
      s.has_customization=hasCustomization;
      setSaveStatus(card,'is-saved','Enregistré');
      const tags=card.querySelector('.composer-situation-tags');
      const customTag=tags?.querySelector('.composer-customized-tag');
      if(hasCustomization&&!customTag)tags?.insertAdjacentHTML('beforeend','<span class="composer-customized-tag">✎ Personnalisée</span>');
      if(!hasCustomization&&customTag)customTag.remove();
      if(hasCustomization&&!card.querySelector('[data-reset]')){
        const actions=card.querySelector('.composer-actions');
        if(actions)actions.insertAdjacentHTML('afterbegin',`<button class="button button-ghost" type="button" data-reset="${esc(id)}">↶ Annuler mes modifications</button>`);
        const reset=card.querySelector('[data-reset]');if(reset)reset.onclick=()=>resetSituationCustomization(id);
      }
    }catch(e){
      setSaveStatus(card,'is-error',`Non enregistré · ${e.message||'erreur serveur'}`);
    }
  }

  async function resetSituationCustomization(id){
    const s=findSituation(id);if(!s)return;
    const confirmed=await window.StudioModal.confirm({
      eyebrow:'Personnalisation',
      title:'Revenir à la version Me&YouToo ?',
      message:'Le texte de la mise en situation et les réponses retrouveront leur formulation d’origine. Le choix de cette situation dans votre diagnostic sera conservé.',
      type:'warning',
      cancelLabel:'Conserver mes modifications',
      confirmLabel:'Revenir à l’original'
    });
    if(!confirmed)return;
    try{
      await api(`/api/projects/${projectId}/situations/${id}`,{method:'PATCH',body:JSON.stringify({resetCustomizations:true})});
      const refreshed=await api(`/api/projects/${projectId}/composer`);
      state.project=refreshed.project;state.chapters=refreshed.chapters;render();
      showMessage('La formulation Me&YouToo d’origine a été restaurée.','success');
    }catch(e){showMessage(e.message);}
  }
  async function removeSituation(id){const ch=state.chapters[state.active],s=findSituation(id),linked=Boolean(s&&s.metadata&&s.metadata.link_group);const confirmed=await window.StudioModal.confirm({eyebrow:'Composition du diagnostic',title:linked?'Supprimer ces situations liées ?':'Supprimer cette situation ?',message:linked?'Cette situation fonctionne avec une autre mise en situation. Les deux seront retirées ensemble de ce chapitre. Cette action concerne uniquement ce brouillon.':'Cette mise en situation sera retirée de ce chapitre. Elle restera disponible dans le référentiel Me&YouToo.',type:'danger',cancelLabel:'Conserver',confirmLabel:linked?'Supprimer les situations':'Supprimer la situation'});if(!confirmed)return;try{const data=await api(`/api/projects/${projectId}/situations/${id}`,{method:'DELETE'});const deleted=new Set((data.deletedIds||[id]).map(String));ch.situations=ch.situations.filter(s=>!deleted.has(String(s.id)));render();showMessage(data.linked?'Les situations liées ont été supprimées ensemble.':'La situation a été supprimée du brouillon.','success');}catch(e){showMessage(e.message);}}

  function currentCatalogIds(){return new Set(state.chapters.flatMap(ch=>ch.situations).flatMap(s=>[String(s.catalog_situation_id||''),String(s.source_id||''),String(s.metadata?.duplicate_of_source_id||''),canonical(s.content)]).filter(Boolean));}
  async function openLibrary(mode='add',replaceId=''){
    const ch=state.chapters[state.active];state.libraryMode=mode;state.replaceId=replaceId;
    try{
      const data=await api(`/api/catalog/themes/${themeSlug}/library?chapterId=${encodeURIComponent(ch.catalog_chapter_id||ch.id)}&projectId=${encodeURIComponent(projectId)}`);
      const existing=currentCatalogIds();
      state.library=(data.situations||[]).filter(s=>![String(s.id||''),String(s.source_id||''),String(s.metadata?.duplicate_of_source_id||''),canonical(s.content)].filter(Boolean).some(k=>existing.has(k)));
      $('library-title').textContent=mode==='replace'?`Remplacer une situation · ${ch.title}`:`Ajouter une situation · ${ch.title}`;

      const seenGroups=new Set(),entries=[];
      for(const s of state.library){
        const group=s.metadata?.link_group||'';
        if(group&&seenGroups.has(group))continue;
        if(group)seenGroups.add(group);
        const members=group&&Array.isArray(s.linked_situations)&&s.linked_situations.length?s.linked_situations:[s];
        entries.push({primary:s,members});
      }

      $('library-list').innerHTML=entries.length?entries.map((entry,index)=>{
        const linked=entry.members.length>1;
        const label=linked?`${entry.members.length} situations liées · ${mode==='replace'?'remplacées':'ajoutées'} ensemble`:'Situation disponible';
        const body=entry.members.map((m,mi)=>`<section class="composer-library-linked-item">${linked?`<div class="composer-library-linked-title">Situation ${mi+1}/${entry.members.length}</div>`:''}<h3>${esc(m.content)}</h3><details><summary>Consulter les réponses et les scores</summary>${(m.answers||[]).map(a=>answerHtml(a,false,'')).join('')}</details></section>`).join('');
        return `<article class="composer-library-card composer-library-bundle tone-${index%4+1}"><div class="composer-library-number">${String(index+1).padStart(2,'0')}</div><div class="composer-library-content"><div class="composer-library-label">${label}</div>${body}<button class="button button-primary" type="button" data-library-pick="${esc(entry.primary.id)}">${mode==='replace'?(linked?`Remplacer par ces ${entry.members.length} situations`:'Remplacer par cette situation'):(linked?`Ajouter les ${entry.members.length} situations au chapitre`:'Ajouter au chapitre')}</button></div></article>`;
      }).join(''):'<div class="composer-library-empty"><strong>Aucune autre situation disponible</strong><p>Les situations déjà présentes dans ce chapitre ne sont pas proposées ici.</p></div>';

      $('library-backdrop').hidden=false;$('library-drawer').classList.add('is-open');$('library-drawer').setAttribute('aria-hidden','false');
      document.querySelectorAll('[data-library-pick]').forEach(b=>b.onclick=()=>mode==='replace'?replaceSituation(replaceId,b.dataset.libraryPick):addSituation(b.dataset.libraryPick));
    }catch(e){showMessage(e.message);}
  }
  function closeLibrary(){$('library-backdrop').hidden=true;$('library-drawer').classList.remove('is-open');$('library-drawer').setAttribute('aria-hidden','true');}
  async function addSituation(catalogSituationId){
    const ch=state.chapters[state.active],status=chapterCountStatus(ch);
    if(status.atMax){
      showMessage(`Ce chapitre est limitée à ${status.rules.max} situations maximum.`);
      return;
    }
    try{
      const data=await api(`/api/projects/${projectId}/chapters/${ch.id}/situations`,{method:'POST',body:JSON.stringify({catalogSituationId:Number(catalogSituationId)})});
      const added=(data.situations||[data.situation]).filter(Boolean);
      if(status.rules.max!=null&&ch.situations.length+added.length>status.rules.max){
        showMessage(`Cette sélection dépasserait le maximum de ${status.rules.max} situations.`);
        return;
      }
      ch.situations.push(...added);
      closeLibrary();render();
      showMessage(data.linked?'Les situations liées ont été ajoutées et enregistrées ensemble.':'La situation a été ajoutée et enregistrée dans le brouillon.','success');
    }catch(e){showMessage(e.message);}
  }
  async function replaceSituation(projectSituationId,catalogSituationId){try{const data=await api(`/api/projects/${projectId}/situations/${projectSituationId}/replace`,{method:'PATCH',body:JSON.stringify({catalogSituationId:Number(catalogSituationId)})});closeLibrary();const refreshed=await api(`/api/projects/${projectId}/composer`);state.project=refreshed.project;state.chapters=refreshed.chapters;render();showMessage(data.linked?'La sélection liée a été remplacée et enregistrée ensemble.':'La situation a été remplacée et enregistrée.','success');}catch(e){showMessage(e.message);}}

  function render(){
    const ch=state.chapters[state.active];if(!ch)return;
    const stereotypes=isStereotypesChapter(ch),status=chapterCountStatus(ch);
    $('chapter-kicker').textContent=`Chapitre ${state.active+1} · Questions`;
    $('chapter-title').textContent=ch.title;
    $('chapter-desc').textContent=ch.locked
      ?(ch.lock_reason||'Ce chapitre méthodologique est obligatoire et non modifiable.')
      :status.rules.min!=null
        ?`${status.count} situation${status.count>1?'s':''} retenue${status.count>1?'s':''} · ${status.rules.min} minimum et ${status.rules.max} maximum dans ce chapitre.`
        :`${status.count} situations retenues · consultez les réponses et scores avant de modifier votre sélection.`;

    const libraryButton=$('library-button');
    libraryButton.hidden=Boolean(ch.locked||stereotypes||state.project?.can_edit===false);
    if(!libraryButton.hidden){
      libraryButton.classList.toggle('is-disabled',status.atMax);
      libraryButton.setAttribute('aria-disabled',String(status.atMax));
      libraryButton.title=status.atMax?`Maximum de ${status.rules.max} situations atteint`:'';
    }

    $('legal-scoring-note').hidden=!isLegalChapter(ch);
    $('situation-list').innerHTML=ch.situations.map(situationHtml).join('');
    $('sticky-part-label').textContent=`Chapitre ${state.active+1}/${state.chapters.length} · ${ch.title}`;

    const next=$('composer-next');
    if(next){
      next.href=`personnalisation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${state.active}`;
      const blocked=status.below||status.above;
      next.classList.toggle('is-disabled',blocked);
      next.setAttribute('aria-disabled',String(blocked));
      next.onclick=blocked?async(event)=>{event.preventDefault();await showIncompleteChapterModal(state.active);}:null;
    }
    renderNav();bindSituations();
  }

  async function ensureProject(){if(projectId)return;const project=await window.StudioProject.createNew(themeSlug);projectId=String(project.id);location.replace(`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}`);throw new Error('redirect');}
  async function load(){try{await ensureProject();const data=await api(`/api/projects/${projectId}/composer`);state.project=data.project;state.chapters=data.chapters;state.active=Math.min(state.active,Math.max(0,state.chapters.length-1));$('catalog-title').textContent=data.project.theme_title;const themeBack=$('composer-theme-back');if(themeBack)themeBack.href=data.project.review_mode?`validation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}`:`theme-${themeSlug}.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}`;if(data.project.can_edit)await saveStep('composer');render();if(data.project.review_mode)showMessage('✎ Correction Me&YouToo active : vous pouvez modifier les situations. La version transmise par le client reste conservée pour comparaison.','success');else if(!data.project.can_edit)showMessage('Configuration verrouillée pendant la relecture Me&YouToo.','success');}catch(e){if(e.message==='redirect')return;showMessage(`Impossible de charger le brouillon : ${e.message}`);$('chapter-title').textContent='Brouillon indisponible';}}

  $('library-button').onclick=async()=>{
    const status=chapterCountStatus(state.chapters[state.active]);
    if(status.atMax){
      await window.StudioModal.confirm({
        eyebrow:'Composition du diagnostic',
        title:`Maximum de ${status.rules.max} situations atteint`,
        message:`Vous avez déjà ${status.rules.max} situations dans ce chapitre. Supprimez-en une avant d’en ajouter une autre depuis la bibliothèque.`,
        type:'warning',
        cancelLabel:'Fermer',
        confirmLabel:'Compris'
      });
      return;
    }
    openLibrary('add');
  };
  $('library-close').onclick=closeLibrary;$('library-backdrop').onclick=closeLibrary;
  document.body.classList.add('sidebar-collapsed');
  const collapseButton=document.querySelector('[data-sidebar-collapse]');if(collapseButton){collapseButton.setAttribute('aria-expanded','false');collapseButton.setAttribute('aria-label','Déployer le menu');collapseButton.setAttribute('title','Déployer le menu');}
  load();
})();
