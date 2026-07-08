(function(){
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === 'index.html' && href === 'index.html')) link.setAttribute('aria-current','page');
  });
})();
