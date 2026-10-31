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
  // Onglets du cockpit (mémorisés dans l'adresse : #apercu, #actions, #prestataires).
  var TABS={apercu:'Vue d’ensemble',actions:'Actions',prestataires:'Prestataires'};
  var tabsEl=document.getElementById('dei-tabs'),yearEl=document.getElementById('dei-year');
  var state={year:Number(params.get('year'))||new Date().getFullYear(),data:null,tab:TABS[location.hash.slice(1)]?location.hash.slice(1):'apercu',focus:/^action-\d+$/.test(params.get('focus')||'')?params.get('focus'):null};

  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){return new Intl.NumberFormat('fr-FR').format(Number(v)||0);}
  function fmtDate(v){if(!v)return '';var d=new Date(String(v).slice(0,10)+'T12:00:00');return d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});}
  function qs(extra){var p=new URLSearchParams();if(organizationId)p.set('organizationId',organizationId);Object.keys(extra||{}).forEach(function(k){p.set(k,extra[k]);});var s=p.toString();return s?'?'+s:'';}
  function withOrg(body){if(organizationId)body.organizationId=organizationId;return body;}
  // Le calendrier d'un client : en mode admin, ouvert directement sur le client consulté.
  function calendarHref(){return isAdmin?(organizationId?'calendrier.html?organizationId='+encodeURIComponent(organizationId):'calendrier.html'):'calendrier.html?audience=client';}
  function today(){return new Date().toISOString().slice(0,10);}

  function load(){
    if(isAdmin&&!organizationId){root.innerHTML='<p class="dr-empty">Le registre des actions est propre à chaque client : ouvrez-le depuis le <a href="admin.html">dossier d’un client</a> (bouton « Cockpit DEI du client »).</p>';return Promise.resolve();}
    root.setAttribute('aria-busy','true');
    return StudioAPI.request('/api/dei/actions'+qs({year:state.year})).then(function(d){state.data=d;render();})
      .catch(function(e){root.innerHTML='<p class="dr-empty">Le registre des actions est momentanément indisponible. '+esc(e.message||'')+'</p>';})
      .finally(function(){root.removeAttribute('aria-busy');});
  }

  // Actions du registre + campagnes de diagnostic, dans un même format d'affichage.
  function items(){
    var d=state.data,t=today();
    var actions=d.actions.map(function(a){return {type:'action',id:a.id,kind:a.kind,title:a.title,date:a.action_date,end:a.end_date,status:a.status,theme:a.theme,audience:a.audience,people:a.people_reached,notes:a.notes,meayt:a.led_by_meayt,documents:a.documents||[],offerId:a.offer_id,provider:a.provider_name,recommended:a.recommended,campaignId:a.campaign_id,raw:a};});
    var campaigns=d.campaigns.map(function(c){return {type:'campaign',id:c.id,kind:'diagnostic',title:c.name,date:c.launch_date,end:c.close_date,status:(['closed','completed','unpublished'].indexOf(c.status)>=0||(c.close_date&&c.close_date<t))?'done':'in_progress',theme:c.theme_title,people:c.respondents,documents:[]};});
    return actions.concat(campaigns).sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
  }
  function kind(k){return (state.data.kinds||{})[k]||{label:k,icon:'•'};}

  function render(){
    var d=state.data,list=items(),ind=d.indicators,canEdit=d.canEdit;
    var years=d.years.map(function(y){return '<button type="button" class="dr-year'+(y===state.year?' is-current':'')+'" data-year="'+y+'">'+y+'</button>';}).join('');
    // Compte limité à certains dossiers d’équipe : son Cockpit ne porte que sur eux.
    var perimeterNames=d.perimeter?d.perimeter.folders.map(function(f){return f.name;}).join(', '):'';
    var head=(d.perimeter?'<p class="ae-perimeter-banner">👥 Votre Cockpit porte sur '+(d.perimeter.folders.length>1?'vos dossiers':'votre dossier')+' d’équipe : '+esc(perimeterNames||'aucun')+'. La vue d’ensemble de l’entreprise et ses objectifs restent à la direction.</p>':'')+'<div class="dr-head"><div><p class="eyebrow">Registre des actions D&amp;I'+(perimeterNames?' · '+esc(perimeterNames):'')+'</p><h2>'+(organizationId?'Année '+state.year+(d.organizationName?' — '+esc(d.organizationName):''):'Votre année '+state.year)+'</h2>'+
      '<p>Toutes vos actions diversité &amp; inclusion au même endroit : celles animées par Me&amp;YouToo, vos diagnostics et vos initiatives internes.</p></div>'+
      '<div class="dr-head-actions"><div class="dr-years" role="group" aria-label="Choisir l’année">'+years+'</div><a class="button button-secondary" data-bilan href="bilan-dei.html'+qs({year:state.year})+'">📄 Bilan '+state.year+' (PDF)</a>'+(canEdit?'<button type="button" class="button button-primary" data-add>＋ Ajouter une action</button>':'')+'</div></div>';
    var cards='<div class="dr-kpis">'+
      kpi(num(ind.actions),'action'+(ind.actions>1?'s':''),ind.done+' réalisée'+(ind.done>1?'s':'')+' · '+ind.planned+' à venir ou en cours')+
      kpi(num(ind.peopleReached),'personne'+(ind.peopleReached>1?'s':'')+' touchée'+(ind.peopleReached>1?'s':''),'actions réalisées et participations aux diagnostics')+
      kpi(num(ind.formats),'format'+(ind.formats>1?'s':'')+' utilisé'+(ind.formats>1?'s':''),'conférences, formations, diagnostics…')+
      kpi(num(ind.themes),'thématique'+(ind.themes>1?'s':'')+' couverte'+(ind.themes>1?'s':''),'sur l’année')+
      kpi(num(ind.monthsWithoutAction),'mois sans action',ind.monthsWithoutAction?'sur les mois déjà écoulés':'aucun trou sur les mois écoulés',ind.monthsWithoutAction?'is-alert':'is-ok')+
    '</div>';
    var byMonth=MONTHS.map(function(){return [];});
    list.forEach(function(it){if(String(it.date).slice(0,4)===String(state.year))byMonth[Number(String(it.date).slice(5,7))-1].push(it);});
    var nowY=new Date().getFullYear(),nowM=new Date().getMonth();
    var frise='<div class="dr-frise" role="list">'+byMonth.map(function(its,m){
      var past=state.year<nowY||(state.year===nowY&&m<nowM),current=state.year===nowY&&m===nowM;
      var body=its.map(function(it){var k=kind(it.kind);return '<button type="button" class="dr-pill st-'+esc(it.status)+'" data-focus="'+esc(it.type+'-'+it.id)+'" data-tip="'+esc(it.title)+'"><span class="dr-pill-text"><span aria-hidden="true">'+esc(k.icon)+'</span> '+esc(it.title)+'</span></button>';}).join('');
      var empty=!its.length?(isClient?'<button type="button" class="dr-help" data-month="'+m+'">'+(past?'Mois sans action':'Rien de prévu')+'<span>Être accompagné →</span></button>':(canEdit?'<button type="button" class="dr-help" data-add-month="'+m+'">'+(past?'Mois sans action':'Rien de prévu')+'<span>＋ Ajouter</span></button>':'<span class="dr-none">—</span>')):'';
      return '<div class="dr-month'+(current?' is-current':'')+(past&&!its.length?' is-gap':'')+'" role="listitem"><p class="dr-month-name">'+MONTHS[m]+'</p>'+body+empty+'</div>';
    }).join('')+'</div>';
    var rows=list.length?list.map(row).join(''):'<p class="dr-empty">Aucune action enregistrée pour '+state.year+'. '+(canEdit?'Ajoutez votre première action, ou demandez-nous de l’alimenter pour vous.':'')+'</p>';
    renderTabs();
    if(yearEl)yearEl.classList.toggle('is-tab-hidden',state.tab!=='apercu');
    if(state.tab==='prestataires'){root.innerHTML=providersView();return;}
    root.innerHTML=state.tab==='actions'
      ?head+'<div class="dr-list">'+rows+'</div>'
      :head+cards+pilotageView()+'<div class="dr-sub-row"><h3 class="dr-sub">Frise de l’année</h3><a class="button button-ghost" href="'+calendarHref()+'">Ouvrir dans le calendrier →</a></div>'+frise;
    // Arrivée depuis le calendrier (?focus=action-12) : on montre l'action une seule fois.
    if(state.focus&&state.tab==='actions'){var target=document.getElementById('dr-'+state.focus);state.focus=null;
      if(target)setTimeout(function(){target.scrollIntoView({block:'center'});target.classList.add('is-focus');setTimeout(function(){target.classList.remove('is-focus');},2000);},200);}
  }
  function renderTabs(){
    if(!tabsEl)return;
    var counts={actions:items().length,prestataires:(state.data.providers||[]).length};
    tabsEl.hidden=false;
    tabsEl.innerHTML=Object.keys(TABS).map(function(k){return '<button type="button" role="tab" class="dr-tab'+(k===state.tab?' is-current':'')+'" aria-selected="'+(k===state.tab)+'" data-tab="'+k+'">'+esc(TABS[k])+(counts[k]!=null?' <span>'+counts[k]+'</span>':'')+'</button>';}).join('');
  }
  function setTab(tab){state.tab=tab;try{history.replaceState(null,'','#'+tab);}catch(e){}render();window.scrollTo({top:(tabsEl||root).getBoundingClientRect().top+window.scrollY-16,behavior:'smooth'});}

  // ── Annuaire des prestataires ──
  function providerName(p){return [p.company,[p.first_name,p.last_name].filter(Boolean).join(' ')].filter(Boolean).join(' · ');}
  function providersView(){
    var d=state.data,list=d.providers||[],canEdit=d.canEdit;
    var head='<div class="dr-head"><div><p class="eyebrow">Annuaire</p><h2>'+(organizationId?'Prestataires de '+esc(d.organizationName||'ce client'):'Vos prestataires D&amp;I')+'</h2>'+
      '<p>Cabinets, formateurs, associations, intervenants : gardez leurs coordonnées à portée de main et reliez-les à vos actions. Renseignez uniquement des coordonnées professionnelles.</p></div>'+
      (canEdit?'<div class="dr-head-actions"><button type="button" class="button button-primary" data-provider-add>＋ Ajouter un prestataire</button></div>':'')+'</div>';
    if(!list.length)return head+'<p class="dr-empty">Aucun prestataire enregistré pour le moment.</p>';
    return head+'<div class="dr-providers">'+list.map(function(p){
      var contact=[p.first_name,p.last_name].filter(Boolean).join(' ');
      return '<article class="dr-provider"><h4>'+esc(p.company||contact)+'</h4>'+(p.company&&contact?'<p class="dr-provider-contact">'+esc(contact)+'</p>':'')+
        (p.specialty?'<p class="dr-row-meta">'+esc(p.specialty)+'</p>':'')+
        '<p class="dr-provider-lines">'+(p.email?'<a href="mailto:'+esc(p.email)+'">✉ '+esc(p.email)+'</a>':'')+(p.phone?'<a href="tel:'+esc(p.phone.replace(/\s+/g,''))+'">☎ '+esc(p.phone)+'</a>':'')+'</p>'+
        (p.notes?'<p class="dr-row-notes">'+esc(p.notes)+'</p>':'')+
        '<p class="dr-row-meta">'+(p.actions_count?p.actions_count+' action'+(p.actions_count>1?'s':'')+' rattachée'+(p.actions_count>1?'s':''):'Aucune action rattachée')+'</p>'+
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
    var ok=await window.StudioModal.confirm({eyebrow:'Prestataires',title:'Supprimer « '+providerName(p)+' » ?',message:'Ses coordonnées seront effacées. Les actions rattachées sont conservées, sans prestataire.',confirmLabel:'Supprimer'});
    if(!ok)return;
    try{await StudioAPI.request('/api/dei/providers/'+encodeURIComponent(id)+qs(),{method:'DELETE'});load();}catch(e){window.StudioModal.alert({title:'Suppression impossible',message:e.message});}
  }
  function kpi(value,label,hint,cls){return '<article class="dr-kpi '+(cls||'')+'"><strong>'+value+'</strong><span>'+label+'</span><small>'+hint+'</small></article>';}

  function campaignName(id){var c=((state.data.diagnostics||{}).campaigns||[]).find(function(x){return String(x.id)===String(id);});return c?c.name:'';}
  function recoTip(id){var n=campaignName(id);return 'Recommandée lors de la restitution'+(n?' du diagnostic « '+n+' »':' de votre diagnostic');}
  function row(it){
    var k=kind(it.kind),st=(state.data.statuses||{})[it.status]||it.status,canEdit=state.data.canEdit&&it.type==='action';
    var when=fmtDate(it.date)+(it.end&&it.end!==it.date?' → '+fmtDate(it.end):'');
    var meta=[it.theme,it.audience,it.people!=null?num(it.people)+(it.type==='campaign'?' participations':' personnes touchées'):'',it.provider?'avec '+it.provider:'',it.recommended?recoTip(it.campaignId):''].filter(Boolean).map(esc).join(' · ');
    var docs=(it.documents||[]).map(function(doc){return '<span class="dr-doc"><button type="button" class="dr-link" data-download="'+esc(it.id)+':'+esc(doc.id)+'" data-filename="'+esc(doc.filename)+'">📎 '+esc(doc.filename)+'</button>'+(canEdit?'<button type="button" class="dr-x" data-doc-delete="'+esc(it.id)+':'+esc(doc.id)+'" aria-label="Retirer '+esc(doc.filename)+'">×</button>':'')+'</span>';}).join('');
    var tools=it.type==='campaign'
      ?'<a class="dr-link" href="campagne-detail.html?projectId='+encodeURIComponent(it.id)+(organizationId?'':'')+'">Voir la campagne →</a>'
      :((canEdit?'<button type="button" class="button button-ghost" data-edit="'+esc(it.id)+'">Modifier</button><label class="button button-ghost dr-upload">Joindre un document<input type="file" accept="application/pdf,image/png,image/jpeg" data-upload="'+esc(it.id)+'" hidden></label><button type="button" class="button button-ghost" data-delete="'+esc(it.id)+'">Supprimer</button>':'')+
        (isClient?'<button type="button" class="dr-link" data-accompany="'+esc(it.id)+'">Être accompagné sur cette action →</button>':''));
    return '<article class="dr-row" id="dr-'+esc(it.type+'-'+it.id)+'"><div class="dr-row-icon" aria-hidden="true">'+esc(k.icon)+'</div><div class="dr-row-main">'+
      '<p class="dr-row-kind">'+esc(it.type==='campaign'?'Diagnostic comportemental · Studio':k.label)+(it.meayt?' <span class="dr-badge is-meayt">Animée par Me&amp;YouToo</span>':'')+(it.recommended?' <span class="dr-badge is-reco">Recommandée par Me&amp;YouToo</span>':'')+' <span class="dr-badge st-'+esc(it.status)+'">'+esc(st)+'</span></p>'+
      '<h4>'+esc(it.title)+'</h4><p class="dr-row-when">'+esc(when)+'</p>'+(meta?'<p class="dr-row-meta">'+meta+'</p>':'')+(it.notes?'<p class="dr-row-notes">'+esc(it.notes)+'</p>':'')+
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
        reached=o.done;pct=o.done?100:(o.target?Math.min(100,Math.round(s.people/o.target*100)):(s.done?50:(s.planned?20:0)));
        figure=(o.done?'Atteint':s.done+' action'+(s.done>1?'s':'')+' réalisée'+(s.done>1?'s':'')+(s.planned?' · '+s.planned+' prévue'+(s.planned>1?'s':''):''))+(o.target?' · '+num(s.people)+' / '+num(o.target)+' pers.':'');
      }else{
        pct=custom?(o.done?100:0):(o.value==null||!o.target?0:Math.min(100,Math.round(o.value/o.target*100)));
        reached=custom?o.done:(o.value!=null&&o.target&&o.value>=o.target);
        figure=custom?(o.done?'Atteint':'À atteindre'):(o.value==null?'Pas encore mesurable':num(o.value)+' / '+num(o.target)+(o.unit==='%'?' %':' '+o.unit));
      }
      var meta=[strategic&&o.themes&&o.label?'Thématiques : '+o.themes:'',o.audiences?'Publics : '+o.audiences:''].filter(Boolean).map(esc).join(' · ');
      return '<li class="dp-obj'+(reached?' is-reached':'')+(strategic?' is-strategic':'')+'">'+(o.suggestion_key?'<span class="dp-suggested">Proposé par Me&amp;YouToo</span>':'')+'<div class="dp-obj-head"><strong>'+esc(title)+'</strong><span>'+esc(figure)+(reached?' ✓':'')+'</span></div>'+
        (meta?'<p class="dp-obj-meta">'+meta+'</p>':'')+
        '<div class="dp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><i style="width:'+pct+'%"></i></div>'+
        (canEdit?'<div class="dp-obj-tools">'+(manual?'<label class="dr-check"><input type="checkbox" data-obj-done="'+esc(o.id)+'"'+(o.done?' checked':'')+'> Atteint</label>':'')+'<button type="button" class="dr-link" data-obj-edit="'+esc(o.id)+'">Modifier</button><button type="button" class="dr-link" data-obj-delete="'+esc(o.id)+'">Retirer</button></div>':'')+'</li>';
    }).join('');
    var objCard=state.data.perimeter?'':'<article class="dp-card"><header><h3>🎯 Objectifs '+state.year+'</h3>'+(canEdit&&p.objectives.length<p.maxObjectives?'<button type="button" class="button button-ghost" data-obj-add>＋ Fixer un objectif</button>':'')+'</header>'+
      (objs?'<ul class="dp-objs">'+objs+'</ul>':'<p class="dr-empty">Fixez 3 à 5 objectifs pour l’année : la progression se calcule toute seule à partir de vos actions et de vos diagnostics.</p>'+
        (canEdit?'<div class="dp-suggest">'+[['actions_done',12,'12 actions réalisées'],['active_quarters',4,'Une action chaque trimestre'],['themes',5,'Couvrir 5 thématiques'],['people_reached',1000,'1 000 personnes touchées']].map(function(s){return '<button type="button" class="dr-chip-btn" data-obj-suggest="'+s[0]+':'+s[1]+'">＋ '+s[2]+'</button>';}).join('')+'</div>':''))+'</article>';
    // Trimestres
    var maxQ=Math.max(1,Math.max.apply(null,p.quarters.map(function(q){return q.done+q.planned+q.late;})));
    var qCard='<article class="dp-card"><header><h3>📊 Prévu / réalisé par trimestre</h3></header><div class="dp-quarters">'+p.quarters.map(function(q){
      var h=function(n){return Math.round(n/maxQ*100);};
      return '<div class="dp-q"><div class="dp-q-bars" aria-hidden="true"><i class="is-done" style="height:'+h(q.done)+'%"></i><i class="is-planned" style="height:'+h(q.planned)+'%"></i><i class="is-late" style="height:'+h(q.late)+'%"></i></div>'+
        '<strong>T'+q.quarter+'</strong><small>'+q.done+' réalisée'+(q.done>1?'s':'')+(q.planned?' · '+q.planned+' en cours ou prévue'+(q.planned>1?'s':''):'')+(q.late?' · <b>'+q.late+' en retard</b>':'')+'</small></div>';
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
    if((a.uncoveredThemes||[]).length)alerts.push('<li><span class="dp-ico" aria-hidden="true">🧭</span><div><strong>Thématiques non travaillées depuis 12 mois</strong><small>'+esc(a.uncoveredThemes.join(', '))+'</small></div><a class="dr-link" href="'+(isAdmin?'offres.html':'offres.html')+'">Voir nos offres</a></li>');
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
      '<label class="dr-field"><span data-label-text>Précision (facultatif)</span><input name="label" maxlength="240" value="'+esc(o.label||'')+'" placeholder="Ex. : former tous les managers à la prévention des VSS"></label>'+
      '<div data-when="themes">'+multiField('themes','Thématiques',THEMES,o.themes)+'</div>'+
      multiField('audiences','Publics visés',AUDIENCES,o.audiences)+
      '<label class="dr-field" data-when="target"><span data-target-text>Cible</span><input type="number" min="1" name="target" value="'+esc(o.target??'')+'"></label>'+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions"><button type="button" class="button button-ghost" data-close>Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error');
    function sync(){
      var m=form.elements.metric.value,custom=m==='custom',strategic=m==='strategic';
      dlg.querySelector('[data-when="target"]').hidden=custom;
      dlg.querySelector('[data-when="themes"]').hidden=!strategic;
      dlg.querySelector('[data-target-text]').textContent=strategic?'Nombre de personnes à toucher (facultatif)':'Cible chiffrée *';
      dlg.querySelector('[data-label-text]').textContent=custom?'Objectif *':strategic?'Enjeu (facultatif si une thématique est cochée)':'Précision (facultatif)';
    }
    form.elements.metric.onchange=sync;sync();
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      var f=new FormData(form),strategicMetric=f.get('metric')==='strategic';
      var body=withOrg({year:state.year,metric:f.get('metric'),target:f.get('target'),label:f.get('label'),done:Boolean(objective&&objective.done),
        themes:strategicMetric?readMulti(form,'themes'):'',audiences:readMulti(form,'audiences')});
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
    var statuses=Object.keys(d.statuses).map(function(s){return '<option value="'+s+'"'+(s===a.status?' selected':'')+'>'+esc(d.statuses[s])+'</option>';}).join('');
    var dlg=document.createElement('dialog');dlg.className='dr-dialog';
    dlg.innerHTML='<form><h2>'+(action?'Modifier l’action':'Nouvelle action')+'</h2>'+
      '<label class="dr-field"><span>Type d’action *</span><select name="kind">'+kinds+'</select></label>'+
      '<label class="dr-field"><span>Titre *</span><input name="title" required maxlength="200" value="'+esc(a.title||'')+'" placeholder="Ex. : Conférence sur le sexisme ordinaire"></label>'+
      '<div class="dr-field-row"><label class="dr-field"><span>Date *</span><input type="date" name="actionDate" required value="'+esc(a.action_date||'')+'"></label><label class="dr-field"><span>Date de fin</span><input type="date" name="endDate" value="'+esc(a.end_date||'')+'"></label><label class="dr-field"><span>Statut</span><select name="status">'+statuses+'</select></label></div>'+
      multiField('theme','Thématiques',THEMES,a.theme)+
      '<div class="dr-field-row"><label class="dr-field"><span>Public visé</span><input name="audience" maxlength="200" value="'+esc(a.audience||'')+'" placeholder="Ex. : managers du siège, nouveaux arrivants…"></label><label class="dr-field dr-field-small"><span>Personnes touchées</span><input type="number" min="0" name="peopleReached" value="'+esc(a.people_reached??'')+'"></label></div>'+
      '<div class="dr-field-row dr-provider-pick"><label class="dr-field"><span>Prestataire</span><select name="providerId">'+providerOptions(currentProvider)+'</select></label><button type="button" class="button button-ghost" data-new-provider>＋ Nouveau prestataire</button></div>'+
      // Dossier d’équipe : l’action apparaît dans le Cockpit de l’équipe concernée (obligatoire pour un compte limité).
      ((d.teamFolders||[]).length?'<label class="dr-field"><span>Dossier d’équipe'+(d.perimeter?' *':'')+'</span><select name="teamFolderId"'+(d.perimeter?' required':'')+'>'+(d.perimeter?'':'<option value="">— Toute l’entreprise —</option>')+d.teamFolders.map(function(t){return '<option value="'+esc(t.id)+'"'+(String(t.id)===String(a.team_folder_id||'')?' selected':'')+'>'+esc(t.name)+'</option>';}).join('')+'</select></label>':'')+
      '<label class="dr-field"><span>Notes</span><textarea name="notes" rows="3" maxlength="4000">'+esc(a.notes||'')+'</textarea></label>'+
      // Côté Me&YouToo : rattacher l'action à un diagnostic (restitution, recommandation issue de la restitution).
      (isAdmin?'<div class="dr-field-row dr-reco-pick"><label class="dr-field"><span>Diagnostic lié</span><select name="campaignId"><option value="">— Aucun —</option>'+
        ((d.diagnostics||{}).campaigns||[]).map(function(c){return '<option value="'+esc(c.id)+'"'+(String(c.id)===String(a.campaign_id||'')?' selected':'')+'>'+esc(c.name+' ('+String(c.launch_date).slice(0,7).split('-').reverse().join('/')+')')+'</option>';}).join('')+
        '</select></label><label class="dr-check"><input type="checkbox" name="recommended"'+(a.recommended?' checked':'')+'> Recommandée par Me&amp;YouToo à la restitution</label></div>':'')+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions"><button type="button" class="button button-ghost" data-close>Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error');
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    // Création d'un prestataire sans quitter la fiche : la liste est rechargée puis le nouveau est sélectionné.
    dlg.querySelector('[data-new-provider]').onclick=function(){
      providerDialog(null,async function(newId){
        var r=await StudioAPI.request('/api/dei/providers'+qs());state.data.providers=r.providers||[];
        form.elements.providerId.innerHTML=providerOptions(newId);
      });
    };
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      if(!form.checkValidity()){form.reportValidity();return;}
      var f=new FormData(form),body=withOrg({kind:f.get('kind'),title:f.get('title'),actionDate:f.get('actionDate'),endDate:f.get('endDate'),status:f.get('status'),
        theme:readMulti(form,'theme'),peopleReached:f.get('peopleReached'),audience:f.get('audience'),notes:f.get('notes'),providerId:f.get('providerId'),offerId:a.offer_id||null});
      if(isAdmin){body.campaignId=f.get('campaignId');body.recommended=f.get('recommended')==='on';}
      if(form.elements.teamFolderId)body.teamFolderId=f.get('teamFolderId')||null;
      try{
        await StudioAPI.request('/api/dei/actions'+(action?'/'+encodeURIComponent(action.id):'')+(action?qs():''),{method:action?'PATCH':'POST',body:JSON.stringify(body)});
        dlg.close();var y=Number(String(body.actionDate).slice(0,4));if(y&&y!==state.year)state.year=y;load();
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
    else if(t.hasAttribute('data-obj-suggest')){var sg=t.getAttribute('data-obj-suggest').split(':');objectiveDialog(null,{metric:sg[0],target:Number(sg[1])});}
    else if(t.hasAttribute('data-obj-edit'))objectiveDialog(findObjective(t.getAttribute('data-obj-edit')));
    else if(t.hasAttribute('data-obj-delete')){var ob=findObjective(t.getAttribute('data-obj-delete'));if(ob)window.StudioModal.confirm({eyebrow:'Objectifs',title:'Retirer cet objectif ?',message:'Il disparaît du tableau de pilotage. Vos actions ne sont pas touchées.',confirmLabel:'Retirer'}).then(function(ok){if(ok)StudioAPI.request('/api/dei/objectives/'+encodeURIComponent(ob.id)+qs(),{method:'DELETE'}).then(load).catch(function(e){window.StudioModal.alert({title:'Action impossible',message:e.message});});});}
    else if(t.hasAttribute('data-prepare')){var pd=t.getAttribute('data-prepare');editDialog(null,Number(pd.slice(5,7))-1,{title:t.getAttribute('data-title'),theme:t.getAttribute('data-theme'),action_date:pd,kind:'evenement'});}
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
    else if(t.hasAttribute('data-provider-add'))providerDialog(null);
    else if(t.hasAttribute('data-provider-edit'))providerDialog((state.data.providers||[]).find(function(p){return String(p.id)===t.getAttribute('data-provider-edit');}));
    else if(t.hasAttribute('data-provider-delete'))removeProvider(t.getAttribute('data-provider-delete'));
    else if(t.hasAttribute('data-focus')){
      // La frise est dans la vue d'ensemble : on bascule sur l'onglet Actions pour montrer le détail.
      var focus=t.getAttribute('data-focus');setTab('actions');
      setTimeout(function(){var el=document.getElementById('dr-'+focus);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('is-focus');setTimeout(function(){el.classList.remove('is-focus');},1600);}},150);
    }
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
