// Onglet admin « Stats d'activité » du dossier client : indicateurs, histogrammes et camemberts (SVG, sans bibliothèque).
(function(){
  'use strict';
  var main=document.querySelector('main.admin-client-page'),head=main&&main.querySelector('.admin-client-page-head');
  var orgId=new URLSearchParams(location.search).get('organizationId');
  if(!main||!head||!orgId||!window.StudioAPI)return;

  var PALETTE=['#007883','#273a64','#ffc000','#eb6366','#5aa9e6','#8e6bbf','#3fb68b','#f08a24','#9fb3d1'];
  var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});};
  var fmt=function(n){return Number(n||0).toLocaleString('fr-FR');};
  var plural=function(n,word){return fmt(n)+' '+word+(Number(n)>1?'s':'');};
  var date=function(v,opt){if(!v)return '—';var d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('fr-FR',opt||{day:'2-digit',month:'short',year:'numeric'});};
  var dateTime=function(v){if(!v)return '—';var d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})+' · '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});};
  var ago=function(days){if(days==null)return 'Jamais connecté';if(days===0)return "Aujourd'hui";if(days===1)return 'Hier';if(days<60)return 'Il y a '+days+' jours';return 'Il y a '+Math.round(days/30)+' mois';};

  // Barre d'onglets : « Dossier » (page actuelle) / « Stats d'activité ».
  var tabs=document.createElement('nav');
  tabs.className='cas-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Vues du dossier client');
  tabs.innerHTML='<button type="button" role="tab" data-cas-tab="folder" aria-selected="true">🗂️ Dossier</button><button type="button" role="tab" data-cas-tab="stats" aria-selected="false">📊 Stats d\'activité</button>';
  head.insertAdjacentElement('afterend',tabs);
  var panel=document.createElement('section');
  panel.className='cas-panel';panel.id='client-activity-stats';panel.hidden=true;panel.setAttribute('role','tabpanel');
  tabs.insertAdjacentElement('afterend',panel);
  var tip=document.createElement('div');tip.className='cas-tooltip';tip.hidden=true;document.body.appendChild(tip);
  panel.addEventListener('mousemove',function(e){var t=e.target.closest&&e.target.closest('[data-tip]');if(!t){tip.hidden=true;return;}tip.textContent=t.getAttribute('data-tip');tip.hidden=false;var x=e.clientX+14,y=e.clientY+14,w=tip.offsetWidth,h=tip.offsetHeight;if(x+w>innerWidth-8)x=e.clientX-w-14;if(y+h>innerHeight-8)y=e.clientY-h-14;tip.style.left=x+'px';tip.style.top=y+'px';});
  panel.addEventListener('mouseleave',function(){tip.hidden=true;});
  var loaded=false;
  function show(tab){
    tabs.querySelectorAll('[data-cas-tab]').forEach(function(b){b.setAttribute('aria-selected',String(b.dataset.casTab===tab));});
    // Masquage par classe CSS : le dossier client, qui réaffiche ses blocs en se chargeant, ne peut pas l'annuler.
    main.classList.toggle('cas-stats-mode',tab==='stats');
    panel.hidden=tab!=='stats';
    if(tab==='stats'&&!loaded)load();
    try{history.replaceState(null,'',tab==='stats'?location.pathname+location.search+'#stats':location.pathname+location.search);}catch(e){}
  }
  tabs.addEventListener('click',function(e){var b=e.target.closest('[data-cas-tab]');if(b)show(b.dataset.casTab);});

  async function load(){
    loaded=true;panel.innerHTML='<div class="cas-loading">Calcul des statistiques…</div>';
    try{render(await StudioAPI.request('/api/admin/organizations/'+encodeURIComponent(orgId)+'/activity-stats'));}
    catch(error){loaded=false;panel.innerHTML='<div class="cas-error">Statistiques indisponibles : '+esc(error.message||error)+' <button type="button" class="button button-secondary" data-cas-retry>Réessayer</button></div>';panel.querySelector('[data-cas-retry]').onclick=load;}
  }

  // ---------- Graphiques SVG ----------
  function donut(items,center,sub){
    var total=items.reduce(function(n,i){return n+i.count;},0),r=70,c=2*Math.PI*r,off=0;
    if(!total)return '<div class="cas-empty-chart">Aucune donnée</div>';
    var arcs=items.map(function(it,i){var len=it.count/total*c,seg='<circle r="'+r+'" cx="90" cy="90" fill="none" stroke="'+PALETTE[i%PALETTE.length]+'" stroke-width="26" stroke-dasharray="'+len+' '+(c-len)+'" stroke-dashoffset="'+(-off)+'" data-tip="'+esc(it.label)+' : '+fmt(it.count)+' ('+Math.round(it.count/total*100)+' %)"></circle>';off+=len;return seg;}).join('');
    var legend=items.map(function(it,i){return '<li><span class="cas-dot" style="background:'+PALETTE[i%PALETTE.length]+'"></span><span>'+esc(it.label)+'</span><strong>'+fmt(it.count)+'</strong><em>'+Math.round(it.count/total*100)+' %</em></li>';}).join('');
    return '<div class="cas-donut"><svg viewBox="0 0 180 180" role="img" aria-label="'+esc(sub)+'"><g transform="rotate(-90 90 90)">'+arcs+'</g><text x="90" y="88" text-anchor="middle" class="cas-donut-value">'+fmt(center==null?total:center)+'</text><text x="90" y="108" text-anchor="middle" class="cas-donut-sub">'+esc(sub)+'</text></svg><ul class="cas-legend">'+legend+'</ul></div>';
  }
  function columns(items,valueKey,labelOf,tipOf,color){
    var max=Math.max(1,Math.max.apply(null,items.map(function(i){return i[valueKey];}))),w=760,h=200,pad=26,bw=(w-pad*2)/items.length;
    var seen={},grid=[0.25,0.5,0.75,1].map(function(f){var y=h-pad-(h-pad*2)*f,t=Math.round(max*f);if(seen[t]||!t)return '';seen[t]=1;return '<line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+y+'" y2="'+y+'" class="cas-grid"/><text x="'+(pad-6)+'" y="'+(y+4)+'" text-anchor="end" class="cas-axis">'+fmt(Math.round(max*f))+'</text>';}).join('');
    var bars=items.map(function(it,i){var v=it[valueKey],bh=(h-pad*2)*v/max,barW=Math.min(bw*0.7,64),x=pad+i*bw+(bw-barW)/2,y=h-pad-bh,label=labelOf(it,i);
      return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+Math.max(bh,v?2:0)+'" rx="4" fill="'+color+'" data-tip="'+esc(tipOf(it))+'"></rect>'+(v&&items.length<=12?'<text x="'+(x+barW/2)+'" y="'+(y-5)+'" text-anchor="middle" class="cas-bar-value">'+fmt(v)+'</text>':'')+(label?'<text x="'+(x+barW/2)+'" y="'+(h-8)+'" text-anchor="middle" class="cas-axis">'+esc(label)+'</text>':'');}).join('');
    return '<svg viewBox="0 0 '+w+' '+h+'" class="cas-columns" role="img">'+grid+bars+'</svg>';
  }
  function hbars(items,max,color){
    max=max||Math.max(1,Math.max.apply(null,items.map(function(i){return i.count;})));
    return '<ul class="cas-hbars">'+items.map(function(it,i){return '<li><span class="cas-hbar-label" title="'+esc(it.label)+'">'+esc(it.label)+'</span><span class="cas-hbar-track"><span class="cas-hbar-fill" style="width:'+Math.max(2,it.count/max*100)+'%;background:'+(color||PALETTE[i%PALETTE.length])+'"></span></span><strong>'+fmt(it.count)+'</strong></li>';}).join('')+'</ul>';
  }
  function gauge(rate,label){
    var r=80,c=Math.PI*r,v=Math.max(0,Math.min(100,rate||0)),col=v>=80?'#eb6366':v>=50?'#ffc000':'#007883';
    return '<svg viewBox="0 0 200 120" class="cas-gauge" role="img" aria-label="'+esc(label)+'"><path d="M20 105 A80 80 0 0 1 180 105" fill="none" stroke="#e6f4f5" stroke-width="22" stroke-linecap="round"/>'+(v>0?'<path d="M20 105 A80 80 0 0 1 180 105" fill="none" stroke="'+col+'" stroke-width="22" stroke-linecap="round" stroke-dasharray="'+(c*v/100)+' '+c+'"/>':'')+'<text x="100" y="92" text-anchor="middle" class="cas-gauge-value">'+v+' %</text><text x="100" y="114" text-anchor="middle" class="cas-donut-sub">'+esc(label)+'</text></svg>';
  }
  function heatmap(grid){
    var max=Math.max(1,Math.max.apply(null,grid.map(function(r){return Math.max.apply(null,r);}))),days=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    var cells=grid.map(function(row,d){return '<text x="30" y="'+(d*22+29)+'" text-anchor="end" class="cas-axis">'+days[d]+'</text>'+row.map(function(v,hr){var o=v?0.18+0.82*v/max:0.06;return '<rect x="'+(36+hr*27)+'" y="'+(d*22+14)+'" width="24" height="19" rx="4" fill="#007883" fill-opacity="'+o.toFixed(2)+'" data-tip="'+days[d]+' · '+hr+' h : '+fmt(v)+' page'+(v>1?'s':'')+' vue'+(v>1?'s':'')+'"></rect>';}).join('');}).join('');
    var hours=[0,6,9,12,14,18,21].map(function(hr){return '<text x="'+(36+hr*27+12)+'" y="10" text-anchor="middle" class="cas-axis">'+hr+'h</text>';}).join('');
    return '<svg viewBox="0 0 690 172" class="cas-heatmap" role="img" aria-label="Pages vues par jour et par heure">'+hours+cells+'</svg>';
  }
  var card=function(title,sub,body,cls){return '<article class="cas-card '+(cls||'')+'"><header><h3>'+title+'</h3>'+(sub?'<p>'+sub+'</p>':'')+'</header>'+body+'</article>';};

  function render(s){
    var k=s.kpis,noAccount=!k.users_total,noVisit=!k.pages_total;
    var health={active:['🟢','Client actif','cas-ok'],slowing:['🟠','Activité en baisse','cas-warn'],inactive:['🔴','Client inactif','cas-bad'],never:['⚪','Aucune connexion','cas-none']}[k.health];
    var month=function(w,i){var d=new Date(w.week+'T00:00:00');return (i===0||d.getDate()<=7)?d.toLocaleDateString('fr-FR',{month:'short'}):'';};
    var tiles=[
      ['<span class="cas-health '+health[2]+'">'+health[0]+' '+health[1]+'</span>',ago(k.days_since_last_seen),k.last_seen_at?'Dernière connexion le '+date(k.last_seen_at):'Personne ne s\'est encore connecté'],
      [fmt(k.users_active_30)+'<small> / '+fmt(k.users_total)+'</small>','Utilisateurs actifs','sur les 30 derniers jours'],
      [fmt(k.visits_30),'Visites','30 jours · '+fmt(k.pages_30)+' pages vues'],
      [fmt(k.active_days_30)+'<small> j</small>','Jours de connexion','sur les 30 derniers jours'],
      [fmt(k.campaigns_total),'Campagnes',fmt(k.campaigns_ongoing)+' en cours ou programmée'+(k.campaigns_ongoing>1?'s':'')],
      [s.pack.quota?fmt(s.pack.remaining)+'<small> / '+fmt(s.pack.quota)+'</small>':(s.pack.unlimited?'∞':'—'),'Passations restantes',s.pack.expires_at?'Pack valable jusqu\'au '+date(s.pack.expires_at):'Aucun pack enregistré'],
    ].map(function(t){return '<div class="cas-tile"><div class="cas-tile-value">'+t[0]+'</div><div class="cas-tile-label">'+t[1]+'</div><div class="cas-tile-note">'+esc(t[2])+'</div></div>';}).join('');
    var notice=noAccount?'<div class="cas-notice">👋 Ce client n\'a pas encore de compte Studio. Les statistiques de connexion apparaîtront dès les premières invitations ; les chiffres des campagnes et du pack sont déjà disponibles.</div>':(noVisit?'<div class="cas-notice">Les comptes de ce client n\'ont encore consulté aucune page du Studio.</div>':'');
    var users=s.users.length?'<table class="cas-users"><thead><tr><th>Utilisateur</th><th>Dernière connexion</th><th>Visites (90 j)</th><th>Pages (90 j)</th><th>Jours actifs (90 j)</th></tr></thead><tbody>'+s.users.map(function(u){var max=Math.max(1,s.users[0].pages90);return '<tr><td><strong>'+esc(u.name)+'</strong>'+(u.active?'':' <span class="cas-tag">désactivé</span>')+'<br><small>'+esc(u.email||'')+'</small></td><td>'+dateTime(u.last_seen_at)+'</td><td>'+fmt(u.visits90)+'</td><td><span class="cas-mini"><span style="width:'+(u.pages90/max*100)+'%"></span></span>'+fmt(u.pages90)+'</td><td>'+fmt(u.days90)+'</td></tr>';}).join('')+'</tbody></table>':'<div class="cas-empty-chart">Aucun utilisateur</div>';
    var recent=s.recent_visits.length?'<ol class="cas-timeline">'+s.recent_visits.map(function(v){return '<li><time>'+dateTime(v.start)+'</time><div><strong>'+esc(v.user)+'</strong> · '+fmt(v.pages)+' page'+(v.pages>1?'s':'')+'<br><small>'+esc(v.sections.join(' · '))+(v.campaigns.length?' — '+esc(v.campaigns.join(', ')):'')+'</small></div></li>';}).join('')+'</ol>':'<div class="cas-empty-chart">Aucune visite enregistrée</div>';
    panel.innerHTML='<div class="cas-head"><div><h2>📊 Stats d\'activité</h2><p>Connexions et usage du Studio par les utilisateurs du client, campagnes et pack. Calculé le '+dateTime(s.generated_at)+'.</p></div><button type="button" class="button button-secondary" data-cas-refresh>↻ Actualiser</button></div>'+notice+
      '<div class="cas-tiles">'+tiles+'</div>'+
      '<div class="cas-grid-2">'+
        card('Activité des 6 derniers mois','Visites par semaine',!s.weekly.some(function(w){return w.visits;})?'<div class="cas-empty-chart">Aucune visite sur les 6 derniers mois</div>':columns(s.weekly,'visits',month,function(w){return 'Semaine du '+date(w.week)+' : '+plural(w.visits,'visite')+', '+plural(w.pages,'page')+' vue'+(w.pages>1?'s':'')+', '+plural(w.users,'utilisateur');},'#007883'),'cas-wide')+
        card('Rubriques consultées','Pages vues sur 90 jours',donut(s.sections,null,'pages vues'))+
        card('Quand se connectent-ils ?','Pages vues par jour et par heure, 90 jours',s.heatmap.some(function(r){return r.some(Boolean);})?heatmap(s.heatmap):'<div class="cas-empty-chart">Aucune page vue sur les 90 derniers jours</div>','cas-wide')+
        card('Campagnes','Par étape',donut(s.campaigns.lifecycle,null,'campagnes'))+
        card('Utilisation du pack',s.pack.started_at?'Pack démarré le '+date(s.pack.started_at):'',s.pack.quota?gauge(s.pack.rate,fmt(s.pack.used)+' passations utilisées')+'<p class="cas-gauge-note">'+fmt(s.pack.remaining)+' restantes sur '+fmt(s.pack.quota)+'</p>':'<div class="cas-empty-chart">'+(s.pack.unlimited?'Pack illimité':'Aucun pack')+'</div>')+
        card('Campagnes par année','Date de lancement (à défaut, de création)',s.campaigns.by_year.length?columns(s.campaigns.by_year,'count',function(y){return y.year;},function(y){return y.year+' : '+plural(y.count,'campagne');},'#273a64'):'<div class="cas-empty-chart">Aucune campagne datée</div>')+
        card('Thématiques','Nombre de campagnes',s.campaigns.by_theme.length?hbars(s.campaigns.by_theme):'<div class="cas-empty-chart">Aucune campagne</div>')+
        card('Utilisateurs','Activité de chaque compte',users,'cas-wide')+
        card('Dernières visites','Pages consultées et campagnes concernées',recent)+
        card('Campagnes les plus consultées','90 jours',s.campaigns.most_viewed.length?hbars(s.campaigns.most_viewed.map(function(p){return{label:p.name,count:p.views};}),null,'#5aa9e6'):'<div class="cas-empty-chart">Aucune consultation</div>')+
      '</div>'+deiBlock(s.dei);
    panel.querySelector('[data-cas-refresh]').onclick=load;
  }

  // Section « Actions DEI » : registre des actions du Cockpit DEI du client.
  function deiBlock(d){
    var title='<div class="cas-section-title"><h3>🧭 Actions DEI du Cockpit</h3><p>Registre des actions diversité &amp; inclusion saisies dans le Cockpit DEI du client. On mesure l\'activité et la continuité, jamais un niveau d\'inclusion.</p></div>';
    if(!d)return title+'<div class="cas-notice">Le registre des actions n\'est pas disponible sur cet environnement.</div>';
    var t=d.totals;
    if(!t.actions)return title+'<div class="cas-notice">Aucune action enregistrée dans le Cockpit DEI de ce client pour l\'instant.</div>';
    var monthNames=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    var tiles=[
      [fmt(t.actions),'Actions enregistrées',fmt(t.this_year)+' en '+d.year],
      [fmt(t.done)+'<small> / '+fmt(t.actions)+'</small>','Actions réalisées',fmt(t.in_progress)+' en cours · '+fmt(t.planned)+' prévue'+(t.planned>1?'s':'')],
      [fmt(t.people_reached),'Personnes touchées','par les actions réalisées'],
      [fmt(t.months_without_action)+'<small> mois</small>','Sans action en '+d.year,'parmi les mois déjà écoulés'],
      [fmt(t.themes),'Thématiques couvertes',fmt(t.led_by_meayt)+' action'+(t.led_by_meayt>1?'s':'')+' menée'+(t.led_by_meayt>1?'s':'')+' avec Me&YouToo'],
      [fmt(t.providers),'Prestataires',fmt(t.documents)+' document'+(t.documents>1?'s':'')+' joint'+(t.documents>1?'s':'')],
    ].map(function(x){return '<div class="cas-tile"><div class="cas-tile-value">'+x[0]+'</div><div class="cas-tile-label">'+x[1]+'</div><div class="cas-tile-note">'+esc(x[2])+'</div></div>';}).join('');
    var months=d.months.map(function(n,i){return{label:monthNames[i],count:n};});
    var upcoming=d.upcoming.length?'<ol class="cas-timeline">'+d.upcoming.map(function(a){return '<li><time>'+date(a.date)+'</time><div><strong>'+esc(a.icon+' '+a.title)+'</strong><br><small>'+esc(a.kind)+' · '+esc(a.status)+'</small></div></li>';}).join('')+'</ol>':'<div class="cas-empty-chart">Aucune action prévue à venir</div>';
    return title+'<div class="cas-tiles">'+tiles+'</div><div class="cas-grid-2">'+
      card('Rythme des actions en '+d.year,'Actions par mois (date de début)',columns(months,'count',function(m){return m.label;},function(m){return m.label+' '+d.year+' : '+m.count+' action'+(m.count>1?'s':'');},'#8e6bbf'),'cas-wide')+
      card('Familles d\'actions','Toutes années confondues',donut(d.by_group,null,'actions'))+
      card('Avancement','Statut des actions',donut(d.by_status.filter(function(s){return s.count;}),t.done,'réalisées'))+
      card('Types d\'actions les plus utilisés','Toutes années confondues',hbars(d.by_kind))+
      card('Actions par année','Date de début',d.by_year.length?columns(d.by_year,'count',function(y){return y.year;},function(y){return y.year+' : '+y.count+' action'+(y.count>1?'s':'');},'#273a64'):'<div class="cas-empty-chart">Aucune action datée</div>')+
      card('Prochaines actions prévues','À venir',upcoming,'cas-wide')+
    '</div>';
  }

  if(location.hash==='#stats')show('stats');
})();
