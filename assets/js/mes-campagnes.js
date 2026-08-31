(function(){
  var cardRoot=document.getElementById('campaigns-card-root');
  var filtersRoot=document.getElementById('campaign-filters');
  var search=document.getElementById('campaignSearch');
  var noResults=document.getElementById('noResults');
  if(!cardRoot||!filtersRoot)return;

  var projects=[];
  var activeFilter='all';

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
      published:'Publiée',
      scheduled:'Programmée',
      active:'En cours',
      unpublished:'Dépubliée',
      closed:'Terminée',
      completed:'Terminée',
      archived:'Archivée'
    }[status]||status||'Statut inconnu';
  }

  function statusVisual(status){
    if(status==='draft')return 'draft';
    if(status==='configuration_submitted')return 'submitted';
    if(status==='scheduled')return 'scheduled';
    if(status==='published'||status==='active')return 'published';
    if(status==='unpublished')return 'unpublished';
    if(status==='closed'||status==='completed')return 'completed';
    if(status==='archived')return 'archived';
    return 'draft';
  }

  function themeLabel(p){
    var raw=String(p.theme_title||p.theme_slug||'').trim();
    if(!raw)return 'Autodiagnostic D&I';
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
    return '?theme='+encodeURIComponent(p.theme_slug||'sexisme')+'&projectId='+encodeURIComponent(p.id);
  }


  function contentPage(p){
    var slug=String(p.theme_slug||'').toLowerCase().trim();
    var pages={
      'sexisme':'theme-sexisme.html',
      'management':'theme-management.html',
      'management-inclusif':'theme-management.html',
      'manager-inclusif':'theme-management.html',
      'handicap':'theme-handicap.html',
      'lgbt':'theme-lgbt.html',
      'lgbt-plus':'theme-lgbt.html',
      'origines':'theme-origines.html',
      'diversite-des-origines':'theme-origines.html',
      'religion':'theme-religion.html',
      'diversite-religieuse':'theme-religion.html',
      'intergenerationnel':'theme-intergenerationnel.html',
      'collaborateur':'theme-collaborateur.html',
      'collaborateur-inclusif':'theme-collaborateur.html'
    };
    return (pages[slug]||'composer.html')+query(p);
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

  function primaryAction(p){
    var q=query(p),id=esc(p.id);
    if(p.status==='draft')return '<a class="campaign-btn campaign-btn-primary" href="'+resumePage(p.current_step)+q+'">Reprendre la création</a>';
    if(p.status==='configuration_submitted')return '<span class="campaign-btn campaign-btn-primary campaign-btn-static">En attente de publication</span>';
    if(p.status==='unpublished'||p.status==='closed'||p.status==='completed')return '<button class="campaign-btn campaign-btn-primary" type="button" data-project-action="reprogram" data-project-id="'+id+'">🚀 Reprogrammer</button>';
    if(p.status==='archived')return '<button class="campaign-btn campaign-btn-primary" type="button" data-project-action="restore" data-project-id="'+id+'">↩️ Restaurer</button>';
    return '<a class="campaign-btn campaign-btn-primary" href="campagne-detail.html'+q+'">Voir la campagne</a>';
  }

  function secondaryActions(p){
    var q=query(p),id=esc(p.id);
    var items=[];
    if(p.status!=='draft')items.push('<a class="campaign-btn" href="'+contentPage(p)+'">👁️ Voir le contenu</a>');
    if(p.status==='configuration_submitted'||p.status==='scheduled'||p.status==='published'||p.status==='active'||p.status==='unpublished'||p.status==='closed'||p.status==='completed')items.push('<a class="campaign-btn campaign-btn-kit" href="kit-communication.html'+q+'">📣 Kit de com</a>');
    if(p.status==='draft')items.push('<button class="campaign-btn campaign-btn-danger" type="button" data-project-action="delete" data-project-id="'+id+'">🗑️ Supprimer</button>');
    if(p.status!=='draft'&&p.status!=='configuration_submitted')items.push('<button class="campaign-btn" type="button" data-project-action="clone" data-project-id="'+id+'">🧬 Cloner</button>');

    var more=[];
    if(p.status==='unpublished'||p.status==='closed'||p.status==='completed')more.push('<button type="button" data-project-action="archive" data-project-id="'+id+'">📦 Archiver</button>');
    if((p.status==='unpublished'||p.status==='closed'||p.status==='completed'||p.status==='archived'))more.push('<button class="danger" type="button" data-project-action="delete" data-project-id="'+id+'">🗑️ Supprimer</button>');

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
        secondaryActions(p)+
      '</div>'+
    '</article>';
  }

  async function projectAction(action,id){
    var p=projects.find(function(x){return String(x.id)===String(id);});if(!p)return;
    if(action==='delete'){var ok=await StudioModal.confirm({type:'danger',title:'Supprimer cet autodiagnostic ?',message:'Cette suppression est définitive.',confirmLabel:'Supprimer'});if(!ok)return;await StudioAPI.request('/api/projects/'+id,{method:'DELETE'});return load();}
    if(action==='archive'){var ok2=await StudioModal.confirm({title:'Archiver cet autodiagnostic ?',message:'Il sera déplacé dans vos archives et restera reprogrammable.',confirmLabel:'Archiver'});if(!ok2)return;await StudioAPI.request('/api/projects/'+id+'/archive',{method:'PATCH',body:'{}'});return load();}
    if(action==='restore'){var okRestore=await StudioModal.confirm({title:'Restaurer cette campagne ?',message:'Elle reviendra dans vos campagnes dépubliées.',confirmLabel:'Restaurer'});if(!okRestore)return;await StudioAPI.request('/api/projects/'+id+'/restore',{method:'PATCH',body:'{}'});return load();}
    if(action==='reprogram'){var ok3=await StudioModal.confirm({title:'Reprogrammer cet autodiagnostic ?',message:'La même URL sera conservée. Vous pourrez choisir de nouvelles dates.',confirmLabel:'Reprogrammer'});if(!ok3)return;await StudioAPI.request('/api/projects/'+id+'/reprogram',{method:'POST',body:'{}'});location.href='parametrage.html'+query(p)+'&reprogram=1';return;}
    if(action==='clone'){var ok4=await StudioModal.confirm({title:'Cloner cet autodiagnostic ?',message:'Une copie indépendante sera créée et recevra de nouveaux liens après publication.',confirmLabel:'Cloner'});if(!ok4)return;var r=await StudioAPI.request('/api/projects/'+id+'/clone',{method:'POST',body:'{}'});location.href='composer.html?projectId='+encodeURIComponent(r.project.id);}
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
    var submitted=projects.filter(function(p){return p.status==='configuration_submitted';});
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
    return statusLabel(key);
  }

  function countForFilter(key){
    if(key==='all')return projects.length;
    if(key==='results')return projects.filter(function(p){return ['unpublished','closed','completed'].includes(p.status);}).length;
    if(key==='endingSoon'){
      var now=new Date(),limit=new Date(now.getTime()+14*24*60*60*1000);
      return projects.filter(function(p){var d=new Date(p.close_date);return ['published','active'].includes(p.status)&&p.close_date&&!Number.isNaN(d.getTime())&&d>=now&&d<=limit;}).length;
    }
    return projects.filter(function(p){return statusKey(p)===key;}).length;
  }

  function buildFilters(){
    var order=['all','published','scheduled','configuration_submitted','draft','unpublished','closed','completed','archived'];
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

  async function load(){
    try{
      var data=await window.StudioAPI.request('/api/projects?organizationId='+encodeURIComponent(window.StudioAPI.organizationId()));
      projects=Array.isArray(data.projects)?data.projects:[];
      renderAlerts();
      buildFilters();
      renderCards();
    }catch(e){
      cardRoot.innerHTML='<div class="composer-alert">Impossible de charger les campagnes : '+esc(e.message)+'</div>';
    }
  }

  if(search)search.addEventListener('input',renderCards);
  bindQuickFilters();
  load();
})();
