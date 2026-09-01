(()=>{
  const p=new URLSearchParams(location.search);let theme=p.get('theme')||'',projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt),$=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
  function reviewPanel(){
    let root=$('review-workflow');if(!root){root=document.createElement('section');root.id='review-workflow';root.className='card review-workflow';document.querySelector('.validation-summary').after(root);}
    const summary=project.review_summary||'Aucun commentaire de relecture pour le moment.',status=statusLabel(project.status),isAdmin=currentUser?.role==='admin';
    const history=reviewEvents.length?`<details class="review-history"><summary>Historique de la relecture</summary>${reviewEvents.map(e=>`<p><strong>${new Date(e.created_at).toLocaleString('fr-FR')}</strong> · ${esc(e.summary||e.event_type)}</p>`).join('')}</details>`:'';
    const snapshot=project.review_snapshot||{},hasReviewSnapshot=Boolean(snapshot.project&&Array.isArray(snapshot.chapters)),beforeProject=snapshot.project||{},beforeChapters=Array.isArray(snapshot.chapters)?snapshot.chapters:[],differences=[];
    const addDiff=(label,before,after)=>{if(String(before??'')!==String(after??''))differences.push([label,String(before??'—'),String(after??'—')]);};
    addDiff('Nom de campagne',beforeProject.campaign_name,project.campaign_name);addDiff('Titre répondants',beforeProject.respondent_title,project.respondent_title);addDiff('Date de lancement',String(beforeProject.launch_date||'').slice(0,10),String(project.launch_date||'').slice(0,10));addDiff('Date de clôture',String(beforeProject.close_date||'').slice(0,10),String(project.close_date||'').slice(0,10));
    const beforeSituations=beforeChapters.flatMap(ch=>(ch.situations||[]).map(s=>({...s,chapter:ch.title}))),afterSituations=currentChapters.flatMap(ch=>(ch.situations||[]).map(s=>({...s,chapter:ch.title}))),beforeSituationMap=new Map(beforeSituations.map(s=>[String(s.id),s])),afterSituationMap=new Map(afterSituations.map(s=>[String(s.id),s]));
    beforeSituationMap.forEach((s,id)=>{const now=afterSituationMap.get(id);if(!now)differences.push([`Situation supprimée · ${s.chapter}`,s.content,'Supprimée']);else if(String(s.content)!==String(now.content))differences.push([`Situation modifiée · ${s.chapter}`,s.content,now.content]);});afterSituationMap.forEach((s,id)=>{if(!beforeSituationMap.has(id))differences.push([`Situation ajoutée · ${s.chapter}`,'Absente',s.content]);});
    const beforeProfiles=beforeChapters.flatMap(ch=>(ch.profiles||[]).map(x=>({...x,chapter:ch.title}))),afterProfiles=currentChapters.flatMap(ch=>(ch.profiles||[]).map(x=>({...x,chapter:ch.title}))),beforeProfileMap=new Map(beforeProfiles.map(x=>[String(x.id),x]));afterProfiles.forEach(now=>{const old=beforeProfileMap.get(String(now.id));if(old&&[old.title,old.summary,old.content].join('|')!==[now.title,now.summary,now.content].join('|'))differences.push([`Profil modifié · ${now.chapter}`,`${old.title} — ${old.summary||old.content}`,`${now.title} — ${now.summary||now.content}`]);});
    const diffHtml=!hasReviewSnapshot?'<p class="review-no-diff">Comparaison indisponible : cette campagne a été transmise avant l’activation du suivi des modifications.</p>':differences.length?`<div class="review-diff"><h3>Modifications depuis la transmission</h3><div class="review-diff-scroll"><table><thead><tr><th>Élément</th><th>Transmis par le client</th><th>Version Me&YouToo</th></tr></thead><tbody>${differences.map(row=>`<tr><th>${esc(row[0])}</th><td>${esc(row[1])}</td><td>${esc(row[2])}</td></tr>`).join('')}</tbody></table></div></div>`:'<p class="review-no-diff">Aucune différence détectée depuis la transmission.</p>';
    let actions='';
    if(isAdmin&&['review_pending','configuration_submitted'].includes(project.status))actions=`<button class="button button-primary" id="review-start" type="button">Commencer la relecture</button>`;
    if(isAdmin&&project.status==='in_review')actions=`<div class="review-edit-links"><a class="button button-secondary" href="composer.html?projectId=${projectId}">Corriger les situations</a><a class="button button-secondary" href="personnalisation.html?projectId=${projectId}">Corriger les profils</a><a class="button button-secondary" href="parametrage.html?projectId=${projectId}">Corriger le paramétrage</a></div><label class="field"><span>Résumé des corrections</span><textarea id="review-summary" rows="4" placeholder="Décrivez brièvement les corrections effectuées…"></textarea></label><div class="top-actions"><button class="button button-primary" id="review-minor" type="button">Corrections mineures · Prête à publier</button><button class="button button-secondary" id="review-major" type="button">Modifications importantes · Faire valider</button></div>`;
    if(!isAdmin&&project.status==='client_validation_required')actions=`<div class="review-client-decision"><p><strong>Modifications proposées par Me&YouToo</strong></p><p>${esc(summary)}</p><label class="field"><span>Question ou ajustement demandé</span><textarea id="review-adjustment" rows="3" placeholder="À remplir uniquement si vous demandez un ajustement"></textarea></label><div class="top-actions"><button class="button button-primary" id="review-accept" type="button">J’accepte les modifications</button><button class="button button-secondary" id="review-adjust" type="button">Demander un ajustement</button></div></div>`;
    root.innerHTML=`<p class="eyebrow">Contrôle qualité</p><h2 class="section-title">Relecture Me&YouToo</h2><div class="review-status"><span>Statut actuel</span><strong>${status}</strong></div>${project.status==='ready_to_publish'?`<p class="review-ready">✓ La relecture est terminée. La campagne peut être programmée ou publiée.</p>`:''}${project.status!=='review_pending'&&project.status!=='configuration_submitted'?diffHtml:''}${actions}${history}`;
    const call=async(url,body={})=>{try{await api(url,{method:'POST',body:JSON.stringify(body)});location.reload();}catch(e){$('validation-alert').hidden=false;$('validation-alert').textContent=e.message;}};
    $('review-start')?.addEventListener('click',()=>call(`/api/admin/projects/${projectId}/review/start`));
    $('review-minor')?.addEventListener('click',()=>call(`/api/admin/projects/${projectId}/review/complete`,{requiresClientValidation:false,summary:$('review-summary').value.trim()}));
    $('review-major')?.addEventListener('click',()=>call(`/api/admin/projects/${projectId}/review/complete`,{requiresClientValidation:true,summary:$('review-summary').value.trim()}));
    $('review-accept')?.addEventListener('click',()=>call(`/api/projects/${projectId}/review/accept`));
    $('review-adjust')?.addEventListener('click',()=>call(`/api/projects/${projectId}/review/request-adjustment`,{message:$('review-adjustment').value.trim()}));
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
