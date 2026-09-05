(function(){
  if(!StudioAPI.requireAuth())return;
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentUser=StudioAPI.user()||{},isAdmin=currentUser.role==='admin',requestedAudience=new URLSearchParams(location.search).get('audience');
  const audience=isAdmin&&requestedAudience!=='client'?'admin':'client',clientView=audience==='client';
  let items=[],filter='all';
  const when=v=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
  function kind(n){const t=String(n.type||'').toLowerCase(),title=String(n.title||'').toLowerCase(),msg=String(n.message||'').toLowerCase();if(t.includes('submission')||title.includes('à publier')||title.includes('configuration'))return'publish';if(t.includes('pack')||title.includes('passation')||msg.includes('passation'))return'passes';if(t.includes('communication')||t.includes('kit')||title.includes('kit')||msg.includes('graphique')||msg.includes('vidéo'))return'kit';return'other';}
  function icon(n){const k=kind(n);return k==='publish'?'🚀':k==='passes'?'🎟️':k==='kit'?'📣':'🔔';}
  function counts(){const c={all:items.length,unread:items.filter(x=>!x.read_at).length,publish:items.filter(x=>kind(x)==='publish').length,passes:items.filter(x=>kind(x)==='passes').length,kit:items.filter(x=>kind(x)==='kit').length};Object.entries(c).forEach(([k,v])=>{const el=$('#notif-count-'+k);if(el)el.textContent=v;});const unreadLabel=c.unread>99?'99+':c.unread;$$('[data-nav-notification-count], .notification-count').forEach(badge=>{badge.textContent=unreadLabel;badge.hidden=!c.unread;});}
  function normalizedUrl(n){
    let url=String(n.action_url||'').trim(),meta=n.metadata||{},k=kind(n);
    const projectId=meta.projectId||meta.project_id||'';
    const organizationId=meta.organizationId||meta.organization_id||n.organization_id||'';
    if(!clientView&&k==='publish'&&projectId){
      return 'client.html?'+(organizationId?'organizationId='+encodeURIComponent(organizationId)+'&':'')+'projectId='+encodeURIComponent(projectId);
    }
    if(k==='kit'&&projectId){const tab=meta.tab?('&tab='+encodeURIComponent(meta.tab)):'';return 'kit-communication.html?projectId='+encodeURIComponent(projectId)+tab;}
    if(!clientView&&k==='passes')return 'admin.html?tab=clients&filter=pack';
    if(clientView&&projectId&&(!url||/^admin\.html/i.test(url)||/^client\.html/i.test(url)))return 'campagne-detail.html?projectId='+encodeURIComponent(projectId);
    if(!clientView&&/^admin\.html\?projectId=/i.test(url))url=url.replace(/^admin\.html/i,'client.html');
    if(/^client\.html\?projectId=/i.test(url)&&organizationId){const q=new URLSearchParams(url.split('?')[1]||'');url='client.html?organizationId='+encodeURIComponent(organizationId)+'&projectId='+encodeURIComponent(q.get('projectId')||projectId||'');}
    return url||'notifications.html';
  }
  function render(){counts();const q=($('#notification-search').value||'').toLowerCase().trim();const visible=items.filter(n=>{const k=kind(n),matchesFilter=filter==='all'||(filter==='unread'&&!n.read_at)||filter===k;const hay=(String(n.title||'')+' '+String(n.message||'')+' '+String(n.type||'')).toLowerCase();return matchesFilter&&(!q||hay.includes(q));});$('#notification-center-list').innerHTML=visible.map(n=>{const read=!!n.read_at,url=normalizedUrl(n);return`<article class="admin-notification-row ${read?'is-read':'is-unread'}" data-notification-id="${n.id}"><div class="admin-notification-row-icon">${icon(n)}</div><button type="button" class="admin-notification-row-main" data-open-notification="${n.id}"><div class="admin-notification-row-title"><strong>${esc(String(n.title||'Notification').replace(/à vérifier/gi,'à publier'))}</strong>${read?'':'<span>Nouvelle</span>'}</div><p>${esc(String(n.message||'').replace(/à vérifier/gi,'à publier'))}</p><time>${esc(when(n.created_at))}</time></button><div class="admin-notification-row-actions">${url?`<button type="button" class="button button-secondary" data-open-notification="${n.id}">Ouvrir</button>`:''}<button type="button" class="notification-item-check" data-toggle-read="${n.id}" aria-label="${read?'Marquer comme non lue':'Marquer comme lue'}" title="${read?'Marquer comme non lue':'Marquer comme lue'}">${read?'✓':''}</button></div></article>`;}).join('')||'<p class="notification-empty">Aucune notification dans cette catégorie.</p>';bindRows();}
  async function toggleRead(id){
    const n=items.find(x=>String(x.id)===String(id));if(!n)return;
    try{
      const path=n.read_at?'/api/notifications/'+id+'/unread?audience='+audience:'/api/notifications/'+id+'/read?audience='+audience;
      const data=await StudioAPI.request(path,{method:'PATCH',body:'{}'});
      n.read_at=data.notification?.read_at||null;render();
    }catch(e){show(e.message||'Impossible de mettre à jour la notification.');}
  }
  function openNotification(id){const n=items.find(x=>String(x.id)===String(id));if(!n)return;const url=normalizedUrl(n);if(url)location.href=url;}
  function bindRows(){$$('[data-open-notification]').forEach(b=>b.onclick=()=>openNotification(b.dataset.openNotification));$$('[data-toggle-read]').forEach(b=>b.onclick=()=>toggleRead(b.dataset.toggleRead));}
  function show(message){const box=$('#notifications-alert');box.hidden=false;box.textContent=message;}
  async function load(){try{const data=await StudioAPI.request('/api/notifications?audience='+audience+'&limit=200');items=data.notifications||[];$('#notifications-alert').hidden=true;render();}catch(e){show(e.message||'Notifications indisponibles.');$('#notification-center-list').innerHTML='<p class="notification-empty">Notifications indisponibles.</p>';}}
  if(clientView){document.querySelector('[data-notification-filter="publish"]')?.setAttribute('hidden','');document.querySelector('.admin-notifications-page .eyebrow').textContent='Votre espace';document.querySelector('.admin-notifications-page h1').textContent='Mes notifications';document.querySelector('.admin-notifications-page .admin-cockpit-hero p:not(.eyebrow)').textContent='Retrouvez toutes vos alertes et accédez directement à la campagne concernée.';}
  $$('[data-notification-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.notificationFilter;$$('[data-notification-filter]').forEach(x=>x.classList.toggle('is-active',x===b));render();});$('#notification-search').oninput=render;$('#notifications-refresh').onclick=load;$('#notifications-read-all').onclick=async()=>{try{await StudioAPI.request('/api/notifications/read-all?audience='+audience,{method:'PATCH',body:'{}'});await load();}catch(e){show(e.message||'Impossible de mettre à jour les notifications.');}};load();
})();
