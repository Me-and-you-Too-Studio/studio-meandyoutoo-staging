(function(){
  if(!StudioAPI.requireAuth())return;
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const user=StudioAPI.user()||{};
  const isAdmin=user.role==='admin'&&StudioAPI.interfaceMode()!=='client';
  const state={view:'month',cursor:new Date(),campaigns:[],tasks:[],organizations:[],missingDates:0,taskFilter:'todo'};
  const statusLabels={draft:'Brouillon',configuration_submitted:'À relire',review_pending:'À relire',in_review:'En relecture',client_validation_required:'Validation client',ready_to_publish:'Prête à publier',scheduled:'Programmée',published:'Publiée',active:'En cours',completed:'Terminée',unpublished:'Dépubliée'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iso=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
  const parseDate=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00`):null;
  const sameDay=(a,b)=>a&&b&&iso(a)===iso(b);
  const dayLabel=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  const campaignName=p=>p.campaign_name||p.title||p.theme_title||'Autodiagnostic';
  const taskOwner=t=>[t.assignee_first_name,t.assignee_last_name].filter(Boolean).join(' ')||[t.creator_first_name,t.creator_last_name].filter(Boolean).join(' ')||'';
  const today=new Date();

  function range(){
    const y=state.cursor.getFullYear(),m=state.cursor.getMonth();
    if(state.view==='year')return{start:`${y}-01-01`,end:`${y}-12-31`};
    return{start:iso(new Date(y,m,1)),end:iso(new Date(y,m+1,0))};
  }
  function setAlert(message){const box=$('#calendar-alert');box.hidden=!message;box.textContent=message||'';}
  function updateHeading(){
    const title=state.view==='year'?String(state.cursor.getFullYear()):state.cursor.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
    $('#calendar-period-title').textContent=title.charAt(0).toUpperCase()+title.slice(1);
  }
  function filteredCampaigns(){
    const q=$('#calendar-search').value.trim().toLowerCase(),status=$('#calendar-status-filter').value,org=$('#calendar-org-filter').value;
    return state.campaigns.filter(p=>(!status||p.status===status)&&(!org||String(p.organization_id)===String(org))&&(!q||[campaignName(p),p.organization_name,p.theme_title,statusLabels[p.status]].some(v=>String(v||'').toLowerCase().includes(q))));
  }
  function filteredTasksForCalendar(){
    if(!$('#calendar-show-tasks').checked)return[];
    const org=$('#calendar-org-filter').value;
    return state.tasks.filter(t=>!org||String(t.organization_id||'')===String(org));
  }
  function campaignActiveOn(p,d){
    const start=parseDate(p.launch_date),end=parseDate(p.close_date);
    if(start&&end)return d>=new Date(start.getFullYear(),start.getMonth(),start.getDate())&&d<=new Date(end.getFullYear(),end.getMonth(),end.getDate());
    if(start)return sameDay(start,d);if(end)return sameDay(end,d);return false;
  }
  function renderMonth(){
    const root=$('#calendar-month'),year=state.cursor.getFullYear(),month=state.cursor.getMonth();
    const first=new Date(year,month,1),offset=(first.getDay()+6)%7,start=new Date(year,month,1-offset);
    const campaigns=filteredCampaigns(),tasks=filteredTasksForCalendar();
    let html='<div class="studio-month-weekdays">'+['Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.','Dim.'].map(v=>`<span>${v}</span>`).join('')+'</div><div class="studio-month-grid">';
    for(let i=0;i<42;i++){
      const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),key=iso(d),outside=d.getMonth()!==month,isToday=sameDay(d,today);
      const dayCampaigns=campaigns.filter(p=>campaignActiveOn(p,d));
      const dayTasks=tasks.filter(t=>t.due_date&&String(t.due_date).slice(0,10)===key&&t.status!=='done');
      const events=[...dayCampaigns.map(p=>({type:'campaign',data:p})),...dayTasks.map(t=>({type:'task',data:t}))];
      html+=`<article class="studio-calendar-day ${outside?'is-outside':''} ${isToday?'is-today':''}" data-date="${key}"><header><span>${d.getDate()}</span>${isToday?'<b>Aujourd’hui</b>':''}</header><div class="studio-calendar-day-events">`;
      events.slice(0,4).forEach(evt=>{if(evt.type==='campaign'){const p=evt.data,startDate=parseDate(p.launch_date),endDate=parseDate(p.close_date);let phase='En cours';if(sameDay(startDate,d))phase='Début';else if(sameDay(endDate,d))phase='Fin';html+=`<a class="studio-calendar-event is-campaign" href="campagne-detail.html?id=${encodeURIComponent(p.id)}" title="${esc(campaignName(p))}"><span></span><div><strong>${esc(campaignName(p))}</strong><small>${esc(phase)}${isAdmin&&p.organization_name?' · '+esc(p.organization_name):''}</small></div></a>`;}else{const t=evt.data;html+=`<button class="studio-calendar-event is-task ${t.priority==='high'?'is-high':''}" type="button" data-open-task="${t.id}"><span></span><div><strong>${esc(t.title)}</strong><small>Tâche${isAdmin&&t.organization_name?' · '+esc(t.organization_name):''}</small></div></button>`;}});
      if(events.length>4)html+=`<div class="studio-calendar-more">+${events.length-4} autre${events.length-4>1?'s':''}</div>`;
      html+='</div></article>';
    }
    root.innerHTML=html+'</div>';
    root.querySelectorAll('[data-open-task]').forEach(b=>b.onclick=()=>switchToTasks(Number(b.dataset.openTask)));
  }
  function renderYear(){
    const root=$('#calendar-year'),year=state.cursor.getFullYear(),campaigns=filteredCampaigns(),tasks=filteredTasksForCalendar();
    root.innerHTML=Array.from({length:12},(_,m)=>{const start=new Date(year,m,1),end=new Date(year,m+1,0);const active=campaigns.filter(p=>{const s=parseDate(p.launch_date),e=parseDate(p.close_date);if(!s&&!e)return false;const a=s||e,b=e||s;return a<=end&&b>=start;});const starts=campaigns.filter(p=>{const s=parseDate(p.launch_date);return s&&s.getFullYear()===year&&s.getMonth()===m;}).length;const ends=campaigns.filter(p=>{const e=parseDate(p.close_date);return e&&e.getFullYear()===year&&e.getMonth()===m;}).length;const taskCount=tasks.filter(t=>{const d=parseDate(t.due_date);return d&&d.getFullYear()===year&&d.getMonth()===m&&t.status!=='done';}).length;return `<button class="studio-year-month" type="button" data-month="${m}"><strong>${start.toLocaleDateString('fr-FR',{month:'long'})}</strong><span class="studio-year-active">${active.length} campagne${active.length>1?'s':''} active${active.length>1?'s':''}</span><div><small><b>${starts}</b> démarrage${starts>1?'s':''}</small><small><b>${ends}</b> fin${ends>1?'s':''}</small><small><b>${taskCount}</b> tâche${taskCount>1?'s':''}</small></div></button>`;}).join('');
    root.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{state.cursor=new Date(year,Number(b.dataset.month),1);setView('month');load();});
  }
  function renderDataQuality(){const box=$('#calendar-data-quality');box.hidden=!state.missingDates;$('#calendar-missing-count').textContent=`${state.missingDates} campagne${state.missingDates>1?'s':''} sans dates`;}
  function renderTaskCount(){const n=state.tasks.filter(t=>t.status!=='done').length;$('#task-open-count').textContent=n;}
  function renderTasks(focusId){
    const root=$('#calendar-task-list'),now=iso(today);let rows=state.tasks.slice();
    if(state.taskFilter==='todo')rows=rows.filter(t=>t.status!=='done');
    if(state.taskFilter==='done')rows=rows.filter(t=>t.status==='done');
    if(state.taskFilter==='overdue')rows=rows.filter(t=>t.status!=='done'&&t.due_date&&String(t.due_date).slice(0,10)<now);
    if(!rows.length){root.innerHTML='<div class="calendar-empty"><strong>Aucune tâche ici</strong><span>Créez une tâche pour préparer une campagne ou noter une action à réaliser.</span></div>';return;}
    root.innerHTML=rows.map(t=>{const overdue=t.status!=='done'&&t.due_date&&String(t.due_date).slice(0,10)<now;return `<article class="studio-task-row ${t.status==='done'?'is-done':''} ${overdue?'is-overdue':''}" data-task-id="${t.id}"><button class="studio-task-check" type="button" data-toggle-task="${t.id}" aria-label="${t.status==='done'?'Rouvrir':'Terminer'} la tâche">${t.status==='done'?'✓':''}</button><div class="studio-task-copy"><div><strong>${esc(t.title)}</strong>${t.priority==='high'?'<span class="studio-task-priority">Priorité haute</span>':''}</div><p>${t.notes?esc(t.notes):''}</p><div class="studio-task-meta">${t.due_date?`<span class="${overdue?'is-danger':''}">📅 ${dayLabel(parseDate(t.due_date))}</span>`:'<span>Sans échéance</span>'}${t.project_id?`<span>🧩 ${esc(t.campaign_name||t.project_title||'Campagne')}</span>`:''}${isAdmin&&t.organization_name?`<span>🏢 ${esc(t.organization_name)}</span>`:''}${!isAdmin?`<span>${t.visibility==='personal'?'🔒 Personnelle':'👥 Équipe'}</span>`:''}${taskOwner(t)?`<span>👤 ${esc(taskOwner(t))}</span>`:''}</div></div><button class="button button-ghost button-small" type="button" data-delete-task="${t.id}">Supprimer</button></article>`;}).join('');
    root.querySelectorAll('[data-toggle-task]').forEach(b=>b.onclick=async()=>{const t=state.tasks.find(x=>String(x.id)===String(b.dataset.toggleTask));if(!t)return;try{await StudioAPI.request('/api/tasks/'+t.id,{method:'PATCH',body:JSON.stringify({status:t.status==='done'?'todo':'done'})});await load();switchTab('tasks');}catch(e){setAlert(e.message);}});
    root.querySelectorAll('[data-delete-task]').forEach(b=>b.onclick=async()=>{const ok=await StudioModal.confirm({type:'danger',title:'Supprimer cette tâche ?',message:'Cette action est définitive.',confirmLabel:'Supprimer'});if(!ok)return;try{await StudioAPI.request('/api/tasks/'+b.dataset.deleteTask,{method:'DELETE'});await load();switchTab('tasks');}catch(e){setAlert(e.message);}});
    if(focusId){const row=root.querySelector(`[data-task-id="${focusId}"]`);row?.scrollIntoView({behavior:'smooth',block:'center'});row?.classList.add('is-focused');}
  }
  function render(){updateHeading();renderDataQuality();renderTaskCount();if(state.view==='month')renderMonth();else renderYear();renderTasks();}
  async function loadOrganizations(){if(!isAdmin)return;try{const data=await StudioAPI.request('/api/admin/organizations');state.organizations=data.organizations||[];const select=$('#calendar-org-filter'),taskOrg=$('#task-org');select.hidden=false;const opts=state.organizations.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr')).map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');select.innerHTML='<option value="">Tous les clients</option>'+opts;taskOrg.innerHTML='<option value="">Tâche interne générale</option>'+opts;$('#task-org-field').hidden=false;$('#task-visibility-field').hidden=true;}catch(e){setAlert(e.message);}}
  async function load(){
    setAlert('');$('#calendar-loading').hidden=false;const r=range(),org=$('#calendar-org-filter')?.value||'';try{const suffix=`?start=${r.start}&end=${r.end}${isAdmin&&org?'&organizationId='+encodeURIComponent(org):''}`;const [cal,tasks]=await Promise.all([StudioAPI.request('/api/calendar'+suffix),StudioAPI.request('/api/tasks'+suffix)]);state.campaigns=cal.campaigns||[];state.tasks=tasks.tasks||[];state.missingDates=Number(cal.missingDates||0);populateTaskProjects();render();}catch(e){setAlert(e.message);}finally{$('#calendar-loading').hidden=true;}
  }
  function populateTaskProjects(){const select=$('#task-project');const org=$('#task-org')?.value||$('#calendar-org-filter')?.value||'';const rows=state.campaigns.filter(p=>!org||String(p.organization_id)===String(org));select.innerHTML='<option value="">Aucune campagne</option>'+rows.map(p=>`<option value="${p.id}">${isAdmin&&p.organization_name?esc(p.organization_name)+' — ':''}${esc(campaignName(p))}</option>`).join('');}
  function setView(view){state.view=view;$$('[data-calendar-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.calendarView===view));$('#calendar-month').hidden=view!=='month';$('#calendar-year').hidden=view!=='year';updateHeading();}
  function switchTab(tab){$$('[data-calendar-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.calendarTab===tab));$$('[data-calendar-panel]').forEach(p=>p.classList.toggle('is-active',p.dataset.calendarPanel===tab));}
  function switchToTasks(id){switchTab('tasks');renderTasks(id);}
  function openTaskDialog(){const d=$('#task-dialog');$('#task-form').reset();$('#task-priority').value='normal';$('#task-visibility').value='team';if(isAdmin)$('#task-org').value=$('#calendar-org-filter').value||'';populateTaskProjects();d.showModal();$('#task-title').focus();}
  function closeTaskDialog(){const d=$('#task-dialog');if(d.open)d.close();}

  $('#new-calendar-task').onclick=openTaskDialog;$$('[data-task-close]').forEach(b=>b.onclick=closeTaskDialog);
  $('#task-dialog').addEventListener('cancel',e=>{e.preventDefault();closeTaskDialog();});
  $('#task-org')?.addEventListener('change',populateTaskProjects);
  $('#task-form').addEventListener('submit',async e=>{e.preventDefault();const payload={title:$('#task-title').value,dueDate:$('#task-due-date').value||null,priority:$('#task-priority').value,projectId:$('#task-project').value||null,notes:$('#task-notes').value};if(isAdmin)payload.organizationId=$('#task-org').value||null;else payload.visibility=$('#task-visibility').value;try{await StudioAPI.request('/api/tasks',{method:'POST',body:JSON.stringify(payload)});closeTaskDialog();await load();switchTab('tasks');}catch(err){setAlert(err.message);}});
  $$('[data-calendar-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.calendarTab));
  $$('[data-calendar-view]').forEach(b=>b.onclick=()=>{setView(b.dataset.calendarView);load();});
  $('#calendar-prev').onclick=()=>{state.cursor=state.view==='year'?new Date(state.cursor.getFullYear()-1,0,1):new Date(state.cursor.getFullYear(),state.cursor.getMonth()-1,1);load();};
  $('#calendar-next').onclick=()=>{state.cursor=state.view==='year'?new Date(state.cursor.getFullYear()+1,0,1):new Date(state.cursor.getFullYear(),state.cursor.getMonth()+1,1);load();};
  $('#calendar-today').onclick=()=>{state.cursor=new Date();load();};
  $('#calendar-status-filter').onchange=render;$('#calendar-search').oninput=render;$('#calendar-show-tasks').onchange=render;
  $('#calendar-org-filter').onchange=()=>load();
  $$('[data-task-filter]').forEach(b=>b.onclick=()=>{state.taskFilter=b.dataset.taskFilter;$$('[data-task-filter]').forEach(x=>x.classList.toggle('is-active',x===b));renderTasks();});

  if(isAdmin){$('#calendar-eyebrow').textContent='Administration Me&YouToo';$('#calendar-lead').textContent='Visualisez les campagnes de tous les clients, leurs échéances et vos tâches internes.';$('#tasks-intro').textContent='Vos tâches internes Me&YouToo restent invisibles des clients.';}
  else{$('#calendar-eyebrow').textContent='Pilotage DEI';$('#calendar-lead').textContent='Visualisez vos périodes de diffusion et organisez les actions de votre équipe.';}

  Promise.resolve(loadOrganizations()).then(load);
})();
