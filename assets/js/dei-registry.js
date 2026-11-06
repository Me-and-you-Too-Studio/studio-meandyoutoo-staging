// Cockpit DEI : registre des actions de l'année (indicateurs, frise 12 mois, liste, pièces jointes).
// Mode admin : cockpit-dei.html?organizationId=… pour saisir les actions animées par Me&YouToo.
(function(){
  'use strict';
  var root=document.getElementById('dei-registry');
  if(!root||!window.StudioAPI)return;
  var params=new URLSearchParams(location.search);
  var user=null;try{user=StudioAPI.user();}catch(e){}
  var isAdmin=Boolean(user&&user.role==='admin');
  var organizationId=isAdmin?params.get('organizationId'):null;
  var isClient=Boolean(user&&user.role==='client');
  var MONTHS=['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];
  var MONTHS_LONG=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var THEMES=['Sexisme','Égalité femmes-hommes','Handicap','LGBT+','Origines','Religion','Intergénérationnel','Harcèlement & VSS','Management inclusif','Inclusion (transversal)'];
  var AUDIENCES=['Managers','Collaborateurs','Direction / COMEX','RH','Référents harcèlement & VSS','Nouveaux arrivants','Alternants & stagiaires'];
  var DOMAINS=THEMES.concat(['Accessibilité','Recrutement inclusif','Qualité de vie au travail','Communication interne']);
  // Choix multiples en cases à cocher + champ « Autre » libre ; enregistré en liste séparée par des virgules.
  function splitValues(v){return String(v||'').split(',').map(function(s){return s.trim();}).filter(Boolean);}
  function multiField(name,label,options,value){
    var values=splitValues(value),known=options.map(function(o){return o.toLowerCase();});
    var others=values.filter(function(v){return known.indexOf(v.toLowerCase())<0;});
    return '<fieldset class="dr-multi"><legend>'+esc(label)+' <small>(plusieurs choix possibles)</small></legend><div class="dr-chips">'+
      options.map(function(o){var on=values.some(function(v){return v.toLowerCase()===o.toLowerCase();});return '<label class="dr-chip"><input type="checkbox" name="'+name+'" value="'+esc(o)+'"'+(on?' checked':'')+'><span>'+esc(o)+'</span></label>';}).join('')+
      '</div><label class="dr-other"><span>Autre</span><input name="'+name+'__other" maxlength="160" value="'+esc(others.join(', '))+'" placeholder="Précisez (séparez par des virgules)"></label></fieldset>';
  }
  function readMulti(form,name){
    var picked=[].slice.call(form.querySelectorAll('input[name="'+name+'"]:checked')).map(function(i){return i.value;});
    return picked.concat(splitValues(form.elements[name+'__other']&&form.elements[name+'__other'].value)).join(', ');
  }
  // Onglets du cockpit (mémorisés dans l'adresse : #apercu, #actions, #dispositifs, #prestataires).
  var TABS={apercu:'Vue d’ensemble',actions:'Actions',dispositifs:'Dispositifs',prestataires:'Prestataires'},TAB_ICONS={apercu:'🧭',actions:'🎯',dispositifs:'🧩',prestataires:'🤝'};
  var tabsEl=document.getElementById('dei-tabs'),yearEl=document.getElementById('dei-year');
  var state={year:Number(params.get('year'))||new Date().getFullYear(),data:null,tab:TABS[location.hash.slice(1)]?location.hash.slice(1):'apercu',focus:/^action-\d+$/.test(params.get('focus')||'')?params.get('focus'):null};

  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){return new Intl.NumberFormat('fr-FR').format(Number(v)||0);}
  function fmtDate(v){if(!v)return '';var d=new Date(String(v).slice(0,10)+'T12:00:00');return d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});}
  function qs(extra){var p=new URLSearchParams();if(organizationId)p.set('organizationId',organizationId);Object.keys(extra||{}).forEach(function(k){p.set(k,extra[k]);});var s=p.toString();return s?'?'+s:'';}
  function withOrg(body){if(organizationId)body.organizationId=organizationId;return body;}
  // Le calendrier d'un client : en mode admin, ouvert directement sur le client consulté.
  // from=cockpit : le calendrier affiche un bouton de retour au Cockpit.
  function calendarHref(){return isAdmin?(organizationId?'calendrier.html?from=cockpit&organizationId='+encodeURIComponent(organizationId):'calendrier.html'):'calendrier.html?audience=client&from=cockpit';}
  function today(){return new Date().toISOString().slice(0,10);}

  function load(){
    if(isAdmin&&!organizationId){root.innerHTML='<p class="dr-empty">Le registre des actions est propre à chaque client : ouvrez-le depuis le <a href="admin.html">dossier d’un client</a> (bouton « Cockpit D&I du client »).</p>';return Promise.resolve();}
    root.setAttribute('aria-busy','true');
    return Promise.all([StudioAPI.request('/api/dei/actions'+qs({year:state.year})),loadReviews()]).then(function(r){state.data=r[0];render();})
      .catch(function(e){root.innerHTML='<p class="dr-empty">Le registre des actions est momentanément indisponible. '+esc(e.message||'')+'</p>';})
      .finally(function(){root.removeAttribute('aria-busy');});
  }

  // Avis sur les actions réalisées, toutes années confondues. Sans réponse de l'API, le Cockpit reste utilisable sans les avis.
  function loadReviews(){
    return StudioAPI.request('/api/dei/reviews'+qs()).then(function(r){state.reviews=r.actions||[];state.reviewAgain=r.again||{};}).catch(function(){state.reviews=[];});
  }
  function reviewRow(id){return (state.reviews||[]).find(function(x){return String(x.id)===String(id);})||null;}
  // Me&YouToo à la place du client ne note pas : le bouton n'apparaît pas.
  function canReview(){return isClient&&Boolean(state.data&&state.data.canEdit)&&!(StudioAPI.clientPreview&&StudioAPI.clientPreview());}
  function starsText(n){return '★★★★★'.slice(0,n)+'☆☆☆☆☆'.slice(0,5-n);}
  function againLabel(k){return (state.reviewAgain||{})[k]||k;}
  function stars(n){return '<span class="dr-stars" role="img" aria-label="'+n+' sur 5">'+starsText(n)+'</span>';}
  function reviewLine(r){return stars(r.rating)+' <span class="dr-review-again">Je referais appel : '+esc(againLabel(r.again))+'</span>';}
  // Invitation visible : cinq étoiles vides, pour que l'avis se repère sur la ligne avant d'être donné.
  function reviewCta(attrs){return '<button type="button" class="dr-review-cta" '+attrs+'><span class="dr-stars is-empty" aria-hidden="true">★★★★★</span><span><strong>Donner mon avis</strong> <small>étoiles et commentaire</small></span></button>';}
  // Bloc « avis » d'une action réalisée : l'avis et son commentaire s'il existe, sinon l'invitation.
  function reviewBox(rv,id){
    if(!rv)return '';
    if(!rv.review)return canReview()?'<div class="dr-review-box">'+reviewCta('data-review="'+esc(id)+'"')+'</div>':'';
    return '<div class="dr-review-box"><p class="dr-review-title">'+(canReview()?'Votre avis':'Avis du client')+'</p><p class="dr-review-line">'+reviewLine(rv.review)+'</p>'+
      (rv.review.comment?'<p class="dr-review-comment">'+esc(rv.review.comment)+'</p>':'')+
      (rv.review.reminderDate?'<p class="dr-row-meta">🔔 Rappel prévu le '+esc(fmtDate(rv.review.reminderDate))+'</p>':'')+
      (canReview()?'<button type="button" class="dr-link" data-review="'+esc(id)+'">Modifier l’avis</button>':'')+'</div>';
  }
  // Résumé d'une fiche : moyenne, nombre d'avis, réponses données. Pas de classement entre prestataires.
  function reviewSummary(rows){
    var done=rows.filter(function(x){return x.review;}),n=done.length;
    if(!n)return '';
    var avg=done.reduce(function(s,x){return s+x.review.rating;},0)/n;
    var again=Object.keys(state.reviewAgain||{}).map(function(k){var c=done.filter(function(x){return x.review.again===k;}).length;return c?c+' × '+againLabel(k).toLowerCase():'';}).filter(Boolean).join(', ');
    return '<p class="dr-review-summary"><span class="dr-stars" aria-hidden="true">★</span> '+avg.toFixed(1).replace('.',',')+' · '+n+' avis</p><p class="dr-row-meta">Je referais appel : '+esc(again)+'</p>';
  }
  function providerRows(key){return (state.reviews||[]).filter(function(x){return key==='meayt'?x.led_by_meayt:String(x.provider_id)===String(key);});}
  var REVIEW_SCALE=['Très éloignée de nos attentes','Éloignée de nos attentes','En partie conforme à nos attentes','Conforme à nos attentes','Tout à fait conforme à nos attentes'];
  function reviewDialog(id){
    var a=reviewRow(id);if(!a)return;
    var r=a.review||{},dlg=document.createElement('dialog');dlg.className='dr-dialog';
    var again=state.reviewAgain||{};
    dlg.innerHTML='<form><h2>Votre avis sur cette action</h2><p class="dr-row-meta">'+esc(a.title)+' · '+esc(fmtDate(a.action_date))+'</p>'+
      '<fieldset class="dr-rating"><legend>Cette action a-t-elle répondu à vos attentes ?</legend><div class="dr-rating-stars">'+
      [1,2,3,4,5].map(function(n){return '<label title="'+esc(REVIEW_SCALE[n-1])+'"><input type="radio" name="rating" value="'+n+'" required'+(r.rating===n?' checked':'')+'><span aria-hidden="true">★</span><span class="dr-sr">'+n+' sur 5 : '+esc(REVIEW_SCALE[n-1])+'</span></label>';}).join('')+
      '</div><p class="dr-rating-caption" data-caption></p></fieldset>'+
      '<fieldset class="dr-rating"><legend>Je referais appel à '+(a.led_by_meayt?'Me&amp;YouToo':'ce prestataire')+'</legend><div class="dr-chips">'+
      Object.keys(again).map(function(k){return '<label class="dr-chip"><input type="radio" name="again" value="'+esc(k)+'" required'+(r.again===k?' checked':'')+'><span>'+esc(again[k])+'</span></label>';}).join('')+'</div></fieldset>'+
      '<label class="dr-field"><span>Commentaire (facultatif)</span><textarea name="comment" rows="4" maxlength="1000" placeholder="Ce qui a bien fonctionné, ce qui serait à ajuster la prochaine fois. Parlez de la prestation, pas de la personne.">'+esc(r.comment||'')+'</textarea></label>'+
      '<label class="dr-check"><input type="checkbox" name="reminder"'+(r.reminderDate?' checked':'')+'> Prévoir un rappel</label>'+
      '<div data-reminder'+(r.reminderDate?'':' hidden')+'><label class="dr-field"><span>Date du rappel</span><input type="date" name="reminderDate" value="'+esc(r.reminderDate||'')+'"></label>'+
      '<p class="dr-row-meta">Une tâche « Recontacter '+(a.led_by_meayt?'Me&amp;YouToo':'ce prestataire')+' » s’ajoute à votre Calendrier, visible par votre équipe, sans la note ni le commentaire.</p></div>'+
      '<p class="dr-review-privacy">'+(a.led_by_meayt?'🔓 Cet avis porte sur une action de Me&amp;YouToo : notre équipe peut le lire.':'🔒 Cet avis reste interne à votre entreprise : il n’est jamais transmis au prestataire, et Me&amp;YouToo ne le voit pas.')+'</p>'+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions">'+(a.review?'<button type="button" class="button button-ghost" data-review-remove>Retirer l’avis</button>':'')+
      '<button type="button" class="button button-ghost" data-close>Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error'),caption=dlg.querySelector('[data-caption]');
    var labels=[].slice.call(dlg.querySelectorAll('.dr-rating-stars label'));
    function paint(){var v=Number((form.elements.rating.value)||0);labels.forEach(function(l,i){l.classList.toggle('is-on',i<v);});caption.textContent=v?REVIEW_SCALE[v-1]:'';}
    form.addEventListener('change',paint);paint();
    var reminderBox=dlg.querySelector('[data-reminder]'),reminderDate=form.elements.reminderDate;
    function syncReminder(){var on=form.elements.reminder.checked;reminderBox.hidden=!on;reminderDate.required=on;}
    form.elements.reminder.addEventListener('change',syncReminder);syncReminder();
    dlg.addEventListener('close',function(){dlg.remove();});
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    var url='/api/dei/actions/'+encodeURIComponent(a.id)+'/review';
    var removeBtn=dlg.querySelector('[data-review-remove]');
    if(removeBtn)removeBtn.onclick=async function(){
      try{await StudioAPI.request(url,{method:'DELETE'});dlg.close();load();}catch(e){err.textContent=e.message||'Suppression impossible';err.hidden=false;}
    };
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      if(!form.checkValidity()){form.reportValidity();return;}
      var f=new FormData(form);
      try{await StudioAPI.request(url,{method:'PUT',body:JSON.stringify({rating:Number(f.get('rating')),again:f.get('again'),comment:f.get('comment'),reminderDate:form.elements.reminder.checked?f.get('reminderDate'):''})});dlg.close();load();}
      catch(e){err.textContent=e.message||'Enregistrement impossible';err.hidden=false;}
    };
    dlg.showModal();
  }
  // Détail d'une fiche : les actions réalisées avec ce prestataire et leurs avis.
  function reviewsDialog(key,name){
    var rows=providerRows(key),dlg=document.createElement('dialog');dlg.className='dr-dialog';
    dlg.innerHTML='<form method="dialog"><h2>Avis sur '+esc(name)+'</h2>'+reviewSummary(rows)+'<div class="dr-review-list">'+rows.map(function(a){var r=a.review;
      return '<article class="dr-review"><h4>'+esc(a.title)+'</h4><p class="dr-row-meta">'+esc(fmtDate(a.action_date))+'</p>'+
        (r?'<p class="dr-review-line">'+reviewLine(r)+'</p>'+(r.comment?'<p class="dr-row-notes">'+esc(r.comment)+'</p>':'')+'<p class="dr-row-meta">'+esc([r.author,'mis à jour le '+fmtDate(String(r.updatedAt).slice(0,10))].filter(Boolean).join(' · '))+'</p>':'<p class="dr-row-meta">Pas encore d’avis</p>')+
        (canReview()?(r?'<button type="button" class="dr-link" data-review="'+esc(a.id)+'">Modifier l’avis</button>':reviewCta('data-review="'+esc(a.id)+'"')):'')+'</article>';
    }).join('')+'</div><div class="dr-dialog-actions"><button type="submit" class="button button-ghost">Fermer</button></div></form>';
    document.body.appendChild(dlg);
    dlg.addEventListener('close',function(){dlg.remove();});
    dlg.addEventListener('click',function(ev){var t=ev.target.closest('[data-review]');if(t){var id=t.getAttribute('data-review');dlg.close();reviewDialog(id);}});
    dlg.showModal();
  }
  function reviewsFooter(key,name){
    var rows=providerRows(key);if(!rows.length)return '';
    var n=rows.filter(function(x){return x.review;}).length;
    if(!n&&!canReview())return '';
    var attrs='data-reviews="'+esc(key)+'" data-name="'+esc(name)+'"';
    return n?reviewSummary(rows)+'<button type="button" class="dr-link" '+attrs+'>Voir les avis et commentaires →</button>':reviewCta(attrs);
  }

  // Une campagne garde le statut de Mes campagnes : Programmée jusqu'à sa date de début, En diffusion ensuite.
  function campaignStatusLabel(it){return it.status==='done'?'Terminé':it.status==='scheduled'?'Programmée':'En diffusion';}
  // Actions du registre + campagnes de diagnostic, dans un même format d'affichage.
  function items(){
    var d=state.data,t=today();
    var actions=d.actions.map(function(a){return {type:'action',id:a.id,kind:a.kind,title:a.title,date:a.action_date,end:a.end_date,status:a.status,theme:a.theme,audience:a.audience,people:a.people_reached,notes:a.notes,dispositifId:a.dispositif_id,objective:a.objective,results:a.results,postponedFrom:a.postponed_from,budget:a.budget_eur,meayt:a.led_by_meayt,documents:a.documents||[],offerId:a.offer_id,provider:a.provider_name,recommended:a.recommended,campaignId:a.campaign_id,raw:a};});
    var campaigns=d.campaigns.map(function(c){return {type:'campaign',id:c.id,kind:'diagnostic',title:c.name,date:c.year_date||c.launch_date,start:c.launch_date,end:c.close_date,status:(['closed','completed','unpublished'].indexOf(c.status)>=0||(c.close_date&&c.close_date<t))?'done':(c.launch_date&&c.launch_date>t)?'scheduled':'in_progress',theme:c.theme_title,coverTheme:c.dei_theme||c.theme_title,people:c.respondents,dispositifId:c.dispositif_id,documents:[]};});
    return actions.concat(campaigns).sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
  }
  function kind(k){return (state.data.kinds||{})[k]||{label:k,icon:'•'};}
  // Temps fort à préparer : une seule carte, jusqu'à ce qu'une action soit prévue ou que le client choisisse « Plus tard ».
  function nudgeCard(n,canEdit){
    var offer=n.offer?'<a class="button button-ghost" href="offres.html?from=cockpit&amp;offer='+encodeURIComponent(n.offer.slug)+'">Voir l’offre : '+esc(n.offer.title)+'</a>':'';
    return '<aside class="dr-nudge" aria-label="Temps fort à préparer"><div><strong>'+esc(n.name)+' dans '+n.daysLeft+' jours</strong>'+
      '<p>Rien n’est encore prévu sur la thématique « '+esc(n.theme)+' » dans votre programme : c’est le bon moment pour préparer une action.</p></div>'+
      '<div class="dr-nudge-actions">'+(canEdit?'<button type="button" class="button button-primary" data-prepare="'+esc(n.date)+'" data-theme="'+esc(n.theme)+'" data-title="'+esc(n.name)+'">Préparer une action</button>':'')+offer+
      '<button type="button" class="dr-link" data-nudge-later="'+esc(n.eventId)+'" data-nudge-year="'+esc(n.year)+'" data-stage="'+esc(n.stage)+'">Plus tard</button></div></aside>';
  }
  // Une action reportée sans nouvelle date ou annulée reste dans la liste mais ne compte plus dans le programme.
  function inProgramme(it){return it.status!=='postponed'&&it.status!=='cancelled';}
  var BUDGET_NOTICE='🔒 Me&amp;YouToo ne voit pas ce montant dans le Studio';
  function euros(v){return num(v)+' €';}

  function render(){
    var d=state.data,list=items(),ind=d.indicators,canEdit=d.canEdit;
    var years=d.years.map(function(y){return '<button type="button" class="dr-year'+(y===state.year?' is-current':'')+'" data-year="'+y+'">'+y+'</button>';}).join('');
    // Compte limité à certains dossiers d’équipe : son Cockpit ne porte que sur eux.
    var perimeterNames=d.perimeter?d.perimeter.folders.map(function(f){return f.name;}).join(', '):'';
    var head=(d.perimeter?'<p class="ae-perimeter-banner">👥 Votre Cockpit porte sur '+(d.perimeter.folders.length>1?'vos dossiers':'votre dossier')+' d’équipe : '+esc(perimeterNames||'aucun')+'. La vue d’ensemble de l’entreprise et ses objectifs restent à la direction.</p>':'')+'<div class="dr-head"><div><p class="eyebrow">Registre des actions D&amp;I'+(perimeterNames?' · '+esc(perimeterNames):'')+'</p><h2>'+(organizationId?'Année '+state.year+(d.organizationName?' — '+esc(d.organizationName):''):'Votre année '+state.year)+'</h2>'+
      '<p>Toutes vos actions diversité &amp; inclusion au même endroit : celles animées par Me&amp;YouToo, vos diagnostics et vos initiatives internes.</p></div>'+
      '<div class="dr-head-actions"><div class="dr-years" role="group" aria-label="Choisir l’année">'+years+'</div><a class="button button-secondary" data-bilan href="bilan-dei.html'+qs({year:state.year})+'">📄 Bilan '+state.year+' (PDF)</a>'+(canEdit?'<button type="button" class="button button-primary" data-add>＋ Ajouter une action</button>':'')+'</div></div>';
    var cards='<div class="dr-kpis">'+
      kpi(num(ind.actions),ind.actions>1?'actions et diagnostics':'action ou diagnostic',ind.done+' réalisée'+(ind.done>1?'s':'')+' · '+ind.planned+' à venir ou en cours'+(ind.postponed?' · '+ind.postponed+' reportée'+(ind.postponed>1?'s':''):'')+(ind.cancelled?' · '+ind.cancelled+' annulée'+(ind.cancelled>1?'s':''):''),null,'actions')+
      kpi(num(ind.peopleReached),'personne'+(ind.peopleReached>1?'s':'')+' touchée'+(ind.peopleReached>1?'s':''),'actions réalisées et participations aux diagnostics',null,'people')+
      kpi(num(ind.formats),'format'+(ind.formats>1?'s':'')+' utilisé'+(ind.formats>1?'s':''),'conférences, formations, diagnostics…',null,'formats')+
      kpi(num(ind.themes),'thématique'+(ind.themes>1?'s':'')+' couverte'+(ind.themes>1?'s':''),'sur l’année',null,'themes')+
      kpi(num(ind.monthsWithoutAction),'mois sans action',ind.monthsWithoutAction?'sur les mois déjà écoulés':'aucun trou sur les mois écoulés',ind.monthsWithoutAction?'is-alert':'is-ok','months')+
    '</div>'+(d.budget&&d.budget.total?'<p class="dr-budget-total">Budget renseigné pour '+state.year+' : <strong>'+euros(d.budget.total)+'</strong><span class="dr-budget-lock">'+BUDGET_NOTICE+'</span></p>':'');
    var nudge=isClient&&d.nudge?nudgeCard(d.nudge,canEdit):'';
    var frise=friseView(list,ind,canEdit);
    var rows=list.length?list.map(row).join(''):'<p class="dr-empty">Aucune action enregistrée pour '+state.year+'. '+(canEdit?'Ajoutez votre première action, ou demandez-nous de l’alimenter pour vous.':'')+'</p>';
    renderTabs();
    if(yearEl)yearEl.classList.toggle('is-tab-hidden',state.tab!=='apercu');
    if(state.tab==='prestataires'){root.innerHTML=providersView();return;}
    if(state.tab==='dispositifs'){root.innerHTML=dispositifsView(years);return;}
    root.innerHTML=state.tab==='actions'
      ?head+'<div class="dr-list">'+rows+'</div>'
      :head+nudge+'<div class="dr-png-wrap" id="dr-png-kpis">'+pngButton('dr-png-kpis','chiffres-cles')+cards+'</div>'+pilotageView()+coverageView()+'<section class="dr-png-wrap dr-tl" id="dr-png-frise"><div class="dr-sub-row"><h3 class="dr-sub">Frise de l’année '+state.year+'</h3><div class="dr-sub-actions">'+pngButton('dr-png-frise','frise')+'<a class="button button-ghost" href="'+calendarHref()+'">Ouvrir dans le calendrier →</a></div></div>'+frise+'</section>';
    // Arrivée depuis le calendrier (?focus=action-12) : on montre l'action une seule fois.
    if(state.focus&&state.tab==='actions'){var target=document.getElementById('dr-'+state.focus);state.focus=null;
      if(target)setTimeout(function(){target.scrollIntoView({block:'center'});target.classList.add('is-focus');setTimeout(function(){target.classList.remove('is-focus');},2000);},200);}
  }
  // Frise de l'année, sur le modèle de celle du calendrier : une ligne par diagnostic, de son lancement à sa clôture,
  // une ligne par type d'action (point pour une journée, barre sinon), puis les mois restés vides.
  function friseView(list,ind,canEdit){
    var y=state.year,y0=Date.UTC(y,0,1),y1=Date.UTC(y+1,0,1),DAY=864e5;
    function ms(v){var p=String(v||'').slice(0,10).split('-');return Date.UTC(+p[0],+p[1]-1,+p[2]);}
    function pct(t){return Math.max(0,Math.min(100,(t-y0)/(y1-y0)*100));}
    function day(v){var d=new Date(String(v).slice(0,10)+'T12:00:00');return d.toLocaleDateString('fr-FR',d.getFullYear()===y?{day:'numeric',month:'short'}:{day:'numeric',month:'short',year:'numeric'});}
    function range(it){var s=it.start||it.date;return day(s)+(it.end&&it.end!==s?' → '+day(it.end):'');}
    var now=new Date(),nowT=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
    var todayLine=now.getFullYear()===y?'<i class="dr-tl-today" style="left:'+pct(nowT).toFixed(2)+'%" aria-hidden="true"></i>':'';
    var statuses=state.data.statuses||{};
    function mark(it,label){
      var s=ms(it.start||it.date),e=(it.end?ms(it.end):s)+DAY,left=pct(s),width=pct(e)-left;
      var st=it.type==='campaign'?campaignStatusLabel(it):(statuses[it.status]||it.status);
      var tip=it.title+' · '+range(it)+' · '+st,attrs=' data-focus="'+esc(it.type+'-'+it.id)+'" data-tip="'+esc(tip)+'" aria-label="'+esc(tip)+'"';
      if(width<1.5)return '<button type="button" class="dr-tl-dot st-'+esc(it.status)+'" style="left:'+left.toFixed(2)+'%"'+attrs+'></button>';
      return '<button type="button" class="dr-tl-bar st-'+esc(it.status)+(s<y0?' is-cut-start':'')+(e>y1?' is-cut-end':'')+'" style="left:'+left.toFixed(2)+'%;width:'+width.toFixed(2)+'%"'+attrs+'>'+(label&&width>=12?'<span>'+esc(label)+'</span>':'')+'</button>';
    }
    var inYear=list.filter(function(it){var s=String(it.start||it.date).slice(0,10),e=String(it.end||s).slice(0,10);return it.status!=='cancelled'&&s<y+1+'-01-01'&&e>=y+'-01-01';});
    function line(label,sub,marks,note,cls){return '<div class="dr-tl-row'+(cls?' '+cls:'')+'"><div class="dr-tl-label"><strong>'+label+'</strong>'+(sub?'<small>'+sub+'</small>':'')+'</div><div class="dr-tl-track">'+todayLine+marks+'</div><span class="dr-tl-note">'+(note||'')+'</span></div>';}
    var rows=inYear.filter(function(it){return it.type==='campaign';}).map(function(c){
      var left=c.end?Math.ceil((ms(c.end)+DAY-nowT)/DAY):null;
      var note=c.status==='done'?'Terminé':c.status==='scheduled'?'Démarre le '+fmtDate(c.start||c.date):left!=null&&left<=15?'Clôture dans '+left+' j':left!=null?'Encore '+left+' jours':'En diffusion';
      return line('<span aria-hidden="true">'+esc(kind('diagnostic').icon)+'</span> '+esc(c.title),esc(range(c))+(c.people?' · '+num(c.people)+' participation'+(c.people>1?'s':''):''),mark(c,campaignStatusLabel(c)),esc(note),'is-campaign');
    });
    var groups={},order=[];
    inYear.filter(function(it){return it.type==='action';}).forEach(function(a){if(!groups[a.kind]){groups[a.kind]=[];order.push(a.kind);}groups[a.kind].push(a);});
    order.forEach(function(k){var its=groups[k],kd=kind(k),done=its.filter(function(a){return a.status==='done';}).length;
      var counted=its.filter(inProgramme).length;
      rows.push(line('<span aria-hidden="true">'+esc(kd.icon)+'</span> '+esc(kd.label),counted+' action'+(counted>1?'s':'')+(done?' · '+done+' réalisée'+(done>1?'s':''):''),its.map(function(a){return mark(a,a.title);}).join(''),''));});
    var months=(ind.months||[]),nowY=now.getFullYear(),nowM=now.getMonth();
    // Mois passé : on ne peut plus être accompagné, seulement saisir une action oubliée. Mois à venir : être accompagné ou planifier.
    var pastYear=y<nowY;
    var gaps=MONTHS.map(function(name,m){
      if(months[m])return '<span class="dr-tl-cell"></span>';
      var past=pastYear||(y===nowY&&m<nowM);
      if(past)return canEdit?'<button type="button" class="dr-tl-gap is-past" data-add-month="'+m+'" title="Aucune action en '+MONTHS_LONG[m]+' '+y+' : saisir une action oubliée"><span>Aucune action</span><b>＋ Saisir</b></button>'
        :'<span class="dr-tl-cell is-past">Aucune action</span>';
      if(isClient)return '<button type="button" class="dr-tl-gap" data-month="'+m+'" title="Rien de prévu en '+MONTHS_LONG[m]+' : être accompagné"><span>Rien de prévu</span><b>Être accompagné</b></button>';
      return canEdit?'<button type="button" class="dr-tl-gap" data-add-month="'+m+'" title="Rien de prévu en '+MONTHS_LONG[m]+' : ajouter une action"><span>Rien de prévu</span><b>＋ Ajouter</b></button>':'<span class="dr-tl-cell">—</span>';
    }).join('');
    var gapsLabel=pastYear?'<strong>Mois sans action</strong><small>'+(canEdit?'Une action oubliée ? Saisissez-la':'Année terminée')+'</small>'
      :'<strong>Mois à remplir</strong><small>Un mois vide casse la dynamique</small>';
    var axis=MONTHS.map(function(m,i){return '<span'+(y===nowY&&i===nowM?' class="is-current"':'')+'>'+m+'</span>';}).join('');
    var legend='<ul class="dr-tl-legend"><li class="st-in_progress">En cours / en diffusion</li><li class="st-done">Réalisé</li><li class="st-planned">Prévu / programmée</li><li class="st-postponed">Reporté</li></ul>';
    var empty=rows.length?'':'<p class="dr-empty">Aucune action ni diagnostic en '+y+'.</p>';
    return legend+'<div class="dr-tl-scroll"><div class="dr-tl-grid">'+line('','',axis,'','dr-tl-axis')+rows.join('')+
      '<div class="dr-tl-row dr-tl-gaps"><div class="dr-tl-label">'+gapsLabel+'</div><div class="dr-tl-months">'+gaps+'</div><span class="dr-tl-note"></span></div></div></div>'+empty;
  }
  // Téléchargement d'un bloc en image PNG (html2canvas chargé au premier clic, comme pour le bilan PDF).
  function pngButton(id,name){return '<button type="button" class="dr-png" data-png="'+esc(id)+'" data-png-name="'+esc(name)+'" title="Télécharger en image PNG" data-png-ignore>⬇ PNG</button>';}
  var html2canvasReady=null;
  function loadHtml2canvas(){
    if(window.html2canvas)return Promise.resolve();
    return html2canvasReady=html2canvasReady||new Promise(function(resolve,reject){var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';s.onload=resolve;s.onerror=function(){html2canvasReady=null;reject(new Error('Module image indisponible'));};document.head.appendChild(s);});
  }
  async function downloadPng(btn){
    var el=document.getElementById(btn.getAttribute('data-png'));if(!el)return;
    var label=btn.textContent;btn.disabled=true;btn.textContent='…';
    try{
      await loadHtml2canvas();
      var canvas=await window.html2canvas(el,{scale:2,backgroundColor:'#ffffff',logging:false,windowWidth:Math.max(document.documentElement.clientWidth,1200),
        // html2canvas rogne le bas du texte tronqué : dans la copie, pas de troncature ni de bouton « Être accompagné ».
        onclone:function(doc){doc.querySelectorAll('.dr-tl-label strong,.dr-tl-bar span').forEach(function(n){n.style.overflow='visible';n.style.textOverflow='clip';});doc.querySelectorAll('.dr-tl-gap b').forEach(function(n){n.remove();});},ignoreElements:function(n){return n.hasAttribute&&(n.hasAttribute('data-png-ignore')||(n.classList&&n.classList.contains('button-ghost')&&n.tagName==='A'));}});
      var slug=String(state.data.organizationName||'cockpit').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
      var a=document.createElement('a');a.download='cockpit-dei-'+slug+'-'+state.year+'-'+btn.getAttribute('data-png-name')+'.png';a.href=canvas.toDataURL('image/png');document.body.appendChild(a);a.click();a.remove();
    }catch(e){window.StudioModal.alert({title:'Image impossible',message:'Le téléchargement de l’image n’a pas abouti. '+(e.message||'')});}
    finally{btn.disabled=false;btn.textContent=label;}
  }
  function renderTabs(){
    if(!tabsEl)return;
    var counts={actions:items().length,dispositifs:(state.data.dispositifs||[]).filter(function(x){return x.inYear;}).length,prestataires:(state.data.providers||[]).length};
    tabsEl.hidden=false;
    tabsEl.innerHTML=Object.keys(TABS).map(function(k){return '<button type="button" role="tab" class="dr-tab'+(k===state.tab?' is-current':'')+'" aria-selected="'+(k===state.tab)+'" data-tab="'+k+'"><b aria-hidden="true">'+TAB_ICONS[k]+'</b>'+esc(TABS[k])+(counts[k]!=null?' <span>'+counts[k]+'</span>':'')+'</button>';}).join('');
  }
  function setTab(tab){state.tab=tab;try{history.replaceState(null,'','#'+tab);}catch(e){}render();window.scrollTo({top:Math.max(0,root.getBoundingClientRect().top+window.scrollY-(tabsEl?tabsEl.offsetHeight:0)-24),behavior:'smooth'});}

  // ── Tableau de couverture : thématiques × familles de formats ──
  var COVER=[
    {key:'mesurer',label:'Mesurer',hint:'Diagnostic, baromètre, enquête, quiz',kinds:['diagnostic','barometre','enquete','quiz']},
    {key:'sensibiliser',label:'Sensibiliser',hint:'Diagnostic, conférence, atelier, vidéo, campagne, événement',kinds:['diagnostic','conference','atelier','video','sensibilisation','evenement']},
    {key:'former',label:'Former',hint:'Formation, e-learning, micro-learning',kinds:['formation','elearning','microlearning']},
    {key:'vivre',label:'Faire vivre',hint:'Réseau interne, mentorat',kinds:['reseau','mentorat']},
    {key:'structurer',label:'Structurer',hint:'Politique RH, accord, charte, recrutement, accessibilité, label, conseil',kinds:['politique_rh','recrutement','accessibilite','label','conseil']}
  ];
  function themeRoot(t){return String(t).toLowerCase().split(/[ &(]/)[0];}
  function sameTheme(a,b){var x=String(a).toLowerCase(),y=String(b).toLowerCase();return x===y||x.indexOf(themeRoot(y))>=0||y.indexOf(themeRoot(x))>=0;}
  function itemThemes(it){return splitValues(it.coverTheme||it.theme);}
  function coverItems(theme,col,list){var kinds=COVER.filter(function(k){return k.key===col;})[0].kinds;
    return list.filter(function(it){return kinds.indexOf(it.kind)>=0&&itemThemes(it).some(function(t){return sameTheme(theme,t);});});}
  function coverageRows(list){
    var free=[];list.forEach(function(it){itemThemes(it).forEach(function(t){if(!THEMES.concat(free).some(function(k){return sameTheme(k,t);}))free.push(t);});});
    var wanted=[];((state.data.pilotage||{}).objectives||[]).forEach(function(o){wanted=wanted.concat(splitValues(o.themes));});
    var isPriority=function(t){return wanted.some(function(w){return sameTheme(w,t);});};
    return THEMES.concat(free).map(function(t){return {theme:t,priority:isPriority(t)};}).sort(function(a,b){return b.priority-a.priority;});
  }
  function coverageView(){
    var y=String(state.year),list=items().filter(function(it){return String(it.date).slice(0,4)===y&&inProgramme(it);});
    var head=COVER.map(function(k){return '<th scope="col">'+esc(k.label)+'<small>'+esc(k.hint)+'</small></th>';}).join('');
    var rows=coverageRows(list).map(function(r){
      var gap=false,cells=COVER.map(function(k){var its=coverItems(r.theme,k.key,list);
        if(!its.length){gap=true;return '<td></td>';}
        var done=its.some(function(it){return it.status==='done';});
        var label=its.length+(done?' : réalisé':' : prévu');
        return '<td><button type="button" class="dr-cover-cell '+(done?'is-done':'is-planned')+'" data-cover="'+esc(r.theme+'|'+k.key)+'" aria-label="'+esc(r.theme+', '+k.label+', '+label)+'">'+(done?'✓':'○')+'</button></td>';}).join('');
      return '<tr'+(r.priority?' class="is-priority"':'')+'><th scope="row">'+(r.priority?'<span aria-label="Priorité de l’année">★ </span>':'')+esc(r.theme)+(r.priority&&gap&&isClient?'<a class="dr-cover-link" href="offres.html?from=cockpit">Voir les solutions</a>':'')+'</th>'+cells+'</tr>';}).join('');
    return '<article class="dp-card dr-png-wrap dr-cover" id="dr-png-couverture"><header><h3>🧭 Couverture de votre programme '+y+'</h3>'+pngButton('dr-png-couverture','couverture')+'</header>'+
      '<p class="dr-row-meta">✓ réalisé · ○ prévu · ★ priorité de l’année. Une case vide n’est pas un manque : ce tableau vous aide à voir où vous en êtes. Cliquez sur une case pour voir le détail.</p>'+
      '<div class="dr-cover-scroll"><table><thead><tr><th scope="col">Thématique</th>'+head+'</tr></thead><tbody>'+rows+'</tbody></table></div></article>';
  }

  // ── Dispositifs : plusieurs actions et diagnostics réunis sous un nom ──
  function dispositifItems(id){return items().filter(function(it){return String(it.dispositifId||'')===String(id);});}
  function dispositifCard(x,canEdit){
    var its=dispositifItems(x.id),live=its.filter(inProgramme),done=live.filter(function(it){return it.status==='done';}).length,planned=live.length-done;
    var people=live.filter(function(it){return it.status==='done'||it.type==='campaign';}).reduce(function(s,it){return s+(Number(it.people)||0);},0);
    var lines=its.map(function(it){var k=kind(it.kind),st=it.type==='campaign'?campaignStatusLabel(it):(state.data.statuses||{})[it.status]||it.status;
      return '<li><span aria-hidden="true">'+esc(k.icon)+'</span><span class="dr-disp-line"><strong>'+esc(it.title)+'</strong><small>'+esc(fmtDate(it.start||it.date))+'</small></span><span class="dr-badge st-'+esc(it.status)+'">'+esc(st)+'</span>'+
        (canEdit&&it.type==='campaign'?'<button type="button" class="dr-x" data-disp-detach="'+esc(x.id)+':'+esc(it.id)+'" aria-label="Retirer '+esc(it.title)+' du dispositif">×</button>':'')+'</li>';}).join('');
    return '<article class="dr-disp"><h3>'+esc(x.name)+'</h3>'+(x.objective?'<p class="dr-row-notes"><strong>Objectif :</strong> '+esc(x.objective)+'</p>':'')+(x.theme?'<p class="dr-row-meta">'+esc(x.theme)+'</p>':'')+
      '<p class="dr-disp-count"><strong>'+done+' réalisée'+(done>1?'s':'')+' · '+planned+' prévue'+(planned>1?'s':'')+'</strong>'+(people?' · '+num(people)+' personne'+(people>1?'s':'')+' touchée'+(people>1?'s':''):'')+'</p>'+
      (lines?'<ul class="dr-disp-list">'+lines+'</ul>':'<p class="dr-empty">Rien pour l’instant : ajoutez une action ou rattachez un diagnostic.</p>')+
      (canEdit?'<div class="dr-disp-tools"><div class="dr-disp-main"><button type="button" class="button button-secondary" data-disp-compose="'+esc(x.id)+'">＋ Ajouter des actions</button><button type="button" class="button button-secondary" data-disp-attach="'+esc(x.id)+'">＋ Rattacher un diagnostic</button></div>'+
        '<div class="dr-disp-more"><button type="button" class="dr-link" data-disp-edit="'+esc(x.id)+'">Modifier le dispositif</button><button type="button" class="dr-link" data-disp-delete="'+esc(x.id)+'">Supprimer</button></div></div>':'')+'</article>';
  }
  function dispositifsView(years){
    var d=state.data,canEdit=d.canEdit,list=(d.dispositifs||[]).filter(function(x){return x.inYear;});
    return '<div class="dr-head"><div><p class="eyebrow">Vos dispositifs</p><h2>Dispositifs '+state.year+'</h2>'+
      '<p>Un dispositif réunit plusieurs actions autour d’un même objectif : par exemple une conférence, un diagnostic et une formation pour la SEEPH. Il ne change pas vos chiffres, chaque action compte une seule fois.</p></div>'+
      '<div class="dr-head-actions"><div class="dr-years" role="group" aria-label="Choisir l’année">'+years+'</div>'+(canEdit?'<button type="button" class="button button-primary" data-disp-add>＋ Créer un dispositif</button>':'')+'</div></div>'+
      (list.length?'<div class="dr-disps">'+list.map(function(x){return dispositifCard(x,canEdit);}).join('')+'</div>':'<p class="dr-empty">Aucun dispositif en '+state.year+'.</p>');
  }
  function dispositifDialog(dispositif,onSaved){
    var x=dispositif||{year:state.year},d=state.data;
    var dlg=document.createElement('dialog');dlg.className='dr-dialog';
    dlg.innerHTML='<form><h2>'+(dispositif?'Modifier le dispositif':'Nouveau dispositif')+'</h2>'+
      '<label class="dr-field"><span>Nom *</span><input name="name" required maxlength="160" value="'+esc(x.name||'')+'" placeholder="Ex. : SEEPH 2027 — Dispositif Handicap"></label>'+
      '<label class="dr-field"><span>Objectif</span><input name="objective" maxlength="300" value="'+esc(x.objective||'')+'" placeholder="Ex. : faire évoluer le regard sur le handicap"></label>'+
      multiField('theme','Thématiques',THEMES,x.theme)+
      '<label class="dr-field dr-field-year"><span>Année *</span><input type="number" name="year" required min="2000" max="2100" value="'+esc(x.year)+'"></label>'+
      ((d.teamFolders||[]).length?'<label class="dr-field"><span>Dossier d’équipe'+(d.perimeter?' *':'')+'</span><select name="teamFolderId"'+(d.perimeter?' required':'')+'>'+(d.perimeter?'':'<option value="">— Toute l’entreprise —</option>')+d.teamFolders.map(function(t){return '<option value="'+esc(t.id)+'"'+(String(t.id)===String(x.team_folder_id||'')?' selected':'')+'>'+esc(t.name)+'</option>';}).join('')+'</select></label>':'')+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions"><button type="button" class="button button-ghost" data-close>Annuler</button><button type="submit" class="button button-primary">'+(dispositif||onSaved?'Enregistrer':'Continuer : choisir les formats')+'</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error');
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      if(!form.checkValidity()){form.reportValidity();return;}
      var f=new FormData(form),body=withOrg({name:f.get('name'),objective:f.get('objective'),theme:readMulti(form,'theme'),year:Number(f.get('year'))});
      if(form.elements.teamFolderId)body.teamFolderId=f.get('teamFolderId')||null;
      try{
        var r=await StudioAPI.request('/api/dei/dispositifs'+(dispositif?'/'+encodeURIComponent(dispositif.id)+qs():''),{method:dispositif?'PATCH':'POST',body:JSON.stringify(body)});
        dlg.close();if(onSaved)onSaved(r.dispositif);else{load();if(!dispositif)composeDialog(r.dispositif,true);}
      }catch(e){err.textContent=e.message||'Enregistrement impossible';err.hidden=false;}
    };
    dlg.showModal();
  }
  // Composer un dispositif : une action prévue par format coché, à compléter ensuite une par une.
  function composeDialog(x,justCreated){
    var d=state.data,kinds=Object.keys(d.kinds).sort(function(a,b){return (b==='diagnostic')-(a==='diagnostic');});
    var theme=String(x.theme||'').split(',')[0].trim();
    var dlg=document.createElement('dialog');dlg.className='dr-dialog';
    dlg.innerHTML='<form><h2>Ajouter des actions</h2><p class="dr-row-meta">Cochez les formats prévus, y compris un diagnostic à venir : une action « Prévue » est créée pour chacun dans « '+esc(x.name)+' ». Un diagnostic déjà lancé ou programmé se rattache avec le bouton de la carte.</p>'+
      '<fieldset class="dr-compose"><legend>Formats</legend>'+kinds.map(function(k){return '<label class="dr-check"><input type="checkbox" name="kind" value="'+esc(k)+'"> '+esc(d.kinds[k].icon+' '+d.kinds[k].label)+'</label>';}).join('')+'</fieldset>'+
      '<label class="dr-field dr-field-date"><span>Date prévue *</span><input type="date" name="actionDate" required value="'+esc(x.year+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-15')+'"></label>'+
      '<button type="button" class="dr-link" data-compose-single>Préférez-vous saisir une seule action en détail ?</button>'+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions"><button type="button" class="button button-ghost" data-close>'+(justCreated?'Plus tard':'Annuler')+'</button><button type="submit" class="button button-primary">Créer les actions</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error');
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    dlg.querySelector('[data-compose-single]').onclick=function(){dlg.close();editDialog(null,null,{dispositif_id:x.id,theme:x.theme});};
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      if(!form.checkValidity()){form.reportValidity();return;}
      var picked=new FormData(form).getAll('kind');
      if(!picked.length){err.textContent='Cochez au moins un format.';err.hidden=false;return;}
      var button=form.querySelector('[type=submit]'),made=0;button.disabled=true;
      try{
        for(var i=0;i<picked.length;i++){
          var body=withOrg({kind:picked[i],title:d.kinds[picked[i]].label.replace(' (Studio)','')+(theme?' — '+theme:''),actionDate:form.elements.actionDate.value,status:'planned',theme:x.theme||'',dispositifId:x.id});
          if(x.team_folder_id)body.teamFolderId=x.team_folder_id;
          await StudioAPI.request('/api/dei/actions',{method:'POST',body:JSON.stringify(body)});made++;
        }
        dlg.close();load();
      }catch(e){button.disabled=false;err.textContent=(made?made+' action'+(made>1?'s':'')+' créée'+(made>1?'s':'')+'. ':'')+(e.message||'Création impossible');err.hidden=false;if(made)load();}
    };
    dlg.showModal();
  }
  function attachDialog(id){
    var free=items().filter(function(it){return it.type==='campaign'&&String(it.dispositifId||'')!==String(id);});
    if(!free.length){window.StudioModal.alert({title:'Aucun diagnostic à rattacher',message:'Aucun autre diagnostic n’est lancé ou programmé cette année. Pour en prévoir un, cochez « Diagnostic » dans « Ajouter des actions ».'});return;}
    // Diagnostic prévu dans le dispositif : la vraie campagne le remplace, pour ne pas le compter deux fois.
    var planned=items().find(function(it){return it.type==='action'&&it.kind==='diagnostic'&&String(it.dispositifId||'')===String(id)&&it.status!=='done'&&it.status!=='cancelled';});
    var dlg=document.createElement('dialog');dlg.className='dr-dialog';
    dlg.innerHTML='<form><h2>Rattacher un diagnostic</h2><label class="dr-field"><span>Diagnostic</span><select name="campaignId">'+free.map(function(it){return '<option value="'+esc(it.id)+'">'+esc(it.title)+(it.dispositifId?' (déjà dans un autre dispositif)':'')+'</option>';}).join('')+'</select></label>'+
      (planned?'<label class="dr-check"><input type="checkbox" name="replace" checked> Remplacer la ligne prévue « '+esc(planned.title)+' » par ce diagnostic</label>':'')+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions"><button type="button" class="button button-ghost" data-close>Annuler</button><button type="submit" class="button button-primary">Rattacher</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error');
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      try{await StudioAPI.request('/api/dei/dispositifs/'+encodeURIComponent(id)+'/diagnostics/'+encodeURIComponent(form.elements.campaignId.value)+qs(),{method:'PUT',body:JSON.stringify(withOrg({}))});
        if(planned&&form.elements.replace.checked)await StudioAPI.request('/api/dei/actions/'+encodeURIComponent(planned.id)+qs(),{method:'DELETE'});
        dlg.close();load();}
      catch(e){err.textContent=e.message||'Rattachement impossible';err.hidden=false;}
    };
    dlg.showModal();
  }
  async function removeDispositif(id){
    var x=(state.data.dispositifs||[]).find(function(y){return String(y.id)===String(id);});if(!x)return;
    var ok=await window.StudioModal.confirm({eyebrow:'Dispositifs',title:'Supprimer « '+x.name+' » ?',message:'Les actions et diagnostics restent dans votre registre : seul le regroupement disparaît.',confirmLabel:'Supprimer'});
    if(!ok)return;
    try{await StudioAPI.request('/api/dei/dispositifs/'+encodeURIComponent(id)+qs(),{method:'DELETE'});load();}catch(e){window.StudioModal.alert({title:'Suppression impossible',message:e.message});}
  }

  // ── Annuaire des prestataires ──
  function providerName(p){return [p.company,[p.first_name,p.last_name].filter(Boolean).join(' ')].filter(Boolean).join(' · ');}
  function providersView(){
    var d=state.data,list=d.providers||[],canEdit=d.canEdit;
    var head='<div class="dr-head"><div><p class="eyebrow">Annuaire</p><h2>'+(organizationId?'Prestataires de '+esc(d.organizationName||'ce client'):'Vos prestataires D&amp;I')+'</h2>'+
      '<p>Cabinets, formateurs, associations, intervenants : gardez leurs coordonnées à portée de main et reliez-les à vos actions. Renseignez uniquement des coordonnées professionnelles.</p>'+
      '<p class="dr-review-privacy">'+(isAdmin?'🔒 Les avis de ce client sur ses prestataires sont masqués à Me&amp;YouToo : seuls ceux sur nos propres actions apparaissent ici.':'🔒 Vos avis sur vos prestataires restent internes à votre entreprise : ils ne leur sont jamais transmis et Me&amp;YouToo ne les voit pas. Seuls vos avis sur les actions de Me&amp;YouToo sont lus par notre équipe.')+'</p></div>'+
      (canEdit?'<div class="dr-head-actions"><button type="button" class="button button-primary" data-provider-add>＋ Ajouter un prestataire</button></div>':'')+'</div>';
    // Me&YouToo n'a pas de fiche dans l'annuaire : sa carte n'apparaît que s'il a mené des actions réalisées.
    var meayt=providerRows('meayt').length?'<article class="dr-provider"><h4 class="dr-meayt-by">'+MEAYT_LOGO+'Me&amp;YouToo</h4><p class="dr-row-meta">Actions animées par Me&amp;YouToo</p>'+reviewsFooter('meayt','Me&YouToo')+'</article>':'';
    if(!list.length&&!meayt)return head+'<p class="dr-empty">Aucun prestataire enregistré pour le moment.</p>';
    return head+'<div class="dr-providers">'+meayt+list.map(function(p){
      var contact=[p.first_name,p.last_name].filter(Boolean).join(' ');
      return '<article class="dr-provider"><h4>'+esc(p.company||contact)+'</h4>'+(p.company&&contact?'<p class="dr-provider-contact">'+esc(contact)+'</p>':'')+
        (p.specialty?'<p class="dr-row-meta">'+esc(p.specialty)+'</p>':'')+
        '<p class="dr-provider-lines">'+(p.email?'<a href="mailto:'+esc(p.email)+'">✉ '+esc(p.email)+'</a>':'')+(p.phone?'<a href="tel:'+esc(p.phone.replace(/\s+/g,''))+'">☎ '+esc(p.phone)+'</a>':'')+'</p>'+
        (p.notes?'<p class="dr-row-notes">'+esc(p.notes)+'</p>':'')+
        '<p class="dr-row-meta">'+(p.actions_count?p.actions_count+' action'+(p.actions_count>1?'s':'')+' rattachée'+(p.actions_count>1?'s':''):'Aucune action rattachée')+'</p>'+reviewsFooter(p.id,p.company||contact)+
        (canEdit?'<div class="dr-row-tools"><button type="button" class="button button-ghost" data-provider-edit="'+esc(p.id)+'">Modifier</button><button type="button" class="button button-ghost" data-provider-delete="'+esc(p.id)+'">Supprimer</button></div>':'')+'</article>';
    }).join('')+'</div>';
  }
  function providerDialog(provider,onSaved){
    var p=provider||{};
    var dlg=document.createElement('dialog');dlg.className='dr-dialog';
    dlg.innerHTML='<form><h2>'+(provider?'Modifier le prestataire':'Nouveau prestataire')+'</h2>'+
      '<label class="dr-field"><span>Nom de l’entreprise ou de la structure</span><input name="company" maxlength="160" value="'+esc(p.company||'')+'" placeholder="Ex. : Cabinet Inclusio, Association Handi+…"></label>'+
      '<div class="dr-field-row"><label class="dr-field"><span>Prénom</span><input name="firstName" maxlength="80" value="'+esc(p.first_name||'')+'"></label><label class="dr-field"><span>Nom</span><input name="lastName" maxlength="80" value="'+esc(p.last_name||'')+'"></label></div>'+
      '<div class="dr-field-row"><label class="dr-field"><span>E-mail</span><input type="email" name="email" maxlength="160" value="'+esc(p.email||'')+'"></label><label class="dr-field"><span>Téléphone</span><input type="tel" name="phone" maxlength="40" value="'+esc(p.phone||'')+'"></label></div>'+
      multiField('specialty','Domaines d’intervention',DOMAINS,p.specialty)+
      '<label class="dr-field"><span>Notes</span><textarea name="notes" rows="2" maxlength="2000">'+esc(p.notes||'')+'</textarea></label>'+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions"><button type="button" class="button button-ghost" data-close>Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error');
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      if(!form.checkValidity()){form.reportValidity();return;}
      var f=new FormData(form),body=withOrg({company:f.get('company'),firstName:f.get('firstName'),lastName:f.get('lastName'),email:f.get('email'),phone:f.get('phone'),specialty:readMulti(form,'specialty'),notes:f.get('notes')});
      try{
        var r=await StudioAPI.request('/api/dei/providers'+(provider?'/'+encodeURIComponent(provider.id)+qs():''),{method:provider?'PATCH':'POST',body:JSON.stringify(body)});
        dlg.close();if(onSaved)onSaved(provider?provider.id:r.provider&&r.provider.id);else load();
      }catch(e){err.textContent=e.message||'Enregistrement impossible';err.hidden=false;}
    };
    dlg.showModal();
  }
  async function removeProvider(id){
    var p=(state.data.providers||[]).find(function(x){return String(x.id)===String(id);});if(!p)return;
    var ok=await window.StudioModal.confirm({eyebrow:'Prestataires',title:'Supprimer « '+providerName(p)+' » ?',message:'Ses coordonnées et les avis qui le concernent seront effacés. Les actions rattachées sont conservées, sans prestataire.',confirmLabel:'Supprimer'});
    if(!ok)return;
    try{await StudioAPI.request('/api/dei/providers/'+encodeURIComponent(id)+qs(),{method:'DELETE'});load();}catch(e){window.StudioModal.alert({title:'Suppression impossible',message:e.message});}
  }
  // Carte chiffrée cliquable : ouvre le détail de ce qu'elle compte.
  function kpi(value,label,hint,cls,key){return '<button type="button" class="dr-kpi '+(cls||'')+'" data-kpi="'+esc(key)+'" aria-haspopup="dialog"><strong>'+value+'</strong><span>'+label+'</span><small>'+hint+'</small><em class="dr-kpi-more">Voir le détail →</em></button>';}
  // Détail d'une carte : les actions et diagnostics de l'année derrière le chiffre, chacun menant à sa fiche.
  function kpiDetail(key){
    var y=String(state.year),year=items().filter(function(it){return String(it.date).slice(0,4)===y;}),list=year.filter(inProgramme);
    var themesOf=function(it){return String(it.theme||'').split(',').map(function(s){return s.trim();}).filter(Boolean);};
    var line=function(it,extra){var k=kind(it.kind),st=it.type==='campaign'?campaignStatusLabel(it):(state.data.statuses||{})[it.status]||it.status;
      var when=fmtDate(it.start||it.date)+(it.end&&it.end!==it.date?' → '+fmtDate(it.end):'');
      return '<li><button type="button" class="dr-detail-line" data-go="'+esc(it.type+'-'+it.id)+'"><span class="dr-detail-ico" aria-hidden="true">'+esc(k.icon)+'</span><span class="dr-detail-main"><strong>'+esc(it.title)+'</strong><small>'+
        esc([it.type==='campaign'?'Diagnostic comportemental':k.label,when].concat(extra||[]).filter(Boolean).join(' · '))+'</small></span><span class="dr-badge st-'+esc(it.status)+'">'+esc(st)+'</span></button></li>';};
    var group=function(title,its,extra){return its.length?'<h3 class="dr-detail-group">'+esc(title)+' <span>'+its.length+'</span></h3><ul class="dr-detail-list">'+its.map(function(it){return line(it,extra&&extra(it));}).join('')+'</ul>':'';};
    var people=function(it){return it.people!=null?num(it.people)+(it.type==='campaign'?' participations':' personnes'):'';};
    var title,intro='',body='';
    if(key==='actions'){title='Actions et diagnostics de '+y;
      body=group('Réalisées',list.filter(function(it){return it.status==='done';}),people)+group('À venir ou en cours',list.filter(function(it){return it.status!=='done';}),people)+
        group('Reportées',year.filter(function(it){return it.status==='postponed';}))+group('Annulées',year.filter(function(it){return it.status==='cancelled';}));}
    else if(key==='people'){title='Personnes touchées en '+y;
      var counted=list.filter(function(it){return (it.status==='done'||it.type==='campaign')&&Number(it.people)>0;}).sort(function(a,b){return b.people-a.people;});
      intro='Participations aux diagnostics et personnes touchées par les actions réalisées. Une même personne peut avoir participé à plusieurs actions.';
      body=group('Ce qui compte dans le total',counted,people)+group('Pas encore comptées (action à venir ou sans nombre renseigné)',list.filter(function(it){return counted.indexOf(it)<0;}));}
    else if(key==='formats'){title='Formats utilisés en '+y;
      var byKind={};list.forEach(function(it){(byKind[it.kind]=byKind[it.kind]||[]).push(it);});
      body=Object.keys(byKind).map(function(k){var kd=kind(k);return group(kd.icon+' '+(k==='diagnostic'?'Diagnostics comportementaux':kd.label),byKind[k],people);}).join('');}
    else if(key==='themes'){title='Thématiques couvertes en '+y;
      var byTheme={},none=[];list.forEach(function(it){var th=themesOf(it);if(!th.length)none.push(it);th.forEach(function(t){(byTheme[t]=byTheme[t]||[]).push(it);});});
      body=Object.keys(byTheme).sort(function(a,b){return a.localeCompare(b,'fr');}).map(function(t){return group(t,byTheme[t]);}).join('')+group('Sans thématique renseignée',none);}
    else if(key.indexOf('cover|')===0){var cv=key.split('|'),col=COVER.filter(function(k){return k.key===cv[2];})[0];title=cv[1]+' · '+col.label;intro=col.hint;
      var cover=coverItems(cv[1],cv[2],list);body=group('Réalisées',cover.filter(function(it){return it.status==='done';}))+group('Prévues ou en cours',cover.filter(function(it){return it.status!=='done';}));}
    else if(key==='months'){title='Mois sans action en '+y;
      var gaps=(state.data.indicators.months||[]).map(function(c,m){return c?null:m;}).filter(function(m){return m!==null;});
      var nowY=new Date().getFullYear(),elapsed=state.year<nowY?12:state.year>nowY?0:new Date().getMonth()+1;
      gaps=gaps.filter(function(m){return m<elapsed;});
      intro='Les mois déjà écoulés sans aucune action ni diagnostic. Une action régulière entretient la dynamique.';
      body=gaps.length?'<ul class="dr-detail-list">'+gaps.map(function(m){return '<li class="dr-detail-month"><strong>'+esc(MONTHS[m])+' '+y+'</strong>'+
        (isClient?'<button type="button" class="dr-link" data-go-month="'+m+'">Être accompagné →</button>':(state.data.canEdit?'<button type="button" class="dr-link" data-go-add-month="'+m+'">＋ Ajouter une action</button>':''))+'</li>';}).join('')+'</ul>':'<p class="dr-empty">Aucun mois sans action : bravo pour la régularité.</p>';}
    if(!body&&key!=='months')body='<p class="dr-empty">Rien d’enregistré pour '+y+'.</p>';
    var dlg=document.createElement('dialog');dlg.className='dr-dialog dr-detail';
    dlg.innerHTML='<form method="dialog"><h2>'+esc(title)+'</h2>'+(intro?'<p class="dr-detail-intro">'+esc(intro)+'</p>':'')+body+
      '<div class="dr-dialog-actions"><button type="submit" class="button button-ghost">Fermer</button></div></form>';
    document.body.appendChild(dlg);
    dlg.addEventListener('close',function(){dlg.remove();});
    dlg.addEventListener('click',function(ev){var b=ev.target.closest('[data-go],[data-go-month],[data-go-add-month]');if(!b)return;ev.preventDefault();dlg.close();
      if(b.hasAttribute('data-go')){var go=b.getAttribute('data-go');
        // Un diagnostic s'ouvre sur sa campagne ; une action sur sa fiche dans l'onglet Actions.
        if(/^campaign-/.test(go))location.href='campagne-detail.html?projectId='+encodeURIComponent(go.slice(9));else focusItem(go);}
      else{var sel=b.hasAttribute('data-go-month')?'[data-month="'+b.getAttribute('data-go-month')+'"]':'[data-add-month="'+b.getAttribute('data-go-add-month')+'"]';var target=root.querySelector(sel);if(target)target.click();}
    });
    dlg.showModal();
  }
  // Montre une action (ou un diagnostic) dans l'onglet Actions.
  function focusItem(focus){setTab('actions');
    setTimeout(function(){var el=document.getElementById('dr-'+focus);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('is-focus');setTimeout(function(){el.classList.remove('is-focus');},1600);}},150);}

  function campaignName(id){var c=((state.data.diagnostics||{}).campaigns||[]).find(function(x){return String(x.id)===String(id);});return c?c.name:'';}
  var MEAYT_LOGO='<img class="dr-meayt-logo" src="assets/img/brand/logo-meayt-small.png" alt="">';
  function recoTip(id){var n=campaignName(id);return 'Recommandée lors de la restitution'+(n?' du diagnostic « '+n+' »':' de votre diagnostic');}
  function row(it){
    var k=kind(it.kind),st=it.type==='campaign'?campaignStatusLabel(it):(state.data.statuses||{})[it.status]||it.status,canEdit=state.data.canEdit&&it.type==='action';
    var when=fmtDate(it.start||it.date)+(it.end&&it.end!==it.date?' → '+fmtDate(it.end):'');
    var rv=it.type==='action'&&it.status==='done'?reviewRow(it.id):null;
    var by=it.meayt?'<span class="dr-meayt-by">avec '+MEAYT_LOGO+'Me&amp;YouToo</span>':it.provider?esc('avec '+it.provider):'';
    var meta=[it.theme,it.audience,it.people!=null?num(it.people)+(it.type==='campaign'?' participations':' personnes touchées'):''].filter(Boolean).map(esc).concat(by?[by]:[],it.recommended?[esc(recoTip(it.campaignId))]:[]).join(' · ');
    var dispositif=it.dispositifId&&(state.data.dispositifs||[]).find(function(x){return String(x.id)===String(it.dispositifId);});
    if(dispositif)meta+=(meta?' · ':'')+'dispositif « '+esc(dispositif.name)+' »';
    if(it.postponedFrom&&it.status!=='done')meta+=(meta?' · ':'')+'reportée du '+esc(fmtDate(it.postponedFrom));
    var budget=it.budget!=null?'<p class="dr-row-meta">Budget : <strong>'+euros(it.budget)+'</strong> <span class="dr-budget-lock is-inline">'+BUDGET_NOTICE+'</span></p>':'';
    var docs=(it.documents||[]).map(function(doc){return '<span class="dr-doc"><button type="button" class="dr-link" data-download="'+esc(it.id)+':'+esc(doc.id)+'" data-filename="'+esc(doc.filename)+'">📎 '+esc(doc.filename)+'</button>'+(canEdit?'<button type="button" class="dr-x" data-doc-delete="'+esc(it.id)+':'+esc(doc.id)+'" aria-label="Retirer '+esc(doc.filename)+'">×</button>':'')+'</span>';}).join('');
    var tools=it.type==='campaign'
      ?'<a class="dr-link" href="campagne-detail.html?projectId='+encodeURIComponent(it.id)+(organizationId?'':'')+'">Voir la campagne →</a>'
      :((canEdit?'<button type="button" class="button button-ghost" data-edit="'+esc(it.id)+'">Modifier</button><label class="button button-ghost dr-upload">Joindre un document<input type="file" accept="application/pdf,image/png,image/jpeg" data-upload="'+esc(it.id)+'" hidden></label><button type="button" class="button button-ghost" data-delete="'+esc(it.id)+'">Supprimer</button>':'')+
        (isClient&&it.status!=='done'&&it.status!=='cancelled'?'<button type="button" class="dr-link" data-accompany="'+esc(it.id)+'">Être accompagné sur cette action →</button>':''));
    return '<article class="dr-row'+(it.status==='cancelled'?' is-cancelled':'')+'" id="dr-'+esc(it.type+'-'+it.id)+'"><div class="dr-row-icon" aria-hidden="true">'+esc(k.icon)+'</div><div class="dr-row-main">'+
      '<p class="dr-row-kind">'+esc(it.type==='campaign'?'Diagnostic comportemental · Studio':k.label)+(it.meayt?' <span class="dr-badge is-meayt">Animée par Me&amp;YouToo</span>':'')+(it.recommended?' <span class="dr-badge is-reco">Recommandée par Me&amp;YouToo</span>':'')+' <span class="dr-badge st-'+esc(it.status)+'">'+esc(st)+'</span></p>'+
      '<h4>'+esc(it.title)+'</h4><p class="dr-row-when">'+esc(when)+'</p>'+(meta?'<p class="dr-row-meta">'+meta+'</p>':'')+
      (it.objective?'<p class="dr-row-notes"><strong>Objectif :</strong> '+esc(it.objective)+'</p>':'')+(it.notes?'<p class="dr-row-notes">'+esc(it.notes)+'</p>':'')+
      (it.results&&it.status==='done'?'<p class="dr-row-notes"><strong>Résultats et enseignements :</strong> '+esc(it.results)+'</p>':'')+budget+
      reviewBox(rv,it.id)+
      (docs?'<div class="dr-docs">'+docs+'</div>':'')+'<div class="dr-row-tools">'+tools+'</div></div></article>';
  }

  // ── Saisie ──
  // ── Tableau de pilotage : objectifs, trimestres, échéances, points d'attention ──
  var EVENT_ICONS={action:'🗓️',campaign_start:'🚀',campaign_end:'🏁',task:'✅',event:'📣'};
  function shortDate(v){var d=new Date(String(v).slice(0,10)+'T12:00:00');return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});}
  function pilotageView(){
    var p=state.data.pilotage;if(!p)return '';
    var canEdit=state.data.canEdit;
    // Objectifs
    var objs=p.objectives.map(function(o){
      var custom=o.metric==='custom',strategic=o.metric==='strategic',manual=custom||strategic;
      var title=custom?o.label:strategic?(o.label||('Enjeu : '+o.themes)):(o.metricLabel+(o.label?' — '+o.label:''));
      var pct,reached,figure;
      if(strategic){
        // Enjeu stratégique : coché à la main quand il est atteint ; jauge sur les personnes touchées si un chiffre est fixé.
        var s=o.strategic||{done:0,planned:0,people:0};
        reached=o.done;pct=o.done?100:(o.target?Math.min(100,Math.round(s.people/o.target*100)):(s.done?50:0));
        figure=(o.done?'Atteint':s.done+' action'+(s.done>1?'s':'')+' réalisée'+(s.done>1?'s':'')+(s.planned?' · '+s.planned+' prévue'+(s.planned>1?'s':''):''))+(o.target?' · '+num(s.people)+' / '+num(o.target)+' pers.':'');
      }else{
        pct=custom?(o.done?100:0):(o.value==null||!o.target?0:Math.min(100,Math.round(o.value/o.target*100)));
        reached=custom?o.done:(o.value!=null&&o.target&&o.value>=o.target);
        figure=custom?(o.done?'Atteint':'À atteindre'):(o.value==null?'Pas encore mesurable':num(o.value)+' / '+num(o.target)+(o.unit==='%'?' %':' '+o.unit));
      }
      var meta=[strategic&&o.themes&&o.label?'Thématiques : '+o.themes:'',o.themeProgress&&o.themeProgress.missing.length?'Reste : '+o.themeProgress.missing.join(', '):'',o.audiences?'Publics : '+o.audiences:''].filter(Boolean).map(esc).join(' · ');
      return '<li class="dp-obj'+(reached?' is-reached':'')+(strategic?' is-strategic':'')+'">'+(o.suggestion_key?'<span class="dp-suggested">Proposé par Me&amp;YouToo</span>':'')+'<div class="dp-obj-head"><strong>'+esc(title)+'</strong><span>'+esc(figure)+(reached?' ✓':'')+'</span></div>'+
        (meta?'<p class="dp-obj-meta">'+meta+'</p>':'')+
        '<div class="dp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><i style="width:'+pct+'%"></i></div>'+
        (canEdit?'<div class="dp-obj-tools">'+(manual?'<label class="dr-check"><input type="checkbox" data-obj-done="'+esc(o.id)+'"'+(o.done?' checked':'')+'> Atteint</label>':'')+'<button type="button" class="dr-link" data-obj-edit="'+esc(o.id)+'">Modifier</button><button type="button" class="dr-link" data-obj-delete="'+esc(o.id)+'">Retirer</button></div>':'')+'</li>';
    }).join('');
    var objCard=state.data.perimeter?'':'<article class="dp-card dr-png-wrap" id="dr-png-objectifs"><header><h3>🎯 Objectifs '+state.year+'</h3>'+pngButton('dr-png-objectifs','objectifs')+(canEdit&&p.objectives.length<p.maxObjectives?'<button type="button" class="button button-ghost" data-obj-add>＋ Fixer un objectif</button>':'')+'</header>'+
      (objs?'<ul class="dp-objs">'+objs+'</ul>':'<p class="dr-empty">Fixez 3 à 5 objectifs pour l’année : la progression se calcule toute seule à partir de vos actions et de vos diagnostics.</p>'+
        (canEdit?'<div class="dp-suggest">'+[['actions_done',12,'12 actions et diagnostics'],['active_quarters',4,'Une action chaque trimestre'],['themes','','Couvrir vos thématiques prioritaires'],['people_reached',1000,'1 000 personnes touchées']].map(function(s){return '<button type="button" class="dr-chip-btn" data-obj-suggest="'+s[0]+':'+s[1]+'">＋ '+s[2]+'</button>';}).join('')+'</div>':''))+'</article>';
    // Trimestres
    var maxQ=Math.max(1,Math.max.apply(null,p.quarters.map(function(q){return q.done+q.planned+q.late;})));
    var qCard='<article class="dp-card dr-png-wrap" id="dr-png-trimestres"><header><h3>📊 Prévu / réalisé par trimestre</h3>'+pngButton('dr-png-trimestres','trimestres')+'</header><div class="dp-quarters">'+p.quarters.map(function(q){
      var h=function(n){return Math.round(n/maxQ*100);};
      return '<div class="dp-q"><div class="dp-q-bars" aria-hidden="true"><i class="is-done" style="height:'+h(q.done)+'%"></i><i class="is-planned" style="height:'+h(q.planned)+'%"></i><i class="is-late" style="height:'+h(q.late)+'%"></i></div>'+
        '<strong>T'+q.quarter+'</strong><small>'+q.done+' réalisée'+(q.done>1?'s':'')+(q.planned?' · '+q.planned+' en cours ou prévue'+(q.planned>1?'s':''):'')+(q.late?' · <b>'+q.late+' en retard</b>':'')+(q.postponed?' · '+q.postponed+' reportée'+(q.postponed>1?'s':''):'')+'</small></div>';
    }).join('')+'</div><ul class="dp-legend"><li class="is-done">Réalisées</li><li class="is-planned">En cours ou prévues</li><li class="is-late">En retard</li></ul></article>';
    if(!p.current)return '<section class="dp-grid">'+plansView()+objCard+qCard+'</section>';
    // Échéances
    var up=(p.upcoming||[]).slice(0,8).map(function(u){
      var link=u.type==='action'?'<button type="button" class="dr-link" data-focus="action-'+esc(u.id)+'">Voir</button>'
        :(u.type==='campaign_start'||u.type==='campaign_end')?'<a class="dr-link" href="campagne-detail.html?projectId='+encodeURIComponent(u.id)+'">Voir</a>'
        :u.type==='task'?'<a class="dr-link" href="'+calendarHref()+'">Voir</a>'
        :(canEdit?'<button type="button" class="dr-link" data-prepare="'+esc(u.date)+'" data-theme="'+esc(u.theme||'')+'" data-title="'+esc(u.title)+'">Préparer</button>':(isClient?'<button type="button" class="dr-link" data-event-help="'+esc(u.title)+'">Être accompagné</button>':''));
      var kindLabel={action:'Action prévue',campaign_start:'Lancement de campagne',campaign_end:'Clôture de campagne',task:'Tâche',event:'Temps fort D&I'}[u.type]||'';
      return '<li><span class="dp-date">'+esc(shortDate(u.date))+'</span><span class="dp-ico" aria-hidden="true">'+EVENT_ICONS[u.type]+'</span><div><strong>'+esc(u.title)+'</strong><small>'+esc(kindLabel)+'</small></div>'+link+'</li>';
    }).join('');
    var upCard='<article class="dp-card"><header><h3>⏰ Prochaines échéances (60 jours)</h3></header>'+(up?'<ul class="dp-list">'+up+'</ul>':'<p class="dr-empty">Rien de prévu dans les 60 prochains jours.</p>')+'</article>';
    // Points d'attention
    var a=p.attention||{},alerts=[];
    (a.late||[]).forEach(function(l){alerts.push('<li class="is-warn"><span class="dp-ico" aria-hidden="true">⚠️</span><div><strong>'+esc(l.title)+'</strong><small>Prévue le '+esc(fmtDate(l.date))+' : est-elle réalisée ?</small></div>'+(canEdit?'<button type="button" class="dr-link" data-late-edit="'+esc(l.id)+'" data-year-of="'+esc(String(l.date).slice(0,4))+'">Mettre à jour</button>':'')+'</li>');});
    (a.emptyMonths||[]).forEach(function(m){alerts.push('<li><span class="dp-ico" aria-hidden="true">🕳️</span><div><strong>Rien de prévu en '+MONTHS_LONG[m.month-1]+' '+m.year+'</strong><small>Un mois sans action casse la dynamique.</small></div>'+
      (canEdit&&m.year===state.year?'<button type="button" class="dr-link" data-add-month="'+(m.month-1)+'">Planifier</button>':'')+(isClient?'<button type="button" class="dr-link" data-month="'+(m.month-1)+'" data-month-year="'+m.year+'">Être accompagné</button>':'')+'</li>');});
    // Rappels réglementaires (ex. loi VSS) : renvoient vers l'objectif proposé de l'année concernée.
    (a.notices||[]).forEach(function(n){alerts.unshift('<li class="is-notice"><span class="dp-ico" aria-hidden="true">⚖️</span><div><strong>'+esc(n.title)+'</strong><small>'+esc(n.text)+'</small></div><button type="button" class="dr-link" data-year="'+esc(n.year)+'">Voir les objectifs '+esc(n.year)+'</button></li>');});
    // Diagnostic terminé sans restitution : on propose la conférence de restitution (vendue à part).
    var dg=state.data.diagnostics||{};
    if(p.current)(dg.restitutions||[]).forEach(function(c){
      var btn=isClient?(c.requested?'<span class="dp-sent">Demande envoyée ✓</span>':'<button type="button" class="dr-link" data-restitution="'+esc(c.id)+'">Demander la restitution</button>')
        :(canEdit?'<button type="button" class="dr-link" data-restitution-add="'+esc(c.id)+'">Saisir la restitution</button>':'');
      alerts.unshift('<li class="is-restitution"><span class="dp-ico" aria-hidden="true">🎤</span><div><strong>Diagnostic « '+esc(c.name)+' » terminé'+(c.closeDate?' le '+esc(shortDate(c.closeDate)):'')+'</strong><small>Conférence de restitution : notre experte inclusion & diversité et en statistiques analyse vos résultats, les situe par rapport à un benchmark anonyme d’autres entreprises et vous recommande des actions ciblées.</small></div>'+btn+'</li>');
    });
    if((a.uncoveredThemes||[]).length)alerts.push('<li><span class="dp-ico" aria-hidden="true">🧭</span><div><strong>Thématiques non travaillées depuis 12 mois</strong><small>'+esc(a.uncoveredThemes.join(', '))+'</small></div><a class="dr-link" href="'+(isAdmin?'offres.html':'offres.html')+'">Voir nos solutions</a></li>');
    var attCard='<article class="dp-card"><header><h3>🔎 Points d’attention</h3></header>'+(alerts.length?'<ul class="dp-list">'+alerts.join('')+'</ul>':'<p class="dr-empty">Rien à signaler, belle dynamique 👍</p>')+'</article>';
    return '<section class="dp-grid">'+plansView()+objCard+qCard+upCard+attCard+'</section>';
  }
  // Plans d'actions issus des diagnostics : la restitution, puis les actions recommandées et leur avancement.
  function plansView(){
    var plans=((state.data.diagnostics||{}).plans||[]).filter(function(pl){return pl.total||pl.restitution;}),canEdit=state.data.canEdit;
    if(!plans.length)return '';
    return '<article class="dp-card dp-wide dp-plans"><header><h3>🧭 Plans d’actions issus de vos diagnostics</h3></header>'+plans.slice(0,3).map(function(pl){
      var pct=pl.total?Math.round(pl.done/pl.total*100):0;
      var acts=pl.actions.map(function(x){return '<li><span class="dp-ico" aria-hidden="true">'+esc(kind(x.kind).icon)+'</span><div><strong>'+esc(x.title)+'</strong><small>'+esc(fmtDate(x.action_date))+(x.theme?' · '+esc(x.theme):'')+'</small></div>'+
        '<span class="dr-badge st-'+esc(x.status)+'">'+esc((state.data.statuses||{})[x.status]||x.status)+'</span>'+
        (isClient&&x.status!=='done'?'<button type="button" class="dr-link" data-reco-help="'+esc(x.id)+'" data-title="'+esc(x.title)+'">Être accompagné</button>':'')+'</li>';}).join('');
      return '<section class="dp-plan"><div class="dp-plan-head"><div><strong>Diagnostic « '+esc(pl.campaign.name)+' »</strong><small>'+
        (pl.restitution?'Restitution '+(pl.restitution.status==='done'?'le ':'prévue le ')+esc(fmtDate(pl.restitution.action_date)):'Restitution à planifier')+'</small></div>'+
        (pl.total?'<span class="dp-plan-count">'+pl.done+' réalisée'+(pl.done>1?'s':'')+' sur '+pl.total+' recommandation'+(pl.total>1?'s':'')+'</span>':'')+'</div>'+
        (pl.total?'<div class="dp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><i style="width:'+pct+'%"></i></div><ul class="dp-list">'+acts+'</ul>':'<p class="dr-empty">Les recommandations de la restitution apparaîtront ici.</p>')+
        (isAdmin&&canEdit?'<button type="button" class="button button-ghost" data-reco-add="'+esc(pl.campaign.id)+'">＋ Ajouter une recommandation</button>':'')+'</section>';
    }).join('')+'</article>';
  }
  // Demande de conférence de restitution : même circuit que les offres (notification, e-mail, transaction HubSpot).
  async function requestRestitution(id,fromLink){
    var dg=state.data.diagnostics||{},c=(dg.restitutions||[]).find(function(x){return String(x.id)===String(id);});
    if(!c){if(fromLink)window.StudioModal.alert({eyebrow:'Conférence de restitution',title:'Restitution déjà prévue',message:'Une restitution ou un plan d’actions est déjà rattaché à ce diagnostic : retrouvez-le dans « Plans d’actions issus des diagnostics ». Pour toute question : contact@meandyoutoo.app.'});return;}
    if(c.requested){if(fromLink)window.StudioModal.alert({eyebrow:'Conférence de restitution',title:'Demande déjà envoyée',type:'success',message:'Votre demande de restitution pour « '+c.name+' » nous est bien parvenue. Nous revenons vers vous pour fixer une date.'});return;}
    var message=await window.StudioModal.prompt({eyebrow:'Conférence de restitution',title:'Restitution du diagnostic « '+c.name+' »',
      message:'Notre experte inclusion & diversité et en statistiques analyse vos résultats, les situe par rapport à un benchmark anonyme d’autres entreprises et vous propose des recommandations d’actions ciblées. Nous revenons vers vous pour fixer une date et vous adresser une proposition.',
      inputLabel:'Vos attentes ou contraintes (facultatif)',placeholder:'Ex. : restitution au CODIR en janvier, en présentiel…',confirmLabel:'Demander la restitution'});
    if(message===null)return;
    try{var r=await StudioAPI.request('/api/offer-requests',{method:'POST',body:JSON.stringify({offerId:dg.restitutionOffer&&dg.restitutionOffer.id,source:'restitution',
        message:'Restitution du diagnostic « '+c.name+' »'+(message?' — '+message:''),context:{campaignId:String(c.id),campaign:c.name}})});
      window.StudioModal.alert({eyebrow:'Conférence de restitution',title:'Demande transmise',type:'success',message:r.message||'Votre demande a bien été transmise.'});load();}
    catch(e){window.StudioModal.alert({title:'Envoi impossible',message:e.message});}
  }
  function objectiveDialog(objective,preset){
    var p=state.data.pilotage,o=objective||preset||{metric:'strategic'};
    var opts=Object.keys(p.metrics).map(function(k){return '<option value="'+k+'"'+(k===o.metric?' selected':'')+'>'+esc(p.metrics[k].label)+'</option>';}).join('');
    var dlg=document.createElement('dialog');dlg.className='dr-dialog';
    dlg.innerHTML='<form><h2>'+(objective?'Modifier l’objectif':'Nouvel objectif '+state.year)+'</h2>'+
      '<label class="dr-field"><span>Type d’objectif</span><select name="metric">'+opts+'</select></label>'+
      '<p class="dr-row-meta" data-help></p>'+
      '<label class="dr-field"><span data-label-text>Précision (facultatif)</span><input name="label" maxlength="240" value="'+esc(o.label||'')+'"></label>'+
      '<div data-when="themes">'+multiField('themes','Thématiques visées',THEMES,o.themes)+'</div>'+
      '<div data-when="audiences">'+multiField('audiences','Publics visés',AUDIENCES,o.audiences)+'</div>'+
      '<label class="dr-field" data-when="target"><span data-target-text>Cible</span><input type="number" min="1" name="target" value="'+esc(o.target??'')+'"></label>'+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions"><button type="button" class="button button-ghost" data-close>Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error');
    // Chaque type guide sa saisie. Un ancien objectif Thématiques sans case cochée garde son chiffre.
    var GUIDE={
      strategic:{help:'Une priorité de l’année : vous la cochez quand elle est atteinte.',label:'Enjeu (facultatif si une thématique est cochée)',example:'Ex. : former tous les managers à la prévention des VSS',target:'Nombre de personnes à toucher (facultatif)',themes:true,audiences:true},
      actions_done:{help:'Actions réalisées et diagnostics du Studio de l’année.',example:'Ex. : au moins une action par site',target:'Combien d’actions et de diagnostics ? *'},
      people_reached:{help:'Personnes touchées par les actions réalisées et participations aux diagnostics. Une personne peut compter plusieurs fois.',example:'Ex. : la moitié des effectifs',target:'Combien de personnes ? *'},
      themes:{help:'Cochez les thématiques que vous voulez travailler cette année : la cible se calcule toute seule.',example:'Ex. : nos priorités issues du diagnostic',themes:true,noTarget:true},
      active_quarters:{help:'Pour garder une dynamique toute l’année.',example:'Ex. : une action forte par trimestre',target:'Combien de trimestres, de 1 à 4 ? *',max:4},
      participation:{help:'Moyenne des participations par rapport à l’objectif fixé sur chaque campagne.',example:'Ex. : mobiliser davantage les managers',target:'Pourcentage visé *',max:100},
      custom:{help:'Un objectif à votre façon : vous le cochez quand il est atteint.',label:'Objectif *',example:'Ex. : obtenir le label diversité',audiences:true,noTarget:true}
    };
    var keepsNumber=Boolean(objective&&objective.metric==='themes'&&!objective.themes);
    function sync(){
      var m=form.elements.metric.value,g=GUIDE[m]||{},legacy=m==='themes'&&keepsNumber;
      dlg.querySelector('[data-help]').textContent=g.help||'';
      dlg.querySelector('[data-when="target"]').hidden=Boolean(g.noTarget)&&!legacy;
      dlg.querySelector('[data-when="themes"]').hidden=!g.themes;
      dlg.querySelector('[data-when="audiences"]').hidden=!g.audiences;
      dlg.querySelector('[data-target-text]').textContent=legacy?'Nombre de thématiques (si aucune n’est cochée)':(g.target||'Cible chiffrée *');
      dlg.querySelector('[data-label-text]').textContent=g.label||'Précision (facultatif)';
      form.elements.label.placeholder=g.example||'';
      if(g.max)form.elements.target.max=g.max;else form.elements.target.removeAttribute('max');
    }
    form.elements.metric.onchange=sync;sync();
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      if(!form.checkValidity()){form.reportValidity();return;}
      var f=new FormData(form),guide=GUIDE[f.get('metric')]||{};
      var body=withOrg({year:state.year,metric:f.get('metric'),target:f.get('target'),label:f.get('label'),done:Boolean(objective&&objective.done),
        themes:guide.themes?readMulti(form,'themes'):'',audiences:guide.audiences?readMulti(form,'audiences'):''});
      try{await StudioAPI.request('/api/dei/objectives'+(objective?'/'+encodeURIComponent(objective.id)+qs():''),{method:objective?'PATCH':'POST',body:JSON.stringify(body)});dlg.close();load();}
      catch(e){err.textContent=e.message||'Enregistrement impossible';err.hidden=false;}
    };
    dlg.showModal();
  }
  async function saveObjective(o,changes){
    try{await StudioAPI.request('/api/dei/objectives/'+encodeURIComponent(o.id)+qs(),{method:'PATCH',body:JSON.stringify(withOrg(Object.assign({metric:o.metric,target:o.target,label:o.label,done:o.done,themes:o.themes,audiences:o.audiences},changes)))});load();}
    catch(e){window.StudioModal.alert({title:'Enregistrement impossible',message:e.message});}
  }
  function findObjective(id){return state.data.pilotage.objectives.find(function(o){return String(o.id)===String(id);});}

  function editDialog(action,month,preset){
    var d=state.data,a=action||Object.assign({kind:'formation',status:'planned',action_date:(state.year+'-'+String((month??new Date().getMonth())+1).padStart(2,'0')+'-15'),led_by_meayt:isAdmin},preset||{});
    // Types regroupés par famille ; le diagnostic Studio s'ajoute tout seul via les campagnes, mais reste saisissable.
    var groups=d.groups||{};
    var kinds=Object.keys(groups).map(function(g){
      var opts=Object.keys(d.kinds).filter(function(k){return d.kinds[k].group===g;}).map(function(k){return '<option value="'+esc(k)+'"'+(k===a.kind?' selected':'')+'>'+esc(d.kinds[k].icon+' '+d.kinds[k].label)+'</option>';}).join('');
      return opts?'<optgroup label="'+esc(groups[g])+'">'+opts+'</optgroup>':'';
    }).join('');
    // « Me&YouToo » en tête : il marque l'action « Animée par Me&YouToo » (présélectionné quand l'admin saisit).
    var providerOptions=function(selected){return '<option value="">— Aucun —</option><option value="meayt"'+(selected==='meayt'?' selected':'')+'>Me&amp;YouToo</option>'+
      ((d.providers||[]).length?'<optgroup label="Vos prestataires">'+d.providers.map(function(p){return '<option value="'+esc(p.id)+'"'+(String(p.id)===String(selected||'')?' selected':'')+'>'+esc(providerName(p))+'</option>';}).join('')+'</optgroup>':'');};
    var currentProvider=a.led_by_meayt?'meayt':a.provider_id;
    var dispositifOptions=function(selected){return '<option value="">— Aucun —</option>'+(d.dispositifs||[]).map(function(x){return '<option value="'+esc(x.id)+'"'+(String(x.id)===String(selected||'')?' selected':'')+'>'+esc(x.name)+'</option>';}).join('');};
    var statuses=Object.keys(d.statuses).map(function(s){return '<option value="'+s+'"'+(s===a.status?' selected':'')+'>'+esc(d.statuses[s])+'</option>';}).join('');
    var dlg=document.createElement('dialog');dlg.className='dr-dialog';
    dlg.innerHTML='<form><h2>'+(action?'Modifier l’action':'Nouvelle action')+'</h2>'+
      '<label class="dr-field"><span>Type d’action *</span><select name="kind">'+kinds+'</select></label>'+
      (action?'':'<p class="dr-row-meta">Une fiche = une action. Pour plusieurs formats, ajoutez une action par format.</p>')+
      '<label class="dr-field"><span>Titre *</span><input name="title" required maxlength="200" value="'+esc(a.title||'')+'" placeholder="Ex. : Conférence sur le sexisme ordinaire"></label>'+
      '<div class="dr-field-row"><label class="dr-field"><span>Date *</span><input type="date" name="actionDate" required value="'+esc(a.action_date||'')+'"></label><label class="dr-field"><span>Date de fin</span><input type="date" name="endDate" value="'+esc(a.end_date||'')+'"></label><label class="dr-field"><span>Statut</span><select name="status">'+statuses+'</select></label></div>'+
      '<div data-postpone hidden><label class="dr-field"><span>Nouvelle date (si vous la connaissez)</span><input type="date" name="postponedTo"></label>'+
      '<p class="dr-row-meta">Avec une date, l’action se déplace et redevient prévue. Sans date, elle reste reportée et ne compte plus dans votre programme.</p></div>'+
      '<label class="dr-field"><span>Objectif</span><input name="objective" maxlength="300" value="'+esc(a.objective||'')+'" placeholder="Ex. : faire connaître le dispositif de signalement"></label>'+
      '<div class="dr-field-row dr-provider-pick"><label class="dr-field"><span>Dispositif</span><select name="dispositifId">'+dispositifOptions(a.dispositif_id)+'</select></label><button type="button" class="button button-ghost" data-new-dispositif>＋ Nouveau dispositif</button></div>'+
      multiField('theme','Thématiques',THEMES,a.theme)+
      '<div class="dr-field-row"><label class="dr-field"><span>Public visé</span><input name="audience" maxlength="200" value="'+esc(a.audience||'')+'" placeholder="Ex. : managers du siège, nouveaux arrivants…"></label><label class="dr-field dr-field-small"><span>Personnes touchées</span><input type="number" min="0" name="peopleReached" value="'+esc(a.people_reached??'')+'"></label></div>'+
      '<div class="dr-field-row dr-provider-pick"><label class="dr-field"><span>Prestataire</span><select name="providerId">'+providerOptions(currentProvider)+'</select></label><button type="button" class="button button-ghost" data-new-provider>＋ Nouveau prestataire</button></div>'+
      // Dossier d’équipe : l’action apparaît dans le Cockpit de l’équipe concernée (obligatoire pour un compte limité).
      ((d.teamFolders||[]).length?'<label class="dr-field"><span>Dossier d’équipe'+(d.perimeter?' *':'')+'</span><select name="teamFolderId"'+(d.perimeter?' required':'')+'>'+(d.perimeter?'':'<option value="">— Toute l’entreprise —</option>')+d.teamFolders.map(function(t){return '<option value="'+esc(t.id)+'"'+(String(t.id)===String(a.team_folder_id||'')?' selected':'')+'>'+esc(t.name)+'</option>';}).join('')+'</select></label>':'')+
      '<label class="dr-field"><span>Notes</span><textarea name="notes" rows="3" maxlength="4000">'+esc(a.notes||'')+'</textarea></label>'+
      '<label class="dr-field" data-results hidden><span>Résultats et enseignements</span><textarea name="results" rows="3" maxlength="4000" placeholder="Ce que l’action a permis, ce que vous en retenez">'+esc(a.results||'')+'</textarea></label>'+
      // Budget : réservé au client, le champ n'existe pas pour Me&YouToo ni pour un compte limité.
      (d.budget?'<label class="dr-field"><span>Budget (€, facultatif)</span><input type="number" min="0" step="1" name="budget" value="'+esc(a.budget_eur??'')+'"></label><p class="dr-budget-lock">'+BUDGET_NOTICE+'</p>':'')+
      // Côté Me&YouToo : rattacher l'action à un diagnostic (restitution, recommandation issue de la restitution).
      (isAdmin?'<div class="dr-field-row dr-reco-pick"><label class="dr-field"><span>Diagnostic lié</span><select name="campaignId"><option value="">— Aucun —</option>'+
        ((d.diagnostics||{}).campaigns||[]).map(function(c){return '<option value="'+esc(c.id)+'"'+(String(c.id)===String(a.campaign_id||'')?' selected':'')+'>'+esc(c.name+' ('+String(c.launch_date).slice(0,7).split('-').reverse().join('/')+')')+'</option>';}).join('')+
        '</select></label><label class="dr-check"><input type="checkbox" name="recommended"'+(a.recommended?' checked':'')+'> Recommandée par Me&amp;YouToo à la restitution</label></div>':'')+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions"><button type="button" class="button button-ghost" data-close>Annuler</button>'+(!action&&a.dispositif_id?'<button type="submit" class="button button-ghost" data-again>Enregistrer et ajouter une autre</button>':'')+'<button type="submit" class="button button-primary">Enregistrer</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error');
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    // La nouvelle date n'a de sens que pour un report, les résultats que pour une action réalisée.
    function syncStatus(){var s=form.elements.status.value;dlg.querySelector('[data-postpone]').hidden=s!=='postponed';dlg.querySelector('[data-results]').hidden=s!=='done';form.elements.postponedTo.min=form.elements.actionDate.value;}
    form.elements.status.addEventListener('change',syncStatus);form.elements.actionDate.addEventListener('change',syncStatus);syncStatus();
    dlg.querySelector('[data-new-dispositif]').onclick=function(){
      dispositifDialog(null,function(x){state.data.dispositifs=(state.data.dispositifs||[]).concat([Object.assign({inYear:x.year===state.year},x)]);form.elements.dispositifId.innerHTML=dispositifOptions(x.id);});
    };
    // Création d'un prestataire sans quitter la fiche : la liste est rechargée puis le nouveau est sélectionné.
    dlg.querySelector('[data-new-provider]').onclick=function(){
      providerDialog(null,async function(newId){
        var r=await StudioAPI.request('/api/dei/providers'+qs());state.data.providers=r.providers||[];
        form.elements.providerId.innerHTML=providerOptions(newId);
      });
    };
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      if(!form.checkValidity()){form.reportValidity();return;}
      // Un avis porte sur un prestataire : il ne suit pas l'action vers un autre.
      var reviewed=action&&reviewRow(action.id);
      if(reviewed&&reviewed.review&&form.elements.providerId.value!==String(currentProvider||'')){
        var keep=await window.StudioModal.confirm({eyebrow:'Registre des actions',title:'Changer de prestataire ?',message:'L’avis donné sur cette action sera effacé, car il concerne le prestataire actuel.',confirmLabel:'Changer'});
        if(!keep)return;
      }
      var f=new FormData(form),body=withOrg({kind:f.get('kind'),title:f.get('title'),actionDate:f.get('actionDate'),endDate:f.get('endDate'),status:f.get('status'),
        theme:readMulti(form,'theme'),peopleReached:f.get('peopleReached'),audience:f.get('audience'),notes:f.get('notes'),dispositifId:f.get('dispositifId'),objective:f.get('objective'),results:f.get('results'),providerId:f.get('providerId'),offerId:a.offer_id||null});
      if(f.get('status')==='postponed'&&f.get('postponedTo'))body.postponedTo=f.get('postponedTo');
      if(form.elements.budget)body.budget=f.get('budget');
      if(isAdmin){body.campaignId=f.get('campaignId');body.recommended=f.get('recommended')==='on';}
      if(form.elements.teamFolderId)body.teamFolderId=f.get('teamFolderId')||null;
      try{
        await StudioAPI.request('/api/dei/actions'+(action?'/'+encodeURIComponent(action.id):'')+(action?qs():''),{method:action?'PATCH':'POST',body:JSON.stringify(body)});
        var again=ev.submitter&&ev.submitter.hasAttribute('data-again');
        dlg.close();var y=Number(String(body.postponedTo||body.actionDate).slice(0,4));if(y&&y!==state.year)state.year=y;load();
        // Suite du dispositif : la fiche se rouvre avec le dispositif, la thématique, le prestataire et la date.
        if(again)editDialog(null,null,{dispositif_id:f.get('dispositifId'),theme:body.theme,provider_id:body.providerId==='meayt'?null:body.providerId,led_by_meayt:body.providerId==='meayt',action_date:body.actionDate});
      }catch(e){err.textContent=e.message||'Enregistrement impossible';err.hidden=false;}
    };
    dlg.showModal();
  }
  async function remove(id){
    var a=state.data.actions.find(function(x){return String(x.id)===String(id);});if(!a)return;
    var ok=await window.StudioModal.confirm({eyebrow:'Registre des actions',title:'Supprimer « '+a.title+' » ?',message:'L’action et ses pièces jointes seront définitivement supprimées.',confirmLabel:'Supprimer'});
    if(!ok)return;
    try{await StudioAPI.request('/api/dei/actions/'+encodeURIComponent(id)+qs(),{method:'DELETE'});load();}catch(e){window.StudioModal.alert({title:'Suppression impossible',message:e.message});}
  }
  function upload(id,file){
    if(!file)return;
    if(file.size>6*1024*1024){window.StudioModal.alert({title:'Fichier trop lourd',message:'Le fichier ne doit pas dépasser 6 Mo.'});return;}
    var reader=new FileReader();
    reader.onload=async function(){
      try{await StudioAPI.request('/api/dei/actions/'+encodeURIComponent(id)+'/documents'+qs(),{method:'POST',body:JSON.stringify(withOrg({filename:file.name,mimeType:file.type,contentBase64:String(reader.result)}))});load();}
      catch(e){window.StudioModal.alert({title:'Envoi impossible',message:e.message});}
    };
    reader.readAsDataURL(file);
  }
  async function download(pair,filename){
    var p=pair.split(':');
    try{
      var res=await fetch(StudioAPI.base()+'/api/dei/actions/'+encodeURIComponent(p[0])+'/documents/'+encodeURIComponent(p[1])+qs(),{headers:{Authorization:'Bearer '+StudioAPI.token()}});
      if(!res.ok)throw new Error('Téléchargement impossible');
      var url=URL.createObjectURL(await res.blob()),link=document.createElement('a');link.href=url;link.download=filename||'document';document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},2000);
    }catch(e){window.StudioModal.alert({title:'Téléchargement impossible',message:e.message});}
  }
  async function removeDoc(pair){
    var p=pair.split(':');
    var ok=await window.StudioModal.confirm({eyebrow:'Pièce jointe',title:'Retirer ce document ?',message:'Le document sera définitivement supprimé.',confirmLabel:'Retirer'});
    if(!ok)return;
    try{await StudioAPI.request('/api/dei/actions/'+encodeURIComponent(p[0])+'/documents/'+encodeURIComponent(p[1])+qs(),{method:'DELETE'});load();}catch(e){window.StudioModal.alert({title:'Action impossible',message:e.message});}
  }

  // « Être accompagné » : même circuit que la vitrine (notification, e-mail, transaction HubSpot).
  async function accompany(context,label){
    var message=await window.StudioModal.prompt({eyebrow:'Être accompagné',title:label,
      message:'L’équipe Me&YouToo vous recontacte pour construire cette action avec vous : conférence, formation, atelier, diagnostic…',
      inputLabel:'Votre besoin (facultatif)',placeholder:'Ex. : un temps fort pour le 8 mars, 200 collaborateurs…',confirmLabel:'Envoyer ma demande'});
    if(message===null)return;
    try{var r=await StudioAPI.request('/api/offer-requests',{method:'POST',body:JSON.stringify({source:'cockpit',message:(label+(message?' — '+message:'')),context:context})});
      window.StudioModal.alert({eyebrow:'Être accompagné',title:'Demande transmise',type:'success',message:r.message||'Votre demande a bien été transmise.'});}
    catch(e){window.StudioModal.alert({title:'Envoi impossible',message:e.message});}
  }

  root.addEventListener('click',function(ev){
    var t=ev.target.closest('button');if(!t)return;
    if(t.hasAttribute('data-year')){state.year=Number(t.getAttribute('data-year'));load();}
    else if(t.hasAttribute('data-add'))editDialog(null);
    else if(t.hasAttribute('data-add-month'))editDialog(null,Number(t.getAttribute('data-add-month')));
    else if(t.hasAttribute('data-edit'))editDialog(state.data.actions.find(function(a){return String(a.id)===t.getAttribute('data-edit');}));
    else if(t.hasAttribute('data-delete'))remove(t.getAttribute('data-delete'));
    else if(t.hasAttribute('data-download'))download(t.getAttribute('data-download'),t.getAttribute('data-filename'));
    else if(t.hasAttribute('data-doc-delete'))removeDoc(t.getAttribute('data-doc-delete'));
    else if(t.hasAttribute('data-month')){var m=Number(t.getAttribute('data-month')),my=Number(t.getAttribute('data-month-year'))||state.year;accompany({year:my,month:m+1},'Une action D&I en '+MONTHS_LONG[m]+' '+my);}
    else if(t.hasAttribute('data-accompany')){var a=state.data.actions.find(function(x){return String(x.id)===t.getAttribute('data-accompany');});if(a)accompany({actionId:a.id,kind:a.kind},'Accompagnement : '+a.title);}
    else if(t.hasAttribute('data-obj-add'))objectiveDialog(null);
    else if(t.hasAttribute('data-obj-suggest')){var sg=t.getAttribute('data-obj-suggest').split(':');objectiveDialog(null,{metric:sg[0],target:sg[1]?Number(sg[1]):undefined});}
    else if(t.hasAttribute('data-obj-edit'))objectiveDialog(findObjective(t.getAttribute('data-obj-edit')));
    else if(t.hasAttribute('data-obj-delete')){var ob=findObjective(t.getAttribute('data-obj-delete'));if(ob)window.StudioModal.confirm({eyebrow:'Objectifs',title:'Retirer cet objectif ?',message:'Il disparaît du tableau de pilotage. Vos actions ne sont pas touchées.',confirmLabel:'Retirer'}).then(function(ok){if(ok)StudioAPI.request('/api/dei/objectives/'+encodeURIComponent(ob.id)+qs(),{method:'DELETE'}).then(load).catch(function(e){window.StudioModal.alert({title:'Action impossible',message:e.message});});});}
    else if(t.hasAttribute('data-prepare')){var pd=t.getAttribute('data-prepare');editDialog(null,Number(pd.slice(5,7))-1,{title:t.getAttribute('data-title'),theme:t.getAttribute('data-theme'),action_date:pd,kind:'evenement'});}
    else if(t.hasAttribute('data-nudge-later')){t.disabled=true;StudioAPI.request('/api/dei/temps-forts/'+encodeURIComponent(t.getAttribute('data-nudge-later'))+'/plus-tard',{method:'POST',body:JSON.stringify({year:Number(t.getAttribute('data-nudge-year')),stage:t.getAttribute('data-stage')})}).then(load).catch(function(e){t.disabled=false;window.StudioModal.alert({title:'Action impossible',message:e.message});});}
    else if(t.hasAttribute('data-event-help'))accompany({event:t.getAttribute('data-event-help')},'Préparer : '+t.getAttribute('data-event-help'));
    else if(t.hasAttribute('data-late-edit')){
      // Une action en retard peut dater de l'année précédente : on charge son année avant d'ouvrir la fiche.
      var lid=t.getAttribute('data-late-edit'),ly=Number(t.getAttribute('data-year-of'));
      var open=function(){var la=state.data.actions.find(function(x){return String(x.id)===lid;});if(la)editDialog(la);};
      if(ly&&ly!==state.year){state.year=ly;load().then(open);}else open();
    }
    else if(t.hasAttribute('data-restitution'))requestRestitution(t.getAttribute('data-restitution'));
    else if(t.hasAttribute('data-restitution-add')){
      var rc=((state.data.diagnostics||{}).restitutions||[]).find(function(x){return String(x.id)===t.getAttribute('data-restitution-add');}),ro=(state.data.diagnostics||{}).restitutionOffer;
      if(rc)editDialog(null,null,{kind:'conference',title:'Restitution des résultats — '+rc.name,theme:rc.theme||'',campaign_id:rc.id,offer_id:ro&&ro.id,led_by_meayt:true,status:'planned',action_date:today()});
    }
    else if(t.hasAttribute('data-reco-add')){var cid=t.getAttribute('data-reco-add');editDialog(null,null,{campaign_id:cid,recommended:true,led_by_meayt:false,action_date:today()});}
    else if(t.hasAttribute('data-reco-help'))accompany({actionId:t.getAttribute('data-reco-help'),recommended:true},'Accompagnement : '+t.getAttribute('data-title'));
    else if(t.hasAttribute('data-cover'))kpiDetail('cover|'+t.getAttribute('data-cover'));
    else if(t.hasAttribute('data-disp-add'))dispositifDialog(null);
    else if(t.hasAttribute('data-disp-edit'))dispositifDialog((state.data.dispositifs||[]).find(function(x){return String(x.id)===t.getAttribute('data-disp-edit');}));
    else if(t.hasAttribute('data-disp-delete'))removeDispositif(t.getAttribute('data-disp-delete'));
    else if(t.hasAttribute('data-disp-attach'))attachDialog(t.getAttribute('data-disp-attach'));
    else if(t.hasAttribute('data-disp-compose'))composeDialog((state.data.dispositifs||[]).find(function(x){return String(x.id)===t.getAttribute('data-disp-compose');}));
    else if(t.hasAttribute('data-disp-detach')){var dp=t.getAttribute('data-disp-detach').split(':');StudioAPI.request('/api/dei/dispositifs/'+encodeURIComponent(dp[0])+'/diagnostics/'+encodeURIComponent(dp[1])+qs(),{method:'DELETE',body:JSON.stringify(withOrg({}))}).then(load).catch(function(e){window.StudioModal.alert({title:'Action impossible',message:e.message});});}
    else if(t.hasAttribute('data-provider-add'))providerDialog(null);
    else if(t.hasAttribute('data-provider-edit'))providerDialog((state.data.providers||[]).find(function(p){return String(p.id)===t.getAttribute('data-provider-edit');}));
    else if(t.hasAttribute('data-provider-delete'))removeProvider(t.getAttribute('data-provider-delete'));
    else if(t.hasAttribute('data-review'))reviewDialog(t.getAttribute('data-review'));
    else if(t.hasAttribute('data-reviews'))reviewsDialog(t.getAttribute('data-reviews'),t.getAttribute('data-name'));
    // La frise est dans la vue d'ensemble : on bascule sur l'onglet Actions pour montrer le détail.
    else if(t.hasAttribute('data-focus'))focusItem(t.getAttribute('data-focus'));
    else if(t.hasAttribute('data-kpi'))kpiDetail(t.getAttribute('data-kpi'));
    else if(t.hasAttribute('data-png'))downloadPng(t);
  });
  if(tabsEl)tabsEl.addEventListener('click',function(ev){var t=ev.target.closest('[data-tab]');if(t)setTab(t.getAttribute('data-tab'));});
  window.addEventListener('hashchange',function(){var h=location.hash.slice(1);if(TABS[h]&&h!==state.tab&&state.data){state.tab=h;render();}});
  root.addEventListener('change',function(ev){var t=ev.target;
    if(t.matches('[data-upload]'))upload(t.getAttribute('data-upload'),t.files&&t.files[0]);
    else if(t.matches('[data-obj-done]')){var o=findObjective(t.getAttribute('data-obj-done'));if(o)saveObjective(o,{done:t.checked});}
  });
  // Arrivée depuis l'alerte « Campagne terminée » (?restitution=<id>) : on ouvre la demande, le client confirme.
  var restitutionLink=isClient&&/^\d+$/.test(params.get('restitution')||'')?params.get('restitution'):null;
  load().then(function(){if(restitutionLink&&state.data)requestRestitution(restitutionLink,true);});
})();
