(()=>{
  const p=new URLSearchParams(location.search);let theme=p.get('theme')||'',projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt),$=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain=value=>{const html=String(value??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>\s*<p[^>]*>/gi,'\n\n');const box=document.createElement('div');box.innerHTML=html;return (box.textContent||'').replace(/\u00a0/g,' ').replace(/\n{3,}/g,'\n\n').trim();};
  function wordDiff(before,after,admin=false){
    const a=plain(before).split(/(\s+|[.,;:!?\"'()«»–—-])/).filter(Boolean),b=plain(after).split(/(\s+|[.,;:!?\"'()«»–—-])/).filter(Boolean),n=a.length,m=b.length,dp=Array.from({length:n+1},()=>Array(m+1).fill(0));
    for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
    let i=0,j=0,out='';while(i<n||j<m){if(i<n&&j<m&&a[i]===b[j]){out+=esc(a[i]);i++;j++;}else if(j<m&&(i===n||dp[i][j+1]>=(dp[i+1]?.[j]||0))){out+=`<ins class="${admin?'is-admin':''}">${esc(b[j])}</ins>`;j++;}else{out+=`<del class="${admin?'is-admin':''}">${esc(a[i])}</del>`;i++;}}return out;
  }
  let project=null,currentUser=null,reviewEvents=[],currentChapters=[];
  const date=v=>{if(!v)return 'À définir';const raw=String(v),day=raw.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return 'À définir';const parsed=new Date(day+'T12:00:00');return Number.isNaN(parsed.getTime())?'À définir':parsed.toLocaleDateString('fr-FR');};
  const statusLabel=status=>({configuration_submitted:'À relire par Me&YouToo',review_pending:'À relire par Me&YouToo',in_review:'En cours de relecture',client_validation_required:'Votre validation est requise',ready_to_publish:'Prête à publier',scheduled:'Campagne programmée',published:'Campagne publiée',active:'Campagne publiée',unpublished:'Campagne dépubliée',closed:'Campagne terminée',completed:'Campagne terminée',archived:'Campagne archivée'}[status]||'Configuration verrouillée');
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
  async function refreshValidationQuota(){
    if(document.hidden||!project||currentUser?.role==='admin'||Date.now()-lastQuotaRefresh<800)return;
    lastQuotaRefresh=Date.now();
    try{const quotaData=await api('/api/me/organization-quota');renderValidationQuota(quotaData.organization);}catch(error){console.warn('Actualisation des passations impossible',error);}
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
  async function openAdjustmentDialog(differences,call){
    document.getElementById('adjustment-dialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='adjustment-dialog';dialog.className='admin-dialog adjustment-dialog';
    const targets=differences.map((row,index)=>({key:`difference:${index}`,label:row[0],category:/profil/i.test(row[0])?'profile':/introduction/i.test(row[0])?'intro':/date|campagne|titre répondants/i.test(row[0])?'settings':'situation'}));
    dialog.innerHTML=`<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Demande ciblée</p><h2>Que souhaitez-vous faire ajuster ?</h2><p>Votre configuration reste verrouillée. Me&YouToo reprendra uniquement les éléments que vous signalez.</p><label class="field"><span>Nature de la demande</span><select id="adjust-category"><option value="">Choisir…</option><option value="situation">Une situation ou une réponse</option><option value="profile">Un profil</option><option value="intro">L’introduction</option><option value="settings">Les dates ou les titres</option><option value="multiple">Plusieurs éléments</option><option value="other">Autre demande</option></select></label><fieldset class="adjust-targets" id="adjust-targets"><legend>Éléments concernés</legend>${targets.map(t=>`<label data-category="${t.category}"><input type="checkbox" value="${esc(t.key)}" data-label="${esc(t.label)}"> <span>${esc(t.label)}</span></label>`).join('')||'<p>Aucune différence détaillée disponible.</p>'}</fieldset><label class="field"><span>Expliquez le résultat attendu <small>(10 caractères minimum)</small></span><textarea id="adjust-message" rows="5" placeholder="Ex. : conserver la formulation du client dans la situation 3, mais remplacer le dernier terme…"></textarea></label><div class="adjust-summary" id="adjust-summary">Sélectionnez une catégorie et les éléments concernés.</div><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="adjust-send" type="button">Vérifier et envoyer</button></div></form>`;
    document.body.append(dialog);const category=$('adjust-category'),targetBox=$('adjust-targets'),summaryBox=$('adjust-summary');
    const update=()=>{const value=category.value;targetBox.querySelectorAll('label').forEach(label=>{label.hidden=Boolean(value&&!['multiple','other'].includes(value)&&label.dataset.category!==value);});const selected=[...targetBox.querySelectorAll('input:checked')];summaryBox.innerHTML=selected.length?`<strong>${selected.length} élément${selected.length>1?'s':''} signalé${selected.length>1?'s':''}</strong><br>${selected.map(x=>esc(x.dataset.label)).join('<br>')}`:'Sélectionnez précisément ce que Me&YouToo doit reprendre.';};category.onchange=update;targetBox.onchange=update;
    $('adjust-send').onclick=async()=>{const message=$('adjust-message').value.trim(),selected=[...targetBox.querySelectorAll('input:checked:not([hidden])')].filter(x=>!x.closest('label').hidden),cat=category.value;if(!cat)return window.StudioModal.alert({title:'Choisissez la nature de la demande',message:'Cela permettra à Me&YouToo de traiter votre retour sans ambiguïté.',type:'info'});if(cat!=='other'&&!selected.length)return window.StudioModal.alert({title:'Sélectionnez au moins un élément',message:'Cochez la ou les corrections concernées.',type:'info'});if(message.length<10)return window.StudioModal.alert({title:'Précisez le résultat attendu',message:'Votre commentaire doit contenir au moins 10 caractères.',type:'info'});const chosen=selected.map(x=>({key:x.value,label:x.dataset.label})),ok=await window.StudioModal.confirm({eyebrow:'Confirmation',title:'Envoyer cette demande d’ajustement ?',message:`${chosen.length||'Aucun'} élément ciblé. Votre commentaire : « ${message} »`,confirmLabel:'Envoyer à Me&YouToo',cancelLabel:'Relire ma demande'});if(ok){dialog.close();await call(`/api/projects/${projectId}/review/request-adjustment`,{message,category:cat,targets:chosen});}};dialog.showModal();
  }
  function reviewPanel(){
    let root=$('review-workflow');if(!root){root=document.createElement('section');root.id='review-workflow';root.className='card review-workflow';document.querySelector('.validation-summary').after(root);}
    const summary=project.review_summary||'Aucun commentaire de relecture pour le moment.',status=statusLabel(project.status),isAdmin=currentUser?.role==='admin';
    const history=reviewEvents.length?`<details class="review-history"><summary>Historique de la relecture</summary>${reviewEvents.map(e=>`<p><strong>${new Date(e.created_at).toLocaleString('fr-FR')}</strong> · ${esc(e.summary||e.event_type)}</p>`).join('')}</details>`:'';
    const snapshot=project.review_snapshot||{},hasReviewSnapshot=Boolean(snapshot.project&&Array.isArray(snapshot.chapters)),beforeProject=snapshot.project||{},beforeChapters=Array.isArray(snapshot.chapters)?snapshot.chapters:[],clientDifferences=[],adminDifferences=[];
    const addClientDiff=(label,reference,client,href='')=>{if(plain(reference)!==plain(client))clientDifferences.push([label,plain(reference)||'—',plain(client)||'—',href]);};
    const addAdminDiff=(label,client,current,href='')=>{if(plain(client)!==plain(current))adminDifferences.push([label,plain(client)||'—',plain(current)||'—',href]);};
    const settingsLink=`parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1`;
    addClientDiff('Nom de campagne',project.base_title,beforeProject.campaign_name,settingsLink);addClientDiff('Titre répondants',project.respondent_title_default,beforeProject.respondent_title,settingsLink);addClientDiff('Introduction du diagnostic',project.theme_introduction_html,beforeProject.introduction_html,settingsLink);
    addAdminDiff('Nom de campagne',beforeProject.campaign_name,project.campaign_name,settingsLink);addAdminDiff('Titre répondants',beforeProject.respondent_title,project.respondent_title,settingsLink);addAdminDiff('Introduction du diagnostic',beforeProject.introduction_html,project.introduction_html,settingsLink);addAdminDiff('Date de lancement',String(beforeProject.launch_date||'').slice(0,10),String(project.launch_date||'').slice(0,10),settingsLink);addAdminDiff('Date de clôture',String(beforeProject.close_date||'').slice(0,10),String(project.close_date||'').slice(0,10),settingsLink);
    const beforeSituations=beforeChapters.flatMap((ch,ci)=>(ch.situations||[]).map((s,si)=>({...s,chapter:ch.title,chapterNumber:ci+1,situationNumber:si+1}))),afterSituations=currentChapters.flatMap((ch,ci)=>(ch.situations||[]).map((s,si)=>({...s,chapter:ch.title,chapterNumber:ci+1,situationNumber:si+1}))),beforeSituationMap=new Map(beforeSituations.map(s=>[String(s.id),s])),afterSituationMap=new Map(afterSituations.map(s=>[String(s.id),s]));
    beforeSituationMap.forEach((s,id)=>{const now=afterSituationMap.get(id),label=`Partie ${s.chapterNumber} · ${s.chapter} · Situation ${s.situationNumber}`,href=`composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1&chapter=${s.chapterNumber-1}&situation=${encodeURIComponent(id)}`;if(now){addClientDiff(`${label} · Texte`,now.original_content,s.content,href);(s.answers||[]).forEach((answer,ai)=>{const original=(now.original_answers||[]).find(a=>String(a.id)===String(answer.id));if(original)addClientDiff(`${label} · Réponse ${ai+1}`,original.content,answer.content,href);});}if(!now)adminDifferences.push([`${label} · supprimée`,plain(s.content),'Supprimée',href]);else{addAdminDiff(`${label} · Texte`,s.content,now.content,href);(s.answers||[]).forEach((answer,ai)=>{const current=(now.answers||[]).find(a=>String(a.id)===String(answer.id));if(current)addAdminDiff(`${label} · Réponse ${ai+1}`,answer.content,current.content,href);});}});afterSituationMap.forEach((s,id)=>{if(!beforeSituationMap.has(id)){const href=`composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1&chapter=${s.chapterNumber-1}&situation=${encodeURIComponent(id)}`;adminDifferences.push([`Partie ${s.chapterNumber} · ${s.chapter} · Situation ${s.situationNumber} · ajoutée`,'Absente',plain(s.content),href]);}});
    const beforeProfiles=beforeChapters.flatMap((ch,ci)=>(ch.profiles||[]).map((x,pi)=>({...x,chapter:ch.title,chapterNumber:ci+1,profileNumber:pi+1}))),afterProfiles=currentChapters.flatMap((ch,ci)=>(ch.profiles||[]).map((x,pi)=>({...x,chapter:ch.title,chapterNumber:ci+1,profileNumber:pi+1}))),beforeProfileMap=new Map(beforeProfiles.map(x=>[String(x.id),x])),levels=['rouge','jaune','vert'];afterProfiles.forEach(now=>{const old=beforeProfileMap.get(String(now.id));if(!old)return;const base=`Partie ${now.chapterNumber} · ${now.chapter} · Profil ${now.profileNumber}/3 · Niveau ${levels[now.profileNumber-1]||now.color||'non défini'}`,href=`personnalisation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1&chapter=${now.chapterNumber-1}&profile=${encodeURIComponent(now.id)}`;[['Titre','title','original_title'],['Résumé','summary','original_summary'],['Contenu détaillé','content','original_content']].forEach(([label,key,originalKey])=>{addClientDiff(`${base} · ${label}`,now[originalKey],old[key],href);addAdminDiff(`${base} · ${label}`,old[key],now[key],href);});});
    const comparisonTable=(title,description,rows,leftTitle,rightTitle,rightClass,adminColors=false)=>rows.length?`<div class="review-diff"><div class="review-diff-head"><div><h3>${esc(title)}</h3><p>${esc(description)}</p></div><div class="review-version-legend"><span class="is-removed">Rouge : supprimé</span><span class="${adminColors?'is-meayt':'is-client-added'}">${adminColors?'Violet : Me&YouToo':'Vert : ajouté par le client'}</span></div></div><div class="review-diff-scroll"><table><thead><tr><th>Élément contrôlé</th><th>${esc(leftTitle)}</th><th class="${rightClass}">${esc(rightTitle)}</th></tr></thead><tbody>${rows.map(row=>`<tr><th>${isAdmin&&row[3]?`<a class="review-edit-target" href="${esc(row[3])}" title="Ouvrir directement cet élément">${esc(row[0])}<span>Modifier →</span></a>`:esc(row[0])}</th><td>${esc(row[1])}</td><td class="${rightClass} review-word-diff ${adminColors?'is-admin-diff':''}">${wordDiff(row[1],row[2],adminColors)}</td></tr>`).join('')}</tbody></table></div></div>`:'';
    const clientDiffHtml=!hasReviewSnapshot?'<p class="review-no-diff">La comparaison n’est pas disponible pour cette ancienne transmission.</p>':clientDifferences.length?comparisonTable('Adaptations transmises par le client','Cliquez sur une modification pour ouvrir directement l’élément concerné.',clientDifferences,'Référentiel Me&YouToo','Version transmise par le client','review-client-version',false):'<p class="review-no-diff review-no-diff-success">✓ Le client n’a modifié aucun texte du référentiel.</p>';
    const adminDiffHtml=hasReviewSnapshot&&adminDifferences.length?comparisonTable('Corrections apportées par Me&YouToo','Ces éléments diffèrent maintenant de la version transmise par le client.',adminDifferences,'Version transmise par le client','Version Me&YouToo','review-meayt-version',true):'';
    const differences=adminDifferences;
    let actions='';
    if(isAdmin&&['review_pending','configuration_submitted'].includes(project.status))actions=`<div class="review-action-intro"><strong>Étape suivante : démarrer le contrôle</strong><span>Les adaptations du client sont affichées ci-dessus. Commencez la vérification ; vous pourrez ensuite valider directement la configuration ou ouvrir uniquement la partie qui nécessite une correction.</span></div><button class="button button-primary" id="review-start" type="button">Commencer la vérification</button>`;
    if(isAdmin&&project.status==='in_review')actions=`<div class="review-correction-mode"><strong>Vérifiez, puis corrigez uniquement si nécessaire</strong><span>Vous pouvez valider directement la configuration. Si un élément doit être repris, ouvrez la partie correspondante sans effacer la version transmise par le client.</span></div><div class="review-edit-links"><a class="button button-secondary" href="composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1">Vérifier / corriger les situations</a><a class="button button-secondary" href="personnalisation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1">Vérifier / corriger les profils</a><a class="button button-secondary" href="parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}&review=1">Vérifier / corriger les paramètres</a></div><label class="field"><span>Résumé visible par le client <small>à renseigner si vous avez effectué des corrections</small></span><textarea id="review-summary" rows="4" placeholder="Expliquez brièvement les corrections effectuées…"></textarea></label><div class="top-actions"><button class="button button-primary" id="review-minor" type="button">Valider la configuration · Prête à publier</button><button class="button button-secondary" id="review-major" type="button">Envoyer les corrections au client</button></div>`;
    if(!isAdmin&&project.status==='client_validation_required')actions=`<div class="review-client-decision"><p><strong>Me&YouToo vous propose une version corrigée</strong></p><p>Votre version transmise reste visible dans la colonne bleue. La version corrigée par Me&YouToo apparaît dans la colonne corail.</p><p class="review-summary-copy"><strong>Résumé de la relecture :</strong> ${esc(summary)}</p><div class="top-actions"><button class="button button-primary" id="review-accept" type="button">J’accepte la version Me&YouToo</button><button class="button button-secondary" id="review-adjust" type="button">Demander un ajustement ciblé</button></div></div>`;
    if(isAdmin&&project.status==='ready_to_publish')actions=`<div class="review-ready-action"><strong>✓ La version a été validée par le client</strong><span>La relecture est terminée. Vous pouvez passer à la dernière vérification et publier la campagne.</span><a class="button button-primary" href="client.html?organizationId=${encodeURIComponent(project.organization_id||'')}&projectId=${encodeURIComponent(projectId)}&publish=1">🚀 Passer à la publication</a></div>`;
    if(!isAdmin&&project.status==='ready_to_publish')actions=`<div class="review-client-confirmed"><strong>✓ Votre validation est bien enregistrée</strong><span>Me&YouToo prépare maintenant la publication de votre campagne. Vous serez informé(e) dès que ses liens seront disponibles.</span></div>`;
    const adjustment=project.status==='in_review'?[...reviewEvents].find(e=>e.event_type==='client_adjustment_requested'):null,meta=adjustment?.metadata||{},adjustmentBanner=adjustment?`<div class="review-adjustment-pending"><strong>↻ Ajustement demandé par le client</strong><p>${esc(adjustment.summary)}</p>${meta.targets?.length?`<ul>${meta.targets.map(t=>`<li>${esc(t.label)}</li>`).join('')}</ul>`:''}</div>`:'';
    root.innerHTML=`<p class="eyebrow">Contrôle qualité</p><h2 class="section-title">Relecture Me&YouToo</h2><div class="review-status ${adjustment?'is-adjustment':''}"><span>Statut actuel</span><strong>${adjustment?'Ajustement demandé par le client':status}</strong></div>${adjustmentBanner}${project.status==='ready_to_publish'?`<p class="review-ready">✓ La relecture est terminée. La campagne peut être programmée ou publiée.</p>`:''}${clientDiffHtml}${adminDiffHtml}${actions}${history}`;
    document.querySelector('.topbar')?.after(root);
    const call=async(url,body={})=>{try{await api(url,{method:'POST',body:JSON.stringify(body)});location.reload();}catch(e){$('validation-alert').hidden=false;$('validation-alert').textContent=e.message;}};
    document.querySelectorAll('.review-edit-target').forEach(link=>link.addEventListener('click',async event=>{if(!isAdmin)return;if(['review_pending','configuration_submitted'].includes(project.status)){event.preventDefault();try{await api(`/api/admin/projects/${projectId}/review/start`,{method:'POST',body:'{}'});location.href=link.href;}catch(error){$('validation-alert').hidden=false;$('validation-alert').textContent=error.message;}}}));
    $('review-start')?.addEventListener('click',()=>call(`/api/admin/projects/${projectId}/review/start`));
    $('review-minor')?.addEventListener('click',()=>call(`/api/admin/projects/${projectId}/review/complete`,{requiresClientValidation:false,summary:$('review-summary').value.trim()}));
    $('review-major')?.addEventListener('click',()=>call(`/api/admin/projects/${projectId}/review/complete`,{requiresClientValidation:true,summary:$('review-summary').value.trim()}));
    $('review-accept')?.addEventListener('click',()=>call(`/api/projects/${projectId}/review/accept`));
    $('review-adjust')?.addEventListener('click',()=>openAdjustmentDialog(differences,call));
  }
  async function load(){
    try{
      if(!projectId){location.href='mes-campagnes.html';return;}
      const [d,quotaData,me]=await Promise.all([api(`/api/projects/${projectId}/composer`),api('/api/me/organization-quota').catch(()=>({organization:null})),api('/api/me')]);
      project=d.project;reviewEvents=d.reviewEvents||[];currentChapters=d.chapters||[];currentUser=me.user;if(!theme)theme=project?.theme_slug||'';const chapters=currentChapters,quota=quotaData.organization;
      if(project.status!=='draft'){document.querySelector('.page-title').textContent='Relecture de la configuration';document.querySelector('.topbar .lead').textContent=currentUser?.role==='admin'?'Contrôlez et corrigez la configuration avant sa publication.':'Suivez la relecture Me&YouToo et validez les modifications importantes si nécessaire.';}if(currentUser?.role==='admin')$('validation-credit').hidden=true;
      const socioLabels=(project.sociodemo||[]).flatMap(item=>[item.q,...(item.opts||[]).filter(option=>option.subcriterion).map(option=>`${option.subcriterion.q} (si « ${option.label} »)`)]);
      $('validation-theme').textContent=project.theme_title||'Autodiagnostic';$('validation-campaign').value=project.campaign_name||project.title||'';$('validation-title').value=project.respondent_title||'';$('validation-launch-date').value=isoDate(project.launch_date);$('validation-close-date').value=isoDate(project.close_date);$('validation-situations').textContent=chapters.reduce((n,c)=>n+c.situations.length,0);$('validation-socio').textContent=socioLabels.join(', ')||'Aucune';
      renderValidationQuota(quota);
      $('validation-back').href=`parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;
      if(project.status!=='draft'){
        lockSubmittedState();
        reviewPanel();
      }else{
        await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:'validation'})});
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
    try{const result=await api(`/api/projects/${projectId}/submit`,{method:'POST',body:'{}'});project=result.project||project;lockSubmittedState();await window.StudioModal.alert({eyebrow:'Configuration transmise',title:'Votre configuration a bien été transmise',message:'Me&YouToo va en prendre connaissance et la vérifier. Votre configuration est désormais figée pendant cette vérification. En attendant, transmettez-nous votre logo, votre charte graphique et vos éventuelles consignes de communication.',type:'success',confirmLabel:'Transmettre mes éléments graphiques'});location.href=`kit-communication.html?projectId=${encodeURIComponent(projectId)}&theme=${encodeURIComponent(theme)}`;}catch(e){button.disabled=false;button.textContent='Transmettre à Me&YouToo';$('validation-alert').hidden=false;$('validation-alert').textContent=e.message;}
  };
  load();
})();
