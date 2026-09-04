(function(){
  var params=new URLSearchParams(location.search);
  var existingProjectId=params.get('projectId')||'';
  var existingTheme=params.get('theme')||'';
  var esc=function(value){return String(value==null?'':value).replace(/[&<>"']/g,function(character){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];});};

  function previewDialog(){
    var dialog=document.getElementById('theme-preview-dialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='theme-preview-dialog';
    dialog.className='theme-preview-dialog';
    dialog.innerHTML='<div class="theme-preview-head"><div><p class="eyebrow">Aperçu du référentiel</p><h2 id="theme-preview-title">Situations du chapitre</h2><p id="theme-preview-count" class="section-desc"></p></div><button type="button" class="theme-preview-close" aria-label="Fermer">×</button></div><div id="theme-preview-content" class="theme-preview-content"></div><div class="theme-preview-footer"><p>Vous consultez le référentiel en lecture seule. Aucun brouillon n’est créé.</p><button type="button" class="button button-secondary">Fermer</button></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('.theme-preview-close').onclick=function(){dialog.close();};
    dialog.querySelector('.theme-preview-footer .button').onclick=function(){dialog.close();};
    dialog.addEventListener('click',function(event){if(event.target===dialog)dialog.close();});
    return dialog;
  }

  function showChapterPreview(chapter,index){
    var dialog=previewDialog();
    var situations=Array.isArray(chapter.situations)?chapter.situations:[];
    dialog.querySelector('#theme-preview-title').textContent='Chapitre '+(index+1)+' · '+(chapter.title||'Sans titre');
    dialog.querySelector('#theme-preview-count').textContent=situations.length+' situation'+(situations.length>1?'s':'')+' dans le référentiel Me&YouToo';
    dialog.querySelector('#theme-preview-content').innerHTML=situations.map(function(situation,situationIndex){
      var answers=Array.isArray(situation.answers)?situation.answers:[];
      return '<article class="theme-preview-situation"><div class="theme-preview-situation-number">Situation '+(situationIndex+1)+'</div><h3>'+esc(situation.content)+'</h3>'+(answers.length?'<details><summary>Voir les réponses proposées</summary><div class="theme-preview-answers">'+answers.map(function(answer){return '<div class="theme-preview-answer'+(answer.is_best?' is-best':'')+'"><span>'+esc(answer.content)+'</span>'+(answer.is_best?'<strong>Réponse la plus appropriée</strong>':'')+'</div>';}).join('')+'</div></details>':'')+'</article>';
    }).join('')||'<p>Aucune situation disponible dans ce chapitre.</p>';
    dialog.showModal();
  }

  async function loadReadOnlyCatalog(){
    var startButton=document.querySelector('.hero-panel [data-start-theme]');
    var themeSlug=(startButton&&startButton.dataset.startTheme)||existingTheme;
    var table=document.querySelector('.table-card .data-table');
    if(!themeSlug||!table)return;
    try{
      var data=await window.StudioAPI.request('/api/catalog/themes/'+encodeURIComponent(themeSlug)+'/template');
      var chapters=Array.isArray(data.chapters)?data.chapters:[];
      table.querySelector('thead').innerHTML='<tr><th>Chapitre</th><th>Situations</th><th>Usage</th><th>Action</th></tr>';
      table.querySelector('tbody').innerHTML=chapters.map(function(chapter,index){
        var count=Array.isArray(chapter.situations)?chapter.situations.length:0;
        var usage=chapter.locked?(chapter.lock_reason||'Obligatoire · non modifiable'):'Sélection personnalisable';
        return '<tr><td><strong>'+esc(chapter.title)+'</strong></td><td>'+count+'</td><td>'+esc(usage)+'</td><td><button class="button button-secondary" type="button" data-preview-chapter="'+index+'">Voir les situations</button></td></tr>';
      }).join('');
      table.querySelectorAll('[data-preview-chapter]').forEach(function(button){button.onclick=function(){showChapterPreview(chapters[Number(button.dataset.previewChapter)],Number(button.dataset.previewChapter));};});
    }catch(error){
      var section=document.querySelector('.table-card');
      if(section){var alert=document.createElement('p');alert.className='composer-alert';alert.textContent='Impossible de charger le détail des situations : '+error.message;section.appendChild(alert);}
    }
  }

  if(existingProjectId){
    var newCampaignPanel=document.querySelector('.hero-panel [data-start-theme]');
    if(newCampaignPanel)newCampaignPanel.closest('.hero-panel').hidden=true;
  }

  // La création d'un brouillon est réservée au CTA principal de la page.
  // La liste des chapitres reste une consultation sans effet en base.
  document.querySelectorAll('.hero-panel [data-start-theme]').forEach(function(link){
    var user=window.StudioAPI.user&&window.StudioAPI.user();
    var canCreate=user&&user.role==='admin'||Boolean(user&&user.permissions&&user.permissions.create_campaigns);
    if(!canCreate){link.classList.add('button-locked');link.innerHTML='🔒 '+esc(link.textContent);link.title='Votre accès ne permet pas de créer des campagnes';}
    link.addEventListener('click',async function(event){
      event.preventDefault();
      if(!canCreate){await window.StudioModal.alert({eyebrow:'Accès limité',title:'Création de campagne verrouillée',message:'Le responsable de votre compte peut vous accorder le droit de créer des campagnes.',type:'warning'});return;}
      if(link.dataset.creating==='true') return;

      var themeSlug=link.dataset.startTheme||existingTheme;
      if(!themeSlug) return;
      function composerUrl(projectId){
        var target=new URLSearchParams({theme:themeSlug,projectId:String(projectId)});
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
        var project=await window.StudioProject.createNew(themeSlug,true);
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

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadReadOnlyCatalog);
  else loadReadOnlyCatalog();
})();
