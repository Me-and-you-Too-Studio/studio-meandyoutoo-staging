(function(){
  var path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach(function(link){
    var href = link.getAttribute('href');
    if (href === path) link.setAttribute('aria-current', 'page');
  });
})();
