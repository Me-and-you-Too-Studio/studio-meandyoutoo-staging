(function(){
  var resolvedTheme='';
  var projectDataPromise=null;

  function params(){return new URLSearchParams(location.search);}
  function projectId(){return params().get('projectId')||'';}
  function theme(){return String(params().get('theme')||resolvedTheme||'').trim();}
  function query(id){
    var q=new URLSearchParams();
    var currentTheme=theme();
    if(currentTheme)q.set('theme',currentTheme);
    if(id)q.set('projectId',id);
    var value=q.toString();
    return value?'?'+value:'';
  }
  function link(page,id){return page+query(id||projectId());}

  async function fetchProjectData(){
    var id=projectId();
    if(!id)return null;
    if(!projectDataPromise)projectDataPromise=window.StudioAPI.request('/api/projects/'+encodeURIComponent(id)+'/composer');
    return projectDataPromise;
  }
  async function ensureTheme(){
    var current=theme();
    if(current)return current;
    var data=await fetchProjectData();
    var realTheme=String(data&&data.project&&data.project.theme_slug||'').trim();
    if(!realTheme)throw new Error('Le thème réel de ce projet est absent des données API.');
    resolvedTheme=realTheme;
    return realTheme;
  }
  function esc(value){return String(value??'').replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});}
  async function bindProjectIdentity(){
    var id=projectId();if(!id)return;
    try{
      var data=await fetchProjectData(),project=data&&data.project||{};
      var host=document.querySelector('.topbar > div:first-child');if(!host||document.getElementById('project-context-identity'))return;
      var client=String(project.organization_name||'').trim();
      var campaign=String(project.campaign_name||project.title||project.respondent_title||project.theme_title||'').trim();
      var items=[];
      if(client)items.push('<span class="meta">Client : <strong>'+esc(client)+'</strong></span>');
      if(campaign)items.push('<span class="meta">Campagne : <strong>'+esc(campaign)+'</strong></span>');
      items.push('<span class="meta">Projet #'+esc(id)+'</span>');
      var strip=document.createElement('div');strip.id='project-context-identity';strip.className='meta-row';strip.style.marginBottom='10px';strip.innerHTML=items.join('');
      host.insertBefore(strip,host.firstChild);
      var legacy=document.getElementById('composer-client-name');if(legacy)legacy.hidden=true;
    }catch(error){console.warn('Identité projet indisponible',error);}
  }

  // Compte limité à plusieurs dossiers d’équipe : il choisit celui de la nouvelle campagne (un seul dossier : choisi d’office par l’API).
  async function chooseTeamFolder(){
    var user=window.StudioAPI.user()||{};
    if(user.campaignScope!=='folders')return null;
    var folders=(await window.StudioAPI.request('/api/campaign-folders')).teamFolders||[];
    if(folders.length<2)return null;
    return new Promise(function(resolve,reject){
      var dialog=document.createElement('dialog');dialog.className='admin-dialog access-dialog';
      dialog.innerHTML='<form method="dialog"><p class="eyebrow">Nouvelle campagne</p><h2>Dans quel dossier d’équipe ?</h2><p>La campagne sera visible de l’équipe de ce dossier et de la direction.</p><div class="field"><label for="team-folder-choice">Dossier d’équipe</label><select id="team-folder-choice">'+folders.map(function(f){return '<option value="'+esc(f.id)+'">📁 '+esc(f.name)+'</option>';}).join('')+'</select></div><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" value="ok">Continuer</button></div></form>';
      document.body.appendChild(dialog);
      dialog.addEventListener('close',function(){var value=dialog.querySelector('select').value,ok=dialog.returnValue==='ok';dialog.remove();if(ok)resolve(value);else reject(new Error('Création annulée : choisissez le dossier d’équipe de la campagne.'));});
      dialog.showModal();
    });
  }
  async function createProject(themeSlug,startMode,confirmedSelection,variant){
    var selected=String(themeSlug||theme()||'').trim();
    if(!selected)throw new Error('Aucune thématique n’a été sélectionnée. Le Studio ne choisit pas de thème par défaut.');
    var teamFolderId=startMode==='resume'?null:await chooseTeamFolder();
    var data=await window.StudioAPI.request('/api/projects/from-template',{
      method:'POST',
      body:JSON.stringify({
        themeSlug:selected,
        teamFolderId:teamFolderId,
        organizationId:window.StudioAPI.organizationId(),
        startMode:startMode==='resume'?'resume':'new',
        creationIntent:confirmedSelection===true?'confirmed-theme-selection':'',
        culturalScope:variant&&variant.culturalScope||'',
        countryCode:variant&&variant.countryCode||'',
        locale:variant&&variant.locale||'',
        countryCodes:variant&&variant.countryCodes||[],
        locales:variant&&variant.locales||[],
        localesByCountry:variant&&variant.localesByCountry||{},
        choiceSelections:variant&&variant.choiceSelections||{}
      })
    });
    return data.project;
  }
  function createNew(themeSlug,confirmedSelection,variant){return createProject(themeSlug,'new',confirmedSelection,variant);}
  function createOrResume(themeSlug){return createProject(themeSlug,'resume');}
  window.StudioProject={projectId:projectId,theme:theme,query:query,link:link,ensureTheme:ensureTheme,createNew:createNew,createOrResume:createOrResume,fetchProjectData:fetchProjectData};

  async function bindStepLinks(){
    var id=projectId();
    var currentTheme='';
    try{currentTheme=await ensureTheme();}catch(error){
      if(!id)currentTheme='';
      else console.error(error);
    }
    document.querySelectorAll('[data-step-page]').forEach(function(stepLink){
      var page=stepLink.dataset.stepPage;
      var q=new URLSearchParams();
      if(currentTheme)q.set('theme',currentTheme);
      if(id)q.set('projectId',id);
      var qs=q.toString();
      stepLink.href=page+(qs?'?'+qs:'');
    });
  }
  function init(){bindStepLinks();bindProjectIdentity();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
