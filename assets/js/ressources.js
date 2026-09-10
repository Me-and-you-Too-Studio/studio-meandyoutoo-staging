(function(){
  'use strict';
  if(!window.StudioAPI||!StudioAPI.requireAuth())return;

  var state={items:[],query:'',category:'',source:'',page:1,pageSize:9};
  var grid=document.getElementById('resources-grid');
  var loading=document.getElementById('resources-loading');
  var empty=document.getElementById('resources-empty');
  var errorBox=document.getElementById('resources-error');
  var count=document.getElementById('resources-count');
  var search=document.getElementById('resources-search');
  var category=document.getElementById('resources-category');
  var reset=document.getElementById('resources-reset');
  var retry=document.getElementById('resources-retry');
  var pagination=document.getElementById('resources-pagination');
  var sourceTabs=[].slice.call(document.querySelectorAll('[data-source]'));

  function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function formatDate(value){if(!value)return '';var date=new Date(value);if(Number.isNaN(date.getTime()))return '';return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(date);}
  function safeUrl(value){try{var url=new URL(value,location.href);return /^https?:$/.test(url.protocol)?url.href:'';}catch(e){return '';}}
  function el(tag,className,text){var node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;}
  function itemHref(item){
    if(item.source==='diverstory')return 'ressource-client.html?id='+encodeURIComponent(item.id);
    return safeUrl(item.link);
  }
  function card(item,index){
    var article=el('article','resource-card'+(item.source==='diverstory'?' resource-card-private':''));
    var link=itemHref(item);var image=safeUrl(item.image);
    if(image){
      var media=el('a','resource-card-media');media.href=link;if(item.source!=='diverstory'){media.target='_blank';media.rel='noopener';}media.setAttribute('aria-label','Lire : '+item.title);
      var img=document.createElement('img');img.src=image;img.alt='';img.loading=index<3?'eager':'lazy';img.decoding='async';img.addEventListener('error',function(){media.classList.add('is-image-error');img.remove();});media.appendChild(img);article.appendChild(media);
    }else{
      var fallback=el('a','resource-card-media resource-card-media-fallback');fallback.href=link;if(item.source!=='diverstory'){fallback.target='_blank';fallback.rel='noopener';}fallback.setAttribute('aria-label','Lire : '+item.title);fallback.innerHTML='<span>Me<span>&</span>YouToo</span>';article.appendChild(fallback);
    }
    var body=el('div','resource-card-body');var meta=el('div','resource-card-meta');
    if(item.source==='diverstory')meta.appendChild(el('span','resource-client-badge','🔒 Ressource client'));
    else if(item.categories&&item.categories[0])meta.appendChild(el('span','resource-category',item.categories[0]));
    var date=formatDate(item.publishedAt);if(date)meta.appendChild(el('time','resource-date',date));body.appendChild(meta);
    var title=el('h3','resource-card-title');var titleLink=el('a','',item.title);titleLink.href=link;if(item.source!=='diverstory'){titleLink.target='_blank';titleLink.rel='noopener';}title.appendChild(titleLink);body.appendChild(title);
    if(item.excerpt)body.appendChild(el('p','resource-card-excerpt',item.excerpt));
    var footer=el('div','resource-card-footer');if(item.author)footer.appendChild(el('span','resource-author','Par '+item.author));
    var read=el('a','resource-read-link',item.source==='diverstory'?'Consulter':'Lire l’article');read.href=link;if(item.source!=='diverstory'){read.target='_blank';read.rel='noopener';read.innerHTML='Lire l’article <span aria-hidden="true">↗</span>';}else read.innerHTML='Consulter <span aria-hidden="true">→</span>';footer.appendChild(read);body.appendChild(footer);article.appendChild(body);return article;
  }
  function filteredItems(){var q=normalize(state.query),cat=normalize(state.category);return state.items.filter(function(item){var hay=normalize([item.title,item.excerpt,item.author].concat(item.categories||[]).join(' '));var cats=(item.categories||[]).map(normalize);return (!q||hay.includes(q))&&(!cat||cats.includes(cat))&&(!state.source||item.source===state.source);});}
  function renderPagination(totalItems){if(!pagination)return;var totalPages=Math.max(1,Math.ceil(totalItems/state.pageSize));if(state.page>totalPages)state.page=totalPages;pagination.innerHTML='';pagination.hidden=totalItems<=state.pageSize;if(pagination.hidden)return;function button(label,page,disabled,current,aria){var b=el('button','resources-page-button',label);b.type='button';b.disabled=!!disabled;if(current){b.classList.add('is-current');b.setAttribute('aria-current','page');}if(aria)b.setAttribute('aria-label',aria);b.addEventListener('click',function(){state.page=page;render();document.querySelector('.resources-status-row').scrollIntoView({behavior:'smooth',block:'start'});});pagination.appendChild(b);}button('‹',Math.max(1,state.page-1),state.page===1,false,'Page précédente');for(var i=1;i<=totalPages;i++)button(String(i),i,false,i===state.page,'Page '+i);button('›',Math.min(totalPages,state.page+1),state.page===totalPages,false,'Page suivante');}
  function render(){var items=filteredItems();var totalPages=Math.max(1,Math.ceil(items.length/state.pageSize));if(state.page>totalPages)state.page=totalPages;var start=(state.page-1)*state.pageSize,visible=items.slice(start,start+state.pageSize);grid.innerHTML='';visible.forEach(function(item,index){grid.appendChild(card(item,index));});grid.hidden=items.length===0;empty.hidden=items.length!==0;count.textContent=items.length+(items.length>1?' ressources':' ressource');renderPagination(items.length);}
  function fillCategories(){category.innerHTML='<option value="">Toutes les thématiques</option>';var values=[];state.items.forEach(function(item){(item.categories||[]).forEach(function(cat){if(cat&&!values.some(function(v){return normalize(v)===normalize(cat);}))values.push(cat);});});values.sort(function(a,b){return a.localeCompare(b,'fr',{sensitivity:'base'});});values.forEach(function(value){var option=document.createElement('option');option.value=value;option.textContent=value;category.appendChild(option);});}
  async function load(){loading.hidden=false;loading.setAttribute('aria-busy','true');grid.hidden=true;empty.hidden=true;errorBox.hidden=true;count.textContent='';try{var results=await Promise.allSettled([StudioAPI.request('/api/resources?limit=50'),StudioAPI.request('/api/resources/client')]);var publicItems=results[0].status==='fulfilled'&&Array.isArray(results[0].value&&results[0].value.items)?results[0].value.items:[];var privateItems=results[1].status==='fulfilled'&&Array.isArray(results[1].value&&results[1].value.items)?results[1].value.items:[];publicItems.forEach(function(item){item.source='blog';});privateItems.forEach(function(item){item.source='diverstory';});state.items=publicItems.concat(privateItems).sort(function(a,b){return new Date(b.publishedAt||0)-new Date(a.publishedAt||0);});fillCategories();loading.hidden=true;loading.setAttribute('aria-busy','false');if(state.items.length){render();if(results[1].status==='rejected')console.warn('Ressources clients indisponibles',results[1].reason);}else{errorBox.hidden=false;}}catch(err){console.error('Chargement ressources',err);loading.hidden=true;loading.setAttribute('aria-busy','false');errorBox.hidden=false;}}
  var debounce;search.addEventListener('input',function(){clearTimeout(debounce);debounce=setTimeout(function(){state.query=search.value.trim();state.page=1;render();},120);});category.addEventListener('change',function(){state.category=category.value;state.page=1;render();});sourceTabs.forEach(function(tab){tab.addEventListener('click',function(){state.source=tab.getAttribute('data-source')||'';state.page=1;sourceTabs.forEach(function(other){other.classList.toggle('is-current',other===tab);});render();});});reset.addEventListener('click',function(){search.value='';category.value='';state.query='';state.category='';state.source='';state.page=1;sourceTabs.forEach(function(tab){tab.classList.toggle('is-current',(tab.getAttribute('data-source')||'')==='');});render();search.focus();});retry.addEventListener('click',load);load();
})();
