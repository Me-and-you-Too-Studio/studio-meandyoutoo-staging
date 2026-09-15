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

  function themeVideoDialog(){
    var dialog=document.getElementById('theme-video-dialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='theme-video-dialog';
    dialog.className='theme-video-dialog';
    dialog.innerHTML='<div class="theme-video-dialog-head"><div><p class="eyebrow">Ressource intégrée</p><h2 data-theme-video-title>Vidéo</h2><p class="section-desc" data-theme-video-chapter></p></div><button type="button" class="theme-preview-close" aria-label="Fermer">×</button></div><div class="theme-video-dialog-body"><div class="theme-video-player-shell"><video controls controlsList="nodownload" disablePictureInPicture playsinline></video><div class="theme-video-loading">Chargement de la vidéo…</div></div><p class="theme-video-dialog-note">Cette vidéo fait partie de la restitution répondant de ce diagnostic.</p></div>';
    document.body.appendChild(dialog);
    var close=function(){
      var video=dialog.querySelector('video'),blobUrl=video.dataset.blobUrl;
      video.pause();video.removeAttribute('src');video.load();
      if(blobUrl)URL.revokeObjectURL(blobUrl);
      video.dataset.blobUrl='';
      dialog.close();
    };
    dialog.querySelector('.theme-preview-close').onclick=close;
    dialog.addEventListener('click',function(event){if(event.target===dialog)close();});
    dialog.addEventListener('cancel',function(event){event.preventDefault();close();});
    return dialog;
  }

  async function openThemeVideo(media,chapter){
    var dialog=themeVideoDialog(),video=dialog.querySelector('video'),loading=dialog.querySelector('.theme-video-loading');
    dialog.querySelector('[data-theme-video-title]').textContent=media.title||'Vidéo';
    dialog.querySelector('[data-theme-video-chapter]').textContent='Chapitre · '+(chapter.title||'');
    loading.textContent='Chargement de la vidéo…';loading.classList.remove('is-error');loading.hidden=false;
    dialog.showModal();
    try{
      var response=await fetch(window.StudioAPI.base()+media.playback_path,{cache:'no-store'});
      if(!response.ok)throw new Error('Vidéo indisponible ('+response.status+')');
      var blob=await response.blob();
      if(!String(blob.type||'').startsWith('video/'))throw new Error('Format vidéo invalide');
      var blobUrl=URL.createObjectURL(blob);
      video.dataset.blobUrl=blobUrl;video.src=blobUrl;video.load();loading.hidden=true;
    }catch(error){
      loading.textContent='La vidéo ne peut pas être chargée pour le moment.';
      loading.classList.add('is-error');
      console.error('[MEAYT] Aperçu vidéo thématique impossible',error);
    }
  }

  function renderThemeVideos(chapters){
    var existing=document.getElementById('theme-video-showcase');
    if(existing)existing.remove();
    var items=[],seen=new Set();
    chapters.forEach(function(chapter,chapterIndex){
      (Array.isArray(chapter.media)?chapter.media:[]).forEach(function(media){
        if(!media||!media.playback_path)return;
        var key=String(chapter.id||chapterIndex)+'|'+String(media.video_id||media.title||media.id||'').trim().toLowerCase();
        if(seen.has(key))return;
        seen.add(key);
        items.push({media:media,chapter:chapter,chapterIndex:chapterIndex});
      });
    });
    if(!items.length)return;
    var tableCard=document.querySelector('.table-card');
    if(!tableCard)return;
    var section=document.createElement('section');
    section.id='theme-video-showcase';
    section.className='theme-video-showcase';
    section.innerHTML='<div class="theme-video-showcase-head"><div><p class="eyebrow">Contenus enrichis</p><h2 class="section-title">Ressources vidéo intégrées au diagnostic</h2><p class="section-desc">Certaines restitutions sont enrichies par des vidéos Me&YouToo. Découvrez-les avant de déployer cette thématique.</p></div><span class="theme-video-count">'+items.length+' vidéo'+(items.length>1?'s':'')+'</span></div><div class="theme-video-showcase-grid">'+items.map(function(item,index){return '<article class="theme-video-card"><div class="theme-video-card-visual"><span class="theme-video-play">▶</span><span>Vidéo</span></div><div class="theme-video-card-body"><span class="theme-video-chapter-tag">Chapitre '+(item.chapterIndex+1)+'</span><h3>'+esc(item.media.title||'Vidéo')+'</h3><p>'+esc(item.chapter.title||'')+'</p><div class="theme-video-card-footer"><span>Intégrée à la restitution répondant</span><button class="button button-secondary button-small" type="button" data-theme-video="'+index+'">Voir un aperçu</button></div></div></article>';}).join('')+'</div>';
    tableCard.insertAdjacentElement('afterend',section);
    section.querySelectorAll('[data-theme-video]').forEach(function(button){
      button.onclick=function(){var item=items[Number(button.dataset.themeVideo)];if(item)openThemeVideo(item.media,item.chapter);};
    });
  }

  async function renderThemeAvailability(themeSlug){
    var hero=document.querySelector('.hero-panel');
    if(!hero||!themeSlug)return;
    var old=hero.querySelector('[data-theme-availability]');if(old)old.remove();
    try{
      var payload=await window.StudioAPI.request('/api/catalog/themes/'+encodeURIComponent(themeSlug)+'/variants');
      var variants=Array.isArray(payload.variants)?payload.variants:[];
      if(!variants.length)return;
      var scopes=[],locales=[];
      variants.forEach(function(v){
        var label=v.scopeLabel||v.countryLabel||v.countryCode||v.culturalScope||'';
        if(label&&!scopes.includes(label))scopes.push(label);
        (v.locales||[]).forEach(function(locale){if(locale&&!locales.includes(locale))locales.push(locale);});
      });
      var block=document.createElement('div');
      block.dataset.themeAvailability='true';
      block.style.cssText='display:flex;flex-wrap:wrap;gap:10px 18px;margin:4px 0 18px;padding:14px 16px;border:1px solid #dce8ee;border-radius:16px;background:#f8fbfc';
      block.innerHTML='<div><strong style="display:block;color:#0d4c72;margin-bottom:5px">Périmètre disponible</strong><span>'+esc(scopes.join(' · '))+'</span></div><div><strong style="display:block;color:#0d4c72;margin-bottom:5px">Langues disponibles</strong><span>'+locales.map(function(l){return esc(localeFullLabel(l));}).join(' · ')+'</span></div>';
      var title=hero.querySelector('.section-title');
      if(title)title.insertAdjacentElement('beforebegin',block);else hero.prepend(block);
    }catch(error){console.warn('[MEAYT] Disponibilités de la thématique non chargées',error);}
  }

  async function loadReadOnlyCatalog(){
    var startButton=document.querySelector('.hero-panel [data-start-theme]');
    var themeSlug=(startButton&&startButton.dataset.startTheme)||existingTheme;
    var table=document.querySelector('.table-card .data-table');
    if(!themeSlug||!table)return;
    try{
      async function resolveThemeSlug(slug){
        try{return {slug:slug,data:await window.StudioAPI.request('/api/catalog/themes/'+encodeURIComponent(slug)+'/template')};}
        catch(firstError){
          if(!/introuvable|404/i.test(String(firstError&&firstError.message||'')))throw firstError;
          var listing=await window.StudioAPI.request('/api/catalog/themes');
          var aliases={collaborateur:['collaborateur inclusif','collègue inclusif','collegue inclusif']};
          var wanted=aliases[slug]||[slug.replace(/[-_]/g,' ')];
          var found=(listing.themes||[]).find(function(theme){var hay=(String(theme.slug||'')+' '+String(theme.title||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');return wanted.some(function(label){return hay.includes(String(label).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));});});
          if(!found)throw firstError;
          return {slug:found.slug,data:await window.StudioAPI.request('/api/catalog/themes/'+encodeURIComponent(found.slug)+'/template')};
        }
      }
      var resolved=await resolveThemeSlug(themeSlug),data=resolved.data;
      themeSlug=resolved.slug;
      if(startButton){startButton.dataset.startTheme=themeSlug;startButton.href='composer.html?theme='+encodeURIComponent(themeSlug);}
      renderThemeAvailability(themeSlug);
      var chapters=Array.isArray(data.chapters)?data.chapters:[];
      table.querySelector('thead').innerHTML='<tr><th>Chapitre du catalogue</th><th>Situations de référence</th><th>Usage</th><th>Action</th></tr>';
      table.querySelector('tbody').innerHTML=chapters.map(function(chapter,index){
        var count=Array.isArray(chapter.situations)?chapter.situations.length:0;
        var usage=chapter.locked?(chapter.lock_reason||'Obligatoire · non modifiable'):'Catalogue Me&YouToo';
        return '<tr><td><strong>'+esc(chapter.title)+'</strong></td><td>'+count+'</td><td>'+esc(usage)+'</td><td><button class="button button-secondary" type="button" data-preview-chapter="'+index+'">Voir le catalogue</button></td></tr>';
      }).join('');
      table.querySelectorAll('[data-preview-chapter]').forEach(function(button){button.onclick=function(){showChapterPreview(chapters[Number(button.dataset.previewChapter)],Number(button.dataset.previewChapter));};});
      // Côté client, la bibliothèque complémentaire reste un outil de personnalisation :
      // elle n'est pas exposée comme un second catalogue à parcourir.
      var oldLibrarySection=document.getElementById('theme-library-complement');
      if(oldLibrarySection)oldLibrarySection.remove();
      var catalogCard=table.closest('.table-card');
      if(catalogCard&&!document.getElementById('theme-personalization-note')){
        var note=document.createElement('div');
        note.id='theme-personalization-note';
        note.className='section-desc';
        note.style.cssText='padding:0 18px 18px';
        note.innerHTML='<strong>Un catalogue personnalisable.</strong> Vous pourrez adapter cette sélection dans Composer grâce à la bibliothèque de contenus Me&amp;YouToo.';
        catalogCard.appendChild(note);
      }
      renderThemeVideos(chapters);
    }catch(error){
      var section=document.querySelector('.table-card');
      if(section){var alert=document.createElement('p');alert.className='composer-alert';alert.textContent='Impossible de charger le détail des situations : '+error.message;section.appendChild(alert);}
    }
  }

  if(existingProjectId){
    var newCampaignPanel=document.querySelector('.hero-panel [data-start-theme]');
    if(newCampaignPanel)newCampaignPanel.closest('.hero-panel').hidden=true;
  }

  function localeFullLabel(code){
    var key=String(code||'').toLowerCase().replaceAll('_','-');
    var names={fr:'Français',en:'Anglais',es:'Espagnol',de:'Allemand',it:'Italien',pt:'Portugais',nl:'Néerlandais',pl:'Polonais',cs:'Tchèque',sk:'Slovaque',id:'Indonésien',ja:'Japonais',ko:'Coréen','ko-kr':'Coréen',zh:'Chinois',ar:'Arabe',ro:'Roumain',bg:'Bulgare',ru:'Russe',tr:'Turc',da:'Danois',no:'Norvégien',sv:'Suédois'};
    return (names[key]||key.toUpperCase())+' ('+key.toUpperCase()+')';
  }
  function chooseCatalogVariant(variants){
    return new Promise(function(resolve){
      var dialog=document.createElement('dialog');dialog.className='studio-modal';
      var scopes=[];variants.forEach(function(v){var k=(v.culturalScope||'')+'|'+(v.countryCode||'');if(!scopes.some(function(x){return x.key===k;}))scopes.push({key:k,label:v.scopeLabel||v.countryLabel||v.culturalScope||v.countryCode||'International',culturalScope:v.culturalScope||'',countryCode:v.countryCode||''});});
      dialog.innerHTML='<form method="dialog" class="studio-modal-shell" style="max-width:680px;grid-template-columns:1fr"><div class="studio-modal-copy" style="padding-right:0"><p class="eyebrow">Version du diagnostic</p><h2>Choisissez le périmètre et la langue</h2><p class="studio-modal-message">Cette sélection détermine la version du catalogue utilisée pour votre campagne.</p></div><div class="studio-modal-field"><label>Périmètre disponible</label><select data-variant-scope class="input" style="width:100%">'+scopes.map(function(x,i){return '<option value="'+i+'">'+esc(x.label)+'</option>';}).join('')+'</select></div><div class="studio-modal-field" style="margin-top:16px"><label>Langue disponible</label><select data-variant-locale class="input" style="width:100%"></select></div><div class="studio-modal-actions"><button type="button" class="button button-secondary" data-cancel>Annuler</button><button type="button" class="button button-primary" data-confirm>Continuer vers la composition</button></div></form>';
      document.body.appendChild(dialog);var scope=dialog.querySelector('[data-variant-scope]'),locale=dialog.querySelector('[data-variant-locale]');
      function refresh(){var x=scopes[Number(scope.value)||0];var allowed=variants.filter(function(v){return (v.culturalScope||'')===x.culturalScope&&(v.countryCode||'')===x.countryCode;});var locales=[];allowed.forEach(function(v){(v.locales||[]).forEach(function(l){if(!locales.includes(l))locales.push(l);});});locale.innerHTML=locales.map(function(l){return '<option value="'+esc(l)+'">'+esc(localeFullLabel(l))+'</option>';}).join('');}
      scope.onchange=refresh;refresh();dialog.querySelector('[data-cancel]').onclick=function(){dialog.close();resolve(null);};dialog.querySelector('[data-confirm]').onclick=function(){var x=scopes[Number(scope.value)||0];var out={culturalScope:x.culturalScope,countryCode:x.countryCode,locale:locale.value};dialog.close();resolve(out);};dialog.addEventListener('close',function(){setTimeout(function(){dialog.remove();},0);},{once:true});dialog.showModal();
    });
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

      // Avant toute création, le client choisit la version culturelle et linguistique réelle.
      var variant={};
      try{
        var options=await window.StudioAPI.request('/api/catalog/themes/'+encodeURIComponent(themeSlug)+'/variants');
        var variants=Array.isArray(options.variants)?options.variants:[];
        if(variants.length){
          variant=await chooseCatalogVariant(variants);
          if(!variant)return;
        }
      }catch(optionError){
        await window.StudioModal.alert({eyebrow:'Version du diagnostic',title:'Impossible de charger les versions disponibles',message:optionError.message,type:'error'});return;
      }
      link.dataset.creating='true';
      link.setAttribute('aria-busy','true');
      var oldText=link.textContent;
      link.textContent='Création de la campagne…';

      try{
        var project=await window.StudioProject.createNew(themeSlug,true,variant);
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
