(function(){
  function params(){return new URLSearchParams(location.search);}
  function projectId(){return params().get('projectId')||'';}
  function theme(){return params().get('theme')||'sexisme';}
  function query(id){return '?theme='+encodeURIComponent(theme())+(id?'&projectId='+encodeURIComponent(id):'');}
  function link(page,id){return page+query(id||projectId());}
  async function createProject(themeSlug,reuseDraft){
    var data=await window.StudioAPI.request('/api/projects/from-template',{method:'POST',body:JSON.stringify({themeSlug:themeSlug||theme(),organizationId:window.StudioAPI.organizationId(),reuseDraft:reuseDraft===true})});
    return data.project;
  }
  function createNew(themeSlug){return createProject(themeSlug,false);}
  function createOrResume(themeSlug){return createProject(themeSlug,true);}
  window.StudioProject={projectId:projectId,theme:theme,query:query,link:link,createNew:createNew,createOrResume:createOrResume};

  function bindStepLinks() {
    const params = new URLSearchParams(location.search);
    const theme = params.get('theme') || 'sexisme';
    const projectId = params.get('projectId') || '';
    document.querySelectorAll('[data-step-page]').forEach(link => {
      const page = link.dataset.stepPage;
      const q = new URLSearchParams({ theme });
      if (projectId && page !== 'theme-sexisme.html') q.set('projectId', projectId);
      link.href = `${page}?${q.toString()}`;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindStepLinks);
  else bindStepLinks();
})();
