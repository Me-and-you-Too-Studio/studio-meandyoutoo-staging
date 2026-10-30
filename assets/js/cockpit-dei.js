(function(){
  var user=null;
  try{user=window.StudioAPI?StudioAPI.user():JSON.parse(localStorage.getItem('studio_user')||'null');}catch(e){}
  var isAdmin=Boolean(user&&user.role==='admin');
  var audience=new URLSearchParams(location.search).get('audience');
  var adminView=isAdmin&&audience!=='client';
  ['dei-calendar-link','dei-final-calendar-link'].forEach(function(id){
    var link=document.getElementById(id);
    if(link)link.href=adminView?'calendrier.html':'calendrier.html?audience=client';
  });

  // Mode admin (cockpit-dei.html?organizationId=…) : on saisit le registre d'un client ; le parcours ne concerne que le compte connecté.
  var adminOrganizationId=isAdmin?new URLSearchParams(location.search).get('organizationId'):null;
  if(adminOrganizationId){
    var banner=document.getElementById('dei-admin-banner');
    if(banner){banner.hidden=false;banner.innerHTML='Vous consultez le Cockpit DEI de ce client en tant que Me&amp;YouToo : les actions que vous ajoutez sont marquées « Animée par Me&amp;YouToo ». <a href="client.html?organizationId='+encodeURIComponent(adminOrganizationId)+'">← Retour au dossier client</a>';}
    return;
  }

  // ── Votre année avec Me&YouToo : frise des campagnes et comparaison avec ses propres campagnes. ──
  var root=document.getElementById('dei-year');
  if(!root||!window.StudioAPI)return;
  var INFO='Un même collaborateur peut répondre à plusieurs campagnes, ou plusieurs fois à une même campagne : on parle donc de participations enregistrées, pas de collaborateurs. Chiffres mis à jour chaque nuit.';
  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){return new Intl.NumberFormat('fr-FR').format(Number(v)||0);}
  function day(v){return v?new Date(String(v).slice(0,10)+'T12:00:00'):null;}
  function month(v){var d=day(v);return d?d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}):'Date à venir';}
  function pct(c){return c.objective&&c.respondents!=null?Math.round(c.respondents/c.objective*100):null;}
  // Série d'activité métier (pas de connexions) : trimestres consécutifs avec une campagne en diffusion.
  function quarterStreak(campaigns,now){
    var q=function(d){return d.getFullYear()*4+Math.floor(d.getMonth()/3);},active={};
    campaigns.forEach(function(c){var s=day(c.launch_date);if(!s||s>now)return;var e=day(c.close_date);e=e&&e<now?e:now;for(var i=q(s);i<=q(e);i++)active[i]=true;});
    var cur=active[q(now)]?q(now):q(now)-1,streak=0;while(active[cur]){streak++;cur--;}return streak;
  }

  function render(campaigns,passationsUsed){
    var now=new Date(),yearAgo=new Date(now.getFullYear()-1,now.getMonth(),now.getDate());
    var year=campaigns.filter(function(c){var d=day(c.launch_date);return c.status==='scheduled'||(d&&d>=yearAgo);});
    var started=campaigns.filter(function(c){return c.status!=='scheduled'&&c.launch_date;});
    if(!campaigns.length){
      root.innerHTML='<div class="dy-head"><p class="eyebrow">Votre année avec Me&amp;YouToo</p><h2>Votre frise démarre avec votre première campagne</h2><p>Chaque campagne lancée viendra s’ajouter ici, avec sa participation.</p></div><a class="button button-primary sp-cta is-pulse" href="bibliotheque.html">Découvrir les diagnostics →</a>';
      root.hidden=false;return;
    }
    // Participations rapportées à la première campagne, pas à une fenêtre de 12 mois.
    var participations=started.reduce(function(s,c){return s+(Number(c.respondents)||0);},0);
    // Aucune campagne lue (stats protégées) : on reprend les passations utilisées du pack.
    var fromCredits=participations===0&&started.length>0&&Number(passationsUsed)>0;
    if(fromCredits)participations=Number(passationsUsed);
    var first=started[0]?day(started[0].launch_date):null;
    var days=first?Math.max(1,Math.round((now-first)/(1000*60*60*24))):0;
    var months=first?Math.max(1,Math.round(days/30.44)):0;
    var perWeek=days>=14?Math.round(participations/days*7):null;
    var since=first?first.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'';
    var streak=quarterStreak(started,now);
    var themes=new Set(started.map(function(c){return c.theme_slug||c.theme_title;}).filter(Boolean)).size;
    var items=year.map(function(c){
      var p=pct(c),upcoming=c.status==='scheduled';
      return '<li class="dy-item'+(upcoming?' is-upcoming':'')+'"><span class="dy-dot" aria-hidden="true"></span>'+
        '<p class="dy-month">'+esc(month(c.launch_date))+'</p><strong>'+esc(c.name)+'</strong><span class="dy-theme">'+esc(c.theme_title||'')+'</span>'+
        '<span class="dy-stats">'+(upcoming?'Programmée':(c.respondents==null?'Répondants bientôt disponibles':num(c.respondents)+' répondants'+(p!=null?' · <b>'+p+' %</b>':'')))+'</span></li>';
    }).join('');

    // Comparaison avec ses propres campagnes, jamais avec d'autres clients.
    var measured=started.filter(function(c){return pct(c)!=null;});
    var bench='';
    if(measured.length>=2){
      var values=measured.map(pct),avg=Math.round(values.reduce(function(a,b){return a+b;},0)/values.length);
      var last=measured[measured.length-1],lastPct=pct(last),best=measured.reduce(function(a,b){return pct(b)>pct(a)?b:a;});
      var progress=lastPct-pct(measured[0]);
      bench='<div class="dy-bench">'+
        '<article><span>Participation moyenne</span><strong>'+avg+' %</strong><small>sur '+measured.length+' campagnes</small></article>'+
        '<article><span>Dernière campagne</span><strong>'+lastPct+' % <em class="'+(lastPct>=avg?'is-up':'is-down')+'">'+(lastPct>=avg?'↑':'↓')+'</em></strong><small>'+esc(last.name)+'</small></article>'+
        '<article><span>Meilleure campagne</span><strong>'+pct(best)+' %</strong><small>'+esc(best.name)+'</small></article>'+
        '<article class="'+(progress>=0?'is-progress':'')+'"><span>Depuis votre première campagne</span><strong>'+(progress>=0?'+':'')+progress+' pts</strong><small>de participation</small></article>'+
      '</div>';
    }
    root.innerHTML='<div class="dy-head"><p class="eyebrow">Votre parcours avec Me&amp;YouToo</p>'+
        '<h2><span class="dy-count">'+num(participations)+'</span> participation'+(participations>1?'s':'')+' enregistrée'+(participations>1?'s':'')+(since?' depuis votre première campagne':'')+(fromCredits?'<small class="dy-source"> (d’après les passations utilisées de votre pack)</small>':'')+' <button type="button" class="admin-info-dot" data-info="'+esc(INFO)+'" aria-label="Comprendre les participations" aria-haspopup="dialog">i</button></h2>'+
        '<p>'+(since?'Première campagne le '+esc(since)+' · actif depuis '+months+' mois'+(perWeek?' · environ '+num(perWeek)+' participations par semaine':'')+' · ':'')+campaigns.length+' campagne'+(campaigns.length>1?'s':'')+' · '+themes+' thématique'+(themes>1?'s':'')+' explorée'+(themes>1?'s':'')+'</p>'+(streak>=2?'<p class="dy-streak">🔥 '+streak+' trimestres consécutifs avec une campagne en cours</p>':'')+'</div>'+
      (items?'<ol class="dy-timeline">'+items+'</ol>':'<p class="dy-empty">Aucune campagne sur les 12 derniers mois.</p>')+
      bench+
      '<div class="dy-next"><span>Gardez la dynamique : planifiez votre prochaine campagne.</span><a class="button button-primary sp-cta is-pulse" href="bibliotheque.html">Choisir une thématique →</a></div>';
    root.hidden=false;
  }

  StudioAPI.request('/api/me/program').then(function(data){render(Array.isArray(data.campaigns)?data.campaigns:[],data.passationsUsed);}).catch(function(){});
})();
