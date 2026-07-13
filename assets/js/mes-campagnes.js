(function(){
  var root=document.getElementById('draft-campaigns-root');
  if(!root)return;
  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function resumePage(step){return {composer:'composer.html',personnalisation:'personnalisation.html',parametrage:'parametrage.html',validation:'validation.html'}[step]||'composer.html';}
  function statusLabel(status){return status==='configuration_submitted'?'Configuration transmise':status==='draft'?'Brouillon':'Statut : '+status;}
  async function load(){
    try{
      var data=await window.StudioAPI.request('/api/projects?organizationId='+encodeURIComponent(window.StudioAPI.organizationId()));
      var projects=data.projects||[];
      if(!projects.length){root.innerHTML='<div class="card empty-drafts"><strong>Aucun brouillon enregistré</strong><p>Commencez depuis la bibliothèque pour créer votre première campagne.</p></div>';return;}
      root.innerHTML=projects.map(function(p){
        var q='?theme='+encodeURIComponent(p.theme_slug)+'&projectId='+encodeURIComponent(p.id);
        var editable=p.status==='draft';
        return '<article class="card draft-card"><div class="draft-card-main"><div class="badge-row"><span class="badge '+(editable?'badge-warning':'badge-info')+'">'+statusLabel(p.status)+'</span><span class="tag-chip">'+esc(p.theme_title)+'</span></div><h3>'+esc(p.campaign_name||p.title)+'</h3><p>'+Number(p.situation_count||0)+' situations · dernière modification '+new Date(p.updated_at).toLocaleDateString('fr-FR')+'</p></div><div class="draft-card-actions">'+(editable?'<a class="button button-primary" href="'+resumePage(p.current_step)+q+'">Continuer</a>':'<a class="button button-secondary" href="validation.html'+q+'">Voir la configuration</a>')+'</div></article>';
      }).join('');
    }catch(e){root.innerHTML='<div class="composer-alert">Impossible de charger les brouillons : '+esc(e.message)+'</div>';}
  }
  load();
})();
