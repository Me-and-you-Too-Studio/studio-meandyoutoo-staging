(function(){
  var resolvedTheme='';

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

  async function ensureTheme(){
    var current=theme();
    if(current)return current;
    var id=projectId();
    if(!id)return '';
    var data=await window.StudioAPI.request('/api/projects/'+encodeURIComponent(id)+'/composer');
    var realTheme=String(data&&data.project&&data.project.theme_slug||'').trim();
    if(!realTheme)throw new Error('Le thème réel de ce projet est absent des données API.');
    resolvedTheme=realTheme;
    return realTheme;
  }

  async function createProject(themeSlug,startMode){
    var selected=String(themeSlug||theme()||'').trim();
    if(!selected)throw new Error('Aucune thématique n’a été sélectionnée. Le Studio ne choisit pas de thème par défaut.');
    var data=await window.StudioAPI.request('/api/projects/from-template',{
      method:'POST',
      body:JSON.stringify({
        themeSlug:selected,
        organizationId:window.StudioAPI.organizationId(),
        startMode:startMode==='resume'?'resume':'new'
      })
    });
    return data.project;
  }
  function createNew(themeSlug){return createProject(themeSlug,'new');}
  function createOrResume(themeSlug){return createProject(themeSlug,'resume');}
  window.StudioProject={projectId:projectId,theme:theme,query:query,link:link,ensureTheme:ensureTheme,createNew:createNew,createOrResume:createOrResume};

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
      if(id&&page!=='theme-sexisme.html')q.set('projectId',id);
      var qs=q.toString();
      stepLink.href=page+(qs?'?'+qs:'');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindStepLinks);
  else bindStepLinks();
})();
