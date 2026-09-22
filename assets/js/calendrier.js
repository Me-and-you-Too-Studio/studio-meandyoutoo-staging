(function(){
  if(!StudioAPI.requireAuth())return;
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const user=StudioAPI.user()||{};
  const isAdmin=user.role==='admin'&&StudioAPI.interfaceMode()!=='client';
  const canManageTasks=isAdmin||Boolean(user.permissions&&user.permissions.manage_tasks);
  const state={view:'year',cursor:new Date(),campaigns:[],tasks:[],organizations:[],missingDates:0,taskFilter:'todo'};
  const statusLabels={draft:'Brouillon',configuration_submitted:'À relire',review_pending:'À relire',in_review:'En relecture',client_validation_required:'Validation client',ready_to_publish:'Prête à publier',scheduled:'Programmée',published:'Publiée',active:'En cours',completed:'Terminée',unpublished:'Dépubliée'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iso=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
  const parseDate=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00`):null;
  const sameDay=(a,b)=>a&&b&&iso(a)===iso(b);
  const dayLabel=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  const fullDateLabel=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
  function campaignDatesLabel(p){
    const start=parseDate(p.launch_date),end=parseDate(p.close_date);
    if(start&&end)return `${fullDateLabel(start)} → ${fullDateLabel(end)}`;
    if(start)return `À partir du ${fullDateLabel(start)}`;
    if(end)return `Jusqu’au ${fullDateLabel(end)}`;
    return 'Dates à compléter';
  }
  const shortMonthLabel=(year,monthIndex)=>new Date(year,monthIndex,1).toLocaleDateString('fr-FR',{month:'short'}).replace('.','');
  function deiYearRangeLabel(e,year){
    const range=eventRangeForYear(e,year);
    if(range)return `${range[0]}–${range[1]} ${shortMonthLabel(year,(e.month||1)-1)}`;
    if(e.allMonth)return 'Tout le mois';
    if(e.day)return `${e.day} ${shortMonthLabel(year,(e.month||1)-1)}`;
    return '';
  }
  const campaignName=p=>p.campaign_name||p.title||p.theme_title||'Autodiagnostic';
  const taskOwner=t=>[t.assignee_first_name,t.assignee_last_name].filter(Boolean).join(' ')||[t.creator_first_name,t.creator_last_name].filter(Boolean).join(' ')||'';
  const today=new Date();

  const deiEvents=[
    {month:1,day:25,title:'Journée nationale contre le sexisme',category:'equality',short:'Sexisme',recommendation:'Compréhension du sexisme'},
    {month:3,day:8,title:'Journée internationale des droits des femmes',category:'equality',short:'Droits des femmes',recommendation:'Allié·e de la mixité'},
    {month:3,day:21,title:'Journée internationale pour l’élimination de la discrimination raciale',category:'discrimination',short:'Discriminations raciales',recommendation:'Diversité des origines'},
    {month:3,day:31,title:'Journée internationale de la visibilité transgenre',category:'lgbt',short:'Visibilité trans',recommendation:'LGBT+'},
    {month:5,allMonth:true,title:'Mois européen de la diversité',category:'diversity',short:'Mois européen de la diversité',recommendation:'Collègue inclusif'},
    {month:5,day:17,title:'Journée internationale contre l’homophobie, la transphobie et la biphobie',category:'lgbt',short:'Lutte contre les LGBTphobies',recommendation:'LGBT+'},
    {month:6,allMonth:true,title:'Mois des fiertés',category:'lgbt',short:'Mois des fiertés',recommendation:'LGBT+'},
    {month:11,dynamicRange:'seeph',yearHighlight:true,title:'SEEPH — Semaine européenne pour l’emploi des personnes handicapées',category:'disability',short:'SEEPH',recommendation:'Handicap'},
    {month:11,day:25,title:'Journée internationale pour l’élimination de la violence à l’égard des femmes',category:'equality',short:'Violences faites aux femmes',recommendation:'Compréhension du sexisme'},
    {month:12,day:3,title:'Journée internationale des personnes handicapées',category:'disability',short:'Handicap',recommendation:'Handicap'},
    {month:12,day:10,title:'Journée des droits humains',category:'human-rights',short:'Droits humains',recommendation:'Collègue inclusif'}
  ];
  const deiCategoryLabels={equality:'Égalité femmes-hommes',diversity:'Diversité & inclusion',discrimination:'Diversité & discriminations',lgbt:'LGBT+',disability:'Handicap','human-rights':'Droits humains'};
  function filteredDeiEvents(){
    const filter=$('#calendar-dei-filter')?.value||'all';
    if(filter==='none')return[];
    return deiEvents.filter(e=>filter==='all'||e.category===filter);
  }
  function seephRangeForYear(year){
    // SEEPH : 3e lundi de novembre -> dimanche suivant.
    const first=new Date(year,10,1);
    const firstMonday=1+((8-first.getDay())%7);
    const start=firstMonday+14;
    return [start,start+6];
  }
  function eventRangeForYear(e,year){
    if(e.dynamicRange==='seeph')return seephRangeForYear(year);
    return e.rangeByYear?.[year]||null;
  }
  function deiEventAppliesToYear(e,year){return !e.rangeByYear||Boolean(e.rangeByYear[year]);}
  function deiEventsCoveringDate(d){
    const year=d.getFullYear(),day=d.getDate();
    return filteredDeiEvents().filter(e=>{
      if(e.month!==d.getMonth()+1||!deiEventAppliesToYear(e,year))return false;
      if(e.allMonth)return true;
      if(e.day)return e.day===day;
      const range=eventRangeForYear(e,year);
      return Boolean(range&&day>=range[0]&&day<=range[1]);
    });
  }
  function deiEventsOnDate(d){
    const day=d.getDate();
    return deiEventsCoveringDate(d).filter(e=>{
      if(e.allMonth)return day===1;
      if(e.day)return true;
      // Une semaine DEI doit rester visible chaque jour, pas seulement le lundi.
      return Boolean(eventRangeForYear(e,d.getFullYear()));
    });
  }

  let deiPopoverHideTimer=null;
  function deiEventDateDetail(e,date){
    const year=date.getFullYear();
    if(e.allMonth)return `Tout le mois de ${date.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}`;
    const range=eventRangeForYear(e,year);
    if(range){
      const start=new Date(year,(e.month||1)-1,range[0]);
      const end=new Date(year,(e.month||1)-1,range[1]);
      return `${fullDateLabel(start)} → ${fullDateLabel(end)}`;
    }
    return fullDateLabel(date);
  }
  function ensureDeiPopover(){
    let pop=$('#calendar-dei-popover');
    if(pop)return pop;
    pop=document.createElement('div');
    pop.id='calendar-dei-popover';
    pop.className='calendar-dei-popover';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-modal','false');
    pop.hidden=true;
    document.body.appendChild(pop);
    pop.addEventListener('mouseenter',()=>{if(deiPopoverHideTimer)clearTimeout(deiPopoverHideTimer);});
    pop.addEventListener('mouseleave',scheduleHideDeiPopover);
    return pop;
  }
  function showDeiPopover(trigger){
    if(deiPopoverHideTimer)clearTimeout(deiPopoverHideTimer);
    const index=Number(trigger.dataset.deiEvent),e=deiEvents[index];
    if(!e)return;
    const date=parseDate(trigger.dataset.deiDate)||state.cursor;
    const pop=ensureDeiPopover();
    const category=deiCategoryLabels[e.category]||'Événement DEI';
    pop.innerHTML=`<div class="calendar-dei-popover-head"><span class="calendar-dei-popover-date">${esc(deiEventDateDetail(e,date))}</span><button type="button" class="calendar-dei-popover-close" aria-label="Fermer">×</button></div><strong class="calendar-dei-popover-title">${esc(e.title)}</strong><span class="calendar-dei-popover-category">${esc(category)}</span>${e.recommendation?`<div class="calendar-dei-popover-reco"><span>Autodiagnostic recommandé</span><strong>${esc(e.recommendation)}</strong></div>`:''}<a class="button button-primary calendar-dei-popover-cta" href="bibliotheque.html">Voir le catalogue →</a>`;
    pop.hidden=false;
    pop.className=`calendar-dei-popover is-${esc(e.category)} is-visible`;
    pop.querySelector('.calendar-dei-popover-close').onclick=hideDeiPopover;
    const rect=trigger.getBoundingClientRect();
    const margin=12;
    pop.style.left='0px';pop.style.top='0px';
    const pw=pop.offsetWidth,ph=pop.offsetHeight;
    let left=rect.left+(rect.width/2)-(pw/2);
    left=Math.max(margin,Math.min(left,window.innerWidth-pw-margin));
    let top=rect.bottom+10;
    if(top+ph>window.innerHeight-margin)top=Math.max(margin,rect.top-ph-10);
    pop.style.left=`${Math.round(left)}px`;
    pop.style.top=`${Math.round(top)}px`;
  }
  function hideDeiPopover(){
    const pop=$('#calendar-dei-popover');
    if(!pop)return;
    pop.hidden=true;
    pop.classList.remove('is-visible');
  }
  function scheduleHideDeiPopover(){
    if(deiPopoverHideTimer)clearTimeout(deiPopoverHideTimer);
    deiPopoverHideTimer=setTimeout(hideDeiPopover,140);
  }
  function bindDeiPopovers(root){
    root.querySelectorAll('[data-dei-event]').forEach(trigger=>{
      trigger.addEventListener('mouseenter',()=>showDeiPopover(trigger));
      trigger.addEventListener('mouseleave',scheduleHideDeiPopover);
      trigger.addEventListener('focus',()=>showDeiPopover(trigger));
      trigger.addEventListener('blur',scheduleHideDeiPopover);
      trigger.addEventListener('click',e=>{e.preventDefault();showDeiPopover(trigger);});
    });
  }

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
    const root=$('#calendar-month'),summary=$('#calendar-month-summary'),year=state.cursor.getFullYear(),month=state.cursor.getMonth();
    const first=new Date(year,month,1),last=new Date(year,month+1,0),offset=(first.getDay()+6)%7,start=new Date(year,month,1-offset);
    const campaigns=filteredCampaigns(),tasks=filteredTasksForCalendar();
    const activeThisMonth=campaigns.filter(p=>{const s=parseDate(p.launch_date),e=parseDate(p.close_date);if(!s&&!e)return false;const a=s||e,b=e||s;return a<=last&&b>=first;}).sort((a,b)=>String(a.launch_date||a.close_date||'').localeCompare(String(b.launch_date||b.close_date||'')));
    if(summary){
      const visible=activeThisMonth.slice(0,8);
      summary.innerHTML=visible.map(p=>{const s=parseDate(p.launch_date),e=parseDate(p.close_date);const dates=s&&e?`${fullDateLabel(s)} → ${fullDateLabel(e)}`:s?`À partir du ${fullDateLabel(s)}`:`Jusqu’au ${fullDateLabel(e)}`;return `<a class="calendar-month-chip" href="campagne-detail.html?id=${encodeURIComponent(p.id)}" title="${esc(campaignName(p))}"><i></i><span><strong>${esc(campaignName(p))}</strong><small>${esc(dates)}${isAdmin&&p.organization_name?' · '+esc(p.organization_name):''}</small></span></a>`;}).join('')+(activeThisMonth.length>8?`<span class="calendar-month-summary-more">+${activeThisMonth.length-8} autres campagnes ce mois</span>`:'');
    }
    let html='<div class="studio-month-weekdays">'+['Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.','Dim.'].map(v=>`<span>${v}</span>`).join('')+'</div><div class="studio-month-grid">';
    for(let i=0;i<42;i++){
      const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),key=iso(d),outside=d.getMonth()!==month,isToday=sameDay(d,today);
      const dayCampaigns=[];
      campaigns.forEach(p=>{const s=parseDate(p.launch_date),e=parseDate(p.close_date);if(sameDay(s,d)||sameDay(e,d))dayCampaigns.push(p);});
      const dayTasks=tasks.filter(t=>t.due_date&&String(t.due_date).slice(0,10)===key&&t.status!=='done');
      const dayDeiCover=deiEventsCoveringDate(d);
      const dayDei=deiEventsOnDate(d);
      const events=[...dayDei.map(e=>({type:'dei',data:e})),...dayCampaigns.map(p=>({type:'campaign',data:p})),...dayTasks.map(t=>({type:'task',data:t}))];
      const deiDayClass=dayDeiCover.length?` has-dei-event has-dei-${dayDeiCover[dayDeiCover.length-1].category}`:'';
      html+=`<article class="studio-calendar-day ${outside?'is-outside':''} ${isToday?'is-today':''}${deiDayClass}" data-date="${key}"><header><span>${d.getDate()}</span>${isToday?'<b>Aujourd’hui</b>':''}</header><div class="studio-calendar-day-events">`;
      events.slice(0,4).forEach(evt=>{if(evt.type==='dei'){const e=evt.data;const eventIndex=deiEvents.indexOf(e);html+=`<button class="studio-calendar-event is-dei is-dei-${esc(e.category)}" type="button" data-dei-event="${eventIndex}" data-dei-date="${key}" aria-haspopup="dialog" aria-label="Voir le détail : ${esc(e.title)}"><span></span><div><strong>${esc(e.short||e.title)}</strong>${e.recommendation?`<small>AD recommandé : ${esc(e.recommendation)}</small>`:''}</div></button>`;}else if(evt.type==='campaign'){const p=evt.data,startDate=parseDate(p.launch_date),endDate=parseDate(p.close_date),isStart=sameDay(startDate,d),isEnd=sameDay(endDate,d);let phase=isStart&&isEnd?'Début · Fin':isStart?'Début':'Fin';const cls=isStart&&isEnd?'is-single':isEnd?'is-end':'';html+=`<a class="studio-calendar-event is-campaign ${cls}" href="campagne-detail.html?id=${encodeURIComponent(p.id)}" title="${esc(campaignName(p))}"><span></span><div><strong>${esc(campaignName(p))}</strong><small>${esc(phase)}${isAdmin&&p.organization_name?' · '+esc(p.organization_name):''}</small></div></a>`;}else{const t=evt.data;html+=`<button class="studio-calendar-event is-task ${t.priority==='high'?'is-high':''}" type="button" data-open-task="${t.id}"><span></span><div><strong>${esc(t.title)}</strong><small>Tâche${isAdmin&&t.organization_name?' · '+esc(t.organization_name):''}</small></div></button>`;}});
      if(events.length>4)html+=`<div class="studio-calendar-more">+${events.length-4} autre${events.length-4>1?'s':''}</div>`;
      html+='</div></article>';
    }
    root.innerHTML=html+'</div>';
    bindDeiPopovers(root);
    root.querySelectorAll('[data-open-task]').forEach(b=>b.onclick=()=>switchToTasks(Number(b.dataset.openTask)));
  }
  function renderYear(){
    const summary=$('#calendar-month-summary');if(summary)summary.innerHTML='';
    const root=$('#calendar-year'),year=state.cursor.getFullYear(),campaigns=filteredCampaigns(),tasks=filteredTasksForCalendar();
    const selectedOrg=$('#calendar-org-filter')?.value||'';
    const showCampaignDates=Boolean(selectedOrg);
    const visibleDei=filteredDeiEvents();
    root.classList.toggle('has-selected-client',showCampaignDates);
    root.innerHTML=Array.from({length:12},(_,m)=>{
      const start=new Date(year,m,1),end=new Date(year,m+1,0);
      const active=campaigns.filter(p=>{const s=parseDate(p.launch_date),e=parseDate(p.close_date);if(!s&&!e)return false;const a=s||e,b=e||s;return a<=end&&b>=start;});
      const starts=campaigns.filter(p=>{const s=parseDate(p.launch_date);return s&&s.getFullYear()===year&&s.getMonth()===m;}).length;
      const ends=campaigns.filter(p=>{const e=parseDate(p.close_date);return e&&e.getFullYear()===year&&e.getMonth()===m;}).length;
      const taskCount=tasks.filter(t=>{const d=parseDate(t.due_date);return d&&d.getFullYear()===year&&d.getMonth()===m&&t.status!=='done';}).length;
      const monthDei=visibleDei.filter(e=>e.month===m+1&&deiEventAppliesToYear(e,year));
      const deiCount=monthDei.length;
      const activeDeiFilter=$('#calendar-dei-filter')?.value||'all';
      const monthHighlights=monthDei.filter(e=>e.allMonth||e.yearHighlight||(activeDeiFilter!=='all'&&activeDeiFilter!=='none'));
      const highlightHtml=monthHighlights.length?`<div class="studio-year-highlights">${monthHighlights.map(e=>{const dateLabel=deiYearRangeLabel(e,year);return `<div class="studio-year-highlight is-${esc(e.category)}"><span class="studio-year-highlight-date">${esc(dateLabel)}</span><span class="studio-year-highlight-copy"><strong>${esc(e.title)}</strong>${e.recommendation?`<small>AD recommandé : ${esc(e.recommendation)}</small>`:''}</span></div>`;}).join('')}</div>`:'';
      const campaignRows=showCampaignDates?active.slice().sort((a,b)=>String(a.launch_date||a.close_date||'').localeCompare(String(b.launch_date||b.close_date||''))):[];
      const campaignsHtml=campaignRows.length?`<div class="studio-year-client-campaigns">${campaignRows.slice(0,4).map(p=>`<div class="studio-year-client-campaign"><div class="studio-year-client-campaign-head"><strong>${esc(campaignName(p))}</strong><span class="studio-year-campaign-status is-${esc(p.status||'draft')}">${esc(statusLabels[p.status]||p.status||'Brouillon')}</span></div><small>${esc(campaignDatesLabel(p))}</small></div>`).join('')}${campaignRows.length>4?`<div class="studio-year-client-campaign-more">+${campaignRows.length-4} autre${campaignRows.length-4>1?'s':''} campagne${campaignRows.length-4>1?'s':''}</div>`:''}</div>`:'';
      return `<button class="studio-year-month ${deiCount?'has-dei-events':''} ${monthHighlights.length?'has-dei-month':''} ${showCampaignDates?'has-client-dates':''}" type="button" data-month="${m}"><strong>${start.toLocaleDateString('fr-FR',{month:'long'})}</strong>${highlightHtml}${campaignsHtml}<span class="studio-year-active">${active.length} campagne${active.length>1?'s':''} active${active.length>1?'s':''}</span><div><small><b>${starts}</b> démarrage${starts>1?'s':''}</small><small><b>${ends}</b> fin${ends>1?'s':''}</small><small><b>${taskCount}</b> tâche${taskCount>1?'s':''}</small>${deiCount?`<small class="studio-year-dei"><b>${deiCount}</b> événement${deiCount>1?'s':''} DEI</small>`:''}</div></button>`;
    }).join('');
    root.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{state.cursor=new Date(year,Number(b.dataset.month),1);setView('month');load();});
  }
  function renderSelectedClientIdentity(){
    const root=$('#calendar-client-identity');if(!root)return;
    const id=$('#calendar-org-filter')?.value||'';
    const org=state.organizations.find(o=>String(o.id)===String(id));
    if(!org){root.hidden=true;root.innerHTML='';return;}
    const rows=state.campaigns||[],drafts=rows.filter(p=>String(p.status||'')==='draft').length,ongoing=rows.filter(p=>String(p.status||'')==='active').length,completed=rows.filter(p=>String(p.status||'')==='completed').length;
    const initial=String(org.name||'C').slice(0,1).toUpperCase();
    const logo=org.logo_data?`<span class="calendar-client-logo has-logo"><img src="${esc(org.logo_data)}" alt="Logo ${esc(org.name||'client')}"></span>`:`<span class="calendar-client-logo"><span>${esc(initial)}</span></span>`;
    root.innerHTML=`${logo}<div><strong>${esc(org.name||'Client')}</strong><span>${rows.length} campagne${rows.length>1?'s':''} · ${drafts} brouillon${drafts>1?'s':''} · ${ongoing} en cours · ${completed} terminée${completed>1?'s':''}</span></div>`;
    root.hidden=false;
  }
  function renderDataQuality(){const box=$('#calendar-data-quality');box.hidden=!state.missingDates;$('#calendar-missing-count').textContent=`${state.missingDates} campagne${state.missingDates>1?'s':''} sans dates`;}
  function renderTaskCount(){const n=state.tasks.filter(t=>t.status!=='done').length;$('#task-open-count').textContent=n;}
  function renderTasks(focusId){
    const root=$('#calendar-task-list'),now=iso(today);let rows=state.tasks.slice();
    if(state.taskFilter==='todo')rows=rows.filter(t=>t.status!=='done');
    if(state.taskFilter==='done')rows=rows.filter(t=>t.status==='done');
    if(state.taskFilter==='overdue')rows=rows.filter(t=>t.status!=='done'&&t.due_date&&String(t.due_date).slice(0,10)<now);
    if(!rows.length){root.innerHTML='<div class="calendar-empty"><strong>Aucune tâche ici</strong><span>Créez une tâche pour préparer une campagne ou noter une action à réaliser.</span></div>';return;}
    root.innerHTML=rows.map(t=>{
      const overdue=t.status!=='done'&&t.due_date&&String(t.due_date).slice(0,10)<now;
      const check=canManageTasks
        ? `<button class="studio-task-check" type="button" data-toggle-task="${t.id}" aria-label="${t.status==='done'?'Rouvrir':'Terminer'} la tâche">${t.status==='done'?'✓':''}</button>`
        : `<span class="studio-task-check is-readonly">${t.status==='done'?'✓':''}</span>`;
      const remove=canManageTasks?`<button class="button button-ghost button-small" type="button" data-delete-task="${t.id}">Supprimer</button>`:'';
      return `<article class="studio-task-row ${t.status==='done'?'is-done':''} ${overdue?'is-overdue':''}" data-task-id="${t.id}">${check}<div class="studio-task-copy"><div><strong>${esc(t.title)}</strong>${t.priority==='high'?'<span class="studio-task-priority">Priorité haute</span>':''}</div><p>${t.notes?esc(t.notes):''}</p><div class="studio-task-meta">${t.due_date?`<span class="${overdue?'is-danger':''}">📅 ${dayLabel(parseDate(t.due_date))}</span>`:'<span>Sans échéance</span>'}${t.project_id?`<span>🧩 ${esc(t.campaign_name||t.project_title||'Campagne')}</span>`:''}${isAdmin&&t.organization_name?`<span>🏢 ${esc(t.organization_name)}</span>`:''}${!isAdmin?`<span>${t.visibility==='personal'?'🔒 Personnelle':'👥 Équipe'}</span>`:''}${taskOwner(t)?`<span>👤 ${esc(taskOwner(t))}</span>`:''}</div></div>${remove}</article>`;
    }).join('');
    if(canManageTasks){
      root.querySelectorAll('[data-toggle-task]').forEach(b=>b.onclick=async()=>{const t=state.tasks.find(x=>String(x.id)===String(b.dataset.toggleTask));if(!t)return;try{await StudioAPI.request('/api/tasks/'+t.id,{method:'PATCH',body:JSON.stringify({status:t.status==='done'?'todo':'done'})});await load();switchTab('tasks');}catch(e){setAlert(e.message);}});
      root.querySelectorAll('[data-delete-task]').forEach(b=>b.onclick=async()=>{const ok=await StudioModal.confirm({type:'danger',title:'Supprimer cette tâche ?',message:'Cette action est définitive.',confirmLabel:'Supprimer'});if(!ok)return;try{await StudioAPI.request('/api/tasks/'+b.dataset.deleteTask,{method:'DELETE'});await load();switchTab('tasks');}catch(e){setAlert(e.message);}});
    }
    if(focusId){const row=root.querySelector(`[data-task-id="${focusId}"]`);row?.scrollIntoView({behavior:'smooth',block:'center'});row?.classList.add('is-focused');}
  }
  function render(){updateHeading();renderSelectedClientIdentity();renderDataQuality();renderTaskCount();if(state.view==='month')renderMonth();else renderYear();renderTasks();}
  async function loadOrganizations(){
    const taskOrgField=$('#task-org-field'),taskVisibilityField=$('#task-visibility-field');
    if(!isAdmin){
      if(taskOrgField){taskOrgField.hidden=true;taskOrgField.style.display='none';}
      if(taskVisibilityField){taskVisibilityField.hidden=false;taskVisibilityField.style.display='';}
      return;
    }
    try{
      const data=await StudioAPI.request('/api/admin/organizations');state.organizations=data.organizations||[];const select=$('#calendar-org-filter'),taskOrg=$('#task-org');select.hidden=false;const opts=state.organizations.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr')).map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');select.innerHTML='<option value="">Tous les clients</option>'+opts;taskOrg.innerHTML='<option value="">Tâche interne générale</option>'+opts;
      if(taskOrgField){taskOrgField.hidden=false;taskOrgField.style.display='';}
      if(taskVisibilityField){taskVisibilityField.hidden=true;taskVisibilityField.style.display='none';}
    }catch(e){setAlert(e.message);}
  }
  async function load(){
    setAlert('');const loading=$('#calendar-loading');loading.hidden=false;const monthRoot=$('#calendar-month'),yearRoot=$('#calendar-year'),summary=$('#calendar-month-summary');if(monthRoot)monthRoot.style.visibility='hidden';if(yearRoot)yearRoot.style.visibility='hidden';if(summary)summary.style.visibility='hidden';const r=range(),org=$('#calendar-org-filter')?.value||'';try{const suffix=`?start=${r.start}&end=${r.end}${isAdmin&&org?'&organizationId='+encodeURIComponent(org):''}`;const [cal,tasks]=await Promise.all([StudioAPI.request('/api/calendar'+suffix),StudioAPI.request('/api/tasks'+suffix)]);state.campaigns=cal.campaigns||[];state.tasks=tasks.tasks||[];state.missingDates=Number(cal.missingDates||0);populateTaskProjects();render();}catch(e){setAlert(e.message);}finally{loading.hidden=true;if(monthRoot)monthRoot.style.visibility='';if(yearRoot)yearRoot.style.visibility='';if(summary)summary.style.visibility='';}
  }
  function populateTaskProjects(){const select=$('#task-project');const org=$('#task-org')?.value||$('#calendar-org-filter')?.value||'';const rows=state.campaigns.filter(p=>!org||String(p.organization_id)===String(org));select.innerHTML='<option value="">Aucune campagne</option>'+rows.map(p=>`<option value="${p.id}">${isAdmin&&p.organization_name?esc(p.organization_name)+' — ':''}${esc(campaignName(p))}</option>`).join('');}
  function setView(view){state.view=view;$$('[data-calendar-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.calendarView===view));$('#calendar-month').hidden=view!=='month';$('#calendar-year').hidden=view!=='year';updateHeading();}
  function switchTab(tab){$$('[data-calendar-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.calendarTab===tab));$$('[data-calendar-panel]').forEach(p=>p.classList.toggle('is-active',p.dataset.calendarPanel===tab));}
  function switchToTasks(id){switchTab('tasks');renderTasks(id);}
  function openTaskDialog(){const d=$('#task-dialog');$('#task-form').reset();$('#task-priority').value='normal';$('#task-visibility').value='team';if(isAdmin)$('#task-org').value=$('#calendar-org-filter').value||'';populateTaskProjects();d.showModal();$('#task-title').focus();}
  function closeTaskDialog(){const d=$('#task-dialog');if(d.open)d.close();}

  if(canManageTasks)$('#new-calendar-task').onclick=openTaskDialog;else $('#new-calendar-task').hidden=true;$$('[data-task-close]').forEach(b=>b.onclick=closeTaskDialog);
  $('#task-dialog').addEventListener('cancel',e=>{e.preventDefault();closeTaskDialog();});
  $('#task-org')?.addEventListener('change',populateTaskProjects);
  $('#task-form').addEventListener('submit',async e=>{e.preventDefault();const payload={title:$('#task-title').value,dueDate:$('#task-due-date').value||null,priority:$('#task-priority').value,projectId:$('#task-project').value||null,notes:$('#task-notes').value};if(isAdmin)payload.organizationId=$('#task-org').value||null;else payload.visibility=$('#task-visibility').value;try{await StudioAPI.request('/api/tasks',{method:'POST',body:JSON.stringify(payload)});closeTaskDialog();await load();switchTab('tasks');}catch(err){setAlert(err.message);}});
  $$('[data-calendar-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.calendarTab));
  $$('[data-calendar-view]').forEach(b=>b.onclick=()=>{setView(b.dataset.calendarView);load();});
  $('#calendar-prev').onclick=()=>{state.cursor=state.view==='year'?new Date(state.cursor.getFullYear()-1,0,1):new Date(state.cursor.getFullYear(),state.cursor.getMonth()-1,1);load();};
  $('#calendar-next').onclick=()=>{state.cursor=state.view==='year'?new Date(state.cursor.getFullYear()+1,0,1):new Date(state.cursor.getFullYear(),state.cursor.getMonth()+1,1);load();};
  $('#calendar-today').onclick=()=>{state.cursor=new Date();load();};
  $('#calendar-status-filter').onchange=render;$('#calendar-dei-filter').onchange=render;$('#calendar-search').oninput=render;$('#calendar-show-tasks').onchange=render;
  $('#calendar-org-filter').onchange=()=>{
    // En choisissant un client, on repart sur tous les statuts afin que ses dates
    // de campagnes soient immédiatement visibles dans l'année.
    if($('#calendar-org-filter').value)$('#calendar-status-filter').value='';
    load();
  };
  $$('[data-task-filter]').forEach(b=>b.onclick=()=>{state.taskFilter=b.dataset.taskFilter;$$('[data-task-filter]').forEach(x=>x.classList.toggle('is-active',x===b));renderTasks();});

  if(isAdmin){$('#calendar-eyebrow').textContent='Administration Me&YouToo';$('#calendar-lead').textContent='Visualisez les campagnes de tous les clients, leurs échéances et vos tâches internes.';$('#tasks-intro').textContent='Vos tâches internes Me&YouToo restent invisibles des clients.';}
  else{$('#calendar-eyebrow').textContent='Pilotage DEI';$('#calendar-lead').textContent='Visualisez vos périodes de diffusion et organisez les actions de votre équipe.';}

  document.addEventListener('keydown',e=>{if(e.key==='Escape')hideDeiPopover();});
  window.addEventListener('resize',hideDeiPopover);
  window.addEventListener('scroll',hideDeiPopover,true);

  Promise.resolve(loadOrganizations()).then(load);
})();
