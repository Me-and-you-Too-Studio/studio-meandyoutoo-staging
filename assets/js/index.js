(function(){
  var recentRoot=document.getElementById('dashboard-recent-campaigns');
  var topicsRoot=document.getElementById('dashboard-topics');
  if(!recentRoot||!topicsRoot||!window.StudioAPI)return;

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,function(character){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }

  function number(value){
    return new Intl.NumberFormat('fr-FR').format(Number(value)||0);
  }

  function dateFr(value){
    if(!value)return '—';
    var date=new Date(value);
    return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('fr-FR');
  }

  function statusLabel(status){
    return {
      draft:'Brouillon',
      configuration_submitted:'Configuration transmise',
      scheduled:'Programmée',
      published:'Publiée',
      active:'En cours',
      closed:'Terminée',
      completed:'Terminée',
      archived:'Archivée'
    }[status]||status||'Statut inconnu';
  }

  function statusClass(status){
    if(status==='draft')return 'badge-warning';
    if(status==='configuration_submitted'||status==='scheduled')return 'badge-info';
    if(status==='published'||status==='active')return 'badge-success';
    return 'badge-muted';
  }

  function projectName(project){
    return project.campaign_name||project.respondent_title||project.title||project.theme_title||'Campagne sans nom';
  }

  function projectLink(project){
    var query='?theme='+encodeURIComponent(project.theme_slug||'sexisme')+'&projectId='+encodeURIComponent(project.id);
    if(project.status==='draft'){
      var pages={composer:'composer.html',personnalisation:'personnalisation.html',parametrage:'parametrage.html',validation:'validation.html'};
      return { href:(pages[project.current_step]||'composer.html')+query, label:'Continuer' };
    }
    if(project.status==='configuration_submitted')return { href:'validation.html'+query, label:'Voir la configuration' };
    return { href:'campagne-detail.html'+query, label:'Voir la campagne' };
  }

  function projectDate(project){
    if(project.status==='draft')return 'Dernière modification le '+dateFr(project.updated_at);
    if(project.status==='closed'||project.status==='completed')return 'Terminée le '+dateFr(project.close_date||project.updated_at);
    if(project.launch_date)return 'Lancement le '+dateFr(project.launch_date);
    return 'Dernière modification le '+dateFr(project.updated_at);
  }

  function renderProjects(projects){
    if(!projects.length){
      recentRoot.innerHTML='<div class="card empty-drafts"><strong>Aucune campagne enregistrée</strong><p>Commencez depuis la bibliothèque pour créer votre première campagne.</p><a class="button button-primary" href="bibliotheque.html">Explorer la bibliothèque</a></div>';
      return;
    }
    recentRoot.innerHTML=projects.map(function(project){
      var action=projectLink(project);
      return '<article class="card campaign-card">'+
        '<span class="badge '+statusClass(project.status)+'">'+esc(statusLabel(project.status))+'</span>'+
        '<h3>'+esc(projectName(project))+'</h3>'+
        '<p>'+esc(project.theme_title||project.theme_slug||'—')+'</p>'+
        '<p>'+esc(projectDate(project))+'</p>'+
        '<p><strong>'+number(project.situation_count)+'</strong> situation'+(Number(project.situation_count)>1?'s':'')+'</p>'+
        '<a class="button button-secondary" href="'+esc(action.href)+'">'+esc(action.label)+'</a>'+
      '</article>';
    }).join('');
  }

  function themePage(slug){
    var known={sexisme:'theme-sexisme.html',handicap:'theme-handicap.html',lgbt:'theme-lgbt.html',origines:'theme-origines.html',religion:'theme-religion.html',intergenerationnel:'theme-intergenerationnel.html',management:'theme-management.html',collaborateur:'theme-collaborateur.html'};
    return known[slug]||'bibliotheque.html';
  }

  function renderThemes(themes){
    var intro='<div class="topic-cta hero-cta"><div><strong>Découvrir plus de sujets</strong><span>Chaque campagne est composée à partir de situations conçues par nos experts.</span></div><a class="button button-primary" href="bibliotheque.html">Explorer</a></div>';
    var cards=themes.slice(0,3).map(function(theme){
      var slug=String(theme.slug||'').replace(/[^a-z0-9-]/g,'');
      return '<a class="topic-mini" href="'+themePage(slug)+'"><div class="topic-icon"><img src="assets/img/illustrations/theme-'+esc(slug)+'.png" alt="" onerror="this.closest(\'.topic-icon\').style.display=\'none\'"></div><strong>'+esc(theme.title)+'</strong><span>'+number(theme.situation_count)+' situation'+(Number(theme.situation_count)>1?'s':'')+'</span></a>';
    }).join('');
    var more='<a class="topic-cta" href="bibliotheque.html"><strong>Voir tous les sujets</strong><span>Explorer la bibliothèque Me&YouToo.</span><span aria-hidden="true">→</span></a>';
    topicsRoot.innerHTML=intro+cards+more;
  }

  async function load(){
    try{
      var data=await window.StudioAPI.request('/api/me/dashboard');
      var firstName=data.user&&data.user.firstName?data.user.firstName:'vous';
      document.getElementById('dashboard-first-name').textContent=firstName;
      document.getElementById('active-campaigns-count').textContent=number(data.summary&&data.summary.active_campaigns);
      document.getElementById('draft-campaigns-count').textContent=number(data.summary&&data.summary.draft_campaigns);
      document.getElementById('used-passations-count').textContent=number(data.organization&&data.organization.passations_used);
      document.getElementById('remaining-passations-count').textContent=number(data.organization&&data.organization.passations_remaining);
      if(data.organization&&data.organization.pack_expires_at){
        document.getElementById('remaining-passations-note').textContent='Disponibles jusqu’au '+dateFr(data.organization.pack_expires_at)+' · commander';
      }
      renderProjects(Array.isArray(data.recentProjects)?data.recentProjects:[]);
      renderThemes(Array.isArray(data.themes)?data.themes:[]);
    }catch(error){
      recentRoot.innerHTML='<div class="composer-alert">Impossible de charger les données de l’accueil : '+esc(error.message)+'</div>';
      topicsRoot.innerHTML='<div class="composer-alert">Impossible de charger le catalogue.</div>';
    }
  }

  load();
})();
