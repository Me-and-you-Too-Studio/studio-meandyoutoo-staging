(()=>{
  const p=new URLSearchParams(location.search);let theme=p.get('theme')||'',projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt),$=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain=value=>{const html=String(value??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>\s*<p[^>]*>/gi,'\n\n');const box=document.createElement('div');box.innerHTML=html;return (box.textContent||'').replace(/\u00a0/g,' ').replace(/\n{3,}/g,'\n\n').trim();};
  function wordDiff(before,after,admin=false){
    if(plain(before).length*plain(after).length>4000000)return `<del>${esc(plain(before))}</del><ins class="${admin?'is-admin':''}">${esc(plain(after))}</ins>`;
    const a=plain(before).split(/(\s+|[.,;:!?\"'()«»–—-])/).filter(Boolean),b=plain(after).split(/(\s+|[.,;:!?\"'()«»–—-])/).filter(Boolean),n=a.length,m=b.length,dp=Array.from({length:n+1},()=>Array(m+1).fill(0));
    for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
    let i=0,j=0,out='';while(i<n||j<m){if(i<n&&j<m&&a[i]===b[j]){out+=esc(a[i]);i++;j++;}else if(j<m&&(i===n||dp[i][j+1]>=(dp[i+1]?.[j]||0))){out+=`<ins class="${admin?'is-admin':''}">${esc(b[j])}</ins>`;j++;}else{out+=`<del>${esc(a[i])}</del>`;i++;}}return out;
  }
  function readableWordDiff(before,after,admin=false){
    const diff=wordDiff(before,after,admin),current=diff.replace(/<del>[\s\S]*?<\/del>/g,''),previous=diff.replace(/<ins\b[^>]*>[\s\S]*?<\/ins>/g,'');
    return `<div class="review-diff-current" style="white-space:pre-wrap">${current||'—'}</div>${diff.includes('<del>')?`<details class="review-removed-text"><summary>Voir les passages supprimés du texte précédent</summary><div style="white-space:pre-wrap">${previous}</div></details>`:''}`;
  }
  const reviewLocale=locale=>String(locale||'').trim().toLowerCase().replaceAll('_','-');
  const reviewLocaleNames={fr:'Français',en:'Anglais',es:'Espagnol',it:'Italien',de:'Allemand',nl:'Néerlandais',br:'Portugais (Brésil)',pt:'Portugais','nl-be':'Néerlandais (Belgique)',ar:'Arabe',sk:'Slovaque',pl:'Polonais',ro:'Roumain',ja:'Japonais','ko-kr':'Coréen',zf:'Chinois traditionnel',zh:'Chinois',ru:'Russe',tr:'Turc',bg:'Bulgare','sv-se':'Suédois'};
  function reviewLocaleValue(map,locale){const key=Object.keys(map||{}).find(key=>reviewLocale(key)===locale);return key===undefined?undefined:map[key];}
  function cloneReviewContext(project){
    const isClone=['cloned_legacy','cloned_studio'].includes(project.legacy_source)||Boolean(project.legacy_payload?.clonedFromProjectId);
    const saved=project.legacy_payload?.cloneReviewBaseline;
    const baseline=isClone&&saved?.version===1&&String(saved.project_id)===String(project.id)&&saved.project&&Array.isArray(saved.chapters)?saved:null;
    return {isClone,baseline};
  }
  function introReviewVersions(project){
    const saved=project.review_snapshot?.project||{},configured=Array.isArray(project.locales)?project.locales:[];
    const mapped=Object.values(project.country_locales||{}).flat().filter(x=>typeof x==='string');
    const locales=[...new Set((configured.length?configured:mapped.length?mapped:[project.selected_locale||'fr']).map(reviewLocale).filter(Boolean))];
    const value=(data,locale)=>reviewLocaleValue(data.introduction_variants,locale)??reviewLocaleValue(data.introduction_variants_resolved,locale)??(locale===reviewLocale(data.selected_locale||data.working_locale)?data.introduction_html:undefined);
    return locales.map(locale=>{
      const submitted=value(saved,locale),current=value(project,locale);
      // A saved reference is in the same language and belongs to the frozen submission.
      // Missing historical baselines are explicit, never replaced by the French text.
      const clone=cloneReviewContext(project);
      const reference=clone.isClone?(clone.baseline?value(clone.baseline.project,locale):undefined):reviewLocaleValue(saved.introduction_reference_variants,locale);
      const query=new URLSearchParams({theme,projectId,review:'1',locale,focus:'intro'});
      return {locale,label:`Introduction du diagnostic · ${reviewLocaleNames[locale]||locale.toUpperCase()} (${locale.toUpperCase()})`,reference,submitted,current,href:`parametrage.html?${query.toString()}`};
    });
  }
  let project=null,currentUser=null,studioSubscription=null,reviewEvents=[],currentChapters=[];
  let translationChanges=[],translationChangesError='',translationChangesSupported=false;
  const date=v=>{if(!v)return 'À définir';const raw=String(v),day=raw.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return 'À définir';const parsed=new Date(day+'T12:00:00');return Number.isNaN(parsed.getTime())?'À définir':parsed.toLocaleDateString('fr-FR');};
  const statusLabel=status=>status&&status!=='draft'?window.StudioStatus.label(status):'Configuration verrouillée';
  const isoDate=value=>String(value||'').slice(0,10);
  let lastQuotaRefresh=0;
  function showValidationError(message){const box=$('validation-alert');box.hidden=false;box.dataset.tone='';box.textContent=message;box.scrollIntoView({behavior:'smooth',block:'center'});}
  function renderValidationQuota(quota){
    const need=Number(project?.estimated_respondents)||0,remaining=quota?Number(quota.passations_remaining)||0:0;
    $('validation-credit-needed').textContent=need?need.toLocaleString('fr-FR'):'—';
    $('validation-credit-remaining').textContent=quota?remaining.toLocaleString('fr-FR'):'À confirmer';
    $('validation-credit-status').textContent=!quota?'À confirmer par Me&YouToo':(!need?'Volume facultatif non renseigné':(remaining>=need?'Solde suffisant':'Solde insuffisant'));
    $('validation-credit-status').style.color=quota&&need&&remaining<need?'var(--danger)':'';
    const pending=quota?.pending_pack_request,pendingBox=$('validation-pack-pending');
    if(pending&&pendingBox){
      const volume=pending.unlimited?'un pack illimité':`${Number(pending.volume||0).toLocaleString('fr-FR')} passations`,requestedAt=pending.requestedAt?new Date(pending.requestedAt):null,dateLabel=requestedAt&&!Number.isNaN(requestedAt.getTime())?` le ${requestedAt.toLocaleDateString('fr-FR')}`:'';
      $('validation-pack-pending-title').textContent=`Demande de ${volume} en attente`;
      $('validation-pack-pending-detail').textContent=`Demande envoyée${dateLabel}. Votre solde actuel restera affiché jusqu’à sa validation par Me&YouToo.`;
      pendingBox.hidden=false;
    }else if(pendingBox)pendingBox.hidden=true;
  }
  function renderMonthlyCampaignAllowance(){
    const existing=document.getElementById('monthly-campaign-allowance');
    if(existing)existing.remove();
    if(currentUser?.role==='admin'||studioSubscription?.plan!=='monthly'||project?.status!=='draft')return;
    const remaining=Number(studioSubscription.monthlyCampaignRemaining);
    const alreadyTransmitted=Boolean(project?.first_submitted_at);
    const container=$('submit-project')?.closest('.top-actions')||$('submit-project')?.parentElement;
    if(!container)return;
    const note=document.createElement('div');note.id='monthly-campaign-allowance';note.className='composer-alert';
    if(alreadyTransmitted){
      note.textContent='Formule mensuelle : cette campagne a déjà utilisé son droit de première transmission. Les corrections ou retransmissions de cette même campagne ne consomment pas un nouveau droit.';
    }else if(remaining<=0){
      note.dataset.tone='warning';
      note.innerHTML='<strong>Limite mensuelle atteinte.</strong> Votre formule permet de transmettre 1 nouvelle campagne par période mensuelle d’abonnement. Vous pourrez transmettre une nouvelle campagne à la prochaine période ou passer à la formule annuelle.';
      const button=$('submit-project');if(button){button.disabled=true;button.classList.add('is-disabled');button.title='Limite mensuelle atteinte';}
    }else{
      note.textContent='Formule mensuelle : 1 nouvelle campagne transmissible par période mensuelle. Cette transmission utilisera votre droit du mois.';
    }
    container.before(note);
  }
  async function refreshValidationQuota(){
    if(document.hidden||!project||currentUser?.role==='admin'||Date.now()-lastQuotaRefresh<800)return;
    lastQuotaRefresh=Date.now();
    try{const quotaData=await api(`/api/projects/${projectId}/quota`);renderValidationQuota(quotaData.organization);}catch(error){console.warn('Actualisation des passations impossible',error);}
  }
  async function saveValidationSettings({silent=false}={}){
    if(!project||project.status!=='draft')return true;
    const campaignName=$('validation-campaign').value.trim(),respondentTitle=$('validation-title').value.trim(),launchDate=$('validation-launch-date').value,closeDate=$('validation-close-date').value;
    if(!campaignName){showValidationError('Renseignez le nom de la campagne.');return false;}
    if(!respondentTitle){showValidationError('Renseignez le titre affiché aux répondants.');return false;}
    if(!launchDate||!closeDate){showValidationError('Renseignez les dates de lancement et de clôture.');return false;}
    if(closeDate<=launchDate){showValidationError('La date de clôture doit être postérieure à la date de lancement.');return false;}
    const button=$('save-validation-settings'),status=$('validation-save-status');
    if(button){button.disabled=true;button.textContent='Enregistrement…';}
    if(status)status.textContent='';
    try{
      const result=await api(`/api/projects/${projectId}/settings`,{method:'PATCH',body:JSON.stringify({campaignName,respondentTitle,introductionHtml:project.introduction_html,launchDate,closeDate})});
      project=result.project||project;
      $('validation-alert').hidden=true;
      if(status&&!silent)status.textContent='✓ Modifications enregistrées';
      return true;
    }catch(error){showValidationError(error.message);return false;}
    finally{if(button){button.disabled=false;button.textContent='Enregistrer les modifications';}}
  }
  function lockSubmittedState(){
    document.querySelectorAll('[data-validation-check]').forEach(c=>{c.disabled=true;c.closest('label')?.style.setProperty('opacity','.6');});
    document.querySelectorAll('[data-validation-edit]').forEach(field=>field.disabled=true);
    const saveButton=$('save-validation-settings');if(saveButton)saveButton.hidden=true;
    const editBadge=document.querySelector('.validation-summary-edit-badge');if(editBadge)editBadge.textContent='Configuration transmise';
    const submit=$('submit-project');
    if(submit){submit.disabled=true;submit.classList.add('is-disabled');submit.textContent=statusLabel(project?.status);}
    const back=$('validation-back');if(back){back.hidden=false;back.textContent='← Revoir le paramétrage';}
    const alert=$('validation-alert');
    if(alert){alert.hidden=false;alert.dataset.tone='success';alert.innerHTML='<strong>🔒 Configuration verrouillée côté client.</strong> '+statusLabel(project?.status)+'. Le suivi de la relecture est affiché ci-dessous.';}
    const checkSection=document.querySelector('[data-validation-check]')?.closest('section');
    if(checkSection)checkSection.style.background='var(--royal-blue-tint)';
  }
  // Après la transmission, la frise montre où en est la campagne. L'équipe voit les phases sans « À vous d'agir »,
  // qui s'adresse au client.
  function showSubmittedJourney(){
    const card=document.querySelector('.studio-process-card');if(!card)return;
    const journey=window.StudioJourney?.html(project?.status,null,{stepsOnly:currentUser?.role==='admin'});
    if(!journey){card.setAttribute('hidden','');return;}
    card.hidden=false;
    card.innerHTML='<p class="eyebrow">Votre parcours</p><h2 class="section-title" id="process-title">Où en est votre campagne ?</h2>'+journey;
  }
  function hideSubmittedPreparation(){
    document.querySelector('nav.steps')?.setAttribute('hidden','');
    showSubmittedJourney();
    const summary=document.querySelector('.validation-summary');if(currentUser?.role==='admin')summary?.setAttribute('hidden','');else if(summary){summary.hidden=false;const title=$('validation-summary-title'),desc=summary.querySelector('.section-desc'),badge=summary.querySelector('.validation-summary-edit-badge'),editActions=summary.querySelector('.validation-edit-actions');if(title)title.textContent='Informations de paramétrage transmises';if(desc)desc.textContent='Retrouvez ici les informations essentielles de votre campagne, conservées en lecture seule pendant la relecture.';if(badge)badge.textContent='Lecture seule';if(editActions){editActions.hidden=true;editActions.style.display='none';}}
    $('validation-credit')?.setAttribute('hidden','');
    document.querySelector('[data-validation-check]')?.closest('section')?.setAttribute('hidden','');
    $('submit-project')?.closest('.top-actions')?.setAttribute('hidden','');
    document.querySelector('.step-time-badge')?.setAttribute('hidden','');
    const alert=$('validation-alert');if(alert){alert.hidden=true;alert.textContent='';}
  }
  async function openAdjustmentDialog(differences,call,preselectedLabel=''){
    document.getElementById('adjustment-dialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='adjustment-dialog';dialog.className='admin-dialog adjustment-dialog';
    const targets=differences.map((row,index)=>{const label=row[0],category=/donnée d’analyse|critère socio/i.test(label)?'sociodemo':/profil/i.test(label)?'profile':/introduction/i.test(label)?'intro':/date|campagne|titre répondants/i.test(label)?'settings':'situation',chapter=label.match(/^(Chapitre \d+ · [^·]+)/)?.[1];return {key:`difference:${index}`,label,leftText:plain(row[1]),rightText:plain(row[2]),leftLabel:row[3]||'Votre version',rightLabel:row[4]||'Version proposée par Me&YouToo',adminColors:row[5]!==false,disabled:row[6]===true,category,group:chapter||(category==='settings'?'Informations essentielles':category==='sociodemo'?'Données d’analyse':category==='intro'?'Introduction':'Autres contenus')};});
    const renderTarget=(t,index,shortLabel='')=>{const unchanged=t.leftText===t.rightText,label=shortLabel||t.label;return `<label class="adjust-target-card ${t.disabled?'is-locked':''}" data-category="${t.category}"><span class="adjust-target-choice"><input type="checkbox" value="${esc(t.key)}" data-label="${esc(t.label)}" data-target-index="${index}" ${t.disabled?'disabled':''}> <strong>${esc(label)}</strong>${t.disabled?'<em>Obligatoire · non modifiable</em>':''}</span>${unchanged?`<span class="adjust-version is-meayt"><small>${esc(t.rightLabel||'Version actuelle Me&YouToo')}</small>${esc(t.rightText)||'—'}</span>`:`<span class="adjust-version ${t.adminColors?'is-client':'is-reference'}"><small>${esc(t.leftLabel)}</small>${esc(t.leftText)||'—'}</span><span class="adjust-version ${t.adminColors?'is-meayt':'is-client-change'}"><small>${esc(t.rightLabel)}</small><div class="review-word-diff">${readableWordDiff(t.leftText,t.rightText,t.adminColors)}</div></span>`}</label>`;};
    const grouped=new Map();targets.forEach((target,index)=>{const key=`${target.category}|${target.group}`;if(!grouped.has(key))grouped.set(key,{category:target.category,title:target.group,items:[]});grouped.get(key).items.push({target,index});});
    const targetMarkup=[...grouped.values()].map(group=>{let content='';if(group.category==='situation'){const situations=new Map();group.items.forEach(item=>{const match=item.target.label.match(/· (Situation \d+) · (Texte|Réponse \d+)$/),name=match?.[1]||'Autre',field=match?.[2]||item.target.label;if(!situations.has(name))situations.set(name,{text:null,answers:[]});if(field==='Texte')situations.get(name).text=item;else situations.get(name).answers.push(item);});content=[...situations.entries()].map(([name,value])=>`<section class="adjust-situation-block"><h4>${esc(name)}</h4>${value.text?renderTarget(value.text.target,value.text.index,'Texte de la situation'):''}${value.answers.length?`<details class="adjust-response-list"><summary>Voir les réponses (${value.answers.length})</summary><div>${value.answers.map(item=>renderTarget(item.target,item.index,item.target.label.match(/Réponse \d+$/)?.[0]||'Réponse')).join('')}</div></details>`:''}</section>`).join('');}else if(group.category==='profile'){const profiles=new Map();group.items.forEach(item=>{const match=item.target.label.match(/· (Profil \d+\/3 · Niveau [^·]+) · (.+)$/),name=match?.[1]||'Profil',field=match?.[2]||item.target.label;if(!profiles.has(name))profiles.set(name,[]);profiles.get(name).push({...item,field});});content=[...profiles.entries()].map(([name,items])=>`<details class="adjust-profile-block"><summary>${esc(name)}</summary><div>${items.map(item=>renderTarget(item.target,item.index,item.field)).join('')}</div></details>`).join('');}else content=group.items.map(item=>renderTarget(item.target,item.index,item.target.label)).join('');return `<details class="adjust-category-group" data-category="${group.category}"><summary>${esc(group.title)}</summary><div class="adjust-group-content">${content}</div></details>`;}).join('');
    dialog.innerHTML=`<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Demande ciblée</p><h2>Que souhaitez-vous faire ajuster ?</h2><p>Votre configuration reste verrouillée. Me&YouToo reprendra uniquement les éléments que vous signalez.</p><label class="field"><span>Nature de la demande</span><select id="adjust-category"><option value="">Choisir…</option><option value="situation">Une situation ou une réponse</option><option value="profile">Un profil</option><option value="intro">L’introduction</option><option value="settings">Les dates ou les titres</option><option value="sociodemo">Les données d’analyse</option><option value="multiple">Plusieurs éléments</option><option value="other">Autre demande</option></select></label><div class="adjust-details" id="adjust-details" hidden><fieldset class="adjust-targets" id="adjust-targets"><legend>Contenu à faire reprendre</legend><p class="adjust-target-help">Sélectionnez le texte précis concerné par votre demande, même si Me&YouToo ne l’a pas encore modifié.</p>${targetMarkup||'<p>Aucune différence détaillée disponible.</p>'}</fieldset><label class="field"><span>Expliquez le résultat attendu <small>(10 caractères minimum)</small></span><textarea id="adjust-message" rows="5" placeholder="Ex. : conserver la formulation du client dans la situation 3, mais remplacer le dernier terme…"></textarea></label><div class="adjust-summary" id="adjust-summary">Sélectionnez une catégorie et le contenu à faire reprendre.</div></div><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="adjust-send" type="button" hidden>Vérifier et envoyer</button></div></form>`;
    document.body.append(dialog);const category=$('adjust-category'),targetBox=$('adjust-targets'),summaryBox=$('adjust-summary'),details=$('adjust-details'),sendButton=$('adjust-send');
    const update=()=>{const value=category.value,filtered=Boolean(value&&!['multiple','other'].includes(value));dialog.classList.toggle('has-selection',Boolean(value));details.hidden=!value;sendButton.hidden=!value;targetBox.hidden=value==='other'||!value;targetBox.querySelectorAll('label').forEach(label=>{label.hidden=filtered&&label.dataset.category!==value;const input=label.querySelector('input');if(label.hidden&&input)input.checked=false;});const visibleGroups=[];targetBox.querySelectorAll('.adjust-category-group').forEach(group=>{group.hidden=filtered&&group.dataset.category!==value;if(!group.hidden)visibleGroups.push(group);});if(value&&visibleGroups.length&&!visibleGroups.some(group=>group.open))visibleGroups[0].open=true;const selected=[...targetBox.querySelectorAll('input:checked')].filter(x=>!x.closest('label').hidden);summaryBox.innerHTML=value==='other'?'Décrivez précisément votre demande dans le champ ci-dessus.':selected.length?`<strong>${selected.length} élément${selected.length>1?'s':''} signalé${selected.length>1?'s':''}</strong><br>${selected.map(x=>esc(x.dataset.label)).join('<br>')}`:'Sélectionnez précisément ce que Me&YouToo doit reprendre.';};category.onchange=update;targetBox.onchange=update;update();if(preselectedLabel){const index=targets.findIndex(target=>target.label===preselectedLabel);if(index>=0){category.value=targets[index].category;update();const input=targetBox.querySelector(`[data-target-index="${index}"]`);if(input){input.checked=true;let parent=input.parentElement;while(parent&&parent!==targetBox){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}update();input.scrollIntoView({block:'center'});}}}
    $('adjust-send').onclick=async()=>{const message=$('adjust-message').value.trim(),selected=[...targetBox.querySelectorAll('input:checked:not([hidden])')].filter(x=>!x.closest('label').hidden),cat=category.value;if(!cat)return window.StudioModal.alert({title:'Choisissez la nature de la demande',message:'Cela permettra à Me&YouToo de traiter votre retour sans ambiguïté.',type:'info'});if(cat!=='other'&&!selected.length)return window.StudioModal.alert({title:'Sélectionnez au moins un élément',message:'Cochez la ou les corrections concernées.',type:'info'});if(message.length<10)return window.StudioModal.alert({title:'Précisez le résultat attendu',message:'Votre commentaire doit contenir au moins 10 caractères.',type:'info'});const chosen=selected.map(x=>{const target=targets[Number(x.dataset.targetIndex)]||{};return {key:x.value,label:x.dataset.label,clientText:target.leftText||'',meaytText:target.rightText||'',leftLabel:target.leftLabel||'',rightLabel:target.rightLabel||'',adminColors:Boolean(target.adminColors)};}),ok=await window.StudioModal.confirm({eyebrow:'Confirmation',title:'Envoyer cette demande d’ajustement ?',message:`${chosen.length||'Aucun'} élément ciblé. Votre commentaire : « ${message} »`,confirmLabel:'Envoyer à Me&YouToo',cancelLabel:'Relire ma demande'});if(ok){dialog.close();await call(`/api/projects/${projectId}/review/request-adjustment`,{message,category:cat,targets:chosen});}};dialog.showModal();
  }
  function translationChangesPanel(locale){
    if(currentUser?.role!=='admin'||!translationChangesSupported)return '';
    const rows=translationChanges.filter(row=>reviewLocale(row.locale)===locale);
    if(!rows.length)return '';
    return `<div class="review-diff"><div class="review-diff-head"><div><h3>Situations et réponses personnalisées</h3></div></div><div class="review-diff-scroll"><table><thead><tr><th>Élément contrôlé</th><th>Texte avant modification</th><th>Version actuelle</th></tr></thead><tbody>${rows.map(row=>{
      const index=currentChapters.findIndex(ch=>String(ch.id)===String(row.chapter_id));
      const chapter=index>=0?index:Math.max(0,Number(row.chapter_position||1)-1);
      const country=row.country_code||project.selected_country_code||(project.countries||[])[0]||'WORLDWIDE';
      const query=new URLSearchParams({theme,projectId,review:'1',chapter:String(chapter),situation:String(row.situation_id),locale,countryCode:country});
      if(row.field==='answer')query.set('answer',String(row.entity_id));
      const label=`${row.chapter_title||'Chapitre'} · Situation ${row.situation_position||row.situation_id}${row.field==='answer'?` · Réponse ${row.answer_position||row.entity_id}`:' · Texte'}${row.country_code?` · Périmètre : ${row.country_code}`:' · Contenu commun'}`;
      const actor=row.actorRole==='admin'?'Dernière correction : Me&YouToo':row.actorRole?'Dernière correction : client':'Version personnalisée';
      const before=row.beforeKnown?esc(row.before):'<em>Texte antérieur non enregistré</em>';
      const after=row.beforeKnown?readableWordDiff(row.before,row.after,row.actorRole==='admin'):esc(row.after);
      return `<tr><th><a class="review-edit-target" href="composer.html?${esc(query.toString())}">${esc(label)}<span>Ouvrir cet élément →</span></a><small>${esc(actor)}</small></th><td>${before}</td><td class="review-word-diff">${after}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
  }

  const reviewOpenLanguages=new Set();
  function bindReviewLanguages(root){
    root.querySelectorAll('.review-language-group').forEach(group=>{
      group.addEventListener('toggle',()=>{
        const locale=group.dataset.reviewLocale;
        if(group.open)reviewOpenLanguages.add(locale);
        else{
          reviewOpenLanguages.delete(locale);
          group.querySelectorAll('details[open]').forEach(child=>{child.open=false;});
        }
      });
    });
  }

  function pendingIntroTranslationRequests(){
    const allowed=(project?.locales||[]).map(reviewLocale),raw=project?.translation_review_state?.introRequests||{};
    return Object.entries(raw).flatMap(([key,value])=>{const locale=reviewLocale(key),sourceLocale=reviewLocale(value?.sourceLocale);return allowed.includes(locale)&&allowed.includes(sourceLocale)&&locale!==sourceLocale?[{locale,sourceLocale}]:[];});
  }
  function pendingSocioTranslationRequests(){
    const allowed=(project?.locales||[]).map(reviewLocale),raw=project?.translation_review_state?.socioRequests||{};
    return Object.entries(raw).flatMap(([key,value])=>{const locale=reviewLocale(key),sourceLocale=reviewLocale(value?.sourceLocale);return allowed.includes(locale)&&allowed.includes(sourceLocale)&&locale!==sourceLocale?[{locale,sourceLocale}]:[];});
  }
  let translationRequestStatus=null,translationRequestStatusError='';
  async function refreshTranslationRequestStatus(){
    try{translationRequestStatus=await api(`/api/admin/projects/${projectId}/translation-requests`);translationRequestStatusError='';}
    catch(error){translationRequestStatus=null;translationRequestStatusError=error.message||'Statut des traductions indisponible.';}
  }
  function translationRequestPanel(kind,requests){
    const intro=kind==='intro',id=`${kind}-translation-request-summary`;
    let host=$(id);
    if(!requests.length){host?.remove();return;}
    const admin=currentUser?.role==='admin',section=intro?'Introduction':'Données d’analyse';
    if(!host){host=document.createElement('section');host.id=id;document.querySelector('.validation-summary').after(host);}
    host.className='card validation-translation-card';
    host.setAttribute('aria-labelledby',`${id}-title`);
    host.innerHTML=`<div class="validation-translation-head"><div><p class="eyebrow">${admin?'Demandes de traduction en attente':'Traductions confiées à Me&YouToo'}</p><h2 class="section-title" id="${id}-title">${intro?'Traductions de l’introduction':'Traductions des données d’analyse'}</h2></div><span class="validation-translation-badge">${requests.length} langue${requests.length>1?'s':''}</span></div><p class="validation-translation-description">${admin?'Complétez les traductions si nécessaire, puis marquez chaque demande comme terminée. Une version déjà renseignée peut être clôturée directement ici après vérification.':'Votre demande est prise en compte. Vous pouvez transmettre la campagne ; Me&YouToo réalisera ces traductions avant la validation pour diffusion.'}</p>${admin&&translationRequestStatusError?`<p class="composer-alert" role="alert">Le statut des traductions n’a pas pu être vérifié : ${esc(translationRequestStatusError)}</p>`:''}<ul class="validation-translation-list">${requests.map(row=>{
      const target=reviewLocaleNames[row.locale]||row.locale.toUpperCase(),source=reviewLocaleNames[row.sourceLocale]||row.sourceLocale.toUpperCase();
      const status=translationRequestStatus?.requests?.find(item=>item.kind===kind&&item.locale===row.locale),ready=status?.complete===true;
      const query=new URLSearchParams({theme,projectId,locale:row.locale,focus:intro?'intro':'socio-list'});
      if(admin)query.set('review','1');
      return `<li class="validation-translation-row"><div class="validation-translation-copy"><strong>${esc(target)}</strong><span>À partir de ${admin?'la version du client':'votre version'} en ${esc(source)}</span>${admin?`<span class="validation-translation-state ${ready?'is-ready':''}">${ready?'Traduction renseignée — à marquer comme terminée':status?'Traduction à compléter':'Statut à vérifier'}</span><small>Paramétrage → ${esc(section)} · ${esc(target)}</small>`:'<small>Prise en charge par Me&YouToo</small>'}</div>${admin?`<div class="validation-translation-actions"><a class="button button-secondary button-small validation-translation-link" href="parametrage.html?${esc(query.toString())}">${ready?'Revoir la traduction':intro?'Traduire l’introduction':'Traduire les données d’analyse'}<span class="sr-only"> en ${esc(target)}</span> <span aria-hidden="true">→</span></a>${ready&&translationRequestStatus?.editable?`<button type="button" class="button button-primary button-small" data-complete-translation="${esc(row.locale)}">Marquer la traduction comme terminée</button>`:''}<p data-translation-complete-error role="alert" hidden></p></div>`:''}</li>`;
    }).join('')}</ul>`;
    host.querySelectorAll('[data-complete-translation]').forEach(button=>button.onclick=async()=>{
      const locale=button.dataset.completeTranslation,error=button.parentElement.querySelector('[data-translation-complete-error]');
      button.disabled=true;error.hidden=true;
      try{
        await api(`/api/admin/projects/${projectId}/translation-requests/complete`,{method:'POST',body:JSON.stringify({kind,locale,expectedUpdatedAt:translationRequestStatus?.version})});
        const key=intro?'introRequests':'socioRequests',requests=project.translation_review_state?.[key]||{};
        for(const storedLocale of Object.keys(requests))if(reviewLocale(storedLocale)===locale)delete requests[storedLocale];
        await refreshTranslationRequestStatus();introTranslationRequestPanel();
      }catch(e){error.textContent=e.message||'La demande n’a pas pu être clôturée.';error.hidden=false;button.disabled=false;}
    });
  }
  function pendingSituationTranslationRequests(){
    const raw=project?.translation_review_state?.situationRequests||{};
    const selected=new Map(currentChapters.flatMap(ch=>(ch.situations||[]).map(s=>[String(s.id),{situation:s,chapter:ch.title}])));
    return Object.entries(raw).flatMap(([key,row])=>{
      const situationId=String(row?.situationId||''),locale=reviewLocale(row?.locale),sourceLocale=reviewLocale(row?.sourceLocale),entry=selected.get(situationId);
      if(!entry||key!==`${situationId}:${locale}`||locale===sourceLocale)return [];
      const status=translationRequestStatus?.requests?.find(r=>r.kind==='situation'&&r.key===key);
      if(currentUser?.role==='admin'&&translationRequestStatus?.supported&&!status)return [];
      return [{key,situationId,locale,sourceLocale,chapter:entry.chapter,countryCode:status?.countryCode||entry.situation.country_code||'WORLDWIDE',complete:status?.complete===true,known:Boolean(status)}];
    });
  }
  function situationTranslationRequestPanel(){
    const requests=pendingSituationTranslationRequests(),id='situation-translation-request-summary';let host=$(id);
    if(!requests.length){host?.remove();return;}
    if(!host){host=document.createElement('section');host.id=id;host.className='card validation-translation-card';document.querySelector('.validation-summary').after(host);}
    const admin=currentUser?.role==='admin';
    host.innerHTML=`<div class="validation-translation-head"><div><p class="eyebrow">${admin?'Demandes de traduction en attente':'Traductions confiées à Me&YouToo'}</p><h2 class="section-title">Situations et réponses à traduire</h2></div><span class="validation-translation-badge">${requests.length} demande${requests.length>1?'s':''}</span></div><p class="validation-translation-description">${admin?'Traduisez la situation et toutes ses réponses, puis clôturez la demande. Les traductions doivent être terminées avant validation pour diffusion.':'Vous pouvez transmettre votre campagne. Me&YouToo traduira ces situations et leurs réponses avant la validation pour diffusion.'}</p>${admin&&translationRequestStatusError?`<p class="composer-alert" role="alert">${esc(translationRequestStatusError)}</p>`:''}<ul class="validation-translation-list">${requests.map(row=>{
      const query=new URLSearchParams({theme,projectId,situation:row.situationId,countryCode:row.countryCode,locale:row.sourceLocale,translate:row.locale,review:'1'});
      return `<li class="validation-translation-row"><div class="validation-translation-copy"><strong>${esc(reviewLocaleNames[row.locale]||row.locale.toUpperCase())} · ${esc(row.chapter)} · Situation #${esc(row.situationId)}</strong><span>À partir de ${esc(reviewLocaleNames[row.sourceLocale]||row.sourceLocale.toUpperCase())} · ${esc(row.countryCode==='WORLDWIDE'?'International':row.countryCode)}</span><span class="validation-translation-state ${row.complete?'is-ready':''}">${admin?(row.complete?'Traduction renseignée — à marquer comme terminée':row.known?'Traduction à compléter':'Statut à vérifier'):'Traduction demandée à Me&YouToo'}</span></div>${admin?`<div class="validation-translation-actions"><a class="button button-secondary button-small" href="composer.html?${esc(query.toString())}">${row.complete?'Revoir la traduction':'Traduire la situation et les réponses'} →</a>${row.complete&&translationRequestStatus?.editable?`<button type="button" class="button button-primary button-small" data-complete-situation-request="${esc(row.key)}">Marquer la traduction comme terminée</button>`:''}<p data-situation-request-error role="alert" hidden></p></div>`:''}</li>`;
    }).join('')}</ul>`;
    host.querySelectorAll('[data-complete-situation-request]').forEach(button=>button.onclick=async()=>{
      const key=button.dataset.completeSituationRequest,error=button.parentElement.querySelector('[data-situation-request-error]');button.disabled=true;error.hidden=true;
      try{
        await api(`/api/admin/projects/${projectId}/situation-translation-requests/complete`,{method:'POST',body:JSON.stringify({key,expectedUpdatedAt:translationRequestStatus?.version})});
        delete project.translation_review_state.situationRequests[key];
        await refreshTranslationRequestStatus();introTranslationRequestPanel();
      }catch(e){error.textContent=e.message||'Impossible de clôturer la demande.';error.hidden=false;button.disabled=false;}
    });
  }
  function socioTranslationRequestPanel(){translationRequestPanel('socio',pendingSocioTranslationRequests());}
  function introTranslationRequestPanel(){
    situationTranslationRequestPanel();
    socioTranslationRequestPanel();
    translationRequestPanel('intro',pendingIntroTranslationRequests());
  }

  function reviewPanel(){
    let root=$('review-workflow');if(!root){root=document.createElement('section');root.id='review-workflow';root.className='card review-workflow';document.querySelector('.validation-summary').after(root);}
    const summary=project.review_summary||'Aucun commentaire de relecture pour le moment.',isAdmin=currentUser?.role==='admin',status=isAdmin&&project.status==='client_validation_required'?'En attente du retour client':statusLabel(project.status);
    const visibleReviewEvents=reviewEvents.filter(event=>!['client_correction_progress','translation_updated'].includes(event.event_type)),history=visibleReviewEvents.length?`<details class="review-history"><summary>Historique de la relecture</summary>${visibleReviewEvents.map(e=>`<p><strong>${new Date(e.created_at).toLocaleString('fr-FR')}</strong> · ${esc(e.summary||e.event_type)}</p>`).join('')}</details>`:'';
    const adjustmentIndex=reviewEvents.findIndex(e=>e.event_type==='client_adjustment_requested'),resolutionEvents=new Set(['client_validation_requested','review_approved','client_accepted','submitted']),adjustment=adjustmentIndex>=0&&!reviewEvents.slice(0,adjustmentIndex).some(e=>resolutionEvents.has(e.event_type))?reviewEvents[adjustmentIndex]:null,meta=adjustment?.metadata||{},requestedTargetLabels=new Set((meta.targets||[]).map(target=>String(target.label||'')));
    const validationRequestIndex=reviewEvents.findIndex(event=>event.event_type==='client_validation_requested'),currentReviewEvents=validationRequestIndex<0?reviewEvents:reviewEvents.slice(0,validationRequestIndex),savedProgress=currentReviewEvents.find(event=>event.event_type==='client_correction_progress'),acceptedCorrections=new Set(Array.isArray(savedProgress?.metadata?.acceptedKeys)?savedProgress.metadata.acceptedKeys:[]),correctionKey=label=>`correction:${label}`;
    const snapshot=project.review_snapshot||{},hasReviewSnapshot=Boolean(snapshot.project&&Array.isArray(snapshot.chapters)),beforeProject=snapshot.project||{},beforeChapters=Array.isArray(snapshot.chapters)?snapshot.chapters:[],clientDifferences=[],adminDifferences=[];
    const clone=cloneReviewContext(project),cloneBaseline=clone.baseline;
    const comparisonProject=cloneBaseline?.project||{},baselineSituations=new Map((cloneBaseline?.chapters||[]).flatMap(ch=>ch.situations||[]).map(row=>[String(row.id),row])),baselineProfiles=new Map((cloneBaseline?.chapters||[]).flatMap(ch=>ch.profiles||[]).map(row=>[String(row.id),row]));
    const referenceProject=(key,fallback)=>clone.isClone?(cloneBaseline?comparisonProject[key]:beforeProject[key]):fallback;
    const referenceSituation=(id,fallback)=>clone.isClone?(baselineSituations.get(String(id))||null):fallback;
    const referenceProfile=(id,fallback)=>clone.isClone?(baselineProfiles.get(String(id))||null):fallback;
    const referenceLabel=cloneBaseline?'Version au moment de la duplication':'Référentiel Me&YouToo';
    const addClientDiff=(label,reference,client,href='')=>{if((!clone.isClone||cloneBaseline)&&plain(reference)!==plain(client))clientDifferences.push([label,plain(reference)||'—',plain(client)||'—',href]);};
    const addAdminDiff=(label,client,current,href='')=>{if(plain(client)!==plain(current))adminDifferences.push([label,plain(client)||'—',plain(current)||'—',href]);};
    const settingsLink=`parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1`;
    addClientDiff('Nom de campagne',referenceProject('campaign_name',project.base_title),beforeProject.campaign_name,settingsLink);addClientDiff('Titre répondants',referenceProject('respondent_title',project.respondent_title_default),beforeProject.respondent_title,settingsLink);const nativeIntros=project.legacy_history!==true&&project.source_type!=='legacy_client'&&!['meayt-legacy','cloned_legacy'].includes(project.legacy_source),introVersions=nativeIntros?introReviewVersions(project):[];if(!nativeIntros)addClientDiff('Introduction du diagnostic',referenceProject('introduction_html',project.theme_introduction_html),beforeProject.introduction_html,settingsLink);for(const intro of introVersions)if((!clone.isClone||cloneBaseline)&&(intro.reference==null||intro.submitted==null||plain(intro.reference)!==plain(intro.submitted)))clientDifferences.push([intro.label,intro.reference==null?null:plain(intro.reference),intro.submitted==null?null:plain(intro.submitted),intro.href,{beforeKnown:intro.reference!=null,afterKnown:intro.submitted!=null}]);
    addAdminDiff('Nom de campagne',beforeProject.campaign_name,project.campaign_name,settingsLink);addAdminDiff('Titre répondants',beforeProject.respondent_title,project.respondent_title,settingsLink);if(!nativeIntros)addAdminDiff('Introduction du diagnostic',beforeProject.introduction_html,project.introduction_html,settingsLink);for(const intro of introVersions)if(intro.submitted!=null&&intro.current!=null)addAdminDiff(intro.label,intro.submitted,intro.current,intro.href);addAdminDiff('Date de lancement',String(beforeProject.launch_date||'').slice(0,10),String(project.launch_date||'').slice(0,10),settingsLink);addAdminDiff('Date de clôture',String(beforeProject.close_date||'').slice(0,10),String(project.close_date||'').slice(0,10),settingsLink);
    const beforeSituations=beforeChapters.flatMap((ch,ci)=>(ch.situations||[]).map((s,si)=>({...s,chapter:ch.title,chapterNumber:ci+1,situationNumber:si+1}))),afterSituations=currentChapters.flatMap((ch,ci)=>(ch.situations||[]).map((s,si)=>({...s,chapter:ch.title,chapterNumber:ci+1,situationNumber:si+1}))),beforeSituationMap=new Map(beforeSituations.map(s=>[String(s.id),s])),afterSituationMap=new Map(afterSituations.map(s=>[String(s.id),s]));
    beforeSituationMap.forEach((s,id)=>{const now=afterSituationMap.get(id),label=`Chapitre ${s.chapterNumber} · ${s.chapter} · Situation ${s.situationNumber}`,href=`composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1&chapter=${s.chapterNumber-1}&situation=${encodeURIComponent(id)}${s.country_code?`&countryCode=${encodeURIComponent(s.country_code)}`:''}`;if(now||cloneBaseline){const initial=referenceSituation(id,{content:now?.original_content,answers:now?.original_answers});addClientDiff(`${label} · Texte`,initial?.content,s.content,href);(s.answers||[]).forEach((answer,ai)=>{const original=(initial?.answers||[]).find(a=>String(a.id)===String(answer.id));if(original||cloneBaseline)addClientDiff(`${label} · Réponse ${ai+1}`,original?.content,answer.content,`${href}&answer=${encodeURIComponent(answer.id)}`);});}if(!now)adminDifferences.push([`${label} · supprimée`,plain(s.content),'Supprimée',href]);else{addAdminDiff(`${label} · Texte`,s.content,now.content,href);(s.answers||[]).forEach((answer,ai)=>{const current=(now.answers||[]).find(a=>String(a.id)===String(answer.id));if(current)addAdminDiff(`${label} · Réponse ${ai+1}`,answer.content,current.content,`${href}&answer=${encodeURIComponent(answer.id)}`);});}});afterSituationMap.forEach((s,id)=>{if(!beforeSituationMap.has(id)){const href=`composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1&chapter=${s.chapterNumber-1}&situation=${encodeURIComponent(id)}${s.country_code?`&countryCode=${encodeURIComponent(s.country_code)}`:''}`;adminDifferences.push([`Chapitre ${s.chapterNumber} · ${s.chapter} · Situation ${s.situationNumber} · ajoutée`,'Absente',plain(s.content),href]);}});
    const beforeProfiles=beforeChapters.flatMap((ch,ci)=>(ch.profiles||[]).map((x,pi)=>({...x,chapter:ch.title,chapterNumber:ci+1,profileNumber:pi+1}))),afterProfiles=currentChapters.flatMap((ch,ci)=>(ch.profiles||[]).map((x,pi)=>({...x,chapter:ch.title,chapterNumber:ci+1,profileNumber:pi+1}))),beforeProfileMap=new Map(beforeProfiles.map(x=>[String(x.id),x])),levels=['rouge','jaune','vert'];afterProfiles.forEach(now=>{const old=beforeProfileMap.get(String(now.id));if(!old)return;const base=`Chapitre ${now.chapterNumber} · ${now.chapter} · Profil ${now.profileNumber}/3 · Niveau ${levels[now.profileNumber-1]||now.color||'non défini'}`,href=`personnalisation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1&chapter=${now.chapterNumber-1}&profile=${encodeURIComponent(now.id)}`;[['Titre','title','original_title'],['Résumé','summary','original_summary'],['Contenu détaillé','content','original_content']].forEach(([label,key,originalKey])=>{addClientDiff(`${base} · ${label}`,referenceProfile(now.id,{[key]:now[originalKey]})?.[key],old[key],href);addAdminDiff(`${base} · ${label}`,old[key],now[key],href);});});
    if(cloneBaseline){
      baselineSituations.forEach((initial,id)=>{if(!beforeSituationMap.has(id))addClientDiff(`Situation retirée depuis la duplication · ${id}`,initial.content,'Retirée',settingsLink);});
      baselineProfiles.forEach((initial,id)=>{if(!beforeProfileMap.has(id))addClientDiff(`Profil retiré depuis la duplication · ${id}`,initial.title,'Retiré',settingsLink);});
      beforeProfiles.forEach(initial=>{if(!baselineProfiles.has(String(initial.id)))addClientDiff(`Profil ajouté depuis la duplication · ${initial.profileNumber}`,null,[initial.title,initial.summary,initial.content].filter(Boolean).join('\n'),settingsLink);});
    }
    const adjustmentRow=(label,reference,client,current)=>{const ref=plain(reference),clientVersion=plain(client),currentVersion=plain(current);if(clientVersion!==currentVersion)return [label,clientVersion,currentVersion,'Votre version','Version proposée par Me&YouToo',true];if(ref!==clientVersion)return [label,ref,clientVersion,referenceLabel,'Votre version',false];return [label,currentVersion,currentVersion,'','Version actuelle Me&YouToo',false];};
    const adjustmentTargets=[adjustmentRow('Nom de campagne',referenceProject('campaign_name',project.base_title),beforeProject.campaign_name||project.campaign_name,project.campaign_name),adjustmentRow('Titre répondants',referenceProject('respondent_title',project.respondent_title_default),beforeProject.respondent_title||project.respondent_title,project.respondent_title),adjustmentRow('Date de lancement',date(beforeProject.launch_date||project.launch_date),date(beforeProject.launch_date||project.launch_date),date(project.launch_date)),adjustmentRow('Date de clôture',date(beforeProject.close_date||project.close_date),date(beforeProject.close_date||project.close_date),date(project.close_date)),...(nativeIntros?introVersions.filter(intro=>intro.submitted!=null&&intro.current!=null).map(intro=>adjustmentRow(intro.label,intro.reference??intro.submitted,intro.submitted,intro.current)):[adjustmentRow('Introduction du diagnostic',referenceProject('introduction_html',project.theme_introduction_html),beforeProject.introduction_html||project.introduction_html,project.introduction_html)])];
    const socioKey=item=>String(item?.kind||item?.q||'').toLowerCase(),socioText=item=>{if(!item)return 'Critère absent';const options=(item.opts||[]).map(option=>option.label||option.value).filter(Boolean);return `${item.q||'Critère'}${options.length?` — Réponses : ${options.join(', ')}`:''}`;},currentSocio=Array.isArray(project.sociodemo)?project.sociodemo:[],clientSocio=Array.isArray(beforeProject.sociodemo)?beforeProject.sociodemo:currentSocio,referenceSocio=clone.isClone?(cloneBaseline?.project.sociodemo||clientSocio):(Array.isArray(project.theme_sociodemo_default)?project.theme_sociodemo_default:[]);
    const genderItem=currentSocio.find(item=>item.kind==='gender'||/genre/i.test(item.q||''));if(genderItem){adjustmentTargets.push(adjustmentRow(`Donnée d’analyse · ${genderItem.q||'Genre'}`,socioText(genderItem),socioText(genderItem),socioText(genderItem)));}currentSocio.filter(item=>item!==genderItem).forEach(item=>{const key=socioKey(item),clientItem=clientSocio.find(candidate=>socioKey(candidate)===key)||item,referenceItem=referenceSocio.find(candidate=>socioKey(candidate)===key)||clientItem;adjustmentTargets.push(adjustmentRow(`Donnée d’analyse · ${item.q||'Critère'}`,socioText(referenceItem),socioText(clientItem),socioText(item)));});
    const isFixedSexismChapter=item=>item.chapterNumber===1&&/sexisme/i.test(`${theme} ${project.theme_slug||''} ${project.theme_title||''}`);
    afterSituations.forEach(now=>{if(isFixedSexismChapter(now))return;const old=beforeSituationMap.get(String(now.id))||now,base=`Chapitre ${now.chapterNumber} · ${now.chapter} · Situation ${now.situationNumber}`;adjustmentTargets.push(adjustmentRow(`${base} · Texte`,referenceSituation(now.id,{content:now.original_content})?.content??old.content,old.content||now.content,now.content));(now.answers||[]).forEach((answer,ai)=>{const previous=(old.answers||[]).find(item=>String(item.id)===String(answer.id))||answer,reference=(referenceSituation(now.id,{answers:now.original_answers})?.answers||[]).find(item=>String(item.id)===String(answer.id))||answer;adjustmentTargets.push(adjustmentRow(`${base} · Réponse ${ai+1}`,reference.content,previous.content||answer.content,answer.content));});});
    afterProfiles.forEach(now=>{if(isFixedSexismChapter(now))return;const old=beforeProfileMap.get(String(now.id))||now,base=`Chapitre ${now.chapterNumber} · ${now.chapter} · Profil ${now.profileNumber}/3 · Niveau ${levels[now.profileNumber-1]||now.color||'non défini'}`;[['Titre','title','original_title'],['Résumé','summary','original_summary'],['Contenu détaillé','content','original_content']].forEach(([label,key,originalKey])=>adjustmentTargets.push(adjustmentRow(`${base} · ${label}`,referenceProfile(now.id,{[key]:now[originalKey]})?.[key]??old[key],old[key]||now[key],now[key])));});
    const comparisonTable=(title,description,rows,leftTitle,rightTitle,rightClass,adminColors=false,options={})=>{if(!rows.length)return '';const body=rows.map(row=>{const key=correctionKey(row[0]),approved=acceptedCorrections.has(key),controls=!isAdmin&&adminColors&&project.status==='client_validation_required'?`<div class="review-row-decision ${approved?'is-approved':''}">${approved?'<strong>✓ Correction validée</strong>':`<button class="button button-small review-approve-one" type="button" data-correction-key="${esc(key)}">Cette correction me convient</button>`}<button class="button button-small button-secondary review-adjust-one" type="button" data-correction-label="${esc(row[0])}">Demander un ajustement</button></div>`:'',badge=options.rowBadge?`<em class="review-origin-badge">${esc(options.rowBadge)}</em>`:'';return `<tr data-review-correction="${esc(key)}"><th>${badge}${isAdmin&&row[3]?`<a class="review-edit-target" href="${esc(row[3])}" title="Ouvrir directement cet élément">${esc(row[0])}<span>Modifier →</span></a>`:esc(row[0])}</th><td>${row[4]?.beforeKnown===false?'<em>Texte de référence dans cette langue non enregistré</em>':esc(row[1])}</td><td class="${rightClass} review-word-diff ${adminColors?'is-admin-diff':''}">${row[4]?.afterKnown===false?'<em>Version transmise non enregistrée pour cette langue</em>':row[4]?.beforeKnown===false?esc(row[2]):readableWordDiff(row[1],row[2],adminColors)}${controls}</td></tr>`;}).join('');return `<div class="review-diff ${esc(options.className||'')}"><div class="review-diff-head"><div><h3>${esc(title)}</h3><p>${esc(description)}</p></div></div><div class="review-diff-scroll"><table><thead><tr><th>Élément contrôlé</th><th>${esc(leftTitle)}</th><th class="${rightClass}">${esc(rightTitle)}</th></tr></thead><tbody>${body}</tbody></table></div></div>`;};
    const requestedAdminDifferences=adjustment?adminDifferences.filter(row=>(requestedTargetLabels.has(row[0])||(requestedTargetLabels.has('Introduction du diagnostic')&&row[0].startsWith('Introduction du diagnostic · ')))):[],otherAdminDifferences=requestedAdminDifferences.length?adminDifferences.filter(row=>!(requestedTargetLabels.has(row[0])||(requestedTargetLabels.has('Introduction du diagnostic')&&row[0].startsWith('Introduction du diagnostic · ')))):adminDifferences;
    // Keep correction labels and keys stable; only change where the rows are displayed.
    const workingLocale=reviewLocale(project.working_locale||'fr');
    const rowLocale=row=>nativeIntros?(introVersions.find(intro=>intro.label===row[0])?.locale||(/^Chapitre \d+ · /.test(row[0])?workingLocale:'')):'';
    const renderComparisons=(clientRows,requestedRows,otherRows)=>[
      comparisonTable(cloneBaseline?'Modifications depuis la duplication':'Adaptations transmises par le client',cloneBaseline?'Les adaptations héritées sont conservées dans le point de départ. Seules les modifications effectuées ensuite sur cette copie sont signalées.':isAdmin?'Cliquez sur un élément pour le vérifier.':'Voici la version que vous avez transmise.',clientRows,referenceLabel,'Version transmise par le client','review-client-version'),
      comparisonTable('Ajustements demandés par le client et réalisés par Me&YouToo',`Commentaire du client : « ${adjustment?.summary||'Demande ciblée'} »`,requestedRows,'Version avant ajustement','Version réalisée par Me&YouToo','review-meayt-version',true,{className:'review-client-request-result',rowBadge:'Suite à la demande du client'}),
      comparisonTable('Autres corrections apportées par Me&YouToo','Ces corrections ont été apportées à l’initiative de Me&YouToo.',otherRows,'Version transmise par le client','Version Me&YouToo','review-meayt-version',true),
    ].join('');
    const locales=[...new Set([...clientDifferences,...adminDifferences].map(rowLocale).filter(Boolean).concat(isAdmin&&translationChangesSupported?translationChanges.map(row=>reviewLocale(row.locale)):[]))];
    const diffusionLocales=new Set(introVersions.map(intro=>intro.locale));
    locales.sort((a,b)=>(diffusionLocales.has(b)?1:0)-(diffusionLocales.has(a)?1:0)||(reviewLocaleNames[a]||a).localeCompare(reviewLocaleNames[b]||b,'fr'));
    const select=(rows,locale)=>rows.filter(row=>rowLocale(row)===locale);
    const commonReviewHtml=renderComparisons(select(clientDifferences,''),select(requestedAdminDifferences,''),select(otherAdminDifferences,''));
    const languageReviewHtml=locales.map(locale=>{
      const clientRows=select(clientDifferences,locale),requestedRows=select(requestedAdminDifferences,locale),otherRows=select(otherAdminDifferences,locale);
      const translatedRows=isAdmin&&translationChangesSupported?translationChanges.filter(row=>reviewLocale(row.locale)===locale):[];
      const count=new Set([...clientRows,...requestedRows,...otherRows].map(row=>row[0])).size+translatedRows.length;
      const name=`${reviewLocaleNames[locale]||locale.toUpperCase()} (${locale.toUpperCase()})`;
      const workingOnly=locale===workingLocale&&!diffusionLocales.has(locale);
      return `<details class="review-history review-language-group" data-review-locale="${esc(locale)}"${reviewOpenLanguages.has(locale)?' open':''}><summary>${workingOnly?'Version de travail · ':''}${esc(name)} · ${count} élément${count>1?'s':''} à relire</summary>${workingOnly?'<p>Cette version sert à préparer les contenus. Elle ne fait pas partie des langues de diffusion de la campagne.</p>':''}${renderComparisons(clientRows,requestedRows,otherRows)}${translationChangesPanel(locale)}</details>`;
    }).join('');
    const translationAlert=isAdmin&&translationChangesError?`<p class="composer-alert">Le contrôle des versions linguistiques n’a pas pu être chargé : ${esc(translationChangesError)}</p>`:'';
    const cloneHistoryNotice=clone.isClone&&!cloneBaseline?'<p class="composer-alert">Cette copie a été créée avant l’enregistrement du contenu de départ. Les adaptations héritées et les changements réalisés ensuite ne peuvent pas être distingués de façon fiable. Les corrections Me&YouToo restent comparées à la version transmise. Consultez les situations, profils et paramètres pour vérifier l’ensemble du contenu.</p>':'';
    const contentReviewHtml=!hasReviewSnapshot?'<p class="review-no-diff">La comparaison n’est pas disponible pour cette ancienne transmission.</p>':`${cloneHistoryNotice}${commonReviewHtml}${languageReviewHtml?`<section class="review-linguistic-changes"><h2 class="section-title">Contenus à relire par langue</h2><p>Retrouvez l’introduction et les textes à vérifier dans le même bloc de langue. Dépliez la flèche sous un texte pour consulter les suppressions.</p>${languageReviewHtml}</section>`:''}${!cloneHistoryNotice&&!commonReviewHtml&&!languageReviewHtml?'<p class="review-no-diff review-no-diff-success">✓ Aucun texte modifié à relire.</p>':''}`;
    const differences=adminDifferences;
    let actions='';
    if(isAdmin&&['review_pending','configuration_submitted'].includes(project.status))actions=`<div class="review-action-intro"><strong>Étape suivante : démarrer le contrôle</strong><span>Les adaptations du client sont affichées ci-dessus. Commencez la vérification ; vous pourrez ensuite valider directement la configuration ou ouvrir uniquement la partie qui nécessite une correction.</span></div><button class="button button-primary" id="review-start" type="button">Commencer la vérification</button>`;
    if(isAdmin&&project.status==='in_review')actions=`<div class="review-correction-mode"><strong>Consultation des contenus · correction si nécessaire</strong><span>Ces accès permettent de consulter les contenus ; ils ne signalent pas une modification du client. Vos éventuelles corrections sont enregistrées dans votre version de travail privée. Le client conserve la dernière version transmise. Elles deviennent visibles uniquement lorsque vous envoyez les corrections ou validez la configuration.</span></div><div class="review-edit-links"><a class="button button-secondary" href="composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1">Consulter les situations</a><a class="button button-secondary" href="personnalisation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1">Consulter les profils</a><a class="button button-secondary" href="parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1">Consulter les paramètres</a></div><label class="field"><span>Résumé transmis au client <small>visible après l’envoi ou la validation de la configuration</small></span><textarea id="review-summary" rows="4" placeholder="Expliquez brièvement les corrections effectuées…"></textarea></label><div class="top-actions"><button class="button button-primary" id="review-minor" type="button">Valider la configuration · Passer en préparation</button><button class="button button-secondary" id="review-major" type="button">Envoyer les corrections au client</button></div>`;
    const correctionKeys=adminDifferences.map(row=>correctionKey(row[0])),allAccepted=correctionKeys.length===0||correctionKeys.every(key=>acceptedCorrections.has(key));
    if(!isAdmin&&project.status==='client_validation_required')actions=`<div class="review-client-decision"><p><strong>Me&YouToo vous propose une version corrigée</strong></p><p>Validez chaque correction dans le tableau. Si l’une d’elles ne vous convient pas, demandez directement un ajustement sur cette ligne.</p><p class="review-summary-copy"><strong>Résumé de la relecture :</strong> ${esc(summary)}</p><p class="review-progress-copy"><strong>${acceptedCorrections.size}/${correctionKeys.length}</strong> correction${correctionKeys.length>1?'s':''} validée${acceptedCorrections.size>1?'s':''}</p><div class="top-actions"><button class="button button-secondary" id="review-accept-all" type="button">Tout valider</button><button class="button button-primary" id="review-accept" type="button" ${allAccepted?'':'disabled'}>Confirmer ma validation</button><button class="button button-secondary" id="review-adjust" type="button">Demander un autre ajustement</button></div></div>`;
    if(isAdmin&&project.status==='client_validation_required')actions=`<div class="review-waiting-client"><strong>En attente du retour client</strong><span>La version corrigée a bien été transmise. Le client doit maintenant l’accepter ou envoyer une demande d’ajustement ciblée.</span></div>`;
    if(isAdmin&&project.status==='ready_to_publish')actions=`<div class="review-ready-action"><strong>✓ La configuration a été validée</strong><span>La configuration est validée. Préparez la campagne dans le moteur et vérifiez ses liens avant de la mettre à disposition.</span><a class="button button-primary" href="client.html?organizationId=${encodeURIComponent(project.organization_id||'')}&projectId=${encodeURIComponent(projectId)}&publish=1">🚀 Passer à la publication</a></div>`;
    if(!isAdmin&&project.status==='ready_to_publish')actions=`<div class="review-client-confirmed"><strong>✓ Votre validation est bien enregistrée</strong><span>Me&YouToo prépare maintenant la publication de votre campagne. Vous serez informé(e) dès que ses liens seront disponibles.</span></div>`;
    const targetEditHref=label=>{const chapterNumber=Number(label.match(/Chapitre (\d+)/i)?.[1]||0),situationNumber=Number(label.match(/Situation (\d+)/i)?.[1]||0),profileNumber=Number(label.match(/Profil (\d+)/i)?.[1]||0),chapter=currentChapters[chapterNumber-1];if(situationNumber){const situation=chapter?.situations?.[situationNumber-1];return `composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1&chapter=${Math.max(0,chapterNumber-1)}${situation?.id?`&situation=${encodeURIComponent(situation.id)}`:''}${situation?.country_code?`&countryCode=${encodeURIComponent(situation.country_code)}`:''}`;}if(profileNumber){const profile=chapter?.profiles?.[profileNumber-1];return `personnalisation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1&chapter=${Math.max(0,chapterNumber-1)}${profile?.id?`&profile=${encodeURIComponent(profile.id)}`:''}`;}return `parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1`;};
    const adjustmentBanner=adjustment?`<div class="review-adjustment-pending"><div class="adjustment-pending-heading"><div><span class="adjustment-pending-eyebrow">Demande active</span><strong>${isAdmin?'↻ Ajustement demandé par le client':'Votre demande a été transmise à Me&YouToo'}</strong></div><span class="adjustment-pending-date">${new Date(adjustment.created_at).toLocaleString('fr-FR')}</span></div><div class="adjustment-client-comment"><small>${isAdmin?'Commentaire du client':'Votre demande'}</small><blockquote>${esc(adjustment.summary)}</blockquote></div>${meta.targets?.length?`<div class="adjustment-review-list">${meta.targets.map(t=>{const unchanged=plain(t.clientText)===plain(t.meaytText),href=targetEditHref(t.label);return `<article><strong>${esc(t.label)}</strong>${unchanged?`<p><small>${esc(t.rightLabel||'Version actuellement utilisée')}</small>${esc(t.meaytText||t.clientText)}</p>`:`${t.clientText?`<p><small>${esc(t.leftLabel||'Version du client')}</small>${esc(t.clientText)}</p>`:''}${t.meaytText?`<p><small>${esc(t.rightLabel||'Version Me&YouToo contestée')}</small>${esc(t.meaytText)}</p>`:''}`} ${isAdmin?`<a class="button button-primary button-small adjustment-edit-button" href="${esc(href)}">Corriger cet élément →</a>`:''}</article>`;}).join('')}</div>`:''}</div>`:'';
    const colorLegend=`<div class="review-color-legend" aria-label="Légende des modifications"><span class="is-removed"><i></i><strong>Rouge</strong> : supprimé</span><span class="is-added"><i></i><strong>Vert</strong> : ajouté par le client</span><span class="is-meayt"><i></i><strong>Violet</strong> : Me&YouToo</span></div>`;
    root.innerHTML=`<p class="eyebrow">Contrôle qualité</p><h2 class="section-title">Relecture Me&YouToo</h2><div class="review-status ${adjustment?'is-adjustment':''}"><span>Statut actuel</span><strong>${adjustment?(isAdmin?'Ajustement demandé par le client':'En attente de retour Me&YouToo'):status}</strong></div>${!isAdmin&&project.review_work_in_progress?'<p class="review-client-confirmed"><strong>En cours de vérification par Me&YouToo.</strong> Vous consultez la dernière version transmise. Les corrections en cours restent privées jusqu’à leur envoi par notre équipe.</p>':''}${colorLegend}${adjustmentBanner}${project.status==='ready_to_publish'?`<p class="review-ready">✓ La configuration est validée. Me&YouToo prépare la campagne et ses liens avant leur mise à disposition.</p>`:''}${contentReviewHtml}${translationAlert}${commonReviewHtml||languageReviewHtml?`<div class="review-color-legend is-bottom" aria-label="Rappel de la légende des modifications">${colorLegend.replace(/^<div[^>]*>|<\/div>$/g,'')}</div>`:''}${actions}${history}`;
    bindReviewLanguages(root);
    document.querySelector('.topbar')?.after(root);
    const call=async(url,body={})=>{try{await api(url,{method:'POST',body:JSON.stringify(body)});location.reload();}catch(e){$('validation-alert').hidden=false;$('validation-alert').textContent=e.message;}};
    document.querySelectorAll('.review-edit-target').forEach(link=>link.addEventListener('click',async event=>{if(!isAdmin)return;if(['review_pending','configuration_submitted'].includes(project.status)){event.preventDefault();try{await api(`/api/admin/projects/${projectId}/review/start`,{method:'POST',body:'{}'});location.href=link.href;}catch(error){$('validation-alert').hidden=false;$('validation-alert').textContent=error.message;}}}));
    $('review-start')?.addEventListener('click',()=>call(`/api/admin/projects/${projectId}/review/start`));
    $('review-minor')?.addEventListener('click',()=>call(`/api/admin/projects/${projectId}/review/complete`,{requiresClientValidation:false,summary:$('review-summary').value.trim()}));
    $('review-major')?.addEventListener('click',()=>call(`/api/admin/projects/${projectId}/review/complete`,{requiresClientValidation:true,summary:$('review-summary').value.trim()}));
    document.querySelectorAll('.review-approve-one').forEach(button=>button.addEventListener('click',()=>call(`/api/projects/${projectId}/review/progress`,{acceptedKeys:[...new Set([...acceptedCorrections,button.dataset.correctionKey])]})));
    document.querySelectorAll('.review-adjust-one').forEach(button=>button.addEventListener('click',()=>openAdjustmentDialog(adjustmentTargets,call,button.dataset.correctionLabel)));
    $('review-accept-all')?.addEventListener('click',()=>call(`/api/projects/${projectId}/review/progress`,{acceptedKeys:correctionKeys}));
    $('review-accept')?.addEventListener('click',()=>{if(!allAccepted)return window.StudioModal.alert({title:'Validez toutes les corrections',message:'Chaque correction doit être acceptée avant la confirmation finale. Vous pouvez aussi demander un ajustement sur la ligne concernée.',type:'info'});call(`/api/projects/${projectId}/review/accept`,{acceptedKeys:[...acceptedCorrections],expectedKeys:correctionKeys});});
    $('review-adjust')?.addEventListener('click',()=>openAdjustmentDialog(adjustmentTargets,call));
    const requestedAdjustment=p.get('adjustment');
    if(!isAdmin&&requestedAdjustment&&!window.__studioAdjustmentOpened){
      window.__studioAdjustmentOpened=true;
      requestAnimationFrame(()=>{
        openAdjustmentDialog(adjustmentTargets,call).then(()=>{
          const category=$('adjust-category');
          if(category&&['situation','profile','intro','settings','sociodemo','multiple','other'].includes(requestedAdjustment)){
            category.value=requestedAdjustment;
            category.dispatchEvent(new Event('change',{bubbles:true}));
          }
        });
      });
    }
  }
  async function reviewChaptersAcrossCountries(payload){
    const context=payload.composer_context||{};
    const countries=[...new Set((context.countries||[]).filter(Boolean))];
    if(payload.project?.status==='draft'||countries.length<2)return payload.chapters||[];
    // The submission snapshot contains all countries. Composer returns one country:
    // load every configured scope before deciding that a situation was removed.
    // Reject an incomplete load instead of displaying false deletion notices.
    const currentCountry=context.countryCode||payload.respondent_context?.countryCode;
    const locale=reviewLocale(payload.project?.working_locale||'fr');
    const others=await Promise.all(countries.filter(country=>country!==currentCountry).map(country=>{
      const params=new URLSearchParams({countryCode:country,locale});
      return api(`/api/projects/${projectId}/composer?${params}`);
    }));
    const chapters=new Map();
    for(const view of [payload,...others])for(const chapter of view.chapters||[]){
      if(!chapters.has(String(chapter.id)))chapters.set(String(chapter.id),{...chapter,situations:[]});
      const merged=chapters.get(String(chapter.id));
      const ids=new Set(merged.situations.map(situation=>String(situation.id)));
      for(const situation of chapter.situations||[])if(!ids.has(String(situation.id))){
        merged.situations.push(situation);ids.add(String(situation.id));
      }
    }
    const order=(a,b)=>Number(a.position||0)-Number(b.position||0)||Number(a.id)-Number(b.id);
    return [...chapters.values()].sort(order).map(chapter=>({...chapter,situations:chapter.situations.sort(order)}));
  }
  async function load(){
    try{
      if(!projectId){location.href='mes-campagnes.html';return;}
      const [d,quotaData,me]=await Promise.all([api(`/api/projects/${projectId}/composer`),api(`/api/projects/${projectId}/quota`).catch(()=>({organization:null})),api('/api/me')]);
      project=d.project;reviewEvents=d.reviewEvents||[];currentChapters=await reviewChaptersAcrossCountries(d);currentUser=me.user;studioSubscription=me.studioSubscription||null;if(!theme)theme=project?.theme_slug||'';const chapters=currentChapters,quota=quotaData.organization;
      if(project.status!=='draft'){document.querySelector('.page-title').textContent='Relecture de la configuration';document.querySelector('.topbar .lead').textContent=currentUser?.role==='admin'?'Contrôlez et corrigez la configuration avant sa publication.':'Suivez la relecture Me&YouToo et validez les modifications importantes si nécessaire.';}if(currentUser?.role==='admin')$('validation-credit').hidden=true;
      const socioLabels=[];
      const collectSocio=(criteria,level=1)=>{
        (criteria||[]).forEach(item=>{
          socioLabels.push(level===1?String(item.q||''):`${String(item.q||'')} (niveau ${level})`);
          (item.opts||[]).forEach(option=>{
            const children=Array.isArray(option.subcriteria)?option.subcriteria:(option.subcriterion?[option.subcriterion]:[]);
            children.forEach(child=>{
              socioLabels.push(`${String(child.q||'')} (si « ${String(option.label||'')} »)`);
              collectSocio((child.opts||[]).flatMap(childOption=>Array.isArray(childOption.subcriteria)?childOption.subcriteria:(childOption.subcriterion?[childOption.subcriterion]:[])),level+2);
            });
          });
        });
      };
      collectSocio(project.sociodemo||[]);
      $('validation-theme').textContent=project.theme_title||'Diagnostic comportemental';$('validation-campaign').value=project.campaign_name||project.title||'';$('validation-title').value=project.respondent_title||'';$('validation-launch-date').value=isoDate(project.launch_date);$('validation-close-date').value=isoDate(project.close_date);$('validation-situations').textContent=chapters.reduce((n,c)=>n+c.situations.length,0);$('validation-socio').innerHTML=socioLabels.length?`<span class="validation-socio-count">${socioLabels.length} question${socioLabels.length>1?'s':''}</span><details class="validation-socio-details"><summary>Voir les questions</summary><ul>${socioLabels.map(label=>`<li>${esc(label||'Question à traduire')}</li>`).join('')}</ul></details>`:'Aucune';
      if(currentUser?.role==='admin'&&(pendingIntroTranslationRequests().length||pendingSocioTranslationRequests().length||Object.keys(project.translation_review_state?.situationRequests||{}).length))await refreshTranslationRequestStatus();
      introTranslationRequestPanel();
      renderValidationQuota(quota);
      renderMonthlyCampaignAllowance();
      $('validation-back').href=`parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;
      if(currentUser?.role==='admin'){
        try{
          const versions=await api(`/api/admin/projects/${projectId}/translation-changes`);
          translationChanges=versions.changes||[];translationChangesSupported=versions.supported===true;translationChangesError='';
        }catch(error){translationChangesError=error.message||'Erreur de chargement';}
      }
      if(project.status!=='draft'){
        lockSubmittedState();
        hideSubmittedPreparation();
        reviewPanel();
        window.StudioTutorial?.set('relecture');
        // La frise passe en tête, au-dessus du suivi de relecture.
        const reviewCard=document.querySelector('.review-workflow'),journeyCard=document.querySelector('.studio-process-card:not([hidden])');
        if(reviewCard&&journeyCard)reviewCard.before(journeyCard);
      }else{
        await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:'validation'})});
        const processCard=document.querySelector('.studio-process-card');if(processCard)processCard.hidden=false;
        // Visite seulement avant la transmission : après, la page devient le suivi de relecture.
        window.StudioTour?.offer('validation');
      }
    }catch(e){$('validation-alert').hidden=false;$('validation-alert').textContent=e.message;}
  }
  window.addEventListener('focus',refreshValidationQuota);
  window.addEventListener('pageshow',refreshValidationQuota);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshValidationQuota();});
  $('save-validation-settings').onclick=()=>saveValidationSettings();
  $('submit-project').onclick=async()=>{
    if(!project||project.status!=='draft'){lockSubmittedState();return;}
    const checks=[...document.querySelectorAll('[data-validation-check]')];if(checks.some(c=>!c.checked)){$('validation-alert').hidden=false;$('validation-alert').textContent='Confirmez les trois points avant de transmettre.';return;}
    if(!await saveValidationSettings({silent:true}))return;
    const button=$('submit-project');button.disabled=true;button.textContent='Transmission…';
    try{const result=await api(`/api/projects/${projectId}/submit`,{method:'POST',body:'{}'});project=result.project||project;lockSubmittedState();await window.StudioModal.alert({eyebrow:'Configuration transmise',title:'Votre configuration a bien été transmise',message:(pendingSituationTranslationRequests().length?'Les demandes de traduction des situations et réponses ont été transmises à Me&YouToo. ':'')+(pendingSocioTranslationRequests().length?`Votre demande de traduction des données d’analyse a été transmise à Me&YouToo : ${pendingSocioTranslationRequests().map(row=>reviewLocaleNames[row.locale]||row.locale.toUpperCase()).join(', ')}. `:'')+(pendingIntroTranslationRequests().length?`Votre demande de traduction de l’introduction a été transmise à Me&YouToo : ${pendingIntroTranslationRequests().map(row=>reviewLocaleNames[row.locale]||row.locale.toUpperCase()).join(', ')}. `:'')+'Me&YouToo va en prendre connaissance et la vérifier. Votre configuration est désormais figée pendant cette vérification. En attendant, transmettez-nous votre logo, votre charte graphique et vos éventuelles consignes de communication.',type:'success',confirmLabel:'Transmettre mes éléments graphiques'});location.href=`kit-communication.html?projectId=${encodeURIComponent(projectId)}&theme=${encodeURIComponent(theme)}`;}catch(e){button.disabled=false;button.textContent='Transmettre à Me&YouToo';$('validation-alert').hidden=false;$('validation-alert').textContent=e.message;}
  };
  load();
})();
