/* Accès et équipes : frise de paramétrage, suggestions de Me&YouToo, dossiers d'équipe, « qui voit quoi »,
   rangement des campagnes et invitations. Même page pour le responsable du compte et pour l'admin
   (fiche client : acces-equipes.html?organizationId=…). Les règles sont vérifiées côté API. */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);};
  var data=null,editing=null,inviting=null;
  var LEVELS={owner:'Responsable du compte',manager:'Gestionnaire de campagnes',contributor:'Contributeur',viewer:'Lecture seule'};
  var me=StudioAPI.user()||{},isAdmin=me.role==='admin'&&!(StudioAPI.clientPreview&&StudioAPI.clientPreview());
  var organizationId=isAdmin?new URLSearchParams(location.search).get('organizationId')||'':'';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function plain(v){return String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();}
  function api(path,options){
    var sep=path.indexOf('?')>=0?'&':'?';
    if(isAdmin&&(!options||!options.method||options.method==='GET'))path+=sep+'organizationId='+encodeURIComponent(organizationId);
    if(isAdmin&&options&&options.body){var body=JSON.parse(options.body);body.organizationId=organizationId;options.body=JSON.stringify(body);}
    if(isAdmin&&options&&options.method&&!options.body)options.body=JSON.stringify({organizationId:organizationId});
    return StudioAPI.request(path,options);
  }
  function name(u){return ((u.firstName||'')+' '+(u.lastName||'')).trim()||u.email||'Compte';}
  function folderName(id){var f=data.teamFolders.find(function(x){return x.id===String(id);});return f?f.name:'Dossier supprimé';}
  function campaignsIn(ids){return data.campaigns.filter(function(c){return c.teamFolderId&&ids.indexOf(c.teamFolderId)>=0;}).length;}
  function scopeBadge(u){
    if(u.accessLevel==='owner'||u.scope==='all')return '<span class="badge badge-success">🌐 Toutes les campagnes</span>';
    if(!u.folderIds.length)return '<span class="badge badge-warning">⚠️ Aucun dossier : ne voit rien</span>';
    return u.folderIds.map(function(id){return '<span class="badge badge-info">📁 '+esc(folderName(id))+'</span>';}).join(' ');
  }
  function statusBadge(u){
    if(u.suggestion==='refused')return ' <span class="badge badge-muted">Refusée par le client'+(u.suggestionDecidedAt?' le '+new Date(u.suggestionDecidedAt).toLocaleDateString('fr-FR'):'')+'</span>';
    if(u.status==='active')return '';
    if(u.canInvite)return ' <span class="badge badge-warning">Invitation à envoyer</span>';
    if(u.status==='pending')return ' <span class="badge badge-muted">En attente du go</span>';
    return ' <span class="badge badge-muted">Désactivé</span>';
  }
  function perimeterText(p){
    if(!p)return 'À choisir';
    if(p.scope==='all')return 'Toutes les campagnes';
    return p.folderIds.length?p.folderIds.map(folderName).join(', '):'Aucun dossier';
  }
  // Résumé en clair de ce que verra la personne, affiché avant d'enregistrer.
  function summary(person,scope,ids){
    var total=data.campaigns.length,first=person.firstName||name(person);
    if(scope==='all')return first+' verra les '+total+' campagne'+(total>1?'s':'')+' de l’entreprise, le Cockpit et le bilan de toute l’entreprise.';
    if(!ids.length)return '⚠️ '+first+' ne verra aucune campagne. Cochez au moins un dossier.';
    var n=campaignsIn(ids),names=ids.map(folderName).join(', ');
    return first+' verra '+n+' campagne'+(n>1?'s':'')+' (dossier'+(ids.length>1?'s':'')+' '+names+'), son Cockpit et le bilan '+names+'.'+(total-n?' '+(total-n>1?'Les '+(total-n)+' autres campagnes ne lui seront pas visibles.':'L’autre campagne ne lui sera pas visible.'):'');
  }

  function renderSteps(){
    var steps=data.steps,done=steps.filter(function(s){return s.done;}).length;
    $('ae-progress-count').textContent=done+' / '+steps.length+' étapes · '+Math.round(done/steps.length*100)+' %';
    $('ae-progress-bar').style.width=Math.round(done/steps.length*100)+'%';
    var current=steps.findIndex(function(s){return !s.done;});
    $('ae-steps').innerHTML=steps.map(function(s,i){
      var state=s.done?'is-done':i===current?'is-current':'';
      var hint=s.done?'Fait':s.key==='review'?'À confirmer':s.todo?s.todo+' à traiter':'À faire';
      return '<li class="studio-process-step '+state+'"'+(i===current?' aria-current="step"':'')+'><span aria-hidden="true">'+(s.done?'✓':i+1)+'</span><strong>'+esc(s.label)+'</strong><small>'+esc(hint)+'</small></li>';
    }).join('');
  }
  function folderOptions(selected,withAll){
    return (withAll?'<option value="all"'+(selected==='all'?' selected':'')+'>Toutes les campagnes</option>':'')+
      data.teamFolders.map(function(f){return '<option value="'+esc(f.id)+'"'+(selected===f.id?' selected':'')+'>📁 '+esc(f.name)+'</option>';}).join('');
  }
  function renderSuggestions(){
    var list=data.users.filter(function(u){return u.suggestion==='pending';});
    $('ae-suggestions').hidden=!list.length||!data.canEdit;
    $('ae-suggestions-title').textContent='Me&YouToo vous suggère '+list.length+' personne'+(list.length>1?'s':'')+' pour votre compte';
    $('ae-suggestion-list').innerHTML=list.map(function(u){
      var p=u.proposedPerimeter,selected=p?(p.scope==='all'?'all':p.folderIds[0]):'';
      return '<article class="ae-row" data-suggestion="'+esc(u.id)+'"><div class="ae-row-person"><strong>'+esc(name(u))+'</strong><span>'+esc(u.jobTitle||'Fonction non renseignée')+'</span>'+
        (p?'<small>💡 Sa fonction évoque : '+esc(perimeterText(p))+'</small>':'')+'</div>'+
        '<label class="ae-row-field"><span>Niveau d’accès</span><select data-level>'+Object.keys(LEVELS).filter(function(k){return k!=='owner';}).map(function(k){return '<option value="'+k+'"'+(u.accessLevel===k?' selected':'')+'>'+LEVELS[k]+'</option>';}).join('')+'</select></label>'+
        '<label class="ae-row-field"><span>Équipe</span><select data-scope><option value="">Choisir son équipe…</option>'+folderOptions(selected,true)+'</select></label>'+
        '<div class="ae-row-actions"><button class="button button-primary" type="button" data-accept>Intégrer</button><button class="button button-ghost" type="button" data-refuse>Refuser</button></div></article>';
    }).join('');
  }
  function renderInvitations(){
    var list=data.users.filter(function(u){return u.canInvite;});
    $('ae-invitations').hidden=!list.length||!data.canEdit;
    $('ae-invitation-list').innerHTML=list.map(function(u){
      return '<article class="ae-row"><div class="ae-row-person"><strong>'+esc(name(u))+'</strong><span>'+esc(u.email||'')+'</span></div><div>'+scopeBadge(u)+'</div>'+
        '<div class="ae-row-actions"><button class="button button-primary" type="button" data-invite="'+esc(u.id)+'">Envoyer l’invitation</button></div></article>';
    }).join('');
  }
  function renderFolders(){
    var everyone=data.users.filter(function(u){return u.suggestion!=='pending'&&(u.accessLevel==='owner'||u.scope==='all');}).length;
    var unfiled=data.campaigns.filter(function(c){return !c.teamFolderId;}).length;
    $('ae-unfiled').hidden=!unfiled||!data.teamFolders.length;
    $('ae-unfiled').textContent=unfiled+' campagne'+(unfiled>1?'s ne sont':' n’est')+' dans aucun dossier : seuls les comptes « Toutes les campagnes » '+(unfiled>1?'les':'la')+' voient. Rangez-'+(unfiled>1?'les':'la')+' plus bas.';
    $('ae-add-folder').hidden=!data.canEdit;
    if(!data.teamFolders.length){
      $('ae-folders').innerHTML='<div class="ae-empty"><strong>Créez votre premier dossier d’équipe</strong><p>Par exemple « Handicap » ou « Sexisme et harcèlement ». Vous y rangerez les campagnes du sujet, et l’équipe concernée ne verra que celles-ci.</p></div>';
      return;
    }
    $('ae-folders').innerHTML=data.teamFolders.map(function(f){
      var team=data.users.filter(function(u){return u.suggestion!=='pending'&&u.accessLevel!=='owner'&&u.scope==='folders'&&u.folderIds.indexOf(f.id)>=0;});
      var ideas=functionsFor(f.name);
      return '<article class="card ae-folder"><h3>📁 '+esc(f.name)+'</h3><p class="ae-folder-count">'+f.campaignCount+' campagne'+(f.campaignCount>1?'s':'')+'</p>'+
        '<p class="ae-folder-label">Visible par</p><p>'+(team.length?team.map(function(u){return '👤 '+esc(name(u));}).join(' · '):'<span class="ae-muted">Personne de l’équipe pour l’instant</span>')+'</p>'+
        '<p class="ae-muted">+ '+everyone+' compte'+(everyone>1?'s':'')+' « Toutes les campagnes »</p>'+
        (ideas.length?'<p class="ae-ideas">'+(team.length?'Fonctions souvent associées':'Personne ne suit encore ce sujet. Les entreprises désignent souvent')+' : '+esc(ideas.join(' · '))+'</p>':'')+
        (data.canEdit?'<div class="ae-row-actions"><button class="button button-ghost" type="button" data-rename="'+esc(f.id)+'">Renommer</button><button class="button button-ghost" type="button" data-delete-folder="'+esc(f.id)+'">Supprimer</button></div>':'')+'</article>';
    }).join('');
  }
  // Fonctions suggérées dont le sujet correspond au nom du dossier (idées de personnes à intégrer).
  function functionsFor(folder){
    var n=plain(folder);
    var hit=(data.suggestedFunctions||[]).find(function(s){return s.theme!=='pilotage'&&(n.indexOf(s.theme)>=0||plain(s.label).split(/[^a-z+]+/).some(function(w){return w.length>4&&n.indexOf(w)>=0;}));});
    return hit?hit.functions:[];
  }
  function renderWho(){
    var rows=data.users.filter(function(u){return u.suggestion!=='pending';});
    $('ae-review').hidden=!data.canEdit;
    $('ae-who-rows').innerHTML=rows.map(function(u){
      var editable=data.canEdit&&u.accessLevel!=='owner';
      return '<div class="ae-who-row'+(u.seesNothing?' is-warning':'')+'" role="row"><span role="cell"><strong>'+esc(name(u))+'</strong>'+statusBadge(u)+'<small>'+esc(u.jobTitle||'')+'</small></span>'+
        '<span role="cell">'+esc(LEVELS[u.accessLevel]||u.accessLevel)+'</span><span role="cell">'+scopeBadge(u)+'</span>'+
        '<span role="cell">'+(editable?'<button class="button button-secondary" type="button" data-edit="'+esc(u.id)+'">Modifier</button>':u.accessLevel==='owner'?'<small class="ae-muted">Voit toujours tout</small>':'')+'</span></div>';
    }).join('')||'<p class="ae-muted">Aucun compte.</p>';
  }
  function renderCampaigns(){
    $('ae-campaigns').hidden=!data.canEdit||!data.campaigns.length;
    $('ae-campaign-list').innerHTML=data.campaigns.map(function(c){
      return '<div class="ae-row ae-campaign"><div class="ae-row-person"><strong>'+esc(c.name)+'</strong><span>'+esc(c.theme||'')+' · '+esc(window.StudioStatus?StudioStatus.label(c.status):c.status)+'</span></div>'+
        '<label class="ae-row-field"><span>Dossier d’équipe</span><select data-campaign="'+esc(c.id)+'"'+(data.teamFolders.length?'':' disabled')+'><option value="">Aucun dossier</option>'+folderOptions(c.teamFolderId||'',false)+'</select></label></div>';
    }).join('');
  }
  function render(){
    $('ae-eyebrow').textContent=isAdmin?'Fiche client · '+data.organization.name:'Compte · '+data.organization.name;
    $('ae-readonly').hidden=data.canEdit;
    renderSteps();renderSuggestions();renderInvitations();renderFolders();renderWho();renderCampaigns();
  }
  async function load(){
    try{data=await api('/api/team-access');render();if(window.StudioTour)StudioTour.offer('acces-equipes');}
    catch(error){$('ae-alert').hidden=false;$('ae-alert').textContent='Impossible de charger les accès : '+error.message;}
  }
  async function act(fn,success){
    try{await fn();await load();if(success)await StudioModal.alert({type:'success',title:success.title,message:success.message});}
    catch(error){await StudioModal.alert({type:'error',title:'Action impossible',message:error.message});}
  }

  // ── Périmètre ──
  function openPerimeter(user){
    editing=user;
    $('ae-perimeter-title').textContent='Ce que voit '+name(user);
    $('ae-perimeter-access').hidden=false;
    $('ae-perimeter-access').innerHTML='<strong>Ce que cette personne peut faire :</strong> '+esc(LEVELS[user.accessLevel]||user.accessLevel)+'. <a href="'+(isAdmin?'client.html?organizationId='+encodeURIComponent(organizationId):'account.html#team-access-section')+'">Modifier son niveau d’accès</a>';
    document.querySelector('input[name="ae-scope"][value="'+(user.scope==='folders'?'folders':'all')+'"]').checked=true;
    $('ae-perimeter-folders').innerHTML=data.teamFolders.length?data.teamFolders.map(function(f){return '<label><input type="checkbox" value="'+esc(f.id)+'"'+(user.folderIds.indexOf(f.id)>=0?' checked':'')+'> 📁 '+esc(f.name)+' <small>('+f.campaignCount+')</small></label>';}).join(''):'<p class="ae-muted">Créez d’abord un dossier d’équipe.</p>';
    $('ae-perimeter-error').hidden=true;
    updatePerimeterSummary();
    $('ae-perimeter-dialog').showModal();
  }
  function perimeterChoice(){
    var scope=document.querySelector('input[name="ae-scope"]:checked').value;
    var ids=[].map.call(document.querySelectorAll('#ae-perimeter-folders input:checked'),function(i){return i.value;});
    return {scope:scope,folderIds:scope==='all'?[]:ids};
  }
  function updatePerimeterSummary(){
    var c=perimeterChoice();
    $('ae-perimeter-folders').classList.toggle('is-disabled',c.scope==='all');
    $('ae-perimeter-summary').textContent=summary(editing,c.scope,c.folderIds);
  }
  $('ae-perimeter-form').addEventListener('change',updatePerimeterSummary);
  $('ae-perimeter-save').onclick=async function(){
    var c=perimeterChoice();
    if(c.scope==='folders'&&!c.folderIds.length){$('ae-perimeter-error').hidden=false;$('ae-perimeter-error').textContent='Cochez au moins un dossier, ou choisissez « Toutes les campagnes ».';return;}
    $('ae-perimeter-dialog').close();
    await act(function(){return api('/api/team-access/users/'+editing.id+'/perimeter',{method:'PUT',body:JSON.stringify(c)});});
  };

  // ── Invitation ──
  function renderInvitePreview(){
    var org=data.organization.name,inviter=isAdmin?'':(((me.firstName||'')+' '+(me.lastName||'')).trim());
    var note=$('ae-invite-message').value.trim();
    $('ae-invite-preview').innerHTML='<p>Bonjour '+esc(inviting.firstName||'')+',</p><p>'+esc(inviter?inviter+' vous invite à rejoindre le Studio Me&YouToo de l’entreprise '+org+'.':'L’équipe Me&YouToo vient de créer pour vous un accès au Studio Me&YouToo, rattaché à l’entreprise '+org+'.')+'</p>'+
      (note?'<blockquote>'+esc(note)+'</blockquote>':'')+'<p><span class="ae-fake-button">Créer mon mot de passe</span></p><p class="ae-muted">Ce lien est personnel, utilisable une seule fois et valable 72 heures.</p>';
  }
  async function openInvite(user){
    if(!data.invitationsEnabled){
      await StudioModal.alert({type:'info',title:'Bientôt disponible',message:'L’envoi des invitations s’ouvrira à la mise en production du Studio. '+name(user)+' est bien intégré(e) à votre compte : vous pourrez l’inviter dès l’ouverture.'});
      return;
    }
    inviting=user;
    $('ae-invite-title').textContent='Inviter '+name(user);
    $('ae-invite-email').value=user.email||'';
    $('ae-invite-message').value='';
    $('ae-invite-error').hidden=true;
    renderInvitePreview();
    $('ae-invite-dialog').showModal();
  }
  $('ae-invite-message').addEventListener('input',renderInvitePreview);
  $('ae-invite-email').addEventListener('input',function(){$('ae-invite-error').hidden=true;});
  $('ae-invite-send').onclick=async function(){
    var email=$('ae-invite-email').value.trim();
    if(!$('ae-invite-email').checkValidity()||!email){$('ae-invite-error').hidden=false;$('ae-invite-error').textContent='Indiquez une adresse e-mail valide.';return;}
    $('ae-invite-dialog').close();
    var who=name(inviting);
    await act(function(){return api('/api/team-access/users/'+inviting.id+'/invite',{method:'POST',body:JSON.stringify({email:email,message:$('ae-invite-message').value.trim()})});},
      {title:'Invitation envoyée',message:who+' va recevoir son invitation par e-mail.'});
  };
  document.querySelectorAll('dialog [data-close]').forEach(function(b){b.onclick=function(){b.closest('dialog').close();};});

  // ── Actions des listes ──
  document.addEventListener('click',async function(e){
    var t=e.target.closest('button');if(!t||!data)return;
    var row=t.closest('[data-suggestion]');
    if(t.hasAttribute('data-accept')&&row){
      var choice=row.querySelector('[data-scope]').value,level=row.querySelector('[data-level]').value,user=data.users.find(function(u){return u.id===row.dataset.suggestion;});
      if(!choice){await StudioModal.alert({type:'warning',title:'Choisissez son équipe',message:'Indiquez quelles campagnes '+name(user)+' verra : toutes, ou celles d’un dossier d’équipe.'});return;}
      var perimeter=choice==='all'?{scope:'all',folderIds:[]}:{scope:'folders',folderIds:[choice]};
      if(!await StudioModal.confirm({type:'info',title:'Intégrer '+name(user)+' ?',message:summary(user,perimeter.scope,perimeter.folderIds)+' Aucune invitation n’est envoyée pour l’instant.',confirmLabel:'Intégrer'}))return;
      await act(function(){return api('/api/team-access/suggestions/'+user.id+'/accept',{method:'POST',body:JSON.stringify({accessLevel:level,perimeter:perimeter})});});
    }else if(t.hasAttribute('data-refuse')&&row){
      var refused=data.users.find(function(u){return u.id===row.dataset.suggestion;});
      if(!await StudioModal.confirm({type:'warning',title:'Refuser '+name(refused)+' ?',message:'Cette personne sortira de votre compte et n’aura jamais accès au Studio. Rien n’est supprimé : Me&YouToo voit votre décision.',confirmLabel:'Refuser'}))return;
      await act(function(){return api('/api/team-access/suggestions/'+refused.id+'/refuse',{method:'POST'});});
    }else if(t.dataset.invite){openInvite(data.users.find(function(u){return u.id===t.dataset.invite;}));}
    else if(t.dataset.edit){openPerimeter(data.users.find(function(u){return u.id===t.dataset.edit;}));}
    else if(t.dataset.rename){
      var folder=data.teamFolders.find(function(f){return f.id===t.dataset.rename;});
      var next=await StudioModal.prompt({title:'Renommer le dossier',inputLabel:'Nom du dossier',value:folder.name,required:true,confirmLabel:'Renommer'});
      if(next)await act(function(){return api('/api/team-access/folders/'+folder.id,{method:'PATCH',body:JSON.stringify({name:next})});});
    }else if(t.dataset.deleteFolder){
      var del=data.teamFolders.find(function(f){return f.id===t.dataset.deleteFolder;});
      var alone=data.users.filter(function(u){return u.scope==='folders'&&u.folderIds.length===1&&u.folderIds[0]===del.id;}).map(name);
      if(!await StudioModal.confirm({type:'danger',title:'Supprimer « '+del.name+' » ?',message:'Ses '+del.campaignCount+' campagne(s) ne seront plus rangées.'+(alone.length?' '+alone.join(', ')+' ne verra'+(alone.length>1?'ont':'')+' plus aucune campagne.':''),confirmLabel:'Supprimer'}))return;
      await act(function(){return api('/api/team-access/folders/'+del.id,{method:'DELETE'});});
    }
  });
  document.addEventListener('change',async function(e){
    var s=e.target.closest('select[data-campaign]');if(!s)return;
    await act(function(){return api('/api/team-access/campaigns/'+s.dataset.campaign+'/folder',{method:'PUT',body:JSON.stringify({teamFolderId:s.value||null})});});
  });
  $('ae-add-folder').onclick=async function(){
    var label=await StudioModal.prompt({title:'Nouveau dossier d’équipe',message:'Un dossier par sujet ou par équipe, par exemple « Handicap » ou « Sexisme et harcèlement ».',inputLabel:'Nom du dossier',required:true,confirmLabel:'Créer'});
    if(label)await act(function(){return api('/api/team-access/folders',{method:'POST',body:JSON.stringify({name:label})});});
  };
  $('ae-review').onclick=function(){act(function(){return api('/api/team-access/review',{method:'POST'});},{title:'Merci',message:'Vérification enregistrée. Elle vous sera redemandée après tout changement d’équipe ou d’accès.'});};

  if(isAdmin&&!organizationId){$('ae-alert').hidden=false;$('ae-alert').textContent='Ouvrez cette page depuis la fiche d’un client.';return;}
  load();
})();
