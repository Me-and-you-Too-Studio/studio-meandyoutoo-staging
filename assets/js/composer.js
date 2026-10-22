(() => {
  const params = new URLSearchParams(location.search);
  const themeSlug = params.get('theme') || 'sexisme';
  let projectId = params.get('projectId') || '';
  const requestedChapter = Math.max(0, Number(params.get('chapter')||0));
  const requestedSituation = params.get('situation') || '';
  const requestedAnswer = params.get('answer') || '';
  const requestedCountry = String(params.get('countryCode')||'').trim().toUpperCase();
  const requestedLocale = String(params.get('locale')||'').trim().toLowerCase().replaceAll('_','-');
  const state = { chapters: [], active: requestedChapter, project: null, country: requestedCountry, locale: requestedLocale||'fr', composerCountryLocales:{}, library: [], libraryMode: 'add', replaceId: '', translationContexts:new Map(), libraryAvailability:new Map(), collapsedSituations:new Set(), expandedSituations:new Set(requestedSituation?[String(requestedSituation)]:[]), expandedAnswers:new Set(requestedAnswer&&requestedSituation?[String(requestedSituation)]:[]) };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canonical = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const api = (path, options={}) => window.StudioAPI.request(path, options);
  const currentUser = window.StudioAPI?.user?.() || {};
  const isAdmin = currentUser.role === 'admin' && (!window.StudioAPI?.interfaceMode || window.StudioAPI.interfaceMode() !== 'client');
  const campaignContextInfoText=`Ajouter un périmètre ou une langue conserve ce que vous avez déjà composé sur les autres périmètres. Retirer un périmètre supprime uniquement le contenu rattaché à ce pays dans la campagne.`;

  function infoDot(message,label='Informations importantes',floating=false){
    return `<span class="composer-info-wrap${floating?' composer-info-wrap-floating':''}"${floating?' data-floating-info':''}><button type="button" class="composer-info-dot" tabindex="0" aria-label="${esc(label)}" aria-expanded="false">i</button><span class="composer-info-bubble" role="tooltip">${esc(message)}</span></span>`;
  }

  function setupFloatingInfoTooltip(root){
    const wrap=root?.querySelector?.('[data-floating-info]');
    const button=wrap?.querySelector?.('.composer-info-dot');
    const source=wrap?.querySelector?.('.composer-info-bubble');
    if(!wrap||!button||!source)return ()=>{};

    const tooltip=document.createElement('div');
    const tooltipId=`composer-floating-tooltip-${Math.random().toString(36).slice(2)}`;
    tooltip.id=tooltipId;
    tooltip.className='composer-floating-info-tooltip';
    tooltip.setAttribute('role','tooltip');
    tooltip.textContent=source.textContent||'';
    document.body.appendChild(tooltip);
    button.setAttribute('aria-describedby',tooltipId);

    let clickPinned=false;
    const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
    const position=()=>{
      if(tooltip.hidden)return;
      const triggerRect=button.getBoundingClientRect();
      const modalRect=root.querySelector('.campaign-context-modal')?.getBoundingClientRect();
      const viewportWidth=document.documentElement.clientWidth;
      const viewportHeight=document.documentElement.clientHeight;
      const margin=16;
      const gap=10;
      const maxWidth=Math.min(420,viewportWidth-(margin*2));
      tooltip.style.maxWidth=`${maxWidth}px`;
      tooltip.style.width=`${maxWidth}px`;

      const tipRect=tooltip.getBoundingClientRect();
      const safeLeft=modalRect?Math.max(margin,modalRect.left+margin):margin;
      const safeRight=modalRect?Math.min(viewportWidth-margin,modalRect.right-margin):viewportWidth-margin;
      const availableWidth=Math.max(0,safeRight-safeLeft);
      if(availableWidth&&tipRect.width>availableWidth){
        tooltip.style.width=`${availableWidth}px`;
      }
      const measured=tooltip.getBoundingClientRect();
      const idealLeft=triggerRect.left+(triggerRect.width/2)-(measured.width/2);
      const maxLeft=Math.max(safeLeft,safeRight-measured.width);
      const left=clamp(idealLeft,safeLeft,maxLeft);
      const belowTop=triggerRect.bottom+gap;
      const aboveTop=triggerRect.top-gap-measured.height;
      const top=(belowTop+measured.height<=viewportHeight-margin||aboveTop<margin)?belowTop:aboveTop;
      tooltip.style.left=`${Math.round(left)}px`;
      tooltip.style.top=`${Math.round(Math.max(margin,top))}px`;
    };
    const show=()=>{
      tooltip.hidden=false;
      tooltip.classList.add('is-visible');
      button.setAttribute('aria-expanded','true');
      position();
    };
    const hide=(force=false)=>{
      if(clickPinned&&!force)return;
      clickPinned=false;
      tooltip.classList.remove('is-visible');
      tooltip.hidden=true;
      button.setAttribute('aria-expanded','false');
    };
    const onDocumentPointerDown=event=>{
      if(!wrap.contains(event.target)&&event.target!==tooltip)hide(true);
    };
    const onKeyDown=event=>{
      if(event.key==='Escape'&&!tooltip.hidden){
        hide(true);
        button.focus();
      }
    };
    const onViewportChange=()=>{if(!tooltip.hidden)position();};

    tooltip.hidden=true;
    button.addEventListener('mouseenter',show);
    button.addEventListener('mouseleave',()=>hide());
    button.addEventListener('focus',show);
    button.addEventListener('blur',()=>setTimeout(()=>hide(),0));
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      if(clickPinned){hide(true);return;}
      clickPinned=true;
      show();
    });
    document.addEventListener('pointerdown',onDocumentPointerDown,true);
    document.addEventListener('keydown',onKeyDown);
    window.addEventListener('resize',onViewportChange);
    window.addEventListener('scroll',onViewportChange,true);

    return ()=>{
      document.removeEventListener('pointerdown',onDocumentPointerDown,true);
      document.removeEventListener('keydown',onKeyDown);
      window.removeEventListener('resize',onViewportChange);
      window.removeEventListener('scroll',onViewportChange,true);
      tooltip.remove();
    };
  }

  function showMessage(message, tone='error') { const el=$('composer-alert'); el.hidden=false; el.textContent=message; el.dataset.tone=tone; }
  function totalSelected(){ return state.chapters.reduce((sum,ch)=>sum+ch.situations.length,0); }
  async function saveStep(step){ if(projectId) await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:step})}); }

  function normalizeCountryLocaleMap(raw){
    const normalize=list=>[...new Set((Array.isArray(list)?list:[]).map(locale=>String(locale||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
    const out={};
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
    Object.entries(raw).forEach(([country,list])=>{
      const code=String(country||'').trim().toUpperCase();
      const locales=normalize(list);
      if(code&&locales.length)out[code]=locales;
    });
    return out;
  }

  function rememberComposerContext(data){
    const map=normalizeCountryLocaleMap(data?.composer_context?.countryLocales);
    if(Object.keys(map).length)state.composerCountryLocales=map;
  }

  function projectContentLocales(project=state.project){
    const normalize=list=>[...new Set((Array.isArray(list)?list:[]).map(locale=>String(locale||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
    // Les langues de diffusion configurées priment sur les contenus conservés.
    if(isLegacyClientCampaign(project)){
      const configured=normalize(project?.locales);
      if(configured.length)return configured;
    }
    const locales=[];
    locales.push(...(Array.isArray(project?.locales)?project.locales:[]));
    if(project?.selected_locale)locales.push(project.selected_locale);
    if(!isLegacyClientCampaign(project)){
      locales.push(project?.working_locale||'fr');
      return normalize(locales);
    }
    locales.push(...(Array.isArray(project?.content_locales)?project.content_locales:[]));
    const intro=project?.introduction_variants_resolved&&typeof project.introduction_variants_resolved==='object'&&!Array.isArray(project.introduction_variants_resolved)?project.introduction_variants_resolved:{};
    locales.push(...Object.keys(intro));
    const socioByLocale=project?.sociodemo_language_variants_resolved&&typeof project.sociodemo_language_variants_resolved==='object'&&!Array.isArray(project.sociodemo_language_variants_resolved)?project.sociodemo_language_variants_resolved:{};
    locales.push(...Object.keys(socioByLocale));
    const collectVariantLocales=value=>{
      if(!value||typeof value!=='object'||Array.isArray(value))return;
      for(const [key,child] of Object.entries(value)){
        const norm=String(key||'').trim().toLowerCase().replaceAll('_','-');
        if(/^[a-z]{2}(?:-[a-z]{2})?$/.test(norm)&&Array.isArray(child))locales.push(norm);
        else if(child&&typeof child==='object'&&!Array.isArray(child))collectVariantLocales(child);
      }
    };
    collectVariantLocales(project?.sociodemo_variants);
    return normalize(locales);
  }

  function projectCountryLocales(project=state.project){
    const raw=normalizeCountryLocaleMap(project?.country_locales);
    const context=normalizeCountryLocaleMap(state.composerCountryLocales);
    const countries=campaignCountries(project);
    const normalize=list=>[...new Set((Array.isArray(list)?list:[]).map(locale=>String(locale||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
    const global=projectContentLocales(project);
    const out={};
    countries.forEach(code=>{
      const key=String(code||'').trim().toUpperCase();
      const explicit=normalize(raw[key]);
      const contextual=normalize(context[key]);
      // Un AD mono-périmètre peut être multilingue : dans ce cas, toutes les
      // langues réellement disponibles appartiennent à ce même périmètre.
      if(countries.length===1&&isLegacyClientCampaign(project)){
        out[key]=explicit.length?explicit:(contextual.length?contextual.filter(loc=>global.includes(loc)):global);
      }else{
        const resolved=explicit.length?explicit:contextual;
        out[key]=resolved.length?resolved:(countries.length===1?global:[]);
      }
    });
    return out;
  }

  async function switchLegacyLocale(locale){
    const next=String(locale||'').trim().toLowerCase().replaceAll('_','-');
    if(!next||next===state.locale||!projectId)return;
    state.locale=next;
    try{
      const query=new URLSearchParams();
      if(state.country)query.set('countryCode',state.country);
      query.set('locale',state.locale);
      const data=await api(`/api/projects/${projectId}/composer?${query.toString()}`);
      state.project=data.project;state.chapters=data.chapters;rememberComposerContext(data);
      state.active=Math.min(state.active,Math.max(0,state.chapters.length-1));
      state.translationContexts.clear();
      await preloadActiveTranslationContexts();
      renderCampaignContext();
      render();
      const url=new URL(location.href);url.searchParams.set('locale',state.locale);history.replaceState(null,'',url);
      showMessage(`Langue affichée : ${localeLabel(state.locale)}.`,'success');
    }catch(e){showMessage(`Impossible de charger ${localeLabel(state.locale)} : ${e.message}`);}
  }

  function renderCampaignContext(){
    const root=$('composer-campaign-context');if(!root)return;
    const readOnly=Boolean(window.STUDIO_COMPOSER_READ_ONLY||document.body.dataset.campaignReadOnly==='true');
    const legacy=isLegacyClientCampaign(state.project);
    if(readOnly||legacy){
      const names={fr:'Français',nl:'Néerlandais','nl-be':'Néerlandais Belgique',en:'Anglais',de:'Allemand',es:'Espagnol',it:'Italien',pt:'Portugais',br:'Portugais Brésil',bg:'Bulgare',ja:'Japonais','ko-kr':'Coréen',pl:'Polonais',ro:'Roumain',ru:'Russe','sv-se':'Suédois',tr:'Turc',zf:'Chinois simplifié',zh:'Chinois traditionnel',cs:'Tchèque',sk:'Slovaque',id:'Indonésien',ar:'Arabe'};
      const byCountry=projectCountryLocales(state.project);
      const countryLocales=state.country&&Array.isArray(byCountry[state.country])?byCountry[state.country]:[];
      const locales=[...new Set((countryLocales.length?countryLocales:projectContentLocales(state.project)).map(v=>String(v||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
      if(locales.length){
        if(!locales.includes(state.locale))state.locale=locales.includes('fr')?'fr':locales[0];
        root.hidden=false;
        root.style.display='';
        root.innerHTML=`<div class="theme-availability-pills"><strong>${legacy?'Langues de la campagne':'Langues disponibles'}</strong>${locales.map(loc=>`<button type="button" class="theme-availability-pill is-language ${loc===state.locale?'is-active':''}" data-composer-locale="${esc(loc)}" aria-pressed="${loc===state.locale?'true':'false'}">${esc(names[loc]||loc.toUpperCase())} (${esc(loc.toUpperCase())})</button>`).join('')}<small>${legacy?'Cliquez sur une langue pour afficher le contenu historique correspondant.':'Utilisez la mappemonde 🌐 sous chaque situation pour comparer les traductions.'}</small></div>`;
        root.querySelectorAll('[data-composer-locale]').forEach(button=>button.addEventListener('click',()=>switchLegacyLocale(button.dataset.composerLocale)));
        return;
      }
    }
    root.hidden=true;
    root.style.display='none';
    root.innerHTML='';
  }

  function campaignCountries(project=state.project){
    return [...new Set((Array.isArray(project?.countries)?project.countries:[])
      .concat(project?.selected_country_code?[project.selected_country_code]:[])
      .map(code=>String(code||'').trim().toUpperCase()).filter(Boolean))];
  }

  function isLegacyClientCampaign(project=state.project){
    return Boolean(project&&(
      project.source_type==='legacy_client' ||
      project.legacy_history===true ||
      project.legacy_source==='meayt-legacy' ||
      project.legacy_source==='cloned_legacy'
    ));
  }

  const countryNamesByNumericCode={'004':'Afghanistan','008':'Albanie','012':'Algérie','020':'Andorre','024':'Angola','031':'Azerbaïdjan','032':'Argentine','036':'Australie','040':'Autriche','048':'Bahreïn','050':'Bangladesh','056':'Belgique','068':'Bolivie','072':'Botswana','076':'Brésil','100':'Bulgarie','116':'Cambodge','120':'Cameroun','124':'Canada','140':'République centrafricaine','144':'Sri Lanka','152':'Chili','156':'Chine','158':'Taïwan','170':'Colombie','178':'Congo','188':'Costa Rica','191':'Croatie','196':'Chypre','203':'Tchéquie','208':'Danemark','214':'République dominicaine','218':'Équateur','233':'Estonie','246':'Finlande','250':'France','268':'Géorgie','276':'Allemagne','288':'Ghana','300':'Grèce','320':'Guatemala','324':'Guinée','332':'Haïti','344':'Hong Kong','348':'Hongrie','356':'Inde','360':'Indonésie','368':'Irak','372':'Irlande','376':'Israël','380':'Italie','384':"Côte d’Ivoire",'392':'Japon','398':'Kazakhstan','400':'Jordanie','404':'Kenya','410':'Corée du Sud','414':'Koweït','422':'Liban','428':'Lettonie','430':'Liberia','440':'Lituanie','442':'Luxembourg','450':'Madagascar','458':'Malaisie','466':'Mali','470':'Malte','480':'Maurice','484':'Mexique','492':'Monaco','498':'Moldavie','504':'Maroc','512':'Oman','528':'Pays-Bas','554':'Nouvelle-Zélande','566':'Nigeria','578':'Norvège','591':'Panama','600':'Paraguay','604':'Pérou','608':'Philippines','616':'Pologne','620':'Portugal','624':'Guinée-Bissau','634':'Qatar','642':'Roumanie','643':'Fédération de Russie','682':'Arabie saoudite','686':'Sénégal','688':'Serbie','694':'Sierra Leone','702':'Singapour','703':'Slovaquie','704':'Vietnam','710':'Afrique du Sud','724':'Espagne','752':'Suède','756':'Suisse','764':'Thaïlande','784':'Émirats arabes unis','788':'Tunisie','792':'Turquie','804':'Ukraine','818':'Égypte','826':'Royaume-Uni','834':'Tanzanie','840':'États-Unis','854':'Burkina Faso','858':'Uruguay'};
  function countryLabel(code){
    const key=String(code||'').trim().toUpperCase();
    if(countryNamesByNumericCode[key])return countryNamesByNumericCode[key];
    if(['UK','GB','826'].includes(key))return'Royaume-Uni';
    if(['WW','WORLDWIDE','INT','GLOBAL'].includes(key))return'International';
    if(key==='ASIA')return'Asie';
    try{return new Intl.DisplayNames(['fr'],{type:'region'}).of(key)||key;}catch(_){return key;}
  }

  function campaignCountryEntries(project=state.project){
    const byCountry=projectCountryLocales(project);
    const grouped=new Map();
    campaignCountries(project).forEach(code=>{
      const label=countryLabel(code);
      const key=label.toLocaleLowerCase('fr');
      const current=grouped.get(key)||{label,codes:[],locales:[]};
      current.codes.push(code);
      current.locales=[...new Set(current.locales.concat(byCountry[code]||[]))];
      grouped.set(key,current);
    });
    return [...grouped.values()].map(entry=>{
      const selected=entry.codes.includes(state.country);
      const numeric=entry.codes.find(code=>/^\d{3}$/.test(code));
      return {...entry,code:selected?state.country:(numeric||entry.codes[0])};
    }).sort((a,b)=>a.label.localeCompare(b.label,'fr',{sensitivity:'base'}));
  }

  function renderCountryTabs(project=state.project){
    const root=$('composer-country-tabs');if(!root)return;
    const countries=campaignCountries(project);
    const countryEntries=campaignCountryEntries(project);
    // Côté client, une campagne historique publiée reste consultable uniquement.
    // Côté admin Me&YouToo, le même contenu reste corrigeable comme toute campagne Studio.
    if(isLegacyClientCampaign(project)&&!isAdmin){
      if(!countries.length){root.hidden=true;root.style.display='none';root.innerHTML='';return;}
      const byCountry=projectCountryLocales(project);
      const label=countryLabel;
      const help=state.country
        ? `Périmètre historique consulté : ${esc(label(state.country))}.`
        : (countries.length>1?'Choisissez un pays pour afficher le contenu historique correspondant.':'Périmètre historique de la campagne.');
      root.hidden=false;root.style.display='';
      root.innerHTML=`<div class="composer-country-tabs-label"><div class="composer-country-tabs-label-copy"><strong>Périmètres historiques</strong><span>${help}</span></div></div><div class="composer-country-tabs-list">${countryEntries.map(entry=>{const active=entry.codes.includes(state.country);const langs=entry.locales;return `<button type="button" class="composer-country-tab composer-country-tab-with-locales ${active?'is-active':''}" data-country-tab="${esc(entry.code)}" aria-pressed="${active?'true':'false'}"><strong>${esc(entry.label)}</strong><span>${langs.length?langs.map(locale=>esc(localeLabel(locale))).join(' · '):'Langues historiques'}</span></button>`;}).join('')}</div>`;
      root.querySelectorAll('[data-country-tab]').forEach(button=>button.onclick=()=>switchCountry(button.dataset.countryTab));
      return;
    }
    // Pour une campagne créée depuis le catalogue, le contexte reste modifiable
    // même avec un seul périmètre : le client doit pouvoir ouvrir la modale et
    // activer les langues disponibles du catalogue.
    if(!countries.length){root.hidden=true;root.style.display='none';root.innerHTML='';return;}
    const byCountry=projectCountryLocales(project);
    const label=countryLabel;
    const activeCopy=state.country
      ? `Vous composez ${esc(label(state.country))} avec ${((byCountry[state.country]||[]).map(localeLabel).join(' · ')||'les langues configurées')}.`
      : (countries.length>1
          ? 'Étape 1 : cliquez sur un pays ci-dessous pour afficher les chapitres et commencer la composition. Les langues associées sont précisées sur chaque carte.'
          : 'Ce périmètre est actif. Vous pouvez modifier les langues disponibles ou ajouter un autre périmètre si le catalogue le permet.');
    root.hidden=false;
    root.style.display='';
    root.innerHTML=`<div class="composer-country-tabs-label"><div class="composer-country-tabs-label-copy"><div class="composer-inline-title"><strong>Composer par périmètre</strong>${infoDot(campaignContextInfoText,'Impact d’une modification de périmètre ou de langue')}</div><span>${activeCopy}</span></div>${state.project?.can_edit===false?'':`<button class="button button-ghost button-small composer-country-edit" type="button" data-edit-campaign-context>Modifier périmètres et langues</button>`}</div><div class="composer-country-tabs-list">${countryEntries.map(entry=>{const active=entry.codes.includes(state.country);const langs=entry.locales;return `<button type="button" class="composer-country-tab composer-country-tab-with-locales ${active?'is-active':''}" data-country-tab="${esc(entry.code)}" aria-pressed="${active?'true':'false'}"><strong>${esc(entry.label)}</strong><span>${langs.length?langs.map(locale=>esc(localeLabel(locale))).join(' · '):'Langue à préciser'}</span><span class="composer-country-action">${active?'✓ Pays sélectionné':'☞ Cliquez pour composer →'}</span></button>`;}).join('')}</div>`;
    root.querySelectorAll('[data-country-tab]').forEach(button=>button.onclick=()=>switchCountry(button.dataset.countryTab));
    root.querySelector('[data-edit-campaign-context]')?.addEventListener('click',openCampaignContextModal);
  }

  function renderComposerCountryGate(){
    const countries=campaignCountryEntries(state.project);
    const gated=countries.length>1&&!state.country;
    const live=document.querySelector('.composer-live');
    const sticky=document.querySelector('.creation-sticky-actions');
    const gate=$('composer-country-gate');
    if(live){
      live.hidden=gated;
      live.style.display=gated?'none':'';
    }
    if(sticky){
      sticky.hidden=gated;
      sticky.style.display=gated?'none':'';
    }
    // L'instruction reste volontairement dans le sélecteur de périmètre situé en haut.
    // On évite un second encart sous la frise d'étapes, qui donnait l'impression
    // que les boutons pays étaient ailleurs.
    if(gate){
      gate.hidden=true;
      gate.innerHTML='';
    }
  }

  async function switchCountry(code){
    const country=String(code||'').trim().toUpperCase();if(!country||country===state.country)return;
    try{
      const knownBefore=projectCountryLocales(state.project)[country]||[];
      const work=String(state.project?.working_locale||'fr').toLowerCase().replaceAll('_','-');
      const requestedLocale=!isLegacyClientCampaign(state.project)&&state.locale===work
        ? work
        : (knownBefore.includes(state.locale)?state.locale:(knownBefore.includes('fr')?'fr':(knownBefore[0]||state.locale||'fr')));
      const data=await api(`/api/projects/${projectId}/composer?countryCode=${encodeURIComponent(country)}&locale=${encodeURIComponent(requestedLocale)}`);
      state.project=data.project;state.chapters=data.chapters;rememberComposerContext(data);state.country=data.composer_context?.countryCode||country;
      const allowed=projectCountryLocales(state.project)[state.country]||[];
      if(allowed.length&&!allowed.includes(state.locale)
        &&(isLegacyClientCampaign(state.project)||state.locale!==String(state.project?.working_locale||'fr').toLowerCase().replaceAll('_','-')))
        state.locale=allowed.includes('fr')?'fr':allowed[0];
      state.active=Math.min(state.active,Math.max(0,state.chapters.length-1));
      state.translationContexts.clear();
      history.replaceState(null,'',`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${state.active}&countryCode=${encodeURIComponent(state.country)}`);
      renderCampaignContext(state.project);renderCountryTabs(state.project);renderComposerCountryGate();render();window.scrollTo({top:0,behavior:'smooth'});
    }catch(e){showMessage(e.message);}
  }

  async function openCampaignContextModal(){
    const normalizeCode=value=>String(value||'').trim().toUpperCase();
    const normalizeLocales=list=>[...new Set((Array.isArray(list)?list:[]).map(x=>String(x||'').toLowerCase().replaceAll('_','-')).filter(Boolean))];
    const currentCountries=[...new Set((Array.isArray(state.project?.countries)?state.project.countries:[]).concat(state.project?.selected_country_code?[state.project.selected_country_code]:[]).map(normalizeCode).filter(Boolean))];
    const currentLocales=projectContentLocales(state.project);
    const storedByCountry=state.project?.country_locales&&typeof state.project.country_locales==='object'&&!Array.isArray(state.project.country_locales)?state.project.country_locales:{};
    const countryName=code=>countryLabel(code);
    const countryKey=code=>countryName(code).toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

    // La modale doit rester disponible aussi pour une campagne historique dont le thème
    // n'existe plus exactement dans le catalogue actuel. Le catalogue enrichit les choix,
    // mais le contexte déjà stocké dans la campagne reste toujours la source de secours.
    let data={variants:[],chapterCapabilities:[]};
    try{data=await api(`/api/catalog/themes/${encodeURIComponent(themeSlug)}/variants`);}catch(_){/* fallback campagne */}
    const variants=Array.isArray(data?.variants)?data.variants:[];
    const caps=Array.isArray(data?.chapterCapabilities)?data.chapterCapabilities:[];
    const selectedChapterIds=new Set((state.chapters||[]).map(ch=>String(ch.catalog_chapter_id||'')).filter(Boolean));
    const selectedCaps=caps.filter(cap=>selectedChapterIds.has(String(cap.id)));
    const intersect=sets=>{if(!sets.length)return [];let out=[...sets[0]];for(const list of sets.slice(1))out=out.filter(x=>list.includes(x));return [...new Set(out)];};
    const localesForCapCountry=(cap,code)=>{
      const scoped=normalizeLocales(cap?.localesByCountry?.[code]);
      return scoped.length?scoped:normalizeLocales(cap?.worldwide?cap.locales:[]);
    };

    const rawCountryOptions=variants.filter(v=>v.countryCode).map(v=>{
      const code=normalizeCode(v.countryCode);
      const perChapter=selectedCaps.map(cap=>localesForCapCountry(cap,code));
      const locales=selectedCaps.length?intersect(perChapter):normalizeLocales(v.locales);
      return {code,locales,supported:!selectedCaps.length||perChapter.every(list=>list.length>0)};
    }).filter(v=>v.supported&&v.locales.length);

    // Réinjecte systématiquement les périmètres déjà présents dans la campagne.
    // Cela évite de perdre le bouton/modal sur les imports historiques.
    if(isLegacyClientCampaign(state.project)){
      currentCountries.forEach(code=>{
        const stored=normalizeLocales(storedByCountry?.[code]);
        const fallback=stored.length?stored:currentLocales;
        rawCountryOptions.push({code,locales:fallback,supported:true,isCurrent:true});
      });
    }

    const countryOptionGroups=new Map();
    rawCountryOptions.forEach(item=>{
      const label=countryName(item.code),key=countryKey(item.code);
      const current=countryOptionGroups.get(key)||{code:item.code,label,locales:[],aliases:[]};
      current.locales=[...new Set(current.locales.concat(item.locales))];
      current.aliases=[...new Set(current.aliases.concat(item.code))];
      // Pour les doublons UK / 826 par exemple, on privilégie le code ISO numérique.
      if(/^\d{3}$/.test(item.code))current.code=item.code;
      countryOptionGroups.set(key,current);
    });
    const countryOptions=[...countryOptionGroups.values()].filter(v=>v.locales.length).sort((a,b)=>a.label.localeCompare(b.label,'fr',{sensitivity:'base'}));
    const currentKeys=new Set(currentCountries.map(countryKey));

    const optionForCountry=code=>countryOptions.find(v=>v.code===code||v.aliases?.includes(code)||countryKey(v.code)===countryKey(code));
    const storedLocalesForOption=option=>{
      const aliases=[option.code,...(option.aliases||[])];
      return [...new Set(aliases.flatMap(code=>normalizeLocales(storedByCountry?.[code])))];
    };
    const selectionByCountry=new Map();
    countryOptions.forEach(option=>{
      if(!currentKeys.has(countryKey(option.code)))return;
      const available=option.locales;
      const stored=storedLocalesForOption(option);
      const fallback=currentLocales.filter(locale=>available.includes(locale));
      selectionByCountry.set(option.code,new Set((stored.length?stored:fallback).filter(locale=>available.includes(locale))));
    });

    if(!countryOptions.length){
      showMessage('Aucun périmètre exploitable n’a été trouvé pour cette campagne.');
      return;
    }

    const overlay=document.createElement('div');overlay.className='translation-overlay';
    overlay.innerHTML=`<section class="translation-modal campaign-context-modal" role="dialog" aria-modal="true"><header class="translation-head campaign-context-modal-head"><div class="campaign-context-modal-heading"><small>CONTEXTE DE CAMPAGNE</small><div class="composer-inline-title campaign-context-modal-title"><h2>Modifier les périmètres et les langues</h2>${infoDot(campaignContextInfoText,'Impact d’une modification de périmètre ou de langue',true)}</div><p>1. Sélectionnez les pays. 2. Pour chaque pays retenu, ajoutez ou retirez uniquement les langues réellement disponibles pour ce périmètre.</p></div><button class="translation-close" type="button" aria-label="Fermer">×</button></header><div class="campaign-context-scroll"><section><h3>1 · Périmètres</h3><p class="hint">Les pays sont classés par ordre alphabétique.</p><div class="version-check-grid">${countryOptions.map(v=>`<label class="version-check"><input type="checkbox" data-context-country value="${esc(v.code)}" ${currentKeys.has(countryKey(v.code))?'checked':''}> ${esc(v.label||countryName(v.code))}</label>`).join('')}</div></section><section><h3>2 · Langues par périmètre</h3><p class="hint">Une langue n’est proposée que si elle est disponible pour le pays concerné. Cliquez sur + pour l’ajouter ou sur ✓ pour la retirer.</p><div class="campaign-context-selection-summary" data-context-selection-summary></div><div class="version-empty" data-context-error hidden></div></section></div><footer class="translation-foot"><button class="button button-ghost" type="button" data-context-cancel>Annuler</button><button class="button button-primary" type="button" data-context-save>Mettre à jour la campagne</button></footer></section>`;
    document.body.appendChild(overlay);
    const destroyFloatingInfo=setupFloatingInfoTooltip(overlay);

    const close=()=>{destroyFloatingInfo();overlay.remove();},selectionSummary=overlay.querySelector('[data-context-selection-summary]'),error=overlay.querySelector('[data-context-error]'),save=overlay.querySelector('[data-context-save]');
    overlay.querySelector('.translation-close').onclick=close;overlay.querySelector('[data-context-cancel]').onclick=close;
    const selectedCountries=()=>[...new Set([...overlay.querySelectorAll('[data-context-country]:checked')].map(x=>x.value))];
    const localesForCountry=code=>optionForCountry(code)?.locales||[];

    function renderSelectionSummary(){
      const countries=selectedCountries();
      if(!selectionSummary)return;
      if(!countries.length){selectionSummary.innerHTML='<div class="campaign-context-empty-selection"><strong>Sélectionnez au moins un pays</strong><span>Les langues disponibles apparaîtront ici automatiquement.</span></div>';return;}
      const rows=countries.map(code=>{
        const available=localesForCountry(code);
        if(!selectionByCountry.has(code))selectionByCountry.set(code,new Set());
        const selected=[...(selectionByCountry.get(code)||new Set())].filter(locale=>available.includes(locale));
        const remaining=available.filter(locale=>!selected.includes(locale));
        const selectedHtml=selected.length
          ? `<div class="campaign-context-country-selected">${selected.map(locale=>`<button type="button" class="campaign-context-summary-lang is-selected" data-summary-country="${esc(code)}" data-summary-locale="${esc(locale)}" aria-label="Retirer ${esc(localeLabel(locale))} pour ${esc(countryName(code))}"><span>✓</span>${esc(localeLabel(locale))}</button>`).join('')}</div>`
          : `<div class="campaign-context-country-missing"><strong>Aucune langue active</strong><small>Ajoutez au moins une langue pour ${esc(countryName(code))}.</small></div>`;
        const availableHtml=remaining.length
          ? `<div class="campaign-context-country-available"><small>${selected.length?'Ajouter une langue':'Langues disponibles'} :</small>${remaining.map(locale=>`<button type="button" class="campaign-context-summary-lang" data-summary-country="${esc(code)}" data-summary-locale="${esc(locale)}"><span>+</span>${esc(localeLabel(locale))}</button>`).join('')}</div>`
          : `<small class="campaign-context-all-selected">Toutes les langues disponibles pour ce périmètre sont actives.</small>`;
        return `<div class="campaign-context-selection-row"><div class="campaign-context-selection-country"><strong>${esc(countryName(code))}</strong><span>${available.length} langue${available.length>1?'s':''} disponible${available.length>1?'s':''}</span></div><div class="campaign-context-country-languages">${selectedHtml}${availableHtml}</div></div>`;
      }).join('');
      selectionSummary.innerHTML=`<div class="campaign-context-selection-title">Langues activées par périmètre</div>${rows}`;
      selectionSummary.querySelectorAll('[data-summary-locale]').forEach(button=>button.onclick=()=>{
        const code=button.dataset.summaryCountry,locale=button.dataset.summaryLocale;
        const set=selectionByCountry.get(code)||new Set();
        if(set.has(locale))set.delete(locale);else set.add(locale);
        selectionByCountry.set(code,set);
        renderSelectionSummary();
        validate();
      });
    }

    function validate(){
      const countries=selectedCountries();
      const missing=countries.filter(code=>!(selectionByCountry.get(code)?.size));
      const sameCountries=countries.length===countryOptions.filter(o=>currentKeys.has(countryKey(o.code))).length&&countries.every(code=>currentKeys.has(countryKey(code)));
      const sameSelections=sameCountries&&countries.every(code=>{
        const option=optionForCountry(code);
        const available=option?.locales||[];
        const stored=storedLocalesForOption(option||{code,aliases:[]});
        const before=(stored.length?stored:currentLocales.filter(locale=>available.includes(locale))).filter(locale=>available.includes(locale)).sort();
        const now=[...(selectionByCountry.get(code)||new Set())].sort();
        return now.length===before.length&&now.every((locale,index)=>locale===before[index]);
      });
      error.hidden=true;error.textContent='';
      if(!countries.length){error.hidden=false;error.textContent='Choisissez au moins un périmètre.';}
      else if(missing.length){error.hidden=false;error.textContent=`Choisissez au moins une langue pour : ${missing.map(countryName).join(', ')}.`;}
      save.disabled=!countries.length||Boolean(missing.length)||sameSelections;
    }

    overlay.querySelectorAll('[data-context-country]').forEach(input=>input.onchange=()=>{
      if(input.checked&&!selectionByCountry.has(input.value))selectionByCountry.set(input.value,new Set());
      renderSelectionSummary();
      validate();
    });
    renderSelectionSummary();
    validate();

    save.onclick=async()=>{
      const selectedCountriesNow=selectedCountries();
      const localesByCountry={};
      selectedCountriesNow.forEach(code=>{localesByCountry[code]=[...(selectionByCountry.get(code)||new Set())];});
      const selectedLocalesNow=[...new Set(selectedCountriesNow.flatMap(code=>localesByCountry[code]||[]))];
      save.disabled=true;save.textContent='Enregistrement…';
      try{
        const result=await api(`/api/projects/${projectId}/context`,{method:'PATCH',body:JSON.stringify({countries:selectedCountriesNow,locales:selectedLocalesNow,localesByCountry})});
        state.project=result.project;state.translationContexts.clear();state.libraryAvailability.clear();close();
        const refreshedCountries=campaignCountries(state.project);
        state.country=refreshedCountries.length===1?refreshedCountries[0]:'';
        if(state.country){
          const refreshed=await api(`/api/projects/${projectId}/composer?countryCode=${encodeURIComponent(state.country)}`);
          state.project=refreshed.project;state.chapters=refreshed.chapters;state.country=refreshed.composer_context?.countryCode||state.country;
          render();
        }else{
          state.chapters=[];
          history.replaceState(null,'',`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}`);
        }
        renderCampaignContext(state.project);renderCountryTabs(state.project);renderComposerCountryGate();clearMessage();
      }catch(e){save.disabled=false;save.textContent='Mettre à jour la campagne';error.hidden=false;error.textContent=e.message;}
    };
  }

  function renderNav(){
    const total=totalSelected();
    $('catalog-summary').textContent=`${state.chapters.length} chapitres · ${total} situations retenues`;
    $('catalog-count').innerHTML=`<strong>${total}</strong> situations dans votre autodiagnostic`;
    $('catalog-progress').style.width='100%';
    $('duration-estimate').textContent=`${Math.max(3,Math.round(total*.35))} à ${Math.max(5,Math.round(total*.45))} minutes · ${total} situations`;
    $('chapter-nav').innerHTML=state.chapters.map((ch,i)=>{const blocking=firstInvalidIndex(i),blocked=blocking!==-1,st=chapterCountStatus(ch);return `<article class="creation-chapter-item ${i===state.active?'is-active':''} ${st.below||st.above?'is-incomplete':''}"><button class="creation-chapter-head" data-chapter="${i}" type="button"><span><small>Partie ${i+1}</small>${esc(ch.title)}</span><strong>${ch.situations.length}</strong></button><div class="creation-chapter-tabs"><button class="${i===state.active?'is-active':''}" data-chapter="${i}" type="button">Questions</button><button class="${blocked?'is-disabled':''}" data-profile-chapter="${i}" data-blocking-chapter="${blocking}" aria-disabled="${blocked}" type="button">Profils</button></div></article>`;}).join('');
    document.querySelectorAll('[data-chapter]').forEach(button=>button.onclick=async()=>{state.active=Number(button.dataset.chapter);history.replaceState(null,'',`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${state.active}${state.country?`&countryCode=${encodeURIComponent(state.country)}`:''}${state.locale?`&locale=${encodeURIComponent(state.locale)}`:''}`);await preloadActiveTranslationContexts();render();window.scrollTo({top:0,behavior:'smooth'});});
    document.querySelectorAll('[data-profile-chapter]').forEach(button=>button.onclick=async()=>{const blocking=Number(button.dataset.blockingChapter);if(blocking>=0){await showIncompleteChapterModal(blocking,'Complétez les situations avant de personnaliser les profils');return;}location.href=`personnalisation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${button.dataset.profileChapter}${state.country?`&countryCode=${encodeURIComponent(state.country)}`:''}`;});
  }

  function isLegalChapter(ch=state.chapters[state.active]){return canonical(ch?.slug||ch?.title).includes('harcelement')||canonical(ch?.slug||ch?.title).includes('agression sexuelle');}
  function bestAnswerLabel(){return isLegalChapter()?'Réponse correcte':'Réponse la plus appropriée';}
  function isStereotypesChapter(ch=state.chapters[state.active]){
    // Règle transversale Me&YouToo : tout chapitre « Stéréotypes… » est un socle méthodologique,
    // quelle que soit la thématique qui le réutilise (Sexisme, Alliés de la mixité, etc.).
    return canonical(ch?.slug||ch?.title).includes('stereotype');
  }
  function isAggressionChapter(ch=state.chapters[state.active]){return canonical(ch?.slug||ch?.title).includes('agression sexuelle');}
  function isHostileChapter(ch=state.chapters[state.active]){return themeSlug==='sexisme'&&canonical(ch?.slug||ch?.title).includes('sexisme hostile');}
  function chapterSituationRules(ch=state.chapters[state.active]){
    // Les campagnes historiques clientes sont des copies fidèles du legacy :
    // les contraintes Studio de minimum/maximum par chapitre ne s'appliquent jamais.
    if(isLegacyClientCampaign())return {min:null,max:null};
    if(isStereotypesChapter(ch))return {min:null,max:null};
    if(ch?.composition_rules)return ch.composition_rules;
    throw new Error('Règles de composition indisponibles : vérifiez la mise à jour de l’API.');
  }
  function chapterCountStatus(ch=state.chapters[state.active]){
    const rules=chapterSituationRules(ch),count=ch?.situations?.length||0;
    return {rules,count,below:rules.min!=null&&count<rules.min,atMax:rules.max!=null&&count>=rules.max,above:rules.max!=null&&count>rules.max};
  }
  function canRemoveSituation(s,ch=state.chapters[state.active]){
    if(!s||!ch||state.project?.can_edit===false)return false;
    const {rules,count}=chapterCountStatus(ch);
    const group=s.metadata?.link_group;
    const removing=group?ch.situations.filter(item=>item.metadata?.link_group===group).length:1;
    return rules.min==null||count-removing>=rules.min;
  }
  function firstInvalidIndex(limit=state.chapters.length-1){for(let i=0;i<=Math.min(limit,state.chapters.length-1);i++){const st=chapterCountStatus(state.chapters[i]);if(st.below||st.above)return i;}return -1;}
  async function showIncompleteChapterModal(index,title){
    const ch=state.chapters[index],status=chapterCountStatus(ch);if(!ch)return;
    state.active=index;history.replaceState(null,'',`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${index}${state.country?`&countryCode=${encodeURIComponent(state.country)}`:''}`);render();window.scrollTo({top:0,behavior:'smooth'});
    if(status.below){await ensureLibraryAvailability(ch);if(!chapterHasLibrary(ch)){await window.StudioModal.alert({eyebrow:'Composition du diagnostic',title:'Chapitre à compléter avec Me&YouToo',message:`Ce chapitre contient ${status.count} situations sur les ${status.rules.min} requises. Aucune situation complémentaire n’est disponible pour ce périmètre. Contactez Me&YouToo pour rétablir les situations manquantes avant de poursuivre.`,type:'warning',confirmLabel:'Revenir au chapitre'});return;}const goLibrary=await window.StudioModal.confirm({eyebrow:'Composition du diagnostic',title:title||`Il vous faut ${status.rules.min} situations minimum`,message:`« ${ch.title} » contient ${status.count} situation${status.count>1?'s':''}. Ajoutez-en ${status.rules.min-status.count} avant de personnaliser les profils.`,type:'info',cancelLabel:'Rester sur le chapitre',confirmLabel:'Piocher dans la bibliothèque'});if(goLibrary)openLibrary('add');return;}
    await window.StudioModal.alert({eyebrow:'Composition du diagnostic',title:`Maximum de ${status.rules.max} situations`,message:`« ${ch.title} » contient plus de ${status.rules.max} situations. Supprimez-en une avant de personnaliser les profils.`,type:'warning',confirmLabel:'J’ai compris'});
  }
  function separatedDiffHtml(original,current){
    const diff=wordDiffHtml(original,current);
    const after=diff.replace(/<del>[\s\S]*?<\/del>/g,''),before=diff.replace(/<ins>[\s\S]*?<\/ins>/g,'');
    return `${after||'—'}${diff.includes('<del>')?`<details class="admin-review-removed"><summary>Voir les passages supprimés du texte précédent</summary><div class="composer-diff-text" style="white-space:pre-wrap">${before}</div></details>`:''}`;
  }
  function wordDiffHtml(original,current){
    const a=String(original||'').split(/(\s+|[.,;:!?'"()«»–—-])/).filter(Boolean),b=String(current||'').split(/(\s+|[.,;:!?'"()«»–—-])/).filter(Boolean);
    const n=a.length,m=b.length,dp=Array.from({length:n+1},()=>Array(m+1).fill(0));
    for(let i=n-1;i>=0;i--)for(let k=m-1;k>=0;k--)dp[i][k]=a[i]===b[k]?dp[i+1][k+1]+1:Math.max(dp[i+1][k],dp[i][k+1]);
    let i=0,k=0,out='';
    while(i<n||k<m){
      if(i<n&&k<m&&a[i]===b[k]){out+=esc(a[i]);i++;k++;}
      else if(k<m&&(i===n||dp[i][k+1]>=dp[i+1]?.[k])){out+=`<ins>${esc(b[k])}</ins>`;k++;}
      else if(i<n){out+=`<del>${esc(a[i])}</del>`;i++;}
    }
    return out;
  }
  function diffBlock(original,current,label,admin=false){
    if(String(original||'')===String(current||''))return '';
    return `<div class="composer-diff${admin?' is-admin-correction':''}"><div class="composer-diff-label">${esc(label)}</div><div class="composer-diff-text">${separatedDiffHtml(original,current)}</div></div>`;
  }
  function submittedSituation(id){const chapters=state.project?.review_snapshot?.chapters;return Array.isArray(chapters)?chapters.flatMap(ch=>ch.situations||[]).find(s=>String(s.id)===String(id)):null;}
  function reviewDiff(original,submitted,current,referenceLabel){if(!state.project?.review_mode)return diffBlock(original,current,`Modifications par rapport à ${referenceLabel}`);const client=submitted==null?current:submitted;return diffBlock(original,client,'Adaptations transmises par le client')+diffBlock(client,current,'Correction ajoutée par Me&YouToo',true);}
  function answerHtml(a, editable=false, originalContent='',submittedContent=null){
    const changed=editable&&String(originalContent||'')!==String(a.content||'');
    return `<div class="composer-answer ${a.is_best?'is-best':''} ${changed?'is-customized':''}">
      ${editable?`<textarea class="composer-inline-answer" data-answer-input="${esc(a.id)}" data-original-answer="${esc(originalContent||a.content)}" rows="2" aria-label="Modifier cette réponse">${esc(a.content)}</textarea>`:`<span class="composer-answer-text">${esc(a.content)}</span>`}
      <span class="composer-score">Score ${Number(a.score).toLocaleString('fr-FR')}</span>${isAdmin?`<small class="composer-tech-id">ID réponse source : ${esc(a.id??'—')}</small>`:''}
      ${a.is_best?`<span class="composer-best">${bestAnswerLabel()}</span>`:''}
      <div data-live-answer-diff="${esc(a.id)}">${editable&&(changed||state.project?.review_mode)?reviewDiff(originalContent,submittedContent,a.content,'la réponse Me&YouToo'):''}</div>
    </div>`;
  }

  function linkedSituationLabel(s,index,situations){
    const group=s?.metadata?.link_group;if(!group)return '';
    const linkedNumbers=situations.map((item,i)=>item?.metadata?.link_group===group?i+1:null).filter(Boolean);
    const others=linkedNumbers.filter(number=>number!==index+1);
    return others.length?`Situation ${index+1} liée ${others.length>1?'aux situations':'à la situation'} ${others.join(' et ')}`:`Situation ${index+1} liée à une autre situation`;
  }

  function situationTone(s,index,ch){
    const group=s?.metadata?.link_group||'';
    if(group){
      const firstLinkedIndex=ch.situations.findIndex(item=>item?.metadata?.link_group===group);
      return `tone-${(Math.max(0,firstLinkedIndex)%4)+1}`;
    }
    return `tone-${(index%4)+1}`;
  }

  function libraryAvailabilityKey(ch=state.chapters[state.active]){
    return `${String(ch?.catalog_chapter_id||ch?.id||'')}:${String(state.country||'')}`;
  }
  function chapterHasLibrary(ch=state.chapters[state.active]){
    return Boolean(ch&&state.project?.can_edit!==false&&(!isStereotypesChapter(ch)||isAdmin)&&state.libraryAvailability.get(libraryAvailabilityKey(ch))===true);
  }
  async function ensureLibraryAvailability(ch=state.chapters[state.active]){
    if(!ch||state.project?.can_edit===false||(isStereotypesChapter(ch)&&!isAdmin))return false;
    const key=libraryAvailabilityKey(ch);
    if(state.libraryAvailability.has(key))return state.libraryAvailability.get(key)===true;
    // Masquer les accès jusqu'à confirmation d'une alternative réellement disponible.
    const pending={};
    state.libraryAvailability.set(key,pending);
    try{
      const data=await api(`/api/catalog/themes/${themeSlug}/library?chapterId=${encodeURIComponent(ch.catalog_chapter_id||ch.id)}&projectId=${encodeURIComponent(projectId)}&countryCode=${encodeURIComponent(state.country||'')}`);
      if(state.libraryAvailability.get(key)!==pending)return false;
      const has=availableLibrarySituations(data?.situations).length>0;
      state.libraryAvailability.set(key,has);
      if(ch===state.chapters[state.active])render();
      return has;
    }catch(error){
      console.warn('Bibliothèque complémentaire indisponible',error);
      if(state.libraryAvailability.get(key)!==pending)return false;
      state.libraryAvailability.set(key,false);
      if(ch===state.chapters[state.active])render();
      return false;
    }
  }

  const normalizeLocale=loc=>String(loc||'').trim().toLowerCase().replaceAll('_','-');
  function translationViewForSituation(s){
    const ctx=state.translationContexts.get(String(s?.id));
    if(!ctx)return null;
    const referenceLocale=normalizeLocale(ctx.referenceLocale||'fr');
    const targetLocale=normalizeLocale(state.locale||referenceLocale);
    if(!targetLocale||targetLocale===referenceLocale)return null;
    const reference=ctx.reference||{};
    const target=ctx.translations?.[targetLocale]||{status:'missing',content:'',answers:[]};
    const referenceAnswers=Array.isArray(reference.answers)?reference.answers:[];
    const targetAnswers=referenceAnswers.map(ref=>{
      const found=(target.answers||[]).find(item=>String(item.id)===String(ref.id));
      return {id:ref.id,referenceContent:ref.content||'',content:found?.content||'',status:found?.status||'missing'};
    });
    return {referenceLocale,targetLocale,reference,target,targetAnswers};
  }
  async function preloadActiveTranslationContexts(){
    if(!isLegacyClientCampaign(state.project)||state.project?.can_edit===false)return;
    const ch=state.chapters[state.active];
    if(!ch||!Array.isArray(ch.situations))return;
    await Promise.allSettled(ch.situations.map(s=>getTranslationContext(s.id)));
  }
  function translationAnswerHtml(baseAnswer,translated,referenceLocale){
    return `<div class="composer-answer ${baseAnswer.is_best?'is-best':''}">
      <div class="translation-reference-text"><strong>${esc(localeLabel(referenceLocale))} · référence :</strong> ${esc(translated?.referenceContent||'')}</div>
      <textarea class="composer-inline-answer" data-answer-input="${esc(baseAnswer.id)}" data-original-answer="${esc(translated?.referenceContent||'')}" rows="2" placeholder="Traduction ${esc(localeLabel(state.locale))} à compléter">${esc(translated?.content||'')}</textarea>
      <span class="composer-score">Score ${Number(baseAnswer.score).toLocaleString('fr-FR')}</span>
      ${baseAnswer.is_best?`<span class="composer-best">${bestAnswerLabel()}</span>`:''}
    </div>`;
  }

  function situationTranslationGaps(ctx){
    if(!ctx)return [];
    const configured=state.country?(projectCountryLocales(state.project)[state.country]||[]):(state.project?.locales||ctx.locales||[]);
    const referenceLocale=normalizeLocale(ctx.referenceLocale||'fr');
    return [...new Set(configured.map(normalizeLocale).filter(Boolean))].filter(locale=>locale!==referenceLocale).flatMap(locale=>{
      const t=ctx.translations?.[locale]||{},answers=ctx.reference?.answers||[];
      const fields=[{content:t.content,status:t.status},...answers.map(a=>(t.answers||[]).find(row=>String(row.id)===String(a.id))||{})];
      const filled=fields.filter(field=>String(field.content||'').trim()&&field.status!=='missing').length;
      return filled===fields.length?[]:[{locale,partial:filled>0,missing:fields.length-filled,total:fields.length}];
    });
  }
  function updateSituationTranslationAlerts(id,ctx){
    if(isLegacyClientCampaign()||state.project?.can_edit===false)return;
    const card=document.querySelector(`[data-situation-card="${CSS.escape(String(id))}"]`);
    if(!card)return;
    const gaps=situationTranslationGaps(ctx),badges=card.querySelector('[data-translation-badges]'),alert=card.querySelector('[data-translation-alert]');
    if(badges)badges.innerHTML=gaps.map(gap=>`<span class="composer-translation-gap-badge">${esc(gap.locale.toUpperCase())} — ${gap.partial?'Traduction incomplète':'Non traduit'}</span>`).join('');
    if(alert){
      alert.hidden=!gaps.length;
      alert.innerHTML=gaps.length?`<strong>Traductions à compléter avant transmission</strong><p>Votre campagne diffuse aussi cette situation dans ${gaps.length>1?'les langues suivantes':'la langue suivante'}. Complétez le texte et toutes les réponses. Les traductions manquantes restent vides.</p><div class="composer-translation-gap-actions">${gaps.map(gap=>`<button type="button" class="button button-secondary button-small" data-complete-translation="${esc(gap.locale)}">Compléter ${esc(localeLabel(gap.locale))} · ${gap.missing} champ${gap.missing>1?'s':''}</button>`).join('')}</div>`:'';
      alert.querySelectorAll('[data-complete-translation]').forEach(button=>button.onclick=()=>openTranslationModal(id,button.dataset.completeTranslation));
    }
  }
  function focusLibrarySituation(id){
    state.libraryFocusId=String(id);
    const card=document.querySelector(`[data-situation-card="${CSS.escape(String(id))}"]`);
    if(!card)return;
    const body=$(`situation-body-${id}`),toggle=card.querySelector('[data-collapse-situation]');
    state.expandedSituations.add(String(id));
    if(body)body.hidden=false;
    if(toggle){toggle.textContent='Replier';toggle.setAttribute('aria-expanded','true');}
    card.classList.add('review-direct-target');card.setAttribute('tabindex','-1');
    card.focus({preventScroll:true});card.scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function afterLibrarySelection(ids){
    const selected=ids.map(String).filter(id=>findSituation(id));
    if(!selected.length)return;
    selected.forEach(id=>state.expandedSituations.add(id));
    render();focusLibrarySituation(selected[0]);
    if(isLegacyClientCampaign()||state.project?.can_edit===false)return;
    const incomplete=[];
    try{
      for(const id of selected){const ctx=await getTranslationContext(id,true);updateSituationTranslationAlerts(id,ctx);const gaps=situationTranslationGaps(ctx);if(gaps.length)incomplete.push({id,gaps});}
      if(!incomplete.length)return;
      focusLibrarySituation(incomplete[0].id);
      const languages=[...new Set(incomplete.flatMap(item=>item.gaps.map(gap=>gap.locale)))];
      const translate=await window.StudioModal.confirm({eyebrow:'Traductions de votre campagne',title:'Traduction à compléter',message:`Votre sélection dans la bibliothèque nécessite de compléter ${languages.map(localeLabel).join(', ')} pour ${incomplete.length} situation${incomplete.length>1?'s':''}. Traduisez le texte et toutes les réponses avant de transmettre votre campagne. Les versions déjà disponibles sont conservées.`,type:'warning',cancelLabel:'Plus tard',confirmLabel:languages.length===1?`Traduire en ${localeNames[languages[0]]||languages[0].toUpperCase()}`:'Compléter les traductions'});
      if(translate)await openTranslationModal(incomplete[0].id,incomplete[0].gaps[0].locale);
    }catch(error){showMessage(`Situation enregistrée. Le contrôle des traductions n’a pas pu aboutir : ${error.message}. Vérifiez les versions linguistiques avant transmission.`);}
  }

  function situationHtml(s,index){
    const ch=state.chapters[state.active];
    const expanded=state.expandedSituations.has(String(s.id)),answersExpanded=state.expandedAnswers.has(String(s.id));
    const stereotypes=isStereotypesChapter(ch);
    // Règle méthodologique Me&YouToo : le chapitre Stéréotypes est un socle
    // non modifiable dans Sexisme et dans Alliés de la mixité.
    const methodologyLocked=Boolean(stereotypes&&!isAdmin);
    const adminCorrection=Boolean(state.project?.review_mode&&state.project?.can_edit===true);
    const readOnly=Boolean(!adminCorrection&&state.project?.can_edit===false);
    const locked=Boolean(methodologyLocked||readOnly);
    const canReplaceLocked=false;
    const showMethodologyChip=Boolean(methodologyLocked&&!readOnly);
    const linkedLabel=linkedSituationLabel(s,index,ch.situations);
    const originalText=s.original_content_localized||s.original_content||s.content||'';
    const submitted=submittedSituation(s.id);
    const legacyClientImport=isLegacyClientCampaign();
    const translationView=translationViewForSituation(s);
    const directTranslationEdit=Boolean(translationView&&legacyClientImport&&state.project?.can_edit!==false&&!locked);
    // Une traduction du catalogue Me&YouToo n'est jamais une personnalisation.
    // Le tag « Personnalisée » repose uniquement sur une vraie contextualisation enregistrée.
    const customized=!legacyClientImport&&Boolean(s.has_customization);
    const originTag=s.from_library?'<span class="composer-library-choice-tag">✓ Choisie dans la bibliothèque</span>':'';
    const hasLibrary=chapterHasLibrary(ch);
    const situationText=locked
      ?`<h3>${esc(s.content)}</h3>`
      :directTranslationEdit
        ?`<div class="composer-inline-field">
          <div class="composer-inline-help composer-context-help"><strong>Texte de référence</strong><span>${esc(translationView.reference.content||s.content||'')}</span></div>
          <div class="composer-editor-label-row"><label for="situation-text-${esc(s.id)}">Traduction ${esc(localeLabel(translationView.targetLocale))}</label><span class="composer-context-tag">Version linguistique</span></div>
          <textarea id="situation-text-${esc(s.id)}" class="composer-inline-situation" data-situation-input="${esc(s.id)}" data-original-situation="${esc(translationView.reference.content||'')}" rows="3" placeholder="Traduction ${esc(localeLabel(translationView.targetLocale))} à compléter">${esc(translationView.target.content||'')}</textarea>
          <small class="composer-field-guidance">Vous modifiez uniquement la version ${esc(localeLabel(translationView.targetLocale))}. La version ${esc(localeLabel(translationView.referenceLocale))} reste inchangée.</small>
        </div>`
        :`<div class="composer-inline-field">
          <div class="composer-editor-label-row"><label for="situation-text-${esc(s.id)}">Texte de la mise en situation</label><span class="composer-context-tag">Contextualisation uniquement</span></div>
          <textarea id="situation-text-${esc(s.id)}" class="composer-inline-situation ${String(originalText)!==String(s.content||'')?'is-customized':''}" data-situation-input="${esc(s.id)}" data-original-situation="${esc(originalText)}" rows="3">${esc(s.content)}</textarea>
          <div data-live-situation-diff>${reviewDiff(originalText,submitted?.content,s.content,'la situation Me&YouToo')}</div>
          <small class="composer-field-guidance">${hasLibrary?'Adaptez un prénom, un métier, votre terminologie ou le contexte professionnel. Si le sens ne convient pas, utilisez « Remplacer » et choisissez une autre situation dans la bibliothèque.':'Adaptez un prénom, un métier, votre terminologie ou le contexte professionnel sans changer le sens de la situation.'}</small>
        </div>`;
    const answerRows=directTranslationEdit
      ?(s.answers||[]).map(a=>{const ta=translationView.targetAnswers.find(item=>String(item.id)===String(a.id))||{id:a.id,referenceContent:a.content||'',content:''};return translationAnswerHtml(a,ta,translationView.referenceLocale);}).join('')
      :(s.answers||[]).map(a=>{const original=(s.original_answers||[]).find(o=>String(o.id)===String(a.id)),sent=(submitted?.answers||[]).find(o=>String(o.id)===String(a.id));return answerHtml(a,!locked,original?.content||a.content,sent?.content??null);}).join('');
    const tone=situationTone(s,index,ch);
    return `<article class="composer-situation ${tone} ${locked?'is-locked':''} ${customized?'has-customization':''} ${state.libraryFocusId===String(s.id)?'review-direct-target':''}" data-situation-card="${esc(s.id)}">
      <div class="composer-situation-head">
        <div class="composer-situation-tags">${isAdmin?`<span class="composer-position-chip">ID situation Studio : ${esc(s.id)}</span>${s.catalog_situation_id?`<span class="composer-position-chip">ID Catalogue : ${esc(s.catalog_situation_id)}</span>`:''}${s.legacy_payload?.surveyQuestionId?`<span class="composer-position-chip">ID question moteur : ${esc(s.legacy_payload.surveyQuestionId)}</span>`:''}${s.legacy_payload?.legacyId?`<span class="composer-position-chip">ID situation Legacy : ${esc(s.legacy_payload.legacyId)}</span>`:''}`:''}${showMethodologyChip?`<span class="composer-lock-chip">🔒 Situation socle — texte non modifiable</span>`:`<span class="composer-position-chip">Situation ${index+1}</span>`}${originTag}<span data-translation-badges></span>${directTranslationEdit?`<span class="composer-customized-tag">🌐 ${esc(localeLabel(translationView.targetLocale))}</span>`:(customized?'<span class="composer-customized-tag">✎ Personnalisée</span>':'')}</div>
        <div class="composer-situation-head-actions">${isAdmin?`<button type="button" class="button button-secondary button-small" data-reuse-client-situation="${esc(s.id)}" title="Copie indépendante vers la Bibliothèque complémentaire Me&YouToo">Copier vers la bibliothèque Me&YouToo</button>`:''}<button class="button button-ghost button-small composer-collapse-situation" type="button" data-collapse-situation="${esc(s.id)}" aria-expanded="${expanded}">${expanded?'Replier':'Déplier'}</button></div>
      </div>
      <div class="composer-situation-body" id="situation-body-${esc(s.id)}"${expanded?'':' hidden'}>
      <div class="composer-translation-gap-alert" data-translation-alert role="status" hidden></div>
      ${linkedLabel?`<div class="composer-linked-chip">🔗 ${esc(linkedLabel)}</div>`:''}
      ${situationText}
      <button class="composer-toggle" type="button" data-toggle="${esc(s.id)}" aria-expanded="${answersExpanded}"><span data-toggle-label>${answersExpanded?'Masquer les réponses et les scores':'Voir les réponses et les scores'}</span> <span aria-hidden="true">⌄</span></button>
      <div class="composer-answers" id="answers-${esc(s.id)}"${answersExpanded?'':' hidden'}>${answerRows}</div>
      ${((((state.country?(projectCountryLocales(state.project)[state.country]||[]):(state.project?.locales||[]))).length>1)?`<div class="composer-translation-row"><button class="button button-ghost composer-translation-button" type="button" data-translations="${esc(s.id)}" ${legacyClientImport?'':'hidden'}>🌐 Vérifier les versions linguistiques</button></div><div class="translation-sync-warning" data-live-translation-warning ${customized?'':'hidden'}>⚠️ Vous modifiez le contenu de référence. Les autres versions linguistiques doivent être vérifiées.</div>`:'')}
      ${!locked?`<div class="composer-inline-help composer-context-help">${directTranslationEdit?`<strong>Vous travaillez en ${esc(localeLabel(translationView.targetLocale))}</strong><span>Complétez la traduction de la situation et de chaque réponse. Le français reste votre référence et ne sera pas modifié.</span>`:`<strong>Réponses : contextualisation uniquement</strong><span>Adaptez les termes au contexte de votre organisation sans changer le sens ni le niveau de pertinence. ${hasLibrary?'Si le fond ne convient pas, remplacez la situation depuis la bibliothèque Me&YouToo.':''} Les scores restent verrouillés et Me&YouToo validera les adaptations avant publication.</span>`}</div>
      <div class="composer-save-row"><span class="composer-save-status is-saved" data-save-status="${esc(s.id)}"><span class="composer-save-check" aria-hidden="true">✓</span><span data-save-text>${directTranslationEdit?'Enregistrement automatique de la traduction':(customized?'Enregistré':'Enregistrement automatique')}</span></span></div>
      <div class="composer-actions">
        ${!directTranslationEdit&&customized?`<button class="button button-ghost" type="button" data-reset="${esc(s.id)}">↶ ${state.project?.review_mode?'Annuler ma correction':'Annuler mes modifications'}</button>`:''}
        ${hasLibrary?`<button class="button button-secondary" type="button" data-replace="${esc(s.id)}">Remplacer depuis la bibliothèque</button>`:''}
        ${canRemoveSituation(s,ch)?`<button class="button button-danger-soft" type="button" data-remove="${esc(s.id)}">Supprimer du chapitre</button>`:''}
      </div>`:canReplaceLocked?`<div class="composer-inline-help composer-context-help composer-socle-help"><strong>Situation socle Stéréotypes</strong><span>Le texte et les réponses ne se modifient pas directement. Vous pouvez toutefois remplacer cette situation par une autre situation validée de la bibliothèque Me&YouToo.</span></div><div class="composer-actions"><button class="button button-secondary" type="button" data-replace="${esc(s.id)}">Remplacer via la bibliothèque</button></div>`:''}
      </div>
    </article>`;
  }

  const autosaveTimers=new Map();
  function setSaveStatus(card,stateName,message){
    const status=card?.querySelector('[data-save-status]'),text=status?.querySelector('[data-save-text]');
    if(!status)return;
    status.classList.remove('is-saving','is-saved','is-error');
    status.classList.add(stateName);
    if(text)text.textContent=message;
  }
  function scheduleAutosave(id){
    const card=document.querySelector(`[data-situation-card="${CSS.escape(String(id))}"]`);
    if(!card)return;
    setSaveStatus(card,'is-saving','Modifications en attente…');
    clearTimeout(autosaveTimers.get(String(id)));
    autosaveTimers.set(String(id),setTimeout(()=>saveInlineSituation(id),800));
  }
  function updateLiveTranslationWarning(card){
    if(!card)return;
    const warning=card.querySelector('[data-live-translation-warning]');
    if(!warning)return;
    const hasOtherLocales=[...new Set((Array.isArray(state.project?.locales)?state.project.locales:[]).map(x=>String(x||'').toLowerCase()))].length>1;
    const situationInput=card.querySelector('[data-situation-input]');
    const situationChanged=situationInput&&String(situationInput.value||'').trim()!==String(situationInput.dataset.originalSituation||'').trim();
    const answerChanged=[...card.querySelectorAll('[data-answer-input]')].some(input=>String(input.value||'').trim()!==String(input.dataset.originalAnswer||'').trim());
    warning.hidden=!(hasOtherLocales&&(situationChanged||answerChanged));
  }
  async function reuseClientSituation(id){
    if(!isAdmin)return;
    const source=findSituation(id);
    if(!source)return;
    try{
      const response=await api('/api/admin/catalog/themes');
      const themes=Array.isArray(response)?response:(response.themes||[]);
      const available=themes.filter(t=>t.active!==false&&Array.isArray(t.chapters)&&t.chapters.length);
      if(!available.length){showMessage('Aucun chapitre du Catalogue disponible.');return;}
      const overlay=document.createElement('div');overlay.className='translation-overlay';
      overlay.innerHTML=`<section class="translation-modal reuse-client-modal" role="dialog" aria-modal="true" aria-labelledby="reuse-client-title"><header class="translation-head reuse-client-head"><div><small>CATALOGUE ME&YOUTOO · RÉSERVÉ AUX ADMINS</small><h2 id="reuse-client-title">Réutiliser une situation client</h2><p>Créer une copie indépendante dans la Bibliothèque complémentaire.</p></div><button class="translation-close" type="button" aria-label="Fermer">×</button></header><div class="reuse-client-body"><div class="reuse-client-source"><span class="reuse-client-section-label">Situation d’origine</span><p>${esc((source.content||'').slice(0,500))}</p></div><div class="reuse-client-note"><strong>Ce qui sera copié</strong><p>Texte, réponses et scores de la campagne. Les traductions seront à vérifier. Aucun profil ni seuil ne sera transféré.</p></div><div class="reuse-client-fields"><label>Thématique de destination<select data-reuse-theme>${available.map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select></label><label>Chapitre de destination<select data-reuse-chapter></select></label></div><label class="reuse-client-consent"><input type="checkbox" data-reuse-review><span>Je confirme avoir vérifié les droits de réutilisation et l’absence d’informations confidentielles propres au client.</span></label><p class="reuse-client-footnote">Une copie strictement identique déjà présente dans cette thématique sera refusée. La campagne d’origine restera inchangée.</p></div><footer class="translation-foot reuse-client-footer"><button type="button" class="button button-secondary" data-reuse-cancel>Annuler</button><button type="button" class="button button-primary" data-reuse-confirm>Copier dans la bibliothèque</button></footer></section>`;
      document.body.appendChild(overlay);
      const close=()=>overlay.remove();overlay.querySelector('.translation-close').onclick=close;overlay.querySelector('[data-reuse-cancel]').onclick=close;
      const theme=overlay.querySelector('[data-reuse-theme]'),chapter=overlay.querySelector('[data-reuse-chapter]');
      const update=()=>{const found=available.find(t=>String(t.id)===theme.value);chapter.innerHTML=(found?.chapters||[]).map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');};theme.onchange=update;update();
      overlay.querySelector('[data-reuse-confirm]').onclick=async()=>{
        if(!overlay.querySelector('[data-reuse-review]').checked){showMessage('Confirmez la revue confidentialité et droits de réutilisation.');return;}
        const btn=overlay.querySelector('[data-reuse-confirm]');btn.disabled=true;
        try{const result=await api(`/api/admin/projects/${projectId}/situations/${id}/copy-to-library`,{method:'POST',body:JSON.stringify({targetChapterId:Number(chapter.value),confidentialityReviewed:true})});close();const alert=$('composer-alert');const target=new URL('admin.html',location.href);target.searchParams.set('tab','library');target.searchParams.set('themeId',String(result.targetThemeId));target.searchParams.set('chapterId',String(result.targetChapterId));target.searchParams.set('situationId',String(result.situationId));showMessage(`Situation catalogue n°${result.situationId} créée dans la Bibliothèque complémentaire.`, 'success');if(alert){const link=document.createElement('a');link.href=target.toString();link.textContent=' Voir la situation dans le Catalogue →';link.className='composer-catalog-copy-link';alert.appendChild(link);}}
        catch(error){btn.disabled=false;showMessage(error.message);}
      };
    }catch(error){showMessage(error.message);}
  }

  function bindSituations(){
    // A campaign may diffuse in ES alone while keeping FR as its working reference.
    // Keep its warning visible even without the multi-language toolbar.
    if(!isLegacyClientCampaign()&&state.project?.can_edit!==false){
      document.querySelectorAll('[data-situation-card]').forEach(async card=>{
        if(card.querySelector('[data-translations]'))return;
        try{const ctx=await getTranslationContext(card.dataset.situationCard);updateSituationTranslationAlerts(card.dataset.situationCard,ctx);}catch(_){/* The transmission endpoint remains authoritative. */}
      });
    }
    if(isAdmin)document.querySelectorAll('[data-reuse-client-situation]').forEach(b=>b.onclick=()=>reuseClientSituation(b.dataset.reuseClientSituation));
    document.querySelectorAll('[data-collapse-situation]').forEach(b=>b.onclick=()=>{const body=$(`situation-body-${b.dataset.collapseSituation}`);if(!body)return;body.hidden=!body.hidden;if(body.hidden)state.expandedSituations.delete(String(b.dataset.collapseSituation));else state.expandedSituations.add(String(b.dataset.collapseSituation));b.setAttribute('aria-expanded',String(!body.hidden));b.textContent=body.hidden?'Déplier':'Replier';});
    document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{
      const box=$(`answers-${b.dataset.toggle}`),label=b.querySelector('[data-toggle-label]');
      if(!box)return;
      box.hidden=!box.hidden;
      if(box.hidden)state.expandedAnswers.delete(String(b.dataset.toggle));else state.expandedAnswers.add(String(b.dataset.toggle));
      b.setAttribute('aria-expanded',String(!box.hidden));
      if(label)label.textContent=box.hidden?'Voir les réponses et les scores':'Masquer les réponses et les scores';
    });
    document.querySelectorAll('[data-situation-input],[data-answer-input]').forEach(input=>{
      input.addEventListener('input',()=>{const card=input.closest('[data-situation-card]');updateLiveTranslationWarning(card);scheduleAutosave(card?.dataset.situationCard);});
      input.addEventListener('blur',()=>{
        const id=input.closest('[data-situation-card]')?.dataset.situationCard;
        if(id&&autosaveTimers.has(String(id))){clearTimeout(autosaveTimers.get(String(id)));autosaveTimers.delete(String(id));saveInlineSituation(id);}
      });
    });
    document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>resetSituationCustomization(b.dataset.reset));
    document.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>openLibrary('replace',b.dataset.replace));
    document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeSituation(b.dataset.remove));
    const projectLocales=[...new Set((state.project?.locales||[]).map(x=>String(x||'').toLowerCase().replaceAll('_','-')).filter(Boolean))];
    const campaignLocales=state.country?(projectCountryLocales(state.project)[state.country]||[]):projectLocales;
    document.querySelectorAll('[data-translations]').forEach(async b=>{
      const id=b.dataset.translations;
      if(campaignLocales.length<=1){b.hidden=true;return;}
      if(!isAdmin&&state.project?.can_edit===false&&!isLegacyClientCampaign(state.project)){
        b.hidden=false;b.textContent='🌐 Consulter les versions linguistiques';
        b.title='Consultez les textes et les réponses transmis à Me&YouToo, en lecture seule.';
        b.onclick=async()=>{try{await openTranslationModal(id);}catch(error){await window.StudioModal.alert({title:'Versions linguistiques indisponibles',message:error.message||'Impossible de charger les versions transmises.',type:'info'});}};
        return;
      }
      if(isLegacyClientCampaign(state.project)){
        // Les imports legacy peuvent avoir un country_locales réduit à FR alors que
        // la situation contient réellement plusieurs traductions. L'endpoint
        // /translations est la source de vérité pour la mappemonde par situation.
        b.hidden=false;
        b.onclick=()=>openTranslationModal(id);
        return;
      }
      try{
        const ctx=await getTranslationContext(id);
        updateSituationTranslationAlerts(id,ctx);
        if((state.country?(projectCountryLocales(state.project)[state.country]||[]):(ctx.locales||[])).filter(x=>x!==ctx.referenceLocale&&(ctx.locales||[]).includes(x)).length){
          b.hidden=false;
          b.onclick=()=>openTranslationModal(id);
        }
      }catch(_){b.hidden=true;}
    });
  }

  const localeNames={fr:'Français',en:'Anglais',es:'Espagnol',de:'Allemand',it:'Italien',pt:'Portugais',br:'Portugais Brésil','id-id':'Indonésien',id:'Indonésien',ar:'Arabe',ja:'Japonais','ko-kr':'Coréen',zf:'Chinois simplifié',zh:'Chinois traditionnel',bg:'Bulgare',nl:'Néerlandais','nl-be':'Néerlandais Belgique',pl:'Polonais',ro:'Roumain',ru:'Russe','sv-se':'Suédois',tr:'Turc',cs:'Tchèque',sk:'Slovaque'};
  const localeLabel=loc=>`${localeNames[String(loc).toLowerCase()]||String(loc).toUpperCase()} (${String(loc).toUpperCase()})`;
  async function getReadOnlyTranslationContext(id){
    // The normal translation route is deliberately blocked during review.
    // Read only the frozen respondent views already visible to this client.
    const configured=state.country?(projectCountryLocales(state.project)[state.country]||[]):(state.project?.locales||[]);
    const locales=[...new Set(configured.map(normalizeLocale).filter(Boolean))];
    if(!locales.length)throw new Error('Aucune langue configurée pour ce périmètre.');
    const preferred=normalizeLocale(state.project?.working_locale||state.project?.selected_locale||'fr');
    const referenceLocale=locales.includes(preferred)?preferred:locales[0];
    const versions=await Promise.all(locales.map(async locale=>{
      const query=new URLSearchParams({locale,respondentPreview:'1'});if(state.country)query.set('countryCode',state.country);
      const view=await api(`/api/projects/${projectId}/composer?${query}`);
      if(normalizeLocale(view.respondent_context?.locale)!==locale)throw new Error('La version transmise dans cette langue n’est pas disponible.');
      const situation=(view.chapters||[]).flatMap(ch=>ch.situations||[]).find(row=>String(row.id)===String(id));
      return [locale,situation];
    }));
    const byLocale=new Map(versions),reference=byLocale.get(referenceLocale);
    if(!reference)throw new Error('La situation transmise n’est pas disponible pour ce périmètre.');
    const answers=(reference.answers||[]).map(answer=>({id:answer.id,content:answer.content||''}));
    const translations=Object.fromEntries(versions.map(([locale,situation])=>[locale,{
      content:situation?.content||'',status:String(situation?.content||'').trim()?'submitted':'missing',
      answers:answers.map(answer=>{const translated=situation?.answers?.find(row=>String(row.id)===String(answer.id));return {id:answer.id,content:translated?.content||'',status:String(translated?.content||'').trim()?'submitted':'missing'};})
    }]));
    return {referenceLocale,locales,reference:{content:reference.content||'',answers},translations,sourceCustomized:false,worldwide:false,readOnly:true};
  }
  async function getTranslationContext(id,refresh=false){const key=`${id}:${state.country||''}`;if(!refresh&&state.translationContexts.has(key))return state.translationContexts.get(key);const countryParam=state.country?`?countryCode=${encodeURIComponent(state.country)}`:'';const ctx=!isAdmin&&state.project?.can_edit===false&&!isLegacyClientCampaign(state.project)?await getReadOnlyTranslationContext(id):await api(`/api/projects/${projectId}/situations/${id}/translations${countryParam}`);state.translationContexts.set(key,ctx);return ctx;}
  async function openTranslationModal(id,preferredLocale=''){const ctx=await getTranslationContext(id,true),legacyReadOnly=isLegacyClientCampaign()&&state.project?.can_edit===false,translationReadOnly=state.project?.can_edit===false||ctx.readOnly===true,countryAllowed=state.country?(projectCountryLocales(state.project)[state.country]||[]):[],ctxLocales=[...new Set((ctx.locales||[]).map(loc=>String(loc||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))],scopedLocales=countryAllowed.length?ctxLocales.filter(loc=>countryAllowed.includes(loc)):ctxLocales,referenceLocale=!isLegacyClientCampaign()?(ctx.referenceLocale||'fr'):(['fr','en','es'].find(loc=>scopedLocales.includes(loc))||scopedLocales[0]||ctx.referenceLocale||'fr'),reference=ctx.reference||{},targets=scopedLocales.filter(x=>x!==referenceLocale);if(!targets.length)return;const overlay=document.createElement('div');overlay.className='translation-overlay';overlay.innerHTML=`<section class="translation-modal" role="dialog" aria-modal="true"><header class="translation-head"><div><small>${legacyReadOnly?'VERSIONS LINGUISTIQUES DE LA CAMPAGNE HISTORIQUE':translationReadOnly?'VERSIONS LINGUISTIQUES · LECTURE SEULE':'TRADUCTION ET ADAPTATION LOCALE ÉVENTUELLE'}</small><h2>Comparer avec la langue de référence</h2></div><button class="translation-close" type="button" aria-label="Fermer">×</button></header><div class="translation-toolbar"><strong>${translationReadOnly?'Langue à consulter':'Langue / adaptation à vérifier'}</strong><select data-translation-locale>${targets.map(l=>`<option value="${esc(l)}" ${l===(preferredLocale||'en')?'selected':''}>${esc(localeLabel(l))}</option>`).join('')}</select><span data-translation-status></span></div>${ctx.worldwide&&state.country?`<div class="composer-shared-translation-note"><strong>Contenu commun à plusieurs pays.</strong> Seules les langues de ${esc(countryLabel(state.country))} sont affichées. Toute modification d’une traduction partagée s’applique aussi aux autres pays qui utilisent cette langue.</div>`:''}<div class="translation-grid"><section class="translation-pane reference" data-reference-pane></section><section class="translation-pane" data-target-pane></section></div><footer class="translation-foot"><button class="button button-ghost" type="button" data-cancel>${translationReadOnly?'Fermer':'Annuler'}</button>${translationReadOnly?'':'<button class="button button-primary" type="button" data-save-translation>Enregistrer et fermer</button>'}</footer></section>`;document.body.appendChild(overlay);const close=()=>{overlay.remove();const saved=state.translationContexts.get(`${id}:${state.country||''}`);if(saved)updateSituationTranslationAlerts(id,saved);};overlay.querySelector('.translation-close').onclick=close;overlay.querySelector('[data-cancel]').onclick=close;const select=overlay.querySelector('[data-translation-locale]');if(targets.includes(preferredLocale))select.value=preferredLocale;const referencePane=overlay.querySelector('[data-reference-pane]'),target=overlay.querySelector('[data-target-pane]');
    const statusLabel=status=>status==='submitted'?'Version transmise':status==='missing'?'À compléter':status==='client_version'?'Personnalisée':'Traduction Me&YouToo';
    // La référence legacy est propre au pays actif, et non au FR global du survey.
    // Elle doit utiliser le texte ET les réponses de la même version linguistique.
    const referenceVersion=ctx.translations?.[referenceLocale];
    const rawReferenceAnswers=Array.isArray(reference.answers)?reference.answers:[];
    const translatedReferenceAnswers=rawReferenceAnswers.map(answer=>{
      const translated=(referenceVersion?.answers||[]).find(item=>String(item.id)===String(answer.id));
      return {...answer,content:translated?.content||''};
    });
    // Ne pas déguiser un contenu FR en référence EN si la traduction est absente.
    const hasTranslatedReference=Boolean(String(referenceVersion?.content||'').trim())
      &&translatedReferenceAnswers.every(answer=>String(answer.content||'').trim());
    const sourceReferenceLocale=normalizeLocale(ctx.referenceLocale||'fr');
    const sourceIsReference=referenceLocale===sourceReferenceLocale;
    const displayedReferenceContent=hasTranslatedReference
      ?referenceVersion.content:(sourceIsReference?reference.content||'':'');
    const displayedReferenceAnswers=hasTranslatedReference
      ?translatedReferenceAnswers:(sourceIsReference?rawReferenceAnswers:[]);
    const referenceUnavailable=!displayedReferenceContent
      ||displayedReferenceAnswers.length!==rawReferenceAnswers.length;
    function draw(){const loc=select.value,t=ctx.translations?.[loc]||{answers:[]};const answerStates=(reference.answers||[]).map(a=>(t.answers||[]).find(x=>String(x.id)===String(a.id))||{status:'missing'});const incomplete=t.status==='missing'||answerStates.some(a=>a.status==='missing');const stale=Boolean(ctx.sourceCustomized);const overall=incomplete?'Traduction incomplète':ctx.readOnly?'Version transmise':t.status==='client_version'||answerStates.some(a=>a.status==='client_version')?'Personnalisée':'Traduction Me&YouToo';referencePane.innerHTML=`<h3>Texte de référence</h3>${campaignCountries(state.project).length>1?`<p class="translation-local-note">Vous comparez les versions utilisées pour ${esc(countryLabel(state.country))}.</p>`:''}${referenceUnavailable?'<p class="translation-sync-warning">La version de référence pour ce périmètre est incomplète. Vérifiez les traductions historiques.</p>':''}<div class="translation-reference-text">${esc(displayedReferenceContent)}</div><h4>Réponses</h4>${displayedReferenceAnswers.map((a,i)=>`<div class="translation-answer"><strong>Réponse ${i+1}</strong><div class="translation-reference-text">${esc(a.content)}</div></div>`).join('')}`;target.innerHTML=`<h3>${esc(localeLabel(loc))}<span class="translation-status ${incomplete?'is-incomplete':''}">${stale?'À vérifier':overall}</span></h3>${stale&&!isLegacyClientCampaign()?`<div class="translation-sync-warning">⚠️ Le texte de référence a été modifié. Vérifiez cette traduction et son adaptation locale éventuelle.</div>`:''}<div class="translation-local-note">${legacyReadOnly?'Version historique importée en lecture seule.':translationReadOnly?'Vous consultez la dernière version transmise à Me&YouToo, en lecture seule.':'Cette modification concerne uniquement la langue affichée. Une correction de traduction peut rester locale. Si vous changez le sens ou ajoutez une information, pensez à adapter les autres langues de diffusion. Les autres versions ne sont pas actualisées automatiquement.'}</div><div class="translation-field-head"><strong>Situation</strong><span class="translation-status">${statusLabel(t.status||'missing')}</span></div><textarea rows="4" data-target-content placeholder="Traduction / adaptation à compléter" ${translationReadOnly?'readonly':''}>${esc(t.content||'')}</textarea><h4>Réponses</h4>${(reference.answers||[]).map((a,i)=>{const ta=answerStates[i];return `<div class="translation-answer"><div class="translation-field-head"><strong>Réponse ${i+1}</strong><span class="translation-status">${statusLabel(ta.status||'missing')}</span></div><textarea rows="2" data-target-answer="${esc(a.id)}" placeholder="Traduction / adaptation à compléter" ${translationReadOnly?'readonly':''}>${esc(ta.content||'')}</textarea></div>`}).join('')}`;}
    function updateTranslationDiffs(){
      if(translationReadOnly)return;
      const inputs=[...target.querySelectorAll('[data-target-content],[data-target-answer]')],filled=inputs.filter(input=>input.value.trim()).length;
      const liveStatus=target.querySelector('h3 .translation-status');
      if(liveStatus){liveStatus.classList.toggle('is-incomplete',filled<inputs.length);liveStatus.textContent=filled<inputs.length?`${filled?'Traduction incomplète':'Traduction manquante'} · ${inputs.length-filled} champ(s) à compléter`:'Complète · à enregistrer';}
      const t=ctx.translations?.[select.value]||{answers:[]};
      for(const input of target.querySelectorAll('[data-target-content],[data-target-answer]')){
        const row=input.hasAttribute('data-target-content')?t:(t.answers||[]).find(a=>String(a.id)===input.dataset.targetAnswer)||{};
        let host=input.nextElementSibling;
        if(!host?.hasAttribute('data-client-translation-diff')){host=document.createElement('div');host.setAttribute('data-client-translation-diff','');input.after(host);}
        const known=row.reference!==null&&row.reference!==undefined,baseline=known?row.reference:row.content||'';
        host.innerHTML=(!known&&row.status==='client_version'?'<small>Texte antérieur non enregistré. Les couleurs indiquent les changements depuis l’ouverture de cette fenêtre.</small>':'')+diffBlock(baseline,input.value,known?'Vos modifications dans cette langue · ajouts en vert':'Modifications depuis l’ouverture · ajouts en vert');
      }
    }
    const drawWithDiffs=()=>{draw();updateTranslationDiffs();};
    target.addEventListener('input',updateTranslationDiffs);
    select.onchange=drawWithDiffs;drawWithDiffs();const saveButton=overlay.querySelector('[data-save-translation]');if(saveButton)saveButton.onclick=async()=>{if(translationReadOnly)return;const loc=select.value,content=target.querySelector('[data-target-content]').value.trim(),answers=[...target.querySelectorAll('[data-target-answer]')].map(x=>({id:Number(x.dataset.targetAnswer),content:x.value.trim()}));try{await api(`/api/projects/${projectId}/situations/${id}/translations/${encodeURIComponent(loc)}${state.country?`?countryCode=${encodeURIComponent(state.country)}`:""}`,{method:'PATCH',body:JSON.stringify({content,answers})});state.translationContexts.delete(`${id}:${state.country||''}`);const updated=await getTranslationContext(id,true);updateSituationTranslationAlerts(id,updated);close();showMessage(`${localeLabel(loc)} · traduction enregistrée. Si vous avez changé le sens ou ajouté une information, pensez à adapter les autres langues de diffusion.`,'success');}catch(e){showMessage(e.message);}};
  }

  function findSituation(id){return state.chapters.flatMap(ch=>ch.situations).find(s=>String(s.id)===String(id));}
  function refreshLiveDiff(card,s,situationText,answers){
    const situationOriginal=String(s.original_content_localized||s.original_content||card.querySelector('[data-situation-input]')?.dataset.originalSituation||'');
    const situationDiff=card.querySelector('[data-live-situation-diff]');
    const situationInput=card.querySelector('[data-situation-input]');
    const situationChanged=situationOriginal!==String(situationText||'');
    const submitted=submittedSituation(s.id);if(situationDiff)situationDiff.innerHTML=(situationChanged||state.project?.review_mode)?reviewDiff(situationOriginal,submitted?.content,situationText,'la situation Me&YouToo'):'';
    if(situationInput)situationInput.classList.toggle('is-customized',situationChanged);

    let anyChanged=situationChanged;
    answers.forEach(item=>{
      const input=card.querySelector(`[data-answer-input="${CSS.escape(String(item.id))}"]`);
      if(!input)return;
      const answerState=(s.answers||[]).find(a=>String(a.id)===String(item.id));
      const originalState=(s.original_answers||[]).find(a=>String(a.id)===String(item.id));
      const original=String(originalState?.content||input.dataset.originalAnswer||answerState?.content||'');
      const changed=original!==String(item.content||'');
      anyChanged=anyChanged||changed;
      input.closest('.composer-answer')?.classList.toggle('is-customized',changed);
      const diff=card.querySelector(`[data-live-answer-diff="${CSS.escape(String(item.id))}"]`);
      const sent=(submitted?.answers||[]).find(answer=>String(answer.id)===String(item.id));if(diff)diff.innerHTML=(changed||state.project?.review_mode)?reviewDiff(original,sent?.content??null,item.content,'la réponse Me&YouToo'):'';
    });
    card.classList.toggle('has-customization',anyChanged);
    return anyChanged;
  }

  async function saveInlineSituation(id){
    if(!id)return;
    clearTimeout(autosaveTimers.get(String(id)));autosaveTimers.delete(String(id));
    const s=findSituation(id),card=document.querySelector(`[data-situation-card="${CSS.escape(String(id))}"]`);
    if(!s||!card)return;
    const situationInput=card.querySelector('[data-situation-input]');
    const answerInputs=[...card.querySelectorAll('[data-answer-input]')];
    const situationText=String(situationInput?.value||'').trim();
    const answers=answerInputs.map(input=>({id:Number(input.dataset.answerInput),content:String(input.value||'').trim()}));
    if(!situationText){setSaveStatus(card,'is-error','Non enregistré · le texte ne peut pas être vide');return;}
    if(answerInputs.some(input=>!String(input.value||'').trim())){setSaveStatus(card,'is-error','Non enregistré · une réponse est vide');return;}
    setSaveStatus(card,'is-saving','Enregistrement…');
    try{
      const translationView=translationViewForSituation(s);
      if(translationView&&isLegacyClientCampaign(state.project)&&state.project?.can_edit!==false){
        await api(`/api/projects/${projectId}/situations/${id}/translations/${encodeURIComponent(translationView.targetLocale)}`,{method:'PATCH',body:JSON.stringify({content:situationText,answers})});
        await getTranslationContext(id,true);
        setSaveStatus(card,'is-saved',`${localeLabel(translationView.targetLocale)} · traduction enregistrée`);
        return;
      }
      const saved=await api(`/api/projects/${projectId}/situations/${id}`,{method:'PATCH',body:JSON.stringify({customContent:situationText,customAnswers:answers})});
      if(!saved?.situation)throw new Error('La sauvegarde n’a pas été confirmée par le serveur.');
      const hasCustomization=refreshLiveDiff(card,s,situationText,answers);
      s.custom_content=saved.situation.custom_content;
      s.custom_answers=saved.situation.custom_answers;
      s.content=situationText;
      s.answers=(s.answers||[]).map(answer=>({...answer,content:answers.find(item=>String(item.id)===String(answer.id))?.content||answer.content}));
      s.has_customization=hasCustomization;
      setSaveStatus(card,'is-saved','Enregistré');
      const tags=card.querySelector('.composer-situation-tags');
      const customTag=tags?.querySelector('.composer-customized-tag');
      if(hasCustomization&&!customTag)tags?.insertAdjacentHTML('beforeend','<span class="composer-customized-tag">✎ Personnalisée</span>');
      if(!hasCustomization&&customTag)customTag.remove();
      if(hasCustomization&&!card.querySelector('[data-reset]')){
        const actions=card.querySelector('.composer-actions');
        if(actions)actions.insertAdjacentHTML('afterbegin',`<button class="button button-ghost" type="button" data-reset="${esc(id)}">↶ ${state.project?.review_mode?'Annuler ma correction':'Annuler mes modifications'}</button>`);
        const reset=card.querySelector('[data-reset]');if(reset)reset.onclick=()=>resetSituationCustomization(id);
      }
    }catch(e){
      setSaveStatus(card,'is-error',`Non enregistré · ${e.message||'erreur serveur'}`);
    }
  }
  async function returnToReview(){
    const ids=(state.chapters[state.active]?.situations||[]).map(s=>String(s.id));
    await Promise.all(ids.map(id=>saveInlineSituation(id)));
    location.href=`validation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}`;
  }

  async function resetSituationCustomization(id){
    const s=findSituation(id);if(!s)return;
    if(state.project?.review_mode){const submitted=submittedSituation(id);if(!submitted||!Array.isArray(submitted.answers)){await window.StudioModal.alert({eyebrow:'Correction Me&YouToo',title:'Version client détaillée indisponible',message:'Cette transmission est antérieure au nouvel historique détaillé. Pour protéger les modifications du client, aucune donnée ne sera effacée automatiquement.',type:'info',confirmLabel:'J’ai compris'});return;}const confirmed=await window.StudioModal.confirm({eyebrow:'Correction Me&YouToo',title:'Annuler uniquement votre correction ?',message:'La situation et ses réponses reviendront exactement à la version transmise par le client.',type:'warning',cancelLabel:'Conserver ma correction',confirmLabel:'Restaurer la version client'});if(!confirmed)return;try{await api(`/api/projects/${projectId}/situations/${id}`,{method:'PATCH',body:JSON.stringify({customContent:submitted.content,customAnswers:submitted.answers.map(answer=>({id:answer.id,content:answer.content}))})});const refreshed=await api(`/api/projects/${projectId}/composer`);state.project=refreshed.project;state.chapters=refreshed.chapters;render();showMessage('La version transmise par le client a été restaurée.','success');}catch(e){showMessage(e.message);}return;}
    const confirmed=await window.StudioModal.confirm({
      eyebrow:'Personnalisation',
      title:'Revenir à la version Me&YouToo ?',
      message:'Le texte de la mise en situation et les réponses retrouveront leur formulation d’origine. Le choix de cette situation dans votre diagnostic sera conservé.',
      type:'warning',
      cancelLabel:'Conserver mes modifications',
      confirmLabel:'Revenir à l’original'
    });
    if(!confirmed)return;
    try{
      await api(`/api/projects/${projectId}/situations/${id}`,{method:'PATCH',body:JSON.stringify({resetCustomizations:true})});
      const refreshed=await api(`/api/projects/${projectId}/composer`);
      state.project=refreshed.project;state.chapters=refreshed.chapters;render();
      showMessage('La formulation Me&YouToo d’origine a été restaurée.','success');
    }catch(e){showMessage(e.message);}
  }
  async function removeSituation(id){const ch=state.chapters[state.active],s=findSituation(id);if(!canRemoveSituation(s,ch)){showMessage('Suppression impossible : le minimum de situations du catalogue doit être conservé.');return;}const linked=Boolean(s&&s.metadata&&s.metadata.link_group);const confirmed=await window.StudioModal.confirm({eyebrow:'Composition du diagnostic',title:linked?'Supprimer ces situations liées ?':'Supprimer cette situation ?',message:linked?'Cette situation fonctionne avec une autre mise en situation. Les deux seront retirées ensemble de ce chapitre. Cette action concerne uniquement ce brouillon.':'Cette mise en situation sera retirée de ce chapitre. Elle restera disponible dans le référentiel Me&YouToo.',type:'danger',cancelLabel:'Conserver',confirmLabel:linked?'Supprimer les situations':'Supprimer la situation'});if(!confirmed)return;try{const data=await api(`/api/projects/${projectId}/situations/${id}`,{method:'DELETE'});const deleted=new Set((data.deletedIds||[id]).map(String));ch.situations=ch.situations.filter(s=>!deleted.has(String(s.id)));state.libraryAvailability.clear();render();showMessage(data.linked?'Les situations liées ont été supprimées ensemble.':'La situation a été supprimée du brouillon.','success');}catch(e){showMessage(e.message);}}

  function currentCatalogIds(){return new Set(state.chapters.flatMap(ch=>ch.situations).flatMap(s=>[String(s.catalog_situation_id||''),String(s.source_id||''),String(s.metadata?.duplicate_of_source_id||''),canonical(s.content)]).filter(Boolean));}
  function availableLibrarySituations(situations){
    const existing=currentCatalogIds();
    return (Array.isArray(situations)?situations:[]).filter(s=>![String(s.id||''),String(s.source_id||''),String(s.metadata?.duplicate_of_source_id||''),canonical(s.content)].filter(Boolean).some(k=>existing.has(k)));
  }
  function libraryReplacementCandidates(ch,adding){
    if(state.project?.can_edit===false||(!isAdmin&&(ch.locked||isStereotypesChapter(ch))))return [];
    const {rules,count}=chapterCountStatus(ch);
    const seen=new Set();
    return ch.situations.flatMap((s,index)=>{
      const group=s.metadata?.link_group;
      if(group&&seen.has(group))return [];
      if(group)seen.add(group);
      const removing=group?ch.situations.filter(item=>item.metadata?.link_group===group).length:1;
      const next=count-removing+adding;
      if((rules.min!=null&&next<rules.min)||(rules.max!=null&&next>rules.max))return [];
      return [{s,index,removing}];
    });
  }
  function libraryCardActions(entry,mode){
    const linked=entry.members.length>1,id=esc(entry.primary.id);
    if(mode==='replace')return `<button class="button button-primary" type="button" data-library-pick="${id}">${linked?`Remplacer par ces ${entry.members.length} situations`:'Remplacer par cette situation'}</button>`;
    const ch=state.chapters[state.active],{rules,count}=chapterCountStatus(ch);
    if(rules.max==null||count+entry.members.length<=rules.max)return `<button class="button button-primary" type="button" data-library-pick="${id}">${linked?`Ajouter les ${entry.members.length} situations au chapitre`:'Ajouter au chapitre'}</button>`;
    const candidates=libraryReplacementCandidates(ch,entry.members.length);
    if(!candidates.length)return '<p>Cette sélection peut être consultée, mais aucun remplacement ne permet de respecter les limites de ce chapitre.</p>';
    return `<details class="composer-library-replacement"><summary>Remplacer une situation par cette sélection</summary><p>Votre chapitre est limité à ${rules.max} situations. Choisissez ce que vous souhaitez remplacer. Rien ne change avant votre confirmation.</p><label for="library-replace-${id}">Situation à remplacer</label><select id="library-replace-${id}" data-library-replace-target><option value="">Choisir une situation du chapitre…</option>${candidates.map(({s,index,removing})=>`<option value="${esc(s.id)}">Situation ${index+1}${removing>1?` et sa sélection liée (${removing} situations)`:''} : ${esc(s.custom_content||s.content||s.original_content||'')}</option>`).join('')}</select><button class="button button-primary" type="button" data-library-replace="${id}" disabled>Confirmer le remplacement</button></details>`;
  }
  async function openLibrary(mode='add',replaceId=''){
    const ch=state.chapters[state.active];if(!chapterHasLibrary(ch))return;state.libraryMode=mode;state.replaceId=replaceId;
    try{
      const data=await api(`/api/catalog/themes/${themeSlug}/library?chapterId=${encodeURIComponent(ch.catalog_chapter_id||ch.id)}&projectId=${encodeURIComponent(projectId)}&countryCode=${encodeURIComponent(state.country||'')}`);
      state.library=availableLibrarySituations(data?.situations);
      $('library-title').textContent=mode==='replace'?`Remplacer une situation · ${ch.title}`:`Bibliothèque · ${ch.title}`;

      const seenGroups=new Set(),entries=[];
      for(const s of state.library){
        const group=s.metadata?.link_group||'';
        if(group&&seenGroups.has(group))continue;
        if(group)seenGroups.add(group);
        const members=group&&Array.isArray(s.linked_situations)&&s.linked_situations.length?s.linked_situations:[s];
        entries.push({primary:s,members});
      }

      const renderLibraryEntries=(query='')=>{
        const q=String(query||'').trim().toLowerCase();
        const filtered=entries.filter(entry=>!q||entry.members.some(m=>[m.content,...(Array.isArray(m.admin_tags)?m.admin_tags:[])].join(' ').toLowerCase().includes(q)));
        $('library-list').innerHTML=filtered.length?filtered.map((entry,index)=>{
          const linked=entry.members.length>1;
          const label=linked?`${entry.members.length} situations liées · à sélectionner ensemble`:'Situation disponible';
          const body=entry.members.map((m,mi)=>{const tags=Array.isArray(m.admin_tags)?m.admin_tags.filter(Boolean):[];return `<section class="composer-library-linked-item">${linked?`<div class="composer-library-linked-title">Situation ${mi+1}/${entry.members.length}</div>`:''}<h3>${esc(m.content)}</h3>${tags.length?`<div class="composer-library-keywords">${tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>`:''}<details><summary>Consulter les réponses et les scores</summary>${(m.answers||[]).map(a=>answerHtml(a,false,'')).join('')}</details></section>`;}).join('');
          return `<article class="composer-library-card composer-library-bundle tone-${index%4+1}"><div class="composer-library-number">${String(index+1).padStart(2,'0')}</div><div class="composer-library-content"><div class="composer-library-label">${label}</div>${body}${libraryCardActions(entry,mode)}</div></article>`;
        }).join(''):`<div class="composer-library-empty"><strong>${q?'Aucune situation trouvée':state.library.length?'Aucune situation trouvée':'Aucune situation complémentaire disponible'}</strong><p>${q?'Modifiez votre recherche.':(data.situations||[]).length?'Les situations proposées pour ce chapitre et ce périmètre sont déjà présentes dans votre campagne.':'Aucune situation complémentaire n’est actuellement proposée pour ce chapitre et le périmètre sélectionné. Le nombre affiché sur la carte du catalogue concerne l’ensemble de la thématique. Vous pouvez consulter les autres chapitres ou contacter Me&YouToo.'}</p></div>`;
        document.querySelectorAll('[data-library-pick]').forEach(b=>b.onclick=()=>mode==='replace'?replaceSituation(replaceId,b.dataset.libraryPick):addSituation(b.dataset.libraryPick));
        document.querySelectorAll('[data-library-replace]').forEach(b=>{
          const select=b.closest('.composer-library-replacement').querySelector('[data-library-replace-target]');
          select.onchange=()=>{b.disabled=!select.value;};
          b.onclick=async()=>{
            const candidate=libraryReplacementCandidates(ch,entries.find(entry=>String(entry.primary.id)===b.dataset.libraryReplace)?.members.length||1).find(item=>String(item.s.id)===select.value);
            if(!candidate)return;
            const confirmed=await window.StudioModal.confirm({eyebrow:'Composition du diagnostic',title:'Confirmer ce remplacement ?',message:`La situation ${candidate.index+1}${candidate.removing>1?' et sa sélection liée':''} sera remplacée par votre sélection de la bibliothèque. Ses personnalisations éventuelles seront retirées de ce brouillon.`,type:'warning',cancelLabel:'Continuer à consulter',confirmLabel:'Remplacer'});
            if(confirmed)await replaceSituation(select.value,b.dataset.libraryReplace);
          };
        });
      };
      const librarySearch=$('library-search');if(librarySearch){librarySearch.value='';librarySearch.oninput=()=>renderLibraryEntries(librarySearch.value);}
      renderLibraryEntries('');

      $('library-backdrop').hidden=false;$('library-drawer').classList.add('is-open');$('library-drawer').setAttribute('aria-hidden','false');
    }catch(e){showMessage(e.message);}
  }
  function closeLibrary(){$('library-backdrop').hidden=true;$('library-drawer').classList.remove('is-open');$('library-drawer').setAttribute('aria-hidden','true');}
  async function addSituation(catalogSituationId){
    const ch=state.chapters[state.active],status=chapterCountStatus(ch);
    if(status.atMax){
      showMessage(`Ce chapitre est limitée à ${status.rules.max} situations maximum.`);
      return;
    }
    try{
      const data=await api(`/api/projects/${projectId}/chapters/${ch.id}/situations`,{method:'POST',body:JSON.stringify({catalogSituationId:Number(catalogSituationId),countryCode:state.country})});
      const added=(data.situations||[data.situation]).filter(Boolean);
      if(status.rules.max!=null&&ch.situations.length+added.length>status.rules.max){
        showMessage(`Cette sélection dépasserait le maximum de ${status.rules.max} situations.`);
        return;
      }
      ch.situations.push(...added);
      state.libraryAvailability.clear();
      closeLibrary();render();
      showMessage(data.linked?'Les situations liées ont été ajoutées et enregistrées ensemble.':'La situation a été ajoutée et enregistrée dans le brouillon.','success');
      await afterLibrarySelection(added.map(s=>s.id));
    }catch(e){showMessage(e.message);}
  }
  async function replaceSituation(projectSituationId,catalogSituationId){
    if(state.librarySaving)return;
    state.librarySaving=true;
    const drawer=$('library-drawer');
    const buttons=[...drawer.querySelectorAll('[data-library-pick],[data-library-replace]')];
    const previous=buttons.map(button=>({button,disabled:button.disabled,text:button.textContent}));
    drawer.querySelector('[data-library-error]')?.remove();
    buttons.forEach(button=>{button.disabled=true;});
    const clicked=buttons.find(button=>(button.dataset.libraryPick||button.dataset.libraryReplace)===String(catalogSituationId));
    if(clicked)clicked.textContent='Remplacement en cours…';
    try{
      const beforeIds=new Set(state.chapters.flatMap(ch=>ch.situations).map(s=>String(s.id)));
      const data=await api(`/api/projects/${projectId}/situations/${projectSituationId}/replace`,{method:'PATCH',body:JSON.stringify({catalogSituationId:Number(catalogSituationId),countryCode:state.country})});
      closeLibrary();
      const refreshed=await api(`/api/projects/${projectId}/composer`);
      state.project=refreshed.project;state.chapters=refreshed.chapters;
      state.libraryAvailability.clear();render();
      showMessage(data.linked?'La sélection liée a été remplacée et enregistrée ensemble.':'La situation a été remplacée et enregistrée.','success');
      await afterLibrarySelection([projectSituationId,...state.chapters.flatMap(ch=>ch.situations).filter(s=>!beforeIds.has(String(s.id))).map(s=>s.id)]);
    }catch(e){
      showMessage(e.message);
      const alert=document.createElement('div');
      alert.className='composer-alert';alert.dataset.libraryError='';alert.setAttribute('role','alert');
      alert.textContent=`Le remplacement n’a pas pu être terminé : ${e.message}`;
      $('library-list').prepend(alert);alert.scrollIntoView({block:'nearest'});
    }finally{
      state.librarySaving=false;
      previous.forEach(({button,disabled,text})=>{button.disabled=disabled;button.textContent=text;});
    }
  }

  async function changeWholeChapter(catalogChapterId){
    const ch=state.chapters[state.active];
    const target=(ch.alternatives||[]).find(option=>String(option.id)===String(catalogChapterId));
    if(!target||target.selected)return;
    const confirmed=await window.StudioModal.confirm({
      eyebrow:'Choix du chapitre',
      title:`Remplacer « ${ch.title} » par « ${target.title} » ?`,
      message:'Ce choix remplace le chapitre entier : situations, réponses, scoring et profils associés. Les personnalisations déjà réalisées dans ce chapitre seront supprimées.',
      type:'warning',
      cancelLabel:'Conserver le chapitre actuel',
      confirmLabel:'Choisir ce chapitre'
    });
    if(!confirmed)return;
    try{
      await api(`/api/projects/${projectId}/chapters/${ch.id}/catalog-choice`,{method:'PATCH',body:JSON.stringify({catalogChapterId:Number(target.id)})});
      const refreshed=await api(`/api/projects/${projectId}/composer`);
      state.project=refreshed.project;state.chapters=refreshed.chapters;
      state.active=Math.min(state.active,state.chapters.length-1);
      render();
      showMessage(`Le chapitre « ${target.title} » a été sélectionné avec ses situations, réponses et profils.`,'success');
    }catch(e){showMessage(e.message);}
  }

  function renderChapterChoice(){
    const box=$('chapter-choice');if(!box)return;
    // Le choix des chapitres alternatifs est fait avant Composer dans le wizard.
    // Composer doit uniquement afficher et personnaliser le parcours déjà retenu :
    // on ne repropose jamais ici des alternatives potentiellement incompatibles
    // avec les périmètres/langues choisis pour la campagne.
    box.hidden=true;
    box.innerHTML='';
  }

  // Les administrateurs corrigent aussi les titres des campagnes Legacy.
  async function openChapterTitleTranslations(chapter){
    if(!chapter)return;
    let data;
    try{data=await api(`/api/projects/${projectId}/chapters/${chapter.id}/title-translations`);}
    catch(error){showMessage(`Titres de chapitres : ${error.message}`);return;}
    const working=String(data.workingLocale||state.project?.working_locale||'fr').toLowerCase().replaceAll('_','-');
    const languages=[...new Set((Array.isArray(data.locales)?data.locales:[]).map(loc=>String(loc||'').toLowerCase().replaceAll('_','-')).filter(Boolean))].filter(loc=>loc!==working);
    const records=Array.isArray(data.translations)?data.translations:[];
    const getTranslation=loc=>records.filter(t=>String(t.locale||'').toLowerCase().replaceAll('_','-')===loc&&(!t.country_code||String(t.country_code).trim()==='')).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0];
    const overlay=document.createElement('div');overlay.className='translation-overlay';
    const canEdit=isAdmin||(!isLegacyClientCampaign()&&state.project?.can_edit!==false);
    overlay.innerHTML=`<section class="translation-modal chapter-title-modal" role="dialog" aria-modal="true" aria-label="Traductions du titre de chapitre"><header class="translation-head"><div><small>COMPOSER · CHAPITRE ${esc(chapter.position??'')}</small><h2>Traductions du titre</h2></div><button class="translation-close" type="button" aria-label="Fermer">×</button></header><div class="chapter-title-modal-content"><p class="chapter-title-info">${canEdit?'Les modifications sont enregistrées uniquement dans cette campagne. Le Catalogue Me&YouToo et les autres campagnes restent inchangés.':'Vous consultez les titres dans les langues de votre campagne. Pour demander une correction, contactez Me&YouToo.'}</p><div class="chapter-title-reference"><label for="chapter-reference-title">Titre de référence · ${esc(localeLabel(working))}</label><input id="chapter-reference-title" type="text" maxlength="300" value="${esc(data.referenceTitle||chapter.title)}" ${isAdmin?'':'readonly'}><small>${isAdmin?'Vous seul pouvez modifier le titre de référence.':'Le titre de référence est réservé à l’administrateur Me&YouToo.'}</small>${isAdmin?'<button class="button button-secondary button-small" type="button" data-save-reference>Enregistrer le titre de référence</button>':''}</div><div class="chapter-title-translation-fields">${languages.length?languages.map(loc=>{const t=getTranslation(loc),value=String(t?.title??t?.content?.title??'');return `<div class="chapter-title-translation-field"><label for="chapter-title-locale-${esc(loc)}">${esc(localeLabel(loc))} (${esc(loc.toUpperCase())})</label><input id="chapter-title-locale-${esc(loc)}" type="text" maxlength="300" data-chapter-title-locale="${esc(loc)}" value="${esc(value)}" placeholder="${canEdit?'Traduction à compléter':'Titre non renseigné'}" ${canEdit?'':'readonly'}><small data-chapter-title-status="${esc(loc)}">${t?.validation_status==='client_version'?'Version personnalisée':t?.validation_status==='historical_source'?'Titre conservé dans la source Legacy':value?'Traduction Me&YouToo':'Traduction manquante'}</small>${canEdit?`<button class="button button-secondary button-small" type="button" data-save-chapter-locale="${esc(loc)}">Enregistrer ${esc(loc.toUpperCase())}</button>`:''}</div>`}).join(''):'<p>Aucune langue de diffusion supplémentaire n’est active dans cette campagne.</p>'}</div><p class="chapter-title-modal-status" data-chapter-title-feedback role="status" aria-live="polite"></p></div><footer class="translation-foot"><button class="button button-ghost" type="button" data-close-chapter-title>Fermer</button></footer></section>`;
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.querySelector('.translation-close').onclick=close;
    overlay.querySelector('[data-close-chapter-title]').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    const feedback=overlay.querySelector('[data-chapter-title-feedback]');
    const setFeedback=(message,failed=false)=>{feedback.textContent=message;feedback.classList.toggle('is-error',failed);};
    overlay.querySelectorAll('[data-save-chapter-locale]').forEach(button=>button.onclick=async()=>{
      const loc=button.dataset.saveChapterLocale;
      const title=overlay.querySelector(`[data-chapter-title-locale="${loc}"]`)?.value?.trim()||'';
      if(!title){setFeedback('Renseignez une traduction avant de l’enregistrer.',true);return;}
      button.disabled=true;setFeedback('Enregistrement…');
      try{
        await api(`/api/projects/${projectId}/chapters/${chapter.id}/title-translations/${encodeURIComponent(loc)}`,{method:'PATCH',body:JSON.stringify({title})});
        overlay.querySelector(`[data-chapter-title-status="${loc}"]`).textContent='Version personnalisée';
        setFeedback(`Traduction ${loc.toUpperCase()} enregistrée uniquement dans cette campagne.`);
      }catch(error){setFeedback(error.message,true);}finally{button.disabled=false;}
    });
    const saveReference=overlay.querySelector('[data-save-reference]');
    if(saveReference)saveReference.onclick=async()=>{
      const title=overlay.querySelector('#chapter-reference-title')?.value?.trim()||'';
      if(!title){setFeedback('Renseignez le titre de référence.',true);return;}
      saveReference.disabled=true;setFeedback('Enregistrement…');
      try{
        await api(`/api/admin/projects/${projectId}/chapters/${chapter.id}/reference-title`,{method:'PATCH',body:JSON.stringify({title})});
        chapter.title=title;render();setFeedback('Titre de référence enregistré dans cette campagne.');
      }catch(error){setFeedback(error.message,true);}finally{saveReference.disabled=false;}
    };
  }

  function render(){
    const ch=state.chapters[state.active];if(!ch)return;
    const stereotypes=isStereotypesChapter(ch),status=chapterCountStatus(ch);
    const methodologyLocked=Boolean(stereotypes&&!isAdmin);
    const hasLibrary=chapterHasLibrary(ch);
    const guidance=document.querySelector('.composer-customization-guidance');
    const objective=document.querySelector('.creation-objective');
    if(guidance){
      if(methodologyLocked){
        guidance.innerHTML=`<div class="composer-customization-guidance-icon" aria-hidden="true">🔒</div><div><strong>Pourquoi ce chapitre est-il non modifiable ?</strong><p>Le chapitre <strong>« Stéréotypes de genre »</strong> est issu d’un <strong>programme de recherche-action mené en entreprise auprès de plusieurs centaines de collaborateurs</strong>.</p><p>Ses situations, leurs formulations, les réponses, la sélection des situations et les profils associés ont été construits comme un <strong>ensemble méthodologique</strong>. Les modifier ferait perdre la cohérence de la mesure et la comparabilité des résultats.</p><p>Ce chapitre est donc <strong>consultable mais non modifiable par les clients</strong>, partout où il est utilisé dans le Studio Me&YouToo.</p></div>`;
      }else{
        guidance.innerHTML=`<div class="composer-customization-guidance-icon" aria-hidden="true">✎</div><div><strong>Personnalisez le contexte, pas le sens</strong><p>Vous pouvez adapter une mise en situation ou une réponse à votre organisation : <strong>changer un prénom</strong>, utiliser votre <strong>terminologie interne</strong>, préciser un <strong>métier</strong>, un <strong>secteur d’activité</strong> ou un <strong>contexte professionnel</strong>.</p><p><strong>À conserver impérativement :</strong> le sens de la situation, l’intention pédagogique et le niveau de pertinence des réponses. Les scores restent définis par Me&YouToo.</p>${hasLibrary?'<p class="composer-library-guidance"><strong>Le sens ne vous convient pas ?</strong> Ne réécrivez pas la situation : utilisez <strong>Remplacer</strong> pour choisir une autre mise en situation dans la bibliothèque Me&YouToo.</p>':''}<p class="composer-customization-validation">Vos adaptations seront <strong>transmises à Me&YouToo pour validation avant toute publication</strong>.</p></div>`;
      }
    }
    if(objective){
      const strong=objective.querySelector('strong'),copy=objective.querySelector('p');
      if(methodologyLocked){
        if(strong)strong.textContent='Objectif de cette étape';
        if(copy)copy.textContent='Consultez le socle méthodologique « Stéréotypes de genre ». Son contenu est conservé à l’identique dans votre autodiagnostic.';
      }else{
        if(strong)strong.textContent='Objectif de cette étape';
        if(copy)copy.textContent='Choisissez les situations de cette partie et adaptez uniquement celles qui nécessitent une contextualisation à votre organisation.';
      }
    }
    $('chapter-kicker').textContent=`Chapitre ${state.active+1} · Questions`;
    $('chapter-title').textContent=ch.title;
    const titleTranslationButton=$('chapter-title-translations-button');
    if(titleTranslationButton){
      const countries=campaignCountries(),locales=projectContentLocales();
      const clientFranceFrenchOnly=!isAdmin&&countries.length===1&&['FR','250'].includes(countries[0])&&locales.length===1&&locales[0]==='fr';
      titleTranslationButton.hidden=clientFranceFrenchOnly;
      const readOnlyTitles=!isAdmin&&(isLegacyClientCampaign()||state.project?.can_edit===false);
      titleTranslationButton.textContent=readOnlyTitles?'🌐 Voir les titres du chapitre dans toutes les langues':'🌐 Vérifier ou corriger les titres traduits du chapitre';
      const info=titleTranslationButton.closest('.chapter-title-translation-entry')?.querySelector('.chapter-title-translation-info');
      if(info)info.textContent=readOnlyTitles?'Consultez les titres dans les langues de votre campagne. Les corrections sont réservées à Me&YouToo.':'Le titre de référence est réservé à Me&YouToo. Les traductions peuvent être corrigées pour cette campagne.';
      titleTranslationButton.onclick=()=>openChapterTitleTranslations(ch);
      const entry=titleTranslationButton.closest('.chapter-title-translation-entry');
      if(entry){entry.hidden=titleTranslationButton.hidden;entry.style.display=entry.hidden?'none':'';}
    }
    const effectiveChapterLocked=methodologyLocked;
    const campaignReadOnly=Boolean(state.project?.can_edit===false&&!state.project?.review_mode);
    $('chapter-desc').textContent=effectiveChapterLocked
      ?'Ce chapitre est issu d’un programme de recherche-action mené en entreprise auprès de plusieurs centaines de collaborateurs. Il constitue un socle méthodologique Me&YouToo et n’est pas modifiable par les clients.'
      :campaignReadOnly
        ?`${status.count} situation${status.count>1?'s':''} dans cette campagne historique · consultation en lecture seule.`
      :status.rules.min!=null
        ?`${status.count} situation${status.count>1?'s':''} retenue${status.count>1?'s':''} · ${status.rules.min} minimum (base du catalogue) et ${status.rules.max} maximum dans ce chapitre.`
        :`${status.count} situations retenues · consultez les réponses et scores avant de modifier votre sélection.`;

    if(!effectiveChapterLocked&&!campaignReadOnly&&status.rules.min!=null&&status.count===status.rules.min){
      $('chapter-desc').textContent+=hasLibrary?' Pour conserver ce minimum, remplacez une situation depuis la bibliothèque plutôt que de la supprimer.':` Les ${status.rules.min} situations de cette partie sont requises. Vous pouvez en adapter le contexte.`;
    }
    renderChapterChoice(ch);

    const libraryButton=$('library-button');
    libraryButton.hidden=Boolean((stereotypes&&!isAdmin)||state.project?.can_edit===false||!hasLibrary);
    if(!libraryButton.hidden){
      libraryButton.classList.remove('is-disabled');
      libraryButton.removeAttribute('aria-disabled');
      libraryButton.textContent='Consulter la bibliothèque';
      libraryButton.title='Consulter les situations complémentaires et choisir un éventuel remplacement';
    }
    if((!stereotypes||isAdmin)&&state.project?.can_edit!==false&&!state.libraryAvailability.has(libraryAvailabilityKey(ch))){
      ensureLibraryAvailability(ch);
    }

    $('legal-scoring-note').hidden=!isLegalChapter(ch);
    $('situation-list').innerHTML=ch.situations.map(situationHtml).join('');
    $('sticky-part-label').textContent=`Chapitre ${state.active+1}/${state.chapters.length} · ${ch.title}`;

    const next=$('composer-next');
    if(next){
      if(state.project?.review_mode){next.href=`validation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}`;next.textContent='Enregistrer et revenir au contrôle qualité →';next.classList.remove('is-disabled');next.setAttribute('aria-disabled','false');next.onclick=async event=>{event.preventDefault();next.setAttribute('aria-busy','true');next.textContent='Enregistrement…';await returnToReview();};}
      else{
      next.href=`personnalisation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${state.active}${state.country?`&countryCode=${encodeURIComponent(state.country)}`:''}`;
      const blocked=status.below||status.above;
      next.classList.toggle('is-disabled',blocked);
      next.setAttribute('aria-disabled',String(blocked));
      next.onclick=blocked?async(event)=>{event.preventDefault();await showIncompleteChapterModal(state.active);}:null;
      }
    }
    renderNav();bindSituations();
  }

  async function ensureProject(){if(projectId)return;location.replace(`theme-${encodeURIComponent(themeSlug)}.html?theme=${encodeURIComponent(themeSlug)}`);throw new Error('redirect');}
  function configureContextBack(project){
    const user=window.StudioAPI?.user?.()||{},isAdmin=user.role==='admin'&&(!window.StudioAPI?.interfaceMode||window.StudioAPI.interfaceMode()!=='client');
    let href='mes-campagnes.html',label='← Mes campagnes';
    if(project.review_mode){href=`validation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}`;label='← Retour au contrôle qualité';}
    else if(isAdmin&&project.organization_id){href=`client.html?organizationId=${encodeURIComponent(project.organization_id)}&projectId=${encodeURIComponent(projectId)}`;label='← Retour au dossier client';}
    else if(!project.can_edit){href=`campagne-detail.html?projectId=${encodeURIComponent(projectId)}`;label='← Retour à la campagne';}
    ['composer-top-back','composer-theme-back'].forEach(id=>{const link=$(id);if(link){link.href=href;link.textContent=label;}});
  }
  function openRequestedSituation(){
    const card=document.querySelector(`[data-situation-card="${CSS.escape(String(requestedSituation))}"]`);
    if(!card)return;
    const body=$(`situation-body-${requestedSituation}`),toggle=card.querySelector('[data-collapse-situation]');
    if(body)body.hidden=false;
    state.expandedSituations.add(String(requestedSituation));
    if(toggle){toggle.setAttribute('aria-expanded','true');toggle.textContent='Replier';}
    let field=card.querySelector('[data-situation-input]');
    if(requestedAnswer){
      const answers=$(`answers-${requestedSituation}`),answerToggle=card.querySelector('[data-toggle]');
      if(answers)answers.hidden=false;
      state.expandedAnswers.add(String(requestedSituation));
      if(answerToggle){answerToggle.setAttribute('aria-expanded','true');const label=answerToggle.querySelector('[data-toggle-label]');if(label)label.textContent='Masquer les réponses et les scores';}
      field=card.querySelector(`[data-answer-input="${CSS.escape(String(requestedAnswer))}"]`)||field;
    }
    card.classList.add('review-direct-target');
    const target=field||body||card;
    if(!field)target.setAttribute('tabindex','-1');
    target.focus?.({preventScroll:true});
    target.scrollIntoView({behavior:'smooth',block:'center'});
  }

  async function load(){try{await ensureProject();const query=new URLSearchParams();if(state.country)query.set('countryCode',state.country);if(state.locale)query.set('locale',state.locale);const data=await api(`/api/projects/${projectId}/composer${query.toString()?`?${query.toString()}`:''}`);state.project=data.project;state.chapters=data.chapters;rememberComposerContext(data);const countries=campaignCountries(data.project);state.country=requestedCountry&&countries.includes(requestedCountry)?requestedCountry:(countries.length===1?countries[0]:'');const locales=projectContentLocales(data.project);if(isLegacyClientCampaign(data.project)&&!requestedLocale&&locales.includes('fr'))state.locale='fr';else if(!locales.includes(state.locale))state.locale=locales.includes('fr')?'fr':(locales[0]||'fr');if(state.country!==requestedCountry||state.locale!==(requestedLocale||'fr')){const q2=new URLSearchParams();if(state.country)q2.set('countryCode',state.country);if(state.locale)q2.set('locale',state.locale);const refreshed=await api(`/api/projects/${projectId}/composer?${q2.toString()}`);state.project=refreshed.project;state.chapters=refreshed.chapters;rememberComposerContext(refreshed);}const targetChapter=requestedSituation?state.chapters.findIndex(ch=>(ch.situations||[]).some(s=>String(s.id)===requestedSituation)):-1;state.active=targetChapter>=0?targetChapter:Math.min(state.active,Math.max(0,state.chapters.length-1));$('catalog-title').textContent=data.project.theme_title||data.project.legacy_theme_title||'Campagne historique';const clientName=$('composer-client-name');if(clientName)clientName.hidden=true;renderCampaignContext(state.project);renderCountryTabs(state.project);renderComposerCountryGate();configureContextBack(state.project);if(state.project.can_edit)await saveStep('composer');if(state.country){await preloadActiveTranslationContexts();render();}if(requestedSituation&&state.country)requestAnimationFrame(openRequestedSituation);if(state.project.review_mode)showMessage('✎ Correction Me&YouToo active : vous pouvez modifier les situations. La version transmise par le client reste conservée pour comparaison.','success');else if(!state.project.can_edit)showMessage('Campagne historique en lecture seule. Choisissez une langue ci-dessus pour consulter ses traductions.','success');}catch(e){if(e.message==='redirect')return;showMessage(`Impossible de charger le brouillon : ${e.message}`);$('chapter-title').textContent='Brouillon indisponible';}}

  $('library-button').onclick=async()=>{
    openLibrary('add');
  };
  window.StudioComposerPreviewSnapshot=()=>({
    project:{
      theme:state.project?.theme_title||'',
      title:state.project?.respondent_title||state.project?.campaign_name||state.project?.theme_title||'Autodiagnostic',
      intro:(()=>{const d=document.createElement('div');d.innerHTML=state.project?.introduction_html||state.project?.theme_introduction_html||'';return(d.textContent||'').trim()})(),
      socio:Array.isArray(state.project?.sociodemo)?state.project.sociodemo:[],
      result_buttons:Array.isArray(state.project?.result_buttons)?state.project.result_buttons:[]
    },
    chapters:state.chapters.map((ch,cidx)=>({
      id:ch.id||ch.source_id||cidx,
      title:ch.title,
      profiles:Array.isArray(ch.profiles)?ch.profiles:[],
      situations:(ch.situations||[]).filter(si=>si.selected!==false).map((si,sidx)=>({
        id:si.id||si.source_id||`${cidx}-${sidx}`,
        content:si.content||si.custom_content||si.original_content||'',
        kind:si.kind,response_kind:si.response_kind||si.legacy_payload?.responseKind||si.legacy_payload?.kind||null,
        answers:si.answers||[]
      }))
    }))
  });
  $('library-close').onclick=closeLibrary;$('library-backdrop').onclick=closeLibrary;
  document.body.classList.add('sidebar-collapsed');
  const collapseButton=document.querySelector('[data-sidebar-collapse]');if(collapseButton){collapseButton.setAttribute('aria-expanded','false');collapseButton.setAttribute('aria-label','Déployer le menu');collapseButton.setAttribute('title','Déployer le menu');}
  load();
})();
