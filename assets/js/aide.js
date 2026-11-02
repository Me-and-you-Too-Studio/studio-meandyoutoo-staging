(function(){
'use strict';
if(!window.StudioAPI||!StudioAPI.requireAuth())return;
// Aide du Studio : articles de la catégorie « Aide Studio Me&YouToo » de la base HubSpot, lus par l'API (pas de compte HubSpot côté client).
// Familles = sous-catégories HubSpot de la catégorie d'aide, dans l'ordre de HubSpot (renvoyées par l'API) ; un article rangé directement dans la catégorie va dans « Autres questions ».
var FAMILIES=[];
var $=function(id){return document.getElementById(id);};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function formatDate(value){var d=value?new Date(value):null;return d&&!isNaN(d)?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(d):'';}
function card(a){return '<a class="help-article-card" href="'+esc(a.link)+'"><strong>'+esc(a.title)+'</strong>'+(a.excerpt?'<span>'+esc(a.excerpt)+'</span>':'')+'</a>';}
var items=[];
function render(){
  var q=String($('help-search').value||'').trim().toLowerCase(),list=q?items.filter(function(a){return a.searchText.indexOf(q)>=0;}):items;
  $('help-empty').hidden=!(items.length&&!list.length);
  var groups=FAMILIES.map(function(f){return {name:f.name,items:list.filter(function(a){return a.subcategoryId===f.id;})};});
  var known=FAMILIES.map(function(f){return f.id;}),rest=list.filter(function(a){return known.indexOf(a.subcategoryId)<0;});
  if(rest.length)groups.push({name:FAMILIES.length?'Autres questions':'Questions fréquentes',items:rest});
  $('help-groups').innerHTML=groups.filter(function(g){return g.items.length;}).map(function(g){return '<section class="help-group"><h2>'+esc(g.name)+'</h2><div class="help-article-list">'+g.items.map(card).join('')+'</div></section>';}).join('');
}
async function loadList(){
  try{var data=await StudioAPI.request('/api/help');items=(data&&data.items)||[];FAMILIES=(data&&data.groups)||[];$('help-loading').hidden=true;if(!items.length){$('help-error').hidden=false;$('help-error').textContent='Les premiers articles d’aide arrivent bientôt. En attendant, écrivez-nous ou ouvrez le chat.';return;}render();}
  catch(e){$('help-loading').hidden=true;$('help-error').hidden=false;}
}
async function loadArticle(id){
  $('help-home').hidden=true;$('help-article-view').hidden=false;
  try{var data=await StudioAPI.request('/api/help/'+encodeURIComponent(id)),a=data&&data.item;if(!a)throw new Error('vide');
    document.title=a.title+' — Aide — Studio Me&YouToo';$('help-article-title').textContent=a.title;
    $('help-article-meta').textContent=a.updatedAt?'Mis à jour le '+formatDate(a.updatedAt):'';$('help-article-body').innerHTML=a.bodyHtml||'';}
  catch(e){$('help-article-title').textContent='Article indisponible';$('help-article-body').innerHTML='<p>Cet article ne peut pas être affiché pour le moment. <a href="aide.html">Revenir à l’aide</a></p>';}
}
// Chat HubSpot quand il est chargé sur la page ; sinon la page de contact de l'équipe. Dans un article, un lien « #chat » fait de même.
document.addEventListener('click',function(e){
  if(!e.target.closest('[data-help-chat], a[href="#chat"]'))return;
  e.preventDefault();
  var w=window.HubSpotConversations&&window.HubSpotConversations.widget;
  if(w&&w.open){w.load&&w.status&&!w.status().loaded&&w.load();w.open();}else location.href='contact-client.html';
});
var id=new URLSearchParams(location.search).get('id');
if(/^\d+$/.test(String(id||'')))loadArticle(id);else{$('help-search').addEventListener('input',render);loadList();}
})();
