(function(){
  var chapters = [
    {
      title:'Équité dans les décisions',
      description:'Choisissez les situations qui permettent d’observer la façon dont les décisions sont préparées, expliquées et partagées.',
      situations:[
        situation('eq-1','Prendre en compte tous les points de vue lors d’un arbitrage','Équité & décisions',true,[
          ['Je décide seul pour gagner du temps, sans expliquer mon choix.',0],
          ['Je consulte surtout les personnes directement concernées.',1],
          ['Je recueille les points de vue utiles, j’explicite les critères et j’explique l’arbitrage.',2]
        ]),
        situation('eq-2','Répartir équitablement les responsabilités dans une équipe','Équité & décisions',true,[
          ['Je confie les missions importantes aux personnes auxquelles je fais déjà confiance.',0],
          ['Je répartis les missions selon les disponibilités du moment.',1],
          ['Je rends les critères transparents et je veille à répartir aussi les opportunités de développement.',2]
        ]),
        situation('eq-3','Réagir lorsqu’une personne est systématiquement moins sollicitée en réunion','Participation',true,[
          ['Je laisse le groupe fonctionner naturellement.',0],
          ['Je lui demande ponctuellement son avis.',1],
          ['Je régule les prises de parole et crée les conditions pour que chacun puisse contribuer.',2]
        ]),
        situation('eq-4','Justifier une décision d’attribution de mission auprès de l’équipe','Transparence',true,[
          ['Je communique uniquement le nom de la personne retenue.',0],
          ['Je donne quelques éléments si quelqu’un me questionne.',1],
          ['J’explique les critères utilisés et les relie aux besoins de la mission.',2]
        ]),
        situation('eq-5','Dans notre organisation, les opportunités de développement ne sont pas toujours communiquées de façon équitable.','Situation personnalisée',true,[
          ['Je considère que chacun doit chercher l’information par lui-même.',0],
          ['Je relaie l’information aux personnes que j’identifie comme intéressées.',1],
          ['Je rends l’information accessible à tous et j’encourage les candidatures de profils variés.',2]
        ],true),
        situation('eq-6','Questionner ses critères lorsqu’un choix repose surtout sur le “bon profil”','Biais de décision',false,[
          ['Je fais confiance à mon intuition et à mon expérience.',0],
          ['Je vérifie rapidement mon choix avec un collègue.',1],
          ['Je reformule des critères observables et je vérifie qu’ils sont appliqués de manière cohérente.',2]
        ])
      ]
    },
    {
      title:'Reconnaissance et valorisation',
      description:'Observez comment la contribution de chacun est reconnue, valorisée et rendue visible.',
      situations:[
        situation('rec-1','Valoriser une contribution discrète mais déterminante', 'Reconnaissance',true, answers('Je ne la mentionne pas si elle n’est pas visible.','Je la remercie en privé.','Je la reconnais explicitement et relie sa contribution au résultat collectif.')),
        situation('rec-2','Réagir lorsqu’une idée est reprise sans citer son auteur ou son autrice','Crédit des idées',true, answers('Je n’interviens pas.','Je rappelle l’origine de l’idée après la réunion.','Je réattribue immédiatement et simplement le mérite à la bonne personne.')),
        situation('rec-3','Donner un feedback après une réussite collective','Feedback',true, answers('Je félicite uniquement la personne la plus visible.','Je remercie globalement l’équipe.','Je reconnais les contributions spécifiques et les complémentarités.')),
        situation('rec-4','Préparer les entretiens annuels avec des critères comparables','Évaluation',true, answers('Je m’appuie surtout sur mon impression générale.','Je relis les objectifs et quelques faits marquants.','Je prépare des faits observables et des critères identiques pour tous.')),
        situation('rec-5','Rendre visibles des réussites provenant de métiers moins exposés','Visibilité',false, answers('Je communique surtout sur les projets les plus connus.','Je varie ponctuellement les exemples.','Je veille à représenter la diversité des métiers et des contributions.')),
        situation('rec-6','Soutenir la prise de parole d’une personne peu reconnue','Sponsorship',false, answers('Je considère que chacun doit se rendre visible.','Je lui donne un conseil en privé.','Je crée une occasion légitime pour qu’elle présente son travail.'))
      ]
    },
    {
      title:'Communication et feedback',
      description:'Sélectionnez les situations liées à l’écoute, au feedback et à la qualité des échanges professionnels.',
      situations:[
        situation('com-1','Recadrer une interruption répétée pendant une réunion','Réunion',true, answers('Je laisse passer pour ne pas créer de tension.','J’en parle après la réunion.','Je régule immédiatement avec une règle commune de prise de parole.')),
        situation('com-2','Adapter son feedback à une personne qui exprime un désaccord','Feedback',true, answers('Je coupe court au désaccord.','J’écoute puis je maintiens ma position.','Je clarifie les faits, j’écoute les arguments et je recherche un point d’ajustement.')),
        situation('com-3','Réagir à une plaisanterie qui met une personne mal à l’aise','Climat inclusif',true, answers('Je n’interviens pas si personne ne proteste.','Je change de sujet.','Je nomme calmement le problème et rappelle le cadre attendu.')),
        situation('com-4','S’assurer qu’une information importante est accessible à tous','Accessibilité',true, answers('Je diffuse par le canal habituel uniquement.','Je vérifie que les principaux interlocuteurs l’ont reçue.','J’utilise des formats et canaux adaptés aux besoins de l’équipe.')),
        situation('com-5','Inviter les avis divergents avant une décision','Débat',true, answers('Je demande surtout des confirmations.','Je demande si quelqu’un n’est pas d’accord.','Je sollicite explicitement les réserves et les arguments alternatifs.')),
        situation('com-6','Donner un feedback sur un comportement sans étiqueter la personne','Feedback',true, answers('Je décris la personne de manière générale.','Je formule une critique courte.','Je décris des faits précis, leurs effets et l’attente pour la suite.'))
      ]
    },
    {
      title:'Délégation et autonomie',
      description:'Évaluez les pratiques de délégation, de confiance et d’accompagnement de l’autonomie.',
      situations:[
        situation('del-1','Confier une mission visible à une personne qui n’en a encore jamais eu','Délégation',true, answers('Je choisis une personne déjà expérimentée.','Je lui confie une partie limitée.','Je clarifie les attendus, sécurise l’accompagnement et lui donne une réelle responsabilité.')),
        situation('del-2','Réagir à une manière de faire différente mais efficace','Autonomie',true, answers('J’impose ma méthode.','Je tolère la différence si le résultat est atteint.','Je laisse de l’autonomie tant que les objectifs, risques et règles sont respectés.')),
        situation('del-3','Répartir les tâches valorisantes et les tâches moins visibles','Répartition',true, answers('Je garde les habitudes existantes.','Je fais tourner certaines tâches.','Je suis la répartition dans le temps et corrige les déséquilibres.')),
        situation('del-4','Accompagner une erreur dans une mission nouvellement déléguée','Droit à l’erreur',false, answers('Je reprends immédiatement la mission.','Je corrige avec la personne.','J’analyse l’erreur, adapte l’accompagnement et maintiens l’autonomie quand c’est possible.')),
        situation('del-5','Clarifier la marge de décision avant de déléguer','Cadre',false, answers('Je donne la tâche sans préciser les limites.','Je précise le résultat attendu.','Je clarifie le résultat, la marge de décision, les points de contrôle et les ressources.')),
        situation('del-6','Éviter de surcontrôler une personne en télétravail','Confiance',true, answers('Je multiplie les points de contrôle.','Je demande des comptes rendus fréquents.','Je m’accorde sur les résultats, les jalons utiles et les modalités de disponibilité.'))
      ]
    }
  ];

  function situation(id,text,tag,selected,answersList,custom){
    return {id:id,text:text,tag:tag,selected:selected,answers:answersList,custom:!!custom,open:false};
  }
  function answers(a,b,c){ return [[a,0],[b,1],[c,2]]; }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g,function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char];
    });
  }

  var activeChapter = 0;
  var editingId = null;

  function selectedCount(chapter){ return chapter.situations.filter(function(item){ return item.selected; }).length; }
  function totalSelected(){ return chapters.reduce(function(total,chapter){ return total + selectedCount(chapter); },0); }
  function totalSituations(){ return chapters.reduce(function(total,chapter){ return total + chapter.situations.length; },0); }

  function renderNavigation(){
    var nav = document.getElementById('chapter-nav');
    nav.innerHTML = chapters.map(function(chapter,index){
      var selected = selectedCount(chapter);
      return '<button class="chapter-tab'+(index===activeChapter?' is-active':'')+'" type="button" role="tab" aria-selected="'+(index===activeChapter?'true':'false')+'" data-chapter="'+index+'">'+
        '<span class="chapter-tab-number">Chapitre '+(index+1)+'</span>'+
        '<strong>'+esc(chapter.title)+'</strong>'+
        '<span class="chapter-tab-meta"><i class="chapter-status '+(selected===chapter.situations.length?'is-complete':'')+'"></i>'+selected+' / '+chapter.situations.length+' situations</span>'+
      '</button>';
    }).join('');
    nav.querySelectorAll('[data-chapter]').forEach(function(button){
      button.addEventListener('click',function(){
        activeChapter = Number(button.getAttribute('data-chapter'));
        render();
      });
    });
  }

  function renderSituations(){
    var chapter = chapters[activeChapter];
    document.getElementById('chapter-kicker').textContent = 'Chapitre '+(activeChapter+1);
    document.getElementById('chapter-title').textContent = chapter.title;
    document.getElementById('chapter-description').textContent = chapter.description;
    document.getElementById('chapter-count').textContent = selectedCount(chapter)+' / '+chapter.situations.length+' sélectionnées';

    document.getElementById('situation-list').innerHTML = chapter.situations.map(function(item,index){
      var editing = editingId === item.id;
      var answersHtml = item.answers.map(function(answer){
        return '<div class="composer-answer score-'+answer[1]+'">'+
          '<span class="answer-marker" aria-hidden="true"></span>'+
          '<span class="answer-text">'+esc(answer[0])+'</span>'+
          '<span class="answer-score" title="Score méthodologique verrouillé">Score <strong>'+answer[1]+'</strong><span class="lock" aria-hidden="true">🔒</span></span>'+
        '</div>';
      }).join('');
      return '<article class="situation composer-situation'+(item.custom?' custom':'')+(item.selected?' is-selected':'')+(item.open?' is-open':'')+'" data-id="'+item.id+'">'+
        '<div class="situation-select">'+
          '<input type="checkbox" id="select-'+item.id+'" '+(item.selected?'checked':'')+' data-select="'+item.id+'">'+
          '<label for="select-'+item.id+'"><span class="sr-only">Sélectionner cette situation</span></label>'+
        '</div>'+
        '<div class="situation-content">'+
          '<div class="situation-order">Situation '+(index+1)+'</div>'+
          (editing ?
            '<textarea class="situation-edit" data-edit-field="'+item.id+'">'+esc(item.text)+'</textarea>' :
            '<h3>'+esc(item.text)+'</h3>')+
          '<div class="situation-meta"><span class="source-badge">'+(item.custom?'✏️ Modifiée par vous':'✓ Situation Me&YouToo')+'</span><span>'+esc(item.tag)+'</span></div>'+
          '<button class="answers-toggle" type="button" data-toggle="'+item.id+'" aria-expanded="'+(item.open?'true':'false')+'">'+(item.open?'▲ Masquer les réponses et les scores':'▼ Voir les réponses et les scores')+'</button>'+
        '</div>'+
        '<div class="situation-actions">'+
          (editing ? '<button class="icon-action is-primary" type="button" data-save="'+item.id+'">✓ Enregistrer</button><button class="icon-action" type="button" data-cancel="'+item.id+'">Annuler</button>' : '<button class="icon-action" type="button" data-edit="'+item.id+'">✏️ Modifier le texte</button><button class="icon-action" type="button" data-replace="'+item.id+'">⇄ Remplacer</button>')+
        '</div>'+
        '<div class="situation-answers" '+(item.open?'':'hidden')+'><div class="answers-head"><strong>Réponses proposées</strong><span>Scores visibles et non modifiables</span></div>'+answersHtml+'</div>'+
      '</article>';
    }).join('');

    bindSituationActions();
  }

  function bindSituationActions(){
    document.querySelectorAll('[data-select]').forEach(function(input){
      input.addEventListener('change',function(){ findSituation(input.getAttribute('data-select')).selected = input.checked; render(); });
    });
    document.querySelectorAll('[data-toggle]').forEach(function(button){
      button.addEventListener('click',function(){ var item=findSituation(button.getAttribute('data-toggle')); item.open=!item.open; render(); });
    });
    document.querySelectorAll('[data-edit]').forEach(function(button){
      button.addEventListener('click',function(){ editingId=button.getAttribute('data-edit'); renderSituations(); });
    });
    document.querySelectorAll('[data-cancel]').forEach(function(button){
      button.addEventListener('click',function(){ editingId=null; renderSituations(); });
    });
    document.querySelectorAll('[data-save]').forEach(function(button){
      button.addEventListener('click',function(){
        var id=button.getAttribute('data-save');
        var field=document.querySelector('[data-edit-field="'+id+'"]');
        var value=field ? field.value.trim() : '';
        if(value){ var item=findSituation(id); item.text=value; item.custom=true; }
        editingId=null;
        render();
      });
    });
    document.querySelectorAll('[data-replace]').forEach(function(button){
      button.addEventListener('click',function(){
        var item=findSituation(button.getAttribute('data-replace'));
        alert('La bibliothèque de remplacement s’ouvrira ici pour remplacer « '+item.text+' » par une autre situation Me&YouToo du même chapitre.');
      });
    });
  }

  function findSituation(id){
    for(var i=0;i<chapters.length;i++){
      for(var j=0;j<chapters[i].situations.length;j++) if(chapters[i].situations[j].id===id) return chapters[i].situations[j];
    }
    throw new Error('Situation introuvable');
  }

  function updateSummary(){
    var selected=totalSelected();
    var total=totalSituations();
    var percent=total ? Math.round(selected/total*100) : 0;
    document.getElementById('selected-total').textContent=selected;
    document.getElementById('situations-total').textContent=total;
    document.getElementById('selection-progress').style.width=percent+'%';
    document.getElementById('campaign-summary').textContent=chapters.length+' chapitres · '+total+' situations';
    document.getElementById('duration-detail').textContent=selected+' situations sélectionnées';
    document.getElementById('estimated-duration').textContent=selected<=15?'6 à 8 minutes':selected<=22?'8 à 10 minutes':'10 à 12 minutes';
  }

  function render(){
    renderNavigation();
    renderSituations();
    updateSummary();
  }

  document.getElementById('open-library').addEventListener('click',function(){ alert('La bibliothèque Me&YouToo s’ouvrira ici, filtrée sur le chapitre « '+chapters[activeChapter].title+' ».'); });
  document.getElementById('replace-situation').addEventListener('click',function(){ alert('Choisissez d’abord la situation à remplacer dans la liste, puis cliquez sur « Remplacer ».'); });
  document.querySelectorAll('.composer-preview').forEach(function(button){ button.addEventListener('click',function(){ alert('Ouverture de l’aperçu répondant avec les '+totalSelected()+' situations sélectionnées.'); }); });

  render();
})();
