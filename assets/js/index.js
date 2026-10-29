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
      review_pending:'À relire par Me&YouToo',
      in_review:'En cours de relecture',
      client_validation_required:'Votre validation est requise',
      ready_to_publish:'Prête à publier',
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
    if(['configuration_submitted','review_pending','in_review','client_validation_required','ready_to_publish','scheduled'].includes(status))return 'badge-info';
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
    if(['configuration_submitted','review_pending','in_review','client_validation_required','ready_to_publish'].includes(project.status))return { href:'validation.html'+query, label:'Suivre la relecture' };
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
      return '<details class="card campaign-card dashboard-campaign-disclosure">'+
        '<summary><span>'+esc(projectName(project))+'</span><span class="dashboard-campaign-chevron" aria-hidden="true"></span></summary>'+
        '<div class="dashboard-campaign-details">'+
          '<span class="badge '+statusClass(project.status)+'">'+esc(statusLabel(project.status))+'</span>'+
          '<p>'+esc(project.theme_title||project.theme_slug||'—')+'</p>'+
          '<p>'+esc(projectDate(project))+'</p>'+
          '<p><strong>'+number(project.situation_count)+'</strong> situation'+(Number(project.situation_count)>1?'s':'')+'</p>'+
          '<a class="button button-secondary" href="'+esc(action.href)+'">'+esc(action.label)+'</a>'+
        '</div>'+
      '</details>';
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

  // ── Gamification : mesure l'activation du programme Studio, jamais le niveau d'inclusion. ──
  var RESPONDENTS_INFO='Un même collaborateur peut répondre plusieurs fois, le questionnaire étant anonyme : les répondants correspondent au nombre de questionnaires complétés. Chiffres mis à jour chaque nuit.';
  function plural(n,word){return number(n)+' '+word+(Number(n)>1?'s':'');}

  // Paliers du pack : un pack consommé est une réussite, jamais présenté en rouge.
  function packStage(percent,remaining,explored,themesTotal){
    if(percent>=90)return {title:'Votre pack est presque entièrement utilisé',text:'Plus que '+plural(remaining,'passation')+'. Commandez dès maintenant pour ne pas interrompre votre programme.',cta:'urgent'};
    if(percent>=80)return {title:'Votre pack est utilisé à '+percent+' %',text:'Il vous reste '+plural(remaining,'passation')+'. Anticipez vos prochaines campagnes.',cta:'pulse'};
    if(percent>=50)return {title:'Déjà la moitié de votre pack utilisée',text:'Vous avez activé '+explored+' thématique'+(explored>1?'s':'')+' sur les '+themesTotal+' disponibles.',cta:''};
    if(percent>=25)return {title:'Votre programme prend vie',text:plural(remaining,'passation')+' encore disponibles pour de nouvelles campagnes.',cta:''};
    return {title:'Votre programme démarre',text:plural(remaining,'passation')+' disponibles, valables sur tous les diagnostics Me&YouToo.',cta:''};
  }
  function packCard(organization,explored,themesTotal){
    if(!organization||organization.pack_unlimited)return '';
    var quota=Number(organization.passations_quota)||0;if(quota<=0)return '';
    var used=Math.min(quota,Math.max(0,Number(organization.passations_used)||0));
    var percent=Math.round(used/quota*100);
    var remaining=organization.passations_remaining==null?quota-used:Number(organization.passations_remaining);
    var stage=packStage(percent,remaining,explored,themesTotal);
    var ticks=[25,50,75,90].map(function(t){return '<i class="sp-tick'+(percent>=t?' is-reached':'')+'" style="left:'+t+'%"><b>'+t+' %</b></i>';}).join('');
    return '<article class="sp-card sp-pack">'+
      '<header class="sp-head"><span class="sp-eyebrow">Votre pack</span><strong class="sp-figure">'+percent+' %</strong></header>'+
      '<h3>'+esc(stage.title)+'</h3>'+
      '<div class="sp-bar" role="progressbar" aria-label="Utilisation du pack" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><span class="sp-bar-fill" data-width="'+percent+'"></span>'+ticks+'</div>'+
      '<p class="sp-meta">'+number(used)+' / '+number(quota)+' passations utilisées'+(organization.pack_expires_at?' · valable jusqu’au '+dateFr(organization.pack_expires_at):'')+'</p>'+
      '<p>'+esc(stage.text)+'</p>'+
      '<a class="button '+(stage.cta?'button-primary sp-cta is-'+stage.cta:'button-secondary')+'" href="packs.html">Commander des passations</a>'+
    '</article>';
  }

  // Prochaine étape : une seule action, choisie selon où en est le client.
  function nextStep(g,organization,themesTotal){
    var f=g.focusCampaign;
    if(!g.launchedCampaigns&&!g.campaignsInPreparation)return {title:'Lancez votre première campagne',text:'Choisissez une thématique et composez votre autodiagnostic à partir des situations conçues par nos experts.',href:'bibliotheque.html',cta:'Découvrir les diagnostics'};
    if(!g.launchedCampaigns)return {title:'Finalisez votre campagne en préparation',text:'Encore quelques étapes avant de la diffuser à vos collaborateurs.',href:'mes-campagnes.html',cta:'Reprendre ma campagne'};
    if(f&&f.respondents/f.objective<0.75){
      var pct=Math.min(100,Math.round(f.respondents/f.objective*100)),goal=pct<50?50:75;
      return {title:'Atteignez '+goal+' % de participation sur « '+f.name+' »',text:number(f.respondents)+' répondants sur un objectif de '+number(f.objective)+'. Une relance suffit souvent à faire décoller la participation.',href:'kit-communication.html?projectId='+encodeURIComponent(f.id)+(f.themeSlug?'&theme='+encodeURIComponent(f.themeSlug):''),cta:'Relancer mes collaborateurs',progress:pct};
    }
    var quota=Number(organization&&organization.passations_quota)||0,used=Number(organization&&organization.passations_used)||0;
    if(organization&&!organization.pack_unlimited&&quota>0&&used/quota>=0.8)return {title:'Anticipez votre prochaine commande',text:'Votre pack est presque utilisé : sécurisez vos prochaines campagnes.',href:'packs.html',cta:'Commander des passations'};
    if(g.exploredThemes.length<themesTotal)return {title:'Explorez une nouvelle thématique',text:'Vous avez exploré '+g.exploredThemes.length+' thématique'+(g.exploredThemes.length>1?'s':'')+' sur '+themesTotal+'. Votre pack est valable sur tous les diagnostics.',href:'bibliotheque.html',cta:'Découvrir les diagnostics'};
    return {title:'Lancez votre prochaine campagne',text:'Votre programme est complet : gardez la dynamique avec une nouvelle vague.',href:'bibliotheque.html',cta:'Composer une campagne'};
  }
  function nextCard(step){
    return '<article class="sp-card sp-next">'+
      '<header class="sp-head"><span class="sp-eyebrow"><i class="sp-pulse-dot" aria-hidden="true"></i>Votre prochaine étape</span></header>'+
      '<h3>'+esc(step.title)+'</h3><p>'+esc(step.text)+'</p>'+
      (step.progress!=null?'<div class="sp-bar sp-bar-small" role="progressbar" aria-label="Participation" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+step.progress+'"><span class="sp-bar-fill" data-width="'+step.progress+'"></span><i class="sp-tick is-goal" style="left:75%"><b>75 %</b></i></div>':'')+
      '<a class="button button-primary sp-cta is-pulse" href="'+esc(step.href)+'">'+esc(step.cta)+' →</a>'+
    '</article>';
  }

  function missionsCard(g){
    var explored=g.exploredThemes.length,r=g.respondentsTotal,best=g.bestParticipation;
    var missions=[
      {label:'Lancer votre première campagne',done:g.launchedCampaigns>=1},
      r==null?null:{label:'Atteindre 50 répondants',done:r>=50,hint:number(Math.min(r,50))+' / 50'},
      {label:'Explorer une deuxième thématique',done:explored>=2,hint:Math.min(explored,2)+' / 2'},
      best==null?null:{label:'Atteindre 75 % de participation sur une campagne',done:best>=75,hint:best?'meilleure campagne : '+best+' %':''},
      r==null?null:{label:'Atteindre 1 000 répondants',done:r>=1000,hint:number(Math.min(r,1000))+' / 1 000'},
      {label:'Explorer 5 thématiques',done:explored>=5,hint:Math.min(explored,5)+' / 5'}
    ].filter(Boolean);
    var done=missions.filter(function(m){return m.done;}).length;
    return '<article class="sp-card sp-missions">'+
      '<header class="sp-head"><span class="sp-eyebrow">Vos missions Studio</span><strong class="sp-figure">'+done+'/'+missions.length+'</strong></header>'+
      (r!=null?'<p class="sp-meta">'+plural(r,'répondant')+' depuis le début de votre programme <button type="button" class="admin-info-dot" data-info="'+esc(RESPONDENTS_INFO)+'" aria-label="Comprendre le nombre de répondants" aria-haspopup="dialog">i</button></p>':'')+
      '<ul class="sp-mission-list">'+missions.map(function(m){return '<li class="'+(m.done?'is-done':'')+'"><span class="sp-check" aria-hidden="true">'+(m.done?'✓':'')+'</span><span>'+esc(m.label)+(m.done||!m.hint?'':'<small>'+esc(m.hint)+'</small>')+'</span><span class="visually-hidden">'+(m.done?'accomplie':'à accomplir')+'</span></li>';}).join('')+'</ul>'+
    '</article>';
  }

  function coverageCard(g,themes){
    var explored=new Set(g.exploredThemes);
    var count=themes.filter(function(t){return explored.has(t.slug);}).length;
    return '<article class="sp-card sp-coverage">'+
      '<header class="sp-head"><span class="sp-eyebrow">Votre couverture D&amp;I</span><strong class="sp-figure">'+count+'<small> / '+themes.length+'</small></strong></header>'+
      '<h3>'+plural(count,'thématique')+' explorée'+(count>1?'s':'')+' sur '+themes.length+'</h3>'+
      '<p class="sp-meta">Votre pack est valable sur tous les diagnostics Me&amp;YouToo : chaque nouvelle thématique enrichit votre programme.</p>'+
      '<div class="sp-theme-grid">'+themes.map(function(t){var slug=String(t.slug||'').replace(/[^a-z0-9-]/g,''),on=explored.has(t.slug);
        return '<a class="sp-theme'+(on?' is-explored':'')+'" href="'+themePage(slug)+'"><span class="sp-theme-state" aria-hidden="true">'+(on?'✓':'+')+'</span><span>'+esc(t.title)+'</span><small>'+(on?'Explorée':'À explorer')+'</small></a>';}).join('')+'</div>'+
    '</article>';
  }

  function renderGamification(data){
    var grid=document.querySelector('.stats-grid'),g=data.gamification,themes=Array.isArray(data.themes)?data.themes:[];
    if(!grid||!g)return;
    var old=document.getElementById('studio-progress');if(old)old.remove();
    grid.insertAdjacentHTML('afterend','<section class="studio-progress" id="studio-progress" aria-label="Votre progression Studio">'+
      '<div class="sp-row">'+packCard(data.organization,g.exploredThemes.length,themes.length)+nextCard(nextStep(g,data.organization,themes.length))+'</div>'+
      '<div class="sp-row">'+missionsCard(g)+coverageCard(g,themes)+'</div>'+
    '</section>');
    // Les jauges se remplissent à l'affichage.
    setTimeout(function(){document.querySelectorAll('#studio-progress .sp-bar-fill').forEach(function(bar){bar.style.width=bar.dataset.width+'%';});},60);
  }

  async function load(){
    try{
      var data=await window.StudioAPI.request('/api/me/dashboard');
      var firstName=data.user&&data.user.firstName?data.user.firstName:'vous';
      document.getElementById('dashboard-first-name').textContent=firstName;
      document.getElementById('active-campaigns-count').textContent=number(data.summary&&data.summary.active_campaigns);
      document.getElementById('draft-campaigns-count').textContent=number(data.summary&&data.summary.draft_campaigns);
      document.getElementById('used-passations-count').textContent=number(data.organization&&data.organization.passations_used);
      document.getElementById('remaining-passations-count').textContent=data.organization&&data.organization.pack_unlimited?'Illimité':number(data.organization&&data.organization.passations_remaining);
      if(data.organization&&data.organization.pack_expires_at){
        document.getElementById('remaining-passations-note').textContent='Disponibles jusqu’au '+dateFr(data.organization.pack_expires_at)+' · commander';
      }
      renderGamification(data);
      renderProjects(Array.isArray(data.recentProjects)?data.recentProjects:[]);
      renderThemes(Array.isArray(data.themes)?data.themes:[]);
    }catch(error){
      recentRoot.innerHTML='<div class="composer-alert">Impossible de charger les données de l’accueil : '+esc(error.message)+'</div>';
      topicsRoot.innerHTML='<div class="composer-alert">Impossible de charger le catalogue.</div>';
    }
  }

  load();
})();
