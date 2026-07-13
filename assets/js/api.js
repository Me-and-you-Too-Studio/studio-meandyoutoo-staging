(function(){
  function resolveApiBase(){
    if(window.STUDIO_API_BASE) return String(window.STUDIO_API_BASE).replace(/\/$/,'');
    var host=String(location.hostname||'').toLowerCase();
    var path=String(location.pathname||'').toLowerCase();
    var staging=host==='localhost'||host==='127.0.0.1'||host.includes('staging')||path.includes('/studio-meandyoutoo-staging/');
    return staging?'https://studio-meandyoutoo-api-staging.osc-fr1.scalingo.io':'https://studio-meandyoutoo-api.osc-fr1.scalingo.io';
  }
  async function request(path,options){
    options=options||{};
    var response=await fetch(resolveApiBase()+path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
    if(response.status===204) return null;
    var data=await response.json().catch(function(){return {};});
    if(!response.ok) throw new Error(data.error||('Erreur API '+response.status));
    return data;
  }
  function organizationId(){
    return localStorage.getItem('studio_organization_id')||localStorage.getItem('organization_id')||'meandyoutoo-default';
  }
  window.StudioAPI={base:resolveApiBase,request:request,organizationId:organizationId};
})();
