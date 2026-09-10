(function(){
  'use strict';
  if(!window.StudioAPI||!StudioAPI.requireAuth())return;

  var state={items:[],query:'',category:''};
  var grid=document.getElementById('resources-grid');
  var loading=document.getElementById('resources-loading');
  var empty=document.getElementById('resources-empty');
  var errorBox=document.getElementById('resources-error');
  var count=document.getElementById('resources-count');
  var search=document.getElementById('resources-search');
  var category=document.getElementById('resources-category');
  var reset=document.getElementById('resources-reset');
  var retry=document.getElementById('resources-retry');

  function normalize(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }
  function formatDate(value){
    if(!value)return '';
    var date=new Date(value);
    if(Number.isNaN(date.getTime()))return '';
    return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(date);
  }
  function safeUrl(value){
    try{
      var url=new URL(value);
      return /^https?:$/.test(url.protocol)?url.href:'';
    }catch(e){return '';}
  }
  function el(tag,className,text){
    var node=document.createElement(tag);
    if(className)node.className=className;
    if(text!=null)node.textContent=text;
    return node;
  }
  function card(item,index){
    var article=el('article','resource-card');
    var link=safeUrl(item.link);
    var image=safeUrl(item.image);
    if(image){
      var media=el('a','resource-card-media');
      media.href=link;media.target='_blank';media.rel='noopener';media.setAttribute('aria-label','Lire : '+item.title);
      var img=document.createElement('img');
      img.src=image;img.alt='';img.loading=index<3?'eager':'lazy';img.decoding='async';
      img.addEventListener('error',function(){media.classList.add('is-image-error');img.remove();});
      media.appendChild(img);article.appendChild(media);
    }else{
      var fallback=el('a','resource-card-media resource-card-media-fallback');
      fallback.href=link;fallback.target='_blank';fallback.rel='noopener';fallback.setAttribute('aria-label','Lire : '+item.title);
      fallback.innerHTML='<span>Me<span>&</span>YouToo</span>';
      article.appendChild(fallback);
    }
    var body=el('div','resource-card-body');
    var meta=el('div','resource-card-meta');
    if(item.categories&&item.categories[0])meta.appendChild(el('span','resource-category',item.categories[0]));
    var date=formatDate(item.publishedAt);if(date)meta.appendChild(el('time','resource-date',date));
    body.appendChild(meta);
    var title=el('h3','resource-card-title');
    var titleLink=el('a','',item.title);titleLink.href=link;titleLink.target='_blank';titleLink.rel='noopener';
    title.appendChild(titleLink);body.appendChild(title);
    if(item.excerpt)body.appendChild(el('p','resource-card-excerpt',item.excerpt));
    var footer=el('div','resource-card-footer');
    if(item.author)footer.appendChild(el('span','resource-author','Par '+item.author));
    var read=el('a','resource-read-link','Lire l’article');read.href=link;read.target='_blank';read.rel='noopener';read.innerHTML='Lire l’article <span aria-hidden="true">↗</span>';
    footer.appendChild(read);body.appendChild(footer);article.appendChild(body);
    return article;
  }
  function filteredItems(){
    var q=normalize(state.query);
    var cat=normalize(state.category);
    return state.items.filter(function(item){
      var hay=normalize([item.title,item.excerpt,item.author].concat(item.categories||[]).join(' '));
      var cats=(item.categories||[]).map(normalize);
      return (!q||hay.includes(q))&&(!cat||cats.includes(cat));
    });
  }
  function render(){
    var items=filteredItems();
    grid.innerHTML='';
    items.forEach(function(item,index){grid.appendChild(card(item,index));});
    grid.hidden=items.length===0;
    empty.hidden=items.length!==0;
    count.textContent=items.length+(items.length>1?' ressources':' ressource');
  }
  function fillCategories(){
    var values=[];
    state.items.forEach(function(item){(item.categories||[]).forEach(function(cat){if(cat&&!values.some(function(v){return normalize(v)===normalize(cat);}))values.push(cat);});});
    values.sort(function(a,b){return a.localeCompare(b,'fr',{sensitivity:'base'});});
    values.forEach(function(value){var option=document.createElement('option');option.value=value;option.textContent=value;category.appendChild(option);});
  }
  async function load(){
    loading.hidden=false;loading.setAttribute('aria-busy','true');grid.hidden=true;empty.hidden=true;errorBox.hidden=true;count.textContent='';
    try{
      var data=await StudioAPI.request('/api/resources?limit=30');
      state.items=Array.isArray(data&&data.items)?data.items:[];
      category.innerHTML='<option value="">Toutes les thématiques</option>';
      fillCategories();
      loading.hidden=true;loading.setAttribute('aria-busy','false');
      render();
    }catch(err){
      console.error('Chargement ressources',err);
      loading.hidden=true;loading.setAttribute('aria-busy','false');errorBox.hidden=false;
    }
  }
  var debounce;
  search.addEventListener('input',function(){clearTimeout(debounce);debounce=setTimeout(function(){state.query=search.value.trim();render();},120);});
  category.addEventListener('change',function(){state.category=category.value;render();});
  reset.addEventListener('click',function(){search.value='';category.value='';state.query='';state.category='';render();search.focus();});
  retry.addEventListener('click',load);
  load();
})();
