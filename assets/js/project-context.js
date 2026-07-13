(function(){
  function params(){return new URLSearchParams(location.search);}
  function projectId(){return params().get('projectId')||'';}
  function theme(){return params().get('theme')||'sexisme';}
  function query(id){return '?theme='+encodeURIComponent(theme())+(id?'&projectId='+encodeURIComponent(id):'');}
  function link(page,id){return page+query(id||projectId());}
  async function createOrResume(themeSlug){
    var data=await window.StudioAPI.request('/api/projects/from-template',{method:'POST',body:JSON.stringify({themeSlug:themeSlug||theme(),organizationId:window.StudioAPI.organizationId(),reuseDraft:true})});
    return data.project;
  }
  window.StudioProject={projectId:projectId,theme:theme,query:query,link:link,createOrResume:createOrResume};
})();
