(()=>{
  const p=new URLSearchParams(location.search),theme=p.get('theme')||'sexisme',projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt);const $=id=>document.getElementById(id);
  const date=v=>v?new Date(v+'T12:00:00').toLocaleDateString('fr-FR'):'À définir';
  async function load(){
    try{
      if(!projectId){location.href='mes-campagnes.html';return;}
      const d=await api(`/api/projects/${projectId}/composer`),project=d.project,chapters=d.chapters||[];
      $('validation-theme').textContent=project.theme_title;$('validation-campaign').textContent=project.campaign_name||project.title;$('validation-dates').textContent=`${date(project.launch_date)} – ${date(project.close_date)}`;$('validation-title').textContent=project.respondent_title||'—';$('validation-situations').textContent=chapters.reduce((n,c)=>n+c.situations.length,0);$('validation-socio').textContent=(project.sociodemo||[]).map(x=>x.q).join(', ')||'Aucune';
      $('validation-back').href=`parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;
      await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:'validation'})});
    }catch(e){$('validation-alert').hidden=false;$('validation-alert').textContent=e.message;}
  }
  $('submit-project').onclick=async()=>{
    const checks=[...document.querySelectorAll('[data-validation-check]')];if(checks.some(c=>!c.checked)){$('validation-alert').hidden=false;$('validation-alert').textContent='Confirmez les trois points avant de transmettre.';return;}
    try{await api(`/api/projects/${projectId}/submit`,{method:'POST',body:'{}'});location.href='mes-campagnes.html?submitted=1';}catch(e){$('validation-alert').hidden=false;$('validation-alert').textContent=e.message;}
  };
  load();
})();
