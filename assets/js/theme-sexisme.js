(function(){
  document.querySelectorAll('[data-start-theme="sexisme"]').forEach(function(link){
    link.addEventListener('click', async function(event){
      event.preventDefault();
      if(link.dataset.creating==='true') return;
      link.dataset.creating='true';
      link.setAttribute('aria-busy','true');

      var oldText=link.textContent;
      link.textContent='Création de la campagne…';

      try{
        var project=await window.StudioProject.createNew('sexisme');
        if(!project || !project.id) throw new Error('Le nouveau brouillon n’a pas pu être créé.');
        location.href='composer.html?theme=sexisme&projectId='+encodeURIComponent(project.id);
      }catch(error){
        link.dataset.creating='false';
        link.removeAttribute('aria-busy');
        link.textContent=oldText;
        await window.StudioModal.alert({
          eyebrow:'Nouvelle campagne',
          title:'Impossible de créer la campagne',
          message:error.message,
          type:'error',
          confirmLabel:'Fermer'
        });
      }
    });
  });
})();
