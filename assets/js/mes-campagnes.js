(function(){
  var root=document.getElementById('campaigns-root');
  if(!root)return;

  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function resumePage(step){return {composer:'composer.html',personnalisation:'personnalisation.html',parametrage:'parametrage.html',validation:'validation.html'}[step]||'composer.html';}
  function dateFr(value){if(!value)return '—';var d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('fr-FR');}
  function statusLabel(status){
    return {
      draft:'Brouillon',
      configuration_submitted:'Configuration transmise',
      published:'Publiée',
      scheduled:'Programmée',
      closed:'Terminée',
      archived:'Archivée'
    }[status]||status||'Statut inconnu';
  }
  function statusClass(status){return status==='draft'?'badge-warning':status==='configuration_submitted'?'badge-info':status==='published'?'badge-success':'badge-muted';}
  function card(p){
    var q='?theme='+encodeURIComponent(p.theme_slug)+'&projectId='+encodeURIComponent(p.id);
    var editable=p.status==='draft';
    var action=editable
      ? '<a class="button button-primary" href="'+resumePage(p.current_step)+q+'">Continuer</a>'
      : '<a class="button button-secondary" href="validation.html'+q+'">Voir la configuration</a>';
    return '<article class="card draft-card">'+
      '<div class="draft-card-main">'+
        '<div class="badge-row"><span class="badge '+statusClass(p.status)+'">'+esc(statusLabel(p.status))+'</span><span class="tag-chip">'+esc(p.theme_title)+'</span></div>'+
        '<h3>'+esc(p.campaign_name||p.title||'Campagne sans nom')+'</h3>'+
        '<p>'+Number(p.situation_count||0)+' situations · dernière modification '+dateFr(p.updated_at)+'</p>'+
      '</div><div class="draft-card-actions">'+action+'</div></article>';
  }
  function section(title,description,projects,id){
    if(!projects.length)return '';
    return '<section class="drafts-section" aria-labelledby="'+id+'">'+
      '<div class="section-head" style="margin-top:0"><div><h2 class="section-title" id="'+id+'">'+esc(title)+'</h2><p class="section-desc">'+esc(description)+'</p></div></div>'+
      '<div class="draft-campaigns-grid">'+projects.map(card).join('')+'</div></section>';
  }
  async function load(){
    try{
      var data=await window.StudioAPI.request('/api/projects?organizationId='+encodeURIComponent(window.StudioAPI.organizationId()));
      var projects=data.projects||[];
      var drafts=projects.filter(function(p){return p.status==='draft';});
      var submitted=projects.filter(function(p){return p.status==='configuration_submitted';});
      var others=projects.filter(function(p){return p.status!=='draft'&&p.status!=='configuration_submitted';});
      if(!projects.length){
        root.innerHTML='<section class="drafts-section"><div class="section-head" style="margin-top:0"><div><h2 class="section-title">Brouillons</h2><p class="section-desc">Toute campagne commencée apparaîtra ici automatiquement.</p></div></div><div class="card empty-drafts"><strong>Aucun brouillon enregistré</strong><p>Commencez depuis la bibliothèque pour créer votre première campagne.</p></div></section>';
        return;
      }
      root.innerHTML=
        section('Brouillons','Toute campagne commencée est enregistrée en base dès sa création. Reprenez-la à l’étape où vous vous êtes arrêté·e.',drafts,'draft-title')+
        section('Configurations transmises','Configurations envoyées à Me&YouToo et désormais consultables en lecture seule.',submitted,'submitted-title')+
        section('Autres campagnes','Campagnes publiées, programmées, terminées ou archivées.',others,'other-title');
    }catch(e){root.innerHTML='<div class="composer-alert">Impossible de charger les campagnes : '+esc(e.message)+'</div>';}
  }
  load();
})();
