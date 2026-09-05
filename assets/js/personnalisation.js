(()=>{
  const p=new URLSearchParams(location.search),theme=p.get('theme')||'',projectId=p.get('projectId')||'',requestedProfile=p.get('profile')||'';let active=Math.max(0,Number(p.get('chapter')||0)),chapters=[],project=null;
  const api=(url,opt={})=>window.StudioAPI.request(url,opt),$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isReadOnly=()=>Boolean(project&&project.can_edit===false);
  const colorRank=color=>{const c=String(color||'').toLowerCase();if(c.includes('ff847')||c.includes('ff84')||c.includes('b423')||c.includes('red'))return 0;if(c.includes('ffc')||c.includes('yellow'))return 1;if(c.includes('77cd')||c.includes('green'))return 2;return 3;};
  const q=chapter=>`?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&chapter=${chapter}`;
  const canonical=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
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
    return `<article class="profile-excel-card" ${ro?'style="background:var(--royal-blue-tint);border-color:var(--line)"':''}><div class="profile-excel-head"><div><small>Profil ${pi+1}/3</small><h3>${esc(pr.title)}</h3></div><span class="profile-color" style="background:${esc(pr.color)}"></span></div>${ro?'<div class="composer-lock-chip" style="margin-bottom:12px">🔒 Lecture seule</div>':''}<div class="field"><label>Titre du profil</label><input data-profile-title="${pr.id}" value="${esc(pr.title)}" ${ro?'readonly aria-readonly="true" tabindex="-1" style="background:var(--surface-soft);pointer-events:none"':''}></div><div class="field"><label>Résumé du profil</label><textarea rows="4" data-profile-summary="${pr.id}" ${ro?'readonly aria-readonly="true" tabindex="-1" style="background:var(--surface-soft);pointer-events:none"':''}>${esc(pr.summary)}</textarea></div><div class="field"><label>Contenu détaillé du profil</label><textarea rows="10" data-profile-content="${pr.id}" ${ro?'readonly aria-readonly="true" tabindex="-1" style="background:var(--surface-soft);pointer-events:none"':''}>${esc(pr.content)}</textarea></div><div class="profile-method"><strong>Seuil :</strong> ${pr.scoring_min} → ${pr.scoring_max} · non modifiable</div></article>`;
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
    $('profile-chapter-desc').textContent=isReadOnly()?'Profils enregistrés pour cette campagne · consultation en lecture seule.':active===chapters.length-1?'Le scoring de cette dernière partie est volontairement plus strict lorsque les situations comportent des enjeux liés à la loi.':'Personnalisez les trois profils issus du référentiel Me&YouToo.';
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
    document.querySelectorAll('[data-profile-title],[data-profile-summary],[data-profile-content]').forEach(el=>el.addEventListener('change',async()=>{const id=el.dataset.profileTitle||el.dataset.profileSummary||el.dataset.profileContent,key=el.dataset.profileTitle?'title':el.dataset.profileSummary?'summary':'content';try{await api(`/api/projects/${projectId}/profiles/${id}`,{method:'PATCH',body:JSON.stringify({[key]:el.value})});}catch(e){await window.StudioModal.alert({eyebrow:'Enregistrement du profil',title:'Modification non enregistrée',message:e.message,type:'error',confirmLabel:'J’ai compris'});}}));
  }
  document.body.classList.add('sidebar-collapsed');const collapseButton=document.querySelector('[data-sidebar-collapse]');if(collapseButton){collapseButton.setAttribute('aria-expanded','false');collapseButton.setAttribute('aria-label','Déployer le menu');collapseButton.setAttribute('title','Déployer le menu');}load();
})();
