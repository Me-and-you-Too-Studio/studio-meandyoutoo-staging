(function(){
'use strict';
if(!window.StudioAPI||!StudioAPI.requireAuth())return;
// Aide du Studio : articles de la catégorie « Aide Studio Me&YouToo » de la base HubSpot, lus par l'API (pas de compte HubSpot côté client).
// Familles = sous-catégories HubSpot de la catégorie d'aide, dans l'ordre de HubSpot (renvoyées par l'API) ; un article rangé directement dans la catégorie va dans « Autres questions ».
var FAMILIES=[];
var $=function(id){return document.getElementById(id);};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function formatDate(value){var d=value?new Date(value):null;return d&&!isNaN(d)?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(d):'';}
// Une couleur et une icône par famille, reconnues à leur nom ; une famille inconnue prend la couleur du Studio.
var THEMES=[[/démarr/i,'🚀','#0d8791','#e3f4f5'],[/choisir|diagnostic/i,'🧭','#5669a9','#eceffa'],[/créer|campagne/i,'✏️','#5f9a1c','#eef6e2'],[/diffus|suivre/i,'📣','#1592b5','#e2f3f8'],[/résultat|pilotage/i,'📊','#8a5cc7','#f3edfb'],[/abonnement|passation/i,'🎟️','#c99400','#fff6dd'],[/compte|accès|équipe/i,'👥','#2f80c4','#e8f2fb'],[/ressource|contact/i,'💬','#2e9d6a','#e5f5ec']];
function theme(name){var t=THEMES.find(function(x){return x[0].test(String(name||''));});return t?{icon:t[1],color:t[2],soft:t[3]}:{icon:'💡',color:'#007883',soft:'#e6f4f5'};}
function themeStyle(t){return '--fam:'+t.color+';--fam-soft:'+t.soft;}
function slug(name){return 'famille-'+String(name||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function card(a){return '<a class="help-article-card" href="'+esc(a.link)+'"><strong>'+esc(a.title)+'</strong>'+(a.excerpt?'<span>'+esc(a.excerpt)+'</span>':'<span></span>')+'<em>Lire le guide →</em></a>';}
var items=[];
function render(){
  var q=String($('help-search').value||'').trim().toLowerCase(),list=q?items.filter(function(a){return a.searchText.indexOf(q)>=0;}):items;
  $('help-empty').hidden=!(items.length&&!list.length);
  var groups=FAMILIES.map(function(f){return {name:f.name,items:list.filter(function(a){return a.subcategoryId===f.id;})};});
  var known=FAMILIES.map(function(f){return f.id;}),rest=list.filter(function(a){return known.indexOf(a.subcategoryId)<0;});
  if(rest.length)groups.push({name:FAMILIES.length?'Autres questions':'Questions fréquentes',items:rest});
  var shown=groups.filter(function(g){return g.items.length;});
  $('help-chips').innerHTML=q?'':shown.map(function(g){var t=theme(g.name);return '<a class="help-chip" href="#'+slug(g.name)+'" style="'+themeStyle(t)+'"><span class="help-chip-icon" aria-hidden="true">'+t.icon+'</span>'+esc(g.name)+' <small>'+g.items.length+'</small></a>';}).join('');
  $('help-groups').innerHTML=shown.map(function(g){var t=theme(g.name);return '<section class="help-group" id="'+slug(g.name)+'" style="'+themeStyle(t)+'"><div class="help-group-head"><span class="help-group-icon" aria-hidden="true">'+t.icon+'</span><h2>'+esc(g.name)+'</h2><span class="help-group-count">'+g.items.length+' guide'+(g.items.length>1?'s':'')+'</span></div><div class="help-article-list">'+g.items.map(card).join('')+'</div></section>';}).join('');
}
async function loadList(){
  try{var data=await StudioAPI.request('/api/help');items=(data&&data.items)||[];FAMILIES=(data&&data.groups)||[];$('help-loading').hidden=true;if(!items.length){$('help-error').hidden=false;$('help-error').textContent='Les premiers articles d’aide arrivent bientôt. En attendant, écrivez-nous ou ouvrez le chat.';return;}render();}
  catch(e){$('help-loading').hidden=true;$('help-error').hidden=false;}
}
async function loadArticle(id){
  $('help-home').hidden=true;$('help-article-view').hidden=false;
  try{var data=await StudioAPI.request('/api/help/'+encodeURIComponent(id)),a=data&&data.item;if(!a)throw new Error('vide');
    var list=await StudioAPI.request('/api/help').catch(function(){return null;}),fam=((list&&list.groups)||[]).find(function(g){return String(g.id)===String(a.subcategoryId);}),t=theme(fam&&fam.name);
    $('help-article-view').setAttribute('style',themeStyle(t));$('help-article-icon').textContent=t.icon;$('help-article-family').textContent=fam?fam.name:'Aide Studio';
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
// Dans un article, un lien vers un tutoriel ouvre la vidéo dans la fenêtre du Studio, refermable, plutôt que dans un nouvel onglet.
document.addEventListener('click',function(e){
  var link=e.target.closest&&e.target.closest('a[href*="/tutos/"]'),m=link&&link.getAttribute('href').match(/\/tutos\/([a-z-]+)\/index\.html/);
  if(!m||!window.StudioTutorial)return;
  e.preventDefault();window.StudioTutorial.open(m[1]);
});
// « Lire le guide » depuis un écran : aide.html?sujet=début du titre. La fiche trouvée s'ouvre ; sinon, la recherche est pré-remplie.
function norm(v){return String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’']/g,"'").toLowerCase().trim();}
async function openSubject(subject){
  try{var data=await StudioAPI.request('/api/help'),list=(data&&data.items)||[],q=norm(subject);
    var a=list.find(function(x){return norm(x.title).indexOf(q)===0;})||list.find(function(x){return norm(x.title).indexOf(q)>=0;});
    if(a){history.replaceState(null,'','aide.html?id='+encodeURIComponent(a.id));loadArticle(a.id);return;}
  }catch(e){}
  history.replaceState(null,'','aide.html');$('help-search').value=subject;$('help-search').addEventListener('input',render);loadList();
}
var params=new URLSearchParams(location.search),id=params.get('id'),subject=params.get('sujet');
if(/^\d+$/.test(String(id||'')))loadArticle(id);else if(subject)openSubject(subject);else{$('help-search').addEventListener('input',render);loadList();}
})();
