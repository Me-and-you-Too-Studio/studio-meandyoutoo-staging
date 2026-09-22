(() => {
  const params = new URLSearchParams(location.search);
  const themeSlug = params.get('theme') || 'sexisme';
  let projectId = params.get('projectId') || '';
  const requestedChapter = Math.max(0, Number(params.get('chapter')||0));
  const requestedSituation = params.get('situation') || '';
  const requestedCountry = String(params.get('countryCode')||'').trim().toUpperCase();
  const requestedLocale = String(params.get('locale')||'').trim().toLowerCase().replaceAll('_','-');
  const state = { chapters: [], active: requestedChapter, project: null, country: requestedCountry, locale: requestedLocale||'fr', composerCountryLocales:{}, library: [], libraryMode: 'add', replaceId: '', translationContexts:new Map(), libraryAvailability:new Map(), collapsedSituations:new Set() };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canonical = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const api = (path, options={}) => window.StudioAPI.request(path, options);
  const currentUser = window.StudioAPI?.user?.() || {};
  const isAdmin = currentUser.role === 'admin';
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

  function projectCountryLocales(project=state.project){
    const raw=normalizeCountryLocaleMap(project?.country_locales);
    const context=normalizeCountryLocaleMap(state.composerCountryLocales);
    const countries=campaignCountries(project);
    const normalize=list=>[...new Set((Array.isArray(list)?list:[]).map(locale=>String(locale||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
    const global=normalize((Array.isArray(project?.locales)?project.locales:[]).concat(project?.selected_locale?[project.selected_locale]:[]));
    const out={};
    countries.forEach(code=>{
      const key=String(code||'').trim().toUpperCase();
      const explicit=normalize(raw[key]);
      const resolved=explicit.length?explicit:normalize(context[key]);
      out[key]=resolved.length?resolved:(countries.length===1?global:[]);
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
      renderCampaignContext();
      render();
      const url=new URL(location.href);url.searchParams.set('locale',state.locale);history.replaceState(null,'',url);
      showMessage(`Langue affichée : ${localeLabel(state.locale)}.`,'success');
    }catch(e){showMessage(`Impossible de charger ${localeLabel(state.locale)} : ${e.message}`);}
  }

  function renderCampaignContext(){
    const root=$('composer-campaign-context');if(!root)return;
    const readOnly=Boolean(window.STUDIO_COMPOSER_READ_ONLY||document.body.dataset.campaignReadOnly==='true');
    if(readOnly){
      const names={fr:'Français',nl:'Néerlandais','nl-be':'Néerlandais Belgique',en:'Anglais',de:'Allemand',es:'Espagnol',it:'Italien',pt:'Portugais',br:'Portugais Brésil',bg:'Bulgare',ja:'Japonais','ko-kr':'Coréen',pl:'Polonais',ro:'Roumain',ru:'Russe','sv-se':'Suédois',tr:'Turc',zf:'Chinois simplifié',zh:'Chinois traditionnel',cs:'Tchèque',sk:'Slovaque',id:'Indonésien',ar:'Arabe'};
      const byCountry=projectCountryLocales(state.project);
      const countryLocales=state.country&&Array.isArray(byCountry[state.country])?byCountry[state.country]:[];
      const locales=[...new Set((countryLocales.length?countryLocales:(Array.isArray(state.project?.locales)?state.project.locales:[]))
        .concat(state.project?.selected_locale?[state.project.selected_locale]:[])
        .map(v=>String(v||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];
      if(locales.length){
        if(!locales.includes(state.locale))state.locale=locales.includes('fr')?'fr':locales[0];
        root.hidden=false;
        root.style.display='';
        root.innerHTML=`<div class="theme-availability-pills"><strong>${state.country?'Langues du périmètre sélectionné':'Langues disponibles'}</strong>${locales.map(loc=>`<span class="theme-availability-pill is-language">${esc(names[loc]||loc.toUpperCase())} (${esc(loc.toUpperCase())})</span>`).join('')}<small>${state.country?'Les langues affichées correspondent au pays sélectionné. ':''}Utilisez la mappemonde 🌐 sous chaque situation pour comparer les traductions.</small></div>`;
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
      project.legacy_source==='meayt-legacy'
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
          ? 'Choisissez un périmètre pour ouvrir sa composition. Les langues à gérer sont indiquées sur chaque bouton.'
          : 'Ce périmètre est actif. Vous pouvez modifier les langues disponibles ou ajouter un autre périmètre si le catalogue le permet.');
    root.hidden=false;
    root.style.display='';
    root.innerHTML=`<div class="composer-country-tabs-label"><div class="composer-country-tabs-label-copy"><div class="composer-inline-title"><strong>Composer par périmètre</strong>${infoDot(campaignContextInfoText,'Impact d’une modification de périmètre ou de langue')}</div><span>${activeCopy}</span></div>${state.project?.can_edit===false?'':`<button class="button button-ghost button-small composer-country-edit" type="button" data-edit-campaign-context>Modifier périmètres et langues</button>`}</div><div class="composer-country-tabs-list">${countryEntries.map(entry=>{const active=entry.codes.includes(state.country);const langs=entry.locales;return `<button type="button" class="composer-country-tab composer-country-tab-with-locales ${active?'is-active':''}" data-country-tab="${esc(entry.code)}" aria-pressed="${active?'true':'false'}"><strong>${esc(entry.label)}</strong><span>${langs.length?langs.map(locale=>esc(localeLabel(locale))).join(' · '):'Langue à préciser'}</span></button>`;}).join('')}</div>`;
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
      const requestedLocale=knownBefore.includes(state.locale)?state.locale:(knownBefore.includes('fr')?'fr':(knownBefore[0]||state.locale||'fr'));
      const data=await api(`/api/projects/${projectId}/composer?countryCode=${encodeURIComponent(country)}&locale=${encodeURIComponent(requestedLocale)}`);
      state.project=data.project;state.chapters=data.chapters;rememberComposerContext(data);state.country=data.composer_context?.countryCode||country;
      const allowed=projectCountryLocales(state.project)[state.country]||[];
      if(allowed.length&&!allowed.includes(state.locale))state.locale=allowed.includes('fr')?'fr':allowed[0];
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
    const currentLocales=[...new Set((Array.isArray(state.project?.locales)?state.project.locales:[]).concat(state.project?.selected_locale?[state.project.selected_locale]:[]).map(x=>String(x||'').toLowerCase().replaceAll('_','-')).filter(Boolean))];
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
    currentCountries.forEach(code=>{
      const stored=normalizeLocales(storedByCountry?.[code]);
      const fallback=stored.length?stored:currentLocales;
      rawCountryOptions.push({code,locales:fallback,supported:true,isCurrent:true});
    });

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
    document.querySelectorAll('[data-chapter]').forEach(button=>button.onclick=()=>{state.active=Number(button.dataset.chapter);history.replaceState(null,'',`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${state.active}${state.country?`&countryCode=${encodeURIComponent(state.country)}`:''}`);render();window.scrollTo({top:0,behavior:'smooth'});});
    document.querySelectorAll('[data-profile-chapter]').forEach(button=>button.onclick=async()=>{const blocking=Number(button.dataset.blockingChapter);if(blocking>=0){await showIncompleteChapterModal(blocking,'Complétez les situations avant de personnaliser les profils');return;}location.href=`personnalisation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${button.dataset.profileChapter}${state.country?`&countryCode=${encodeURIComponent(state.country)}`:''}`;});
  }

  function isLegalChapter(ch=state.chapters[state.active]){return canonical(ch?.slug||ch?.title).includes('harcelement')||canonical(ch?.slug||ch?.title).includes('agression sexuelle');}
  function bestAnswerLabel(){return isLegalChapter()?'Réponse correcte':'Réponse la plus appropriée';}
  function isStereotypesChapter(ch=state.chapters[state.active]){
    // Règle transversale Me&YouToo : tout chapitre « Stéréotypes… » est un socle méthodologique,
    // y compris lorsqu'il provient d'un import historique client sans rattachement catalogue.
    return canonical(ch?.slug||ch?.title).includes('stereotype');
  }
  function isAggressionChapter(ch=state.chapters[state.active]){return canonical(ch?.slug||ch?.title).includes('agression sexuelle');}
  function isHostileChapter(ch=state.chapters[state.active]){return themeSlug==='sexisme'&&canonical(ch?.slug||ch?.title).includes('sexisme hostile');}
  function chapterSituationRules(ch=state.chapters[state.active]){
    // Les campagnes historiques clientes sont des copies fidèles du legacy :
    // les contraintes Studio de minimum/maximum par chapitre ne s'appliquent jamais.
    if(isLegacyClientCampaign())return {min:null,max:null};
    if(isStereotypesChapter(ch))return {min:null,max:null};
    return {min:isAggressionChapter(ch)||isHostileChapter(ch)?4:5,max:8};
  }
  function chapterCountStatus(ch=state.chapters[state.active]){
    const rules=chapterSituationRules(ch),count=ch?.situations?.length||0;
    return {rules,count,below:rules.min!=null&&count<rules.min,atMax:rules.max!=null&&count>=rules.max,above:rules.max!=null&&count>rules.max};
  }
  function firstInvalidIndex(limit=state.chapters.length-1){for(let i=0;i<=Math.min(limit,state.chapters.length-1);i++){const st=chapterCountStatus(state.chapters[i]);if(st.below||st.above)return i;}return -1;}
  async function showIncompleteChapterModal(index,title){
    const ch=state.chapters[index],status=chapterCountStatus(ch);if(!ch)return;
    state.active=index;history.replaceState(null,'',`composer.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}&chapter=${index}${state.country?`&countryCode=${encodeURIComponent(state.country)}`:''}`);render();window.scrollTo({top:0,behavior:'smooth'});
    if(status.below){const goLibrary=await window.StudioModal.confirm({eyebrow:'Composition du diagnostic',title:title||`Il vous faut ${status.rules.min} situations minimum`,message:`« ${ch.title} » contient ${status.count} situation${status.count>1?'s':''}. Ajoutez-en ${status.rules.min-status.count} avant de personnaliser les profils.`,type:'info',cancelLabel:'Rester sur le chapitre',confirmLabel:'Piocher dans la bibliothèque'});if(goLibrary)openLibrary('add');return;}
    await window.StudioModal.alert({eyebrow:'Composition du diagnostic',title:`Maximum de ${status.rules.max} situations`,message:`« ${ch.title} » contient plus de ${status.rules.max} situations. Supprimez-en une avant de personnaliser les profils.`,type:'warning',confirmLabel:'J’ai compris'});
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
    return `<div class="composer-diff${admin?' is-admin-correction':''}"><div class="composer-diff-label">${esc(label)}</div><div class="composer-diff-text">${wordDiffHtml(original,current)}</div></div>`;
  }
  function submittedSituation(id){const chapters=state.project?.review_snapshot?.chapters;return Array.isArray(chapters)?chapters.flatMap(ch=>ch.situations||[]).find(s=>String(s.id)===String(id)):null;}
  function reviewDiff(original,submitted,current,referenceLabel){if(!state.project?.review_mode)return diffBlock(original,current,`Modifications par rapport à ${referenceLabel}`);const client=submitted==null?current:submitted;return diffBlock(original,client,'Adaptations transmises par le client')+diffBlock(client,current,'Correction ajoutée par Me&YouToo',true);}
  function answerHtml(a, editable=false, originalContent='',submittedContent=null){
    const changed=editable&&String(originalContent||'')!==String(a.content||'');
    return `<div class="composer-answer ${a.is_best?'is-best':''} ${changed?'is-customized':''}">
      ${editable?`<textarea class="composer-inline-answer" data-answer-input="${esc(a.id)}" data-original-answer="${esc(originalContent||a.content)}" rows="2" aria-label="Modifier cette réponse">${esc(a.content)}</textarea>`:`<span class="composer-answer-text">${esc(a.content)}</span>`}
      <span class="composer-score">Score ${Number(a.score).toLocaleString('fr-FR')}</span>
      ${a.is_best?`<span class="composer-best">${bestAnswerLabel()}</span>`:''}
      <div data-live-answer-diff="${esc(a.id)}">${changed?reviewDiff(originalContent,submittedContent,a.content,'la réponse Me&YouToo'):''}</div>
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
    return state.libraryAvailability.get(libraryAvailabilityKey(ch))===true;
  }
  async function ensureLibraryAvailability(ch=state.chapters[state.active]){
    if(!ch||state.project?.can_edit===false||(isStereotypesChapter(ch)&&!isAdmin))return false;
    const key=libraryAvailabilityKey(ch);
    if(state.libraryAvailability.has(key))return state.libraryAvailability.get(key)===true;
    // Valeur provisoire : tant que le contrôle n'est pas terminé, aucun bouton
    // de bibliothèque n'est affiché. Cela évite un clic vers une bibliothèque vide.
    state.libraryAvailability.set(key,false);
    try{
      const data=await api(`/api/catalog/themes/${themeSlug}/library?chapterId=${encodeURIComponent(ch.catalog_chapter_id||ch.id)}&projectId=${encodeURIComponent(projectId)}&countryCode=${encodeURIComponent(state.country||'')}`);
      const has=Array.isArray(data?.situations)&&data.situations.length>0;
      state.libraryAvailability.set(key,has);
      if(ch===state.chapters[state.active])render();
      return has;
    }catch(error){
      console.warn('Bibliothèque complémentaire indisponible',error);
      state.libraryAvailability.set(key,false);
      if(ch===state.chapters[state.active])render();
      return false;
    }
  }

  function situationHtml(s,index){
    const ch=state.chapters[state.active];
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
    // Une traduction du catalogue Me&YouToo n'est jamais une personnalisation.
    // Le tag « Personnalisée » repose uniquement sur une vraie contextualisation enregistrée.
    const customized=!legacyClientImport&&Boolean(s.has_customization);
    const originTag=s.from_library?'<span class="composer-library-choice-tag">✓ Choisie dans la bibliothèque</span>':'';
    const hasLibrary=chapterHasLibrary(ch);
    const situationText=locked
      ?`<h3>${esc(s.content)}</h3>`
      :`<div class="composer-inline-field">
          <div class="composer-editor-label-row"><label for="situation-text-${esc(s.id)}">Texte de la mise en situation</label><span class="composer-context-tag">Contextualisation uniquement</span></div>
          <textarea id="situation-text-${esc(s.id)}" class="composer-inline-situation ${String(originalText)!==String(s.content||'')?'is-customized':''}" data-situation-input="${esc(s.id)}" data-original-situation="${esc(originalText)}" rows="3">${esc(s.content)}</textarea>
          <div data-live-situation-diff>${reviewDiff(originalText,submitted?.content,s.content,'la situation Me&YouToo')}</div>
          <small class="composer-field-guidance">${hasLibrary?'Adaptez un prénom, un métier, votre terminologie ou le contexte professionnel. Si le sens ne convient pas, utilisez « Remplacer » et choisissez une autre situation dans la bibliothèque.':'Adaptez un prénom, un métier, votre terminologie ou le contexte professionnel sans changer le sens de la situation.'}</small>
        </div>`;
    const answerRows=(s.answers||[]).map(a=>{const original=(s.original_answers||[]).find(o=>String(o.id)===String(a.id)),sent=(submitted?.answers||[]).find(o=>String(o.id)===String(a.id));return answerHtml(a,!locked,original?.content||a.content,sent?.content??null);}).join('');
    const tone=situationTone(s,index,ch);
    return `<article class="composer-situation ${tone} ${locked?'is-locked':''} ${customized?'has-customization':''}" data-situation-card="${esc(s.id)}">
      <div class="composer-situation-head">
        <div class="composer-situation-tags">${showMethodologyChip?`<span class="composer-lock-chip">🔒 Situation socle — texte non modifiable</span>`:`<span class="composer-position-chip">Situation ${index+1}</span>`}${originTag}${customized?'<span class="composer-customized-tag">✎ Personnalisée</span>':''}</div>
        <div class="composer-situation-head-actions"><span class="composer-origin">Situation Me&YouToo</span><button class="button button-ghost button-small composer-collapse-situation" type="button" data-collapse-situation="${esc(s.id)}" aria-expanded="false">Déplier</button></div>
      </div>
      <div class="composer-situation-body" id="situation-body-${esc(s.id)}" hidden>
      ${linkedLabel?`<div class="composer-linked-chip">🔗 ${esc(linkedLabel)}</div>`:''}
      ${situationText}
      <button class="composer-toggle" type="button" data-toggle="${esc(s.id)}" aria-expanded="false"><span data-toggle-label>Voir les réponses et les scores</span> <span aria-hidden="true">⌄</span></button>
      <div class="composer-answers" id="answers-${esc(s.id)}" hidden>${answerRows}</div>
      ${((((state.country?(projectCountryLocales(state.project)[state.country]||[]):(state.project?.locales||[]))).length>1)?`<div class="composer-translation-row"><button class="button button-ghost composer-translation-button" type="button" data-translations="${esc(s.id)}" ${legacyClientImport?'':'hidden'}>🌐 Vérifier les versions linguistiques</button></div><div class="translation-sync-warning" data-live-translation-warning ${customized?'':'hidden'}>⚠️ Vous modifiez le contenu de référence. Les autres versions linguistiques doivent être vérifiées.</div>`:'')}
      ${!locked?`<div class="composer-inline-help composer-context-help"><strong>Réponses : contextualisation uniquement</strong><span>Adaptez les termes au contexte de votre organisation sans changer le sens ni le niveau de pertinence. Si le fond ne convient pas, remplacez la situation depuis la bibliothèque Me&YouToo. Les scores restent verrouillés et Me&YouToo validera les adaptations avant publication.</span></div>
      <div class="composer-save-row"><span class="composer-save-status is-saved" data-save-status="${esc(s.id)}"><span class="composer-save-check" aria-hidden="true">✓</span><span data-save-text>${customized?'Enregistré':'Enregistrement automatique'}</span></span></div>
      <div class="composer-actions">
        ${customized?`<button class="button button-ghost" type="button" data-reset="${esc(s.id)}">↶ ${state.project?.review_mode?'Annuler ma correction':'Annuler mes modifications'}</button>`:''}
        ${hasLibrary?`<button class="button button-secondary" type="button" data-replace="${esc(s.id)}">Remplacer</button>`:''}
        <button class="button button-danger-soft" type="button" data-remove="${esc(s.id)}">Supprimer du chapitre</button>
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
  function bindSituations(){
    document.querySelectorAll('[data-collapse-situation]').forEach(b=>b.onclick=()=>{const body=$(`situation-body-${b.dataset.collapseSituation}`);if(!body)return;body.hidden=!body.hidden;b.setAttribute('aria-expanded',String(!body.hidden));b.textContent=body.hidden?'Déplier':'Replier';});
    document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{
      const box=$(`answers-${b.dataset.toggle}`),label=b.querySelector('[data-toggle-label]');
      if(!box)return;
      box.hidden=!box.hidden;
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
        if((ctx.locales||[]).filter(x=>x!==ctx.referenceLocale).length){
          b.hidden=false;
          b.onclick=()=>openTranslationModal(id);
        }
      }catch(_){b.hidden=true;}
    });
  }

  const localeNames={fr:'Français',en:'Anglais',es:'Espagnol',de:'Allemand',it:'Italien',pt:'Portugais',br:'Portugais Brésil','id-id':'Indonésien',id:'Indonésien',ar:'Arabe',ja:'Japonais','ko-kr':'Coréen',zf:'Chinois simplifié',zh:'Chinois traditionnel',bg:'Bulgare',nl:'Néerlandais','nl-be':'Néerlandais Belgique',pl:'Polonais',ro:'Roumain',ru:'Russe','sv-se':'Suédois',tr:'Turc',cs:'Tchèque',sk:'Slovaque'};
  const localeLabel=loc=>`${localeNames[String(loc).toLowerCase()]||String(loc).toUpperCase()} (${String(loc).toUpperCase()})`;
  async function getTranslationContext(id,refresh=false){if(!refresh&&state.translationContexts.has(String(id)))return state.translationContexts.get(String(id));const ctx=await api(`/api/projects/${projectId}/situations/${id}/translations`);state.translationContexts.set(String(id),ctx);return ctx;}
  async function openTranslationModal(id){const ctx=await getTranslationContext(id,true),legacyReadOnly=isLegacyClientCampaign()&&state.project?.can_edit===false,countryAllowed=state.country?(projectCountryLocales(state.project)[state.country]||[]):[],ctxLocales=[...new Set((ctx.locales||[]).map(loc=>String(loc||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))],scopedLocales=countryAllowed.length?ctxLocales.filter(loc=>countryAllowed.includes(loc)):ctxLocales,referenceLocale=scopedLocales.includes('fr')?'fr':((ctx.referenceLocale&&scopedLocales.includes(String(ctx.referenceLocale).toLowerCase().replaceAll('_','-')))?String(ctx.referenceLocale).toLowerCase().replaceAll('_','-'):(scopedLocales[0]||ctx.referenceLocale||'fr')),reference=ctx.reference||{},targets=scopedLocales.filter(x=>x!==referenceLocale);if(!targets.length)return;const overlay=document.createElement('div');overlay.className='translation-overlay';overlay.innerHTML=`<section class="translation-modal" role="dialog" aria-modal="true"><header class="translation-head"><div><small>${legacyReadOnly?'VERSIONS LINGUISTIQUES DE LA CAMPAGNE HISTORIQUE':'TRADUCTION ET ADAPTATION LOCALE ÉVENTUELLE'}</small><h2>Comparer avec la langue de référence</h2></div><button class="translation-close" type="button" aria-label="Fermer">×</button></header><div class="translation-toolbar"><strong>${legacyReadOnly?'Langue à comparer':'Langue / adaptation à vérifier'}</strong><select data-translation-locale>${targets.map(l=>`<option value="${esc(l)}" ${l==='en'?'selected':''}>${esc(localeLabel(l))}</option>`).join('')}</select><span data-translation-status></span></div><div class="translation-grid"><section class="translation-pane reference" data-reference-pane></section><section class="translation-pane" data-target-pane></section></div><footer class="translation-foot"><button class="button button-ghost" type="button" data-cancel>${legacyReadOnly?'Fermer':'Annuler'}</button>${legacyReadOnly?'':'<button class="button button-primary" type="button" data-save-translation>Enregistrer et fermer</button>'}</footer></section>`;document.body.appendChild(overlay);const close=()=>overlay.remove();overlay.querySelector('.translation-close').onclick=close;overlay.querySelector('[data-cancel]').onclick=close;const select=overlay.querySelector('[data-translation-locale]');const referencePane=overlay.querySelector('[data-reference-pane]'),target=overlay.querySelector('[data-target-pane]');
    const statusLabel=status=>status==='missing'?'À compléter':status==='client_version'?'Personnalisée':'Traduction Me&YouToo';
    function draw(){const loc=select.value,t=ctx.translations?.[loc]||{answers:[]};const answerStates=(reference.answers||[]).map(a=>(t.answers||[]).find(x=>String(x.id)===String(a.id))||{status:'missing'});const incomplete=t.status==='missing'||answerStates.some(a=>a.status==='missing');const stale=Boolean(ctx.sourceCustomized);const overall=incomplete?'Traduction incomplète':t.status==='client_version'||answerStates.some(a=>a.status==='client_version')?'Personnalisée':'Traduction Me&YouToo';referencePane.innerHTML=`<h3>${esc(localeLabel(referenceLocale))} · référence</h3><div class="translation-reference-text">${esc(reference.content||'')}</div><h4>Réponses</h4>${(reference.answers||[]).map((a,i)=>`<div class="translation-answer"><strong>Réponse ${i+1}</strong><div class="translation-reference-text">${esc(a.content)}</div></div>`).join('')}`;target.innerHTML=`<h3>${esc(localeLabel(loc))}<span class="translation-status ${incomplete?'is-incomplete':''}">${stale?'À vérifier':overall}</span></h3>${stale&&!legacyReadOnly?`<div class="translation-sync-warning">⚠️ La référence ${esc(localeLabel(referenceLocale))} a été modifiée. Vérifiez cette traduction et son adaptation locale éventuelle.</div>`:''}<div class="translation-local-note">${legacyReadOnly?'Version historique importée en lecture seule.':'Modifier cette version n’actualise pas automatiquement les autres langues.'}</div><div class="translation-field-head"><strong>Situation</strong><span class="translation-status">${statusLabel(t.status||'missing')}</span></div><textarea rows="4" data-target-content placeholder="Traduction / adaptation à compléter" ${legacyReadOnly?'readonly':''}>${esc(t.content||'')}</textarea><h4>Réponses</h4>${(reference.answers||[]).map((a,i)=>{const ta=answerStates[i];return `<div class="translation-answer"><div class="translation-field-head"><strong>Réponse ${i+1}</strong><span class="translation-status">${statusLabel(ta.status||'missing')}</span></div><textarea rows="2" data-target-answer="${esc(a.id)}" placeholder="Traduction / adaptation à compléter" ${legacyReadOnly?'readonly':''}>${esc(ta.content||'')}</textarea></div>`}).join('')}`;}
    select.onchange=draw;draw();const saveButton=overlay.querySelector('[data-save-translation]');if(saveButton)saveButton.onclick=async()=>{const loc=select.value,content=target.querySelector('[data-target-content]').value.trim(),answers=[...target.querySelectorAll('[data-target-answer]')].map(x=>({id:Number(x.dataset.targetAnswer),content:x.value.trim()}));try{await api(`/api/projects/${projectId}/situations/${id}/translations/${encodeURIComponent(loc)}`,{method:'PATCH',body:JSON.stringify({content,answers})});state.translationContexts.delete(String(id));close();showMessage(`${localeLabel(loc)} · traduction et adaptation locale enregistrée.`,'success');}catch(e){showMessage(e.message);}};
  }

  function findSituation(id){return state.chapters.flatMap(ch=>ch.situations).find(s=>String(s.id)===String(id));}
  function refreshLiveDiff(card,s,situationText,answers){
    const situationOriginal=String(s.original_content_localized||s.original_content||card.querySelector('[data-situation-input]')?.dataset.originalSituation||'');
    const situationDiff=card.querySelector('[data-live-situation-diff]');
    const situationInput=card.querySelector('[data-situation-input]');
    const situationChanged=situationOriginal!==String(situationText||'');
    const submitted=submittedSituation(s.id);if(situationDiff)situationDiff.innerHTML=situationChanged?reviewDiff(situationOriginal,submitted?.content,situationText,'la situation Me&YouToo'):'';
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
      const sent=(submitted?.answers||[]).find(answer=>String(answer.id)===String(item.id));if(diff)diff.innerHTML=changed?reviewDiff(original,sent?.content??null,item.content,'la réponse Me&YouToo'):'';
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
  async function removeSituation(id){const ch=state.chapters[state.active],s=findSituation(id),linked=Boolean(s&&s.metadata&&s.metadata.link_group);const confirmed=await window.StudioModal.confirm({eyebrow:'Composition du diagnostic',title:linked?'Supprimer ces situations liées ?':'Supprimer cette situation ?',message:linked?'Cette situation fonctionne avec une autre mise en situation. Les deux seront retirées ensemble de ce chapitre. Cette action concerne uniquement ce brouillon.':'Cette mise en situation sera retirée de ce chapitre. Elle restera disponible dans le référentiel Me&YouToo.',type:'danger',cancelLabel:'Conserver',confirmLabel:linked?'Supprimer les situations':'Supprimer la situation'});if(!confirmed)return;try{const data=await api(`/api/projects/${projectId}/situations/${id}`,{method:'DELETE'});const deleted=new Set((data.deletedIds||[id]).map(String));ch.situations=ch.situations.filter(s=>!deleted.has(String(s.id)));render();showMessage(data.linked?'Les situations liées ont été supprimées ensemble.':'La situation a été supprimée du brouillon.','success');}catch(e){showMessage(e.message);}}

  function currentCatalogIds(){return new Set(state.chapters.flatMap(ch=>ch.situations).flatMap(s=>[String(s.catalog_situation_id||''),String(s.source_id||''),String(s.metadata?.duplicate_of_source_id||''),canonical(s.content)]).filter(Boolean));}
  async function openLibrary(mode='add',replaceId=''){
    const ch=state.chapters[state.active];state.libraryMode=mode;state.replaceId=replaceId;
    try{
      const data=await api(`/api/catalog/themes/${themeSlug}/library?chapterId=${encodeURIComponent(ch.catalog_chapter_id||ch.id)}&projectId=${encodeURIComponent(projectId)}&countryCode=${encodeURIComponent(state.country||'')}`);
      const existing=currentCatalogIds();
      state.library=(data.situations||[]).filter(s=>![String(s.id||''),String(s.source_id||''),String(s.metadata?.duplicate_of_source_id||''),canonical(s.content)].filter(Boolean).some(k=>existing.has(k)));
      $('library-title').textContent=mode==='replace'?`Remplacer une situation · ${ch.title}`:`Ajouter une situation · ${ch.title}`;

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
          const label=linked?`${entry.members.length} situations liées · ${mode==='replace'?'remplacées':'ajoutées'} ensemble`:'Situation disponible';
          const body=entry.members.map((m,mi)=>{const tags=Array.isArray(m.admin_tags)?m.admin_tags.filter(Boolean):[];return `<section class="composer-library-linked-item">${linked?`<div class="composer-library-linked-title">Situation ${mi+1}/${entry.members.length}</div>`:''}<h3>${esc(m.content)}</h3>${tags.length?`<div class="composer-library-keywords">${tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>`:''}<details><summary>Consulter les réponses et les scores</summary>${(m.answers||[]).map(a=>answerHtml(a,false,'')).join('')}</details></section>`;}).join('');
          return `<article class="composer-library-card composer-library-bundle tone-${index%4+1}"><div class="composer-library-number">${String(index+1).padStart(2,'0')}</div><div class="composer-library-content"><div class="composer-library-label">${label}</div>${body}<button class="button button-primary" type="button" data-library-pick="${esc(entry.primary.id)}">${mode==='replace'?(linked?`Remplacer par ces ${entry.members.length} situations`:'Remplacer par cette situation'):(linked?`Ajouter les ${entry.members.length} situations au chapitre`:'Ajouter au chapitre')}</button></div></article>`;
        }).join(''):'<div class="composer-library-empty"><strong>Aucune situation trouvée</strong><p>Modifiez votre recherche. Vous restez dans la bibliothèque complémentaire autorisée pour cet autodiagnostic.</p></div>';
        document.querySelectorAll('[data-library-pick]').forEach(b=>b.onclick=()=>mode==='replace'?replaceSituation(replaceId,b.dataset.libraryPick):addSituation(b.dataset.libraryPick));
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
    }catch(e){showMessage(e.message);}
  }
  async function replaceSituation(projectSituationId,catalogSituationId){try{const data=await api(`/api/projects/${projectId}/situations/${projectSituationId}/replace`,{method:'PATCH',body:JSON.stringify({catalogSituationId:Number(catalogSituationId),countryCode:state.country})});closeLibrary();const refreshed=await api(`/api/projects/${projectId}/composer`);state.project=refreshed.project;state.chapters=refreshed.chapters;render();showMessage(data.linked?'La sélection liée a été remplacée et enregistrée ensemble.':'La situation a été remplacée et enregistrée.','success');}catch(e){showMessage(e.message);}}

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

  function render(){
    const ch=state.chapters[state.active];if(!ch)return;
    const stereotypes=isStereotypesChapter(ch),status=chapterCountStatus(ch);
    $('chapter-kicker').textContent=`Chapitre ${state.active+1} · Questions`;
    $('chapter-title').textContent=ch.title;
    const effectiveChapterLocked=Boolean(stereotypes&&!isAdmin);
    const campaignReadOnly=Boolean(state.project?.can_edit===false&&!state.project?.review_mode);
    $('chapter-desc').textContent=effectiveChapterLocked
      ?'Les situations de ce chapitre constituent un socle méthodologique Me&YouToo : leur texte, leurs réponses et leur sélection ne sont pas modifiables.'
      :campaignReadOnly
        ?`${status.count} situation${status.count>1?'s':''} dans cette campagne historique · consultation en lecture seule.`
      :status.rules.min!=null
        ?`${status.count} situation${status.count>1?'s':''} retenue${status.count>1?'s':''} · ${status.rules.min} minimum et ${status.rules.max} maximum dans ce chapitre.`
        :`${status.count} situations retenues · consultez les réponses et scores avant de modifier votre sélection.`;

    renderChapterChoice(ch);

    const libraryButton=$('library-button');
    const hasLibrary=chapterHasLibrary(ch);
    libraryButton.hidden=Boolean((stereotypes&&!isAdmin)||state.project?.can_edit===false||!hasLibrary);
    if(!libraryButton.hidden){
      libraryButton.classList.toggle('is-disabled',status.atMax);
      libraryButton.setAttribute('aria-disabled',String(status.atMax));
      libraryButton.title=status.atMax?`Maximum de ${status.rules.max} situations atteint`:'';
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
    const user=window.StudioAPI?.user?.()||{},isAdmin=user.role==='admin';
    let href='mes-campagnes.html',label='← Mes campagnes';
    if(project.review_mode){href=`validation.html?theme=${encodeURIComponent(themeSlug)}&projectId=${encodeURIComponent(projectId)}`;label='← Retour au contrôle qualité';}
    else if(isAdmin&&project.organization_id){href=`client.html?organizationId=${encodeURIComponent(project.organization_id)}&projectId=${encodeURIComponent(projectId)}`;label='← Retour au dossier client';}
    else if(!project.can_edit){href=`campagne-detail.html?projectId=${encodeURIComponent(projectId)}`;label='← Retour à la campagne';}
    ['composer-top-back','composer-theme-back'].forEach(id=>{const link=$(id);if(link){link.href=href;link.textContent=label;}});
  }
  async function load(){try{await ensureProject();const query=new URLSearchParams();if(state.country)query.set('countryCode',state.country);if(state.locale)query.set('locale',state.locale);const data=await api(`/api/projects/${projectId}/composer${query.toString()?`?${query.toString()}`:''}`);state.project=data.project;state.chapters=data.chapters;rememberComposerContext(data);const countries=campaignCountries(data.project);state.country=requestedCountry&&countries.includes(requestedCountry)?requestedCountry:(countries.length===1?countries[0]:'');const locales=[...new Set((Array.isArray(data.project?.locales)?data.project.locales:[]).map(v=>String(v||'').trim().toLowerCase().replaceAll('_','-')).filter(Boolean))];if(isLegacyClientCampaign(data.project)&&locales.includes('fr'))state.locale='fr';else if(!locales.includes(state.locale))state.locale=locales.includes('fr')?'fr':(locales[0]||'fr');if(state.country!==requestedCountry||state.locale!==(requestedLocale||'fr')){const q2=new URLSearchParams();if(state.country)q2.set('countryCode',state.country);if(state.locale)q2.set('locale',state.locale);const refreshed=await api(`/api/projects/${projectId}/composer?${q2.toString()}`);state.project=refreshed.project;state.chapters=refreshed.chapters;rememberComposerContext(refreshed);}state.active=Math.min(state.active,Math.max(0,state.chapters.length-1));$('catalog-title').textContent=data.project.theme_title||data.project.legacy_theme_title||'Campagne historique';renderCampaignContext(state.project);renderCountryTabs(state.project);renderComposerCountryGate();configureContextBack(state.project);if(state.project.can_edit)await saveStep('composer');if(state.country)render();if(requestedSituation&&state.country){requestAnimationFrame(()=>{const card=document.querySelector(`[data-situation-card="${CSS.escape(String(requestedSituation))}"]`);if(card){card.classList.add('review-direct-target');card.scrollIntoView({behavior:'smooth',block:'center'});card.querySelector('textarea,button')?.focus({preventScroll:true});}});}if(state.project.review_mode)showMessage('✎ Correction Me&YouToo active : vous pouvez modifier les situations. La version transmise par le client reste conservée pour comparaison.','success');else if(!state.project.can_edit)showMessage('Campagne historique en lecture seule. Choisissez une langue ci-dessus pour consulter ses traductions.','success');}catch(e){if(e.message==='redirect')return;showMessage(`Impossible de charger le brouillon : ${e.message}`);$('chapter-title').textContent='Brouillon indisponible';}}

  $('library-button').onclick=async()=>{
    const status=chapterCountStatus(state.chapters[state.active]);
    if(status.atMax){
      await window.StudioModal.confirm({
        eyebrow:'Composition du diagnostic',
        title:`Maximum de ${status.rules.max} situations atteint`,
        message:`Vous avez déjà ${status.rules.max} situations dans ce chapitre. Supprimez-en une avant d’en ajouter une autre depuis la bibliothèque.`,
        type:'warning',
        cancelLabel:'Fermer',
        confirmLabel:'Compris'
      });
      return;
    }
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
        answers:si.answers||[]
      }))
    }))
  });
  $('library-close').onclick=closeLibrary;$('library-backdrop').onclick=closeLibrary;
  document.body.classList.add('sidebar-collapsed');
  const collapseButton=document.querySelector('[data-sidebar-collapse]');if(collapseButton){collapseButton.setAttribute('aria-expanded','false');collapseButton.setAttribute('aria-label','Déployer le menu');collapseButton.setAttribute('title','Déployer le menu');}
  load();
})();
