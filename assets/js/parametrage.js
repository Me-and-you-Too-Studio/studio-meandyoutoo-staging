(()=>{
  const p=new URLSearchParams(location.search);let theme=p.get('theme')||'',projectId=p.get('projectId')||'';
  const DIFFUSION_BASE_URL='https://selfdiag-mayt.meandyoutoo.app/';let diffusionCustomerSlug='',diffusionExistingUrl='',diffusionDirty=false;
  const api=(url,opt={})=>window.StudioAPI.request(url,opt);let baseTitle='',socio=[],socioLanguageVariants={},introVariants={},introResolvedVariants={},translationReviewState={intro:{},socio:{}},socioReferenceLocaleStable='',socioContextCountry='',socioContextLocale='',socioContextBaseline='',socioContextHasStored=false,introContextBaseline='',introContextHasStored=false,resultResources=[],resourceLibrary=[],quota=null,referenceIntro='',project=null;
  let autosaveTimer=null,autosaveInFlight=null,autosavePending=false,autosaveEnabled=false,lastSavedFingerprint='';
  const autosaveDirtyFields=new Set();
  const currentUser=window.StudioAPI.user&&window.StudioAPI.user()||{},canOrder=currentUser.role==='admin'||Boolean(currentUser.permissions&&currentUser.permissions.order_passations);
  const isReadOnly=()=>Boolean(project&&project.can_edit===false&&currentUser.role!=='admin');
  const isLegacyClientCampaign=()=>Boolean(project&&(project.source_type==='legacy_client'||project.legacy_history===true||project.legacy_source==='meayt-legacy'));
  const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stripHtml=v=>{let html=String(v||'');const start=html.indexOf('« Nous entendons');if(start>=0)html=html.slice(start);const d=document.createElement('div');d.innerHTML=html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<\/li>/gi,'\n');return(d.textContent||'').replace(/\n{3,}/g,'\n\n').trim();};
  const slugify=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' et ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  function parseDiffusionUrl(value){const raw=String(value||'').trim();if(!raw)return null;try{const url=new URL(raw),base=new URL(DIFFUSION_BASE_URL);if(url.origin!==base.origin)return null;const parts=url.pathname.split('/').filter(Boolean);if(parts.length<2)return null;return{customer:parts[0],slug:parts.slice(1).join('/'),url:raw};}catch(_){return null;}}
  function currentDiffusionUrl(){const raw=String($('diffusion-slug')?.value||'').trim(),slug=slugify(raw);if(!slug)return diffusionExistingUrl&&!diffusionDirty?diffusionExistingUrl:'';if(diffusionExistingUrl&&!diffusionDirty)return diffusionExistingUrl;return `${DIFFUSION_BASE_URL}${encodeURIComponent(diffusionCustomerSlug)}/${encodeURIComponent(slug)}`;}
  function renderDiffusionAddress(){const input=$('diffusion-slug'),prefix=$('diffusion-url-prefix'),preview=$('diffusion-url-preview'),open=$('diffusion-url-open'),note=$('diffusion-url-note');if(!input||!prefix||!preview)return;prefix.textContent=`${DIFFUSION_BASE_URL}${diffusionCustomerSlug||'client'}/`;const url=currentDiffusionUrl();preview.textContent=url||'Adresse en attente du slug de campagne.';preview.classList.toggle('is-legacy',Boolean(diffusionExistingUrl&&!diffusionDirty));if(open){open.hidden=!url;open.href=url||'#';}if(note){if(isLegacyClientCampaign()&&diffusionExistingUrl&&!diffusionDirty)note.textContent=currentUser.role==='admin'?'URL historique reprise telle quelle. Vous pouvez modifier le slug si cette adresse doit être corrigée.':'URL historique reprise telle quelle depuis la campagne existante.';else note.textContent='Le nom du client constitue automatiquement la première partie de l’adresse. Saisissez uniquement le slug souhaité pour cette campagne.';}}
  const iso=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10);};
  const genderRequiredTheme=()=>['sexisme','mixite','allie-mixite'].includes(String(theme||'').toLowerCase());
  const defaultSocio=()=>genderRequiredTheme()?[{kind:'gender',q:'Quel est votre genre ?',opts:[{label:'Homme',n:0},{label:'Femme',n:0},{label:'Non binaire',n:0},{label:'Autre',n:0}]}]:[];
  const normalizeLocale=value=>String(value||'fr').trim().toLowerCase().replaceAll('_','-')||'fr';
  const AGE_TRANSLATIONS={
    fr:['Votre âge',['Moins de 20 ans','Entre 20 et 34 ans','Entre 35 et 49 ans','Entre 50 et 65 ans','Plus de 65 ans']],
    en:['Your age',['Under 20','20 to 34','35 to 49','50 to 65','Over 65']],
    de:['Ihr Alter',['Unter 20 Jahre','20 bis 34 Jahre','35 bis 49 Jahre','50 bis 65 Jahre','Über 65 Jahre']],
    es:['Su edad',['Menos de 20 años','Entre 20 y 34 años','Entre 35 y 49 años','Entre 50 y 65 años','Más de 65 años']],
    it:['La sua età',['Meno di 20 anni','Tra 20 e 34 anni','Tra 35 e 49 anni','Tra 50 e 65 anni','Più di 65 anni']],
    br:['Sua idade',['Menos de 20 anos','Entre 20 e 34 anos','Entre 35 e 49 anos','Entre 50 e 65 anos','Mais de 65 anos']],
    pt:['A sua idade',['Menos de 20 anos','Entre 20 e 34 anos','Entre 35 e 49 anos','Entre 50 e 65 anos','Mais de 65 anos']],
    nl:['Uw leeftijd',['Jonger dan 20 jaar','20 tot 34 jaar','35 tot 49 jaar','50 tot 65 jaar','Ouder dan 65 jaar']],
    'nl-be':['Uw leeftijd',['Jonger dan 20 jaar','20 tot 34 jaar','35 tot 49 jaar','50 tot 65 jaar','Ouder dan 65 jaar']],
    pl:['Twój wiek',['Poniżej 20 lat','20–34 lata','35–49 lat','50–65 lat','Powyżej 65 lat']],
    ro:['Vârsta dvs.',['Sub 20 de ani','Între 20 și 34 de ani','Între 35 și 49 de ani','Între 50 și 65 de ani','Peste 65 de ani']],
    ru:['Ваш возраст',['Младше 20 лет','От 20 до 34 лет','От 35 до 49 лет','От 50 до 65 лет','Старше 65 лет']],
    tr:['Yaşınız',['20 yaşından küçük','20–34 yaş','35–49 yaş','50–65 yaş','65 yaşından büyük']],
    bg:['Вашата възраст',['Под 20 години','Между 20 и 34 години','Между 35 и 49 години','Между 50 и 65 години','Над 65 години']],
    'sv-se':['Din ålder',['Under 20 år','20–34 år','35–49 år','50–65 år','Över 65 år']],
    ja:['年齢',['20歳未満','20～34歳','35～49歳','50～65歳','65歳超']],
    'ko-kr':['연령',['20세 미만','20~34세','35~49세','50~65세','65세 초과']],
    zf:['您的年龄',['20岁以下','20至34岁','35至49岁','50至65岁','65岁以上']],
    zh:['您的年齡',['20歲以下','20至34歲','35至49歲','50至65歲','65歲以上']]
  };
  const ageForLocale=locale=>{const loc=String(locale||'fr').trim().toLowerCase().replaceAll('_','-'),row=AGE_TRANSLATIONS[loc]||AGE_TRANSLATIONS.fr;return{kind:'age',q:row[0],opts:row[1].map(label=>({label,n:0}))};};
  const AGE=ageForLocale('fr');
  const EXAMPLES=[['Business Unit',['Business Unit 1','Business Unit 2']],['Régions',['Région 1','Région 2']],['Fonction',['Fonction 1','Fonction 2']],['Manager ou collaborateur',['Manager','Collaborateur']]];
  const newSubcriterion=()=>({q:'Précisez votre choix',opts:[{label:'Sous-réponse 1',n:0},{label:'Sous-réponse 2',n:0}],subcriteria:[]});
  const rawSubcriteria=option=>Array.isArray(option?.subcriteria)?option.subcriteria:(option?.subcriterion?[option.subcriterion]:[]);
  function normalizeCriterion(item){
    return {
      ...(item?.kind?{kind:String(item.kind)}:{}),
      ...(item?.source_id!==undefined?{source_id:item.source_id}:{}),
      ...(item?.multiple===true||item?.multi_select===true||item?.multiple_answers===true?{multiple:true}:{}),
      q:String(item?.q||item?.question||''),
      opts:(Array.isArray(item?.opts)?item.opts:[]).map(option=>({
        ...(option?.source_id!==undefined?{source_id:option.source_id}:{}),
        label:String(option?.label||''),
        n:Number(option?.n)||0,
        subcriteria:rawSubcriteria(option).map(normalizeCriterion)
      }))
    };
  }
  const normalizedSocio=value=>(Array.isArray(value)?value:[]).map(normalizeCriterion);
  const isBlankAutoCriterion=criterion=>{const q=String(criterion?.q||'').trim();const labels=(Array.isArray(criterion?.opts)?criterion.opts:[]).map(o=>String(o?.label||'').trim());const noRealQuestion=!q||q==='Nouvelle donnée';const noRealAnswers=!labels.length||labels.every(label=>!label||/^Réponse\s*[12]$/i.test(label));return !criterion?.kind&&noRealQuestion&&noRealAnswers;};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const normalizeCountry=value=>String(value||'').trim().toUpperCase();
  const normalizeSocioLanguageVariants=(value,sourceSurveyId='')=>{const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;const surveyId=String(sourceSurveyId||'').trim();const scoped=surveyId&&value.bySurvey&&typeof value.bySurvey==='object'&&!Array.isArray(value.bySurvey)&&value.bySurvey[surveyId]&&typeof value.bySurvey[surveyId]==='object'&&!Array.isArray(value.bySurvey[surveyId])?value.bySurvey[surveyId]:value;const add=(locale,items)=>{const loc=normalizeLocale(locale);if(loc&&Array.isArray(items)&&!out[loc])out[loc]=normalizedSocio(items);};for(const [key,items] of Object.entries(scoped)){if(key==='bySurvey')continue;if(Array.isArray(items))add(key,items);}const buckets=Object.entries(scoped).filter(([key,val])=>key!=='bySurvey'&&val&&typeof val==='object'&&!Array.isArray(val));buckets.sort(([a],[b])=>{const rank=k=>k==='250'?0:['ALL','*','default'].includes(k)?1:2;return rank(a)-rank(b)||String(a).localeCompare(String(b));});for(const [,locales] of buckets)for(const [locale,items] of Object.entries(locales||{}))add(locale,items);return out;};
  const normalizeIntroVariants=value=>{const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;for(const [locale,text] of Object.entries(value)){const loc=normalizeLocale(locale),v=String(text??'').trim();if(loc&&v)out[loc]=v;}return out;};
  const countryLabel=code=>{try{return new Intl.DisplayNames(['fr'],{type:'region'}).of(code)||code}catch(_){return code}};
  const localeLabel=code=>{const labels={fr:'Français',en:'Anglais',de:'Allemand',es:'Espagnol',it:'Italien',pt:'Portugais',br:'Portugais (Brésil)','pt-br':'Portugais (Brésil)',nl:'Néerlandais','nl-be':'Néerlandais (Belgique)',pl:'Polonais',ro:'Roumain',ru:'Russe',tr:'Turc',bg:'Bulgare',ja:'Japonais',ko:'Coréen','ko-kr':'Coréen',zh:'Chinois',zf:'Chinois traditionnel','sv-se':'Suédois',ar:'Arabe',sk:'Slovaque'};return labels[normalizeLocale(code)]||String(code||'').toUpperCase();};

  const reviewState=()=>{translationReviewState=translationReviewState&&typeof translationReviewState==='object'&&!Array.isArray(translationReviewState)?translationReviewState:{};translationReviewState.intro=translationReviewState.intro&&typeof translationReviewState.intro==='object'?translationReviewState.intro:{};translationReviewState.socio=translationReviewState.socio&&typeof translationReviewState.socio==='object'?translationReviewState.socio:{};translationReviewState.todo=translationReviewState.todo&&typeof translationReviewState.todo==='object'?translationReviewState.todo:{};translationReviewState.baselines=translationReviewState.baselines&&typeof translationReviewState.baselines==='object'?translationReviewState.baselines:{};translationReviewState.baselines.intro=translationReviewState.baselines.intro&&typeof translationReviewState.baselines.intro==='object'?translationReviewState.baselines.intro:{};translationReviewState.baselines.socio=translationReviewState.baselines.socio&&typeof translationReviewState.baselines.socio==='object'?translationReviewState.baselines.socio:{};for(const [loc,paths] of Object.entries(translationReviewState.todo)){if(!Array.isArray(paths)||!paths.length)continue;const todo=new Set(paths);if(Array.isArray(translationReviewState.socio[loc]))translationReviewState.socio[loc]=translationReviewState.socio[loc].filter(path=>!todo.has(path));if(translationReviewState.baselines.socio[loc])for(const path of todo)delete translationReviewState.baselines.socio[loc][path];}return translationReviewState;};
  const criterionKey=(c,i)=>String(c?.source_id??`i${i}`);
  const reviewPathValue=(criteria,path)=>{const rows=Array.isArray(criteria)?criteria:[];if(String(path).startsWith('q:')){const key=String(path).slice(2);const c=rows.find((x,i)=>criterionKey(x,i)===key);return String(c?.q||'');}if(String(path).startsWith('o:')){const bits=String(path).split(':'),key=bits[1],optionKey=bits.slice(2).join(':');const c=rows.find((x,i)=>criterionKey(x,i)===key);if(!c)return'';const o=(c.opts||[]).find((x,i)=>String(x?.source_id??`i${i}`)===optionKey);return String(o?.label||'');}return'';};
  const diffTokens=value=>String(value??'').match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[];
  function renderTextDiff(before,after){const a=diffTokens(before),b=diffTokens(after),n=a.length,m=b.length,dp=Array.from({length:n+1},()=>Array(m+1).fill(0));for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);let i=0,j=0,out='';while(i<n||j<m){if(i<n&&j<m&&a[i]===b[j]){out+=esc(a[i]);i++;j++;continue;}if(j<m&&(i>=n||dp[i][j+1]>=dp[i+1]?.[j])){out+=`<ins class="translation-diff-add">${esc(b[j])}</ins>`;j++;continue;}if(i<n){out+=`<del class="translation-diff-remove">${esc(a[i])}</del>`;i++;}}return out||esc(after);}
  function markIntroTranslationsToReview(referenceLocale,beforeText){const st=reviewState();for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(referenceLocale)||!String(introForLocale(n)||'').trim())continue;if(!st.intro[n])st.baselines.intro[n]={referenceLocale:normalizeLocale(referenceLocale),text:String(beforeText||'')};st.intro[n]=true;}}
  function socioDiffPaths(before,after){const paths=[];const max=Math.max(before?.length||0,after?.length||0);for(let i=0;i<max;i++){const a=before?.[i],b=after?.[i],key=criterionKey(b||a,i);if(!a||!b||String(a.q||'')!==String(b.q||''))paths.push(`q:${key}`);const ao=a?.opts||[],bo=b?.opts||[],m=Math.max(ao.length,bo.length);for(let j=0;j<m;j++)if(!ao[j]||!bo[j]||String(ao[j]?.label||'')!==String(bo[j]?.label||''))paths.push(`o:${key}:${String(bo[j]?.source_id??ao[j]?.source_id??`i${j}`)}`);}return [...new Set(paths)];}
  function markSocioTranslationsToReview(referenceLocale,paths,before){if(!paths.length)return;const st=reviewState();for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(referenceLocale)||!Array.isArray(socioLanguageVariants?.[n])||!socioLanguageVariants[n].length)continue;const todo=new Set(translationTodoPaths(n)),reviewPaths=paths.filter(path=>!todo.has(path));if(!reviewPaths.length)continue;st.socio[n]=[...new Set([...(Array.isArray(st.socio[n])?st.socio[n]:[]),...reviewPaths])];st.baselines.socio[n]=st.baselines.socio[n]&&typeof st.baselines.socio[n]==='object'?st.baselines.socio[n]:{};for(const path of reviewPaths)if(!st.baselines.socio[n][path])st.baselines.socio[n][path]={referenceLocale:normalizeLocale(referenceLocale),text:reviewPathValue(before,path)};}}
  function reviewCount(locale){const st=reviewState(),loc=normalizeLocale(locale);return (st.intro[loc]?1:0)+(Array.isArray(st.socio[loc])?st.socio[loc].length:0);}
  function clearCriterionReview(locale,criterion,index){const st=reviewState(),loc=normalizeLocale(locale),key=criterionKey(criterion,index),rows=Array.isArray(st.socio[loc])?st.socio[loc]:[];const removed=rows.filter(x=>x.startsWith(`q:${key}`)||x.startsWith(`o:${key}:`));st.socio[loc]=rows.filter(x=>!removed.includes(x));if(st.baselines.socio[loc])for(const path of removed)delete st.baselines.socio[loc][path];scheduleAutosave(0);renderSocioContext();renderSocio();}

  function projectCountries(){const raw=Array.isArray(project?.countries)?project.countries:[];const selected=normalizeCountry(project?.selected_country_code);return [...new Set([...raw.map(normalizeCountry),selected].filter(Boolean))];}
  function projectLocales(){const values=[];if(Array.isArray(project?.content_locales))values.push(...project.content_locales);if(Array.isArray(project?.locales))values.push(...project.locales);if(project?.selected_locale)values.push(project.selected_locale);const map=project?.country_locales&&typeof project.country_locales==='object'&&!Array.isArray(project.country_locales)?project.country_locales:{};for(const rows of Object.values(map))if(Array.isArray(rows))values.push(...rows);values.push(...Object.keys(socioLanguageVariants||{}),...Object.keys(introVariants||{}),...Object.keys(introResolvedVariants||{}));return [...new Set(values.map(normalizeLocale).filter(Boolean))];}
  function socioForLocale(locale){const loc=normalizeLocale(locale);return Array.isArray(socioLanguageVariants?.[loc])?clone(socioLanguageVariants[loc]):null;}
  function introForLocale(locale){const loc=normalizeLocale(locale),primary=normalizeLocale(project?.selected_locale||(Array.isArray(project?.locales)&&project.locales[0])||'fr');if(introVariants?.[loc]!==undefined)return String(introVariants[loc]||'');if(introResolvedVariants?.[loc]!==undefined)return String(introResolvedVariants[loc]||'');return loc===primary?String(project?.introduction_html??project?.theme_introduction_html??''):'';}
  function introReference(){const socioRef=normalizeLocale(socioReference().locale),preferred=[socioRef,'fr','en','es',...projectLocales()].filter(Boolean),seen=new Set();for(const loc of preferred){const n=normalizeLocale(loc);if(seen.has(n))continue;seen.add(n);const text=String(introVariants?.[n]??introResolvedVariants?.[n]??'').trim();if(text)return{locale:n,text};}const primary=normalizeLocale(project?.selected_locale||(Array.isArray(project?.locales)&&project.locales[0])||'fr'),projectIntro=String(project?.introduction_html||'').trim();if(projectIntro)return{locale:primary,text:projectIntro};const themeIntro=String(project?.theme_introduction_html||'').trim();return themeIntro?{locale:'fr',text:themeIntro}:{locale:'',text:''};}
  function comparableSocioText(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();}
  function socioComparableMap(items){const out=new Map();const walk=(rows,prefix='')=>{(Array.isArray(rows)?rows:[]).forEach((criterion,ci)=>{const cPath=prefix?`${prefix}.c${ci}`:`c${ci}`;out.set(`${cPath}.q`,comparableSocioText(criterion?.q));(Array.isArray(criterion?.opts)?criterion.opts:[]).forEach((option,oi)=>{const oPath=`${cPath}.o${oi}`;out.set(`${oPath}.label`,comparableSocioText(option?.label));walk(rawSubcriteria(option),oPath);});});};walk(normalizedSocio(items));return out;}
  function socioSimilarityScore(referenceItems,candidateItems){const ref=socioComparableMap(referenceItems),candidate=socioComparableMap(candidateItems);if(!ref.size||!candidate.size)return 0;let exact=0,comparable=0;for(const [path,text] of ref){if(!text)continue;const other=candidate.get(path);if(other===undefined)continue;comparable++;if(other===text)exact++;}const denominator=Math.max(ref.size,candidate.size,1),coverage=comparable/denominator,exactRatio=exact/denominator,sizePenalty=Math.abs(ref.size-candidate.size)/denominator;return (exactRatio*100)+(coverage*8)-(sizePenalty*12);}
  function inferSocioReferenceLocale(meta){
    const explicit=[meta?.sociodemo_reference_locale,meta?.reference_locale,meta?.legacy_payload?.sociodemoReferenceLocale,meta?.legacy_payload?.referenceLocale,meta?.legacy_preview_payload?.referenceLocale,meta?.legacy_preview_payload?.reference_locale].map(value=>String(value||'').trim()).filter(Boolean).map(normalizeLocale);
    for(const loc of explicit){if(Array.isArray(socioLanguageVariants?.[loc])&&socioLanguageVariants[loc].length)return loc;}
    // Exception historique déterministe : Orange (#20), survey legacy #382.
    // Cette campagne a été construite avec l'anglais comme structure DSD maître.
    // Ne jamais ré-inférer sa référence depuis le texte des variantes : les contenus
    // multilingues legacy peuvent être partiellement similaires et produire un faux
    // positif (FR/AR/etc.).
    const legacyCustomer=String(meta?.legacy_customer_id||meta?.legacyCustomerId||'').trim();
    const legacySurvey=String(meta?.legacy_survey_id||meta?.legacySurveyId||'').trim();
    if(meta?.legacy_history===true&&legacyCustomer==='20'&&legacySurvey==='382'&&Array.isArray(socioLanguageVariants?.en)&&socioLanguageVariants.en.length)return'en';
    return'';
  }

  function isOrange382Project(meta){
    const legacyCustomer=String(meta?.legacy_customer_id||meta?.legacyCustomerId||'').trim();
    const legacySurvey=String(meta?.legacy_survey_id||meta?.legacySurveyId||'').trim();
    return legacySurvey==='382'&&(legacyCustomer==='20'||String(projectId||'')==='266');
  }
  function orangeFamilyLikeCriterion(criterion,familyCriterion){
    const familyCount=Array.isArray(familyCriterion?.opts)?familyCriterion.opts.length:0;
    const count=Array.isArray(criterion?.opts)?criterion.opts.length:0;
    return familyCount===6&&count===familyCount;
  }
  function stripDuplicateFamilyChildren(areaCriterion,familyCriterion){
    let changed=false;
    for(const option of areaCriterion?.opts||[]){
      const children=Array.isArray(option?.subcriteria)?option.subcriteria:[];
      const kept=children.filter(child=>!orangeFamilyLikeCriterion(child,familyCriterion));
      if(kept.length!==children.length){option.subcriteria=kept;changed=true;}
    }
    return changed;
  }
  function repairOrange382DivisionOrder(meta){
    if(!isOrange382Project(meta))return{changed:false};
    let changed=false;
    for(const [loc,criteria] of Object.entries(socioLanguageVariants||{})){
      if(!Array.isArray(criteria)||!criteria.length)continue;
      let divisionIndex=-1;
      if(loc==='en')divisionIndex=criteria.findIndex(c=>/division/i.test(String(c?.q||'')));
      if(divisionIndex<0){
        const en=socioLanguageVariants?.en;
        const enIndex=Array.isArray(en)?en.findIndex(c=>/division/i.test(String(c?.q||''))):-1;
        divisionIndex=enIndex>=0&&criteria[enIndex]?enIndex:5;
      }
      const division=criteria[divisionIndex];
      if(!division||!Array.isArray(division.opts)||division.opts.length<8)continue;

      // 2 Europe, 3 MEA, 5 Cyberdefense: famille de métiers (N2), puis Région (N3).
      for(const optionIndex of [1,2,4]){
        const branch=division.opts[optionIndex];
        const roots=Array.isArray(branch?.subcriteria)?branch.subcriteria:[];
        if(roots.length<2)continue;
        const family=roots[0],area=roots[1];
        if(!family||!area||!Array.isArray(family.opts)||family.opts.length!==6)continue;
        stripDuplicateFamilyChildren(area,family);
        for(const familyOption of family.opts){
          familyOption.subcriteria=Array.isArray(familyOption.subcriteria)?familyOption.subcriteria:[];
          const alreadyHasArea=familyOption.subcriteria.some(child=>String(child?.q||'').trim()===String(area?.q||'').trim()&&Array.isArray(child?.opts)&&child.opts.length===area.opts.length);
          if(!alreadyHasArea)familyOption.subcriteria.push(clone(area));
        }
        branch.subcriteria=[family,...roots.slice(2)];
        changed=true;
      }

      // Cyberdefense uniquement : sous Région (N3), la réponse « Orange Business - France »
      // doit ouvrir « OB France Regions » (N4). On réutilise les libellés/réponses déjà
      // présents dans la branche Orange Business de la même langue, sans recopier les
      // dépendances Famille de métiers plus profondes (la famille a déjà été choisie au N2).
      const businessBranch=division.opts[0];
      const businessRoots=Array.isArray(businessBranch?.subcriteria)?businessBranch.subcriteria:[];
      const businessArea=businessRoots.find(root=>Array.isArray(root?.opts)&&root.opts.length>=5) || businessRoots[0];
      const businessFranceOption=businessArea?.opts?.[1];
      const sourceFranceRegions=(Array.isArray(businessFranceOption?.subcriteria)?businessFranceOption.subcriteria:[]).find(child=>Array.isArray(child?.opts)&&child.opts.length===8);
      const cyberBranch=division.opts[4];
      const cyberFamily=Array.isArray(cyberBranch?.subcriteria)?cyberBranch.subcriteria[0]:null;
      if(sourceFranceRegions&&cyberFamily&&Array.isArray(cyberFamily.opts)){
        for(const familyOption of cyberFamily.opts){
          const areaCriterion=(Array.isArray(familyOption?.subcriteria)?familyOption.subcriteria:[]).find(child=>Array.isArray(child?.opts)&&child.opts.length>=5);
          const cyberFranceOption=areaCriterion?.opts?.[1];
          if(!cyberFranceOption)continue;
          cyberFranceOption.subcriteria=Array.isArray(cyberFranceOption.subcriteria)?cyberFranceOption.subcriteria:[];
          const alreadyHasFranceRegions=cyberFranceOption.subcriteria.some(child=>Array.isArray(child?.opts)&&child.opts.length===sourceFranceRegions.opts.length&&String(child?.q||'').trim()===String(sourceFranceRegions.q||'').trim());
          if(alreadyHasFranceRegions)continue;
          const franceRegions=clone(sourceFranceRegions);
          franceRegions.opts=(franceRegions.opts||[]).map(option=>({...option,subcriteria:[]}));
          cyberFranceOption.subcriteria.push(franceRegions);
          changed=true;
        }
      }

      // 6 Wholesale, 7 France: Famille de métiers et Région restent deux N2 indépendants.
      // On retire uniquement les doublons "famille de métiers" imbriqués sous Région.
      for(const optionIndex of [5,6]){
        const branch=division.opts[optionIndex],roots=Array.isArray(branch?.subcriteria)?branch.subcriteria:[];
        if(roots.length<2)continue;
        const family=roots[0],area=roots[1];
        if(stripDuplicateFamilyChildren(area,family))changed=true;
      }
      // Business (1), Innovation (4) et Corporate Functions (8) sont déjà dans le bon ordre : aucun déplacement.
    }
    return{changed};
  }
  function repairOrange382FrenchLabels(meta){
    if(!isOrange382Project(meta)||!Array.isArray(socioLanguageVariants?.fr))return{changed:false};
    const questionMap=new Map([
      ['Your division','Votre division'],
      ['Area','Région'],
      ['Please select, among the following, the segment you work for:','Parmi les propositions suivantes, sélectionnez votre famille de métiers :'],
      ['lease select, among the following, the segment you work for:','Parmi les propositions suivantes, sélectionnez votre famille de métiers :'],
      ['OB France Regions','Régions OB France']
    ]);
    const answerMap=new Map([
      ['Human resources','Ressources Humaines'],
      ['Finance, Performance and Strategy','Finance, Performance et Stratégie'],
      ['Marketing & Communication','Marketing et Communication'],
      ['Sales and Customer Relations','Vente & Relation Client'],
      ['Technology, Innovation, Networks and Data','Technologies, Innovation, Réseaux et Data'],
      ['Other support functions','Autres Fonctions Support'],
      ['Caribbean','Caraïbes'],
      ['Great North East','Grand Nord-Est'],
      ['Great West','Grand Ouest'],
      ['Great South East','Grand Sud-Est'],
      ['Great South West','Grand Sud-Ouest'],
      ['Reunion','La Réunion'],
      ['Other geographical area','Autre zone géographique'],
      ['SubSaharan Africa','Afrique subsaharienne'],
      ['Americas','Amériques'],
      ['Asia','Asie'],
      ['Eastern Europe','Europe de l’Est'],
      ['Western Europe','Europe de l’Ouest'],
      ['Middle East & North Africa','Moyen-Orient et Afrique du Nord'],
      ['Not in France','Hors de France'],
      ['France - Caribbean','France - Caraïbes'],
      ['France - Great North East','France - Grand Nord-Est'],
      ['France - Great West','France - Grand Ouest'],
      ['France - Great South East','France - Grand Sud-Est'],
      ['France - Great South West','France - Grand Sud-Ouest'],
      ['France - Reunion','France - La Réunion'],
      ['France - Other geographical area','France - Autre zone géographique']
    ]);
    let changed=false;
    const visit=criterion=>{
      const currentQ=String(criterion?.q||'').trim();
      if(questionMap.has(currentQ)){criterion.q=questionMap.get(currentQ);changed=true;}
      for(const option of criterion?.opts||[]){
        const currentLabel=String(option?.label||'').trim();
        if(answerMap.has(currentLabel)){option.label=answerMap.get(currentLabel);changed=true;}
        for(const child of option?.subcriteria||[])visit(child);
      }
    };
    for(const criterion of socioLanguageVariants.fr)visit(criterion);
    return{changed};
  }
  function socioReference(){const stable=normalizeLocale(socioReferenceLocaleStable);if(stable){const stableItems=socioForLocale(stable);if(Array.isArray(stableItems)&&stableItems.length)return{locale:stable,items:stableItems};}const preferred=[normalizeLocale(project?.selected_locale),'fr','en','es',...projectLocales()],seen=new Set();for(const loc of preferred){const n=normalizeLocale(loc);if(!n||seen.has(n))continue;seen.add(n);const items=socioForLocale(n);if(Array.isArray(items)&&items.length)return{locale:n,items};}const first=Object.keys(socioLanguageVariants||{}).find(loc=>Array.isArray(socioLanguageVariants[loc])&&socioLanguageVariants[loc].length);return first?{locale:first,items:socioForLocale(first)}:{locale:'',items:[]};}
  function isSocioReferenceLocale(){const ref=socioReference();return Boolean(ref.locale)&&normalizeLocale(ref.locale)===normalizeLocale(socioContextLocale);}
  function canAdminCleanLegacyVariant(){const refLoc=normalizeLocale(socioReference().locale),currentLoc=normalizeLocale(socioContextLocale);return currentUser.role==='admin'&&isLegacyClientCampaign()&&!isReadOnly()&&Boolean(refLoc)&&Boolean(currentLoc)&&refLoc!==currentLoc;}
  function syncSocioStructureControls(){
    const editable=!isReadOnly()&&isSocioReferenceLocale();
    const examples=document.querySelector('.socio-examples-visible');
    const addCustom=$('add-socio');
    if(examples){examples.hidden=!editable;examples.style.display=editable?'':'none';}
    if(addCustom){
      addCustom.hidden=false;
      addCustom.style.display=isReadOnly()?'none':'';
      addCustom.textContent=editable?'+ Ajouter un critère personnalisé':'+ Ajouter une donnée d’analyse';
      addCustom.title=editable?'':'La structure se construit dans la langue de référence.';
      addCustom.classList.toggle('is-translation-redirect',!editable);
    }
  }
  function renderStickySocioLanguages(){
    const host=$('socio-dsd-context');if(!host)return;
    let bar=host.querySelector('.socio-sticky-languages');
    if(!bar){bar=document.createElement('div');bar.className='socio-sticky-languages';host.appendChild(bar);}
    const ref=socioReference(),refLoc=normalizeLocale(ref.locale),current=normalizeLocale(socioContextLocale);
    bar.innerHTML=`<div class="socio-sticky-languages-head"><strong>Langue travaillée</strong>${refLoc?`<span>Structure pilotée depuis ${esc(localeLabel(refLoc))} (${esc(refLoc.toUpperCase())})</span>`:''}</div><div class="socio-sticky-language-buttons">${projectLocales().map(loc=>{const n=normalizeLocale(loc),c=translationCounts(n),isRef=n===refLoc,suffix=isRef?'Référence':[c.todo?`${c.todo} à traduire`:'',c.review?`${c.review} à vérifier`:''].filter(Boolean).join(' · ');return `<button type="button" class="${n===current?'is-active':''} ${isRef?'is-reference':''}" data-sticky-locale="${esc(n)}">${esc(localeLabel(n))} <small>${esc(n.toUpperCase())}${suffix?` · ${esc(suffix)}`:''}</small></button>`;}).join('')}</div>${refLoc&&current!==refLoc?`<button type="button" class="socio-go-reference" data-sticky-locale="${esc(refLoc)}">← Modifier la structure en ${esc(localeLabel(refLoc))}</button>`:''}`;
    bar.querySelectorAll('[data-sticky-locale]').forEach(btn=>btn.onclick=()=>{storeActiveLanguageContent();activateLanguage(btn.dataset.stickyLocale);renderSocioContext();renderSocio();scheduleAutosave(0);});
  }
  function referenceCriterionFor(criterion,index){const ref=socioReference();if(!ref.items?.length||normalizeLocale(ref.locale)===normalizeLocale(socioContextLocale))return null;let match=null;if(criterion?.source_id!==undefined)match=ref.items.find(c=>String(c?.source_id??'')===String(criterion.source_id));if(!match)match=ref.items[index]||null;return match?{locale:ref.locale,criterion:match}:null;}
  function renderSocioReference(criterion,index){const ref=referenceCriterionFor(criterion,index);if(!ref)return'';const st=reviewState(),loc=normalizeLocale(socioContextLocale),key=criterionKey(criterion,index),rows=Array.isArray(st.socio[loc])?st.socio[loc]:[],todos=translationTodoPaths(loc),qPath=`q:${key}`,qTodo=todos.includes(qPath),qNeeds=!qTodo&&rows.includes(qPath),qBase=st.baselines.socio?.[loc]?.[qPath]?.text;const opts=(ref.criterion.opts||[]).map((o,j)=>{const optionKey=String(o?.source_id??`i${j}`),path=`o:${key}:${optionKey}`,todo=todos.includes(path),needs=!todo&&rows.includes(path),base=st.baselines.socio?.[loc]?.[path]?.text,label=needs&&base!==undefined?renderTextDiff(base,o.label):esc(o.label);return `<li class="${needs?'has-translation-diff':''} ${todo?'is-translation-todo':''}">${label}</li>`;}).join('');const needs=rows.some(x=>(x===qPath||x.startsWith(`o:${key}:`))&&!todos.includes(x)),todo=todos.some(x=>x===qPath||x.startsWith(`o:${key}:`)),question=qNeeds&&qBase!==undefined?renderTextDiff(qBase,ref.criterion.q||''):esc(ref.criterion.q||'');return `<aside class="socio-reference-panel">${todo?`<div class="translation-review-alert translation-todo-alert"><strong>Traduction à renseigner</strong><span>Cette donnée a été ajoutée en ${esc(localeLabel(ref.locale))}. Traduisez la question et les réponses en ${esc(localeLabel(loc))}.</span></div>`:needs?`<div class="translation-review-alert"><strong>Traduction à vérifier</strong><span>Les changements de la référence sont surlignés ci-dessous.</span><button type="button" data-review-clear="${index}">Marquer comme vérifié</button></div>`:''}<div class="socio-reference-head"><strong>Référence projet · ${esc(localeLabel(ref.locale))}</strong><span class="status-pill">${esc(String(ref.locale).toUpperCase())}</span></div><div class="socio-reference-question ${qNeeds?'has-translation-diff':''} ${qTodo?'is-translation-todo':''}">${question}</div><div class="socio-reference-label">Réponses de référence</div><ol>${opts}</ol><small>${todo?'Renseignez les champs à droite. Le statut disparaît automatiquement lorsque la traduction est complète.':'Ajout en vert · suppression en rouge barré. La traduction à droite n’est jamais modifiée automatiquement.'}</small></aside>`;}
  function renderIntroReference(){const panel=$('intro-reference-panel'),text=$('intro-reference-text'),title=$('intro-reference-title'),badge=$('intro-reference-badge'),editTitle=$('intro-edit-title');if(!panel||!text)return;const ref=introReference(),current=normalizeLocale(socioContextLocale);if(editTitle)editTitle.textContent=`Introduction · ${localeLabel(current)} (${current.toUpperCase()})`;if(!ref.text||normalizeLocale(ref.locale)===current){panel.hidden=true;return;}panel.hidden=false;if(title)title.textContent=`Référence projet · ${localeLabel(ref.locale)}`;if(badge)badge.textContent=String(ref.locale).toUpperCase();const head=panel.querySelector('.parameter-reference-head');let editRef=panel.querySelector('[data-edit-intro-reference]');if(currentUser.role==='admin'&&head){if(!editRef){editRef=document.createElement('button');editRef.type='button';editRef.className='button button-secondary button-small';editRef.dataset.editIntroReference='1';editRef.style.marginLeft='auto';head.appendChild(editRef);}editRef.textContent=`Modifier ${localeLabel(ref.locale)}`;editRef.hidden=false;editRef.onclick=()=>{storeActiveLanguageContent();activateLanguage(ref.locale);renderSocioContext();renderSocio();scheduleAutosave(0);setTimeout(()=>$('intro')?.focus(),0);};}else if(editRef)editRef.hidden=true;const st=reviewState(),needs=Boolean(st.intro[current]),baseline=st.baselines.intro?.[current]?.text,currentText=stripHtml(ref.text);if(needs&&baseline!==undefined)text.innerHTML=renderTextDiff(stripHtml(baseline),currentText);else text.textContent=currentText;const alert=$('intro-review-alert'),clear=$('intro-review-clear');if(alert)alert.hidden=!needs;if(clear)clear.onclick=()=>{delete st.intro[current];delete st.baselines.intro[current];scheduleAutosave(0);renderSocioContext();renderIntroReference();};}
  function storeActiveSocio(){if(!socioContextLocale)return;const normalized=normalizedSocio(socio),serialized=JSON.stringify(normalized);if(!socioContextHasStored&&serialized===socioContextBaseline)return;const loc=normalizeLocale(socioContextLocale),ref=socioReference(),before=Array.isArray(socioLanguageVariants?.[loc])?clone(socioLanguageVariants[loc]):[];if(ref.locale&&normalizeLocale(ref.locale)===loc)markSocioTranslationsToReview(loc,socioDiffPaths(before,normalized),before);socioLanguageVariants[loc]=clone(normalized);socioContextHasStored=true;socioContextBaseline=serialized;}
  function storeActiveIntro(){if(!socioContextLocale||!$('intro'))return;const current=String($('intro').value||'').trim();if(!introContextHasStored&&current===introContextBaseline)return;const loc=normalizeLocale(socioContextLocale),ref=introReference(),before=String(introVariants?.[loc]??introResolvedVariants?.[loc]??'').trim();if(ref.locale&&normalizeLocale(ref.locale)===loc&&current!==before)markIntroTranslationsToReview(loc,before);if(current)introVariants[loc]=current;else delete introVariants[loc];introContextHasStored=Boolean(current);introContextBaseline=current;}
  function storeActiveLanguageContent(){storeActiveSocio();storeActiveIntro();}
  function activateLanguage(locale){socioContextLocale=normalizeLocale(locale);const countries=projectCountries();socioContextCountry=normalizeCountry(project?.selected_country_code)||(countries[0]||'');const exact=socioForLocale(socioContextLocale);socio=normalizeSexismeCriteria(normalizedSocio(exact||(Array.isArray(project?.sociodemo)&&project.sociodemo.length?project.sociodemo:defaultSocio())));socioContextHasStored=Boolean(exact);socioContextBaseline=JSON.stringify(normalizedSocio(socio));const intro=stripHtml(introForLocale(socioContextLocale));if($('intro'))$('intro').value=intro;introContextHasStored=Boolean(introVariants?.[socioContextLocale]);introContextBaseline=String(intro||'').trim();socioOpenRoots.clear();socioOpenBranches.clear();renderIntroReference();}
  function renderSocioContext(){const introWrap=$('socio-context'),introSelect=$('socio-locale'),introNote=$('socio-context-note'),dsdWrap=$('socio-dsd-context'),dsdSelect=$('socio-dsd-locale'),dsdNote=$('socio-dsd-context-note');if(!introWrap||!introSelect)return;const locales=projectLocales();if(!locales.length){introWrap.hidden=true;if(dsdWrap)dsdWrap.hidden=true;return;}introWrap.hidden=false;if(dsdWrap)dsdWrap.hidden=false;const currentLocale=locales.includes(normalizeLocale(socioContextLocale))?normalizeLocale(socioContextLocale):(locales[0]||'fr');const options=locales.map(loc=>{const c=translationCounts(loc),suffix=[c.todo?`${c.todo} à traduire`:'',c.review?`${c.review} à vérifier`:''].filter(Boolean).join(' · ');return `<option value="${esc(loc)}">${esc(localeLabel(loc))} (${esc(loc.toUpperCase())})${suffix?` · ${suffix}`:''}</option>`}).join('');introSelect.innerHTML=options;introSelect.value=currentLocale;if(dsdSelect){dsdSelect.innerHTML=options;dsdSelect.value=currentLocale;}socioContextLocale=currentLocale;if(introNote)introNote.textContent='Modifiez la langue sélectionnée en gardant la langue de référence Me&YouToo visible ci-dessous.';if(dsdNote)dsdNote.textContent='Les données proposées viennent du référentiel Me&YouToo dans la langue sélectionnée.';syncSocioStructureControls();renderStickySocioLanguages();const changeLocale=nextLocale=>{storeActiveLanguageContent();scheduleAutosave(0);activateLanguage(nextLocale);renderSocioContext();renderSocio();};introSelect.onchange=()=>changeLocale(introSelect.value);if(dsdSelect)dsdSelect.onchange=()=>changeLocale(dsdSelect.value);}
  const normalizeResultResources=value=>(Array.isArray(value)?value:[]).map((item,i)=>{const title=String(item?.title||item?.titre||item?.label||item?.text||'').trim(),url=String(item?.url||item?.href||item?.link||'').trim(),documentId=String(item?.documentId??item?.document_id??'').trim(),legacyFilename=String(item?.legacyFilename||item?.legacy_filename||'').trim(),filename=String(item?.filename||legacyFilename||'').trim(),type=String(item?.type||'').trim().toLowerCase()||(documentId?'document':legacyFilename&&!url?'legacy_document':'link');return{title,type,url,documentId,filename,legacyFilename}}).filter(item=>item.title||item.url||item.documentId||item.legacyFilename);
  const validHttpUrl=value=>{try{const u=new URL(String(value||'').trim());return u.protocol==='http:'||u.protocol==='https:'}catch(_){return false}};
  const resourceDocumentById=id=>resourceLibrary.find(doc=>String(doc.id)===String(id));
  const resourceComplete=item=>{if(!String(item?.title||'').trim())return false;if(item?.type==='document')return Boolean(item.documentId&&resourceDocumentById(item.documentId));if(item?.type==='legacy_document')return false;return validHttpUrl(item?.url)};
  async function loadResourceLibrary(){try{const data=await api(`/api/projects/${projectId}/resource-library`);resourceLibrary=Array.isArray(data?.documents)?data.documents:[];}catch(_){resourceLibrary=[];}}
  const fileToBase64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Lecture du PDF impossible'));reader.onload=()=>resolve(String(reader.result||'').split(',').pop()||'');reader.readAsDataURL(file);});
  function resourceModal(){
    let dialog=$('result-resource-modal');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='result-resource-modal';
    dialog.className='studio-modal result-resource-modal';
    dialog.innerHTML=`<div class="studio-modal-shell"><div class="studio-modal-icon" aria-hidden="true"></div><div class="studio-modal-copy"><p class="eyebrow">Ressource après les résultats</p><h2 id="result-resource-modal-title">Ajouter une ressource</h2><p class="studio-modal-message">Choisissez ce que le répondant ouvrira à la fin de l’autodiagnostic : un lien ou un fichier PDF.</p></div><button class="studio-modal-close" type="button" aria-label="Fermer">×</button><div class="result-resource-modal-fields"><label class="field"><span>Texte affiché aux répondants *</span><input id="result-resource-modal-label" maxlength="160" placeholder="Ex. Le harcèlement au travail : le définir et comment y réagir chez Infomil"></label><div class="result-resource-type-choice" role="radiogroup" aria-label="Type de ressource"><label><input type="radio" name="result-resource-type" value="link" checked><span>🔗 Lien</span></label><label><input type="radio" name="result-resource-type" value="document"><span>📄 Document PDF</span></label></div><label class="field" data-resource-link-field><span>URL du lien <span data-resource-link-required>*</span></span><input id="result-resource-modal-url" type="url" inputmode="url" placeholder="https://..."></label><label class="field result-resource-document-field" data-resource-document-field hidden><span>Fichier PDF <span data-resource-document-required>*</span></span><input id="result-resource-upload-file" type="file" accept="application/pdf,.pdf"><small id="result-resource-document-help">Sélectionnez le PDF à proposer aux répondants.</small></label><p class="result-resource-modal-error" id="result-resource-modal-error" hidden></p></div><div class="studio-modal-actions"><button class="button button-ghost" type="button" data-resource-cancel>Annuler</button><button class="button button-primary" type="button" data-resource-confirm>Ajouter la ressource</button></div></div>`;
    document.body.appendChild(dialog);
    return dialog;
  }
  async function saveAdminResultResources(){
    if(currentUser.role!=='admin')return;
    const data=await api(`/api/admin/projects/${projectId}/result-resources`,{method:'PATCH',body:JSON.stringify({resultButtons:resultResources})});
    resultResources=normalizeResultResources(data?.resources||resultResources);
    renderResultResources();
  }
  async function uploadResultPdf(file,title=''){
    if(!file)throw new Error('Choisissez un fichier PDF.');
    if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name))throw new Error('Un fichier PDF est requis.');
    if(file.size>6*1024*1024)throw new Error('Le PDF ne doit pas dépasser 6 Mo.');
    const data=await api(`/api/projects/${projectId}/resource-library`,{method:'POST',body:JSON.stringify({filename:file.name,title:title||null,mimeType:'application/pdf',contentBase64:await fileToBase64(file)})});
    await loadResourceLibrary();
    return data.document;
  }
  function openResourceModal(index=null){
    if(isReadOnly()&&currentUser.role!=='admin')return;
    if(index===null&&resultResources.length>=10){window.StudioModal.alert({eyebrow:'Ressources après les résultats',title:'Maximum atteint',message:'Vous pouvez ajouter au maximum 10 ressources.',type:'info',confirmLabel:'Fermer'});return;}
    const dialog=resourceModal(),editing=index!==null,item=editing?resultResources[index]:{title:'',type:'link',url:'',documentId:''};
    const title=dialog.querySelector('#result-resource-modal-title'),label=dialog.querySelector('#result-resource-modal-label'),url=dialog.querySelector('#result-resource-modal-url'),error=dialog.querySelector('#result-resource-modal-error'),confirm=dialog.querySelector('[data-resource-confirm]'),linkField=dialog.querySelector('[data-resource-link-field]'),documentField=dialog.querySelector('[data-resource-document-field]'),help=dialog.querySelector('#result-resource-document-help'),uploadFile=dialog.querySelector('#result-resource-upload-file');
    title.textContent=editing?'Modifier la ressource':'Ajouter une ressource';
    label.value=item.title||'';url.value=item.url||'';uploadFile.value='';error.hidden=true;confirm.textContent=editing?'Enregistrer les modifications':'Ajouter la ressource';
    const initialType=item.type==='document'||item.type==='legacy_document'?'document':'link';
    dialog.querySelectorAll('input[name="result-resource-type"]').forEach(radio=>radio.checked=radio.value===initialType);
    const existingDoc=item.type==='document'?resourceDocumentById(item.documentId):null;
    const syncType=()=>{const type=dialog.querySelector('input[name="result-resource-type"]:checked')?.value||'link',linkRequired=dialog.querySelector('[data-resource-link-required]'),documentRequired=dialog.querySelector('[data-resource-document-required]'),hasExistingPdf=item.type==='document'&&Boolean(item.documentId);linkField.hidden=type!=='link';linkField.style.display=type==='link'?'':'none';url.disabled=type!=='link';url.required=type==='link';if(linkRequired)linkRequired.hidden=type!=='link';documentField.hidden=type!=='document';documentField.style.display=type==='document'?'':'none';uploadFile.disabled=type!=='document';uploadFile.required=type==='document'&&!hasExistingPdf;if(documentRequired)documentRequired.hidden=type!=='document'||hasExistingPdf;if(type==='document'){if(item.type==='legacy_document'&&item.legacyFilename)help.textContent=`Document historique attendu : ${item.legacyFilename}. Sélectionnez le PDF correspondant.`;else if(existingDoc||hasExistingPdf)help.textContent=`PDF actuel : ${existingDoc?.filename||item.filename||'document existant'}. Choisissez un nouveau fichier uniquement si vous souhaitez le remplacer pour cette ressource.`;else help.textContent='Sélectionnez le PDF à proposer aux répondants.';}error.hidden=true;};
    dialog.querySelectorAll('input[name="result-resource-type"]').forEach(radio=>radio.onchange=syncType);syncType();
    const close=()=>{document.body.classList.remove('studio-modal-open');if(dialog.open)dialog.close();};
    dialog.querySelector('.studio-modal-close').onclick=close;dialog.querySelector('[data-resource-cancel]').onclick=close;dialog.onclick=e=>{if(e.target===dialog)close()};dialog.oncancel=e=>{e.preventDefault();close()};
    confirm.onclick=async()=>{
      const type=dialog.querySelector('input[name="result-resource-type"]:checked')?.value||'link',next={title:label.value.trim(),type};
      if(!next.title){error.textContent='Le texte affiché aux répondants est obligatoire.';error.hidden=false;label.focus();return;}
      confirm.disabled=true;
      try{
        if(type==='link'){
          next.url=url.value.trim();
          if(!validHttpUrl(next.url))throw new Error('Saisissez une URL complète commençant par http:// ou https://.');
        }else{
          const selectedFile=uploadFile.files?.[0];
          let doc=existingDoc;
          if(selectedFile)doc=await uploadResultPdf(selectedFile,next.title);
          if(!doc)throw new Error(item.type==='legacy_document'&&item.legacyFilename?`Sélectionnez le PDF correspondant à « ${item.legacyFilename} ».`:'Choisissez un fichier PDF.');
          next.documentId=String(doc.id);next.filename=doc.filename;
        }
        const before=clone(resultResources);
        if(editing)resultResources[index]=next;else resultResources.push(next);
        if(isReadOnly()&&currentUser.role==='admin'){
          confirm.textContent='Enregistrement…';
          try{await saveAdminResultResources();close();}
          catch(e){resultResources=before;throw e;}
        }else{close();renderResultResources();}
      }catch(e){error.textContent=e.message||'Enregistrement impossible.';error.hidden=false;confirm.disabled=false;confirm.textContent=editing?'Enregistrer les modifications':'Ajouter la ressource';}
    };
    [label,url,uploadFile].forEach(input=>input.oninput=()=>{error.hidden=true});
    document.body.classList.add('studio-modal-open');dialog.showModal();setTimeout(()=>label.focus(),0);
  }
  async function openResultPdf(item){
    const documentId=String(item?.documentId||'').trim();
    if(!documentId)return window.StudioModal.alert({title:'PDF indisponible',message:'Aucun fichier PDF consultable n’est rattaché à cette ressource.',type:'info',confirmLabel:'Fermer'});
    const popup=window.open('about:blank','_blank');
    if(popup){popup.document.title='Ouverture du PDF…';popup.document.body.innerHTML='<p style="font-family:Arial,sans-serif;padding:24px">Ouverture du PDF…</p>';}
    try{
      const base=typeof window.StudioAPI?.base==='function'?window.StudioAPI.base():String(window.STUDIO_API_BASE||'').replace(/\/$/,'');
      const response=await fetch(`${base}/api/projects/${encodeURIComponent(projectId)}/resource-library/${encodeURIComponent(documentId)}/download?inline=1`,{headers:{Authorization:`Bearer ${window.StudioAPI.token()}`}});
      if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.error||'Impossible d’ouvrir ce PDF.');}
      const blob=await response.blob(),url=URL.createObjectURL(blob);
      if(popup)popup.location.replace(url);else window.open(url,'_blank','noopener');
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){if(popup)popup.close();await window.StudioModal.alert({title:'PDF indisponible',message:e.message||'Impossible d’ouvrir ce PDF.',type:'error',confirmLabel:'Fermer'});}
  }

  async function attachLegacyResourceDocument(index){
    const item=resultResources[index];if(!item||item.type!=='legacy_document'||currentUser.role!=='admin')return;
    const input=document.createElement('input');input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;document.body.appendChild(input);
    input.onchange=async()=>{const file=input.files?.[0];input.remove();if(!file)return;try{const doc=await uploadResultPdf(file,item.legacyFilename||item.title);if(doc){resultResources[index]={title:item.title,type:'document',documentId:String(doc.id),filename:doc.filename};if(isReadOnly())await saveAdminResultResources();else renderResultResources();await window.StudioModal.alert({eyebrow:'Ressource après les résultats',title:'PDF rattaché',message:'Le document est maintenant associé à cette ressource.',type:'success'});}}catch(e){await window.StudioModal.alert({title:'Ajout impossible',message:e.message,type:'error'});}};
    input.click();
  }

  function renderResultResources(){
    const list=$('result-resources-list');if(!list)return;const ro=isReadOnly();
    const pendingLegacy=resultResources.filter(item=>item.type==='legacy_document');
    const warning=pendingLegacy.length?`<div class="composer-alert" data-tone="warning"><strong>PDF historique à rattacher</strong><br>${pendingLegacy.length} document${pendingLegacy.length>1?'s':''} importé${pendingLegacy.length>1?'s':''} depuis l’ancien moteur ${pendingLegacy.length>1?'doivent':'doit'} encore recevoir le fichier PDF avant diffusion.</div>`:'';
    if(!resultResources.length)list.innerHTML='<div class="result-resource-empty">Aucune ressource ajoutée pour le moment.</div>';
    else list.innerHTML=warning+resultResources.map((item,i)=>{const doc=item.type==='document'?resourceDocumentById(item.documentId):null;const meta=item.type==='document'?`📄 ${doc?.filename||item.filename||'Document PDF'}`:item.type==='legacy_document'?`📄 Document historique : ${item.legacyFilename} · PDF à rattacher`:`🔗 ${item.url}`;const viewAction=item.type==='document'&&item.documentId?`<button type="button" class="button button-secondary button-small" data-result-view-pdf="${i}">Voir le PDF</button>`:'';const legacyAdminAction=item.type==='legacy_document'&&currentUser.role==='admin'?`<button type="button" class="button button-secondary button-small" data-attach-legacy-document="${i}">Rattacher le PDF</button>`:'';const editActions=(ro&&currentUser.role!=='admin')?'':`<button type="button" class="button button-secondary button-small" data-result-edit="${i}">Modifier</button><button type="button" class="button button-ghost button-small result-resource-delete" data-result-remove="${i}">Supprimer</button>`;const actions=viewAction||legacyAdminAction||editActions?`<div class="result-resource-actions">${viewAction}${legacyAdminAction}${editActions}</div>`:'';return `<article class="result-resource-row ${item.type==='legacy_document'?'is-legacy-pending':''}"><div class="result-resource-copy"><strong>${esc(item.title)}</strong><span>${esc(meta)}</span></div>${actions}</article>`}).join('');
    list.querySelectorAll('[data-result-view-pdf]').forEach(el=>el.onclick=()=>openResultPdf(resultResources[Number(el.dataset.resultViewPdf)]));
    list.querySelectorAll('[data-attach-legacy-document]').forEach(el=>el.onclick=()=>attachLegacyResourceDocument(Number(el.dataset.attachLegacyDocument)));
    list.querySelectorAll('[data-result-edit]').forEach(el=>el.onclick=()=>openResourceModal(Number(el.dataset.resultEdit)));
    list.querySelectorAll('[data-result-remove]').forEach(el=>el.onclick=async()=>{const i=Number(el.dataset.resultRemove),ok=await window.StudioModal.confirm({eyebrow:'Ressource après les résultats',title:'Supprimer cette ressource ?',message:`« ${resultResources[i]?.title||'Cette ressource'} » ne sera plus proposée aux répondants.`,type:'danger',cancelLabel:'Conserver',confirmLabel:'Supprimer'});if(ok){const before=clone(resultResources);resultResources.splice(i,1);try{if(isReadOnly()&&currentUser.role==='admin')await saveAdminResultResources();else renderResultResources();}catch(e){resultResources=before;renderResultResources();show(e.message||'Suppression impossible.');}}});
    const add=$('add-result-resource');if(add){add.disabled=resultResources.length>=10;add.title=resultResources.length>=10?'Maximum de 10 ressources atteint':'';}
    renderResultResourcesPreview();
  }
  function renderResultResourcesPreview(){
    const preview=$('result-resources-preview');if(!preview)return;
    const visible=resultResources.filter(r=>String(r?.title||'').trim());
    preview.innerHTML=visible.length?visible.map(r=>`<div class="result-preview-resource"><span>${r.type==='document'||r.type==='legacy_document'?'📄':'↗'}</span>${esc(String(r.title||'').trim())}</div>`).join(''):'<div class="result-preview-empty">Vos ressources apparaîtront ici dès que vous en ajouterez.</div>';
  }

  function normalizeSexismeCriteria(items,locale=socioContextLocale){
    const loc=normalizeLocale(locale),todos=new Set(translationTodoPaths(loc)),keepCriterion=(c,i)=>!isBlankAutoCriterion(c)||todos.has(`q:${criterionKey(c,i)}`)||[...todos].some(path=>path.startsWith(`o:${criterionKey(c,i)}:`));
    if(!genderRequiredTheme())return items.filter(keepCriterion);
    let cleaned=items.filter(keepCriterion);
    cleaned=cleaned.filter(c=>c.kind==='age'||String(c.q||'').trim()==='Votre âge'||!/(?:âge|\bage\b)/i.test(String(c.q||'')));
    let gender=cleaned.find(c=>c.kind==='gender'||/genre/i.test(c.q||''));const genderWasExisting=Boolean(gender);
    if(!gender){gender=clone(defaultSocio()[0]);cleaned.unshift(gender);}else{gender.kind='gender';gender.q='Quel est votre genre ?';const existing=Array.isArray(gender.opts)?gender.opts:[];const count=label=>Number(existing.find(o=>String(o.label||'').trim().toLocaleLowerCase('fr-FR')===label.toLocaleLowerCase('fr-FR'))?.n)||0;const labels=['Homme','Femme'];if(!genderWasExisting||existing.some(o=>/^(non[ -]?binaire)$/i.test(String(o.label||'').trim())))labels.push('Non binaire');if(!genderWasExisting||existing.some(o=>/^autre$/i.test(String(o.label||'').trim())))labels.push('Autre');gender.opts=labels.map(label=>({label,n:count(label)}));}
    const age=cleaned.find(c=>c.kind==='age'||String(c.q||'').trim()==='Votre âge');if(age){const existing=Array.isArray(age.opts)?age.opts:[];const count=label=>Number(existing.find(o=>String(o.label||'').trim()===label)?.n)||0;age.kind='age';age.q='Votre âge';age.opts=AGE.opts.map(o=>({label:o.label,n:count(o.label)}));}
    cleaned=cleaned.filter(c=>c!==gender);return [gender,...cleaned];
  }
  function show(message){const alert=$('param-alert');alert.hidden=false;alert.textContent=message;alert.scrollIntoView({behavior:'smooth',block:'center'});}
  function optionState(value){const n=Number(value)||0;if(!n)return{cls:'empty',hint:'Effectif à renseigner'};if(n<8)return{cls:'danger',hint:'🚨 Groupe trop petit : moins de 8'};if(n<10)return{cls:'warning',hint:'⚠️ Groupe fragile : entre 8 et 9'};return{cls:'success',hint:'✓ Groupe exploitable'};}
  function updateOptionVisual(input){const unit=input.closest('.socio-option-unit'),state=optionState(input.value),field=unit?.querySelector('.socio-count-field'),hint=unit?.querySelector('.socio-option-hint');if(field)field.className='socio-count-field '+state.cls;if(hint){hint.className='socio-option-hint '+state.cls;hint.textContent=state.hint;}updateVigilance();}

  const socioOpenRoots=new Set();
  const socioOpenBranches=new Set();
  let socioOpenInitialized=false;
  function criterionStats(criterion){
    let nested=0,maxDepth=1;
    const walk=(c,depth)=>{maxDepth=Math.max(maxDepth,depth);(c?.opts||[]).forEach(o=>(o.subcriteria||[]).forEach(child=>{nested++;walk(child,depth+1);}));};
    walk(criterion,1);
    return{responses:(criterion?.opts||[]).length,nested,maxDepth};
  }
  function initSocioOpenState(){
    if(socioOpenInitialized)return;
    socioOpenInitialized=true;
    socio.forEach((criterion,i)=>{const stats=criterionStats(criterion);if(!stats.nested)socioOpenRoots.add(String(i));});
  }
  function getCriterionByPath(path){
    const parts=String(path).split('.').map(Number);let criterion=socio[parts[0]];
    for(let i=1;i<parts.length;i+=2){criterion=criterion?.opts?.[parts[i]]?.subcriteria?.[parts[i+1]];}
    return criterion;
  }
  function getOptionByPath(path){const [criterionPath,index]=String(path).split('|');return getCriterionByPath(criterionPath)?.opts?.[Number(index)];}
  function criterionParentInfo(path){const parts=String(path).split('.').map(Number);if(parts.length<3)return null;const childIndex=parts.pop(),optionIndex=parts.pop(),parentPath=parts.join('.');return{parentPath,optionIndex,childIndex};}
  const answerRow=(option,optionPath,removable,locked=false)=>{const state=optionState(option.n),ro=isReadOnly();return`<div class="socio-option-unit ${locked?'locked-option':''}"><div class="socio-option"><div class="socio-answer-field ${locked?'locked-field':''}"><span>${locked?'Réponse figée':'Réponse'}</span><input data-tree-label="${optionPath}" value="${esc(option.label)}" aria-label="Réponse possible" ${ro||locked?'readonly tabindex="-1"':''}></div><div class="socio-count-field ${state.cls}"><span>Effectif estimé</span><input data-tree-n="${optionPath}" type="number" min="0" placeholder="Ex. 25" value="${Number(option.n)||''}" aria-label="Effectif estimé" ${ro||locked?'readonly tabindex="-1"':''}></div>${ro||locked?'<span class="socio-option-spacer" aria-hidden="true"></span>':`<button type="button" class="socio-option-remove" data-tree-option-remove="${optionPath}" ${removable?'':'disabled'}>×</button>`}</div><div class="socio-option-hint ${state.cls}">${state.hint}</div></div>`;};
  function renderNestedCriterion(criterion,path,level,conditionLabel){
    const ro=isReadOnly(),stats=criterionStats(criterion),isOpen=socioOpenBranches.has(path),structureEditable=!ro&&normalizeLocale(socioReference().locale)===normalizeLocale(socioContextLocale),legacyVariantCleanup=canAdminCleanLegacyVariant();
    const options=(criterion.opts||[]).map((option,j)=>{
      const optionPath=`${path}|${j}`;
      const children=(option.subcriteria||[]).map((child,k)=>renderNestedCriterion(child,`${path}.${j}.${k}`,level+1,option.label)).join('');
      return `<div class="socio-option-block">${answerRow(option,optionPath,structureEditable&&criterion.opts.length>2)}${children}${structureEditable?`<button class="socio-add-sub" type="button" data-tree-child-add="${optionPath}">+ Ajouter une sous-question pour cette réponse</button>`:''}</div>`;
    }).join('');
    const nestedLabel=stats.nested?` · ${stats.nested} sous-branche${stats.nested>1?'s':''}`:'';
    const depthLabel=stats.maxDepth>1?` · jusqu’au niveau ${level+stats.maxDepth-1}`:'';
    return `<div class="socio-subcriterion ${isOpen?'is-open':'is-collapsed'}" style="--socio-depth:${Math.min(level,8)}">
      <div class="socio-sub-summary">
        <button type="button" class="socio-sub-toggle" data-socio-branch-toggle="${path}" aria-expanded="${isOpen}">
          <span class="socio-sub-summary-main"><span class="socio-level-badge">Niveau ${level} · si « ${esc(conditionLabel||'cette réponse')} »</span><strong>${esc(criterion.q||'Question complémentaire')}</strong><small>${stats.responses} réponse${stats.responses>1?'s':''}${nestedLabel}${depthLabel}</small></span>
          <span class="socio-chevron" aria-hidden="true">⌄</span>
        </button>
        ${structureEditable?`<button type="button" class="socio-sub-remove" data-tree-criterion-remove="${path}">Retirer</button>`:legacyVariantCleanup?`<button type="button" class="socio-sub-remove socio-sub-remove-variant" data-tree-criterion-remove-variant="${path}">Retirer de cette langue</button>`:''}
      </div>
      <div class="socio-sub-body" ${isOpen?'':'hidden'}>
        <div class="field"><label>Question complémentaire</label><input data-tree-q="${path}" value="${esc(criterion.q)}" ${ro?'readonly tabindex="-1"':''}></div>
        <div class="socio-selection-mode"><span>Mode de réponse</span>${structureEditable?`<button type="button" class="button button-small ${criterion.multiple?'button-primary':'button-secondary'}" data-tree-multiple="${path}" aria-pressed="${criterion.multiple?'true':'false'}">${criterion.multiple?'✓ Plusieurs réponses possibles':'Une seule réponse'}</button>`:`<span class="status-pill">${criterion.multiple?'Plusieurs réponses possibles':'Une seule réponse'}</span>`}</div>
        <div class="socio-sub-options">${options}</div>
        ${structureEditable?`<button class="button button-ghost" type="button" data-tree-option-add="${path}">+ Ajouter une sous-réponse</button>`:''}
      </div>
    </div>`;
  }
  function renderSocio(){
    initSocioOpenState();
    const ro=isReadOnly(),structureEditable=!ro&&normalizeLocale(socioReference().locale)===normalizeLocale(socioContextLocale);
    const toolbar=`<div class="socio-tree-toolbar"><div><strong>Données socio-démographiques</strong><span>Repliez les critères et ouvrez uniquement la branche que vous souhaitez modifier.</span></div><div class="socio-tree-toolbar-actions"><button type="button" class="button button-ghost button-small" data-socio-collapse-all>Tout replier</button><button type="button" class="button button-secondary button-small" data-socio-expand-all>Tout déplier</button></div></div>`;
    $('socio-list').innerHTML=toolbar+socio.map((criterion,i)=>{
      const path=String(i),isGender=genderRequiredTheme()&&criterion.kind==='gender',isAge=criterion.kind==='age'||String(criterion.q||'').trim()==='Votre âge',locked=isGender||isAge||ro,isOpen=socioOpenRoots.has(path),stats=criterionStats(criterion),translationMode=Boolean(referenceCriterionFor(criterion,i)),criterionStructureEditable=structureEditable&&!translationMode;
      const optionsHtml=criterion.opts.map((option,j)=>{
        const optionPath=`${path}|${j}`;
        if(locked){
          const state=optionState(option.n),genderRequired=isGender&&(option.label==='Homme'||option.label==='Femme'),canRemove=!ro&&isGender&&!genderRequired;
          const removeControl=canRemove?`<button type="button" class="socio-option-remove socio-option-remove-visible" data-tree-option-remove="${optionPath}" aria-label="Supprimer ${esc(option.label)}" title="Supprimer cette réponse facultative">×</button>`:`<span class="socio-option-spacer" aria-hidden="true"></span>`;
          const children=(option.subcriteria||[]).map((child,k)=>renderNestedCriterion(child,`${path}.${j}.${k}`,2,option.label)).join('');
          return `<div class="socio-option-block"><div class="socio-option-unit locked-option"><div class="socio-option"><div class="socio-answer-field locked-field"><span>Réponse figée</span><input value="${esc(option.label)}" readonly tabindex="-1" aria-label="Réponse non modifiable"></div><div class="socio-count-field ${state.cls}"><span>Effectif estimé</span><input data-tree-n="${optionPath}" type="number" min="0" value="${Number(option.n)||''}" readonly tabindex="-1"></div>${removeControl}</div><div class="socio-option-hint ${state.cls}">${state.hint}</div></div>${children}</div>`;
        }
        const children=(option.subcriteria||[]).map((child,k)=>renderNestedCriterion(child,`${path}.${j}.${k}`,2,option.label)).join('');
        return `<div class="socio-option-block">${answerRow(option,optionPath,criterionStructureEditable&&criterion.opts.length>2)}${children}${criterionStructureEditable?`<button class="socio-add-sub" type="button" data-tree-child-add="${optionPath}">+ Ajouter un sous-critère pour cette réponse</button>`:''}</div>`;
      }).join('');
      const lockText=ro?'Campagne en lecture seule.':isGender?'Obligatoire · réponses standardisées. Homme et Femme sont obligatoires ; Non binaire et Autre peuvent être supprimés.':isAge?'Tranches d’âge standardisées pour permettre la comparaison avec le benchmark global Me&YouToo. Elles ne peuvent être ni modifiées, ni ajoutées, ni supprimées.':'';
      const headerAction=ro?'<span class="socio-required-badge">🔒 Lecture seule</span>':isGender?`<span class="socio-required-badge">Obligatoire</span>`:criterionStructureEditable?`<button class="button button-danger-soft" type="button" data-socio-remove="${i}" ${socio.length<=1?'disabled':''}>Supprimer le critère</button>`:'';
      const branchBadge=stats.nested?`<span class="socio-tree-badge">${stats.nested} sous-question${stats.nested>1?'s':''} · profondeur ${stats.maxDepth}</span>`:'';
      return `<article class="socio-card socio-card-foldable ${isOpen?'is-open':'is-collapsed'} ${locked?'socio-card-locked':''} ${isGender?'socio-card-gender':''} ${isAge?'socio-card-age':''}" ${ro?'style="background:var(--royal-blue-tint)"':''}>
        <div class="socio-card-fold-head">
          <button type="button" class="socio-root-toggle" data-socio-root-toggle="${path}" aria-expanded="${isOpen}">
            <span class="socio-number"><small>Critère</small>${i+1}</span>
            <span class="socio-root-summary"><strong>${esc(criterion.q||`Critère ${i+1}`)}</strong><small>${stats.responses} réponse${stats.responses>1?'s':''}${stats.nested?` · ${stats.nested} branche${stats.nested>1?'s':''} conditionnelle${stats.nested>1?'s':''}`:''}</small></span>
            ${branchBadge}<span class="socio-chevron" aria-hidden="true">⌄</span>
          </button>
          <div class="socio-card-fold-actions">${headerAction}</div>
        </div>
        <div class="socio-card-fold-body" ${isOpen?'':'hidden'}>
          <div class="socio-translation-compare ${referenceCriterionFor(criterion,i)?'has-reference':''}">
            ${renderSocioReference(criterion,i)}
            <div class="socio-current-editor"><div class="socio-current-head"><strong>Version répondant · ${esc(localeLabel(socioContextLocale))}</strong><span class="status-pill">${esc(String(socioContextLocale).toUpperCase())}</span></div>${translationMode&&!ro?'<div class="socio-translation-structure-note">La structure se modifie dans la langue de référence. Ici, vous traduisez uniquement les libellés existants.</div>':''}
              <div class="socio-card-head"><span class="socio-number socio-number-spacer" aria-hidden="true"></span><div class="field socio-question"><label>Question posée aux répondants ${locked?'<span class="socio-lock-badge">🔒 Figé</span>':''}${isAge?'<span class="socio-age-info" title="Les tranches d’âge sont standardisées afin de permettre la comparaison de vos résultats avec le benchmark global Me&YouToo." aria-label="Information benchmark âge">i</span>':''}</label><input data-tree-q="${path}" value="${esc(criterion.q)}" ${locked?'readonly tabindex="-1"':''}>${locked?`<span class="socio-lock-help">${lockText}</span>`:''}</div><span></span></div>
              ${!locked?`<div class="socio-selection-mode"><span>Mode de réponse</span>${criterionStructureEditable?`<button type="button" class="button button-small ${criterion.multiple?'button-primary':'button-secondary'}" data-tree-multiple="${path}" aria-pressed="${criterion.multiple?'true':'false'}">${criterion.multiple?'✓ Plusieurs réponses possibles':'Une seule réponse'}</button>`:`<span class="status-pill">${criterion.multiple?'Plusieurs réponses possibles':'Une seule réponse'}</span>`}</div>`:''}
              <div class="socio-options">${optionsHtml}</div>${!locked&&criterionStructureEditable?`<button class="button button-ghost" type="button" data-tree-option-add="${path}">+ Ajouter une réponse</button>`:''}
            </div>
          </div>
        </div>
      </article>`;
    }).join('');bindSocio();updateVigilance();syncSocioStructureControls();renderStickySocioLanguages();
  }
  function criterionByPathIn(criteria,path){
    const parts=String(path).split('.').map(Number);let criterion=criteria?.[parts[0]];
    for(let i=1;i<parts.length;i+=2)criterion=criterion?.opts?.[parts[i]]?.subcriteria?.[parts[i+1]];
    return criterion;
  }
  function optionByPathIn(criteria,path){const [criterionPath,index]=String(path).split('|');return criterionByPathIn(criteria,criterionPath)?.opts?.[Number(index)];}
  const stableSourceId=item=>{const value=item?.source_id;return value===undefined||value===null||String(value).trim()===''?'':String(value);};
  function criterionStructureKey(criterion){
    const own=stableSourceId(criterion);if(own)return `c:${own}`;
    const optionIds=(criterion?.opts||[]).map(stableSourceId);
    return optionIds.length>=2&&optionIds.every(Boolean)?`o:${optionIds.join('|')}`:'';
  }
  const optionStructureKey=option=>{const id=stableSourceId(option);return id?`o:${id}`:'';};
  function matchingIndexByKey(referenceItem,targetItems,fallbackIndex,keyFn){
    const key=keyFn(referenceItem);
    if(key)return (targetItems||[]).findIndex(item=>keyFn(item)===key);
    return Array.isArray(targetItems)&&fallbackIndex>=0&&fallbackIndex<targetItems.length?fallbackIndex:-1;
  }
  function resolveCriterionPathInTarget(referenceCriteria,targetCriteria,path){
    const parts=String(path).split('.').map(Number);if(!parts.length||parts.some(Number.isNaN))return null;
    let refList=referenceCriteria,targetList=targetCriteria,refCriterion=refList?.[parts[0]],targetIndex=matchingIndexByKey(refCriterion,targetList,parts[0],criterionStructureKey),targetCriterion=targetList?.[targetIndex];
    if(!refCriterion||!targetCriterion)return null;
    let targetParentOption=null,targetChildIndex=-1;
    for(let i=1;i<parts.length;i+=2){
      const optionIndex=parts[i],childIndex=parts[i+1],refOption=refCriterion?.opts?.[optionIndex];
      const targetOptionIndex=matchingIndexByKey(refOption,targetCriterion?.opts||[],optionIndex,optionStructureKey),targetOption=targetCriterion?.opts?.[targetOptionIndex];
      if(!refOption||!targetOption)return null;
      const refChild=refOption?.subcriteria?.[childIndex],targetChildren=targetOption?.subcriteria||[];
      targetChildIndex=matchingIndexByKey(refChild,targetChildren,childIndex,criterionStructureKey);
      targetParentOption=targetOption;targetCriterion=targetChildren?.[targetChildIndex];refCriterion=refChild;
      if(!refCriterion||!targetCriterion)return null;
    }
    return{criterion:targetCriterion,parentOption:targetParentOption,childIndex:targetChildIndex};
  }
  function reconcileCriteriaStructure(referenceItems,targetItems){
    const reference=Array.isArray(referenceItems)?referenceItems:[],target=Array.isArray(targetItems)?targetItems:[];let removed=0;
    const refKeyList=reference.map(criterionStructureKey),refKeys=new Set(refKeyList.filter(Boolean)),canPruneCriteria=reference.length>0&&refKeyList.every(Boolean);
    let rows=canPruneCriteria?target.filter(item=>{const key=criterionStructureKey(item);if(!key||refKeys.has(key))return true;removed++;return false;}):target;
    for(let ri=0;ri<reference.length;ri++){
      const refCriterion=reference[ri],ti=matchingIndexByKey(refCriterion,rows,ri,criterionStructureKey),targetCriterion=rows[ti];if(!targetCriterion)continue;
      const refOptions=Array.isArray(refCriterion.opts)?refCriterion.opts:[],targetOptions=Array.isArray(targetCriterion.opts)?targetCriterion.opts:[],refOptionKeyList=refOptions.map(optionStructureKey),refOptionKeys=new Set(refOptionKeyList.filter(Boolean)),canPruneOptions=refOptions.length>0&&refOptionKeyList.every(Boolean);
      targetCriterion.opts=canPruneOptions?targetOptions.filter(option=>{const key=optionStructureKey(option);if(!key||refOptionKeys.has(key))return true;removed++;return false;}):targetOptions;
      for(let oi=0;oi<refOptions.length;oi++){
        const refOption=refOptions[oi],toi=matchingIndexByKey(refOption,targetCriterion.opts,oi,optionStructureKey),targetOption=targetCriterion.opts?.[toi];if(!targetOption)continue;
        const refChildren=Array.isArray(refOption.subcriteria)?refOption.subcriteria:[],targetChildren=Array.isArray(targetOption.subcriteria)?targetOption.subcriteria:[];
        if(!refChildren.length&&optionStructureKey(refOption)&&optionStructureKey(refOption)===optionStructureKey(targetOption)){removed+=targetChildren.length;targetOption.subcriteria=[];continue;}
        const childResult=reconcileCriteriaStructure(refChildren,targetChildren);targetOption.subcriteria=childResult.items;removed+=childResult.removed;
      }
    }
    return{items:rows,removed};
  }
  function reconcileStoredSocioVariantsToReference(){
    const ref=socioReference(),refLoc=normalizeLocale(ref.locale);if(!refLoc||!Array.isArray(ref.items)||!ref.items.length)return{changed:false,removed:0};
    let removed=0;
    for(const loc of projectLocales()){
      const n=normalizeLocale(loc);if(n===refLoc||!Array.isArray(socioLanguageVariants[n])||!socioLanguageVariants[n].length)continue;
      const result=reconcileCriteriaStructure(ref.items,socioLanguageVariants[n]);if(result.removed){socioLanguageVariants[n]=result.items;removed+=result.removed;}
    }
    return{changed:removed>0,removed};
  }
  function ensureAllLocaleSocioVariants(){
    storeActiveSocio();
    const active=normalizeLocale(socioContextLocale),snapshot=clone(socio);
    for(const loc of projectLocales()){
      const n=normalizeLocale(loc);if(n===active)continue;
      if(!Array.isArray(socioLanguageVariants[n])||!socioLanguageVariants[n].length)socioLanguageVariants[n]=clone(snapshot);
    }
  }
  function translationTodoPaths(locale){const st=reviewState(),loc=normalizeLocale(locale);return Array.isArray(st.todo[loc])?st.todo[loc]:[];}
  function setTranslationTodoPaths(locale,paths){const st=reviewState(),loc=normalizeLocale(locale);st.todo[loc]=[...new Set(paths||[])];}
  function clearTranslationTodoPath(locale,path){const st=reviewState(),loc=normalizeLocale(locale),rows=translationTodoPaths(loc).filter(x=>x!==path);if(rows.length)st.todo[loc]=rows;else delete st.todo[loc];if(st.baselines.socio?.[loc])delete st.baselines.socio[loc][path];}
  function isTranslationTodo(locale,path){return translationTodoPaths(locale).includes(path);}
  function translationCounts(locale){const loc=normalizeLocale(locale),todos=new Set(translationTodoPaths(loc)),todo=todos.size,review=Array.isArray(reviewState().socio[loc])?reviewState().socio[loc].filter(path=>!todos.has(path)).length:0;return{todo,review};}
  function markNewTranslationPaths(locale,paths,sourceLocale,sourceCriteria){
    const st=reviewState(),loc=normalizeLocale(locale),todo=[...new Set([...translationTodoPaths(loc),...paths])];st.todo[loc]=todo;
    const review=Array.isArray(st.socio[loc])?st.socio[loc]:[];st.socio[loc]=review.filter(path=>!todo.includes(path));
    st.baselines.socio[loc]=st.baselines.socio[loc]&&typeof st.baselines.socio[loc]==='object'?st.baselines.socio[loc]:{};
    for(const path of paths)delete st.baselines.socio[loc][path];
  }
  function pathsForCriterion(criterion,index){const key=criterionKey(criterion,index),paths=[`q:${key}`];(criterion?.opts||[]).forEach((o,j)=>paths.push(`o:${key}:${String(o?.source_id??`i${j}`)}`));return paths;}
  function blankCriterion(c){const x=clone(c||{});x.q='';x.opts=(x.opts||[]).map(o=>({...o,label:'',subcriteria:(o.subcriteria||[]).map(child=>blankCriterion(child))}));return x;}
  function propagateRootCriterionAdd(criterion,index){
    const sourceLocale=normalizeLocale(socioContextLocale),sourceSnapshot=clone(socio),blank=clone(criterion);
    blank.q='';blank.opts=(blank.opts||[]).map(o=>({...o,label:'',subcriteria:(o.subcriteria||[]).map(c=>blankCriterion(c))}));
    for(const loc of projectLocales()){
      const n=normalizeLocale(loc);if(n===sourceLocale)continue;
      const rows=Array.isArray(socioLanguageVariants[n])?socioLanguageVariants[n]:(socioLanguageVariants[n]=[]);
      rows.splice(index,0,clone(blank));markNewTranslationPaths(n,pathsForCriterion(criterion,index),sourceLocale,sourceSnapshot);
    }
  }
  function propagateRootCriterionRemove(index){const reference=clone(socio),removedCriterion=reference[index];for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(socioContextLocale))continue;const rows=socioLanguageVariants[n];if(!Array.isArray(rows))continue;const targetIndex=matchingIndexByKey(removedCriterion,rows,index,criterionStructureKey);if(targetIndex>=0)rows.splice(targetIndex,1);}}
  function propagateCriterionMultiple(criterionPath,multiple){
    const reference=clone(socio);
    for(const loc of projectLocales()){
      const n=normalizeLocale(loc);if(n===normalizeLocale(socioContextLocale))continue;
      const resolved=resolveCriterionPathInTarget(reference,socioLanguageVariants[n],criterionPath),targetCriterion=resolved?.criterion;
      if(!targetCriterion)continue;
      if(multiple)targetCriterion.multiple=true;else delete targetCriterion.multiple;
    }
  }
  function propagateOptionAdd(criterionPath,option){
    const sourceLocale=normalizeLocale(socioContextLocale),sourceSnapshot=clone(socio),rootIndex=Number(String(criterionPath).split('.')[0]);
    for(const loc of projectLocales()){
      const n=normalizeLocale(loc);if(n===sourceLocale)continue;const criterion=criterionByPathIn(socioLanguageVariants[n],criterionPath);if(!criterion)continue;
      criterion.opts=Array.isArray(criterion.opts)?criterion.opts:[];criterion.opts.push({...clone(option),label:''});markNewTranslationPaths(n,pathsForCriterion(sourceSnapshot[rootIndex],rootIndex),sourceLocale,sourceSnapshot);
    }
  }
  function propagateOptionRemove(criterionPath,index){const reference=clone(socio),refCriterion=criterionByPathIn(reference,criterionPath),removedOption=refCriterion?.opts?.[Number(index)];for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(socioContextLocale))continue;const resolved=resolveCriterionPathInTarget(reference,socioLanguageVariants[n],criterionPath),targetCriterion=resolved?.criterion;if(!targetCriterion||!Array.isArray(targetCriterion.opts))continue;const targetIndex=matchingIndexByKey(removedOption,targetCriterion.opts,Number(index),optionStructureKey);if(targetIndex>=0)targetCriterion.opts.splice(targetIndex,1);}}
  function propagateChildAdd(optionPath,child){for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(socioContextLocale))continue;const option=optionByPathIn(socioLanguageVariants[n],optionPath);if(!option)continue;option.subcriteria=Array.isArray(option.subcriteria)?option.subcriteria:[];option.subcriteria.push(clone(child));}}
  function propagateChildRemove(path){const info=criterionParentInfo(path);if(!info)return;const reference=clone(socio),removedCriterion=criterionByPathIn(reference,path);for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(socioContextLocale))continue;const parentResolved=resolveCriterionPathInTarget(reference,socioLanguageVariants[n],info.parentPath),targetParent=parentResolved?.criterion;if(!targetParent)continue;const refParent=criterionByPathIn(reference,info.parentPath),refOption=refParent?.opts?.[info.optionIndex],targetOptionIndex=matchingIndexByKey(refOption,targetParent.opts||[],info.optionIndex,optionStructureKey),targetOption=targetParent.opts?.[targetOptionIndex],children=targetOption?.subcriteria;if(!Array.isArray(children))continue;const targetChildIndex=matchingIndexByKey(removedCriterion,children,info.childIndex,criterionStructureKey);if(targetChildIndex>=0)children.splice(targetChildIndex,1);}}
  function bindSocio(){
    document.querySelectorAll('[data-socio-root-toggle]').forEach(el=>el.onclick=()=>{const path=el.dataset.socioRootToggle;socioOpenRoots.has(path)?socioOpenRoots.delete(path):socioOpenRoots.add(path);renderSocio();});
    document.querySelectorAll('[data-socio-branch-toggle]').forEach(el=>el.onclick=()=>{const path=el.dataset.socioBranchToggle;socioOpenBranches.has(path)?socioOpenBranches.delete(path):socioOpenBranches.add(path);renderSocio();});
    document.querySelector('[data-socio-collapse-all]')?.addEventListener('click',()=>{socioOpenRoots.clear();socioOpenBranches.clear();renderSocio();});
    document.querySelector('[data-socio-expand-all]')?.addEventListener('click',()=>{socioOpenRoots.clear();socioOpenBranches.clear();socio.forEach((c,i)=>{const root=String(i);socioOpenRoots.add(root);const visit=(criterion,path)=>{(criterion.opts||[]).forEach((o,j)=>(o.subcriteria||[]).forEach((child,k)=>{const childPath=`${path}.${j}.${k}`;socioOpenBranches.add(childPath);visit(child,childPath);}));};visit(c,root);});renderSocio();});
    if(isReadOnly())return;
    document.querySelectorAll('[data-tree-q]').forEach(el=>el.oninput=()=>{const criterion=getCriterionByPath(el.dataset.treeQ);if(criterion){criterion.q=el.value;const root=Number(String(el.dataset.treeQ).split('.')[0]),key=criterionKey(socio[root],root),path=`q:${key}`;if(String(el.value||'').trim())clearTranslationTodoPath(socioContextLocale,path);scheduleAutosave();renderSocioContext();}});
    document.querySelectorAll('[data-tree-label]').forEach(el=>el.oninput=()=>{const option=getOptionByPath(el.dataset.treeLabel);if(option){option.label=el.value;const root=Number(String(el.dataset.treeLabel).split('.')[0]),key=criterionKey(socio[root],root),idx=Number(String(el.dataset.treeLabel).split('|').pop()),ref=socioReference().items?.[root],optKey=String(ref?.opts?.[idx]?.source_id??`i${idx}`),path=`o:${key}:${optKey}`;if(String(el.value||'').trim())clearTranslationTodoPath(socioContextLocale,path);scheduleAutosave();renderSocioContext();}});
    document.querySelectorAll('[data-tree-n]').forEach(el=>el.oninput=()=>{const option=getOptionByPath(el.dataset.treeN);if(option){option.n=Number(el.value)||0;updateOptionVisual(el);scheduleAutosave();}});
    document.querySelectorAll('[data-tree-multiple]').forEach(el=>el.onclick=()=>{if(isReadOnly()||!isSocioReferenceLocale())return;ensureAllLocaleSocioVariants();const path=el.dataset.treeMultiple,criterion=getCriterionByPath(path);if(!criterion)return;criterion.multiple=!criterion.multiple;propagateCriterionMultiple(path,criterion.multiple);renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-socio-remove]').forEach(el=>el.onclick=()=>{ensureAllLocaleSocioVariants();const index=+el.dataset.socioRemove;propagateRootCriterionRemove(index);socio.splice(index,1);renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-tree-option-remove]').forEach(el=>el.onclick=()=>{ensureAllLocaleSocioVariants();const [criterionPath,index]=el.dataset.treeOptionRemove.split('|'),criterion=getCriterionByPath(criterionPath);propagateOptionRemove(criterionPath,index);criterion?.opts?.splice(Number(index),1);renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-tree-option-add]').forEach(el=>el.onclick=()=>{ensureAllLocaleSocioVariants();const criterionPath=el.dataset.treeOptionAdd,criterion=getCriterionByPath(criterionPath),option={label:criterionPath.includes('.')?'Nouvelle sous-réponse':'Nouvelle réponse',n:0,subcriteria:[]};criterion?.opts?.push(option);propagateOptionAdd(criterionPath,option);renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-tree-child-add]').forEach(el=>el.onclick=()=>{ensureAllLocaleSocioVariants();const optionPath=el.dataset.treeChildAdd,option=getOptionByPath(optionPath);if(!option)return;const child=newSubcriterion();option.subcriteria=Array.isArray(option.subcriteria)?option.subcriteria:[];option.subcriteria.push(child);propagateChildAdd(optionPath,child);renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-review-clear]').forEach(el=>el.onclick=()=>clearCriterionReview(socioContextLocale,socio[Number(el.dataset.reviewClear)],Number(el.dataset.reviewClear)));
    document.querySelectorAll('[data-tree-criterion-remove-variant]').forEach(el=>el.onclick=async()=>{
      if(!canAdminCleanLegacyVariant())return;
      const path=el.dataset.treeCriterionRemoveVariant,info=criterionParentInfo(path),criterion=getCriterionByPath(path);if(!info||!criterion)return;
      const locale=normalizeLocale(socioContextLocale),ref=socioReference();
      const ok=await window.StudioModal.confirm({eyebrow:'Nettoyage historique',title:`Retirer cette sous-question uniquement en ${localeLabel(locale)}`,message:`Cette action supprime « ${String(criterion.q||'cette sous-question')} » uniquement de la version ${localeLabel(locale)} (${locale.toUpperCase()}). La structure de référence ${localeLabel(ref.locale)} (${String(ref.locale||'').toUpperCase()}) et les autres langues ne seront pas modifiées. Les autres traductions et effectifs déjà renseignés restent inchangés.`,type:'warning',cancelLabel:'Annuler',confirmLabel:'Retirer de cette langue'});
      if(!ok)return;
      const parent=getCriterionByPath(info.parentPath);parent?.opts?.[info.optionIndex]?.subcriteria?.splice(info.childIndex,1);
      socioContextHasStored=true;
      renderSocio();scheduleAutosave(0);
    });
    document.querySelectorAll('[data-tree-criterion-remove]').forEach(el=>el.onclick=()=>{ensureAllLocaleSocioVariants();const path=el.dataset.treeCriterionRemove,info=criterionParentInfo(path);if(!info)return;propagateChildRemove(path);const parent=getCriterionByPath(info.parentPath);parent?.opts?.[info.optionIndex]?.subcriteria?.splice(info.childIndex,1);renderSocio();scheduleAutosave(0);});
  }
  function walkCriteria(criteria,cb,depth=1){(criteria||[]).forEach(c=>{cb(c,depth);(c.opts||[]).forEach(o=>walkCriteria(o.subcriteria||[],cb,depth+1));});}
  function allSocioOptions(){const out=[];walkCriteria(socio,c=>(c.opts||[]).forEach(o=>out.push(o)));return out;}
  function countSubcriteria(){let n=0;walkCriteria(socio,(c,depth)=>{if(depth>1)n++;});return n;}
  const fmt=n=>Number(n||0).toLocaleString('fr-FR');
  function bindPackToggle(){const toggle=$('toggle-packs'),panel=$('inline-packs');if(!toggle||!panel)return;if(!canOrder){panel.hidden=true;toggle.classList.add('button-locked');toggle.innerHTML='🔒 Commander un pack';toggle.onclick=()=>window.StudioModal.alert({eyebrow:'Accès limité',title:'Commande de passations verrouillée',message:'Le responsable de votre compte peut vous accorder le droit de commander des passations.',type:'warning'});return;}toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.textContent=panel.hidden?'Voir les packs disponibles':'Masquer les packs';if(!panel.hidden)panel.scrollIntoView({behavior:'smooth',block:'nearest'});};}
  function renderQuota(){const root=$('param-credit-card');if(!root)return;if(!quota){root.innerHTML='<div><h3>Pack non renseigné</h3><p>Le volume sera confirmé par Me&YouToo.</p></div><button class="button" type="button" id="toggle-packs">Voir les packs disponibles</button>';bindPackToggle();return;}const need=Number($('nb-respondents').value)||0,unlimited=Boolean(quota.pack_unlimited),remaining=unlimited?null:Number(quota.passations_remaining)||0,pending=quota.pending_pack_request;let status=need?'Calcul du besoin…':'Volume non renseigné',tone='';if(need){if(unlimited||remaining>=need)status='✓ Solde suffisant pour cette campagne.';else{status='⚠ Il manque '+fmt(need-remaining)+' passation(s) pour couvrir le besoin estimé.';tone=' warn';}}const pendingRequested=pending&&(pending.requestedAt||pending.requested_at),pendingExpiry=pending&&(pending.expiresAt||pending.expires_at),pendingLabel=pending&&(pending.packLabel||pending.pack_label);const pendingMessage=pending?`<div class="pack-pending-note">⏳ Demande de pack <strong>${esc(pendingLabel||'')}</strong> envoyée le ${pendingRequested?new Date(pendingRequested).toLocaleDateString('fr-FR'):'—'}. Après validation, elle sera valable jusqu’au ${pendingExpiry?new Date(String(pendingExpiry).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR'):'—'}.</div>`:'';root.className='passation-credit-card'+tone;root.innerHTML=`<div><h3>${esc(quota.name||'Votre entreprise')}</h3>${quota.pack_expires_at?'<p>Pack valable jusqu’au '+new Date(String(quota.pack_expires_at).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR')+'</p>':''}<div class="credit-stats"><div class="credit-stat"><strong>${unlimited?'Illimité':fmt(quota.passations_quota)}</strong><span>Achetées</span></div><div class="credit-stat"><strong>${fmt(quota.passations_used)}</strong><span>Utilisées</span></div><div class="credit-stat"><strong>${unlimited?'Illimité':fmt(remaining)}</strong><span>Restantes</span></div><div class="credit-stat ${need?'filled':'waiting'}"><strong>${need||'—'}</strong><span>Prévues ici</span></div></div><div class="credit-status">${status}</div>${pendingMessage}</div><button class="button" type="button" id="toggle-packs">${pending?'Voir les autres packs':'Voir les packs disponibles'}</button>`;bindPackToggle();}
  async function loadQuota(){try{const data=await api(`/api/projects/${projectId}/quota`);quota=data.organization||null;}catch(error){quota=null;}renderQuota();}
  function updateVigilance(){const total=Number($('nb-respondents').value)||0,allOptions=allSocioOptions(),counts=allOptions.map(o=>Number(o.n)||0).filter(n=>n>0),min=counts.length?Math.min(...counts):0,missing=allOptions.filter(o=>!Number(o.n)).length,subcount=countSubcriteria();let level='Faible',cls='low',text='Les groupes estimés sont suffisamment larges.';if(!total||!counts.length){level='À compléter';cls='';text='Renseignez les effectifs estimés par option.';}if(total&&total<8){level='Élevé';cls='high';text='Le nombre total de répondants est insuffisant pour une analyse collective.';}else if((min&&min<8)||socio.length>=4){level='Élevé';cls='high';text='Des groupes sont trop petits ou les croisements sont trop nombreux.';}else if((min&&min<10)||socio.length>=3||subcount){level='Modéré';cls='medium';text='Certains croisements devront être interprétés avec prudence.';}$('anonymity-level').textContent=level;$('anonymity-level').className='anonymity-level '+cls;$('anonymity-summary-text').textContent=text;$('anonymity-metrics').innerHTML=`<span class="anonymity-metric">${socio.length} critère(s)</span><span class="anonymity-metric">${subcount} sous-critère(s)</span><span class="anonymity-metric">Plus petit groupe : ${min||'—'}</span><span class="anonymity-metric">${missing} effectif(s) manquant(s)</span>`;const live=$('anon-alert');if(total&&total<8){live.hidden=false;live.className='anonymity-live-alert danger';live.innerHTML='<strong>🚨 Attention : moins de 8 répondants sont prévus au total.</strong><span>Le volume est insuffisant pour restituer des résultats collectifs fiables et anonymes.</span>';}else if(min&&min<8){live.hidden=false;live.className='anonymity-live-alert danger';live.innerHTML='<strong>🚨 Attention : au moins un groupe compte moins de 8 répondants.</strong>';}else if(min&&min<10){live.hidden=false;live.className='anonymity-live-alert warning';live.innerHTML='<strong>⚠️ Vigilance : au moins un groupe compte seulement 8 ou 9 répondants.</strong>';}else{live.hidden=true;live.innerHTML='';}}
  const normalizeIntro=value=>String(value||'').replace(/<br\s*\/?>/gi,' ').replace(/<\/p>/gi,' ').replace(/<\/li>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
  function settingsReadiness(){const intro=$('intro').value.trim(),launch=$('launch-date').value,close=$('close-date').value,shareUrl=currentDiffusionUrl(),diffusionReady=isLegacyClientCampaign()?true:Boolean(slugify($('diffusion-slug')?.value||''));return{introChanged:Boolean(intro)&&normalizeIntro(intro)!==normalizeIntro(referenceIntro),launchFilled:Boolean(launch),closeFilled:Boolean(close),diffusionReady,shareUrl,intro,launch,close};}
  function autosaveFieldIndicator(el){
    if(!el||!el.isConnected||!el.matches?.('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, select'))return null;
    if(el.readOnly||el.disabled)return null;
    const host=el.parentElement;if(!host)return null;
    host.classList.add('field-autosave-host');el.classList.add('field-autosave-input');
    let badge=host.querySelector(':scope > .field-autosave-indicator');
    if(!badge){badge=document.createElement('span');badge.className='field-autosave-indicator';badge.setAttribute('aria-hidden','true');host.appendChild(badge);}
    const refresh=()=>{if(!el.isConnected||!badge.isConnected)return;badge.style.top=`${el.offsetTop+(el.offsetHeight/2)}px`;};
    refresh();requestAnimationFrame(refresh);
    return badge;
  }
  function setAutosaveFieldState(el,state){
    const badge=autosaveFieldIndicator(el);if(!badge)return;
    const map={saving:'…',saved:'✓',pending:'•',error:'!'};
    badge.dataset.state=state;badge.textContent=map[state]||'';badge.classList.add('is-visible');
    badge.title=state==='saved'?'Enregistré automatiquement':state==='saving'?'Enregistrement en cours':state==='pending'?'Enregistrement en attente':state==='error'?"Échec de l’enregistrement automatique":'';
  }
  function markAutosaveActiveField(){
    const el=document.activeElement;if(!el||!el.closest?.('#contenu'))return;
    const badge=autosaveFieldIndicator(el);if(!badge)return;
    autosaveDirtyFields.add(el);setAutosaveFieldState(el,'saving');
  }
  function settleAutosaveFields(state){
    [...autosaveDirtyFields].forEach(el=>{if(!el?.isConnected){autosaveDirtyFields.delete(el);return;}setAutosaveFieldState(el,state);});
    if(state==='saved')autosaveDirtyFields.clear();
  }
  function autosaveStatus(message,tone='saved'){
    const el=$('param-autosave-status');if(!el)return;
    el.dataset.tone=tone;el.textContent=message;
  }
  function autosavePayload(){
    storeActiveLanguageContent();
    const primaryLocale=normalizeLocale(project?.selected_locale||(Array.isArray(project?.locales)&&project.locales[0])||'fr');
    const currentIntro=String($('intro')?.value||'').trim();
    const introductionHtml=socioContextLocale===primaryLocale?currentIntro:String(project?.introduction_html||'');
    const rawRespondents=String($('nb-respondents')?.value||'').trim();
    return {
      campaignName:String($('campaign-name')?.value||'').trim(),
      respondentTitle:String($('respondent-title')?.value||'').trim(),
      introductionHtml,
      introductionVariants:introVariants,
      launchDate:String($('launch-date')?.value||'').trim()||null,
      closeDate:String($('close-date')?.value||'').trim()||null,
      nbRespondents:rawRespondents?Number(rawRespondents):null,
      sociodemo:Array.isArray(project?.sociodemo)?project.sociodemo:socio,
      sociodemoLanguageVariants:socioLanguageVariants,
      translationReviewState:reviewState(),
      communicationShareUrl:currentDiffusionUrl()||null
    };
  }
  function autosaveFingerprint(payload){try{return JSON.stringify(payload);}catch(_){return String(Date.now());}}
  async function autosaveNow(){
    if(!autosaveEnabled||isReadOnly()||!projectId)return true;
    if(autosaveInFlight){autosavePending=true;await autosaveInFlight;if(autosavePending){autosavePending=false;return autosaveNow();}return true;}
    const payload=autosavePayload(),fingerprint=autosaveFingerprint(payload);
    if(fingerprint===lastSavedFingerprint){autosaveStatus('✓ Enregistré automatiquement','saved');settleAutosaveFields('saved');return true;}
    autosaveStatus('Enregistrement…','saving');
    autosaveInFlight=(async()=>{
      try{
        const data=await api(`/api/projects/${projectId}/settings/autosave`,{method:'PATCH',body:JSON.stringify(payload)});
        if(data?.project)project={...project,...data.project};
        lastSavedFingerprint=fingerprint;
        autosaveStatus('✓ Enregistré automatiquement','saved');
        settleAutosaveFields('saved');
        return true;
      }catch(error){
        const message=String(error?.message||'').trim();
        if(/intitulé|réponse|critère|socio|date de clôture/i.test(message)){autosaveStatus('Saisie en cours — enregistrement dès que le bloc est complet','pending');settleAutosaveFields('pending');}
        else{autosaveStatus('⚠ Enregistrement automatique interrompu','error');settleAutosaveFields('error');}
        return false;
      }finally{autosaveInFlight=null;}
    })();
    const ok=await autosaveInFlight;
    if(autosavePending){autosavePending=false;return autosaveNow();}
    return ok;
  }
  function scheduleAutosave(delay=700){
    if(!autosaveEnabled||isReadOnly())return;
    clearTimeout(autosaveTimer);markAutosaveActiveField();autosaveStatus('Modifications en cours…','saving');
    autosaveTimer=setTimeout(()=>{autosaveTimer=null;autosaveNow();},delay);
  }
  async function flushAutosave(){clearTimeout(autosaveTimer);autosaveTimer=null;return autosaveNow();}
  function updateNextState(){const buttons=[$('param-next'),$('param-next-top')].filter(Boolean);if(!buttons.length)return;if(isReadOnly()){buttons.forEach(button=>{button.classList.remove('is-disabled');button.setAttribute('aria-disabled','false');button.dataset.ready='true';button.title='';button.textContent='Revoir la transmission →';});return;}const state=settingsReadiness(),ready=state.introChanged&&state.launchFilled&&state.closeFilled&&state.diffusionReady;buttons.forEach(button=>{button.classList.toggle('is-disabled',!ready);button.setAttribute('aria-disabled',String(!ready));button.dataset.ready=ready?'true':'false';button.title=ready?'':!state.introChanged?'Adaptez l’introduction avant de poursuivre.':!state.diffusionReady?'Choisissez le slug de l’adresse de diffusion.':'Renseignez les deux dates avant de poursuivre.';});}
  async function showReadinessModal(){const state=settingsReadiness(),missing=[];if(!state.introChanged)missing.push('adapter l’introduction Me&YouToo à votre organisation');if(!state.diffusionReady)missing.push('choisir le slug de l’adresse de diffusion');if(!state.launchFilled)missing.push('renseigner la date de lancement');if(!state.closeFilled)missing.push('renseigner la date de clôture');await window.StudioModal.alert({eyebrow:'Paramétrage incomplet',title:'Complétez les éléments obligatoires',message:`Avant de passer à l’étape suivante, vous devez ${missing.join(', puis ')}.`,type:'info',confirmLabel:'J’ai compris'});}
  function applyReadOnlyUI(){
    const alert=$('param-alert');alert.hidden=false;alert.dataset.tone='success';alert.innerHTML='<strong>🔒 Paramétrage en lecture seule.</strong> Cette campagne a déjà été transmise. <button class="button button-secondary button-small" type="button" data-content-adjustment="settings">Demander un ajustement</button>';
    document.querySelectorAll('#settings-form input,#settings-form textarea,#settings-form select').forEach(el=>{el.readOnly=true;el.setAttribute('aria-readonly','true');el.style.background='var(--surface-soft)';el.style.pointerEvents='none';});
    const readOnlyHidden='[data-example],#add-socio,[data-socio-remove],[data-tree-option-remove],[data-tree-option-add],[data-tree-child-add],[data-tree-criterion-remove]'+(currentUser.role==='admin'?'':',#add-result-resource');
    document.querySelectorAll(readOnlyHidden).forEach(el=>{el.style.display='none';});
    if(currentUser.role==='admin'){$('add-result-resource').style.display='';$('add-result-resource').disabled=resultResources.length>=10;}
    document.querySelectorAll('.socio-card').forEach(el=>el.style.background='var(--royal-blue-tint)');
    updateNextState();
  }
  async function load(){try{
    if(!projectId){if(!theme)throw new Error('Thématique manquante.');location.replace(`theme-${encodeURIComponent(theme)}.html?theme=${encodeURIComponent(theme)}`);return;}
    const data=await api(`/api/projects/${projectId}/composer`),meta=data.project||{};project=meta;translationReviewState=meta.translation_review_state&&typeof meta.translation_review_state==='object'?clone(meta.translation_review_state):{intro:{},socio:{}};reviewState();if(!theme)theme=meta.theme_slug||'';await Promise.all([loadQuota(),loadResourceLibrary()]);
    baseTitle=meta.base_title||meta.theme_title||meta.title||'Autodiagnostic';referenceIntro=stripHtml(meta.theme_introduction_html||'');$('param-theme').textContent=meta.theme_title||'Autodiagnostic';$('campaign-name').value=meta.campaign_name||baseTitle;$('respondent-title').value=meta.respondent_title||meta.respondent_title_default||baseTitle;const organizationName=meta.organization_name||quota?.name||'votre-entreprise',existingShareUrl=String(meta.communication_share_url||'').trim(),parsedShareUrl=parseDiffusionUrl(existingShareUrl);diffusionExistingUrl=existingShareUrl;diffusionCustomerSlug=parsedShareUrl?.customer||slugify(organizationName)||'votre-entreprise';const diffusionInput=$('diffusion-slug');diffusionInput.value=parsedShareUrl?.slug||(isLegacyClientCampaign()&&!existingShareUrl?slugify(meta.legacy_slug||''):'');diffusionDirty=false;if(isLegacyClientCampaign()&&currentUser.role!=='admin'&&existingShareUrl){diffusionInput.readOnly=true;diffusionInput.setAttribute('aria-readonly','true');diffusionInput.closest('.diffusion-url-builder')?.classList.add('is-readonly');}renderDiffusionAddress();$('launch-date').min=isLegacyClientCampaign()?'':iso(5);$('launch-date').value=meta.launch_date?String(meta.launch_date).slice(0,10):(isLegacyClientCampaign()?'':iso(5));$('close-date').value=meta.close_date?String(meta.close_date).slice(0,10):'';syncCloseMin();$('nb-respondents').value=meta.estimated_respondents||'';const sourceSurveyId=String(meta.legacy_survey_id||meta.theme_legacy_id||'').trim(),themeSocioVariants=normalizeSocioLanguageVariants(meta.theme_sociodemo_variants,sourceSurveyId),legacyProjectSocioVariants=normalizeSocioLanguageVariants(meta.sociodemo_variants,sourceSurveyId),resolvedSocioVariants=normalizeSocioLanguageVariants(meta.sociodemo_language_variants_resolved||{},sourceSurveyId),storedSocioVariants=normalizeSocioLanguageVariants(meta.sociodemo_language_variants||{},sourceSurveyId);socioLanguageVariants={...themeSocioVariants,...legacyProjectSocioVariants,...resolvedSocioVariants,...storedSocioVariants};const inferredReferenceLocale=inferSocioReferenceLocale(meta),initialReferenceCandidates=[inferredReferenceLocale,String(meta.sociodemo_reference_locale||'').trim(),String(meta.reference_locale||'').trim(),'fr','en','es',...projectLocales()],initialReferenceSeen=new Set();socioReferenceLocaleStable='';for(const candidate of initialReferenceCandidates){const loc=normalizeLocale(candidate);if(!loc||initialReferenceSeen.has(loc))continue;initialReferenceSeen.add(loc);if(Array.isArray(socioLanguageVariants?.[loc])&&socioLanguageVariants[loc].length){socioReferenceLocaleStable=loc;break;}}if(!socioReferenceLocaleStable){socioReferenceLocaleStable=Object.keys(socioLanguageVariants||{}).find(loc=>Array.isArray(socioLanguageVariants[loc])&&socioLanguageVariants[loc].length)||'';}const orangeOrderRepair=repairOrange382DivisionOrder(meta),orangeFrenchRepair=repairOrange382FrenchLabels(meta),socioStructureRepair={changed:Boolean(orangeOrderRepair.changed||orangeFrenchRepair.changed),removed:0};introResolvedVariants=normalizeIntroVariants(meta.introduction_variants_resolved||{});introVariants=normalizeIntroVariants(meta.introduction_variants||{});const countries=projectCountries();socioContextCountry=normalizeCountry(meta.selected_country_code)||(countries[0]||'');const locales=projectLocales();socioContextLocale=locales.includes(normalizeLocale(meta.selected_locale))?normalizeLocale(meta.selected_locale):(locales[0]||'fr');activateLanguage(socioContextLocale);resultResources=normalizeResultResources(meta.result_buttons);renderSocioContext();renderSocio();renderResultResources();renderQuota();const clientFolderLink=$('param-client-folder');if(clientFolderLink){const showAdminFolder=currentUser.role==='admin'&&Boolean(meta.organization_id);clientFolderLink.hidden=!showAdminFolder;clientFolderLink.style.display=showAdminFolder?'':'none';if(showAdminFolder)clientFolderLink.href=`client.html?organizationId=${encodeURIComponent(meta.organization_id)}`;}$('param-back').href=`composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;$('param-back').textContent='← Revenir au contenu';const contentTop=$('param-content-top');if(contentTop)contentTop.href=`composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;
    if(isReadOnly())applyReadOnlyUI();else{if(project?.review_mode){const reviewUrl=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`,alert=$('param-alert');alert.hidden=false;alert.dataset.tone='success';alert.innerHTML='<strong>✎ Correction Me&YouToo active.</strong> Modifiez uniquement les paramètres nécessaires, puis revenez directement au contrôle qualité.';$('param-back').href=reviewUrl;$('param-back').textContent='← Retour au contrôle qualité';$('param-next').textContent='Enregistrer et revenir au contrôle qualité';if($('param-next-top'))$('param-next-top').textContent='Enregistrer et revenir au contrôle qualité';}updateNextState();await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:'parametrage'})});autosaveEnabled=true;lastSavedFingerprint=autosaveFingerprint(autosavePayload());autosaveStatus('✓ Enregistré automatiquement','saved');if(socioStructureRepair.changed){lastSavedFingerprint='';await autosaveNow();}}
  }catch(error){show(error.message);}}
  function syncCloseMin(){const d=$('launch-date').value;if(!d)return;const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+1);const min=x.toISOString().slice(0,10);$('close-date').min=min;if(!isReadOnly()&&$('close-date').value&&$('close-date').value<min)$('close-date').value='';}
  function invalidCriterion(c){return !String(c?.q||'').trim()||!Array.isArray(c?.opts)||c.opts.length<2||c.opts.some(o=>!String(o?.label||'').trim()||(o.subcriteria||[]).some(invalidCriterion));}
  function invalidSocio(){return socio.some(invalidCriterion);}
  $('add-socio').onclick=async()=>{if(isReadOnly())return;const addCriterion=()=>{ensureAllLocaleSocioVariants();const criterion={q:'Nouvelle donnée personnalisée',opts:[{label:'Réponse 1',n:0},{label:'Réponse 2',n:0}]},index=socio.length;socio.push(criterion);propagateRootCriterionAdd(criterion,index);renderSocioContext();renderSocio();scheduleAutosave(0);setTimeout(()=>document.querySelector(`[data-socio-root-toggle="${index}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),80);};if(isSocioReferenceLocale())return addCriterion();const ref=socioReference(),refLoc=normalizeLocale(ref.locale);if(!refLoc)return;const ok=await window.StudioModal.confirm({eyebrow:'Données d’analyse multilingues',title:'La structure se construit dans la langue de référence',message:`Pour garantir les mêmes critères, réponses et sous-critères dans toutes les langues, ajoutez la donnée depuis ${localeLabel(refLoc)} (${refLoc.toUpperCase()}). Elle sera ensuite disponible dans toutes les langues du projet pour être traduite.`,type:'info',cancelLabel:'Rester ici',confirmLabel:`Passer en ${localeLabel(refLoc)} et ajouter`});if(!ok)return;storeActiveLanguageContent();activateLanguage(refLoc);renderSocioContext();renderSocio();addCriterion();};
  $('intro').addEventListener('input',()=>{if(!isReadOnly()){updateNextState();scheduleAutosave();}});
  $('launch-date').addEventListener('change',()=>{if(!isReadOnly()){syncCloseMin();updateNextState();scheduleAutosave(0);}});
  $('close-date').addEventListener('change',()=>{if(!isReadOnly()){updateNextState();scheduleAutosave(0);}});
  document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{if(isReadOnly())return;const k=b.dataset.example;if(k==='age'){storeActiveSocio();for(const loc of projectLocales()){const n=normalizeLocale(loc),items=Array.isArray(socioLanguageVariants[n])?clone(socioLanguageVariants[n]):[];if(!items.some(c=>c.kind==='age')){items.push(ageForLocale(n));socioLanguageVariants[n]=items;}}if(!socio.some(c=>c.kind==='age'))socio.push(ageForLocale(socioContextLocale));socioContextHasStored=true;socioContextBaseline=JSON.stringify(normalizedSocio(socio));}else{ensureAllLocaleSocioVariants();const e=EXAMPLES[+k],criterion={q:e[0],opts:e[1].map(label=>({label,n:0}))},index=socio.length;socio.push(criterion);propagateRootCriterionAdd(criterion,index);renderSocioContext();}renderSocio();scheduleAutosave(0);});
  $('add-result-resource').onclick=()=>openResourceModal();
  $('result-preview-toggle').onclick=()=>{const button=$('result-preview-toggle'),body=$('result-resources-preview'),open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));body.hidden=open;button.querySelector('span').textContent=open?'⌄':'⌃';};
  window.StudioParametragePreviewSnapshot=()=>{storeActiveLanguageContent();return {project:{theme:project?.theme_title||'',title:$('respondent-title')?.value.trim()||project?.respondent_title||baseTitle||'Autodiagnostic',intro:$('intro')?.value.trim()||'',socio:socio,result_buttons:resultResources.filter(resourceComplete)},respondent_context:{countryCode:socioContextCountry,locale:socioContextLocale}};};
  $('diffusion-slug')?.addEventListener('input',event=>{if(isReadOnly()||event.currentTarget.readOnly)return;const normalized=slugify(event.currentTarget.value);if(event.currentTarget.value!==normalized)event.currentTarget.value=normalized;diffusionDirty=true;renderDiffusionAddress();updateNextState();scheduleAutosave();});
  $('nb-respondents').oninput=()=>{if(isReadOnly())return;updateVigilance();renderQuota();scheduleAutosave();};
  $('close-packs').onclick=()=>{const panel=$('inline-packs');panel.hidden=true;const toggle=$('toggle-packs');if(toggle)toggle.textContent='Voir les packs disponibles';};window.addEventListener('studio:pack-requested',loadQuota);bindPackToggle();
  ['campaign-name','respondent-title'].forEach(id=>$(id)?.addEventListener('input',()=>scheduleAutosave()));
  $('param-next-top')?.addEventListener('click',()=>$('settings-form')?.requestSubmit());
  $('settings-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(isReadOnly()){location.href=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;return;}
    await flushAutosave();
    const readiness=settingsReadiness();if(!readiness.introChanged||!readiness.launchFilled||!readiness.closeFilled||!readiness.diffusionReady){await showReadinessModal();return;}
    storeActiveLanguageContent();const campaignName=$('campaign-name').value.trim(),respondentTitle=$('respondent-title').value.trim(),primaryLocale=normalizeLocale(project?.selected_locale||(Array.isArray(project?.locales)&&project.locales[0])||'fr'),introductionHtml=socioContextLocale===primaryLocale?readiness.intro:String(project?.introduction_html||readiness.intro),launchDate=readiness.launch,closeDate=readiness.close;const rawRespondents=$('nb-respondents').value.trim(),nbRespondents=rawRespondents?Number(rawRespondents):null;
    if(!respondentTitle)return show('Le titre visible est obligatoire.');if(!isLegacyClientCampaign()&&!project?.review_mode&&launchDate<iso(5))return show('La date de lancement doit être au minimum à J+5.');if(closeDate<=launchDate)return show('La date de clôture doit être postérieure à la date de lancement.');if(!socio.length)return show('Au moins une donnée d’analyse doit être présente.');if(invalidSocio())return show('Chaque donnée et chaque sous-critère doivent avoir un intitulé et au moins deux réponses renseignées.');const incompleteResource=resultResources.find(r=>!resourceComplete(r));if(incompleteResource)return show(incompleteResource.type==='legacy_document'?`Le PDF historique « ${incompleteResource.legacyFilename} » doit être rattaché avant de pouvoir être utilisé.`:'Chaque ressource doit avoir un texte et soit une URL valide, soit un fichier PDF.');const resultButtons=resultResources.filter(resourceComplete);
    try{await api(`/api/projects/${projectId}/settings`,{method:'PATCH',body:JSON.stringify({campaignName,respondentTitle,introductionHtml,introductionVariants:introVariants,launchDate,closeDate,nbRespondents,sociodemo:Array.isArray(project?.sociodemo)?project.sociodemo:socio,sociodemoLanguageVariants:socioLanguageVariants,translationReviewState:reviewState(),communicationShareUrl:readiness.shareUrl||null,resultButtons})});location.href=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;}catch(error){show(error.message);}
  });load();
})();
