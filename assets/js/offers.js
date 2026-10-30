// Vitrine des offres Me&YouToo : page publique (index.html#offres), espace client et gestion admin (offres.html).
(function(){
  'use strict';
  var root=document.querySelector('[data-offers-root]');
  if(!root)return;
  var mode=root.getAttribute('data-offers-root'); // public | studio
  var user=null;
  try{user=window.StudioAPI&&StudioAPI.user?StudioAPI.user():null;}catch(e){}
  var isAdmin=mode==='studio'&&Boolean(user&&user.role==='admin')&&new URLSearchParams(location.search).get('audience')!=='client';
  var isClient=mode==='studio'&&Boolean(user&&user.role==='client');
  var state={offers:[],categories:{},catalogues:{},hubspotCategories:[],filter:''};

  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  // Le site public n’a que public.css (.btn), le Studio a style.css (.button).
  function cls(kind){return mode==='public'?'btn '+(kind==='primary'?'primary':'secondary'):'button button-'+kind;}
  function safeUrl(v){try{var u=new URL(v);return u.protocol==='https:'?u.href:'';}catch(e){return '';}}
  function apiBase(){if(window.STUDIO_API_BASE)return String(window.STUDIO_API_BASE).replace(/\/$/,'');var host=String(location.hostname||'').toLowerCase(),path=String(location.pathname||'').toLowerCase();var staging=host==='localhost'||host==='127.0.0.1'||host.includes('staging')||path.includes('/studio-meandyoutoo-staging/');return staging?'https://studio-meandyoutoo-api-staging.osc-fr1.scalingo.io':'https://studio-meandyoutoo-api.osc-fr1.scalingo.io';}
  function load(){
    if(mode==='public')return fetch(apiBase()+'/api/public/offers').then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();});
    return StudioAPI.request(isAdmin?'/api/admin/offers':'/api/offers');
  }

  function card(o){
    var cat=state.categories[o.category]||{label:o.category,icon:'•'};
    var meta=[o.format,o.duration].filter(Boolean).map(esc).join(' · ');
    var url=safeUrl(o.url),catalogue=safeUrl(o.catalogue_url);
    var ask=mode==='public'
      ?'<a class="'+cls('primary')+' offer-ask" href="contact.html">Demander des informations</a>'
      :(isClient?'<button type="button" class="button button-primary offer-ask" data-offer-ask="'+esc(o.id)+'">Demander des informations</button>':'');
    var adminTools=isAdmin?'<div class="offer-admin"><span class="offer-status '+(o.published?'is-on':'is-off')+'">'+(o.published?'Publiée':'Masquée')+'</span>'+(o.hubspot_category?'<span class="offer-status is-hs" title="Catégorie de produit HubSpot">HubSpot : '+esc(o.hubspot_category)+'</span>':'')+'<button type="button" class="button button-ghost" data-offer-edit="'+esc(o.id)+'">Modifier</button><button type="button" class="button button-ghost" data-offer-archive="'+esc(o.id)+'">Retirer</button></div>':'';
    return '<article class="offer-card cat-'+esc(o.category)+(isAdmin&&!o.published?' is-hidden-offer':'')+'">'+
      '<p class="offer-cat"><span aria-hidden="true">'+esc(cat.icon)+'</span> '+esc(cat.label)+'</p>'+
      '<h3>'+esc(o.title)+'</h3>'+(o.summary?'<p class="offer-summary">'+esc(o.summary)+'</p>':'')+
      (meta?'<p class="offer-meta">'+meta+'</p>':'')+
      '<div class="offer-actions">'+ask+
        (catalogue?'<a class="'+cls('secondary')+'" href="'+esc(catalogue)+'" target="_blank" rel="noopener">Voir le catalogue ↗</a>':'')+
        (url?'<a class="offer-link" href="'+esc(url)+'" target="_blank" rel="noopener">En savoir plus ↗</a>':'')+
      '</div>'+adminTools+'</article>';
  }

  function render(){
    var used=Object.keys(state.categories).filter(function(k){return state.offers.some(function(o){return o.category===k;});});
    var list=state.offers.filter(function(o){return !state.filter||o.category===state.filter;});
    var chips='<div class="offer-filters" role="group" aria-label="Filtrer les offres"><button type="button" class="offer-chip'+(state.filter?'':' is-current')+'" data-offer-filter="">Toutes</button>'+
      used.map(function(k){var c=state.categories[k];return '<button type="button" class="offer-chip'+(state.filter===k?' is-current':'')+'" data-offer-filter="'+esc(k)+'"><span aria-hidden="true">'+esc(c.icon)+'</span> '+esc(c.label)+'</button>';}).join('')+'</div>';
    var catalogues='';
    if(state.catalogues.conferences||state.catalogues.formations){
      catalogues='<div class="offer-catalogues"><span>📘 Nos catalogues 2026 :</span>'+
        (safeUrl(state.catalogues.conferences)?'<a href="'+esc(state.catalogues.conferences)+'" target="_blank" rel="noopener">Conférences ↗</a>':'')+
        (safeUrl(state.catalogues.formations)?'<a href="'+esc(state.catalogues.formations)+'" target="_blank" rel="noopener">Formations ↗</a>':'')+'</div>';
    }else if(mode==='public'){
      // Les catalogues sont réservés aux clients connectés : l'API publique ne les transmet pas.
      catalogues='<div class="offer-catalogues"><span>📘 Nos catalogues détaillés de conférences et de formations sont réservés à nos clients.</span><a href="login.html">Se connecter à l’espace client →</a></div>';
    }
    var adminBar=isAdmin?'<div class="offer-admin-bar"><button type="button" class="button button-primary" data-offer-new>＋ Ajouter une offre</button><span>Les offres masquées n’apparaissent ni sur le site public ni chez les clients.</span></div>':'';
    root.innerHTML=adminBar+catalogues+chips+'<div class="offer-grid">'+(list.map(card).join('')||'<p class="offer-empty">Aucune offre dans cette catégorie.</p>')+'</div>'+(isAdmin?'<div id="offer-requests"></div>':'');
    if(isAdmin)loadRequests();
  }

  function fail(){root.innerHTML='<p class="offer-empty">Nos offres sont momentanément indisponibles. <a href="https://meandyoutoo.app/fr/" target="_blank" rel="noopener">Les découvrir sur meandyoutoo.app ↗</a></p>';}
  function refresh(){return load().then(function(d){state.offers=d.offers||[];state.categories=d.categories||{};state.catalogues=d.catalogues||{};state.hubspotCategories=d.hubspotCategories||[];render();}).catch(fail);}

  async function ask(id){
    var o=state.offers.find(function(x){return String(x.id)===String(id);});if(!o)return;
    var message=await window.StudioModal.prompt({eyebrow:'Demande d’information',title:o.title,
      message:'L’équipe Me&YouToo vous recontacte rapidement. Vous pouvez préciser votre besoin (facultatif).',
      inputLabel:'Votre message',placeholder:'Ex. : public visé, période envisagée, nombre de participants…',confirmLabel:'Envoyer ma demande'});
    if(message===null)return;
    try{
      var r=await StudioAPI.request('/api/offer-requests',{method:'POST',body:JSON.stringify({offerId:o.id,source:'offers',message:message})});
      await window.StudioModal.alert({eyebrow:o.title,title:'Demande transmise',type:'success',message:r.message||'Votre demande a bien été transmise.'});
    }catch(e){await window.StudioModal.alert({title:'Envoi impossible',message:e.message||'Réessayez dans quelques instants.'});}
  }

  // ── Gestion admin ──
  function field(name,label,value,opts){opts=opts||{};
    var input=opts.area?'<textarea name="'+name+'" rows="3">'+esc(value)+'</textarea>'
      :opts.select?'<select name="'+name+'">'+opts.select.map(function(k){return '<option value="'+esc(k)+'"'+(k===value?' selected':'')+'>'+esc(state.categories[k].label)+'</option>';}).join('')+'</select>'
      :'<input name="'+name+'" value="'+esc(value)+'"'+(opts.placeholder?' placeholder="'+esc(opts.placeholder)+'"':'')+'>';
    return '<label class="offer-field"><span>'+label+'</span>'+input+'</label>';
  }
  function edit(id){
    var o=id?state.offers.find(function(x){return String(x.id)===String(id);}):{category:'formation',published:true,themes:[]};
    if(!o)return;
    var dlg=document.createElement('dialog');dlg.className='offer-dialog';
    dlg.innerHTML='<form method="dialog"><h2>'+(id?'Modifier l’offre':'Nouvelle offre')+'</h2>'+
      field('title','Titre',o.title||'')+field('category','Catégorie',o.category,{select:Object.keys(state.categories)})+
      field('summary','Description courte',o.summary||'',{area:true})+
      '<div class="offer-field-row">'+field('format','Format',o.format||'',{placeholder:'Présentiel ou distanciel'})+field('duration','Durée',o.duration||'',{placeholder:'3 h à 7 h'})+'</div>'+
      field('themes','Thématiques (séparées par des virgules)',(o.themes||[]).join(', '),{placeholder:'sexisme, handicap'})+
      field('url','Lien « En savoir plus » (https://…)',o.url||'')+
      '<label class="offer-field"><span>Catégorie de produit HubSpot (transaction)</span><select name="hubspotCategory"><option value="">— Aucune —</option>'+state.hubspotCategories.map(function(c){return '<option value="'+esc(c)+'"'+(c===o.hubspot_category?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select></label>'+field('catalogueUrl','Lien du catalogue (https://…)',o.catalogue_url||'')+
      '<label class="offer-check"><input type="checkbox" name="published"'+(o.published!==false?' checked':'')+'> Publiée (visible sur le site public et chez les clients)</label>'+
      '<p class="offer-form-error" hidden></p><div class="offer-dialog-actions"><button type="button" class="button button-ghost" value="cancel">Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),err=dlg.querySelector('.offer-form-error');
    dlg.querySelector('[value=cancel]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    form.onsubmit=async function(ev){ev.preventDefault();
      var f=new FormData(form),body={title:f.get('title'),category:f.get('category'),summary:f.get('summary'),format:f.get('format'),duration:f.get('duration'),
        themes:String(f.get('themes')||''),url:f.get('url'),catalogueUrl:f.get('catalogueUrl'),hubspotCategory:f.get('hubspotCategory'),published:f.get('published')==='on',position:o.position||0};
      try{await StudioAPI.request(id?'/api/admin/offers/'+encodeURIComponent(id):'/api/admin/offers',{method:id?'PATCH':'POST',body:JSON.stringify(body)});dlg.close();refresh();}
      catch(e){err.textContent=e.message||'Enregistrement impossible';err.hidden=false;}
    };
    dlg.showModal();
  }
  async function archive(id){
    var o=state.offers.find(function(x){return String(x.id)===String(id);});if(!o)return;
    var ok=await window.StudioModal.confirm({eyebrow:'Offres',title:'Retirer « '+o.title+' » ?',message:'L’offre disparaît du site public et de l’espace client. Les demandes déjà reçues sont conservées.',confirmLabel:'Retirer l’offre'});
    if(!ok)return;
    try{await StudioAPI.request('/api/admin/offers/'+encodeURIComponent(id),{method:'DELETE'});refresh();}catch(e){window.StudioModal.alert({title:'Action impossible',message:e.message});}
  }
  function loadRequests(){
    var box=document.getElementById('offer-requests');if(!box)return;
    StudioAPI.request('/api/admin/offer-requests').then(function(d){
      var rows=(d.requests||[]).map(function(r){
        var who=[r.first_name,r.last_name].filter(Boolean).join(' ')||r.email||'';
        return '<tr><td>'+esc(new Date(r.created_at).toLocaleDateString('fr-FR'))+'</td><td><a href="client.html?organizationId='+encodeURIComponent(r.organization_id||'')+'">'+esc(r.organization_name||'—')+'</a></td><td>'+esc(who)+(r.email?'<br><small>'+esc(r.email)+'</small>':'')+'</td><td>'+esc(r.offer_title||'Accompagnement')+'</td><td>'+esc(r.message||'')+'</td></tr>';
      }).join('');
      box.innerHTML='<h2 class="offer-requests-title">Demandes reçues</h2>'+(rows?'<div class="offer-table-wrap"><table class="offer-table"><thead><tr><th>Date</th><th>Client</th><th>Contact</th><th>Offre</th><th>Message</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="offer-empty">Aucune demande pour le moment.</p>');
    }).catch(function(){box.innerHTML='';});
  }

  root.addEventListener('click',function(ev){
    var t=ev.target.closest('button');if(!t)return;
    if(t.hasAttribute('data-offer-filter')){state.filter=t.getAttribute('data-offer-filter');render();}
    else if(t.hasAttribute('data-offer-ask'))ask(t.getAttribute('data-offer-ask'));
    else if(t.hasAttribute('data-offer-new'))edit(null);
    else if(t.hasAttribute('data-offer-edit'))edit(t.getAttribute('data-offer-edit'));
    else if(t.hasAttribute('data-offer-archive'))archive(t.getAttribute('data-offer-archive'));
  });
  refresh();
})();
