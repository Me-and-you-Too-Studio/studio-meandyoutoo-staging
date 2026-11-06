// Temps forts D&I côté Me&YouToo : la liste lue par le Calendrier, le Cockpit et le Bilan, ses offres et ses alertes.
(function(){
  'use strict';
  var root=document.querySelector('[data-temps-forts-root]');
  if(!root)return;
  var MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var CATEGORIES={equality:'Égalité femmes-hommes',diversity:'Diversité & inclusion',discrimination:'Diversité & discriminations',lgbt:'LGBT+',disability:'Handicap','human-rights':'Droits humains'};
  var THEMES=['Sexisme','Égalité femmes-hommes','Handicap','LGBT+','Origines','Religion','Intergénérationnel','Harcèlement & VSS','Inclusion'];
  var state={events:[],offers:[],upcoming:[],sendingEnabled:false};
  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function when(e){return e.date_kind==='seeph'?'3e lundi de novembre':e.date_kind==='month'?'Tout le mois de '+MONTHS[e.month-1]:e.day+' '+MONTHS[e.month-1];}
  function fmt(v){return new Date(String(v).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});}

  function upcomingView(){
    if(!state.upcoming.length)return '<p class="tf-empty">Aucun temps fort avec alerte dans les 90 prochains jours.</p>';
    return '<div class="tf-upcoming">'+state.upcoming.map(function(u){
      return '<article class="tf-card"><p class="tf-when">Dans '+u.daysLeft+' jours · '+esc(fmt(u.date))+'</p><h3>'+esc(u.name)+'</h3><p class="tf-theme">'+esc(u.theme)+'</p>'+
        (u.clients.length?'<p><strong>'+u.clients.length+' client'+(u.clients.length>1?'s':'')+' sans rien de prévu</strong></p><ul>'+u.clients.map(function(c){return '<li><a href="cockpit-dei.html?organizationId='+encodeURIComponent(c.id)+'">'+esc(c.name)+'</a></li>';}).join('')+'</ul>':'<p>Tous les clients ont prévu une action.</p>')+'</article>';
    }).join('')+'</div>';
  }
  function eventRow(e){
    var offers=(e.offers||[]).map(function(o){return esc(o.title);}).join(', ');
    return '<tr'+(e.active?'':' class="is-off"')+'><td><strong>'+esc(e.title)+'</strong><br><small>'+esc(when(e))+'</small></td><td>'+esc(e.theme||'—')+'</td><td>'+(offers||'<em>Aucune offre</em>')+'</td>'+
      '<td>'+(e.active?(e.alerts?'<span class="tf-pill is-on">Alerte active</span>':'<span class="tf-pill">Sans alerte</span>'):'<span class="tf-pill">Masqué</span>')+'</td>'+
      '<td class="tf-tools"><button type="button" class="button button-ghost" data-edit="'+esc(e.id)+'">Modifier</button><button type="button" class="button button-ghost" data-test="'+esc(e.id)+'">Recevoir l’e-mail d’essai</button></td></tr>';
  }
  // Fenêtre avec une croix toujours visible : pas besoin de descendre jusqu'au bouton du bas.
  function showDialog(dlg){var x=document.createElement('button');x.type='button';x.className='dr-dialog-x';x.setAttribute('aria-label','Fermer');x.textContent='×';x.onclick=function(){dlg.close();};dlg.appendChild(x);dlg.showModal();}
  function render(){
    root.innerHTML='<p class="tf-state '+(state.sendingEnabled?'is-on':'')+'">'+(state.sendingEnabled?'✅ Les alertes partent aux clients : e-mail à 90 jours, carte et cloche à 60 jours.':'⏸️ Aucune alerte n’est envoyée aux clients pour le moment. La carte du Cockpit reste visible.')+'</p>'+
      '<h2 class="tf-title">Les 90 prochains jours</h2>'+upcomingView()+
      '<div class="tf-head"><h2 class="tf-title">Tous les temps forts</h2><button type="button" class="button button-primary" data-add>＋ Ajouter un temps fort</button></div>'+
      '<div class="tf-table-wrap"><table class="tf-table"><thead><tr><th>Temps fort</th><th>Thématique</th><th>Offres proposées</th><th>Alerte</th><th></th></tr></thead><tbody>'+state.events.map(eventRow).join('')+'</tbody></table></div>';
  }
  function dialog(event){
    var e=event||{date_kind:'day',month:1,day:1,category:'diversity',active:true,offers:[]};
    var chosen=(e.offers||[]).map(function(o){return String(o.id);});
    var options=function(map,value){return Object.keys(map).map(function(k){return '<option value="'+esc(k)+'"'+(k===value?' selected':'')+'>'+esc(map[k])+'</option>';}).join('');};
    var dlg=document.createElement('dialog');dlg.className='dr-dialog';
    dlg.innerHTML='<form><h2>'+(event?'Modifier le temps fort':'Nouveau temps fort')+'</h2>'+
      '<label class="dr-field"><span>Nom *</span><input name="title" required maxlength="200" value="'+esc(e.title||'')+'"></label>'+
      '<label class="dr-field"><span>Nom court (Calendrier, e-mail)</span><input name="short" maxlength="80" value="'+esc(e.short_title||'')+'"></label>'+
      '<div class="dr-field-row"><label class="dr-field"><span>Date</span><select name="dateKind">'+options({day:'Jour fixe',month:'Mois entier',seeph:'SEEPH (calculée)'},e.date_kind)+'</select></label>'+
      '<label class="dr-field" data-month><span>Mois</span><select name="month">'+MONTHS.map(function(m,i){return '<option value="'+(i+1)+'"'+(i+1===e.month?' selected':'')+'>'+m+'</option>';}).join('')+'</select></label>'+
      '<label class="dr-field" data-day><span>Jour</span><input type="number" min="1" max="31" name="day" value="'+esc(e.day||1)+'"></label></div>'+
      '<div class="dr-field-row"><label class="dr-field"><span>Thématique</span><input name="theme" list="tf-themes" maxlength="120" value="'+esc(e.theme||'')+'"><datalist id="tf-themes">'+THEMES.map(function(t){return '<option value="'+esc(t)+'">';}).join('')+'</datalist></label>'+
      '<label class="dr-field"><span>Famille (filtre du Calendrier)</span><select name="category">'+options(CATEGORIES,e.category)+'</select></label></div>'+
      '<label class="dr-field"><span>Diagnostic conseillé</span><input name="recommendation" maxlength="120" value="'+esc(e.recommendation||'')+'"></label>'+
      '<fieldset class="tf-offers"><legend>Offres proposées (la première s’affiche sur la carte du Cockpit)</legend>'+state.offers.map(function(o){return '<label class="dr-check"><input type="checkbox" name="offer" value="'+esc(o.id)+'"'+(chosen.indexOf(String(o.id))>=0?' checked':'')+'> '+esc(o.title)+(o.published?'':' (masquée)')+'</label>';}).join('')+'</fieldset>'+
      '<label class="dr-check"><input type="checkbox" name="alerts"'+(e.alerts?' checked':'')+'> Alerte aux clients (e-mail à 90 jours, carte et cloche à 60 jours)</label>'+
      '<label class="dr-check"><input type="checkbox" name="highlight"'+(e.highlight?' checked':'')+'> Mis en avant dans le Calendrier</label>'+
      '<label class="dr-check"><input type="checkbox" name="active"'+(e.active?' checked':'')+'> Visible par les clients</label>'+
      '<p class="dr-error" hidden></p><div class="dr-dialog-actions">'+(event?'<button type="button" class="button button-ghost" data-delete>Supprimer</button>':'')+'<button type="button" class="button button-ghost" data-close>Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.dr-error');
    function sync(){var k=form.elements.dateKind.value;dlg.querySelector('[data-month]').hidden=k==='seeph';dlg.querySelector('[data-day]').hidden=k!=='day';}
    form.elements.dateKind.addEventListener('change',sync);sync();
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    var del=dlg.querySelector('[data-delete]');
    if(del)del.onclick=async function(){
      var ok=await window.StudioModal.confirm({eyebrow:'Temps forts',title:'Supprimer « '+e.title+' » ?',message:'Il disparaît du Calendrier, du Cockpit et du Bilan. Pour le garder de côté, décochez plutôt « Visible par les clients ».',confirmLabel:'Supprimer'});
      if(!ok)return;
      try{await StudioAPI.request('/api/admin/temps-forts/'+encodeURIComponent(e.id),{method:'DELETE'});dlg.close();load();}catch(x){err.textContent=x.message;err.hidden=false;}
    };
    form.onsubmit=async function(ev){ev.preventDefault();err.hidden=true;
      var f=new FormData(form);
      var body={title:f.get('title'),short:f.get('short'),dateKind:f.get('dateKind'),month:Number(f.get('month')),day:Number(f.get('day')),theme:f.get('theme'),category:f.get('category'),recommendation:f.get('recommendation'),
        offerIds:f.getAll('offer'),alerts:f.get('alerts')==='on',highlight:f.get('highlight')==='on',active:f.get('active')==='on'};
      try{await StudioAPI.request('/api/admin/temps-forts'+(event?'/'+encodeURIComponent(e.id):''),{method:event?'PATCH':'POST',body:JSON.stringify(body)});dlg.close();load();}
      catch(x){err.textContent=x.message||'Enregistrement impossible';err.hidden=false;}
    };
    showDialog(dlg);
  }
  async function sendTest(id,button){
    button.disabled=true;
    try{var r=await StudioAPI.request('/api/admin/temps-forts/'+encodeURIComponent(id)+'/essai',{method:'POST'});
      window.StudioModal.alert({title:r.sent?'E-mail d’essai envoyé':'E-mail non envoyé',message:r.sent?'Il part à votre adresse seulement ('+r.to+').':'L’envoi d’e-mails n’est pas disponible sur cet environnement.'});
    }catch(x){window.StudioModal.alert({title:'Envoi impossible',message:x.message});}
    button.disabled=false;
  }
  root.addEventListener('click',function(ev){
    var t=ev.target.closest('[data-add],[data-edit],[data-test]');if(!t)return;
    if(t.hasAttribute('data-add'))dialog(null);
    else if(t.hasAttribute('data-edit'))dialog(state.events.find(function(e){return String(e.id)===t.getAttribute('data-edit');}));
    else sendTest(t.getAttribute('data-test'),t);
  });
  async function load(){
    try{var d=await StudioAPI.request('/api/admin/temps-forts');state=d;render();}
    catch(e){root.innerHTML='<p class="tf-empty">Temps forts indisponibles : '+esc(e.message||'')+'</p>';}
  }
  load();
})();
