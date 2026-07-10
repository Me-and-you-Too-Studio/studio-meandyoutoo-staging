/* Studio Me&YouToo — navigation partagée (sidebar, bottom-nav, menu mobile)
   Toute modification du menu latéral ou de la navigation mobile se fait UNIQUEMENT ici :
   les pages HTML ne contiennent qu'un conteneur vide (#sidebar-root / #bottom-nav-root)
   que ce script remplit au chargement, comme un header/menu partagé. */
(function(){
  var CURRENT = location.pathname.split('/').pop() || 'index.html';

  var NAV_MAIN = [
    { href: 'index.html', label: 'Accueil', icon: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/>' },
    { href: 'mes-campagnes.html', label: 'Mes campagnes', icon: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>' },
    { href: 'bibliotheque.html', label: 'Bibliothèque', icon: '<path d="M5 5h6v14H5zM13 5h6v14h-6z"/><path d="M8 8v8M16 8v8"/>' },
    { href: 'ressources.html', label: 'Ressources', icon: '<path d="M6 4h9l3 3v13H6z"/><path d="M14 4v4h4M9 13h6M9 17h4"/>' }
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
    return '<a href="' + item.href + '" data-nav' + current + '>' + iconHtml + item.label + '</a>';
  }

  function renderSidebar(){
    var root = document.getElementById('sidebar-root');
    if (!root) return;
    var helpTitle = root.getAttribute('data-help-title') || "Besoin d'aide&nbsp;?";
    var helpText = root.getAttribute('data-help-text') || '';
    var helpHref = root.getAttribute('data-help-href') || 'ressources.html';
    var helpCta = root.getAttribute('data-help-cta') || 'Contacter Me&YouToo';

    root.innerHTML =
      '<div class="brand"><img src="assets/img/brand/logo-meayt-color.png" alt="Me&YouToo"><span class="studio-pill">Studio</span></div>' +
      '<nav class="nav">' + NAV_MAIN.map(function(i){ return navLink(i, true); }).join('') + '</nav>' +
      '<div class="sidebar-footer">' +
        '<div class="help-card"><strong>' + helpTitle + '</strong><p>' + helpText + '</p><a class="button button-primary" href="' + helpHref + '">' + helpCta + '</a></div>' +
        '<nav class="nav nav-secondary" aria-label="Compte et passations">' + NAV_SECONDARY.map(function(i){ return navLink(i, true); }).join('') + '</nav>' +
        '<div class="profile"><div class="avatar">C</div><div><strong>Carole Michelon</strong><small>Me&YouToo SAS</small></div></div>' +
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

  renderSidebar();
  renderBottomNav();
  setupMobileToggle();
})();
