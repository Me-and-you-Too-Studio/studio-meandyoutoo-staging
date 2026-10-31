/* Accès et équipes : frise de paramétrage, suggestions de Me&YouToo, dossiers d'équipe, « qui voit quoi »,
   rangement des campagnes et invitations. Même page pour le responsable du compte et pour l'admin
   (fiche client : acces-equipes.html?organizationId=…). Les règles sont vérifiées côté API. */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);};
  var data=null,editing=null,inviting=null;
  var LEVELS={owner:'Responsable du compte',manager:'Gestionnaire de campagnes',contributor:'Contributeur',viewer:'Lecture seule'};
  // Droits ouverts par chaque niveau : mêmes libellés et mêmes valeurs par défaut que « Mon compte » (permissionPresets de l’API).
  var RIGHTS={manage_users:'Gérer les comptes et les accès',create_campaigns:'Créer des campagnes',edit_campaigns:'Modifier et renommer les campagnes, et demander des ajustements',organize_folders:'Organiser les campagnes dans des dossiers',submit_campaigns:'Transmettre une configuration à Me&YouToo pour relecture',manage_schedule:'Programmer, prolonger et reprogrammer',manage_kit:'Gérer le kit de communication et le lien de diffusion',view_results:'Voir le lien des résultats et les statistiques',order_passations:'Commander des passations',track_orders:'Suivre les commandes de passations',view_calendar:'Voir le calendrier des campagnes',manage_tasks:'Créer et gérer les tâches',view_dei_cockpit:'Accéder au Cockpit DEI'};
  var PRESETS={owner:{manage_users:true,create_campaigns:true,edit_campaigns:true,organize_folders:true,submit_campaigns:true,manage_schedule:true,manage_kit:true,view_results:true,order_passations:true,track_orders:true,view_calendar:true,manage_tasks:true,view_dei_cockpit:true},manager:{manage_users:false,create_campaigns:true,edit_campaigns:true,organize_folders:true,submit_campaigns:true,manage_schedule:true,manage_kit:true,view_results:true,order_passations:false,track_orders:true,view_calendar:true,manage_tasks:true,view_dei_cockpit:true},contributor:{manage_users:false,create_campaigns:true,edit_campaigns:true,organize_folders:false,submit_campaigns:true,manage_schedule:false,manage_kit:true,view_results:false,order_passations:false,track_orders:false,view_calendar:true,manage_tasks:true,view_dei_cockpit:true},viewer:{manage_users:false,create_campaigns:false,edit_campaigns:false,organize_folders:false,submit_campaigns:false,manage_schedule:false,manage_kit:false,view_results:false,order_passations:false,track_orders:false,view_calendar:true,manage_tasks:false,view_dei_cockpit:true}};
  var RIGHT_KEYS=Object.keys(RIGHTS);
  function rightsCount(values){var n=RIGHT_KEYS.filter(function(k){return values&&values[k];}).length;return n+' droit'+(n>1?'s':'')+' sur '+RIGHT_KEYS.length;}
  // Liste complète des droits : cases à cocher (ajustables avant d’intégrer) ou lecture seule (✓ / —).
  function rightsHtml(values,editable){
    return '<ul class="ae-rights-list">'+RIGHT_KEYS.map(function(k){var on=Boolean(values&&values[k]);
      return editable?'<li><label><input type="checkbox" data-right="'+k+'"'+(on?' checked':'')+'> '+esc(RIGHTS[k])+'</label></li>':'<li class="'+(on?'is-on':'is-off')+'"><span aria-hidden="true">'+(on?'✓':'—')+'</span> '+esc(RIGHTS[k])+(on?'':' <span class="sr-only">(non)</span>')+'</li>';}).join('')+'</ul>';
  }
  function rowRights(row){var r={};row.querySelectorAll('[data-right]').forEach(function(i){r[i.dataset.right]=i.checked;});if(r.manage_tasks)r.view_calendar=true;return r;}
  function levelsTable(){
    var levels=Object.keys(LEVELS);
    return '<table class="ae-levels-table"><thead><tr><th scope="col">Ce que la personne peut faire</th>'+levels.map(function(l){return '<th scope="col">'+esc(LEVELS[l])+'</th>';}).join('')+'</tr></thead><tbody>'+
      RIGHT_KEYS.map(function(k){return '<tr><th scope="row">'+esc(RIGHTS[k])+'</th>'+levels.map(function(l){return PRESETS[l][k]?'<td class="is-on"><span aria-hidden="true">✓</span><span class="sr-only">oui</span></td>':'<td class="is-off"><span aria-hidden="true">—</span><span class="sr-only">non</span></td>';}).join('')+'</tr>';}).join('')+
      '</tbody></table><p class="ae-muted">Ce sont les droits par défaut de chaque niveau ; vous pouvez les ajuster personne par personne. Le responsable du compte a toujours tous les droits. Ce que chacun voit (toutes les campagnes ou certains dossiers) se règle à part, dans le périmètre.</p>';
  }
  var preview=Boolean(StudioAPI.clientPreview&&StudioAPI.clientPreview());
  var me=StudioAPI.user()||{},isAdmin=me.role==='admin'&&!preview;
  var organizationId=isAdmin?new URLSearchParams(location.search).get('organizationId')||'':'';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function plain(v){return String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();}
  function api(path,options){
    // Mode démonstration (vue client ouverte par l’admin) : les écritures sont jouées à l’écran seulement.
    if(preview&&options&&options.method&&options.method!=='GET')return demoApply(path,options.method,options.body?JSON.parse(options.body):{});
    var sep=path.indexOf('?')>=0?'&':'?';
    if(isAdmin&&(!options||!options.method||options.method==='GET'))path+=sep+'organizationId='+encodeURIComponent(organizationId);
    if(isAdmin&&options&&options.body){var body=JSON.parse(options.body);body.organizationId=organizationId;options.body=JSON.stringify(body);}
    if(isAdmin&&options&&options.method&&!options.body)options.body=JSON.stringify({organizationId:organizationId});
    return StudioAPI.request(path,options);
  }
  function name(u){return ((u.firstName||'')+' '+(u.lastName||'')).trim()||u.email||'Compte';}
  // Nom + lien vers la fiche HubSpot (fourni par l’API à l’admin uniquement).
  function nameHtml(u){return esc(name(u))+(u.hubspotUrl?' <a class="ae-hs" href="'+esc(u.hubspotUrl)+'" target="_blank" rel="noopener" title="Ouvrir la fiche HubSpot">HubSpot ↗</a>':'');}
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
      return '<article class="ae-row" data-suggestion="'+esc(u.id)+'"><div class="ae-row-person"><strong>'+nameHtml(u)+'</strong><span>'+esc(u.jobTitle||'Fonction non renseignée')+'</span>'+
        (p?'<small>💡 Sa fonction évoque : '+esc(perimeterText(p))+'</small>':'')+'</div>'+
        '<label class="ae-row-field"><span>Niveau d’accès <button type="button" class="ae-link" data-levels>Que permet chaque niveau ?</button></span><select data-level>'+Object.keys(LEVELS).filter(function(k){return k!=='owner';}).map(function(k){return '<option value="'+k+'"'+(u.accessLevel===k?' selected':'')+'>'+LEVELS[k]+'</option>';}).join('')+'</select></label>'+
        '<label class="ae-row-field"><span>Équipe</span><select data-scope><option value="">Choisir son équipe…</option>'+folderOptions(selected,true)+'</select></label>'+
        '<div class="ae-row-actions"><button class="button button-primary" type="button" data-accept>Intégrer</button><button class="button button-ghost" type="button" data-refuse>Refuser</button></div>'+
        '<details class="ae-rights"><summary>Ce que ce niveau lui permet · <strong data-rights-count>'+rightsCount(PRESETS[u.accessLevel]||PRESETS.manager)+'</strong> <span class="ae-muted">(voir et ajuster)</span></summary><div data-rights-box>'+rightsHtml(PRESETS[u.accessLevel]||PRESETS.manager,true)+'</div></details></article>';
    }).join('');
  }
  function renderInvitations(){
    var list=data.users.filter(function(u){return u.canInvite;});
    $('ae-invitations').hidden=!list.length||!data.canEdit;
    $('ae-invitations-title').textContent=data.invitationsEnabled?'Invitations à envoyer':'Invitations à préparer';
    $('ae-invitations-desc').textContent=data.invitationsEnabled?'Ces personnes sont intégrées à votre compte mais n’ont encore rien reçu. Envoyez leur invitation quand vous le souhaitez, par exemple après une annonce interne.':'Ces personnes sont intégrées à votre compte. Préparez dès maintenant leur invitation (adresse, mot d’accompagnement) : elle partira automatiquement à la mise en production du Studio. Rien n’est envoyé pour l’instant.';
    $('ae-invitation-list').innerHTML=list.map(function(u){
      // Avant le go, l’invitation est « préparée » : elle partira automatiquement à la mise en production.
      var ready=u.invitationPreparedAt&&!data.invitationsEnabled;
      return '<article class="ae-row"><div class="ae-row-person"><strong>'+nameHtml(u)+'</strong><span>'+esc(u.email||'')+'</span>'+(ready?'<small>✓ Invitation prête le '+esc(new Date(u.invitationPreparedAt).toLocaleDateString("fr-FR"))+' : elle partira à la mise en production</small>':'')+'</div><div>'+scopeBadge(u)+'</div>'+
        '<div class="ae-row-actions"><button class="button '+(ready?'button-secondary':'button-primary')+'" type="button" data-invite="'+esc(u.id)+'">'+(data.invitationsEnabled?'Envoyer l’invitation':ready?'Modifier l’invitation':'Préparer l’invitation')+'</button>'+
          '<button class="button button-ghost" type="button" data-reset="'+esc(u.id)+'">Annuler l’intégration</button></div></article>';
    }).join('');
  }
  function renderFolders(){
    var everyone=data.users.filter(function(u){return u.suggestion!=='pending'&&(u.accessLevel==='owner'||u.scope==='all');}).length;
    var unfiled=data.campaigns.filter(function(c){return !c.teamFolderId;}).length,unfiledActions=actions().filter(function(a){return !a.teamFolderId;}).length;
    var parts=[unfiled?unfiled+' campagne'+(unfiled>1?'s':''):'',unfiledActions?unfiledActions+' action'+(unfiledActions>1?'s':'')+' du Cockpit':''].filter(Boolean);
    $('ae-unfiled').hidden=!parts.length||!data.teamFolders.length;
    $('ae-unfiled').textContent=parts.join(' et ')+(unfiled+unfiledActions>1?' ne sont':' n’est')+' dans aucun dossier : seuls les comptes « Toutes les campagnes » les voient. Ajoutez-les depuis un dossier (« + Ajouter… »). Une action de toute l’entreprise, comme un séminaire de direction, peut rester sans dossier.';
    var proposed=proposals();
    $('ae-actions-proposal').hidden=!proposed.length||!data.canEdit;
    $('ae-actions-proposal-text').textContent=proposed.length+' action'+(proposed.length>1?'s':'')+' du Cockpit évoque'+(proposed.length>1?'nt':'')+' un de vos dossiers d’après leur thématique ('+Array.from(new Set(proposed.map(function(a){return folderName(a.proposedFolderId);}))).join(', ')+').';
    $('ae-add-folder').hidden=!data.canEdit;
    if(!data.teamFolders.length){
      $('ae-folders').innerHTML='<div class="ae-empty"><strong>Créez votre premier dossier d’équipe</strong><p>Par exemple « Handicap » ou « Sexisme et harcèlement ». Vous y rangerez les campagnes du sujet, et l’équipe concernée ne verra que celles-ci.</p></div>';
      return;
    }
    $('ae-folders').innerHTML=data.teamFolders.map(function(f){
      var team=data.users.filter(function(u){return u.suggestion!=='pending'&&u.accessLevel!=='owner'&&u.scope==='folders'&&u.folderIds.indexOf(f.id)>=0;});
      var ideas=functionsFor(f.name),inside=data.campaigns.filter(function(c){return c.teamFolderId===f.id;}),acts=actions().filter(function(a){return a.teamFolderId===f.id;});
      // Les campagnes du dossier, avec l’ajout et le retrait directement ici.
      return '<article class="card ae-folder"><h3>📁 '+esc(f.name)+'</h3><p class="ae-folder-label">Campagnes ('+inside.length+')</p>'+
        (inside.length?'<ul class="ae-folder-campaigns">'+inside.map(function(c){return '<li><span>'+esc(c.name)+'</span>'+(data.canEdit?'<button type="button" class="ae-link" data-unfile="'+esc(c.id)+'" aria-label="Retirer '+esc(c.name)+' du dossier">Retirer</button>':'')+'</li>';}).join('')+'</ul>':'<p class="ae-muted">Aucune campagne pour l’instant.</p>')+
        (data.canEdit&&data.campaigns.length>inside.length?'<button class="button button-secondary ae-add-campaigns" type="button" data-add-campaigns="'+esc(f.id)+'">+ Ajouter des campagnes</button>':'')+
        // Les actions du Cockpit (formations, conférences, dessins…) du dossier, rangées de la même façon.
        '<p class="ae-folder-label">Actions du Cockpit ('+acts.length+')</p>'+
        (acts.length?'<ul class="ae-folder-campaigns">'+acts.map(function(a){return '<li><span>'+esc(a.icon)+' '+esc(a.title)+' <small class="ae-muted">· '+esc(shortDate(a.date))+'</small></span>'+(data.canEdit?'<button type="button" class="ae-link" data-unfile-action="'+esc(a.id)+'" aria-label="Retirer '+esc(a.title)+' du dossier">Retirer</button>':'')+'</li>';}).join('')+'</ul>':'<p class="ae-muted">Aucune action pour l’instant.</p>')+
        (data.canEdit&&actions().length>acts.length?'<button class="button button-secondary ae-add-campaigns" type="button" data-add-actions="'+esc(f.id)+'">+ Ajouter des actions</button>':'')+
        '<p class="ae-folder-label">Visible par</p><p>'+(team.length?team.map(function(u){return '👤 '+esc(name(u));}).join(' · '):'<span class="ae-muted">Personne de l’équipe pour l’instant</span>')+'</p>'+
        '<p class="ae-muted">+ '+everyone+' compte'+(everyone>1?'s':'')+' « Toutes les campagnes »</p>'+
        (ideas.length?'<p class="ae-ideas">'+(team.length?'Fonctions souvent associées':'Personne ne suit encore ce sujet. Les entreprises désignent souvent')+' : '+esc(ideas.join(' · '))+'</p>':'')+
        (data.canEdit?'<div class="ae-row-actions"><button class="button button-ghost" type="button" data-rename="'+esc(f.id)+'">Renommer</button><button class="button button-ghost" type="button" data-delete-folder="'+esc(f.id)+'">Supprimer</button></div>':'')+'</article>';
    }).join('');
  }
  function actions(){return data.actions||[];}
  // Actions sans dossier dont la thématique évoque un dossier existant (proposition calculée par l’API).
  function proposals(){return actions().filter(function(a){return !a.teamFolderId&&a.proposedFolderId;});}
  function shortDate(v){var d=new Date(String(v||'').slice(0,10)+'T12:00:00');return Number.isNaN(d.getTime())?'':d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});}
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
      // Suggestion refusée (vue admin) : seule action possible, annuler le refus.
      if(u.suggestion==='refused')return '<div class="ae-who-row" role="row"><span role="cell"><strong>'+nameHtml(u)+'</strong>'+statusBadge(u)+'<small>'+esc(u.jobTitle||'')+'</small></span><span role="cell"></span><span role="cell"></span>'+
        '<span role="cell">'+(data.canEdit?'<button class="button button-ghost" type="button" data-reset="'+esc(u.id)+'">Annuler le refus</button>':'')+'</span></div>';
      var editable=data.canEdit&&u.accessLevel!=='owner';
      return '<div class="ae-who-row'+(u.seesNothing?' is-warning':'')+'" role="row"><span role="cell"><strong>'+nameHtml(u)+'</strong>'+statusBadge(u)+'<small>'+esc(u.jobTitle||'')+'</small></span>'+
        '<span role="cell">'+esc(LEVELS[u.accessLevel]||u.accessLevel)+'<small><button type="button" class="ae-link" data-rights-of="'+esc(u.id)+'">'+rightsCount(u.permissions)+'</button></small></span><span role="cell">'+scopeBadge(u)+'</span>'+
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
    // Admin : retour à la fiche du client, et sa fiche entreprise HubSpot.
    $('ae-eyebrow').innerHTML=isAdmin?'<a href="client.html?organizationId='+encodeURIComponent(organizationId)+'">← Fiche client · '+esc(data.organization.name)+'</a>'+(data.organization.hubspotUrl?' · <a href="'+esc(data.organization.hubspotUrl)+'" target="_blank" rel="noopener">HubSpot ↗</a>':''):'Compte · '+esc(data.organization.name);
    $('ae-readonly').hidden=data.canEdit;
    renderSteps();renderSuggestions();renderInvitations();renderFolders();renderWho();renderCampaigns();
  }
  async function load(){
    try{data=await api('/api/team-access');
      // Vue client ouverte par l’admin : la page s’affiche comme pour le client, mais rien n’y est modifiable
      // (l’API refuse toute écriture) ; le bandeau renvoie vers la page admin.
      if(preview)$('ae-preview').hidden=false;
      render();if(preview)$('ae-readonly').hidden=true;if(window.StudioTour)StudioTour.offer('acces-equipes');}
    catch(error){$('ae-alert').hidden=false;$('ae-alert').textContent='Impossible de charger les accès : '+error.message;}
  }
  document.querySelectorAll('[data-end-preview]').forEach(function(b){b.onclick=function(){StudioAPI.endClientPreview();};});
  async function act(fn,success){
    try{await fn();
      if(preview){recomputeSteps();render();}else await load();
      if(success)await StudioModal.alert({type:'success',title:success.title,message:success.message+(preview?' (Mode démonstration : rien n’est enregistré.)':'')});}
    catch(error){await StudioModal.alert({type:'error',title:'Action impossible',message:error.message});}
  }

  // ── Périmètre ──
  function openPerimeter(user){
    editing=user;
    $('ae-perimeter-title').textContent='Ce que voit '+name(user);
    $('ae-perimeter-access').hidden=false;
    $('ae-perimeter-access').innerHTML='<details><summary><strong>Ce que cette personne peut faire :</strong> '+esc(LEVELS[user.accessLevel]||user.accessLevel)+' · '+rightsCount(user.permissions)+'</summary>'+rightsHtml(user.permissions,false)+'</details><a href="'+(isAdmin?'client.html?organizationId='+encodeURIComponent(organizationId):'account.html#team-access-section')+'">Modifier son niveau d’accès et ses droits</a>';
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
  // Présentation du Studio et accès reçu : mêmes textes que l’e-mail envoyé par l’API (access-email.js).
  var PRESENTATION={lead:'Le Studio Me&YouToo est la plateforme diversité et inclusion de votre entreprise. Vous pourrez y :',points:['créer et diffuser des autodiagnostics anonymes sur la diversité et l’inclusion (sexisme, handicap, origines, intergénérationnel…), conçus par les experts Me&YouToo ;','suivre la participation de vos collaborateurs et consulter les résultats ;','piloter vos actions D&I (conférences, formations…) et préparer votre bilan dans le Cockpit.']};
  function accessText(u){
    var level=LEVELS[u.accessLevel];if(!level)return '';
    var scope=u.accessLevel==='owner'||u.scope!=='folders'?'toutes les campagnes de l’entreprise':u.folderIds.length?(u.folderIds.length>1?'dossiers ':'dossier ')+u.folderIds.map(folderName).join(', '):'';
    return scope?level+' · '+scope:level;
  }
  function renderInvitePreview(){
    var org=data.organization.name,inviter=isAdmin?'':(((me.firstName||'')+' '+(me.lastName||'')).trim());
    var note=$('ae-invite-message').value.trim(),access=accessText(inviting);
    $('ae-invite-preview').innerHTML='<p>Bonjour '+esc(inviting.firstName||'')+',</p><p>'+esc(inviter?inviter+' vous invite à rejoindre le Studio Me&YouToo de l’entreprise '+org+'.':'L’équipe Me&YouToo vient de créer pour vous un accès au Studio Me&YouToo, rattaché à l’entreprise '+org+'.')+'</p>'+
      (note?'<blockquote>'+esc(note)+'</blockquote>':'')+
      '<div class="ae-preview-studio"><p><strong>'+esc(PRESENTATION.lead)+'</strong></p><ul>'+PRESENTATION.points.map(function(p){return '<li>'+esc(p)+'</li>';}).join('')+'</ul>'+(access?'<p><strong>Votre accès :</strong> '+esc(access)+'</p>':'')+'</div>'+
      '<p><span class="ae-fake-button">Créer mon mot de passe</span></p><p class="ae-muted">Ce lien est personnel, utilisable une seule fois et valable 72 heures.</p>';
  }
  async function openInvite(user){
    inviting=user;
    $('ae-invite-title').textContent=(data.invitationsEnabled?'Inviter ':'Préparer l’invitation de ')+name(user);
    $('ae-invite-later').hidden=data.invitationsEnabled;
    $('ae-invite-send').textContent=data.invitationsEnabled?'Envoyer l’invitation':'Enregistrer l’invitation';
    $('ae-invite-email').value=user.email||'';
    $('ae-invite-message').value=user.invitationMessage||'';
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
      data.invitationsEnabled?{title:'Invitation envoyée',message:who+' va recevoir son invitation par e-mail.'}:{title:'Invitation prête',message:'Aucun e-mail n’est parti. L’invitation de '+who+' partira automatiquement à la mise en production du Studio, avec votre mot d’accompagnement. Vous pouvez la modifier d’ici là.'});
  };
  document.querySelectorAll('dialog [data-close]').forEach(function(b){b.onclick=function(){b.closest('dialog').close();};});

  // ── Actions des listes ──
  document.addEventListener('click',async function(e){
    var t=e.target.closest('button');if(!t||!data)return;
    var row=t.closest('[data-suggestion]');
    if(t.hasAttribute('data-accept')&&row){
      var choice=row.querySelector('[data-scope]').value,level=row.querySelector('[data-level]').value,user=data.users.find(function(u){return u.id===row.dataset.suggestion;});
      if(!choice){await StudioModal.alert({type:'warning',title:'Choisissez son équipe',message:'Indiquez quelles campagnes '+name(user)+' verra : toutes, ou celles d’un dossier d’équipe.'});return;}
      var perimeter=choice==='all'?{scope:'all',folderIds:[]}:{scope:'folders',folderIds:[choice]},rights=rowRights(row);
      if(!await StudioModal.confirm({type:'info',title:'Intégrer '+name(user)+' ?',message:LEVELS[level]+' ('+rightsCount(rights)+'). '+summary(user,perimeter.scope,perimeter.folderIds)+' Aucune invitation n’est envoyée pour l’instant.',confirmLabel:'Intégrer'}))return;
      await act(function(){return api('/api/team-access/suggestions/'+user.id+'/accept',{method:'POST',body:JSON.stringify({accessLevel:level,permissions:rights,perimeter:perimeter})});});
    }else if(t.hasAttribute('data-refuse')&&row){
      openRefuse(data.users.find(function(u){return u.id===row.dataset.suggestion;}));
    }else if(t.hasAttribute('data-levels')){e.preventDefault();openLevels();}
    else if(t.dataset.rightsOf){var who=data.users.find(function(u){return u.id===t.dataset.rightsOf;});$('ae-levels-title').textContent='Ce que peut faire '+name(who);$('ae-levels-body').innerHTML='<p class="ae-summary">'+esc(LEVELS[who.accessLevel]||who.accessLevel)+' · '+rightsCount(who.permissions)+'</p>'+rightsHtml(who.permissions,false);$('ae-levels-dialog').showModal();}
    else if(t.dataset.addCampaigns){openAdd('campaigns',t.dataset.addCampaigns);}
    else if(t.dataset.addActions){openAdd('actions',t.dataset.addActions);}
    else if(t.hasAttribute('data-open-proposals')){openAdd('proposals',null);}
    else if(t.dataset.unfileAction){var ac=actions().find(function(x){return x.id===t.dataset.unfileAction;});
      if(await StudioModal.confirm({type:'warning',title:'Retirer « '+ac.title+' » du dossier ?',message:'Elle ne sera plus visible que des comptes « Toutes les campagnes ».',confirmLabel:'Retirer'}))
        await act(function(){return api('/api/team-access/actions/'+ac.id+'/folder',{method:'PUT',body:JSON.stringify({teamFolderId:null})});});}
    else if(t.dataset.unfile){var c=data.campaigns.find(function(x){return x.id===t.dataset.unfile;});
      if(await StudioModal.confirm({type:'warning',title:'Retirer « '+c.name+' » du dossier ?',message:'Elle ne sera plus visible que des comptes « Toutes les campagnes ».',confirmLabel:'Retirer'}))
        await act(function(){return api('/api/team-access/campaigns/'+c.id+'/folder',{method:'PUT',body:JSON.stringify({teamFolderId:null})});});}
    else if(t.dataset.reset){var back=data.users.find(function(u){return u.id===t.dataset.reset;}),refusedBack=back.suggestion==='refused';
      if(!await StudioModal.confirm({type:'warning',title:(refusedBack?'Annuler le refus de ':'Annuler l’intégration de ')+name(back)+' ?',message:name(back)+' redeviendra une suggestion à examiner, comme à son import : niveau et équipe à choisir de nouveau'+(refusedBack?'':', invitation préparée effacée')+'. Aucun e-mail n’est envoyé.',confirmLabel:refusedBack?'Annuler le refus':'Annuler l’intégration'}))return;
      await act(function(){return api('/api/team-access/suggestions/'+back.id+'/reset',{method:'POST'});});}
    else if(t.dataset.invite){openInvite(data.users.find(function(u){return u.id===t.dataset.invite;}));}
    else if(t.dataset.edit){openPerimeter(data.users.find(function(u){return u.id===t.dataset.edit;}));}
    else if(t.dataset.rename){
      var folder=data.teamFolders.find(function(f){return f.id===t.dataset.rename;});
      var next=await StudioModal.prompt({title:'Renommer le dossier',inputLabel:'Nom du dossier',value:folder.name,required:true,confirmLabel:'Renommer'});
      if(next)await act(function(){return api('/api/team-access/folders/'+folder.id,{method:'PATCH',body:JSON.stringify({name:next})});});
    }else if(t.dataset.deleteFolder){
      var del=data.teamFolders.find(function(f){return f.id===t.dataset.deleteFolder;});
      var alone=data.users.filter(function(u){return u.scope==='folders'&&u.folderIds.length===1&&u.folderIds[0]===del.id;}).map(name);
      if(!await StudioModal.confirm({type:'danger',title:'Supprimer « '+del.name+' » ?',message:'Ses '+del.campaignCount+' campagne(s) et ses actions ne seront plus rangées.'+(alone.length?' '+alone.join(', ')+' ne verra'+(alone.length>1?'ont':'')+' plus aucune campagne.':''),confirmLabel:'Supprimer'}))return;
      await act(function(){return api('/api/team-access/folders/'+del.id,{method:'DELETE'});});
    }
  });
  // Niveau changé sur une suggestion : on repart des droits par défaut de ce niveau ; case cochée : compteur à jour.
  document.addEventListener('change',function(e){
    var row=e.target.closest('[data-suggestion]');if(!row)return;
    if(e.target.matches('[data-level]'))row.querySelector('[data-rights-box]').innerHTML=rightsHtml(PRESETS[e.target.value],true);
    if(e.target.matches('[data-level],[data-right]'))row.querySelector('[data-rights-count]').textContent=rightsCount(rowRights(row));
  });
  // Ajouter des campagnes ou des actions à un dossier (cases à cocher, avec le dossier actuel de chacune),
  // ou ranger d’un coup les actions dont la thématique évoque un dossier (« proposals », cases cochées d’office).
  var adding=null;
  function where(x){return x.teamFolderId?'actuellement dans « '+esc(folderName(x.teamFolderId))+' » (elle en sera retirée)':'sans dossier';}
  function openAdd(mode,folderId){
    adding={mode:mode,folderId:folderId};
    var items,unfiledFirst=function(a,b){return (a.teamFolderId?1:0)-(b.teamFolderId?1:0);};
    if(mode==='campaigns')items=data.campaigns.filter(function(c){return c.teamFolderId!==folderId;}).sort(unfiledFirst).map(function(c){return {id:c.id,title:c.name,sub:esc(c.theme||'')+' · '+where(c)};});
    else if(mode==='actions')items=actions().filter(function(a){return a.teamFolderId!==folderId;}).sort(unfiledFirst).map(function(a){return {id:a.id,title:a.icon+' '+a.title,sub:esc(a.kindLabel)+' · '+esc(shortDate(a.date))+(a.theme?' · '+esc(a.theme):'')+' · '+where(a)};});
    else items=proposals().map(function(a){return {id:a.id,target:a.proposedFolderId,checked:true,title:a.icon+' '+a.title,sub:esc(a.kindLabel)+' · '+esc(shortDate(a.date))+' · '+esc(a.theme||'')+' → <strong>📁 '+esc(folderName(a.proposedFolderId))+'</strong>'};});
    $('ae-add-campaigns-title').textContent=mode==='proposals'?'Ranger les actions d’après leur thématique':'Ajouter des '+(mode==='actions'?'actions':'campagnes')+' à « '+folderName(folderId)+' »';
    $('ae-add-desc').textContent=mode==='proposals'?'Décochez celles qui doivent rester visibles de toute l’entreprise. Rien n’est rangé avant de cliquer sur « Ranger ».':'Cochez les '+(mode==='actions'?'actions':'campagnes')+' à ranger dans ce dossier : l’équipe du dossier les verra.';
    $('ae-add-campaigns-save').textContent=mode==='proposals'?'Ranger':'Ajouter au dossier';
    $('ae-add-campaigns-list').innerHTML=items.map(function(x){return '<li><label><input type="checkbox" value="'+esc(x.id)+'"'+(x.target?' data-target="'+esc(x.target)+'"':'')+(x.checked?' checked':'')+'> <span><strong>'+esc(x.title)+'</strong><small>'+x.sub+'</small></span></label></li>';}).join('');
    $('ae-add-campaigns-dialog').showModal();
  }
  $('ae-add-campaigns-save').onclick=async function(){
    var picked=[].map.call(document.querySelectorAll('#ae-add-campaigns-list input:checked'),function(i){return {id:i.value,target:i.dataset.target||adding.folderId};});
    $('ae-add-campaigns-dialog').close();if(!picked.length)return;
    var kind=adding.mode==='campaigns'?'campaigns':'actions';
    await act(async function(){for(var i=0;i<picked.length;i++)await api('/api/team-access/'+kind+'/'+picked[i].id+'/folder',{method:'PUT',body:JSON.stringify({teamFolderId:picked[i].target})});});
  };
  // Refuser une suggestion : « a quitté l’entreprise » (contact supprimé, Me&YouToo prévenu) ou « ne doit pas avoir accès ».
  var refusing=null;
  function openRefuse(user){
    refusing=user;
    $('ae-refuse-title').textContent='Refuser '+name(user)+' ?';
    document.querySelectorAll('input[name="ae-refuse-reason"]').forEach(function(i){i.checked=false;});
    $('ae-refuse-error').hidden=true;
    $('ae-refuse-dialog').showModal();
  }
  $('ae-refuse-dialog').addEventListener('change',function(){$('ae-refuse-error').hidden=true;});
  $('ae-refuse-confirm').onclick=async function(){
    var picked=document.querySelector('input[name="ae-refuse-reason"]:checked');
    if(!picked){$('ae-refuse-error').hidden=false;return;}
    $('ae-refuse-dialog').close();
    var who=name(refusing),left=picked.value==='left';
    await act(function(){return api('/api/team-access/suggestions/'+refusing.id+'/refuse',{method:'POST',body:JSON.stringify({reason:picked.value})});},
      left?{title:'Contact supprimé',message:who+' est retiré(e) du Studio. Me&YouToo est prévenu pour mettre sa base de contacts à jour.'}:{title:'Suggestion refusée',message:who+' n’aura pas accès au Studio.'});
  };

  // ── Mode démonstration : les actions sont jouées sur les données affichées, sans rien enregistrer ──
  var demoReviewed=false;
  function demoApply(path,method,body){
    var m,byId=function(list,id){return list.find(function(x){return x.id===String(id);});};
    var changed=true;
    if((m=path.match(/suggestions\/([^/]+)\/accept$/))){var a=byId(data.users,m[1]),p=body.perimeter||{scope:'all',folderIds:[]};
      Object.assign(a,{suggestion:'accepted',canInvite:true,accessLevel:body.accessLevel||a.accessLevel,permissions:body.permissions||a.permissions,scope:p.scope,folderIds:(p.folderIds||[]).map(String)});a.seesNothing=a.scope==='folders'&&!a.folderIds.length;}
    else if((m=path.match(/suggestions\/([^/]+)\/refuse$/)))data.users=data.users.filter(function(u){return u.id!==m[1];});
    else if((m=path.match(/suggestions\/([^/]+)\/reset$/)))Object.assign(byId(data.users,m[1]),{suggestion:'pending',canInvite:false,invitationPreparedAt:null,invitationMessage:'',accessLevel:'manager',permissions:PRESETS.manager,scope:'all',folderIds:[],seesNothing:false});
    else if((m=path.match(/users\/([^/]+)\/invite$/))){var i=byId(data.users,m[1]);i.email=body.email;i.invitationMessage=body.message||'';
      if(data.invitationsEnabled)Object.assign(i,{canInvite:false,status:'active'});else i.invitationPreparedAt=new Date().toISOString();}
    else if((m=path.match(/users\/([^/]+)\/perimeter$/))){var q=byId(data.users,m[1]);q.scope=body.scope;q.folderIds=(body.folderIds||[]).map(String);q.seesNothing=q.scope==='folders'&&!q.folderIds.length;}
    else if((m=path.match(/campaigns\/([^/]+)\/folder$/)))byId(data.campaigns,m[1]).teamFolderId=body.teamFolderId?String(body.teamFolderId):null;
    else if((m=path.match(/actions\/([^/]+)\/folder$/)))byId(actions(),m[1]).teamFolderId=body.teamFolderId?String(body.teamFolderId):null;
    else if(/\/folders$/.test(path))data.teamFolders.push({id:'demo-'+Date.now(),name:body.name,campaignCount:0});
    else if((m=path.match(/folders\/([^/]+)$/))){
      if(method==='DELETE'){data.teamFolders=data.teamFolders.filter(function(f){return f.id!==m[1];});
        data.campaigns.concat(actions()).forEach(function(x){if(x.teamFolderId===m[1])x.teamFolderId=null;});
        data.users.forEach(function(u){u.folderIds=u.folderIds.filter(function(id){return id!==m[1];});u.seesNothing=u.scope==='folders'&&!u.folderIds.length;});}
      else byId(data.teamFolders,m[1]).name=body.name;}
    else if(/\/review$/.test(path)){demoReviewed=true;changed=false;}
    if(changed)demoReviewed=false;
    data.teamFolders.forEach(function(f){f.campaignCount=data.campaigns.filter(function(c){return c.teamFolderId===f.id;}).length;});
    return Promise.resolve({ok:true,demo:true});
  }
  // Frise recalculée à l’écran, avec les mêmes règles que l’API (team-access.js, setupSteps).
  function recomputeSteps(){
    var live=data.users.filter(function(u){return u.suggestion!=='refused';});
    var undecided=live.filter(function(u){return u.suggestion==='pending';}).length;
    var unfiled=data.campaigns.filter(function(c){return !c.teamFolderId;}).length+actions().filter(function(a){return !a.teamFolderId&&a.proposedFolderId;}).length;
    var nothing=live.filter(function(u){return u.seesNothing;}).length,toInvite=live.filter(function(u){return u.canInvite&&!u.invitationPreparedAt;}).length;
    var state={suggestions:[undecided===0,undecided],folders:[data.teamFolders.length>0,data.teamFolders.length?0:1],campaigns:[data.teamFolders.length>0&&unfiled===0,unfiled],
      perimeters:[nothing===0&&undecided===0,nothing],invitations:[toInvite===0&&undecided===0,toInvite],review:[demoReviewed,demoReviewed?0:1]};
    data.steps.forEach(function(s){if(state[s.key]){s.done=state[s.key][0];s.todo=state[s.key][1];}});
  }
  function openLevels(){$('ae-levels-title').textContent='Ce que permet chaque niveau d’accès';$('ae-levels-body').innerHTML=levelsTable();$('ae-levels-dialog').showModal();}
  document.querySelectorAll('[data-open-levels]').forEach(function(b){b.onclick=openLevels;});
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
