// Pages thématiques : si le client n'a jamais exploré ce diagnostic, rappeler que son pack
// est valable sur tous les diagnostics Me&YouToo (carte Trello « gamification du studio »).
(function(){
  if(!window.StudioAPI||!StudioAPI.token||!StudioAPI.token())return;
  var user=StudioAPI.user&&StudioAPI.user()||{};
  if(user.role!=='client')return;
  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){return new Intl.NumberFormat('fr-FR').format(Number(v)||0);}

  function render(start,data){
    var slug=start.dataset.startTheme,g=data.gamification||{},org=data.organization||{};
    if(!slug||(g.exploredThemes||[]).indexOf(slug)>=0||document.getElementById('theme-nudge'))return;
    var theme=(data.themes||[]).find(function(t){return t.slug===slug;});
    var title=theme?theme.title:(document.querySelector('.page-title')||{}).textContent||'ce diagnostic';
    var remaining=org.pack_unlimited?null:Number(org.passations_remaining)||0;
    var credit=org.pack_unlimited?'Votre pack illimité couvre ce diagnostic.':remaining>0?'Il vous reste <strong>'+num(remaining)+' passation'+(remaining>1?'s':'')+'</strong> disponible'+(remaining>1?'s':'')+'.':'Votre pack est entièrement utilisé : commandez des passations pour lancer ce diagnostic.';
    var action=remaining===0?'<a class="button button-primary sp-cta is-pulse" href="packs.html">Commander des passations</a>':'<button type="button" class="button button-primary sp-cta is-pulse" data-theme-nudge-start>Composer ce diagnostic →</button>';
    var box=document.createElement('section');
    box.id='theme-nudge';box.className='theme-nudge';box.setAttribute('aria-live','polite');
    box.innerHTML='<span class="theme-nudge-icon" aria-hidden="true">✨</span><div><strong>Vous n’avez pas encore exploré le diagnostic « '+esc(title)+' ».</strong><p>Votre pack actuel est valable sur <b>tous les diagnostics Me&amp;YouToo</b>. '+credit+'</p></div>'+action;
    var anchor=start.closest('section')||start.parentElement;
    anchor.parentElement.insertBefore(box,anchor);
    var go=box.querySelector('[data-theme-nudge-start]');
    if(go)go.onclick=function(){start.click();};
  }

  // Le bouton « Choisir ce thème » peut être ajouté après le chargement (page thématique dynamique).
  var tries=0;
  (function wait(){
    var start=document.querySelector('[data-start-theme]');
    if(!start){if(++tries<24)setTimeout(wait,250);return;}
    StudioAPI.request('/api/me/dashboard').then(function(data){render(start,data);}).catch(function(){});
  })();
})();
