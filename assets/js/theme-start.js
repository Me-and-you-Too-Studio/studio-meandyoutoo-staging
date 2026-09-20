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
      var isLegalScope=Boolean(payload.theme&&payload.theme.culturalLegalScope);
      var scopeTitle=isLegalScope?'Périmètre culturel et légal':'Périmètre culturel';
      var block=document.createElement('div');
      block.dataset.themeAvailability='true';
      block.className='theme-availability-tags';
      block.innerHTML='<div class="theme-availability-group"><strong>'+esc(scopeTitle)+'</strong><div class="theme-availability-pills">'+scopes.map(function(scope){return '<span class="theme-availability-pill is-scope">'+esc(scope)+'</span>';}).join('')+'</div></div><div class="theme-availability-group"><strong>Langues disponibles</strong><div class="theme-availability-pills">'+locales.map(function(l){return '<span class="theme-availability-pill is-language">'+esc(localeFullLabel(l))+'</span>';}).join('')+'</div></div><p class="theme-availability-note">Les périmètres et langues disponibles pour votre campagne seront précisés selon les chapitres que vous choisirez.</p>';
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
        try{return {slug:slug,data:await window.StudioAPI.request('/api/catalog/themes/'+encodeURIComponent(slug)+'/template?countryCode=FR&locale=fr')};}
        catch(firstError){
          if(!/introuvable|404/i.test(String(firstError&&firstError.message||'')))throw firstError;
          var listing=await window.StudioAPI.request('/api/catalog/themes');
          var aliases={collaborateur:['collaborateur inclusif','collègue inclusif','collegue inclusif']};
          var wanted=aliases[slug]||[slug.replace(/[-_]/g,' ')];
          var found=(listing.themes||[]).find(function(theme){var hay=(String(theme.slug||'')+' '+String(theme.title||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');return wanted.some(function(label){return hay.includes(String(label).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));});});
          if(!found)throw firstError;
          return {slug:found.slug,data:await window.StudioAPI.request('/api/catalog/themes/'+encodeURIComponent(found.slug)+'/template?countryCode=FR&locale=fr')};
        }
      }
      var resolved=await resolveThemeSlug(themeSlug),data=resolved.data;
      themeSlug=resolved.slug;
      if(startButton){startButton.dataset.startTheme=themeSlug;startButton.href='composer.html?theme='+encodeURIComponent(themeSlug);}
      renderThemeAvailability(themeSlug);
      var chapters=Array.isArray(data.chapters)?data.chapters:[];
      table.querySelector('thead').innerHTML='<tr><th>Chapitre du catalogue</th><th>Situations de référence</th><th>Usage</th><th>Action</th></tr>';
      var groupCounts={};
      chapters.forEach(function(ch){if(ch.choice_group)groupCounts[ch.choice_group]=(groupCounts[ch.choice_group]||0)+1;});
      var renderedGroups={};
      var bodyHtml='';
      chapters.forEach(function(chapter,index){
        var count=Array.isArray(chapter.situations)?chapter.situations.length:0;
        var hasChoice=Boolean(chapter.choice_group&&groupCounts[chapter.choice_group]>1);
        if(hasChoice&&!renderedGroups[chapter.choice_group]){
          renderedGroups[chapter.choice_group]=true;
          var members=chapters.filter(function(x){return x.choice_group===chapter.choice_group;});
          var labels=members.map(function(x){return '<strong>'+esc(x.title)+'</strong>';}).join(' ou ');
          bodyHtml+='<tr class="theme-choice-explainer"><td colspan="4"><div class="theme-choice-explainer-box"><span class="theme-choice-kicker">Chapitre au choix</span><div><strong>À vous de choisir entre '+labels+'.</strong><p>Consultez le contenu et l’objectif de chaque proposition pour choisir l’approche la plus adaptée à votre campagne. Le choix présélectionné pourra être changé avant de composer.</p></div></div></td></tr>';
        }
        var choiceBadge=hasChoice?'<span class="theme-choice-badge">'+(chapter.is_default_choice?'Présélectionné':'Alternative')+'</span>':'';
        var description=String(chapter.client_description||'').trim()||'Consultez le contenu de ce chapitre pour choisir l’approche la plus adaptée à votre objectif.';
        var usage=chapter.locked?(chapter.lock_reason||'Obligatoire · non modifiable'):(hasChoice?'Chapitre au choix':'Catalogue Me&YouToo');
        bodyHtml+='<tr class="'+(hasChoice?'is-choice-chapter':'')+'"><td><div class="theme-chapter-title"><strong>'+esc(chapter.title)+'</strong>'+choiceBadge+'</div><p class="theme-chapter-description">'+esc(description)+'</p></td><td>'+count+'</td><td>'+esc(usage)+'</td><td><button class="button button-secondary" type="button" data-preview-chapter="'+index+'">Voir le catalogue</button></td></tr>';
      });
      table.querySelector('tbody').innerHTML=bodyHtml;

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
    var names={fr:'Français',en:'Anglais',es:'Espagnol',de:'Allemand',it:'Italien',pt:'Portugais',br:'Portugais (Brésil)',nl:'Néerlandais','nl-be':'Néerlandais (Belgique)',pl:'Polonais',cs:'Tchèque',sk:'Slovaque',id:'Indonésien',ja:'Japonais',ko:'Coréen','ko-kr':'Coréen',zh:'Chinois traditionnel',zf:'Chinois simplifié',ar:'Arabe',ro:'Roumain',bg:'Bulgare',ru:'Russe',tr:'Turc',da:'Danois',no:'Norvégien',sv:'Suédois','sv-se':'Suédois'};
    return (names[key]||key.toUpperCase())+' ('+key.toUpperCase()+')';
  }
  function chooseCatalogVariant(options,isLegalScope){
    return new Promise(function(resolve){
      var variants=Array.isArray(options.variants)?options.variants:[];
      var caps=Array.isArray(options.chapterCapabilities)?options.chapterCapabilities:[];
      var groups=options.choiceGroups||{};
      var dialog=document.createElement('dialog');dialog.className='studio-modal version-picker-dialog';
      var groupKeys=Object.keys(groups);
      var defaults={};
      groupKeys.forEach(function(g){var d=(groups[g]||[]).find(function(c){return c.isDefaultChoice;})||(groups[g]||[])[0];if(d)defaults[g]=String(d.id);});
      var scopeFieldLabel=isLegalScope?'Périmètres culturels et légaux':'Périmètres de la campagne';
      dialog.innerHTML='<form method="dialog" class="studio-modal-shell version-picker-shell"><header class="version-picker-header"><div class="studio-modal-copy"><p class="eyebrow">Configuration du diagnostic</p><h2>Choisissez votre parcours, vos périmètres et vos langues</h2><p class="studio-modal-message">Les périmètres et langues proposés s’adaptent aux chapitres que vous retenez.</p><div class="version-picker-explainer"><strong>À savoir</strong><span><b>Contenu universel</b> : les mêmes situations peuvent être utilisées dans plusieurs pays ; seules les traductions changent.</span><span><b>Contenu adapté au périmètre</b> : certaines situations sont adaptées au contexte culturel ou local choisi.</span><small>À l’étape suivante, le Studio ne vous proposera que les périmètres et langues compatibles avec l’ensemble de votre parcours.</small></div></div></header><div class="version-picker-scroll" data-version-picker-scroll><div data-choice-groups></div><div class="version-picker-section"><h3>'+esc(scopeFieldLabel)+'</h3><p class="version-picker-help" data-country-help>Sélection obligatoire : choisissez au moins un périmètre.</p><div data-country-checks class="version-check-grid"></div></div><div class="version-picker-section"><h3>Langues par périmètre</h3><p class="version-picker-help" data-locale-help>Sélection obligatoire : choisissez d’abord un périmètre, puis ajoutez au moins une langue pour chaque pays.</p><div data-locale-checks class="version-check-grid"></div></div></div><footer class="studio-modal-actions version-picker-actions"><button type="button" class="button button-secondary" data-cancel>Annuler</button><button type="button" class="button button-primary" data-confirm disabled aria-disabled="true">Continuer vers la composition</button></footer></form>';

      document.body.appendChild(dialog);
      var groupsRoot=dialog.querySelector('[data-choice-groups]'),countriesRoot=dialog.querySelector('[data-country-checks]'),localesRoot=dialog.querySelector('[data-locale-checks]'),confirmButton=dialog.querySelector('[data-confirm]'),countryHelp=dialog.querySelector('[data-country-help]'),localeHelp=dialog.querySelector('[data-locale-help]');
      var selectedLocalesByCountry={};
      function capLine(c){var countries=(c.countryCodes||[]).join(', ');var mode=c.worldwide?'Contenu universel':'Contenu adapté au périmètre';var p=c.worldwide?'Utilisable dans plusieurs pays':(countries||'Selon le référentiel');var ls=(c.locales||[]).map(localeFullLabel).join(' · ');return mode+' · Périmètre : '+p+(ls?' · Langues : '+ls:'');}
      groupKeys.forEach(function(g,gi){
        var members=groups[g]||[];
        var box=document.createElement('section');box.className='version-choice-group';
        box.innerHTML='<h3>Chapitre au choix</h3><div class="version-choice-options">'+members.map(function(c){return '<label class="version-choice-card"><input type="radio" name="choice-'+gi+'" value="'+esc(String(c.id))+'" '+(String(c.id)===defaults[g]?'checked':'')+'><span><strong>'+esc(c.title)+'</strong><small>'+esc(c.description||'Consultez le contenu de ce chapitre pour choisir l’approche la plus adaptée à votre objectif.')+'</small><span class="version-cap">'+esc(capLine(c))+'</span></span></label>';}).join('')+'</div>';
        groupsRoot.appendChild(box);
      });
      function selectedCaps(){
        var chosen={};groupKeys.forEach(function(g,gi){var r=dialog.querySelector('input[name="choice-'+gi+'"]:checked');if(r)chosen[g]=r.value;});
        return caps.filter(function(c){return !c.choiceGroup||String(c.id)===chosen[c.choiceGroup];});
      }
      function countryLabel(code){var v=variants.find(function(x){return x.countryCode===code;});return v?v.scopeLabel:code;}
      function localesForSelectedCountry(code){
        var selected=selectedCaps(),allowed=null;
        selected.forEach(function(c){
          var ls=[];
          if(c.localesByCountry&&Array.isArray(c.localesByCountry[code])&&c.localesByCountry[code].length)ls=c.localesByCountry[code].slice();
          else if(c.worldwide||!(c.countryCodes||[]).length)ls=(c.locales||[]).slice();
          allowed=allowed===null?ls:allowed.filter(function(l){return ls.includes(l);});
        });
        return [...new Set((allowed||[]).filter(Boolean))];
      }
      function updateConfirmState(){
        var countries=[].slice.call(countriesRoot.querySelectorAll('input:checked')).map(function(i){return i.value;});
        var uncovered=countries.filter(function(code){return !(selectedLocalesByCountry[code]||[]).length;});
        var totalLocales=[...new Set(countries.flatMap(function(code){return selectedLocalesByCountry[code]||[];}))];
        if(countryHelp)countryHelp.textContent=countries.length?'Périmètre(s) sélectionné(s).':'Sélection obligatoire : choisissez au moins un périmètre.';
        if(localeHelp){
          if(!countries.length)localeHelp.textContent='Sélection obligatoire : choisissez d’abord un périmètre, puis au moins une langue compatible.';
          else if(uncovered.length)localeHelp.textContent='Ajoutez au moins une langue pour : '+uncovered.map(countryLabel).join(' · ')+'.';
          else localeHelp.textContent=countries.length>1?'Chaque périmètre possède ses propres langues. Vous pouvez retirer une langue d’un pays sans modifier les autres.':'Langue(s) du périmètre sélectionnée(s).';
        }
        var ready=countries.length>0&&totalLocales.length>0&&!uncovered.length;
        confirmButton.disabled=!ready;
        confirmButton.setAttribute('aria-disabled',ready?'false':'true');
      }
      function compatibleCountries(){
        var selected=selectedCaps(),all=variants.map(function(v){return v.countryCode;}).filter(Boolean);
        return all.filter(function(code){return selected.every(function(c){return c.worldwide||!(c.countryCodes||[]).length||(c.countryCodes||[]).includes(code);});});
      }
      function renderCountries(){
        var previous=[].slice.call(countriesRoot.querySelectorAll('input:checked')).map(function(i){return i.value;});
        var allowed=compatibleCountries();
        countriesRoot.innerHTML=allowed.length?allowed.map(function(code){var v=variants.find(function(x){return x.countryCode===code;});return '<label class="version-check"><input type="checkbox" value="'+esc(code)+'" '+(previous.includes(code)?'checked':'')+'><span>'+esc(v?v.scopeLabel:code)+'</span></label>';}).join(''):'<div class="version-empty">Aucun périmètre n’est compatible avec ce choix de chapitres.</div>';
        countriesRoot.querySelectorAll('input').forEach(function(i){i.onchange=renderLocales;});
        renderLocales();
      }
      function renderLocales(){
        var chosenCountries=[].slice.call(countriesRoot.querySelectorAll('input:checked')).map(function(i){return i.value;});
        if(!chosenCountries.length){
          localesRoot.innerHTML='<div class="version-empty">Sélectionnez d’abord au moins un périmètre.</div>';
          updateConfirmState();
          return;
        }
        Object.keys(selectedLocalesByCountry).forEach(function(code){
          if(!chosenCountries.includes(code))delete selectedLocalesByCountry[code];
        });
        chosenCountries.forEach(function(code){
          var allowed=localesForSelectedCountry(code);
          selectedLocalesByCountry[code]=(selectedLocalesByCountry[code]||[]).filter(function(locale){return allowed.includes(locale);});
        });
        localesRoot.innerHTML=chosenCountries.map(function(code){
          var allowed=localesForSelectedCountry(code);
          var chosen=selectedLocalesByCountry[code]||[];
          return '<div class="version-country-languages" data-country-language-block="'+esc(code)+'">'+
            '<div class="version-country-languages-head"><strong>'+esc(countryLabel(code))+'</strong><small>Ajoutez uniquement les langues à utiliser pour ce pays.</small></div>'+
            '<div class="version-check-grid">'+(allowed.length?allowed.map(function(locale){
              var checked=chosen.includes(locale);
              return '<label class="version-check version-check-locale '+(checked?'is-selected':'')+'"><input type="checkbox" data-country-locale="'+esc(code)+'" value="'+esc(locale)+'" '+(checked?'checked':'')+'><span><b aria-hidden="true">'+(checked?'✓':'+')+'</b> '+esc(localeFullLabel(locale))+'</span></label>';
            }).join(''):'<div class="version-empty">Aucune langue disponible pour ce périmètre avec ce parcours.</div>')+'</div></div>';
        }).join('');
        localesRoot.querySelectorAll('[data-country-locale]').forEach(function(input){
          input.onchange=function(){
            var code=input.dataset.countryLocale;
            var current=(selectedLocalesByCountry[code]||[]).slice();
            if(input.checked){if(!current.includes(input.value))current.push(input.value);}
            else current=current.filter(function(locale){return locale!==input.value;});
            selectedLocalesByCountry[code]=current;
            var label=input.closest('.version-check');
            if(label){label.classList.toggle('is-selected',input.checked);var marker=label.querySelector('span b');if(marker)marker.textContent=input.checked?'✓':'+';}
            updateConfirmState();
          };
        });
        updateConfirmState();
      }
      dialog.querySelectorAll('[data-choice-groups] input[type=radio]').forEach(function(i){i.onchange=renderCountries;});
      renderCountries();
      dialog.querySelector('[data-cancel]').onclick=function(){dialog.close();resolve(null);};
      dialog.querySelector('[data-confirm]').onclick=function(){
        var countries=[].slice.call(countriesRoot.querySelectorAll('input:checked')).map(function(i){return i.value;});
        var localesByCountry={};
        countries.forEach(function(code){localesByCountry[code]=(selectedLocalesByCountry[code]||[]).slice();});
        var uncovered=countries.filter(function(code){return !(localesByCountry[code]||[]).length;});
        var locales=[...new Set(countries.flatMap(function(code){return localesByCountry[code]||[];}))];
        if(!countries.length||!locales.length||uncovered.length){updateConfirmState();return;}
        var choiceSelections={};groupKeys.forEach(function(g,gi){var r=dialog.querySelector('input[name="choice-'+gi+'"]:checked');if(r)choiceSelections[g]=Number(r.value);});
        var firstCountry=countries[0],firstLocales=localesByCountry[firstCountry]||[];
        dialog.close();resolve({culturalScope:'country',countryCode:firstCountry,locale:firstLocales[0]||locales[0],countryCodes:countries,locales:locales,localesByCountry:localesByCountry,choiceSelections:choiceSelections});
      };
      dialog.addEventListener('close',function(){setTimeout(function(){dialog.remove();},0);},{once:true});dialog.showModal();
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
          variant=await chooseCatalogVariant(options,Boolean(options.theme&&options.theme.culturalLegalScope));
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
