// Suivi Me&YouToo de la préparation de l'année suivante, client par client. Le budget du client n'y figure jamais.
(function(){
  'use strict';
  var root=document.querySelector('[data-programmes-root]');
  if(!root)return;
  var LABELS={finalized:'Finalisé',in_progress:'En cours',not_started:'Pas commencé'};
  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){return new Intl.NumberFormat('fr-FR').format(Number(v)||0);}
  function when(v){return v?new Date(v).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}):'';}
  function row(r){
    var k=r.pack,order=k.unlimited?'Illimité':num(k.toOrder);
    return '<tr><td><a href="cockpit-dei.html?organizationId='+encodeURIComponent(r.id)+'"><strong>'+esc(r.name)+'</strong></a></td>'+
      '<td><span class="tf-pill'+(r.status==='finalized'?' is-on':'')+'">'+esc(LABELS[r.status])+'</span>'+(r.finalizedAt?'<br><small>le '+esc(when(r.finalizedAt))+'</small>':'')+'</td>'+
      '<td>'+num(r.actions)+(r.themes.length?'<br><small>'+esc(r.themes.join(', '))+'</small>':'')+'</td>'+
      '<td>'+num(k.planned)+'</td><td>'+(k.unlimited?'—':num(k.valid))+(k.expired?'<br><small>expire avant l’année</small>':'')+'</td><td><strong>'+order+'</strong></td><td>'+num(r.requests)+'</td></tr>';
  }
  async function load(){
    try{
      var d=await StudioAPI.request('/api/admin/programmes');
      var count=function(s){return d.rows.filter(function(r){return r.status===s;}).length;};
      var toOrder=d.rows.reduce(function(s,r){return s+(r.pack.unlimited?0:r.pack.toOrder);},0);
      root.innerHTML='<p class="tf-state'+(d.open?' is-on':'')+'">'+(d.open?'La préparation de '+d.year+' est ouverte aux clients.':'La préparation de '+d.year+' est fermée : elle ouvre le 1er septembre.')+'</p>'+
        '<div class="tf-upcoming"><article class="tf-card"><h3>'+count('finalized')+' finalisé'+(count('finalized')>1?'s':'')+'</h3></article><article class="tf-card"><h3>'+count('in_progress')+' en cours</h3></article><article class="tf-card"><h3>'+count('not_started')+' pas commencé'+(count('not_started')>1?'s':'')+'</h3></article><article class="tf-card"><h3>'+num(toOrder)+' passations à prévoir</h3></article></div>'+
        '<h2 class="tf-title">Programmes '+d.year+'</h2><div class="tf-table-wrap"><table class="tf-table"><thead><tr><th>Client</th><th>Statut</th><th>Actions prévues</th><th>Passations envisagées</th><th>Solde valable</th><th>Pack à prévoir</th><th>Devis demandés</th></tr></thead><tbody>'+
        (d.rows.map(row).join('')||'<tr><td colspan="7">Aucun client avec Cockpit pour le moment.</td></tr>')+'</tbody></table></div>';
    }catch(e){root.innerHTML='<p class="tf-empty">Programmes indisponibles : '+esc(e.message||'')+'</p>';}
  }
  load();
})();
