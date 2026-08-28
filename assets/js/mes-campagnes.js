(function(){
  var draftRoot=document.getElementById('draft-campaigns-root');
  var activeRoot=document.getElementById('active-campaigns-root');
  var tableBody=document.getElementById('campaigns-table-body');
  var filtersRoot=document.getElementById('campaign-filters');
  var search=document.getElementById('campaignSearch');
  var table=document.getElementById('campaignsTable');
  var noResults=document.getElementById('noResults');
  if(!draftRoot||!activeRoot||!tableBody||!filtersRoot)return;

  var projects=[];
  var activeFilter='all';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function dateFr(value){
    if(!value)return '—';
    var d=new Date(value);
    return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('fr-FR');
  }

  function resumePage(step){
    return {
      composer:'composer.html',
      personnalisation:'personnalisation.html',
      parametrage:'parametrage.html',
      validation:'validation.html'
    }[step]||'composer.html';
  }

  function statusLabel(status){
    return {
      draft:'Brouillon',
      configuration_submitted:'Configuration transmise',
      published:'Publiée',
      scheduled:'Programmée',
      active:'En cours',
      unpublished:'Dépubliée',
      closed:'Terminée',
      completed:'Terminée',
      archived:'Archivée'
    }[status]||status||'Statut inconnu';
  }

  function statusClass(status){
    if(status==='draft')return 'badge-warning';
    if(status==='configuration_submitted'||status==='scheduled')return 'badge-info';
    if(status==='published'||status==='active')return 'badge-success';
    if(status==='unpublished'||status==='archived')return 'badge-muted';
    return 'badge-muted';
  }

  function query(p){
    return '?theme='+encodeURIComponent(p.theme_slug||'sexisme')+'&projectId='+encodeURIComponent(p.id);
  }

  function campaignName(p){
    return p.campaign_name||p.respondent_title||p.title||p.theme_title||'Campagne sans nom';
  }

  function actionHtml(p,primary){
    var q=query(p),id=esc(p.id),kit='<a class="button button-secondary" href="kit-communication.html'+q+'">📣 Kit de com</a>';
    if(p.status==='draft')return '<div class="campaign-action-group"><a class="button '+(primary?'button-primary':'button-secondary')+'" href="'+resumePage(p.current_step)+q+'">Reprendre le paramétrage</a><button class="button button-danger-soft" type="button" data-project-action="delete" data-project-id="'+id+'">🗑️ Supprimer</button></div>';
    if(p.status==='configuration_submitted')return '<div class="campaign-action-group"><a class="button button-secondary" href="validation.html'+q+'">👁️ Voir le contenu</a>'+kit+'</div>';
    if(['scheduled','published','active'].includes(p.status))return '<div class="campaign-action-group"><a class="button button-secondary" href="campagne-detail.html'+q+'">👁️ Voir le contenu</a>'+kit+'<button class="button button-secondary" type="button" data-project-action="clone" data-project-id="'+id+'">🧬 Cloner</button></div>';
    if(['closed','completed','unpublished'].includes(p.status))return '<div class="campaign-action-group"><button class="button button-primary" type="button" data-project-action="reprogram" data-project-id="'+id+'">🚀 Reprogrammer</button><a class="button button-secondary" href="campagne-detail.html'+q+'">👁️ Voir le contenu</a>'+kit+'<button class="button button-secondary" type="button" data-project-action="clone" data-project-id="'+id+'">🧬 Cloner</button><button class="button button-secondary" type="button" data-project-action="archive" data-project-id="'+id+'">📦 Archiver</button><button class="button button-danger-soft" type="button" data-project-action="delete" data-project-id="'+id+'">🗑️ Supprimer</button></div>';
    if(p.status==='archived')return '<div class="campaign-action-group"><button class="button button-primary" type="button" data-project-action="reprogram" data-project-id="'+id+'">🚀 Reprogrammer</button><a class="button button-secondary" href="campagne-detail.html'+q+'">👁️ Voir le contenu</a>'+kit+'<button class="button button-secondary" type="button" data-project-action="clone" data-project-id="'+id+'">🧬 Cloner</button><button class="button button-secondary" type="button" data-project-action="restore" data-project-id="'+id+'">↩️ Restaurer</button></div>';
    return '<a class="button button-secondary" href="campagne-detail.html'+q+'">Voir la campagne</a>';
  }

  async function projectAction(action,id){
    var p=projects.find(function(x){return String(x.id)===String(id);});if(!p)return;
    if(action==='delete'){var ok=await StudioModal.confirm({type:'danger',title:'Supprimer cet autodiagnostic ?',message:'Cette suppression est définitive.',confirmLabel:'Supprimer'});if(!ok)return;await StudioAPI.request('/api/projects/'+id,{method:'DELETE'});return load();}
    if(action==='archive'){var ok2=await StudioModal.confirm({title:'Archiver cet autodiagnostic ?',message:'Il sera déplacé dans vos archives et restera reprogrammable.',confirmLabel:'Archiver'});if(!ok2)return;await StudioAPI.request('/api/projects/'+id+'/archive',{method:'PATCH',body:'{}'});return load();}
    if(action==='restore'){var okRestore=await StudioModal.confirm({title:'Restaurer cette campagne ?',message:'Elle reviendra dans vos campagnes dépubliées.',confirmLabel:'Restaurer'});if(!okRestore)return;await StudioAPI.request('/api/projects/'+id+'/restore',{method:'PATCH',body:'{}'});return load();}
    if(action==='reprogram'){var ok3=await StudioModal.confirm({title:'Reprogrammer cet autodiagnostic ?',message:'La même URL sera conservée. Vous pourrez choisir de nouvelles dates.',confirmLabel:'Reprogrammer'});if(!ok3)return;await StudioAPI.request('/api/projects/'+id+'/reprogram',{method:'POST',body:'{}'});location.href='parametrage.html'+query(p)+'&reprogram=1';return;}
    if(action==='clone'){var ok4=await StudioModal.confirm({title:'Cloner cet autodiagnostic ?',message:'Une copie indépendante sera créée et recevra de nouveaux liens après publication.',confirmLabel:'Cloner'});if(!ok4)return;var r=await StudioAPI.request('/api/projects/'+id+'/clone',{method:'POST',body:'{}'});location.href='composer.html?projectId='+encodeURIComponent(r.project.id);}
  }
  function bindProjectActions(){document.querySelectorAll('[data-project-action]').forEach(function(b){b.onclick=function(){projectAction(b.dataset.projectAction,b.dataset.projectId).catch(function(e){StudioModal.alert({title:'Action impossible',message:e.message||'Une erreur est survenue.',confirmLabel:'Fermer'});});};});}

  function renderDrafts(){
    var drafts=projects.filter(function(p){return p.status==='draft';});
    if(!drafts.length){
      draftRoot.innerHTML='<div class="card empty-drafts"><strong>Aucun brouillon enregistré</strong><p>Commencez depuis la bibliothèque pour créer votre première campagne.</p></div>';
      return;
    }
    draftRoot.innerHTML=drafts.map(function(p){
      return '<article class="card draft-card">'+
        '<div class="draft-card-main">'+
          '<div class="badge-row"><span class="badge badge-warning">Brouillon</span><span class="tag-chip">'+esc(p.theme_title||p.theme_slug)+'</span></div>'+
          '<h3>'+esc(campaignName(p))+'</h3>'+
          '<p>'+Number(p.situation_count||0)+' situations · dernière modification '+dateFr(p.updated_at)+'</p>'+
        '</div>'+
        '<div class="draft-card-actions">'+actionHtml(p,true)+'</div>'+
      '</article>';
    }).join('');
  }

  function renderAlerts(){
    var submitted=projects.filter(function(p){return p.status==='configuration_submitted';});
    var results=projects.filter(function(p){return p.status==='closed'||p.status==='completed'||p.status==='unpublished';});
    var now=new Date();
    var soonLimit=new Date(now.getTime()+14*24*60*60*1000);
    var endingSoon=projects.filter(function(p){
      if(!(p.status==='published'||p.status==='active'))return false;
      if(!p.close_date)return false;
      var d=new Date(p.close_date);
      return !Number.isNaN(d.getTime())&&d>=now&&d<=soonLimit;
    });

    document.getElementById('submitted-count').textContent=submitted.length+' configuration'+(submitted.length>1?'s':'')+' transmise'+(submitted.length>1?'s':'');
    document.getElementById('results-count').textContent=results.length+' résultat'+(results.length>1?'s':'')+' disponible'+(results.length>1?'s':'');
    document.getElementById('ending-soon-count').textContent=endingSoon.length+' campagne'+(endingSoon.length>1?'s':'')+' se termine'+(endingSoon.length>1?'nt':'')+' bientôt';
    document.getElementById('ending-soon-text').textContent=endingSoon.length
      ? endingSoon.map(function(p){return campaignName(p)+' · clôture le '+dateFr(p.close_date);}).join(' — ')
      : 'Aucune campagne ne nécessite de relance immédiate.';
  }

  function renderActive(){
    var active=projects.filter(function(p){
      return p.status==='configuration_submitted'||p.status==='scheduled'||p.status==='published'||p.status==='active';
    });
    if(!active.length){
      activeRoot.innerHTML='<div class="card empty-drafts"><strong>Aucune campagne active</strong><p>Les configurations transmises, campagnes programmées et campagnes en cours apparaîtront ici.</p></div>';
      return;
    }
    activeRoot.innerHTML=active.map(function(p){
      return '<article class="card campaign-card">'+
        '<span class="badge '+statusClass(p.status)+'">'+esc(statusLabel(p.status))+'</span>'+
        '<h3>'+esc(campaignName(p))+'</h3>'+
        '<p>'+esc(p.theme_title||p.theme_slug||'—')+' · dernière modification '+dateFr(p.updated_at)+'</p>'+
        '<div class="action-bar campaign-action-bar" style="margin-top:12px">'+actionHtml(p,false)+'</div>'+
      '</article>';
    }).join('');
  }

  function statusKey(p){
    return p.status||'unknown';
  }

  function buildFilters(){
    var counts={all:projects.length};
    projects.forEach(function(p){
      var key=statusKey(p);
      counts[key]=(counts[key]||0)+1;
    });
    var order=['all','draft','configuration_submitted','scheduled','published','active','unpublished','closed','completed','archived'];
    filtersRoot.innerHTML=order.filter(function(key){return key==='all'||counts[key];}).map(function(key){
      var label=key==='all'?'Toutes':statusLabel(key);
      return '<button class="status-pill" type="button" data-filter="'+esc(key)+'" aria-pressed="'+(key==='all'?'true':'false')+'">'+esc(label)+' <span class="count">'+Number(counts[key]||0)+'</span></button>';
    }).join('');

    filtersRoot.querySelectorAll('[data-filter]').forEach(function(button){
      button.addEventListener('click',function(){
        activeFilter=button.getAttribute('data-filter');
        filtersRoot.querySelectorAll('[data-filter]').forEach(function(b){
          b.setAttribute('aria-pressed',b===button?'true':'false');
        });
        renderTable();
        bindProjectActions();
      });
    });
  }

  function rowHtml(p){
    var period=(p.launch_date||p.close_date)
      ? dateFr(p.launch_date)+' – '+dateFr(p.close_date)
      : 'À définir';
    var passations=p.respondent_count??p.response_count??p.responses_count??'—';
    return '<tr data-status="'+esc(statusKey(p))+'">'+
      '<td><strong>'+esc(campaignName(p))+'</strong></td>'+
      '<td>'+esc(p.theme_title||p.theme_slug||'—')+'</td>'+
      '<td><span class="badge '+statusClass(p.status)+'">'+esc(statusLabel(p.status))+'</span></td>'+
      '<td>'+esc(period)+'</td>'+
      '<td>'+esc(passations)+'</td>'+
      '<td>'+esc(dateFr(p.updated_at))+'</td>'+
      '<td>'+actionHtml(p,false)+'</td>'+
    '</tr>';
  }

  function renderTable(){
    var term=(search&&search.value?search.value:'').trim().toLowerCase();
    var filtered=projects.filter(function(p){
      var filterOk=activeFilter==='all'||statusKey(p)===activeFilter;
      var haystack=[campaignName(p),p.theme_title,p.theme_slug,statusLabel(p.status)].join(' ').toLowerCase();
      return filterOk&&(!term||haystack.indexOf(term)!==-1);
    });

    tableBody.innerHTML=filtered.map(rowHtml).join('');
    var empty=filtered.length===0;
    table.style.display=empty?'none':'';
    noResults.style.display=empty?'':'none';
    bindProjectActions();
  }

  async function load(){
    try{
      var data=await window.StudioAPI.request('/api/projects?organizationId='+encodeURIComponent(window.StudioAPI.organizationId()));
      projects=Array.isArray(data.projects)?data.projects:[];
      renderDrafts();
      renderAlerts();
      renderActive();
      buildFilters();
      renderTable();
      bindProjectActions();
    }catch(e){
      var message='<div class="composer-alert">Impossible de charger les campagnes : '+esc(e.message)+'</div>';
      draftRoot.innerHTML=message;
      activeRoot.innerHTML=message;
      tableBody.innerHTML='<tr><td colspan="7">Impossible de charger les campagnes.</td></tr>';
    }
  }

  if(search)search.addEventListener('input',renderTable);
  load();
})();
