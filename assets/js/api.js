(function(){
  function resolveApiBase(){
    if(window.STUDIO_API_BASE) return String(window.STUDIO_API_BASE).replace(/\/$/,'');
    var host=String(location.hostname||'').toLowerCase();
    var path=String(location.pathname||'').toLowerCase();
    var staging=host==='localhost'||host==='127.0.0.1'||host.includes('staging')||path.includes('/studio-meandyoutoo-staging/');
    return staging?'https://studio-meandyoutoo-api-staging.osc-fr1.scalingo.io':'https://studio-meandyoutoo-api.osc-fr1.scalingo.io';
  }
  function adminUser(){
    try{return JSON.parse(localStorage.getItem('studio_user')||'null');}catch(e){return null;}
  }
  function clientPreview(){
    try{
      var preview=JSON.parse(sessionStorage.getItem('studio_client_preview')||'null'),actor=adminUser();
      return preview&&preview.token&&preview.user&&actor&&actor.role==='admin'&&String(actor.id)===String(preview.actorId)?preview:null;
    }catch(e){return null;}
  }
  function token(){var preview=clientPreview();return preview?preview.token:localStorage.getItem('studio_token')||'';}
  function user(){var preview=clientPreview();return preview?preview.user:adminUser();}
  function startClientPreview(data){
    var actor=adminUser();
    if(!actor||actor.role!=='admin'||String(data.actorId)!==String(actor.id)||data.user?.role!=='client'||!data.token)throw new Error('Vue client indisponible.');
    sessionStorage.setItem('studio_client_preview',JSON.stringify(data));
    sessionStorage.setItem('studio_interface_mode','client');
  }
  function endClientPreview(){
    var preview=clientPreview(),organizationId=preview?.user?.organizationId;
    sessionStorage.removeItem('studio_client_preview');sessionStorage.removeItem('studio_preview_subscription');
    sessionStorage.setItem('studio_interface_mode','admin');
    location.href=organizationId?'client.html?organizationId='+encodeURIComponent(organizationId):'admin.html';
  }
  function saveSession(data){
    sessionStorage.removeItem('studio_client_preview');sessionStorage.removeItem('studio_preview_subscription');
    localStorage.setItem('studio_token',data.token);
    localStorage.setItem('studio_user',JSON.stringify(data.user));
    if(Object.prototype.hasOwnProperty.call(data,'studioSubscription'))localStorage.setItem('studio_subscription',JSON.stringify(data.studioSubscription));
    if(data.user&&data.user.organizationId)localStorage.setItem('studio_organization_id',data.user.organizationId);
  }
  function clearSession(){
    sessionStorage.removeItem('studio_client_preview');sessionStorage.removeItem('studio_preview_subscription');
    localStorage.removeItem('studio_token');localStorage.removeItem('studio_user');localStorage.removeItem('studio_organization_id');localStorage.removeItem('studio_subscription');
  }
  async function request(path,options){
    options=options||{};
    var preview=clientPreview(),method=String(options.method||'GET').toUpperCase();
    if(preview&&!['GET','HEAD','OPTIONS'].includes(method)){
      // Les mises à jour techniques ne doivent pas interrompre la consultation.
      if((method==='PATCH'&&/^\/api\/projects\/[^/]+\/progress$/.test(path))||(method==='POST'&&path==='/api/me/activity'))return {readOnly:true};
      var blocked=new Error('Vue client en consultation seule : aucune modification n’est autorisée.');blocked.code='CLIENT_PREVIEW_READ_ONLY';throw blocked;
    }
    var headers={'Content-Type':'application/json',...(options.headers||{})};
    if(token())headers.Authorization='Bearer '+token();
    var response=await fetch(resolveApiBase()+path,{...options,headers:headers});
    if(response.status===204)return null;
    var data=await response.json().catch(function(){return {};});
    if(response.status===401&&location.pathname.split('/').pop()!=='login.html'){
      if(preview){endClientPreview();throw new Error('La consultation a expiré. Retour au dossier admin.');}
      clearSession();
      location.href='login.html?expired=1';
      throw new Error('Session expirée');
    }
    if(preview&&path==='/api/me'&&response.ok&&data.user){preview.user=data.user;sessionStorage.setItem('studio_client_preview',JSON.stringify(preview));}
    if(path==='/api/me'&&Object.prototype.hasOwnProperty.call(data,'studioSubscription'))(preview?sessionStorage:localStorage).setItem(preview?'studio_preview_subscription':'studio_subscription',JSON.stringify(data.studioSubscription));
    if(!response.ok){var err=new Error(data.error||('Erreur API '+response.status));err.code=data.code||null;err.studioSubscription=data.studioSubscription||null;throw err;}
    return data;
  }
  function organizationId(){
    var current=user();
    return current&&current.organizationId?current.organizationId:(localStorage.getItem('studio_organization_id')||'');
  }
  function interfaceMode(){
    var current=user();
    if(!current||current.role!=='admin')return 'client';
    return sessionStorage.getItem('studio_interface_mode')==='client'?'client':'admin';
  }
  function setInterfaceMode(mode){
    var current=user();
    var next=current&&current.role==='admin'&&mode==='client'?'client':'admin';
    sessionStorage.setItem('studio_interface_mode',next);
    return next;
  }
  async function login(email,password){
    var data=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:email,password:password})});
    saveSession(data);return data;
  }
  function requireAuth(requiredRole){
    var current=user();
    if(!token()||!current){location.href='login.html';return false;}
    if(requiredRole&&current.role!==requiredRole){location.href='accueil.html';return false;}
    return true;
  }
  function logout(){if(clientPreview()){endClientPreview();return;}clearSession();sessionStorage.removeItem('studio_interface_mode');location.href='login.html';}
  window.StudioAPI={clientPreview:clientPreview,startClientPreview:startClientPreview,endClientPreview:endClientPreview,base:resolveApiBase,request:request,organizationId:organizationId,token:token,user:user,login:login,logout:logout,requireAuth:requireAuth,interfaceMode:interfaceMode,setInterfaceMode:setInterfaceMode};
})();
