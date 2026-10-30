// Cockpit DEI : registre des actions de l'année (indicateurs, frise 12 mois, liste, pièces jointes).
// Mode admin : cockpit-dei.html?organizationId=… pour saisir les actions animées par Me&YouToo.
(function(){
  'use strict';
  var root=document.getElementById('dei-registry');
  if(!root||!window.StudioAPI)return;
  var params=new URLSearchParams(location.search);
  var user=null;try{user=StudioAPI.user();}catch(e){}
  var isAdmin=Boolean(user&&user.role==='admin');
  var organizationId=isAdmin?params.get('organizationId'):null;
  var isClient=Boolean(user&&user.role==='client');
  var MONTHS=['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];
  var MONTHS_LONG=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var THEMES=['Sexisme','Égalité femmes-hommes','Handicap','LGBT+','Origines','Religion','Intergénérationnel','Harcèlement & VSS','Inclusion','Management inclusif'];
  var state={year:Number(params.get('year'))||new Date().getFullYear(),data:null};

  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){return new Intl.NumberFormat('fr-FR').format(Number(v)||0);}
  function fmtDate(v){if(!v)return '';var d=new Date(String(v).slice(0,10)+'T12:00:00');return d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});}
  function qs(extra){var p=new URLSearchParams();if(organizationId)p.set('organizationId',organizationId);Object.keys(extra||{}).forEach(function(k){p.set(k,extra[k]);});var s=p.toString();return s?'?'+s:'';}
  function withOrg(body){if(organizationId)body.organizationId=organizationId;return body;}
  function today(){return new Date().toISOString().slice(0,10);}

  function load(){
    if(isAdmin&&!organizationId){root.innerHTML='<p class="dr-empty">Le registre des actions est propre à chaque client : ouvrez-le depuis le <a href="admin.html">dossier d’un client</a> (bouton « Cockpit DEI du client »).</p>';return Promise.resolve();}
    root.setAttribute('aria-busy','true');
    return StudioAPI.request('/api/dei/actions'+qs({year:state.year})).then(function(d){state.data=d;render();})
      .catch(function(e){root.innerHTML='<p class="dr-empty">Le registre des actions est momentanément indisponible. '+esc(e.message||'')+'</p>';})
      .finally(function(){root.removeAttribute('aria-busy');});
  }

  // Actions du registre + campagnes de diagnostic, dans un même format d'affichage.
  function items(){
    var d=state.data,t=today();
    var actions=d.actions.map(function(a){return {type:'action',id:a.id,kind:a.kind,title:a.title,date:a.action_date,end:a.end_date,status:a.status,theme:a.theme,audience:a.audience,people:a.people_reached,notes:a.notes,meayt:a.led_by_meayt,documents:a.documents||[],offerId:a.offer_id,raw:a};});
    var campaigns=d.campaigns.map(function(c){return {type:'campaign',id:c.id,kind:'diagnostic',title:c.name,date:c.launch_date,end:c.close_date,status:c.close_date&&c.close_date<t?'done':'in_progress',theme:c.theme_title,people:c.respondents,documents:[]};});
    return actions.concat(campaigns).sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
  }
  function kind(k){return (state.data.kinds||{})[k]||{label:k,icon:'•'};}

  function render(){
    var d=state.data,list=items(),ind=d.indicators,canEdit=d.canEdit;
    var years=d.years.map(function(y){return '<button type="button" class="dr-year'+(y===state.year?' is-current':'')+'" data-year="'+y+'">'+y+'</button>';}).join('');
    var head='<div class="dr-head"><div><p class="eyebrow">Registre des actions D&amp;I</p><h2>'+(organizationId?'Année '+state.year+(d.organizationName?' — '+esc(d.organizationName):''):'Votre année '+state.year)+'</h2>'+
      '<p>Toutes vos actions diversité &amp; inclusion au même endroit : celles animées par Me&amp;YouToo, vos diagnostics et vos initiatives internes.</p></div>'+
      '<div class="dr-head-actions"><div class="dr-years" role="group" aria-label="Choisir l’année">'+years+'</div>'+(canEdit?'<button type="button" class="button button-primary" data-add>＋ Ajouter une action</button>':'')+'</div></div>';
    var cards='<div class="dr-kpis">'+
      kpi(num(ind.actions),'action'+(ind.actions>1?'s':''),ind.done+' réalisée'+(ind.done>1?'s':'')+' · '+ind.planned+' à venir ou en cours')+
      kpi(num(ind.peopleReached),'personne'+(ind.peopleReached>1?'s':'')+' touchée'+(ind.peopleReached>1?'s':''),'actions réalisées et participations aux diagnostics')+
      kpi(num(ind.formats),'format'+(ind.formats>1?'s':'')+' utilisé'+(ind.formats>1?'s':''),'conférences, formations, diagnostics…')+
      kpi(num(ind.themes),'thématique'+(ind.themes>1?'s':'')+' couverte'+(ind.themes>1?'s':''),'sur l’année')+
      kpi(num(ind.monthsWithoutAction),'mois sans action',ind.monthsWithoutAction?'sur les mois déjà écoulés':'aucun trou sur les mois écoulés',ind.monthsWithoutAction?'is-alert':'is-ok')+
    '</div>';
    var byMonth=MONTHS.map(function(){return [];});
    list.forEach(function(it){if(String(it.date).slice(0,4)===String(state.year))byMonth[Number(String(it.date).slice(5,7))-1].push(it);});
    var nowY=new Date().getFullYear(),nowM=new Date().getMonth();
    var frise='<div class="dr-frise" role="list">'+byMonth.map(function(its,m){
      var past=state.year<nowY||(state.year===nowY&&m<nowM),current=state.year===nowY&&m===nowM;
      var body=its.map(function(it){var k=kind(it.kind);return '<button type="button" class="dr-pill st-'+esc(it.status)+'" data-focus="'+esc(it.type+'-'+it.id)+'" title="'+esc(it.title)+'"><span aria-hidden="true">'+esc(k.icon)+'</span> '+esc(it.title)+'</button>';}).join('');
      var empty=!its.length?(isClient?'<button type="button" class="dr-help" data-month="'+m+'">'+(past?'Mois sans action':'Rien de prévu')+'<span>Être accompagné →</span></button>':(canEdit?'<button type="button" class="dr-help" data-add-month="'+m+'">'+(past?'Mois sans action':'Rien de prévu')+'<span>＋ Ajouter</span></button>':'<span class="dr-none">—</span>')):'';
      return '<div class="dr-month'+(current?' is-current':'')+(past&&!its.length?' is-gap':'')+'" role="listitem"><p class="dr-month-name">'+MONTHS[m]+'</p>'+body+empty+'</div>';
    }).join('')+'</div>';
    var rows=list.length?list.map(row).join(''):'<p class="dr-empty">Aucune action enregistrée pour '+state.year+'. '+(canEdit?'Ajoutez votre première action, ou demandez-nous de l’alimenter pour vous.':'')+'</p>';
    root.innerHTML=head+cards+'<h3 class="dr-sub">Frise de l’année</h3>'+frise+'<h3 class="dr-sub">Détail des actions</h3><div class="dr-list">'+rows+'</div>';
  }
  function kpi(value,label,hint,cls){return '<article class="dr-kpi '+(cls||'')+'"><strong>'+value+'</strong><span>'+label+'</span><small>'+hint+'</small></article>';}

  function row(it){
    var k=kind(it.kind),st=(state.data.statuses||{})[it.status]||it.status,canEdit=state.data.canEdit&&it.type==='action';
    var when=fmtDate(it.date)+(it.end&&it.end!==it.date?' → '+fmtDate(it.end):'');
    var meta=[it.theme,it.audience,it.people!=null?num(it.people)+(it.type==='campaign'?' participations':' personnes touchées'):''].filter(Boolean).map(esc).join(' · ');
    var docs=(it.documents||[]).map(function(doc){return '<span class="dr-doc"><button type="button" class="dr-link" data-download="'+esc(it.id)+':'+esc(doc.id)+'" data-filename="'+esc(doc.filename)+'">📎 '+esc(doc.filename)+'</button>'+(canEdit?'<button type="button" class="dr-x" data-doc-delete="'+esc(it.id)+':'+esc(doc.id)+'" aria-label="Retirer '+esc(doc.filename)+'">×</button>':'')+'</span>';}).join('');
    var tools=it.type==='campaign'
      ?'<a class="dr-link" href="campagne-detail.html?projectId='+encodeURIComponent(it.id)+(organizationId?'':'')+'">Voir la campagne →</a>'
      :((canEdit?'<button type="button" class="button button-ghost" data-edit="'+esc(it.id)+'">Modifier</button><label class="button button-ghost dr-upload">Joindre un document<input type="file" accept="application/pdf,image/png,image/jpeg" data-upload="'+esc(it.id)+'" hidden></label><button type="button" class="button button-ghost" data-delete="'+esc(it.id)+'">Supprimer</button>':'')+
        (isClient?'<button type="button" class="dr-link" data-accompany="'+esc(it.id)+'">Être accompagné sur cette action →</button>':''));
    return '<article class="dr-row" id="dr-'+esc(it.type+'-'+it.id)+'"><div class="dr-row-icon" aria-hidden="true">'+esc(k.icon)+'</div><div class="dr-row-main">'+
      '<p class="dr-row-kind">'+esc(it.type==='campaign'?'Diagnostic comportemental · Studio':k.label)+(it.meayt?' <span class="dr-badge is-meayt">Animée par Me&amp;YouToo</span>':'')+' <span class="dr-badge st-'+esc(it.status)+'">'+esc(st)+'</span></p>'+
      '<h4>'+esc(it.title)+'</h4><p class="dr-row-when">'+esc(when)+'</p>'+(meta?'<p class="dr-row-meta">'+meta+'</p>':'')+(it.notes?'<p class="dr-row-notes">'+esc(it.notes)+'</p>':'')+
      (docs?'<div class="dr-docs">'+docs+'</div>':'')+'<div class="dr-row-tools">'+tools+'</div></div></article>';
  }

  // ── Saisie ──
  function editDialog(action,month){
    var d=state.data,a=action||{kind:'formation',status:'planned',action_date:(state.year+'-'+String((month??new Date().getMonth())+1).padStart(2,'0')+'-15'),led_by_meayt:isAdmin};
    var kinds=Object.keys(d.kinds).filter(function(k){return k!=='microlearning';}).map(function(k){return '<option value="'+esc(k)+'"'+(k===a.kind?' selected':'')+'>'+esc(d.kinds[k].icon+' '+d.kinds[k].label)+'</option>';}).join('');
    var statuses=Object.keys(d.statuses).map(function(s){return '<option value="'+s+'"'+(s===a.status?' selected':'')+'>'+esc(d.statuses[s])+'</option>';}).join('');
    var dlg=document.createElement('dialog');dlg.className='dr-dialog';
    dlg.innerHTML='<form><h2>'+(action?'Modifier l’action':'Nouvelle action')+'</h2>'+
      '<label class="dr-field"><span>Type d’action *</span><select name="kind">'+kinds+'</select></label>'+
      '<label class="dr-field"><span>Titre *</span><input name="title" required maxlength="200" value="'+esc(a.title||'')+'" placeholder="Ex. : Conférence sur le sexisme ordinaire"></label>'+
      '<div class="dr-field-row"><label class="dr-field"><span>Date *</span><input type="date" name="actionDate" required value="'+esc(a.action_date||'')+'"></label><label class="dr-field"><span>Date de fin</span><input type="date" name="endDate" value="'+esc(a.end_date||'')+'"></label><label class="dr-field"><span>Statut</span><select name="status">'+statuses+'</select></label></div>'+
      '<div class="dr-field-row"><label class="dr-field"><span>Thématique</span><input name="theme" list="dr-themes" value="'+esc(a.theme||'')+'"><datalist id="dr-themes">'+THEMES.map(function(t){return '<option value="'+esc(t)+'">';}).join('')+'</datalist></label><label class="dr-field"><span>Personnes touchées</span><input type="number" min="0" name="peopleReached" value="'+esc(a.people_reached??'')+'"></label></div>'+
      '<label class="dr-field"><span>Public visé</span><input name="audience" maxlength="200" value="'+esc(a.audience||'')+'" placeholder="Ex. : managers du siège, nouveaux arrivants…"></label>'+
      '<label class="dr-field"><span>Notes</span><textarea name="notes" rows="3" maxlength="4000">'+esc(a.notes||'')+'</textarea></label>'+
      (isAdmin?'<label class="dr-check"><input type="checkbox" name="ledByMeayt"'+(a.led_by_meayt?' checked':'')+'> Action animée par Me&amp;YouToo</label>':'')+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions"><button type="button" class="button button-ghost" data-close>Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error');
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      if(!form.checkValidity()){form.reportValidity();return;}
      var f=new FormData(form),body=withOrg({kind:f.get('kind'),title:f.get('title'),actionDate:f.get('actionDate'),endDate:f.get('endDate'),status:f.get('status'),
        theme:f.get('theme'),peopleReached:f.get('peopleReached'),audience:f.get('audience'),notes:f.get('notes')});
      if(isAdmin)body.ledByMeayt=f.get('ledByMeayt')==='on';
      try{
        await StudioAPI.request('/api/dei/actions'+(action?'/'+encodeURIComponent(action.id):'')+(action?qs():''),{method:action?'PATCH':'POST',body:JSON.stringify(body)});
        dlg.close();var y=Number(String(body.actionDate).slice(0,4));if(y&&y!==state.year)state.year=y;load();
      }catch(e){err.textContent=e.message||'Enregistrement impossible';err.hidden=false;}
    };
    dlg.showModal();
  }
  async function remove(id){
    var a=state.data.actions.find(function(x){return String(x.id)===String(id);});if(!a)return;
    var ok=await window.StudioModal.confirm({eyebrow:'Registre des actions',title:'Supprimer « '+a.title+' » ?',message:'L’action et ses pièces jointes seront définitivement supprimées.',confirmLabel:'Supprimer'});
    if(!ok)return;
    try{await StudioAPI.request('/api/dei/actions/'+encodeURIComponent(id)+qs(),{method:'DELETE'});load();}catch(e){window.StudioModal.alert({title:'Suppression impossible',message:e.message});}
  }
  function upload(id,file){
    if(!file)return;
    if(file.size>6*1024*1024){window.StudioModal.alert({title:'Fichier trop lourd',message:'Le fichier ne doit pas dépasser 6 Mo.'});return;}
    var reader=new FileReader();
    reader.onload=async function(){
      try{await StudioAPI.request('/api/dei/actions/'+encodeURIComponent(id)+'/documents'+qs(),{method:'POST',body:JSON.stringify(withOrg({filename:file.name,mimeType:file.type,contentBase64:String(reader.result)}))});load();}
      catch(e){window.StudioModal.alert({title:'Envoi impossible',message:e.message});}
    };
    reader.readAsDataURL(file);
  }
  async function download(pair,filename){
    var p=pair.split(':');
    try{
      var res=await fetch(StudioAPI.base()+'/api/dei/actions/'+encodeURIComponent(p[0])+'/documents/'+encodeURIComponent(p[1])+qs(),{headers:{Authorization:'Bearer '+StudioAPI.token()}});
      if(!res.ok)throw new Error('Téléchargement impossible');
      var url=URL.createObjectURL(await res.blob()),link=document.createElement('a');link.href=url;link.download=filename||'document';document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},2000);
    }catch(e){window.StudioModal.alert({title:'Téléchargement impossible',message:e.message});}
  }
  async function removeDoc(pair){
    var p=pair.split(':');
    var ok=await window.StudioModal.confirm({eyebrow:'Pièce jointe',title:'Retirer ce document ?',message:'Le document sera définitivement supprimé.',confirmLabel:'Retirer'});
    if(!ok)return;
    try{await StudioAPI.request('/api/dei/actions/'+encodeURIComponent(p[0])+'/documents/'+encodeURIComponent(p[1])+qs(),{method:'DELETE'});load();}catch(e){window.StudioModal.alert({title:'Action impossible',message:e.message});}
  }

  // « Être accompagné » : même circuit que la vitrine (notification, e-mail, transaction HubSpot).
  async function accompany(context,label){
    var message=await window.StudioModal.prompt({eyebrow:'Être accompagné',title:label,
      message:'L’équipe Me&YouToo vous recontacte pour construire cette action avec vous : conférence, formation, atelier, diagnostic…',
      inputLabel:'Votre besoin (facultatif)',placeholder:'Ex. : un temps fort pour le 8 mars, 200 collaborateurs…',confirmLabel:'Envoyer ma demande'});
    if(message===null)return;
    try{var r=await StudioAPI.request('/api/offer-requests',{method:'POST',body:JSON.stringify({source:'cockpit',message:(label+(message?' — '+message:'')),context:context})});
      window.StudioModal.alert({eyebrow:'Être accompagné',title:'Demande transmise',type:'success',message:r.message||'Votre demande a bien été transmise.'});}
    catch(e){window.StudioModal.alert({title:'Envoi impossible',message:e.message});}
  }

  root.addEventListener('click',function(ev){
    var t=ev.target.closest('button');if(!t)return;
    if(t.hasAttribute('data-year')){state.year=Number(t.getAttribute('data-year'));load();}
    else if(t.hasAttribute('data-add'))editDialog(null);
    else if(t.hasAttribute('data-add-month'))editDialog(null,Number(t.getAttribute('data-add-month')));
    else if(t.hasAttribute('data-edit'))editDialog(state.data.actions.find(function(a){return String(a.id)===t.getAttribute('data-edit');}));
    else if(t.hasAttribute('data-delete'))remove(t.getAttribute('data-delete'));
    else if(t.hasAttribute('data-download'))download(t.getAttribute('data-download'),t.getAttribute('data-filename'));
    else if(t.hasAttribute('data-doc-delete'))removeDoc(t.getAttribute('data-doc-delete'));
    else if(t.hasAttribute('data-month')){var m=Number(t.getAttribute('data-month'));accompany({year:state.year,month:m+1},'Une action D&I en '+MONTHS_LONG[m]+' '+state.year);}
    else if(t.hasAttribute('data-accompany')){var a=state.data.actions.find(function(x){return String(x.id)===t.getAttribute('data-accompany');});if(a)accompany({actionId:a.id,kind:a.kind},'Accompagnement : '+a.title);}
    else if(t.hasAttribute('data-focus')){var el=document.getElementById('dr-'+t.getAttribute('data-focus'));if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('is-focus');setTimeout(function(){el.classList.remove('is-focus');},1600);}}
  });
  root.addEventListener('change',function(ev){var t=ev.target;if(t.matches('[data-upload]'))upload(t.getAttribute('data-upload'),t.files&&t.files[0]);});
  load();
})();
