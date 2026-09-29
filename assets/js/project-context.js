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

  async function createProject(themeSlug,startMode,confirmedSelection,variant){
    var selected=String(themeSlug||theme()||'').trim();
    if(!selected)throw new Error('Aucune thématique n’a été sélectionnée. Le Studio ne choisit pas de thème par défaut.');
    var data=await window.StudioAPI.request('/api/projects/from-template',{
      method:'POST',
      body:JSON.stringify({
        themeSlug:selected,
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
