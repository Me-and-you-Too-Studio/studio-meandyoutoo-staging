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
  if (IS_ADMIN && CURRENT === 'admin.html') {
    INTERFACE_MODE = 'admin';
    sessionStorage.setItem('studio_interface_mode', 'admin');
  } else if (IS_ADMIN && INTERFACE_MODE === 'admin') {
    location.href = 'admin.html';
    return;
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
    { href: 'bibliotheque.html', label: 'Bibliothèque', icon: '<path d="M5 5h6v14H5zM13 5h6v14h-6z"/><path d="M8 8v8M16 8v8"/>' },
    { href: 'ressources.html', label: 'Ressources', icon: '<path d="M6 4h9l3 3v13H6z"/><path d="M14 4v4h4M9 13h6M9 17h4"/>' }
  ];

  var NAV_ADMIN = [
    { href: 'admin.html', label: 'Cockpit clients', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4M7 16h7"/>' }
  ];

  var NAV_SECONDARY = [
    { href: 'packs.html', label: 'Commander des passations', icon: '<path d="M3 7h18v12H3z"/><path d="M16 12h5"/><path d="M6 7V5h12v2"/>' },
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
    var current = item.href === CURRENT ? ' aria-current="page"' : '';
    var iconHtml = withIcon ? '<span>' + svg(item.icon) + '</span>' : '';
    var labelAttrs = withIcon ? ' aria-label="' + item.label + '" title="' + item.label + '"' : '';
    return '<a href="' + item.href + '" data-nav' + current + labelAttrs + '>' + iconHtml + item.label + '</a>';
  }

  function renderSidebar(){
    var root = document.getElementById('sidebar-root');
    if (!root) return;

    var adminInterface = IS_ADMIN && INTERFACE_MODE === 'admin';
    var mainNavigation = adminInterface ? NAV_ADMIN : NAV_MAIN;
    var secondaryNavigation = adminInterface ? [] : NAV_SECONDARY;
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
      '<div class="interface-badge ' + (adminInterface ? 'interface-badge-admin' : 'interface-badge-client') + '">' + roleLabel + '</div>' +
      '<nav class="nav">' + mainNavigation.map(function(i){ return navLink(i, true); }).join('') + '</nav>' +
      '<div class="sidebar-footer">' +
        (adminInterface ? '<div class="admin-help-card"><strong>Espace d’administration</strong><p>Gérez les clients, leurs accès, leurs crédits et leurs demandes de packs.</p></div>' : '<div class="help-card"><strong>Besoin d’aide&nbsp;?</strong><p>Une question sur votre campagne, vos contenus ou le fonctionnement du Studio&nbsp;?</p><a class="button button-primary" href="contact.html">Contacter Me&YouToo</a></div>') +
        (secondaryNavigation.length ? '<nav class="nav nav-secondary" aria-label="Compte et passations">' + secondaryNavigation.map(function(i){ return navLink(i, true); }).join('') + '</nav>' : '') +
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

  function setupNotifications(){
    if(!window.StudioAPI||!StudioAPI.token()||document.querySelector('.studio-notifications'))return;
    var shell=document.createElement('div');shell.className='studio-notifications';shell.innerHTML='<button class="notification-bell" type="button" aria-label="Ouvrir les notifications" aria-haspopup="dialog" aria-expanded="false"><svg class="notification-bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="notification-bell-label">Notifications</span><span class="notification-count" hidden>0</span></button><section class="notification-panel" role="dialog" aria-label="Centre de notifications" hidden><header><div><strong>Notifications</strong><span data-notification-subtitle>Aucune nouveauté</span></div><button type="button" class="notification-read-all">Tout marquer comme lu</button></header><div class="notification-list"><p class="notification-empty">Chargement…</p></div></section>';document.body.appendChild(shell);
    var bell=shell.querySelector('.notification-bell'),count=shell.querySelector('.notification-count'),panel=shell.querySelector('.notification-panel'),list=shell.querySelector('.notification-list'),subtitle=shell.querySelector('[data-notification-subtitle]');
    var escape=function(value){return String(value||'').replace(/[&<>"']/g,function(char){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});};
    var date=function(value){if(!value)return'';var parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Date indisponible':parsed.toLocaleString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
    var notificationAudience=IS_ADMIN?(INTERFACE_MODE==='client'?'client':'admin'):'client';
    async function load(){try{var data=await StudioAPI.request('/api/notifications?audience='+notificationAudience);var unread=Number(data.unread)||0;count.textContent=unread>99?'99+':unread;count.hidden=!unread;shell.classList.toggle('has-unread',Boolean(unread));subtitle.textContent=unread?(unread+' non lue'+(unread>1?'s':'')):'Tout est à jour';list.innerHTML=(data.notifications||[]).map(function(item){var read=Boolean(item.read_at);return'<article class="notification-item '+(read?'treated':'unread')+'" data-notification-id="'+item.id+'" data-notification-url="'+escape(item.action_url||'')+'"><span class="notification-item-icon">'+(String(item.type).includes('approved')?'✅':String(item.type).includes('rejected')?'⚠️':'🎟️')+'</span><button type="button" class="notification-item-main"><strong>'+escape(item.title)+'</strong><small>'+escape(item.message)+'</small><time>'+escape(date(item.created_at))+'</time></button><button type="button" class="notification-item-check" aria-label="'+(read?'Notification traitée':'Marquer comme lue')+'">'+(read?'✓':'')+'</button></article>';}).join('')||'<p class="notification-empty">Aucune notification pour le moment.</p>';bindItems();}catch(error){list.innerHTML='<p class="notification-empty">Notifications indisponibles.</p>';}}
    function mark(item,navigate){return StudioAPI.request('/api/notifications/'+item.dataset.notificationId+'/read?audience='+notificationAudience,{method:'PATCH',body:'{}'}).catch(function(){}).then(function(){var url=item.dataset.notificationUrl;if(navigate&&url)location.href=url;else load();});}
    function bindItems(){list.querySelectorAll('[data-notification-id]').forEach(function(item){item.querySelector('.notification-item-main').onclick=function(){mark(item,true);};item.querySelector('.notification-item-check').onclick=function(){mark(item,false);};});}
    bell.onclick=function(){panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',panel.hidden?'false':'true');if(!panel.hidden)load();};
    shell.querySelector('.notification-read-all').onclick=async function(){try{await StudioAPI.request('/api/notifications/read-all?audience='+notificationAudience,{method:'PATCH',body:'{}'});load();}catch(error){}};
    document.addEventListener('click',function(event){if(!panel.hidden&&!shell.contains(event.target)){panel.hidden=true;bell.setAttribute('aria-expanded','false');}});
    document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!panel.hidden){panel.hidden=true;bell.setAttribute('aria-expanded','false');bell.focus();}});
    window.addEventListener('studio:pack-requested',load);load();setInterval(load,60000);
  }

  function trackProductActivity(){
    if(!window.StudioAPI||!StudioAPI.token())return;
    var params=new URLSearchParams(location.search),projectId=params.get('projectId')||params.get('id')||localStorage.getItem('studio_current_project_id')||null;
    StudioAPI.request('/api/me/activity',{method:'POST',body:JSON.stringify({page:CURRENT,eventType:'page_view',projectId:/^\d+$/.test(String(projectId||''))?Number(projectId):null})}).catch(function(){});
  }

  renderSidebar();
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
  setTimeout(setupNotifications,0);
})();
