/* Studio Me&YouToo — navigation partagée (sidebar, bottom-nav, menu mobile)
   Toute modification du menu latéral ou de la navigation mobile se fait UNIQUEMENT ici :
   les pages HTML ne contiennent qu'un conteneur vide (#sidebar-root / #bottom-nav-root)
   que ce script remplit au chargement, comme un header/menu partagé. */

/* Vocabulaire du parcours client : un seul nom par statut sur tous les écrans,
   et un lexique commun pour les points « i ». Toute évolution de libellé se fait ici. */
(function(){
  function esc(value){
    return String(value??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  var SUBMITTED={label:'Transmise à Me&YouToo',info:'Vous avez transmis votre configuration. L’équipe Me&YouToo va la relire pour garantir la qualité des contenus et des traductions. Vous n’avez rien à faire pour l’instant.'};
  var LIVE={label:'En diffusion',info:'Vos collaborateurs peuvent répondre. Suivez la participation et relancez-les si besoin avec le kit de communication.'};
  var ENDED={label:'Terminée',info:'La diffusion est terminée. Consultez vos résultats, puis lancez une nouvelle thématique pour poursuivre votre parcours : votre pack est valable sur tous les diagnostics.'};
  var STATUSES={
    draft:{label:'Brouillon',info:'Votre campagne est en cours de création. Reprenez-la à l’étape où vous l’avez laissée : rien n’est encore transmis à Me&YouToo.'},
    configuration_submitted:SUBMITTED,
    review_pending:SUBMITTED,
    in_review:{label:'En relecture chez Me&YouToo',info:'L’équipe Me&YouToo relit votre configuration. Si des ajustements sont nécessaires, elle vous les propose et vous pourrez les valider.'},
    client_validation_required:{label:'À vous de valider',adminLabel:'En attente du client',info:'Me&YouToo vous propose des corrections. Validez-les pour que la campagne puisse être programmée.'},
    ready_to_publish:{label:'Validée, en préparation',info:'Tout est validé. Me&YouToo prépare la mise en ligne de la campagne aux dates prévues.'},
    scheduled:{label:'Programmée',info:'La campagne s’ouvrira automatiquement à sa date de début. En attendant, préparez votre communication avec le kit.'},
    published:{label:'Publiée',info:'La campagne est validée et en ligne. Vos collaborateurs pourront répondre pendant sa période de diffusion.'},
    active:LIVE,
    unpublished:{label:'Dépubliée',info:'La campagne a été retirée avant sa date de fin. Vous pouvez la reprogrammer en conservant son contenu et ses liens.'},
    closed:ENDED,
    completed:ENDED,
    archived:{label:'Archivée',info:'La campagne est rangée dans vos archives. Vous pouvez la restaurer à tout moment.'}
  };
  var GLOSSARY={
    autodiagnostic:{title:'Qu’est-ce qu’un autodiagnostic ?',text:'Un questionnaire anonyme composé de situations concrètes de la vie au travail. Chaque collaborateur choisit ce qu’il ferait, puis découvre un profil et des pistes pour progresser. Ce n’est ni un test de connaissances ni une évaluation individuelle.'},
    thematique:{title:'Thématique',text:'Le sujet D&I de la campagne : sexisme, handicap, origines, management inclusif… Chaque thématique a son propre catalogue de situations conçues par nos experts.'},
    passation:{title:'Passation',text:'Un questionnaire complété par un collaborateur. Chaque passation est décomptée de votre pack, quelle que soit la thématique.'},
    pack:{title:'Votre pack',text:'Votre réserve de passations. Elle est valable sur tous les diagnostics Me&YouToo : utilisez-la pour explorer de nouvelles thématiques avec vos équipes.'},
    participation:{title:'Participations et répondants',text:'Un même collaborateur peut répondre plusieurs fois, le questionnaire étant anonyme : ce chiffre correspond au nombre de questionnaires complétés, pas à un nombre de personnes. Chiffres mis à jour chaque nuit.'},
    objectif:{title:'Objectif de répondants',text:'Le nombre de collaborateurs que vous souhaitez toucher. Il sert à calculer votre taux de participation et à savoir quand relancer.'},
    relecture:{title:'Relecture Me&YouToo',text:'Avant toute diffusion, l’équipe Me&YouToo vérifie vos contenus, vos traductions et vos paramètres. C’est une garantie de qualité pour vos collaborateurs.'},
    resultats:{title:'Résultats',text:'Les résultats anonymes et agrégés de votre campagne, accessibles par le lien que Me&YouToo renseigne. Ils montrent comment vos collaborateurs réagissent aux situations, pour orienter vos prochaines actions.'},
    chapitre:{title:'Chapitre',text:'Un ensemble de situations sur un même sujet. Votre autodiagnostic est composé d’un ou plusieurs chapitres.'},
    situation:{title:'Situation',text:'Une scène de la vie au travail, avec plusieurs réponses possibles. Le collaborateur choisit celle qui lui ressemble le plus.'},
    profil:{title:'Profil de restitution',text:'Le texte que chaque répondant découvre à la fin de son autodiagnostic : il l’aide à comprendre ses réponses et lui propose des pistes de progression.'}
  };
  function dot(title,text){
    return '<button type="button" class="admin-info-dot" data-info-title="'+esc(title)+'" data-info="'+esc(text)+'" aria-label="Comprendre : '+esc(title)+'">i</button>';
  }
  window.StudioStatus={
    // asAdmin : vue équipe Me&YouToo, où « À vous de valider » n’aurait pas de sens.
    label:function(status,asAdmin){var s=STATUSES[status];return s?(asAdmin&&s.adminLabel)||s.label:(status||'Statut inconnu');},
    info:function(status){return STATUSES[status]?STATUSES[status].info:'';},
    dot:function(status){return STATUSES[status]?dot(STATUSES[status].label,STATUSES[status].info):'';}
  };
  window.StudioGlossary={
    text:function(term){return GLOSSARY[term]?GLOSSARY[term].text:'';},
    dot:function(term){return GLOSSARY[term]?dot(GLOSSARY[term].title,GLOSSARY[term].text):'';}
  };
  // Frise de vie d'une campagne : cinq grandes étapes, qui agit maintenant et ce qui vient ensuite.
  var JOURNEY_STEPS=[
    {label:'Création',hint:'Composer, personnaliser, paramétrer'},
    {label:'Relecture',hint:'Vérification par Me&YouToo'},
    {label:'Mise en ligne',hint:'Programmation aux dates prévues'},
    {label:'Diffusion',hint:'Vos collaborateurs répondent'},
    {label:'Résultats',hint:'Analyser et poursuivre'}
  ];
  var OWNERS={client:'À vous d’agir',team:'Chez Me&YouToo',auto:'Automatique'};
  var IN_REVIEW={step:1,owner:'team',next:'Me&YouToo relit votre configuration. Vous serez prévenu par notification et par e-mail dès qu’une action vous sera demandée.'};
  var FINISHED={step:4,owner:'client',next:'Consultez vos résultats. Vous pouvez ensuite relancer cette campagne avec les mêmes contenus et les mêmes liens, ou explorer une nouvelle thématique : votre pack est valable sur tous les diagnostics Me&YouToo.'};
  var JOURNEY={
    draft:{step:0,owner:'client',next:'Terminez la composition, la personnalisation et le paramétrage, puis transmettez votre configuration à Me&YouToo.'},
    configuration_submitted:IN_REVIEW,
    review_pending:IN_REVIEW,
    in_review:IN_REVIEW,
    client_validation_required:{step:1,owner:'client',next:'Me&YouToo vous propose des corrections : validez-les pour passer à la mise en ligne.'},
    ready_to_publish:{step:2,owner:'team',next:'Me&YouToo prépare la mise en ligne aux dates prévues. Profitez-en pour préparer l’annonce à vos collaborateurs.'},
    scheduled:{step:2,owner:'auto',next:'La campagne s’ouvrira automatiquement à sa date de début. Préparez son annonce avec le kit de communication.'},
    published:{step:3,owner:'client',next:'Annoncez la campagne à vos collaborateurs avec le kit de communication.'},
    active:{step:3,owner:'client',next:'Suivez la participation et relancez vos collaborateurs avec le kit de communication si besoin. Il vous faut plus de temps ? Prolongez la campagne.'},
    unpublished:{step:4,owner:'client',next:'La campagne a été retirée. Reprogrammez-la pour la relancer avec les mêmes liens, ou lancez une nouvelle thématique.'},
    closed:FINISHED,
    completed:FINISHED,
    archived:FINISHED
  };
  window.StudioJourney={
    // Frise complète : étapes, puis « qui agit » et la prochaine étape, avec des boutons facultatifs [{href,label}] (le premier est principal).
    html:function(status,action,options){
      var j=JOURNEY[status];if(!j)return '';
      var done=j.step===4&&status!=='unpublished';
      var steps='<ol class="studio-process-steps studio-journey-steps">'+JOURNEY_STEPS.map(function(s,i){
        var state=i<j.step||(done&&i===j.step)?'is-done':i===j.step?'is-current':'';
        return '<li class="studio-process-step '+state+'"'+(i===j.step?' aria-current="step"':'')+'><span aria-hidden="true">'+(state==='is-done'?'✓':i+1)+'</span><strong>'+esc(s.label)+'</strong><small>'+esc(s.hint)+'</small></li>';
      }).join('')+'</ol>';
      if(options&&options.stepsOnly)return steps;
      return steps+'<div class="studio-journey-next is-'+j.owner+'"><span class="studio-journey-owner">'+esc(OWNERS[j.owner])+'</span><p><strong>Prochaine étape :</strong> '+esc(j.next)+'</p>'+
        [].concat(action||[]).map(function(a,i){return '<a class="button '+(i?'button-secondary':'button-primary')+'" href="'+esc(a.href)+'">'+esc(a.label)+(i?'':' →')+'</a>';}).join('')+'</div>';
    },
    // Version courte pour les cartes : progression en cinq segments et qui agit.
    mini:function(status){
      var j=JOURNEY[status];if(!j)return '';
      var done=j.step===4&&status!=='unpublished';
      return '<div class="studio-journey-mini is-'+j.owner+'"><ol aria-hidden="true">'+JOURNEY_STEPS.map(function(s,i){return '<li class="'+(i<j.step||(done&&i===j.step)?'is-done':i===j.step?'is-current':'')+'"></li>';}).join('')+'</ol>'+
        '<span>Phase '+(j.step+1)+'/5 · '+esc(JOURNEY_STEPS[j.step].label)+'</span><span class="studio-journey-owner">'+esc(OWNERS[j.owner])+'</span></div>';
    }
  };

  // Visites guidées : quelques bulles à la première visite d'une page, pour chaque personne.
  // Le « déjà vu » est gardé dans ce navigateur ; « Revoir la visite » (aide de la barre latérale) la relance.
  var NEXT_STEPS_TEXT='Choisissez une thématique dans le catalogue, puis suivez les 5 étapes de création : choisir, composer, personnaliser, paramétrer, transmettre. Me&YouToo relit tout avant la mise en ligne.';
  var TOURS={
    'accueil-legacy':{key:'accueil',steps:[
      {title:'Bienvenue dans votre Studio',text:'Vos campagnes déjà diffusées avec Me&YouToo sont ici, avec leur participation. Le Studio vous permet maintenant de créer vous-même vos prochains autodiagnostics.'},
      {target:'#dashboard-recent-campaigns',title:'Vos campagnes',text:'Retrouvez vos campagnes passées et en cours. Dans « Mes campagnes », vous suivez la participation, consultez vos résultats et pouvez relancer une campagne avec les mêmes liens.'},
      {target:'.sp-pack, .stat-link',title:'Votre pack de passations',text:'Une passation correspond à un questionnaire complété. Votre pack est valable sur toutes les thématiques Me&YouToo.'},
      {target:'.sp-coverage',title:'Les thématiques à explorer',text:'Voici les thématiques déjà abordées avec vos équipes et celles qui restent à découvrir. Chacune a ses situations conçues par nos experts.'},
      {target:'.topbar .button-primary, .top-actions .button-primary',title:'Lancer une nouvelle thématique',text:NEXT_STEPS_TEXT}
    ]},
    'accueil-new':{key:'accueil',steps:[
      {title:'Bienvenue dans votre Studio',text:'Ici, vous créez vos autodiagnostics : des questionnaires anonymes faits de situations concrètes de la vie au travail. Chaque collaborateur choisit ce qu’il ferait, puis découvre un profil et des pistes pour progresser.'},
      {target:'.sp-next',title:'Votre prochaine étape',text:'Le Studio vous indique toujours l’action du moment. Commencez par là.'},
      {target:'.topbar .button-primary, .top-actions .button-primary',title:'Créer votre première campagne',text:NEXT_STEPS_TEXT},
      {target:'.sp-pack, .stat-link',title:'Votre pack de passations',text:'Une passation correspond à un questionnaire complété. Votre pack est valable sur toutes les thématiques Me&YouToo.'},
      {target:'.help-card',title:'Besoin d’aide ?',text:'Contactez Me&YouToo à tout moment. Vous pouvez aussi revoir cette visite depuis ce bloc.'}
    ]},
    'mes-campagnes':{key:'mes-campagnes',auto:true,steps:[
      {target:'.campaign-pilot-kpi',parent:true,title:'Vos campagnes en un coup d’œil',text:'Cliquez sur un compteur pour n’afficher que les campagnes concernées : brouillons, en relecture, en diffusion, terminées.'},
      {target:'.campaign-project-card .campaign-status-tag',title:'Le statut de la campagne',text:'Le point « i » à côté du statut explique ce qu’il veut dire et qui doit agir.'},
      {target:'.campaign-project-card .studio-journey-mini',title:'Où en est-elle ?',text:'Chaque campagne passe par 5 phases : création, relecture, mise en ligne, diffusion, résultats. « À vous d’agir » signale qu’une action vous attend.'},
      {target:'.campaign-project-card .campaign-btn-primary',title:'L’action du moment',text:'Le bouton principal vous mène toujours à ce qu’il faut faire maintenant : reprendre la création, valider des corrections, voir la campagne…'}
    ]},
    'campagne-detail':{key:'campagne-detail',auto:true,steps:[
      {target:'.studio-journey',title:'Où en est votre campagne ?',text:'La phase en cours, qui doit agir et la prochaine étape, avec le bouton correspondant.'},
      {target:'.hero-panel',title:'Résultats et participation',text:'Suivez le nombre de répondants, mis à jour chaque nuit, et votre objectif de participation. Les résultats s’ouvrent ici dès qu’ils sont disponibles.'},
      {target:'#actions-title',parent:true,title:'Actions sur la campagne',text:'Aperçu répondant, kit de communication, prolongation ou reprogrammation : tout ce que vous pouvez faire sur cette campagne.'}
    ]},
    'composer':{key:'creation-composer',auto:true,steps:[
      {target:'nav.steps',title:'Les 5 étapes de création',text:'Vous êtes à l’étape « Composer ». Votre travail est enregistré au fur et à mesure : vous pouvez vous arrêter et reprendre plus tard depuis « Mes campagnes ».'},
      {target:'.composer-chapter-nav',title:'Les chapitres',text:'Votre autodiagnostic est composé d’un ou plusieurs chapitres. Ouvrez-en un pour voir ses situations.'},
      {target:'.composer-situation-list',title:'Les situations',text:'Dépliez une situation pour la lire avec ses réponses. Certaines forment un socle méthodologique et restent verrouillées ; d’autres peuvent être adaptées à votre organisation (prénom, métier, vocabulaire interne).'},
      {target:'.creation-sticky-actions',title:'Passer à l’étape suivante',text:'Quand votre sélection vous convient, continuez vers la personnalisation des profils.'}
    ]},
    'personnalisation':{key:'creation-personnalisation',auto:true,steps:[
      {target:'nav.steps',title:'Étape 3 : personnaliser',text:'Les profils sont les textes que chaque répondant découvre à la fin de son autodiagnostic, avec des pistes pour progresser.'},
      {target:'.composer-main',title:'Adapter les profils',text:'Relisez le titre, le résumé et la description de chaque profil. Vous pouvez adapter le ton à vos collaborateurs en gardant le sens pédagogique ; les seuils restent définis par Me&YouToo.'}
    ]},
    'parametrage':{key:'creation-parametrage',auto:true,steps:[
      {target:'nav.steps',title:'Étape 4 : paramétrer',text:'Vous renseignez ici ce que verront vos collaborateurs et les informations de diffusion.'},
      {target:'#settings-form fieldset:nth-of-type(2)',title:'L’introduction',text:'Adaptez le texte d’accueil à votre organisation. Si votre campagne a plusieurs langues, personnalisez-en une et confiez les autres à Me&YouToo.'},
      {target:'#settings-form fieldset:nth-of-type(3)',title:'Les dates',text:'La campagne s’ouvrira et se fermera automatiquement à ces dates. Prévoyez au moins cinq jours avant le lancement pour la relecture.'}
    ]},
    'validation':{key:'creation-validation',auto:true,steps:[
      {target:'nav.steps',title:'Dernière étape : transmettre',text:'Vérifiez votre configuration, puis transmettez-la. Me&YouToo la relit avant la mise en ligne et vous prévient par notification et par e-mail.'}
    ]}
  };
  var PAGE_TOURS={'mes-campagnes.html':'mes-campagnes','campagne-detail.html':'campagne-detail','composer.html':'composer','personnalisation.html':'personnalisation','parametrage.html':'parametrage'};
  var tourState=null,registeredTour=null;
  function tourUser(){try{return window.StudioAPI&&StudioAPI.user()||JSON.parse(localStorage.getItem('studio_user')||'null');}catch(e){return null;}}
  function seenKey(tour){var u=tourUser();return 'studio_tour_seen_v1:'+(u&&u.id||'anonyme')+':'+tour.key;}
  function hasSeen(tour){try{return localStorage.getItem(seenKey(tour))==='1';}catch(e){return true;}}
  function markSeen(tour){try{localStorage.setItem(seenKey(tour),'1');}catch(e){}}
  function findTarget(step){
    if(!step.target)return null;
    var el=null;step.target.split(',').some(function(sel){var c=document.querySelector(sel.trim());if(c&&c.getClientRects().length){el=c;return true;}return false;});
    return el&&step.parent?el.closest('section,fieldset,.card')||el.parentElement:el;
  }
  function closeTour(){
    if(!tourState)return;
    markSeen(tourState.tour);
    tourState.root.remove();window.removeEventListener('resize',positionTour);window.removeEventListener('scroll',positionTour,true);document.removeEventListener('keydown',tourKeys,true);
    var back=tourState.returnFocus;tourState=null;if(back&&back.focus)back.focus();
  }
  function tourKeys(e){if(!tourState)return;if(e.key==='Escape'){e.preventDefault();closeTour();}else if(e.key==='ArrowRight')showStep(tourState.index+1);else if(e.key==='ArrowLeft')showStep(tourState.index-1);}
  function positionTour(){
    if(!tourState)return;
    var root=tourState.root,spot=root.querySelector('.studio-tour-spot'),bubble=root.querySelector('.studio-tour-bubble'),el=tourState.el;
    if(!el){spot.hidden=true;root.classList.add('is-centered');bubble.style.cssText='';return;}
    root.classList.remove('is-centered');spot.hidden=false;
    var r=el.getBoundingClientRect(),pad=6,vw=window.innerWidth,vh=window.innerHeight;
    spot.style.cssText='top:'+(r.top-pad)+'px;left:'+(r.left-pad)+'px;width:'+(r.width+pad*2)+'px;height:'+(r.height+pad*2)+'px';
    if(vw<640){bubble.style.cssText='';return;}
    var bw=bubble.offsetWidth,bh=bubble.offsetHeight,top=r.bottom+14;
    if(top+bh>vh-12)top=r.top-bh-14>12?r.top-bh-14:Math.max(12,vh-bh-12);
    var left=Math.min(Math.max(12,r.left),vw-bw-12);
    bubble.style.cssText='top:'+top+'px;left:'+left+'px';
  }
  function showStep(index){
    if(!tourState)return;
    var steps=tourState.steps;if(index<0)return;if(index>=steps.length){closeTour();return;}
    tourState.index=index;var step=steps[index],el=findTarget(step);tourState.el=el;
    var b=tourState.root.querySelector('.studio-tour-bubble');
    b.querySelector('.studio-tour-count').textContent=(index+1)+' / '+steps.length;
    b.querySelector('h2').textContent=step.title;b.querySelector('p').textContent=step.text;
    b.querySelector('[data-tour-prev]').hidden=index===0;
    b.querySelector('[data-tour-next]').textContent=index===steps.length-1?'Terminer':'Suivant →';
    if(el){var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;el.scrollIntoView({block:'center',behavior:reduce?'auto':'smooth'});}
    positionTour();setTimeout(positionTour,350);
    b.querySelector('[data-tour-next]').focus();
  }
  function startTour(id,force){
    var tour=TOURS[id];if(!tour||tourState)return false;
    if(!force&&hasSeen(tour))return false;
    // Seules les étapes dont l'élément est affiché sont gardées ; une étape sans cible reste au centre.
    var steps=tour.steps.filter(function(s){return !s.target||findTarget(s);});
    if(!steps.length)return false;
    var root=document.createElement('div');root.className='studio-tour';
    root.innerHTML='<div class="studio-tour-spot" aria-hidden="true"></div><div class="studio-tour-bubble" role="dialog" aria-modal="true" aria-labelledby="studio-tour-title"><span class="studio-tour-count"></span><h2 id="studio-tour-title"></h2><p></p><div class="studio-tour-actions"><button type="button" class="studio-tour-skip" data-tour-skip>Passer la visite</button><span><button type="button" class="button button-secondary" data-tour-prev>← Précédent</button><button type="button" class="button button-primary" data-tour-next>Suivant →</button></span></div></div>';
    document.body.appendChild(root);
    tourState={tour:tour,steps:steps,index:0,root:root,el:null,returnFocus:document.activeElement};
    root.querySelector('[data-tour-skip]').onclick=closeTour;
    root.querySelector('[data-tour-prev]').onclick=function(){showStep(tourState.index-1);};
    root.querySelector('[data-tour-next]').onclick=function(){showStep(tourState.index+1);};
    window.addEventListener('resize',positionTour);window.addEventListener('scroll',positionTour,true);document.addEventListener('keydown',tourKeys,true);
    showStep(0);return true;
  }
  function isTeamView(){var u=tourUser();return Boolean(u&&u.role==='admin'&&!(window.StudioAPI&&StudioAPI.clientPreview&&StudioAPI.clientPreview()));}
  window.StudioTour={
    // La page déclare sa visite (bouton « Revoir la visite ») et la lance si elle n'a pas encore été vue.
    offer:function(id){
      if(!TOURS[id])return;registeredTour=id;
      document.querySelectorAll('[data-tour-replay]').forEach(function(b){b.hidden=false;});
      if(!isTeamView())setTimeout(function(){startTour(id,false);},400);
    },
    replay:function(){if(registeredTour)startTour(registeredTour,true);}
  };
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-tour-replay]');if(b){e.preventDefault();window.StudioTour.replay();}});
  // Pages dont la visite ne dépend pas du profil : on attend que le premier élément soit affiché (contenus chargés).
  function autoOffer(){
    var page=location.pathname.split('/').pop(),id=PAGE_TOURS[page];if(!id)return;
    var tour=TOURS[id],tries=0;
    (function wait(){
      if(tour.steps.some(function(s){return findTarget(s);})){window.StudioTour.offer(id);return;}
      if(++tries<40)setTimeout(wait,300);
    })();
  }

  // Les libellés statiques portent data-glossary="terme" : le point « i » est ajouté ici.
  function decorate(){
    document.querySelectorAll('[data-glossary]:not([data-glossary-ready])').forEach(function(el){
      el.setAttribute('data-glossary-ready','');
      el.insertAdjacentHTML('beforeend',' '+window.StudioGlossary.dot(el.getAttribute('data-glossary')));
    });
    // data-journey="statut" : étapes de la frise seules, pour les pages statiques.
    document.querySelectorAll('[data-journey]:not([data-journey-ready])').forEach(function(el){
      el.setAttribute('data-journey-ready','');
      el.innerHTML=window.StudioJourney.html(el.getAttribute('data-journey'),null,{stepsOnly:true});
    });
  }
  function init(){decorate();autoOffer();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function(){
  if (!localStorage.getItem('studio_token') && location.pathname.split('/').pop() !== 'login.html') {
    location.href='login.html';
    return;
  }
  var CURRENT = location.pathname.split('/').pop() || 'accueil.html';
  var CURRENT_USER = null;
  try { CURRENT_USER = window.StudioAPI?StudioAPI.user():JSON.parse(localStorage.getItem('studio_user') || 'null'); } catch (e) {}
  var CLIENT_PREVIEW=window.StudioAPI?.clientPreview?.();
  var IS_ADMIN = Boolean(CURRENT_USER && CURRENT_USER.role === 'admin');
  var INTERFACE_MODE = IS_ADMIN && sessionStorage.getItem('studio_interface_mode') !== 'client' ? 'admin' : 'client';
  var ADMIN_PAGES = ['admin.html','client.html'];
  var DUAL_MODE_PAGES = ['notifications.html','calendrier.html','cockpit-dei.html'];
  var REQUESTED_NOTIFICATION_AUDIENCE = new URLSearchParams(location.search).get('audience');
  if (IS_ADMIN && DUAL_MODE_PAGES.includes(CURRENT) && REQUESTED_NOTIFICATION_AUDIENCE === 'client') {
    INTERFACE_MODE = 'client';
    sessionStorage.setItem('studio_interface_mode', 'client');
  }
  if (IS_ADMIN && (ADMIN_PAGES.includes(CURRENT) || DUAL_MODE_PAGES.includes(CURRENT)) && !(DUAL_MODE_PAGES.includes(CURRENT) && REQUESTED_NOTIFICATION_AUDIENCE === 'client')) {
    INTERFACE_MODE = 'admin';
    sessionStorage.setItem('studio_interface_mode', 'admin');
  }

  function setupSharedModal(){
    var dialog = document.createElement('dialog');
    dialog.className = 'studio-modal';
    dialog.setAttribute('aria-labelledby', 'studio-modal-title');
    dialog.setAttribute('aria-describedby', 'studio-modal-message');
    dialog.innerHTML =
      '<div class="studio-modal-shell">' +
        '<button class="studio-modal-close" type="button" aria-label="Fermer la fenêtre" data-modal-close>×</button>' +
        '<div class="studio-modal-icon" data-modal-icon aria-hidden="true"></div>' +
        '<div class="studio-modal-copy">' +
          '<p class="eyebrow" data-modal-eyebrow>Studio Me&amp;YouToo</p>' +
          '<h2 id="studio-modal-title" data-modal-title></h2>' +
          '<p id="studio-modal-message" class="studio-modal-message" data-modal-message></p>' +
          '<div class="studio-modal-field" data-modal-field hidden>' +
            '<label for="studio-modal-input" data-modal-label></label>' +
            '<textarea id="studio-modal-input" rows="7" data-modal-input></textarea>' +
            '<small class="studio-modal-field-error" data-modal-field-error hidden></small>' +
          '</div>' +
        '</div>' +
        '<div class="studio-modal-actions">' +
          '<button class="button button-ghost" type="button" data-modal-cancel>Annuler</button>' +
          '<button class="button button-primary" type="button" data-modal-confirm>Confirmer</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dialog);

    var title = dialog.querySelector('[data-modal-title]');
    var eyebrow = dialog.querySelector('[data-modal-eyebrow]');
    var message = dialog.querySelector('[data-modal-message]');
    var field = dialog.querySelector('[data-modal-field]');
    var label = dialog.querySelector('[data-modal-label]');
    var input = dialog.querySelector('[data-modal-input]');
    var fieldError = dialog.querySelector('[data-modal-field-error]');
    var cancelButton = dialog.querySelector('[data-modal-cancel]');
    var confirmButton = dialog.querySelector('[data-modal-confirm]');
    var closeButton = dialog.querySelector('[data-modal-close]');
    var resolveCurrent = null;
    var currentOptions = null;
    var previouslyFocused = null;

    function finish(confirmed){
      if(!resolveCurrent)return;
      var resolver = resolveCurrent;
      var result = confirmed ? { confirmed:true, value:field.hidden ? null : input.value.trim() } : { confirmed:false, value:null };
      resolveCurrent = null;
      currentOptions = null;
      document.body.classList.remove('studio-modal-open');
      if(dialog.open)dialog.close();
      if(previouslyFocused&&typeof previouslyFocused.focus==='function')previouslyFocused.focus();
      resolver(result);
    }

    function validateAndFinish(){
      if(!field.hidden&&currentOptions&&currentOptions.required&&input.value.trim()===''){
        fieldError.textContent=currentOptions.requiredMessage||'Ce champ doit être renseigné.';
        fieldError.hidden=false;
        input.setAttribute('aria-invalid','true');
        input.focus();
        return;
      }
      finish(true);
    }

    cancelButton.addEventListener('click',function(){finish(false);});
    closeButton.addEventListener('click',function(){finish(false);});
    confirmButton.addEventListener('click',validateAndFinish);
    input.addEventListener('input',function(){fieldError.hidden=true;input.removeAttribute('aria-invalid');});
    dialog.addEventListener('cancel',function(event){event.preventDefault();finish(false);});
    dialog.addEventListener('click',function(event){if(event.target===dialog)finish(false);});

    function open(options){
      options=options||{};
      if(resolveCurrent)finish(false);
      previouslyFocused=document.activeElement;
      currentOptions=options;
      dialog.dataset.type=options.type||'info';
      eyebrow.textContent=options.eyebrow||'Studio Me&YouToo';
      title.textContent=options.title||'Information';
      message.textContent=options.message||'';
      message.hidden=!options.message;
      cancelButton.textContent=options.cancelLabel||'Annuler';
      cancelButton.hidden=options.showCancel===false;
      confirmButton.textContent=options.confirmLabel||'Confirmer';
      confirmButton.className='button '+((options.type==='danger'||options.type==='error')?'studio-modal-danger':'button-primary');
      field.hidden=!options.input;
      fieldError.hidden=true;
      input.removeAttribute('aria-invalid');
      if(options.input){
        label.textContent=options.inputLabel||'Votre texte';
        input.value=options.value||'';
        input.placeholder=options.placeholder||'';
      }
      document.body.classList.add('studio-modal-open');
      dialog.showModal();
      setTimeout(function(){(options.input?input:confirmButton).focus();},0);
      return new Promise(function(resolve){resolveCurrent=resolve;});
    }

    window.StudioModal={
      open:open,
      alert:async function(options){
        if(typeof options==='string')options={message:options};
        var result=await open({...options,showCancel:false,confirmLabel:options.confirmLabel||'Fermer'});
        return result.confirmed;
      },
      confirm:async function(options){
        if(typeof options==='string')options={message:options};
        var result=await open({...options,showCancel:true});
        return result.confirmed;
      },
      prompt:async function(options){
        var result=await open({...options,showCancel:true,input:true});
        return result.confirmed?result.value:null;
      }
    };
  }

  setupSharedModal();

  function setupInfoModals(){
    var selector='.admin-info-dot[data-info],.admin-info-dot[title],.field-help-button';
    function prepare(control){
      var help=control.matches('.field-help-button')?control.closest('.field-help'):null;
      var content=help&&help.querySelector('.field-help-content');
      var message=String(control.getAttribute('data-info')||control.getAttribute('title')||(content&&content.textContent)||'').trim();
      if(!message)return;
      control.setAttribute('data-info',message);
      control.removeAttribute('title');
      control.classList.add('studio-info-modal-trigger');
      if(help)help.classList.add('studio-info-modal-help');
      if(control.tagName!=='BUTTON'){
        control.setAttribute('role','button');
        control.setAttribute('tabindex','0');
      }
      control.setAttribute('aria-haspopup','dialog');
      if(!control.getAttribute('aria-label'))control.setAttribute('aria-label','Afficher les informations');
    }
    function prepareTree(root){
      if(root.matches&&root.matches(selector))prepare(root);
      if(root.querySelectorAll)root.querySelectorAll(selector).forEach(prepare);
    }
    function activate(event){
      var control=event.target.closest&&event.target.closest(selector);
      if(!control)return;
      // Native buttons already produce a click on Enter/Space.
      if(event.type==='keydown'&&(control.tagName==='BUTTON'||!['Enter',' '].includes(event.key)||event.repeat))return;
      prepare(control);
      var message=control.getAttribute('data-info');
      if(!message)return;
      event.preventDefault();event.stopPropagation();
      window.StudioModal.alert({title:control.getAttribute('data-info-title')||'Information',message:message,type:'info',confirmLabel:'Fermer'});
    }
    prepareTree(document);
    document.addEventListener('click',activate,true);
    document.addEventListener('keydown',activate,true);
    // Catalogue cards and project dialogs are rendered after app.js has loaded.
    var observer=new MutationObserver(function(records){
      records.forEach(function(record){
        if(record.type==='attributes'){
          var control=record.target;
          if(control.matches(selector)&&(!control.classList.contains('studio-info-modal-trigger')||control.hasAttribute('title')))prepare(control);
        }else record.addedNodes.forEach(prepareTree);
      });
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['title','data-info']});
  }
  setupInfoModals();

  var NAV_MAIN = [
    { href: 'accueil.html', label: 'Accueil', icon: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/>' },
    { href: 'mes-campagnes.html', label: 'Mes campagnes', icon: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>' },
    { href: 'calendrier.html?audience=client', label: 'Calendrier', permission:'view_calendar', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>' },
    { href: 'bibliotheque.html', label: 'Catalogue', icon: '<path d="M5 5h6v14H5zM13 5h6v14h-6z"/><path d="M8 8v8M16 8v8"/>' },
    { href: 'notifications.html?audience=client', label: 'Notifications', notificationBadge: true, icon: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>' },
    { href: 'cockpit-dei.html?audience=client', label: 'Cockpit DEI', permission:'view_dei_cockpit', icon: '<path d="M4 19v-6M10 19V9M16 19V5M22 19H2"/><path d="m4 9 5-3 5 2 6-5"/>' },
    { href: 'ressources.html', label: 'Ressources', icon: '<path d="M6 4h9l3 3v13H6z"/><path d="M14 4v4h4M9 13h6M9 17h4"/>' }
  ];

  var NAV_ADMIN = [
    { href: 'admin.html', label: 'Cockpit clients', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4M7 16h7"/>' },
    { href: 'calendrier.html', label: 'Calendrier', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>' },
    { href: 'admin.html?tab=clients&filter=pack', label: 'Demandes de passations', icon: '<path d="M3 7h18v12H3z"/><path d="M6 7V5h12v2"/>' },
    { href: 'admin.html?tab=accounts', label: 'Comptes & accès', icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-7 6-7"/><path d="M16 11v6M13 14h6"/>' },
    { href: 'admin.html?tab=library', label: 'Catalogue', icon: '<path d="M5 5h6v14H5zM13 5h6v14h-6z"/><path d="M8 8v8M16 8v8"/>' },
    { href: 'admin.html?tab=media', label: 'Médiathèque', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>' },
    { href: 'notifications.html', label: 'Notifications', icon: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>' }
  ];

  var NAV_SECONDARY = [
    { href: 'packs.html', label: 'Commander des passations', permission:'order_passations', icon: '<path d="M3 7h18v12H3z"/><path d="M16 12h5"/><path d="M6 7V5h12v2"/>' },
    { href: 'account.html', label: 'Mon compte', icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>' }
  ];

  var NAV_BOTTOM = [
    { href: 'accueil.html', label: 'Accueil' },
    { href: 'mes-campagnes.html', label: 'Campagnes' },
    { href: 'bibliotheque.html', label: 'Catalogue' },
    { href: 'packs.html', label: 'Passations' }
  ];

  function svg(icon){
    return '<svg aria-hidden="true" viewBox="0 0 24 24">' + icon + '</svg>';
  }

  function navLink(item, withIcon){
    var href=item.href||'',path=href.split('?')[0].split('#')[0],isCurrent=false;
    if(path===CURRENT&&!item.action){
      var itemQuery=href.indexOf('?')>=0?new URLSearchParams(href.split('?')[1].split('#')[0]):null;
      var currentQuery=new URLSearchParams(location.search);
      if(itemQuery&&[...itemQuery.keys()].length){
        isCurrent=[...itemQuery.entries()].every(function(pair){return currentQuery.get(pair[0])===pair[1];});
      }else if(CURRENT==='admin.html'){
        isCurrent=!currentQuery.get('tab');
      }else{
        isCurrent=true;
      }
    }
    var current = isCurrent ? ' aria-current="page"' : '';
    var iconHtml = withIcon ? '<span>' + svg(item.icon) + '</span>' : '';
    var labelAttrs = withIcon ? ' aria-label="' + item.label + '" title="' + item.label + '"' : '';
    var actionAttr=item.action?' data-nav-action="'+item.action+'"':'';
    var allowed=!item.permission||IS_ADMIN||Boolean(CURRENT_USER&&CURRENT_USER.permissions&&CURRENT_USER.permissions[item.permission]);
    var locked=allowed?'':' aria-disabled="true" data-nav-locked title="Accès non autorisé"';
    var notificationBadge=item.notificationBadge?'<b class="nav-notification-count" data-nav-notification-count hidden>0</b>':'';
    return '<a href="' + item.href + '" data-nav'+actionAttr+ current + labelAttrs + locked + '>' + iconHtml + (allowed?'':'<b class="nav-lock" aria-hidden="true">🔒</b>') + item.label + notificationBadge + '</a>';
  }

  function enforcePageAccess(){
    if(IS_ADMIN)return;
    var required={
      'packs.html':'order_passations',
      'commande.html':'order_passations',
      'kit-communication.html':'manage_kit',
      'calendrier.html':'view_calendar',
      'cockpit-dei.html':'view_dei_cockpit'
    }[CURRENT];
    if(!required||CURRENT_USER&&CURRENT_USER.permissions&&CURRENT_USER.permissions[required])return;
    var main=document.querySelector('main.main');
    if(main)main.innerHTML='<section class="card permission-denied"><div class="permission-denied-icon">🔒</div><p class="eyebrow">Accès limité</p><h1>Cette fonctionnalité ne vous est pas autorisée</h1><p>Le responsable de votre compte peut modifier vos droits d’accès.</p><a class="button button-secondary" href="accueil.html">Retour à l’accueil</a></section>';
  }

  function enforceActionAccess(){
    if(IS_ADMIN||CURRENT_USER&&CURRENT_USER.permissions&&CURRENT_USER.permissions.edit_campaigns)return;
    document.querySelectorAll('[data-content-adjustment]').forEach(function(control){
      control.removeAttribute('data-content-adjustment');control.classList.add('button-locked');control.setAttribute('aria-disabled','true');control.innerHTML='🔒 Demander un ajustement';control.addEventListener('click',function(event){event.preventDefault();StudioModal.alert({eyebrow:'Accès limité',title:'Demande d’ajustement verrouillée',message:'Le responsable de votre compte peut vous accorder le droit de modifier les campagnes et de demander des ajustements.',type:'warning'});});
    });
  }

  function renderSidebar(){
    var root = document.getElementById('sidebar-root');
    if (!root) return;

    var adminInterface = IS_ADMIN && INTERFACE_MODE === 'admin';
    var mainNavigation = adminInterface ? NAV_ADMIN : NAV_MAIN.concat(NAV_SECONDARY);
    var roleLabel = adminInterface ? 'Administratrice' : 'Espace client';
    var avatarHtml=(CURRENT_USER&&CURRENT_USER.profileImageData)?'<img src="'+CURRENT_USER.profileImageData+'" alt="">':((CURRENT_USER && (CURRENT_USER.firstName || CURRENT_USER.email)) ? String(CURRENT_USER.firstName || CURRENT_USER.email).charAt(0).toUpperCase() : 'C');
    var rawCompanyLogo=(!adminInterface&&CURRENT_USER)?(CURRENT_USER.organizationLogoUrl||CURRENT_USER.organizationLogoData||''):'';var companyLogoSrc=rawCompanyLogo&&rawCompanyLogo.charAt(0)==='/'&&window.StudioAPI?window.StudioAPI.base()+rawCompanyLogo:rawCompanyLogo;var clientLogoHtml=companyLogoSrc?'<div class="profile-company-logo"><img src="'+companyLogoSrc+'" alt="Logo '+String(CURRENT_USER.organizationName||'entreprise').replace(/["<>]/g,'')+'"></div>':'';
    var switchButton = IS_ADMIN ? '<button class="interface-switch" type="button" data-interface-switch="' + (adminInterface ? 'client' : 'admin') + '">' + (adminInterface ? 'Voir mon espace client' : 'Revenir à l’administration') + '</button>' : '';
    root.classList.toggle('sidebar-admin', adminInterface);
    root.innerHTML =
      '<div class="sidebar-head">' +
        '<div class="brand"><img class="studio-brand-logo" src="assets/img/brand/logo-studio-blue.png" alt="Le Studio Me&YouToo"></div>' +
        '<button class="sidebar-collapse" type="button" data-sidebar-collapse aria-label="Réduire le menu" aria-expanded="true" title="Réduire le menu">' +
          '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="sidebar-interface-row">' +
        '<div class="interface-badge ' + (adminInterface ? 'interface-badge-admin' : 'interface-badge-client') + '">' + roleLabel + '</div>' +
        '<div id="notification-root" class="sidebar-notification-root" aria-label="Notifications"></div>' +
      '</div>' +
      '<nav class="nav">' + mainNavigation.map(function(i){ return navLink(i, true); }).join('') + '</nav>' +
      '<div class="sidebar-footer">' +
        (adminInterface ? '<div class="admin-help-card"><strong>Espace d’administration</strong><p>Gérez les clients, leurs accès, leurs crédits et leurs demandes de packs.</p></div>' : '<div class="help-card"><strong>Besoin d’aide&nbsp;?</strong><p>Une question sur votre campagne, vos contenus ou le fonctionnement du Studio&nbsp;?</p><button type="button" class="help-tour-button" data-tour-replay hidden>Revoir la visite de cette page</button><a class="button button-primary" href="contact-client.html">Contacter Me&YouToo</a></div>') +
        switchButton +
        '<div class="profile"><div class="profile-person"><div class="avatar">' + avatarHtml + '</div><strong class="profile-person-name">' + (CURRENT_USER ? ((CURRENT_USER.firstName || '') + ' ' + (CURRENT_USER.lastName || '')).trim() || CURRENT_USER.email : 'Compte') + '</strong></div><div class="profile-copy">' + clientLogoHtml + '<small>' + roleLabel + ' · ' + (CURRENT_USER ? (CURRENT_USER.organizationName || 'Me&YouToo') : '') + '</small><button class="sidebar-logout" type="button" data-logout>Se déconnecter</button></div></div>' +
      '</div>';
  }

  function renderBottomNav(){
    var root = document.getElementById('bottom-nav-root');
    if (!root) return;
    root.innerHTML = NAV_BOTTOM.map(function(i){ return navLink(i, false); }).join('');
  }

  function setupMobileToggle(){
    var toggle = document.querySelector('[data-menu-toggle]');
    if (!toggle) return;
    toggle.addEventListener('click', function(){
      var open = document.body.classList.toggle('sidebar-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function(evt){
      if (!document.body.classList.contains('sidebar-open')) return;
      var sidebar = document.querySelector('.sidebar');
      if (sidebar && !sidebar.contains(evt.target) && evt.target !== toggle && !toggle.contains(evt.target)) {
        document.body.classList.remove('sidebar-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function setupSidebarCollapse(){
    var button = document.querySelector('[data-sidebar-collapse]');
    if (!button) return;

    var storageKey = 'studioSidebarCollapsed';
    var media = window.matchMedia('(max-width: 820px)');

    function apply(collapsed){
      if (media.matches) {
        document.body.classList.remove('sidebar-collapsed');
        button.setAttribute('aria-expanded', 'true');
        button.setAttribute('aria-label', 'Réduire le menu');
        button.setAttribute('title', 'Réduire le menu');
        return;
      }
      document.body.classList.toggle('sidebar-collapsed', collapsed);
      button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      button.setAttribute('aria-label', collapsed ? 'Déployer le menu' : 'Réduire le menu');
      button.setAttribute('title', collapsed ? 'Déployer le menu' : 'Réduire le menu');
    }

    var collapsed = false;
    try {
      collapsed = localStorage.getItem(storageKey) === '1';
    } catch (e) {}
    apply(collapsed);

    button.addEventListener('click', function(){
      var next = !document.body.classList.contains('sidebar-collapsed');
      apply(next);
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch (e) {}
    });

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', function(){ apply(document.body.classList.contains('sidebar-collapsed')); });
    }
  }

  /* Menus « Autres actions » : <details>/<summary> natif (campagne-detail.html,
     cartes de mes-campagnes.html…). Un seul menu ouvert à la fois : on ferme les
     autres <details class="action-more"> quand l'un d'eux s'ouvre. */
  function setupActionMenus(){
    var menus = document.querySelectorAll('details.action-more');
    if (!menus.length) return;
    menus.forEach(function(menu){
      menu.addEventListener('toggle', function(){
        if (!menu.open) return;
        menus.forEach(function(other){
          if (other !== menu) other.open = false;
        });
      });
    });
    document.addEventListener('click', function(evt){
      menus.forEach(function(menu){
        if (menu.open && !menu.contains(evt.target)) menu.open = false;
      });
    });
  }

  function setupNotifications(attempt){
    attempt=attempt||0;
    if(document.querySelector('.studio-notifications'))return;
    if(!window.StudioAPI||!StudioAPI.token()){
      if(attempt<20)setTimeout(function(){setupNotifications(attempt+1);},100);
      return;
    }
    var root=document.getElementById('notification-root');
    if(!root)return;
    var shell=document.createElement('div');shell.className='studio-notifications '+(root.classList.contains('sidebar-notification-root')?'notification-placement-sidebar':'notification-placement-admin');shell.innerHTML='<button class="notification-bell" type="button" aria-label="Ouvrir les notifications" aria-haspopup="dialog" aria-expanded="false"><svg class="notification-bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="notification-count" hidden>0</span></button><section class="notification-panel" role="dialog" aria-label="Centre de notifications" hidden><header><div><strong>Notifications</strong><span data-notification-subtitle>Aucune nouveauté</span></div><div class="notification-head-actions"><a class="notification-center-link" href="notifications.html">Voir toutes</a><button type="button" class="notification-read-all">Tout marquer comme lu</button></div></header><div class="notification-list"><p class="notification-empty">Chargement…</p></div></section>';root.appendChild(shell);
    var bell=shell.querySelector('.notification-bell'),count=shell.querySelector('.notification-count'),panel=shell.querySelector('.notification-panel'),list=shell.querySelector('.notification-list'),subtitle=shell.querySelector('[data-notification-subtitle]');
    var escape=function(value){return String(value||'').replace(/[&<>"']/g,function(char){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});};
    var date=function(value){if(!value)return'';var parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Date indisponible':parsed.toLocaleString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
    var notificationAudience=IS_ADMIN?(INTERFACE_MODE==='client'?'client':'admin'):'client';
    shell.querySelector('.notification-center-link').href='notifications.html?audience='+encodeURIComponent(notificationAudience);
    function notificationUrl(item){var url=String(item.action_url||''),meta=item.metadata||{},type=String(item.type||'').toLowerCase(),title=String(item.title||'').toLowerCase();var projectId=meta.projectId||meta.project_id||'';if((type.includes('submission')||title.includes('configuration'))&&projectId)return 'validation.html?projectId='+encodeURIComponent(projectId);if((type.includes('communication')||type.includes('kit'))&&projectId){var tab=meta.tab?('&tab='+encodeURIComponent(meta.tab)):'';return 'kit-communication.html?projectId='+encodeURIComponent(projectId)+tab;}if(type.includes('pack'))return 'admin.html?tab=clients&filter=pack';if(IS_ADMIN&&INTERFACE_MODE==='admin'&&/^admin\.html\?projectId=/i.test(url))url=url.replace(/^admin\.html/i,'client.html');return url;}
    async function load(){try{var data=await StudioAPI.request('/api/notifications?audience='+notificationAudience);var unread=Number(data.unread)||0;var unreadLabel=unread>99?'99+':unread;count.textContent=unreadLabel;count.hidden=!unread;document.querySelectorAll('[data-nav-notification-count]').forEach(function(badge){badge.textContent=unreadLabel;badge.hidden=!unread;});shell.classList.toggle('has-unread',Boolean(unread));subtitle.textContent=unread?(unread+' non lue'+(unread>1?'s':'')):'Tout est à jour';list.innerHTML=(data.notifications||[]).map(function(item){var read=Boolean(item.read_at);return'<article class="notification-item '+(read?'treated':'unread')+'" data-notification-id="'+item.id+'" data-notification-url="'+escape(notificationUrl(item))+'" data-notification-read="'+(read?'1':'0')+'"><span class="notification-item-icon">'+(String(item.type).includes('approved')?'✅':String(item.type).includes('rejected')?'⚠️':'🎟️')+'</span><button type="button" class="notification-item-main"><strong>'+escape(String(item.title||'').replace(/à vérifier/gi,'à publier'))+'</strong><small>'+escape(String(item.message||'').replace(/à vérifier/gi,'à publier'))+'</small><time>'+escape(date(item.created_at))+'</time></button><button type="button" class="notification-item-delete" aria-label="Supprimer cette notification" title="Supprimer cette notification">🗑</button><button type="button" class="notification-item-check" aria-label="'+(read?'Marquer comme non lue':'Marquer comme lue')+'" title="'+(read?'Marquer comme non lue':'Marquer comme lue')+'">'+(read?'✓':'')+'</button></article>';}).join('')||'<p class="notification-empty">Aucune notification pour le moment.</p>';bindItems();}catch(error){list.innerHTML='<p class="notification-empty">Notifications indisponibles.</p>';}}
    function navigate(item){var url=item.dataset.notificationUrl;if(url)location.href=url;}
    function toggle(item){var isRead=item.dataset.notificationRead==='1',path='/api/notifications/'+item.dataset.notificationId+(isRead?'/unread':'/read')+'?audience='+notificationAudience;return StudioAPI.request(path,{method:'PATCH',body:'{}'}).catch(function(){}).then(load);}
    function bindItems(){list.querySelectorAll('[data-notification-id]').forEach(function(item){item.querySelector('.notification-item-main').onclick=function(){navigate(item);};item.querySelector('.notification-item-check').onclick=function(){toggle(item);};item.querySelector('.notification-item-delete').onclick=function(event){event.stopPropagation();dismiss(item);};});} function dismiss(item){/* Suppression personnelle : les collègues gardent la notification. */item.classList.add('is-removing');return StudioAPI.request('/api/notifications/'+encodeURIComponent(item.dataset.notificationId)+'?audience='+notificationAudience,{method:'DELETE'}).catch(function(){item.classList.remove('is-removing');}).then(load);}
    bell.onclick=function(){panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',panel.hidden?'false':'true');document.body.classList.toggle('notification-panel-open',!panel.hidden);if(!panel.hidden)load();};
    shell.querySelector('.notification-read-all').onclick=async function(){try{await StudioAPI.request('/api/notifications/read-all?audience='+notificationAudience,{method:'PATCH',body:'{}'});load();}catch(error){}};
    document.addEventListener('click',function(event){if(!panel.hidden&&!shell.contains(event.target)){panel.hidden=true;bell.setAttribute('aria-expanded','false');document.body.classList.remove('notification-panel-open');}});
    document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!panel.hidden){panel.hidden=true;bell.setAttribute('aria-expanded','false');document.body.classList.remove('notification-panel-open');bell.focus();}});
    window.addEventListener('studio:pack-requested',load);
    window.addEventListener('focus',load);
    window.addEventListener('pageshow',load);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)load();});
    load();setInterval(load,30000);
  }

  function trackProductActivity(){
    if(CLIENT_PREVIEW||!window.StudioAPI||!StudioAPI.token())return;
    var params=new URLSearchParams(location.search),projectId=params.get('projectId')||params.get('id')||localStorage.getItem('studio_current_project_id')||null;
    StudioAPI.request('/api/me/activity',{method:'POST',body:JSON.stringify({page:CURRENT,eventType:'page_view',projectId:/^\d+$/.test(String(projectId||''))?Number(projectId):null})}).catch(function(){});
  }


  function studioSubscriptionCached(){
    try{return JSON.parse((CLIENT_PREVIEW?sessionStorage:localStorage).getItem(CLIENT_PREVIEW?'studio_preview_subscription':'studio_subscription')||'null');}catch(e){return null;}
  }
  function showSubscriptionRequired(){
    return StudioModal.alert({eyebrow:'Abonnement Studio',title:'Abonnement Studio requis',message:'Votre abonnement Studio est arrivé à échéance. Vous pouvez continuer à consulter vos campagnes et vos passations, mais la création et la modification de campagnes nécessitent un abonnement actif.',type:'warning',confirmLabel:'Fermer'});
  }
  function disableForExpiredSubscription(subscription){
    if(IS_ADMIN||!subscription||subscription.accessActive!==false)return;
    document.body.classList.add('studio-subscription-readonly');
    if(!document.querySelector('.studio-subscription-banner')){
      var main=document.querySelector('main.main')||document.querySelector('main');
      if(main){
        var banner=document.createElement('section');
        banner.className='studio-subscription-banner';
        banner.innerHTML='<div><strong>Votre abonnement Studio est arrivé à échéance.</strong><p>Vous conservez l’accès à vos campagnes existantes et vos passations non utilisées restent valables jusqu’à la date d’expiration de votre pack. Pour créer ou modifier une campagne, réactivez votre abonnement Studio.</p></div><a class="button button-primary" href="paiement-studio.html">Réactiver mon abonnement</a>';
        main.insertBefore(banner,main.firstChild);
      }
    }
    document.querySelectorAll('[data-start-theme]').forEach(function(el){el.setAttribute('aria-disabled','true');el.classList.add('subscription-disabled');el.title='Abonnement Studio requis';});
    if(CURRENT==='mes-campagnes.html')document.querySelectorAll('a[href="bibliotheque.html"]').forEach(function(el){if(el.textContent.includes('Nouvelle campagne')){el.setAttribute('aria-disabled','true');el.classList.add('subscription-disabled');el.title='Abonnement Studio requis';}});
    var selectors=[];
    if(CURRENT==='composer.html')selectors=['[data-situation-input]','[data-answer-input]','[data-replace]','[data-remove]','[data-reset]','[data-add]','[data-library]'];
    if(CURRENT==='personnalisation.html')selectors=['textarea','input','select','button:not([data-menu-toggle]):not(.composer-toggle):not(.field-help-button)'];
    if(CURRENT==='parametrage.html')selectors=['form input','form textarea','form select','#param-next','#add-socio','#add-result-resource','[data-example]'];
    if(CURRENT==='validation.html')selectors=['#save-validation-settings','#submit-project','[data-validation-check]'];
    function applyReadonlyControls(){
      document.querySelectorAll('[data-start-theme]').forEach(function(el){el.setAttribute('aria-disabled','true');el.classList.add('subscription-disabled');el.title='Abonnement Studio requis';});
      if(CURRENT==='mes-campagnes.html')document.querySelectorAll('a[href="bibliotheque.html"]').forEach(function(el){if(el.textContent.includes('Nouvelle campagne')){el.setAttribute('aria-disabled','true');el.classList.add('subscription-disabled');el.title='Abonnement Studio requis';}});
      selectors.forEach(function(sel){document.querySelectorAll(sel).forEach(function(el){el.disabled=true;el.setAttribute('aria-disabled','true');el.title='Abonnement Studio requis';});});
    }
    applyReadonlyControls();
    if(!window.__studioSubscriptionObserver){
      window.__studioSubscriptionObserver=new MutationObserver(function(){applyReadonlyControls();});
      window.__studioSubscriptionObserver.observe(document.body,{childList:true,subtree:true});
      document.addEventListener('click',function(event){var locked=event.target.closest('.subscription-disabled');if(!locked)return;event.preventDefault();showSubscriptionRequired();},true);
    }
  }
  async function setupStudioSubscriptionAccess(){
    if(IS_ADMIN)return;
    var cached=studioSubscriptionCached();
    if(cached)disableForExpiredSubscription(cached);
    if(!window.StudioAPI||!StudioAPI.token())return;
    try{
      var data=await StudioAPI.request('/api/me');
      if(data&&data.studioSubscription){
        (CLIENT_PREVIEW?sessionStorage:localStorage).setItem(CLIENT_PREVIEW?'studio_preview_subscription':'studio_subscription',JSON.stringify(data.studioSubscription));
        disableForExpiredSubscription(data.studioSubscription);
      }
    }catch(e){}
  }

  if(CLIENT_PREVIEW){
    document.body.classList.add('studio-client-preview');
    var banner=document.createElement('div');banner.className='studio-client-preview-banner';banner.setAttribute('role','region');banner.setAttribute('aria-label','Vue client en consultation');
    banner.style.cssText='position:sticky;top:0;z-index:10050;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 20px;background:#124b61;color:white;font:600 15px Asap,Arial,sans-serif;box-shadow:0 2px 8px #0002';
    var text=document.createElement('span');text.style.flex='1';text.textContent='Vous consultez l’espace de '+(CLIENT_PREVIEW.user.organizationName||'ce client')+' — Vue client · Consultation seule';
    var account=document.createElement('small');account.textContent=CLIENT_PREVIEW.previewMode==='standard'?'Droits standards du responsable client · Aucun compte associé':'Accès : '+(CLIENT_PREVIEW.user.email||'');
    var back=document.createElement('button');back.type='button';back.className='button button-secondary';back.textContent='Retour au dossier admin';back.onclick=function(){StudioAPI.endClientPreview();};
    banner.append(text,account,back);document.body.prepend(banner);
    var previewStyle=document.createElement('style');previewStyle.textContent='body.studio-client-preview .sidebar{top:calc(var(--client-preview-height,64px) + 16px);height:calc(100dvh - var(--client-preview-height,64px) - 32px)}';document.head.append(previewStyle);
    var sizeBanner=function(){document.documentElement.style.setProperty('--client-preview-height',banner.offsetHeight+'px');};
    sizeBanner();if(window.ResizeObserver)new ResizeObserver(sizeBanner).observe(banner);
    var lockPreviewFields=function(){
      document.querySelectorAll('[data-situation-input],[data-answer-input],[data-profile-title],[data-profile-summary],[data-profile-content],[data-tree-label],[data-tree-q],#intro,#campaign-name,#respondent-title,#launch-date,#close-date,#nb-respondents,#diffusion-slug').forEach(function(input){if(!input.readOnly){input.readOnly=true;input.setAttribute('aria-readonly','true');input.title='Vue client en consultation seule';}});
    };
    var previewWriteSelector=[
      '[data-project-action]:not([data-project-action="view-legacy-pdf"])',
      '[data-folder-create]','[data-folder-manage]','[data-content-adjustment]',
      '[data-library-pick]','[data-replace]','[data-remove]','[data-reset]',
      '[data-result-edit]','[data-result-remove]','[data-example]',
      '[data-socio-remove]','[data-tree-child-add]','[data-tree-criterion-remove]',
      '[data-tree-criterion-remove-variant]','[data-tree-option-add]','[data-tree-option-remove]',
      '[data-team-edit]','[data-team-toggle]','[data-team-permission]',
      '[data-remove-project-video]','[data-validation-check]',
      '#confirm-extension','#submit-project','#save-validation-settings',
      '#add-socio','#add-socio-top','#add-result-resource','#video-save','#video-clear',
      '#kit-delete-confirm',
      'a.button-primary[href="bibliotheque.html"]'
    ].join(',');
    var isPreviewWriteLink=function(link){
      try{var url=new URL(link.href,location.href);return /\/mes-campagnes\.html$/.test(url.pathname)&&url.searchParams.has('action')&&url.searchParams.get('action')!=='view-legacy-pdf';}catch(e){return false;}
    };
    var disablePreviewControl=function(control){
      if(control.hasAttribute('data-preview-write-blocked'))return;
      control.setAttribute('data-preview-write-blocked','true');control.setAttribute('aria-disabled','true');
      if('disabled' in control)control.disabled=true;
      control.title='Consultation seule : revenez au dossier admin pour effectuer cette action.';
      control.style.opacity='.5';control.style.cursor='not-allowed';
    };
    var lockPreviewActions=function(){
      lockPreviewFields();
      document.querySelectorAll(previewWriteSelector).forEach(disablePreviewControl);
      document.querySelectorAll('a[href]').forEach(function(link){if(isPreviewWriteLink(link))disablePreviewControl(link);});
    };
    document.addEventListener('click',function(event){
      var control=event.target.closest?.('[data-preview-write-blocked],'+previewWriteSelector);
      if(!control){var link=event.target.closest?.('a[href]');if(link&&isPreviewWriteLink(link))control=link;}
      if(control){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    document.addEventListener('submit',function(event){
      var method=String(event.target.getAttribute('method')||'').toLowerCase();
      if(method==='dialog'||method==='get')return;
      event.preventDefault();event.stopImmediatePropagation();
      StudioModal.alert({title:'Consultation seule',message:'Revenez au dossier admin pour enregistrer des modifications.',type:'info'});
    },true);
    lockPreviewActions();new MutationObserver(lockPreviewActions).observe(document.body,{childList:true,subtree:true});
  }
  function setupScrollNavigation(){
    if(document.getElementById('studio-back-to-top'))return;
    var button=document.createElement('button');
    button.id='studio-back-to-top';button.className='studio-back-to-top';button.type='button';button.hidden=true;
    button.setAttribute('aria-label','Revenir en haut de page');
    button.innerHTML='<span aria-hidden="true">↑</span><span>Haut de page</span>';
    document.body.appendChild(button);
    var scrollTarget=null,frame=0;
    var overlaySelector='dialog[open],[role="dialog"][aria-modal="true"],.composer-drawer.is-open';
    function behavior(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';}
    function visibleOverlay(){
      var overlays=Array.from(document.querySelectorAll(overlaySelector));
      return overlays.reverse().find(function(node){return node.getClientRects().length>0;})||null;
    }
    function scrollable(node){
      return node.scrollHeight>node.clientHeight+1&&/auto|scroll/.test(getComputedStyle(node).overflowY);
    }
    function currentTarget(overlay){
      if(!overlay)return document.scrollingElement||document.documentElement;
      if(scrollTarget&&scrollTarget.isConnected&&overlay.contains(scrollTarget)&&scrollable(scrollTarget))return scrollTarget;
      if(scrollable(overlay))return overlay;
      return Array.from(overlay.querySelectorAll('*')).find(function(node){return !node.matches('textarea,select,[contenteditable]')&&scrollable(node);})||overlay;
    }
    function focusAndReveal(node){
      if(!node)return;
      node.scrollIntoView({behavior:behavior(),block:'start'});
      var control=node.matches('summary,button,[tabindex]')?node:node.querySelector('summary,button,[tabindex]');
      if(control)control.focus({preventScroll:true});
    }
    function addFooter(container,kind,label){
      if(Array.from(container.children).some(function(child){return child.classList.contains('studio-collapse-footer');}))return;
      var footer=document.createElement('div');footer.className='studio-collapse-footer';
      var close=document.createElement('button');close.type='button';close.className='button button-secondary button-small';
      close.dataset.scrollCollapse=kind;close.textContent='↑ '+label;
      footer.appendChild(close);container.appendChild(footer);
    }
    function decorate(){
      document.querySelectorAll('details.topic-card-accordion > .topic-expanded').forEach(function(node){addFooter(node,'details','Replier cette fiche');});
      document.querySelectorAll('details.admin-library-situation-row').forEach(function(node){addFooter(node,'details','Replier cette situation');});
      document.querySelectorAll('.composer-situation-body').forEach(function(node){addFooter(node,'composer','Replier cette situation');});
      document.querySelectorAll('.admin-library-chapter-body').forEach(function(node){addFooter(node,'chapter','Replier ce chapitre');});
    }
    function update(){
      frame=0;decorate();
      var overlay=visibleOverlay(),parent=overlay||document.body;
      // Un bouton placé dans le dialogue reste accessible dans la couche modale native.
      if(button.parentNode!==parent)parent.appendChild(button);
      var target=currentTarget(overlay),offset=target.scrollTop||0;
      var hidden=offset<Math.min(400,Math.max(200,target.clientHeight/2));
      if(button.hidden!==hidden)button.hidden=hidden;
      // Keep the shortcut above visible action bars, including Composer/Profils.
      // Reset first to restore the responsive CSS position away from the bars.
      button.style.bottom='';
      if(!overlay&&!hidden){
        var actions=Array.from(document.querySelectorAll('.creation-sticky-actions'));
        var parameterActions=document.getElementById('param-next')?.closest('.top-actions');
        if(parameterActions)actions.push(parameterActions);
        var shortcut=button.getBoundingClientRect();
        var bottom=parseFloat(getComputedStyle(button).bottom)||0;
        actions.forEach(function(actionBar){
          var bar=actionBar.getBoundingClientRect();
          if(bar.width>0&&bar.height>0&&shortcut.left<bar.right&&shortcut.right>bar.left&&shortcut.top<bar.bottom&&shortcut.bottom>bar.top){
            bottom=Math.max(bottom,window.innerHeight-bar.top+12);
          }
        });
        if(bottom>(parseFloat(getComputedStyle(button).bottom)||0))button.style.bottom=bottom+'px';
      }
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(update);}
    document.addEventListener('scroll',function(event){
      var target=event.target;
      if(target instanceof Element&&!target.matches('textarea,select,[contenteditable]')&&target.closest(overlaySelector))scrollTarget=target;
      schedule();
    },true);
    window.addEventListener('resize',schedule,{passive:true});
    document.addEventListener('toggle',schedule,true);document.addEventListener('close',schedule,true);
    button.addEventListener('click',function(){
      var overlay=visibleOverlay(),target=currentTarget(overlay);
      if(overlay){
        target.scrollTo({top:0,behavior:behavior()});
        var heading=overlay.querySelector('h1,h2');
        if(heading){if(!heading.hasAttribute('tabindex'))heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
      }
      else{
        window.scrollTo({top:0,behavior:behavior()});
        var main=document.querySelector('main');
        if(main){if(!main.hasAttribute('tabindex'))main.setAttribute('tabindex','-1');main.focus({preventScroll:true});}
      }
    });
    document.addEventListener('click',function(event){
      var close=event.target.closest?.('[data-scroll-collapse]');if(!close)return;
      event.preventDefault();
      if(close.dataset.scrollCollapse==='details'){
        var details=close.closest('details');if(!details)return;
        details.open=false;focusAndReveal(details.querySelector('summary'));
      }else if(close.dataset.scrollCollapse==='composer'){
        var card=close.closest('[data-situation-card]'),toggle=card?.querySelector('[data-collapse-situation]');
        if(toggle?.getAttribute('aria-expanded')==='true')toggle.click();
        focusAndReveal(toggle);
      }else if(close.dataset.scrollCollapse==='chapter'){
        var chapter=close.closest('[data-library-chapter]'),id=chapter?.dataset.libraryChapter;
        chapter?.querySelector('[data-toggle-library-chapter]')?.click();
        var updated=Array.from(document.querySelectorAll('[data-library-chapter]')).find(function(node){return node.dataset.libraryChapter===id;});
        focusAndReveal(updated);
      }
      schedule();
    });
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','aria-hidden']});
    update();
  }
  renderSidebar();
  enforcePageAccess();
  enforceActionAccess();
  document.querySelectorAll('[data-nav-locked]').forEach(function(link){link.addEventListener('click',function(event){event.preventDefault();StudioModal.alert({eyebrow:'Accès limité',title:'Fonctionnalité verrouillée',message:'Le responsable de votre compte peut vous accorder ce droit.',type:'warning'});});});
  setupNotifications(0);
  var interfaceButton = document.querySelector('[data-interface-switch]');
  if (interfaceButton) interfaceButton.addEventListener('click', function(){
    var next = interfaceButton.dataset.interfaceSwitch;
    StudioAPI.setInterfaceMode(next);
    location.href = next === 'admin' ? 'admin.html' : 'accueil.html';
  });
  var logoutButton = document.querySelector('[data-logout]');
  if (logoutButton) logoutButton.addEventListener('click', function(){
    if(CLIENT_PREVIEW){StudioAPI.endClientPreview();return;}
    localStorage.removeItem('studio_token');
    localStorage.removeItem('studio_user');
    localStorage.removeItem('studio_organization_id');
    sessionStorage.removeItem('studio_interface_mode');
    location.href='login.html';
  });
  renderBottomNav();
  setupMobileToggle();
  setupSidebarCollapse();
  setupActionMenus();
  setupScrollNavigation();
  setupStudioSubscriptionAccess();
  setTimeout(trackProductActivity,0);
})();
