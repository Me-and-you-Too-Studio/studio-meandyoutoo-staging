(function(){
  if(!StudioAPI.requireAuth('admin'))return;
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>Number(v||0).toLocaleString('fr-FR'),date=v=>v?new Date(v).toLocaleDateString('fr-FR'):'—',dateTime=v=>v?new Date(v).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Jamais';
  const labels={draft:'Brouillon',configuration_submitted:'À relire',review_pending:'À relire',in_review:'En relecture',client_validation_required:'Validation client requise',ready_to_publish:'Prête à publier',scheduled:'Programmée',published:'Publiée',active:'En cours',completed:'Terminée',unpublished:'Dépubliée'},pages={'accueil.html':'Accueil','composer.html':'Questions','personnalisation.html':'Profils','parametrage.html':'Paramétrage','validation.html':'Validation','mes-campagnes.html':'Mes campagnes','campagne-detail.html':'Détail campagne','account.html':'Mon compte','packs.html':'Commander des passations'};
  const state={organizations:[],activity:[],administrators:[],currentUserId:null,orgFilter:'all',clientFolderFilter:'all',clientFolders:[],clientUsers:new Map(),adminUsers:new Map(),catalogThemes:[],catalogLoaded:false,mediaLibrary:[],mediaThemes:[],mediaLibraryLoaded:false,migrationsLoaded:false,migrationBatches:[],promotionRequests:[],libraryThemeId:null,libraryExpandedChapters:new Set(),librarySituationFilters:new Map()};
  const orgDialog=$('#org-dialog'),userDialog=$('#user-dialog'),adminUserDialog=$('#admin-user-dialog'),contactsRoot=$('#org-contacts');
  const orgUsers=o=>Array.isArray(o.users)?o.users:[],orgProjects=o=>Array.isArray(o.projects)?o.projects:[],orgSectors=o=>Array.isArray(o.sectors)&&o.sectors.length?o.sectors:(o.sector?[o.sector]:[]),orgThemes=o=>{const counts=new Map();orgProjects(o).forEach(p=>{const t=String(p.theme_title||'').trim();if(t)counts.set(t,(counts.get(t)||0)+1);});return[...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0]));},remaining=o=>o.pack_unlimited?null:Math.max(0,Number(o.passations_quota||0)-Number(o.passations_used||0));
  function showError(message){const box=$('#admin-alert');box.hidden=false;box.textContent=message;box.scrollIntoView({behavior:'smooth',block:'center'});}
  function stats(o){const ps=orgProjects(o),us=orgUsers(o),quota=Number(o.passations_quota||0),used=Number(o.passations_used||0),rem=remaining(o),rate=quota?Math.min(100,Math.round(used/quota*100)):0,statuses={};ps.forEach(p=>statuses[p.status]=(statuses[p.status]||0)+1);const today=new Date().toISOString().slice(0,10),liveCount=ps.filter(p=>['published','active'].includes(p.status)&&(!p.launch_date||p.launch_date<=today)&&(!p.close_date||p.close_date>=today)).length,live=liveCount>0;const dates=[o.last_activity_at,...us.map(u=>u.last_seen_at||u.last_login_at),...ps.map(p=>p.updated_at)].filter(Boolean).map(v=>new Date(v).getTime()),last=dates.length?Math.max(...dates):0,month=30*24*60*60*1000,projectStarts=ps.map(p=>p.created_at||p.launch_date).filter(Boolean).map(v=>new Date(v).getTime()).filter(Number.isFinite),expiry=o.pack_expires_at?new Date(o.pack_expires_at):null,inferredPackStart=expiry?new Date(expiry.getFullYear()-1,expiry.getMonth(),expiry.getDate()).getTime():0,started=Math.min(...[...projectStarts,inferredPackStart].filter(v=>v>0)),packOlderThanMonth=Number.isFinite(started)&&Date.now()-started>=month,hasActivity=last>0||ps.length>0,toPublish=['configuration_submitted','review_pending','in_review','client_validation_required','ready_to_publish'].reduce((n,key)=>n+Number(statuses[key]||0),0);return{ps,us,rem,rate,statuses,live,liveCount,last,pending:Boolean(o.pending_pack_request),toPublish,low:rem!==null&&quota>0&&rem/quota<=.2,underused:quota>0&&packOlderThanMonth&&rate<=10,hasActivity,accessOpen:o.active!==false};}
  function health(o){const s=stats(o),items=[];if(s.live)items.push(['good','🟢 Campagne en cours']);if(s.toPublish)items.push(['info',`🚀 ${s.toPublish} à publier`]);if(s.pending)items.push(['warn','📦 Demande à valider']);if(s.low)items.push(['danger','🔥 Crédits faibles']);if(s.underused)items.push(['warn','💤 Pack sous-utilisé après 1 mois']);if(!s.us.length)items.push(['warn','⚠️ Aucun compte']);if(!s.hasActivity)items.push(['muted','⚪ Aucune activité']);return items.map(([kind,text])=>`<span class="admin-health ${kind}">${text}</span>`).join('');}
  function activateTab(name){$$('[data-admin-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.adminTab===name));$$('[data-admin-panel]').forEach(p=>p.classList.toggle('is-active',p.dataset.adminPanel===name));if(name==='library'&&!state.catalogLoaded)loadLibraryAdmin();if(name==='media'&&!state.mediaLibraryLoaded)loadMediaLibrary();if(name==='migrations'&&!state.migrationsLoaded)loadMigrations();}
  function bindNavigation(){$$('[data-admin-tab]').forEach(b=>b.onclick=()=>activateTab(b.dataset.adminTab));$$('[data-kpi-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.kpiFilter)state.orgFilter=b.dataset.kpiFilter;activateTab(b.dataset.kpiTab);renderOrganizations();});}
  async function load(){try{const[cockpit,team]=await Promise.all([StudioAPI.request('/api/admin/cockpit'),StudioAPI.request('/api/admin/administrators')]);state.organizations=cockpit.organizations||[];state.clientFolders=cockpit.clientFolders||[];state.activity=cockpit.activity||[];state.administrators=team.administrators||[];state.currentUserId=team.currentUserId;state.clientUsers=new Map(state.organizations.flatMap(o=>orgUsers(o).map(u=>[String(u.id),{...u,organizationId:o.id,organizationName:o.name}])));state.adminUsers=new Map(state.administrators.map(u=>[String(u.id),u]));renderAll();}catch(error){showError(error.message);}}
  function renderAll(){renderKpis();renderOverview();renderSectors();renderThemeFilter();renderChips();renderClientFolderBar();renderOrganizations();renderCampaigns();renderAccounts();renderAdministrators();renderActivity();applyRequestedView();}
  function applyRequestedView(){const q=new URLSearchParams(location.search),tab=q.get('tab'),status=q.get('status'),filter=q.get('filter');if(tab)activateTab(tab);if(tab==='campaigns'&&status&&$('#campaign-status')){$('#campaign-status').value=status;renderCampaigns();}if(tab==='clients'&&filter){state.orgFilter=filter;renderChips();renderOrganizations();}}
  function renderKpis(){const ss=state.organizations.map(stats),campaigns=state.organizations.flatMap(orgProjects),credits=state.organizations.filter(o=>!o.pack_unlimited).reduce((n,o)=>n+remaining(o),0),toPublish=ss.reduce((n,s)=>n+s.toPublish,0),liveCampaigns=ss.reduce((n,s)=>n+s.liveCount,0),activeClients=ss.filter(s=>s.hasActivity).length,lowCredits=ss.filter(s=>s.low).length,pendingRequests=ss.filter(s=>s.pending).length,underusedPacks=ss.filter(s=>s.underused).length,alerts=ss.reduce((n,s)=>n+s.toPublish+(s.pending?1:0)+(s.low?1:0),0);$('#kpi-clients').textContent=activeClients;$('#kpi-clients-note').textContent=`${state.organizations.length} entreprise${state.organizations.length>1?'s':''}`;$('#kpi-campaigns').textContent=campaigns.length;$('#kpi-campaigns-note').textContent=`${toPublish} à publier`;$('#kpi-credits').textContent=fmt(credits);$('#kpi-alerts').textContent=alerts;const clientKpis={active:activeClients,publish:toPublish,live:liveCampaigns,low:lowCredits,requests:pendingRequests,underused:underusedPacks};Object.entries(clientKpis).forEach(([key,value])=>{const el=$(`#client-kpi-${key}`);if(el)el.textContent=fmt(value);});}
  function renderOverview(){const ss=state.organizations.map(stats),campaigns=state.organizations.flatMap(orgProjects),count=s=>campaigns.filter(p=>p.status===s).length,cards=[['🧩','Campagnes',[['Brouillons',count('draft'),'campaigns'],['À publier',count('configuration_submitted'),'campaigns'],['Publiées',count('published'),'campaigns'],['Terminées',count('completed'),'campaigns']]],['🏢','Clients',[['Avec activité',ss.filter(s=>s.hasActivity).length,'clients'],['Sans compte',ss.filter(s=>!s.us.length).length,'clients'],['Crédits faibles',ss.filter(s=>s.low).length,'clients'],['Packs sous-utilisés après 1 mois',ss.filter(s=>s.underused).length,'clients']]],['⚠️','Actions attendues',[['Configurations transmises',ss.reduce((n,s)=>n+s.toPublish,0),'campaigns'],['Demandes de passations',ss.filter(s=>s.pending).length,'clients'],['Invitations à finaliser',state.organizations.flatMap(orgUsers).filter(u=>u.must_change_password).length,'accounts'],['Comptes désactivés',state.organizations.flatMap(orgUsers).filter(u=>!u.active).length,'accounts']]]];$('#admin-overview').innerHTML=cards.map(([ico,title,lines])=>`<article class="admin-overview-card"><div class="admin-overview-icon">${ico}</div><div><h3>${title}</h3>${lines.map(([label,total,tab])=>`<button data-overview-tab="${tab}"><span>${label}</span><strong>${total}</strong></button>`).join('')}</div></article>`).join('');$$('[data-overview-tab]').forEach(b=>b.onclick=()=>activateTab(b.dataset.overviewTab));}
  function renderSectors(){const select=$('#org-sector-filter'),current=select.value,values=[...new Set(state.organizations.flatMap(orgSectors))].sort((a,b)=>a.localeCompare(b));select.innerHTML='<option value="">Tous les secteurs</option>'+values.map(v=>`<option>${esc(v)}</option>`).join('');if(values.includes(current))select.value=current;}
  function renderThemeFilter(){const select=$('#org-theme-filter');if(!select)return;const current=select.value,values=[...new Set(state.organizations.flatMap(o=>orgThemes(o).map(([name])=>name)))].sort((a,b)=>a.localeCompare(b));select.innerHTML='<option value="">Toutes les thématiques</option>'+values.map(v=>`<option>${esc(v)}</option>`).join('');if(values.includes(current))select.value=current;}
  function matches(o){const s=stats(o),f=state.orgFilter;return f==='all'||(f==='active'&&s.hasActivity)||(f==='publish'&&s.toPublish)||(f==='live'&&s.live)||(f==='low'&&s.low)||(f==='pack'&&s.pending)||(f==='underused'&&s.underused)||(f==='no-user'&&!s.us.length)||(f==='inactive'&&!s.hasActivity);}
  function renderChips(){const fs=[['all','✨ Tous'],['active','🟢 Avec activité'],['publish','🚀 À publier'],['live','📣 En cours'],['low','🔥 Crédits faibles'],['pack','📦 Demandes à valider'],['underused','💤 Sous-utilisés après 1 mois'],['no-user','⚠️ Sans compte'],['inactive','⚪ Sans activité']];$('#org-filter-chips').innerHTML=fs.map(([key,label])=>{const before=state.orgFilter;state.orgFilter=key;const n=state.organizations.filter(matches).length;state.orgFilter=before;return`<button class="${state.orgFilter===key?'is-active':''}" data-org-filter="${key}">${label}<strong>${n}</strong></button>`;}).join('');$$('[data-org-filter]').forEach(b=>b.onclick=()=>{state.orgFilter=b.dataset.orgFilter;renderChips();renderOrganizations();});}
  function filteredOrgs(){const q=$('#org-search').value.toLowerCase().trim(),sector=$('#org-sector-filter').value,theme=$('#org-theme-filter')?.value||'',sort=$('#org-sort').value;const rows=state.organizations.filter(o=>{const text=[o.name,...orgSectors(o),...orgUsers(o).flatMap(u=>[u.first_name,u.last_name,u.email,u.job_title]),accountManagerName(o.account_manager_user_id),...orgProjects(o).flatMap(p=>[p.campaign_name,p.theme_title])].join(' ').toLowerCase();const folderOk=state.clientFolderFilter==='all'||(state.clientFolderFilter==='favorites'?o.admin_favorite===true:(state.clientFolderFilter==='unclassified'?!o.admin_client_folder_id:String(o.admin_client_folder_id||'')===state.clientFolderFilter));return folderOk&&(!q||text.includes(q))&&(!sector||orgSectors(o).includes(sector))&&(!theme||orgThemes(o).some(([name])=>name===theme))&&matches(o);});rows.sort((a,b)=>{const x=stats(a),y=stats(b);if(sort==='recent')return y.last-x.last;if(sort==='remaining')return(x.rem??Infinity)-(y.rem??Infinity);if(sort==='usage')return y.rate-x.rate;if(sort==='campaigns')return y.ps.length-x.ps.length;if(sort==='name')return a.name.localeCompare(b.name);const score=s=>s.toPublish*50+(s.pending?60:0)+(s.low?35:0)+(s.live?30:0)+(s.underused?15:0);return score(y)-score(x);});return rows;}
  function subscriptionHtml(o){const sub=o.studio_subscription;if(!sub)return'<div class="admin-subscription-card"><span>Abonnement Studio</span><strong>Inclus / historique</strong><small>Aucun abonnement Stripe rattaché</small></div>';const plan=sub.plan==='annual'?'Annuel':'Mensuel',status=sub.cancellationScheduled?'Résilié à échéance':sub.status==='active'?'Actif':sub.status==='expired'?'Expiré':'Résilié';return`<div class="admin-subscription-card is-${esc(sub.status||'active')}"><span>Abonnement Studio</span><strong>${status} · ${plan}</strong><small>Début : ${date(sub.periodStart)} · Fin de période : ${date(sub.periodEnd)}</small></div>`;}
  function packHtml(o){const r=o.pending_pack_request;if(!r)return'';return`<div class="admin-pack-alert"><div><strong>📦 Demande : ${r.unlimited?'Illimité':fmt(r.volume)+' passations'}</strong><span>${esc(r.requesterEmail||'Client')} · validité prévue ${date(r.expiresAt)}</span></div><div><button class="button button-primary" data-pack="approve" data-pack-id="${r.id}">Valider</button><button class="button button-danger-soft" data-pack="reject" data-pack-id="${r.id}">Refuser</button></div></div>`;}
  function userRow(u,o){const status=!u.active?'Désactivé':u.must_change_password?'Invitation à finaliser':'Activé';return`<article class="admin-inline-user"><div><strong>${esc((u.first_name||'')+' '+(u.last_name||''))}</strong><span>${esc(u.job_title||'Fonction non renseignée')} · ${esc(u.email)}</span><small>${status} · activité ${dateTime(u.last_seen_at||u.last_login_at)}</small></div><div>${u.must_change_password&&u.active?`<button data-resend-client="${u.id}">Renvoyer</button>`:''}<button data-edit-client="${u.id}">Modifier</button><button data-toggle-client="${u.id}" data-active="${u.active?'false':'true'}">${u.active?'Désactiver':'Réactiver'}</button><button class="danger" data-delete-client="${u.id}">Supprimer</button></div></article>`;}
const normalizedStatus=p=>p.status==='configuration_submitted'?'review_pending':p.status==='completed'?'unpublished':p.status;
  const statusLabel=p=>({draft:'Brouillon',review_pending:'À relire',in_review:'En relecture',client_validation_required:'Validation client requise',ready_to_publish:'Prête à publier',scheduled:'Programmé',published:'Publié',active:'Publié',unpublished:'Dépublié',archived:'Archivé'}[normalizedStatus(p)]||labels[p.status]||p.status);
  function adFilterKey(p){const st=normalizedStatus(p),now=new Date(),close=p.close_date?new Date(String(p.close_date).slice(0,10)+'T12:00:00'):null;if(['published','active'].includes(st)&&close){const d=Math.ceil((close-now)/86400000);if(d>=0&&d<14)return'endingSoon';}if(['review_pending','in_review','client_validation_required','ready_to_publish'].includes(st))return'sent';if(st==='draft')return'draft';if(st==='archived')return'archived';if(st==='unpublished')return'unpublished';if(['published','active','scheduled'].includes(st))return'published';return st;}
  function adCard(p,o){const st=normalizedStatus(p),theme=p.theme_title||'Thématique',title=p.campaign_name||p.title||'Sans nom',respondent=p.respondent_title||title,contact=orgUsers(o)[0],commanditaire=contact?`${esc((contact.first_name||'')+' '+(contact.last_name||''))} — ${esc(contact.email||'')}`:'Non renseigné dans cet AD.',review=['review_pending','in_review','client_validation_required','ready_to_publish'].includes(st);return`<article class="admin-ad-card" data-ad-card data-status="${adFilterKey(p)}" data-search="${esc((title+' '+theme+' '+respondent).toLowerCase())}" id="admin-ad-${p.id}"><h3>${esc(title)}</h3><div class="admin-ad-meta">Base catalogue : <strong>${esc(theme)}</strong></div><div class="admin-ad-meta">Titre répondants : <strong>${esc(respondent)}</strong></div><div class="admin-ad-tags"><span class="admin-ad-theme">${esc(theme)}</span><span class="admin-ad-status status-${st}">${statusLabel(p)}</span></div><div class="admin-ad-commanditaire"><strong>Commanditaire campagne</strong><span>${commanditaire}</span></div><div class="admin-ad-dates">Début : ${date(p.launch_date)}<br>Fin : ${date(p.close_date)}</div><div class="admin-ad-actions">${review?`<a class="button button-primary" href="validation.html?projectId=${p.id}">🔎 Relecture et corrections</a>`:st==='draft'?`<a class="button button-secondary" href="composer.html?projectId=${p.id}">Modifier le contenu</a>`:`<a class="button button-secondary" href="campagne-detail.html?id=${p.id}">👁️ Voir le contenu</a>`}<a class="button button-secondary" href="kit-communication.html?projectId=${p.id}">📣 Kit de com</a>${['unpublished','archived'].includes(st)?`<a class="button button-secondary" href="parametrage.html?projectId=${p.id}&reprogram=1">🚀 Reprogrammer</a>`:''}${st==='unpublished'?`<button class="button button-secondary" type="button" disabled title="Archivage à connecter à l’API">📦 Archiver</button>`:''}</div></article>`;}
  function clientFolder(o){const ps=orgProjects(o),counts={all:ps.length,endingSoon:0,sent:0,results:0,draft:0,published:0,unpublished:0,archived:0};ps.forEach(p=>{const k=adFilterKey(p);if(counts[k]!=null)counts[k]++;});const chips=[['all','✨ Tous'],['endingSoon','🔴 Fin proche'],['sent','🚀 À publier'],['results','📊 Résultats dispo'],['draft','✏️ Brouillons'],['published','🟢 Publiés'],['unpublished','🛑 Dépubliés'],['archived','📦 Archivés']];return`<section class="admin-client-folder" data-client-folder="${o.id}"><div class="admin-ad-filterbar">${chips.map(([k,l])=>`<button type="button" class="${k==='all'?'is-active':''}" data-ad-filter="${k}">${l} <strong>${counts[k]}</strong></button>`).join('')}<label class="admin-ad-search">🔎 <input type="search" placeholder="Rechercher un AD, une thématique…" data-ad-search></label></div><div class="admin-ad-grid">${ps.map(p=>adCard(p,o)).join('')||'<p class="admin-empty">Aucun autodiagnostic.</p>'}</div></section>`;}
  function clientFolderById(id){return state.clientFolders.find(f=>String(f.id)===String(id));}
  function askClientFolderName(title,value=''){return new Promise(resolve=>{document.getElementById('admin-client-folder-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='admin-client-folder-dialog';dialog.className='admin-dialog campaign-rename-dialog';dialog.innerHTML=`<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Classement administratif</p><h2>${esc(title)}</h2><p>Créez vos propres dossiers, par exemple par associée, équipe ou portefeuille.</p><label class="field"><span>Nom du dossier</span><input id="admin-client-folder-name" maxlength="80" minlength="2" required value="${esc(value)}"></label><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="confirm-admin-client-folder" type="button">Enregistrer</button></div></form>`;document.body.append(dialog);let done=false;const finish=result=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(result);};dialog.querySelectorAll('[value="cancel"]').forEach(b=>b.onclick=()=>finish(null));dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});dialog.querySelector('#confirm-admin-client-folder').onclick=()=>{const input=dialog.querySelector('#admin-client-folder-name'),result=input.value.replace(/\s+/g,' ').trim();if(result.length<2){input.reportValidity();return;}finish(result);};dialog.showModal();dialog.querySelector('#admin-client-folder-name').focus();});}
  function askClientMoveFolder(o){return new Promise(resolve=>{document.getElementById('admin-client-move-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='admin-client-move-dialog';dialog.className='admin-dialog campaign-rename-dialog';dialog.innerHTML=`<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Classement administratif</p><h2>Classer le client</h2><p>« ${esc(o.name)} »</p><label class="field"><span>Dossier</span><select id="admin-client-folder-select"><option value="">Non classés</option>${state.clientFolders.map(f=>`<option value="${esc(f.id)}" ${String(o.admin_client_folder_id||'')===String(f.id)?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="confirm-admin-client-move" type="button">Classer</button></div></form>`;document.body.append(dialog);let done=false;const finish=result=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(result);};dialog.querySelectorAll('[value="cancel"]').forEach(b=>b.onclick=()=>finish(null));dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});dialog.querySelector('#confirm-admin-client-move').onclick=()=>finish(dialog.querySelector('#admin-client-folder-select').value);dialog.showModal();});}
  function renderClientFolderBar(){const root=$('#admin-client-folder-bar');if(!root)return;const chip=(key,label,count)=>`<button type="button" class="campaign-folder-chip ${state.clientFolderFilter===key?'is-active':''}" data-client-folder-filter="${esc(key)}"><span>${label}</span><strong>${count}</strong></button>`;root.innerHTML=`<div class="campaign-folder-heading"><div><strong>Dossiers clients</strong><span>Classement administratif partagé du portefeuille clients</span></div><button class="campaign-folder-create" type="button" data-client-folder-create>+ Nouveau dossier</button></div><div class="campaign-folder-list">${chip('all','🗂️ Tous',state.organizations.length)}${chip('favorites','⭐ Favoris',state.organizations.filter(o=>o.admin_favorite).length)}${chip('unclassified','📄 Non classés',state.organizations.filter(o=>!o.admin_client_folder_id).length)}${state.clientFolders.map(f=>`<span class="campaign-folder-group">${chip(String(f.id),'📁 '+esc(f.name),state.organizations.filter(o=>String(o.admin_client_folder_id||'')===String(f.id)).length)}<button type="button" class="campaign-folder-manage" data-client-folder-manage="${esc(f.id)}" aria-label="Gérer le dossier ${esc(f.name)}">•••</button></span>`).join('')}</div>`;root.querySelectorAll('[data-client-folder-filter]').forEach(b=>b.onclick=()=>{state.clientFolderFilter=b.dataset.clientFolderFilter;renderClientFolderBar();renderOrganizations();});root.querySelector('[data-client-folder-create]')?.addEventListener('click',async()=>{const name=await askClientFolderName('Nouveau dossier');if(!name)return;try{await StudioAPI.request('/api/admin/client-folders',{method:'POST',body:JSON.stringify({name})});await load();}catch(error){showError(error.message);}});root.querySelectorAll('[data-client-folder-manage]').forEach(b=>b.onclick=async()=>{const folder=clientFolderById(b.dataset.clientFolderManage);if(!folder)return;const rename=await StudioModal.confirm({eyebrow:'Dossier clients',title:folder.name,message:'Renommez ce dossier, ou supprimez-le pour replacer ses clients dans « Non classés ».',cancelLabel:'Supprimer le dossier',confirmLabel:'Renommer'});try{if(rename){const name=await askClientFolderName('Renommer le dossier',folder.name);if(!name||name===folder.name)return;await StudioAPI.request('/api/admin/client-folders/'+folder.id,{method:'PATCH',body:JSON.stringify({name})});}else{const remove=await StudioModal.confirm({type:'danger',title:`Supprimer le dossier « ${folder.name} » ?`,message:'Les clients ne seront pas supprimés. Ils retourneront dans « Non classés ».',cancelLabel:'Conserver',confirmLabel:'Supprimer le dossier'});if(!remove)return;await StudioAPI.request('/api/admin/client-folders/'+folder.id,{method:'DELETE'});if(state.clientFolderFilter===String(folder.id))state.clientFolderFilter='all';}await load();}catch(error){showError(error.message);}});}
  function accountManagerOptions(selectedId=''){const admins=(state.administrators||[]).filter(u=>u.active!==false);return '<option value="">Non attribué</option>'+admins.map(u=>{const label=((u.first_name||'')+' '+(u.last_name||'')).trim()||u.email;return `<option value="${u.id}" ${String(u.id)===String(selectedId||'')?'selected':''}>${esc(label)}${u.job_title?' · '+esc(u.job_title):''}</option>`;}).join('');}
  function accountManagerName(id){const u=(state.administrators||[]).find(a=>String(a.id)===String(id||''));return u?(((u.first_name||'')+' '+(u.last_name||'')).trim()||u.email):'Non attribué';}
  function renderOrganizations(){const rows=filteredOrgs(),sectorChoices=[...$('#org-sector').options].filter(o=>o.value).map(o=>o.value);$('#admin-organizations').innerHTML=rows.map(o=>{const st=stats(o),rateClass=st.rate>=90?'critical':st.rate>=75?'warning':'',initial=String(o.name||'C').slice(0,1).toUpperCase(),users=orgUsers(o),primary=users.find(u=>u.access_level==='owner')||users[0],themes=orgThemes(o),currentSector=orgSectors(o)[0]||'',sectorOptions=sectorChoices.map(v=>`<option value="${esc(v)}" ${v===currentSector?'selected':''}>${esc(v)}</option>`).join('');return`<article class="admin-client-card admin-client-card-rich" data-org-card="${o.id}"><header><div class="admin-client-title"><span class="admin-client-avatar">${esc(initial)}</span><div><h3>${esc(o.name)}</h3><p>${esc(currentSector||'Secteur non renseigné')} · ${st.ps.length} AD · ${st.us.length} compte${st.us.length>1?'s':''}</p><div class="admin-theme-tags">${themes.map(([name,count])=>`<span>🌼 ${esc(name)} <strong>${count}</strong></span>`).join('')||'<span class="is-empty">Aucune thématique utilisée</span>'}</div><div class="admin-health-row">${health(o)}</div></div></div><span class="badge ${st.accessOpen?'badge-success':'badge-muted'}">${st.accessOpen?'Accès ouvert':'Cockpit archivé'}</span></header>${subscriptionHtml(o)}<div class="admin-client-kpis"><div class="pack"><span>Crédits attribués</span><strong>${o.pack_unlimited?'Illimité':fmt(o.passations_quota)}</strong><small>Fin : ${date(o.pack_expires_at)}</small></div><div class="remaining"><span>Restants</span><strong>${o.pack_unlimited?'∞':fmt(st.rem)}</strong><small>Solde disponible</small></div><div class="used"><span>Utilisation</span><strong>${st.rate}%</strong><small>${fmt(o.passations_used)} utilisés</small><i><b class="${rateClass}" style="width:${st.rate}%"></b></i></div><div class="activity"><span>Dernière activité</span><strong>${st.last?dateTime(st.last):'Jamais'}</strong><small>${st.toPublish} à publier</small></div></div>${packHtml(o)}<div class="admin-client-management"><section class="admin-client-contact-block"><h4>👤 Responsable de compte Me&YouToo</h4><strong class="admin-account-manager-name">${esc(accountManagerName(o.account_manager_user_id))}</strong><small>Référent interne du dossier client</small><h4>👤 Contact dossier</h4>${primary?`<strong>${esc((primary.first_name||'')+' '+(primary.last_name||''))}</strong><span>${esc(primary.job_title||'Fonction non renseignée')}</span><a href="mailto:${esc(primary.email||'')}">${esc(primary.email||'')}</a>${primary.phone?`<span>${esc(primary.phone)}</span>`:''}`:'<span>Aucun contact renseigné</span>'}<h4>👥 Comptes rattachés</h4><div class="admin-linked-users">${users.map(u=>`<div><span>${esc((u.first_name||'')+' '+(u.last_name||''))}</span><small>${esc(u.email||'')}</small><em>${u.active?'Actif':'Désactivé'}</em></div>`).join('')||'<span>Aucun compte</span>'}</div></section><section class="admin-client-pack-manager"><div class="admin-pack-manager-head"><div><h4>📦 Gestion du pack</h4><p>${o.pack_unlimited?'Pack illimité':fmt(o.passations_used)+' utilisées · '+fmt(st.rem)+' restantes'}</p></div></div><div class="admin-pack-form-grid"><label>Responsable de compte<select data-account-manager="${o.id}">${accountManagerOptions(o.account_manager_user_id)}</select></label><label>Secteur<select data-sector="${o.id}"><option value="">Choisir</option>${sectorOptions}</select></label><label>Crédits attribués<input data-quota="${o.id}" type="number" min="0" value="${Number(o.passations_quota||0)}" ${o.pack_unlimited?'disabled':''}></label><label>Crédits utilisés<input data-used="${o.id}" type="number" min="0" value="${Number(o.passations_used||0)}" ${o.pack_unlimited?'disabled':''}></label><label>Fin de validité<input data-expiry="${o.id}" type="date" value="${o.pack_expires_at?String(o.pack_expires_at).slice(0,10):''}"></label><label class="admin-pack-unlimited-inline"><input data-unlimited="${o.id}" type="checkbox" ${o.pack_unlimited?'checked':''}> Pack illimité</label></div><button class="button button-primary" type="button" data-save-credits="${o.id}">Enregistrer la gestion</button></section></div><div class="admin-client-classification"><span>${o.admin_favorite?'⭐ Favori':'☆ Non favori'}${clientFolderById(o.admin_client_folder_id)?' · 📁 '+esc(clientFolderById(o.admin_client_folder_id).name):' · Non classé'}</span><div><button class="button button-secondary" type="button" data-favorite-org="${o.id}" data-next-favorite="${o.admin_favorite?'false':'true'}">${o.admin_favorite?'Retirer des favoris':'☆ Ajouter aux favoris'}</button><button class="button button-secondary" type="button" data-move-client-folder="${o.id}">📁 Classer</button></div></div><div class="admin-client-open-row"><a class="button button-primary" href="client.html?organizationId=${encodeURIComponent(o.id)}">Ouvrir le dossier client</a><button class="button button-secondary" data-add-user="${o.id}">+ Ajouter un accès</button><button class="button button-secondary" data-archive-org="${o.id}" data-next-active="${st.accessOpen?'false':'true'}">${st.accessOpen?'Archiver le cockpit':'Réactiver le cockpit'}</button><button class="button button-danger-soft" data-delete-org="${o.id}">Supprimer le cockpit</button></div></article>`;}).join('')||'<div class="card admin-empty">Aucun client ne correspond aux filtres.</div>';bindOrgActions();}
    function renderCampaigns(){const q=$('#campaign-search').value.toLowerCase().trim(),filter=$('#campaign-status').value,rows=state.organizations.flatMap(o=>orgProjects(o).map(p=>({...p,organizationName:o.name}))).filter(p=>(!filter||p.status===filter)&&(!q||[p.campaign_name,p.title,p.theme_title,p.organizationName].join(' ').toLowerCase().includes(q))).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));$('#admin-campaigns').innerHTML=rows.map(p=>`<article class="admin-campaign-card"><div><span class="badge badge-status">${labels[p.status]||esc(p.status)}</span><h3>${esc(p.campaign_name||p.title||'Sans nom')}</h3><p>${esc(p.organizationName)} · ${esc(p.theme_title||'Thématique non renseignée')}</p></div><dl><div><dt>Étape</dt><dd>${esc(p.current_step||'—')}</dd></div><div><dt>Dernière modification</dt><dd>${dateTime(p.updated_at)}</dd></div><div><dt>Dates</dt><dd>${date(p.launch_date)} → ${date(p.close_date)}</dd></div></dl><a class="button button-secondary" href="client.html?projectId=${p.id}">Ouvrir dans le dossier client</a></article>`).join('')||'<div class="card admin-empty">Aucune campagne.</div>';}
  function renderAccounts(){const q=$('#account-search').value.toLowerCase().trim(),filter=$('#account-status').value,rows=[...state.clientUsers.values()].filter(u=>{const current=!u.active?'disabled':u.must_change_password?'pending':'active';return(!filter||filter===current)&&(!q||[u.first_name,u.last_name,u.email,u.organizationName,u.job_title].join(' ').toLowerCase().includes(q));});$('#admin-client-accounts').innerHTML=rows.map(u=>`<article class="admin-account-card"><div><strong>${esc((u.first_name||'')+' '+(u.last_name||''))}</strong><span>${esc(u.organizationName)} · ${esc(u.job_title||'Fonction non renseignée')}</span><small>${esc(u.email)} · téléphone ${esc(u.phone||'non renseigné')}</small></div><span class="badge ${!u.active?'badge-muted':u.must_change_password?'badge-warning':'badge-success'}">${!u.active?'Désactivé':u.must_change_password?'Invitation à finaliser':'Activé'}</span><div class="admin-account-actions"><button data-edit-client="${u.id}">Modifier</button>${u.must_change_password&&u.active?`<button data-resend-client="${u.id}">Renvoyer</button>`:''}<button data-toggle-client="${u.id}" data-active="${u.active?'false':'true'}">${u.active?'Désactiver':'Réactiver'}</button><button class="danger" data-delete-client="${u.id}">Supprimer</button></div></article>`).join('')||'<div class="card admin-empty">Aucun compte client.</div>';bindUserActions($('#admin-client-accounts'));}
  function renderAdministrators(){$('#admin-users').innerHTML=state.administrators.map(u=>{const self=String(u.id)===String(state.currentUserId);return`<article class="admin-team-row"><div><strong>${esc((u.first_name||'')+' '+(u.last_name||''))}</strong>${self?' <span class="badge badge-muted">Votre compte</span>':''}<p>${esc(u.email)}${u.job_title?' · '+esc(u.job_title):''}</p><span class="badge ${!u.active?'badge-muted':u.must_change_password?'badge-warning':'badge-success'}">${!u.active?'Désactivé':u.must_change_password?'Invitation à finaliser':'Activé'}</span></div><div class="admin-team-actions">${u.must_change_password&&u.active?`<button data-admin-resend="${u.id}">Renvoyer</button>`:''}<button data-admin-edit="${u.id}">Modifier</button>${self?'':`<button data-admin-active="${u.id}" data-active="${u.active?'false':'true'}">${u.active?'Désactiver':'Réactiver'}</button><button class="danger" data-admin-delete="${u.id}">Supprimer</button>`}</div></article>`;}).join('');bindAdminActions();}
  function renderActivity(){const q=$('#activity-search').value.toLowerCase().trim(),rows=state.activity.filter(a=>!q||[a.first_name,a.last_name,a.email,a.organization_name,a.page,a.campaign_name].join(' ').toLowerCase().includes(q));$('#admin-activity').innerHTML=rows.map(a=>`<article><span class="admin-activity-icon">${a.project_id?'🧩':'👤'}</span><div><strong>${esc((a.first_name||'')+' '+(a.last_name||''))}</strong><p>${esc(a.organization_name||'')} · ${esc(pages[a.page]||a.page)}${a.campaign_name?' · '+esc(a.campaign_name):''}</p></div><time>${dateTime(a.created_at)}</time></article>`).join('')||'<div class="card admin-empty">Aucune activité enregistrée.</div>';}
  async function loadMigrations(){
    try{
      const [batches,promotions]=await Promise.all([StudioAPI.request('/api/admin/migrations'),StudioAPI.request('/api/admin/catalog-promotion-requests')]);
      state.migrationBatches=batches.batches||[];state.promotionRequests=promotions.requests||[];state.migrationsLoaded=true;renderMigrations();
    }catch(e){showError(e.message);}
  }
  function migrationStatusLabel(s){return({draft:'Brouillon',dry_run_ready:'Dry-run prêt',approved:'Approuvé',importing:'Import en cours',review_ready:'En zone de revue',completed:'Test intégré',failed:'Erreur',rolled_back:'Test annulé',archived:'Archivé'})[s]||s;}
  function dryRunText(b){const d=b?.summary?.dryRun;if(!d)return'';return `${fmt(d.accepted)} éléments · ${fmt(d.exactMatches)} déjà présents · ${fmt(d.possibleVariants)} variantes possibles · ${fmt(d.newEntities)} nouveaux`;}
  function renderMigrations(){
    const rows=state.migrationBatches||[],activeRows=rows.filter(x=>x.status!=='archived'),archivedRows=rows.filter(x=>x.status==='archived'),pending=(state.promotionRequests||[]).filter(x=>x.status==='pending').length;
    const k=$('#migration-kpis');if(k)k.innerHTML=`<article><strong>${activeRows.length}</strong><span>Lots actifs</span></article><article><strong>${activeRows.filter(x=>x.status==='dry_run_ready').length}</strong><span>Dry-runs à valider</span></article><article><strong>${activeRows.filter(x=>x.status==='review_ready').length}</strong><span>Imports en revue</span></article><article><strong>${pending}</strong><span>Promotions à traiter</span></article>`;
    const migrationCard=b=>{const integration=b.summary?.integration||{},isTestApplied=b.status==='completed'&&integration.testMode===true,isRolledBack=b.status==='rolled_back'&&integration.testMode===true;return `<article class="admin-migration-card ${b.status==='archived'?'is-archived':''}" data-open-migration-card="${b.id}" data-migration-status="${esc(b.status)}" tabindex="0" role="button" aria-label="Ouvrir le lot ${esc(b.source_customer_name||'Migration historique')}"><div><span class="admin-migration-scope">${b.scope==='catalog'?'Catalogue Me&YouToo':'Client'}</span><h3>${esc(b.source_customer_name||'Migration historique')}</h3><p>${esc(b.organization_name||'Catalogue commun')}${b.source_survey_id?' · Survey #'+esc(b.source_survey_id):''} · ${fmt(b.mapping_count)} élément${Number(b.mapping_count)>1?'s':''} · ${fmt(b.error_count)} erreur${Number(b.error_count)>1?'s':''}</p>${dryRunText(b)?`<small class="admin-migration-summary">${esc(dryRunText(b))}</small>`:''}${isTestApplied?`<small class="admin-migration-summary">Test appliqué : ${fmt(integration.updated)} mise(s) à jour · ${fmt(integration.created)} création(s) · ${fmt(integration.countryVariants)} variante(s) pays · rollback disponible</small>`:''}${isRolledBack?`<small class="admin-migration-summary">Test annulé le ${esc(dateTime(integration.rolledBackAt))} · le lot peut être supprimé.</small>`:''}${b.status==='archived'&&b.archived_at?`<small class="admin-migration-summary">Archivé le ${esc(dateTime(b.archived_at))}</small>`:''}</div><div class="admin-migration-actions"><span class="admin-migration-status is-${esc(b.status)}">${esc(migrationStatusLabel(b.status))}</span><button class="button button-secondary" data-open-migration="${b.id}" data-status="${esc(b.status)}">Ouvrir</button>${isTestApplied?`<button class="button button-danger-soft" data-rollback-migration="${b.id}">Annuler le test</button>`:''}${b.status!=='archived'&&!isTestApplied?`<button class="button button-ghost" data-archive-migration="${b.id}">Archiver</button>`:b.status==='archived'?`<button class="button button-ghost" data-restore-migration="${b.id}">Restaurer</button>`:''}${b.status!=='completed'&&b.status!=='importing'?`<button class="button button-danger-soft" data-delete-migration="${b.id}">Supprimer</button>`:''}</div></article>`;};
    const root=$('#admin-migrations');if(root)root.innerHTML=(activeRows.map(migrationCard).join('')||'<div class="card admin-empty">Aucun lot de migration actif.</div>')+(archivedRows.length?`<details class="admin-migration-archives"><summary>Lots archivés <strong>${archivedRows.length}</strong></summary><div class="admin-migration-archive-list">${archivedRows.map(migrationCard).join('')}</div></details>`:'');
    const pro=$('#admin-promotion-requests');if(pro)pro.innerHTML=(state.promotionRequests||[]).map(r=>`<article class="admin-migration-card"><div><span class="admin-migration-scope">${esc(r.organization_name||'Client')}</span><h3>${esc(r.source_entity_type)} #${esc(r.source_entity_id)}</h3><p>${esc(r.reason||'Aucun commentaire')}</p></div><div class="admin-migration-actions"><span class="admin-migration-status is-${esc(r.status)}">${esc(r.status)}</span>${r.status==='pending'?`<button class="button button-secondary" data-promotion-action="approve" data-promotion-id="${r.id}">Valider</button><button class="button button-ghost" data-promotion-action="reject" data-promotion-id="${r.id}">Refuser</button>`:''}</div></article>`).join('')||'<div class="card admin-empty">Aucune variante proposée au catalogue.</div>';
    $$('[data-dryrun-migration]').forEach(b=>b.onclick=()=>openDryRunDialog(b.dataset.dryrunMigration));
    $$('[data-dryrun-detail]').forEach(b=>b.onclick=()=>showDryRunDetail(b.dataset.dryrunDetail));
    $$('[data-approve-migration]').forEach(b=>b.onclick=async()=>{const ok=await StudioModal.confirm({title:'Valider cette analyse ?',message:'Cette validation autorise uniquement l’import en zone de revue. Le catalogue Sexisme actuel ne sera pas modifié.',confirmLabel:'Valider l’analyse'});if(!ok)return;try{await StudioAPI.request('/api/admin/migrations/'+b.dataset.approveMigration+'/approve',{method:'POST',body:'{}'});state.migrationsLoaded=false;loadMigrations();}catch(e){showError(e.message);}});
    $$('[data-stage-migration]').forEach(b=>b.onclick=async()=>{const ok=await StudioModal.confirm({title:'Importer en zone de revue ?',message:'Les données historiques seront copiées dans une zone séparée réservée aux admins. Aucune thématique, situation, réponse ou campagne actuelle ne sera modifiée.',confirmLabel:'Importer en revue'});if(!ok)return;try{const r=await StudioAPI.request('/api/admin/migrations/'+b.dataset.stageMigration+'/stage-import',{method:'POST',body:'{}'});await StudioModal.alert({title:'Import protégé terminé',message:r.message||'Les contenus sont prêts à être revus.',confirmLabel:'Voir la revue'});state.migrationsLoaded=false;await loadMigrations();openMigrationReview(b.dataset.stageMigration);}catch(e){showError(e.message);}});
    $$('[data-review-migration]').forEach(b=>b.onclick=()=>openMigrationReview(b.dataset.reviewMigration));
    $$('[data-open-migration]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openMigrationByStatus(b.dataset.openMigration,b.dataset.status);});
    $$('[data-open-migration-card]').forEach(card=>{const open=()=>openMigrationByStatus(card.dataset.openMigrationCard,card.dataset.migrationStatus);card.onclick=e=>{if(e.target.closest('button,select,input,a,summary'))return;open();};card.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button,select,input,a')){e.preventDefault();open();}};});
    $$('[data-archive-migration]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const ok=await StudioModal.confirm({title:'Archiver ce lot ?',message:'Le lot disparaîtra des lots actifs mais conservera tout son historique, son dry-run et sa zone de revue.',confirmLabel:'Archiver'});if(!ok)return;try{await StudioAPI.request('/api/admin/migrations/'+b.dataset.archiveMigration+'/archive',{method:'POST',body:'{}'});state.migrationsLoaded=false;loadMigrations();}catch(err){showError(err.message);}});
    $$('[data-restore-migration]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();try{await StudioAPI.request('/api/admin/migrations/'+b.dataset.restoreMigration+'/restore',{method:'POST',body:'{}'});state.migrationsLoaded=false;loadMigrations();}catch(err){showError(err.message);}});
    $$('[data-rollback-migration]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const ok=await StudioModal.confirm({type:'danger',eyebrow:'TEST STAGING',title:'Annuler complètement cette intégration de test ?',message:'Studio restaurera les contenus modifiés et supprimera les contenus/traductions créés par ce lot. Les décisions de revue resteront dans le lot pour pouvoir contrôler le test. Cette fonction est réservée au staging.',cancelLabel:'Conserver le test',confirmLabel:'Annuler l’intégration'});if(!ok)return;try{const r=await StudioAPI.request('/api/admin/migrations/'+b.dataset.rollbackMigration+'/rollback-test',{method:'POST',body:'{}'});await StudioModal.alert({eyebrow:'ROLLBACK TERMINÉ',title:'Le catalogue a été restauré',message:r.message||'Toutes les opérations du test ont été annulées.',confirmLabel:'Fermer'});state.migrationsLoaded=false;await loadMigrations();}catch(err){showError(err.message);}});
    $$('[data-delete-migration]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const ok=await StudioModal.confirm({type:'danger',title:'Supprimer définitivement ce lot ?',message:'Le lot, son dry-run, ses mappings et sa zone de revue seront supprimés. Cette action est irréversible. Le Studio refusera la suppression si le lot a déjà créé des contenus.',confirmLabel:'Supprimer'});if(!ok)return;try{await StudioAPI.request('/api/admin/migrations/'+b.dataset.deleteMigration,{method:'DELETE'});state.migrationsLoaded=false;loadMigrations();}catch(err){showError(err.message);}});
    $$('[data-promotion-action]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/catalog-promotion-requests/'+b.dataset.promotionId,{method:'PATCH',body:JSON.stringify({action:b.dataset.promotionAction})});state.migrationsLoaded=false;loadMigrations();}catch(e){showError(e.message);}});
  }
  async function openMigrationByStatus(batchId,status){
    if(status==='draft')return openDryRunDialog(batchId);
    if(status==='review_ready')return openMigrationReview(batchId);
    if(status==='dry_run_ready'||status==='approved'||status==='completed'||status==='failed'||status==='rolled_back'||status==='archived'){
      return showDryRunDetail(batchId);
    }
    try{
      const data=await StudioAPI.request('/api/admin/migrations/'+batchId),b=data.batch||{};
      await StudioModal.alert({title:b.source_customer_name||'Lot de migration',message:`Statut : ${migrationStatusLabel(b.status)}. ${dryRunText(b)||'Aucun dry-run enregistré.'}`,confirmLabel:'Fermer'});
    }catch(e){showError(e.message);}
  }
  function migrationJsonData(json){
    const entities=Array.isArray(json)?json:(Array.isArray(json?.entities)?json.entities:[]),meta=Array.isArray(json)?{}:(json?.meta||{});
    const surveyMeta=entities.find(x=>String(x?.entityType||x?.entity_type||'')==='survey_meta')||{};
    const theme=entities.find(x=>String(x?.entityType||x?.entity_type||'')==='theme')||{};
    const surveyPayload=surveyMeta.payload||surveyMeta.source_payload||{};
    const themePayload=theme.payload||theme.source_payload||{};
    const survey=surveyPayload.survey||{};
    const sourceSurveyId=String(meta.sourceSurveyId||survey.id||surveyMeta.legacyId||surveyMeta.legacy_id||'').trim();
    const sourceCustomerId=String(meta.sourceCustomerId||survey.customer_id||themePayload.sourceCustomerId||'').trim();
    const sourceCustomerName=String(meta.sourceCustomerName||survey.customer_name||themePayload.customerName||'').trim();
    let diagnosticTitle=String(themePayload.title||'').replace(/\s+[—-]\s+historique importé\s*$/i,'').trim();
    if(!diagnosticTitle)diagnosticTitle=String(meta.diagnosticTitle||meta.title||'Migration historique').trim();
    const lotName=`Me&YouToo — ${diagnosticTitle||'Migration historique'}${sourceSurveyId?` — #${sourceSurveyId}`:''}`;
    return{entities,meta,sourceSurveyId,sourceCustomerId,sourceCustomerName,diagnosticTitle,lotName};
  }
  function migrationDryRunPreview(input,batchId,fileName=''){
    const preview=$('#migration-dryrun-preview'),btn=$('#run-migration-dryrun'),entities=input?._entities||[],meta=input?._meta||{};
    if(!preview||!btn)return;
    const by={};entities.forEach(x=>{const t=String(x.entityType||x.entity_type||'inconnu');by[t]=(by[t]||0)+1;});
    const batch=state.migrationBatches.find(x=>String(x.id)===String(batchId)),expected=String(batch?.source_survey_id||''),got=String(meta.sourceSurveyId||'');
    const mismatch=expected&&got&&expected!==got;
    preview.innerHTML=`${fileName?`<small class="migration-prefill-file">JSON prêt : ${esc(fileName)}</small>`:''}<strong>${fmt(entities.length)} éléments détectés</strong><p>${esc(Object.entries(by).map(([k,v])=>k+' '+v).join(' · '))}</p>${got?`<p>Survey du fichier : <strong>#${esc(got)}</strong>${expected?' · attendu #'+esc(expected):''}</p>`:''}${mismatch?'<div class="composer-alert">Ce fichier ne correspond pas au survey indiqué dans le lot.</div>':'<p class="hint">Le dry-run compare sans écrire dans le catalogue.</p>'}`;
    btn.disabled=!entities.length||mismatch;
  }
  function openMigrationDialog(){
    const d=$('#migration-dialog'),sel=$('#migration-org');if(!d||!sel)return;
    sel.innerHTML='<option value="">Choisir un client</option>'+state.organizations.map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
    const jsonInput=$('#migration-source-json');if(jsonInput){jsonInput.value='';jsonInput._migrationData=null;}
    const jsonStatus=$('#migration-source-json-status');if(jsonStatus){jsonStatus.textContent='Sélectionne le JSON historique : Studio préremplit le survey, l’ID client historique et le nom du lot. Tu peux encore les modifier avant de créer le lot.';jsonStatus.classList.remove('is-success','is-error');}
    $('#migration-source-name').value='';$('#migration-source-id').value='';$('#migration-source-survey-id').value='';$('#migration-scope').value='catalog';$('#migration-org-wrap').hidden=true;d.showModal();
  }
  function openDryRunDialog(batchId,preloaded=null){
    const d=$('#migration-dryrun-dialog');if(!d)return;d.dataset.batchId=batchId;
    const input=$('#migration-dryrun-file');input.value='';input._entities=[];input._meta={};
    $('#migration-dryrun-preview').innerHTML='<p class="hint">Sélectionne le fichier JSON exporté depuis la copie locale de l’ancien moteur.</p>';$('#run-migration-dryrun').disabled=true;
    if(preloaded?.entities?.length){input._entities=preloaded.entities;input._meta=preloaded.meta||{};migrationDryRunPreview(input,batchId,preloaded.fileName||'JSON sélectionné à la création du lot');}
    d.showModal();
  }
  function migrationEntityLabel(type,count=1){const labels={theme:['Thématique','Thématiques'],chapter:['Chapitre','Chapitres'],situation:['Situation','Situations'],answer:['Réponse','Réponses'],profile:['Profil','Profils'],survey_meta:['Informations du diagnostic','Informations du diagnostic']};return (labels[type]||[type,type])[count>1?1:0];}
  function migrationComparisonLabel(status){return({exact_match:'Déjà dans Studio',possible_variant:'Variante possible',new:'Nouveau'})[status]||'À analyser';}
  function migrationComparisonClass(status){return status==='exact_match'?'is-exact':status==='possible_variant'?'is-variant':'is-new';}
  function migrationDifferenceLabel(field){return({content:'texte',score:'score',is_best:'meilleure réponse',position:'position',title:'titre',summary:'résumé',scoring_min:'score minimum',scoring_max:'score maximum',top_score:'score plafond',color:'couleur'})[field]||String(field||'différence');}
  function migrationDifferencesText(cmp){const rows=Array.isArray(cmp?.differences)?cmp.differences:[];return rows.map(migrationDifferenceLabel).join(' · ');}
  function migrationDifferencesHtml(cmp){const text=migrationDifferencesText(cmp);return text?`<div class="migration-difference-note"><strong>Différences détectées :</strong> ${esc(text)}</div>`:'';}
  function migrationTranslations(payload){const all=Object.keys(payload?.translations||{}).map(x=>String(x).toLowerCase()).filter(Boolean);const active=(payload?.activeLocales||[]).map(x=>String(x).toLowerCase()).filter(Boolean);const selected=active.length?active.filter(x=>all.includes(x)):all;return [...new Set(selected)].sort((a,b)=>a.localeCompare(b,'fr'));}
  function migrationDormantTranslations(payload){const all=Object.keys(payload?.translations||{}).map(x=>String(x).toLowerCase()).filter(Boolean);const active=new Set((payload?.activeLocales||[]).map(x=>String(x).toLowerCase()).filter(Boolean));return [...new Set(all.filter(x=>!active.has(x)))].sort((a,b)=>a.localeCompare(b,'fr'));}
  function migrationLanguageLabel(locale){const l=String(locale||'').toLowerCase();return({fr:'Français',en:'English',es:'Español',de:'Deutsch',it:'Italiano',pt:'Português',ar:'العربية',ja:'日本語','ko-kr':'한국어',zh:'中文',pl:'Polski',ru:'Русский',tr:'Türkçe'})[l]||String(locale||'').toUpperCase();}
  function migrationPlainText(value){const box=document.createElement('div');box.innerHTML=String(value||'');return (box.textContent||box.innerText||'').replace(/\s+/g,' ').trim();}
  function migrationDiffTokens(value){return migrationPlainText(value).match(/\s+|[^\s]+/gu)||[];}
  function migrationDiffTokenKey(token){return /^\s+$/u.test(token)?' ':String(token).toLocaleLowerCase('fr').replace(/[’]/g,"'");}
  function migrationTextDiff(oldValue,newValue){
    const oldTokens=migrationDiffTokens(oldValue),newTokens=migrationDiffTokens(newValue);
    const oldPlain=migrationPlainText(oldValue),newPlain=migrationPlainText(newValue);
    if(oldPlain===newPlain)return{oldHtml:esc(oldPlain||'—'),newHtml:esc(newPlain||'—'),changed:false};
    const n=oldTokens.length,m=newTokens.length;
    if(!n&&!m)return{oldHtml:'—',newHtml:'—',changed:false};
    if(n*m>550000){return{oldHtml:`<mark class="migration-diff-old">${esc(oldPlain||'—')}</mark>`,newHtml:`<mark class="migration-diff-new">${esc(newPlain||'—')}</mark>`,changed:true};}
    const dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
    for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--){dp[i][j]=migrationDiffTokenKey(oldTokens[i])===migrationDiffTokenKey(newTokens[j])?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);}
    const oldOut=[],newOut=[];let i=0,j=0;
    while(i<n||j<m){
      if(i<n&&j<m&&migrationDiffTokenKey(oldTokens[i])===migrationDiffTokenKey(newTokens[j])){oldOut.push(esc(oldTokens[i]));newOut.push(esc(newTokens[j]));i++;j++;continue;}
      if(j<m&&(i===n||dp[i][j+1]>dp[i+1]?.[j])){newOut.push(`<mark class="migration-diff-new">${esc(newTokens[j])}</mark>`);j++;continue;}
      if(i<n){oldOut.push(`<mark class="migration-diff-old">${esc(oldTokens[i])}</mark>`);i++;continue;}
    }
    return{oldHtml:oldOut.join('')||'—',newHtml:newOut.join('')||'—',changed:true};
  }
  function migrationDiffLegend(changed=true){return changed?'<div class="migration-diff-legend"><span><i class="is-old"></i>Historique : supprimé / remplacé</span><span><i class="is-new"></i>Studio : ajouté / remplacé</span></div>':'';}
  function migrationPayloadTitle(m){const p=m?.source_payload||{};if(m?.entity_type==='profile')return p.title||p.raw?.title||`Profil #${m.legacy_id}`;if(m?.entity_type==='chapter')return p.title||p.originalTitle||`Chapitre #${m.legacy_id}`;if(m?.entity_type==='theme')return p.title||p.originalTitle||`Thématique #${m.legacy_id}`;return p.content||p.title||p.originalTitle||p.label||`${migrationEntityLabel(m.entity_type)} #${m.legacy_id}`;}
  function dryRunTypeStats(mappings,type){const rows=mappings.filter(m=>m.entity_type===type);const stat={total:rows.length,exact:0,variant:0,new:0};rows.forEach(m=>{const st=(m.comparison||m.source_payload?._comparison||{}).status||'new';if(st==='exact_match')stat.exact++;else if(st==='possible_variant')stat.variant++;else stat.new++;});return stat;}
  function migrationTranslationText(payload,locale){const t=payload?.translations?.[locale]||{};return t.content||t.title||t.summary||t.label||'';}
  function migrationStudioTranslationText(target,locale){
    const l=String(locale||'').toLowerCase();
    const translated=target?.translations?.[l]||{};
    const translatedText=translated.content||translated.title||translated.summary||translated.label||'';
    if(translatedText)return translatedText;
    if(l==='fr')return target?.content||target?.title||target?.summary||target?.label||'';
    return '';
  }
  function migrationScoreHtml(m){const p=m?.source_payload||{};if(m.entity_type==='answer'&&p.scoreValue!=null)return `<span class="migration-score-badge">Score ${esc(p.scoreValue)}</span>`;if(m.entity_type==='profile'&&(p.scoringRangeMin!=null||p.scoringRangeMax!=null))return `<span class="migration-score-badge is-range">Score ${esc(p.scoringRangeMin??'—')} → ${esc(p.scoringRangeMax??'—')}</span>`;return '';}
  function migrationProfileDetailRow(m,context={}){
    const p=m.source_payload||{},cmp=m.comparison||p._comparison||{status:'new'},langs=migrationTranslations(p);
    const raw=p.raw||{},title=migrationPlainText(p.title||raw.title||`Profil #${m.legacy_id}`),summary=migrationPlainText(p.summary||raw.summary||''),content=migrationPlainText(p.content||raw.content||'');
    const color=p.color||raw.color||'#dce6ec',min=p.scoringRangeMin??raw.scoring_range_min??'—',max=p.scoringRangeMax??raw.scoring_range_max??'—',target=cmp.targetPayload||null;
    const targetTitle=migrationPlainText(target?.title||''),targetSummary=migrationPlainText(target?.summary||''),targetContent=migrationPlainText(target?.content||'');
    const titleDiff=migrationTextDiff(title,targetTitle),summaryDiff=migrationTextDiff(summary,targetSummary),contentDiff=migrationTextDiff(content,targetContent);
    const hasTextDiff=!!target&&(titleDiff.changed||summaryDiff.changed||contentDiff.changed);
    const translationPanels=langs.map(l=>{const row=p.translations?.[l]||{},translatedTitle=migrationPlainText(row.title||(l==='fr'?title:'')),translatedSummary=migrationPlainText(row.summary||(l==='fr'?summary:'')),translatedContent=migrationPlainText(row.content||(l==='fr'?content:''));return `<div class="migration-lang-panel migration-profile-lang-panel" data-migration-lang-panel="${esc(m.legacy_id)}:${esc(l)}" hidden><div class="migration-lang-version"><div class="migration-lang-panel-head"><span class="migration-lang-code">${esc(String(l).toUpperCase())}</span><strong>${esc(migrationLanguageLabel(l))}</strong><em>Version historique${(p.activeLocales||[]).map(x=>String(x).toLowerCase()).includes(String(l).toLowerCase())?' · langue active':''}</em></div><div class="migration-profile-copy-grid"><div><span>Titre</span><p>${esc(translatedTitle||'Aucun titre historique.')}</p></div><div><span>Résumé</span><p>${esc(translatedSummary||'Aucun résumé historique.')}</p></div><div class="migration-profile-lang-content"><span>Texte détaillé</span><p>${esc(translatedContent||'Aucun texte détaillé historique.')}</p></div></div></div></div>`;}).join('');
    const comparisonHtml=target?`${migrationDiffLegend(hasTextDiff)}<div class="migration-profile-structured-compare"><div class="migration-profile-version is-history"><div class="migration-profile-version-head"><span>HISTORIQUE</span><strong>${p.position!=null?'Profil '+esc(p.position)+' · ':''}${esc(title||'Profil historique')}</strong></div><div class="migration-profile-field"><span>Titre du profil</span><p class="migration-diff-text">${titleDiff.oldHtml}</p></div><div class="migration-profile-field"><span>Résumé</span><p class="migration-diff-text">${summaryDiff.oldHtml}</p></div><div class="migration-profile-field is-detail"><span>Texte détaillé</span><p class="migration-diff-text">${contentDiff.oldHtml}</p></div><small>Score ${esc(min)} → ${esc(max)}${p.topScore!=null?' · plafond '+esc(p.topScore):''}${color?' · couleur '+esc(color):''}</small></div><div class="migration-profile-version is-studio"><div class="migration-profile-version-head"><span>STUDIO ACTUEL</span><strong>${esc(targetTitle||'Profil actuel')}</strong></div><div class="migration-profile-field"><span>Titre du profil</span><p class="migration-diff-text">${titleDiff.newHtml}</p></div><div class="migration-profile-field"><span>Résumé</span><p class="migration-diff-text">${summaryDiff.newHtml}</p></div><div class="migration-profile-field is-detail"><span>Texte détaillé</span><p class="migration-diff-text">${contentDiff.newHtml}</p></div><small>Score ${esc(target.scoring_min??'—')} → ${esc(target.scoring_max??'—')}${target.top_score!=null?' · plafond '+esc(target.top_score):''}${target.color?' · couleur '+esc(target.color):''}</small></div></div>`:`<div class="migration-profile-single"><div class="migration-profile-field"><span>Titre du profil</span><p>${esc(title||'—')}</p></div><div class="migration-profile-field"><span>Résumé</span><p>${esc(summary||'—')}</p></div><div class="migration-profile-field is-detail"><span>Texte détaillé</span><p>${esc(content||'—')}</p></div></div>`;
    return `<article class="migration-detail-item migration-profile-item ${migrationComparisonClass(cmp.status)}"><div class="migration-detail-item-head"><div class="migration-profile-heading"><span class="migration-profile-color-dot" style="--migration-profile-color:${esc(color)}"></span><div><span class="migration-detail-kind">Profil${p.position!=null?' '+esc(p.position):''}</span><strong>${esc(title)}</strong><small>Ancien ID ${esc(m.legacy_id)}</small></div></div><div class="migration-detail-badges"><span class="migration-compare-badge ${migrationComparisonClass(cmp.status)}">${esc(migrationComparisonLabel(cmp.status))}</span><span class="migration-score-badge is-range">Score ${esc(min)} → ${esc(max)}</span>${langs.length?`<div class="migration-lang-switch" aria-label="Langues actives disponibles">${langs.map(l=>`<button type="button" class="migration-lang-badge" data-migration-lang="${esc(m.legacy_id)}:${esc(l)}"><span>${esc(String(l).toUpperCase())}</span><small>${esc(migrationLanguageLabel(l))}</small></button>`).join('')}</div>`:''}</div></div>${migrationDifferencesHtml(cmp)}${comparisonHtml}${translationPanels}</article>`;
  }


  function migrationDetailRow(m,childrenHtml='',context={}){
    const p=m.source_payload||{},cmp=m.comparison||p._comparison||{status:'new'},langs=migrationTranslations(p),title=migrationPayloadTitle(m),target=cmp.targetPayload||null;
    const currentText=target?.content||target?.title||'',textDiff=target?migrationTextDiff(title,currentText):null;
    const translationPanels=langs.map(l=>{const studioLocaleText=migrationStudioTranslationText(target,l),localeCode=String(l||'').toUpperCase();const studioPanel=target?(studioLocaleText?`<div class="migration-lang-version is-studio"><div class="migration-lang-panel-head"><span class="migration-lang-code is-studio">STUDIO</span><strong>Version actuelle · ${esc(localeCode)}</strong></div><p>${esc(studioLocaleText)}</p></div>`:`<div class="migration-lang-version is-studio is-missing"><div class="migration-lang-panel-head"><span class="migration-lang-code is-studio">STUDIO</span><strong>Aucune version ${esc(localeCode)}</strong></div><p>Le Studio actuel ne contient pas de version ${esc(migrationLanguageLabel(l))} pour cet élément.</p></div>`):'';return `<div class="migration-lang-panel" data-migration-lang-panel="${esc(m.legacy_id)}:${esc(l)}" hidden><div class="migration-lang-version"><div class="migration-lang-panel-head"><span class="migration-lang-code">${esc(localeCode)}</span><strong>${esc(migrationLanguageLabel(l))}</strong><em>Version historique</em></div><p>${esc(migrationTranslationText(p,l)||'Aucun texte disponible dans cette langue.')}</p></div>${studioPanel}</div>`;}).join('');
    const countries=(p.countries||[]).map(c=>String(c.name||c.id||'').trim()).filter(Boolean),official=(context.officialCountries||[]).map(x=>String(x).trim()).filter(Boolean),variantCountries=[...new Set(countries.filter(c=>!official.some(o=>o.toLowerCase()===c.toLowerCase())))],countryHtml=variantCountries.length?`<div class="migration-country-variant"><span>Variante pays</span><strong>${variantCountries.map(esc).join(' · ')}</strong></div>`:'';
    const compareHtml=currentText?`${migrationDiffLegend(textDiff?.changed)}<div class="migration-side-by-side migration-text-compare"><div><span>Historique</span><p class="migration-diff-text">${textDiff?.oldHtml||esc(title)}</p></div><div><span>Studio actuel</span><p class="migration-diff-text">${textDiff?.newHtml||esc(currentText)}</p>${m.entity_type==='answer'?`<small>Score ${esc(target?.score??'—')}${target?.is_best===true?' · meilleure réponse':''}</small>`:''}</div></div>`:'';
    return `<article class="migration-detail-item ${migrationComparisonClass(cmp.status)}"><div class="migration-detail-item-head"><div><span class="migration-detail-kind">${esc(migrationEntityLabel(m.entity_type))}</span><strong>${esc(title)}</strong><small>Ancien ID ${esc(m.legacy_id)}${p.position!=null?' · position '+esc(p.position):''}</small></div><div class="migration-detail-badges"><span class="migration-compare-badge ${migrationComparisonClass(cmp.status)}">${esc(migrationComparisonLabel(cmp.status))}</span>${migrationScoreHtml(m)}${langs.length?`<div class="migration-lang-switch" aria-label="Langues disponibles">${langs.map(l=>`<button type="button" class="migration-lang-badge" data-migration-lang="${esc(m.legacy_id)}:${esc(l)}" title="Afficher ${esc(migrationLanguageLabel(l))}"><span>${esc(String(l).toUpperCase())}</span><small>${esc(migrationLanguageLabel(l))}</small></button>`).join('')}</div>`:''}</div></div>${migrationDifferencesHtml(cmp)}${compareHtml}${translationPanels}${countryHtml}${childrenHtml||''}</article>`;
  }

  async function showDryRunDetail(batchId){
    try{
      const data=await StudioAPI.request('/api/admin/migrations/'+batchId),batch=data.batch||{},mappings=data.mappings||[],summary=batch.summary?.dryRun||{},d=$('#migration-detail-dialog'),root=$('#migration-detail-content');
      if(!d||!root)return;
      d.dataset.batchId=batchId;
      const batchLabel=batch.name||batch.source_customer_name||'Import historique';
      const integration=batch.summary?.integration||{},isTestApplied=batch.status==='completed'&&integration.testMode===true,isRolledBack=batch.status==='rolled_back'&&integration.testMode===true;
      $('#migration-detail-title').textContent=isTestApplied?'Intégration de test appliquée':isRolledBack?'Intégration de test annulée':'Résultat du dry-run';
      $('#migration-detail-subtitle').textContent=isTestApplied
        ? `${batchLabel} · application STAGING avec rollback disponible`
        : isRolledBack
          ? `${batchLabel} · catalogue restauré · lot supprimable`
          : `${batchLabel} · ${fmt(summary.accepted||mappings.length)} éléments analysés · aucune écriture dans le catalogue`;
      const types=['theme','chapter','situation','answer','profile','survey_meta'];
      const stats=Object.fromEntries(types.map(t=>[t,dryRunTypeStats(mappings,t)]));
      const summaryCards=types.filter(t=>stats[t].total).map(t=>{const x=stats[t];return `<article><strong>${fmt(x.total)}</strong><span>${esc(migrationEntityLabel(t,x.total))}</span><small>${fmt(x.exact)} déjà présents · ${fmt(x.variant)} variantes · ${fmt(x.new)} nouveaux</small></article>`;}).join('');
      const byParent=new Map();mappings.forEach(m=>{const k=String(m.legacy_parent_id||'');if(!byParent.has(k))byParent.set(k,[]);byParent.get(k).push(m);});
      const theme=mappings.find(m=>m.entity_type==='theme');
      const meta=mappings.find(m=>m.entity_type==='survey_meta');
      const activeLocales=meta?.source_payload?.activeLocales||theme?.source_payload?.activeLocales||[];
      const explicitDormant=meta?.source_payload?.dormantLocales||theme?.source_payload?.dormantLocales||[];
      const allHistoricalLocales=[...new Set(mappings.flatMap(m=>Object.keys(m.source_payload?.translations||{})).map(x=>String(x).toLowerCase()).filter(Boolean))];
      const activeLocaleSet=new Set(activeLocales.map(x=>String(x).toLowerCase()));
      const dormantLocales=explicitDormant.length?explicitDormant:allHistoricalLocales.filter(x=>!activeLocaleSet.has(x));
      const officialCountries=[...new Set((meta?.source_payload?.countries||[])
        .map(x=>x.country_name||x.name)
        .filter(Boolean))];
      const chapters=mappings.filter(m=>m.entity_type==='chapter').sort((a,b)=>(Number(a.source_payload?.position)||0)-(Number(b.source_payload?.position)||0));
      const chapterBlocks=chapters.map(ch=>{const situations=(byParent.get(String(ch.legacy_id))||[]).filter(x=>x.entity_type==='situation').sort((a,b)=>(Number(a.source_payload?.position)||0)-(Number(b.source_payload?.position)||0));const profiles=(byParent.get(String(ch.legacy_id))||[]).filter(x=>x.entity_type==='profile').sort((a,b)=>(Number(a.source_payload?.position)||0)-(Number(b.source_payload?.position)||0));const situationHtml=situations.map(si=>{const answers=(byParent.get(String(si.legacy_id))||[]).filter(x=>x.entity_type==='answer');const child=`<details class="migration-detail-children"><summary><span>${answers.length} réponse${answers.length>1?'s':''} · ${migrationTranslations(si.source_payload).length} langue${migrationTranslations(si.source_payload).length>1?'s':''}</span><span class="migration-fold-label">Afficher</span></summary><div>${answers.map(a=>migrationDetailRow(a,'',{officialCountries})).join('')||'<p class="hint">Aucune réponse.</p>'}</div></details>`;return migrationDetailRow(si,child,{officialCountries});}).join('');return `<details class="migration-chapter-block"><summary><div class="migration-chapter-summary-main"><span class="migration-chapter-chevron" aria-hidden="true">›</span><div><strong>${esc(migrationPayloadTitle(ch))}</strong><span>${situations.length} situation${situations.length>1?'s':''} · ${profiles.length} profil${profiles.length>1?'s':''}</span></div></div><div class="migration-chapter-summary-actions"><span class="migration-compare-badge ${migrationComparisonClass((ch.comparison||ch.source_payload?._comparison||{}).status)}">${esc(migrationComparisonLabel((ch.comparison||ch.source_payload?._comparison||{}).status))}</span><span class="migration-fold-label">Déplier</span></div></summary><div class="migration-chapter-content">${situationHtml}${profiles.length?`<details class="migration-profile-group"><summary><span>${profiles.length} profils du chapitre</span><span class="migration-fold-label">Afficher</span></summary>${profiles.map(p=>migrationProfileDetailRow(p,{officialCountries})).join('')}</details>`:''}</div></details>`;}).join('');
      root.innerHTML=`<section class="migration-review-welcome migration-dryrun-welcome"><div class="migration-review-welcome-head"><div><span class="migration-review-step-label">${isTestApplied?'ÉTAPE 3 SUR 3 · TEST D’INTÉGRATION':isRolledBack?'TEST ANNULÉ · CATALOGUE RESTAURÉ':'ÉTAPE 1 SUR 3 · ANALYSE AUTOMATIQUE'}</span><h3>${isTestApplied?'Contrôler le résultat avant rollback':isRolledBack?'Le test a été entièrement annulé':'Contrôler le rapprochement avant toute décision'}</h3><p>${isTestApplied?'Les décisions ont été appliquées au catalogue de staging. Tu peux maintenant tester les écrans qui consomment réellement ces données puis annuler le test.':isRolledBack?'Les contenus modifiés ont été restaurés et les contenus créés par le test ont été supprimés. Tu peux supprimer le lot.':'Ce premier écran sert uniquement à vérifier ce que Studio a détecté : correspondances, variantes, nouveautés, langues et périmètre. Tu ne prends encore aucune décision d’intégration.'}</p></div></div></section>${isTestApplied?`<section class="migration-detail-security"><strong>Test STAGING appliqué</strong><span>${fmt(integration.updated)} mise(s) à jour · ${fmt(integration.created)} création(s) · ${fmt(integration.countryVariants)} variante(s) pays · ${fmt(integration.translations)} traduction(s). Un snapshot de rollback a été créé.</span></section>`:isRolledBack?`<section class="migration-detail-security"><strong>Rollback terminé</strong><span>Le catalogue a été restauré. Le lot peut maintenant être supprimé définitivement si tu n’en as plus besoin.</span></section>`:`<section class="migration-detail-security"><strong>Import protégé</strong><span>Le Sexisme actuel reste intact. Ce dry-run compare uniquement les données historiques au Studio.</span></section>`}<section class="migration-detail-kpis">${summaryCards}</section><section class="migration-detail-overview"><div><span>Survey historique</span><strong>#${esc(batch.source_survey_id||meta?.legacy_id||'—')}</strong></div><div><span>Langues actives</span><strong>${activeLocales.map(x=>String(x).toUpperCase()).join(' · ')||'—'}</strong>${dormantLocales.length?`<small>Traductions historiques hors diffusion : ${dormantLocales.map(x=>String(x).toUpperCase()).join(' · ')}</small>`:''}</div><div><span>Périmètre historique</span><strong>${officialCountries.map(esc).join(' · ')||'Non renseigné'}</strong></div><div><span>Erreurs</span><strong>${fmt(summary.invalid||0)}</strong></div></section>${theme?`<div class="migration-detail-theme">${migrationDetailRow(theme,'',{officialCountries})}</div>`:''}<section class="migration-detail-chapters"><div class="migration-detail-section-head"><div><h3>Contrôle du contenu</h3><p>Ouvre les chapitres puis les situations. Clique sur une langue pour afficher sa version. Les langues hors diffusion restent signalées séparément. Les scores sont affichés sur chaque réponse et les seuils sur chaque profil.</p></div><div class="migration-fold-actions"><button type="button" class="button button-ghost button-small" id="migration-expand-all">Tout déplier</button><button type="button" class="button button-ghost button-small" id="migration-collapse-all">Tout replier</button></div></div>${chapterBlocks||'<p class="admin-empty">Aucun chapitre trouvé.</p>'}</section>`;
      $$('[data-migration-lang]',root).forEach(btn=>btn.onclick=()=>{const key=btn.dataset.migrationLang,panel=root.querySelector(`[data-migration-lang-panel="${CSS.escape(key)}"]`),item=btn.closest('.migration-detail-item');if(!panel)return;item.querySelectorAll('[data-migration-lang-panel]').forEach(x=>{if(x!==panel)x.hidden=true;});item.querySelectorAll('[data-migration-lang]').forEach(x=>x.classList.toggle('is-active',x===btn&&!panel.hidden));panel.hidden=!panel.hidden;btn.classList.toggle('is-active',!panel.hidden);});
      $('#migration-expand-all')?.addEventListener('click',()=>$$('.migration-chapter-block,.migration-detail-children,.migration-profile-group',root).forEach(x=>x.open=true));
      $('#migration-collapse-all')?.addEventListener('click',()=>$$('.migration-chapter-block,.migration-detail-children,.migration-profile-group',root).forEach(x=>x.open=false));
      const actions=$('#migration-detail-actions');actions.innerHTML=`<button type="button" class="button button-ghost" data-close-dialog="migration-detail-dialog">Fermer</button>${batch.status==='dry_run_ready'?'<button type="button" class="button button-primary" id="migration-detail-approve">Passer à la revue</button>':''}${batch.status==='approved'?'<button type="button" class="button button-primary" id="migration-detail-stage">Ouvrir la revue humaine</button>':''}${batch.status==='review_ready'?'<button type="button" class="button button-primary" id="migration-detail-review">Reprendre la revue des décisions</button>':''}${isTestApplied?'<button type="button" class="button button-danger-soft" id="migration-detail-rollback">Annuler l’intégration de test</button>':''}`;
      actions.querySelector('[data-close-dialog]')?.addEventListener('click',()=>d.close());
      $('#migration-detail-approve')?.addEventListener('click',async()=>{const ok=await StudioModal.confirm({title:'Passer à la revue humaine ?',message:'Tu confirmes que le résultat du dry-run est cohérent. Studio va copier ce lot dans une zone de revue séparée afin que tu puisses prendre les décisions métier. Aucune donnée du catalogue actuel ne sera modifiée.',confirmLabel:'Passer à la revue'});if(!ok)return;try{await StudioAPI.request('/api/admin/migrations/'+batchId+'/approve',{method:'POST',body:'{}'});await StudioAPI.request('/api/admin/migrations/'+batchId+'/stage-import',{method:'POST',body:'{}'});d.close();state.migrationsLoaded=false;await loadMigrations();openMigrationReview(batchId);}catch(e){showError(e.message);state.migrationsLoaded=false;await loadMigrations();}});
      $('#migration-detail-stage')?.addEventListener('click',async()=>{const ok=await StudioModal.confirm({title:'Ouvrir la revue humaine ?',message:'Le dry-run est déjà validé. Les éléments historiques seront copiés dans la zone de revue séparée. Le catalogue actuel ne sera pas modifié.',confirmLabel:'Ouvrir la revue'});if(!ok)return;try{await StudioAPI.request('/api/admin/migrations/'+batchId+'/stage-import',{method:'POST',body:'{}'});d.close();state.migrationsLoaded=false;await loadMigrations();openMigrationReview(batchId);}catch(e){showError(e.message);}});
      $('#migration-detail-review')?.addEventListener('click',()=>{d.close();openMigrationReview(batchId);});
      $('#migration-detail-rollback')?.addEventListener('click',async()=>{const ok=await StudioModal.confirm({type:'danger',eyebrow:'TEST STAGING',title:'Annuler cette intégration de test ?',message:'Les mises à jour seront restaurées et toutes les données créées par ce lot seront supprimées. Les décisions de revue resteront traçables.',cancelLabel:'Conserver le test',confirmLabel:'Annuler l’intégration'});if(!ok)return;try{const r=await StudioAPI.request('/api/admin/migrations/'+batchId+'/rollback-test',{method:'POST',body:'{}'});d.close();await StudioModal.alert({title:'Rollback terminé',message:r.message||'Le catalogue de staging a été restauré.',confirmLabel:'Fermer'});state.migrationsLoaded=false;await loadMigrations();}catch(e){showError(e.message);}});
      d.showModal();
    }catch(e){showError(e.message);}
  }
  const reviewDecisionDefinitions={
    pending:{label:'À décider',short:'Aucune décision n’est encore prise.',detail:'L’élément reste en attente dans la revue. Rien ne sera prévu pour l’intégration finale tant qu’une décision n’aura pas été choisie.'},
    keep_current:{label:'Garder le Studio actuel',short:'Conserver la version déjà présente dans Studio.',detail:'La version historique reste traçable dans le lot, mais elle ne remplacera pas le contenu actuel du Studio lors de l’intégration finale.'},
    use_legacy:{label:'Utiliser la version historique',short:'Remplacer la version Studio par la version historique.',detail:'Lors de l’intégration finale, le contenu historique validé deviendra la version de référence pour l’élément correspondant dans Studio.'},
    add_complementary:{label:'Ajouter en complémentaire',short:'Conserver Studio et ajouter l’historique en plus.',detail:'La version actuelle reste intacte et la version historique sera créée comme contenu complémentaire distinct. C’est particulièrement utile lorsqu’il s’agit d’une vraie alternative métier et non d’une correction.'},
    country_variant:{label:'Créer variante pays',short:'Conserver la base Studio et créer une version spécifique à un pays.',detail:'La version historique sera conservée comme variante pays rattachée au contenu Studio de référence. Pour le survey #44, le périmètre historique est la France.'},
    translation_only:{label:'Récupérer la traduction uniquement',short:'Garder le contenu Studio et ne reprendre que la traduction.',detail:'Le contenu principal du Studio n’est pas remplacé. Seules les traductions historiques utiles seront préparées pour être rattachées à l’élément Studio correspondant.'},
    ignore:{label:'Ignorer',short:'Ne rien intégrer pour cet élément.',detail:'L’élément reste visible dans l’historique du lot pour traçabilité, mais il sera exclu de l’intégration finale.'}
  };
  function reviewDecisionOptions(current){
    return Object.entries(reviewDecisionDefinitions).map(([v,d])=>`<option value="${v}" ${v===current?'selected':''}>${d.label}</option>`).join('');
  }
  function reviewDecisionHelpHtml(current){
    const currentDef=reviewDecisionDefinitions[current]||reviewDecisionDefinitions.pending;
    return `<div class="migration-review-decision-current" data-decision-current><strong>${esc(currentDef.label)}</strong><span>${esc(currentDef.short)}</span></div><div class="migration-review-decision-help-panel" data-decision-help-panel hidden><div class="migration-review-decision-help-head"><strong>Que signifie chaque choix ?</strong><span>Aucune de ces décisions ne modifie le catalogue maintenant. Elles seront appliquées uniquement lors de l’étape finale d’intégration.</span></div>${Object.entries(reviewDecisionDefinitions).map(([value,d])=>`<div class="migration-review-decision-help-item" data-decision-help-item="${value}"><strong>${esc(d.label)}</strong><span>${esc(d.detail)}</span></div>`).join('')}</div>`;
  }
  const reviewTypeLabel=t=>({
    theme:'THÉMATIQUE',chapter:'CHAPITRE',situation:'SITUATION',
    answer:'RÉPONSE',profile:'PROFIL',survey_meta:'INFORMATIONS DU DIAGNOSTIC',
    translation:'TRADUCTION'
  })[t]||String(t||'ÉLÉMENT').toUpperCase();

  const reviewCmpLabel=s=>s==='exact_match'?'Déjà présent':s==='possible_variant'?'Variante':'Nouveau';

  function translationMissingInfo(e){
    const p=e.source_payload||{},active=(p.activeLocales||[]).map(String).filter(Boolean),tr=p.translations||{};
    if(!active.length || ['theme','survey_meta'].includes(e.entity_type))return [];
    const out=[];
    for(const loc of active){
      const row=tr[loc]||{},missing=[];
      if(e.entity_type==='profile'){
        if(loc==='fr'){
          if(!p.title)missing.push('titre');if(!p.summary)missing.push('résumé');if(!p.content)missing.push('texte détaillé');
        }else{
          if(!row.title)missing.push('titre');if(!row.summary)missing.push('résumé');if(!row.content)missing.push('texte détaillé');
        }
      }else if(e.entity_type==='chapter'){
        if(!(loc==='fr'?(p.title||row.title):row.title))missing.push('titre');
      }else if(['situation','answer'].includes(e.entity_type)){
        if(!(loc==='fr'?(p.content||row.content):row.content))missing.push('texte');
      }
      if(missing.length)out.push({locale:loc,missing,availableTitle:row.title||'',availableContent:row.content||''});
    }
    return out;
  }
  function activeTranslationMissing(e){return translationMissingInfo(e).length>0;}
  function translationReviewHtml(e){
    const p=e.source_payload||{},missing=translationMissingInfo(e),tr=p.translations||{};
    if(!missing.length)return'';
    const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return `<div class="migration-review-translation-detail">${missing.map(m=>{
      const loc=m.locale.toUpperCase(),row=tr[m.locale]||{};
      const refTitle=p.title||tr.fr?.title||'',refSummary=clean(p.summary||tr.fr?.summary||''),refContent=clean(p.content||tr.fr?.content||'');
      return `<div class="migration-review-translation-card"><div class="migration-review-translation-head"><span>${esc(loc)}</span><strong>${m.locale==='en'?'English':m.locale==='fr'?'Français':esc(m.locale)}</strong><em>${m.missing.map(x=>esc(x)).join(' · ')} manquant${m.missing.length>1?'s':''}</em></div><div class="migration-review-translation-grid"><div><span>FR — référence</span><strong>${esc(refTitle||'—')}</strong>${e.entity_type==='profile'?`<small><b>Résumé :</b> ${esc(refSummary||'—')}</small><small><b>Texte :</b> ${esc(refContent||'—')}</small>`:''}</div><div><span>${esc(loc)} — historique</span><strong>${esc(row.title||row.content||'—')}</strong>${e.entity_type==='profile'?`<small><b>Résumé :</b> ${row.summary?esc(clean(row.summary)):'<mark>À compléter</mark>'}</small><small><b>Texte :</b> ${row.content?esc(clean(row.content)):'<mark>À compléter</mark>'}</small>`:''}</div></div><button type="button" class="button button-secondary migration-translation-edit" data-translation-edit="${e.id}" data-locale="${esc(m.locale)}">Compléter la traduction</button></div>`;
    }).join('')}</div>`;
  }

  function reviewInfo(text){
    return `<span class="migration-review-info" tabindex="0" aria-label="${esc(text)}" title="${esc(text)}">i</span>`;
  }

  function reviewCard(e,compact=false){
    const p=e.source_payload||{},c=e.comparison||{},cur=c.targetPayload||{},clean=v=>migrationPlainText(v);
    const isProfile=e.entity_type==='profile';
    const title=isProfile?clean(p.title||p.raw?.title)||`Profil #${e.legacy_id}`:clean(p.content||p.title||p.label)||`${reviewTypeLabel(e.entity_type)} #${e.legacy_id}`;
    const exact=c.status==='exact_match',variant=c.status==='possible_variant',status=exact?'existing':variant?'variant':'new';
    let compare='';
    if(!compact&&c.targetEntityId&&['situation','answer','profile'].includes(e.entity_type)){
      if(isProfile){
        const histTitle=clean(p.title||p.raw?.title),histSummary=clean(p.summary||p.raw?.summary),histContent=clean(p.content||p.raw?.content),studioTitle=clean(cur.title),studioSummary=clean(cur.summary),studioContent=clean(cur.content);
        const dTitle=migrationTextDiff(histTitle,studioTitle),dSummary=migrationTextDiff(histSummary,studioSummary),dContent=migrationTextDiff(histContent,studioContent),changed=dTitle.changed||dSummary.changed||dContent.changed;
        compare=`${migrationDifferencesHtml(c)}${migrationDiffLegend(changed)}<div class="migration-review-profile-compare"><div class="migration-review-profile-version is-history"><div class="migration-review-profile-version-head"><span>HISTORIQUE</span><strong>${p.position!=null?'Profil '+esc(p.position)+' · ':''}${esc(histTitle||'Profil historique')}</strong></div><div class="migration-review-profile-field"><span>Titre du profil</span><p class="migration-diff-text">${dTitle.oldHtml}</p></div><div class="migration-review-profile-field"><span>Résumé</span><p class="migration-diff-text">${dSummary.oldHtml}</p></div><div class="migration-review-profile-field is-detail"><span>Texte détaillé</span><p class="migration-diff-text">${dContent.oldHtml}</p></div><small>Score ${esc(p.scoringRangeMin??p.scoring_min??'—')} → ${esc(p.scoringRangeMax??p.scoring_max??'—')}${p.topScore!=null?' · plafond '+esc(p.topScore):''}${p.color?' · couleur '+esc(p.color):''}</small></div><div class="migration-review-profile-version is-studio"><div class="migration-review-profile-version-head"><span>STUDIO ACTUEL</span><strong>${esc(studioTitle||'Profil actuel')}</strong></div><div class="migration-review-profile-field"><span>Titre du profil</span><p class="migration-diff-text">${dTitle.newHtml}</p></div><div class="migration-review-profile-field"><span>Résumé</span><p class="migration-diff-text">${dSummary.newHtml}</p></div><div class="migration-review-profile-field is-detail"><span>Texte détaillé</span><p class="migration-diff-text">${dContent.newHtml}</p></div><small>Score ${esc(cur.scoring_min??'—')} → ${esc(cur.scoring_max??'—')}${cur.top_score!=null?' · plafond '+esc(cur.top_score):''}${cur.color?' · couleur '+esc(cur.color):''}</small></div></div>`;
      }else{
        const hist=clean(p.content||p.title),studio=clean(cur.content||cur.title),diff=migrationTextDiff(hist,studio);
        compare=`${migrationDifferencesHtml(c)}${migrationDiffLegend(diff.changed)}<div class="migration-review-compare"><div><span>HISTORIQUE</span><p class="migration-diff-text">${diff.oldHtml}</p>${e.entity_type==='answer'?`<small>Score ${esc(p.scoreValue??p.score??'—')}${p.isBest===true||p.is_best===true?' · meilleure réponse':''}</small>`:''}</div><div><span>STUDIO ACTUEL</span><p class="migration-diff-text">${diff.newHtml}</p>${e.entity_type==='answer'?`<small>Score ${esc(cur.score??'—')}${cur.is_best===true?' · meilleure réponse':''}</small>`:''}</div></div>`;
      }
    }
    const decision=e.review_status||(exact?'keep_current':'pending'),missing=activeTranslationMissing(e),answerContext=e.entity_type==='answer'&&Array.isArray(c.currentSiblingAnswers)&&c.currentSiblingAnswers.length?`<div class="migration-review-answer-context"><span>Réponses actuellement rattachées à cette situation dans Studio</span><ul>${c.currentSiblingAnswers.map(a=>`<li>${esc(a.content||'—')} <b>— score ${esc(a.score??'—')}</b></li>`).join('')}</ul></div>`:'';
    return `<article class="migration-review-row" data-review-card data-cmp="${status}" data-pending="${decision==='pending'?'1':'0'}" data-translations="${missing?'1':'0'}"><div class="migration-review-main"><div class="migration-review-heading"><span class="admin-migration-scope">${reviewTypeLabel(e.entity_type)}${isProfile&&p.position!=null?' '+esc(p.position):''}</span><span class="migration-review-status ${status}">${reviewCmpLabel(c.status)}</span>${missing?`<span class="migration-review-translation-warning">Traduction active à compléter</span>`:''}<span class="migration-review-context-note">Contexte parent</span></div><strong>${esc(title)}</strong><small>Ancien ID ${esc(e.legacy_id)}</small>${compare}${answerContext}${translationReviewHtml(e)}</div><div class="migration-review-decision"><div class="migration-review-decision-control"><select data-review-status="${e.id}" aria-label="Décision pour ${esc(title)}">${reviewDecisionOptions(decision)}</select><button type="button" class="migration-review-decision-help" data-decision-help aria-label="Aide sur les décisions">?</button></div>${reviewDecisionHelpHtml(decision)}</div></article>`;
  }


  function reviewTechnicalCard(e){
    const p=e.source_payload||{};
    const title=e.entity_type==='theme'
      ? (p.originalTitle||p.title||'Thématique source')
      : `Diagnostic historique #${esc(e.legacy_id)}`;
    const desc=e.entity_type==='theme'
      ? 'Cette ligne sert à rattacher le contenu importé à la bonne thématique. Elle n’est pas une décision métier.'
      : 'Ces métadonnées conservent la provenance du diagnostic (ancien ID, langues, périmètre, source). Elles ne modifient pas le contenu du catalogue.';
    return `<article class="migration-review-technical">
      <div><span>${reviewTypeLabel(e.entity_type)}</span><strong>${esc(title)}</strong><small>${esc(desc)}</small></div>
      <span class="migration-review-auto">Géré automatiquement</span>
    </article>`;
  }

  async function openMigrationReview(batchId){
    try{
      const data=await StudioAPI.request('/api/admin/migrations/'+batchId+'/review');
      const d=$('#migration-review-dialog'),root=$('#migration-review-list'),entities=data.entities||[];
      const translationDrafts=data.translationDrafts||[],draftsByKey=new Map(translationDrafts.map(x=>[`${x.staged_entity_id}:${x.locale}`,x]));
      // Une traduction validée devient la version de référence de la revue : elle ne doit plus rester comptée comme « à compléter ».
      entities.forEach(entity=>{
        const p=entity.source_payload||{},translations={...(p.translations||{})};
        let changed=false;
        for(const [key,draft] of draftsByKey){
          if(String(draft.staged_entity_id)!==String(entity.id)||draft.status!=='validated')continue;
          const locale=String(draft.locale||'').toLowerCase();if(!locale)continue;
          translations[locale]={...(translations[locale]||{}),title:draft.title||translations[locale]?.title||'',summary:draft.summary||translations[locale]?.summary||'',content:draft.content||translations[locale]?.content||''};
          changed=true;
        }
        if(changed)entity.source_payload={...p,translations};
      });
      d.dataset.batchId=batchId;
      $('#migration-review-title').textContent='Revue des décisions — '+(data.batch?.name||data.batch?.source_customer_name||'Import historique');

      const businessEntities=entities.filter(x=>!['theme','survey_meta'].includes(x.entity_type));
      const technicalEntities=entities.filter(x=>['theme','survey_meta'].includes(x.entity_type));

      const children=new Map();
      entities.forEach(x=>{
        const k=String(x.legacy_parent_id||'');
        if(!children.has(k)) children.set(k,[]);
        children.get(k).push(x);
      });

      const chapters=entities.filter(x=>x.entity_type==='chapter');
      const n={
        pending:businessEntities.filter(x=>x.review_status==='pending'&&x.comparison?.status!=='exact_match').length,
        variant:businessEntities.filter(x=>x.comparison?.status==='possible_variant'&&x.review_status==='pending').length,
        new:businessEntities.filter(x=>x.comparison?.status==='new'&&x.review_status==='pending').length,
        existing:businessEntities.filter(x=>x.comparison?.status==='exact_match').length,
        translations:businessEntities.filter(x=>{
          if(!activeTranslationMissing(x))return false;
          const p=x.source_payload||{},active=(p.activeLocales||[]).map(String);
          return active.some(loc=>draftsByKey.get(`${x.id}:${loc}`)?.status!=='validated');
        }).length,
        total:businessEntities.length
      };

      const chapterHtml=chapters.map(ch=>{
        const direct=children.get(String(ch.legacy_id))||[];
        const situations=direct.filter(x=>x.entity_type==='situation');
        const profiles=direct.filter(x=>x.entity_type==='profile');
        return `<details class="migration-review-chapter" data-review-chapter>
          <summary>
            <span class="migration-review-round">›</span>
            <div><strong>${esc(ch.source_payload?.title||'Chapitre')}</strong><small><span data-review-chapter-situations data-total-situations="${situations.length}">${situations.length} situations</span> · <span data-review-chapter-profiles data-total-profiles="${profiles.length}">${profiles.length} profils</span></small></div>
          </summary>
          <div class="migration-review-chapter-body">
            ${reviewCard(ch,true)}
            ${profiles.length?`<details class="migration-review-subgroup migration-review-profile-subgroup" data-review-profile-group data-total-profiles="${profiles.length}">
              <summary><span class="migration-review-round">›</span><span><strong>Profils</strong> · <span data-review-profile-count>${profiles.length} profil${profiles.length>1?'s':''}</span></span></summary>
              <div>${profiles.map(x=>reviewCard(x)).join('')}</div>
            </details>`:''}
            ${situations.length?`<details class="migration-review-subgroup migration-review-situations-subgroup" data-review-situations-group>
              <summary><span class="migration-review-round">›</span><span><strong>Situations</strong> · <span data-review-situation-count data-total-situations="${situations.length}">${situations.length} situation${situations.length>1?'s':''}</span></span></summary>
              <div>${situations.map(si=>{
                const answers=(children.get(String(si.legacy_id))||[]).filter(x=>x.entity_type==='answer');
                return `<div class="migration-review-situation-group">
                  ${reviewCard(si)}
                  ${answers.length?`<details class="migration-review-subgroup">
                    <summary><span class="migration-review-round">›</span>${answers.length} réponses</summary>
                    <div>${answers.map(x=>reviewCard(x,true)).join('')}</div>
                  </details>`:''}
                </div>`;
              }).join('')}</div>
            </details>`:''}
          </div>
        </details>`;
      }).join('');

      root.innerHTML=`
        <section class="migration-review-welcome">
          <div class="migration-review-welcome-head">
            <div>
              <span class="migration-review-step-label">ÉTAPE 2 SUR 3 · REVUE HUMAINE</span>
              <h3>${n.pending} décision${n.pending>1?'s':''} réellement à prendre</h3>
              <p>Studio a déjà rapproché automatiquement l’historique du catalogue actuel. Commence par les différences : tu n’as pas à relire tout le diagnostic.</p>
            </div>
          </div>
          <div class="migration-review-steps">
            <div><b>1</b><span><strong>Examiner</strong><small>Variantes, nouveautés et traductions manquantes.</small></span></div>
            <div><b>2</b><span><strong>Choisir</strong><small>Tu indiques ce qu’il faut conserver, récupérer ou ignorer.</small></span></div>
            <div><b>3</b><span><strong>Intégrer plus tard</strong><small>Aucune décision ici ne modifie encore le catalogue.</small></span></div>
          </div>
        </section>

        <div class="migration-review-toolbar">
          <div class="migration-review-filters" role="group" aria-label="Filtres de revue">
            <button type="button" data-review-filter="pending">
              À décider <b>${n.pending}</b>${reviewInfo('Les éléments qui nécessitent une décision humaine. C’est le meilleur point de départ.')}
            </button>
            <button type="button" data-review-filter="variant">
              Variantes à décider <b>${n.variant}</b>${reviewInfo('Variantes détectées qui n’ont pas encore de décision enregistrée. Une fois décidées, elles sortent de ce compteur et restent consultables dans « Tout voir ».')}
            </button>
            <button type="button" data-review-filter="new">
              Nouveaux à décider <b>${n.new}</b>${reviewInfo('Nouveaux contenus sans décision enregistrée. Une fois décidés, ils sortent de ce compteur et restent consultables dans « Tout voir ».')}
            </button>
            <button type="button" data-review-filter="translations">
              Traductions à compléter <b>${n.translations}</b>${reviewInfo('Uniquement les langues actives du diagnostic pour lesquelles un contenu requis manque. Les traductions historiques hors diffusion ne sont pas comptées.')}
            </button>
            <button type="button" data-review-filter="existing">
              Déjà présents <b>${n.existing}</b>${reviewInfo('Studio a retrouvé un équivalent. Ces éléments sont pré-positionnés sur « Garder le Studio actuel ».')}
            </button>
            <button type="button" data-review-filter="all">
              Tout voir <b>${n.total}</b>${reviewInfo('Affiche tous les contenus métier du diagnostic. À utiliser surtout pour contrôler un rapprochement.')}
            </button>
          </div>
          <div class="migration-review-expand">
            <button type="button" data-review-expand="1">Tout déplier</button>
            <button type="button" data-review-expand="0">Tout replier</button>
          </div>
        </div>

        <div class="migration-review-filter-summary" id="migration-review-filter-summary"></div>

        <div class="migration-review-auto-note">
          <strong>${n.existing} éléments déjà rapprochés automatiquement</strong>
          <span>Ils sont réglés sur « Garder le Studio actuel ». Tu peux les contrôler ou modifier la décision si nécessaire.</span>
          ${reviewInfo('Un rapprochement automatique n’intègre rien. Il prépare uniquement la décision finale.')}
        </div>

        ${technicalEntities.length?`<details class="migration-review-technical-block">
          <summary><span class="migration-review-round">›</span>Informations techniques de migration ${reviewInfo('Provenance, ancien ID, langues et métadonnées nécessaires à la traçabilité. Aucune décision métier à prendre ici.')}</summary>
          <div>${technicalEntities.map(reviewTechnicalCard).join('')}</div>
        </details>`:''}

        <div class="migration-review-empty" data-review-empty hidden>
          <strong>Aucun élément dans ce filtre.</strong>
          <span>Choisis un autre filtre pour poursuivre la revue.</span>
        </div>

        ${chapterHtml}
        <section class="admin-library-note migration-review-final-step" id="migration-review-final-step" ${(n.pending>0||n.translations>0)?'hidden':''}>
          <strong>ÉTAPE 3 SUR 3 · TEST D’INTÉGRATION STAGING</strong>
          <span>Toutes les décisions sont enregistrées. Tu peux appliquer réellement ce lot dans le catalogue de staging pour tester le parcours jusqu’au bout. Studio créera un snapshot permettant d’annuler ensuite toutes les modifications et créations du test.</span>
          <div class="top-actions"><button type="button" class="button button-primary" id="migration-review-apply-test">Appliquer le test dans le catalogue staging</button></div>
        </section>`;

      const filterButtons=$$('[data-review-filter]');
      const cards=$$('[data-review-card]');
      const chaptersEls=$$('[data-review-chapter]');
      const empty=$('[data-review-empty]');
      const saveBtn=$('#migration-review-save');
      const saveState=$('#migration-review-save-state');
      const dirty=new Map();

      const filterSummary=$('#migration-review-filter-summary');
      function filterExplanation(f){
        const matching=businessEntities.filter(e=>{
          if(f==='pending')return e.review_status==='pending'&&e.comparison?.status!=='exact_match';
          if(f==='variant')return e.comparison?.status==='possible_variant'&&e.review_status==='pending';
          if(f==='new')return e.comparison?.status==='new'&&e.review_status==='pending';
          if(f==='existing')return e.comparison?.status==='exact_match';
          if(f==='translations')return activeTranslationMissing(e);
          return true;
        });
        const byType={};matching.forEach(e=>byType[e.entity_type]=(byType[e.entity_type]||0)+1);
        const parts=[];
        if(byType.situation)parts.push(`${byType.situation} situation${byType.situation>1?'s':''}`);
        if(byType.answer)parts.push(`${byType.answer} réponse${byType.answer>1?'s':''}`);
        if(byType.profile)parts.push(`${byType.profile} profil${byType.profile>1?'s':''}`);
        if(byType.chapter)parts.push(`${byType.chapter} chapitre${byType.chapter>1?'s':''}`);
        if(f==='translations'){
          const locales=[...new Set(matching.flatMap(e=>translationMissingInfo(e).map(x=>x.locale.toUpperCase())))];
          return `<strong>${matching.length} contenu${matching.length>1?'s':''} avec traduction active incomplète</strong><span>Langue${locales.length>1?'s':''} concernée${locales.length>1?'s':''} : ${locales.join(', ')||'—'}. ${parts.join(' · ')}</span>`;
        }
        const labels={pending:'Décisions restantes',variant:'Variantes restant à décider',new:'Nouveaux contenus restant à décider',existing:'Contenus déjà rapprochés',all:'Tous les contenus métier'};
        return `<strong>${labels[f]||'Résultats'}</strong><span>${parts.join(' · ')||'Aucun contenu'}. Les situations parentes restent visibles comme contexte lorsque seules leurs réponses correspondent au filtre.</span>`;
      }
      function refreshNestedVisibility(){
        $$('.migration-review-situation-group').forEach(group=>{
          const own=[...group.children].find(el=>el.matches?.('[data-review-card]'));
          const childCards=[...group.querySelectorAll('.migration-review-subgroup [data-review-card]')];
          const visibleChildren=childCards.some(c=>!c.hidden);
          const ownMatched=own && own.dataset.filterMatched==='1';
          if(own){
            own.classList.toggle('is-context-only',visibleChildren&&!ownMatched);
            if(visibleChildren&&!ownMatched)own.hidden=false;
          }
        });
        $$('.migration-review-subgroup').forEach(group=>{
          const hasVisible=[...group.querySelectorAll('[data-review-card]')].some(c=>!c.hidden&&!c.classList.contains('is-context-only'));
          group.hidden=!hasVisible;
        });
        const activeFilter=root.dataset.activeFilter||'all';
        const contextualLabel=(kind,visible,total)=>{
          const plural=visible>1?'s':'';
          if(activeFilter==='pending')return `${visible} ${kind}${plural} à décider sur ${total}`;
          if(activeFilter==='variant')return `${visible} ${kind}${plural} variante${plural} sur ${total}`;
          if(activeFilter==='new')return `${visible} nouveau${visible>1?'x':''} ${kind}${plural} sur ${total}`;
          if(activeFilter==='translations')return `${visible} ${kind}${plural} à compléter sur ${total}`;
          if(activeFilter==='existing')return `${visible} ${kind}${plural} déjà présent${plural} sur ${total}`;
          return `${total} ${kind}${total>1?'s':''}`;
        };
        $$('[data-review-profile-group]').forEach(group=>{
          const total=Number(group.dataset.totalProfiles||0);
          const visible=[...group.querySelectorAll(':scope > div > [data-review-card]')].filter(c=>!c.hidden&&!c.classList.contains('is-context-only')).length;
          const label=group.querySelector('[data-review-profile-count]');
          if(label)label.textContent=contextualLabel('profil',visible,total);
        });
        $$('[data-review-situations-group]').forEach(group=>{
          const label=group.querySelector('[data-review-situation-count]');
          if(!label)return;
          const total=Number(label.dataset.totalSituations||0);
          const visible=[...group.querySelectorAll(':scope > div > .migration-review-situation-group > [data-review-card]')].filter(c=>!c.hidden&&!c.classList.contains('is-context-only')).length;
          label.textContent=contextualLabel('situation',visible,total);
        });
        $$('.migration-review-situation-group').forEach(group=>{
          const own=[...group.children].find(el=>el.matches?.('[data-review-card]'));
          const subgroup=[...group.querySelectorAll('.migration-review-subgroup')].some(g=>!g.hidden);
          const ownReal=own&&!own.hidden&&!own.classList.contains('is-context-only');
          group.hidden=!ownReal&&!subgroup;
        });
        let visibleChapters=0;
        chaptersEls.forEach(ch=>{
          // Un chapitre doit rester visible dès qu'il contient AU MOINS
          // une carte réellement visible, y compris un profil dans le bloc profils.
          const visibleCards=[...ch.querySelectorAll('[data-review-card]')]
            .filter(c=>!c.hidden&&!c.classList.contains('is-context-only'));
          const visibleGroups=[...ch.querySelectorAll('.migration-review-subgroup')]
            .filter(g=>!g.hidden);
          const hasVisible=visibleCards.length>0||visibleGroups.length>0;
          const situationCards=[...ch.querySelectorAll('.migration-review-situations-subgroup > div > .migration-review-situation-group > [data-review-card]')].filter(c=>!c.hidden&&!c.classList.contains('is-context-only'));
          const profileCards=[...ch.querySelectorAll('.migration-review-profile-subgroup > div > [data-review-card]')].filter(c=>!c.hidden&&!c.classList.contains('is-context-only'));
          const sitLabel=ch.querySelector('[data-review-chapter-situations]');
          const profLabel=ch.querySelector('[data-review-chapter-profiles]');
          if(sitLabel)sitLabel.textContent=contextualLabel('situation',situationCards.length,Number(sitLabel.dataset.totalSituations||0));
          if(profLabel)profLabel.textContent=contextualLabel('profil',profileCards.length,Number(profLabel.dataset.totalProfiles||0));
          ch.hidden=!hasVisible;
          if(hasVisible)visibleChapters++;
        });
        if(empty)empty.hidden=visibleChapters>0;
      }
      function applyReviewFilter(f){
        root.dataset.activeFilter=f;
        filterButtons.forEach(x=>x.classList.toggle('active',x.dataset.reviewFilter===f));
        cards.forEach(c=>{
          c.classList.remove('is-context-only');
          const show=f==='all'||(f==='pending'&&c.dataset.pending==='1')||(f==='variant'&&c.dataset.cmp==='variant'&&c.dataset.pending==='1')||(f==='new'&&c.dataset.cmp==='new'&&c.dataset.pending==='1')||(f==='existing'&&c.dataset.cmp==='existing')||(f==='translations'&&c.dataset.translations==='1');
          c.dataset.filterMatched=show?'1':'0';c.hidden=!show;
        });
        refreshNestedVisibility();
        if(filterSummary)filterSummary.innerHTML=filterExplanation(f);
      }

      filterButtons.forEach(b=>b.addEventListener('click',ev=>{
        ev.preventDefault();ev.stopPropagation();applyReviewFilter(b.dataset.reviewFilter);
      }));

      $$('[data-review-expand]').forEach(b=>b.addEventListener('click',ev=>{
        ev.preventDefault();ev.stopPropagation();
        $$('[data-review-chapter],.migration-review-subgroup').filter(x=>!x.hidden).forEach(x=>x.open=b.dataset.reviewExpand==='1');
      }));

      function liveReviewCounts(){
        return {
          pending:businessEntities.filter(x=>x.review_status==='pending'&&x.comparison?.status!=='exact_match').length,
          variant:businessEntities.filter(x=>x.comparison?.status==='possible_variant'&&x.review_status==='pending').length,
          new:businessEntities.filter(x=>x.comparison?.status==='new'&&x.review_status==='pending').length,
          existing:businessEntities.filter(x=>x.comparison?.status==='exact_match').length,
          translations:businessEntities.filter(x=>activeTranslationMissing(x)).length,
          total:businessEntities.length
        };
      }
      function refreshReviewCounters(){
        const counts=liveReviewCounts();
        filterButtons.forEach(btn=>{
          const key=btn.dataset.reviewFilter;
          const value=counts[key];
          const counter=btn.querySelector('b');
          if(counter&&Number.isFinite(value))counter.textContent=String(value);
        });
        const title=root.querySelector('.migration-review-welcome h3');
        if(title)title.textContent=counts.pending?`${counts.pending} décision${counts.pending>1?'s':''} réellement à prendre`:counts.translations?`Toutes les décisions sont prises · ${counts.translations} traduction${counts.translations>1?'s':''} à compléter`:'Toutes les décisions métier sont enregistrées';
        const finalStep=root.querySelector('#migration-review-final-step');
        if(finalStep)finalStep.hidden=counts.pending>0||counts.translations>0;
        return counts;
      }
      function updateSaveUi(message=''){
        const count=dirty.size;
        if(saveBtn)saveBtn.disabled=!count;
        if(!saveState)return;
        if(message){saveState.textContent=message;return;}
        saveState.textContent=count?`${count} décision${count>1?'s':''} à enregistrer`:'Aucune modification en attente';
      }
      function syncDecisionControlsFromData(){
        $$('[data-review-status]').forEach(sel=>{
          const id=sel.dataset.reviewStatus;
          const entity=businessEntities.find(x=>String(x.id)===String(id));
          if(!entity)return;
          const exact=entity.comparison?.status==='exact_match';
          const expected=entity.review_status||(exact?'keep_current':'pending');
          sel.value=expected;
          sel.dataset.initialValue=expected;
          sel.classList.toggle('is-decided',expected!=='pending');
          const card=sel.closest('[data-review-card]');
          card?.setAttribute('data-pending',expected==='pending'?'1':'0');
          const current=card?.querySelector('[data-decision-current]');
          const def=reviewDecisionDefinitions[expected]||reviewDecisionDefinitions.pending;
          if(current)current.innerHTML=`<strong>${esc(def.label)}</strong><span>${esc(def.short)}</span>`;
          card?.querySelectorAll('[data-decision-help-item]').forEach(item=>item.classList.toggle('is-current',item.dataset.decisionHelpItem===expected));
          const helpPanel=card?.querySelector('[data-decision-help-panel]');
          const helpBtn=card?.querySelector('[data-decision-help]');
          if(helpPanel)helpPanel.hidden=true;
          if(helpBtn){helpBtn.classList.remove('is-open');helpBtn.setAttribute('aria-expanded','false');}
        });
      }

      $$('[data-review-status]').forEach(sel=>{
        const initial=sel.value;
        sel.dataset.initialValue=initial;
        sel.classList.toggle('is-decided',initial!=='pending');
        sel.onchange=()=>{
          const value=sel.value;
          const id=sel.dataset.reviewStatus;
          sel.classList.toggle('is-decided',value!=='pending');
          const card=sel.closest('[data-review-card]');
          card?.setAttribute('data-pending',value==='pending'?'1':'0');
          const current=card?.querySelector('[data-decision-current]');
          const def=reviewDecisionDefinitions[value]||reviewDecisionDefinitions.pending;
          if(current)current.innerHTML=`<strong>${esc(def.label)}</strong><span>${esc(def.short)}</span>`;
          card?.querySelectorAll('[data-decision-help-item]').forEach(item=>item.classList.toggle('is-current',item.dataset.decisionHelpItem===value));
          if(value===sel.dataset.initialValue)dirty.delete(id); else dirty.set(id,value);
          updateSaveUi();
        };
      });

      $$('[data-decision-help]').forEach(btn=>{
        const card=btn.closest('[data-review-card]');
        const panel=card?.querySelector('[data-decision-help-panel]');
        const sel=card?.querySelector('[data-review-status]');
        if(panel&&sel){
          panel.querySelectorAll('[data-decision-help-item]').forEach(item=>item.classList.toggle('is-current',item.dataset.decisionHelpItem===sel.value));
          btn.onclick=()=>{
            panel.hidden=!panel.hidden;
            btn.classList.toggle('is-open',!panel.hidden);
            btn.setAttribute('aria-expanded',panel.hidden?'false':'true');
          };
        }
      });

      if(saveBtn)saveBtn.onclick=async()=>{
        if(!dirty.size)return;
        const savedEntries=[...dirty.entries()];
        const savedCount=savedEntries.length;
        saveBtn.disabled=true;
        if(saveState)saveState.textContent='Enregistrement…';
        try{
          for(const [id,value] of savedEntries){
            await StudioAPI.request('/api/admin/migrations/'+batchId+'/review/'+id,{
              method:'PATCH',body:JSON.stringify({reviewStatus:value})
            });
            const sel=$(`[data-review-status="${id}"]`);
            if(sel)sel.dataset.initialValue=value;
            const entity=businessEntities.find(x=>String(x.id)===String(id));
            if(entity)entity.review_status=value;
          }
          dirty.clear();
          syncDecisionControlsFromData();
          const counts=refreshReviewCounters();
          const activeFilter=root.dataset.activeFilter||'pending';
          applyReviewFilter(activeFilter);
          const savedLabel=`${savedCount} décision${savedCount>1?'s':''} enregistrée${savedCount>1?'s':''}`;
          if(counts.pending>0){
            updateSaveUi(`✓ ${savedLabel}. ${counts.pending} reste${counts.pending>1?'nt':''} à décider.`);
            if(activeFilter==='pending'){
              const next=[...root.querySelectorAll('[data-review-card]')].find(card=>!card.hidden&&card.dataset.pending==='1');
              next?.scrollIntoView({behavior:'smooth',block:'center'});
            }
          }else{
            updateSaveUi(`✓ ${savedLabel}. Toutes les décisions sont enregistrées.`);
            await StudioModal.alert({
              eyebrow:'ÉTAPE 2 TERMINÉE',
              title:'Toutes les décisions sont enregistrées',
              message:'La revue humaine est terminée. Aucune modification du catalogue n’a encore été appliquée. L’intégration finale restera une étape séparée.',
              confirmLabel:'Continuer'
            });
          }
        }catch(e){
          showError(e.message);
          updateSaveUi('Échec de l’enregistrement — réessaie.');
        }
      };

      syncDecisionControlsFromData();
      updateSaveUi();
      const applyTestBtn=$('#migration-review-apply-test');
      if(applyTestBtn)applyTestBtn.onclick=async()=>{
        const counts=liveReviewCounts();
        if(dirty.size){updateSaveUi('Enregistre d’abord les décisions en attente avant l’intégration de test.');return;}
        if(counts.pending>0){updateSaveUi(`${counts.pending} décision${counts.pending>1?'s':''} reste${counts.pending>1?'nt':''} à prendre.`);return;}if(counts.translations>0){updateSaveUi(`${counts.translations} traduction${counts.translations>1?'s':''} active${counts.translations>1?'s':''} reste${counts.translations>1?'nt':''} à compléter.`);return;}
        const ok=await StudioModal.confirm({type:'danger',eyebrow:'ÉTAPE 3 SUR 3 · TEST STAGING',title:'Appliquer réellement ces décisions dans le catalogue de staging ?',message:'Cette action modifie le catalogue STAGING pour te permettre de tester le parcours complet. Avant chaque modification, Studio crée un snapshot. Tu pourras ensuite utiliser « Annuler le test » pour restaurer les anciennes valeurs et supprimer tout ce que ce lot a créé. Ne jamais activer cette fonction en production.',cancelLabel:'Rester en revue',confirmLabel:'Appliquer le test'});
        if(!ok)return;
        applyTestBtn.disabled=true;applyTestBtn.textContent='Application en cours…';
        try{
          const r=await StudioAPI.request('/api/admin/migrations/'+batchId+'/apply-test',{method:'POST',body:'{}'});
          d.close();
          await StudioModal.alert({eyebrow:'TEST STAGING APPLIQUÉ',title:'Tu peux maintenant tester le catalogue',message:r.message||'Les décisions ont été appliquées. Un rollback complet est disponible depuis le lot de migration.',confirmLabel:'Fermer'});
          state.migrationsLoaded=false;await loadMigrations();
        }catch(e){
          showError(e.message);
          applyTestBtn.disabled=false;applyTestBtn.textContent='Appliquer le test dans le catalogue staging';
        }
      };
      applyReviewFilter(n.pending>0?'pending':(n.variant>0?'variant':(n.new>0?'new':'all')));
      $$('[data-translation-edit]').forEach(btn=>btn.onclick=()=>{
        const entity=entities.find(x=>String(x.id)===String(btn.dataset.translationEdit)),locale=btn.dataset.locale;
        if(!entity)return;
        const p=entity.source_payload||{},hist=p.translations?.[locale]||{},saved=draftsByKey.get(`${entity.id}:${locale}`)||{};
        const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),td=$('#migration-translation-dialog');
        $('#migration-translation-title').textContent=`${p.title||hist.title||'Profil'} — ${locale.toUpperCase()}`;
        $('#migration-translation-intro').textContent='Le français est affiché comme référence. Les champs historiques disponibles sont préremplis. « Enregistrer comme brouillon » conserve ton travail sans le considérer terminé ; « Valider la traduction » la marque comme complète et la retire du filtre des traductions à compléter.';
        $('#migration-translation-body').innerHTML=`<div class="migration-translation-editor"><section><span>FR — référence</span><h3>${esc(p.title||p.translations?.fr?.title||'—')}</h3><label>Résumé</label><div class="migration-translation-reference">${esc(clean(p.summary)||'—')}</div><label>Texte détaillé</label><div class="migration-translation-reference">${esc(clean(p.content)||'—')}</div></section><section><span>${locale.toUpperCase()} — à compléter</span><label>Titre</label><input id="migration-translation-field-title" value="${esc(saved.title||hist.title||'')}"><label>Résumé</label><textarea id="migration-translation-field-summary" rows="5">${esc(saved.summary||hist.summary||'')}</textarea><label>Texte détaillé</label><textarea id="migration-translation-field-content" rows="10">${esc(saved.content||hist.content||'')}</textarea></section></div>`;
        const stateEl=$('#migration-translation-state'),draftBtn=$('#migration-translation-draft'),validateBtn=$('#migration-translation-validate');
        const setTranslationState=(kind,message)=>{
          stateEl.className='migration-translation-state '+kind;
          stateEl.textContent=message||'';
        };
        if(saved.status==='validated'){
          setTranslationState('success','✓ Traduction déjà validée');
          validateBtn.textContent='✓ Traduction validée';
          validateBtn.disabled=true;
        }else if(saved.status==='draft'){
          setTranslationState('draft','Brouillon enregistré');
          validateBtn.textContent='Valider la traduction';
          validateBtn.disabled=false;
        }else{
          setTranslationState('','');
          validateBtn.textContent='Valider la traduction';
          validateBtn.disabled=false;
        }
        const closeTranslation=()=>{
          if(td.open)td.close();
        };
        td.querySelectorAll('[data-close-dialog="migration-translation-dialog"]').forEach(b=>{
          b.onclick=e=>{e.preventDefault();e.stopPropagation();closeTranslation();};
        });
        const save=async status=>{
          const title=$('#migration-translation-field-title').value.trim();
          const summary=$('#migration-translation-field-summary').value.trim();
          const content=$('#migration-translation-field-content').value.trim();
          if(status==='validated'&&(!title||!summary||!content)){
            setTranslationState('error','Titre, résumé et texte détaillé sont obligatoires pour valider.');
            return;
          }
          draftBtn.disabled=true;validateBtn.disabled=true;
          if(status==='validated'){
            validateBtn.textContent='Validation…';
            setTranslationState('loading','Validation en cours…');
          }else{
            draftBtn.textContent='Enregistrement…';
            setTranslationState('loading','Enregistrement du brouillon…');
          }
          try{
            const result=await StudioAPI.request(`/api/admin/migrations/${batchId}/review/${entity.id}/translation/${locale}`,{
              method:'PUT',
              body:JSON.stringify({title,summary,content,status})
            });
            draftsByKey.set(`${entity.id}:${locale}`,result.translation||{title,summary,content,status});
            if(status==='validated'){
              setTranslationState('success','✓ Traduction validée. Elle ne sera plus comptée parmi les traductions à compléter.');
              validateBtn.textContent='✓ Traduction validée';
              validateBtn.disabled=true;
              draftBtn.textContent='Enregistrer comme brouillon';
              draftBtn.disabled=false;
            }else{
              setTranslationState('draft','✓ Brouillon enregistré. La traduction reste à compléter tant qu’elle n’est pas validée.');
              draftBtn.textContent='Enregistrer comme brouillon';
              draftBtn.disabled=false;
              validateBtn.textContent='Valider la traduction';
              validateBtn.disabled=false;
            }
          }catch(err){
            setTranslationState('error','Échec : '+(err.message||'impossible d’enregistrer la traduction'));
            draftBtn.textContent='Enregistrer comme brouillon';
            validateBtn.textContent='Valider la traduction';
            draftBtn.disabled=false;validateBtn.disabled=false;
          }
        };
        draftBtn.onclick=()=>save('draft');
        validateBtn.onclick=()=>save('validated');
        td.addEventListener('close',()=>{
          // Rafraîchit la revue seulement APRÈS fermeture de la sous-fenêtre.
          // On ferme d'abord la revue existante pour éviter showModal() sur un dialog déjà ouvert.
          if(d.open)d.close();
          openMigrationReview(batchId);
        },{once:true});
        td.showModal();
      });
      d.showModal();
    }catch(e){showError(e.message);}
  }
  async function processPack(id,action){const ok=await StudioModal.confirm({type:action==='approve'?'info':'danger',title:action==='approve'?'Valider cette demande ?':'Refuser cette demande ?',message:action==='approve'?'Les crédits seront ajoutés selon la règle du pack actif.':'Le client sera informé.',confirmLabel:action==='approve'?'Valider':'Refuser'});if(!ok)return;try{await StudioAPI.request('/api/admin/pack-requests/'+id,{method:'PATCH',body:JSON.stringify({action})});load();}catch(e){showError(e.message);}}
  function bindOrgActions(){$$('[data-pack]').forEach(b=>b.onclick=()=>processPack(b.dataset.packId,b.dataset.pack));$$('[data-save-credits]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveCredits,unlimited=$(`[data-unlimited="${id}"]`).checked;try{await StudioAPI.request('/api/admin/organizations/'+id,{method:'PATCH',body:JSON.stringify({sectors:[$(`[data-sector="${id}"]`).value].filter(Boolean),passationsQuota:Number($(`[data-quota="${id}"]`).value)||0,passationsUsed:Number($(`[data-used="${id}"]`).value)||0,packExpiresAt:$(`[data-expiry="${id}"]`).value||null,packUnlimited:unlimited,accountManagerUserId:$(`[data-account-manager="${id}"]`).value||null})});load();}catch(e){showError(e.message);}});$$('[data-unlimited]').forEach(c=>c.onchange=()=>{const id=c.dataset.unlimited;$(`[data-quota="${id}"]`).disabled=c.checked;$(`[data-used="${id}"]`).disabled=c.checked;});$$('[data-add-user]').forEach(b=>b.onclick=()=>openClientForm(null,b.dataset.addUser));$$('[data-org-campaigns]').forEach(b=>b.onclick=()=>{$('#campaign-search').value=b.dataset.orgCampaigns;activateTab('campaigns');renderCampaigns();});$$('[data-archive-org]').forEach(b=>b.onclick=async()=>{const o=state.organizations.find(x=>String(x.id)===String(b.dataset.archiveOrg)),next=b.dataset.nextActive==='true';if(!window.confirm((next?'Réactiver':'Archiver')+' le cockpit de '+(o?.name||'ce client')+' ?\n\n'+(next?'Les accès pourront de nouveau être utilisés.':'Aucune campagne ni donnée ne sera supprimée.')))return;try{await StudioAPI.request('/api/admin/organizations/'+b.dataset.archiveOrg,{method:'PATCH',body:JSON.stringify({active:next})});load();}catch(e){showError(e.message);}});$$('[data-delete-org]').forEach(b=>b.onclick=async()=>{const o=state.organizations.find(x=>String(x.id)===String(b.dataset.deleteOrg)),typed=window.prompt('Suppression définitive du cockpit « '+(o?.name||'ce client')+' ».\n\nCette action n’est possible que si aucun historique métier n’existe.\n\nTapez SUPPRIMER pour confirmer.','');if(typed!=='SUPPRIMER')return;try{await StudioAPI.request('/api/admin/organizations/'+b.dataset.deleteOrg,{method:'DELETE'});load();}catch(e){showError(e.message);}});$$('[data-favorite-org]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/organizations/'+b.dataset.favoriteOrg+'/classification',{method:'PATCH',body:JSON.stringify({favorite:b.dataset.nextFavorite==='true'})});await load();}catch(e){showError(e.message);}});$$('[data-move-client-folder]').forEach(b=>b.onclick=async()=>{const o=state.organizations.find(x=>String(x.id)===String(b.dataset.moveClientFolder));if(!o)return;const folderId=await askClientMoveFolder(o);if(folderId===null)return;try{await StudioAPI.request('/api/admin/organizations/'+o.id+'/classification',{method:'PATCH',body:JSON.stringify({folderId:folderId||null})});await load();}catch(e){showError(e.message);}});bindUserActions($('#admin-organizations'));}
    function bindUserActions(scope){scope.querySelectorAll('[data-resend-client]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/users/'+b.dataset.resendClient+'/resend-invitation',{method:'POST',body:'{}'});await StudioModal.alert({title:'Invitation renvoyée',message:'Un nouveau lien a été envoyé.',confirmLabel:'Fermer'});}catch(e){showError(e.message);}});scope.querySelectorAll('[data-edit-client]').forEach(b=>b.onclick=()=>{const u=state.clientUsers.get(b.dataset.editClient);openClientForm(u,u.organizationId);});scope.querySelectorAll('[data-toggle-client]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/client-users/'+b.dataset.toggleClient,{method:'PATCH',body:JSON.stringify({active:b.dataset.active==='true'})});load();}catch(e){showError(e.message);}});scope.querySelectorAll('[data-delete-client]').forEach(b=>b.onclick=async()=>{const u=state.clientUsers.get(b.dataset.deleteClient),ok=await StudioModal.confirm({type:'danger',title:'Supprimer ce compte client ?',message:`L’accès de ${u?.first_name||''} ${u?.last_name||''} sera définitivement supprimé.`,confirmLabel:'Supprimer'});if(!ok)return;try{await StudioAPI.request('/api/admin/client-users/'+b.dataset.deleteClient,{method:'DELETE'});load();}catch(e){showError(e.message);}});}
  function openClientForm(u,orgId){const f=$('#user-form');f.reset();f.dataset.editId=u?.id||'';$('#user-org-id').value=orgId;$('#user-dialog h2').textContent=u?'Modifier le compte client':'Ajouter un accès supplémentaire';$('#create-user').textContent=u?'Enregistrer':'Créer et envoyer l’invitation';if(u){$('#user-first').value=u.first_name||'';$('#user-last').value=u.last_name||'';$('#user-job-title').value=u.job_title||'';$('#user-phone').value=u.phone||'';$('#user-email').value=u.email||'';}userDialog.showModal();}
  function openAdminForm(u=null){const f=$('#admin-user-form');f.reset();f.dataset.editId=u?.id||'';$('#admin-user-dialog h2').textContent=u?'Modifier le compte administrateur':'Ajouter un compte administrateur';$('#create-admin-user').textContent=u?'Enregistrer':'Créer et envoyer l’invitation';if(u){$('#admin-user-first').value=u.first_name||'';$('#admin-user-last').value=u.last_name||'';$('#admin-user-job').value=u.job_title||'';$('#admin-user-phone').value=u.phone||'';$('#admin-user-email').value=u.email||'';}adminUserDialog.showModal();}
  function bindAdminActions(){$$('[data-admin-edit]').forEach(b=>b.onclick=()=>openAdminForm(state.adminUsers.get(b.dataset.adminEdit)));$$('[data-admin-resend]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/users/'+b.dataset.adminResend+'/resend-invitation',{method:'POST',body:'{}'});}catch(e){showError(e.message);}});$$('[data-admin-active]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/administrators/'+b.dataset.adminActive,{method:'PATCH',body:JSON.stringify({active:b.dataset.active==='true'})});load();}catch(e){showError(e.message);}});$$('[data-admin-delete]').forEach(b=>b.onclick=async()=>{const ok=await StudioModal.confirm({type:'danger',title:'Supprimer cet administrateur ?',message:'Cet accès sera définitivement supprimé.',confirmLabel:'Supprimer'});if(!ok)return;try{await StudioAPI.request('/api/admin/administrators/'+b.dataset.adminDelete,{method:'DELETE'});load();}catch(e){showError(e.message);}});}
  async function loadLibraryAdmin(){
    const root=$('#admin-library');if(!root)return;root.innerHTML='<div class="admin-library-loading">Chargement de la bibliothèque…</div>';
    try{const[data,media]=await Promise.all([StudioAPI.request('/api/admin/catalog/themes'),StudioAPI.request('/api/admin/media-library')]);state.catalogThemes=data.themes||[];state.mediaLibrary=media.videos||[];state.mediaThemes=media.themeOptions||[];state.mediaLibraryLoaded=true;state.catalogLoaded=true;renderLibraryAdmin();}catch(e){root.innerHTML=`<div class="composer-alert">${esc(e.message)}</div>`;}
  }
  function mediaLibraryOptions(selectedId=''){
    const active=state.mediaLibrary.filter(v=>v.active!==false||String(v.id)===String(selectedId));
    return '<option value="">Aucune vidéo</option>'+active.map(v=>`<option value="${v.id}" ${String(v.id)===String(selectedId)?'selected':''}>${esc(v.title)}</option>`).join('');
  }
  function mediaLibraryForm(video=null){
    const selectedThemes=new Set((video?.theme_keys||[]).map(String));
    const themeChoices=state.mediaThemes.map(t=>`<label class="admin-media-theme-choice"><input type="checkbox" data-media-lib-theme value="${esc(t.key)}" ${selectedThemes.has(String(t.key))?'checked':''}><span>${esc(t.title)}</span></label>`).join('');
    const tags=(video?.admin_tags||[]);
    const existingTags=[...new Set(state.mediaLibrary.flatMap(v=>v.admin_tags||[]))].filter(t=>!tags.includes(t)).slice(0,12);
    return `<form class="admin-media-library-form admin-media-library-form-v2" data-media-library-form="${video?.id||''}">
      <div class="admin-media-form-head">
        <div class="admin-media-form-title"><span class="admin-media-library-play">▶</span><div><h3>${video?'Modifier la vidéo':'Ajouter une vidéo'}</h3><p>Centralisez la vidéo ici, puis classez-la pour la retrouver rapidement dans les profils et les chapitres.</p></div></div>
      </div>

      <section class="admin-media-form-card">
        <div class="admin-media-form-card-head"><span class="admin-media-form-step">1</span><div><h4>Informations</h4><p>Le titre et le lien d’hébergement de la vidéo.</p></div></div>
        <div class="admin-media-info-grid">
          <label><span>Titre</span><input data-media-lib-title value="${esc(video?.title||'')}" placeholder="Ex. Stéréotypes de genre" required></label>
          <label><span>URL publique HB</span><input data-media-lib-url type="url" value="${esc(video?.source_url||'')}" placeholder="https://…" required><small>Cette URL reste côté admin/API et n’est pas affichée au client.</small></label>
          <label class="admin-media-library-description"><span>Description</span><textarea data-media-lib-description rows="3" placeholder="Ex. France en français">${esc(video?.description||'')}</textarea></label>
        </div>
      </section>

      <section class="admin-media-form-card">
        <div class="admin-media-form-card-head"><span class="admin-media-form-step">2</span><div><h4>Thématiques</h4><p>Associez la vidéo aux thématiques du Studio concernées.</p></div></div>
        <div class="admin-media-theme-choices">${themeChoices||'<span class="admin-library-empty-line">Aucune thématique disponible.</span>'}</div>
      </section>

      <section class="admin-media-form-card">
        <div class="admin-media-form-card-head"><span class="admin-media-form-step">3</span><div><h4>Mots-clés</h4><p>Créez librement vos propres tags : stéréotypes, France, français, rappel à la loi…</p></div></div>
        <div class="admin-media-tag-editor">
          <div class="admin-media-tag-entry">
            <input data-media-tag-input placeholder="Saisir un mot-clé puis Entrée" autocomplete="off">
            <button class="button button-secondary button-small" type="button" data-add-media-tag>+ Ajouter</button>
          </div>
          <div class="admin-media-tag-chips" data-media-tag-chips>${tags.map(t=>`<button type="button" class="admin-media-edit-tag" data-media-tag="${esc(t)}"><span>${esc(t)}</span><b aria-hidden="true">×</b></button>`).join('')}</div>
          ${existingTags.length?`<div class="admin-media-tag-suggestions"><span>Tags déjà utilisés :</span>${existingTags.map(t=>`<button type="button" data-suggest-media-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>`:''}
          <small>Un tag peut être retiré en cliquant sur ×. Les tags servent aussi de filtres dans la Médiathèque.</small>
        </div>
      </section>

      <section class="admin-media-form-card admin-media-status-card">
        <div class="admin-media-form-card-head"><span class="admin-media-form-step">4</span><div><h4>Disponibilité</h4><p>Une vidéo inactive reste conservée mais n’est plus proposée dans les sélecteurs.</p></div></div>
        <label class="admin-media-status-toggle"><input data-media-lib-active type="checkbox" ${video?.active===false?'':'checked'}><span><strong>Vidéo active et sélectionnable</strong><small>Disponible dans les profils et les chapitres.</small></span></label>
      </section>

      <div class="admin-library-inline-actions admin-media-form-actions"><button class="button button-secondary" type="button" data-cancel-media-library>Annuler</button><button class="button button-primary" type="submit">${video?'Enregistrer les modifications':'Ajouter à la médiathèque'}</button></div>
    </form>`;
  }
  async function loadMediaLibrary(){
    const root=$('#admin-media-library');if(root)root.innerHTML='<div class="admin-library-loading">Chargement de la médiathèque…</div>';
    try{const data=await StudioAPI.request('/api/admin/media-library');state.mediaLibrary=data.videos||[];state.mediaThemes=data.themeOptions||[];state.mediaLibraryLoaded=true;renderMediaLibrary();}catch(e){if(root)root.innerHTML=`<div class="composer-alert">${esc(e.message)}</div>`;}
  }
  function renderMediaLibrary(){
    const root=$('#admin-media-library');if(!root)return;
    const q=String($('#media-library-search')?.value||'').trim().toLowerCase(),status=$('#media-library-status')?.value||'',themeId=$('#media-library-theme')?.value||'',tag=$('#media-library-tag')?.value||'';
    const themeSelect=$('#media-library-theme'),tagSelect=$('#media-library-tag');
    if(themeSelect){
      const current=themeSelect.value;
      themeSelect.innerHTML='<option value="">Toutes les thématiques</option>'+state.mediaThemes.map(t=>`<option value="${esc(t.key)}">${esc(t.title)}</option>`).join('');
      themeSelect.value=current;
    }
    const allTags=[...new Set(state.mediaLibrary.flatMap(v=>v.admin_tags||[]))].sort((a,b)=>a.localeCompare(b,'fr'));
    if(tagSelect){
      const current=tagSelect.value;
      tagSelect.innerHTML='<option value="">Tous les tags</option>'+allTags.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
      tagSelect.value=current;
    }
    const videos=state.mediaLibrary.filter(v=>{
      const themeTitles=(v.theme_keys||[]).map(key=>state.mediaThemes.find(t=>t.key===key)?.title||key);const searchable=`${v.title||''} ${v.description||''} ${v.source_url||''} ${(v.admin_tags||[]).join(' ')} ${themeTitles.join(' ')}`.toLowerCase();
      return (!q||searchable.includes(q))
        &&(!status||(status==='active'?v.active!==false:v.active===false))
        &&(!themeId||(v.theme_keys||[]).includes(themeId))
        &&(!tag||(v.admin_tags||[]).includes(tag));
    });
    root.innerHTML=videos.length?videos.map(v=>`<article class="admin-media-library-card ${v.active===false?'is-inactive':''}"><div class="admin-media-library-card-head"><span class="admin-media-library-play">▶</span><div><h3>${esc(v.title)}</h3><div class="admin-media-library-tags"><span class="${v.active===false?'is-off':'is-on'}">${v.active===false?'Inactive':'Active'}</span><span>${Number(v.usage_count||0)} utilisation${Number(v.usage_count||0)>1?'s':''}</span></div></div></div><div class="admin-media-classification">${(v.theme_keys||[]).map(key=>`<span class="admin-media-theme-tag">${esc(state.mediaThemes.find(t=>t.key===key)?.title||key)}</span>`).join('')}${(v.admin_tags||[]).map(t=>`<span class="admin-media-free-tag">${esc(t)}</span>`).join('')}</div>${v.description?`<p>${esc(v.description)}</p>`:''}<div class="admin-media-library-url"><span>URL HB</span><code>${esc(v.source_url)}</code></div><div class="admin-media-library-card-actions"><button class="button button-secondary button-small" type="button" data-edit-media-library="${v.id}">Modifier</button><button class="button button-danger-soft button-small" type="button" data-delete-media-library="${v.id}" ${Number(v.usage_count||0)>0?'disabled title="Vidéo utilisée : retirez d’abord ses associations"':''}>Supprimer</button></div></article>`).join(''):'<p class="admin-library-empty-line">Aucune vidéo ne correspond à ces filtres.</p>';
    $$('[data-edit-media-library]').forEach(b=>b.onclick=()=>openMediaLibraryForm(state.mediaLibrary.find(v=>String(v.id)===String(b.dataset.editMediaLibrary))));
    $$('[data-delete-media-library]').forEach(b=>b.onclick=async()=>{const v=state.mediaLibrary.find(x=>String(x.id)===String(b.dataset.deleteMediaLibrary));if(!confirm(`Supprimer définitivement « ${v?.title||'cette vidéo'} » de la médiathèque ?`))return;try{await StudioAPI.request('/api/admin/media-library/'+b.dataset.deleteMediaLibrary,{method:'DELETE'});await loadMediaLibrary();state.catalogLoaded=false;}catch(error){showError(error.message);}});
  }
  function mediaFormTags(form){
    return [...form.querySelectorAll('[data-media-tag]')].map(el=>String(el.dataset.mediaTag||'').trim()).filter(Boolean);
  }
  function addMediaFormTag(form,raw){
    const value=String(raw||'').replace(/\s+/g,' ').trim();
    if(!value)return;
    if(value.length>40){showError('Un tag ne peut pas dépasser 40 caractères');return;}
    const current=mediaFormTags(form);
    if(current.some(t=>t.toLocaleLowerCase('fr')===value.toLocaleLowerCase('fr')))return;
    const chips=form.querySelector('[data-media-tag-chips]');
    const button=document.createElement('button');
    button.type='button';button.className='admin-media-edit-tag';button.dataset.mediaTag=value;
    const label=document.createElement('span');label.textContent=value;
    const close=document.createElement('b');close.setAttribute('aria-hidden','true');close.textContent='×';
    button.append(label,close);
    button.onclick=()=>button.remove();
    chips.appendChild(button);
  }
  function bindMediaTagEditor(form){
    const input=form.querySelector('[data-media-tag-input]'),add=form.querySelector('[data-add-media-tag]');
    form.querySelectorAll('[data-media-tag]').forEach(b=>b.onclick=()=>b.remove());
    const commit=()=>{addMediaFormTag(form,input.value);input.value='';input.focus();};
    add.onclick=commit;
    input.onkeydown=e=>{
      if(e.key==='Enter'||e.key===','){e.preventDefault();commit();}
      if(e.key==='Backspace'&&!input.value){const tags=form.querySelectorAll('[data-media-tag]');tags[tags.length-1]?.remove();}
    };
    form.querySelectorAll('[data-suggest-media-tag]').forEach(b=>b.onclick=()=>addMediaFormTag(form,b.dataset.suggestMediaTag));
  }
  function openMediaLibraryForm(video=null){
    const slot=$('#admin-media-library-form-slot');if(!slot)return;
    slot.innerHTML=mediaLibraryForm(video);
    const form=slot.querySelector('form');
    bindMediaTagEditor(form);
    form.querySelector('[data-cancel-media-library]').onclick=()=>slot.innerHTML='';
    form.onsubmit=async e=>{
      e.preventDefault();if(!form.reportValidity())return;
      const payload={
        title:form.querySelector('[data-media-lib-title]').value.trim(),
        sourceUrl:form.querySelector('[data-media-lib-url]').value.trim(),
        description:form.querySelector('[data-media-lib-description]').value.trim(),
        themeKeys:[...form.querySelectorAll('[data-media-lib-theme]:checked')].map(i=>i.value),
        tags:mediaFormTags(form),
        active:form.querySelector('[data-media-lib-active]').checked
      };
      try{
        await StudioAPI.request(video?'/api/admin/media-library/'+video.id:'/api/admin/media-library',{method:video?'PATCH':'POST',body:JSON.stringify(payload)});
        slot.innerHTML='';await loadMediaLibrary();state.catalogLoaded=false;
      }catch(error){showError(error.message);}
    };
    form.querySelector('[data-media-lib-title]')?.focus();
  }
  const findTheme=id=>state.catalogThemes.find(t=>String(t.id)===String(id));
  const findChapter=id=>state.catalogThemes.flatMap(t=>t.chapters||[]).find(c=>String(c.id)===String(id));
  const findSituation=id=>state.catalogThemes.flatMap(t=>(t.chapters||[]).flatMap(c=>c.situations||[])).find(si=>String(si.id)===String(id));
  const situationKey=si=>String(si?.content||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function canonicalSituations(chapter){
    const groups=new Map(),rank=si=>(si.active!==false&&!si.archived_at&&!si.deleted_at?3:(si.archived_at||si.deleted_at?2:1));
    for(const si of chapter?.situations||[]){
      const key=situationKey(si)||`id:${si.id}`;
      const previous=groups.get(key);
      if(!previous){groups.set(key,si);continue;}
      // Les anciens imports ont parfois laissé une copie inactive de la même situation.
      // On privilégie d'abord la situation réellement utilisée, puis une archive/corbeille volontaire,
      // et seulement en dernier une ancienne copie technique inactive.
      if(rank(si)>rank(previous)||(rank(si)===rank(previous)&&Number(si.id)>Number(previous.id)))groups.set(key,si);
    }
    return [...groups.values()].sort((a,b)=>(Number(a.position)||0)-(Number(b.position)||0)||Number(a.id)-Number(b.id));
  }
  const currentSituations=chapter=>canonicalSituations(chapter)
    .filter(si=>!si.archived_at&&!si.deleted_at)
    .sort((a,b)=>(Number(Boolean(b.is_default))-Number(Boolean(a.is_default)))||((Number(a.position)||0)-(Number(b.position)||0))||Number(a.id)-Number(b.id));
  const archivedSituations=chapter=>canonicalSituations(chapter).filter(si=>Boolean(si.archived_at)&&!si.deleted_at);
  const deletedSituations=chapter=>canonicalSituations(chapter).filter(si=>Boolean(si.deleted_at));
  const themeSituationCount=theme=>(theme.chapters||[]).reduce((n,c)=>n+currentSituations(c).length,0);
  const archivedSituationCount=theme=>(theme.chapters||[]).reduce((n,c)=>n+archivedSituations(c).length,0);
  const deletedSituationCount=theme=>(theme.chapters||[]).reduce((n,c)=>n+deletedSituations(c).length,0);
  const chapterSituationFilter=chapterId=>state.librarySituationFilters.get(String(chapterId))||'all';
  function filteredChapterSituations(chapter){
    const filter=chapterSituationFilter(chapter.id);
    if(filter==='base')return currentSituations(chapter).filter(si=>Boolean(si.is_default));
    if(filter==='library')return currentSituations(chapter).filter(si=>!si.is_default);
    if(filter==='archived')return archivedSituations(chapter);
    if(filter==='deleted')return deletedSituations(chapter);
    return currentSituations(chapter);
  }
  function renderLibraryAdmin(){
    const root=$('#admin-library');if(!root)return;
    if(!state.catalogThemes.length){root.innerHTML='<div class="admin-library-empty"><strong>Aucune thématique</strong><p>Créez la première thématique du référentiel.</p></div>';return;}
    const theme=state.libraryThemeId?findTheme(state.libraryThemeId):null;
    if(!theme){
      state.libraryThemeId=null;
      root.innerHTML=`<div class="admin-library-home-head"><div><h3>Thématiques</h3><p>Entrez dans une thématique pour administrer ses chapitres, situations, réponses, scoring et profils.</p></div><span>${state.catalogThemes.length} thématique${state.catalogThemes.length>1?'s':''}</span></div><div class="admin-library-theme-grid">${state.catalogThemes.map(t=>`<article class="admin-library-theme-card ${t.active?'':'is-inactive'}" data-open-library-theme="${t.id}" tabindex="0" role="button" aria-label="Ouvrir ${esc(t.title)}"><div class="admin-library-theme-card-top"><span class="admin-library-theme-icon">🌼</span><span class="status-pill ${t.active?'is-open':'is-muted'}">${t.active?'Active':'Inactive'}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description||'Aucune description')}</p><div class="admin-library-theme-stats"><span><strong>${(t.chapters||[]).length}</strong> chapitre${(t.chapters||[]).length>1?'s':''}</span><span><strong>${themeSituationCount(t)}</strong> situation${themeSituationCount(t)>1?'s':''}</span>${archivedSituationCount(t)?`<span><strong>${archivedSituationCount(t)}</strong> archivée${archivedSituationCount(t)>1?'s':''}</span>`:''}${deletedSituationCount(t)?`<span><strong>${deletedSituationCount(t)}</strong> supprimée${deletedSituationCount(t)>1?'s':''}</span>`:''}</div><div class="admin-library-theme-enter">Entrer dans la thématique <span>→</span></div></article>`).join('')}</div>`;
      bindLibraryActions();return;
    }
    root.innerHTML=`<div class="admin-library-detail-head"><button class="button button-ghost admin-library-back" type="button" data-library-back>← Toutes les thématiques</button><div class="admin-library-detail-title"><div><div class="admin-library-theme-title"><h3>${esc(theme.title)}</h3><span class="status-pill ${theme.active?'is-open':'is-muted'}">${theme.active?'Active':'Inactive'}</span></div><p>${esc(theme.description||'Aucune description')}</p><div class="admin-library-detail-stats"><span>${(theme.chapters||[]).length} chapitre${(theme.chapters||[]).length>1?'s':''}</span><span>${themeSituationCount(theme)} situations</span>${archivedSituationCount(theme)?`<span>${archivedSituationCount(theme)} archivée${archivedSituationCount(theme)>1?'s':''}</span>`:''}${deletedSituationCount(theme)?`<span>${deletedSituationCount(theme)} supprimée${deletedSituationCount(theme)>1?'s':''}</span>`:''}</div></div><div class="admin-library-actions"><button class="button button-secondary button-small" data-edit-theme="${theme.id}">Modifier la thématique</button><button class="button button-primary button-small" data-add-chapter="${theme.id}">+ Ajouter un chapitre</button></div></div></div><div class="admin-library-chapters admin-library-chapters-detail">${(theme.chapters||[]).length?(theme.chapters||[]).map(ch=>chapterAccordion(theme,ch)).join(''):'<div class="admin-library-empty"><strong>Aucun chapitre</strong><p>Ajoutez le premier chapitre de cette thématique.</p></div>'}</div>`;
    bindLibraryActions();
  }
  function chapterAccordion(theme,ch){
    const expanded=state.libraryExpandedChapters.has(String(ch.id));
    const current=currentSituations(ch),archives=archivedSituations(ch),deleted=deletedSituations(ch),count=current.length;
    const baseCount=current.filter(si=>si.is_default).length,libraryCount=current.filter(si=>!si.is_default).length;
    const filter=chapterSituationFilter(ch.id),visible=filteredChapterSituations(ch);
    const chip=(value,label,countValue,klass='')=>`<button type="button" class="admin-library-filter-chip ${klass} ${filter===value?'is-selected':''}" data-library-situation-filter="${value}" data-chapter-id="${ch.id}"><span>${label}</span><b>${countValue}</b></button>`;
    return `<section class="admin-library-chapter admin-library-chapter-accordion ${expanded?'is-expanded':''}" data-library-chapter="${ch.id}"><div class="admin-library-chapter-head" data-toggle-library-chapter="${ch.id}" role="button" tabindex="0"><div class="admin-library-chapter-main"><span class="admin-library-chevron" aria-hidden="true">›</span><div><strong>${esc(ch.title)}</strong>${ch.locked?'<span class="admin-library-lock">🔒 Obligatoire</span>':''}<small>${count} situation${count>1?'s':''}${archives.length?` · ${archives.length} archivée${archives.length>1?'s':''}`:''}${deleted.length?` · ${deleted.length} supprimée${deleted.length>1?'s':''}`:''} · ${Number(ch.profile_count||0)}/3 profils</small></div></div><div class="admin-library-chapter-actions"><button class="button button-ghost button-small" data-edit-chapter="${ch.id}">Modifier</button><button class="button button-secondary button-small" data-add-inline-situation="${ch.id}">+ Situation</button></div></div>${expanded?`<div class="admin-library-chapter-body"><section class="admin-library-profiles-panel"><div class="admin-library-subhead admin-library-profiles-head"><div><h4>Profils de restitution</h4><p>Ouvrez un profil pour modifier son titre, ses textes, sa couleur et ses seuils de scoring.</p></div></div><form class="admin-library-profiles-form" data-profile-inline-form="${ch.id}"><div class="admin-library-profile-list">${[0,1,2].map((_,i)=>profileInlineRow(ch,(ch.profiles||[])[i]||{},i)).join('')}</div><div class="admin-library-inline-actions admin-library-profiles-actions"><button class="button button-secondary" type="button" data-cancel-inline>Annuler</button><button class="button button-primary" type="submit">Enregistrer les profils</button></div></form></section><div class="admin-library-situations-inline"><div class="admin-library-subhead"><div><h4>Situations</h4><p>Les situations de la sélection de base sont affichées en premier. Utilisez les filtres pour isoler un type de contenu.</p></div><button class="button button-primary button-small" type="button" data-add-inline-situation="${ch.id}">+ Ajouter une situation</button></div><div class="admin-library-situation-filters">${chip('all','Toutes',count,'is-all')}${chip('base','Sélection de base',baseCount,'is-base')}${chip('library','Bibliothèque complémentaire',libraryCount,'is-library')}${chip('archived','Archivées',archives.length,'is-archived')}${chip('deleted','Supprimées',deleted.length,'is-deleted')}</div><div data-inline-new-situation="${ch.id}"></div><div class="admin-library-filtered-list">${visible.length?visible.map(si=>situationAccordion(ch,si,filter==='archived',filter==='deleted')).join(''):`<p class="admin-library-empty-line">${filter==='base'?'Aucune situation dans la sélection de base.':filter==='library'?'Aucune situation complémentaire.':filter==='archived'?'Aucune situation archivée.':filter==='deleted'?'Aucune situation supprimée.':'Aucune situation dans ce chapitre.'}</p>`}</div></div></div>`:''}</section>`;
  }
  function situationAccordion(ch,si,isArchived=false,isDeleted=false){
    const answers=si.answers||[];
    const readonly=isArchived||isDeleted;
    const typeTag=si.is_default?'<span class="admin-library-type-tag is-base">Sélection de base</span>':'<span class="admin-library-type-tag is-library">Bibliothèque complémentaire</span>';
    const statusTag=isArchived?'<span class="admin-library-type-tag is-archived">Archivée</span>':isDeleted?'<span class="admin-library-type-tag is-deleted">Supprimée</span>':'';
    return `<details class="admin-library-situation-row ${isArchived?'is-archived':''} ${isDeleted?'is-deleted':''}" data-situation-details="${si.id}"><summary><div class="admin-library-situation-summary"><p>${esc(si.content)}</p><div class="admin-library-situation-meta"><span>${answers.length} réponse${answers.length>1?'s':''}</span>${typeTag}${statusTag}</div></div><span class="admin-library-summary-action">${readonly?'Consulter':'Voir / modifier'} <span class="admin-library-situation-chevron" aria-hidden="true">⌄</span></span></summary><form class="admin-library-inline-form admin-library-situation-form" data-situation-inline-form="${si.id}" data-chapter-id="${ch.id}"><section class="admin-library-editor-section admin-library-editor-situation"><div class="admin-library-editor-section-title"><span class="admin-library-editor-icon">✎</span><div><h4>Situation</h4><p>${isArchived?'Cette situation est archivée et n’est plus proposée dans les nouvelles campagnes.':isDeleted?'Cette situation est dans les supprimées. Vous pouvez la restaurer ou la supprimer définitivement.':'Modifiez son contenu ou son emplacement dans le catalogue.'}</p></div></div><label class="admin-library-wide-label admin-library-content-field"><span>Texte de la situation</span><textarea data-inline-situation-content rows="3" required ${readonly?'disabled':''}>${esc(si.content||'')}</textarea></label><div class="admin-library-inline-toggles"><label><input data-inline-situation-default type="checkbox" ${si.is_default?'checked':''} ${readonly?'disabled':''}> Inclure dans la sélection de base du thème</label></div></section><section class="admin-library-editor-section admin-library-editor-answers"><div class="admin-library-answer-head"><div class="admin-library-editor-section-title"><span class="admin-library-editor-icon">✓</span><div><h4>Réponses et scoring</h4><p>Le score reste administré par Me&amp;YouToo.</p></div></div>${readonly?'':'<button class="button button-secondary button-small" type="button" data-add-inline-answer>+ Ajouter une réponse</button>'}</div><div class="admin-library-answer-list" data-inline-answer-list>${answers.map((answer,index)=>answerInlineRow(answer,index,readonly)).join('')}</div></section><div class="admin-library-inline-actions admin-library-content-actions">${isArchived?`<button class="button button-secondary" type="button" data-restore-situation="${si.id}">Restaurer</button><button class="button button-danger-soft" type="button" data-delete-situation="${si.id}">Déplacer dans les supprimées</button>`:isDeleted?`<button class="button button-secondary" type="button" data-undelete-situation="${si.id}">Restaurer</button><button class="button button-danger-soft" type="button" data-delete-situation-permanent="${si.id}">Supprimer définitivement</button>`:`<button class="button button-danger-soft" type="button" data-archive-situation="${si.id}">Archiver</button><button class="button button-danger-soft admin-library-delete-button" type="button" data-delete-situation="${si.id}">Supprimer</button><span class="admin-library-action-spacer"></span><button class="button button-secondary" type="button" data-cancel-inline>Annuler</button><button class="button button-primary" type="submit">Enregistrer la situation</button>`}</div></form></details>`;
  }
  function answerInlineRow(answer={},index=0,readonly=false){return `<div class="admin-library-answer-row"><span class="admin-library-answer-number">${Number(index)+1}</span><label class="admin-library-answer-content"><span>Réponse</span><input data-answer-content placeholder="Texte de la réponse" value="${esc(answer.content||'')}" required ${readonly?'disabled':''}></label><label class="admin-library-answer-score"><span>Score</span><input data-answer-score type="number" step="0.01" value="${answer.score??''}" required ${readonly?'disabled':''}></label><label class="admin-library-best-answer" title="Réponse attendue / la plus inclusive"><input data-answer-best type="checkbox" ${answer.is_best?'checked':''} ${readonly?'disabled':''}><span>Meilleure réponse</span></label>${readonly?'':`<button type="button" class="admin-library-answer-remove" data-remove-inline-answer aria-label="Supprimer la réponse">×</button>`}</div>`;}
  function profileInlineRow(ch,profile={},index=0){
    const profileMedia=(ch.media||[]).filter(m=>m.placement==='profile_result');
    const commonMedia=profileMedia.find(m=>m.profile_position===null||m.profile_position===undefined)||profileMedia[0]||null;
    const effectiveMedia=commonMedia;
    const color=esc(profile.color||'#dce6ec');
    return `<article class="admin-library-profile-inline-card admin-profile-card-v2"><details><summary>
      <div class="admin-library-profile-summary">
        <span class="admin-library-profile-index">Profil ${index+1}</span>
        <div class="admin-profile-summary-copy">
          <strong>${esc(profile.title||'Profil à renseigner')}</strong>
          <small>${profile.content?'Restitution renseignée':'Restitution à compléter'} · ${profile.scoring_min??'—'} à ${profile.scoring_max??'—'}${effectiveMedia?' · 🎬 '+esc(effectiveMedia.title):''}</small>
        </div>
      </div>
      <span class="admin-library-profile-summary-right">
        <span class="admin-library-profile-color" style="--profile-color:${color}"></span>
        <span class="admin-library-summary-action">Voir / modifier <span class="admin-library-profile-chevron" aria-hidden="true">⌄</span></span>
      </span>
    </summary>
    <div class="admin-library-profile-inline-body admin-profile-editor-v2">

      <section class="admin-profile-editor-card admin-profile-identity-card">
        <div class="admin-profile-editor-card-head">
          <span class="admin-profile-editor-card-icon">◎</span>
          <div><h4>Identité du profil</h4><p>Le libellé et la couleur visibles dans la restitution répondant.</p></div>
        </div>
        <div class="admin-profile-identity-fields">
          <label><span>Titre du profil</span><input data-profile-title value="${esc(profile.title||'')}" required></label>
          <label class="admin-profile-color-field"><span>Couleur</span><div class="admin-profile-color-input"><i style="--profile-current-color:${color}"></i><input data-profile-color value="${color}" placeholder="#0d4c72"></div></label>
        </div>
      </section>

      <section class="admin-profile-editor-card admin-profile-copy-card">
        <div class="admin-profile-editor-card-head">
          <span class="admin-profile-editor-card-icon">✎</span>
          <div><h4>Restitution répondant</h4><p>Rédigez le contenu principal puis le résumé qui présente ce profil.</p></div>
        </div>
        <div class="admin-profile-copy-fields">
          <label class="admin-profile-main-copy"><span>Texte détaillé</span><textarea data-profile-content rows="6" required>${esc(profile.content||'')}</textarea></label>
          <label class="admin-profile-summary-copy"><span>Résumé</span><textarea data-profile-summary rows="3">${esc(profile.summary||'')}</textarea></label>
        </div>
      </section>

      <section class="admin-profile-editor-card admin-profile-score-card">
        <div class="admin-profile-editor-card-head">
          <span class="admin-profile-editor-card-icon">#</span>
          <div><h4>Plage de scoring</h4><p>Définissez les seuils qui orientent le répondant vers ce profil.</p></div>
        </div>
        <div class="admin-profile-score-pills">
          <label><span>Minimum</span><input data-profile-min type="number" step="0.01" value="${profile.scoring_min??''}"></label>
          <span class="admin-profile-score-arrow">→</span>
          <label><span>Maximum</span><input data-profile-max type="number" step="0.01" value="${profile.scoring_max??''}"></label>
          <label class="admin-profile-top-score"><span>Score plafond</span><input data-profile-top type="number" step="0.01" value="${profile.top_score??''}"></label>
        </div>
      </section>

      <section class="admin-profile-editor-card admin-library-profile-video admin-profile-video-card">
        <div class="admin-profile-editor-card-head">
          <span class="admin-profile-editor-card-icon">▶</span>
          <div><h4>Vidéo de restitution <span class="admin-library-optional">facultatif</span></h4><p>Une vidéo choisie ici est automatiquement appliquée aux trois profils de ce chapitre.</p></div>
        </div>
        <input type="hidden" data-profile-video-id value="${effectiveMedia?.id||''}">
        <label class="admin-library-video-select admin-profile-video-select"><span>Vidéo associée</span><select data-profile-video-library>${mediaLibraryOptions(effectiveMedia?.video_id||'')}</select></label>
        ${effectiveMedia?`<span class="admin-library-video-present">🎬 ${esc(effectiveMedia.title)} · appliquée aux 3 profils</span>`:'<small class="admin-library-video-help">Aucune vidéo associée à ce chapitre.</small>'}
      </section>

    </div></details></article>`;
  }
  function mediaPlacementLabel(media){if(media.placement==='after_chapter')return'Après le chapitre';if(media.profile_position===null||media.profile_position===undefined)return'Dans tous les profils';return`Dans le profil ${Number(media.profile_position)+1}`;}
  function mediaInlineRow(ch,media={}){return `<article class="admin-library-media-card"><div class="admin-library-media-card-head"><div><strong>${esc(media.title||'Vidéo')}</strong><span class="admin-library-media-tag">${esc(mediaPlacementLabel(media))}</span></div><button type="button" class="button button-ghost button-small" data-edit-media="${media.id}">Modifier</button></div><form class="admin-library-media-form" data-media-form="${media.id}" hidden><input type="hidden" data-media-placement value="${esc(media.placement||'after_chapter')}"><div class="admin-library-media-grid"><label>Vidéo de la médiathèque<select data-media-video-id required>${mediaLibraryOptions(media.video_id||'')}</select></label><label class="admin-library-media-active"><input data-media-active type="checkbox" ${media.active!==false?'checked':''}> Association active</label></div><div class="admin-library-inline-actions"><button type="button" class="button button-danger-soft" data-delete-media="${media.id}">Retirer du chapitre</button><span class="admin-library-action-spacer"></span><button type="button" class="button button-secondary" data-cancel-media>Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form></article>`;}
  function newMediaForm(chapterId){return `<form class="admin-library-media-form admin-library-media-new" data-new-media-form="${chapterId}"><div class="admin-library-new-badge">Vidéo après le chapitre</div><input type="hidden" data-media-placement value="after_chapter"><div class="admin-library-media-grid"><label>Choisir dans la médiathèque<select data-media-video-id required>${mediaLibraryOptions()}</select><small>Ajoutez d’abord la vidéo dans la Médiathèque si elle n’existe pas encore.</small></label><label class="admin-library-media-active"><input data-media-active type="checkbox" checked> Association active</label></div><div class="admin-library-inline-actions"><button type="button" class="button button-secondary" data-cancel-media>Annuler</button><button type="submit" class="button button-primary">Associer la vidéo</button></div></form>`;}
  function mediaPayload(form){return{videoId:form.querySelector('[data-media-video-id]').value,placement:form.querySelector('[data-media-placement]').value,profilePosition:null,active:form.querySelector('[data-media-active]').checked};}
  function bindMediaForm(form){}
  function openThemeDialog(theme=null){const d=$('#library-theme-dialog'),f=$('#library-theme-form');f.reset();$('#library-theme-id').value=theme?.id||'';$('#library-theme-title').value=theme?.title||'';$('#library-theme-description').value=theme?.description||'';$('#library-theme-base-title').value=theme?.base_title||theme?.title||'';$('#library-theme-respondent-title').value=theme?.respondent_title_default||theme?.title||'';$('#library-theme-introduction').value=theme?.introduction_html||'';$('#library-theme-result-title').value=theme?.result_title||'';$('#library-theme-result-sentence').value=theme?.result_sentence||'';$('#library-theme-active').checked=Boolean(theme?.active);d.querySelector('h2').textContent=theme?'Modifier la thématique':'Créer une thématique';d.showModal();}
  function openChapterDialog(themeId,chapter=null){const d=$('#library-chapter-dialog'),f=$('#library-chapter-form');f.reset();$('#library-chapter-id').value=chapter?.id||'';$('#library-chapter-theme-id').value=themeId||'';$('#library-chapter-title').value=chapter?.title||'';$('#library-chapter-locked').checked=Boolean(chapter?.locked);$('#library-chapter-lock-reason').value=chapter?.lock_reason||'';d.querySelector('h2').textContent=chapter?'Modifier le chapitre':'Ajouter un chapitre';d.showModal();}
  function newSituationForm(chapterId){return `<form class="admin-library-inline-form admin-library-situation-form admin-library-new-situation" data-new-situation-form="${chapterId}"><div class="admin-library-new-badge">Nouvelle situation</div><section class="admin-library-editor-section admin-library-editor-situation"><div class="admin-library-editor-section-title"><span class="admin-library-editor-icon">✎</span><div><h4>Situation</h4><p>Créez le contenu puis choisissez où il sera proposé.</p></div></div><label class="admin-library-wide-label admin-library-content-field"><span>Texte de la situation</span><textarea data-inline-situation-content rows="3" required placeholder="Saisir le texte de la situation"></textarea></label><div class="admin-library-inline-toggles"><label><input data-inline-situation-default type="checkbox"> Inclure dans la sélection de base du thème</label></div></section><section class="admin-library-editor-section admin-library-editor-answers"><div class="admin-library-answer-head"><div class="admin-library-editor-section-title"><span class="admin-library-editor-icon">✓</span><div><h4>Réponses et scoring</h4><p>Ajoutez les réponses proposées au répondant et leur score.</p></div></div><button class="button button-secondary button-small" type="button" data-add-inline-answer>+ Ajouter une réponse</button></div><div class="admin-library-answer-list" data-inline-answer-list>${answerInlineRow({score:0},0)}${answerInlineRow({score:1},1)}${answerInlineRow({score:2},2)}</div></section><div class="admin-library-inline-actions"><button class="button button-secondary" type="button" data-cancel-new-situation>Annuler</button><button class="button button-primary" type="submit">Créer la situation</button></div></form>`;}
  function renumberInlineAnswers(list){[...list.querySelectorAll('.admin-library-answer-number')].forEach((el,index)=>el.textContent=String(index+1));}
  function minimumAnswersForList(list){return list.closest('[data-new-situation-form]')?3:2;}
  function addInlineAnswer(list){const wrap=document.createElement('div');wrap.innerHTML=answerInlineRow({},list.children.length);const row=wrap.firstElementChild;row.querySelector('[data-remove-inline-answer]').onclick=()=>{if(list.children.length>minimumAnswersForList(list)){row.remove();renumberInlineAnswers(list);}};list.appendChild(row);renumberInlineAnswers(list);}
  function collectSituationForm(form){const answers=[...form.querySelectorAll('.admin-library-answer-row')].map(row=>({content:row.querySelector('[data-answer-content]').value.trim(),score:Number(row.querySelector('[data-answer-score]').value),isBest:row.querySelector('[data-answer-best]').checked}));return{content:form.querySelector('[data-inline-situation-content]').value.trim(),isDefault:form.querySelector('[data-inline-situation-default]').checked,answers};}
  function bindInlineForm(form){
    form.querySelectorAll('[data-remove-inline-answer]').forEach(b=>b.onclick=()=>{const list=b.closest('[data-inline-answer-list]');if(list.children.length>minimumAnswersForList(list)){b.closest('.admin-library-answer-row').remove();renumberInlineAnswers(list);}});
    const add=form.querySelector('[data-add-inline-answer]');if(add)add.onclick=()=>addInlineAnswer(form.querySelector('[data-inline-answer-list]'));
  }
  function bindLibraryActions(){
    $$('[data-open-library-theme]').forEach(card=>{const open=()=>{state.libraryThemeId=card.dataset.openLibraryTheme;state.libraryExpandedChapters=new Set();renderLibraryAdmin();};card.onclick=open;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
    const back=$('[data-library-back]');if(back)back.onclick=()=>{state.libraryThemeId=null;state.libraryExpandedChapters=new Set();renderLibraryAdmin();};
    $$('[data-edit-theme]').forEach(b=>b.onclick=e=>{e.stopPropagation();openThemeDialog(findTheme(b.dataset.editTheme));});
    $$('[data-add-chapter]').forEach(b=>b.onclick=e=>{e.stopPropagation();openChapterDialog(b.dataset.addChapter);});
    $$('[data-edit-chapter]').forEach(b=>b.onclick=e=>{e.stopPropagation();const ch=findChapter(b.dataset.editChapter);openChapterDialog(state.libraryThemeId,ch);});
    $$('[data-toggle-library-chapter]').forEach(head=>{const toggle=()=>{const id=String(head.dataset.toggleLibraryChapter);state.libraryExpandedChapters.has(id)?state.libraryExpandedChapters.delete(id):state.libraryExpandedChapters.add(id);renderLibraryAdmin();};head.onclick=e=>{if(e.target.closest('button'))return;toggle();};head.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();toggle();}};});
    $$('[data-library-situation-filter]').forEach(b=>b.onclick=e=>{e.stopPropagation();state.librarySituationFilters.set(String(b.dataset.chapterId),b.dataset.librarySituationFilter||'all');state.libraryExpandedChapters.add(String(b.dataset.chapterId));renderLibraryAdmin();});
    $$('[data-add-inline-situation]').forEach(b=>b.onclick=e=>{e.stopPropagation();const chapterId=String(b.dataset.addInlineSituation);state.libraryExpandedChapters.add(chapterId);renderLibraryAdmin();const slot=document.querySelector(`[data-inline-new-situation="${chapterId}"]`);if(!slot)return;slot.innerHTML=newSituationForm(chapterId);const form=slot.querySelector('form');bindInlineForm(form);form.querySelector('[data-cancel-new-situation]').onclick=()=>slot.innerHTML='';form.onsubmit=async ev=>{ev.preventDefault();if(!form.reportValidity())return;try{await StudioAPI.request('/api/admin/catalog/chapters/'+chapterId+'/situations',{method:'POST',body:JSON.stringify(collectSituationForm(form))});await refreshLibrary();state.libraryThemeId=String(findChapter(chapterId)?.theme_id||state.libraryThemeId);state.libraryExpandedChapters.add(chapterId);renderLibraryAdmin();}catch(error){showError(error.message);}};setTimeout(()=>form.querySelector('textarea')?.focus(),0);});
    $$('[data-add-media]').forEach(b=>b.onclick=e=>{e.stopPropagation();const chapterId=String(b.dataset.addMedia),slot=document.querySelector(`[data-new-media-slot="${chapterId}"]`);if(!slot)return;slot.innerHTML=newMediaForm(chapterId);const form=slot.querySelector('form');bindMediaForm(form);form.querySelector('[data-cancel-media]').onclick=()=>slot.innerHTML='';form.onsubmit=async ev=>{ev.preventDefault();if(!form.reportValidity())return;try{await StudioAPI.request('/api/admin/catalog/chapters/'+chapterId+'/media',{method:'POST',body:JSON.stringify(mediaPayload(form))});await refreshLibrary();state.libraryExpandedChapters.add(chapterId);renderLibraryAdmin();}catch(error){showError(error.message);}};});
    $$('[data-edit-media]').forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      const card=b.closest('.admin-library-media-card'),form=card?.querySelector('[data-media-form]');
      if(!form)return;
      form.hidden=!form.hidden;
      if(form.hidden)return;
      bindMediaForm(form);
      form.querySelector('[data-cancel-media]').onclick=()=>form.hidden=true;
      form.onsubmit=async ev=>{
        ev.preventDefault();
        if(!form.reportValidity())return;
        try{
          await StudioAPI.request('/api/admin/catalog/media/'+form.dataset.mediaForm,{method:'PATCH',body:JSON.stringify(mediaPayload(form))});
          await refreshLibrary();
          renderLibraryAdmin();
        }catch(error){showError(error.message);}
      };
      const del=form.querySelector('[data-delete-media]');
      if(del)del.onclick=async()=>{
        if(!confirm('Supprimer cette vidéo du catalogue ?'))return;
        try{
          await StudioAPI.request('/api/admin/catalog/media/'+del.dataset.deleteMedia,{method:'DELETE'});
          await refreshLibrary();
          renderLibraryAdmin();
        }catch(error){showError(error.message);}
      };
    });
    $$('[data-situation-inline-form]').forEach(form=>{bindInlineForm(form);const cancel=form.querySelector('[data-cancel-inline]');if(cancel)cancel.onclick=()=>{const d=form.closest('details');if(d)d.open=false;};form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;try{await StudioAPI.request('/api/admin/catalog/situations/'+form.dataset.situationInlineForm,{method:'PATCH',body:JSON.stringify(collectSituationForm(form))});const chapterId=String(form.dataset.chapterId);await refreshLibrary();state.libraryExpandedChapters.add(chapterId);renderLibraryAdmin();}catch(error){showError(error.message);}};});
    $$('[data-archive-situation]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const si=findSituation(b.dataset.archiveSituation);if(!confirm(`Archiver cette situation ?\n\n« ${si?.content||'Cette situation'} »\n\nElle ne sera plus proposée dans les nouvelles campagnes. Les campagnes existantes ne seront pas modifiées.`))return;try{await StudioAPI.request('/api/admin/catalog/situations/'+b.dataset.archiveSituation+'/archive',{method:'POST'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-restore-situation]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();try{await StudioAPI.request('/api/admin/catalog/situations/'+b.dataset.restoreSituation+'/restore',{method:'POST'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-delete-situation]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const si=findSituation(b.dataset.deleteSituation);if(!confirm(`Déplacer cette situation dans les supprimées ?\n\n« ${si?.content||'Cette situation'} »\n\nElle ne sera plus proposée dans les nouvelles campagnes et pourra être restaurée depuis le filtre « Supprimées ».`))return;try{await StudioAPI.request('/api/admin/catalog/situations/'+b.dataset.deleteSituation,{method:'DELETE'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-undelete-situation]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();try{await StudioAPI.request('/api/admin/catalog/situations/'+b.dataset.undeleteSituation+'/undelete',{method:'POST'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-delete-situation-permanent]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const si=findSituation(b.dataset.deleteSituationPermanent);if(!confirm(`Supprimer DÉFINITIVEMENT cette situation ?\n\n« ${si?.content||'Cette situation'} »\n\nCette action est irréversible. Si la situation a déjà été utilisée dans une campagne, le Studio refusera la suppression définitive.`))return;try{await StudioAPI.request('/api/admin/catalog/situations/'+b.dataset.deleteSituationPermanent+'/permanent',{method:'DELETE'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-profile-inline-form]').forEach(form=>{bindProfileVideoSync(form);form.querySelector('[data-cancel-inline]').onclick=()=>{const d=form.closest('details');if(d)d.open=false;};form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;const chapterId=form.dataset.profileInlineForm,rows=[...form.querySelectorAll('.admin-library-profile-inline-card')],profiles=rows.map(row=>({title:row.querySelector('[data-profile-title]').value.trim(),content:row.querySelector('[data-profile-content]').value.trim(),summary:row.querySelector('[data-profile-summary]').value.trim(),scoringMin:row.querySelector('[data-profile-min]').value,scoringMax:row.querySelector('[data-profile-max]').value,topScore:row.querySelector('[data-profile-top]').value,color:row.querySelector('[data-profile-color]').value.trim()}));try{await StudioAPI.request('/api/admin/catalog/chapters/'+chapterId+'/profiles',{method:'PUT',body:JSON.stringify({profiles})});await syncChapterProfileVideo(chapterId,form);await refreshLibrary();state.libraryExpandedChapters.add(String(chapterId));renderLibraryAdmin();}catch(error){showError(error.message);}};});
  }
  function bindProfileVideoSync(form){
    const selects=[...form.querySelectorAll('[data-profile-video-library]')];
    selects.forEach(select=>select.onchange=()=>{
      const value=select.value;
      selects.forEach(other=>other.value=value);
      form.querySelectorAll('.admin-library-video-present').forEach(el=>el.remove());
      form.querySelectorAll('.admin-library-video-help').forEach(el=>{
        el.textContent=value?'Cette vidéo sera affichée quel que soit le profil obtenu.':'Aucune vidéo associée à ce chapitre.';
      });
    });
  }
  async function syncChapterProfileVideo(chapterId,form){
    const videoId=form.querySelector('[data-profile-video-library]')?.value||'';
    await StudioAPI.request('/api/admin/catalog/chapters/'+chapterId+'/profile-video',{
      method:'PUT',
      body:JSON.stringify({videoId:videoId||null})
    });
  }
  async function refreshLibrary(){state.catalogLoaded=false;await loadLibraryAdmin();}
  function addContact(){const i=contactsRoot.children.length+1,card=document.createElement('article');card.className='admin-contact-card';card.innerHTML=`<div class="admin-contact-head"><strong>Personne ${i}</strong><button type="button" class="admin-contact-remove">Supprimer</button></div><div class="admin-contact-grid"><label>Prénom<input data-contact="firstName" required></label><label>Nom<input data-contact="lastName" required></label><label>Fonction<input data-contact="jobTitle" required></label><label>Téléphone <span class="hint">(facultatif)</span><input data-contact="phone" type="tel"></label><label>Email professionnel<input data-contact="email" type="email" required></label></div><p class="admin-invitation-note">✉️ Cette personne recevra un lien personnel.</p>`;card.querySelector('button').onclick=()=>{if(contactsRoot.children.length>1)card.remove();};contactsRoot.appendChild(card);}
  const selectedSectors=()=>[$('#org-sector').value].filter(Boolean),contactsPayload=()=>$$('.admin-contact-card').map(card=>{const value=n=>card.querySelector(`[data-contact="${n}"]`).value.trim();return{firstName:value('firstName'),lastName:value('lastName'),jobTitle:value('jobTitle'),phone:value('phone'),email:value('email')};}),selectedQuota=()=>$('#org-credit-pack').value==='custom'?Math.max(0,Number($('#org-quota').value)||0):Number($('#org-credit-pack').value)||0;
  function syncQuota(){const custom=$('#org-credit-pack').value==='custom';$('#org-custom-credit-wrap').hidden=!custom;$('#org-quota').required=custom;}
  function openNewOrganization(){ $('#org-form').reset();contactsRoot.innerHTML='';addContact();syncQuota();const manager=$('#org-account-manager');if(manager)manager.innerHTML=accountManagerOptions('');orgDialog.showModal(); }
  $('#refresh-admin').onclick=load;$('#new-org').onclick=openNewOrganization;const newOrgAccounts=$('#new-org-accounts');if(newOrgAccounts)newOrgAccounts.onclick=openNewOrganization;$('#add-org-contact').onclick=addContact;$('#org-credit-pack').onchange=syncQuota;$('#new-admin-user').onclick=()=>openAdminForm();$$('[data-close-dialog]').forEach(b=>b.onclick=()=>$('#'+b.dataset.closeDialog).close());[orgDialog,userDialog,adminUserDialog].forEach(d=>d.onclick=e=>{if(e.target===d)d.close();});
  $('#create-org').onclick=async e=>{e.preventDefault();if(!$('#org-form').reportValidity())return;const selected=selectedSectors();if(!selected.length)return;try{await StudioAPI.request('/api/admin/organizations',{method:'POST',body:JSON.stringify({name:$('#org-name').value.trim(),sectors:selected,contacts:contactsPayload(),passationsQuota:selectedQuota(),packExpiresAt:$('#org-expiry').value||null,accountManagerUserId:$('#org-account-manager')?.value||null})});orgDialog.close();load();}catch(error){showError(error.message);}};
  $('#create-user').onclick=async e=>{e.preventDefault();const f=$('#user-form');if(!f.reportValidity())return;const id=f.dataset.editId,payload={organizationId:$('#user-org-id').value,firstName:$('#user-first').value.trim(),lastName:$('#user-last').value.trim(),jobTitle:$('#user-job-title').value.trim(),phone:$('#user-phone').value.trim(),email:$('#user-email').value.trim()};try{await StudioAPI.request(id?'/api/admin/client-users/'+id:'/api/admin/users',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});userDialog.close();load();}catch(error){showError(error.message);}};
  $('#create-admin-user').onclick=async e=>{e.preventDefault();const f=$('#admin-user-form');if(!f.reportValidity())return;const id=f.dataset.editId,payload={firstName:$('#admin-user-first').value.trim(),lastName:$('#admin-user-last').value.trim(),jobTitle:$('#admin-user-job').value.trim(),phone:$('#admin-user-phone').value.trim(),email:$('#admin-user-email').value.trim()};try{await StudioAPI.request('/api/admin/administrators'+(id?'/'+id:''),{method:id?'PATCH':'POST',body:JSON.stringify(payload)});adminUserDialog.close();load();}catch(error){showError(error.message);}};
  ['org-search','org-sector-filter','org-theme-filter','org-sort'].forEach(id=>$('#'+id).addEventListener(id==='org-search'?'input':'change',()=>{renderChips();renderOrganizations();}));['campaign-search','campaign-status'].forEach(id=>$('#'+id).addEventListener(id==='campaign-search'?'input':'change',renderCampaigns));['account-search','account-status'].forEach(id=>$('#'+id).addEventListener(id==='account-search'?'input':'change',renderAccounts));$('#activity-search').oninput=renderActivity;
  const newLibraryTheme=$('#new-library-theme');if(newLibraryTheme)newLibraryTheme.onclick=()=>openThemeDialog();
  const newMediaLibrary=$('#new-media-library');if(newMediaLibrary)newMediaLibrary.onclick=()=>openMediaLibraryForm();
  const mediaLibrarySearch=$('#media-library-search');if(mediaLibrarySearch)mediaLibrarySearch.oninput=renderMediaLibrary;
  const mediaLibraryStatus=$('#media-library-status');if(mediaLibraryStatus)mediaLibraryStatus.onchange=renderMediaLibrary;const mediaLibraryTheme=$('#media-library-theme');if(mediaLibraryTheme)mediaLibraryTheme.onchange=renderMediaLibrary;const mediaLibraryTag=$('#media-library-tag');if(mediaLibraryTag)mediaLibraryTag.onchange=renderMediaLibrary;
  const themeForm=$('#library-theme-form');if(themeForm)themeForm.onsubmit=async e=>{e.preventDefault();if(!themeForm.reportValidity())return;const id=$('#library-theme-id').value,payload={title:$('#library-theme-title').value.trim(),description:$('#library-theme-description').value.trim(),baseTitle:$('#library-theme-base-title').value.trim(),respondentTitle:$('#library-theme-respondent-title').value.trim(),introductionHtml:$('#library-theme-introduction').value.trim(),resultTitle:$('#library-theme-result-title').value.trim(),resultSentence:$('#library-theme-result-sentence').value.trim(),active:$('#library-theme-active').checked};try{await StudioAPI.request(id?'/api/admin/catalog/themes/'+id:'/api/admin/catalog/themes',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});$('#library-theme-dialog').close();await refreshLibrary();}catch(error){showError(error.message);}};
  const chapterForm=$('#library-chapter-form');if(chapterForm)chapterForm.onsubmit=async e=>{e.preventDefault();if(!chapterForm.reportValidity())return;const id=$('#library-chapter-id').value,themeId=$('#library-chapter-theme-id').value,payload={title:$('#library-chapter-title').value.trim(),locked:$('#library-chapter-locked').checked,lockReason:$('#library-chapter-lock-reason').value.trim()};try{await StudioAPI.request(id?'/api/admin/catalog/chapters/'+id:'/api/admin/catalog/themes/'+themeId+'/chapters',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});$('#library-chapter-dialog').close();await refreshLibrary();}catch(error){showError(error.message);}};
  bindNavigation();
  const migrationBtn=$('#new-migration-batch');if(migrationBtn)migrationBtn.onclick=openMigrationDialog;
  const migrationScope=$('#migration-scope');if(migrationScope)migrationScope.onchange=()=>{$('#migration-org-wrap').hidden=migrationScope.value!=='client';};
  const migrationSourceJson=$('#migration-source-json');if(migrationSourceJson)migrationSourceJson.onchange=async()=>{const file=migrationSourceJson.files?.[0],status=$('#migration-source-json-status');migrationSourceJson._migrationData=null;if(!file){if(status){status.textContent='Sélectionne le JSON historique : Studio préremplit le survey, l’ID client historique et le nom du lot.';status.classList.remove('is-success','is-error');}return;}try{const json=JSON.parse(await file.text()),data=migrationJsonData(json);if(!data.entities.length)throw new Error('Aucune entité de migration détectée');migrationSourceJson._migrationData={...data,fileName:file.name};if(data.sourceSurveyId)$('#migration-source-survey-id').value=data.sourceSurveyId;if(data.sourceCustomerId)$('#migration-source-id').value=data.sourceCustomerId;if(data.lotName)$('#migration-source-name').value=data.lotName;if(status){status.innerHTML=`Prérempli depuis <strong>${esc(file.name)}</strong> : survey ${data.sourceSurveyId?'#'+esc(data.sourceSurveyId):'non renseigné'}${data.sourceCustomerId?' · client historique #'+esc(data.sourceCustomerId):''}${data.sourceCustomerName?' · '+esc(data.sourceCustomerName):''}.`;status.classList.remove('is-error');status.classList.add('is-success');}}catch(err){if(status){status.textContent='JSON invalide : '+err.message;status.classList.remove('is-success');status.classList.add('is-error');}}};
  const migrationForm=$('#migration-form');if(migrationForm)migrationForm.onsubmit=async e=>{e.preventDefault();try{const scope=$('#migration-scope').value,organizationId=scope==='client'?$('#migration-org').value:null,preloaded=$('#migration-source-json')?._migrationData||null;const created=await StudioAPI.request('/api/admin/migrations',{method:'POST',body:JSON.stringify({scope,organizationId,sourceCustomerName:$('#migration-source-name').value.trim(),sourceCustomerId:$('#migration-source-id').value.trim(),sourceSurveyId:$('#migration-source-survey-id').value.trim()})});$('#migration-dialog').close();state.migrationsLoaded=false;await loadMigrations();if(preloaded?.entities?.length&&created?.batch?.id)openDryRunDialog(created.batch.id,preloaded);}catch(err){showError(err.message);}};
  const dryRunFile=$('#migration-dryrun-file');if(dryRunFile)dryRunFile.onchange=async()=>{const file=dryRunFile.files?.[0];$('#run-migration-dryrun').disabled=true;if(!file){dryRunFile._entities=[];dryRunFile._meta={};$('#migration-dryrun-preview').innerHTML='<p class="hint">Sélectionne un fichier JSON.</p>';return;}try{const json=JSON.parse(await file.text()),data=migrationJsonData(json);dryRunFile._entities=data.entities;dryRunFile._meta=data.meta;migrationDryRunPreview(dryRunFile,$('#migration-dryrun-dialog').dataset.batchId,file.name);}catch(e){dryRunFile._entities=[];dryRunFile._meta={};$('#migration-dryrun-preview').innerHTML='<div class="composer-alert">Fichier JSON invalide : '+esc(e.message)+'</div>';}};
  const runDry=$('#run-migration-dryrun');if(runDry)runDry.onclick=async()=>{const d=$('#migration-dryrun-dialog'),entities=$('#migration-dryrun-file')._entities||[];if(!entities.length)return;runDry.disabled=true;try{const r=await StudioAPI.request('/api/admin/migrations/'+d.dataset.batchId+'/dry-run',{method:'POST',body:JSON.stringify({entities})});d.close();await StudioModal.alert({title:'Dry-run terminé',message:`${fmt(r.validation?.accepted)} éléments analysés. Aucune donnée du catalogue n’a été modifiée.`,confirmLabel:'Continuer'});state.migrationsLoaded=false;loadMigrations();}catch(e){showError(e.message);}finally{runDry.disabled=false;}};
  load();
})();