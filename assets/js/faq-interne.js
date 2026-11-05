(function(){
'use strict';
if(!window.StudioAPI||!StudioAPI.requireAuth())return;
// FAQ interne de l'équipe Me&YouToo : articles de la sous-catégorie HubSpot « Administration du Studio », lus par l'API.
// Réservée aux comptes admin : l'API refuse tout autre compte, y compris la vue client ouverte par un admin.
if((StudioAPI.user()||{}).role!=='admin'){location.replace('accueil.html');return;}
var $=function(id){return document.getElementById(id);};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function norm(v){return String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’']/g,"'").toLowerCase();}
function formatDate(value){var d=value?new Date(value):null;return d&&!isNaN(d)?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(d):'';}
var THEME='--fam:#007883;--fam-soft:#e6f4f5';
var items=[];
// Une carte par chapitre ; pendant une recherche, les questions trouvées mènent droit à la bonne réponse.
function card(a,q){
  var found=q?(a.questions||[]).map(function(text,i){return {text:text,i:i};}).filter(function(x){return norm(x.text).indexOf(q)>=0;}):[];
  var more=found.length?'<ul class="faq-internal-found">'+found.map(function(x){return '<li><a href="'+esc(a.link)+'#question-'+x.i+'">'+esc(x.text)+'</a></li>';}).join('')+'</ul>':'';
  return '<div class="help-article-card"><a href="'+esc(a.link)+'"><strong>'+esc(a.title)+'</strong></a>'+(more||(a.excerpt?'<span>'+esc(a.excerpt)+'</span>':'<span></span>'))+'<a href="'+esc(a.link)+'"><em>Lire le chapitre →</em></a></div>';
}
function render(){
  var q=norm($('help-search').value).trim(),list=q?items.filter(function(a){return norm(a.searchText).indexOf(q)>=0;}):items;
  $('help-empty').hidden=!(items.length&&!list.length);
  $('help-groups').innerHTML=list.length?'<section class="help-group" style="'+THEME+'"><div class="help-group-head"><span class="help-group-icon" aria-hidden="true">🛠️</span><h2>Gérer le Studio</h2><span class="help-group-count">'+list.length+' chapitre'+(list.length>1?'s':'')+'</span></div><div class="help-article-list">'+list.map(function(a){return card(a,q);}).join('')+'</div></section>':'';
}
async function loadList(){
  try{var data=await StudioAPI.request('/api/admin/help');items=(data&&data.items)||[];$('help-loading').hidden=true;
    if(!items.length){$('help-error').hidden=false;$('help-error').textContent='Aucun article interne n’est publié pour le moment.';return;}
    render();}
  catch(e){$('help-loading').hidden=true;$('help-error').hidden=false;}
}
// Sommaire du chapitre : chaque titre reçoit une ancre, dans le même ordre que les questions de l'API.
function buildSummary(){
  var titles=[].filter.call($('help-article-body').querySelectorAll('h2,h3'),function(h){return h.textContent.trim();});
  titles.forEach(function(h,i){h.id='question-'+i;});
  var box=$('faq-internal-summary');box.hidden=titles.length<2;$('help-article-body').prepend(box);
  box.querySelector('ul').innerHTML=titles.map(function(h){return '<li'+(h.tagName==='H3'?' class="is-sub"':'')+'><a href="#'+h.id+'">'+esc(h.textContent.trim())+'</a></li>';}).join('');
  var target=location.hash&&document.getElementById(location.hash.slice(1));if(target)target.scrollIntoView({behavior:'instant'});
}
async function loadArticle(id){
  $('help-home').hidden=true;$('help-article-view').hidden=false;
  try{var data=await StudioAPI.request('/api/admin/help/'+encodeURIComponent(id)),a=data&&data.item;if(!a)throw new Error('vide');
    document.title=a.title+' — FAQ interne — Studio Me&YouToo';$('help-article-title').textContent=a.title;
    $('help-article-meta').textContent=a.updatedAt?'Mis à jour le '+formatDate(a.updatedAt):'';$('help-article-body').innerHTML=a.bodyHtml||'';buildSummary();}
  catch(e){$('help-article-title').textContent='Article indisponible';$('help-article-body').innerHTML='<p>Cet article ne peut pas être affiché pour le moment. <a href="faq-interne.html">Revenir à la FAQ interne</a></p>';}
}
var id=new URLSearchParams(location.search).get('id');
if(/^\d+$/.test(String(id||'')))loadArticle(id);else{$('help-search').addEventListener('input',render);loadList();}
})();
