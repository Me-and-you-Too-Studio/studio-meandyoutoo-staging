(function(){
  const root=document.getElementById('library-topics');
  const search=document.getElementById('search-topic');
  const scopeFilter=document.getElementById('filter-scope');
  const localeFilter=document.getElementById('filter-locale');
  const reset=document.getElementById('reset-library-filters');
  const themeCount=document.getElementById('library-theme-count');
  if(!root)return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').trim().toLowerCase().replaceAll('_','-');
  const uniq=items=>[...new Set(items.filter(Boolean))];

  const known={
    sexisme:'theme-sexisme.html',handicap:'theme-handicap.html',lgbt:'theme-lgbt.html',
    origines:'theme-origines.html',religion:'theme-religion.html',
    intergenerationnel:'theme-intergenerationnel.html',management:'theme-management.html',
    'collegue-inclusif':'theme-collaborateur.html',mixite:'theme.html?theme=mixite'
  };

  const shortTitles={
    sexisme:'Sexisme',handicap:'Handicap',lgbt:'LGBT+',origines:'Diversité des origines',
    religion:'Laïcité & diversité religieuse',intergenerationnel:'Intergénérationnel',
    management:'Management inclusif','collegue-inclusif':'Collègue inclusif',mixite:'Mixité',
    'harcelement-moral':'Harcèlement moral'
  };

  const fallbackDescriptions={
    management:'Équité, reconnaissance, décisions, feedback et coopération au quotidien.',
    sexisme:'Stéréotypes, micro-agressions, comportements sexistes et prévention.',
    handicap:"Recrutement, intégration, accessibilité et maintien dans l'emploi.",
    origines:'Préjugés, représentations, équité et inclusion au quotidien.',
    lgbt:'Inclusion, expressions de soi, alliances et discriminations ordinaires.',
    religion:'Comprendre, respecter la neutralité et gérer les situations sensibles.',
    intergenerationnel:'Coopération, transmission et représentations entre générations.',
    'collegue-inclusif':'Comportements du quotidien, coopération, vigilance et posture inclusive.',
    mixite:'Stéréotypes de genre, équité, autocensure, micro-agressions et pratiques qui favorisent concrètement la mixité au travail.',
    'harcelement-moral':'Repérer les comportements toxiques, micro-agressions et signaux d’alerte pour adopter les bons réflexes.'
  };

  // Ces bases garantissent une bibliothèque utile si l’API est momentanément indisponible.
  // Les capacités réelles (langues/périmètres) sont ensuite enrichies depuis /variants.
  const plannedThemes=[
    {slug:'sexisme',title:'Compréhension du sexisme',description:fallbackDescriptions.sexisme,situation_count:27,chapter_count:4,library_situation_count:16,country_codes:['FR'],available_locales:['fr','en','es']},
    {slug:'lgbt',title:'LGBT+',description:fallbackDescriptions.lgbt,situation_count:24,chapter_count:4,library_situation_count:0,country_codes:['FR'],available_locales:['fr','en']},
    {slug:'intergenerationnel',title:'Intergénérationnel',description:fallbackDescriptions.intergenerationnel,situation_count:29,chapter_count:5,library_situation_count:0,country_codes:['FR'],available_locales:['fr','en']},
    {slug:'management',title:'Management inclusif',description:fallbackDescriptions.management,situation_count:62,chapter_count:6,library_situation_count:0,country_codes:['FR'],available_locales:['fr']},
    {slug:'collegue-inclusif',title:'Êtes-vous un·e collègue inclusif·ve ?',description:fallbackDescriptions['collegue-inclusif'],situation_count:208,chapter_count:4,library_situation_count:0,cultural_scopes:['worldwide'],available_locales:['fr','en']},
    {slug:'mixite',title:'Alliés de la mixité',description:fallbackDescriptions.mixite,situation_count:34,chapter_count:5,library_situation_count:0,cultural_scopes:['europe'],available_locales:['fr','en','es','it']}
  ];

  const localeNames={
    fr:'Français',en:'Anglais',es:'Espagnol',de:'Allemand',it:'Italien',pt:'Portugais',br:'Portugais (Brésil)',
    bg:'Bulgare',ar:'Arabe',ja:'Japonais','ko-kr':'Coréen',ko:'Coréen',zh:'Chinois traditionnel',zf:'Chinois simplifié',
    nl:'Néerlandais','nl-be':'Néerlandais (Belgique)',pl:'Polonais',ro:'Roumain',ru:'Russe','sv-se':'Suédois',sv:'Suédois',
    tr:'Turc',cs:'Tchèque',sk:'Slovaque',id:'Indonésien'
  };
  const countryNames={
    AR:'Argentine',AT:'Autriche',BR:'Brésil',CA:'Canada',CH:'Suisse',CL:'Chili',CN:'Chine',DE:'Allemagne',DK:'Danemark',
    ES:'Espagne',FR:'France',HK:'Hong Kong',JP:'Japon',KR:'Corée du Sud',MX:'Mexique',NO:'Norvège',PA:'Panama',PT:'Portugal',
    SE:'Suède',TW:'Taïwan',US:'États-Unis',UY:'Uruguay',BE:'Belgique',GB:'Royaume-Uni',IT:'Italie',NL:'Pays-Bas',PL:'Pologne',
    RO:'Roumanie',RU:'Russie',TR:'Turquie',BG:'Bulgarie',AU:'Australie',IN:'Inde',SG:'Singapour'
  };
  const scopeNames={
    worldwide:'International / Worldwide',international:'International / Worldwide',global:'International / Worldwide',
    europe:'Europe',asia:'Asie',asie:'Asie','north-america':'Amérique du Nord','south-america':'Amérique du Sud',
    africa:'Afrique',middleeast:'Moyen-Orient','middle-east':'Moyen-Orient',oceania:'Océanie'
  };

  let themes=[];
  const href=t=>known[norm(t.slug)]||('theme.html?theme='+encodeURIComponent(t.slug));
  const locales=t=>uniq((Array.isArray(t.available_locales)?t.available_locales:[]).map(norm));
  const scopes=t=>uniq((Array.isArray(t.cultural_scopes)?t.cultural_scopes:[]).map(norm));
  const countries=t=>uniq((Array.isArray(t.country_codes)?t.country_codes:[]).map(x=>String(x||'').toUpperCase()));
  const localeLabel=x=>(localeNames[norm(x)]||String(x).toUpperCase())+' ('+String(x).toUpperCase()+')';
  const scopeLabel=x=>scopeNames[norm(x)]||String(x).replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
  const countryLabel=x=>countryNames[String(x).toUpperCase()]||String(x).toUpperCase();
  const displayTitle=t=>shortTitles[norm(t.slug)]||t.title||'Thématique D&I';
  const description=t=>t.description||fallbackDescriptions[norm(t.slug)]||'Une thématique issue du référentiel propriétaire Me&YouToo.';
  const themeTags=t=>uniq((Array.isArray(t.admin_tags)?t.admin_tags:[]).map(x=>String(x||'').trim()));

  const illustrationFile=slug=>{
    const key=norm(slug);
    const special={'collegue-inclusif':'theme-collaborateur.png',mixite:'composer.png',handicap:'resources.png','harcelement-moral':'theme-religion.png'};
    return special[key]||`theme-${key}.png`;
  };

  function mergeTheme(base,live){
    const out={...(base||{}),...(live||{})};
    if(!out.description)out.description=base?.description||fallbackDescriptions[norm(out.slug)]||'Une thématique issue du référentiel propriétaire Me&YouToo.';
    if(!Array.isArray(out.available_locales)||!out.available_locales.length)out.available_locales=base?.available_locales||[];
    if(!Array.isArray(out.country_codes)||!out.country_codes.length)out.country_codes=base?.country_codes||[];
    if(!Array.isArray(out.cultural_scopes)||!out.cultural_scopes.length)out.cultural_scopes=base?.cultural_scopes||[];
    if(out.library_situation_count==null)out.library_situation_count=base?.library_situation_count||0;
    if(out.catalog_situation_count==null&&out.situation_count!=null)out.catalog_situation_count=out.situation_count;
    return out;
  }

  function updateThemeCount(){
    if(themeCount)themeCount.textContent=String(new Set(themes.map(t=>norm(t.slug)).filter(Boolean)).size);
  }

  function chips(items,formatter,max=3){
    if(!items.length)return '<span class="topic-chip is-muted">Non renseigné</span>';
    const shown=items.slice(0,max);
    return shown.map(x=>`<span class="topic-chip">${esc(formatter(x))}</span>`).join('')+
      (items.length>max?`<span class="topic-chip topic-chip-more">+${items.length-max}</span>`:'');
  }

  async function enrichThemeCapabilities(theme){
    try{
      const data=await StudioAPI.request('/api/catalog/themes/'+encodeURIComponent(theme.slug)+'/variants');
      const extraLocales=uniq([
        ...(Array.isArray(data.availableLocales)?data.availableLocales:[]),
        ...(Array.isArray(data.variants)?data.variants.flatMap(v=>Array.isArray(v.locales)?v.locales:[]):[]),
        ...(Array.isArray(data.chapterCapabilities)?data.chapterCapabilities.flatMap(c=>Array.isArray(c.locales)?c.locales:[]):[])
      ].map(norm));
      const extraCountries=uniq([
        ...(Array.isArray(data.countryCodes)?data.countryCodes:[]),
        ...(Array.isArray(data.variants)?data.variants.map(v=>v.countryCode):[])
      ].map(x=>String(x||'').toUpperCase()));
      const extraScopes=[];
      if((data.variants||[]).some(v=>norm(v.culturalScope)==='worldwide')||(data.chapterCapabilities||[]).some(c=>c.worldwide))extraScopes.push('worldwide');
      return {
        ...theme,
        available_locales:uniq([...locales(theme),...extraLocales]),
        country_codes:uniq([...countries(theme),...extraCountries]),
        cultural_scopes:uniq([...scopes(theme),...extraScopes])
      };
    }catch(_){
      return theme;
    }
  }

  function fillFilters(){
    const allScopes=uniq([
      ...themes.flatMap(t=>scopes(t).map(x=>'scope:'+x)),
      ...themes.flatMap(t=>countries(t).map(x=>'country:'+x))
    ]);
    scopeFilter.innerHTML='<option value="">Tous les périmètres</option>';
    const broad=allScopes.filter(x=>x.startsWith('scope:')).sort((a,b)=>scopeLabel(a.slice(6)).localeCompare(scopeLabel(b.slice(6)),'fr'));
    const nations=allScopes.filter(x=>x.startsWith('country:')).sort((a,b)=>countryLabel(a.slice(8)).localeCompare(countryLabel(b.slice(8)),'fr'));
    if(broad.length){
      const g=document.createElement('optgroup');g.label='Zones culturelles';
      broad.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=scopeLabel(v.slice(6));g.appendChild(o)});
      scopeFilter.appendChild(g);
    }
    if(nations.length){
      const g=document.createElement('optgroup');g.label='Pays';
      nations.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=countryLabel(v.slice(8));g.appendChild(o)});
      scopeFilter.appendChild(g);
    }
    const langs=uniq(themes.flatMap(locales)).sort((a,b)=>localeLabel(a).localeCompare(localeLabel(b),'fr'));
    localeFilter.innerHTML='<option value="">Toutes les langues</option>'+langs.map(x=>`<option value="${esc(x)}">${esc(localeLabel(x))}</option>`).join('');
  }

  function themeMarkup(t){
    const loc=locales(t),sc=scopes(t),co=countries(t),tags=themeTags(t);
    const cat=Number(t.catalog_situation_count??t.situation_count??0);
    const lib=Number(t.library_situation_count||0);
    const fullTitle=String(t.title||'').trim();
    const short=displayTitle(t);
    const perimeterItems=[...sc.map(x=>({type:'scope',value:x})),...co.map(x=>({type:'country',value:x}))];
    const perimeterFormatter=item=>item.type==='scope'?scopeLabel(item.value):countryLabel(item.value);
    const diagnosticLine=fullTitle&&fullTitle!==short?`<p class="topic-diagnostic-title"><span>Diagnostic</span><strong>${esc(fullTitle)}</strong></p>`:'';
    return `<details class="card topic-card topic-card-accordion" data-theme="${esc(norm(t.slug))}">
      <summary class="topic-summary">
        <div class="topic-thumb"><img src="assets/img/illustrations/${esc(illustrationFile(t.slug))}" alt="" onerror="this.closest('.topic-thumb').classList.add('is-empty');this.remove()"></div>
        <div class="topic-summary-copy">
          <div class="topic-summary-heading"><h3>${esc(short)}</h3><span class="topic-chevron" aria-hidden="true">⌄</span></div>
          <p>${esc(description(t))}</p>
          <div class="topic-summary-meta">
            <span>${Number(t.chapter_count||0)} chapitres</span>
            <span>${cat} situations</span>
            ${loc.length?`<span>${loc.length} langue${loc.length>1?'s':''}</span>`:''}
          </div>
        </div>
      </summary>
      <div class="topic-expanded">
        ${diagnosticLine}
        ${tags.length?`<div class="topic-business-tags" aria-label="Tags métier">${tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>`:''}
        <div class="topic-expanded-grid">
          <div class="topic-detail-block"><strong>Périmètres disponibles</strong><div class="topic-chip-list">${chips(perimeterItems,perimeterFormatter,4)}</div></div>
          <div class="topic-detail-block"><strong>Langues disponibles</strong><div class="topic-chip-list">${chips(loc,localeLabel,6)}</div></div>
        </div>
        <div class="topic-content-split">
          <div class="topic-content-count is-catalog"><span>Catalogue</span><strong>${cat}</strong><small>situations de référence</small></div>
          <div class="topic-content-count is-library"><span>Bibliothèque</span><strong>${lib}</strong><small>situations complémentaires</small></div>
        </div>
        <div class="topic-expanded-actions"><a class="button button-secondary" href="${href(t)}">Découvrir la thématique</a></div>
      </div>
    </details>`;
  }

  function render(){
    const q=norm(search?.value),sf=scopeFilter?.value||'',lf=norm(localeFilter?.value);
    const filtered=themes.filter(t=>{
      const scopeOk=!sf||(sf.startsWith('scope:')?scopes(t).includes(sf.slice(6)):countries(t).includes(sf.slice(8)));
      const langOk=!lf||locales(t).includes(lf);
      const hay=[displayTitle(t),t.title,description(t),t.slug,...themeTags(t),...scopes(t).map(scopeLabel),...countries(t).map(countryLabel),...locales(t).flatMap(x=>[x,localeLabel(x)])].join(' ').toLowerCase();
      return scopeOk&&langOk&&(!q||hay.includes(q));
    });
    if(reset)reset.hidden=!(q||sf||lf);
    root.innerHTML=filtered.map(themeMarkup).join('')||'<article class="card library-no-result"><h3>Aucune thématique disponible</h3><p>Aucune thématique ne correspond à ces critères. Modifiez le périmètre ou la langue.</p></article>';

    root.querySelectorAll('details.topic-card-accordion').forEach(details=>{
      details.addEventListener('toggle',()=>{
        if(!details.open)return;
        root.querySelectorAll('details.topic-card-accordion[open]').forEach(other=>{if(other!==details)other.open=false;});
      });
    });
  }

  async function load(){
    try{
      const data=await StudioAPI.request('/api/catalog/themes');
      const live=new Map((data.themes||[]).map(t=>[norm(t.slug),t]));
      themes=plannedThemes.map(base=>mergeTheme(base,live.get(norm(base.slug))));
      for(const t of data.themes||[])if(!themes.some(x=>norm(x.slug)===norm(t.slug)))themes.push(mergeTheme({slug:norm(t.slug)},t));
      themes=await Promise.all(themes.map(enrichThemeCapabilities));
    }catch(_){
      themes=plannedThemes.slice();
    }
    updateThemeCount();
    fillFilters();
    render();
  }

  [search,scopeFilter,localeFilter].forEach(el=>el&&el.addEventListener(el===search?'input':'change',render));
  if(reset)reset.addEventListener('click',()=>{search.value='';scopeFilter.value='';localeFilter.value='';render()});
  load();
})();
