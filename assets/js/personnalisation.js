(()=>{
  const p=new URLSearchParams(location.search),theme=p.get('theme')||'',projectId=p.get('projectId')||'',requestedProfile=p.get('profile')||'';let active=Math.max(0,Number(p.get('chapter')||0)),chapters=[],project=null;const translationContexts=new Map();
  const api=(url,opt={})=>window.StudioAPI.request(url,opt),$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isReadOnly=()=>Boolean(project&&project.can_edit===false);
  const colorRank=color=>{const c=String(color||'').toLowerCase();if(c.includes('ff847')||c.includes('ff84')||c.includes('b423')||c.includes('red'))return 0;if(c.includes('ffc')||c.includes('yellow'))return 1;if(c.includes('77cd')||c.includes('green'))return 2;return 3;};
  const q=chapter=>`?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&chapter=${chapter}`;
  const canonical=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const localeNames={fr:'Français',en:'Anglais',es:'Espagnol',de:'Allemand',it:'Italien',pt:'Portugais',br:'Portugais Brésil',ja:'Japonais','ko-kr':'Coréen',zf:'Chinois simplifié',zh:'Chinois traditionnel',bg:'Bulgare',nl:'Néerlandais','nl-be':'Néerlandais Belgique',pl:'Polonais',ro:'Roumain',ru:'Russe','sv-se':'Suédois',tr:'Turc',cs:'Tchèque',sk:'Slovaque',id:'Indonésien'};
  const localeLabel=loc=>`${localeNames[String(loc).toLowerCase()]||String(loc).toUpperCase()} (${String(loc).toUpperCase()})`;
  const countryNames={AR:'Argentine',AT:'Autriche',BR:'Brésil',CA:'Canada',CH:'Suisse',CL:'Chili',CN:'Chine',DE:'Allemagne',DK:'Danemark',ES:'Espagne',FR:'France',HK:'Hong Kong',JP:'Japon',KR:'Corée du Sud',MX:'Mexique',NO:'Norvège',PA:'Panama',PT:'Portugal',SE:'Suède',TW:'Taïwan',US:'États-Unis',UY:'Uruguay'};
  const countryLabel=code=>countryNames[String(code||'').toUpperCase()]||String(code||'').toUpperCase();
  const infoDot=text=>`<span class="profile-info-wrap"><button class="profile-info-dot" type="button" aria-label="Information" title="${esc(text)}">i</button><span class="profile-info-bubble" role="tooltip">${esc(text)}</span></span>`;
  const profileFieldChanged=(value,original)=>original!==undefined&&original!==null&&String(value??'')!==String(original??'');
  function wordDiffHtml(original,current){
    const a=String(original||'').split(/(\s+|[.,;:!?\'"()«»–—-])/).filter(Boolean),b=String(current||'').split(/(\s+|[.,;:!?\'"()«»–—-])/).filter(Boolean);
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
  function profileDiffBlock(original,current){
    if(!profileFieldChanged(current,original))return '';
    return `<div class="composer-diff"><div class="composer-diff-label">Modifications par rapport au profil Me&YouToo</div><div class="composer-diff-text">${wordDiffHtml(original,current)}</div></div>`;
  }
  function projectCountries(){return [...new Set((Array.isArray(project?.country_codes)?project.country_codes:[]).concat(Array.isArray(project?.countries)?project.countries:[]).map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))];}
  function projectLocales(){return [...new Set((Array.isArray(project?.locales)?project.locales:[]).concat(project?.selected_locale?[project.selected_locale]:[]).map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];}
  function renderProfilesContext(){const root=$('profiles-context');if(!root)return;const countries=projectCountries(),locales=projectLocales();root.innerHTML=`<div class="profiles-context-head"><div><strong>Votre campagne</strong>${infoDot('Les questions ont été composées selon les périmètres sélectionnés. Les profils, eux, sont communs à tous les périmètres : seule leur version linguistique varie.')}</div><span class="profiles-common-badge">Profils communs à tous les périmètres</span></div><div class="profiles-context-grid"><div><span>Périmètres composés</span><div class="theme-availability-pills">${countries.length?countries.map(c=>`<span class="theme-availability-pill is-scope">${esc(countryLabel(c))}</span>`).join(''):'<em>Aucun périmètre renseigné</em>'}</div></div><div><span>Langues actives</span><div class="theme-availability-pills">${locales.length?locales.map(l=>`<span class="theme-availability-pill is-language">${esc(localeLabel(l))}</span>`).join(''):'<em>Aucune langue renseignée</em>'}</div></div></div><p class="profiles-context-note"><strong>À retenir :</strong> vous ne recréez pas les profils par pays. Vous personnalisez un seul socle de 3 profils par chapitre, puis vous vérifiez leurs traductions et adaptations linguistiques.</p>`;root.hidden=false;}
  const isStereotypes=ch=>theme==='sexisme'&&canonical(ch?.slug||ch?.title).includes('stereotype');
  const isAggression=ch=>canonical(ch?.slug||ch?.title).includes('agression sexuelle');
  const isHostile=ch=>theme==='sexisme'&&canonical(ch?.slug||ch?.title).includes('sexisme hostile');
  const rules=ch=>isStereotypes(ch)?{min:null,max:null}:{min:isAggression(ch)||isHostile(ch)?4:5,max:8};
  const status=ch=>{const r=rules(ch),count=(ch?.situations||[]).length;return {rules:r,count,valid:(r.min==null||count>=r.min)&&(r.max==null||count<=r.max)};};
  function firstInvalidIndex(limit=chapters.length-1){for(let i=0;i<=Math.min(limit,chapters.length-1);i++)if(!status(chapters[i]).valid)return i;return -1;}
  async function incompleteModal(index,title){
    if(isReadOnly())return;
    const ch=chapters[index],st=status(ch);
    const msg=st.rules.min!=null&&st.count<st.rules.min?`${st.rules.min} situations minimum sont nécessaires. Ce chapitre en contient ${st.count}.`:`Ce chapitre dépasse le maximum de ${st.rules.max} situations.`;
    const go=await window.StudioModal.confirm({eyebrow:'Composition du diagnostic',title:title||'Partie incomplète',message:`${ch.title} : ${msg}`,type:'info',cancelLabel:'Rester ici',confirmLabel:'Compléter ce chapitre'});
    if(go)location.href='composer.html'+q(index);
  }
  function card(ch,pr,pi){
    const ro=isReadOnly();
    const originalTitle=pr.original_title??pr.title,originalSummary=pr.original_summary??pr.summary,originalContent=pr.original_content??pr.content;
    return `<article class="profile-excel-card" ${ro?'style="background:var(--royal-blue-tint);border-color:var(--line)"':''}><div class="profile-excel-head"><div><small>Profil ${pi+1}/3 · socle commun ${infoDot('Ce profil est le même pour tous les périmètres de la campagne. Seule sa version linguistique peut varier.')}</small><h3>${esc(pr.title)}</h3></div><span class="profile-color" style="background:${esc(pr.color)}"></span></div>${ro?'<div class="composer-lock-chip" style="margin-bottom:12px">🔒 Lecture seule</div>':''}<div class="field"><label>Titre du profil ${infoDot('Le titre appartient au profil commun. Si vous le modifiez, pensez à vérifier les autres langues actives.')}</label><input data-profile-title="${pr.id}" data-original-profile="${esc(originalTitle)}" value="${esc(pr.title)}" ${ro?'readonly aria-readonly="true" tabindex="-1" style="background:var(--surface-soft);pointer-events:none"':''}><div data-live-profile-diff="title:${esc(pr.id)}">${profileDiffBlock(originalTitle,pr.title)}</div></div><div class="field"><label>Résumé du profil ${infoDot('Le résumé est commun à tous les périmètres. Les traductions se gèrent séparément dans le bouton dédié.')}</label><textarea rows="4" data-profile-summary="${pr.id}" data-original-profile="${esc(originalSummary)}" ${ro?'readonly aria-readonly="true" tabindex="-1" style="background:var(--surface-soft);pointer-events:none"':''}>${esc(pr.summary)}</textarea><div data-live-profile-diff="summary:${esc(pr.id)}">${profileDiffBlock(originalSummary,pr.summary)}</div></div><div class="field"><label>Contenu détaillé du profil ${infoDot('La description détaillée est le socle métier commun du profil. Seule la langue varie selon les langues activées dans la campagne.')}</label><textarea rows="10" data-profile-content="${pr.id}" data-original-profile="${esc(originalContent)}" ${ro?'readonly aria-readonly="true" tabindex="-1" style="background:var(--surface-soft);pointer-events:none"':''}>${esc(pr.content)}</textarea><div data-live-profile-diff="content:${esc(pr.id)}">${profileDiffBlock(originalContent,pr.content)}</div></div><div class="profile-method"><div class="profile-method-main"><span class="profile-method-label">Seuil de restitution</span><strong class="profile-method-range">${pr.scoring_min} → ${pr.scoring_max}</strong><span class="profile-method-lock">Non modifiable</span></div>${infoDot('Les seuils et la logique de scoring sont identiques pour tous les périmètres et ne sont pas modifiables par le client.')}</div><div class="composer-translation-row"><button class="button button-ghost composer-translation-button" type="button" data-profile-translations="${pr.id}" hidden>🌐 Traduction et adaptation locale éventuelle</button>${infoDot('Ouvrez ici les versions linguistiques du même profil : titre, résumé et description détaillée.')}</div></article>`;
  }

  async function getProfileTranslationContext(id,refresh=false){if(!refresh&&translationContexts.has(String(id)))return translationContexts.get(String(id));const ctx=await api(`/api/projects/${projectId}/profiles/${id}/translations`);translationContexts.set(String(id),ctx);return ctx;}
  async function openProfileTranslationModal(id){
    const ctx=await getProfileTranslationContext(id,true),referenceLocale=ctx.referenceLocale||ctx.locales?.[0]||'fr',reference=ctx.reference||{},targets=(ctx.locales||[]).filter(x=>x!==referenceLocale);if(!targets.length)return;
    const overlay=document.createElement('div');overlay.className='translation-overlay';overlay.innerHTML=`<section class="translation-modal" role="dialog" aria-modal="true"><header class="translation-head"><div><small>TRADUCTION ET ADAPTATION LOCALE ÉVENTUELLE DU PROFIL</small><h2>Comparer avec la langue de référence</h2></div><button class="translation-close" type="button" aria-label="Fermer">×</button></header><div class="translation-toolbar"><strong>Langue / adaptation à vérifier</strong><select data-translation-locale>${targets.map(l=>`<option value="${esc(l)}">${esc(localeLabel(l))}</option>`).join('')}</select></div><div class="profile-modal-context"><strong>Profil commun à tous les périmètres.</strong> Vous vérifiez ici uniquement sa version linguistique : titre, résumé et description détaillée.</div><div class="translation-grid"><section class="translation-pane reference" data-reference-pane></section><section class="translation-pane" data-target-pane></section></div><footer class="translation-foot"><button class="button button-ghost" type="button" data-cancel>Annuler</button><button class="button button-primary" type="button" data-save>Enregistrer et fermer</button></footer></section>`;document.body.appendChild(overlay);
    const close=()=>overlay.remove(),select=overlay.querySelector('[data-translation-locale]'),referencePane=overlay.querySelector('[data-reference-pane]'),target=overlay.querySelector('[data-target-pane]');overlay.querySelector('.translation-close').onclick=close;overlay.querySelector('[data-cancel]').onclick=close;
    function draw(){const loc=select.value,t=ctx.translations?.[loc]||{};const missing=!t.title||!t.summary||!t.content;referencePane.innerHTML=`<h3>${esc(localeLabel(referenceLocale))} · référence</h3><div class="translation-profile-block"><strong>Titre</strong><div class="translation-reference-text">${esc(reference.title||'')}</div><strong>Résumé</strong><div class="translation-reference-text">${esc(reference.summary||'')}</div><strong>Description détaillée</strong><div class="translation-reference-text">${esc(reference.content||'')}</div></div>`;target.innerHTML=`<h3>${esc(localeLabel(loc))}<span class="translation-status ${missing?'is-incomplete':''}">${ctx.sourceCustomized?'À vérifier':missing?'Traduction incomplète':t.status==='client_version'?'Personnalisée':'Traduction Me&YouToo'}</span></h3>${ctx.sourceCustomized?`<div class="translation-sync-warning">⚠️ Le profil dans la langue de référence ${esc(localeLabel(referenceLocale))} a été modifié. Vérifiez les trois champs de cette version locale.</div>`:''}<div class="translation-local-note">Modifier cette version n’actualise pas automatiquement les autres langues.</div><label class="translation-profile-field"><strong>Titre</strong><input data-profile-target-title value="${esc(t.title||'')}" placeholder="Titre à compléter"></label><label class="translation-profile-field"><strong>Résumé</strong><textarea rows="4" data-profile-target-summary placeholder="Résumé à compléter">${esc(t.summary||'')}</textarea></label><label class="translation-profile-field"><strong>Description détaillée</strong><textarea rows="8" data-profile-target-content placeholder="Description à compléter">${esc(t.content||'')}</textarea></label>`;}
    select.onchange=draw;draw();overlay.querySelector('[data-save]').onclick=async()=>{const loc=select.value,payload={title:target.querySelector('[data-profile-target-title]').value.trim(),summary:target.querySelector('[data-profile-target-summary]').value.trim(),content:target.querySelector('[data-profile-target-content]').value.trim()};try{await api(`/api/projects/${projectId}/profiles/${id}/translations/${encodeURIComponent(loc)}`,{method:'PATCH',body:JSON.stringify(payload)});translationContexts.delete(String(id));close();const a=$('profiles-alert');a.hidden=false;a.dataset.tone='success';a.textContent=`${localeLabel(loc)} · traduction et adaptation locale enregistrée.`;}catch(e){await window.StudioModal.alert({title:'Traduction non enregistrée',message:e.message,type:'error'});}};
  }

  function renderNav(){
    $('profiles-catalog-summary').textContent=`${chapters.length} chapitres · Questions et profils réunis dans un même parcours`;
    $('profiles-chapter-nav').innerHTML=chapters.map((ch,i)=>{
      const st=status(ch),blocking=isReadOnly()?-1:firstInvalidIndex(i),blocked=blocking!==-1;
      return `<article class="creation-chapter-item ${i===active?'is-active':''} ${!st.valid&&!isReadOnly()?'is-incomplete':''}"><div class="creation-chapter-head"><span><small>Chapitre ${i+1}</small>${esc(ch.title)}</span><strong>${!st.valid&&!isReadOnly()&&st.rules.min!=null?`${st.count}/${st.rules.min} situations`:`${(ch.profiles||[]).length}/3`}</strong></div><div class="creation-chapter-tabs"><a href="composer.html${q(i)}">Questions</a><button class="${i===active?'is-active':''} ${blocked?'is-disabled':''}" data-profile-chapter="${i}" data-blocking-chapter="${blocking}" aria-disabled="${blocked}" type="button">Profils</button></div></article>`;
    }).join('');
    document.querySelectorAll('[data-profile-chapter]').forEach(button=>button.onclick=async()=>{const blocking=Number(button.dataset.blockingChapter);if(blocking>=0){await incompleteModal(blocking,'Complétez d’abord les situations');return;}active=Number(button.dataset.profileChapter);history.replaceState(null,'',`personnalisation.html${q(active)}`);render();window.scrollTo({top:0,behavior:'smooth'});});
  }
  function render(){
    const ch=chapters[active];if(!ch)return;const profiles=[...(ch.profiles||[])].sort((a,b)=>colorRank(a.color)-colorRank(b.color));
    $('profile-chapter-kicker').textContent=`Chapitre ${active+1} · Profils`;
    $('profile-chapter-title').textContent=ch.title;
    $('profile-chapter-desc').textContent=isReadOnly()?'Profils enregistrés pour cette campagne · consultation en lecture seule.':'Les trois profils de ce chapitre sont communs à tous les périmètres de la campagne. Seules leurs versions linguistiques varient.';
    renderProfilesContext();
    $('profiles-root').innerHTML=`<div class="profile-excel-grid">${profiles.map((pr,pi)=>card(ch,pr,pi)).join('')}</div>`;
    $('profile-sticky-label').textContent=`Chapitre ${active+1}/${chapters.length} · ${ch.title}`;
    const stickyPreviewReady=!project?.review_mode&&!isReadOnly()&&active===chapters.length-1&&firstInvalidIndex()===-1;
    document.body.classList.toggle('rp-sticky-preview-enabled',stickyPreviewReady);
    document.dispatchEvent(new CustomEvent('studio:preview-layout-changed'));
    $('back-link').href='composer.html'+q(active);$('questions-step').href='composer.html'+q(active);
    if(project?.review_mode){
      const reviewUrl=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;
      $('back-link').href=reviewUrl;$('back-link').textContent='← Retour au contrôle qualité';
      const next=$('next-link');next.href=reviewUrl;next.textContent='Enregistrer et revenir au contrôle qualité →';next.classList.remove('is-disabled');next.setAttribute('aria-disabled','false');next.onclick=async event=>{event.preventDefault();next.setAttribute('aria-busy','true');next.textContent='Enregistrement…';try{await saveAllProfiles();location.href=reviewUrl;}catch(error){next.removeAttribute('aria-busy');next.textContent='Enregistrer et revenir au contrôle qualité →';await window.StudioModal.alert({title:'Modification non enregistrée',message:error.message,type:'error'});}};
    }else if(isReadOnly()){
      const alert=$('profiles-alert');alert.hidden=false;alert.dataset.tone='success';alert.innerHTML='<strong>🔒 Profils en lecture seule.</strong> Cette campagne a déjà été transmise. <button class="button button-secondary button-small" type="button" data-content-adjustment="profile">Demander un ajustement</button>';
      const next=$('next-link');next.href=`parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;next.textContent='Revoir le paramétrage →';next.classList.remove('is-disabled');next.setAttribute('aria-disabled','false');next.onclick=null;
    }else{
      const next=$('next-link');
      if(active<chapters.length-1){
        const blocking=firstInvalidIndex(active);next.href='composer.html'+q(active+1);next.textContent=`Questions du chapitre ${active+2} →`;next.classList.toggle('is-disabled',blocking!==-1);next.setAttribute('aria-disabled',String(blocking!==-1));next.onclick=blocking!==-1?async e=>{e.preventDefault();await incompleteModal(blocking,'Complétez ce chapitre avant de poursuivre');}:null;
      }else{
        const blocking=firstInvalidIndex();next.href=`parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;next.textContent='Toutes les parties terminées · Paramétrer →';next.classList.toggle('is-disabled',blocking!==-1);next.setAttribute('aria-disabled',String(blocking!==-1));next.onclick=blocking!==-1?async e=>{e.preventDefault();await incompleteModal(blocking,'Toutes les parties ne sont pas terminées');}:null;
      }
    }
    renderNav();bind();if(requestedProfile){requestAnimationFrame(()=>{const field=document.querySelector(`[data-profile-title="${CSS.escape(String(requestedProfile))}"],[data-profile-summary="${CSS.escape(String(requestedProfile))}"],[data-profile-content="${CSS.escape(String(requestedProfile))}"]`);const card=field?.closest('.profile-excel-card');if(card){card.classList.add('review-direct-target');card.scrollIntoView({behavior:'smooth',block:'center'});field.focus({preventScroll:true});}});}
  }
  async function saveAllProfiles(){
    const fields=[...document.querySelectorAll('[data-profile-title],[data-profile-summary],[data-profile-content]')],byProfile=new Map();
    fields.forEach(field=>{const id=field.dataset.profileTitle||field.dataset.profileSummary||field.dataset.profileContent;if(!byProfile.has(id))byProfile.set(id,{});const values=byProfile.get(id);if(field.dataset.profileTitle)values.title=field.value;if(field.dataset.profileSummary)values.summary=field.value;if(field.dataset.profileContent)values.content=field.value;});
    await Promise.all([...byProfile].map(([id,values])=>api(`/api/projects/${projectId}/profiles/${id}`,{method:'PATCH',body:JSON.stringify(values)})));
  }
  async function load(){try{
    if(!theme&&projectId){const d=await api(`/api/projects/${projectId}/composer`);project=d.project;theme=project?.theme_slug||'';chapters=d.chapters||[];}else{
      if(!projectId){if(!theme)throw new Error('Thématique manquante.');location.replace(`theme-${encodeURIComponent(theme)}.html?theme=${encodeURIComponent(theme)}`);return;}
      const d=await api(`/api/projects/${projectId}/composer`);project=d.project;chapters=d.chapters||[];
    }
    active=Math.min(active,Math.max(0,chapters.length-1));if(chapters.some(ch=>(ch.profiles||[]).length!==3))throw new Error('Le référentiel doit contenir exactement 3 profils par partie.');
    const blocking=firstInvalidIndex(active);if(!isReadOnly()&&blocking!==-1){await incompleteModal(blocking,'Complétez les situations avant de personnaliser les profils');if(location.pathname.includes('personnalisation.html'))location.replace('composer.html'+q(blocking));return;}
    $('theme-name').textContent=project?.theme_title||'Autodiagnostic';$('profiles-catalog-title').textContent=project?.theme_title||'Autodiagnostic';
    if(project?.review_mode){const alert=$('profiles-alert');alert.hidden=false;alert.dataset.tone='success';alert.innerHTML='<strong>✎ Correction Me&YouToo active.</strong> Vous pouvez modifier les profils. Les changements sont enregistrés dans la version Me&YouToo et la version transmise par le client reste conservée.';}
    if(!isReadOnly())await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:'personnalisation'})});
    render();
  }catch(e){$('profiles-alert').hidden=false;$('profiles-alert').textContent=e.message;}}
  function bind(){
    if(isReadOnly())return;
    document.querySelectorAll('[data-profile-title],[data-profile-summary],[data-profile-content]').forEach(el=>{
      const id=el.dataset.profileTitle||el.dataset.profileSummary||el.dataset.profileContent,key=el.dataset.profileTitle?'title':el.dataset.profileSummary?'summary':'content';
      const diffKey=`${key}:${id}`;
      const updateDiff=()=>{const target=document.querySelector(`[data-live-profile-diff="${CSS.escape(diffKey)}"]`);if(target)target.innerHTML=profileDiffBlock(el.dataset.originalProfile,el.value);};
      el.addEventListener('input',updateDiff);
      el.addEventListener('change',async()=>{try{await api(`/api/projects/${projectId}/profiles/${id}`,{method:'PATCH',body:JSON.stringify({[key]:el.value})});translationContexts.delete(String(id));const btn=document.querySelector(`[data-profile-translations="${CSS.escape(String(id))}"]`);if(btn&&!btn.hidden&&!btn.parentElement.querySelector('.translation-inline-warning')){btn.insertAdjacentHTML('afterend','<span class="translation-inline-warning">⚠ Traductions et adaptations locales à vérifier après modification de la langue de référence</span>');}}catch(e){await window.StudioModal.alert({eyebrow:'Enregistrement du profil',title:'Modification non enregistrée',message:e.message,type:'error',confirmLabel:'J’ai compris'});}});
    });
    document.querySelectorAll('[data-profile-translations]').forEach(async b=>{const id=b.dataset.profileTranslations;try{const ctx=await getProfileTranslationContext(id);if((ctx.locales||[]).filter(x=>x!==ctx.referenceLocale).length){b.hidden=false;b.onclick=()=>openProfileTranslationModal(id);}}catch(_){b.hidden=true;}});
  }
  document.body.classList.add('sidebar-collapsed');const collapseButton=document.querySelector('[data-sidebar-collapse]');if(collapseButton){collapseButton.setAttribute('aria-expanded','false');collapseButton.setAttribute('aria-label','Déployer le menu');collapseButton.setAttribute('title','Déployer le menu');}load();
})();
