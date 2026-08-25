(function(){
  'use strict';
  var data=null,$=function(id){return document.getElementById(id);};
  var number=new Intl.NumberFormat('fr-FR');
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function date(value,options){if(!value)return '—';var d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('fr-FR',options||{});}
  function money(cents){return cents==null?'—':(Number(cents)/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0});}
  function render(){
    var u=data.user,o=data.organization,users=(data.users||[]).filter(function(x){return x.active;});
    $('account-name').textContent=((u.firstName||'')+' '+(u.lastName||'')).trim()||u.email;
    $('account-job').textContent=u.jobTitle||'Non renseignée';$('account-email').textContent=u.email||'—';$('account-phone').textContent=u.phone||'—';
    $('organization-name').textContent=o.name||'—';$('organization-users-count').textContent=number.format(users.length)+' accès';
    $('organization-since').textContent=date(o.created_at,{month:'long',year:'numeric'});
    $('organization-users').innerHTML=users.length?users.map(function(x){var name=((x.first_name||'')+' '+(x.last_name||'')).trim()||x.email;return '<li>'+esc(name)+' — '+esc(x.job_title||'accès client')+'</li>';}).join(''):'<li>Aucun autre accès actif.</li>';
    var unlimited=Boolean(o.pack_unlimited),quota=Number(o.passations_quota)||0,used=Number(o.passations_used)||0,remaining=Math.max(0,quota-used);
    $('credits-remaining').textContent=unlimited?'Passations illimitées':number.format(o.passations_remaining==null?remaining:Number(o.passations_remaining))+' passations restantes';
    $('credits-total').textContent=unlimited?'Votre pack actif ne comporte aucune limite de passations.':'Sur un pack actif de '+number.format(quota)+' passations ('+number.format(used)+' utilisée'+(used>1?'s':'')+').';
    var percent=unlimited?100:(quota?Math.min(100,Math.round(used/quota*100)):0);$('credits-progress').querySelector('span').style.width=percent+'%';$('credits-progress').setAttribute('aria-label',percent+' % des crédits utilisés');
    $('credits-expiry').textContent=o.pack_expires_at?'Validité du pack en cours : jusqu’au '+date(o.pack_expires_at)+'.':'Aucune date de validité renseignée pour le pack en cours.';
    var packs=data.packs||[];$('packs-history').innerHTML=packs.length?packs.map(function(p){var status=p.status==='approved'?['badge-success','Validé']:p.status==='rejected'?['badge-muted','Refusé']:['badge-warning','En attente'];return '<tr><td>'+date(p.requested_at)+'</td><td>'+esc(p.pack_label||p.pack_code||'Pack')+'</td><td>'+(p.unlimited?'Illimité':number.format(p.requested_volume||0))+'</td><td>'+money(p.price_cents)+'</td><td><span class="badge '+status[0]+'">'+status[1]+'</span></td></tr>';}).join(''):'<tr><td colspan="5">Aucune commande de pack enregistrée.</td></tr>';
  }
  async function load(){try{data=await StudioAPI.request('/api/me/account');render();}catch(error){$('account-alert').hidden=false;$('account-alert').textContent='Impossible de charger les données du compte : '+error.message;}}
  $('edit-profile').addEventListener('click',async function(){
    if(!data)return;var u=data.user;
    var firstName=await StudioModal.prompt({title:'Modifier mon prénom',inputLabel:'Prénom',value:u.firstName||'',required:true});if(firstName===null)return;
    var lastName=await StudioModal.prompt({title:'Modifier mon nom',inputLabel:'Nom',value:u.lastName||'',required:true});if(lastName===null)return;
    var jobTitle=await StudioModal.prompt({title:'Modifier ma fonction',inputLabel:'Fonction',value:u.jobTitle||''});if(jobTitle===null)return;
    var phone=await StudioModal.prompt({title:'Modifier mon téléphone',inputLabel:'Téléphone',value:u.phone||''});if(phone===null)return;
    try{var result=await StudioAPI.request('/api/me/profile',{method:'PATCH',body:JSON.stringify({firstName:firstName,lastName:lastName,jobTitle:jobTitle,phone:phone})});data.user=result.user;localStorage.setItem('studio_user',JSON.stringify(result.user));render();await StudioModal.alert({type:'success',title:'Informations mises à jour',message:'Vos informations personnelles ont bien été enregistrées.'});location.reload();}catch(error){await StudioModal.alert({type:'error',title:'Modification impossible',message:error.message});}
  });
  load();
})();
