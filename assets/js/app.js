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

  var NAV_MAIN = [
    { href: 'index.html', label: 'Accueil', icon: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/>' },
    { href: 'mes-campagnes.html', label: 'Mes campagnes', icon: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>' },
    { href: 'bibliotheque.html', label: 'Bibliothèque', icon: '<path d="M5 5h6v14H5zM13 5h6v14h-6z"/><path d="M8 8v8M16 8v8"/>' },
    { href: 'ressources.html', label: 'Ressources', icon: '<path d="M6 4h9l3 3v13H6z"/><path d="M14 4v4h4M9 13h6M9 17h4"/>' }
  ];

  if (CURRENT_USER && CURRENT_USER.role === 'admin') {
    NAV_MAIN.push({ href: 'admin.html', label: 'Cockpit clients', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4M7 16h7"/>' });
  }

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

    root.innerHTML =
      '<div class="sidebar-head">' +
        '<div class="brand"><img src="assets/img/brand/logo-meayt-color.png" alt="Me&YouToo"><span class="studio-pill">Studio</span></div>' +
        '<button class="sidebar-collapse" type="button" data-sidebar-collapse aria-label="Réduire le menu" aria-expanded="true" title="Réduire le menu">' +
          '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>' +
        '</button>' +
      '</div>' +
      '<nav class="nav">' + NAV_MAIN.map(function(i){ return navLink(i, true); }).join('') + '</nav>' +
      '<div class="sidebar-footer">' +
        '<div class="help-card"><strong>Besoin d’aide&nbsp;?</strong><p>Une question sur votre campagne, vos contenus ou le fonctionnement du Studio&nbsp;?</p><a class="button button-primary" href="contact.html">Contacter Me&YouToo</a></div>' +
        '<nav class="nav nav-secondary" aria-label="Compte et passations">' + NAV_SECONDARY.map(function(i){ return navLink(i, true); }).join('') + '</nav>' +
        '<div class="profile"><div class="avatar">' + ((CURRENT_USER && (CURRENT_USER.firstName || CURRENT_USER.email)) ? String(CURRENT_USER.firstName || CURRENT_USER.email).charAt(0).toUpperCase() : 'C') + '</div><div class="profile-copy"><strong>' + (CURRENT_USER ? ((CURRENT_USER.firstName || '') + ' ' + (CURRENT_USER.lastName || '')).trim() || CURRENT_USER.email : 'Compte') + '</strong><small>' + (CURRENT_USER ? (CURRENT_USER.organizationName || (CURRENT_USER.role === 'admin' ? 'Administration' : 'Client')) : '') + '</small><button class="sidebar-logout" type="button" data-logout>Se déconnecter</button></div></div>' +
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

  renderSidebar();
  var logoutButton = document.querySelector('[data-logout]');
  if (logoutButton) logoutButton.addEventListener('click', function(){
    localStorage.removeItem('studio_token');
    localStorage.removeItem('studio_user');
    localStorage.removeItem('studio_organization_id');
    location.href='login.html';
  });
  renderBottomNav();
  setupMobileToggle();
  setupSidebarCollapse();
  setupActionMenus();
})();
