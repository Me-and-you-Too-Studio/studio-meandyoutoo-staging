(function(){
  if(!StudioAPI.requireAuth('admin'))return;
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const organizationLogoSrc=o=>{const raw=o?.logo_url||o?.logo_data||'';return raw&&raw.startsWith('/')?StudioAPI.base()+raw:raw;};
  const fmt=v=>Number(v||0).toLocaleString('fr-FR'),date=v=>v?new Date(v).toLocaleDateString('fr-FR'):'—',dateTime=v=>v?new Date(v).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Jamais';
  const labels={draft:'Brouillon',configuration_submitted:'À relire',review_pending:'À relire',in_review:'En relecture',client_validation_required:'Validation client requise',ready_to_publish:'Prête à publier',scheduled:'Programmée',published:'Publiée',active:'En cours',completed:'Terminée',unpublished:'Dépubliée'},pages={'accueil.html':'Accueil','composer.html':'Questions','personnalisation.html':'Profils','parametrage.html':'Paramétrage','validation.html':'Validation','mes-campagnes.html':'Mes campagnes','campagne-detail.html':'Détail campagne','account.html':'Mon compte','packs.html':'Commander des passations'};
  const state={organizations:[],activity:[],administrators:[],currentUserId:null,orgFilter:'all',clientFolderFilter:'all',clientFolders:[],clientUsers:new Map(),adminUsers:new Map(),catalogThemes:[],catalogLoaded:false,mediaLibrary:[],mediaThemes:[],mediaLibraryLoaded:false,migrationsLoaded:false,migrationBatches:[],promotionRequests:[],libraryThemeId:null,libraryExpandedChapters:new Set(),librarySituationFilters:new Map(),libraryGlobalPickerChapterId:null,libraryGlobalPickerQuery:'',libraryGlobalPickerThemeId:'',libraryGlobalPickerSourceChapterId:'',libraryGlobalPickerPlacement:'base',libraryGlobalPickerSourcePlacement:'base',expandedClientCards:new Set(),selectedOrgIds:new Set(),adminComments:[],campaignQuickFilter:'all'};
  const orgDialog=$('#org-dialog'),userDialog=$('#user-dialog'),adminUserDialog=$('#admin-user-dialog'),contactsRoot=$('#org-contacts');
  function orgLogoHtml(o,extraClass=''){
    const initial=String(o?.name||'C').slice(0,1).toUpperCase();
    const src=organizationLogoSrc(o);
    return src
      ? `<span class="admin-client-avatar admin-client-logo ${extraClass}"><img src="${esc(src)}" alt="Logo ${esc(o.name||'client')}"></span>`
      : `<span class="admin-client-avatar ${extraClass}">${esc(initial)}</span>`;
  }
  async function optimizeOrganizationLogo(file){
    if(!file)return null;
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type))throw new Error('Choisissez une image PNG, JPG ou WebP.');
    if(file.size>8000000)throw new Error('L’image source est trop volumineuse (8 Mo maximum).');
    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Impossible de lire cette image.'));reader.readAsDataURL(file);});
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Format d’image invalide.'));img.src=dataUrl;});
    const ratio=Math.min(1,900/image.width,420/image.height),w=Math.max(1,Math.round(image.width*ratio)),h=Math.max(1,Math.round(image.height*ratio));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(image,0,0,w,h);
    return canvas.toDataURL('image/webp',.86);
  }
  const orgUsers=o=>Array.isArray(o.users)?o.users:[],orgProjects=o=>Array.isArray(o.projects)?o.projects:[],orgSectors=o=>Array.isArray(o.sectors)&&o.sectors.length?o.sectors:(o.sector?[o.sector]:[]),orgCountryNames={FR:'France',BE:'Belgique',ES:'Espagne',DE:'Allemagne',IT:'Italie',PT:'Portugal',CH:'Suisse',GB:'Royaume-Uni',NL:'Pays-Bas',LU:'Luxembourg',AT:'Autriche',IE:'Irlande',PL:'Pologne',RO:'Roumanie',SE:'Suède',DK:'Danemark',NO:'Norvège',FI:'Finlande',CZ:'Tchéquie',SK:'Slovaquie',BG:'Bulgarie',GR:'Grèce',TR:'Turquie',US:'États-Unis',CA:'Canada',MX:'Mexique',BR:'Brésil',AR:'Argentine',CL:'Chili',UY:'Uruguay',MA:'Maroc',TN:'Tunisie',SN:'Sénégal',CI:'Côte d’Ivoire',ZA:'Afrique du Sud',IN:'Inde',CN:'Chine',HK:'Hong Kong',JP:'Japon',KR:'Corée du Sud',SG:'Singapour',AU:'Australie',AE:'Émirats arabes unis'},orgCountryLabel=code=>orgCountryNames[String(code||'').toUpperCase()]||String(code||'').toUpperCase()||'Non renseigné',orgCountryOptions=selected=>'<option value="">Non renseigné</option>'+Object.entries(orgCountryNames).map(([code,label])=>`<option value="${code}" ${String(selected||'').toUpperCase()===code?'selected':''}>${esc(label)}</option>`).join(''),orgThemes=o=>{const counts=new Map();orgProjects(o).forEach(p=>{const t=String(p.theme_title||'').trim();if(t)counts.set(t,(counts.get(t)||0)+1);});return[...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0]));},remaining=o=>o.pack_unlimited?null:Math.max(0,Number(o.passations_quota||0)-Number(o.passations_used||0));
  const localeNames={fr:'Français',en:'Anglais',es:'Espagnol',de:'Allemand',it:'Italien',pt:'Portugais',br:'Portugais (Brésil)',bg:'Bulgare',ar:'Arabe',ja:'Japonais','ko-kr':'Coréen',ko:'Coréen',zh:'Chinois traditionnel',zf:'Chinois simplifié',nl:'Néerlandais','nl-be':'Néerlandais (Belgique)',pl:'Polonais',ro:'Roumain',ru:'Russe','sv-se':'Suédois',sv:'Suédois',tr:'Turc'};
  const accessLabels={owner:'Responsable du compte',manager:'Gestionnaire de campagnes',contributor:'Contributeur',viewer:'Lecture seule'};
  const clientPermissionLabels={manage_users:'Gérer les comptes et les accès',create_campaigns:'Créer des campagnes',edit_campaigns:'Modifier et renommer les campagnes, et demander des ajustements',organize_folders:'Organiser les campagnes dans des dossiers',submit_campaigns:'Transmettre une configuration à Me&YouToo pour relecture',manage_schedule:'Programmer, prolonger et reprogrammer',manage_kit:'Gérer le kit de communication et le lien de diffusion',view_results:'Voir le lien des résultats et les statistiques',order_passations:'Commander des passations',track_orders:'Suivre les commandes de passations',view_calendar:'Voir le calendrier des campagnes',manage_tasks:'Créer et gérer les tâches',view_dei_cockpit:'Accéder au Cockpit DEI'};
  const clientPermissionPresets={owner:Object.fromEntries(Object.keys(clientPermissionLabels).map(k=>[k,true])),manager:{manage_users:false,create_campaigns:true,edit_campaigns:true,organize_folders:true,submit_campaigns:true,manage_schedule:true,manage_kit:true,view_results:true,order_passations:false,track_orders:true,view_calendar:true,manage_tasks:true,view_dei_cockpit:true},contributor:{manage_users:false,create_campaigns:true,edit_campaigns:true,organize_folders:false,submit_campaigns:true,manage_schedule:false,manage_kit:true,view_results:false,order_passations:false,track_orders:false,view_calendar:true,manage_tasks:true,view_dei_cockpit:true},viewer:{manage_users:false,create_campaigns:false,edit_campaigns:false,organize_folders:false,submit_campaigns:false,manage_schedule:false,manage_kit:false,view_results:false,order_passations:false,track_orders:false,view_calendar:true,manage_tasks:false,view_dei_cockpit:true}};
  function renderAdminClientPermissions(values={}){const root=$('#user-permissions');if(!root)return;const owner=$('#user-access-level')?.value==='owner';root.innerHTML=Object.entries(clientPermissionLabels).map(([key,label])=>`<label><input type="checkbox" data-user-permission="${esc(key)}" ${owner||values[key]?'checked':''} ${owner?'disabled':''}> <span>${esc(label)}</span></label>`).join('');}
  function selectedAdminClientPermissions(){const out={};$$('[data-user-permission]').forEach(input=>out[input.dataset.userPermission]=input.checked);if(out.manage_tasks)out.view_calendar=true;return out;}
  const projectCountryNamesByNumericCode={'004':'Afghanistan','008':'Albanie','012':'Algérie','020':'Andorre','024':'Angola','031':'Azerbaïdjan','032':'Argentine','036':'Australie','040':'Autriche','048':'Bahreïn','050':'Bangladesh','056':'Belgique','068':'Bolivie','072':'Botswana','076':'Brésil','100':'Bulgarie','116':'Cambodge','120':'Cameroun','124':'Canada','140':'République centrafricaine','144':'Sri Lanka','152':'Chili','156':'Chine','158':'Taïwan','170':'Colombie','178':'Congo','188':'Costa Rica','191':'Croatie','196':'Chypre','203':'Tchéquie','208':'Danemark','214':'République dominicaine','218':'Équateur','233':'Estonie','246':'Finlande','250':'France','268':'Géorgie','276':'Allemagne','288':'Ghana','300':'Grèce','320':'Guatemala','324':'Guinée','332':'Haïti','344':'Hong Kong','348':'Hongrie','356':'Inde','360':'Indonésie','368':'Irak','372':'Irlande','376':'Israël','380':'Italie','384':'Côte d’Ivoire','392':'Japon','398':'Kazakhstan','400':'Jordanie','404':'Kenya','410':'Corée du Sud','414':'Koweït','422':'Liban','428':'Lettonie','430':'Liberia','440':'Lituanie','442':'Luxembourg','450':'Madagascar','458':'Malaisie','466':'Mali','470':'Malte','480':'Maurice','484':'Mexique','492':'Monaco','498':'Moldavie','504':'Maroc','512':'Oman','528':'Pays-Bas','554':'Nouvelle-Zélande','566':'Nigeria','578':'Norvège','591':'Panama','600':'Paraguay','604':'Pérou','608':'Philippines','616':'Pologne','620':'Portugal','624':'Guinée-Bissau','634':'Qatar','642':'Roumanie','643':'Fédération de Russie','682':'Arabie saoudite','686':'Sénégal','688':'Serbie','694':'Sierra Leone','702':'Singapour','703':'Slovaquie','704':'Vietnam','710':'Afrique du Sud','724':'Espagne','752':'Suède','756':'Suisse','764':'Thaïlande','784':'Émirats arabes unis','788':'Tunisie','792':'Turquie','804':'Ukraine','818':'Égypte','826':'Royaume-Uni','834':'Tanzanie','840':'États-Unis','854':'Burkina Faso','858':'Uruguay'};
  const normalizeLocale=v=>String(v||'').trim().toLowerCase().replaceAll('_','-');
  const normalizeProjectCountry=v=>{const raw=String(v||'').trim().toUpperCase();return /^\d{1,3}$/.test(raw)?raw.padStart(3,'0'):raw;};
  function projectCountryLabel(code){const key=normalizeProjectCountry(code);if(projectCountryNamesByNumericCode[key])return projectCountryNamesByNumericCode[key];if(['WW','WORLDWIDE','INT','GLOBAL'].includes(key))return'International';if(key==='ASIA')return'Asie';if(orgCountryNames[key])return orgCountryNames[key];try{return new Intl.DisplayNames(['fr'],{type:'region'}).of(key)||key;}catch(_){return key||'Non renseigné';}}
  function projectCountries(p){const map=p?.country_locales&&typeof p.country_locales==='object'&&!Array.isArray(p.country_locales)?p.country_locales:{};return[...new Set([...(Array.isArray(p?.countries)?p.countries:[]),...(p?.selected_country_code?[p.selected_country_code]:[]),...Object.keys(map)].map(normalizeProjectCountry).filter(Boolean))].sort((a,b)=>projectCountryLabel(a).localeCompare(projectCountryLabel(b),'fr',{sensitivity:'base'}));}
  function projectLocales(p){const countryLocales=p?.country_locales&&typeof p.country_locales==='object'&&!Array.isArray(p.country_locales)?Object.values(p.country_locales).flatMap(v=>Array.isArray(v)?v:[]):[];return[...new Set([...(Array.isArray(p?.locales)?p.locales:[]),...countryLocales].map(normalizeLocale).filter(Boolean))].sort((a,b)=>(localeNames[a]||a).localeCompare(localeNames[b]||b,'fr'));}
  const projectIsMultilingual=p=>projectLocales(p).length>1;
  const orgMultilingualProjects=o=>orgProjects(o).filter(projectIsMultilingual).sort((a,b)=>String(a.campaign_name||a.title||'').localeCompare(String(b.campaign_name||b.title||''),'fr',{sensitivity:'base'}));
  const localeLabel=l=>localeNames[normalizeLocale(l)]||String(l||'').toUpperCase();
  function renderClientJump(){
    const select=$('#org-jump'),list=$('#org-jump-list');if(!select||!list)return;
    const current=select.value;
    const rows=[...state.organizations].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr',{sensitivity:'base'}));
    select.innerHTML='<option value="">Choisir un client…</option>'+rows.map(o=>`<option value="${esc(o.id)}">${esc(o.name||'Client sans nom')}</option>`).join('');
    if(rows.some(o=>String(o.id)===String(current)))select.value=current;
    const query=String($('#org-jump-search')?.value||'').trim().toLowerCase();
    const filtered=query?rows.filter(o=>String(o.name||'').toLowerCase().includes(query)):rows;
    list.innerHTML=filtered.length?filtered.map(o=>{
      const logo=organizationLogoSrc(o);const initial=String(o.name||'C').slice(0,1).toUpperCase();
      const avatar=logo?`<span class="admin-client-picker-avatar has-logo"><img src="${esc(logo)}" alt=""></span>`:`<span class="admin-client-picker-avatar">${esc(initial)}</span>`;
      const meta=[...(orgSectors(o)||[])].filter(Boolean).join(' · ');
      return `<button type="button" class="admin-client-picker-option" role="option" data-org-jump-id="${esc(o.id)}">${avatar}<span><strong>${esc(o.name||'Client sans nom')}</strong>${meta?`<small>${esc(meta)}</small>`:''}</span><span class="admin-client-picker-open">Ouvrir</span></button>`;
    }).join(''):'<div class="admin-client-picker-empty">Aucun client trouvé.</div>';
    list.querySelectorAll('[data-org-jump-id]').forEach(button=>button.onclick=()=>{const id=button.dataset.orgJumpId;if(id)location.href='client.html?organizationId='+encodeURIComponent(id);});
  }
  function closeClientJump(){const pop=$('#org-jump-popover'),button=$('#org-jump-button');if(pop)pop.hidden=true;if(button)button.setAttribute('aria-expanded','false');}
  function toggleClientJump(){const pop=$('#org-jump-popover'),button=$('#org-jump-button'),search=$('#org-jump-search');if(!pop||!button)return;const open=pop.hidden;pop.hidden=!open;button.setAttribute('aria-expanded',open?'true':'false');if(open){renderClientJump();setTimeout(()=>search?.focus(),0);}}

  function multilingualAuditHtml(o){const projects=orgMultilingualProjects(o);if(!projects.length)return'';return`<div class="admin-multilingual-audit"><div class="admin-multilingual-audit-head"><strong>🌍 Autodiagnostic${projects.length>1?'s':''} multilingue${projects.length>1?'s':''}</strong><span>${projects.length} à vérifier</span></div>${projects.map(p=>{const locales=projectLocales(p),countries=projectCountries(p);return`<div class="admin-multilingual-audit-row"><div><strong>${esc(p.campaign_name||p.title||'Autodiagnostic sans nom')}</strong>${p.legacy_survey_id?`<small>Survey historique #${esc(p.legacy_survey_id)}</small>`:''}${countries.length?`<small class="admin-audit-scope-label">Périmètre${countries.length>1?'s':''} : ${countries.map(projectCountryLabel).map(esc).join(' · ')}</small>`:''}</div><div class="admin-language-pills">${locales.map(l=>`<span title="${esc(localeLabel(l))}">${esc(l.toUpperCase())} · ${esc(localeLabel(l))}</span>`).join('')}</div></div>`;}).join('')}</div>`;}
  function showError(message){const box=$('#admin-alert');box.hidden=false;box.textContent=message;box.scrollIntoView({behavior:'smooth',block:'center'});}
  function stats(o){const ps=orgProjects(o),us=orgUsers(o),quota=Number(o.passations_quota||0),used=Number(o.passations_used||0),rem=remaining(o),rate=quota?Math.min(100,Math.round(used/quota*100)):0,statuses={};ps.forEach(p=>statuses[p.status]=(statuses[p.status]||0)+1);const today=new Date().toISOString().slice(0,10),liveCount=ps.filter(p=>['published','active'].includes(p.status)&&(!p.launch_date||p.launch_date<=today)&&(!p.close_date||p.close_date>=today)).length,live=liveCount>0;const dates=[o.last_activity_at,...us.map(u=>u.last_seen_at||u.last_login_at),...ps.map(p=>p.updated_at)].filter(Boolean).map(v=>new Date(v).getTime()),last=dates.length?Math.max(...dates):0,month=30*24*60*60*1000,projectStarts=ps.map(p=>p.created_at||p.launch_date).filter(Boolean).map(v=>new Date(v).getTime()).filter(Number.isFinite),expiry=o.pack_expires_at?new Date(o.pack_expires_at):null,packStart=o.pack_started_at?new Date(o.pack_started_at).getTime():0,started=Math.min(...[...projectStarts,packStart].filter(v=>v>0)),packOlderThanMonth=Number.isFinite(started)&&Date.now()-started>=month,hasActivity=last>0||ps.length>0,toPublish=['configuration_submitted','review_pending','in_review','client_validation_required','ready_to_publish'].reduce((n,key)=>n+Number(statuses[key]||0),0);return{ps,us,rem,rate,statuses,live,liveCount,last,pending:Boolean(o.pending_pack_request),toPublish,low:rem!==null&&quota>0&&rem/quota<=.2,underused:quota>0&&packOlderThanMonth&&rate<=10,hasActivity,accessOpen:o.active!==false};}
  function health(o){const s=stats(o),items=[];if(s.live)items.push(['good','🟢 Campagne en cours']);if(s.toPublish)items.push(['info',`🚀 ${s.toPublish} à publier`]);if(s.pending)items.push(['warn','📦 Demande à valider']);if(s.low)items.push(['danger','🔥 Crédits faibles']);if(s.underused)items.push(['warn','💤 Pack sous-utilisé après 1 mois']);if(!s.us.length)items.push(['warn','⚠️ Aucun compte']);if(!s.hasActivity)items.push(['muted','⚪ Aucune activité']);return items.map(([kind,text])=>`<span class="admin-health ${kind}">${text}</span>`).join('');}
  function activateTab(name,{syncUrl=true}={}){$$('[data-admin-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.adminTab===name));$$('[data-admin-panel]').forEach(p=>p.classList.toggle('is-active',p.dataset.adminPanel===name));if(syncUrl){const url=new URL(location.href);url.searchParams.set('tab',name);history.replaceState(null,'',url);}if(name==='library'&&!state.catalogLoaded)loadLibraryAdmin();if(name==='media'&&!state.mediaLibraryLoaded)loadMediaLibrary();if(name==='migrations'&&!state.migrationsLoaded)loadMigrations();}
  function bindNavigation(){$$('[data-admin-tab]').forEach(b=>b.onclick=()=>activateTab(b.dataset.adminTab));$$('[data-kpi-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.kpiFilter)state.orgFilter=b.dataset.kpiFilter;activateTab(b.dataset.kpiTab);renderOrganizations();});}
  function setAdminLoading(active){document.body.classList.toggle('admin-is-loading',Boolean(active));const overlay=$('#admin-loading-screen');if(overlay)overlay.hidden=!active;const refresh=$('#refresh-admin');if(refresh)refresh.disabled=Boolean(active);}
  async function load(){setAdminLoading(true);try{const[cockpit,team,comments]=await Promise.all([StudioAPI.request('/api/admin/cockpit'),StudioAPI.request('/api/admin/administrators'),StudioAPI.request('/api/admin/comments?limit=1000').catch(()=>({comments:[]}))]);state.organizations=cockpit.organizations||[];state.clientFolders=cockpit.clientFolders||[];state.activity=cockpit.activity||[];state.administrators=team.administrators||[];state.currentUserId=team.currentUserId;state.adminComments=comments.comments||[];state.clientUsers=new Map(state.organizations.flatMap(o=>orgUsers(o).map(u=>[String(u.id),{...u,organizationId:o.id,organizationName:o.name}])));state.adminUsers=new Map(state.administrators.map(u=>[String(u.id),u]));renderAll();}catch(error){showError(error.message);}finally{setAdminLoading(false);}}
  function renderAll(){renderKpis();renderOverview();renderSectors();renderThemeFilter();renderLanguageCountFilter();renderScopeFilter();renderClientJump();renderChips();renderClientFolderBar();renderFolderSelect();renderOrganizations();renderCampaigns();renderAccounts();renderAdministrators();renderActivity();applyRequestedView();}
  function applyRequestedView(){const q=new URLSearchParams(location.search),tab=q.get('tab'),status=q.get('status'),filter=q.get('filter'),organizationId=q.get('organizationId'),projectId=q.get('projectId');if(tab)activateTab(tab,{syncUrl:false});if(tab==='campaigns'&&status&&$('#campaign-status')){$('#campaign-status').value=status;renderCampaigns();}if(tab==='clients'&&filter){state.orgFilter=filter;renderChips();renderOrganizations();}if(tab==='clients'&&organizationId){const org=state.organizations.find(o=>String(o.id)===String(organizationId));if(org){state.expandedClientCards.add(String(org.id));if($('#org-search'))$('#org-search').value=org.name||'';renderOrganizations();setTimeout(()=>document.querySelector(`[data-org-card="${CSS.escape(String(org.id))}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),80);}}if(tab==='campaigns'&&projectId){const project=state.organizations.flatMap(orgProjects).find(p=>String(p.id)===String(projectId));if(project&&$('#campaign-search')){$('#campaign-search').value=project.campaign_name||project.title||'';renderCampaigns();setTimeout(()=>document.querySelector(`[data-project-card="${CSS.escape(String(project.id))}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),80);}}}
  function renderKpis(){const ss=state.organizations.map(stats),campaigns=state.organizations.flatMap(orgProjects),toPublish=ss.reduce((n,s)=>n+s.toPublish,0),liveCampaigns=ss.reduce((n,s)=>n+s.liveCount,0),activeClients=ss.filter(s=>s.hasActivity).length,lowCredits=ss.filter(s=>s.low).length,pendingRequests=ss.filter(s=>s.pending).length,underusedPacks=ss.filter(s=>s.underused).length;$('#kpi-clients').textContent=activeClients;$('#kpi-clients-note').textContent=`${state.organizations.length} entreprise${state.organizations.length>1?'s':''}`;$('#kpi-campaigns').textContent=liveCampaigns;$('#kpi-campaigns-note').textContent=`${campaigns.length} campagne${campaigns.length>1?'s':''} au total`;$('#kpi-publish').textContent=toPublish;$('#kpi-requests').textContent=pendingRequests;const clientKpis={active:activeClients,publish:toPublish,live:liveCampaigns,low:lowCredits,requests:pendingRequests,underused:underusedPacks};Object.entries(clientKpis).forEach(([key,value])=>{const el=$(`#client-kpi-${key}`);if(el)el.textContent=fmt(value);});}
  function renderOverview(){const ss=state.organizations.map(stats),campaigns=state.organizations.flatMap(orgProjects),count=s=>campaigns.filter(p=>p.status===s).length,cards=[['🧩','Campagnes',[['Brouillons',campaigns.filter(adminCampaignIsDraft).length,'campaigns'],['À publier',count('configuration_submitted'),'campaigns'],['Publiées',count('published'),'campaigns'],['Terminées',campaigns.filter(adminCampaignIsFinished).length,'campaigns']]],['🏢','Clients',[['Avec activité',ss.filter(s=>s.hasActivity).length,'clients'],['Sans compte',ss.filter(s=>!s.us.length).length,'clients'],['Crédits faibles',ss.filter(s=>s.low).length,'clients'],['Packs sous-utilisés après 1 mois',ss.filter(s=>s.underused).length,'clients']]],['⚠️','Actions attendues',[['Configurations transmises',ss.reduce((n,s)=>n+s.toPublish,0),'campaigns'],['Demandes de passations',ss.filter(s=>s.pending).length,'clients'],['Invitations à finaliser',state.organizations.flatMap(orgUsers).filter(u=>u.must_change_password).length,'accounts'],['Comptes désactivés',state.organizations.flatMap(orgUsers).filter(u=>!u.active).length,'accounts']]]];$('#admin-overview').innerHTML=cards.map(([ico,title,lines])=>`<article class="admin-overview-card"><div class="admin-overview-icon">${ico}</div><div><h3>${title}</h3>${lines.map(([label,total,tab])=>`<button data-overview-tab="${tab}"><span>${label}</span><strong>${total}</strong></button>`).join('')}</div></article>`).join('');$$('[data-overview-tab]').forEach(b=>b.onclick=()=>activateTab(b.dataset.overviewTab));}
  function renderSectors(){const select=$('#org-sector-filter'),current=select.value,values=[...new Set(state.organizations.flatMap(orgSectors))].sort((a,b)=>a.localeCompare(b));select.innerHTML='<option value="">Tous les secteurs</option>'+values.map(v=>`<option>${esc(v)}</option>`).join('');if(values.includes(current))select.value=current;}
  function selectedLanguageCounts(){return $$('[data-language-count]:checked').map(input=>Number(input.value)).filter(Number.isFinite);}
  function selectedDiagnosticFilters(){return{theme:$('#org-theme-filter')?.value||'',languageCounts:selectedLanguageCounts(),scope:$('#org-scope-filter')?.value||''};}
  function projectMatchesDiagnosticFilters(p,filters=selectedDiagnosticFilters()){if(filters.theme&&String(p.theme_title||'').trim()!==filters.theme)return false;const languageCounts=Array.isArray(filters.languageCounts)?filters.languageCounts:[];if(languageCounts.length&&!languageCounts.includes(projectLocales(p).length))return false;if(filters.scope){const countries=projectCountries(p);if(filters.scope==='__multi__'){if(countries.length<=1)return false;}else if(!countries.includes(filters.scope))return false;}return true;}
  function orgMatchesDiagnosticFilters(o,filters=selectedDiagnosticFilters()){if(!filters.theme&&!(filters.languageCounts||[]).length&&!filters.scope)return true;return orgProjects(o).some(p=>projectMatchesDiagnosticFilters(p,filters));}
  function renderThemeFilter(){const select=$('#org-theme-filter');if(!select)return;const current=select.value,values=[...new Set(state.organizations.flatMap(o=>orgProjects(o).map(p=>String(p.theme_title||'').trim()).filter(Boolean)))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));select.innerHTML='<option value="">Toutes les thématiques</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(values.includes(current))select.value=current;}
  function renderLanguageCountFilter(){const root=$('#org-language-count-options'),summary=$('[data-language-count-summary]');if(!root||!summary)return;const selected=new Set(selectedLanguageCounts());const theme=$('#org-theme-filter')?.value||'';const projects=state.organizations.flatMap(orgProjects).filter(p=>!theme||String(p.theme_title||'').trim()===theme);const counts=new Map();projects.forEach(p=>{const n=projectLocales(p).length;if(n>0)counts.set(n,(counts.get(n)||0)+1);});const values=[...counts.keys()].sort((a,b)=>a-b);root.innerHTML=values.length?values.map(n=>{const count=counts.get(n)||0,label=`${n} langue${n>1?'s':''}`;return `<label class="admin-multicheck-simple ${selected.has(n)?'is-selected':''}"><input type="checkbox" data-language-count value="${n}" ${selected.has(n)?'checked':''}><span>${label}</span><small>${count} AD</small></label>`;}).join(''):'<span class="admin-multicheck-empty">Aucun AD avec langue renseignée</span>';const active=values.filter(n=>selected.has(n));summary.textContent=!active.length?'Toutes les langues':active.length<=2?active.map(n=>`${n} langue${n>1?'s':''}`).join(' · '):`${active.length} sélections`;}
  function renderScopeFilter(){const select=$('#org-scope-filter');if(!select)return;const current=select.value,theme=$('#org-theme-filter')?.value||'',languageCounts=selectedLanguageCounts();const projects=state.organizations.flatMap(orgProjects).filter(p=>projectMatchesDiagnosticFilters(p,{theme,languageCounts,scope:''}));const values=[...new Set(projects.flatMap(projectCountries))].sort((a,b)=>projectCountryLabel(a).localeCompare(projectCountryLabel(b),'fr',{sensitivity:'base'}));select.innerHTML='<option value="">Tous les périmètres</option><option value="__multi__">AD avec plusieurs périmètres</option>'+values.map(code=>`<option value="${esc(code)}">${esc(projectCountryLabel(code))}</option>`).join('');if(current==='__multi__'||values.includes(current))select.value=current;else select.value='';}
  function matches(o){const s=stats(o),f=state.orgFilter;return f==='all'||(f==='active'&&s.hasActivity)||(f==='publish'&&s.toPublish)||(f==='live'&&s.live)||(f==='low'&&s.low)||(f==='pack'&&s.pending)||(f==='underused'&&s.underused)||(f==='no-user'&&!s.us.length)||(f==='inactive'&&!s.hasActivity);}
  function renderChips(){const fs=[['all','✨ Tous'],['active','🟢 Avec activité'],['publish','🚀 À publier'],['live','📣 En cours'],['low','🔥 Crédits faibles'],['pack','📦 Demandes à valider'],['underused','💤 Sous-utilisés après 1 mois'],['no-user','⚠️ Sans compte'],['inactive','⚪ Sans activité']];$('#org-filter-chips').innerHTML=fs.map(([key,label])=>{const before=state.orgFilter;state.orgFilter=key;const n=state.organizations.filter(matches).length;state.orgFilter=before;return`<button class="${state.orgFilter===key?'is-active':''}" data-org-filter="${key}">${label}<strong>${n}</strong></button>`;}).join('');$$('[data-org-filter]').forEach(b=>b.onclick=()=>{state.orgFilter=b.dataset.orgFilter;renderChips();renderOrganizations();});}
  function filteredOrgs(){const q=$('#org-search').value.toLowerCase().trim(),sector=$('#org-sector-filter').value,sort=$('#org-sort').value,diagnosticFilters=selectedDiagnosticFilters();const rows=state.organizations.filter(o=>{const text=[o.name,orgCountryLabel(o.country_code),...orgSectors(o),...orgUsers(o).flatMap(u=>[u.first_name,u.last_name,u.email,u.job_title]),accountManagerName(o.account_manager_user_id),...orgProjects(o).flatMap(p=>[p.campaign_name,p.theme_title,...projectLocales(p),...projectLocales(p).map(localeLabel),...projectCountries(p).map(projectCountryLabel)])].join(' ').toLowerCase();const folderOk=state.clientFolderFilter==='all'||(state.clientFolderFilter==='favorites'?o.admin_favorite===true:(state.clientFolderFilter==='unclassified'?!o.admin_client_folder_id:String(o.admin_client_folder_id||'')===state.clientFolderFilter));return folderOk&&orgMatchesDiagnosticFilters(o,diagnosticFilters)&&(!q||text.includes(q))&&(!sector||orgSectors(o).includes(sector))&&matches(o);});rows.sort((a,b)=>{const x=stats(a),y=stats(b);if(sort==='recent')return y.last-x.last;if(sort==='remaining')return(x.rem??Infinity)-(y.rem??Infinity);if(sort==='usage')return y.rate-x.rate;if(sort==='campaigns')return y.ps.length-x.ps.length;if(sort==='name')return String(a.name||'').localeCompare(String(b.name||''),'fr',{sensitivity:'base'});const score=s=>s.toPublish*50+(s.pending?60:0)+(s.low?35:0)+(s.live?30:0)+(s.underused?15:0);return score(y)-score(x);});return rows;}
  function subscriptionHtml(o){const sub=o.studio_subscription;if(!sub)return'<div class="admin-subscription-card"><span>Abonnement Studio</span><strong>Inclus / historique</strong><small>Aucun abonnement Stripe rattaché</small></div>';const plan=sub.plan==='annual'?'Annuel':'Mensuel',status=sub.cancellationScheduled?'Résilié à échéance':sub.status==='active'?'Actif':sub.status==='expired'?'Expiré':'Résilié';return`<div class="admin-subscription-card is-${esc(sub.status||'active')}"><span>Abonnement Studio</span><strong>${status} · ${plan}</strong><small>Début : ${date(sub.periodStart)} · Fin de période : ${date(sub.periodEnd)}</small></div>`;}
  function packHtml(o){const r=o.pending_pack_request;if(!r)return'';return`<div class="admin-pack-alert"><div><strong>📦 Demande : ${r.unlimited?'Illimité':fmt(r.volume)+' passations'}</strong><span>${esc(r.requesterEmail||'Client')} · validité prévue ${date(r.expiresAt)}</span></div><div><button class="button button-primary" data-pack="approve" data-pack-id="${r.id}">Valider</button><button class="button button-danger-soft" data-pack="reject" data-pack-id="${r.id}">Refuser</button></div></div>`;}
  function userRow(u,o){const status=!u.active?'Désactivé':u.must_change_password?'Invitation à finaliser':'Activé';return`<article class="admin-inline-user"><div><strong>${esc((u.first_name||'')+' '+(u.last_name||''))}</strong><span>${esc(u.job_title||'Fonction non renseignée')} · ${esc(u.email)}</span><small>${status} · activité ${dateTime(u.last_seen_at||u.last_login_at)}</small></div><div>${u.must_change_password&&u.active?`<button data-resend-client="${u.id}">Renvoyer</button>`:''}<button data-edit-client="${u.id}">Modifier</button><button data-toggle-client="${u.id}" data-active="${u.active?'false':'true'}">${u.active?'Désactiver':'Réactiver'}</button><button class="danger" data-delete-client="${u.id}">Supprimer</button></div></article>`;}
  function adminCommentsFor(entityType,id){return state.adminComments.filter(c=>c.entity_type===entityType&&String(entityType==='project'?c.project_id:c.organization_id)===String(id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));}
  function adminName(user){if(!user)return'Administrateur';return [user.first_name,user.last_name].filter(Boolean).join(' ')||user.email||'Administrateur';}
  function adminCommentPanel(entityType,id){const comments=adminCommentsFor(entityType,id),label=entityType==='project'?'campagne':'client';return`<details class="admin-internal-comments" data-comment-panel="${entityType}:${esc(id)}"><summary><span>💬 Commentaires admin</span><strong>${comments.length}</strong><small>Interne Me&amp;YouToo uniquement</small></summary><div class="admin-internal-comments-body"><div class="admin-comment-list">${comments.slice(0,8).map(c=>{const own=String(c.author_user_id)===String(state.currentUserId),edited=c.updated_at&&c.created_at&&new Date(c.updated_at).getTime()>new Date(c.created_at).getTime()+1000;return`<article class="admin-comment-item" data-admin-comment-id="${c.id}"><div class="admin-comment-head"><div><strong>${esc(adminName(c.author))}</strong><time>${dateTime(c.created_at)}${edited?' · modifié':''}</time></div>${own?`<div class="admin-comment-actions"><button type="button" data-admin-comment-edit="${c.id}">Modifier</button><button type="button" class="danger" data-admin-comment-delete="${c.id}">Supprimer</button></div>`:''}</div><p data-admin-comment-body>${esc(c.body).replace(/\n/g,'<br>')}</p>${Array.isArray(c.mentions)&&c.mentions.length?`<small class="admin-comment-mentions">Alerte envoyée à ${c.mentions.map(m=>'@'+esc(adminName(m))).join(' · ')}</small>`:''}${own?`<div class="admin-comment-edit" data-admin-comment-edit-form hidden><label>Modifier le commentaire<textarea rows="3" maxlength="4000" data-admin-comment-edit-input>${esc(c.body)}</textarea></label><div class="admin-mention-picker" data-admin-mention-picker hidden></div><div class="admin-comment-edit-footer"><button class="button button-ghost button-small" type="button" data-admin-comment-cancel>Annuler</button><button class="button button-primary button-small" type="button" data-admin-comment-save data-comment-id="${c.id}">Enregistrer</button></div></div>`:''}</article>`;}).join('')||'<p class="admin-comment-empty">Aucun commentaire interne pour ce '+label+'.</p>'}</div><div class="admin-comment-compose"><label>Ajouter un commentaire<textarea rows="3" maxlength="4000" placeholder="Écrivez une note interne. Tapez @ pour alerter un autre administrateur." data-admin-comment-input data-entity-type="${entityType}" data-entity-id="${esc(id)}"></textarea></label><div class="admin-mention-picker" data-admin-mention-picker hidden></div><div class="admin-comment-compose-footer"><small>Tapez <strong>@</strong> puis choisissez un administrateur dans la liste pour lui envoyer une notification.</small><button class="button button-primary button-small" type="button" data-admin-comment-submit>Ajouter</button></div></div></div></details>`;}
  function bindAdminComments(root=document){
    const bindMentionPicker=(textarea,initialMentionIds=[])=>{if(textarea.dataset.commentBound==='1')return;textarea.dataset.commentBound='1';textarea._mentionIds=new Set(initialMentionIds.map(Number).filter(Number.isFinite));const host=textarea.closest('.admin-comment-compose,.admin-comment-edit'),picker=host?.querySelector('[data-admin-mention-picker]');const closePicker=()=>{if(picker){picker.hidden=true;picker.innerHTML='';}};const renderPicker=()=>{if(!picker)return;const before=textarea.value.slice(0,textarea.selectionStart??textarea.value.length),match=before.match(/(?:^|\s)@([^@\s]*)$/);if(!match){closePicker();return;}const q=String(match[1]||'').toLowerCase();const admins=state.administrators.filter(a=>a.active!==false&&String(a.id)!==String(state.currentUserId)&&(!q||[a.first_name,a.last_name,a.email].join(' ').toLowerCase().includes(q))).slice(0,8);if(!admins.length){closePicker();return;}picker.innerHTML=admins.map(a=>`<button type="button" data-mention-admin="${a.id}"><strong>@${esc(adminName(a))}</strong><small>${esc(a.email||'')}</small></button>`).join('');picker.hidden=false;picker.querySelectorAll('[data-mention-admin]').forEach(btn=>btn.onclick=()=>{const admin=state.adminUsers.get(String(btn.dataset.mentionAdmin));if(!admin)return;const pos=textarea.selectionStart??textarea.value.length,beforeNow=textarea.value.slice(0,pos),after=textarea.value.slice(pos),m=beforeNow.match(/(?:^|\s)@([^@\s]*)$/);if(!m)return;const atIndex=beforeNow.lastIndexOf('@'),token='@'+(admin.first_name||admin.last_name||String(admin.email||'admin').split('@')[0]);textarea.value=beforeNow.slice(0,atIndex)+token+' '+after;textarea._mentionIds.add(Number(admin.id));textarea.focus();const cursor=beforeNow.slice(0,atIndex).length+token.length+1;textarea.setSelectionRange(cursor,cursor);closePicker();});};textarea.addEventListener('input',renderPicker);textarea.addEventListener('click',renderPicker);textarea.addEventListener('keydown',e=>{if(e.key==='Escape')closePicker();});textarea.addEventListener('blur',()=>setTimeout(closePicker,160));};
    root.querySelectorAll('[data-admin-comment-input]').forEach(textarea=>bindMentionPicker(textarea));
    root.querySelectorAll('[data-admin-comment-submit]').forEach(button=>{if(button.dataset.commentBound==='1')return;button.dataset.commentBound='1';button.onclick=async()=>{const compose=button.closest('.admin-comment-compose'),textarea=compose?.querySelector('[data-admin-comment-input]');if(!textarea)return;const body=textarea.value.trim();if(!body){textarea.focus();return;}const entityType=textarea.dataset.entityType,id=textarea.dataset.entityId,payload={entityType,body,mentionedAdminIds:[...(textarea._mentionIds||new Set())]};if(entityType==='project')payload.projectId=Number(id);else payload.organizationId=id;button.disabled=true;button.textContent='Ajout…';try{const data=await StudioAPI.request('/api/admin/comments',{method:'POST',body:JSON.stringify(payload)});if(data.comment)state.adminComments.unshift(data.comment);if(entityType==='organization')renderOrganizations();else renderCampaigns();}catch(error){showError(error.message);}finally{button.disabled=false;button.textContent='Ajouter';}};});
    root.querySelectorAll('[data-admin-comment-edit]').forEach(button=>{if(button.dataset.commentBound==='1')return;button.dataset.commentBound='1';button.onclick=()=>{const item=button.closest('.admin-comment-item'),form=item?.querySelector('[data-admin-comment-edit-form]'),textarea=form?.querySelector('[data-admin-comment-edit-input]'),comment=state.adminComments.find(c=>String(c.id)===String(button.dataset.adminCommentEdit));if(!form||!textarea||!comment)return;form.hidden=false;item.querySelector('[data-admin-comment-body]')?.setAttribute('hidden','');button.closest('.admin-comment-actions')?.setAttribute('hidden','');bindMentionPicker(textarea,Array.isArray(comment.mentioned_user_ids)?comment.mentioned_user_ids:[]);textarea.focus();};});
    root.querySelectorAll('[data-admin-comment-cancel]').forEach(button=>{if(button.dataset.commentBound==='1')return;button.dataset.commentBound='1';button.onclick=()=>{const item=button.closest('.admin-comment-item'),form=button.closest('[data-admin-comment-edit-form]');if(form)form.hidden=true;item?.querySelector('[data-admin-comment-body]')?.removeAttribute('hidden');item?.querySelector('.admin-comment-actions')?.removeAttribute('hidden');};});
    root.querySelectorAll('[data-admin-comment-save]').forEach(button=>{if(button.dataset.commentBound==='1')return;button.dataset.commentBound='1';button.onclick=async()=>{const item=button.closest('.admin-comment-item'),textarea=item?.querySelector('[data-admin-comment-edit-input]'),commentId=button.dataset.commentId;if(!textarea)return;const body=textarea.value.trim();if(!body){textarea.focus();return;}button.disabled=true;button.textContent='Enregistrement…';try{const data=await StudioAPI.request('/api/admin/comments/'+commentId,{method:'PATCH',body:JSON.stringify({body,mentionedAdminIds:[...(textarea._mentionIds||new Set())]})});if(data.comment){const i=state.adminComments.findIndex(c=>String(c.id)===String(data.comment.id));if(i>=0)state.adminComments[i]=data.comment;}const entityType=data.comment?.entity_type||'organization';if(entityType==='project')renderCampaigns();else renderOrganizations();}catch(error){showError(error.message);}finally{button.disabled=false;button.textContent='Enregistrer';}};});
    root.querySelectorAll('[data-admin-comment-delete]').forEach(button=>{if(button.dataset.commentBound==='1')return;button.dataset.commentBound='1';button.onclick=async()=>{const commentId=button.dataset.adminCommentDelete,comment=state.adminComments.find(c=>String(c.id)===String(commentId));if(!comment)return;const ok=await StudioModal.confirm({type:'danger',title:'Supprimer ce commentaire ?',message:'Le commentaire sera supprimé définitivement. Les notifications de mention associées seront également retirées.',cancelLabel:'Conserver',confirmLabel:'Supprimer'});if(!ok)return;button.disabled=true;try{await StudioAPI.request('/api/admin/comments/'+commentId,{method:'DELETE'});state.adminComments=state.adminComments.filter(c=>String(c.id)!==String(commentId));if(comment.entity_type==='project')renderCampaigns();else renderOrganizations();}catch(error){showError(error.message);}finally{button.disabled=false;}};});
  }

const normalizedStatus=p=>p.status==='configuration_submitted'?'review_pending':p.status==='completed'?'unpublished':p.status;
  const statusLabel=p=>({draft:'Brouillon',review_pending:'À relire',in_review:'En relecture',client_validation_required:'Validation client requise',ready_to_publish:'Prête à publier',scheduled:'Programmé',published:'Publié',active:'Publié',unpublished:'Dépublié',archived:'Archivé'}[normalizedStatus(p)]||labels[p.status]||p.status);
  function adFilterKey(p){const st=normalizedStatus(p),now=new Date(),close=p.close_date?new Date(String(p.close_date).slice(0,10)+'T12:00:00'):null;if(['published','active'].includes(st)&&close){const d=Math.ceil((close-now)/86400000);if(d>=0&&d<14)return'endingSoon';}if(['review_pending','in_review','client_validation_required','ready_to_publish'].includes(st))return'sent';if(st==='draft')return'draft';if(st==='archived')return'archived';if(st==='unpublished')return'unpublished';if(['published','active','scheduled'].includes(st))return'published';return st;}
  function adCard(p,o){const st=normalizedStatus(p),theme=p.theme_title||p.legacy_theme_title||'Thématique',title=p.campaign_name||p.title||'Sans nom',respondent=p.respondent_title||title,contact=orgUsers(o)[0],commanditaire=contact?`${esc((contact.first_name||'')+' '+(contact.last_name||''))} — ${esc(contact.email||'')}`:'Non renseigné dans cet AD.',review=['review_pending','in_review','client_validation_required','ready_to_publish'].includes(st),legacy=p.legacy_history===true;const actions=`${review?`<a class="button button-primary" href="validation.html?projectId=${p.id}">🔎 Relecture et corrections</a>`:st==='draft'?`<a class="button button-secondary" href="composer.html?projectId=${p.id}">Modifier le contenu</a>`:`<a class="button button-secondary" href="campagne-detail.html?projectId=${p.id}">👁️ Voir le contenu</a>`}<a class="button button-secondary" href="parametrage.html?projectId=${p.id}">⚙️ Paramétrage</a><a class="button button-secondary" href="kit-communication.html?projectId=${p.id}">📣 Kit de com</a>${['unpublished','archived'].includes(st)?`<a class="button button-secondary" href="parametrage.html?projectId=${p.id}&reprogram=1">🚀 Reprogrammer</a>`:''}${st==='unpublished'?`<button class="button button-secondary" type="button" disabled title="Archivage à connecter à l’API">📦 Archiver</button>`:''}`;return`<article class="admin-ad-card" data-ad-card data-status="${adFilterKey(p)}" data-search="${esc((title+' '+theme+' '+respondent+' '+(p.legacy_slug||'')).toLowerCase())}" id="admin-ad-${p.id}"><h3>${esc(title)}</h3><div class="admin-ad-meta">Base catalogue : <strong>${esc(theme)}</strong></div><div class="admin-ad-meta">Titre répondants : <strong>${esc(respondent)}</strong></div>${legacy&&p.legacy_slug?`<div class="admin-ad-meta">Slug historique : <strong>${esc(p.legacy_slug)}</strong></div>`:''}<div class="admin-ad-tags"><span class="admin-ad-theme">${esc(theme)}</span><span class="admin-ad-status status-${st}">${statusLabel(p)}</span>${legacy?'<span class="admin-ad-status">Import Me&YouToo</span>':''}</div><div class="admin-ad-commanditaire"><strong>Commanditaire campagne</strong><span>${commanditaire}</span></div><div class="admin-ad-dates">Début : ${date(p.launch_date)}<br>Fin : ${date(p.close_date)}</div><div class="admin-ad-actions">${actions}</div></article>`;}
  function clientFolder(o){const ps=orgProjects(o),counts={all:ps.length,endingSoon:0,sent:0,results:0,draft:0,published:0,unpublished:0,archived:0};ps.forEach(p=>{const k=adFilterKey(p);if(counts[k]!=null)counts[k]++;});const chips=[['all','✨ Tous'],['endingSoon','🔴 Fin proche'],['sent','🚀 À publier'],['results','📊 Résultats dispo'],['draft','✏️ Brouillons'],['published','🟢 Publiés'],['unpublished','🛑 Dépubliés'],['archived','📦 Archivés']];return`<section class="admin-client-folder" data-client-folder="${o.id}"><div class="admin-ad-filterbar">${chips.map(([k,l])=>`<button type="button" class="${k==='all'?'is-active':''}" data-ad-filter="${k}">${l} <strong>${counts[k]}</strong></button>`).join('')}<label class="admin-ad-search">🔎 <input type="search" placeholder="Rechercher un AD, une thématique…" data-ad-search></label></div><div class="admin-ad-grid">${ps.map(p=>adCard(p,o)).join('')||'<p class="admin-empty">Aucun autodiagnostic.</p>'}</div></section>`;}
  function clientFolderById(id){return state.clientFolders.find(f=>String(f.id)===String(id));}
  function clientFolderLabel(o){const f=clientFolderById(o.admin_client_folder_id);return f?f.name:'Non classé';}
  function renderFolderSelect(){const select=$('#org-folder-filter');if(!select)return;const current=state.clientFolderFilter;select.innerHTML='<option value="all">Tous les dossiers</option><option value="unclassified">Non classés</option>'+state.clientFolders.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr',{sensitivity:'base'})).map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');select.value=[...select.options].some(o=>o.value===String(current))?String(current):'all';}
  function renderBulkFolderBar(){let bar=$('#admin-client-bulk-bar');if(!bar){bar=document.createElement('div');bar.id='admin-client-bulk-bar';bar.className='admin-client-bulk-bar';$('#admin-organizations')?.before(bar);}const ids=[...state.selectedOrgIds].filter(id=>state.organizations.some(o=>String(o.id)===String(id)));state.selectedOrgIds=new Set(ids);if(!ids.length){bar.hidden=true;bar.innerHTML='';return;}bar.hidden=false;bar.innerHTML=`<div><strong>${ids.length} client${ids.length>1?'s':''} sélectionné${ids.length>1?'s':''}</strong><button type="button" class="button button-ghost button-small" data-clear-org-selection>Tout désélectionner</button></div><label>Déplacer vers <select data-bulk-folder-select><option value="">Non classé</option>${state.clientFolders.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr',{sensitivity:'base'})).map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select></label><button type="button" class="button button-primary button-small" data-bulk-move-folder>Classer les clients</button>`;bar.querySelector('[data-clear-org-selection]').onclick=()=>{state.selectedOrgIds.clear();renderOrganizations();};bar.querySelector('[data-bulk-move-folder]').onclick=async()=>{const folderId=bar.querySelector('[data-bulk-folder-select]').value||null;const selected=[...state.selectedOrgIds];try{await Promise.all(selected.map(id=>StudioAPI.request('/api/admin/organizations/'+id+'/classification',{method:'PATCH',body:JSON.stringify({folderId})})));state.selectedOrgIds.clear();await load();}catch(e){showError(e.message);}};}
  function askClientFolderName(title,value=''){return new Promise(resolve=>{document.getElementById('admin-client-folder-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='admin-client-folder-dialog';dialog.className='admin-dialog campaign-rename-dialog';dialog.innerHTML=`<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Classement administratif</p><h2>${esc(title)}</h2><p>Créez vos propres dossiers, par exemple par associée, équipe ou portefeuille.</p><label class="field"><span>Nom du dossier</span><input id="admin-client-folder-name" maxlength="80" minlength="2" required value="${esc(value)}"></label><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="confirm-admin-client-folder" type="button">Enregistrer</button></div></form>`;document.body.append(dialog);let done=false;const finish=result=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(result);};dialog.querySelectorAll('[value="cancel"]').forEach(b=>b.onclick=()=>finish(null));dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});dialog.querySelector('#confirm-admin-client-folder').onclick=()=>{const input=dialog.querySelector('#admin-client-folder-name'),result=input.value.replace(/\s+/g,' ').trim();if(result.length<2){input.reportValidity();return;}finish(result);};dialog.showModal();dialog.querySelector('#admin-client-folder-name').focus();});}
  function askClientMoveFolder(o){return new Promise(resolve=>{document.getElementById('admin-client-move-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='admin-client-move-dialog';dialog.className='admin-dialog campaign-rename-dialog';dialog.innerHTML=`<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Classement administratif</p><h2>Classer le client</h2><p>« ${esc(o.name)} »</p><label class="field"><span>Dossier</span><select id="admin-client-folder-select"><option value="">Non classés</option>${state.clientFolders.map(f=>`<option value="${esc(f.id)}" ${String(o.admin_client_folder_id||'')===String(f.id)?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="confirm-admin-client-move" type="button">Classer</button></div></form>`;document.body.append(dialog);let done=false;const finish=result=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(result);};dialog.querySelectorAll('[value="cancel"]').forEach(b=>b.onclick=()=>finish(null));dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});dialog.querySelector('#confirm-admin-client-move').onclick=()=>finish(dialog.querySelector('#admin-client-folder-select').value);dialog.showModal();});}
  function renderClientFolderBar(){const root=$('#admin-client-folder-bar');if(!root)return;const chip=(key,label,count)=>`<button type="button" class="campaign-folder-chip ${state.clientFolderFilter===key?'is-active':''}" data-client-folder-filter="${esc(key)}"><span>${label}</span><strong>${count}</strong></button>`;root.innerHTML=`<div class="campaign-folder-heading"><div><strong>Dossiers clients</strong><span>Classement administratif partagé du portefeuille clients</span></div><button class="campaign-folder-create" type="button" data-client-folder-create>+ Nouveau dossier</button></div><div class="campaign-folder-list">${chip('all','🗂️ Tous',state.organizations.length)}${chip('favorites','⭐ Favoris',state.organizations.filter(o=>o.admin_favorite).length)}${chip('unclassified','📄 Non classés',state.organizations.filter(o=>!o.admin_client_folder_id).length)}${state.clientFolders.map(f=>`<span class="campaign-folder-group">${chip(String(f.id),'📁 '+esc(f.name),state.organizations.filter(o=>String(o.admin_client_folder_id||'')===String(f.id)).length)}<button type="button" class="campaign-folder-manage" data-client-folder-manage="${esc(f.id)}" aria-label="Gérer le dossier ${esc(f.name)}">•••</button></span>`).join('')}</div>`;root.querySelectorAll('[data-client-folder-filter]').forEach(b=>b.onclick=()=>{state.clientFolderFilter=b.dataset.clientFolderFilter;renderClientFolderBar();renderFolderSelect();renderChips();renderOrganizations();});root.querySelector('[data-client-folder-create]')?.addEventListener('click',async()=>{const name=await askClientFolderName('Nouveau dossier');if(!name)return;try{await StudioAPI.request('/api/admin/client-folders',{method:'POST',body:JSON.stringify({name})});await load();}catch(error){showError(error.message);}});root.querySelectorAll('[data-client-folder-manage]').forEach(b=>b.onclick=async()=>{const folder=clientFolderById(b.dataset.clientFolderManage);if(!folder)return;const rename=await StudioModal.confirm({eyebrow:'Dossier clients',title:folder.name,message:'Renommez ce dossier, ou supprimez-le pour replacer ses clients dans « Non classés ».',cancelLabel:'Supprimer le dossier',confirmLabel:'Renommer'});try{if(rename){const name=await askClientFolderName('Renommer le dossier',folder.name);if(!name||name===folder.name)return;await StudioAPI.request('/api/admin/client-folders/'+folder.id,{method:'PATCH',body:JSON.stringify({name})});}else{const remove=await StudioModal.confirm({type:'danger',title:`Supprimer le dossier « ${folder.name} » ?`,message:'Les clients ne seront pas supprimés. Ils retourneront dans « Non classés ».',cancelLabel:'Conserver',confirmLabel:'Supprimer le dossier'});if(!remove)return;await StudioAPI.request('/api/admin/client-folders/'+folder.id,{method:'DELETE'});if(state.clientFolderFilter===String(folder.id))state.clientFolderFilter='all';}await load();}catch(error){showError(error.message);}});}
  function accountManagerOptions(selectedId=''){const admins=(state.administrators||[]).filter(u=>u.active!==false);return '<option value="">Non attribué</option>'+admins.map(u=>{const label=((u.first_name||'')+' '+(u.last_name||'')).trim()||u.email;return `<option value="${u.id}" ${String(u.id)===String(selectedId||'')?'selected':''}>${esc(label)}${u.job_title?' · '+esc(u.job_title):''}</option>`;}).join('');}
  function accountManagerName(id){const u=(state.administrators||[]).find(a=>String(a.id)===String(id||''));return u?(((u.first_name||'')+' '+(u.last_name||'')).trim()||u.email):'Non attribué';}
  function renderOrganizations(){
    const rows=filteredOrgs(),sectorChoices=[...$('#org-sector').options].filter(o=>o.value).map(o=>o.value);
    $('#admin-organizations').innerHTML=rows.map(o=>{
      const st=stats(o),rateClass=st.rate>=90?'critical':st.rate>=75?'warning':'',initial=String(o.name||'C').slice(0,1).toUpperCase(),users=orgUsers(o),primary=users.find(u=>u.access_level==='owner')||users[0],themes=orgThemes(o),currentSector=orgSectors(o)[0]||'',currentCountry=String(o.country_code||'').toUpperCase(),sectorOptions=sectorChoices.map(v=>`<option value="${esc(v)}" ${v===currentSector?'selected':''}>${esc(v)}</option>`).join(''),expanded=state.expandedClientCards.has(String(o.id)),manager=accountManagerName(o.account_manager_user_id),remainingLabel=o.pack_unlimited?'∞':fmt(st.rem);
      return`<article class="admin-client-card admin-client-card-rich admin-client-card-compact ${expanded?'is-expanded':''}" data-org-card="${o.id}">
        <header class="admin-client-compact-head">
          <div class="admin-client-compact-main"><label class="admin-client-select" title="Sélectionner ce client"><input type="checkbox" data-select-org="${o.id}" ${state.selectedOrgIds.has(String(o.id))?'checked':''}><span></span></label>${orgLogoHtml(o)}<div class="admin-client-compact-identity"><div class="admin-client-compact-title-row"><h3>${esc(o.name)}</h3><span class="badge ${st.accessOpen?'badge-success':'badge-muted'}">${st.accessOpen?'Accès ouvert':'Cockpit archivé'}</span></div><p>${esc(currentSector||'Secteur non renseigné')}</p><span class="admin-client-folder-inline ${o.admin_client_folder_id?'is-classified':'is-unclassified'}">📁 ${esc(clientFolderLabel(o))}</span></div></div>
          <div class="admin-client-compact-metrics"><span><strong>${st.ps.length}</strong><small>AD</small></span><span><strong>${st.us.length}</strong><small>compte${st.us.length>1?'s':''}</small></span><span><strong>${remainingLabel}</strong><small>crédits restants</small></span><span><strong>${st.rate}%</strong><small>utilisation</small></span><span class="admin-client-compact-manager"><strong>${esc(manager)}</strong><small>responsable</small></span></div>
          <div class="admin-client-compact-actions"><a class="button button-primary button-small" href="client.html?organizationId=${encodeURIComponent(o.id)}">Ouvrir</a><button class="button button-secondary button-small admin-client-toggle" type="button" data-toggle-org-details="${o.id}" aria-expanded="${expanded?'true':'false'}">${expanded?'Replier':'Détails'} <span aria-hidden="true">${expanded?'▴':'▾'}</span></button></div>
        </header>
        <div class="admin-client-compact-alerts">${themes.length?`<div class="admin-theme-tags">${themes.slice(0,3).map(([name,count])=>`<span>🌼 ${esc(name)} <strong>${count}</strong></span>`).join('')}${themes.length>3?`<span>+${themes.length-3}</span>`:''}</div>`:''}<div class="admin-health-row">${health(o)}</div></div>${multilingualAuditHtml(o)}
        <div class="admin-client-expanded-content" ${expanded?'':'hidden'}>${subscriptionHtml(o)}<div class="admin-client-kpis"><div class="pack"><span>Crédits attribués</span><strong>${o.pack_unlimited?'Illimité':fmt(o.passations_quota)}</strong><small>Début : ${date(o.pack_started_at)} · Fin : ${date(o.pack_expires_at)}</small></div><div class="remaining"><span>Restants</span><strong>${remainingLabel}</strong><small>Solde disponible</small></div><div class="used"><span>Utilisation</span><strong>${st.rate}%</strong><small>${fmt(o.passations_used)} utilisés</small><i><b class="${rateClass}" style="width:${st.rate}%"></b></i></div><div class="activity"><span>Dernière activité</span><strong>${st.last?dateTime(st.last):'Jamais'}</strong><small>${st.toPublish} à publier</small></div></div>${packHtml(o)}<section class="admin-client-branding"><div class="admin-client-branding-copy"><h4>Identité du client <span class="admin-info-dot" tabindex="0" data-info="Le logo est enregistré une seule fois sur le compte client. Il est ensuite réutilisé automatiquement dans le cockpit, les campagnes et le calendrier lorsque l’espace le permet.">i</span></h4><p>Logo partagé dans le Studio.</p></div><div class="admin-client-branding-preview">${orgLogoHtml(o,'is-large')}</div><div class="admin-client-branding-actions"><input type="file" accept="image/png,image/jpeg,image/webp" data-org-logo-input="${o.id}" hidden><button class="button button-secondary" type="button" data-upload-org-logo="${o.id}">${organizationLogoSrc(o)?'Remplacer le logo':'Ajouter un logo'}</button>${organizationLogoSrc(o)?`<button class="button button-ghost" type="button" data-remove-org-logo="${o.id}">Supprimer</button>`:''}</div></section><div class="admin-client-management"><section class="admin-client-contact-block"><h4>🌍 Pays du client</h4><strong>${esc(orgCountryLabel(o.country_code))}</strong><small>Pays de rattachement de l’entreprise</small><h4>👤 Responsable de compte Me&YouToo</h4><strong class="admin-account-manager-name">${esc(manager)}</strong><small>Référent interne du dossier client</small><h4>👤 Contact dossier</h4>${primary?`<strong>${esc((primary.first_name||'')+' '+(primary.last_name||''))}</strong><span>${esc(primary.job_title||'Fonction non renseignée')}</span><a href="mailto:${esc(primary.email||'')}">${esc(primary.email||'')}</a>${primary.phone?`<span>${esc(primary.phone)}</span>`:''}`:'<span>Aucun contact renseigné</span>'}<h4>👥 Comptes rattachés</h4><div class="admin-linked-users">${users.map(u=>`<div><span>${esc((u.first_name||'')+' '+(u.last_name||''))}</span><small>${esc(u.email||'')}</small><em>${u.active?'Actif':'Désactivé'}</em></div>`).join('')||'<span>Aucun compte</span>'}</div></section><section class="admin-client-pack-manager"><div class="admin-pack-manager-head"><div><h4>📦 Gestion du pack</h4><p>${o.pack_unlimited?'Pack illimité':fmt(o.passations_used)+' utilisées · '+fmt(st.rem)+' restantes'}</p></div></div><div class="admin-pack-form-grid"><label>Nom de l’entreprise<input data-org-name="${o.id}" type="text" maxlength="160" value="${esc(o.name||'')}" required></label><label>Responsable de compte<select data-account-manager="${o.id}">${accountManagerOptions(o.account_manager_user_id)}</select></label><label>Pays du client<select data-country="${o.id}">${orgCountryOptions(currentCountry)}</select></label><label>Secteur<select data-sector="${o.id}"><option value="">Choisir</option>${sectorOptions}</select></label><label>Crédits attribués<input data-quota="${o.id}" type="number" min="0" value="${Number(o.passations_quota||0)}" ${o.pack_unlimited?'disabled':''}></label><label>Crédits utilisés<input data-used="${o.id}" type="number" min="0" value="${Number(o.passations_used||0)}" ${o.pack_unlimited?'disabled':''}></label><label>Début du pack<input data-pack-start="${o.id}" type="date" value="${o.pack_started_at?String(o.pack_started_at).slice(0,10):''}"></label><label>Fin de validité<input data-expiry="${o.id}" type="date" value="${o.pack_expires_at?String(o.pack_expires_at).slice(0,10):''}"></label><label class="admin-pack-unlimited-inline"><input data-unlimited="${o.id}" type="checkbox" ${o.pack_unlimited?'checked':''}> Pack illimité</label></div><button class="button button-primary" type="button" data-save-credits="${o.id}">Enregistrer la gestion</button></section></div><div class="admin-client-classification"><span>${o.admin_favorite?'⭐ Favori':'☆ Non favori'}${clientFolderById(o.admin_client_folder_id)?' · 📁 '+esc(clientFolderById(o.admin_client_folder_id).name):' · Non classé'}</span><div><button class="button button-secondary" type="button" data-favorite-org="${o.id}" data-next-favorite="${o.admin_favorite?'false':'true'}">${o.admin_favorite?'Retirer des favoris':'☆ Ajouter aux favoris'}</button><button class="button button-secondary" type="button" data-move-client-folder="${o.id}">📁 Classer</button></div></div>${adminCommentPanel('organization',o.id)}<div class="admin-client-open-row"><a class="button button-primary" href="client.html?organizationId=${encodeURIComponent(o.id)}">Ouvrir le dossier client</a><button class="button button-secondary" data-add-user="${o.id}">+ Ajouter un accès</button><button class="button button-secondary" data-archive-org="${o.id}" data-next-active="${st.accessOpen?'false':'true'}">${st.accessOpen?'Archiver le cockpit':'Réactiver le cockpit'}</button><button class="button button-danger-soft" data-delete-org="${o.id}">Supprimer le cockpit</button></div></div>
      </article>`;
    }).join('')||'<div class="card admin-empty">Aucun client ne correspond aux filtres.</div>';
    $$('[data-select-org]').forEach(c=>c.onchange=()=>{const id=String(c.dataset.selectOrg);if(c.checked)state.selectedOrgIds.add(id);else state.selectedOrgIds.delete(id);renderBulkFolderBar();});
    renderBulkFolderBar();
    $$('[data-toggle-org-details]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const id=String(b.dataset.toggleOrgDetails);if(state.expandedClientCards.has(id))state.expandedClientCards.delete(id);else state.expandedClientCards.add(id);renderOrganizations();});
    bindOrgActions();bindAdminComments($('#admin-organizations'));
  }
    function adminCampaignRows(){return state.organizations.flatMap(o=>orgProjects(o).map(p=>({...p,organizationName:o.name,organizationId:o.id,organizationLogoData:organizationLogoSrc(o)||null})));}
    function adminCampaignReviewStatus(status){return['configuration_submitted','review_pending','in_review','client_validation_required','ready_to_publish'].includes(status);}
    function adminCampaignDate(value,endOfDay=false){if(!value)return null;const raw=String(value).slice(0,10),d=new Date(raw+(endOfDay?'T23:59:59':'T00:00:00'));return Number.isNaN(d.getTime())?null:d;}
    function adminCampaignIsLegacy(p){return Boolean(p&&(p.source_type==='legacy_client'||p.legacy_history===true||String(p.legacy_source||'')==='meayt-legacy'));}
    function adminCampaignIsDraft(p){return !adminCampaignIsLegacy(p)&&normalizedStatus(p)==='draft';}
    function adminCampaignIsUnpublished(p){return normalizedStatus(p)==='unpublished';}
    function adminCampaignIsFinished(p){
      const raw=normalizedStatus(p),now=new Date(),end=adminCampaignDate(p.close_date,true);
      // Les imports legacy conservent leur statut technique d'origine : draft/unpublished = patrimoine terminé.
      // Ce filtre est volontairement cumulatif : un legacy unpublished reste aussi « Dépubliée ».
      if(adminCampaignIsLegacy(p)&&['draft','unpublished'].includes(raw))return true;
      if(['completed','closed'].includes(raw))return true;
      // Pour une campagne Studio native, « Terminée » est un état temporel calculé à partir de la date de fin.
      if(!adminCampaignIsLegacy(p)&&end&&end<now)return true;
      return false;
    }
    function adminCampaignLifecycle(p){
      const raw=normalizedStatus(p),now=new Date(),start=adminCampaignDate(p.launch_date),end=adminCampaignDate(p.close_date,true);
      if(raw==='archived')return'archived';
      if(adminCampaignReviewStatus(raw))return'review';
      if(adminCampaignIsFinished(p))return'finished';
      if(start&&start>now&&['scheduled','published','active'].includes(raw))return'scheduled';
      if(['published','active','scheduled'].includes(raw)&&(!start||start<=now)&&(!end||end>=now))return'ongoing';
      if(raw==='draft')return'draft';
      if(raw==='unpublished')return'unpublished';
      return raw;
    }
    function adminCampaignOngoingStatus(p){return adminCampaignLifecycle(typeof p==='object'?p:{status:p})==='ongoing';}
    function adminCampaignFinishedStatus(p){return adminCampaignIsFinished(typeof p==='object'?p:{status:p});}
    function adminCampaignEndingSoon(p){if(adminCampaignLifecycle(p)!=='ongoing'||!p.close_date)return false;const now=new Date(),limit=new Date(now.getTime()+14*24*60*60*1000),d=adminCampaignDate(p.close_date,true);return Boolean(d&&d>=now&&d<=limit);}
    function adminCampaignHasResults(p){return Boolean(String(p.communication_results_url||'').trim());}
    function adminCampaignQuickMatch(p,key){
      if(!key||key==='all')return true;
      if(key==='endingSoon')return adminCampaignEndingSoon(p);
      if(key==='results')return adminCampaignHasResults(p);
      if(key==='finished')return adminCampaignIsFinished(p);
      if(key==='unpublished')return adminCampaignIsUnpublished(p);
      if(key==='draft')return adminCampaignIsDraft(p);
      return adminCampaignLifecycle(p)===key;
    }
    function adminCampaignQuickLabel(key){return({all:'Toutes',endingSoon:'Fin proche',results:'Résultats',draft:'Brouillon',review:'À publier',scheduled:'Programmée',ongoing:'En cours',finished:'Terminée',unpublished:'Dépubliée',archived:'Archivée'})[key]||labels[key]||key;}
    function adminCampaignQuickIcon(key){return({all:'✨',endingSoon:'🔴',results:'📊',draft:'✏️',review:'🚀',scheduled:'🗓️',ongoing:'🟢',finished:'🏁',unpublished:'🛑',archived:'📦'})[key]||'•';}
    function adminCampaignStageLabel(p){
      const raw=normalizedStatus(p);
      if(adminCampaignIsLegacy(p)){
        const parts=[];
        if(adminCampaignIsFinished(p))parts.push('Terminée');
        if(raw==='unpublished')parts.push('Dépubliée');
        else if(raw==='draft'){/* Legacy draft = patrimoine terminé : ne jamais l'afficher comme brouillon. */}
        else if(['published','active'].includes(raw))parts.push('Publiée');
        else if(raw==='scheduled')parts.push('Programmée');
        else if(raw==='archived')parts.push('Archivée');
        else if(adminCampaignReviewStatus(raw))parts.push(labels[raw]||raw);
        return [...new Set(parts)].join(' · ')||labels[raw]||raw||'—';
      }
      const stepLabels={accueil:'Accueil',composer:'Questions',personnalisation:'Profils',parametrage:'Paramétrage',validation:'Validation'};
      if(adminCampaignIsFinished(p))return raw==='unpublished'?'Terminée · Dépubliée':'Terminée';
      if(raw==='unpublished')return'Dépubliée';
      if(raw==='archived')return'Archivée';
      if(adminCampaignReviewStatus(raw))return labels[raw]||raw;
      if(['published','active'].includes(raw))return adminCampaignLifecycle(p)==='ongoing'?'En cours':'Publiée';
      if(raw==='scheduled')return'Programmée';
      if(raw==='draft'){const step=stepLabels[String(p.current_step||'').toLowerCase()];return step?`Brouillon · ${step}`:'Brouillon';}
      return labels[raw]||stepLabels[String(p.current_step||'').toLowerCase()]||raw||'—';
    }
    function adminCampaignSortArrow(group,sort){if(!String(sort||'').startsWith(group+'_'))return'↕';return String(sort).endsWith('_asc')?'↑':'↓';}
    function adminCampaignPeriodMatch(p,value){if(!value||value==='all')return true;const now=new Date();if(value==='current')return adminCampaignLifecycle(p)==='ongoing';if(value==='upcoming')return adminCampaignLifecycle(p)==='scheduled';if(value.startsWith('year:')){const year=Number(value.split(':')[1]);if(!year)return true;const start=adminCampaignDate(p.launch_date)||(p.created_at?new Date(p.created_at):null),end=adminCampaignDate(p.close_date,true),yearStart=new Date(year,0,1),yearEnd=new Date(year,11,31,23,59,59,999);return Boolean(start&&!Number.isNaN(start.getTime())&&start<=yearEnd&&(!end||end>=yearStart));}return true;}
    function populateAdminCampaignFilters(rows){
      const status=$('#campaign-status'),theme=$('#campaign-theme'),period=$('#campaign-period'),scope=$('#campaign-scope'),locale=$('#campaign-locale'),client=$('#campaign-client');
      const preserve=(el,html)=>{if(!el)return;const current=el.value;el.innerHTML=html;if([...el.options].some(o=>o.value===current))el.value=current;};
      const statusOptions=[
        ['draft','Brouillon'],['review','À traiter'],['scheduled','Programmée'],['ongoing','En cours'],
        ['finished','Terminée'],['unpublished','Dépubliée'],['archived','Archivée']
      ].filter(([key])=>rows.some(p=>adminCampaignQuickMatch(p,key)));
      preserve(status,'<option value="">Tous les statuts</option>'+statusOptions.map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join(''));
      const themes=[...new Set(rows.map(p=>String(p.theme_title||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
      preserve(theme,'<option value="">Toutes les thématiques</option>'+themes.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(''));
      const scopes=[...new Set(rows.flatMap(projectCountries))].sort((a,b)=>projectCountryLabel(a).localeCompare(projectCountryLabel(b),'fr',{sensitivity:'base'}));
      preserve(scope,'<option value="">Tous les périmètres</option>'+scopes.map(v=>`<option value="${esc(v)}">${esc(projectCountryLabel(v))}</option>`).join(''));
      const locales=[...new Set(rows.flatMap(projectLocales))].sort((a,b)=>localeLabel(a).localeCompare(localeLabel(b),'fr',{sensitivity:'base'}));
      preserve(locale,'<option value="">Toutes les langues</option>'+locales.map(v=>`<option value="${esc(v)}">${esc(localeLabel(v))}</option>`).join(''));
      const clients=[...new Map(rows.filter(p=>p.organizationId).map(p=>[String(p.organizationId),p.organizationName])).entries()].sort((a,b)=>String(a[1]||'').localeCompare(String(b[1]||''),'fr',{sensitivity:'base'}));
      preserve(client,'<option value="">Tous les clients</option>'+clients.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join(''));
      const years=[...new Set(rows.flatMap(p=>[p.launch_date,p.close_date].filter(Boolean).map(v=>new Date(v)).filter(d=>!Number.isNaN(d.getTime())).map(d=>d.getFullYear())))].sort((a,b)=>b-a);
      preserve(period,'<option value="all">Toutes les périodes</option><option value="current">En cours aujourd’hui</option><option value="upcoming">À venir</option>'+years.map(y=>`<option value="year:${y}">${y}</option>`).join(''));
    }
    function renderAdminCampaignQuickFilters(rows){
      const root=$('#admin-campaign-quick-filters');if(!root)return;
      const keys=['all','endingSoon','results','draft','review','scheduled','ongoing','finished','unpublished','archived'];
      const count=key=>key==='all'?rows.length:rows.filter(p=>adminCampaignQuickMatch(p,key)).length;
      root.innerHTML=keys.filter(key=>key==='all'||key==='review'||count(key)>0).map(key=>`<button type="button" class="admin-campaign-filter-chip ${key==='review'?'is-publish':''} ${state.campaignQuickFilter===key?'is-active':''}" data-admin-campaign-filter="${esc(key)}"><span>${adminCampaignQuickIcon(key)} ${esc(adminCampaignQuickLabel(key))}</span><strong>${fmt(count(key))}</strong></button>`).join('');
      root.querySelectorAll('[data-admin-campaign-filter]').forEach(button=>button.onclick=()=>{state.campaignQuickFilter=button.dataset.adminCampaignFilter||'all';renderCampaigns();});
      $$('[data-admin-campaign-kpi]').forEach(button=>button.classList.toggle('is-active',button.dataset.adminCampaignKpi===state.campaignQuickFilter||(button.dataset.adminCampaignKpi==='review'&&state.campaignQuickFilter==='review')));
    }
    function renderAdminCampaignKpis(rows){
      const counts={all:rows.length,draft:rows.filter(adminCampaignIsDraft).length,review:rows.filter(p=>adminCampaignLifecycle(p)==='review').length,ongoing:rows.filter(p=>adminCampaignLifecycle(p)==='ongoing').length,finished:rows.filter(adminCampaignIsFinished).length};
      Object.entries(counts).forEach(([key,value])=>{const el=$(`#campaign-kpi-${key}`);if(el)el.textContent=fmt(value);});
    }
    function renderCampaigns(){
      const allRows=adminCampaignRows();populateAdminCampaignFilters(allRows);renderAdminCampaignKpis(allRows);renderAdminCampaignQuickFilters(allRows);
      const q=String($('#campaign-search')?.value||'').toLowerCase().trim(),status=$('#campaign-status')?.value||'',theme=$('#campaign-theme')?.value||'',period=$('#campaign-period')?.value||'all',scope=$('#campaign-scope')?.value||'',locale=$('#campaign-locale')?.value||'',client=$('#campaign-client')?.value||'',sort=$('#campaign-sort')?.value||'updated_desc';
      const rows=allRows.filter(p=>{
        const countries=projectCountries(p),locales=projectLocales(p),haystack=[p.campaign_name,p.title,p.theme_title,p.organizationName,labels[p.status]||p.status,...countries.map(projectCountryLabel),...locales.map(localeLabel)].join(' ').toLowerCase();
        const lifecycle=adminCampaignLifecycle(p),statusMatch=!status||adminCampaignQuickMatch(p,status);
        return adminCampaignQuickMatch(p,state.campaignQuickFilter)&&statusMatch&&(!theme||p.theme_title===theme)&&adminCampaignPeriodMatch(p,period)&&(!scope||countries.includes(scope))&&(!locale||locales.includes(locale))&&(!client||String(p.organizationId)===String(client))&&(!q||haystack.includes(q));
      });
      rows.sort((a,b)=>{if(sort==='updated_asc')return new Date(a.updated_at||0)-new Date(b.updated_at||0);if(sort==='launch_desc')return new Date(b.launch_date||0)-new Date(a.launch_date||0);if(sort==='launch_asc')return new Date(a.launch_date||8640000000000000)-new Date(b.launch_date||8640000000000000);if(sort==='close_desc')return new Date(b.close_date||0)-new Date(a.close_date||0);if(sort==='close_asc')return new Date(a.close_date||8640000000000000)-new Date(b.close_date||8640000000000000);if(sort==='name')return String(a.campaign_name||a.title||'').localeCompare(String(b.campaign_name||b.title||''),'fr',{sensitivity:'base'});if(sort==='client')return String(a.organizationName||'').localeCompare(String(b.organizationName||''),'fr',{sensitivity:'base'});return new Date(b.updated_at||0)-new Date(a.updated_at||0);});
      const root=$('#admin-campaigns');
      const header=`<div class="admin-campaign-list-header"><span>Campagne / client</span><span>État / étape</span><button type="button" data-campaign-sort-header="updated">Dernière modification <b>${adminCampaignSortArrow('updated',sort)}</b></button><button type="button" data-campaign-sort-header="launch">Date de début <b>${adminCampaignSortArrow('launch',sort)}</b></button><button type="button" data-campaign-sort-header="close">Date de fin <b>${adminCampaignSortArrow('close',sort)}</b></button><span>Accès</span></div>`;
      root.innerHTML=rows.length?header+rows.map(p=>{return'';}).join(''):'';
      // Les cartes ont déjà été construites ci-dessus dans campaignCards ; réinjectées ci-dessous.
      const campaignCards=rows.map(p=>{const countries=projectCountries(p),locales=projectLocales(p),lifecycle=adminCampaignLifecycle(p),raw=normalizedStatus(p),stateBadges=[];if(adminCampaignIsDraft(p))stateBadges.push('<span class="badge badge-status">Brouillon</span>');if(raw==='unpublished')stateBadges.push('<span class="badge badge-status">Dépubliée</span>');if(raw==='archived')stateBadges.push('<span class="badge badge-status">Archivée</span>');if(adminCampaignReviewStatus(raw))stateBadges.push('<span class="badge badge-status badge-publish">À publier</span>');if(lifecycle==='scheduled')stateBadges.push('<span class="badge badge-status">Programmée</span>');if(lifecycle==='ongoing')stateBadges.push('<span class="badge badge-status">En cours</span>');if(adminCampaignIsFinished(p))stateBadges.push('<span class="badge badge-status">Terminée</span>');if(!stateBadges.length)stateBadges.push(`<span class="badge badge-status">${esc(labels[raw]||raw||'—')}</span>`);const signals=[adminCampaignEndingSoon(p)?'<span class="admin-campaign-signal is-ending">🔴 Fin proche</span>':'',adminCampaignHasResults(p)?'<span class="admin-campaign-signal is-results">📊 Résultats disponibles</span>':''].filter(Boolean).join(''),meta=[...countries.slice(0,4).map(c=>`<span>${esc(projectCountryLabel(c))}</span>`),...locales.slice(0,5).map(l=>`<span>${esc(localeLabel(l))}</span>`)].join('');return `<article class="admin-campaign-card" data-project-card="${p.id}"><div class="admin-campaign-card-main"><div class="admin-campaign-card-badges">${stateBadges.join('')}${signals}</div><h3>${esc(p.campaign_name||p.title||'Sans nom')}</h3><p class="admin-campaign-client-line">${p.organizationLogoData?`<span class="admin-inline-client-logo"><img src="${esc(p.organizationLogoData)}" alt=""></span>`:''}<strong>${esc(p.organizationName)}</strong> · ${esc(p.theme_title||'Thématique non renseignée')}</p>${meta?`<div class="admin-campaign-meta-tags">${meta}</div>`:''}</div><div class="admin-campaign-cell" data-label="État / étape"><strong>${esc(adminCampaignStageLabel(p))}</strong></div><div class="admin-campaign-cell" data-label="Dernière modification"><strong>${dateTime(p.updated_at)}</strong></div><div class="admin-campaign-cell" data-label="Date de début"><strong>${date(p.launch_date)}</strong></div><div class="admin-campaign-cell" data-label="Date de fin"><strong>${date(p.close_date)}</strong></div><div class="admin-campaign-access"><a class="button button-secondary" href="client.html?projectId=${p.id}">Ouvrir dans le dossier client</a></div>${adminCommentPanel('project',p.id)}</article>`;}).join('');
      root.innerHTML=rows.length?header+campaignCards:'<div class="card admin-empty">Aucune campagne ne correspond à ces filtres.</div>';
      root.querySelectorAll('[data-campaign-sort-header]').forEach(button=>button.onclick=()=>{const group=button.dataset.campaignSortHeader,current=$('#campaign-sort')?.value||'updated_desc',next=group==='updated'?(current==='updated_desc'?'updated_asc':'updated_desc'):group==='launch'?(current==='launch_asc'?'launch_desc':'launch_asc'):(current==='close_asc'?'close_desc':'close_asc');if($('#campaign-sort'))$('#campaign-sort').value=next;renderCampaigns();});
      bindAdminComments(root);
    }
  function renderAccounts(){const q=$('#account-search').value.toLowerCase().trim(),filter=$('#account-status').value,rows=[...state.clientUsers.values()].filter(u=>{const current=!u.active?'disabled':u.must_change_password?'pending':'active';return(!filter||filter===current)&&(!q||[u.first_name,u.last_name,u.email,u.organizationName,u.job_title].join(' ').toLowerCase().includes(q));});$('#admin-client-accounts').innerHTML=rows.map(u=>`<article class="admin-account-card"><div><strong>${esc((u.first_name||'')+' '+(u.last_name||''))}</strong><span>${esc(u.organizationName)} · ${esc(u.job_title||'Fonction non renseignée')}</span><small>${esc(u.email)} · téléphone ${esc(u.phone||'non renseigné')}</small><small><b class="access-level-badge">${esc(accessLabels[u.access_level]||accessLabels.manager)}</b></small></div><span class="badge ${!u.active?'badge-muted':u.must_change_password?'badge-warning':'badge-success'}">${!u.active?'Désactivé':u.must_change_password?'Invitation à finaliser':'Activé'}</span><div class="admin-account-actions"><button data-edit-client="${u.id}">Modifier</button>${u.must_change_password&&u.active?`<button data-resend-client="${u.id}">Renvoyer</button>`:''}<button data-toggle-client="${u.id}" data-active="${u.active?'false':'true'}">${u.active?'Désactiver':'Réactiver'}</button><button class="danger" data-delete-client="${u.id}">Supprimer</button></div></article>`).join('')||'<div class="card admin-empty">Aucun compte client.</div>';bindUserActions($('#admin-client-accounts'));}
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
    const migrationCard=b=>{const integration=b.summary?.integration||{},isTestApplied=b.status==='completed'&&integration.testMode===true,isRolledBack=b.status==='rolled_back'&&integration.testMode===true;let displayName=String(b.source_customer_name||'Migration historique');if(b.scope==='client'&&b.organization_name&&/^Me&YouToo\s+[—-]/i.test(displayName))displayName=displayName.replace(/^Me&YouToo\s+[—-]\s*/i,`${b.organization_name} — `);return `<article class="admin-migration-card ${b.status==='archived'?'is-archived':''}" data-open-migration-card="${b.id}" data-migration-status="${esc(b.status)}" tabindex="0" role="button" aria-label="Ouvrir le lot ${esc(displayName)}"><div><span class="admin-migration-scope">${b.scope==='catalog'?'Catalogue Me&YouToo':'Client'}</span><h3>${esc(displayName)}</h3><p>${esc(b.organization_name||'Catalogue commun')}${b.source_survey_id?' · Survey #'+esc(b.source_survey_id):''} · ${fmt(b.mapping_count)} élément${Number(b.mapping_count)>1?'s':''} · ${fmt(b.error_count)} erreur${Number(b.error_count)>1?'s':''}</p>${dryRunText(b)?`<small class="admin-migration-summary">${esc(dryRunText(b))}</small>`:''}${isTestApplied?`<small class="admin-migration-summary">Test appliqué : ${fmt(integration.updated)} mise(s) à jour · ${fmt(integration.created)} création(s) · ${fmt(integration.countryVariants)} variante(s) pays · rollback disponible</small>`:''}${isRolledBack?`<small class="admin-migration-summary">Test annulé le ${esc(dateTime(integration.rolledBackAt))} · les décisions sont conservées et peuvent être reprises.</small>`:''}${b.status==='archived'&&b.archived_at?`<small class="admin-migration-summary">Archivé le ${esc(dateTime(b.archived_at))}</small>`:''}</div><div class="admin-migration-actions"><span class="admin-migration-status is-${esc(b.status)}">${esc(migrationStatusLabel(b.status))}</span><button class="button button-secondary" data-open-migration="${b.id}" data-status="${esc(b.status)}">Ouvrir</button>${isRolledBack?`<button class="button button-primary" data-resume-review="${b.id}">Reprendre la revue</button>`:''}${isTestApplied?`<button class="button button-danger-soft" data-rollback-migration="${b.id}">Annuler le test</button>`:''}${b.status!=='archived'&&!isTestApplied?`<button class="button button-ghost" data-archive-migration="${b.id}">Archiver</button>`:b.status==='archived'?`<button class="button button-ghost" data-restore-migration="${b.id}">Restaurer</button>`:''}${b.status!=='completed'&&b.status!=='importing'?`<button class="button button-danger-soft" data-delete-migration="${b.id}">Supprimer</button>`:''}</div></article>`;};
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
    $$('[data-resume-review]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const batchId=b.dataset.resumeReview;const ok=await StudioModal.confirm({eyebrow:'TEST STAGING ANNULÉ',title:'Reprendre la revue de ce lot ?',message:'Le catalogue a déjà été restauré. Les décisions précédentes seront conservées afin que tu puisses les relire et les modifier avant de relancer un nouveau test staging.',cancelLabel:'Annuler',confirmLabel:'Reprendre la revue'});if(!ok)return;try{const r=await StudioAPI.request('/api/admin/migrations/'+batchId+'/resume-review',{method:'POST',body:'{}'});state.migrationsLoaded=false;await loadMigrations();await openMigrationReview(batchId);}catch(err){showError(err.message);}});
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
    const suggestedScope=String(meta.importTarget||surveyPayload.importTarget||'').toLowerCase()==='client'?'client':null;
    const lotPrefix=suggestedScope==='client'?(sourceCustomerName||'Client'):'Me&YouToo';
    const lotName=`${lotPrefix} — ${diagnosticTitle||'Migration historique'}${sourceSurveyId?` — #${sourceSurveyId}`:''}`;
    return{entities,meta,sourceSurveyId,sourceCustomerId,sourceCustomerName,diagnosticTitle,lotName,suggestedScope};
  }
  function migrationDryRunPreview(data,batchId,fileName=''){
    const preview=$('#migration-dryrun-preview'),btn=$('#run-migration-dryrun'),entities=data?.entities||[],meta=data?.meta||{};
    if(!preview||!btn)return;
    const by={};entities.forEach(x=>{const t=String(x.entityType||x.entity_type||'inconnu');by[t]=(by[t]||0)+1;});
    const batch=state.migrationBatches.find(x=>String(x.id)===String(batchId)),expected=String(batch?.source_survey_id||''),got=String(meta.sourceSurveyId||'');
    const mismatch=expected&&got&&expected!==got,clientMode=batch?.scope==='client';
    preview.innerHTML=`${fileName?`<small class="migration-prefill-file">JSON prêt : ${esc(fileName)}</small>`:''}<strong>${fmt(entities.length)} éléments détectés</strong><p>${esc(Object.entries(by).map(([k,v])=>k+' '+v).join(' · '))}</p>${got?`<p>Survey du fichier : <strong>#${esc(got)}</strong>${expected?' · attendu #'+esc(expected):''}</p>`:''}${mismatch?'<div class="composer-alert">Ce fichier ne correspond pas au survey indiqué dans le lot.</div>':clientMode?'<p class="hint">Le dry-run contrôle le contenu historique à copier. Aucune comparaison avec le catalogue Me&YouToo n’est effectuée et aucune donnée client n’est écrite.</p>':'<p class="hint">Le dry-run compare sans écrire dans le catalogue.</p>'}`;
    btn.disabled=!entities.length||mismatch;
  }
  function syncMigrationLotName(force=false){
    const input=$('#migration-source-name'),jsonInput=$('#migration-source-json'),data=jsonInput?._migrationData||null;if(!input||!data)return;
    const scope=$('#migration-scope')?.value||data.suggestedScope||'catalog',orgSel=$('#migration-org');
    const selectedOrgName=scope==='client'&&orgSel?.value?String(orgSel.options[orgSel.selectedIndex]?.textContent||'').trim():'';
    const prefix=scope==='client'?(selectedOrgName||data.sourceCustomerName||'Client'):'Me&YouToo';
    const next=`${prefix} — ${data.diagnosticTitle||'Migration historique'}${data.sourceSurveyId?` — #${data.sourceSurveyId}`:''}`;
    const current=String(input.value||'').trim();
    if(force||!current||/^Me&YouToo\s+[—-]/i.test(current)||current===data.lotName||current.startsWith((data.sourceCustomerName||'')+' — '))input.value=next;
  }
  function syncMigrationScopeUi(){
    const scope=$('#migration-scope')?.value||'catalog',clientMode=scope==='client',wrap=$('#migration-org-wrap'),note=$('#migration-protection-note');
    if(wrap)wrap.hidden=!clientMode;
    if(note)note.textContent=clientMode?'Le JSON prépare le lot et le dry-run. Aucune campagne, aucun crédit, aucune date de pack et aucun utilisateur du client ne sont modifiés à cette étape.':'Le JSON sert uniquement à préparer le lot et le dry-run. Aucun contenu n’est intégré au catalogue à cette étape.';
  }
  function openMigrationDialog(){
    const d=$('#migration-dialog'),sel=$('#migration-org');if(!d||!sel)return;
    sel.innerHTML='<option value="">Choisir un client</option>'+state.organizations.map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
    const jsonInput=$('#migration-source-json');if(jsonInput){jsonInput.value='';jsonInput._migrationData=null;}
    const jsonStatus=$('#migration-source-json-status');if(jsonStatus){jsonStatus.textContent='Sélectionne le JSON historique : Studio préremplit le survey, l’ID client historique et le nom du lot. Tu peux encore les modifier avant de créer le lot.';jsonStatus.classList.remove('is-success','is-error');}
    $('#migration-source-name').value='';$('#migration-source-id').value='';$('#migration-source-survey-id').value='';$('#migration-scope').value='catalog';syncMigrationScopeUi();d.showModal();
  }
  function openDryRunDialog(batchId,preloaded=null){
    const d=$('#migration-dryrun-dialog');if(!d)return;d.dataset.batchId=batchId;
    const batch=state.migrationBatches.find(x=>String(x.id)===String(batchId));
    const stored=batch?.summary?.sourceImport||null;
    const source=preloaded?.entities?.length?preloaded:(stored?.entities?.length?stored:null);
    d._migrationData=source||null;
    const intro=$('#migration-dryrun-intro');
    if(intro)intro.textContent=batch?.scope==='client'
      ?'Studio utilise automatiquement le master JSON déjà associé à ce lot. Le dry-run vérifie uniquement ce qui sera copié dans le patrimoine du client, sans comparaison avec le catalogue.'
      :'Studio utilise automatiquement le JSON déjà associé à ce lot pour préparer le dry-run.';
    $('#migration-dryrun-preview').innerHTML='<p class="hint">Aucun JSON n’est associé à ce lot.</p>';$('#run-migration-dryrun').disabled=true;
    if(source?.entities?.length)migrationDryRunPreview(source,batchId,source.fileName||'JSON associé au lot');
    d.showModal();
  }
  function migrationEntityLabel(type,count=1){const labels={theme:['Thématique','Thématiques'],chapter:['Chapitre','Chapitres'],situation:['Situation','Situations'],answer:['Réponse','Réponses'],profile:['Profil','Profils'],survey_meta:['Informations du diagnostic','Informations du diagnostic']};return (labels[type]||[type,type])[count>1?1:0];}
  function migrationComparisonLabel(status){return({exact_match:'Déjà dans Studio',possible_variant:'Variante possible',new:'Nouveau'})[status]||'À analyser';}
  function migrationComparisonClass(status){return status==='exact_match'?'is-exact':status==='possible_variant'?'is-variant':'is-new';}
  function migrationDifferenceLabel(field){
    const raw=String(field||'différence');
    if(raw.startsWith('translation_missing:'))return `traduction ${raw.split(':')[1]?.toUpperCase()||''} absente du Studio`;
    if(raw.startsWith('translation_differs:'))return `traduction ${raw.split(':')[1]?.toUpperCase()||''} différente`;
    return ({content:'texte',introduction:'introduction',score:'score',is_best:'meilleure réponse',position:'position',title:'titre',summary:'résumé',scoring_min:'score minimum',scoring_max:'score maximum',top_score:'score plafond',color:'couleur'})[raw]||raw;
  }
  function migrationDifferencesText(cmp){const rows=Array.isArray(cmp?.differences)?cmp.differences:[];return rows.map(migrationDifferenceLabel).join(' · ');}
  function migrationDifferencesHtml(cmp){const text=migrationDifferencesText(cmp);return text?`<div class="migration-difference-note"><strong>Différences détectées :</strong> ${esc(text)}</div>`:'';}
  function migrationLanguageDifferences(cmp){return Array.isArray(cmp?.translationDifferences)?cmp.translationDifferences:[];}
  function migrationLanguageDiffLocales(cmp){return [...new Set(migrationLanguageDifferences(cmp).map(x=>String(x||'').split(':')[1]).filter(Boolean))];}
  function migrationLanguageDiffBadge(cmp){const locales=migrationLanguageDiffLocales(cmp);return locales.length?`<span class="migration-review-language-warning">Langue${locales.length>1?'s':''} à récupérer : ${esc(locales.map(x=>x.toUpperCase()).join(' · '))}</span>`:'';}
  function migrationRecoveryLocales(entities=[]){return [...new Set(entities.flatMap(x=>migrationLanguageDiffLocales(x.comparison)).map(x=>String(x||'').toLowerCase()).filter(Boolean))].sort();}
  function migrationTranslations(payload){const all=Object.keys(payload?.translations||{}).map(x=>String(x).toLowerCase()).filter(Boolean);const active=(payload?.activeLocales||[]).map(x=>String(x).toLowerCase()).filter(Boolean);const selected=active.length?active.filter(x=>all.includes(x)):all;return [...new Set(selected)].sort((a,b)=>a.localeCompare(b,'fr'));}
  function migrationDormantTranslations(payload){const all=Object.keys(payload?.translations||{}).map(x=>String(x).toLowerCase()).filter(Boolean);const active=new Set((payload?.activeLocales||[]).map(x=>String(x).toLowerCase()).filter(Boolean));return [...new Set(all.filter(x=>!active.has(x)))].sort((a,b)=>a.localeCompare(b,'fr'));}
  function migrationLanguageLabel(locale){const l=String(locale||'').toLowerCase();return({fr:'Français',en:'English',es:'Español',de:'Deutsch',it:'Italiano',pt:'Português',br:'Português (Brésil)',bg:'Български',ar:'العربية',ja:'日本語','ko-kr':'한국어',zh:'中文',zf:'中文繁體',nl:'Nederlands','nl-be':'Nederlands (BE)',pl:'Polski',ro:'Română',ru:'Русский','sv-se':'Svenska',tr:'Türkçe'})[l]||String(locale||'').toUpperCase();}
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
  function migrationIsTechnicalCountryLabel(value){
    const text=migrationPlainText(value);
    if(!text)return false;
    return /^question\s+(?:(?:us|usa|canada|br[eé]sil|chine|japon|cor[eé]e|allemagne|argentine|autriche|chili|espagne|france|hong\s*kong|mexique|norv[eè]ge|panama|portugal|su[eè]de|suisse|ta[iï]wan|uruguay|[A-Z]{2,})(?:\s+(?:et|\/|&)\s+(?:us|usa|canada|br[eé]sil|chine|japon|cor[eé]e|allemagne|argentine|autriche|chili|espagne|france|hong\s*kong|mexique|norv[eè]ge|panama|portugal|su[eè]de|suisse|ta[iï]wan|uruguay|[A-Z]{2,}))*)\b/i.test(text);
  }
  function migrationDisplayTranslation(payload,locale){
    const l=String(locale||'').toLowerCase();
    const direct=migrationTranslationText(payload,l);
    if(l==='fr'&&(!direct||migrationIsTechnicalCountryLabel(direct))){
      const ref=migrationBestSourceTranslation(payload,['en','es','br','de','it','ja','ko-kr','zf','zh','pt','nl','pl','ro','ru','sk','sv-se','tr','bg']);
      if(ref.text)return{text:ref.text,fallback:true,sourceLocale:ref.locale};
    }
    return{text:direct,fallback:false,sourceLocale:l};
  }
  function migrationBestSourceTranslation(payload,preferredLocales=[]){
    const translations=payload?.translations||{};
    const candidates=[...preferredLocales,...Object.keys(translations)]
      .map(x=>String(x||'').toLowerCase().replaceAll('_','-'))
      .filter((x,i,a)=>x&&x!=='fr'&&a.indexOf(x)===i);
    for(const locale of candidates){
      const value=migrationTranslationText(payload,locale);
      if(value&&!migrationIsTechnicalCountryLabel(value))return{locale,text:value};
    }
    return{locale:'',text:''};
  }
  function migrationCountryLocaleMap(metaPayload={}){
    // Référentiel métier du survey international #453.
    // Le code ISO numérique vient des variantes pays historiques.
    // FR reste ajouté séparément comme langue de gestion.
    const defaults={
      '276':['de','en'], '032':['en','es'], '040':['de','en'], '076':['br','en'],
      '124':['en'], '152':['en','es'], '156':['en','zh'], '410':['en','ko-kr'],
      '208':['en'], '724':['es'], '840':['en'], '250':['fr'], '344':['en','zf'],
      '392':['en','ja'], '484':['en','es'], '578':['en'], '591':['en','es'],
      '620':['br'], '752':['en'], '756':['de','fr','it'], '158':['en','zf'],
      '858':['en','es']
    };
    const out=new Map(Object.entries(defaults).map(([code,locales])=>[code,new Set(locales)]));
    const countries=Array.isArray(metaPayload.countries)?metaPayload.countries:[],
      localeRows=Array.isArray(metaPayload.locales)?metaPayload.locales:[];
    const localesBySurveyCountry=new Map();
    localeRows.forEach(row=>{
      const key=String(row.surveys_country_id??'');
      if(!key)return;
      if(!localesBySurveyCountry.has(key))localesBySurveyCountry.set(key,new Set());
      const locale=String(row.locale_code||'').trim().toLowerCase().replaceAll('_','-');
      if(locale)localesBySurveyCountry.get(key).add(locale);
    });
    countries.forEach(row=>{
      const code=String(row.country_code||row.code||row.countryCode||'').trim().toUpperCase();
      if(!code)return;
      const locales=localesBySurveyCountry.get(String(row.surveys_country_id??''))||new Set();
      if(!out.has(code))out.set(code,new Set());
      locales.forEach(locale=>out.get(code).add(locale));
    });
    return out;
  }
  function migrationVisibleLocales(m,context={}){
    const p=m?.source_payload||{};
    const normalize=x=>String(x||'').trim().toLowerCase().replaceAll('_','-');
    const active=[...(p.activeLocales||[]),...(context.activeLocales||[])].map(normalize).filter(Boolean);
    const translations=p.translations||{};
    const available=new Set();

    // FR est toujours visible comme langue de gestion.
    available.add('fr');

    // Les langues de diffusion viennent du contenu réellement disponible,
    // jamais du pays. Pays et langue sont deux axes indépendants.
    Object.entries(translations).forEach(([locale,row])=>{
      const loc=normalize(locale);
      if(!loc)return;
      const hasText=Boolean(
        row && (
          String(row.content||'').trim() ||
          String(row.title||'').trim() ||
          String(row.summary||'').trim() ||
          String(row.introduction||'').trim()
        )
      );
      if(hasText)available.add(loc);
    });

    // Le contenu source FR compte comme FR disponible.
    if(String(p.content||p.title||p.summary||'').trim())available.add('fr');

    // Si le survey déclare des langues actives, on ne garde en diffusion
    // que celles qui ont réellement un contenu, plus FR gestion.
    if(active.length){
      return [...available].filter(loc=>loc==='fr'||active.includes(loc));
    }
    return [...available];
  }
  function migrationPayloadTitle(m){const p=m?.source_payload||{};if(m?.entity_type==='profile')return p.title||p.raw?.title||`Profil #${m.legacy_id}`;if(m?.entity_type==='chapter')return p.title||p.originalTitle||`Chapitre #${m.legacy_id}`;if(m?.entity_type==='theme')return p.title||p.originalTitle||`Thématique #${m.legacy_id}`;if(m?.entity_type==='situation'){const fr=migrationDisplayTranslation(p,'fr');if(fr.text)return fr.text;}return p.content||p.title||p.originalTitle||p.label||`${migrationEntityLabel(m.entity_type)} #${m.legacy_id}`;}
  function dryRunTypeStats(mappings,type){const rows=mappings.filter(m=>m.entity_type===type);const stat={total:rows.length,exact:0,variant:0,new:0};rows.forEach(m=>{const st=(m.comparison||m.source_payload?._comparison||{}).status||'new';if(st==='exact_match')stat.exact++;else if(st==='possible_variant')stat.variant++;else stat.new++;});return stat;}
  function migrationTranslationText(payload,locale){const t=payload?.translations?.[locale]||{};return t.introduction||t.content||t.title||t.summary||t.label||'';}
  function migrationStudioTranslationText(target,locale){
    const l=String(locale||'').toLowerCase();
    const translated=target?.translations?.[l]||{};
    const translatedText=translated.introduction||translated.content||translated.title||translated.summary||translated.label||'';
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
    const p=m.source_payload||{},cmp=m.comparison||p._comparison||{status:'new'},langs=migrationVisibleLocales(m,context),title=migrationPayloadTitle(m),target=cmp.targetPayload||null;
    const currentText=target?.content||target?.title||'',textDiff=target?migrationTextDiff(title,currentText):null;
    const translationPanels=langs.map(l=>{const studioLocaleText=migrationStudioTranslationText(target,l),localeCode=String(l||'').toUpperCase(),display=m.entity_type==='situation'?migrationDisplayTranslation(p,l):{text:migrationTranslationText(p,l),fallback:false};const studioPanel=target?(studioLocaleText?`<div class="migration-lang-version is-studio"><div class="migration-lang-panel-head"><span class="migration-lang-code is-studio">STUDIO</span><strong>Version actuelle · ${esc(localeCode)}</strong></div><p>${esc(studioLocaleText)}</p></div>`:`<div class="migration-lang-version is-studio is-missing"><div class="migration-lang-panel-head"><span class="migration-lang-code is-studio">STUDIO</span><strong>Aucune version ${esc(localeCode)}</strong></div><p>Le Studio actuel ne contient pas de version ${esc(migrationLanguageLabel(l))} pour cet élément.</p></div>`):'';return `<div class="migration-lang-panel" data-migration-lang-panel="${esc(m.legacy_id)}:${esc(l)}" hidden><div class="migration-lang-version${display.fallback?' is-fallback':''}"><div class="migration-lang-panel-head"><span class="migration-lang-code">${esc(localeCode)}</span><strong>${esc(migrationLanguageLabel(l))}</strong><em>${display.fallback?'Texte anglais affiché · traduction FR à compléter':'Version historique'}</em></div><p>${esc(display.text||'Aucun texte disponible dans cette langue.')}</p></div>${studioPanel}</div>`;}).join('');
    const countries=[...new Set((p.countries||[]).map(c=>String(c.name||c.code||c.id||'').trim()).filter(Boolean))],countryCodes=[...new Set([...(p.countryCodes||[]),...(p.country_codes||[])].map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))],countryHtml=countries.length||countryCodes.length?`<div class="migration-country-variant"><span>Pays associé${countries.length>1||countryCodes.length>1?'s':''}</span><strong>${countries.length?countries.map(esc).join(' · '):countryCodes.map(esc).join(' · ')}</strong>${countryCodes.length?`<small>${countryCodes.map(esc).join(' · ')}</small>`:''}</div>`:'';
    const compareHtml=currentText?`${migrationDiffLegend(textDiff?.changed)}<div class="migration-side-by-side migration-text-compare"><div><span>Historique</span><p class="migration-diff-text">${textDiff?.oldHtml||esc(title)}</p></div><div><span>Studio actuel</span><p class="migration-diff-text">${textDiff?.newHtml||esc(currentText)}</p>${m.entity_type==='answer'?`<small>Score ${esc(target?.score??'—')}${target?.is_best===true?' · meilleure réponse':''}</small>`:''}</div></div>`:'';
    return `<article class="migration-detail-item ${migrationComparisonClass(cmp.status)}"><div class="migration-detail-item-head"><div><span class="migration-detail-kind">${esc(migrationEntityLabel(m.entity_type))}</span><strong>${esc(title)}</strong><small>Ancien ID ${esc(m.legacy_id)}${p.position!=null?' · position '+esc(p.position):''}</small></div><div class="migration-detail-badges"><span class="migration-compare-badge ${migrationComparisonClass(cmp.status)}">${esc(migrationComparisonLabel(cmp.status))}</span>${migrationScoreHtml(m)}${langs.length?`<div class="migration-lang-switch" aria-label="Langues disponibles">${langs.map(l=>`<button type="button" class="migration-lang-badge" data-migration-lang="${esc(m.legacy_id)}:${esc(l)}" title="Afficher ${esc(migrationLanguageLabel(l))}"><span>${esc(String(l).toUpperCase())}</span><small>${esc(migrationLanguageLabel(l))}</small></button>`).join('')}</div>`:''}</div></div>${migrationDifferencesHtml(cmp)}${compareHtml}${translationPanels}${countryHtml}${childrenHtml||''}</article>`;
  }

  async function showDryRunDetail(batchId){
    try{
      const data=await StudioAPI.request('/api/admin/migrations/'+batchId),batch=data.batch||{},mappings=data.mappings||[],summary=batch.summary?.dryRun||{},d=$('#migration-detail-dialog'),root=$('#migration-detail-content');
      if(!d||!root)return;
      d.dataset.batchId=batchId;
      const batchLabel=batch.name||batch.source_customer_name||'Import historique';
      const integration=batch.summary?.integration||{},clientMode=batch.scope==='client',isTestApplied=batch.status==='completed'&&integration.testMode===true,isRolledBack=batch.status==='rolled_back'&&integration.testMode===true;
      $('#migration-detail-title').textContent=isTestApplied?'Intégration de test appliquée':isRolledBack?'Intégration de test annulée':'Résultat du dry-run';
      $('#migration-detail-subtitle').textContent=isTestApplied
        ? `${batchLabel} · application STAGING avec rollback disponible`
        : isRolledBack
          ? `${batchLabel} · ${clientMode?'campagne client supprimée':'catalogue restauré'} · lot supprimable`
          : `${batchLabel} · ${fmt(summary.accepted||mappings.length)} éléments analysés · aucune écriture ${clientMode?'dans le client':'dans le catalogue'}`;
      const types=['theme','chapter','situation','answer','profile','survey_meta'];
      const stats=Object.fromEntries(types.map(t=>[t,dryRunTypeStats(mappings,t)]));
      const summaryCards=types.filter(t=>stats[t].total).map(t=>{const x=stats[t];return `<article><strong>${fmt(x.total)}</strong><span>${esc(migrationEntityLabel(t,x.total))}</span><small>${clientMode?'À copier tel quel dans la campagne client':`${fmt(x.exact)} déjà présents · ${fmt(x.variant)} variantes · ${fmt(x.new)} nouveaux`}</small></article>`;}).join('');
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
      const worldwideCatalog=mappings.some(m=>m.entity_type==='chapter'&&m.source_payload?.countryScope==='worldwide');
      const catalogScopeLabel=worldwideCatalog?'WORLDWIDE · tous pays':(officialCountries.map(String).join(' · ')||'Non renseigné');
      const legacyScopeNote=worldwideCatalog&&officialCountries.length?`<small>Paramétrage historique : ${officialCountries.map(esc).join(' · ')} — ignoré comme contrainte métier</small>`:'';
      const countryLocaleMap=migrationCountryLocaleMap(meta?.source_payload||{});
      const chapters=mappings.filter(m=>m.entity_type==='chapter').sort((a,b)=>(Number(a.source_payload?.position)||0)-(Number(b.source_payload?.position)||0));
      const chapterBlocks=chapters.map(ch=>{const situations=(byParent.get(String(ch.legacy_id))||[]).filter(x=>x.entity_type==='situation').sort((a,b)=>(Number(a.source_payload?.position)||0)-(Number(b.source_payload?.position)||0));const profiles=(byParent.get(String(ch.legacy_id))||[]).filter(x=>x.entity_type==='profile').sort((a,b)=>(Number(a.source_payload?.position)||0)-(Number(b.source_payload?.position)||0));const situationHtml=situations.map(si=>{const answers=(byParent.get(String(si.legacy_id))||[]).filter(x=>x.entity_type==='answer'),situationLocales=migrationVisibleLocales(si,{officialCountries,countryLocaleMap});const child=`<details class="migration-detail-children"><summary><span>${answers.length} réponse${answers.length>1?'s':''} · ${situationLocales.length} langue${situationLocales.length>1?'s':''} de gestion/diffusion</span><span class="migration-fold-label">Afficher</span></summary><div>${answers.map(a=>migrationDetailRow(a,'',{officialCountries,countryLocaleMap,allowedLocales:situationLocales})).join('')||'<p class="hint">Aucune réponse.</p>'}</div></details>`;return migrationDetailRow(si,child,{officialCountries,countryLocaleMap});}).join('');return `<details class="migration-chapter-block"><summary><div class="migration-chapter-summary-main"><span class="migration-chapter-chevron" aria-hidden="true">›</span><div><strong>${esc(migrationPayloadTitle(ch))}</strong>${ch.source_payload?.choiceGroup?`<div class="migration-alternative-summary"><span class="admin-library-type-tag is-library"><b>Chapitre alternatif à :</b> ${esc(ch.source_payload.alternativeToTitle||'chapitre de référence')}</span><span class="admin-library-type-tag is-country">${ch.source_payload.countryScope==='worldwide'?'🌍 Tous pays · WORLDWIDE':'Périmètre : '+esc((ch.source_payload.countryCodes||[]).join(' · '))}</span><small><b>Après intégration :</b> ${esc(ch.source_payload.alternativeToTitle||'Chapitre par défaut')} (choix par défaut) ↔ ${esc(migrationPayloadTitle(ch))} (alternative)</small></div>`:''}<span>${situations.length} situation${situations.length>1?'s':''} · ${profiles.length} profil${profiles.length>1?'s':''}</span></div></div><div class="migration-chapter-summary-actions"><span class="migration-compare-badge ${migrationComparisonClass((ch.comparison||ch.source_payload?._comparison||{}).status)}">${esc(migrationComparisonLabel((ch.comparison||ch.source_payload?._comparison||{}).status))}</span><span class="migration-fold-label">Déplier</span></div></summary><div class="migration-chapter-content">${situationHtml}${profiles.length?`<details class="migration-profile-group"><summary><span>${profiles.length} profils du chapitre</span><span class="migration-fold-label">Afficher</span></summary>${profiles.map(p=>migrationProfileDetailRow(p,{officialCountries})).join('')}</details>`:''}</div></details>`;}).join('');
      root.innerHTML=`<section class="migration-review-welcome migration-dryrun-welcome"><div class="migration-review-welcome-head"><div><span class="migration-review-step-label">${isTestApplied?'ÉTAPE 3 SUR 3 · TEST D’INTÉGRATION':isRolledBack?`TEST ANNULÉ · ${clientMode?'CAMPAGNE CLIENT SUPPRIMÉE':'CATALOGUE RESTAURÉ'}`:'ÉTAPE 1 SUR 3 · ANALYSE AUTOMATIQUE'}</span><h3>${isTestApplied?'Contrôler le résultat avant rollback':isRolledBack?'Le test a été entièrement annulé':clientMode?'Contrôler la copie historique avant import':'Contrôler le rapprochement avant toute décision'}</h3><p>${isTestApplied?'Les décisions ont été appliquées au catalogue de staging. Tu peux maintenant tester les écrans qui consomment réellement ces données puis annuler le test.':isRolledBack?clientMode?'La campagne créée par ce test a été supprimée. Le client, son pack et ses utilisateurs sont restés intacts. Tu peux supprimer le lot.':'Les contenus modifiés ont été restaurés et les contenus créés par le test ont été supprimés. Tu peux supprimer le lot.':clientMode?'Ce premier écran vérifie uniquement le contenu historique qui sera copié dans le client sélectionné : chapitres, situations, réponses, scores, profils, langues et périmètres. Aucune comparaison avec le catalogue actuel.':'Ce premier écran sert uniquement à vérifier ce que Studio a détecté : correspondances, variantes, nouveautés, langues et périmètre. Tu ne prends encore aucune décision d’intégration.'}</p></div></div></section>${isTestApplied?`<section class="migration-detail-security"><strong>Test STAGING appliqué</strong><span>${fmt(integration.updated)} mise(s) à jour · ${fmt(integration.created)} création(s) · ${fmt(integration.countryVariants)} variante(s) pays · ${fmt(integration.translations)} traduction(s). Un snapshot de rollback a été créé.</span></section>`:isRolledBack?`<section class="migration-detail-security"><strong>Rollback terminé</strong><span>${clientMode?'La campagne client créée par ce lot a été supprimée. Le client et son pack sont intacts.':'Le catalogue a été restauré. Le lot peut maintenant être supprimé définitivement si tu n’en as plus besoin.'}</span></section>`:`<section class="migration-detail-security"><strong>Import protégé</strong><span>${clientMode?'Le dry-run lit le master JSON sans comparer au catalogue et sans modifier le client destinataire.':'Le catalogue Studio actuel reste intact. Ce dry-run compare uniquement les données historiques au Studio.'}</span></section>`}<section class="migration-detail-kpis">${summaryCards}</section><section class="migration-detail-overview"><div><span>Survey historique</span><strong>#${esc(batch.source_survey_id||meta?.legacy_id||'—')}</strong></div><div><span>Langues actives</span><strong>${activeLocales.map(x=>String(x).toUpperCase()).join(' · ')||'—'}</strong>${dormantLocales.length?`<small>Traductions historiques hors diffusion : ${dormantLocales.map(x=>String(x).toUpperCase()).join(' · ')}</small>`:''}</div><div><span>${worldwideCatalog?'Portée catalogue':'Périmètre historique'}</span><strong>${esc(catalogScopeLabel)}</strong>${legacyScopeNote}</div><div><span>Erreurs</span><strong>${fmt(summary.invalid||0)}</strong></div></section>${theme?`<div class="migration-detail-theme">${migrationDetailRow(theme,'',{officialCountries})}</div>`:''}<section class="migration-detail-chapters"><div class="migration-detail-section-head"><div><h3>Contrôle du contenu</h3><p>Ouvre les chapitres puis les situations. Clique sur une langue pour afficher sa version. Les langues hors diffusion restent signalées séparément. Les scores sont affichés sur chaque réponse et les seuils sur chaque profil.</p></div><div class="migration-fold-actions"><button type="button" class="button button-ghost button-small" id="migration-expand-all">Tout déplier</button><button type="button" class="button button-ghost button-small" id="migration-collapse-all">Tout replier</button></div></div>${chapterBlocks||'<p class="admin-empty">Aucun chapitre trouvé.</p>'}</section>`;
      $$('[data-migration-lang]',root).forEach(btn=>btn.onclick=()=>{const key=btn.dataset.migrationLang,panel=root.querySelector(`[data-migration-lang-panel="${CSS.escape(key)}"]`),item=btn.closest('.migration-detail-item');if(!panel)return;item.querySelectorAll('[data-migration-lang-panel]').forEach(x=>{if(x!==panel)x.hidden=true;});item.querySelectorAll('[data-migration-lang]').forEach(x=>x.classList.toggle('is-active',x===btn&&!panel.hidden));panel.hidden=!panel.hidden;btn.classList.toggle('is-active',!panel.hidden);});
      $('#migration-expand-all')?.addEventListener('click',()=>$$('.migration-chapter-block,.migration-detail-children,.migration-profile-group',root).forEach(x=>x.open=true));
      $('#migration-collapse-all')?.addEventListener('click',()=>$$('.migration-chapter-block,.migration-detail-children,.migration-profile-group',root).forEach(x=>x.open=false));
      const actions=$('#migration-detail-actions');actions.innerHTML=`<button type="button" class="button button-ghost" data-close-dialog="migration-detail-dialog">Fermer</button>${batch.status==='dry_run_ready'?'<button type="button" class="button button-primary" id="migration-detail-approve">Passer à la revue</button>':''}${batch.status==='approved'?'<button type="button" class="button button-primary" id="migration-detail-stage">Ouvrir la revue humaine</button>':''}${batch.status==='review_ready'?'<button type="button" class="button button-primary" id="migration-detail-review">Reprendre la revue des décisions</button>':''}${isTestApplied?'<button type="button" class="button button-danger-soft" id="migration-detail-rollback">Annuler l’intégration de test</button>':''}`;
      actions.querySelector('[data-close-dialog]')?.addEventListener('click',()=>d.close());
      $('#migration-detail-approve')?.addEventListener('click',async()=>{const ok=await StudioModal.confirm({title:'Passer à la revue humaine ?',message:clientMode?'Tu confirmes que le contenu historique détecté est cohérent. Studio va le copier dans une zone de revue séparée. Aucune campagne, aucun pack et aucun utilisateur du client ne seront modifiés à cette étape.':'Tu confirmes que le résultat du dry-run est cohérent. Studio va copier ce lot dans une zone de revue séparée afin que tu puisses prendre les décisions métier. Aucune donnée du catalogue actuel ne sera modifiée.',confirmLabel:'Passer à la revue'});if(!ok)return;try{await StudioAPI.request('/api/admin/migrations/'+batchId+'/approve',{method:'POST',body:'{}'});await StudioAPI.request('/api/admin/migrations/'+batchId+'/stage-import',{method:'POST',body:'{}'});d.close();state.migrationsLoaded=false;await loadMigrations();openMigrationReview(batchId);}catch(e){showError(e.message);state.migrationsLoaded=false;await loadMigrations();}});
      $('#migration-detail-stage')?.addEventListener('click',async()=>{const ok=await StudioModal.confirm({title:'Ouvrir la revue humaine ?',message:clientMode?'Le dry-run est déjà validé. Les éléments historiques seront copiés dans la zone de revue client. Aucune campagne ni donnée de pack ne sera modifiée à cette étape.':'Le dry-run est déjà validé. Les éléments historiques seront copiés dans la zone de revue séparée. Le catalogue actuel ne sera pas modifié.',confirmLabel:'Ouvrir la revue'});if(!ok)return;try{await StudioAPI.request('/api/admin/migrations/'+batchId+'/stage-import',{method:'POST',body:'{}'});d.close();state.migrationsLoaded=false;await loadMigrations();openMigrationReview(batchId);}catch(e){showError(e.message);}});
      $('#migration-detail-review')?.addEventListener('click',()=>{d.close();openMigrationReview(batchId);});
      $('#migration-detail-rollback')?.addEventListener('click',async()=>{const ok=await StudioModal.confirm({type:'danger',eyebrow:'TEST STAGING',title:'Annuler cette intégration de test ?',message:'Les mises à jour seront restaurées et toutes les données créées par ce lot seront supprimées. Les décisions de revue resteront traçables.',cancelLabel:'Conserver le test',confirmLabel:'Annuler l’intégration'});if(!ok)return;try{const r=await StudioAPI.request('/api/admin/migrations/'+batchId+'/rollback-test',{method:'POST',body:'{}'});d.close();await StudioModal.alert({title:'Rollback terminé',message:r.message||(clientMode?'La campagne client de test a été supprimée.':'Le catalogue de staging a été restauré.'),confirmLabel:'Fermer'});state.migrationsLoaded=false;await loadMigrations();}catch(e){showError(e.message);}});
      d.showModal();
    }catch(e){showError(e.message);}
  }
  const reviewDecisionDefinitions={
    pending:{label:'À décider',short:'Aucune décision n’est encore prise.',detail:'L’élément reste en attente dans la revue. Rien ne sera prévu pour l’intégration finale tant qu’une décision n’aura pas été choisie.'},
    keep_current:{label:'Garder le Studio actuel',short:'Conserver la version déjà présente dans Studio.',detail:'La version historique reste traçable dans le lot, mais elle ne remplacera pas le contenu actuel du Studio lors de l’intégration finale.'},
    use_legacy:{label:'Remplacer par la version historique',short:'Remplacer la version Studio par la version historique.',detail:'Lors de l’intégration finale, le contenu historique validé deviendra la version de référence pour l’élément correspondant dans Studio.'},
    add_complementary:{label:'Ajouter en complémentaire',short:'Conserver Studio et ajouter l’historique en plus.',detail:'La version actuelle reste intacte et la version historique sera créée comme contenu complémentaire distinct. C’est particulièrement utile lorsqu’il s’agit d’une vraie alternative métier et non d’une correction.'},
    country_variant:{label:'Créer variante pays',short:'Conserver la base Studio et créer une version spécifique à un pays.',detail:'La version historique sera conservée comme variante pays rattachée au contenu Studio de référence. Pour le survey #44, le périmètre historique est la France.'},
    ignore:{label:'Ignorer',short:'Ne rien intégrer pour cet élément.',detail:'L’élément reste visible dans l’historique du lot pour traçabilité, mais il sera exclu de l’intégration finale.'}
  };
  function reviewDecisionEntries(entityType){
    return Object.entries(reviewDecisionDefinitions).filter(([value])=>{
      if(entityType==='profile'&&value==='add_complementary')return false;
      if(entityType==='theme'&&['add_complementary','country_variant'].includes(value))return false;
      return true;
    });
  }
  function reviewDecisionOptions(current,entityType,entity=null,businessEntities=[]){
    return reviewDecisionEntries(entityType).map(([v,d])=>{
      const display=migrationDecisionDisplay(entity,v,businessEntities);
      return `<option value="${v}" ${v===current?'selected':''}>${esc(display.label||d.label)}</option>`;
    }).join('');
  }
  function reviewDecisionHelpHtml(current,entityType,entity=null,businessEntities=[]){
    const currentDef=migrationDecisionDisplay(entity,current,businessEntities);
    return `<div class="migration-review-decision-current" data-decision-current><strong>${esc(currentDef.label)}</strong><span>${esc(currentDef.short)}</span></div><div class="migration-review-decision-help-panel" data-decision-help-panel hidden><div class="migration-review-decision-help-head"><strong>Que signifie chaque choix ?</strong><span>Aucune de ces décisions ne modifie le catalogue maintenant. Elles seront appliquées uniquement lors de l’étape finale d’intégration.</span></div>${reviewDecisionEntries(entityType).map(([value,d])=>{const display=migrationDecisionDisplay(entity,value,businessEntities);return `<div class="migration-review-decision-help-item" data-decision-help-item="${value}"><strong>${esc(display.label||d.label)}</strong><span>${esc(value==='use_legacy'&&display.short?display.short:d.detail)}</span></div>`;}).join('')}</div>`;
  }
  const reviewTypeLabel=t=>({
    theme:'THÉMATIQUE',chapter:'CHAPITRE',situation:'SITUATION',
    answer:'RÉPONSE',profile:'PROFIL',survey_meta:'INFORMATIONS DU DIAGNOSTIC',
    translation:'TRADUCTION'
  })[t]||String(t||'ÉLÉMENT').toUpperCase();

  const reviewCmpLabel=s=>s==='exact_match'?'Déjà présent':s==='possible_variant'?'Variante':'Nouveau';

  function migrationDecisionEntityTitle(e){
    const p=e?.source_payload||{};
    if(e?.entity_type==='profile')return migrationPlainText(p.title||p.raw?.title)||`Profil #${e?.legacy_id||'—'}`;
    if(e?.entity_type==='chapter')return migrationPlainText(p.title)||`Chapitre #${e?.legacy_id||'—'}`;
    return migrationPlainText(p.content||p.title||p.label)||`${reviewTypeLabel(e?.entity_type)} #${e?.legacy_id||'—'}`;
  }
  function migrationDecisionDisplay(entity,value,businessEntities=[]){
    const def=reviewDecisionDefinitions[value]||reviewDecisionDefinitions.pending;
    if(value!=='use_legacy')return {label:def.label,short:def.short};
    const p=entity?.source_payload||{};
    if(entity?.entity_type==='chapter'&&p.choiceGroup){
      return {label:'Intégrer le chapitre alternatif',short:`Créer « ${p.title||'ce chapitre'} » comme alternative${p.alternativeToTitle?` à « ${p.alternativeToTitle} »`:''}.`};
    }
    const parentAlt=businessEntities.find(x=>x.entity_type==='chapter'&&String(x.legacy_id)===String(entity?.legacy_parent_id||'')&&x.source_payload?.choiceGroup);
    let answerAlt=false;
    if(entity?.entity_type==='answer'){
      const parentSituation=businessEntities.find(x=>x.entity_type==='situation'&&String(x.legacy_id)===String(entity?.legacy_parent_id||''));
      if(parentSituation){
        answerAlt=businessEntities.some(ch=>ch.entity_type==='chapter'&&ch.source_payload?.choiceGroup&&String(ch.legacy_id)===String(parentSituation.legacy_parent_id||''));
      }
    }
    if(parentAlt||answerAlt){
      return {label:'Intégrer avec le chapitre alternatif',short:'Ajouter ce contenu avec le nouveau chapitre alternatif.'};
    }
    return {label:def.label,short:def.short};
  }

  function migrationDecisionDate(value){
    if(!value)return 'Date non disponible';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return 'Date non disponible';
    return d.toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  }
  function migrationDecisionHistoryHtml(entityList){
    const rows=(entityList||[])
      .filter(e=>e.reviewed_at&&e.review_status&&e.review_status!=='pending')
      .sort((a,b)=>new Date(b.reviewed_at||0)-new Date(a.reviewed_at||0));
    if(!rows.length)return '';
    return `<details class="migration-review-decision-history" data-review-decision-history ${rows.length?'open':''}>
      <summary>
        <span class="migration-review-round">›</span>
        <span><strong>Mes décisions enregistrées</strong> · <span data-review-history-count>${rows.length}</span></span>
      </summary>
      <div class="migration-review-decision-history-body">
        <p class="hint">Ce récapitulatif montre la décision actuellement enregistrée pour chaque élément que tu as traité manuellement. Si tu modifies une décision, cette ligne sera mise à jour.</p>
        <div data-review-history-list>
          ${rows.map(e=>{
            const def=migrationDecisionDisplay(e,e.review_status,entityList||[]);
            const title=migrationDecisionEntityTitle(e);
            return `<article class="migration-review-decision-history-row" data-review-history-entity="${esc(e.id)}">
              <div>
                <span class="admin-migration-scope">${reviewTypeLabel(e.entity_type)}</span>
                <strong>${esc(title)}</strong>
                <small>Ancien ID ${esc(e.legacy_id)} · ${esc(migrationDecisionDate(e.reviewed_at))}</small>
              </div>
              <span class="migration-review-decision-history-choice">${esc(def.label)}</span>
            </article>`;
          }).join('')}
        </div>
      </div>
    </details>`;
  }

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
        if(loc==='fr'){
          const frValue=p.content||row.content||'';
          if(!frValue||migrationIsTechnicalCountryLabel(frValue))missing.push('texte');
        }else if(!row.content)missing.push('texte');
      }
      if(missing.length)out.push({locale:loc,missing,availableTitle:row.title||'',availableContent:row.content||''});
    }
    return out;
  }
  function reviewRequiredLocales(e,context={}){
    if(['situation','answer'].includes(e.entity_type)){
      return migrationVisibleLocales(e,context).map(x=>String(x||'').toLowerCase());
    }
    return (e.source_payload?.activeLocales||[]).map(x=>String(x||'').toLowerCase());
  }
  function translationMissingInfoForContext(e,context={}){
    const allowed=new Set(reviewRequiredLocales(e,context));
    return translationMissingInfo(e).filter(x=>!allowed.size||allowed.has(String(x.locale||'').toLowerCase()));
  }
  function activeTranslationMissing(e,context={}){return translationMissingInfoForContext(e,context).length>0;}
  function translationReviewHtml(e,context={}){
    const p=e.source_payload||{},missing=translationMissingInfoForContext(e,context),tr=p.translations||{};
    if(!missing.length)return'';
    const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return `<div class="migration-review-translation-detail">${missing.map(m=>{
      const loc=m.locale.toUpperCase(),row=tr[m.locale]||{};
      const refTitle=p.title||tr.fr?.title||'',refSummary=clean(p.summary||tr.fr?.summary||''),refContent=clean(p.content||tr.fr?.content||'');
      if(m.locale==='fr'&&['situation','answer'].includes(e.entity_type)){
        const source=migrationBestSourceTranslation(p,['en','es','br','de','it','ja','ko-kr','zf','zh','pt','nl','pl','ro','ru','sk','sv-se','tr','bg']);
        const sourceCode=(source.locale||'').toUpperCase();
        return `<div class="migration-review-translation-card"><div class="migration-review-translation-head"><span>FR</span><strong>Français</strong><em>traduction à compléter</em></div><div class="migration-review-fr-missing-notice"><strong>⚠ Traduction française à compléter</strong><p>Le champ FR historique est un repère technique et non une traduction exploitable.</p></div><div class="migration-review-translation-grid"><div><span>Texte source disponible${sourceCode?' — '+esc(sourceCode):''}</span><strong>${esc(source.text||'—')}</strong></div></div><button type="button" class="button button-secondary migration-translation-edit" data-translation-edit="${e.id}" data-locale="fr">Traduire en français</button></div>`;
      }
      return `<div class="migration-review-translation-card"><div class="migration-review-translation-head"><span>${esc(loc)}</span><strong>${m.locale==='en'?'English':esc(m.locale)}</strong><em>${m.missing.map(x=>esc(x)).join(' · ')} manquant${m.missing.length>1?'s':''}</em></div><div class="migration-review-translation-grid"><div><span>Contenu source disponible</span><strong>${esc(row.title||row.content||'—')}</strong>${e.entity_type==='profile'?`<small><b>Résumé :</b> ${row.summary?esc(clean(row.summary)):'<mark>À compléter</mark>'}</small><small><b>Texte :</b> ${row.content?esc(clean(row.content)):'<mark>À compléter</mark>'}</small>`:''}</div></div><button type="button" class="button button-secondary migration-translation-edit" data-translation-edit="${e.id}" data-locale="${esc(m.locale)}">Compléter la traduction</button></div>`;
    }).join('')}</div>`;
  }

  function migrationReviewLanguageHtml(e,context={}){
    const p=e.source_payload||{},c=e.comparison||{},target=c.targetPayload||{},active=new Set((p.activeLocales||[]).map(x=>String(x).toLowerCase())),dormant=new Set((p.dormantLocales||[]).map(x=>String(x).toLowerCase())),newCatalogMode=context.newCatalogMode===true;
    const isNewContent=c.status==='new'&&!c.targetEntityId&&!e.target_entity_id;
    const importOnlyMode=newCatalogMode||isNewContent;
    const activeOnly=[...new Set(['fr',...(p.activeLocales||[])].map(x=>String(x||'').toLowerCase()).filter(Boolean))];
    const baseLocales=importOnlyMode
      ? (['situation','answer'].includes(e.entity_type)?migrationVisibleLocales(e,context):activeOnly)
      : (['situation','answer'].includes(e.entity_type)?migrationVisibleLocales(e,context):[...new Set(['fr',...Object.keys(p.translations||{}),...Object.keys(target.translations||{}),...(p.activeLocales||[]),...(p.dormantLocales||[])])]);
    const locales=[...new Set(baseLocales.map(x=>String(x||'').toLowerCase()).filter(Boolean))].sort((a,b)=>a==='fr'?-1:b==='fr'?1:a.localeCompare(b,'fr'));
    if(!locales.length)return'';
    const diffs=new Set(migrationLanguageDifferences(c));
    const clean=v=>migrationPlainText(v);
    const histFor=loc=>{
      const row=p.translations?.[loc]||{};
      if(e.entity_type==='profile')return{title:loc==='fr'?(p.title||row.title):row.title,summary:loc==='fr'?(p.summary||row.summary):row.summary,content:loc==='fr'?(p.content||row.content):row.content};
      if(e.entity_type==='theme')return{introduction:loc==='fr'?(p.introduction||row.introduction||row.content):(row.introduction||row.content)};
      if(e.entity_type==='chapter')return{title:loc==='fr'?(p.title||row.title):row.title};
      if(['situation','answer'].includes(e.entity_type)){const shown=migrationDisplayTranslation(p,loc);return{content:shown.text};}
      return{content:loc==='fr'?(p.content||row.content):row.content};
    };
    const studioFor=loc=>{
      if(loc==='fr'){
        if(e.entity_type==='profile')return{title:target.title,summary:target.summary,content:target.content};
        if(e.entity_type==='theme')return{introduction:target.introduction_html};
        if(e.entity_type==='chapter')return{title:target.title};
        return{content:target.content};
      }
      return target.translations?.[loc]||{};
    };
    const panels=locales.map((loc,index)=>{
      const h=histFor(loc),st=studioFor(loc),code=loc.toUpperCase(),missing=diffs.has(`translation_missing:${loc}`),different=diffs.has(`translation_differs:${loc}`),isDormant=dormant.has(loc)&&!active.has(loc);
      const frRaw=loc==='fr'&&['situation','answer'].includes(e.entity_type)?migrationTranslationText(p,'fr'):'';
      const frNeedsTranslation=loc==='fr'&&['situation','answer'].includes(e.entity_type)&&(!frRaw||migrationIsTechnicalCountryLabel(frRaw));
      let body='';
      if(importOnlyMode){
        if(e.entity_type==='profile'){
          body=`<div class="migration-review-language-columns"><div><span>Contenu à importer</span><p><b>${esc(clean(h.title)||'—')}</b></p><p>${esc(clean(h.summary)||'—')}</p><p>${esc(clean(h.content)||'—')}</p>${loc==='fr'?`<small>Score ${esc(p.scoringRangeMin??p.scoring_min??'—')} → ${esc(p.scoringRangeMax??p.scoring_max??'—')}</small>`:''}</div></div>`;
        }else if(e.entity_type==='theme'){
          body=`<div class="migration-review-language-columns"><div><span>Introduction à importer</span><p>${esc(clean(h.introduction)||'—')}</p></div></div>`;
        }else{
          const hv=clean(h.title||h.content);
          if(frNeedsTranslation){
            const english=clean(migrationTranslationText(p,'en'));
            const source=migrationBestSourceTranslation(p,['en','es','br','de','it','ja','ko-kr','zf','zh','pt','nl','pl','ro','ru','sk','sv-se','tr','bg']);
            const sourceCode=(source.locale||'').toUpperCase();
            body=`<div class="migration-review-fr-missing-notice"><strong>⚠ Traduction française à compléter</strong><p>Le champ FR historique est un repère technique. Le vrai contenu disponible est affiché ci-dessous comme source de traduction.</p></div><div class="migration-review-language-columns"><div><span>Texte source disponible${sourceCode?' — '+esc(sourceCode):''}</span><p>${esc(clean(source.text)||hv||'—')}</p>${e.entity_type==='answer'?`<small>Score ${esc(p.scoreValue??p.score??'—')}</small>`:''}</div></div><button type="button" class="button button-secondary migration-translation-edit" data-translation-edit="${e.id}" data-locale="fr">Traduire en français</button>`;
          }else{
            body=`<div class="migration-review-language-columns"><div><span>Contenu à importer</span><p>${esc(hv||'—')}</p>${e.entity_type==='answer'?`<small>Score ${esc(p.scoreValue??p.score??'—')}</small>`:''}</div></div>`;
          }
        }
      }else if(e.entity_type==='profile'){
        const dt=migrationTextDiff(clean(h.title),clean(st.title)),ds=migrationTextDiff(clean(h.summary),clean(st.summary)),dc=migrationTextDiff(clean(h.content),clean(st.content));
        body=`${migrationDiffLegend(dt.changed||ds.changed||dc.changed)}<div class="migration-review-language-profile-compare"><div class="migration-review-language-profile-side is-history"><strong>HISTORIQUE</strong><div><span>Titre</span><p class="migration-diff-text">${dt.oldHtml}</p></div><div><span>Résumé</span><p class="migration-diff-text">${ds.oldHtml}</p></div><div><span>Texte détaillé</span><p class="migration-diff-text">${dc.oldHtml}</p></div>${loc==='fr'?`<small class="migration-profile-meta"><i class="migration-profile-color-swatch" style="--migration-profile-color:${esc(p.color||'#dce6ec')}"></i> Score ${esc(p.scoringRangeMin??p.scoring_min??'—')} → ${esc(p.scoringRangeMax??p.scoring_max??'—')}${p.color?' · '+esc(p.color):''}</small>`:''}</div><div class="migration-review-language-profile-side is-studio"><strong>STUDIO ACTUEL</strong><div><span>Titre</span><p class="migration-diff-text">${dt.newHtml}</p></div><div><span>Résumé</span><p class="migration-diff-text">${ds.newHtml}</p></div><div><span>Texte détaillé</span><p class="migration-diff-text">${dc.newHtml}</p></div>${loc==='fr'?`<small class="migration-profile-meta"><i class="migration-profile-color-swatch" style="--migration-profile-color:${esc(target.color||'#dce6ec')}"></i> Score ${esc(target.scoring_min??'—')} → ${esc(target.scoring_max??'—')}${target.color?' · '+esc(target.color):''}</small>`:''}</div></div>`;
      }else if(e.entity_type==='theme'){
        const d=migrationTextDiff(clean(h.introduction),clean(st.introduction));
        body=`${migrationDiffLegend(d.changed)}<div class="migration-review-language-columns"><div><span>Introduction historique</span><p class="migration-diff-text">${d.oldHtml}</p></div><div><span>Introduction Studio actuelle</span><p class="migration-diff-text">${d.newHtml}</p></div></div>`;
      }else{
        const hv=clean(h.title||h.content),sv=clean(st.title||st.content),d=migrationTextDiff(hv,sv);
        body=`${migrationDiffLegend(d.changed)}<div class="migration-review-language-columns"><div><span>Historique</span><p class="migration-diff-text">${d.oldHtml}</p></div><div><span>Studio actuel</span><p class="migration-diff-text">${d.newHtml}</p></div></div>`;
      }
      let status=newCatalogMode?(frNeedsTranslation?'Traduction FR à compléter':'Disponible pour import'):'Disponible';
      if(!newCatalogMode&&missing)status=isDormant?'À récupérer · historique hors diffusion':'À récupérer : absente du Studio';
      else if(!newCatalogMode&&different)status=isDormant?'Version différente · historique hors diffusion':'À récupérer : version différente';
      else if(isDormant)status='Historique hors diffusion';
      return `<div class="migration-review-language-panel" data-review-lang-panel="${esc(e.id)}:${esc(loc)}" ${index?'hidden':''}><div class="migration-review-language-status"><strong>${esc(code)} · ${esc(migrationLanguageLabel(loc))}</strong><span class="${missing||different?'is-action':isDormant?'is-dormant':''}">${esc(status)}</span></div>${body}${(!newCatalogMode&&(missing||different))?`<p class="hint">${e.review_status==='translation_only'?'Cette langue sera récupérée sans modifier la version FR du Studio.':'Cette langue sera importée uniquement si elle est cochée dans le choix global des langues.'}</p>`:''}</div>`;
    }).join('');
    const recovery=migrationLanguageDiffLocales(c).map(x=>x.toUpperCase());
    return `<details class="migration-review-languages" ${recovery.length?'open':''}><summary><strong>Langues</strong>${migrationLanguageDiffBadge(c)}<span class="hint">Historique : ${locales.map(x=>x.toUpperCase()).join(' · ')}</span></summary><div class="migration-review-language-tabs">${locales.map((loc,index)=>`<button type="button" class="${index?'':'is-active'}" data-review-lang-tab="${esc(e.id)}:${esc(loc)}">${esc(loc.toUpperCase())}</button>`).join('')}</div>${panels}</details>`;
  }

  function reviewInfo(text){
    return `<span class="migration-review-info" tabindex="0" aria-label="${esc(text)}" title="${esc(text)}">i</span>`;
  }
  function migrationReviewCountryHtml(e){
    if(e.entity_type!=='situation')return'';
    const p=e.source_payload||{},countries=[...new Set((p.countries||[]).map(c=>String(c?.name||'').trim()).filter(Boolean))],codes=[...new Set([...(p.countryCodes||[]),...(p.country_codes||[]),...((p.countries||[]).map(c=>c?.code||c?.country_code||c?.id))].map(x=>String(x||'').trim()).filter(Boolean))];
    if(p.countryScope==='worldwide')return `<div class="migration-country-variant"><span>Portée</span><strong>WORLDWIDE · universelle</strong></div>`;
    if(!countries.length&&!codes.length)return'';
    return `<div class="migration-country-variant"><span>Pays associé${countries.length>1?'s':''}</span><strong>${esc(countries.join(' · ')||codes.join(' · '))}</strong>${codes.length?`<small>${esc(codes.join(' · '))}</small>`:''}</div>`;
  }

  function reviewCard(e,compact=false,context={}){
    const p=e.source_payload||{},c=e.comparison||{},cur=c.targetPayload||{},clean=v=>migrationPlainText(v),newCatalogMode=context.newCatalogMode===true,clientMode=context.clientMode===true;
    const isProfile=e.entity_type==='profile',isTheme=e.entity_type==='theme';
    const displaySituation=['situation','answer'].includes(e.entity_type)?migrationDisplayTranslation(p,'fr').text:'';
    const title=isProfile?clean(p.title||p.raw?.title)||`Profil #${e.legacy_id}`:isTheme?'Introduction du diagnostic':clean(displaySituation||p.content||p.title||p.label)||`${reviewTypeLabel(e.entity_type)} #${e.legacy_id}`;
    const exact=c.status==='exact_match',variant=c.status==='possible_variant',status=exact?'existing':variant?'variant':'new';
    let compare='';
    const isNewContent=c.status==='new'&&!c.targetEntityId&&!e.target_entity_id;
    if(!newCatalogMode&&!isNewContent&&!compact&&c.targetEntityId&&['theme','situation','answer','profile'].includes(e.entity_type)){
      if(isTheme){
        const histIntro=clean(p.introduction||p.translations?.fr?.introduction||p.translations?.fr?.content),studioIntro=clean(cur.introduction_html),diff=migrationTextDiff(histIntro,studioIntro);
        compare=`${migrationDifferencesHtml(c)}${migrationDiffLegend(diff.changed)}<div class="migration-review-compare"><div><span>INTRODUCTION HISTORIQUE</span><p class="migration-diff-text">${diff.oldHtml}</p></div><div><span>INTRODUCTION STUDIO ACTUELLE</span><p class="migration-diff-text">${diff.newHtml}</p></div></div>`;
      }else if(isProfile){
        const histTitle=clean(p.title||p.raw?.title),histSummary=clean(p.summary||p.raw?.summary),histContent=clean(p.content||p.raw?.content),studioTitle=clean(cur.title),studioSummary=clean(cur.summary),studioContent=clean(cur.content);
        const dTitle=migrationTextDiff(histTitle,studioTitle),dSummary=migrationTextDiff(histSummary,studioSummary),dContent=migrationTextDiff(histContent,studioContent),changed=dTitle.changed||dSummary.changed||dContent.changed;
        compare=`${migrationDifferencesHtml(c)}${migrationDiffLegend(changed)}<div class="migration-review-profile-compare"><div class="migration-review-profile-version is-history"><div class="migration-review-profile-version-head"><span>HISTORIQUE</span><strong>${p.position!=null?'Profil '+esc(p.position)+' · ':''}${esc(histTitle||'Profil historique')}</strong></div><div class="migration-review-profile-field"><span>Titre du profil</span><p class="migration-diff-text">${dTitle.oldHtml}</p></div><div class="migration-review-profile-field"><span>Résumé</span><p class="migration-diff-text">${dSummary.oldHtml}</p></div><div class="migration-review-profile-field is-detail"><span>Texte détaillé</span><p class="migration-diff-text">${dContent.oldHtml}</p></div><small>Score ${esc(p.scoringRangeMin??p.scoring_min??'—')} → ${esc(p.scoringRangeMax??p.scoring_max??'—')}${p.topScore!=null?' · plafond '+esc(p.topScore):''}${p.color?' · couleur '+esc(p.color):''}</small></div><div class="migration-review-profile-version is-studio"><div class="migration-review-profile-version-head"><span>STUDIO ACTUEL</span><strong>${esc(studioTitle||'Profil actuel')}</strong></div><div class="migration-review-profile-field"><span>Titre du profil</span><p class="migration-diff-text">${dTitle.newHtml}</p></div><div class="migration-review-profile-field"><span>Résumé</span><p class="migration-diff-text">${dSummary.newHtml}</p></div><div class="migration-review-profile-field is-detail"><span>Texte détaillé</span><p class="migration-diff-text">${dContent.newHtml}</p></div><small>Score ${esc(cur.scoring_min??'—')} → ${esc(cur.scoring_max??'—')}${cur.top_score!=null?' · plafond '+esc(cur.top_score):''}${cur.color?' · couleur '+esc(cur.color):''}</small></div></div>`;
      }else{
        const hist=clean(p.content||p.title),studio=clean(cur.content||cur.title),diff=migrationTextDiff(hist,studio);
        compare=`${migrationDifferencesHtml(c)}${migrationDiffLegend(diff.changed)}<div class="migration-review-compare"><div><span>HISTORIQUE</span><p class="migration-diff-text">${diff.oldHtml}</p>${e.entity_type==='answer'?`<small>Score ${esc(p.scoreValue??p.score??'—')}${p.isBest===true||p.is_best===true?' · meilleure réponse':''}</small>`:''}</div><div><span>STUDIO ACTUEL</span><p class="migration-diff-text">${diff.newHtml}</p>${e.entity_type==='answer'?`<small>Score ${esc(cur.score??'—')}${cur.is_best===true?' · meilleure réponse':''}</small>`:''}</div></div>`;
      }
    }
    const decision=e.review_status||(exact?'keep_current':'pending'),missing=activeTranslationMissing(e,context),answerContext=!newCatalogMode&&e.entity_type==='answer'&&Array.isArray(c.currentSiblingAnswers)&&c.currentSiblingAnswers.length?`<div class="migration-review-answer-context"><span>Réponses actuellement rattachées à cette situation dans Studio</span><ul>${c.currentSiblingAnswers.map(a=>`<li>${esc(a.content||'—')} <b>— score ${esc(a.score??'—')}</b></li>`).join('')}</ul></div>`:'';
    const languageDiff=migrationLanguageDifferences(c).length>0;
    const countryHtml=migrationReviewCountryHtml(e);
    const statusBadge=clientMode?`<span class="migration-review-status new">À copier dans le client</span>`:(newCatalogMode||isNewContent)?`<span class="migration-review-status new">À importer</span>`:`<span class="migration-review-status ${status}">${reviewCmpLabel(c.status)}</span>${migrationLanguageDiffBadge(c)}`;
    const decisionHtml=clientMode?`<div class="migration-review-decision"><div class="migration-review-decision-current"><strong>Copie historique</strong><span>Ce contenu sera copié tel quel dans la campagne du client.</span></div></div>`:newCatalogMode?`<div class="migration-review-decision"><div class="migration-review-decision-current"><strong>Décision globale</strong><span>Inclus dans le nouveau catalogue de référence</span></div></div>`:`<div class="migration-review-decision"><div class="migration-review-decision-control"><select data-review-status="${e.id}" aria-label="Décision pour ${esc(title)}">${reviewDecisionOptions(decision,e.entity_type,e,context.businessEntities||[])}</select><button type="button" class="migration-review-decision-help" data-decision-help aria-label="Aide sur les décisions">?</button></div>${reviewDecisionHelpHtml(decision,e.entity_type,e,context.businessEntities||[])}</div>`;
    return `<article class="migration-review-row" data-review-card data-cmp="${status}" data-pending="${(newCatalogMode||clientMode)?'0':decision==='pending'?'1':'0'}" data-translations="${missing?'1':'0'}" data-language-recover="${languageDiff?'1':'0'}"><div class="migration-review-main"><div class="migration-review-heading"><span class="admin-migration-scope">${reviewTypeLabel(e.entity_type)}${isProfile&&p.position!=null?' '+esc(p.position):''}</span>${statusBadge}${missing?`<span class="migration-review-translation-warning">Traduction à compléter</span>`:''}${isTheme?'':`<span class="migration-review-context-note">Contexte parent</span>`}</div><strong>${esc(title)}</strong><small>Ancien ID ${esc(e.legacy_id)}</small>${countryHtml}${compare}${migrationReviewLanguageHtml(e,context)}${answerContext}${translationReviewHtml(e,context)}</div>${decisionHtml}</article>`;
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
      $('#migration-review-title').textContent=(data.batch?.scope==='client'?'Contrôle avant import client — ':'Revue des décisions — ')+(data.batch?.name||data.batch?.source_customer_name||'Import historique');

      const contentEntities=entities.filter(x=>!['theme','survey_meta'].includes(x.entity_type));
      const themeEntity=entities.find(x=>x.entity_type==='theme')||null;
      const businessEntities=themeEntity?[themeEntity,...contentEntities]:contentEntities;
      const technicalEntities=entities.filter(x=>x.entity_type==='survey_meta');
      // Un profil doit rester l'un des 3 niveaux de scoring du chapitre : il ne peut jamais
      // être ajouté comme 4e profil complémentaire. Les anciennes décisions incompatibles
      // sont remises à "À décider" et seront resauvegardées explicitement.
      const invalidProfileComplementaryIds=[];
      businessEntities.forEach(entity=>{
        if(entity.entity_type==='profile'&&entity.review_status==='add_complementary'){
          invalidProfileComplementaryIds.push(String(entity.id));
          entity.review_status='pending';
        }
      });

      const children=new Map();
      entities.forEach(x=>{
        const k=String(x.legacy_parent_id||'');
        if(!children.has(k)) children.set(k,[]);
        children.get(k).push(x);
      });

      const chapters=entities.filter(x=>x.entity_type==='chapter');
      let migrationBatch=data.batch||{};const clientMode=migrationBatch.scope==='client';
      const reviewIntro=$('#migration-review-intro'),protectionTitle=$('#migration-review-protection-title'),protectionText=$('#migration-review-protection-text');
      if(clientMode){
        if(reviewIntro)reviewIntro.textContent='Étape 2 : contrôle uniquement le contenu historique qui sera copié tel quel dans le patrimoine du client. Aucune comparaison avec le catalogue Studio.';
        if(protectionTitle)protectionTitle.textContent='Copie historique sans comparaison';
        if(protectionText)protectionText.textContent='Aucun choix de remplacement n’est nécessaire : les données du master seront copiées telles quelles dans une nouvelle campagne du client. Le pack et les utilisateurs restent intacts.';
      }else{
        if(reviewIntro)reviewIntro.textContent='Étape 2 : examine les différences et enregistre les décisions métier. Aucune modification du catalogue n’est appliquée à ce stade.';
        if(protectionTitle)protectionTitle.textContent='Catalogue actuel protégé';
        if(protectionText)protectionText.textContent='Aucune décision ci-dessous ne modifie encore le catalogue. Les choix enregistrés restent préparatoires jusqu’à une étape finale d’intégration distincte.';
      }
      const metaEntity=technicalEntities.find(x=>x.entity_type==='survey_meta')||null;
      const reviewCountryLocaleMap=migrationCountryLocaleMap(metaEntity?.source_payload||{});
      const baseReviewContext={countryLocaleMap:reviewCountryLocaleMap};
      const n={
        pending:businessEntities.filter(x=>x.review_status==='pending'&&x.comparison?.status!=='exact_match').length,
        variant:businessEntities.filter(x=>x.comparison?.status==='possible_variant'&&x.review_status==='pending').length,
        new:contentEntities.filter(x=>x.comparison?.status==='new'&&x.review_status==='pending').length,
        existing:contentEntities.filter(x=>x.comparison?.status==='exact_match').length,
        translations:clientMode?0:businessEntities.filter(x=>{
          if(!activeTranslationMissing(x,baseReviewContext))return false;
          const required=reviewRequiredLocales(x,baseReviewContext);
          return required.some(loc=>draftsByKey.get(`${x.id}:${loc}`)?.status!=='validated');
        }).length,
        languageRecover:migrationRecoveryLocales(businessEntities).length,
        total:contentEntities.length
      };
      const availableMigrationLocales=[...new Set(businessEntities.flatMap(e=>{
        const p=e.source_payload||{};
        const active=(p.activeLocales||[])
          .map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-'))
          .filter(Boolean);
        return active.length?active:['fr'];
      }).map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))]
        .sort((a,b)=>a==='fr'?-1:b==='fr'?1:a.localeCompare(b,'fr'));
      const hasExplicitLanguageChoice=migrationBatch.summary?.migrationLanguageSelectionExplicit===true;
      const savedMigrationLocales=(hasExplicitLanguageChoice&&Array.isArray(migrationBatch.summary?.migrationLanguageSelection))
        ? migrationBatch.summary.migrationLanguageSelection.map(x=>String(x||'').toLowerCase())
        : (clientMode ? availableMigrationLocales : ['fr']);
      const selectedMigrationLocales=new Set(savedMigrationLocales);
      selectedMigrationLocales.add('fr');
      const newCatalogMode=Boolean(themeEntity && !themeEntity.target_entity_id && themeEntity.source_payload?.catalogCreateIfMissing===true);
      const reviewContext={newCatalogMode,clientMode,countryLocaleMap:reviewCountryLocaleMap,businessEntities};

      const chapterHtml=chapters.map(ch=>{
        const direct=children.get(String(ch.legacy_id))||[];
        const situations=direct.filter(x=>x.entity_type==='situation');
        const profiles=direct.filter(x=>x.entity_type==='profile');
        const answers=situations.flatMap(si=>(children.get(String(si.legacy_id))||[]).filter(x=>x.entity_type==='answer'));
        const treeEntities=[ch,...situations,...answers,...profiles];
        const activeLocales=[...new Set(treeEntities.flatMap(e=>{
          const p=e.source_payload||{};
          const active=Array.isArray(p.activeLocales)?p.activeLocales:[];
          return active.map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean);
        }))].sort((a,b)=>a==='fr'?-1:b==='fr'?1:a.localeCompare(b,'fr'));
        if(!activeLocales.includes('fr'))activeLocales.unshift('fr');
        const countryCodes=(ch.source_payload?.countryCodes||[]).map(x=>String(x||'').toUpperCase()).filter(Boolean);
        const countryLabel=ch.source_payload?.countryScope==='worldwide'?'🌍 Tous pays · WORLDWIDE':`Périmètre culturel : ${countryCodes.length?countryCodes.map(libraryCountryLabel).join(' · '):'—'}`;
        const isNewAlternative=Boolean(ch.source_payload?.choiceGroup&&!ch.target_entity_id);
        return `<details class="migration-review-chapter" data-review-chapter>
          <summary>
            <span class="migration-review-round">›</span>
            <div><strong>${esc(ch.source_payload?.title||'Chapitre')}</strong>${ch.source_payload?.choiceGroup?`<div class="migration-alternative-summary"><span><b>Chapitre alternatif à :</b> ${esc(ch.source_payload?.alternativeToTitle||'chapitre de référence')}</span><span>${esc(countryLabel)}</span><span><b>Langues actives :</b> ${esc(activeLocales.map(x=>x.toUpperCase()).join(' · '))}</span>${isNewAlternative?`<button type="button" class="button button-secondary button-small" data-review-alt-bulk="${esc(ch.id)}">Intégrer tout ce chapitre comme alternative</button>`:''}</div>`:''}<small><span data-review-chapter-situations data-total-situations="${situations.length}">${situations.length} situations</span> · ${answers.length} réponses · <span data-review-chapter-profiles data-total-profiles="${profiles.length}">${profiles.length} profils</span></small></div>
          </summary>
          <div class="migration-review-chapter-body">
            ${reviewCard(ch,true,reviewContext)}
            ${profiles.length?`<details class="migration-review-subgroup migration-review-profile-subgroup" data-review-profile-group data-total-profiles="${profiles.length}">
              <summary><span class="migration-review-round">›</span><span><strong>Profils</strong> · <span data-review-profile-count>${profiles.length} profil${profiles.length>1?'s':''}</span></span></summary>
              <div>${profiles.map(x=>reviewCard(x,false,reviewContext)).join('')}</div>
            </details>`:''}
            ${situations.length?`<details class="migration-review-subgroup migration-review-situations-subgroup" data-review-situations-group>
              <summary><span class="migration-review-round">›</span><span><strong>Situations</strong> · <span data-review-situation-count data-total-situations="${situations.length}">${situations.length} situation${situations.length>1?'s':''}</span></span></summary>
              <div>${situations.map(si=>{
                const answers=(children.get(String(si.legacy_id))||[]).filter(x=>x.entity_type==='answer');
                return `<div class="migration-review-situation-group">
                  ${reviewCard(si,false,reviewContext)}
                  ${answers.length?`<details class="migration-review-subgroup">
                    <summary><span class="migration-review-round">›</span>${answers.length} réponses</summary>
                    <div>${answers.map(x=>reviewCard(x,true,{...reviewContext,allowedLocales:migrationVisibleLocales(si,reviewContext)})).join('')}</div>
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
              <h3>${clientMode?`Copie historique vers ${esc(migrationBatch.organization_name||'le client sélectionné')}`:newCatalogMode?'Nouvelle thématique · validation globale du référentiel':`${n.pending} décision${n.pending>1?'s':''} réellement à prendre`}</h3>
              <p>${clientMode?'Contrôle les données historiques avant copie. Elles ne sont pas rapprochées du catalogue actuel : elles seront recréées telles quelles dans une campagne rattachée au client sélectionné.':newCatalogMode?'Aucune référence Studio n’existe encore pour cette thématique. Contrôle le contenu puis valide le lot en une seule fois comme nouveau catalogue de référence Me&YouToo.':"Studio a déjà rapproché automatiquement l’historique du catalogue actuel. Commence par les différences : tu n’as pas à relire tout le diagnostic."}</p>
            </div>
          </div>
          <div class="migration-review-steps">
            <div><b>1</b><span><strong>Examiner</strong><small>Contrôle pays, contenus, réponses, profils et traductions.</small></span></div>
            <div><b>2</b><span><strong>${clientMode?'Contrôler':newCatalogMode?'Valider globalement':'Choisir'}</strong><small>${clientMode?'Aucune comparaison : tout le contenu historique du lot est prévu pour être copié.':newCatalogMode?'Une seule décision pour créer le nouveau référentiel.':'Tu indiques ce qu’il faut conserver, récupérer ou ignorer.'}</small></span></div>
            <div><b>3</b><span><strong>Tester dans staging</strong><small>${clientMode?'Aucune campagne ni donnée de pack n’est créée avant ce test.':'Aucune modification du catalogue avant le test d’intégration.'}</small></span></div>
          </div>
        </section>

        ${newCatalogMode?`<section class="migration-review-global-decision">
          <div>
            <strong>Nouvelle thématique — aucun catalogue Studio existant</strong>
            <span>Les ${businessEntities.length} éléments métier de ce lot peuvent être définis en une seule fois comme référence du nouveau catalogue. La revue reste disponible pour contrôler chapitres, pays, réponses, scores, profils et traductions avant le test staging.</span>
          </div>
          <button type="button" class="button button-primary" id="migration-use-legacy-all">Importer tout ce lot comme nouvelle référence Me&YouToo</button>
        </section>`:''}

        <section class="migration-review-global-languages">
          <div class="migration-review-global-languages-head">
            <div><strong>${clientMode?'Langues de la campagne historique':'Langues à intégrer au catalogue'}</strong><span>${clientMode?'Elles viennent directement du master client et seront copiées avec la campagne.':'Choix global pour tout le diagnostic. Les langues proposées viennent directement du survey historique ; les onglets des contenus servent uniquement à contrôler les traductions.'}</span></div>
          </div>
          <div class="migration-review-global-language-options">
            ${availableMigrationLocales.map(loc=>loc==='fr'
              ? `<label class="is-required"><input type="checkbox" checked disabled> <span><b>${esc(migrationLanguageLabel(loc))} (${esc(loc.toUpperCase())})</b><small>Langue de gestion/référence · obligatoire</small></span></label>`
              : `<label><input type="checkbox" data-migration-global-locale="${esc(loc)}" ${selectedMigrationLocales.has(loc)?'checked':''}> <span><b>${esc(migrationLanguageLabel(loc))} (${esc(loc.toUpperCase())})</b><small>Traduction historique disponible${(themeEntity?.source_payload?.activeLocales||[]).map(x=>String(x).toLowerCase()).includes(loc)?' · active dans le survey':''}</small></span></label>`
            ).join('')}
          </div>
          <div class="migration-review-global-language-state" data-migration-language-state></div>
        </section>

        ${clientMode?`<div class="migration-review-toolbar"><div class="migration-review-filters" role="group" aria-label="Filtres de contrôle"><button type="button" data-review-filter="all">Tout voir <b>${n.total}</b></button></div><div class="migration-review-expand"><button type="button" data-review-expand="1">Tout déplier</button><button type="button" data-review-expand="0">Tout replier</button></div></div>`:newCatalogMode?`<div class="migration-review-toolbar"><div class="migration-review-filters" role="group" aria-label="Filtres de revue"><button type="button" data-review-filter="translations">Traductions à compléter <b>${n.translations}</b></button><button type="button" data-review-filter="all">Tout voir <b>${n.total}</b></button></div><div class="migration-review-expand"><button type="button" data-review-expand="1">Tout déplier</button><button type="button" data-review-expand="0">Tout replier</button></div></div>`:`<div class="migration-review-toolbar">
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
              Traductions à compléter <b>${n.translations}</b>${reviewInfo('Uniquement les langues actives du diagnostic pour lesquelles le contenu historique lui-même est incomplet. Les traductions historiques hors diffusion ne sont pas comptées.')}
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
        </div>`}

        <div class="migration-review-filter-summary" id="migration-review-filter-summary"></div>

        <div class="migration-review-auto-note">
          <strong>${clientMode?'Aucune comparaison avec le catalogue':newCatalogMode?'Aucune référence Studio à remplacer':`${n.existing} éléments déjà rapprochés automatiquement`}</strong>
          <span>${clientMode?'Les chapitres, situations, réponses, scores et profils proviennent uniquement du master historique et seront copiés dans le patrimoine du client.':newCatalogMode?'Ce lot crée le nouveau référentiel. Les langues se choisissent une seule fois dans « Langues à intégrer au catalogue » et ne créent aucune variante métier.':'Le contenu FR est comparé séparément. Les autres langues se choisissent une seule fois dans « Langues à intégrer au catalogue » : elles ne créent aucune variante métier.'}</span>
          ${clientMode?'':reviewInfo('Un rapprochement automatique n’intègre rien. Il prépare uniquement la décision finale.')}
        </div>

        ${clientMode?'':`<div id="migration-review-decision-history-slot">${migrationDecisionHistoryHtml(businessEntities)}</div>`}

        ${themeEntity?`<section class="migration-review-diagnostic-section"><div class="migration-review-diagnostic-head"><strong>Introduction du diagnostic</strong><span>${clientMode?'Sera copiée telle quelle avec la campagne historique.':newCatalogMode?'Contenu de référence à importer.':'Comparée séparément du catalogue Studio existant.'}</span></div>${reviewCard(themeEntity,false,reviewContext)}</section>`:''}

        ${technicalEntities.length?`<details class="migration-review-technical-block">
          <summary><span class="migration-review-round">›</span>Informations techniques de migration ${reviewInfo('Provenance, ancien ID, langues et métadonnées nécessaires à la traçabilité. Aucune décision métier à prendre ici.')}</summary>
          <div>${technicalEntities.map(reviewTechnicalCard).join('')}</div>
        </details>`:''}

        <div class="migration-review-empty" data-review-empty hidden>
          <strong>Aucun élément dans ce filtre.</strong>
          <span>Choisis un autre filtre pour poursuivre la revue.</span>
        </div>

        ${chapterHtml}
        <section class="admin-library-note migration-review-final-step" id="migration-review-final-step" ${(n.pending>0||(!newCatalogMode&&n.translations>0))?'hidden':''}>
          <strong>ÉTAPE 3 SUR 3 · TEST D’INTÉGRATION STAGING</strong>
          <span>${clientMode?'Le contenu historique est prêt. Le bouton principal en bas de la fenêtre va créer la campagne de test dans le client sélectionné. Le pack actuel et les utilisateurs ne seront pas modifiés. Un rollback supprimera uniquement les données créées par ce lot.':`Toutes les décisions métier sont enregistrées. ${newCatalogMode&&n.translations>0?`${n.translations} traduction${n.translations>1?'s':''} FR reste${n.translations>1?'nt':''} à compléter, mais cela ne bloque pas le test staging. `:''}Le bouton principal en bas de la fenêtre permet maintenant d’appliquer ce lot dans le catalogue de staging. Studio créera un snapshot permettant d’annuler ensuite toutes les modifications et créations du test.`}</span>
        </section>`;

      const filterButtons=$$('[data-review-filter]');
      const cards=$$('[data-review-card]');
      const chaptersEls=$$('[data-review-chapter]');
      const empty=$('[data-review-empty]');
      const saveBtn=$('#migration-review-save');
      const saveState=$('#migration-review-save-state');
      const dirty=new Map();
      invalidProfileComplementaryIds.forEach(id=>dirty.set(id,'pending'));

      const languageState=$('[data-migration-language-state]');
      const refreshGlobalLanguageState=()=>{
        const selected=['FR',...$$('[data-migration-global-locale]:checked').map(el=>String(el.dataset.migrationGlobalLocale||'').toUpperCase())];
        if(languageState)languageState.innerHTML=`<strong>Sera intégré : ${selected.join(' · ')}</strong><span>La sélection s’applique à tous les contenus disposant de cette traduction historique.</span>`;
      };
      $$('[data-migration-global-locale]').forEach(input=>input.addEventListener('change',async()=>{
        const intendedChecked=input.checked;
        const locale=String(input.dataset.migrationGlobalLocale||'').toLowerCase();
        refreshGlobalLanguageState();
        const locales=['fr',...$$('[data-migration-global-locale]:checked').map(el=>String(el.dataset.migrationGlobalLocale||'').toLowerCase())];
        input.disabled=true;
        try{
          const response=await StudioAPI.request(`/api/admin/migrations/${migrationBatch.id}/languages`,{method:'PATCH',body:JSON.stringify({locales})});
          if(response?.batch) migrationBatch=response.batch;
          selectedMigrationLocales.clear();
          locales.forEach(loc=>selectedMigrationLocales.add(loc));
          input.checked=intendedChecked;
          input.closest('label')?.classList.toggle('is-selected',intendedChecked);
          refreshGlobalLanguageState();
        }catch(error){
          input.checked=!intendedChecked;
          input.closest('label')?.classList.toggle('is-selected',!intendedChecked);
          refreshGlobalLanguageState();
          showError(error?.message||'Impossible d’enregistrer le choix de langue.');
        }finally{
          input.disabled=false;
        }
      }));
      refreshGlobalLanguageState();

      const globalReferenceBtn=$('#migration-use-legacy-all');
      if(globalReferenceBtn)globalReferenceBtn.onclick=async()=>{
        const ok=await StudioModal.confirm({
          eyebrow:'NOUVELLE THÉMATIQUE',
          title:'Définir tout ce lot comme nouveau catalogue de référence ?',
          message:`Cette décision marquera en une seule fois les ${businessEntities.length} éléments métier du lot comme contenus à intégrer. Aucune écriture dans le catalogue n’est encore faite : tu pourras toujours contrôler la revue avant le test staging.`,
          cancelLabel:'Annuler',confirmLabel:'Valider tout le lot'
        });
        if(!ok)return;
        globalReferenceBtn.disabled=true;globalReferenceBtn.textContent='Validation du lot…';
        try{
          const result=await StudioAPI.request(`/api/admin/migrations/${migrationBatch.id}/review/use-legacy-all`,{method:'POST',body:'{}'});
          businessEntities.forEach(entity=>{if(entity.comparison?.status!=='exact_match')entity.review_status='use_legacy';});
          dirty.clear();
          syncDecisionControlsFromData();
          refreshDecisionHistory();
          refreshReviewCounters();
          applyReviewFilter(root.dataset.activeFilter||'all');
          updateSaveUi(`✓ ${result?.updated||businessEntities.length} éléments validés comme nouvelle référence.`);
          globalReferenceBtn.textContent='Lot validé comme nouvelle référence';
        }catch(error){
          globalReferenceBtn.disabled=false;globalReferenceBtn.textContent='Importer tout ce lot comme nouvelle référence Me&YouToo';
          showError(error?.message||'Impossible de valider globalement le lot.');
        }
      };

      const filterSummary=$('#migration-review-filter-summary');
      function reviewDecisionFor(entity){
        const sel=$(`[data-review-status="${entity.id}"]`);
        if(sel)return sel.value||'pending';
        if(dirty.has(String(entity.id)))return dirty.get(String(entity.id))||'pending';
        return entity.review_status||((entity.comparison?.status==='exact_match')?'keep_current':'pending');
      }
      function filterExplanation(f){
        const matching=businessEntities.filter(e=>{
          const decision=reviewDecisionFor(e);
          if(f==='pending')return decision==='pending'&&e.comparison?.status!=='exact_match';
          if(f==='variant')return e.comparison?.status==='possible_variant'&&decision==='pending';
          if(f==='new')return e.comparison?.status==='new'&&decision==='pending';
          if(f==='existing')return e.comparison?.status==='exact_match';
          if(f==='languages')return migrationLanguageDifferences(e.comparison).length>0;
          if(f==='translations')return activeTranslationMissing(e,reviewContext);
          return true;
        });
        const byType={};matching.forEach(e=>byType[e.entity_type]=(byType[e.entity_type]||0)+1);
        const parts=[];
        if(byType.situation)parts.push(`${byType.situation} situation${byType.situation>1?'s':''}`);
        if(byType.answer)parts.push(`${byType.answer} réponse${byType.answer>1?'s':''}`);
        if(byType.profile)parts.push(`${byType.profile} profil${byType.profile>1?'s':''}`);
        if(byType.chapter)parts.push(`${byType.chapter} chapitre${byType.chapter>1?'s':''}`);
        if(f==='languages'){
          const locales=[...new Set(matching.flatMap(e=>migrationLanguageDiffLocales(e.comparison).map(x=>x.toUpperCase())))];
          return `<strong>${locales.length} langue${locales.length>1?'s':''} à récupérer · ${matching.length} élément${matching.length>1?'s':''} concerné${matching.length>1?'s':''}</strong><span>Langue${locales.length>1?'s':''} : ${locales.join(', ')||'—'}. FR reste la base de comparaison ; EN/ES manquants ou différents sont traités ici séparément des variantes métier.</span>`;
        }
        if(f==='translations'){
          const locales=[...new Set(matching.flatMap(e=>translationMissingInfoForContext(e,reviewContext).map(x=>x.locale.toUpperCase())))];
          return `<strong>${matching.length} contenu${matching.length>1?'s':''} avec traduction historique incomplète</strong><span>Langue${locales.length>1?'s':''} concernée${locales.length>1?'s':''} : ${locales.join(', ')||'—'}. ${parts.join(' · ')}</span>`;
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
          if(activeFilter==='languages')return `${visible} ${kind}${plural} avec langue à récupérer sur ${total}`;
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
          const show=f==='all'||(f==='pending'&&c.dataset.pending==='1')||(f==='variant'&&c.dataset.cmp==='variant'&&c.dataset.pending==='1')||(f==='new'&&c.dataset.cmp==='new'&&c.dataset.pending==='1')||(f==='existing'&&c.dataset.cmp==='existing')||(f==='languages'&&c.dataset.languageRecover==='1')||(f==='translations'&&c.dataset.translations==='1');
          c.dataset.filterMatched=show?'1':'0';c.hidden=!show;
        });
        refreshNestedVisibility();
        if(f==='languages'){
          cards.filter(c=>!c.hidden&&c.dataset.languageRecover==='1').forEach(card=>{
            const details=card.querySelector('.migration-review-languages');
            if(details)details.open=true;
            const action=card.querySelector('.migration-review-language-panel .migration-review-language-status .is-action');
            const panel=action?.closest('[data-review-lang-panel]');
            if(panel){
              const key=panel.dataset.reviewLangPanel;
              card.querySelectorAll('[data-review-lang-tab]').forEach(tab=>tab.classList.toggle('is-active',tab.dataset.reviewLangTab===key));
              card.querySelectorAll('[data-review-lang-panel]').forEach(p=>p.hidden=p.dataset.reviewLangPanel!==key);
              card.classList.add('is-language-focus');
            }
          });
        }else cards.forEach(c=>c.classList.remove('is-language-focus'));
        if(filterSummary)filterSummary.innerHTML=filterExplanation(f);
      }

      filterButtons.forEach(b=>b.addEventListener('click',ev=>{
        ev.preventDefault();ev.stopPropagation();applyReviewFilter(b.dataset.reviewFilter);
      }));

      $$('[data-review-lang-tab]').forEach(b=>b.addEventListener('click',ev=>{
        ev.preventDefault();ev.stopPropagation();
        const [entityId,locale]=String(b.dataset.reviewLangTab||'').split(':');
        $$(`[data-review-lang-tab^="${entityId}:"]`).forEach(x=>x.classList.toggle('is-active',x===b));
        $$(`[data-review-lang-panel^="${entityId}:"]`).forEach(panel=>{panel.hidden=panel.dataset.reviewLangPanel!==`${entityId}:${locale}`;});
      }));

      $$('[data-review-expand]').forEach(b=>b.addEventListener('click',ev=>{
        ev.preventDefault();ev.stopPropagation();
        $$('[data-review-chapter],.migration-review-subgroup').filter(x=>!x.hidden).forEach(x=>x.open=b.dataset.reviewExpand==='1');
      }));

      function liveReviewCounts(){
        return {
          pending:businessEntities.filter(x=>reviewDecisionFor(x)==='pending'&&x.comparison?.status!=='exact_match').length,
          variant:businessEntities.filter(x=>x.comparison?.status==='possible_variant'&&reviewDecisionFor(x)==='pending').length,
          new:contentEntities.filter(x=>x.comparison?.status==='new'&&reviewDecisionFor(x)==='pending').length,
          existing:contentEntities.filter(x=>x.comparison?.status==='exact_match').length,
          translations:businessEntities.filter(x=>activeTranslationMissing(x,reviewContext)).length,
          languages:migrationRecoveryLocales(businessEntities).length,
          languageRecover:migrationRecoveryLocales(businessEntities).length,
          total:contentEntities.length
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
        const languageLabel=root.querySelector('[data-review-language-filter-label]');
        if(languageLabel)languageLabel.textContent=counts.pending===0?'Langues prévues':'Langues à récupérer';
        const title=root.querySelector('.migration-review-welcome h3');
        if(title)title.textContent=clientMode?`Copie historique vers ${migrationBatch.organization_name||'le client sélectionné'}`:newCatalogMode?'Nouvelle thématique · validation globale du référentiel':counts.pending?`${counts.pending} décision${counts.pending>1?'s':''} réellement à prendre`:counts.translations?`Toutes les décisions sont prises · ${counts.translations} traduction${counts.translations>1?'s':''} à compléter`:'Toutes les décisions métier sont enregistrées';
        const finalStep=root.querySelector('#migration-review-final-step');
        if(finalStep)finalStep.hidden=clientMode?false:(counts.pending>0||(!newCatalogMode&&counts.translations>0));
        return counts;
      }
      function refreshDecisionHistory(){
        const slot=$('#migration-review-decision-history-slot');
        if(!slot)return;
        slot.innerHTML=migrationDecisionHistoryHtml(businessEntities);
      }
      function isReviewReadyForTest(){
        const counts=liveReviewCounts();
        return dirty.size===0&&counts.pending===0&&(clientMode||newCatalogMode||counts.translations===0);
      }
      function updateSaveUi(message=''){
        const count=dirty.size;
        const ready=isReviewReadyForTest();
        if(saveBtn){
          saveBtn.dataset.mode=ready?'apply-test':'save';
          saveBtn.textContent=ready?'Tester l’intégration dans staging':'Enregistrer mes décisions';
          saveBtn.disabled=ready?false:!count;
        }
        if(!saveState)return;
        if(message){saveState.textContent=message;return;}
        if(ready){
          const counts=liveReviewCounts();
          saveState.textContent=clientMode?'Le master client est contrôlé. Le test staging est prêt : il créera uniquement la campagne historique et pourra être annulé.':newCatalogMode&&counts.translations>0
            ? `Toutes les décisions métier sont enregistrées. ${counts.translations} traduction${counts.translations>1?'s':''} reste${counts.translations>1?'nt':''} à compléter sans bloquer le test staging.`
            : 'Toutes les décisions sont enregistrées. Le test staging est prêt à être appliqué.';
          return;
        }
        saveState.textContent=count?`${count} décision${count>1?'s':''} à enregistrer`:'Aucune modification en attente';
      }
      function syncDecisionControlsFromData(){
        $$('[data-review-status]').forEach(sel=>{
          const id=sel.dataset.reviewStatus;
          const entity=businessEntities.find(x=>String(x.id)===String(id));
          if(!entity)return;
          const exact=entity.comparison?.status==='exact_match';
          const expected=(entity.entity_type==='profile'&&entity.review_status==='add_complementary')?'pending':(entity.review_status||(exact?'keep_current':'pending'));
          sel.value=expected;
          sel.dataset.initialValue=expected;
          sel.classList.toggle('is-decided',expected!=='pending');
          const card=sel.closest('[data-review-card]');
          card?.setAttribute('data-pending',expected==='pending'?'1':'0');
          const current=card?.querySelector('[data-decision-current]');
          const def=migrationDecisionDisplay(entity,expected,businessEntities);
          if(current)current.innerHTML=`<strong>${esc(def.label)}</strong><span>${esc(def.short)}</span>`;
          card?.querySelectorAll('[data-decision-help-item]').forEach(item=>item.classList.toggle('is-current',item.dataset.decisionHelpItem===expected));
          const helpPanel=card?.querySelector('[data-decision-help-panel]');
          const helpBtn=card?.querySelector('[data-decision-help]');
          if(helpPanel)helpPanel.hidden=true;
          if(helpBtn){helpBtn.classList.remove('is-open');helpBtn.setAttribute('aria-expanded','false');}
        });
      }

      $$('[data-review-alt-bulk]').forEach(btn=>btn.onclick=async()=>{
        const chapterId=String(btn.dataset.reviewAltBulk||'');
        const chapter=businessEntities.find(e=>e.entity_type==='chapter'&&String(e.id)===chapterId);
        if(!chapter)return;
        const chapterLegacy=String(chapter.legacy_id||'');
        const direct=businessEntities.filter(e=>String(e.legacy_parent_id||'')===chapterLegacy);
        const situationIds=new Set(direct.filter(e=>e.entity_type==='situation').map(e=>String(e.legacy_id)));
        const descendants=businessEntities.filter(e=>
          e===chapter ||
          String(e.legacy_parent_id||'')===chapterLegacy ||
          (e.entity_type==='answer'&&situationIds.has(String(e.legacy_parent_id||'')))
        );
        const situationCount=descendants.filter(e=>e.entity_type==='situation').length;
        const answerCount=descendants.filter(e=>e.entity_type==='answer').length;
        const profileCount=descendants.filter(e=>e.entity_type==='profile').length;
        const ok=await StudioModal.confirm({
          eyebrow:'CHAPITRE ALTERNATIF',
          title:`Intégrer « ${chapter.source_payload?.title||'ce chapitre'} » en une seule décision ?`,
          message:`Cette décision sera enregistrée immédiatement pour le chapitre complet : ${situationCount} situation${situationCount>1?'s':''}, ${answerCount} réponse${answerCount>1?'s':''} et ${profileCount} profil${profileCount>1?'s':''}. ${chapter.source_payload?.alternativeToTitle?`Il sera proposé en alternative à « ${chapter.source_payload.alternativeToTitle} ». `:''}${chapter.source_payload?.countryScope==='worldwide'?'Sa portée restera WORLDWIDE / tous pays. ':''}L’introduction générale du diagnostic n’est pas modifiée.`,
          cancelLabel:'Annuler',
          confirmLabel:'Intégrer le chapitre complet'
        });
        if(!ok)return;
        btn.disabled=true;
        const previousLabel=btn.textContent;
        btn.textContent='Intégration du chapitre…';
        try{
          const result=await StudioAPI.request(`/api/admin/migrations/${batchId}/review/${chapter.id}/use-legacy-tree`,{method:'POST',body:'{}'});
          const updatedById=new Map((result?.entities||[]).map(e=>[String(e.id),e]));
          descendants.forEach(entity=>{
            const updated=updatedById.get(String(entity.id));
            if(updated)Object.assign(entity,updated);
            else entity.review_status='use_legacy';
            dirty.delete(String(entity.id));
          });
          syncDecisionControlsFromData();
          refreshDecisionHistory();
          const counts=refreshReviewCounters();
          applyReviewFilter(root.dataset.activeFilter||(counts.pending?'pending':'all'));
          updateSaveUi(`✓ Chapitre alternatif enregistré comme un bloc complet : ${situationCount} situation${situationCount>1?'s':''}, ${answerCount} réponse${answerCount>1?'s':''}, ${profileCount} profil${profileCount>1?'s':''}.`);
          btn.textContent='Chapitre alternatif intégré';
        }catch(error){
          btn.disabled=false;
          btn.textContent=previousLabel;
          showError(error?.message||'Impossible d’intégrer ce chapitre alternatif en une seule décision.');
        }
      });

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
          const decisionEntity=businessEntities.find(x=>String(x.id)===String(id));
          const def=migrationDecisionDisplay(decisionEntity,value,businessEntities);
          if(current)current.innerHTML=`<strong>${esc(def.label)}</strong><span>${esc(def.short)}</span>`;
          card?.querySelectorAll('[data-decision-help-item]').forEach(item=>item.classList.toggle('is-current',item.dataset.decisionHelpItem===value));
          if(value===sel.dataset.initialValue)dirty.delete(id); else dirty.set(id,value);
          refreshReviewCounters();
          const activeFilter=root.dataset.activeFilter||(newCatalogMode?'all':'pending');
          if(filterSummary)filterSummary.innerHTML=filterExplanation(activeFilter);
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
        if(saveBtn.dataset.mode==='apply-test'){
          return applyMigrationTest();
        }
        if(!dirty.size)return;
        const savedEntries=[...dirty.entries()];
        const savedCount=savedEntries.length;
        saveBtn.disabled=true;
        if(saveState)saveState.textContent='Enregistrement…';
        try{
          for(const [id,value] of savedEntries){
            const saved=await StudioAPI.request('/api/admin/migrations/'+batchId+'/review/'+id,{
              method:'PATCH',body:JSON.stringify({reviewStatus:value})
            });
            const sel=$(`[data-review-status="${id}"]`);
            if(sel)sel.dataset.initialValue=value;
            const entity=businessEntities.find(x=>String(x.id)===String(id));
            if(entity){
              if(saved?.entity)Object.assign(entity,saved.entity);
              else entity.review_status=value;
            }
          }
          dirty.clear();
          syncDecisionControlsFromData();
          refreshDecisionHistory();
          const counts=refreshReviewCounters();
          const activeFilter=root.dataset.activeFilter||(newCatalogMode?'all':'pending');
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
      refreshDecisionHistory();
      updateSaveUi();

      // Repair batches saved with the former regression: if the alternative chapter
      // itself was already accepted but its descendants stayed pending, the parent
      // decision is authoritative and must be propagated to the complete tree.
      (async()=>{
        const alternatives=businessEntities.filter(ch=>
          ch.entity_type==='chapter'&&
          ch.source_payload?.choiceGroup&&
          !ch.target_entity_id&&
          ch.review_status==='use_legacy'
        );
        let repaired=false;
        for(const chapter of alternatives){
          const chapterLegacy=String(chapter.legacy_id||'');
          const direct=businessEntities.filter(e=>String(e.legacy_parent_id||'')===chapterLegacy);
          const situationIds=new Set(direct.filter(e=>e.entity_type==='situation').map(e=>String(e.legacy_id)));
          const descendants=businessEntities.filter(e=>
            e===chapter||
            String(e.legacy_parent_id||'')===chapterLegacy||
            (e.entity_type==='answer'&&situationIds.has(String(e.legacy_parent_id||'')))
          );
          if(!descendants.some(e=>e!==chapter&&e.review_status==='pending'))continue;
          try{
            const result=await StudioAPI.request(`/api/admin/migrations/${batchId}/review/${chapter.id}/use-legacy-tree`,{method:'POST',body:'{}'});
            const updatedById=new Map((result?.entities||[]).map(e=>[String(e.id),e]));
            descendants.forEach(entity=>{
              const updated=updatedById.get(String(entity.id));
              if(updated)Object.assign(entity,updated);
              else entity.review_status='use_legacy';
              dirty.delete(String(entity.id));
            });
            repaired=true;
          }catch(error){
            console.error('Impossible de propager la décision du chapitre alternatif',error);
          }
        }
        if(repaired){
          syncDecisionControlsFromData();
          refreshDecisionHistory();
          const counts=refreshReviewCounters();
          applyReviewFilter(root.dataset.activeFilter||(counts.pending?'pending':'all'));
          updateSaveUi(counts.pending?`✓ Décision du chapitre alternatif propagée. ${counts.pending} décision${counts.pending>1?'s':''} reste${counts.pending>1?'nt':''} à prendre.`:'✓ Chapitre alternatif enregistré comme une seule décision. Toutes ses situations, réponses et profils sont intégrés avec lui.');
        }
      })();

      async function applyMigrationTest(){
        const counts=liveReviewCounts();
        if(dirty.size){updateSaveUi('Enregistre d’abord les décisions en attente avant l’intégration de test.');return;}
        if(counts.pending>0){updateSaveUi(`${counts.pending} décision${counts.pending>1?'s':''} reste${counts.pending>1?'nt':''} à prendre.`);return;}
        if(counts.translations>0&&!newCatalogMode&&!clientMode){updateSaveUi(`${counts.translations} traduction${counts.translations>1?'s':''} active${counts.translations>1?'s':''} reste${counts.translations>1?'nt':''} à compléter.`);return;}
        const ok=await StudioModal.confirm({type:'danger',eyebrow:'ÉTAPE 3 SUR 3 · TEST STAGING',title:clientMode?`Importer cette campagne historique dans ${migrationBatch.organization_name||'le client sélectionné'} ?`:'Appliquer réellement ces décisions dans le catalogue de staging ?',message:clientMode?'Cette action crée la campagne historique à partir du master JSON, sans comparaison avec le catalogue. Le pack actuel, les crédits, les dates de pack, le responsable de compte et les utilisateurs ne sont pas modifiés. Un rollback supprimera uniquement ce que ce lot a créé.':`Cette action modifie le catalogue STAGING pour te permettre de tester le parcours complet.${newCatalogMode&&counts.translations>0?` ${counts.translations} traduction${counts.translations>1?'s':''} FR reste${counts.translations>1?'nt':''} à compléter ; elles restent signalées et pourront être travaillées ensuite.`:''} Avant chaque modification, Studio crée un snapshot. Tu pourras ensuite utiliser « Annuler le test » pour restaurer les anciennes valeurs et supprimer tout ce que ce lot a créé. Ne jamais activer cette fonction en production.`,cancelLabel:'Rester en revue',confirmLabel:clientMode?'Importer le test':'Appliquer le test'});
        if(!ok)return;
        if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Application en cours…';}
        try{
          const r=await StudioAPI.request('/api/admin/migrations/'+batchId+'/apply-test',{method:'POST',body:'{}'});
          d.close();
          await StudioModal.alert({eyebrow:'TEST STAGING APPLIQUÉ',title:clientMode?'Tu peux maintenant tester la campagne client':'Tu peux maintenant tester le catalogue',message:r.message||(clientMode?'La campagne historique a été créée. Un rollback complet est disponible depuis le lot de migration.':'Les décisions ont été appliquées. Un rollback complet est disponible depuis le lot de migration.'),confirmLabel:'Fermer'});
          state.migrationsLoaded=false;await loadMigrations();
          if(clientMode)await load();
        }catch(e){
          showError(e.message);
          updateSaveUi(clientMode?'Échec de l’import de test — aucune campagne client n’a été validée.':'Échec de l’application du test — le catalogue n’a pas été validé.');
        }
      }
      applyReviewFilter(clientMode?'all':(n.pending>0?'pending':(n.variant>0?'variant':(n.new>0?'new':(n.languageRecover>0?'languages':'all')))));
      $$('[data-translation-edit]').forEach(btn=>btn.onclick=()=>{
        const entity=entities.find(x=>String(x.id)===String(btn.dataset.translationEdit)),locale=btn.dataset.locale;
        if(!entity)return;
        const p=entity.source_payload||{},hist=p.translations?.[locale]||{},saved=draftsByKey.get(`${entity.id}:${locale}`)||{};
        const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),td=$('#migration-translation-dialog');
        const isSimpleTranslation=['situation','answer','chapter'].includes(entity.entity_type);
        const entityLabel=entity.entity_type==='situation'?'Situation':entity.entity_type==='answer'?'Réponse':entity.entity_type==='chapter'?'Chapitre':(p.title||hist.title||'Profil');
        $('#migration-translation-title').textContent=`${entityLabel} — ${locale.toUpperCase()}`;
        $('#migration-translation-intro').textContent=locale==='fr'?'Le texte anglais est affiché comme référence lorsqu’aucune vraie version française n’existe. Saisis ici la traduction française, puis valide-la pour la retirer des traductions à compléter.':'Le français est affiché comme référence. Les champs historiques disponibles sont préremplis. « Enregistrer comme brouillon » conserve ton travail sans le considérer terminé ; « Valider la traduction » la marque comme complète et la retire du filtre des traductions à compléter.';
        if(isSimpleTranslation){
          const source=locale==='fr'
            ? migrationBestSourceTranslation(p,['en','es','br','de','it','ja','ko-kr','zf','zh','pt','nl','pl','ro','ru','sk','sv-se','tr','bg'])
            : {locale:'fr',text:clean(p.translations?.fr?.content||p.content||p.translations?.fr?.title||p.title||'')};
          const reference=source.text||'—',sourceCode=(source.locale||'').toUpperCase();
          const existing=saved.content||hist.content||saved.title||hist.title||'';
          $('#migration-translation-body').innerHTML=`<div class="migration-translation-editor"><section><span>${locale==='fr'?(sourceCode?sourceCode+' — texte source disponible':'Texte source disponible'):'FR — contenu source'}</span><div class="migration-translation-reference">${esc(reference)}</div></section><section><span>${locale.toUpperCase()} — à compléter</span><label>${entity.entity_type==='chapter'?'Titre':'Texte'}</label><textarea id="migration-translation-field-content" rows="10">${esc(existing)}</textarea><input type="hidden" id="migration-translation-field-title" value=""><input type="hidden" id="migration-translation-field-summary" value=""></section></div>`;
        }else{
          $('#migration-translation-body').innerHTML=`<div class="migration-translation-editor"><section><span>FR — contenu source</span><h3>${esc(p.title||p.translations?.fr?.title||'—')}</h3><label>Résumé</label><div class="migration-translation-reference">${esc(clean(p.summary)||'—')}</div><label>Texte détaillé</label><div class="migration-translation-reference">${esc(clean(p.content)||'—')}</div></section><section><span>${locale.toUpperCase()} — à compléter</span><label>Titre</label><input id="migration-translation-field-title" value="${esc(saved.title||hist.title||'')}"><label>Résumé</label><textarea id="migration-translation-field-summary" rows="5">${esc(saved.summary||hist.summary||'')}</textarea><label>Texte détaillé</label><textarea id="migration-translation-field-content" rows="10">${esc(saved.content||hist.content||'')}</textarea></section></div>`;
        }
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
  function bindOrgActions(){
  $$('[data-upload-org-logo]').forEach(button=>button.onclick=()=>{const id=button.dataset.uploadOrgLogo,input=$(`[data-org-logo-input="${id}"]`);if(!input)return;input.value='';input.onchange=async()=>{if(!input.files?.[0])return;try{const logoData=await optimizeOrganizationLogo(input.files[0]);await StudioAPI.request('/api/admin/organizations/'+id+'/branding',{method:'PATCH',body:JSON.stringify({logoData})});await load();}catch(e){showError(e.message);}};input.click();});
  $$('[data-remove-org-logo]').forEach(button=>button.onclick=async()=>{const o=state.organizations.find(x=>String(x.id)===String(button.dataset.removeOrgLogo));const ok=await StudioModal.confirm({type:'warning',title:'Supprimer le logo ?',message:'Le logo de '+(o?.name||'ce client')+' disparaîtra des écrans du Studio, sans modifier les autres données du compte.',confirmLabel:'Supprimer'});if(!ok)return;try{await StudioAPI.request('/api/admin/organizations/'+button.dataset.removeOrgLogo+'/branding',{method:'PATCH',body:JSON.stringify({logoData:null})});await load();}catch(e){showError(e.message);}});
  $$('[data-pack]').forEach(b=>b.onclick=()=>processPack(b.dataset.packId,b.dataset.pack));$$('[data-save-credits]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveCredits,unlimited=$(`[data-unlimited="${id}"]`).checked;try{await StudioAPI.request('/api/admin/organizations/'+id,{method:'PATCH',body:JSON.stringify({name:$(`[data-org-name="${id}"]`)?.value.trim()||null,countryCode:$(`[data-country="${id}"]`)?.value||null,sectors:[$(`[data-sector="${id}"]`).value].filter(Boolean),passationsQuota:Number($(`[data-quota="${id}"]`).value)||0,passationsUsed:Number($(`[data-used="${id}"]`).value)||0,packStartedAt:$(`[data-pack-start="${id}"]`).value||null,packExpiresAt:$(`[data-expiry="${id}"]`).value||null,packUnlimited:unlimited,accountManagerUserId:$(`[data-account-manager="${id}"]`).value||null})});load();}catch(e){showError(e.message);}});$$('[data-unlimited]').forEach(c=>c.onchange=()=>{const id=c.dataset.unlimited;$(`[data-quota="${id}"]`).disabled=c.checked;$(`[data-used="${id}"]`).disabled=c.checked;});$$('[data-add-user]').forEach(b=>b.onclick=()=>openClientForm(null,b.dataset.addUser));$$('[data-org-campaigns]').forEach(b=>b.onclick=()=>{$('#campaign-search').value=b.dataset.orgCampaigns;activateTab('campaigns');renderCampaigns();});$$('[data-archive-org]').forEach(b=>b.onclick=async()=>{const o=state.organizations.find(x=>String(x.id)===String(b.dataset.archiveOrg)),next=b.dataset.nextActive==='true';if(!window.confirm((next?'Réactiver':'Archiver')+' le cockpit de '+(o?.name||'ce client')+' ?\n\n'+(next?'Les accès pourront de nouveau être utilisés.':'Aucune campagne ni donnée ne sera supprimée.')))return;try{await StudioAPI.request('/api/admin/organizations/'+b.dataset.archiveOrg,{method:'PATCH',body:JSON.stringify({active:next})});load();}catch(e){showError(e.message);}});$$('[data-delete-org]').forEach(b=>b.onclick=async()=>{const o=state.organizations.find(x=>String(x.id)===String(b.dataset.deleteOrg)),typed=window.prompt('Suppression définitive du cockpit « '+(o?.name||'ce client')+' ».\n\nCette action n’est possible que si aucun historique métier n’existe.\n\nTapez SUPPRIMER pour confirmer.','');if(typed!=='SUPPRIMER')return;try{await StudioAPI.request('/api/admin/organizations/'+b.dataset.deleteOrg,{method:'DELETE'});load();}catch(e){showError(e.message);}});$$('[data-favorite-org]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/organizations/'+b.dataset.favoriteOrg+'/classification',{method:'PATCH',body:JSON.stringify({favorite:b.dataset.nextFavorite==='true'})});await load();}catch(e){showError(e.message);}});$$('[data-move-client-folder]').forEach(b=>b.onclick=async()=>{const o=state.organizations.find(x=>String(x.id)===String(b.dataset.moveClientFolder));if(!o)return;const folderId=await askClientMoveFolder(o);if(folderId===null)return;try{await StudioAPI.request('/api/admin/organizations/'+o.id+'/classification',{method:'PATCH',body:JSON.stringify({folderId:folderId||null})});await load();}catch(e){showError(e.message);}});bindUserActions($('#admin-organizations'));}
    function bindUserActions(scope){scope.querySelectorAll('[data-resend-client]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/users/'+b.dataset.resendClient+'/resend-invitation',{method:'POST',body:'{}'});await StudioModal.alert({title:'Invitation renvoyée',message:'Un nouveau lien a été envoyé.',confirmLabel:'Fermer'});}catch(e){showError(e.message);}});scope.querySelectorAll('[data-edit-client]').forEach(b=>b.onclick=()=>{const u=state.clientUsers.get(b.dataset.editClient);openClientForm(u,u.organizationId);});scope.querySelectorAll('[data-toggle-client]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/client-users/'+b.dataset.toggleClient,{method:'PATCH',body:JSON.stringify({active:b.dataset.active==='true'})});load();}catch(e){showError(e.message);}});scope.querySelectorAll('[data-delete-client]').forEach(b=>b.onclick=async()=>{const u=state.clientUsers.get(b.dataset.deleteClient),ok=await StudioModal.confirm({type:'danger',title:'Supprimer ce compte client ?',message:`L’accès de ${u?.first_name||''} ${u?.last_name||''} sera définitivement supprimé.`,confirmLabel:'Supprimer'});if(!ok)return;try{await StudioAPI.request('/api/admin/client-users/'+b.dataset.deleteClient,{method:'DELETE'});load();}catch(e){showError(e.message);}});}
  function openClientForm(u,orgId){const f=$('#user-form');f.reset();f.dataset.editId=u?.id||'';$('#user-org-id').value=orgId;$('#user-dialog h2').textContent=u?'Modifier le compte client':'Ajouter un accès supplémentaire';$('#create-user').textContent=u?'Enregistrer les droits':'Créer et envoyer l’invitation';const level=u?.access_level||'manager';$('#user-access-level').value=level;renderAdminClientPermissions(u?.permissions&&Object.keys(u.permissions).length?u.permissions:clientPermissionPresets[level]);if(u){$('#user-first').value=u.first_name||'';$('#user-last').value=u.last_name||'';$('#user-job-title').value=u.job_title||'';$('#user-phone').value=u.phone||'';$('#user-email').value=u.email||'';}userDialog.showModal();}
  function openAdminForm(u=null){const f=$('#admin-user-form');f.reset();f.dataset.editId=u?.id||'';$('#admin-user-dialog h2').textContent=u?'Modifier le compte administrateur':'Ajouter un compte administrateur';$('#create-admin-user').textContent=u?'Enregistrer':'Créer et envoyer l’invitation';if(u){$('#admin-user-first').value=u.first_name||'';$('#admin-user-last').value=u.last_name||'';$('#admin-user-job').value=u.job_title||'';$('#admin-user-phone').value=u.phone||'';$('#admin-user-email').value=u.email||'';}adminUserDialog.showModal();}
  function bindAdminActions(){$$('[data-admin-edit]').forEach(b=>b.onclick=()=>openAdminForm(state.adminUsers.get(b.dataset.adminEdit)));$$('[data-admin-resend]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/users/'+b.dataset.adminResend+'/resend-invitation',{method:'POST',body:'{}'});}catch(e){showError(e.message);}});$$('[data-admin-active]').forEach(b=>b.onclick=async()=>{try{await StudioAPI.request('/api/admin/administrators/'+b.dataset.adminActive,{method:'PATCH',body:JSON.stringify({active:b.dataset.active==='true'})});load();}catch(e){showError(e.message);}});$$('[data-admin-delete]').forEach(b=>b.onclick=async()=>{const ok=await StudioModal.confirm({type:'danger',title:'Supprimer cet administrateur ?',message:'Cet accès sera définitivement supprimé.',confirmLabel:'Supprimer'});if(!ok)return;try{await StudioAPI.request('/api/admin/administrators/'+b.dataset.adminDelete,{method:'DELETE'});load();}catch(e){showError(e.message);}});}
  async function loadLibraryAdmin(){
    const root=$('#admin-library');if(!root)return;root.innerHTML='<div class="admin-library-loading">Chargement de la bibliothèque…</div>';
    try{const[data,media]=await Promise.all([StudioAPI.request('/api/admin/catalog/themes'),StudioAPI.request('/api/admin/media-library')]);state.catalogThemes=data.themes||[];state.mediaLibrary=media.videos||[];state.mediaThemes=media.themeOptions||[];state.mediaLibraryLoaded=true;state.catalogLoaded=true;renderLibraryAdmin();}catch(e){root.innerHTML=`<div class="composer-alert">${esc(e.message)}</div>`;}
  }
  function normalizedVideoMeta(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_]+/g,' ').replace(/\s+/g,' ').trim();}
  function inferredVideoMeta(video){
    const blob=normalizedVideoMeta([video?.title,video?.description,...(video?.admin_tags||[])].filter(Boolean).join(' '));
    let scope=String(video?.cultural_scope||video?.effective_cultural_scope||'').trim().toUpperCase();
    if(scope==='INTERNATIONAL')scope='WORLDWIDE';
    if(scope==='JAPON'||scope==='JAPAN')scope='ASIE';
    if(!scope){
      if(/\b(universel|universelle|universal|worldwide|monde)\b/.test(blob))scope='WORLDWIDE';
      else if(/\bfrance\b/.test(blob))scope='FRANCE';
      else if(/\b(asie|asia|asiatique)\b/.test(blob))scope='ASIE';
      else if(/\bmaghreb\b/.test(blob))scope='MAGHREB';
      else if(/\binternational\b/.test(blob))scope='WORLDWIDE';
    }
    let locale=String(video?.locale||video?.effective_locale||'').trim().toLowerCase().replaceAll('_','-');
    if(!locale){
      if(/\b(francais|french)\b/.test(blob))locale='fr';
      else if(/\b(anglais|english)\b/.test(blob))locale='en';
      else if(/\b(arabe|arabic)\b/.test(blob))locale='ar';
      else if(/\b(japonais|japanese)\b/.test(blob))locale='ja';
      else if(/\b(coreen|korean)\b/.test(blob))locale='ko-kr';
      else if(/\b(chinois|chinese|mandarin)\b/.test(blob))locale='zh';
      else if(/\b(allemand|german)\b/.test(blob))locale='de';
      else if(/\b(espagnol|spanish)\b/.test(blob))locale='es';
      else if(/\b(italien|italian)\b/.test(blob))locale='it';
      else if(/\b(portugais|portuguese)\b/.test(blob))locale='pt';
    }
    return {scope:scope||'',locale:locale||''};
  }
  function chapterVideoScope(chapter){
    if(String(chapter?.country_scope||'').toLowerCase()==='worldwide')return'WORLDWIDE';
    const codes=(chapter?.country_codes||[]).map(x=>String(x||'').trim().toUpperCase()).filter(Boolean);
    if(codes.includes('FR'))return'FRANCE';
    if(codes.length===1)return codes[0];
    return String(chapter?.country_scope||'').trim().toUpperCase();
  }
  function compatibleVideoScope(videoScope,chapterScope){
    const v=String(videoScope||'').toUpperCase(),c=String(chapterScope||'').toUpperCase();
    if(!v||!c)return true;
    if(v===c)return true;
    if(c==='WORLDWIDE'&&(v==='WORLDWIDE'||v==='INTERNATIONAL'))return true;
    return false;
  }
  function mediaLibraryOptions(selectedId='',context=null){
    const selected=String(selectedId||'');
    let active=state.mediaLibrary.filter(v=>v.active!==false||String(v.id)===selected);
    if(context?.chapter){
      const expectedScope=chapterVideoScope(context.chapter);
      const expectedLocale=String(context.locale||'').toLowerCase().replaceAll('_','-');
      active=active.filter(v=>{
        if(String(v.id)===selected)return true;
        const meta=inferredVideoMeta(v);
        const localeOk=!meta.locale||!expectedLocale||meta.locale===expectedLocale;
        const scopeOk=compatibleVideoScope(meta.scope,expectedScope);
        return localeOk&&scopeOk;
      });
      const theme=findTheme(context.chapter.theme_id);
      if(theme?.slug){
        active=active.filter(v=>String(v.id)===selected||!(v.theme_keys||[]).length||(v.theme_keys||[]).includes(theme.slug));
      }
    }
    const option=v=>{
      const meta=inferredVideoMeta(v);
      const tags=[...(v.theme_keys||[]).map(key=>state.mediaThemes.find(t=>t.key===key)?.title||key),...(v.admin_tags||[])].filter(Boolean);
      const classification=[meta.scope||'PÉRIMÈTRE À CLASSER',meta.locale?meta.locale.toUpperCase():'LANGUE À CLASSER'].join(' · ');
      const suffix=tags.length?' — '+tags.join(' · '):'';
      return `<option value="${v.id}" ${String(v.id)===selected?'selected':''}>${esc(v.title+' — '+classification+suffix)}</option>`;
    };
    const classified=active.filter(v=>{const m=inferredVideoMeta(v);return m.scope&&m.locale;});
    const unclassified=active.filter(v=>{const m=inferredVideoMeta(v);return !m.scope||!m.locale;});
    return '<option value="">Aucune vidéo</option>'
      +(classified.length?`<optgroup label="Compatibles avec ce périmètre et cette langue">${classified.map(option).join('')}</optgroup>`:'')
      +(unclassified.length?`<optgroup label="Vidéos à classer (métadonnées incomplètes)">${unclassified.map(option).join('')}</optgroup>`:'');
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
          <label><span>Périmètre culturel</span><input data-media-lib-scope list="admin-media-scope-suggestions" value="${esc(video?.cultural_scope||video?.effective_cultural_scope||'')}" placeholder="WORLDWIDE, FRANCE, ASIE, MAGHREB"><small>Indépendant de la langue. INTERNATIONAL est normalisé en WORLDWIDE ; Japon relève du périmètre ASIE.</small></label>
          <label><span>Langue de cette vidéo</span><input data-media-lib-locale list="admin-media-locale-suggestions" value="${esc(video?.locale||video?.effective_locale||'')}" placeholder="fr, en, ja, ko-kr…"><small>Une seule langue par fichier vidéo.</small></label>
          <datalist id="admin-media-scope-suggestions"><option value="WORLDWIDE"><option value="FRANCE"><option value="ASIE"><option value="MAGHREB"></datalist>
          <datalist id="admin-media-locale-suggestions"><option value="fr"><option value="en"><option value="bg"><option value="br"><option value="de"><option value="es"><option value="it"><option value="ja"><option value="ko-kr"><option value="nl"><option value="nl-be"><option value="pl"><option value="pt"><option value="ro"><option value="ru"><option value="sv-se"><option value="tr"><option value="zf"><option value="zh"><option value="id"><option value="ar"></datalist>
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
    const q=String($('#media-library-search')?.value||'').trim().toLowerCase(),status=$('#media-library-status')?.value||'',themeId=$('#media-library-theme')?.value||'',scope=$('#media-library-scope')?.value||'',locale=$('#media-library-locale')?.value||'',tag=$('#media-library-tag')?.value||'';
    const themeSelect=$('#media-library-theme'),scopeSelect=$('#media-library-scope'),localeSelect=$('#media-library-locale'),tagSelect=$('#media-library-tag');
    if(themeSelect){
      const current=themeSelect.value;
      themeSelect.innerHTML='<option value="">Toutes les thématiques</option>'+state.mediaThemes.map(t=>`<option value="${esc(t.key)}">${esc(t.title)}</option>`).join('');
      themeSelect.value=current;
    }
    const mediaMeta=state.mediaLibrary.map(v=>({video:v,meta:inferredVideoMeta(v)}));
    const scopeReference=['WORLDWIDE','FRANCE','ASIE','MAGHREB'];
    const allScopes=scopeReference;
    if(scopeSelect){
      const current=scopeSelect.value;
      scopeSelect.innerHTML='<option value="">Tous les périmètres</option>'+allScopes.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
      if(allScopes.includes(current))scopeSelect.value=current;
    }
    const localeLabels={fr:'Français (FR)',en:'Anglais (EN)',bg:'Bulgare (BG)',br:'Portugais Brésil (BR)',de:'Allemand (DE)',es:'Espagnol (ES)',it:'Italien (IT)',ja:'Japonais (JA)','ko-kr':'Coréen (KO-KR)',nl:'Néerlandais (NL)','nl-be':'Néerlandais Belgique (NL-BE)',pl:'Polonais (PL)',pt:'Portugais (PT)',ro:'Roumain (RO)',ru:'Russe (RU)','sv-se':'Suédois (SV-SE)',tr:'Turc (TR)',zf:'Chinois simplifié (ZF)',zh:'Chinois traditionnel (ZH)',cs:'Tchèque (CS)',sk:'Slovaque (SK)',id:'Indonésien (ID)',ar:'Arabe (AR)'};
    const localeReference=['fr','en','bg','br','cs','de','es','it','ja','ko-kr','nl','nl-be','pl','pt','ro','ru','sk','sv-se','tr','zf','zh','id','ar'];
    const detectedLocales=mediaMeta.map(x=>String(x.meta.locale||'').trim().toLowerCase()).filter(Boolean);
    const allLocales=[...new Set([...localeReference,...detectedLocales])].sort((a,b)=>(localeLabels[a]||a).localeCompare(localeLabels[b]||b,'fr'));
    if(localeSelect){
      const current=localeSelect.value;
      localeSelect.innerHTML='<option value="">Toutes les langues</option>'+allLocales.map(v=>`<option value="${esc(v)}">${esc(localeLabels[v]||v.toUpperCase())}</option>`).join('');
      if(allLocales.includes(current))localeSelect.value=current;
    }
    const allTags=[...new Set(state.mediaLibrary.flatMap(v=>v.admin_tags||[]))].sort((a,b)=>a.localeCompare(b,'fr'));
    if(tagSelect){
      const current=tagSelect.value;
      tagSelect.innerHTML='<option value="">Tous les tags</option>'+allTags.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
      tagSelect.value=current;
    }
    const videos=state.mediaLibrary.filter(v=>{
      const meta=inferredVideoMeta(v);
      const themeTitles=(v.theme_keys||[]).map(key=>state.mediaThemes.find(t=>t.key===key)?.title||key);const searchable=`${v.title||''} ${v.description||''} ${v.source_url||''} ${meta.scope||''} ${meta.locale||''} ${(v.admin_tags||[]).join(' ')} ${themeTitles.join(' ')}`.toLowerCase();
      return (!q||searchable.includes(q))
        &&(!status||(status==='active'?v.active!==false:v.active===false))
        &&(!themeId||(v.theme_keys||[]).includes(themeId))
        &&(!scope||String(meta.scope||'')===scope)
        &&(!locale||String(meta.locale||'').toLowerCase()===locale)
        &&(!tag||(v.admin_tags||[]).includes(tag));
    });
    root.innerHTML=videos.length?videos.map(v=>`<article class="admin-media-library-card ${v.active===false?'is-inactive':''}"><div class="admin-media-library-card-head"><span class="admin-media-library-play">▶</span><div><h3>${esc(v.title)}</h3><div class="admin-media-library-tags"><span class="${v.active===false?'is-off':'is-on'}">${v.active===false?'Inactive':'Active'}</span><span>${Number(v.usage_count||0)} utilisation${Number(v.usage_count||0)>1?'s':''}</span></div></div></div><div class="admin-media-classification">${(()=>{const meta=inferredVideoMeta(v);return `${meta.scope?`<span class="admin-media-theme-tag">🌍 ${esc(meta.scope)}</span>`:''}${meta.locale?`<span class="admin-media-theme-tag">🌐 ${esc(meta.locale.toUpperCase())}</span>`:''}`;})()}${(v.theme_keys||[]).map(key=>`<span class="admin-media-theme-tag">${esc(state.mediaThemes.find(t=>t.key===key)?.title||key)}</span>`).join('')}${(v.admin_tags||[]).map(t=>`<span class="admin-media-free-tag">${esc(t)}</span>`).join('')}</div>${v.description?`<p>${esc(v.description)}</p>`:''}<div class="admin-media-library-url"><span>URL HB</span><code>${esc(v.source_url)}</code></div><div class="admin-media-library-card-actions"><button class="button button-secondary button-small" type="button" data-edit-media-library="${v.id}">Modifier</button><button class="button button-danger-soft button-small" type="button" data-delete-media-library="${v.id}">Supprimer définitivement</button></div></article>`).join(''):'<p class="admin-library-empty-line">Aucune vidéo ne correspond à ces filtres.</p>';
    $$('[data-edit-media-library]').forEach(b=>b.onclick=()=>openMediaLibraryForm(state.mediaLibrary.find(v=>String(v.id)===String(b.dataset.editMediaLibrary))));
    $$('[data-delete-media-library]').forEach(b=>b.onclick=()=>openGlobalMediaDelete(b.dataset.deleteMediaLibrary));
  }
  async function openGlobalMediaDelete(videoId){
    const video=state.mediaLibrary.find(v=>String(v.id)===String(videoId));
    let usage;
    try{usage=await StudioAPI.request('/api/admin/media-library/'+encodeURIComponent(videoId)+'/usages');}
    catch(error){showError(error.message);return;}
    document.querySelector('#admin-media-global-delete-dialog')?.remove();
    const associations=Array.isArray(usage.associations)?usage.associations:[];
    const campaigns=Array.isArray(usage.campaigns)?usage.campaigns:[];
    const themes=Array.isArray(usage.themes)?usage.themes:[];
    const grouped=[...new Map(associations.map(a=>[`${a.theme_id}:${a.chapter_id}`,{theme:a.theme_title,chapter:a.chapter_title,items:[]}])).values()];
    associations.forEach(a=>{const key=`${a.theme_id}:${a.chapter_id}`,group=grouped.find(g=>g.theme===a.theme_title&&g.chapter===a.chapter_title);if(group)group.items.push(a);});
    const placementLabel=a=>a.placement==='profile_result'?(a.profile_position===null?'Résultats / profils':`Profil ${Number(a.profile_position)+1}`):'Après le chapitre';
    const dialog=document.createElement('dialog');
    dialog.id='admin-media-global-delete-dialog';dialog.className='admin-dialog admin-media-delete-dialog';
    const usageHtml=grouped.length?grouped.map(g=>`<li><strong>${esc(g.theme||'Thématique')}</strong><span>${esc(g.chapter||'Chapitre')}</span><small>${g.items.map(a=>`${esc(placementLabel(a))}${a.locale?' · '+esc(String(a.locale).toUpperCase()):''}`).join(' · ')}</small></li>`).join(''):'<li class="is-empty"><span>Aucune association catalogue active.</span></li>';
    const campaignHtml=campaigns.length?campaigns.map(c=>`<li><strong>${esc(c.campaign_name||c.title||'Campagne')}</strong><span>${esc(c.organization_name||'Client')} · ${esc(c.status||'')}</span>${c.legacy_history?'<small>Campagne importée / historique</small>':''}</li>`).join(''):'<li class="is-empty"><span>Aucune campagne actuellement concernée.</span></li>';
    dialog.innerHTML=`<form method="dialog" class="admin-media-delete-shell"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Suppression globale</p><h2>Supprimer définitivement cette ressource ?</h2><p class="admin-media-delete-lead">« ${esc(video?.title||usage.video?.title||'Cette ressource')} » disparaîtra de tous les emplacements Studio où elle est actuellement utilisée.</p><div class="admin-media-delete-summary"><span><b>${associations.length}</b> association${associations.length>1?'s':''}</span><span><b>${themes.length}</b> thématique${themes.length>1?'s':''}</span><span><b>${campaigns.length}</b> campagne${campaigns.length>1?'s':''}</span></div><section><h3>Utilisée dans le catalogue</h3><ul>${usageHtml}</ul></section><section><h3>Campagnes concernées</h3><ul>${campaignHtml}</ul></section>${campaigns.length?`<div class="admin-media-delete-warning"><strong>Attention</strong><span>La ressource ne sera plus visible dans ces campagnes, y compris si elles sont publiées ou importées. Les autres contenus de ces campagnes restent inchangés.</span></div>`:''}<div class="admin-media-delete-final"><strong>Cette action est irréversible.</strong><span>La ressource sera supprimée de toutes les bibliothèques, thématiques, variantes pays/langues et vues admin.</span></div><div class="admin-media-delete-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button studio-modal-danger" type="button" data-confirm-global-media-delete>Supprimer partout</button></div></form>`;
    document.body.appendChild(dialog);dialog.showModal();
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close('cancel');});
    const confirm=dialog.querySelector('[data-confirm-global-media-delete]');
    confirm.onclick=async()=>{confirm.disabled=true;confirm.textContent='Suppression…';try{await StudioAPI.request('/api/admin/media-library/'+encodeURIComponent(videoId)+'?global=1',{method:'DELETE'});dialog.close('deleted');await loadMediaLibrary();state.catalogLoaded=false;}catch(error){confirm.disabled=false;confirm.textContent='Supprimer partout';showError(error.message);}};
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
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
        culturalScope:form.querySelector('[data-media-lib-scope]').value.trim(),
        locale:form.querySelector('[data-media-lib-locale]').value.trim(),
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
  const situationKey=si=>{
    const text=String(si?.content||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    // Deux contenus identiques peuvent être deux variantes de diffusion distinctes.
    // Le périmètre fait donc partie de l'identité d'affichage ; on ne dédoublonne
    // que les vraies copies techniques ayant même texte ET même périmètre.
    const scope=Array.isArray(si?.country_codes)?[...new Set(si.country_codes.map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))].sort().join(','):'';
    const worldwide=String(si?.country_scope||'').toLowerCase()==='worldwide'?'worldwide':'';
    return `${text}|${worldwide||scope}`;
  };
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
  function situationTags(si){return [...new Set((Array.isArray(si?.admin_tags)?si.admin_tags:[]).map(v=>String(v||'').trim()).filter(Boolean))];}
  function situationTagHtml(si){const tags=situationTags(si);return tags.length?`<div class="admin-situation-tags">${tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>`:'';}
  function globalCatalogSituations(){
    const rows=[];
    for(const theme of state.catalogThemes||[])for(const chapter of theme.chapters||[])for(const si of canonicalSituations(chapter)){
      if(si._linked||si.archived_at||si.deleted_at||si.active===false)continue;
      rows.push({situation:si,theme,chapter});
    }
    return rows;
  }
  function globalPickerHtml(targetChapter){
    if(String(state.libraryGlobalPickerChapterId||'')!==String(targetChapter.id))return '';
    const targetTheme=findTheme(targetChapter.theme_id||state.libraryThemeId);
    const q=String(state.libraryGlobalPickerQuery||'').trim().toLowerCase();
    const themeFilter=String(state.libraryGlobalPickerThemeId||'');
    const sourceChapterFilter=String(state.libraryGlobalPickerSourceChapterId||'');
    const sourcePlacement=state.libraryGlobalPickerSourcePlacement==='library'?'library':'base';
    const already=new Set((targetChapter.situations||[]).map(si=>String(si.id)));
    const sourceThemes=(state.catalogThemes||[]).filter(t=>String(t.id)!==String(targetTheme?.id||''));
    const sourceChapters=(themeFilter?(findTheme(themeFilter)?.chapters||[]):sourceThemes.flatMap(t=>t.chapters||[]));
    const rows=globalCatalogSituations().filter(row=>String(row.chapter.id)!==String(targetChapter.id)&&!already.has(String(row.situation.id))).filter(row=>{
      if(themeFilter&&String(row.theme.id)!==themeFilter)return false;
      if(sourceChapterFilter&&String(row.chapter.id)!==sourceChapterFilter)return false;
      if(sourcePlacement==='base'&&!Boolean(row.situation.is_default))return false;
      if(sourcePlacement==='library'&&Boolean(row.situation.is_default))return false;
      if(!q)return true;
      const hay=[libraryRealContent(row.situation),row.theme.title,row.chapter.title,...situationTags(row.situation)].join(' ').toLowerCase();
      return hay.includes(q);
    }).slice(0,80);
    const languageChoices=row=>{
      const locales=[...new Set((Array.isArray(row.situation?.available_locales)?row.situation.available_locales:['fr']).map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
      const ordered=locales.includes('fr')?['fr',...locales.filter(x=>x!=='fr')]:locales;
      return `<div class="admin-global-picker-locales" data-picker-locales-for="${row.situation.id}"><div class="admin-global-picker-locales-title"><strong>Langues utilisées dans cet autodiagnostic</strong><span class="admin-info-dot" tabindex="0" data-info="La situation conserve toutes ses traductions dans son autodiagnostic d’origine. Ici, vous choisissez uniquement les langues actives pour cette réutilisation.">i</span></div><div class="admin-global-picker-locale-chips">${ordered.map((loc,i)=>`<label><input type="checkbox" data-picker-locale value="${esc(loc)}" ${(loc==='fr'||(!ordered.includes('fr')&&i===0))?'checked':''}> <span>${esc(libraryLocaleLabel(loc))}</span></label>`).join('')}</div><small>Par défaut, seul le français est sélectionné quand il est disponible. Vous pourrez réutiliser les autres traductions plus tard sans dupliquer la situation.</small></div>`;
    };
    const currentFilter=state.librarySituationFilters.get(String(targetChapter.id))||'all';
    const pickerPlacement=currentFilter==='library'?'library':'base';
    const pickerPlacementLabel=pickerPlacement==='library'?'Bibliothèque complémentaire':'Base du thème';
    const pickerPlacementHelp=pickerPlacement==='library'?'La situation sera disponible comme alternative pour cet autodiagnostic. Elle ne sera pas proposée par défaut au client.':'La situation fera partie du contenu de référence de cet autodiagnostic et sera proposée par défaut au client.';
    return `<section class="admin-global-catalog-picker" data-global-picker="${targetChapter.id}"><div class="admin-global-picker-head"><div><strong>Catalogue global Me&amp;YouToo</strong><p>Choisissez une situation déjà existante dans le Catalogue Me&amp;YouToo. Elle sera rattachée ici sans être dupliquée.</p></div><button type="button" class="button button-ghost button-small" data-close-global-picker>Fermer</button></div><div class="admin-global-picker-destination"><span>Vous construisez : <strong>${pickerPlacementLabel}</strong></span><span class="admin-info-dot" tabindex="0" data-info="${esc(pickerPlacementHelp)} La situation source reste inchangée dans sa thématique d’origine.">i</span></div><div class="admin-global-picker-help"><span class="admin-info-dot" tabindex="0" data-info="Vous êtes dans une zone précise de la thématique. La destination est donc déjà définie ici : vous ne choisissez plus Base ou Bibliothèque sur chaque situation. Le client n’a jamais accès au catalogue global.">i</span><span>Vous consultez actuellement ${sourcePlacement==='library'?'la bibliothèque complémentaire':'la base'} des autres autodiagnostics. Filtrez, choisissez les langues, puis ajoutez la situation ici.</span></div><div class="admin-global-picker-filters"><label><span>Thématique d’origine <span class="admin-info-dot" tabindex="0" data-info="Filtre les situations selon l’autodiagnostic dans lequel elles ont été créées à l’origine.">i</span></span><select data-global-picker-theme><option value="">Toutes les thématiques</option>${sourceThemes.map(t=>`<option value="${t.id}" ${themeFilter===String(t.id)?'selected':''}>${esc(t.title)}</option>`).join('')}</select></label><label><span>Chapitre d’origine <span class="admin-info-dot" tabindex="0" data-info="Affiche uniquement les situations du chapitre source choisi. Ce filtre dépend de la thématique d’origine sélectionnée.">i</span></span><select data-global-picker-source-chapter><option value="">Tous les chapitres</option>${sourceChapters.map(ch=>`<option value="${ch.id}" ${sourceChapterFilter===String(ch.id)?'selected':''}>${esc(ch.title)}</option>`).join('')}</select></label></div><label class="admin-global-picker-search"><span>Rechercher par mot-clé, contexte ou texte <span class="admin-info-dot" tabindex="0" data-info="La recherche porte sur le texte de la situation, ses tags contextuels et ses mots-clés : réunion, chantier, industrie, harcèlement, management, etc.">i</span></span><input type="search" data-global-picker-search value="${esc(state.libraryGlobalPickerQuery||'')}" placeholder="Ex. harcèlement, réunion, chantier, industrie, management…"></label><div class="admin-global-picker-results">${rows.length?rows.map(row=>`<article class="admin-global-picker-card" data-global-situation-card="${row.situation.id}"><div><div class="admin-global-picker-source"><span>${esc(row.theme.title)}</span><b>›</b><span>${esc(row.chapter.title)}</span><span class="admin-info-dot" tabindex="0" data-info="Cette provenance reste la source officielle de la situation. La réutilisation ici ne crée pas de copie.">i</span></div><p>${esc(libraryRealContent(row.situation))}</p>${situationTagHtml(row.situation)}${languageChoices(row)}</div><div class="admin-global-picker-actions"><button type="button" class="button button-primary button-small" data-link-global-situation="${row.situation.id}" data-target-chapter="${targetChapter.id}" data-placement="${pickerPlacement}">Ajouter cette situation</button></div></article>`).join(''):`<p class="admin-library-empty-line">Aucune situation ne correspond à ces filtres.</p>`}</div></section>`;
  }
  function catalogTagCoverage(){
    const rows=[];
    for(const theme of state.catalogThemes||[])for(const chapter of theme.chapters||[])for(const si of canonicalSituations(chapter)){
      if(si._linked||si.archived_at||si.deleted_at||si.active===false||!si.is_default)continue;
      rows.push(si);
    }
    const tagged=rows.filter(si=>situationTags(si).length>0).length;
    return {total:rows.length,tagged,untagged:Math.max(0,rows.length-tagged)};
  }
  function catalogTaggingPanel(){
    const c=catalogTagCoverage();
    const pct=c.total?Math.round((c.tagged/c.total)*100):0;
    return `<section class="admin-catalog-tagging-panel"><div class="admin-catalog-tagging-copy"><div class="admin-library-editor-section-title"><span class="admin-library-editor-icon">#</span><div><h3>Tags des situations</h3><p>Les tags sont réservés à l’administration et servent à retrouver, filtrer et réutiliser les situations du Catalogue Me&amp;YouToo.</p></div></div><div class="admin-catalog-tagging-kpis"><span><strong>${c.tagged}</strong> taguées</span><span><strong>${c.untagged}</strong> sans tag</span><span><strong>${pct}%</strong> de couverture</span></div></div><div class="admin-catalog-tagging-actions"><button type="button" class="button button-primary" data-auto-tag-catalog>Analyser et intégrer les tags</button><span class="admin-info-dot" tabindex="0" data-info="Analyse le texte de chaque situation de la base ainsi que la bibliothèque complémentaire Sexisme. Les tags existants sont conservés et peuvent être complétés ou corrigés manuellement. Les prénoms et noms propres ne sont jamais proposés comme tags automatiques.">i</span><small>Base des thèmes + bibliothèque complémentaire Sexisme · les tags existants sont conservés.</small></div></section>`;
  }
  function renderLibraryAdmin(){
    const root=$('#admin-library');if(!root)return;
    if(!state.catalogThemes.length){root.innerHTML='<div class="admin-library-empty"><strong>Aucune thématique</strong><p>Créez la première thématique du référentiel.</p></div>';return;}
    const theme=state.libraryThemeId?findTheme(state.libraryThemeId):null;
    if(!theme){
      state.libraryThemeId=null;
      root.innerHTML=`${catalogTaggingPanel()}<div class="admin-library-home-head"><div><h3>Thématiques</h3><p>Entrez dans une thématique pour administrer ses chapitres, situations, réponses, scoring et profils.</p></div><span>${state.catalogThemes.length} thématique${state.catalogThemes.length>1?'s':''}</span></div><div class="admin-library-theme-grid">${state.catalogThemes.map(t=>`<article class="admin-library-theme-card ${t.active?'':'is-inactive'}" data-open-library-theme="${t.id}" tabindex="0" role="button" aria-label="Ouvrir ${esc(t.title)}"><div class="admin-library-theme-card-top"><span class="admin-library-theme-icon">🌼</span><span class="status-pill ${t.active?'is-open':'is-muted'}">${t.active?'Active':'Inactive'}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description||'Aucune description')}</p>${libraryThemeScopeBadges(t)}<div class="admin-library-theme-stats"><span><strong>${(t.chapters||[]).length}</strong> chapitre${(t.chapters||[]).length>1?'s':''}</span><span><strong>${themeSituationCount(t)}</strong> situation${themeSituationCount(t)>1?'s':''}</span>${archivedSituationCount(t)?`<span><strong>${archivedSituationCount(t)}</strong> archivée${archivedSituationCount(t)>1?'s':''}</span>`:''}${deletedSituationCount(t)?`<span><strong>${deletedSituationCount(t)}</strong> supprimée${deletedSituationCount(t)>1?'s':''}</span>`:''}</div><div class="admin-library-theme-enter">Entrer dans la thématique <span>→</span></div></article>`).join('')}</div>`;
      bindLibraryActions();return;
    }
    root.innerHTML=`<div class="admin-library-detail-head"><button class="button button-ghost admin-library-back" type="button" data-library-back>← Toutes les thématiques</button><div class="admin-library-detail-title"><div><div class="admin-library-theme-title"><h3>${esc(theme.title)}</h3>${libraryThemeScopeBadges(theme)}<span class="status-pill ${theme.active?'is-open':'is-muted'}">${theme.active?'Active':'Inactive'}</span></div><p>${esc(theme.description||'Aucune description')}</p><div class="admin-library-detail-stats"><span>${(theme.chapters||[]).length} chapitre${(theme.chapters||[]).length>1?'s':''}</span><span>${themeSituationCount(theme)} situations</span>${archivedSituationCount(theme)?`<span>${archivedSituationCount(theme)} archivée${archivedSituationCount(theme)>1?'s':''}</span>`:''}${deletedSituationCount(theme)?`<span>${deletedSituationCount(theme)} supprimée${deletedSituationCount(theme)>1?'s':''}</span>`:''}</div></div><div class="admin-library-actions"><button class="button button-secondary button-small" data-edit-theme="${theme.id}">Modifier la thématique</button><button class="button button-primary button-small" data-add-chapter="${theme.id}">+ Ajouter un chapitre</button></div></div></div><div class="admin-library-chapters admin-library-chapters-detail">${(theme.chapters||[]).length?(theme.chapters||[]).map(ch=>chapterAccordion(theme,ch)).join(''):'<div class="admin-library-empty"><strong>Aucun chapitre</strong><p>Ajoutez le premier chapitre de cette thématique.</p></div>'}</div>`;
    bindLibraryActions();
  }
  function chapterAccordion(theme,ch){
    const expanded=state.libraryExpandedChapters.has(String(ch.id));
    const current=currentSituations(ch),archives=archivedSituations(ch),deleted=deletedSituations(ch),count=current.length;
    const baseCount=current.filter(si=>si.is_default).length,libraryCount=current.filter(si=>!si.is_default).length;
    const filter=chapterSituationFilter(ch.id),visible=filteredChapterSituations(ch);
    const chip=(value,label,countValue,klass='')=>`<button type="button" class="admin-library-filter-chip ${klass} ${filter===value?'is-selected':''}" data-library-situation-filter="${value}" data-chapter-id="${ch.id}"><span>${label}</span><b>${countValue}</b></button>`;
    return `<section class="admin-library-chapter admin-library-chapter-accordion ${expanded?'is-expanded':''}" data-library-chapter="${ch.id}"><div class="admin-library-chapter-head" data-toggle-library-chapter="${ch.id}" role="button" tabindex="0"><div class="admin-library-chapter-main"><span class="admin-library-chevron" aria-hidden="true">›</span><div><strong>${esc(ch.title)}</strong>${ch.choice_group?`<span class="admin-library-type-tag is-library">${ch.is_default_choice?'Choix par défaut':'Chapitre alternatif'} · ${esc(ch.choice_group)}</span>`:''}${libraryChapterScopeTag(ch)}${libraryChapterLanguagesTag(ch)}${ch.locked?'<span class="admin-library-lock">🔒 Obligatoire</span>':''}<small>${count} situation${count>1?'s':''}${archives.length?` · ${archives.length} archivée${archives.length>1?'s':''}`:''}${deleted.length?` · ${deleted.length} supprimée${deleted.length>1?'s':''}`:''} · ${Number(ch.profile_count||0)}/3 profils</small></div></div><div class="admin-library-chapter-actions"><button class="button button-ghost button-small" data-edit-chapter="${ch.id}">Modifier</button><button class="button button-secondary button-small" data-add-inline-situation="${ch.id}">+ Situation</button></div></div>${expanded?`<div class="admin-library-chapter-body"><section class="admin-library-profiles-panel"><div class="admin-library-subhead admin-library-profiles-head"><div><h4>Profils de restitution</h4><p>Ouvrez un profil pour modifier son titre, ses textes, sa couleur et ses seuils de scoring.</p></div></div><form class="admin-library-profiles-form" data-profile-inline-form="${ch.id}"><div class="admin-library-profile-list">${[0,1,2].map((_,i)=>profileInlineRow(ch,(ch.profiles||[])[i]||{},i)).join('')}</div><div class="admin-library-inline-actions admin-library-profiles-actions"><button class="button button-secondary" type="button" data-cancel-inline>Annuler</button><button class="button button-primary" type="submit">Enregistrer les profils</button></div></form></section><div class="admin-library-situations-inline"><div class="admin-library-subhead"><div><h4>Situations</h4><p>Les situations de la base du thème sont affichées en premier. Utilisez les filtres pour isoler un type de contenu.</p></div><div class="admin-library-subhead-actions"><button class="button button-secondary button-small" type="button" data-open-global-picker="${ch.id}" data-picker-source="base">+ Prendre depuis la base <span class="admin-info-dot" tabindex="0" data-info="Affiche uniquement les situations qui appartiennent à la base des autres autodiagnostics. La situation choisie sera ajoutée dans la zone que vous êtes en train de construire ici.">i</span></button><button class="button button-secondary button-small" type="button" data-open-global-picker="${ch.id}" data-picker-source="library">+ Prendre depuis la bibliothèque complémentaire <span class="admin-info-dot" tabindex="0" data-info="Affiche uniquement les situations classées dans les bibliothèques complémentaires des autres autodiagnostics. La situation choisie sera ajoutée dans la zone que vous êtes en train de construire ici.">i</span></button><button class="button button-primary button-small" type="button" data-add-inline-situation="${ch.id}">+ Créer une situation <span class="admin-info-dot" tabindex="0" data-info="Crée une situation entièrement nouvelle dans cette thématique, au lieu de reprendre un contenu déjà existant dans le Catalogue Me&amp;YouToo.">i</span></button></div></div>${globalPickerHtml(ch)}<div class="admin-library-situation-filters">${chip('all','Toutes',count,'is-all')}${chip('base','Base du thème <span class="admin-info-dot" tabindex="0" data-info="Situations proposées par défaut dans cet autodiagnostic.">i</span>',baseCount,'is-base')}${chip('library','Bibliothèque complémentaire <span class="admin-info-dot" tabindex="0" data-info="Situations alternatives visibles uniquement dans la bibliothèque de cet autodiagnostic.">i</span>',libraryCount,'is-library')}${chip('archived','Archivées',archives.length,'is-archived')}${chip('deleted','Supprimées',deleted.length,'is-deleted')}</div><div data-inline-new-situation="${ch.id}"></div><div class="admin-library-filtered-list">${visible.length?visible.map(si=>situationAccordion(ch,si,filter==='archived',filter==='deleted')).join(''):`<p class="admin-library-empty-line">${filter==='base'?'Aucune situation dans la base du thème.':filter==='library'?'Aucune situation complémentaire.':filter==='archived'?'Aucune situation archivée.':filter==='deleted'?'Aucune situation supprimée.':'Aucune situation dans ce chapitre.'}</p>`}</div></div></div>`:''}</section>`;
  }
  const libraryTranslationRows=entity=>Array.isArray(entity?.translations)?entity.translations:[];
  const libraryGenericTranslations=entity=>libraryTranslationRows(entity).filter(t=>!t.country_code);
  const libraryCountryVariants=entity=>libraryTranslationRows(entity).filter(t=>Boolean(t.country_code));
  const libraryLocaleLabel=locale=>String(locale||'').toUpperCase();
  const libraryReferenceLocale=entity=>{
    const declared=String(entity?.reference_locale||'').trim().toLowerCase().replaceAll('_','-');
    if(declared)return declared;
    const available=(Array.isArray(entity?.available_locales)?entity.available_locales:[])
      .map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean);
    return available[0]||'fr';
  };
  const libraryContentObject=row=>row?.content&&typeof row.content==='object'?row.content:{};
  const libraryCountryLabel=code=>({FR:'France',BE:'Belgique',CH:'Suisse',CA:'Canada',LU:'Luxembourg',ES:'Espagne',DE:'Allemagne',AR:'Argentine',AT:'Autriche',BR:'Brésil',CL:'Chili',CN:'Chine',KR:'Corée du Sud',DK:'Danemark',US:'États-Unis',HK:'Hong Kong',JP:'Japon',MX:'Mexique',NO:'Norvège',PA:'Panama',PT:'Portugal',SE:'Suède',TW:'Taïwan',UY:'Uruguay',IT:'Italie',GB:'Royaume-Uni',NL:'Pays-Bas',PL:'Pologne',RO:'Roumanie',RU:'Russie',TR:'Turquie',BG:'Bulgarie'}[String(code||'').toUpperCase()]||String(code||''));
  function libraryChapterScopeTag(ch){
    if(ch?.country_scope==='worldwide')return '<span class="admin-library-type-tag is-country">🌍 Périmètre culturel : WORLDWIDE</span>';
    const codes=[...new Set((Array.isArray(ch?.country_codes)?ch.country_codes:[]).map(x=>String(x||'').toUpperCase()).filter(Boolean))];
    return codes.length?`<span class="admin-library-type-tag is-country">Périmètre culturel : ${codes.map(libraryCountryLabel).map(esc).join(' · ')}</span>`:'';
  }
  function libraryChapterLanguagesTag(ch){
    const locales=[...new Set((Array.isArray(ch?.available_locales)?ch.available_locales:[])
      .map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
    if(!locales.length)return '';
    const ordered=locales.includes('fr')?['fr',...locales.filter(x=>x!=='fr')]:['fr',...locales];
    return `<span class="admin-library-type-tag is-language">Langues : ${ordered.map(libraryLocaleLabel).join(' · ')}</span>`;
  }
  function libraryContentScopeTag(ch,entity){
    if(ch?.country_scope==='worldwide'||entity?.country_scope==='worldwide')return '<span class="admin-library-type-tag is-country">🌍 WORLDWIDE</span>';
    const codes=[...new Set([...(Array.isArray(entity?.country_codes)?entity.country_codes:[]),...(Array.isArray(ch?.country_codes)?ch.country_codes:[])].map(x=>String(x||'').toUpperCase()).filter(Boolean))];
    return codes.length?`<span class="admin-library-type-tag is-country">Périmètre : ${codes.map(libraryCountryLabel).map(esc).join(' · ')}</span>`:'';
  }
  function libraryThemeScopeBadges(theme){
    const locales=[...new Set((Array.isArray(theme?.available_locales)?theme.available_locales:['fr']).map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
    const countries=[...new Set((Array.isArray(theme?.country_codes)?theme.country_codes:[]).map(x=>String(x||'').toUpperCase()).filter(Boolean))];
    const tags=[...new Set((Array.isArray(theme?.admin_tags)?theme.admin_tags:[]).map(x=>String(x||'').trim()).filter(Boolean))];
    return `<div class="admin-library-theme-scope">
      ${countries.length?`<span class="admin-library-theme-scope-label"><b>Périmètre culturel</b></span>${countries.map(c=>`<span class="admin-library-theme-scope-tag is-scope">${esc(libraryCountryLabel(c))}</span>`).join('')}`:''}
      ${tags.map(tag=>`<span class="admin-library-theme-scope-tag is-manual">${esc(tag)}</span>`).join('')}
      <span class="admin-library-theme-scope-tag is-language"><b>Langues disponibles</b> ${locales.map(libraryLocaleLabel).join(' · ')}</span>
    </div>`;
  }
  function libraryIsTechnicalLegacyContent(value){
    const s=String(value||'').trim();
    return /^question\s+[A-ZÀ-ÖØ-Þ0-9][A-ZÀ-ÖØ-Þ0-9 .&+/_-]*(?:\s+ET\s+[A-ZÀ-ÖØ-Þ0-9 .&+/_-]+)?\s*\(/i.test(s);
  }
  function libraryRealContent(entity){
    const raw=String(entity?.content||'').trim();
    if(raw&&!libraryIsTechnicalLegacyContent(raw))return raw;
    const rows=Array.isArray(entity?.translations)?entity.translations:[];
    const order=['en','es','br','de','it','ja','ko-kr','zf','zh','pt','nl','pl','ro','ru','sk','sv-se','tr','bg'];
    for(const loc of order){
      const row=rows.find(r=>String(r.locale||'').toLowerCase()===loc);
      const c=libraryContentObject(row);
      const txt=String(c.content||c.title||'').trim();
      if(txt&&!libraryIsTechnicalLegacyContent(txt))return txt;
    }
    for(const row of rows){
      const c=libraryContentObject(row),txt=String(c.content||c.title||'').trim();
      if(txt&&!libraryIsTechnicalLegacyContent(txt))return txt;
    }
    return raw;
  }
  function libraryLocalizationBadges(entity){
    const generic=libraryGenericTranslations(entity);
    const declared=(Array.isArray(entity?.available_locales)?entity.available_locales:[])
      .map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean);
    // La liste calculée par l'API pour cette occurrence/périmètre est la source de vérité.
    const base=declared.length?declared:generic.map(t=>String(t.locale||'').toLowerCase()).filter(Boolean);
    const locales=[...new Set(base.map(x=>String(x).toLowerCase()))];
    const reference=libraryReferenceLocale(entity);
    const countryCodes=[...new Set([...(entity?.cultural_legal_scope?[String(entity.cultural_legal_scope)]:[]),...libraryCountryVariants(entity).map(t=>String(t.country_code||'').trim()).filter(Boolean)])];
    return `<span class="admin-library-localization-badges"><span class="admin-library-localization-chip is-language">Langues disponibles : ${(locales.length?locales:[reference]).map(libraryLocaleLabel).join(' · ')}</span><span class="admin-library-localization-chip is-language">Référence : ${libraryLocaleLabel(reference)}</span>${countryCodes.map(c=>`<span class="admin-library-localization-chip is-country">Périmètre culturel et légal : ${esc(libraryCountryLabel(c))}</span>`).join('')}</span>`;
  }
  function libraryFilteredTranslations(entity,countryCodes=[]){
    const rows=libraryTranslationRows(entity);
    const active=(Array.isArray(entity?.available_locales)?entity.available_locales:[])
      .map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-'))
      .filter(Boolean);
    const reference=libraryReferenceLocale(entity);
    const scoped=active.length?rows.filter(row=>{
      const locale=String(row.locale||'').trim().toLowerCase().replaceAll('_','-');
      return active.includes(locale);
    }):rows;
    // Le texte principal est déjà l'édition de la langue de référence : ne pas dupliquer
    // un champ "Traduction FR/EN" pour cette même langue.
    return scoped.filter(row=>String(row.locale||'').trim().toLowerCase().replaceAll('_','-')!==reference);
  }
  function libraryLocalizationDetails(entity,entityType,countryCodes=[]){
    const filtered=libraryFilteredTranslations(entity,countryCodes);
    const generic=filtered.filter(t=>!t.country_code);
    const variants=filtered.filter(t=>Boolean(t.country_code));
    if(!generic.length&&!variants.length){const reference=libraryReferenceLocale(entity);return `<p class="admin-library-localization-empty">Langue de référence : <strong>${libraryLocaleLabel(reference)}</strong>. Aucune autre traduction n’est disponible pour ce contenu.</p>`;}
    const rowHtml=(row,isVariant=false)=>{
      const c=libraryContentObject(row),locale=libraryLocaleLabel(row.locale),country=row.country_code?` · ${esc(row.country_code)}`:'';
      let body='';
      if(entityType==='profile')body=`<label><b>Titre</b><input data-translation-field="title" value="${esc(c.title||'')}"></label><label><b>Résumé</b><textarea data-translation-field="summary" rows="4">${esc(c.summary||'')}</textarea></label><label><b>Texte détaillé</b><textarea data-translation-field="content" rows="7">${esc(c.content||'')}</textarea></label>`;
      else body=`<label><b>Texte</b><textarea data-translation-field="content" rows="5">${esc(c.content||c.title||'')}</textarea></label>`;
      return `<details class="admin-library-localization-row ${isVariant?'is-cultural':''}" data-library-translation-row="${row.id}"><summary><strong>${isVariant?'Variante culturelle et légale':'Traduction'} ${locale}${country}</strong><span>${isVariant?'Version spécifique au périmètre':'Version linguistique'}</span></summary><div class="admin-library-localization-copy">${body}<div class="admin-library-localization-actions"><button type="button" class="button button-primary button-small" data-save-library-translation="${row.id}">Enregistrer la traduction</button></div></div></details>`;
    };
    return `${generic.map(r=>rowHtml(r,false)).join('')}${variants.map(r=>rowHtml(r,true)).join('')}`;
  }
  function linkedSituationLocaleEditor(si){
    if(!(si?._linked||si?._placement_id))return '';
    const source=[...new Set((Array.isArray(si.source_available_locales)?si.source_available_locales:(Array.isArray(si.available_locales)?si.available_locales:['fr'])).map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
    const active=new Set((Array.isArray(si.available_locales)?si.available_locales:['fr']).map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean));
    const ordered=source.includes('fr')?['fr',...source.filter(x=>x!=='fr')]:source;
    return `<div class="admin-global-picker-locales admin-linked-locale-editor"><div class="admin-global-picker-locales-title"><strong>Langues actives dans cet autodiagnostic</strong><span class="admin-info-dot" tabindex="0" data-info="Vous ne modifiez pas les traductions de la situation source. Vous choisissez seulement quelles langues sont actives dans cet autodiagnostic.">i</span></div><div class="admin-global-picker-locale-chips">${ordered.map(loc=>`<label><input type="checkbox" data-linked-active-locale value="${esc(loc)}" ${active.has(loc)?'checked':''}> <span>${esc(libraryLocaleLabel(loc))}</span></label>`).join('')}</div><small>Les autres traductions restent disponibles dans la situation d’origine et peuvent être réactivées plus tard.</small></div>`;
  }
  function situationAccordion(ch,si,isArchived=false,isDeleted=false){
    const answers=si.answers||[];
    const isLinked=Boolean(si._linked||si._placement_id);
    const readonly=isArchived||isDeleted||isLinked;
    const typeTag=si.is_default?'<span class="admin-library-type-tag is-base">Base du thème</span>':'<span class="admin-library-type-tag is-library">Bibliothèque complémentaire</span>';
    const statusTag=isArchived?'<span class="admin-library-type-tag is-archived">Archivée</span>':isDeleted?'<span class="admin-library-type-tag is-deleted">Supprimée</span>':'';
    const sourceTag=isLinked?`<span class="admin-library-type-tag is-source">Source : ${esc(si._source_theme_title||'Catalogue')} · ${esc(si._source_chapter_title||'')}</span>`:'';
    const placementName=si.is_default?'base':'library';
    return `<details class="admin-library-situation-row ${isArchived?'is-archived':''} ${isDeleted?'is-deleted':''} ${isLinked?'is-linked':''}" data-situation-details="${si.id}"><summary><div class="admin-library-situation-summary"><p>${esc(libraryRealContent(si))}</p><div class="admin-library-situation-meta"><span>${answers.length} réponse${answers.length>1?'s':''}</span>${typeTag}${sourceTag}${statusTag}${libraryContentScopeTag(ch,si)}</div>${situationTagHtml(si)}</div><span class="admin-library-summary-action">${readonly?'Consulter':'Voir / modifier'} <span class="admin-library-situation-chevron" aria-hidden="true">⌄</span></span></summary><form class="admin-library-inline-form admin-library-situation-form" data-situation-inline-form="${si.id}" data-chapter-id="${ch.id}" ${isLinked?`data-placement-id="${si._placement_id}"`:''}><section class="admin-library-editor-section admin-library-editor-situation"><div class="admin-library-editor-section-title"><span class="admin-library-editor-icon">✎</span><div><h4>Situation</h4><p>${isLinked?'Situation partagée depuis une autre thématique. Son texte reste administré dans sa thématique d’origine. Vous pouvez ici choisir son emplacement ou la retirer.':isArchived?'Cette situation est archivée et n’est plus proposée dans les nouvelles campagnes.':isDeleted?'Cette situation est dans les supprimées. Vous pouvez la restaurer ou la supprimer définitivement.':'Modifiez son contenu, ses mots-clés ou son emplacement dans le catalogue.'}</p></div></div><label class="admin-library-wide-label admin-library-content-field"><span>Texte de la situation</span><textarea data-inline-situation-content rows="3" required ${readonly?'disabled':''}>${esc(libraryRealContent(si)||'')}</textarea></label>${isLinked?`<div class="admin-library-shared-source"><strong>Contenu partagé</strong><span>Origine : ${esc(si._source_theme_title||'—')} · ${esc(si._source_chapter_title||'—')}</span></div>${linkedSituationLocaleEditor(si)}`:`<label class="admin-library-wide-label admin-library-tags-field"><span>Tags de recherche — automatiques + manuels</span><input data-inline-situation-tags value="${esc(situationTags(si).join(', '))}" placeholder="Ex. apprenti, tenue, apparence, réunion, client"><small>Vous pouvez compléter, corriger ou supprimer les tags automatiques. Ajoutez surtout les mots concrets qui caractérisent cette situation : personne, statut, lieu, objet, moment ou contexte métier.</small></label>`}<fieldset class="admin-library-placement-choice" ${isArchived||isDeleted?'disabled':''}><legend>Où proposer cette situation dans cet autodiagnostic ?</legend><label><input type="radio" name="placement-${si.id}-${ch.id}" data-situation-placement value="base" ${placementName==='base'?'checked':''}> <span><strong>Base du thème</strong><small>Proposée par défaut au client dans sa composition initiale.</small></span></label><label><input type="radio" name="placement-${si.id}-${ch.id}" data-situation-placement value="library" ${placementName==='library'?'checked':''}> <span><strong>Bibliothèque complémentaire</strong><small>Disponible uniquement comme alternative dans cet autodiagnostic.</small></span></label></fieldset>${!isLinked?`<div class="admin-library-localization-panel"><div class="admin-library-localization-head"><strong>Langues disponibles sur ce contenu · Référence ${libraryLocaleLabel(libraryReferenceLocale(si))}</strong>${libraryContentScopeTag(ch,si)}</div>${libraryLocalizationDetails(si,'situation',si.country_codes||[])}</div>`:''}</section><section class="admin-library-editor-section admin-library-editor-answers"><div class="admin-library-answer-head"><div class="admin-library-editor-section-title"><span class="admin-library-editor-icon">✓</span><div><h4>Réponses et scoring</h4><p>${isLinked?'Réponses héritées de la situation source.':'Le score reste administré par Me&amp;YouToo.'}</p></div></div>${readonly?'':'<button class="button button-secondary button-small" type="button" data-add-inline-answer>+ Ajouter une réponse</button>'}</div><div class="admin-library-answer-list" data-inline-answer-list>${answers.map((answer,index)=>answerInlineRow(answer,index,readonly,si.country_codes||[])).join('')}</div></section><div class="admin-library-inline-actions admin-library-content-actions">${isLinked?`<button class="button button-danger-soft" type="button" data-unlink-situation-placement="${si._placement_id}">Retirer de cet autodiagnostic</button><span class="admin-library-action-spacer"></span><button class="button button-primary" type="submit">Enregistrer l’emplacement</button>`:isArchived?`<button class="button button-secondary" type="button" data-restore-situation="${si.id}">Restaurer</button><button class="button button-danger-soft" type="button" data-delete-situation="${si.id}">Déplacer dans les supprimées</button>`:isDeleted?`<button class="button button-secondary" type="button" data-undelete-situation="${si.id}">Restaurer</button><button class="button button-danger-soft" type="button" data-delete-situation-permanent="${si.id}">Supprimer définitivement</button>`:`<button class="button button-danger-soft" type="button" data-archive-situation="${si.id}">Archiver</button><button class="button button-danger-soft admin-library-delete-button" type="button" data-delete-situation="${si.id}">Supprimer</button><span class="admin-library-action-spacer"></span><button class="button button-secondary" type="button" data-cancel-inline>Annuler</button><button class="button button-primary" type="submit">Enregistrer la situation</button>`}</div></form></details>`;
  }
  function answerInlineRow(answer={},index=0,readonly=false,countryCodes=[]){return `<div class="admin-library-answer-row"><span class="admin-library-answer-number">${Number(index)+1}</span><label class="admin-library-answer-content"><span>Réponse</span><input data-answer-content placeholder="Texte de la réponse" value="${esc(answer.content||'')}" required ${readonly?'disabled':''}></label><label class="admin-library-answer-score"><span>Score</span><input data-answer-score type="number" step="0.01" value="${answer.score??''}" required ${readonly?'disabled':''}></label><label class="admin-library-best-answer" title="Réponse attendue / la plus inclusive"><input data-answer-best type="checkbox" ${answer.is_best?'checked':''} ${readonly?'disabled':''}><span>Meilleure réponse</span></label>${readonly?'':`<button type="button" class="admin-library-answer-remove" data-remove-inline-answer aria-label="Supprimer la réponse">×</button>`}<div class="admin-library-answer-localization">${libraryFilteredTranslations(answer,countryCodes).length?`<details><summary>Voir les langues disponibles</summary>${libraryLocalizationDetails(answer,'answer',countryCodes)}</details>`:''}</div></div>`;}
  function profileInlineRow(ch,profile={},index=0){
    const profileMedia=(ch.media||[]).filter(m=>m.placement==='profile_result');
    const chapterLocales=[...new Set((Array.isArray(ch.available_locales)&&ch.available_locales.length?ch.available_locales:['fr']).map(x=>String(x||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
    const mediaForLocale=locale=>profileMedia.find(m=>String(m.locale||'').toLowerCase()===locale)||(locale==='fr'?profileMedia.find(m=>!m.locale):null)||null;
    const effectiveMedia=mediaForLocale('fr')||profileMedia[0]||null;
    const videoLanguageRows=chapterLocales.map(locale=>{
      const current=mediaForLocale(locale);
      return `<label class="admin-library-video-select admin-profile-video-select"><span>${esc(locale.toUpperCase())}</span><select data-profile-video-library data-profile-video-locale="${esc(locale)}">${mediaLibraryOptions(current?.video_id||'',{chapter:ch,locale})}</select></label>`;
    }).join('');
    const color=esc(profile.color||'#dce6ec');
    return `<article class="admin-library-profile-inline-card admin-profile-card-v2"><details><summary>
      <div class="admin-library-profile-summary">
        <span class="admin-library-profile-index">Profil ${index+1}</span>
        <div class="admin-profile-summary-copy">
          <strong>${esc(profile.title||'Profil à renseigner')}</strong>
          <small>${profile.content?'Restitution renseignée':'Restitution à compléter'} · ${profile.scoring_min??'—'} à ${profile.scoring_max??'—'}${effectiveMedia?' · 🎬 '+esc(effectiveMedia.title):''}</small>${libraryLocalizationBadges(profile)}
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

      <section class="admin-profile-editor-card admin-profile-localization-card">
        <div class="admin-profile-editor-card-head">
          <span class="admin-profile-editor-card-icon">🌐</span>
          <div><h4>Langues et périmètre culturel</h4><p>Les traductions générales et les variantes propres à un pays restent rattachées à ce même profil.</p></div>
        </div>
        ${libraryLocalizationBadges(profile)}
        <div class="admin-library-localization-list">${libraryLocalizationDetails(profile,'profile')}</div>
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
        <div class="admin-profile-video-language-grid">${videoLanguageRows}</div>
        <small class="admin-library-video-help">Facultatif : chaque liste est filtrée selon le périmètre culturel du chapitre + la langue. Le titre, le périmètre, la langue et les tags de la médiathèque restent visibles pour identifier la bonne version. Si ce chapitre n’a pas de vidéo, laissez « Aucune vidéo ». Le choix est appliqué aux 3 profils.</small>
      </section>

    </div></details></article>`;
  }
  function mediaPlacementLabel(media){if(media.placement==='after_chapter')return'Après le chapitre';if(media.profile_position===null||media.profile_position===undefined)return'Dans tous les profils';return`Dans le profil ${Number(media.profile_position)+1}`;}
  function mediaInlineRow(ch,media={}){return `<article class="admin-library-media-card"><div class="admin-library-media-card-head"><div><strong>${esc(media.title||'Vidéo')}</strong><span class="admin-library-media-tag">${esc(mediaPlacementLabel(media))}</span></div><button type="button" class="button button-ghost button-small" data-edit-media="${media.id}">Modifier</button></div><form class="admin-library-media-form" data-media-form="${media.id}" hidden><input type="hidden" data-media-placement value="${esc(media.placement||'after_chapter')}"><div class="admin-library-media-grid"><label>Vidéo de la médiathèque<select data-media-video-id required>${mediaLibraryOptions(media.video_id||'')}</select></label><label class="admin-library-media-active"><input data-media-active type="checkbox" ${media.active!==false?'checked':''}> Association active</label></div><div class="admin-library-inline-actions"><button type="button" class="button button-danger-soft" data-delete-media="${media.id}">Retirer du chapitre</button><span class="admin-library-action-spacer"></span><button type="button" class="button button-secondary" data-cancel-media>Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form></article>`;}
  function newMediaForm(chapterId){return `<form class="admin-library-media-form admin-library-media-new" data-new-media-form="${chapterId}"><div class="admin-library-new-badge">Vidéo après le chapitre</div><input type="hidden" data-media-placement value="after_chapter"><div class="admin-library-media-grid"><label>Choisir dans la médiathèque<select data-media-video-id required>${mediaLibraryOptions()}</select><small>Ajoutez d’abord la vidéo dans la Médiathèque si elle n’existe pas encore.</small></label><label class="admin-library-media-active"><input data-media-active type="checkbox" checked> Association active</label></div><div class="admin-library-inline-actions"><button type="button" class="button button-secondary" data-cancel-media>Annuler</button><button type="submit" class="button button-primary">Associer la vidéo</button></div></form>`;}
  function mediaPayload(form){return{videoId:form.querySelector('[data-media-video-id]').value,placement:form.querySelector('[data-media-placement]').value,profilePosition:null,active:form.querySelector('[data-media-active]').checked};}
  function bindMediaForm(form){}
  const libraryCountryOptions=['AR','AT','BR','CA','CL','CN','KR','DK','ES','US','FR','HK','JP','MX','NO','PA','PT','SE','CH','TW','UY','DE'];
  function renderThemeCountryEditor(form){
    const box=$('#library-theme-country-tags'),select=$('#library-theme-country-add');
    if(!box||!select)return;
    const codes=[...new Set((form._countryCodes||[]).map(x=>String(x).toUpperCase()).filter(Boolean))];
    box.innerHTML=codes.map(c=>`<span class="admin-library-theme-scope-tag is-scope">${esc(libraryCountryLabel(c))}<button type="button" data-remove-theme-country="${esc(c)}" aria-label="Retirer ${esc(libraryCountryLabel(c))}">×</button></span>`).join('')||'<span class="hint">Aucun pays sélectionné</span>';
    select.innerHTML='<option value="">Ajouter un pays…</option>'+libraryCountryOptions.filter(c=>!codes.includes(c)).map(c=>`<option value="${c}">${esc(libraryCountryLabel(c))}</option>`).join('');
    box.querySelectorAll('[data-remove-theme-country]').forEach(b=>b.onclick=()=>{form._countryCodes=codes.filter(c=>c!==b.dataset.removeThemeCountry);renderThemeCountryEditor(form);});
  }
  function openThemeDialog(theme=null){const d=$('#library-theme-dialog'),f=$('#library-theme-form');f.reset();$('#library-theme-id').value=theme?.id||'';$('#library-theme-title').value=theme?.title||'';$('#library-theme-description').value=theme?.description||'';$('#library-theme-base-title').value=theme?.base_title||theme?.title||'';$('#library-theme-respondent-title').value=theme?.respondent_title_default||theme?.title||'';$('#library-theme-introduction').value=theme?.introduction_html||'';$('#library-theme-result-title').value=theme?.result_title||'';$('#library-theme-result-sentence').value=theme?.result_sentence||'';$('#library-theme-active').checked=Boolean(theme?.active);$('#library-theme-admin-tags').value=(theme?.admin_tags||[]).join(', ');f._countryCodes=[...((theme?.country_codes||theme?.auto_country_codes||[]).map(x=>String(x).toUpperCase()))];renderThemeCountryEditor(f);d.querySelector('h2').textContent=theme?'Modifier la thématique':'Créer une thématique';d.showModal();}
  function openChapterDialog(themeId,chapter=null){const d=$('#library-chapter-dialog'),f=$('#library-chapter-form');f.reset();$('#library-chapter-id').value=chapter?.id||'';$('#library-chapter-theme-id').value=themeId||'';$('#library-chapter-title').value=chapter?.title||'';$('#library-chapter-client-description').value=chapter?.client_description||'';$('#library-chapter-locked').checked=Boolean(chapter?.locked);$('#library-chapter-lock-reason').value=chapter?.lock_reason||'';d.querySelector('h2').textContent=chapter?'Modifier le chapitre':'Ajouter un chapitre';d.showModal();}
  function newSituationForm(chapterId){return `<form class="admin-library-inline-form admin-library-situation-form admin-library-new-situation" data-new-situation-form="${chapterId}"><div class="admin-library-new-badge">Nouvelle situation</div><section class="admin-library-editor-section admin-library-editor-situation"><div class="admin-library-editor-section-title"><span class="admin-library-editor-icon">✎</span><div><h4>Situation</h4><p>Créez le contenu, classez-le et ajoutez les mots-clés qui permettront de le retrouver dans le catalogue global.</p></div></div><label class="admin-library-wide-label admin-library-content-field"><span>Texte de la situation</span><textarea data-inline-situation-content rows="3" required placeholder="Saisir le texte de la situation"></textarea></label><label class="admin-library-wide-label admin-library-tags-field"><span>Tags de recherche — manuels</span><input data-inline-situation-tags placeholder="Ex. apprenti, tenue, apparence, réunion, client"><small>Ajoutez les mots concrets qui permettront de retrouver cette situation : personne, statut, lieu, objet, moment ou contexte métier.</small></label><fieldset class="admin-library-placement-choice"><legend>Où ajouter cette situation ?</legend><label><input type="radio" name="placement-new-${chapterId}" data-situation-placement value="base"> <span><strong>Base du thème</strong><small>Proposée par défaut dans la composition initiale.</small></span></label><label><input type="radio" name="placement-new-${chapterId}" data-situation-placement value="library" checked> <span><strong>Bibliothèque complémentaire</strong><small>Alternative disponible uniquement dans cet autodiagnostic.</small></span></label></fieldset></section><section class="admin-library-editor-section admin-library-editor-answers"><div class="admin-library-answer-head"><div class="admin-library-editor-section-title"><span class="admin-library-editor-icon">✓</span><div><h4>Réponses et scoring</h4><p>Ajoutez les réponses proposées au répondant et leur score.</p></div></div><button class="button button-secondary button-small" type="button" data-add-inline-answer>+ Ajouter une réponse</button></div><div class="admin-library-answer-list" data-inline-answer-list>${answerInlineRow({score:0},0)}${answerInlineRow({score:1},1)}${answerInlineRow({score:2},2)}</div></section><div class="admin-library-inline-actions"><button class="button button-secondary" type="button" data-cancel-new-situation>Annuler</button><button class="button button-primary" type="submit">Créer la situation</button></div></form>`;}
  function renumberInlineAnswers(list){[...list.querySelectorAll('.admin-library-answer-number')].forEach((el,index)=>el.textContent=String(index+1));}
  function minimumAnswersForList(list){return list.closest('[data-new-situation-form]')?3:2;}
  function addInlineAnswer(list){const wrap=document.createElement('div');wrap.innerHTML=answerInlineRow({},list.children.length);const row=wrap.firstElementChild;row.querySelector('[data-remove-inline-answer]').onclick=()=>{if(list.children.length>minimumAnswersForList(list)){row.remove();renumberInlineAnswers(list);}};list.appendChild(row);renumberInlineAnswers(list);}
  function collectSituationForm(form){const answers=[...form.querySelectorAll('.admin-library-answer-row')].map(row=>({content:row.querySelector('[data-answer-content]')?.value.trim()||'',score:Number(row.querySelector('[data-answer-score]')?.value),isBest:Boolean(row.querySelector('[data-answer-best]')?.checked)}));const placement=form.querySelector('[data-situation-placement]:checked')?.value||'library';const tags=String(form.querySelector('[data-inline-situation-tags]')?.value||'').split(',').map(v=>v.trim()).filter(Boolean);return{content:form.querySelector('[data-inline-situation-content]')?.value.trim()||'',isDefault:placement==='base',placement,tags,answers};}
  function bindInlineForm(form){
    form.querySelectorAll('[data-remove-inline-answer]').forEach(b=>b.onclick=()=>{const list=b.closest('[data-inline-answer-list]');if(list.children.length>minimumAnswersForList(list)){b.closest('.admin-library-answer-row').remove();renumberInlineAnswers(list);}});
    const add=form.querySelector('[data-add-inline-answer]');if(add)add.onclick=()=>addInlineAnswer(form.querySelector('[data-inline-answer-list]'));
  }
  function bindLibraryActions(){
    const autoTag=$('[data-auto-tag-catalog]');if(autoTag)autoTag.onclick=async()=>{try{autoTag.disabled=true;autoTag.textContent='Analyse en cours…';const preview=await StudioAPI.request('/api/admin/catalog/tagging-preview');const sample=(preview.items||[]).filter(x=>x.merged?.length>x.current?.length).slice(0,5).map(x=>`• ${x.theme} — ${x.chapter}
  ${x.suggested.join(', ')}`).join('\n\n');const message=`Analyse terminée : ${preview.total||0} situations analysées (base + bibliothèque complémentaire Sexisme).
${preview.tagged||0} ont déjà des tags · ${preview.untagged||0} n'en ont pas.
${preview.toEnrich||0} situations peuvent être enrichies.

${sample?`Exemples de tags proposés :
${sample}

`:''}Appliquer ces tags maintenant ?

Les tags existants seront conservés. La bibliothèque complémentaire Sexisme est incluse. Les autres bibliothèques complémentaires seront intégrées plus tard à partir de vos fichiers Excel ou Word.`;const confirmed=await StudioModal.confirm({eyebrow:'Catalogue Me&YouToo',title:'Intégrer les tags proposés ?',message,type:'info',cancelLabel:'Annuler',confirmLabel:'Intégrer les tags'});if(!confirmed){autoTag.disabled=false;autoTag.textContent='Analyser et intégrer les tags';return;}autoTag.textContent='Intégration…';const result=await StudioAPI.request('/api/admin/catalog/tagging-apply',{method:'POST',body:'{}'});await refreshLibrary();await StudioModal.alert({eyebrow:'Catalogue Me&YouToo',title:'Tags intégrés',message:`${result.updated||0} situation${Number(result.updated||0)>1?'s':''} enrichie${Number(result.updated||0)>1?'s':''}, base et bibliothèque complémentaire Sexisme incluses.`,type:'success',confirmLabel:'Fermer'});}catch(error){showError(error.message);}finally{const b=$('[data-auto-tag-catalog]');if(b){b.disabled=false;b.textContent='Analyser et intégrer les tags';}}};
    $$('[data-open-library-theme]').forEach(card=>{const open=()=>{state.libraryThemeId=card.dataset.openLibraryTheme;state.libraryExpandedChapters=new Set();renderLibraryAdmin();};card.onclick=open;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
    const back=$('[data-library-back]');if(back)back.onclick=()=>{state.libraryThemeId=null;state.libraryExpandedChapters=new Set();renderLibraryAdmin();};
    $$('[data-edit-theme]').forEach(b=>b.onclick=e=>{e.stopPropagation();openThemeDialog(findTheme(b.dataset.editTheme));});
    $$('[data-toggle-theme-active]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const theme=findTheme(b.dataset.toggleThemeActive);if(!theme)return;try{b.disabled=true;await StudioAPI.request('/api/admin/catalog/themes/'+theme.id,{method:'PATCH',body:JSON.stringify({active:!Boolean(theme.active)})});await refreshLibrary();}catch(error){b.disabled=false;showError(error.message);}});
    $$('[data-add-chapter]').forEach(b=>b.onclick=e=>{e.stopPropagation();openChapterDialog(b.dataset.addChapter);});
    $$('[data-edit-chapter]').forEach(b=>b.onclick=e=>{e.stopPropagation();const ch=findChapter(b.dataset.editChapter);openChapterDialog(state.libraryThemeId,ch);});
    $$('[data-toggle-library-chapter]').forEach(head=>{const toggle=()=>{const id=String(head.dataset.toggleLibraryChapter);state.libraryExpandedChapters.has(id)?state.libraryExpandedChapters.delete(id):state.libraryExpandedChapters.add(id);renderLibraryAdmin();};head.onclick=e=>{if(e.target.closest('button'))return;toggle();};head.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();toggle();}};});
    $$('[data-library-situation-filter]').forEach(b=>b.onclick=e=>{e.stopPropagation();state.librarySituationFilters.set(String(b.dataset.chapterId),b.dataset.librarySituationFilter||'all');state.libraryExpandedChapters.add(String(b.dataset.chapterId));renderLibraryAdmin();});
    $$('[data-open-global-picker]').forEach(b=>b.onclick=e=>{e.stopPropagation();state.libraryGlobalPickerChapterId=String(b.dataset.openGlobalPicker);state.libraryGlobalPickerSourcePlacement=b.dataset.pickerSource==='library'?'library':'base';state.libraryGlobalPickerQuery='';state.libraryGlobalPickerThemeId='';state.libraryGlobalPickerSourceChapterId='';state.libraryExpandedChapters.add(String(b.dataset.openGlobalPicker));renderLibraryAdmin();setTimeout(()=>document.querySelector('[data-global-picker-search]')?.focus(),0);});
    $$('[data-close-global-picker]').forEach(b=>b.onclick=()=>{state.libraryGlobalPickerChapterId=null;state.libraryGlobalPickerQuery='';state.libraryGlobalPickerThemeId='';state.libraryGlobalPickerSourceChapterId='';renderLibraryAdmin();});
    $$('[data-global-picker-search]').forEach(input=>input.oninput=()=>{state.libraryGlobalPickerQuery=input.value;const chapterId=String(state.libraryGlobalPickerChapterId||'');renderLibraryAdmin();state.libraryExpandedChapters.add(chapterId);const field=document.querySelector('[data-global-picker-search]');if(field){field.focus();field.setSelectionRange(field.value.length,field.value.length);}});
    $$('[data-global-picker-theme]').forEach(select=>select.onchange=()=>{state.libraryGlobalPickerThemeId=select.value;state.libraryGlobalPickerSourceChapterId='';renderLibraryAdmin();});
    $$('[data-global-picker-source-chapter]').forEach(select=>select.onchange=()=>{state.libraryGlobalPickerSourceChapterId=select.value;renderLibraryAdmin();});
    $$('[data-link-global-situation]').forEach(b=>b.onclick=async()=>{try{const card=b.closest('[data-global-situation-card]');const activeLocales=[...card.querySelectorAll('[data-picker-locale]:checked')].map(el=>el.value);if(!activeLocales.length){showError('Choisissez au moins une langue pour cette situation.');return;}b.disabled=true;await StudioAPI.request('/api/admin/catalog/chapters/'+b.dataset.targetChapter+'/situation-placements',{method:'POST',body:JSON.stringify({situationId:Number(b.dataset.linkGlobalSituation),placement:b.dataset.placement,activeLocales})});const chapterId=String(b.dataset.targetChapter);await refreshLibrary();state.libraryExpandedChapters.add(chapterId);state.libraryGlobalPickerChapterId=chapterId;renderLibraryAdmin();}catch(error){b.disabled=false;showError(error.message);}});
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
        if(!await StudioModal.confirm({eyebrow:'Catalogue Me&YouToo',title:'Supprimer cette vidéo du catalogue ?',message:'La vidéo sera retirée de ce contenu du catalogue.',type:'danger',cancelLabel:'Conserver',confirmLabel:'Supprimer'}))return;
        try{
          await StudioAPI.request('/api/admin/catalog/media/'+del.dataset.deleteMedia,{method:'DELETE'});
          await refreshLibrary();
          renderLibraryAdmin();
        }catch(error){showError(error.message);}
      };
    });
    $$('[data-save-library-translation]').forEach(button=>button.onclick=async e=>{
      e.preventDefault();e.stopPropagation();
      const row=button.closest('[data-library-translation-row]');if(!row)return;
      const content={};row.querySelectorAll('[data-translation-field]').forEach(field=>content[field.dataset.translationField]=field.value);
      button.disabled=true;
      try{
        await StudioAPI.request('/api/admin/catalog/translations/'+button.dataset.saveLibraryTranslation,{method:'PATCH',body:JSON.stringify({content})});
        await refreshLibrary();renderLibraryAdmin();
      }catch(error){showError(error.message);}finally{button.disabled=false;}
    });
    $$('[data-situation-inline-form]').forEach(form=>{bindInlineForm(form);const cancel=form.querySelector('[data-cancel-inline]');if(cancel)cancel.onclick=()=>{const d=form.closest('details');if(d)d.open=false;};form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;try{const payload=collectSituationForm(form);if(form.dataset.placementId){const activeLocales=[...form.querySelectorAll('[data-linked-active-locale]:checked')].map(el=>el.value);if(!activeLocales.length){showError('Choisissez au moins une langue pour cette situation.');return;}await StudioAPI.request('/api/admin/catalog/situation-placements/'+form.dataset.placementId,{method:'PATCH',body:JSON.stringify({placement:payload.placement,activeLocales})});}else await StudioAPI.request('/api/admin/catalog/situations/'+form.dataset.situationInlineForm,{method:'PATCH',body:JSON.stringify(payload)});const chapterId=String(form.dataset.chapterId);await refreshLibrary();state.libraryExpandedChapters.add(chapterId);renderLibraryAdmin();}catch(error){showError(error.message);}};});
    $$('[data-unlink-situation-placement]').forEach(b=>b.onclick=async()=>{if(!await StudioModal.confirm({eyebrow:'Catalogue Me&YouToo',title:'Retirer cette situation de cet autodiagnostic ?',message:'La situation source restera disponible dans le Catalogue Me&YouToo. Seul ce rattachement sera retiré.',type:'warning',cancelLabel:'Conserver',confirmLabel:'Retirer'}))return;try{await StudioAPI.request('/api/admin/catalog/situation-placements/'+b.dataset.unlinkSituationPlacement,{method:'DELETE'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-archive-situation]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const si=findSituation(b.dataset.archiveSituation);if(!await StudioModal.confirm({eyebrow:'Catalogue Me&YouToo',title:'Archiver cette situation ?',message:`« ${si?.content||'Cette situation'} »\n\nElle ne sera plus proposée dans les nouvelles campagnes. Les campagnes existantes ne seront pas modifiées.`,type:'warning',cancelLabel:'Conserver',confirmLabel:'Archiver'}))return;try{await StudioAPI.request('/api/admin/catalog/situations/'+b.dataset.archiveSituation+'/archive',{method:'POST'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-restore-situation]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();try{await StudioAPI.request('/api/admin/catalog/situations/'+b.dataset.restoreSituation+'/restore',{method:'POST'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-delete-situation]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const si=findSituation(b.dataset.deleteSituation);if(!await StudioModal.confirm({eyebrow:'Catalogue Me&YouToo',title:'Déplacer cette situation dans les supprimées ?',message:`« ${si?.content||'Cette situation'} »\n\nElle ne sera plus proposée dans les nouvelles campagnes et pourra être restaurée depuis le filtre « Supprimées ».`,type:'danger',cancelLabel:'Conserver',confirmLabel:'Déplacer dans les supprimées'}))return;try{await StudioAPI.request('/api/admin/catalog/situations/'+b.dataset.deleteSituation,{method:'DELETE'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-undelete-situation]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();try{await StudioAPI.request('/api/admin/catalog/situations/'+b.dataset.undeleteSituation+'/undelete',{method:'POST'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-delete-situation-permanent]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const si=findSituation(b.dataset.deleteSituationPermanent);if(!await StudioModal.confirm({eyebrow:'Catalogue Me&YouToo',title:'Supprimer définitivement cette situation ?',message:`« ${si?.content||'Cette situation'} »\n\nCette action est irréversible. Si la situation a déjà été utilisée dans une campagne, le Studio refusera la suppression définitive.`,type:'danger',cancelLabel:'Conserver',confirmLabel:'Supprimer définitivement'}))return;try{await StudioAPI.request('/api/admin/catalog/situations/'+b.dataset.deleteSituationPermanent+'/permanent',{method:'DELETE'});await refreshLibrary();renderLibraryAdmin();}catch(error){showError(error.message);}});
    $$('[data-profile-inline-form]').forEach(form=>{bindProfileVideoSync(form);form.querySelector('[data-cancel-inline]').onclick=()=>{const d=form.closest('details');if(d)d.open=false;};form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;const chapterId=form.dataset.profileInlineForm,rows=[...form.querySelectorAll('.admin-library-profile-inline-card')],profiles=rows.map(row=>({title:row.querySelector('[data-profile-title]').value.trim(),content:row.querySelector('[data-profile-content]').value.trim(),summary:row.querySelector('[data-profile-summary]').value.trim(),scoringMin:row.querySelector('[data-profile-min]').value,scoringMax:row.querySelector('[data-profile-max]').value,topScore:row.querySelector('[data-profile-top]').value,color:row.querySelector('[data-profile-color]').value.trim()}));try{await StudioAPI.request('/api/admin/catalog/chapters/'+chapterId+'/profiles',{method:'PUT',body:JSON.stringify({profiles})});await syncChapterProfileVideo(chapterId,form);await refreshLibrary();state.libraryExpandedChapters.add(String(chapterId));renderLibraryAdmin();}catch(error){showError(error.message);}};});
  }
  function bindProfileVideoSync(form){
    const selects=[...form.querySelectorAll('[data-profile-video-library]')];
    selects.forEach(select=>select.onchange=()=>{
      const locale=String(select.dataset.profileVideoLocale||'fr');
      const value=select.value;
      selects.filter(other=>String(other.dataset.profileVideoLocale||'fr')===locale).forEach(other=>other.value=value);
    });
  }
  async function syncChapterProfileVideo(chapterId,form){
    const byLocale=new Map();
    [...form.querySelectorAll('[data-profile-video-library]')].forEach(select=>{
      const locale=String(select.dataset.profileVideoLocale||'fr').toLowerCase();
      if(!byLocale.has(locale))byLocale.set(locale,select.value||'');
    });
    const videos=[...byLocale.entries()].map(([locale,videoId])=>({locale,videoId:videoId||null}));
    await StudioAPI.request('/api/admin/catalog/chapters/'+chapterId+'/profile-video',{
      method:'PUT',
      body:JSON.stringify({videos})
    });
  }
  async function refreshLibrary(){state.catalogLoaded=false;await loadLibraryAdmin();}
  function addContact(){const i=contactsRoot.children.length+1,card=document.createElement('article');card.className='admin-contact-card';card.innerHTML=`<div class="admin-contact-head"><strong>Personne ${i}</strong><button type="button" class="admin-contact-remove">Supprimer</button></div><div class="admin-contact-grid"><label>Prénom<input data-contact="firstName" required></label><label>Nom<input data-contact="lastName" required></label><label>Fonction<input data-contact="jobTitle" required></label><label>Téléphone <span class="hint">(facultatif)</span><input data-contact="phone" type="tel"></label><label>Email professionnel<input data-contact="email" type="email" required></label></div><p class="admin-invitation-note">✉️ Cette personne recevra un lien personnel.</p>`;card.querySelector('button').onclick=()=>card.remove();contactsRoot.appendChild(card);}
  const selectedSectors=()=>[$('#org-sector').value].filter(Boolean),contactsPayload=()=>$$('.admin-contact-card').map(card=>{const value=n=>card.querySelector(`[data-contact="${n}"]`).value.trim();return{firstName:value('firstName'),lastName:value('lastName'),jobTitle:value('jobTitle'),phone:value('phone'),email:value('email')};}),selectedQuota=()=>$('#org-credit-pack').value==='custom'?Math.max(0,Number($('#org-quota').value)||0):Number($('#org-credit-pack').value)||0,selectedRemaining=()=>Math.max(0,Number($('#org-remaining').value)||0);
  let orgRemainingManuallyEdited=false;
  function syncQuota(){const custom=$('#org-credit-pack').value==='custom';$('#org-custom-credit-wrap').hidden=!custom;$('#org-quota').required=custom;const quota=selectedQuota();$('#org-remaining').max=String(quota);if(!orgRemainingManuallyEdited||selectedRemaining()>quota)$('#org-remaining').value=String(quota);}
  function openNewOrganization(){ $('#org-form').reset();contactsRoot.innerHTML='';orgRemainingManuallyEdited=false;syncQuota();const manager=$('#org-account-manager');if(manager)manager.innerHTML=accountManagerOptions('');orgDialog.showModal(); }
  $('#refresh-admin').onclick=load;$('#new-org').onclick=openNewOrganization;const newOrgClients=$('#new-org-clients');if(newOrgClients)newOrgClients.onclick=openNewOrganization;const goClientsFromAccounts=$('#go-clients-from-accounts');if(goClientsFromAccounts)goClientsFromAccounts.onclick=()=>activateTab('clients');$('#add-org-contact').onclick=addContact;$('#org-credit-pack').onchange=syncQuota;$('#org-quota').oninput=syncQuota;$('#org-remaining').oninput=()=>{orgRemainingManuallyEdited=true;};$('#new-admin-user').onclick=()=>openAdminForm();$$('[data-close-dialog]').forEach(b=>b.onclick=()=>$('#'+b.dataset.closeDialog).close());[orgDialog,userDialog,adminUserDialog].forEach(d=>d.onclick=e=>{if(e.target===d)d.close();});
  $('#create-org').onclick=async e=>{e.preventDefault();if(!$('#org-form').reportValidity())return;const selected=selectedSectors();if(!selected.length)return;const quota=selectedQuota(),remaining=selectedRemaining();if(remaining>quota)return showError('Les crédits restants ne peuvent pas dépasser les crédits attribués.');try{await StudioAPI.request('/api/admin/organizations',{method:'POST',body:JSON.stringify({name:$('#org-name').value.trim(),countryCode:$('#org-country')?.value||'FR',sectors:selected,contacts:contactsPayload(),passationsQuota:quota,passationsRemaining:remaining,packStartedAt:$('#org-pack-start').value||null,packExpiresAt:$('#org-expiry').value||null,accountManagerUserId:$('#org-account-manager')?.value||null})});orgDialog.close();await load();activateTab('clients');}catch(error){showError(error.message);}};
  $('#user-access-level').onchange=()=>renderAdminClientPermissions(clientPermissionPresets[$('#user-access-level').value]||clientPermissionPresets.manager);
  $('#create-user').onclick=async e=>{e.preventDefault();const f=$('#user-form');if(!f.reportValidity())return;const id=f.dataset.editId,payload={organizationId:$('#user-org-id').value,firstName:$('#user-first').value.trim(),lastName:$('#user-last').value.trim(),jobTitle:$('#user-job-title').value.trim(),phone:$('#user-phone').value.trim(),email:$('#user-email').value.trim(),accessLevel:$('#user-access-level').value,permissions:selectedAdminClientPermissions()};try{await StudioAPI.request(id?'/api/admin/client-users/'+id:'/api/admin/users',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});userDialog.close();load();}catch(error){showError(error.message);}};
  $('#create-admin-user').onclick=async e=>{e.preventDefault();const f=$('#admin-user-form');if(!f.reportValidity())return;const id=f.dataset.editId,payload={firstName:$('#admin-user-first').value.trim(),lastName:$('#admin-user-last').value.trim(),jobTitle:$('#admin-user-job').value.trim(),phone:$('#admin-user-phone').value.trim(),email:$('#admin-user-email').value.trim()};try{await StudioAPI.request('/api/admin/administrators'+(id?'/'+id:''),{method:id?'PATCH':'POST',body:JSON.stringify(payload)});adminUserDialog.close();load();}catch(error){showError(error.message);}};
  ['org-search','org-sector-filter','org-theme-filter','org-scope-filter','org-folder-filter','org-sort'].forEach(id=>$('#'+id)?.addEventListener(id==='org-search'?'input':'change',()=>{if(id==='org-folder-filter')state.clientFolderFilter=$('#org-folder-filter').value||'all';if(id==='org-theme-filter'){renderLanguageCountFilter();renderScopeFilter();}renderChips();renderClientFolderBar();renderOrganizations();}));
  $('#org-language-count-options')?.addEventListener('change',e=>{if(!e.target.matches('[data-language-count]'))return;renderLanguageCountFilter();renderScopeFilter();renderChips();renderClientFolderBar();renderOrganizations();});
  $('[data-clear-language-counts]')?.addEventListener('click',()=>{$$('[data-language-count]').forEach(input=>input.checked=false);renderLanguageCountFilter();renderScopeFilter();renderChips();renderClientFolderBar();renderOrganizations();});
  if($('#org-jump-button'))$('#org-jump-button').addEventListener('click',toggleClientJump);
  if($('#org-jump-search'))$('#org-jump-search').addEventListener('input',renderClientJump);
  document.addEventListener('click',e=>{const picker=$('#org-jump-picker');if(picker&&!picker.contains(e.target))closeClientJump();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeClientJump();});
['campaign-search','campaign-status','campaign-theme','campaign-period','campaign-scope','campaign-locale','campaign-client','campaign-sort'].forEach(id=>{const el=$('#'+id);if(el)el.addEventListener(id==='campaign-search'?'input':'change',renderCampaigns);});$$('[data-admin-campaign-kpi]').forEach(button=>button.addEventListener('click',()=>{state.campaignQuickFilter=button.dataset.adminCampaignKpi||'all';renderCampaigns();}));['account-search','account-status'].forEach(id=>$('#'+id).addEventListener(id==='account-search'?'input':'change',renderAccounts));$('#activity-search').oninput=renderActivity;
  const newLibraryTheme=$('#new-library-theme');if(newLibraryTheme)newLibraryTheme.onclick=()=>openThemeDialog();
  const newMediaLibrary=$('#new-media-library');if(newMediaLibrary)newMediaLibrary.onclick=()=>openMediaLibraryForm();
  const mediaLibrarySearch=$('#media-library-search');if(mediaLibrarySearch)mediaLibrarySearch.oninput=renderMediaLibrary;
  const mediaLibraryStatus=$('#media-library-status');if(mediaLibraryStatus)mediaLibraryStatus.onchange=renderMediaLibrary;const mediaLibraryTheme=$('#media-library-theme');if(mediaLibraryTheme)mediaLibraryTheme.onchange=renderMediaLibrary;const mediaLibraryScope=$('#media-library-scope');if(mediaLibraryScope)mediaLibraryScope.onchange=renderMediaLibrary;const mediaLibraryLocale=$('#media-library-locale');if(mediaLibraryLocale)mediaLibraryLocale.onchange=renderMediaLibrary;const mediaLibraryTag=$('#media-library-tag');if(mediaLibraryTag)mediaLibraryTag.onchange=renderMediaLibrary;
  const themeCountryAdd=$('#library-theme-country-add');if(themeCountryAdd)themeCountryAdd.onchange=()=>{const form=$('#library-theme-form'),code=themeCountryAdd.value;if(form&&code){form._countryCodes=[...new Set([...(form._countryCodes||[]),code])];renderThemeCountryEditor(form);}themeCountryAdd.value='';};
  const themeForm=$('#library-theme-form');if(themeForm)themeForm.onsubmit=async e=>{e.preventDefault();if(!themeForm.reportValidity())return;const id=$('#library-theme-id').value,payload={title:$('#library-theme-title').value.trim(),description:$('#library-theme-description').value.trim(),baseTitle:$('#library-theme-base-title').value.trim(),respondentTitle:$('#library-theme-respondent-title').value.trim(),introductionHtml:$('#library-theme-introduction').value.trim(),resultTitle:$('#library-theme-result-title').value.trim(),resultSentence:$('#library-theme-result-sentence').value.trim(),active:$('#library-theme-active').checked,adminTags:$('#library-theme-admin-tags').value.split(',').map(x=>x.trim()).filter(Boolean),culturalScopeCodes:[...(themeForm._countryCodes||[])]};try{await StudioAPI.request(id?'/api/admin/catalog/themes/'+id:'/api/admin/catalog/themes',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});$('#library-theme-dialog').close();await refreshLibrary();}catch(error){showError(error.message);}};
  const chapterForm=$('#library-chapter-form');if(chapterForm)chapterForm.onsubmit=async e=>{e.preventDefault();if(!chapterForm.reportValidity())return;const id=$('#library-chapter-id').value,themeId=$('#library-chapter-theme-id').value,payload={title:$('#library-chapter-title').value.trim(),clientDescription:$('#library-chapter-client-description').value.trim(),locked:$('#library-chapter-locked').checked,lockReason:$('#library-chapter-lock-reason').value.trim()};try{await StudioAPI.request(id?'/api/admin/catalog/chapters/'+id:'/api/admin/catalog/themes/'+themeId+'/chapters',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});$('#library-chapter-dialog').close();await refreshLibrary();}catch(error){showError(error.message);}};
  bindNavigation();
  const migrationBtn=$('#new-migration-batch');if(migrationBtn)migrationBtn.onclick=openMigrationDialog;
  const migrationScope=$('#migration-scope');if(migrationScope)migrationScope.onchange=()=>{syncMigrationScopeUi();syncMigrationLotName(true);};
  const migrationOrg=$('#migration-org');if(migrationOrg)migrationOrg.onchange=()=>syncMigrationLotName(true);
  const migrationSourceJson=$('#migration-source-json');if(migrationSourceJson)migrationSourceJson.onchange=async()=>{const file=migrationSourceJson.files?.[0],status=$('#migration-source-json-status');migrationSourceJson._migrationData=null;if(!file){if(status){status.textContent='Sélectionne le JSON historique : Studio préremplit le survey, l’ID client historique et le nom du lot.';status.classList.remove('is-success','is-error');}return;}try{const json=JSON.parse(await file.text()),data=migrationJsonData(json);if(!data.entities.length)throw new Error('Aucune entité de migration détectée');migrationSourceJson._migrationData={...data,fileName:file.name};if(data.sourceSurveyId)$('#migration-source-survey-id').value=data.sourceSurveyId;if(data.sourceCustomerId)$('#migration-source-id').value=data.sourceCustomerId;if(data.suggestedScope){$('#migration-scope').value=data.suggestedScope;syncMigrationScopeUi();}syncMigrationLotName(true);if(status){status.innerHTML=`Prérempli depuis <strong>${esc(file.name)}</strong> : survey ${data.sourceSurveyId?'#'+esc(data.sourceSurveyId):'non renseigné'}${data.sourceCustomerId?' · client historique #'+esc(data.sourceCustomerId):''}${data.sourceCustomerName?' · '+esc(data.sourceCustomerName):''}${data.suggestedScope==='client'?' · <b>Patrimoine d’un client</b>':''}.`;status.classList.remove('is-error');status.classList.add('is-success');}}catch(err){if(status){status.textContent='JSON invalide : '+err.message;status.classList.remove('is-success');status.classList.add('is-error');}}};
  const migrationForm=$('#migration-form');if(migrationForm)migrationForm.onsubmit=async e=>{e.preventDefault();try{const scope=$('#migration-scope').value,organizationId=scope==='client'?$('#migration-org').value:null,preloaded=$('#migration-source-json')?._migrationData||null;if(!preloaded?.entities?.length)throw new Error('Choisis d’abord le JSON de migration.');const sourceImport={entities:preloaded.entities,meta:preloaded.meta||{},fileName:preloaded.fileName||''};const created=await StudioAPI.request('/api/admin/migrations',{method:'POST',body:JSON.stringify({scope,organizationId,sourceCustomerName:$('#migration-source-name').value.trim(),sourceCustomerId:$('#migration-source-id').value.trim(),sourceSurveyId:$('#migration-source-survey-id').value.trim(),summary:{sourceImport}})});$('#migration-dialog').close();state.migrationsLoaded=false;await loadMigrations();if(created?.batch?.id)openDryRunDialog(created.batch.id,sourceImport);}catch(err){showError(err.message);}};
  const runDry=$('#run-migration-dryrun');if(runDry)runDry.onclick=async()=>{const d=$('#migration-dryrun-dialog'),source=d._migrationData||{},entities=source.entities||[];if(!entities.length){showError('Aucun JSON n’est associé à ce lot. Recrée le lot depuis le master JSON.');return;}runDry.disabled=true;try{const r=await StudioAPI.request('/api/admin/migrations/'+d.dataset.batchId+'/dry-run',{method:'POST',body:JSON.stringify({entities})});d.close();const b=state.migrationBatches.find(x=>String(x.id)===String(d.dataset.batchId));await StudioModal.alert({title:'Dry-run terminé',message:`${fmt(r.validation?.accepted)} éléments analysés. ${b?.scope==='client'?'Le contenu est prêt à être contrôlé puis copié tel quel dans le client. Aucune comparaison avec le catalogue n’a été effectuée.':'Aucune donnée du catalogue n’a été modifiée.'}`,confirmLabel:'Continuer'});state.migrationsLoaded=false;loadMigrations();}catch(e){showError(e.message);}finally{runDry.disabled=false;}};
  load();
})();
