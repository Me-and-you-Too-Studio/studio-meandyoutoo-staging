(function(){
  var cardRoot=document.getElementById('campaigns-card-root');
  var filtersRoot=document.getElementById('campaign-filters');
  var search=document.getElementById('campaignSearch');
  var noResults=document.getElementById('noResults');
  if(!cardRoot||!filtersRoot)return;

  var projects=[];
  var activeFilter='all';
  var pageParams=new URLSearchParams(location.search),initialAction=pageParams.get('action'),initialProjectId=pageParams.get('projectId'),initialActionHandled=false;

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function dateFr(value){
    if(!value)return '—';
    var d=new Date(value);
    return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('fr-FR');
  }

  function resumePage(step){
    return {
      composer:'composer.html',
      personnalisation:'personnalisation.html',
      parametrage:'parametrage.html',
      validation:'validation.html'
    }[step]||'composer.html';
  }

  function statusLabel(status){
    return {
      draft:'Brouillon',
      configuration_submitted:'Transmise à Me&YouToo',
      review_pending:'À relire par Me&YouToo',
      in_review:'En cours de relecture',
      client_validation_required:'À valider',
      ready_to_publish:'Prête à publier',
      published:'Publiée',
      scheduled:'Programmée',
      active:'Publiée',
      unpublished:'Dépubliée',
      closed:'Terminée',
      completed:'Terminée',
      archived:'Archivée'
    }[status]||status||'Statut inconnu';
  }

  function statusVisual(status){
    if(status==='draft')return 'draft';
    if(status==='client_validation_required')return 'validation';
    if(['configuration_submitted','review_pending','in_review','ready_to_publish'].includes(status))return 'submitted';
    if(status==='scheduled')return 'scheduled';
    if(status==='published'||status==='active')return 'published';
    if(status==='unpublished')return 'unpublished';
    if(status==='closed'||status==='completed')return 'completed';
    if(status==='archived')return 'archived';
    return 'draft';
  }

  function themeSlug(p){
    return String(p&&p.theme_slug||'').trim().toLowerCase();
  }

  function hasTheme(p){
    return Boolean(themeSlug(p));
  }

  function themeLabel(p){
    var raw=String(p.theme_title||p.theme_slug||'').trim();
    if(!raw)return 'Thématique indisponible';
    var slug=String(p.theme_slug||raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
    var labels={
      'sexisme':'Sexisme',
      'management':'Management inclusif',
      'management-inclusif':'Management inclusif',
      'manager-inclusif':'Management inclusif',
      'handicap':'Handicap',
      'lgbt':'LGBT+',
      'lgbt-plus':'LGBT+',
      'origines':'Diversité des origines',
      'diversite-des-origines':'Diversité des origines',
      'religion':'Diversité religieuse',
      'diversite-religieuse':'Diversité religieuse',
      'intergenerationnel':'Intergénérationnel',
      'collaborateur':'Collaborateur inclusif',
      'collaborateur-inclusif':'Collaborateur inclusif'
    };
    return labels[slug]||raw;
  }

  function query(p){
    var slug=themeSlug(p);
    if(!slug)return null;
    return '?theme='+encodeURIComponent(slug)+'&projectId='+encodeURIComponent(p.id);
  }

  function contentPage(p){
    var q=query(p);
    return q?'composer.html'+q:null;
  }

  function campaignName(p){
    return p.campaign_name||p.respondent_title||p.title||p.theme_title||'Campagne sans nom';
  }

  function campaignDates(p){
    if(!p.launch_date&&!p.close_date)return 'Dates de campagne non renseignées';
    if(p.launch_date&&p.close_date)return 'Campagne : '+dateFr(p.launch_date)+' → '+dateFr(p.close_date);
    if(p.launch_date)return 'Lancement : '+dateFr(p.launch_date);
    return 'Clôture : '+dateFr(p.close_date);
  }

  function isoDay(value){return String(value||'').slice(0,10);}
  function addDays(day,count){var d=new Date(day+'T12:00:00');d.setDate(d.getDate()+count);return d.toISOString().slice(0,10);}
  function askExtensionDate(p){
    return new Promise(function(resolve){
      document.getElementById('campaign-extension-dialog')?.remove();
      var current=isoDay(p.close_date),minimum=current?addDays(current,1):new Date().toISOString().slice(0,10),suggested=current?addDays(current,7):minimum;
      var dialog=document.createElement('dialog');dialog.id='campaign-extension-dialog';dialog.className='admin-dialog campaign-lifecycle-dialog';
      dialog.innerHTML='<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Campagne publiée</p><h2>Prolonger « '+esc(campaignName(p))+' »</h2><p>La campagne et ses liens restent identiques. Seule la date de clôture change.</p><label class="field"><span>Clôture actuelle</span><strong>'+esc(dateFr(p.close_date))+'</strong></label><label class="field"><span>Nouvelle date de clôture</span><input id="campaign-new-close-date" type="date" min="'+esc(minimum)+'" value="'+esc(suggested)+'" required></label><div class="campaign-lifecycle-note"><strong>Vous n’avez rien à reconstruire.</strong><span>Le contenu, l’URL de passation et l’URL de résultats sont conservés.</span></div><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="confirm-extension" type="button">Confirmer la prolongation</button></div></form>';
      document.body.append(dialog);var settled=false,finish=function(value){if(settled)return;settled=true;dialog.close();dialog.remove();resolve(value);};dialog.addEventListener('cancel',function(e){e.preventDefault();finish('');});dialog.addEventListener('close',function(){if(!settled){settled=true;dialog.remove();resolve('');}});dialog.querySelector('[value="cancel"]').onclick=function(){finish('');};dialog.querySelector('.admin-dialog-close').onclick=function(){finish('');};dialog.querySelector('#confirm-extension').onclick=function(){var value=dialog.querySelector('#campaign-new-close-date').value;if(!value||value<minimum){dialog.querySelector('#campaign-new-close-date').reportValidity();return;}finish(value);};dialog.showModal();
    });
  }

  function linkState(p){
    var share=String(p.communication_share_url||'').trim();
    var results=String(p.communication_results_url||'').trim();
    return {
      share:share,
      results:results,
      shareText:share?'disponible':'en attente Me&YouToo',
      resultsText:results?'disponibles':'non disponibles'
    };
  }

  function invalidThemeAction(){
    return '<span class="campaign-btn campaign-btn-static" title="Le thème réel de ce projet est absent des données API.">Thématique indisponible</span>';
  }

  function primaryAction(p){
    var q=query(p),id=esc(p.id);
    if(!q)return invalidThemeAction();
    if(p.status==='draft')return '<a class="campaign-btn campaign-btn-primary" href="'+resumePage(p.current_step)+q+'">Reprendre la création</a>';
    if(p.status==='client_validation_required')return '<a class="campaign-btn campaign-btn-primary" href="validation.html'+q+'">Valider les corrections</a>';
    if(['configuration_submitted','review_pending','in_review','ready_to_publish'].includes(p.status))return '<a class="campaign-btn campaign-btn-primary" href="validation.html'+q+'">Suivre la relecture</a>';
    if(p.status==='unpublished'||p.status==='closed'||p.status==='completed')return '<button class="campaign-btn campaign-btn-primary" type="button" data-project-action="reprogram" data-project-id="'+id+'">🚀 Reprogrammer</button>';
    if(p.status==='archived')return '<button class="campaign-btn campaign-btn-primary" type="button" data-project-action="restore" data-project-id="'+id+'">↩️ Restaurer</button>';
    return '<a class="campaign-btn campaign-btn-primary" href="campagne-detail.html'+q+'">Voir la campagne</a>';
  }

  function secondaryActions(p){
    var q=query(p),id=esc(p.id);
    var items=[];
    var content=contentPage(p);
    if(p.status!=='draft'){
      items.push(content
        ? '<a class="campaign-btn" href="'+content+'">👁️ Voir le contenu</a>'
        : invalidThemeAction());
    }
    if(q&&(['configuration_submitted','review_pending','in_review','client_validation_required','ready_to_publish','scheduled','published','active','unpublished','closed','completed'].includes(p.status)))items.push('<a class="campaign-btn campaign-btn-kit" href="kit-communication.html'+q+'">📣 Kit de com</a>');
    if(['published','active'].includes(p.status))items.push('<button class="campaign-btn" type="button" data-project-action="extend" data-project-id="'+id+'">📅 Prolonger</button>');
    if(['published','active'].includes(p.status))items.push('<button class="campaign-btn campaign-btn-danger" type="button" data-project-action="unpublish" data-project-id="'+id+'">⏹ Dépublier</button>');
    if(!['scheduled','published','active'].includes(p.status))items.push('<button class="campaign-btn campaign-btn-danger" type="button" data-project-action="delete" data-project-id="'+id+'">🗑️ Supprimer</button>');
    if(!['draft','configuration_submitted','review_pending','in_review','client_validation_required','ready_to_publish'].includes(p.status))items.push('<button class="campaign-btn" type="button" data-project-action="clone" data-project-id="'+id+'">🧬 Cloner</button>');

    var more=[];
    if(p.status==='unpublished')more.push('<button type="button" data-project-action="archive" data-project-id="'+id+'">📦 Archiver</button>');

    var html='<div class="campaign-row-actions">'+primaryAction(p)+items.join('');
    if(more.length){
      html+='<details class="campaign-more"><summary>Autres actions</summary><div class="campaign-more-menu">'+more.join('')+'</div></details>';
    }
    html+='</div>';
    return html;
  }

  function extraBadges(p){
    var parts=[];
    if(p.reprogrammed_at||p.reprogrammedAt)parts.push('<span class="campaign-context-tag reprogrammed">Reprogrammée</span>');
    if(p.extended_at||p.extendedAt)parts.push('<span class="campaign-context-tag extended">Prolongée</span>');
    return parts.join('');
  }

  function cardHtml(p){
    var visual=statusVisual(p.status);
    var links=linkState(p);
    var themeWarning=hasTheme(p)?'':'<div class="composer-alert" style="margin:12px 0 0">Le thème réel de cette campagne est absent des données API. Aucun thème de remplacement n’est utilisé.</div>';
    return '<article class="campaign-project-card '+visual+'-card">'+
      '<div class="campaign-status-bar '+visual+'"></div>'+
      '<div class="campaign-project-body">'+
        '<div class="campaign-project-title">🧩 '+esc(campaignName(p))+'</div>'+
        '<div class="campaign-project-meta">'+
          'Créée le '+dateFr(p.created_at)+' · '+esc(campaignDates(p))+'<br>'+
          'Lien de diffusion : '+esc(links.shareText)+' · Résultats : '+esc(links.resultsText)+
        '</div>'+
        '<div class="campaign-tag-row">'+
          '<span class="campaign-topic-tag">'+esc(themeLabel(p))+'</span>'+
          '<span class="campaign-status-tag '+visual+'">'+esc(statusLabel(p.status))+'</span>'+
          extraBadges(p)+
        '</div>'+
        themeWarning+
        (['unpublished','closed','completed','archived'].includes(p.status)?'<div class="campaign-reprogram-hint"><strong>Relancer ce même autodiagnostic</strong><span>Utilisez « Reprogrammer » pour conserver le contenu et les mêmes liens. Il n’est pas nécessaire de reconstruire une campagne sur ce thème.</span></div>':'')+
        secondaryActions(p)+
      '</div>'+
    '</article>';
  }

  async function projectAction(action,id){
    var p=projects.find(function(x){return String(x.id)===String(id);});if(!p)return;
    if(action==='delete'){var ok=await StudioModal.confirm({eyebrow:'Faire du tri',type:'danger',title:'Supprimer « '+campaignName(p)+' » ?',message:'Cet autodiagnostic, son contenu personnalisé et ses fichiers seront définitivement supprimés. Cette action ne peut pas être annulée.',cancelLabel:'Conserver cet AD',confirmLabel:'Supprimer définitivement'});if(!ok)return;await StudioAPI.request('/api/projects/'+id,{method:'DELETE'});await StudioModal.alert({eyebrow:'Autodiagnostic supprimé',title:'La suppression est terminée',message:'« '+campaignName(p)+' » a été retiré de votre espace.',type:'success',confirmLabel:'Fermer'});return load();}
    if(action==='archive'){var ok2=await StudioModal.confirm({title:'Archiver cet autodiagnostic ?',message:'Il sera déplacé dans vos archives et restera reprogrammable.',confirmLabel:'Archiver'});if(!ok2)return;await StudioAPI.request('/api/projects/'+id+'/archive',{method:'PATCH',body:'{}'});return load();}
    if(action==='extend'){var closeDate=await askExtensionDate(p);if(!closeDate)return;await StudioAPI.request('/api/projects/'+id+'/extend',{method:'PATCH',body:JSON.stringify({closeDate:closeDate})});await StudioModal.alert({eyebrow:'Campagne prolongée',title:'La nouvelle date est enregistrée',message:'La campagne, son contenu et ses liens restent inchangés.',type:'success',confirmLabel:'Fermer'});return load();}
    if(action==='unpublish'){var okUnpublish=await StudioModal.confirm({eyebrow:'Campagne publiée',type:'warning',title:'Dépublier « '+campaignName(p)+' » ?',message:'La campagne ne sera plus accessible aux répondants. Son contenu, ses résultats et ses liens seront conservés. Vous pourrez ensuite l’archiver ou la reprogrammer.',cancelLabel:'Laisser publiée',confirmLabel:'Dépublier la campagne'});if(!okUnpublish)return;await StudioAPI.request('/api/projects/'+id+'/unpublish',{method:'PATCH',body:'{}'});await StudioModal.alert({eyebrow:'Campagne dépubliée',title:'La campagne n’est plus accessible',message:'Vous pouvez maintenant l’archiver ou la reprogrammer avec les mêmes liens.',type:'success',confirmLabel:'Fermer'});return load();}
    if(action==='restore'){var okRestore=await StudioModal.confirm({title:'Restaurer cette campagne ?',message:'Elle reviendra dans vos campagnes dépubliées.',confirmLabel:'Restaurer'});if(!okRestore)return;await StudioAPI.request('/api/projects/'+id+'/restore',{method:'PATCH',body:'{}'});return load();}
    if(action==='reprogram'){
      var q=query(p);
      if(!q)throw new Error('Le thème réel de cette campagne est absent. Reprogrammation impossible sans corriger les données du projet.');
      var ok3=await StudioModal.confirm({eyebrow:'Réutiliser une campagne existante',title:'Reprogrammer cet autodiagnostic ?',message:'Vous n’avez pas besoin de reconstruire une campagne sur le même thème. Le contenu, l’URL de passation et l’URL de résultats seront conservés ; vous choisirez seulement de nouvelles dates.',confirmLabel:'Reprogrammer avec les mêmes liens'});if(!ok3)return;
      await StudioAPI.request('/api/projects/'+id+'/reprogram',{method:'POST',body:'{}'});
      location.href='parametrage.html'+q+'&reprogram=1';
      return;
    }
    if(action==='clone'){
      if(!hasTheme(p))throw new Error('Le thème réel de cette campagne est absent. Clonage impossible sans corriger les données du projet.');
      var ok4=await StudioModal.confirm({title:'Cloner cet autodiagnostic ?',message:'Une copie indépendante sera créée et recevra de nouveaux liens après publication.',confirmLabel:'Cloner'});if(!ok4)return;
      var r=await StudioAPI.request('/api/projects/'+id+'/clone',{method:'POST',body:'{}'});
      location.href='composer.html?theme='+encodeURIComponent(themeSlug(p))+'&projectId='+encodeURIComponent(r.project.id);
    }
  }

  function bindProjectActions(){
    document.querySelectorAll('[data-project-action]').forEach(function(b){
      b.onclick=function(e){
        e.preventDefault();e.stopPropagation();
        projectAction(b.dataset.projectAction,b.dataset.projectId).catch(function(err){
          StudioModal.alert({title:'Action impossible',message:err.message||'Une erreur est survenue.',confirmLabel:'Fermer'});
        });
      };
    });
  }

  function renderAlerts(){
    var submitted=projects.filter(function(p){return ['configuration_submitted','review_pending','in_review','client_validation_required','ready_to_publish'].includes(p.status);});
    var results=projects.filter(function(p){return p.status==='closed'||p.status==='completed'||p.status==='unpublished';});
    var now=new Date();
    var soonLimit=new Date(now.getTime()+14*24*60*60*1000);
    var endingSoon=projects.filter(function(p){
      if(!(p.status==='published'||p.status==='active'))return false;
      if(!p.close_date)return false;
      var d=new Date(p.close_date);
      return !Number.isNaN(d.getTime())&&d>=now&&d<=soonLimit;
    });

    document.getElementById('submitted-count').textContent=submitted.length+' configuration'+(submitted.length>1?'s':'')+' transmise'+(submitted.length>1?'s':'');
    document.getElementById('results-count').textContent=results.length+' campagne'+(results.length>1?'s':'')+' avec résultats';
    document.getElementById('ending-soon-count').textContent=endingSoon.length+' campagne'+(endingSoon.length>1?'s':'')+' se termine'+(endingSoon.length>1?'nt':'')+' bientôt';
    document.getElementById('ending-soon-text').textContent=endingSoon.length
      ? endingSoon.map(function(p){return campaignName(p)+' · clôture le '+dateFr(p.close_date);}).join(' — ')
      : 'Aucune campagne ne nécessite de relance immédiate.';
  }

  function statusKey(p){return p.status||'unknown';}

  function filterLabel(key){
    if(key==='all')return 'Toutes';
    if(key==='results')return 'Résultats';
    if(key==='endingSoon')return 'À surveiller';
    if(key==='validation')return 'À valider';
    if(key==='review')return 'En relecture';
    return statusLabel(key);
  }

  function countForFilter(key){
    if(key==='all')return projects.length;
    if(key==='results')return projects.filter(function(p){return ['unpublished','closed','completed'].includes(p.status);}).length;
    if(key==='validation')return projects.filter(function(p){return p.status==='client_validation_required';}).length;
    if(key==='review')return projects.filter(function(p){return ['configuration_submitted','review_pending','in_review'].includes(p.status);}).length;
    if(key==='endingSoon'){
      var now=new Date(),limit=new Date(now.getTime()+14*24*60*60*1000);
      return projects.filter(function(p){var d=new Date(p.close_date);return ['published','active'].includes(p.status)&&p.close_date&&!Number.isNaN(d.getTime())&&d>=now&&d<=limit;}).length;
    }
    return projects.filter(function(p){return statusKey(p)===key;}).length;
  }

  function buildFilters(){
    var order=['all','validation','published','scheduled','review','draft','unpublished','closed','completed','archived'];
    filtersRoot.innerHTML=order.filter(function(key){return key==='all'||countForFilter(key)>0;}).map(function(key){
      return '<button class="campaign-filter-tab'+(activeFilter===key?' active':'')+'" type="button" data-filter="'+esc(key)+'">'+esc(filterLabel(key))+' <span>'+countForFilter(key)+'</span></button>';
    }).join('');
    filtersRoot.querySelectorAll('[data-filter]').forEach(function(button){
      button.addEventListener('click',function(){
        activeFilter=button.getAttribute('data-filter');
        buildFilters();
        renderCards();
      });
    });
  }

  function matchesFilter(p){
    if(activeFilter==='all')return true;
    if(activeFilter==='results')return ['unpublished','closed','completed'].includes(p.status);
    if(activeFilter==='validation')return p.status==='client_validation_required';
    if(activeFilter==='review')return ['configuration_submitted','review_pending','in_review'].includes(p.status);
    if(activeFilter==='endingSoon'){
      if(!['published','active'].includes(p.status)||!p.close_date)return false;
      var now=new Date(),limit=new Date(now.getTime()+14*24*60*60*1000),d=new Date(p.close_date);
      return !Number.isNaN(d.getTime())&&d>=now&&d<=limit;
    }
    return statusKey(p)===activeFilter;
  }

  function renderCards(){
    var term=(search&&search.value?search.value:'').trim().toLowerCase();
    var filtered=projects.filter(function(p){
      var haystack=[campaignName(p),themeLabel(p),statusLabel(p.status)].join(' ').toLowerCase();
      return matchesFilter(p)&&(!term||haystack.indexOf(term)!==-1);
    });
    cardRoot.innerHTML=filtered.map(cardHtml).join('');
    noResults.hidden=filtered.length!==0;
    bindProjectActions();
  }

  function bindQuickFilters(){
    document.querySelectorAll('[data-quick-filter]').forEach(function(button){
      button.addEventListener('click',function(){
        activeFilter=button.getAttribute('data-quick-filter');
        buildFilters();
        renderCards();
        document.querySelector('.campaign-browser')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
  }

  async function enrichCommunication(project){
    if(!project||!project.id)return project;
    try{
      var data=await window.StudioAPI.request('/api/projects/'+encodeURIComponent(project.id)+'/communication-assets');
      var communication=data&&data.communication||{};
      project.communication_share_url=communication.shareUrl||project.communication_share_url||'';
      project.communication_results_url=communication.resultsUrl||project.communication_results_url||'';
      project.communication_video_url=communication.videoDownloadUrl||project.communication_video_url||'';
    }catch(e){}
    return project;
  }

  async function load(){
    try{
      var data=await window.StudioAPI.request('/api/projects?organizationId='+encodeURIComponent(window.StudioAPI.organizationId()));
      projects=Array.isArray(data.projects)?data.projects:[];
      await Promise.all(projects.map(enrichCommunication));
      renderAlerts();
      buildFilters();
      renderCards();
      if(!initialActionHandled&&initialAction&&initialProjectId){initialActionHandled=true;projectAction(initialAction,initialProjectId).catch(function(err){StudioModal.alert({title:'Action impossible',message:err.message||'Une erreur est survenue.',confirmLabel:'Fermer'});});}
    }catch(e){
      cardRoot.innerHTML='<div class="composer-alert">Impossible de charger les campagnes : '+esc(e.message)+'</div>';
    }
  }

  if(search)search.addEventListener('input',renderCards);
  bindQuickFilters();
  load();
})();
