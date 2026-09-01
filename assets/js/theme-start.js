(function(){
  var params=new URLSearchParams(location.search);
  var existingProjectId=params.get('projectId')||'';
  var existingTheme=params.get('theme')||'';

  if(existingProjectId){
    var newCampaignPanel=document.querySelector('.hero-panel [data-start-theme]');
    if(newCampaignPanel)newCampaignPanel.closest('.hero-panel').hidden=true;
  }

  document.querySelectorAll('[data-start-theme]').forEach(function(link){
    link.addEventListener('click',async function(event){
      event.preventDefault();
      if(link.dataset.creating==='true') return;

      var themeSlug=link.dataset.startTheme||existingTheme;
      if(!themeSlug) return;
      var chapterLinks=link.closest('tbody')?Array.from(link.closest('tbody').querySelectorAll('[data-start-theme]')):[];
      var chapterIndex=chapterLinks.indexOf(link);

      function composerUrl(projectId){
        var target=new URLSearchParams({theme:themeSlug,projectId:String(projectId)});
        if(chapterIndex>=0)target.set('chapter',String(chapterIndex));
        return 'composer.html?'+target.toString();
      }

      // Si la page est ouverte dans le contexte d'un projet existant
      // (ex. "Revoir le contenu"), on réutilise strictement ce projet.
      // Aucun nouveau brouillon ne doit être créé.
      if(existingProjectId){
        location.href=composerUrl(existingProjectId);
        return;
      }

      link.dataset.creating='true';
      link.setAttribute('aria-busy','true');
      var oldText=link.textContent;
      link.textContent='Création de la campagne…';

      try{
        var project=await window.StudioProject.createNew(themeSlug);
        if(!project||!project.id) throw new Error('Le nouveau brouillon n’a pas pu être créé.');
        location.href=composerUrl(project.id);
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
