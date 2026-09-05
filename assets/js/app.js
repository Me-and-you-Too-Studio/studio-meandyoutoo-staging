/* Studio Me&YouToo — navigation partagée (sidebar, bottom-nav, menu mobile)
   Toute modification du menu latéral ou de la navigation mobile se fait UNIQUEMENT ici :
   les pages HTML ne contiennent qu'un conteneur vide (#sidebar-root / #bottom-nav-root)
   que ce script remplit au chargement, comme un header/menu partagé. */
(function(){
  if (!localStorage.getItem('studio_token') && location.pathname.split('/').pop() !== 'login.html') {
    location.href='login.html';
    return;
  }
  var CURRENT = location.pathname.split('/').pop() || 'index.html';
  var CURRENT_USER = null;
  try { CURRENT_USER = JSON.parse(localStorage.getItem('studio_user') || 'null'); } catch (e) {}
  var IS_ADMIN = Boolean(CURRENT_USER && CURRENT_USER.role === 'admin');
  var INTERFACE_MODE = IS_ADMIN && sessionStorage.getItem('studio_interface_mode') !== 'client' ? 'admin' : 'client';
  var ADMIN_PAGES = ['admin.html','client.html','notifications.html','kit-communication.html','validation.html','campagne-detail.html','composer.html','personnalisation.html','parametrage.html'];
  var REQUESTED_NOTIFICATION_AUDIENCE = new URLSearchParams(location.search).get('audience');
  if (IS_ADMIN && CURRENT === 'notifications.html' && REQUESTED_NOTIFICATION_AUDIENCE === 'client') {
    INTERFACE_MODE = 'client';
    sessionStorage.setItem('studio_interface_mode', 'client');
  }
  if (IS_ADMIN && ADMIN_PAGES.includes(CURRENT) && !(CURRENT === 'notifications.html' && REQUESTED_NOTIFICATION_AUDIENCE === 'client')) {
    INTERFACE_MODE = 'admin';
    sessionStorage.setItem('studio_interface_mode', 'admin');
  }

  function setupSharedModal(){
    var dialog = document.createElement('dialog');
    dialog.className = 'studio-modal';
    dialog.setAttribute('aria-labelledby', 'studio-modal-title');
    dialog.setAttribute('aria-describedby', 'studio-modal-message');
    dialog.innerHTML =
      '<div class="studio-modal-shell">' +
        '<button class="studio-modal-close" type="button" aria-label="Fermer la fenêtre" data-modal-close>×</button>' +
        '<div class="studio-modal-icon" data-modal-icon aria-hidden="true"></div>' +
        '<div class="studio-modal-copy">' +
          '<p class="eyebrow" data-modal-eyebrow>Studio Me&amp;YouToo</p>' +
          '<h2 id="studio-modal-title" data-modal-title></h2>' +
          '<p id="studio-modal-message" class="studio-modal-message" data-modal-message></p>' +
          '<div class="studio-modal-field" data-modal-field hidden>' +
            '<label for="studio-modal-input" data-modal-label></label>' +
            '<textarea id="studio-modal-input" rows="7" data-modal-input></textarea>' +
            '<small class="studio-modal-field-error" data-modal-field-error hidden></small>' +
          '</div>' +
        '</div>' +
        '<div class="studio-modal-actions">' +
          '<button class="button button-ghost" type="button" data-modal-cancel>Annuler</button>' +
          '<button class="button button-primary" type="button" data-modal-confirm>Confirmer</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dialog);

    var title = dialog.querySelector('[data-modal-title]');
    var eyebrow = dialog.querySelector('[data-modal-eyebrow]');
    var message = dialog.querySelector('[data-modal-message]');
    var field = dialog.querySelector('[data-modal-field]');
    var label = dialog.querySelector('[data-modal-label]');
    var input = dialog.querySelector('[data-modal-input]');
    var fieldError = dialog.querySelector('[data-modal-field-error]');
    var cancelButton = dialog.querySelector('[data-modal-cancel]');
    var confirmButton = dialog.querySelector('[data-modal-confirm]');
    var closeButton = dialog.querySelector('[data-modal-close]');
    var resolveCurrent = null;
    var currentOptions = null;
    var previouslyFocused = null;

    function finish(confirmed){
      if(!resolveCurrent)return;
      var resolver = resolveCurrent;
      var result = confirmed ? { confirmed:true, value:field.hidden ? null : input.value.trim() } : { confirmed:false, value:null };
      resolveCurrent = null;
      currentOptions = null;
      document.body.classList.remove('studio-modal-open');
      if(dialog.open)dialog.close();
      if(previouslyFocused&&typeof previouslyFocused.focus==='function')previouslyFocused.focus();
      resolver(result);
    }

    function validateAndFinish(){
      if(!field.hidden&&currentOptions&&currentOptions.required&&input.value.trim()===''){
        fieldError.textContent=currentOptions.requiredMessage||'Ce champ doit être renseigné.';
        fieldError.hidden=false;
        input.setAttribute('aria-invalid','true');
        input.focus();
        return;
      }
      finish(true);
    }

    cancelButton.addEventListener('click',function(){finish(false);});
    closeButton.addEventListener('click',function(){finish(false);});
    confirmButton.addEventListener('click',validateAndFinish);
    input.addEventListener('input',function(){fieldError.hidden=true;input.removeAttribute('aria-invalid');});
    dialog.addEventListener('cancel',function(event){event.preventDefault();finish(false);});
    dialog.addEventListener('click',function(event){if(event.target===dialog)finish(false);});

    function open(options){
      options=options||{};
      if(resolveCurrent)finish(false);
      previouslyFocused=document.activeElement;
      currentOptions=options;
      dialog.dataset.type=options.type||'info';
      eyebrow.textContent=options.eyebrow||'Studio Me&YouToo';
      title.textContent=options.title||'Information';
      message.textContent=options.message||'';
      message.hidden=!options.message;
      cancelButton.textContent=options.cancelLabel||'Annuler';
      cancelButton.hidden=options.showCancel===false;
      confirmButton.textContent=options.confirmLabel||'Confirmer';
      confirmButton.className='button '+((options.type==='danger'||options.type==='error')?'studio-modal-danger':'button-primary');
      field.hidden=!options.input;
      fieldError.hidden=true;
      input.removeAttribute('aria-invalid');
      if(options.input){
        label.textContent=options.inputLabel||'Votre texte';
        input.value=options.value||'';
        input.placeholder=options.placeholder||'';
      }
      document.body.classList.add('studio-modal-open');
      dialog.showModal();
      setTimeout(function(){(options.input?input:confirmButton).focus();},0);
      return new Promise(function(resolve){resolveCurrent=resolve;});
    }

    window.StudioModal={
      open:open,
      alert:async function(options){
        if(typeof options==='string')options={message:options};
        var result=await open({...options,showCancel:false,confirmLabel:options.confirmLabel||'Fermer'});
        return result.confirmed;
      },
      confirm:async function(options){
        if(typeof options==='string')options={message:options};
        var result=await open({...options,showCancel:true});
        return result.confirmed;
      },
      prompt:async function(options){
        var result=await open({...options,showCancel:true,input:true});
        return result.confirmed?result.value:null;
      }
    };
  }

  setupSharedModal();

  var NAV_MAIN = [
    { href: 'index.html', label: 'Accueil', icon: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/>' },
    { href: 'mes-campagnes.html', label: 'Mes campagnes', icon: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>' },
    { href: 'notifications.html?audience=client', label: 'Notifications', notificationBadge: true, icon: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>' },
    { href: 'bibliotheque.html', label: 'Bibliothèque', icon: '<path d="M5 5h6v14H5zM13 5h6v14h-6z"/><path d="M8 8v8M16 8v8"/>' },
    { href: 'ressources.html', label: 'Ressources', icon: '<path d="M6 4h9l3 3v13H6z"/><path d="M14 4v4h4M9 13h6M9 17h4"/>' }
  ];

  var NAV_ADMIN = [
    { href: 'admin.html', label: 'Cockpit clients', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4M7 16h7"/>' },
    { href: 'admin.html?tab=campaigns&status=configuration_submitted', label: 'À publier', icon: '<path d="M4 12h12"/><path d="m12 6 6 6-6 6"/>' },
    { href: 'admin.html?tab=clients&filter=pack', label: 'Demandes de passations', icon: '<path d="M3 7h18v12H3z"/><path d="M6 7V5h12v2"/>' },
    { href: 'admin.html?tab=accounts', label: 'Comptes & accès', icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-7 6-7"/><path d="M16 11v6M13 14h6"/>' },
    { href: 'notifications.html', label: 'Notifications', icon: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>' }
  ];

  var NAV_SECONDARY = [
    { href: 'packs.html', label: 'Commander des passations', permission:'order_passations', icon: '<path d="M3 7h18v12H3z"/><path d="M16 12h5"/><path d="M6 7V5h12v2"/>' },
    { href: 'account.html', label: 'Mon compte', icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>' }
  ];

  var NAV_BOTTOM = [
    { href: 'index.html', label: 'Accueil' },
    { href: 'mes-campagnes.html', label: 'Campagnes' },
    { href: 'bibliotheque.html', label: 'Bibliothèque' },
    { href: 'packs.html', label: 'Passations' }
  ];

  function svg(icon){
    return '<svg aria-hidden="true" viewBox="0 0 24 24">' + icon + '</svg>';
  }

  function navLink(item, withIcon){
    var href=item.href||'',path=href.split('?')[0].split('#')[0],isCurrent=false;
    if(path===CURRENT&&!item.action){
      var itemQuery=href.indexOf('?')>=0?new URLSearchParams(href.split('?')[1].split('#')[0]):null;
      var currentQuery=new URLSearchParams(location.search);
      if(itemQuery&&[...itemQuery.keys()].length){
        isCurrent=[...itemQuery.entries()].every(function(pair){return currentQuery.get(pair[0])===pair[1];});
      }else if(CURRENT==='admin.html'){
        isCurrent=!currentQuery.get('tab');
      }else{
        isCurrent=true;
      }
    }
    var current = isCurrent ? ' aria-current="page"' : '';
    var iconHtml = withIcon ? '<span>' + svg(item.icon) + '</span>' : '';
    var labelAttrs = withIcon ? ' aria-label="' + item.label + '" title="' + item.label + '"' : '';
    var actionAttr=item.action?' data-nav-action="'+item.action+'"':'';
    var allowed=!item.permission||IS_ADMIN||Boolean(CURRENT_USER&&CURRENT_USER.permissions&&CURRENT_USER.permissions[item.permission]);
    var locked=allowed?'':' aria-disabled="true" data-nav-locked title="Accès non autorisé"';
    var notificationBadge=item.notificationBadge?'<b class="nav-notification-count" data-nav-notification-count hidden>0</b>':'';
    return '<a href="' + item.href + '" data-nav'+actionAttr+ current + labelAttrs + locked + '>' + iconHtml + (allowed?'':'<b class="nav-lock" aria-hidden="true">🔒</b>') + item.label + notificationBadge + '</a>';
  }

  function enforcePageAccess(){
    if(IS_ADMIN)return;
    var required={
      'packs.html':'order_passations',
      'commande.html':'order_passations',
      'kit-communication.html':'manage_kit'
    }[CURRENT];
    if(!required||CURRENT_USER&&CURRENT_USER.permissions&&CURRENT_USER.permissions[required])return;
    var main=document.querySelector('main.main');
    if(main)main.innerHTML='<section class="card permission-denied"><div class="permission-denied-icon">🔒</div><p class="eyebrow">Accès limité</p><h1>Cette fonctionnalité ne vous est pas autorisée</h1><p>Le responsable de votre compte peut modifier vos droits d’accès.</p><a class="button button-secondary" href="index.html">Retour à l’accueil</a></section>';
  }

  function enforceActionAccess(){
    if(IS_ADMIN||CURRENT_USER&&CURRENT_USER.permissions&&CURRENT_USER.permissions.edit_campaigns)return;
    document.querySelectorAll('[data-content-adjustment]').forEach(function(control){
      control.removeAttribute('data-content-adjustment');control.classList.add('button-locked');control.setAttribute('aria-disabled','true');control.innerHTML='🔒 Demander un ajustement';control.addEventListener('click',function(event){event.preventDefault();StudioModal.alert({eyebrow:'Accès limité',title:'Demande d’ajustement verrouillée',message:'Le responsable de votre compte peut vous accorder le droit de modifier les campagnes et de demander des ajustements.',type:'warning'});});
    });
  }

  function renderSidebar(){
    var root = document.getElementById('sidebar-root');
    if (!root) return;

    var adminInterface = IS_ADMIN && INTERFACE_MODE === 'admin';
    var mainNavigation = adminInterface ? NAV_ADMIN : NAV_MAIN.concat(NAV_SECONDARY);
    var roleLabel = adminInterface ? 'Administratrice' : 'Espace client';
    var switchButton = IS_ADMIN ? '<button class="interface-switch" type="button" data-interface-switch="' + (adminInterface ? 'client' : 'admin') + '">' + (adminInterface ? 'Voir mon espace client' : 'Revenir à l’administration') + '</button>' : '';
    root.classList.toggle('sidebar-admin', adminInterface);
    root.innerHTML =
      '<div class="sidebar-head">' +
        '<div class="brand"><img src="assets/img/brand/logo-meayt-color.png" alt="Me&YouToo"><span class="studio-pill">Studio</span></div>' +
        '<button class="sidebar-collapse" type="button" data-sidebar-collapse aria-label="Réduire le menu" aria-expanded="true" title="Réduire le menu">' +
          '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="sidebar-interface-row">' +
        '<div class="interface-badge ' + (adminInterface ? 'interface-badge-admin' : 'interface-badge-client') + '">' + roleLabel + '</div>' +
        '<div id="notification-root" class="sidebar-notification-root" aria-label="Notifications"></div>' +
      '</div>' +
      '<nav class="nav">' + mainNavigation.map(function(i){ return navLink(i, true); }).join('') + '</nav>' +
      '<div class="sidebar-footer">' +
        (adminInterface ? '<div class="admin-help-card"><strong>Espace d’administration</strong><p>Gérez les clients, leurs accès, leurs crédits et leurs demandes de packs.</p></div>' : '<div class="help-card"><strong>Besoin d’aide&nbsp;?</strong><p>Une question sur votre campagne, vos contenus ou le fonctionnement du Studio&nbsp;?</p><a class="button button-primary" href="contact.html">Contacter Me&YouToo</a></div>') +
        switchButton +
        '<div class="profile"><div class="avatar">' + ((CURRENT_USER && (CURRENT_USER.firstName || CURRENT_USER.email)) ? String(CURRENT_USER.firstName || CURRENT_USER.email).charAt(0).toUpperCase() : 'C') + '</div><div class="profile-copy"><strong>' + (CURRENT_USER ? ((CURRENT_USER.firstName || '') + ' ' + (CURRENT_USER.lastName || '')).trim() || CURRENT_USER.email : 'Compte') + '</strong><small>' + roleLabel + ' · ' + (CURRENT_USER ? (CURRENT_USER.organizationName || 'Me&YouToo') : '') + '</small><button class="sidebar-logout" type="button" data-logout>Se déconnecter</button></div></div>' +
      '</div>';
  }

  function renderBottomNav(){
    var root = document.getElementById('bottom-nav-root');
    if (!root) return;
    root.innerHTML = NAV_BOTTOM.map(function(i){ return navLink(i, false); }).join('');
  }

  function setupMobileToggle(){
    var toggle = document.querySelector('[data-menu-toggle]');
    if (!toggle) return;
    toggle.addEventListener('click', function(){
      var open = document.body.classList.toggle('sidebar-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function(evt){
      if (!document.body.classList.contains('sidebar-open')) return;
      var sidebar = document.querySelector('.sidebar');
      if (sidebar && !sidebar.contains(evt.target) && evt.target !== toggle && !toggle.contains(evt.target)) {
        document.body.classList.remove('sidebar-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function setupSidebarCollapse(){
    var button = document.querySelector('[data-sidebar-collapse]');
    if (!button) return;

    var storageKey = 'studioSidebarCollapsed';
    var media = window.matchMedia('(max-width: 820px)');

    function apply(collapsed){
      if (media.matches) {
        document.body.classList.remove('sidebar-collapsed');
        button.setAttribute('aria-expanded', 'true');
        button.setAttribute('aria-label', 'Réduire le menu');
        button.setAttribute('title', 'Réduire le menu');
        return;
      }
      document.body.classList.toggle('sidebar-collapsed', collapsed);
      button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      button.setAttribute('aria-label', collapsed ? 'Déployer le menu' : 'Réduire le menu');
      button.setAttribute('title', collapsed ? 'Déployer le menu' : 'Réduire le menu');
    }

    var collapsed = false;
    try {
      collapsed = localStorage.getItem(storageKey) === '1';
    } catch (e) {}
    apply(collapsed);

    button.addEventListener('click', function(){
      var next = !document.body.classList.contains('sidebar-collapsed');
      apply(next);
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch (e) {}
    });

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', function(){ apply(document.body.classList.contains('sidebar-collapsed')); });
    }
  }

  /* Menus « Autres actions » : <details>/<summary> natif (campagne-detail.html,
     cartes de mes-campagnes.html…). Un seul menu ouvert à la fois : on ferme les
     autres <details class="action-more"> quand l'un d'eux s'ouvre. */
  function setupActionMenus(){
    var menus = document.querySelectorAll('details.action-more');
    if (!menus.length) return;
    menus.forEach(function(menu){
      menu.addEventListener('toggle', function(){
        if (!menu.open) return;
        menus.forEach(function(other){
          if (other !== menu) other.open = false;
        });
      });
    });
    document.addEventListener('click', function(evt){
      menus.forEach(function(menu){
        if (menu.open && !menu.contains(evt.target)) menu.open = false;
      });
    });
  }

  function setupNotifications(attempt){
    attempt=attempt||0;
    if(document.querySelector('.studio-notifications'))return;
    if(!window.StudioAPI||!StudioAPI.token()){
      if(attempt<20)setTimeout(function(){setupNotifications(attempt+1);},100);
      return;
    }
    var root=document.getElementById('notification-root');
    if(!root)return;
    var shell=document.createElement('div');shell.className='studio-notifications '+(root.classList.contains('sidebar-notification-root')?'notification-placement-sidebar':'notification-placement-admin');shell.innerHTML='<button class="notification-bell" type="button" aria-label="Ouvrir les notifications" aria-haspopup="dialog" aria-expanded="false"><svg class="notification-bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="notification-count" hidden>0</span></button><section class="notification-panel" role="dialog" aria-label="Centre de notifications" hidden><header><div><strong>Notifications</strong><span data-notification-subtitle>Aucune nouveauté</span></div><div class="notification-head-actions"><a class="notification-center-link" href="notifications.html">Voir toutes</a><button type="button" class="notification-read-all">Tout marquer comme lu</button></div></header><div class="notification-list"><p class="notification-empty">Chargement…</p></div></section>';root.appendChild(shell);
    var bell=shell.querySelector('.notification-bell'),count=shell.querySelector('.notification-count'),panel=shell.querySelector('.notification-panel'),list=shell.querySelector('.notification-list'),subtitle=shell.querySelector('[data-notification-subtitle]');
    var escape=function(value){return String(value||'').replace(/[&<>"']/g,function(char){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});};
    var date=function(value){if(!value)return'';var parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Date indisponible':parsed.toLocaleString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
    var notificationAudience=IS_ADMIN?(INTERFACE_MODE==='client'?'client':'admin'):'client';
    shell.querySelector('.notification-center-link').href='notifications.html?audience='+encodeURIComponent(notificationAudience);
    function notificationUrl(item){var url=String(item.action_url||''),meta=item.metadata||{},type=String(item.type||'').toLowerCase(),title=String(item.title||'').toLowerCase();var projectId=meta.projectId||meta.project_id||'';if((type.includes('submission')||title.includes('configuration'))&&projectId)return 'validation.html?projectId='+encodeURIComponent(projectId);if((type.includes('communication')||type.includes('kit'))&&projectId){var tab=meta.tab?('&tab='+encodeURIComponent(meta.tab)):'';return 'kit-communication.html?projectId='+encodeURIComponent(projectId)+tab;}if(type.includes('pack'))return 'admin.html?tab=clients&filter=pack';if(IS_ADMIN&&INTERFACE_MODE==='admin'&&/^admin\.html\?projectId=/i.test(url))url=url.replace(/^admin\.html/i,'client.html');return url;}
    async function load(){try{var data=await StudioAPI.request('/api/notifications?audience='+notificationAudience);var unread=Number(data.unread)||0;var unreadLabel=unread>99?'99+':unread;count.textContent=unreadLabel;count.hidden=!unread;document.querySelectorAll('[data-nav-notification-count]').forEach(function(badge){badge.textContent=unreadLabel;badge.hidden=!unread;});shell.classList.toggle('has-unread',Boolean(unread));subtitle.textContent=unread?(unread+' non lue'+(unread>1?'s':'')):'Tout est à jour';list.innerHTML=(data.notifications||[]).map(function(item){var read=Boolean(item.read_at);return'<article class="notification-item '+(read?'treated':'unread')+'" data-notification-id="'+item.id+'" data-notification-url="'+escape(notificationUrl(item))+'" data-notification-read="'+(read?'1':'0')+'"><span class="notification-item-icon">'+(String(item.type).includes('approved')?'✅':String(item.type).includes('rejected')?'⚠️':'🎟️')+'</span><button type="button" class="notification-item-main"><strong>'+escape(String(item.title||'').replace(/à vérifier/gi,'à publier'))+'</strong><small>'+escape(String(item.message||'').replace(/à vérifier/gi,'à publier'))+'</small><time>'+escape(date(item.created_at))+'</time></button><button type="button" class="notification-item-check" aria-label="'+(read?'Marquer comme non lue':'Marquer comme lue')+'" title="'+(read?'Marquer comme non lue':'Marquer comme lue')+'">'+(read?'✓':'')+'</button></article>';}).join('')||'<p class="notification-empty">Aucune notification pour le moment.</p>';bindItems();}catch(error){list.innerHTML='<p class="notification-empty">Notifications indisponibles.</p>';}}
    function navigate(item){var url=item.dataset.notificationUrl;if(url)location.href=url;}
    function toggle(item){var isRead=item.dataset.notificationRead==='1',path='/api/notifications/'+item.dataset.notificationId+(isRead?'/unread':'/read')+'?audience='+notificationAudience;return StudioAPI.request(path,{method:'PATCH',body:'{}'}).catch(function(){}).then(load);}
    function bindItems(){list.querySelectorAll('[data-notification-id]').forEach(function(item){item.querySelector('.notification-item-main').onclick=function(){navigate(item);};item.querySelector('.notification-item-check').onclick=function(){toggle(item);};});}
    bell.onclick=function(){panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',panel.hidden?'false':'true');document.body.classList.toggle('notification-panel-open',!panel.hidden);if(!panel.hidden)load();};
    shell.querySelector('.notification-read-all').onclick=async function(){try{await StudioAPI.request('/api/notifications/read-all?audience='+notificationAudience,{method:'PATCH',body:'{}'});load();}catch(error){}};
    document.addEventListener('click',function(event){if(!panel.hidden&&!shell.contains(event.target)){panel.hidden=true;bell.setAttribute('aria-expanded','false');document.body.classList.remove('notification-panel-open');}});
    document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!panel.hidden){panel.hidden=true;bell.setAttribute('aria-expanded','false');document.body.classList.remove('notification-panel-open');bell.focus();}});
    window.addEventListener('studio:pack-requested',load);
    window.addEventListener('focus',load);
    window.addEventListener('pageshow',load);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)load();});
    load();setInterval(load,30000);
  }

  function trackProductActivity(){
    if(!window.StudioAPI||!StudioAPI.token())return;
    var params=new URLSearchParams(location.search),projectId=params.get('projectId')||params.get('id')||localStorage.getItem('studio_current_project_id')||null;
    StudioAPI.request('/api/me/activity',{method:'POST',body:JSON.stringify({page:CURRENT,eventType:'page_view',projectId:/^\d+$/.test(String(projectId||''))?Number(projectId):null})}).catch(function(){});
  }

  renderSidebar();
  enforcePageAccess();
  enforceActionAccess();
  document.querySelectorAll('[data-nav-locked]').forEach(function(link){link.addEventListener('click',function(event){event.preventDefault();StudioModal.alert({eyebrow:'Accès limité',title:'Fonctionnalité verrouillée',message:'Le responsable de votre compte peut vous accorder ce droit.',type:'warning'});});});
  setupNotifications(0);
  var interfaceButton = document.querySelector('[data-interface-switch]');
  if (interfaceButton) interfaceButton.addEventListener('click', function(){
    var next = interfaceButton.dataset.interfaceSwitch;
    StudioAPI.setInterfaceMode(next);
    location.href = next === 'admin' ? 'admin.html' : 'index.html';
  });
  var logoutButton = document.querySelector('[data-logout]');
  if (logoutButton) logoutButton.addEventListener('click', function(){
    localStorage.removeItem('studio_token');
    localStorage.removeItem('studio_user');
    localStorage.removeItem('studio_organization_id');
    sessionStorage.removeItem('studio_interface_mode');
    location.href='login.html';
  });
  renderBottomNav();
  setupMobileToggle();
  setupSidebarCollapse();
  setupActionMenus();
  setTimeout(trackProductActivity,0);
})();
