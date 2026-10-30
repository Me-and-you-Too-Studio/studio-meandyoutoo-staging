// Bilan D&I annuel : page mise en forme pour l'impression (« Enregistrer au format PDF »).
// bilan-dei.html?year=2026 ; en admin : &organizationId=… pour le bilan d'un client.
// On mesure l'activité du client et sa progression par rapport à lui-même, jamais par rapport à d'autres clients.
(function(){
  'use strict';
  var doc=document.getElementById('bl-doc');
  if(!doc||!window.StudioAPI)return;
  if(!StudioAPI.requireAuth())return;
  var params=new URLSearchParams(location.search);
  var user=null;try{user=StudioAPI.user();}catch(e){}
  var isAdmin=Boolean(user&&user.role==='admin');
  var organizationId=isAdmin?params.get('organizationId'):null;
  var year=/^\d{4}$/.test(params.get('year')||'')?Number(params.get('year')):new Date().getFullYear();
  var MONTHS=['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];
  var STATUS={done:'Réalisée',in_progress:'En cours',planned:'Prévue'};
  // Temps forts de l'année suivante mis en avant dans les perspectives.
  var EVENTS=[['8 mars','Journée internationale des droits des femmes'],['17 mai','Journée contre l’homophobie, la transphobie et la biphobie'],['Juin','Mois des fiertés'],['Novembre','SEEPH — Semaine européenne pour l’emploi des personnes handicapées'],['25 novembre','Journée pour l’élimination de la violence à l’égard des femmes'],['3 décembre','Journée internationale des personnes handicapées']];

  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){return new Intl.NumberFormat('fr-FR').format(Number(v)||0);}
  function plural(n,word){return num(n)+' '+word+(Number(n)>1?'s':'');}
  function fmtDate(v){if(!v)return '';var d=new Date(String(v).slice(0,10)+'T12:00:00');return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});}
  function qs(y){var p=new URLSearchParams({year:String(y)});if(organizationId)p.set('organizationId',organizationId);return '?'+p.toString();}
  function today(){return new Date().toISOString().slice(0,10);}
  function cockpitHref(){return 'cockpit-dei.html'+(organizationId?'?organizationId='+encodeURIComponent(organizationId):'');}

  // Actions du registre + campagnes de diagnostic dans un même format.
  function items(d){
    var t=today();
    return d.actions.map(function(a){return {kind:a.kind,title:a.title,date:a.action_date,end:a.end_date,status:a.status,theme:a.theme,audience:a.audience,people:a.people_reached,provider:a.led_by_meayt?'Me&YouToo':a.provider_name,documents:a.documents||[]};})
      .concat(d.campaigns.map(function(c){return {kind:'diagnostic',title:c.name,date:c.launch_date,end:c.close_date,campaign:true,
        status:(['closed','completed','unpublished'].indexOf(c.status)>=0||(c.close_date&&c.close_date<t))?'done':'in_progress',
        theme:c.theme_title,people:c.respondents,provider:'Me&YouToo',documents:[]};}))
      .sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
  }
  function kindOf(d,k){return (d.kinds||{})[k]||{label:k,icon:'•'};}
  function load(y){return StudioAPI.request('/api/dei/actions'+qs(y)).catch(function(){return null;});}

  function start(){
    document.getElementById('bl-back').href=cockpitHref();
    if(isAdmin&&!organizationId){doc.innerHTML='<p class="bl-loading">Ouvrez le bilan depuis le Cockpit DEI d’un client.</p>';return;}
    Promise.all([StudioAPI.request('/api/dei/actions'+qs(year)),load(year-1),load(year+1)]).then(function(r){render(r[0],r[1],r[2]);})
      .catch(function(e){doc.innerHTML='<p class="bl-loading">Le bilan est momentanément indisponible. '+esc(e.message||'')+'</p>';});
  }

  function render(d,prev,next){
    var select=document.getElementById('bl-year');
    select.innerHTML=d.years.filter(function(y){return y<=new Date().getFullYear()+1;}).map(function(y){return '<option'+(y===year?' selected':'')+'>'+y+'</option>';}).join('');
    select.onchange=function(){params.set('year',select.value);location.search=params.toString();};
    var org=d.organizationName||(user&&user.organizationName)||'';
    document.title='Bilan D&I '+year+(org?' — '+org:'')+' — Studio Me&YouToo';
    var list=items(d),ind=d.indicators,p=d.pilotage||{objectives:[],quarters:[]};
    var done=list.filter(function(i){return i.status==='done';});
    var generated=new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
    var logo=user&&user.role==='client'?(user.organizationLogoUrl||user.organizationLogoData||''):(organizationId?'/media/organizations/'+encodeURIComponent(organizationId)+'/logo':'');
    if(logo&&logo.charAt(0)==='/')logo=StudioAPI.base()+logo;
    var html='';

    // 1. Couverture
    html+='<section class="bl-page bl-cover">'+
      '<div class="bl-cover-logos"><img src="assets/img/brand/logo-studio-blue.png" alt="Le Studio Me&amp;YouToo">'+(logo?'<img class="bl-client-logo" src="'+esc(logo)+'" alt="'+esc(org)+'" onerror="this.remove()">':'')+'</div>'+
      '<div class="bl-cover-title"><p class="bl-eyebrow">Bilan diversité &amp; inclusion</p><h1>'+year+'</h1>'+(org?'<p class="bl-org">'+esc(org)+'</p>':'')+
      '<p class="bl-cover-intro">Actions menées, personnes touchées, objectifs et perspectives : la synthèse de l’année, prête à partager avec la direction, le CSE ou dans le rapport RSE.</p></div>'+
      '<p class="bl-cover-foot">Généré le '+esc(generated)+(year>=new Date().getFullYear()?' · année en cours : les chiffres évolueront jusqu’au 31 décembre':'')+'</p></section>';

    // 2. L'année en chiffres + comparaison avec l'année précédente
    var pind=prev&&prev.indicators;
    var participation=participationRate(d.campaigns);
    var kpis=[[ind.done,'action réalisée','actions réalisées',pind&&pind.done],[ind.peopleReached,'personne touchée','personnes touchées',pind&&pind.peopleReached],
      [ind.formats,'format utilisé','formats utilisés',pind&&pind.formats],[ind.themes,'thématique couverte','thématiques couvertes',pind&&pind.themes],
      [activeQuarters(list),'trimestre actif','trimestres actifs (sur 4)',null]];
    html+='<section class="bl-page"><h2>L’année en chiffres</h2><div class="bl-kpis">'+kpis.map(function(k){
      var delta=pind&&k[3]!=null&&(pind.actions||pind.peopleReached)?deltaText(k[0],k[3]):'';
      return '<div class="bl-kpi"><strong>'+num(k[0])+'</strong><span>'+(Number(k[0])>1?k[2]:k[1])+'</span>'+(delta?'<em>'+delta+'</em>':'')+'</div>';
    }).join('')+(participation!=null?'<div class="bl-kpi"><strong>'+participation+' %</strong><span>participation moyenne aux diagnostics</span></div>':'')+'</div>'+
      (ind.planned?'<p class="bl-note">'+(ind.planned>1?num(ind.planned)+' autres actions en cours ou prévues':'1 autre action en cours ou prévue')+' sur l’année.</p>':'')+
      (pind&&(pind.actions||pind.peopleReached)?'<p class="bl-note">Les variations sont calculées par rapport à votre année '+(year-1)+'.</p>':'')+
      formatsBlock(d,list)+themesBlock(list)+
      '<h3>La frise de l’année</h3>'+frise(d,list)+'</section>';

    // 3. Objectifs
    html+='<section class="bl-page"><h2>Objectifs '+year+'</h2>'+(p.objectives.length?'<ul class="bl-objs">'+p.objectives.map(objective).join('')+'</ul>':'<p class="bl-note">Aucun objectif n’a été fixé pour '+year+'.</p>');

    // 4. Diagnostics comportementaux
    if(d.campaigns.length){
      html+='<h3>Diagnostics comportementaux</h3><table class="bl-table"><thead><tr><th>Campagne</th><th>Thématique</th><th>Période</th><th>Participations</th></tr></thead><tbody>'+
        d.campaigns.map(function(c){var rate=Number(c.objective)>0&&c.respondents!=null?Math.round(Number(c.respondents)/Number(c.objective)*100):null;
          return '<tr><td>'+esc(c.name)+'</td><td>'+esc(c.theme_title||'—')+'</td><td>'+esc(fmtDate(c.launch_date))+(c.close_date?' → '+esc(fmtDate(c.close_date)):'')+'</td><td>'+(c.respondents!=null?num(c.respondents)+(rate!=null?' ('+rate+' %)':''):'—')+'</td></tr>';}).join('')+'</tbody></table>';
    }
    // Plans d'actions issus des restitutions : recommandations de Me&YouToo et leur avancement.
    var plans=((d.diagnostics||{}).plans||[]).filter(function(pl){
      var y=String(year);return String(pl.campaign.closeDate||'').slice(0,4)===y||pl.actions.some(function(x){return String(x.action_date).slice(0,4)===y;})||(pl.restitution&&String(pl.restitution.action_date).slice(0,4)===y);
    }).filter(function(pl){return pl.total;});
    if(plans.length){
      html+='<h3>Plans d’actions issus des diagnostics</h3>'+plans.map(function(pl){
        var pct=Math.round(pl.done/pl.total*100);
        return '<div class="bl-plan"><div class="bl-obj-head"><strong>Diagnostic « '+esc(pl.campaign.name)+' »</strong><span class="bl-plan-count">'+pl.done+' réalisée'+(pl.done>1?'s':'')+' sur '+pl.total+' recommandation'+(pl.total>1?'s':'')+'</span></div>'+
          (pl.restitution?'<p class="bl-obj-meta">Restitution des résultats le '+esc(fmtDate(pl.restitution.action_date))+', avec les recommandations de Me&amp;YouToo.</p>':'')+
          '<div class="bl-bar"><i style="width:'+pct+'%"></i></div><ul class="bl-list bl-reco">'+pl.actions.map(function(x){
            return '<li><span>'+esc(fmtDate(x.action_date))+'</span> '+esc(x.title)+' <em class="bl-st st-'+esc(x.status)+'">'+esc(STATUS[x.status]||x.status)+'</em></li>';}).join('')+'</ul></div>';
      }).join('');
    }
    html+='</section>';

    // 5. Détail des actions par trimestre
    html+='<section class="bl-page"><h2>Le détail des actions</h2>';
    [1,2,3,4].forEach(function(q){
      var inQ=list.filter(function(i){return Math.floor((Number(String(i.date).slice(5,7))-1)/3)+1===q;});
      html+='<h3>'+q+(q===1?'er':'e')+' trimestre <small>'+plural(inQ.length,'action')+'</small></h3>';
      if(!inQ.length){html+='<p class="bl-note">Aucune action ce trimestre.</p>';return;}
      html+='<table class="bl-table bl-actions"><thead><tr><th>Date</th><th>Action</th><th>Thématiques et public</th><th>Pers.</th><th>Statut</th></tr></thead><tbody>'+inQ.map(function(i){
        var k=kindOf(d,i.kind);
        var sub=[k.label,i.provider?'par '+i.provider:''].filter(Boolean).join(' · ');
        var docs=i.documents.length?'<span class="bl-docs">📎 '+i.documents.map(function(x){return esc(x.filename);}).join(', ')+'</span>':'';
        return '<tr><td>'+esc(fmtDate(i.date))+(i.end&&i.end!==i.date?'<br><small>→ '+esc(fmtDate(i.end))+'</small>':'')+'</td><td><strong>'+esc(i.title)+'</strong><br><small>'+esc(sub)+'</small>'+docs+'</td>'+
          '<td>'+esc(i.theme||'—')+(i.audience?'<br><small>'+esc(i.audience)+'</small>':'')+'</td><td>'+(i.people!=null&&i.people!==''?num(i.people):'—')+'</td><td><span class="bl-st st-'+esc(i.status)+'">'+esc(STATUS[i.status]||i.status)+'</span></td></tr>';
      }).join('')+'</tbody></table>';
    });
    html+='</section>';

    // 6. Perspectives
    html+='<section class="bl-page bl-next"><h2>Perspectives '+(year+1)+'</h2>';
    var nextList=next?items(next):[];
    if(nextList.length)html+='<h3>Déjà prévu</h3><ul class="bl-list">'+nextList.map(function(i){return '<li><span>'+esc(fmtDate(i.date))+'</span> '+esc(i.title)+'</li>';}).join('')+'</ul>';
    if(next&&next.pilotage&&next.pilotage.objectives.length)html+='<h3>Objectifs déjà fixés</h3><ul class="bl-list">'+next.pilotage.objectives.map(function(o){return '<li>'+esc(objectiveTitle(o))+'</li>';}).join('')+'</ul>';
    var notices=(d.pilotage&&d.pilotage.attention&&d.pilotage.attention.notices)||[];
    notices.forEach(function(n){html+='<div class="bl-notice"><strong>'+esc(n.title)+'</strong><p>'+esc(n.text)+'</p></div>';});
    html+='<h3>Temps forts à ne pas manquer</h3><ul class="bl-list">'+EVENTS.map(function(e){return '<li><span>'+esc(e[0])+'</span> '+esc(e[1])+'</li>';}).join('')+'</ul>'+
      '<div class="bl-cta"><img src="assets/img/brand/logo-meayt-color.png" alt="Me&amp;YouToo"><div><strong>Construire votre plan '+(year+1)+' avec Me&amp;YouToo</strong>'+
      '<p>Diagnostics comportementaux, conférences, formations, ateliers, vidéos et e-learning : nous vous aidons à bâtir une année D&amp;I continue, au plus près de vos enjeux. Demandez un accompagnement depuis votre Cockpit DEI ou écrivez-nous.</p><p class="bl-cta-link">meandyoutoo.app</p></div></div></section>';
    doc.innerHTML=html+'<footer class="bl-footer">Bilan généré avec le Studio Me&amp;YouToo · '+esc(org)+' · '+year+'</footer>';
    document.getElementById('bl-print').disabled=false;
  }

  function deltaText(value,before){
    value=Number(value)||0;before=Number(before)||0;
    if(value===before)return 'stable par rapport à '+(year-1);
    if(!before)return 'contre 0 en '+(year-1);
    var pct=Math.round((value-before)/before*100);
    return (pct>0?'+':'')+pct+' % par rapport à '+(year-1);
  }
  function participationRate(campaigns){
    var m=campaigns.filter(function(c){return Number(c.objective)>0&&c.respondents!=null;});
    if(!m.length)return null;
    return Math.round(m.reduce(function(s,c){return s+Number(c.respondents)/Number(c.objective)*100;},0)/m.length);
  }
  function activeQuarters(list){
    var q={};list.forEach(function(i){if(i.status!=='planned'&&String(i.date).slice(0,4)===String(year))q[Math.floor((Number(String(i.date).slice(5,7))-1)/3)]=1;});
    return Object.keys(q).length;
  }
  function formatsBlock(d,list){
    var counts={};list.forEach(function(i){counts[i.kind]=(counts[i.kind]||0)+1;});
    var keys=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];});
    if(!keys.length)return '';
    return '<h3>Les formats utilisés</h3><ul class="bl-tags">'+keys.map(function(k){var kd=kindOf(d,k);return '<li>'+esc(kd.icon)+' '+esc(kd.label)+' <b>'+counts[k]+'</b></li>';}).join('')+'</ul>';
  }
  function themesBlock(list){
    var counts={},label={};
    list.forEach(function(i){String(i.theme||'').split(',').map(function(s){return s.trim();}).filter(Boolean).forEach(function(t){var k=t.toLowerCase();counts[k]=(counts[k]||0)+1;label[k]=label[k]||t;});});
    var keys=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];});
    if(!keys.length)return '';
    return '<h3>Les thématiques travaillées</h3><ul class="bl-tags">'+keys.map(function(k){return '<li>'+esc(label[k])+' <b>'+counts[k]+'</b></li>';}).join('')+'</ul>';
  }
  function frise(d,list){
    var byMonth=MONTHS.map(function(){return [];});
    list.forEach(function(i){if(String(i.date).slice(0,4)===String(year))byMonth[Number(String(i.date).slice(5,7))-1].push(i);});
    return '<div class="bl-frise">'+byMonth.map(function(its,m){
      return '<div class="bl-month"><b>'+MONTHS[m]+'</b>'+(its.length?its.map(function(i){return '<span class="bl-pill st-'+esc(i.status)+'">'+esc(kindOf(d,i.kind).icon)+' '+esc(i.title)+'</span>';}).join(''):'<span class="bl-empty">—</span>')+'</div>';
    }).join('')+'</div>';
  }
  function objectiveTitle(o){
    return o.metric==='custom'?o.label:o.metric==='strategic'?(o.label||('Enjeu : '+o.themes)):(o.metricLabel+(o.label?' — '+o.label:''));
  }
  function objective(o){
    var strategic=o.metric==='strategic',custom=o.metric==='custom',figure,pct,reached;
    if(strategic){
      var s=o.strategic||{done:0,planned:0,people:0};
      reached=o.done;pct=o.done?100:(o.target?Math.min(100,Math.round(s.people/o.target*100)):(s.done?50:(s.planned?20:0)));
      figure=(o.done?'Atteint · ':'')+plural(s.done,'action')+' réalisée'+(s.done>1?'s':'')+(s.planned?' · '+s.planned+' prévue'+(s.planned>1?'s':''):'')+' · '+plural(s.people,'personne')+' touchée'+(s.people>1?'s':'')+(o.target?' sur '+num(o.target)+' visées':'');
    }else{
      pct=custom?(o.done?100:0):(o.value==null||!o.target?0:Math.min(100,Math.round(o.value/o.target*100)));
      reached=custom?o.done:(o.value!=null&&o.target&&o.value>=o.target);
      figure=custom?(o.done?'Atteint':'En cours'):(o.value==null?'Pas encore mesurable':num(o.value)+' / '+num(o.target)+(o.unit==='%'?' %':' '+o.unit));
    }
    var meta=[strategic&&o.themes&&o.label?'Thématiques : '+o.themes:'',o.audiences?'Publics : '+o.audiences:''].filter(Boolean).map(esc).join(' · ');
    return '<li class="'+(reached?'is-reached':'')+'"><div class="bl-obj-head"><strong>'+esc(objectiveTitle(o))+'</strong>'+(reached?'<span class="bl-ok">✓ Atteint</span>':'')+'</div>'+
      (meta?'<p class="bl-obj-meta">'+meta+'</p>':'')+'<div class="bl-bar"><i style="width:'+pct+'%"></i></div><p class="bl-obj-figure">'+esc(figure)+'</p></li>';
  }

  document.getElementById('bl-print').addEventListener('click',function(){window.print();});
  start();
})();
