(()=>{
  const p=new URLSearchParams(location.search);let theme=p.get('theme')||'',projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt),$=id=>document.getElementById(id);
  let project=null;
  const date=v=>{if(!v)return 'À définir';const raw=String(v),day=raw.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return 'À définir';const parsed=new Date(day+'T12:00:00');return Number.isNaN(parsed.getTime())?'À définir':parsed.toLocaleDateString('fr-FR');};
  const statusLabel=status=>({configuration_submitted:'Configuration transmise',scheduled:'Campagne programmée',published:'Campagne publiée',active:'Campagne publiée',unpublished:'Campagne dépubliée',closed:'Campagne terminée',completed:'Campagne terminée',archived:'Campagne archivée'}[status]||'Configuration verrouillée');
  function lockSubmittedState(){
    document.querySelectorAll('[data-validation-check]').forEach(c=>{c.disabled=true;c.closest('label')?.style.setProperty('opacity','.6');});
    const submit=$('submit-project');
    if(submit){submit.disabled=true;submit.classList.add('is-disabled');submit.textContent=statusLabel(project?.status);}
    const back=$('validation-back');if(back){back.hidden=false;back.textContent='← Revoir le paramétrage';}
    const alert=$('validation-alert');
    if(alert){alert.hidden=false;alert.dataset.tone='success';alert.innerHTML='<strong>🔒 Transmission verrouillée.</strong> La configuration a déjà été transmise à Me&YouToo et ne peut plus être modifiée. Pour demander un changement, <a href="contact.html" style="text-decoration:underline;font-weight:900">contactez Me&YouToo</a>.';}
    const checkSection=document.querySelector('[data-validation-check]')?.closest('section');
    if(checkSection)checkSection.style.background='var(--royal-blue-tint)';
  }
  async function load(){
    try{
      if(!projectId){location.href='mes-campagnes.html';return;}
      const [d,quotaData]=await Promise.all([api(`/api/projects/${projectId}/composer`),api('/api/me/organization-quota').catch(()=>({organization:null}))]);
      project=d.project;if(!theme)theme=project?.theme_slug||'';const chapters=d.chapters||[],quota=quotaData.organization;
      const socioLabels=(project.sociodemo||[]).flatMap(item=>[item.q,...(item.opts||[]).filter(option=>option.subcriterion).map(option=>`${option.subcriterion.q} (si « ${option.label} »)`)]);
      $('validation-theme').textContent=project.theme_title||'Autodiagnostic';$('validation-campaign').textContent=project.campaign_name||project.title;$('validation-dates').textContent=`${date(project.launch_date)} – ${date(project.close_date)}`;$('validation-title').textContent=project.respondent_title||'—';$('validation-situations').textContent=chapters.reduce((n,c)=>n+c.situations.length,0);$('validation-socio').textContent=socioLabels.join(', ')||'Aucune';
      const need=Number(project.estimated_respondents)||0,remaining=quota?Number(quota.passations_remaining)||0:0;$('validation-credit-needed').textContent=need?need.toLocaleString('fr-FR'):'—';$('validation-credit-remaining').textContent=quota?remaining.toLocaleString('fr-FR'):'À confirmer';$('validation-credit-status').textContent=!quota?'À confirmer par Me&YouToo':(!need?'Volume facultatif non renseigné':(remaining>=need?'Solde suffisant':'Solde insuffisant'));$('validation-credit-status').style.color=quota&&need&&remaining<need?'var(--danger)':'';
      $('validation-back').href=`parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;
      if(project.status!=='draft')lockSubmittedState();else await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:'validation'})});
    }catch(e){$('validation-alert').hidden=false;$('validation-alert').textContent=e.message;}
  }
  $('submit-project').onclick=async()=>{
    if(!project||project.status!=='draft'){lockSubmittedState();return;}
    const checks=[...document.querySelectorAll('[data-validation-check]')];if(checks.some(c=>!c.checked)){$('validation-alert').hidden=false;$('validation-alert').textContent='Confirmez les trois points avant de transmettre.';return;}
    const button=$('submit-project');button.disabled=true;button.textContent='Transmission…';
    try{const result=await api(`/api/projects/${projectId}/submit`,{method:'POST',body:'{}'});project=result.project||project;lockSubmittedState();await window.StudioModal.alert({eyebrow:'Configuration transmise',title:'Votre configuration a bien été transmise',message:'Me&YouToo va en prendre connaissance et la vérifier. Votre configuration est désormais figée pendant cette vérification. En attendant, transmettez-nous votre logo, votre charte graphique et vos éventuelles consignes de communication.',type:'success',confirmLabel:'Transmettre mes éléments graphiques'});location.href=`kit-communication.html?projectId=${encodeURIComponent(projectId)}&theme=${encodeURIComponent(theme)}`;}catch(e){button.disabled=false;button.textContent='Transmettre à Me&YouToo';$('validation-alert').hidden=false;$('validation-alert').textContent=e.message;}
  };
  load();
})();