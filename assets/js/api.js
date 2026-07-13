(function(){
  function resolveApiBase(){
    if(window.STUDIO_API_BASE) return String(window.STUDIO_API_BASE).replace(/\/$/,'');
    var host=String(location.hostname||'').toLowerCase();
    var path=String(location.pathname||'').toLowerCase();
    var staging=host==='localhost'||host==='127.0.0.1'||host.includes('staging')||path.includes('/studio-meandyoutoo-staging/');
    return staging?'https://studio-meandyoutoo-api-staging.osc-fr1.scalingo.io':'https://studio-meandyoutoo-api.osc-fr1.scalingo.io';
  }
  function token(){return localStorage.getItem('studio_token')||'';}
  function user(){
    try{return JSON.parse(localStorage.getItem('studio_user')||'null');}catch(e){return null;}
  }
  function saveSession(data){
    localStorage.setItem('studio_token',data.token);
    localStorage.setItem('studio_user',JSON.stringify(data.user));
    if(data.user&&data.user.organizationId)localStorage.setItem('studio_organization_id',data.user.organizationId);
  }
  function clearSession(){
    localStorage.removeItem('studio_token');localStorage.removeItem('studio_user');localStorage.removeItem('studio_organization_id');
  }
  async function request(path,options){
    options=options||{};
    var headers={'Content-Type':'application/json',...(options.headers||{})};
    if(token())headers.Authorization='Bearer '+token();
    var response=await fetch(resolveApiBase()+path,{...options,headers:headers});
    if(response.status===204)return null;
    var data=await response.json().catch(function(){return {};});
    if(response.status===401&&location.pathname.split('/').pop()!=='login.html'){
      clearSession();
      location.href='login.html?expired=1';
      throw new Error('Session expirée');
    }
    if(!response.ok)throw new Error(data.error||('Erreur API '+response.status));
    return data;
  }
  function organizationId(){
    var current=user();
    return current&&current.organizationId?current.organizationId:(localStorage.getItem('studio_organization_id')||'');
  }
  async function login(email,password){
    var data=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:email,password:password})});
    saveSession(data);return data;
  }
  function requireAuth(requiredRole){
    var current=user();
    if(!token()||!current){location.href='login.html';return false;}
    if(requiredRole&&current.role!==requiredRole){location.href='index.html';return false;}
    return true;
  }
  function logout(){clearSession();location.href='login.html';}
  window.StudioAPI={base:resolveApiBase,request:request,organizationId:organizationId,token:token,user:user,login:login,logout:logout,requireAuth:requireAuth};
})();