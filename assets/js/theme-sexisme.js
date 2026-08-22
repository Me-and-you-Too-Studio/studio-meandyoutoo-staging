(function(){
  document.querySelectorAll('[data-start-theme="sexisme"]').forEach(function(link){
    link.addEventListener('click',async function(event){
      event.preventDefault();
      link.setAttribute('aria-busy','true');
      var old=link.textContent;link.textContent='Ouverture du brouillon…';
      try{
        var project=await window.StudioProject.createNew('sexisme');
        location.href='composer.html?theme=sexisme&projectId='+encodeURIComponent(project.id);
      }catch(error){
        await window.StudioModal.alert({eyebrow:'Création du brouillon',title:'Impossible d’ouvrir la campagne',message:error.message,type:'error',confirmLabel:'Fermer'});link.textContent=old;link.removeAttribute('aria-busy');
      }
    });
  });
})();
