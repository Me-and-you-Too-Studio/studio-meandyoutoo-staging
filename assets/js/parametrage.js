(()=>{
  const p=new URLSearchParams(location.search);let theme=p.get('theme')||'',projectId=p.get('projectId')||'';
  const DIFFUSION_BASE_URL='https://selfdiag-mayt.meandyoutoo.app/';let diffusionCustomerSlug='',diffusionExistingUrl='',diffusionDirty=false;
  const api=(url,opt={})=>window.StudioAPI.request(url,opt);let baseTitle='',socio=[],socioLanguageVariants={},introVariants={},introResolvedVariants={},introReferenceVariants={},translationReviewState={intro:{},socio:{}},socioReferenceLocaleStable='',socioContextCountry='',socioContextLocale='',socioContextBaseline='',socioContextHasStored=false,introContextBaseline='',introContextHasStored=false,resultResources=[],resourceLibrary=[],quota=null,referenceIntro='',project=null;
  let lastAutosaveError='';
  let autosaveTimer=null,autosaveInFlight=null,autosavePending=false,autosaveEnabled=false,lastSavedFingerprint='';
  const autosaveDirtyFields=new Set();
  let insertingTranslatedSuggestion=false;
  const currentUser=window.StudioAPI.user&&window.StudioAPI.user()||{},canOrder=currentUser.role==='admin'||Boolean(currentUser.permissions&&currentUser.permissions.order_passations);
  const isReadOnly=()=>Boolean(project&&project.can_edit===false&&currentUser.role!=='admin');
  const isLegacyClientCampaign=()=>Boolean(project&&(project.source_type==='legacy_client'||project.legacy_history===true||project.legacy_source==='meayt-legacy'));
  const isAdminLegacySocio=()=>currentUser.role==='admin'&&isLegacyClientCampaign();
  const isSocioReadOnly=()=>isReadOnly()||(isLegacyClientCampaign()&&!isAdminLegacySocio());
  let legacySocioBaselines={},legacySocioExpected={},lastSavedSettingsFingerprint='';
  function initLegacySocioBaselines(){
    if(!isAdminLegacySocio())return;
    legacySocioBaselines=clone(socioLanguageVariants);
    legacySocioExpected=clone(project.sociodemo_language_variants||{});
  }
  function serializeHistoricalCriteria(items){
    return (items||[]).map(c=>{
      const out={...c,q:c.q,opts:(c.opts||[]).map(o=>{
        const option={...o,subcriteria:serializeHistoricalCriteria(o.subcriteria||[])};
        if('subcriterion' in option){if(option.subcriteria.length)option.subcriterion=clone(option.subcriteria[0]);else delete option.subcriterion;}
        return option;
      })};
      if('options' in out)out.options=clone(out.opts);
      if('multi_select' in out)out.multi_select=out.multiple===true;
      if('multiple_answers' in out)out.multiple_answers=out.multiple===true;
      if('label' in out)out.label=out.q;
      if('question' in out)out.question=out.q;
      return out;
    });
  }
  async function saveLegacySocioChanges(){
    if(!isAdminLegacySocio())return;
    const snapshots={},edits=[];
    for(const [locale,items] of Object.entries(socioLanguageVariants)){
      if(JSON.stringify(items)===JSON.stringify(legacySocioBaselines[locale]))continue;
      snapshots[locale]=clone(items);
      edits.push({locale,expected:legacySocioExpected[locale]??null,sociodemo:serializeHistoricalCriteria(items)});
    }
    if(!edits.length)return;
    const data=await api(`/api/admin/projects/${projectId}/legacy-sociodemo`,{method:'PATCH',body:JSON.stringify({edits})});
    for(const edit of edits){legacySocioBaselines[edit.locale]=snapshots[edit.locale];legacySocioExpected[edit.locale]=clone(data.sociodemoLanguageVariants[edit.locale]);}
    project.sociodemo_language_variants={...(project.sociodemo_language_variants||{}),...data.sociodemoLanguageVariants};
  }

  const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stripHtml=v=>{let html=String(v||'');const start=html.indexOf('« Nous entendons');if(start>=0)html=html.slice(start);const d=document.createElement('div');d.innerHTML=html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<\/li>/gi,'\n');return(d.textContent||'').replace(/\n{3,}/g,'\n\n').trim();};
  const slugify=(value,typing=false)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' et ').replace(/[^a-z0-9]+/g,'-').replace(typing?/^-+/g:/^-+|-+$/g,'').slice(0,80);
  function parseDiffusionUrl(value){const raw=String(value||'').trim();if(!raw)return null;try{const url=new URL(raw),base=new URL(DIFFUSION_BASE_URL);if(url.origin!==base.origin)return null;const parts=url.pathname.split('/').filter(Boolean);if(parts.length<2)return null;return{customer:parts[0],slug:parts.slice(1).join('/'),url:raw};}catch(_){return null;}}
  function currentDiffusionUrl(){const raw=String($('diffusion-slug')?.value||'').trim(),slug=slugify(raw);if(!slug)return diffusionExistingUrl&&!diffusionDirty?diffusionExistingUrl:'';if(diffusionExistingUrl&&!diffusionDirty)return diffusionExistingUrl;return `${DIFFUSION_BASE_URL}${encodeURIComponent(diffusionCustomerSlug)}/${encodeURIComponent(slug)}`;}
  let diffusionSlugError='',diffusionErrorShadow=null;
  function renderDiffusionSlugError(message='',focus=false){
    const field=$('diffusion-slug');if(!field)return;
    const builder=field.closest('.diffusion-url-builder');
    let hint=$('diffusion-slug-error');
    if(!hint&&message){
      hint=document.createElement('p');hint.id='diffusion-slug-error';hint.className='hint';hint.setAttribute('role','alert');
      hint.style.cssText='margin:8px 0;padding:10px 12px;border-radius:10px;background:#fff2f2;color:#a3212b;font-weight:600;';
      (builder||field).insertAdjacentElement('afterend',hint);
    }
    const previous=diffusionSlugError;diffusionSlugError=String(message||'');
    field.setCustomValidity(diffusionSlugError);
    if(hint){hint.textContent=diffusionSlugError;hint.hidden=!diffusionSlugError;}
    const described=new Set(String(field.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));
    if(diffusionSlugError){
      field.setAttribute('aria-invalid','true');described.add('diffusion-slug-error');
      if(builder){if(diffusionErrorShadow===null)diffusionErrorShadow=builder.style.boxShadow;builder.style.boxShadow='0 0 0 2px #c63843';}
    }else{
      field.removeAttribute('aria-invalid');described.delete('diffusion-slug-error');
      if(builder&&diffusionErrorShadow!==null){builder.style.boxShadow=diffusionErrorShadow;diffusionErrorShadow=null;}
      const alert=$('param-alert');if(previous&&alert?.textContent?.includes(previous))alert.hidden=true;
    }
    if(described.size)field.setAttribute('aria-describedby',[...described].join(' '));else field.removeAttribute('aria-describedby');
    if(message&&focus){
      for(let parent=field.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
      field.focus({preventScroll:true});field.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
    }
  }
  function renderDiffusionAddress(){const input=$('diffusion-slug'),prefix=$('diffusion-url-prefix'),preview=$('diffusion-url-preview'),note=$('diffusion-url-note');if(!input||!prefix||!preview)return;prefix.textContent=`${DIFFUSION_BASE_URL}${diffusionCustomerSlug||'client'}/`;const url=currentDiffusionUrl();preview.textContent=url||'Adresse en attente du slug de campagne.';preview.classList.toggle('is-legacy',Boolean(diffusionExistingUrl&&!diffusionDirty));const status=$('diffusion-url-status');if(status){const legacy=isLegacyClientCampaign();status.hidden=legacy;status.style.display=legacy?'none':'';status.textContent=legacy?'':'Votre lien est en préparation et n’est pas encore effectif.';}if(note){if(isLegacyClientCampaign())note.textContent='Adresse historique de la campagne.';else note.textContent='Le nom du client constitue automatiquement la première partie de l’adresse. Saisissez uniquement le slug souhaité pour cette campagne.';}}
  const iso=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10);};
function genderText(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function genderAnswerKind(label){
  const text=genderText(label);
  const groups={
    male:['homme','un homme','man','a man','male','masculin','hombre','un hombre','homem','um homem','masculino','mann','mannlich','uomo','maschio','mannelijk','mężczyzna','mezczyzna','barbat','muž','muz','erkek','мужчина','мъж','男性','남성','رجل','ذكر'],
    female:['femme','une femme','woman','a woman','female','feminin','mujer','una mujer','mulher','uma mulher','feminino','frau','weiblich','donna','femmina','vrouw','vrouwelijk','kobieta','femeie','žena','zena','kadin','женщина','жена','女性','여성','امرأة','انثى'],
    nonbinary:['non binaire','nonbinaire','non binary','nonbinary','no binario','nao binario','nao binaria','nicht binar','nichtbinar','non binario','persona non binaria','niet binair','nie binarny','niebinarna','nebinarny','nebinare','ne binar','nebinarní','небинарный','небинарен','非二元','논바이너리','غير ثنائي'],
    other:['autre','other','others','otro','otra','outro','outra','altro','altra','andere','anderes','sonstiges','anders','andere identiteit','inne','inny','altul','alta','ine','iny','diğer','diger','другое','друг','その他','其他','其它','기타','اخر','أخرى']
  };
  return Object.keys(groups).find(key=>groups[key].some(value=>genderText(value)===text))||'';
}
function genderOptions(criterion){return Array.isArray(criterion?.opts)?criterion.opts:Array.isArray(criterion?.options)?criterion.options:[];}
function isGenderCriterion(criterion){
  if(['gender','genre','sex','sexe'].includes(genderText(criterion?.kind||criterion?.key)))return true;
  const kinds=genderOptions(criterion).map(o=>genderAnswerKind(o.label));
  return kinds.includes('male')&&kinds.includes('female');
}
function optionalGenderAnswer(option){return ['nonbinary','other'].includes(genderAnswerKind(option?.label));}
function requiredGenderTheme(slug){return ['sexisme','mixite','allie-mixite'].includes(String(slug||'').toLowerCase().replace(/--copie--[a-f0-9]{12}$/, ''));}

  const optionalMinorityTheme=()=>['collegue-inclusif','collaborateur','collaborateur-inclusif','management','manager-inclusif','management-inclusif','lgbt'].includes(String(project?.theme_slug||theme||'').toLowerCase().replace(/--copie--[a-f0-9]{12}$/, ''))&&!isLegacyClientCampaign();
  const genderRequiredTheme=()=>requiredGenderTheme(project?.theme_slug||theme);
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
  // Modèles de suggestions : libellés de réponse préremplis uniquement à la création.
  // Une traduction déjà personnalisée ou issue d'un import historique n'est jamais écrasée.
  const EXAMPLE_TRANSLATIONS={
    fr:[['Business Unit',['Business Unit 1','Business Unit 2']],['Régions',['Région 1','Région 2']],['Fonction',['Fonction 1','Fonction 2']],['Manager ou collaborateur',['Manager','Collaborateur']]],
    en:[['Business unit',['Business unit 1','Business unit 2']],['Regions',['Region 1','Region 2']],['Job function',['Function 1','Function 2']],['Manager or employee',['Manager','Employee']]],
    es:[['Unidad de negocio',['Unidad de negocio 1','Unidad de negocio 2']],['Regiones',['Región 1','Región 2']],['Función',['Función 1','Función 2']],['Responsable o colaborador',['Responsable','Colaborador']]]
  };
  const EXAMPLES=EXAMPLE_TRANSLATIONS.fr;
  const suggestedCriterion=(index,locale)=>{const rows=EXAMPLE_TRANSLATIONS[normalizeLocale(locale)]||EXAMPLE_TRANSLATIONS.fr,entry=rows[index]||rows[0];return{q:entry[0],opts:entry[1].map(label=>({label,n:0}))};};
  const GENDER_TRANSLATIONS={
    fr:['Quel est votre genre ?',['Homme','Femme','Non binaire','Autre']],
    en:['What is your gender?',['Man','Woman','Non-binary','Other']],
    es:['¿Cuál es su género?',['Hombre','Mujer','No binario','Otro']]
  };
  const genderForLocale=locale=>{const row=GENDER_TRANSLATIONS[normalizeLocale(locale)]||GENDER_TRANSLATIONS.fr;return{kind:'gender',q:row[0],opts:row[1].map(label=>({label,n:0}))};};
  // Traduit seulement les modèles standard non personnalisés (pas les contenus legacy).
  function isAgeCriterion(criterion){
    const norm=value=>String(value||'').trim().toLowerCase();
    return norm(criterion?.kind)==='age'||['votre âge','your age'].includes(norm(criterion?.q));
  }
  function localizeStandardCriteria(items,locale){
    const loc=normalizeLocale(locale);
    if(isLegacyClientCampaign()||!['en','es'].includes(loc))return items;
    const genderSource=GENDER_TRANSLATIONS.fr,genderTarget=GENDER_TRANSLATIONS[loc],ageSource=AGE_TRANSLATIONS.fr,ageTarget=AGE_TRANSLATIONS[loc];
    return items.map(criterion=>{
      const c=clone(criterion);
      if(c.kind==='gender'||['Quel est votre genre ?','Vous êtes :'].includes(String(c.q||'').trim())){
        c.kind='gender';
        if([genderSource[0],'Vous êtes :'].includes(c.q))c.q=genderTarget[0];
        c.opts=(c.opts||[]).map(option=>{const variants=[['Homme','Un homme'],['Femme','Une femme'],['Non binaire','Non-binaire'],['Autre']];const i=variants.findIndex(row=>row.includes(String(option.label||'').trim()));return i>=0?{...option,label:genderTarget[1][i]}:option;});
      }else if(isAgeCriterion(c)){
        c.kind='age';
        if(ageSource[0]===c.q)c.q=ageTarget[0];
        c.opts=(c.opts||[]).map(option=>{const i=ageSource[1].indexOf(option.label);return i>=0?{...option,label:ageTarget[1][i]}:option;});
      }
      return c;
    });
  }
  const newSubcriterion=()=>({q:'',opts:[{label:'',n:0},{label:'',n:0}],subcriteria:[]});
  const rawSubcriteria=option=>Array.isArray(option?.subcriteria)?option.subcriteria:(option?.subcriterion?[option.subcriterion]:[]);
  function normalizeCriterion(item){
    if(isLegacyClientCampaign()){
      const original=item&&typeof item==='object'?item:{};
      return {...original,...((Object.hasOwn(original,'multiple')?original.multiple===true:original.multi_select===true||original.multiple_answers===true)?{multiple:true}:{}),q:String(original.q??original.label??original.question??''),opts:(Array.isArray(original.opts)?original.opts:Array.isArray(original.options)?original.options:[]).map(o=>({...o,label:String(o.label??''),n:Number(o.n)||0,subcriteria:rawSubcriteria(o).map(normalizeCriterion)}))};
    }
    return {
      ...(isAgeCriterion(item)?{kind:'age'}:item?.kind?{kind:String(item.kind)}:{}),
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
  function markIntroTranslationsToReview(referenceLocale,beforeText){const st=reviewState();for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(referenceLocale)||!String(introForLocale(n)||'').trim())continue;if(!st.intro[n])st.baselines.intro[n]={referenceLocale:normalizeLocale(referenceLocale),text:String(beforeText||'')};st.intro[n]=true;}}
  function socioDiffPaths(before,after){const paths=[];const max=Math.max(before?.length||0,after?.length||0);for(let i=0;i<max;i++){const a=before?.[i],b=after?.[i],key=criterionKey(b||a,i);if(!a||!b||String(a.q||'')!==String(b.q||''))paths.push(`q:${key}`);const ao=a?.opts||[],bo=b?.opts||[],m=Math.max(ao.length,bo.length);for(let j=0;j<m;j++)if(!ao[j]||!bo[j]||String(ao[j]?.label||'')!==String(bo[j]?.label||''))paths.push(`o:${key}:${String(bo[j]?.source_id??ao[j]?.source_id??`i${j}`)}`);}return [...new Set(paths)];}
  function markSocioTranslationsToReview(referenceLocale,paths,before){if(!paths.length)return;const st=reviewState();for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(referenceLocale)||!Array.isArray(socioLanguageVariants?.[n])||!socioLanguageVariants[n].length)continue;const todo=new Set(translationTodoPaths(n)),reviewPaths=paths.filter(path=>!todo.has(path));if(!reviewPaths.length)continue;st.socio[n]=[...new Set([...(Array.isArray(st.socio[n])?st.socio[n]:[]),...reviewPaths])];st.baselines.socio[n]=st.baselines.socio[n]&&typeof st.baselines.socio[n]==='object'?st.baselines.socio[n]:{};for(const path of reviewPaths)if(!st.baselines.socio[n][path])st.baselines.socio[n][path]={referenceLocale:normalizeLocale(referenceLocale),text:reviewPathValue(before,path)};}}
  function reviewCount(locale){const st=reviewState(),loc=normalizeLocale(locale);return (st.intro[loc]?1:0)+(Array.isArray(st.socio[loc])?st.socio[loc].length:0);}
  function clearCriterionReview(locale,criterion,index){const st=reviewState(),loc=normalizeLocale(locale),key=criterionKey(criterion,index),rows=Array.isArray(st.socio[loc])?st.socio[loc]:[];const removed=rows.filter(x=>x===`q:${key}`||x.startsWith(`o:${key}:`));st.socio[loc]=rows.filter(x=>!removed.includes(x));if(st.baselines.socio[loc])for(const path of removed)delete st.baselines.socio[loc][path];scheduleAutosave(0);renderSocioContext();renderSocio();}

  function projectCountries(){const raw=Array.isArray(project?.countries)?project.countries:[];const selected=normalizeCountry(project?.selected_country_code);return [...new Set([...raw.map(normalizeCountry),selected].filter(Boolean))];}
  function projectLocales(){
    const configured=Array.isArray(project?.locales)?project.locales:[],map=project?.country_locales&&typeof project.country_locales==='object'&&!Array.isArray(project.country_locales)?project.country_locales:{};
    const values=configured.length?configured:Object.values(map).flat().filter(value=>typeof value==='string');
    if(!values.length&&project?.selected_locale)values.push(project.selected_locale);
    return [...new Set(values.map(normalizeLocale).filter(Boolean))];
  }
  function activeLanguageVariants(variants){
    if(isLegacyClientCampaign())return variants;
    const active=new Set(projectLocales());
    return Object.fromEntries(Object.entries(variants||{}).filter(([locale])=>active.has(normalizeLocale(locale))));
  }
  function socioForLocale(locale){const loc=normalizeLocale(locale);return Array.isArray(socioLanguageVariants?.[loc])?clone(socioLanguageVariants[loc]):null;}
  function introForLocale(locale){const loc=normalizeLocale(locale),primary=normalizeLocale(project?.selected_locale||(Array.isArray(project?.locales)&&project.locales[0])||'fr');if(introVariants?.[loc]!==undefined)return String(introVariants[loc]||'');if(introResolvedVariants?.[loc]!==undefined)return String(introResolvedVariants[loc]||'');return loc===primary?String(project?.introduction_html??(isLegacyClientCampaign()?'':project?.theme_introduction_html)??''):'';}
  function introReference(){const socioRef=normalizeLocale(socioReference().locale),preferred=[socioRef,'fr','en','es',...projectLocales()].filter(Boolean),seen=new Set();for(const loc of preferred){const n=normalizeLocale(loc);if(seen.has(n)||(isLegacyClientCampaign()&&!projectLocales().includes(n)))continue;seen.add(n);const text=String(introVariants?.[n]??introResolvedVariants?.[n]??'').trim();if(text)return{locale:n,text};}const primary=normalizeLocale(project?.selected_locale||(Array.isArray(project?.locales)&&project.locales[0])||'fr'),projectIntro=String(project?.introduction_html||'').trim();if(projectIntro)return{locale:primary,text:projectIntro};const themeIntro=isLegacyClientCampaign()?'':String(project?.theme_introduction_html||'').trim();return themeIntro?{locale:'fr',text:themeIntro}:{locale:'',text:''};}
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
  function socioReference(){const stable=normalizeLocale(socioReferenceLocaleStable);if(stable&&(!isLegacyClientCampaign()||projectLocales().includes(stable))){const stableItems=socioForLocale(stable);if(Array.isArray(stableItems)&&stableItems.length)return{locale:stable,items:stableItems};}const preferred=[normalizeLocale(project?.selected_locale),'fr','en','es',...projectLocales()],seen=new Set();for(const loc of preferred){const n=normalizeLocale(loc);if(!n||seen.has(n)||(isLegacyClientCampaign()&&!projectLocales().includes(n)))continue;seen.add(n);const items=socioForLocale(n);if(Array.isArray(items)&&items.length)return{locale:n,items};}const first=Object.keys(socioLanguageVariants||{}).find(loc=>(!isLegacyClientCampaign()||projectLocales().includes(normalizeLocale(loc)))&&Array.isArray(socioLanguageVariants[loc])&&socioLanguageVariants[loc].length);if(first)return{locale:first,items:socioForLocale(first)};if((project?.legacy_payload?.copySettingsPolicy==='new_client'||project?.legacy_payload?.minorityDefaultInitialized===true)){const locales=projectLocales(),reference=[project?.selected_locale,project?.working_locale,...locales].map(normalizeLocale).find(loc=>loc&&locales.includes(loc));if(reference)return{locale:reference,items:[]};}return{locale:'',items:[]};}
  function isSocioReferenceLocale(){if(isAdminLegacySocio())return true;const ref=socioReference();return Boolean(ref.locale)&&normalizeLocale(ref.locale)===normalizeLocale(socioContextLocale);}
  function canAdminCleanLegacyVariant(){const refLoc=normalizeLocale(socioReference().locale),currentLoc=normalizeLocale(socioContextLocale);return currentUser.role==='admin'&&isLegacyClientCampaign()&&!isReadOnly()&&Boolean(refLoc)&&Boolean(currentLoc)&&refLoc!==currentLoc;}
  function syncSocioStructureControls(){
    const readOnly=isSocioReadOnly(),editable=!readOnly&&isSocioReferenceLocale();
    const examples=document.querySelector('.socio-examples-visible');
    if(examples){examples.hidden=readOnly;examples.style.display=readOnly?'none':'';renderExampleSuggestions();}
    for(const addCustom of [$('add-socio'),$('add-socio-top')].filter(Boolean)){
      addCustom.hidden=false;
      addCustom.style.display=readOnly?'none':'';
      addCustom.textContent='+ Ajouter une donnée personnalisée';
      addCustom.title=editable?'':'La structure se construit dans la langue de référence.';
      addCustom.classList.toggle('is-translation-redirect',!editable);
    }
  }
  function renderExampleSuggestions(){
    const host=document.querySelector('.socio-examples-visible');if(!host)return;
    const locale=normalizeLocale(socioContextLocale),rows=EXAMPLE_TRANSLATIONS[locale]||EXAMPLE_TRANSLATIONS.fr;
    const names={fr:['Âge',...rows.map(row=>row[0])],en:['Age',...rows.map(row=>row[0])],es:['Edad',...rows.map(row=>row[0])]};
    host.querySelectorAll('[data-example]').forEach(button=>{const index=button.dataset.example==='age'?0:Number(button.dataset.example)+1;button.textContent=`+ ${names[locale]?.[index]||names.fr[index]}`;});
    const message=host.querySelector('span');
    if(message)message.textContent=locale==='en'?'Suggested optional questions. They are added with English labels and answers; you can customise them, except for the standardised age bands.':locale==='es'?'Preguntas opcionales sugeridas. Se añaden con preguntas y respuestas en español; puede personalizarlas, excepto los tramos de edad estandarizados.':'Critères facultatifs proposés par Me&YouToo. Les questions et réponses sont préremplies dans chaque langue ; les tranches d’âge restent figées pour le benchmark.';
  }
  function renderStickySocioLanguages(){
    const host=$('socio-dsd-context');if(!host)return;
    let bar=host.querySelector('.socio-sticky-languages');
    if(!bar){bar=document.createElement('div');bar.className='socio-sticky-languages';host.appendChild(bar);}
    const ref=socioReference(),refLoc=normalizeLocale(ref.locale),current=normalizeLocale(socioContextLocale);
    bar.innerHTML=`<div class="socio-sticky-languages-head"><strong>Langue travaillée</strong>${refLoc&&!isLegacyClientCampaign()?`<span>Structure pilotée depuis ${esc(localeLabel(refLoc))} (${esc(refLoc.toUpperCase())})</span>`:''}</div><div class="socio-sticky-language-buttons">${projectLocales().map(loc=>{const n=normalizeLocale(loc),c=translationCounts(n),isRef=n===refLoc,suffix=isLegacyClientCampaign()?'':isRef?'Référence':[c.todo?`${c.todo} à traduire`:'',c.review?`${c.review} à vérifier`:''].filter(Boolean).join(' · ');return `<button type="button" class="${n===current?'is-active':''} ${isRef?'is-reference':''}" data-sticky-locale="${esc(n)}">${esc(localeLabel(n))} <small>${esc(n.toUpperCase())}${suffix?` · ${esc(suffix)}`:''}</small></button>`;}).join('')}</div>${!isLegacyClientCampaign()&&refLoc&&current!==refLoc?`<button type="button" class="socio-go-reference" data-sticky-locale="${esc(refLoc)}">← Modifier la structure en ${esc(localeLabel(refLoc))}</button>`:''}`;
    bar.querySelectorAll('[data-sticky-locale]').forEach(btn=>btn.onclick=()=>{storeActiveLanguageContent();activateLanguage(btn.dataset.stickyLocale);renderSocioContext();renderSocio();scheduleAutosave(0);});
  }
  function nativeSocioKind(criterion){return isGenderCriterion(criterion)?'gender':isAgeCriterion(criterion)?'age':'';}
  function uniqueSocioMatch(item,candidates){
    const id=stableSourceId(item);
    if(id){const hits=candidates.filter(c=>stableSourceId(c)===id);return hits.length===1?hits[0]:null;}
    const kind=nativeSocioKind(item);
    if(kind){const hits=candidates.filter(c=>nativeSocioKind(c)===kind);return hits.length===1?hits[0]:null;}
    const q=comparableSocioText(item?.q);
    if(q){const hits=candidates.filter(c=>comparableSocioText(c.q)===q);if(hits.length===1)return hits[0];}
    const labels=(item?.opts||[]).map(o=>comparableSocioText(o.label));
    if(labels.length&&labels.every(Boolean)){
      const hits=candidates.filter(c=>c.opts?.length===labels.length&&c.opts.every((o,i)=>comparableSocioText(o.label)===labels[i]));
      if(hits.length===1)return hits[0];
    }
    return null;
  }
  function restoreNativeSocioIds(rows,baseline){
    if(isLegacyClientCampaign())return rows;
    for(const row of rows||[]){
      const source=uniqueSocioMatch(row,baseline||[]);if(!source)continue;
      if(!stableSourceId(row)&&stableSourceId(source))row.source_id=String(source.source_id);
      for(const option of row.opts||[]){
        const id=stableSourceId(option),label=comparableSocioText(option.label);
        const candidates=(source.opts||[]).filter(o=>id?stableSourceId(o)===id:label&&comparableSocioText(o.label)===label);
        if(candidates.length!==1)continue;const before=candidates[0];
        if(!id&&stableSourceId(before))option.source_id=String(before.source_id);
        restoreNativeSocioIds(option.subcriteria||[],before.subcriteria||[]);
      }
    }
    return rows;
  }
  function orderNativeSocioRows(reference,rows){
    if(isLegacyClientCampaign())return rows;
    const remaining=[...(rows||[])],ordered=[];
    for(const source of reference||[]){
      const target=uniqueSocioMatch(source,remaining);if(!target)continue;
      ordered.push(target);remaining.splice(remaining.indexOf(target),1);
    }
    return [...ordered,...remaining];
  }
  function alignNativeSocioVariants(baselines){
    if(isLegacyClientCampaign())return;
    for(const [locale,rows] of Object.entries(socioLanguageVariants))restoreNativeSocioIds(rows,baselines[locale]||[]);
    const ref=socioReference();
    for(const [locale,rows] of Object.entries(socioLanguageVariants))if(normalizeLocale(locale)!==normalizeLocale(ref.locale))socioLanguageVariants[locale]=orderNativeSocioRows(ref.items,rows);
  }
  function referenceCriterionFor(criterion,index){if(isLegacyClientCampaign())return null;const ref=socioReference();if(!ref.items?.length||normalizeLocale(ref.locale)===normalizeLocale(socioContextLocale))return null;const match=uniqueSocioMatch(criterion,ref.items);return match?{locale:ref.locale,criterion:match,index:ref.items.indexOf(match)}:null;}
  function renderSocioReference(criterion,index){if(isLegacyClientCampaign())return'';const ref=referenceCriterionFor(criterion,index);if(!ref)return'';const st=reviewState(),loc=normalizeLocale(socioContextLocale),key=criterionKey(ref.criterion,ref.index),status=socioTranslationStatus(loc),rows=status.reviewPaths,todos=status.todoPaths,qPath=`q:${key}`,qTodo=todos.includes(qPath),qNeeds=!qTodo&&rows.includes(qPath),qBase=st.baselines.socio?.[loc]?.[qPath]?.text;const opts=(ref.criterion.opts||[]).map((o,j)=>{const optionKey=String(o?.source_id??`i${j}`),path=`o:${key}:${optionKey}`,todo=todos.includes(path),needs=!todo&&rows.includes(path),base=st.baselines.socio?.[loc]?.[path]?.text,label=esc(o.label);return `<li class="${needs?'has-translation-diff':''} ${todo?'is-translation-todo':''}">${label}</li>`;}).join('');const needs=rows.some(x=>(x===qPath||x.startsWith(`o:${key}:`))&&!todos.includes(x)),todo=todos.some(x=>x===qPath||x.startsWith(`o:${key}:`)),question=esc(ref.criterion.q||'');return `<aside class="socio-reference-panel">${todo?`<div class="translation-review-alert translation-todo-alert"><strong>Traduction à renseigner</strong><span>Cette donnée a été ajoutée en ${esc(localeLabel(ref.locale))}. Traduisez la question et les réponses en ${esc(localeLabel(loc))}.</span></div>`:needs?`<div class="translation-review-alert"><strong>Traduction à vérifier</strong><span>Vérifiez votre traduction à partir de la référence ci-dessous.</span><button type="button" data-review-clear="${index}">Marquer comme vérifié</button></div>`:''}<div class="socio-reference-head"><strong>Référence projet · ${esc(localeLabel(ref.locale))}</strong><span class="status-pill">${esc(String(ref.locale).toUpperCase())}</span></div><div class="socio-reference-question ${qNeeds?'has-translation-diff':''} ${qTodo?'is-translation-todo':''}">${question}</div><div class="socio-reference-label">Réponses de référence</div><ol>${opts}</ol><small>${todo?'Renseignez les champs à droite. Le statut disparaît automatiquement lorsque la traduction est complète.':'La référence actuelle est affichée ci-dessus. Vérifiez la traduction à droite après une modification de la référence.'}</small></aside>`;}
  const isAdminReview=()=>currentUser.role==='admin'&&project?.review_mode&&!isLegacyClientCampaign();
  function submittedSettings(){return project?.review_submitted_settings||project?.review_snapshot?.project||null;}
  function reviewWordDiff(original,current){
    if(String(original??'')===String(current??''))return esc(current??'');
    const a=String(original||'').split(/(\s+|[.,;:!?'"()«»–—-])/).filter(Boolean),b=String(current||'').split(/(\s+|[.,;:!?'"()«»–—-])/).filter(Boolean);
    if(a.length*b.length>1000000)return `<del>${esc(original)}</del> <ins>${esc(current)}</ins>`;
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
  function settingsReviewBlock(reference,submitted,current){
    if(!isAdminReview())return '';
    if(submitted==null)return '<div class="composer-diff">Version transmise indisponible pour cet élément ; aucune comparaison supposée.</div>';
    const block=(before,after,label,admin=false)=>{
      const diff=reviewWordDiff(before,after),hasRemovals=diff.includes('<del>'),afterHtml=diff.replace(/<del>[\s\S]*?<\/del>/g,''),beforeHtml=diff.replace(/<ins>[\s\S]*?<\/ins>/g,'');
      return `<div class="composer-diff${admin?' is-admin-correction':''}"><div class="composer-diff-label">${esc(label)}</div><div class="composer-diff-text" style="white-space:pre-wrap">${afterHtml||'—'}</div>${hasRemovals?`<details class="admin-review-removed"><summary>Voir les passages supprimés du texte précédent</summary><div class="composer-diff-text" style="white-space:pre-wrap">${beforeHtml}</div></details>`:''}</div>`;
    };
    let html=reference==null?block(submitted,submitted,'Version transmise par le client'):String(reference)===String(submitted)?block(submitted,submitted,'Version transmise · identique au référentiel'):block(reference,submitted,'Version transmise par le client · ajouts en vert');
    if(String(submitted)!==String(current))html+=block(submitted,current,'Votre correction Me&YouToo · version de travail privée',true);
    return html;
  }
  function reviewLocaleValue(map,locale){const key=Object.keys(map||{}).find(k=>normalizeLocale(k)===normalizeLocale(locale));return key===undefined?undefined:map[key];}
  function submittedIntroForReview(locale){
    const saved=submittedSettings();
    const text=reviewLocaleValue(saved?.introduction_variants,locale)??reviewLocaleValue(saved?.introduction_variants_resolved,locale)??(normalizeLocale(locale)===normalizeLocale(saved?.selected_locale||project.working_locale||project.selected_locale||'fr')?saved?.introduction_html:undefined);
    return text==null?null:stripHtml(text);
  }
  function reviewIntroComparison(locale,current){
    const reference=reviewLocaleValue(introReferenceVariants,locale);
    return settingsReviewBlock(reference==null?null:stripHtml(reference),submittedIntroForReview(locale),current);
  }
  function saveReviewPeerIntro(locale,value){
    if(!isAdminReview()||projectLocales().length!==2||normalizeLocale(locale)===normalizeLocale(socioContextLocale))return;
    const loc=normalizeLocale(locale),before=introForLocale(loc),ref=introReference();
    if(normalizeLocale(ref.locale)===loc&&String(value)!==String(before))markIntroTranslationsToReview(loc,before);
    // Keep an explicitly empty translation empty; never replace it with a fallback.
    introVariants[loc]=String(value);
    updateNextState();scheduleAutosave();
  }
  function reviewPrimaryIntroForSave(primary,current,fallback=''){
    if(normalizeLocale(socioContextLocale)===normalizeLocale(primary))return current;
    if(isAdminReview()&&projectLocales().length===2&&Object.hasOwn(introVariants,primary))return String(introVariants[primary]??'');
    return String(project?.introduction_html||fallback);
  }
  function renderReviewIntroPair(){
    const input=$('intro'),container=input?.closest?.('.parameter-intro-compare');if(!container)return;
    const locales=projectLocales(),peerLocale=locales.length===2?locales.find(loc=>normalizeLocale(loc)!==normalizeLocale(socioContextLocale)):'';
    container.classList.add('is-admin-review-intros');container.classList.toggle('is-review-bilingual',Boolean(peerLocale));input.rows=6;
    let peer=$('admin-review-intro-peer');
    if(!peerLocale){peer?.remove();return;}
    if(!peer){peer=document.createElement('div');peer.id='admin-review-intro-peer';peer.className='field parameter-intro-edit';container.appendChild(peer);}
    if(peer.dataset.locale!==peerLocale){
      peer.dataset.locale=peerLocale;
      peer.innerHTML=`<label for="admin-review-intro-peer-input">Introduction · ${esc(localeLabel(peerLocale))} · votre version de travail <span class="req">*</span></label><textarea id="admin-review-intro-peer-input" rows="6" required></textarea><div id="admin-review-intro-peer-comparison"></div>`;
      $('admin-review-intro-peer-input').addEventListener('input',event=>saveReviewPeerIntro(peerLocale,event.target.value));
    }
    const peerInput=$('admin-review-intro-peer-input');
    if(document.activeElement!==peerInput)peerInput.value=stripHtml(introForLocale(peerLocale));
    $('admin-review-intro-peer-comparison').innerHTML=reviewIntroComparison(peerLocale,peerInput.value);
  }
  function renderSettingsReview(){
    if(!isAdminReview()){
      const input=$('intro');if(!input||!project||isLegacyClientCampaign())return;
      let host=$('client-review-intro');if(!host){host=document.createElement('div');host.id='client-review-intro';input.after(host);}
      const reference=reviewLocaleValue(introReferenceVariants,socioContextLocale);
      if(reference==null||stripHtml(reference)===input.value){host.innerHTML='';return;}
      const diff=reviewWordDiff(stripHtml(reference),input.value),after=diff.replace(/<del>[\s\S]*?<\/del>/g,''),before=diff.replace(/<ins>[\s\S]*?<\/ins>/g,'');
      host.innerHTML=`<div class="composer-diff"><div class="composer-diff-label">Vos modifications · ${esc(localeLabel(socioContextLocale))} · ajouts en vert</div><div class="composer-diff-text" style="white-space:pre-wrap">${after||'—'}</div>${diff.includes('<del>')?`<details class="admin-review-removed"><summary>Voir les passages supprimés du texte précédent</summary><div class="composer-diff-text" style="white-space:pre-wrap">${before}</div></details>`:''}</div>`;
      return;
    }
    renderReviewIntroPair();
    const saved=submittedSettings();
    for(const [id,key,ref] of [['campaign-name','campaign_name',project.base_title],['respondent-title','respondent_title',project.respondent_title_default],['launch-date','launch_date',null],['close-date','close_date',null],['intro','introduction_html',reviewLocaleValue(introReferenceVariants,socioContextLocale)]]){
      const input=$(id);if(!input)continue;
      let before=saved?.[key],reference=ref;
      if(id==='intro'){
        before=submittedIntroForReview(socioContextLocale);reference=ref==null?null:stripHtml(ref);
      }else if(id.endsWith('-date'))before=before==null?null:String(before).slice(0,10);
      let host=$(`admin-review-${id}`);if(!host){host=document.createElement('div');host.id=`admin-review-${id}`;input.after(host);}
      host.innerHTML=settingsReviewBlock(reference,before,input.value);
    }
    document.querySelectorAll('[data-admin-socio-review]').forEach(host=>{host.innerHTML=renderSocioAdminReview(Number(host.dataset.adminSocioReview));});
  }
  function socioReviewText(criterion){
    if(!criterion)return 'Donnée absente';
    return [criterion.q||'',...(criterion.opts||[]).flatMap(option=>[option.label||'',...(option.subcriteria||[]).map(socioReviewText)])].join('\n');
  }
  function renderSocioAdminReview(index){
    if(!isAdminReview())return '';
    const saved=submittedSettings(),loc=socioContextLocale,items=reviewLocaleValue(saved?.sociodemo_language_variants,loc)??reviewLocaleValue(saved?.sociodemo_language_variants_resolved,loc)??(normalizeLocale(loc)===normalizeLocale(saved?.selected_locale||project.working_locale||project.selected_locale||'fr')?saved?.sociodemo:null);
    if(!items)return settingsReviewBlock(null,null,'');
    const current=socio[index],find=list=>current?.source_id!=null?list?.find(c=>String(c.source_id)===String(current.source_id)):list?.find(c=>(current.kind&&c.kind===current.kind)||c.q===current.q);
    const client=find(items),refs=reviewLocaleValue(project.theme_sociodemo_variants,loc),reference=Array.isArray(refs)?find(refs):null;
    if(!client&&current?.source_id==null)return settingsReviewBlock(null,null,'');
    return settingsReviewBlock(reference?socioReviewText(reference):null,socioReviewText(client),socioReviewText(current));
  }
  function renderIntroReference(){renderSettingsReview();if(isAdminReview()){$('intro-reference-panel').hidden=true;const label=$('intro-edit-title');if(label)label.textContent=`Introduction · ${localeLabel(socioContextLocale)} · votre version de travail`;return;}const panel=$('intro-reference-panel'),text=$('intro-reference-text'),title=$('intro-reference-title'),badge=$('intro-reference-badge'),editTitle=$('intro-edit-title');if(!panel||!text)return;if($('intro'))$('intro').readOnly=isReadOnly()||(isLegacyClientCampaign()&&currentUser.role!=='admin');const ref=introReference(),current=normalizeLocale(socioContextLocale);if(editTitle)editTitle.textContent=`Introduction · ${localeLabel(current)} (${current.toUpperCase()})`;if(!ref.text||normalizeLocale(ref.locale)===current){panel.hidden=true;return;}panel.hidden=false;if(title)title.textContent=`Référence projet · ${localeLabel(ref.locale)}`;if(badge)badge.textContent=String(ref.locale).toUpperCase();const head=panel.querySelector('.parameter-reference-head');let editRef=panel.querySelector('[data-edit-intro-reference]');if(currentUser.role==='admin'&&head){if(!editRef){editRef=document.createElement('button');editRef.type='button';editRef.className='button button-secondary button-small';editRef.dataset.editIntroReference='1';editRef.style.marginLeft='auto';head.appendChild(editRef);}editRef.textContent=`Modifier ${localeLabel(ref.locale)}`;editRef.hidden=false;editRef.onclick=()=>{storeActiveLanguageContent();activateLanguage(ref.locale);renderSocioContext();renderSocio();scheduleAutosave(0);setTimeout(()=>$('intro')?.focus(),0);};}else if(editRef)editRef.hidden=true;const st=reviewState(),needs=!isLegacyClientCampaign()&&Boolean(st.intro[current]),baseline=st.baselines.intro?.[current]?.text,currentText=stripHtml(ref.text);text.textContent=currentText;const alert=$('intro-review-alert'),clear=$('intro-review-clear');if(alert)alert.hidden=!needs;if(clear)clear.onclick=()=>{delete st.intro[current];delete st.baselines.intro[current];scheduleAutosave(0);renderSocioContext();renderIntroReference();};}
  function storeActiveSocio(skipReview=false){if(isSocioReadOnly()||!socioContextLocale)return;const normalized=normalizedSocio(socio),serialized=JSON.stringify(normalized);if(!socioContextHasStored&&serialized===socioContextBaseline)return;const loc=normalizeLocale(socioContextLocale),ref=socioReference(),before=Array.isArray(socioLanguageVariants?.[loc])?clone(socioLanguageVariants[loc]):[];if(!skipReview&&!isLegacyClientCampaign()&&!insertingTranslatedSuggestion&&ref.locale&&normalizeLocale(ref.locale)===loc)markSocioTranslationsToReview(loc,socioDiffPaths(before,normalized),before);socioLanguageVariants[loc]=clone(normalized);socioContextHasStored=true;socioContextBaseline=serialized;}
  function storeActiveIntro(){if(isReadOnly()||(isLegacyClientCampaign()&&currentUser.role!=='admin')||!socioContextLocale||!$('intro'))return;const current=String($('intro').value||'').trim();if(isLegacyClientCampaign()){if(current!==introContextBaseline){introVariants[normalizeLocale(socioContextLocale)]=current;introContextHasStored=true;introContextBaseline=current;}return;}if(!introContextHasStored&&current===introContextBaseline)return;const loc=normalizeLocale(socioContextLocale),ref=introReference(),before=String(introVariants?.[loc]??introResolvedVariants?.[loc]??'').trim();if(ref.locale&&normalizeLocale(ref.locale)===loc&&current!==before)markIntroTranslationsToReview(loc,before);introVariants[loc]=current;introContextHasStored=true;introContextBaseline=current;}
  function storeActiveLanguageContent(){storeActiveSocio();storeActiveIntro();}
  function activateLanguage(locale){socioContextLocale=normalizeLocale(locale);const countries=projectCountries();socioContextCountry=normalizeCountry(project?.selected_country_code)||(countries[0]||'');const exact=socioForLocale(socioContextLocale);socio=normalizeSexismeCriteria(localizeStandardCriteria(normalizedSocio(exact||(isLegacyClientCampaign()?(normalizeLocale(project?.selected_locale)===socioContextLocale&&Array.isArray(project?.sociodemo)?project.sociodemo:[]):(Array.isArray(project?.sociodemo)&&project.sociodemo.length?project.sociodemo:defaultSocio()))),socioContextLocale));socioContextHasStored=Boolean(exact);socioContextBaseline=JSON.stringify(normalizedSocio(socio));const intro=stripHtml(introForLocale(socioContextLocale));if($('intro'))$('intro').value=intro;introContextHasStored=Boolean(introVariants?.[socioContextLocale]);introContextBaseline=String(intro||'').trim();socioOpenRoots.clear();socioOpenBranches.clear();renderIntroReference();}
  function renderSocioContext(){const introWrap=$('socio-context'),introSelect=$('socio-locale'),introNote=$('socio-context-note'),dsdWrap=$('socio-dsd-context'),dsdSelect=$('socio-dsd-locale'),dsdNote=$('socio-dsd-context-note');if(!introWrap||!introSelect)return;const originNote=$('intro-origin-note');if(originNote&&isLegacyClientCampaign())originNote.textContent='L’introduction ci-dessous est celle de votre campagne, dans la langue sélectionnée.';const locales=projectLocales();if(!locales.length){introWrap.hidden=true;if(dsdWrap)dsdWrap.hidden=true;return;}const hideLanguageControls=currentUser.role!=='admin'&&locales.length===1&&projectCountries().length<=1;introWrap.hidden=hideLanguageControls;introWrap.style.display=hideLanguageControls?'none':'';if(dsdWrap){dsdWrap.hidden=hideLanguageControls;dsdWrap.style.display=hideLanguageControls?'none':'';}const currentLocale=locales.includes(normalizeLocale(socioContextLocale))?normalizeLocale(socioContextLocale):(locales[0]||'fr');const options=locales.map(loc=>{const c=translationCounts(loc),suffix=[c.todo?`${c.todo} à traduire`:'',c.review?`${c.review} à vérifier`:''].filter(Boolean).join(' · ');return `<option value="${esc(loc)}">${esc(localeLabel(loc))} (${esc(loc.toUpperCase())})${suffix?` · ${suffix}`:''}</option>`}).join('');introSelect.innerHTML=options;introSelect.value=currentLocale;if(dsdSelect){dsdSelect.innerHTML=options;dsdSelect.value=currentLocale;}socioContextLocale=currentLocale;if(introNote)introNote.textContent=isLegacyClientCampaign()?(currentUser.role==='admin'?'Modifiez l’introduction dans la langue sélectionnée. Chaque traduction est enregistrée séparément pour cette campagne.':'Consultez l’introduction dans les langues actives de votre campagne.'):'Modifiez la langue sélectionnée en gardant la langue de référence Me&YouToo visible ci-dessous.';if(dsdNote)dsdNote.textContent=isAdminLegacySocio()?`Les ajouts de critères, sous-critères et réponses sont créés dans les ${locales.length} langues actives de cette campagne. Les traductions se modifient séparément.`:isLegacyClientCampaign()?'Consultez les données d’analyse de votre campagne dans la langue sélectionnée.':'Tout ajout crée la même structure dans les langues actives de cette campagne ; les traductions sont à compléter séparément.';if(dsdNote&&optionalMinorityTheme())dsdNote.textContent+=' La question sur le sentiment d’appartenance à une ou plusieurs minorités est proposée par défaut et peut être supprimée.';syncSocioStructureControls();renderStickySocioLanguages();const changeLocale=nextLocale=>{storeActiveLanguageContent();scheduleAutosave(0);activateLanguage(nextLocale);renderSocioContext();renderSocio();};introSelect.onchange=()=>changeLocale(introSelect.value);if(dsdSelect)dsdSelect.onchange=()=>changeLocale(dsdSelect.value);}
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
    if(isLegacyClientCampaign())return items;
    const loc=normalizeLocale(locale),todos=new Set(translationTodoPaths(loc)),keepCriterion=(c,i)=>!isBlankAutoCriterion(c)||todos.has(`q:${criterionKey(c,i)}`)||[...todos].some(path=>path.startsWith(`o:${criterionKey(c,i)}:`));
    for(const criterion of items)if(isAgeCriterion(criterion))criterion.kind='age';
    const importedGender=items.find(isGenderCriterion);if(importedGender)importedGender.kind='gender';
    if(!genderRequiredTheme())return items.filter(keepCriterion);
    if(!isLegacyClientCampaign()&&['en','es'].includes(loc)){
      const localized=localizeStandardCriteria(items.filter(keepCriterion),loc);
      const gender=localized.find(c=>c.kind==='gender'||/^(what is your gender\?|¿cuál es su género\?|quel est votre genre \?)/i.test(c.q||''));
      if(gender){gender.kind='gender';return localized;}
      return [genderForLocale(loc),...localized];
    }
    let cleaned=items.filter(keepCriterion);
    // Les critères importés conservent leurs textes, bornes, IDs et effectifs.
    let gender=cleaned.find(isGenderCriterion);
    if(!gender){gender=clone(defaultSocio()[0]);cleaned.unshift(gender);}else gender.kind='gender';

    return cleaned;
  }
  function show(message){const alert=$('param-alert');alert.hidden=false;alert.textContent=message;alert.scrollIntoView({behavior:'smooth',block:'center'});}
  function optionState(value){const n=Number(value)||0;if(!n)return{cls:'empty',hint:'Effectif à renseigner'};if(n<8)return{cls:'danger',hint:'🚨 Groupe trop petit : moins de 8'};if(n<10)return{cls:'warning',hint:'⚠️ Groupe fragile : entre 8 et 9'};return{cls:'success',hint:'✓ Groupe exploitable'};}
  function updateOptionVisual(input){const unit=input.closest('.socio-option-unit'),state=optionState(input.value),field=unit?.querySelector('.socio-count-field'),hint=unit?.querySelector('.socio-option-hint');if(field)field.className='socio-count-field '+state.cls;if(hint){hint.className='socio-option-hint '+state.cls;hint.textContent=state.hint;}updateVigilance();}

  const socioOpenRoots=new Set();
  const socioOpenBranches=new Set();
  function criterionStats(criterion){
    let nested=0,maxDepth=1;
    const walk=(c,depth)=>{maxDepth=Math.max(maxDepth,depth);(c?.opts||[]).forEach(o=>(o.subcriteria||[]).forEach(child=>{nested++;walk(child,depth+1);}));};
    walk(criterion,1);
    return{responses:(criterion?.opts||[]).length,nested,maxDepth};
  }
  function openSocioPath(path){
    const parts=String(path).split('.');socioOpenRoots.add(parts[0]);
    for(let length=3;length<=parts.length;length+=2)socioOpenBranches.add(parts.slice(0,length).join('.'));
  }
  function getCriterionByPath(path){
    const parts=String(path).split('.').map(Number);let criterion=socio[parts[0]];
    for(let i=1;i<parts.length;i+=2){criterion=criterion?.opts?.[parts[i]]?.subcriteria?.[parts[i+1]];}
    return criterion;
  }
  function getOptionByPath(path){const [criterionPath,index]=String(path).split('|');return getCriterionByPath(criterionPath)?.opts?.[Number(index)];}
  function criterionParentInfo(path){const parts=String(path).split('.').map(Number);if(parts.length<3)return null;const childIndex=parts.pop(),optionIndex=parts.pop(),parentPath=parts.join('.');return{parentPath,optionIndex,childIndex};}
  const answerRow=(option,optionPath,removable,locked=false)=>{const state=optionState(option.n),ro=isSocioReadOnly();return`<div class="socio-option-unit ${locked?'locked-option':''}"><div class="socio-option"><div class="socio-answer-field ${locked?'locked-field':''}"><span>${locked?'Réponse figée':'Réponse'}</span><input data-tree-label="${optionPath}" value="${esc(option.label)}" placeholder="Saisissez une réponse" aria-label="Réponse possible" ${ro||locked?'readonly tabindex="-1"':''}></div><div class="socio-count-field ${state.cls}"><span>Effectif estimé</span><input data-tree-n="${optionPath}" type="number" min="0" placeholder="Ex. 25" value="${Number(option.n)||''}" aria-label="Effectif estimé" ${ro||locked?'readonly tabindex="-1"':''}></div>${ro||locked?'<span class="socio-option-spacer" aria-hidden="true"></span>':`<button type="button" class="socio-option-remove" data-tree-option-remove="${optionPath}" ${removable?'':'disabled'}>×</button>`}</div><div class="socio-option-hint ${state.cls}">${state.hint}</div></div>`;};
  function renderNestedCriterion(criterion,path,level,conditionLabel){
    const ro=isSocioReadOnly(),stats=criterionStats(criterion),isOpen=socioOpenBranches.has(path),structureEditable=!ro&&isSocioReferenceLocale(),legacyVariantCleanup=!isLegacyClientCampaign()&&canAdminCleanLegacyVariant();
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
        <div class="field"><label>Question complémentaire</label><input data-tree-q="${path}" value="${esc(criterion.q)}" placeholder="Saisissez votre question" ${ro?'readonly tabindex="-1"':''}></div>
        <div class="socio-selection-mode"><span>Mode de réponse</span>${structureEditable?`<button type="button" class="button button-small ${criterion.multiple?'button-primary':'button-secondary'}" data-tree-multiple="${path}" aria-pressed="${criterion.multiple?'true':'false'}">${criterion.multiple?'✓ Plusieurs réponses possibles':'Une seule réponse'}</button>`:`<span class="status-pill">${criterion.multiple?'Plusieurs réponses possibles':'Une seule réponse'}</span>`}</div>
        <div class="socio-sub-options">${options}</div>
        ${structureEditable?`<button class="button button-ghost" type="button" data-tree-option-add="${path}">+ Ajouter une sous-réponse</button>`:''}
      </div>
    </div>`;
  }
  function renderSocio(){
    const ro=isSocioReadOnly(),structureEditable=!ro&&isSocioReferenceLocale();
    const toolbar=`<div class="socio-tree-toolbar"><div><strong>Données socio-démographiques</strong><span>${isLegacyClientCampaign()?(isAdminLegacySocio()?(isOrange382Project(project)?'Édition Me&YouToo : les réponses ajoutées depuis l’anglais sont créées dans toutes les langues actives. Complétez ensuite leur libellé dans chaque langue. Les autres modifications restent propres à la langue sélectionnée.':'Édition Me&YouToo : les modifications sont enregistrées uniquement dans la langue sélectionnée. Les autres langues restent inchangées.'):'Consultez les questions et réponses de la campagne dans la langue sélectionnée.'):'Repliez les critères et ouvrez uniquement la branche que vous souhaitez modifier.'}</span></div><div class="socio-tree-toolbar-actions"><button type="button" class="button button-ghost button-small" data-socio-collapse-all>Tout replier</button><button type="button" class="button button-secondary button-small" data-socio-expand-all>Tout déplier</button></div></div>`;
    $('socio-list').innerHTML=toolbar+socio.map((criterion,i)=>{
      const path=String(i),isGender=isGenderCriterion(criterion),isAge=!isAdminLegacySocio()&&isAgeCriterion(criterion),locked=isGender||isAge||ro,isOpen=socioOpenRoots.has(path),stats=criterionStats(criterion),translationMode=Boolean(referenceCriterionFor(criterion,i)),criterionStructureEditable=structureEditable&&!translationMode;
      const optionsHtml=criterion.opts.map((option,j)=>{
        const optionPath=`${path}|${j}`;
        if(locked){
          const state=optionState(option.n),canRemove=!ro&&isGender&&optionalGenderAnswer(option);
          const removeControl=canRemove?`<button type="button" class="socio-option-remove socio-option-remove-visible" data-tree-option-remove="${optionPath}" aria-label="Supprimer ${esc(option.label)}" title="Supprimer cette réponse facultative">×</button>`:`<span class="socio-option-spacer" aria-hidden="true"></span>`;
          const children=(option.subcriteria||[]).map((child,k)=>renderNestedCriterion(child,`${path}.${j}.${k}`,2,option.label)).join('');
          return `<div class="socio-option-block"><div class="socio-option-unit locked-option"><div class="socio-option"><div class="socio-answer-field locked-field"><span>Réponse figée</span><input value="${esc(option.label)}" readonly tabindex="-1" aria-label="Réponse non modifiable"></div><div class="socio-count-field ${state.cls}"><span>Effectif estimé</span><input data-tree-n="${optionPath}" type="number" min="0" value="${Number(option.n)||''}" readonly tabindex="-1"></div>${removeControl}</div><div class="socio-option-hint ${state.cls}">${state.hint}</div></div>${children}</div>`;
        }
        const children=(option.subcriteria||[]).map((child,k)=>renderNestedCriterion(child,`${path}.${j}.${k}`,2,option.label)).join('');
        return `<div class="socio-option-block">${answerRow(option,optionPath,criterionStructureEditable&&criterion.opts.length>2)}${children}${criterionStructureEditable?`<button class="socio-add-sub" type="button" data-tree-child-add="${optionPath}">+ Ajouter un sous-critère pour cette réponse</button>`:''}</div>`;
      }).join('');
      const lockText=ro?'Campagne en lecture seule.':isGender?'Critère figé · seuls les choix Non binaire et Autre peuvent être retirés. Les autres réponses et le libellé restent inchangés.':isAge?'Tranches d’âge standardisées pour permettre la comparaison avec le benchmark global Me&YouToo. Elles ne peuvent être ni modifiées, ni ajoutées, ni supprimées.':'';
      const headerAction=isGender?`<span class="socio-required-badge">${ro?'🔒 ':''}Genre · ${genderRequiredTheme()?'Obligatoire':'Facultatif · libellés figés'}</span>${!genderRequiredTheme()&&!ro&&criterionStructureEditable?`<button class="button button-danger-soft" type="button" data-socio-remove="${i}" ${socio.length<=1&&!optionalMinorityTheme()?'disabled':''}>Supprimer le critère</button>`:''}`:ro?'<span class="socio-required-badge">🔒 Lecture seule</span>':criterionStructureEditable?`<button class="button button-danger-soft" type="button" data-socio-remove="${i}" ${socio.length<=1&&!optionalMinorityTheme()?'disabled':''}>Supprimer le critère</button>`:'';
      const referenceLocale=normalizeLocale(socioReference().locale),otherLanguage=!ro&&!structureEditable&&Boolean(referenceLocale)&&referenceLocale!==normalizeLocale(socioContextLocale);
      const structureRedirect=otherLanguage?`<div class="socio-translation-structure-note" role="note">🔒 Cette donnée est commune à toutes les langues. Pour la retirer du diagnostic ou modifier sa structure, ouvrez sa version ${esc(localeLabel(referenceLocale))} (${esc(referenceLocale.toUpperCase())}). ${isAge?'Les tranches d’âge restent non modifiables pour le benchmark.':''}<button type="button" class="button button-secondary button-small socio-open-reference-criterion" data-socio-open-reference="${i}">← Gérer cette donnée d’analyse en ${esc(localeLabel(referenceLocale))}</button></div>`:'';
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
          ${structureRedirect}
          ${isAdminReview()?`<div data-admin-socio-review="${i}">${renderSocioAdminReview(i)}</div>`:''}
          <div class="socio-translation-compare ${referenceCriterionFor(criterion,i)?'has-reference':''}">
            ${renderSocioReference(criterion,i)}
            <div class="socio-current-editor"><div class="socio-current-head"><strong>Version répondant · ${esc(localeLabel(socioContextLocale))}</strong><span class="status-pill">${esc(String(socioContextLocale).toUpperCase())}</span></div>${translationMode&&!ro?'<div class="socio-translation-structure-note">La structure se modifie dans la langue de référence. Ici, vous traduisez uniquement les libellés existants.</div>':''}
              <div class="socio-card-head"><span class="socio-number socio-number-spacer" aria-hidden="true"></span><div class="field socio-question"><label>Question posée aux répondants ${locked?'<span class="socio-lock-badge">🔒 Figé</span>':''}${isAge?'<span class="socio-age-info" title="Les tranches d’âge sont standardisées afin de permettre la comparaison de vos résultats avec le benchmark global Me&YouToo." aria-label="Information benchmark âge">i</span>':''}</label><input data-tree-q="${path}" value="${esc(criterion.q)}" placeholder="Saisissez votre question" ${locked?'readonly tabindex="-1"':''}>${locked?`<span class="socio-lock-help">${lockText}</span>`:''}</div><span></span></div>
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
    if(isLegacyClientCampaign())return;
    storeActiveSocio();
    const active=normalizeLocale(socioContextLocale),snapshot=clone(socio);
    for(const loc of projectLocales()){
      const n=normalizeLocale(loc);if(n===active)continue;
      if(!Array.isArray(socioLanguageVariants[n])||!socioLanguageVariants[n].length)socioLanguageVariants[n]=localizeStandardCriteria(clone(snapshot),n);
    }
  }
  function translationTodoPaths(locale){const st=reviewState(),loc=normalizeLocale(locale);return Array.isArray(st.todo[loc])?st.todo[loc]:[];}
  function setTranslationTodoPaths(locale,paths){const st=reviewState(),loc=normalizeLocale(locale);st.todo[loc]=[...new Set(paths||[])];}
  function clearTranslationTodoPath(locale,path){const st=reviewState(),loc=normalizeLocale(locale),rows=translationTodoPaths(loc).filter(x=>x!==path);if(rows.length)st.todo[loc]=rows;else delete st.todo[loc];if(st.baselines.socio?.[loc])delete st.baselines.socio[loc][path];}
  function isTranslationTodo(locale,path){return translationTodoPaths(locale).includes(path);}
  // Compter les champs vivants, jamais la longueur des anciens marqueurs.
  function socioTranslationStatus(locale){
    if(isLegacyClientCampaign())return {todoPaths:[],reviewPaths:[]};
    const loc=normalizeLocale(locale),current=normalizeLocale(socioContextLocale),ref=socioReference();
    const reference=normalizeLocale(ref.locale)===current?socio:ref.items||[];
    const rows=loc===current?socio:socioForLocale(loc)||[],fields=new Map(),aliases=new Map();
    const visit=(criterion,source,path)=>{
      const add=(key,text,alias)=>{const field={key,text:String(text||'')};fields.set(key,field);aliases.set(key,field);if(alias)aliases.set(alias,field);};
      add(`q:${path}`,criterion?.q);
      const options=criterion?.opts||[],sourceOptions=source?.opts||[];
      for(let j=0;j<Math.max(options.length,sourceOptions.length);j++){
        const option=options[j],sourceOption=sourceOptions[j],key=String(sourceOption?.source_id??option?.source_id??`i${j}`);
        add(`o:${path}:${key}`,option?.label,`o:${path}:${String(option?.source_id??`i${j}`)}`);
        const children=option?.subcriteria||[],sourceChildren=sourceOption?.subcriteria||[];
        for(let k=0;k<Math.max(children.length,sourceChildren.length);k++)visit(children[k],sourceChildren[k],`${path}.${j}.${k}`);
      }
    };
    // Same structural positions as the readiness check: translated text is
    // not an identity key, and older copies may have no source_id.
    Array.from({length:Math.max(reference.length,rows.length)}).forEach((_,i)=>{
      const source=reference[i],criterion=rows[i],key=criterionKey(source||criterion,i);visit(criterion,source,key);
      const targetKey=criterionKey(criterion,i);
      if(targetKey!==key){aliases.set(`q:${targetKey}`,fields.get(`q:${key}`));(criterion?.opts||[]).forEach((option,j)=>aliases.set(`o:${targetKey}:${String(option?.source_id??`i${j}`)}`,aliases.get(`o:${key}:${String(source?.opts?.[j]?.source_id??option?.source_id??`i${j}`)}`)));}
    });
    const todoPaths=[...fields.values()].filter(field=>unfilledSocioText(field.text,field.key.startsWith('q:'))).map(field=>field.key),todo=new Set(todoPaths);
    const reviewPaths=[...new Set((Array.isArray(reviewState().socio[loc])?reviewState().socio[loc]:[]).map(path=>aliases.get(path)?.key).filter(path=>path&&!todo.has(path)))];
    return {todoPaths,reviewPaths};
  }
  // Les références d’objets servent uniquement à remapper les alertes après retrait.
  function captureSocioAlertPaths(){
    if(isLegacyClientCampaign())return null;
    return projectLocales().map(locale=>{
      const loc=normalizeLocale(locale),rows=loc===normalizeLocale(socioContextLocale)?socio:socioLanguageVariants[loc]||[];
      return {locale:loc,roots:rows.map((criterion,i)=>({criterion,key:criterionKey(criterion,i),options:(criterion.opts||[]).map((option,j)=>({option,key:String(option.source_id??`i${j}`)}))}))};
    });
  }
  function rebaseSocioAlerts(snapshot){
    if(!snapshot)return;
    const st=reviewState();
    for(const {locale,roots} of snapshot){
      const rows=locale===normalizeLocale(socioContextLocale)?socio:socioLanguageVariants[locale]||[],paths=new Map();
      for(const root of roots){
        const index=rows.indexOf(root.criterion);if(index<0)continue;
        const key=criterionKey(root.criterion,index);paths.set(`q:${root.key}`,`q:${key}`);
        for(const {option,key:oldKey} of root.options){const j=root.criterion.opts.indexOf(option);if(j>=0)paths.set(`o:${root.key}:${oldKey}`,`o:${key}:${String(option.source_id??`i${j}`)}`);}
      }
      for(const group of ['todo','socio'])if(Array.isArray(st[group][locale]))st[group][locale]=[...new Set(st[group][locale].map(path=>paths.get(path)).filter(Boolean))];
      const before=st.baselines.socio[locale];if(before)st.baselines.socio[locale]=Object.fromEntries(Object.entries(before).filter(([path])=>paths.has(path)).map(([path,value])=>[paths.get(path),value]));
    }
  }
  function translationCounts(locale){const status=socioTranslationStatus(locale);return {todo:status.todoPaths.length,review:status.reviewPaths.length};}
  function markNewTranslationPaths(locale,paths,sourceLocale,sourceCriteria){
    const st=reviewState(),loc=normalizeLocale(locale),todo=[...new Set([...translationTodoPaths(loc),...paths])];st.todo[loc]=todo;
    const review=Array.isArray(st.socio[loc])?st.socio[loc]:[];st.socio[loc]=review.filter(path=>!todo.includes(path));
    st.baselines.socio[loc]=st.baselines.socio[loc]&&typeof st.baselines.socio[loc]==='object'?st.baselines.socio[loc]:{};
    for(const path of paths)delete st.baselines.socio[loc][path];
  }
  // Les suggestions Me&YouToo ont déjà des traductions validées. Ne retirer que
  // leurs faux statuts de révision, sans toucher aux alertes sur les DSD personnalisées.
  function clearStandardSuggestionReview(){
    if(isLegacyClientCampaign())return;
    const reference=socioReference(),refLoc=normalizeLocale(reference.locale),items=reference.items||[];
    const st=reviewState();
    items.forEach((criterion,index)=>{
      const kind=isAgeCriterion(criterion)?'age':null;
      const matchIndex=kind?null:EXAMPLE_TRANSLATIONS[refLoc]?.findIndex((entry,i)=>{
        const expected=suggestedCriterion(i,refLoc);
        return criterion.q===expected.q&&criterion.opts?.length===expected.opts.length&&criterion.opts.every((o,j)=>o.label===expected.opts[j].label);
      });
      if(!kind&&(matchIndex===null||matchIndex<0))return;
      const template=kind?ageForLocale(refLoc):suggestedCriterion(matchIndex,refLoc);
      if(criterion.q!==template.q||criterion.opts?.length!==template.opts.length||!criterion.opts.every((o,j)=>o.label===template.opts[j].label))return;
      for(const loc of projectLocales()){
        const n=normalizeLocale(loc);
        if(n===refLoc)continue;
        const target=socioLanguageVariants[n]?.[index];
        const expected=kind?ageForLocale(n):suggestedCriterion(matchIndex,n);
        if(!target||target.q!==expected.q||target.opts?.length!==expected.opts.length||!target.opts.every((o,j)=>o.label===expected.opts[j].label))continue;
        const paths=new Set(pathsForCriterion(criterion,index));
        if(Array.isArray(st.socio[n]))st.socio[n]=st.socio[n].filter(path=>!paths.has(path));
        if(Array.isArray(st.todo[n]))st.todo[n]=st.todo[n].filter(path=>!paths.has(path));
        for(const path of paths)if(st.baselines.socio[n])delete st.baselines.socio[n][path];
      }
    });
  }
  function pathsForCriterion(criterion,index){const key=criterionKey(criterion,index),paths=[`q:${key}`];(criterion?.opts||[]).forEach((o,j)=>paths.push(`o:${key}:${String(o?.source_id??`i${j}`)}`));return paths;}
  function blankCriterion(c){const x=clone(c||{});x.q='';x.opts=(x.opts||[]).map(o=>({...o,label:'',subcriteria:(o.subcriteria||[]).map(child=>blankCriterion(child))}));return x;}
  function propagateRootCriterionAdd(criterion,index){if(isLegacyClientCampaign())return;
    const sourceLocale=normalizeLocale(socioContextLocale),sourceSnapshot=clone(socio),blank=clone(criterion);
    blank.q='';blank.opts=(blank.opts||[]).map(o=>({...o,label:'',subcriteria:(o.subcriteria||[]).map(c=>blankCriterion(c))}));
    for(const loc of projectLocales()){
      const n=normalizeLocale(loc);if(n===sourceLocale)continue;
      const rows=Array.isArray(socioLanguageVariants[n])?socioLanguageVariants[n]:(socioLanguageVariants[n]=[]);
      rows.splice(index,0,clone(blank));markNewTranslationPaths(n,pathsForCriterion(criterion,index),sourceLocale,sourceSnapshot);
    }
  }
  function propagateRootCriterionRemove(index){if(isLegacyClientCampaign())return;const reference=clone(socio),removedCriterion=reference[index];for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(socioContextLocale))continue;const rows=socioLanguageVariants[n];if(!Array.isArray(rows))continue;const targetIndex=matchingIndexByKey(removedCriterion,rows,index,criterionStructureKey);if(targetIndex>=0)rows.splice(targetIndex,1);}}
  function propagateCriterionMultiple(criterionPath,multiple){if(isLegacyClientCampaign())return;
    const reference=clone(socio);
    for(const loc of projectLocales()){
      const n=normalizeLocale(loc);if(n===normalizeLocale(socioContextLocale))continue;
      const resolved=resolveCriterionPathInTarget(reference,socioLanguageVariants[n],criterionPath),targetCriterion=resolved?.criterion;
      if(!targetCriterion)continue;
      if(multiple)targetCriterion.multiple=true;else delete targetCriterion.multiple;
    }
  }
  function newSharedSocioId(){return `studio-dsd-${window.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;}
  function sharedSocioNode(node,kind,sourceLocale,following=false){
    const result=clone(node);
    if(!stableSourceId(result))result.source_id=newSharedSocioId();
    if(isLegacyClientCampaign()){
      result.studio_dsd_reference_locale=sourceLocale;
      if(following)result.studio_dsd_reference_fields=[kind==='criterion'?'q':'label'];
    }
    if(kind==='criterion')result.opts=(result.opts||[]).map(answer=>sharedSocioNode(answer,'option',sourceLocale,following));
    else result.subcriteria=(result.subcriteria||[]).map(child=>sharedSocioNode(child,'criterion',sourceLocale,following));
    return result;
  }
  function socioAddPlans(){
    if(isSocioReadOnly()||!isSocioReferenceLocale())throw new Error('La structure se modifie dans la langue de référence autorisée.');
    const sourceLocale=normalizeLocale(socioContextLocale),locales=[...new Set(projectLocales().map(normalizeLocale).filter(Boolean))];
    if(!locales.includes(sourceLocale))throw new Error('Cette langue ne fait pas partie du périmètre de la campagne.');
    return locales.map(locale=>{
      const active=locale===sourceLocale;let rows=active?socio:socioLanguageVariants[locale];
      if(!Array.isArray(rows))throw new Error(`Les données ${localeLabel(locale)} manquent. Rechargez la campagne avant de recommencer. Aucun ajout n’a été effectué.`);
      return {locale,rows,active};
    });
  }
  function countSocioNodes(rows){let count=0;for(const criterion of rows||[]){count++;for(const option of criterion.opts||[])count+=countSocioNodes(option.subcriteria||[]);}return count;}
  function translatedSocioAddCopy(source,template){
    const result=clone(source);
    if(!template||result.opts.length!==(template.opts||[]).length)throw new Error('La suggestion n’a pas la même structure dans toutes les langues. Aucun ajout n’a été effectué.');
    result.q=String(template.q||'');
    result.opts.forEach((option,index)=>{option.label=String(template.opts[index].label||'');});
    return result;
  }
  function multilingualSocioAdd(kind,path='',template=null,translatedTemplate=null){
    const plans=socioAddPlans(),reference=clone(socio),sourceLocale=normalizeLocale(socioContextLocale);
    const [criterionPath,optionIndex]=String(path).split('|');
    const parent=kind==='root'?null:getCriterionByPath(criterionPath);
    if(kind!=='root'&&!parent)throw new Error('Question parente introuvable. Aucun ajout n’a été effectué.');
    const sourceOption=kind==='child'?parent.opts?.[Number(optionIndex)]:null;
    if(kind==='child'&&!sourceOption)throw new Error('Réponse parente introuvable. Aucun ajout n’a été effectué.');
    if(kind==='child'&&(String(criterionPath).split('.').length+1)/2+1>12)throw new Error('La structure ne peut pas dépasser douze niveaux.');
    // Resolve every destination and check all limits before changing any language.
    for(const plan of plans){
      if(kind==='root'){
        if(plan.rows.length>=20)throw new Error(`Vingt critères sont déjà présents en ${localeLabel(plan.locale)}. Aucun ajout n’a été effectué.`);
        plan.destination=plan.rows;
      }else{
        const target=plan.active?parent:resolveCriterionPathInTarget(reference,plan.rows,criterionPath)?.criterion;
        if(!target)throw new Error(`La question correspondante manque en ${localeLabel(plan.locale)}. Aucun ajout n’a été effectué.`);
        if(kind==='option'){
          if(!Array.isArray(target.opts)||target.opts.length>=50)throw new Error(`La question est absente ou contient déjà cinquante réponses en ${localeLabel(plan.locale)}. Aucun ajout n’a été effectué.`);
          plan.destination=target.opts;
        }else{
          const index=plan.active?Number(optionIndex):matchingIndexByKey(sourceOption,target.opts,Number(optionIndex),optionStructureKey);
          const option=target.opts?.[index];
          if(!option)throw new Error(`La réponse parente manque en ${localeLabel(plan.locale)}. Aucun ajout n’a été effectué.`);
          plan.parentOption=option;plan.destination=Array.isArray(option.subcriteria)?option.subcriteria:[];
        }
      }
      if(kind!=='option'&&countSocioNodes(plan.rows)>=1000)throw new Error(`La limite de sous-critères est atteinte en ${localeLabel(plan.locale)}. Aucun ajout n’a été effectué.`);
    }
    const item=sharedSocioNode(template||(kind==='option'?{label:'',n:0,subcriteria:[]}:newSubcriterion()),kind==='option'?'option':'criterion',sourceLocale);
    const copies=plans.map(plan=>plan.active?item:translatedTemplate?translatedSocioAddCopy(item,translatedTemplate(plan.locale)):isLegacyClientCampaign()?sharedSocioNode(item,kind==='option'?'option':'criterion',sourceLocale,true):kind==='option'?{...clone(item),label:''}:blankCriterion(item));
    for(let i=0;i<plans.length;i++){
      const plan=plans[i];if(plan.parentOption)plan.parentOption.subcriteria=plan.destination;
      plan.destination.push(copies[i]);if(!plan.active)socioLanguageVariants[plan.locale]=plan.rows;
    }
    if(!isLegacyClientCampaign()&&kind==='root'&&!String(item.q||'').trim()){
      const index=socio.length-1,paths=pathsForCriterion(item,index);
      for(const plan of plans)markNewTranslationPaths(plan.locale,paths,sourceLocale,socio);
    }
    return item;
  }
  function syncAddedSocioText(item,field,value){
    if(!isAdminLegacySocio())return;
    const id=String(item?.source_id||''),compatibility=id.startsWith('studio-orange382-')&&isOrange382Project(project);
    const sourceLocale=normalizeLocale(item?.studio_dsd_reference_locale||(compatibility?'en':''));
    if(!sourceLocale||(!id.startsWith('studio-dsd-')&&!compatibility))return;
    const marker=compatibility?'studio_orange382_reference_fields':'studio_dsd_reference_fields';
    if(normalizeLocale(socioContextLocale)!==sourceLocale){
      if(Array.isArray(item[marker]))item[marker]=item[marker].filter(key=>key!==field);
      return;
    }
    const visit=rows=>{for(const criterion of rows||[]){
      if(field==='q'&&String(criterion.source_id)===id&&criterion[marker]?.includes(field))criterion[field]=value;
      for(const answer of criterion.opts||[]){
        if(field==='label'&&String(answer.source_id)===id&&answer[marker]?.includes(field))answer[field]=value;
        visit(answer.subcriteria||[]);
      }
    }};
    for(const locale of projectLocales()){const loc=normalizeLocale(locale);if(loc!==sourceLocale)visit(socioLanguageVariants[loc]);}
  }
  async function showSocioAddError(error){await window.StudioModal.alert({title:'Ajout multilingue impossible',message:error.message,type:'error',confirmLabel:'Fermer'});}
  function propagateOptionAdd(criterionPath,option){if(isLegacyClientCampaign())return;
    const sourceLocale=normalizeLocale(socioContextLocale),sourceSnapshot=clone(socio),rootIndex=Number(String(criterionPath).split('.')[0]);
    for(const loc of projectLocales()){
      const n=normalizeLocale(loc);if(n===sourceLocale)continue;const criterion=criterionByPathIn(socioLanguageVariants[n],criterionPath);if(!criterion)continue;
      criterion.opts=Array.isArray(criterion.opts)?criterion.opts:[];criterion.opts.push({...clone(option),label:''});markNewTranslationPaths(n,pathsForCriterion(sourceSnapshot[rootIndex],rootIndex),sourceLocale,sourceSnapshot);
    }
  }
  function propagateOptionRemove(criterionPath,index){if(isLegacyClientCampaign())return;const reference=clone(socio),refCriterion=criterionByPathIn(reference,criterionPath),removedOption=refCriterion?.opts?.[Number(index)];for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(socioContextLocale))continue;const resolved=resolveCriterionPathInTarget(reference,socioLanguageVariants[n],criterionPath),targetCriterion=resolved?.criterion;if(!targetCriterion||!Array.isArray(targetCriterion.opts))continue;const targetIndex=matchingIndexByKey(removedOption,targetCriterion.opts,Number(index),optionStructureKey);if(targetIndex>=0)targetCriterion.opts.splice(targetIndex,1);}}
  function propagateChildAdd(optionPath,child){if(isLegacyClientCampaign())return;for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(socioContextLocale))continue;const option=optionByPathIn(socioLanguageVariants[n],optionPath);if(!option)continue;option.subcriteria=Array.isArray(option.subcriteria)?option.subcriteria:[];option.subcriteria.push(clone(child));}}
  function propagateChildRemove(path){if(isLegacyClientCampaign())return;const info=criterionParentInfo(path);if(!info)return;const reference=clone(socio),removedCriterion=criterionByPathIn(reference,path);for(const loc of projectLocales()){const n=normalizeLocale(loc);if(n===normalizeLocale(socioContextLocale))continue;const parentResolved=resolveCriterionPathInTarget(reference,socioLanguageVariants[n],info.parentPath),targetParent=parentResolved?.criterion;if(!targetParent)continue;const refParent=criterionByPathIn(reference,info.parentPath),refOption=refParent?.opts?.[info.optionIndex],targetOptionIndex=matchingIndexByKey(refOption,targetParent.opts||[],info.optionIndex,optionStructureKey),targetOption=targetParent.opts?.[targetOptionIndex],children=targetOption?.subcriteria;if(!Array.isArray(children))continue;const targetChildIndex=matchingIndexByKey(removedCriterion,children,info.childIndex,criterionStructureKey);if(targetChildIndex>=0)children.splice(targetChildIndex,1);}}
  function bindSocio(){
    document.querySelectorAll('[data-socio-root-toggle]').forEach(el=>el.onclick=()=>{const path=el.dataset.socioRootToggle;socioOpenRoots.has(path)?socioOpenRoots.delete(path):socioOpenRoots.add(path);renderSocio();});
    document.querySelectorAll('[data-socio-open-reference]').forEach(el=>el.onclick=()=>{const index=Number(el.dataset.socioOpenReference),refLoc=normalizeLocale(socioReference().locale);if(!Number.isInteger(index)||index<0||!refLoc)return;storeActiveLanguageContent();activateLanguage(refLoc);socioOpenRoots.add(String(index));renderSocioContext();renderSocio();scheduleAutosave(0);requestAnimationFrame(()=>document.querySelector(`[data-socio-root-toggle="${index}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}));});
    document.querySelectorAll('[data-socio-branch-toggle]').forEach(el=>el.onclick=()=>{const path=el.dataset.socioBranchToggle;socioOpenBranches.has(path)?socioOpenBranches.delete(path):socioOpenBranches.add(path);renderSocio();});
    document.querySelector('[data-socio-collapse-all]')?.addEventListener('click',()=>{socioOpenRoots.clear();socioOpenBranches.clear();renderSocio();});
    document.querySelector('[data-socio-expand-all]')?.addEventListener('click',()=>{socioOpenRoots.clear();socioOpenBranches.clear();socio.forEach((c,i)=>{const root=String(i);socioOpenRoots.add(root);const visit=(criterion,path)=>{(criterion.opts||[]).forEach((o,j)=>(o.subcriteria||[]).forEach((child,k)=>{const childPath=`${path}.${j}.${k}`;socioOpenBranches.add(childPath);visit(child,childPath);}));};visit(c,root);});renderSocio();});
    if(isSocioReadOnly())return;
    document.querySelectorAll('[data-tree-q]').forEach(el=>el.oninput=()=>{const criterion=getCriterionByPath(el.dataset.treeQ);if(criterion){syncAddedSocioText(criterion,'q',el.value);criterion.q=el.value;const root=Number(String(el.dataset.treeQ).split('.')[0]),key=criterionKey(socio[root],root),path=`q:${key}`;if(String(el.value||'').trim())clearTranslationTodoPath(socioContextLocale,path);scheduleAutosave();renderSocioContext();}});
    document.querySelectorAll('[data-tree-label]').forEach(el=>el.oninput=()=>{const option=getOptionByPath(el.dataset.treeLabel);if(option){syncAddedSocioText(option,'label',el.value);option.label=el.value;const root=Number(String(el.dataset.treeLabel).split('.')[0]),key=criterionKey(socio[root],root),idx=Number(String(el.dataset.treeLabel).split('|').pop()),ref=socioReference().items?.[root],optKey=String(ref?.opts?.[idx]?.source_id??`i${idx}`),path=`o:${key}:${optKey}`;if(String(el.value||'').trim())clearTranslationTodoPath(socioContextLocale,path);scheduleAutosave();renderSocioContext();}});
    document.querySelectorAll('[data-tree-n]').forEach(el=>el.oninput=()=>{const option=getOptionByPath(el.dataset.treeN);if(option){option.n=Number(el.value)||0;updateOptionVisual(el);scheduleAutosave();}});
    document.querySelectorAll('[data-tree-multiple]').forEach(el=>el.onclick=()=>{if(isSocioReadOnly()||!isSocioReferenceLocale())return;ensureAllLocaleSocioVariants();const path=el.dataset.treeMultiple,criterion=getCriterionByPath(path);if(!criterion)return;criterion.multiple=!criterion.multiple;propagateCriterionMultiple(path,criterion.multiple);renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-socio-remove]').forEach(el=>el.onclick=()=>{ensureAllLocaleSocioVariants();const index=+el.dataset.socioRemove;if(isGenderCriterion(socio[index])&&genderRequiredTheme())return;const alerts=captureSocioAlertPaths();propagateRootCriterionRemove(index);socio.splice(index,1);rebaseSocioAlerts(alerts);if(alerts)storeActiveSocio(true);renderSocioContext();renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-tree-option-remove]').forEach(el=>el.onclick=()=>{ensureAllLocaleSocioVariants();const [criterionPath,index]=el.dataset.treeOptionRemove.split('|'),criterion=getCriterionByPath(criterionPath);if(isGenderCriterion(criterion)&&!optionalGenderAnswer(criterion?.opts?.[Number(index)]))return;const alerts=captureSocioAlertPaths();propagateOptionRemove(criterionPath,index);criterion?.opts?.splice(Number(index),1);rebaseSocioAlerts(alerts);if(alerts)storeActiveSocio(true);renderSocioContext();renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-tree-option-add]').forEach(el=>el.onclick=async()=>{try{multilingualSocioAdd('option',el.dataset.treeOptionAdd);renderSocio();scheduleAutosave(0);}catch(error){await showSocioAddError(error);}});
    document.querySelectorAll('[data-tree-child-add]').forEach(el=>el.onclick=async()=>{try{const optionPath=el.dataset.treeChildAdd;multilingualSocioAdd('child',optionPath);const [parent,index]=optionPath.split('|'),option=getOptionByPath(optionPath);openSocioPath(`${parent}.${index}.${option.subcriteria.length-1}`);renderSocio();scheduleAutosave(0);}catch(error){await showSocioAddError(error);}});
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
function unfilledSocioText(value,question=false){
  const text=String(value??'').trim();
  return !text||(question?/^Nouvelle donnée(?: personnalisée)?$/i.test(text):/^(?:(?:Sous[- ]?)?réponse\s*\d+|Nouvelle (?:sous[- ]?)?réponse)$/i.test(text));
}
function incompleteSocioLocale(items,reference=[],allowEmpty=false){
  if(allowEmpty&&Array.isArray(items)&&!items.length&&!reference.length)return null;
  const options=c=>Array.isArray(c?.opts)?c.opts:Array.isArray(c?.options)?c.options:[];
  const children=o=>Array.isArray(o?.subcriteria)?o.subcriteria:o?.subcriterion?[o.subcriterion]:[];
  const issue=(path,field,message)=>({path,field,message});
  let count=0;
  const walk=(rows,refs,parent='',depth=1)=>{
    if(depth>12)return issue(parent,'question','La structure dépasse douze niveaux.');
    if(!Array.isArray(rows))rows=[];
    if(!rows.length&&!refs.length)return parent?'':issue('','add','Ajoutez au moins une donnée d’analyse.');
    for(let i=0;i<Math.max(rows.length,refs.length);i++){
      if(++count>1000)return issue(parent,'question','La structure des données d’analyse est trop volumineuse.');
      const c=rows[i],ref=refs[i],path=parent?`${parent}.${i}`:String(i);
      const q=String(c?.q??c?.question??c?.label??'').trim();
      if(unfilledSocioText(q,true)||q.length>500)return issue(path,'question','Renseignez la question dans cette langue.');
      const opts=options(c),refOpts=options(ref);
      if(opts.length<2||opts.length>50)return issue(path,'options','Chaque question doit comporter entre deux et cinquante réponses.');
      for(let j=0;j<Math.max(opts.length,refOpts.length);j++){
        const option=opts[j],refOption=refOpts[j];
        if(unfilledSocioText(option?.label)||String(option?.label??'').length>250)return issue(`${path}|${j}`,'answer','Renseignez cette réponse dans cette langue.');
        const nested=walk(children(option),children(refOption),`${path}.${j}`,depth+1);if(nested)return nested;
      }
      if(ref&&opts.length!==refOpts.length)return issue(path,'options','Les mêmes réponses doivent être présentes dans toutes les langues actives.');
      if(!ref&&refs.length)return issue(path,'question','Les mêmes questions doivent être présentes dans toutes les langues actives.');
    }
    if(depth>1&&rows.length!==refs.length)return issue(parent.slice(0,parent.lastIndexOf('.')),'question','Les mêmes sous-questions doivent être présentes dans toutes les langues actives.');
    return null;
  };
  if(Array.isArray(items)&&items.length>20)return issue('','add','Les données d’analyse sont limitées à vingt critères.');
  return walk(items,reference);
}
  function incompleteSociodemo(){
    if(isLegacyClientCampaign())return [];
    const ref=socioReference(),current=normalizeLocale(socioContextLocale),reference=normalizeLocale(ref.locale)===current?socio:ref.items||[];
    return projectLocales().flatMap(locale=>{
      const loc=normalizeLocale(locale),rows=loc===current?socio:socioForLocale(loc),issue=incompleteSocioLocale(rows,reference,optionalMinorityTheme());
      if(!issue)return [];
      const selector=issue.field==='question'?`input[data-tree-q="${issue.path}"]`:issue.field==='answer'?`input[data-tree-label="${issue.path}"]`:`button[data-tree-option-add="${issue.path}"]`;
      return [{id:issue.field==='add'?'add-socio':'socio-list',title:`Donnée d’analyse à compléter · ${localeLabel(loc)} (${loc.toUpperCase()})`,message:issue.message,locale:loc,socio:issue.field!=='add',selector,prepareSocio:true}];
    });
  }
  // Une langue peut manquer une branche entière dans un ancien brouillon.
  // Créer uniquement ses champs vides permet de guider vers la traduction manquante.
  function fillMissingSocioStructure(rows,reference){
    const target=clone(Array.isArray(rows)?rows:[]);
    if(isLegacyClientCampaign())return target;
    for(const ref of reference||[]){
      let criterion=uniqueSocioMatch(ref,target);
      if(!criterion){target.push(blankCriterion(ref));continue;}
      criterion.opts=Array.isArray(criterion.opts)?criterion.opts:[];
      for(const option of ref.opts||[]){
        const id=stableSourceId(option),candidates=criterion.opts.filter(o=>id?stableSourceId(o)===id:comparableSocioText(o.label)===comparableSocioText(option.label));
        if(candidates.length!==1){criterion.opts.push({...clone(option),label:'',subcriteria:(option.subcriteria||[]).map(blankCriterion)});continue;}
        const current=candidates[0];current.subcriteria=fillMissingSocioStructure(current.subcriteria||[],option.subcriteria||[]);
      }
    }
    return orderNativeSocioRows(reference,target);
  }
  function incompleteIntroductions(){
    if(isLegacyClientCampaign()){const text=$('intro').value;return text.trim()&&normalizeIntro(text)!==normalizeIntro(referenceIntro)?[]:[socioContextLocale];}
    return projectLocales().filter(locale=>{
      const loc=normalizeLocale(locale),text=loc===normalizeLocale(socioContextLocale)?$('intro').value:introForLocale(loc),reference=introReferenceVariants[loc]??(loc==='fr'?referenceIntro:'');
      return !normalizeIntro(text)||(Boolean(normalizeIntro(reference))&&normalizeIntro(text)===normalizeIntro(reference));
    });
  }
  function settingsReadiness(){const intro=$('intro').value.trim(),launch=$('launch-date').value,close=$('close-date').value,shareUrl=currentDiffusionUrl(),diffusionReady=isLegacyClientCampaign()?true:Boolean(slugify($('diffusion-slug')?.value||''));return{introChanged:incompleteIntroductions().length===0,launchFilled:Boolean(launch),closeFilled:Boolean(close),diffusionReady,shareUrl,intro,launch,close};}
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
    badge.title=state==='error'&&lastAutosaveError?'Non enregistré : '+lastAutosaveError:state==='saved'?'Enregistré automatiquement':state==='saving'?'Enregistrement en cours':state==='pending'?'Enregistrement en attente':state==='error'?"Échec de l’enregistrement automatique":'';
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
  function introductionSettingsForSave(primary,current){
    if(!isLegacyClientCampaign())return {introductionHtml:current,introductionVariants:activeLanguageVariants(introVariants)};
    if(currentUser.role!=='admin')return {introductionHtml:project.introduction_html,introductionVariants:project.introduction_variants};
    const variants={...(project.introduction_variants||{}),...introVariants};
    return {introductionHtml:Object.hasOwn(variants,primary)?variants[primary]:project.introduction_html,introductionVariants:variants};
  }
  function autosavePayload(){
    storeActiveLanguageContent();
    const primaryLocale=normalizeLocale(project?.selected_locale||(Array.isArray(project?.locales)&&project.locales[0])||'fr');
    const currentIntro=String($('intro')?.value||'').trim();
    const introductionHtml=reviewPrimaryIntroForSave(primaryLocale,currentIntro);
    const rawRespondents=String($('nb-respondents')?.value||'').trim();
    return {
      campaignName:String($('campaign-name')?.value||'').trim(),
      respondentTitle:String($('respondent-title')?.value||'').trim(),
      ...introductionSettingsForSave(primaryLocale,introductionHtml),
      launchDate:String($('launch-date')?.value||'').trim()||null,
      closeDate:String($('close-date')?.value||'').trim()||null,
      nbRespondents:rawRespondents?Number(rawRespondents):null,
      sociodemo:isAdminLegacySocio()?undefined:(Array.isArray(project?.sociodemo)?project.sociodemo:socio),
      sociodemoLanguageVariants:isAdminLegacySocio()?undefined:(isLegacyClientCampaign()?project.sociodemo_language_variants:activeLanguageVariants(socioLanguageVariants)),
      translationReviewState:isLegacyClientCampaign()?project.translation_review_state:reviewState(),
      communicationShareUrl:currentDiffusionUrl()||null
    };
  }
  function autosaveFingerprint(payload){try{return JSON.stringify(isAdminLegacySocio()?[payload,socioLanguageVariants]:payload);}catch(_){return String(Date.now());}}
  async function autosaveNow(){
    if(!autosaveEnabled||isReadOnly()||!projectId)return true;
    if(autosaveInFlight){autosavePending=true;await autosaveInFlight;if(autosavePending){autosavePending=false;return autosaveNow();}return true;}
    const payload=autosavePayload(),fingerprint=autosaveFingerprint(payload);
    if(fingerprint===lastSavedFingerprint){renderDiffusionSlugError();autosaveStatus('✓ Enregistré automatiquement','saved');settleAutosaveFields('saved');return true;}
    autosaveStatus('Enregistrement…','saving');
    autosaveInFlight=(async()=>{
      try{
        await saveLegacySocioChanges();
        const settingsFingerprint=JSON.stringify(payload);
        const data=isAdminLegacySocio()&&settingsFingerprint===lastSavedSettingsFingerprint?{}:await api(`/api/projects/${projectId}/settings/autosave`,{method:'PATCH',body:JSON.stringify(payload)});
        lastSavedSettingsFingerprint=settingsFingerprint;
        if(data?.project)project={...project,...data.project};
        lastSavedFingerprint=fingerprint;
        if(lastAutosaveError&&$('param-alert')?.textContent?.includes(lastAutosaveError))$('param-alert').hidden=true;
        lastAutosaveError='';
        renderDiffusionSlugError();
        autosaveStatus('✓ Enregistré automatiquement','saved');
        settleAutosaveFields('saved');
        return true;
      }catch(error){
        const message=String(error?.message||'').trim();
        lastAutosaveError=message||'Erreur serveur lors de l’enregistrement.';
        const slugTaken=error.code==='DIFFUSION_URL_TAKEN';
        if(slugTaken)renderDiffusionSlugError(lastAutosaveError,true);
        autosaveStatus('⚠ Non enregistré : '+(message||'erreur serveur'),'error');settleAutosaveFields('error');
        const alert=$('param-alert');if(alert&&!slugTaken){alert.hidden=false;alert.textContent='Modifications non enregistrées : '+lastAutosaveError;}
        return false;
      }finally{autosaveInFlight=null;}
    })();
    const ok=await autosaveInFlight;
    if(autosavePending){autosavePending=false;return autosaveNow();}
    return ok;
  }
  function scheduleAutosave(delay=700){
    renderSettingsReview();
    if(!autosaveEnabled||isReadOnly())return;
    clearTimeout(autosaveTimer);markAutosaveActiveField();autosaveStatus('Modifications en cours…','saving');
    autosaveTimer=setTimeout(()=>{autosaveTimer=null;autosaveNow();},delay);
  }
  async function flushAutosave(){clearTimeout(autosaveTimer);autosaveTimer=null;return autosaveNow();}
  function updateNextState(){const buttons=[$('param-next'),$('param-next-top')].filter(Boolean);if(!buttons.length)return;if(isReadOnly()){buttons.forEach(button=>{button.classList.remove('is-disabled');button.setAttribute('aria-disabled','false');button.dataset.ready='true';button.title='';button.textContent='Consulter la relecture →';});return;}const state=settingsReadiness(),ready=state.introChanged&&state.launchFilled&&state.closeFilled&&state.diffusionReady&&!incompleteSociodemo().length;buttons.forEach(button=>{button.classList.toggle('is-disabled',!ready);button.setAttribute('aria-disabled',String(!ready));button.dataset.ready=ready?'true':'false';button.title=ready?'':!state.introChanged?'Personnalisez l’introduction dans chaque langue active.':incompleteSociodemo().length?'Complétez les données d’analyse dans chaque langue active.':!state.diffusionReady?'Choisissez le slug de l’adresse de diffusion.':'Renseignez les deux dates avant de poursuivre.';});}
  function incompleteSocioSelector(criterion,path){
    if(!String(criterion?.q||'').trim())return `input[data-tree-q="${path}"]`;
    if(!Array.isArray(criterion.opts)||criterion.opts.length<2)return `button[data-tree-option-add="${path}"]`;
    for(let index=0;index<criterion.opts.length;index++){
      const option=criterion.opts[index];if(!String(option?.label||'').trim())return `input[data-tree-label="${path}|${index}"]`;
      for(let child=0;child<(option.subcriteria||[]).length;child++){const target=incompleteSocioSelector(option.subcriteria[child],`${path}.${index}.${child}`);if(target)return target;}
    }
    return '';
  }
  function missingSettings(){
    const state=settingsReadiness(),items=[];
    const add=(id,title,message,extra={})=>{if(!items.some(item=>item.id===id&&item.locale===extra.locale))items.push({id,title,message,...extra});};
    if(!$('campaign-name').value.trim())add('campaign-name','Nom de la campagne','Donnez un nom interne à votre campagne pour la retrouver facilement.');
    if(!$('respondent-title').value.trim())add('respondent-title','Titre visible par les répondants','Renseignez le titre qui sera affiché au début de l’autodiagnostic.');
    for(const locale of incompleteIntroductions())add('intro',`Introduction à personnaliser · ${localeLabel(locale)} (${locale.toUpperCase()})`,`Adaptez l’introduction en ${localeLabel(locale)} au contexte et à l’objectif de votre campagne. Chaque langue active doit être personnalisée avant la transmission.`,{locale});
    if(!state.diffusionReady)add('diffusion-slug','Adresse de diffusion','Choisissez la dernière partie de l’adresse de votre campagne. Votre lien sera ensuite préparé par Me&YouToo.');
    if(!state.launchFilled)add('launch-date','Date de lancement','Indiquez la date à laquelle vous souhaitez lancer la campagne.');
    else if(!isLegacyClientCampaign()&&!project?.review_mode&&state.launch<iso(5))add('launch-date','Date de lancement à corriger','Choisissez une date de lancement au minimum cinq jours après aujourd’hui.');
    if(!state.closeFilled)add('close-date','Date de clôture','Indiquez la date à laquelle la campagne doit se terminer.');
    else if(state.launchFilled&&state.close<=state.launch)add('close-date','Date de clôture à corriger','Choisissez une date de clôture postérieure à la date de lancement.');
    for(const field of $('settings-form').querySelectorAll('input,textarea,select')){
      if(!field.id||!field.willValidate||field.validity.valid||items.some(item=>item.id===field.id))continue;
      if(field.id==='launch-date'&&field.validity.rangeUnderflow&&(isLegacyClientCampaign()||project?.review_mode))continue;
      const label=({'diffusion-slug':'Adresse de diffusion','launch-date':'Date de lancement','close-date':'Date de clôture','nb-respondents':'Nombre de répondants estimé'})[field.id]||field.labels?.[0]?.textContent?.replace(/\s+/g,' ').trim()||'Champ à compléter';
      add(field.id,label,field.validationMessage||'Vérifiez la valeur de ce champ.');
    }
    if(!isLegacyClientCampaign())items.push(...incompleteSociodemo());
    else {
    if(!socio.length)add('add-socio','Données d’analyse','Ajoutez au moins une donnée d’analyse avant de transmettre la campagne.');
    else if(invalidSocio())add('socio-list','Donnée d’analyse à compléter','Chaque question et sous-question doit avoir un intitulé et au moins deux réponses renseignées.',{socio:true,selector:incompleteSocioSelector(socio.find(invalidCriterion),String(socio.findIndex(invalidCriterion)))});
    }
    resultResources.forEach((resource,index)=>{if(!resourceComplete(resource))add('resource-'+index,'Ressource à compléter',resource.type==='legacy_document'?`Rattachez le PDF « ${resource.legacyFilename||resource.title||'Document historique'} » avant de poursuivre.`:'Renseignez le titre de la ressource, puis une adresse web valide ou un fichier PDF.',{resourceIndex:index});});
    return items;
  }
  function focusSetting(item){
    if(item.id==='diffusion-slug'&&diffusionSlugError){renderDiffusionSlugError(diffusionSlugError,true);return;}
    if(item.prepareSocio){
      storeActiveLanguageContent();const reference=socioReference();
      socioLanguageVariants[normalizeLocale(item.locale)]=fillMissingSocioStructure(socioForLocale(item.locale),reference.items||[]);
      socioLanguageVariants[normalizeLocale(item.locale)].forEach((criterion,index)=>{if(isBlankAutoCriterion(criterion))markNewTranslationPaths(item.locale,pathsForCriterion(criterion,index),reference.locale,reference.items);});
      activateLanguage(item.locale);renderSocioContext();renderSocio();updateNextState();scheduleAutosave(0);
    }
    if(item.locale&&normalizeLocale(item.locale)!==normalizeLocale(socioContextLocale)){storeActiveLanguageContent();activateLanguage(item.locale);renderSocioContext();renderSocio();updateNextState();scheduleAutosave(0);}
    if(Number.isInteger(item.resourceIndex)){openResourceModal(item.resourceIndex);return;}
    if(item.socio){const path=item.selector?.match(/data-tree-(?:q|label|option-add)="([0-9.]+)/)?.[1];if(path){openSocioPath(path);renderSocio();}}
    let field=$(item.id);
    if(item.socio)field=field?.querySelector(item.selector)||field?.querySelector('input:not([readonly]),button');
    if(!field)return;
    for(let parent=field.parentElement;parent;parent=parent.parentElement){if(parent.tagName==='DETAILS')parent.open=true;}
    const previous=$('param-field-guidance');
    if(previous){document.querySelectorAll('[aria-describedby~="param-field-guidance"]').forEach(input=>{const ids=input.getAttribute('aria-describedby').split(/\s+/).filter(id=>id!=='param-field-guidance');if(ids.length)input.setAttribute('aria-describedby',ids.join(' '));else input.removeAttribute('aria-describedby');});previous.remove();}
    const hint=document.createElement('p');hint.id='param-field-guidance';hint.className='hint';hint.setAttribute('role','status');hint.textContent=item.message;hint.style.cssText='display:block;padding:12px 14px;border-radius:12px;background:#edf8fa;color:#124f61;margin:8px 0;';field.insertAdjacentElement('beforebegin',hint);
    field.setAttribute('aria-describedby',[field.getAttribute('aria-describedby'),hint.id].filter(Boolean).join(' '));
    if(!field.matches('input,textarea,select,button,a[href]'))field.setAttribute('tabindex','-1');
    field.focus({preventScroll:true});
    field.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
  }
  async function showMissingSettings(items){
    if(!items.length)return;
    const dialog=document.createElement('dialog');dialog.className='studio-modal';dialog.style.cssText='max-height:90vh;overflow:auto;';dialog.setAttribute('aria-labelledby','param-missing-title');dialog.setAttribute('aria-describedby','param-missing-description');
    dialog.innerHTML=`<div class="studio-modal-shell"><button class="studio-modal-close" type="button" aria-label="Fermer la fenêtre" data-missing-close>×</button><div class="studio-modal-icon" aria-hidden="true">✎</div><div class="studio-modal-copy"><p class="eyebrow">Avant la transmission</p><h2 id="param-missing-title">${items.length===1?'Un élément reste à compléter':'Quelques éléments restent à compléter'}</h2><p id="param-missing-description" class="studio-modal-message">Votre campagne n’a pas encore été transmise. Complétez les points suivants pour poursuivre. Choisissez un élément pour accéder directement au champ concerné.</p><div style="display:grid;gap:10px;margin-top:18px;">${items.map((item,index)=>`<button type="button" class="button button-secondary" data-missing-index="${index}" style="display:block;text-align:left;white-space:normal;height:auto;padding:14px 16px;"><strong style="display:block;margin-bottom:5px;">${esc(item.title)} <span aria-hidden="true">→</span></strong><span style="display:block;font-weight:400;line-height:1.5;">${esc(item.message)}</span></button>`).join('')}</div></div><div class="studio-modal-actions"><button class="button button-ghost" type="button" data-missing-close>Fermer</button><button class="button button-primary" type="button" data-missing-first autofocus>Compléter ${items.length===1?'cet élément':'le premier élément'} →</button></div></div>`;
    document.body.appendChild(dialog);
    document.body.classList.add('studio-modal-open');
    await new Promise(resolve=>{
      let selected=null;
      dialog.querySelectorAll('[data-missing-close]').forEach(button=>button.onclick=()=>dialog.close());
      dialog.querySelectorAll('[data-missing-index]').forEach(button=>button.onclick=()=>{selected=items[Number(button.dataset.missingIndex)];dialog.close();});
      dialog.querySelector('[data-missing-first]').onclick=()=>{selected=items[0];dialog.close();};
      dialog.addEventListener('close',()=>{document.body.classList.remove('studio-modal-open');dialog.remove();if(selected)requestAnimationFrame(()=>focusSetting(selected));resolve();},{once:true});
      dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
      dialog.showModal();
    });
  }
  function applyReadOnlyUI(){
    const alert=$('param-alert');alert.hidden=false;alert.dataset.tone='success';alert.innerHTML='<strong>🔒 Paramétrage en lecture seule.</strong> Cette campagne a déjà été transmise. <button class="button button-secondary button-small" type="button" data-content-adjustment="settings">Demander un ajustement</button>';
    document.querySelectorAll('#settings-form input,#settings-form textarea,#settings-form select').forEach(el=>{el.readOnly=true;el.setAttribute('aria-readonly','true');el.style.background='var(--surface-soft)';el.style.pointerEvents='none';});
    const readOnlyHidden='[data-example],#add-socio,#add-socio-top,[data-socio-remove],[data-tree-option-remove],[data-tree-option-add],[data-tree-child-add],[data-tree-criterion-remove]'+(currentUser.role==='admin'?'':',#add-result-resource');
    document.querySelectorAll(readOnlyHidden).forEach(el=>{el.style.display='none';});
    if(currentUser.role==='admin'){$('add-result-resource').style.display='';$('add-result-resource').disabled=resultResources.length>=10;}
    document.querySelectorAll('.socio-card').forEach(el=>el.style.background='var(--royal-blue-tint)');
    updateNextState();
  }
  async function load(){try{
    if(!projectId){if(!theme)throw new Error('Thématique manquante.');location.replace(`theme-${encodeURIComponent(theme)}.html?theme=${encodeURIComponent(theme)}`);return;}
    const data=await api(`/api/projects/${projectId}/composer`),meta=data.project||{};project=meta;translationReviewState=meta.translation_review_state&&typeof meta.translation_review_state==='object'?clone(meta.translation_review_state):{intro:{},socio:{}};reviewState();if(!theme)theme=meta.theme_slug||'';await Promise.all([loadQuota(),loadResourceLibrary()]);
    baseTitle=meta.base_title||meta.theme_title||meta.title||'Autodiagnostic';referenceIntro=stripHtml(meta.theme_introduction_html||'');$('param-theme').textContent=meta.theme_title||'Autodiagnostic';$('campaign-name').value=meta.campaign_name||baseTitle;$('respondent-title').value=meta.respondent_title||meta.respondent_title_default||baseTitle;const organizationName=meta.organization_name||quota?.name||'votre-entreprise',existingShareUrl=String(meta.communication_share_url||'').trim(),parsedShareUrl=parseDiffusionUrl(existingShareUrl);diffusionExistingUrl=existingShareUrl;diffusionCustomerSlug=parsedShareUrl?.customer||slugify(organizationName)||'votre-entreprise';const diffusionInput=$('diffusion-slug');diffusionInput.placeholder=meta.legacy_payload?.copySettingsPolicy==='new_client'?'À renseigner pour ce client':slugify(meta.theme_slug||meta.theme_title||baseTitle)||'slug-de-la-campagne';diffusionInput.value=parsedShareUrl?.slug||String(meta.legacy_payload?.copiedDiffusionSlug||'')||(isLegacyClientCampaign()&&!existingShareUrl?slugify(meta.legacy_slug||''):'');diffusionDirty=false;if(isLegacyClientCampaign()&&currentUser.role!=='admin'&&existingShareUrl){diffusionInput.readOnly=true;diffusionInput.setAttribute('aria-readonly','true');diffusionInput.closest('.diffusion-url-builder')?.classList.add('is-readonly');}renderDiffusionAddress();$('launch-date').min=isLegacyClientCampaign()?'':iso(5);$('launch-date').value=meta.launch_date?String(meta.launch_date).slice(0,10):(isLegacyClientCampaign()?'':iso(5));$('close-date').value=meta.close_date?String(meta.close_date).slice(0,10):'';syncCloseMin();$('nb-respondents').value=meta.estimated_respondents||'';const sourceSurveyId=String(meta.legacy_survey_id||meta.theme_legacy_id||'').trim(),themeSocioVariants=normalizeSocioLanguageVariants(meta.theme_sociodemo_variants,sourceSurveyId),legacyProjectSocioVariants=normalizeSocioLanguageVariants(meta.sociodemo_variants,sourceSurveyId),resolvedSocioVariants=normalizeSocioLanguageVariants(meta.sociodemo_language_variants_resolved||{},sourceSurveyId),storedSocioVariants=normalizeSocioLanguageVariants(meta.sociodemo_language_variants||{},sourceSurveyId);socioLanguageVariants={...(isLegacyClientCampaign()||(meta.legacy_payload?.copySettingsPolicy==='new_client'||meta.legacy_payload?.minorityDefaultInitialized===true)?{}:themeSocioVariants),...legacyProjectSocioVariants,...resolvedSocioVariants,...storedSocioVariants};const inferredReferenceLocale=inferSocioReferenceLocale(meta),initialReferenceCandidates=[inferredReferenceLocale,String(meta.sociodemo_reference_locale||'').trim(),String(meta.reference_locale||'').trim(),'fr','en','es',...projectLocales()],initialReferenceSeen=new Set();socioReferenceLocaleStable='';for(const candidate of initialReferenceCandidates){const loc=normalizeLocale(candidate);if(!loc||initialReferenceSeen.has(loc)||(isLegacyClientCampaign()&&!projectLocales().includes(loc)))continue;initialReferenceSeen.add(loc);if(Array.isArray(socioLanguageVariants?.[loc])&&socioLanguageVariants[loc].length){socioReferenceLocaleStable=loc;break;}}if(!socioReferenceLocaleStable){socioReferenceLocaleStable=Object.keys(socioLanguageVariants||{}).find(loc=>(!isLegacyClientCampaign()||projectLocales().includes(normalizeLocale(loc)))&&Array.isArray(socioLanguageVariants[loc])&&socioLanguageVariants[loc].length)||'';}alignNativeSocioVariants(legacyProjectSocioVariants);const orangeOrderRepair=repairOrange382DivisionOrder(meta),orangeFrenchRepair=repairOrange382FrenchLabels(meta),socioStructureRepair={changed:Boolean(orangeOrderRepair.changed||orangeFrenchRepair.changed),removed:0};introReferenceVariants=normalizeIntroVariants(meta.introduction_reference_variants||{});introResolvedVariants=normalizeIntroVariants(meta.introduction_variants_resolved||{});introVariants=normalizeIntroVariants(meta.introduction_variants||{});const countries=projectCountries();socioContextCountry=normalizeCountry(meta.selected_country_code)||(countries[0]||'');const locales=projectLocales();socioContextLocale=p.get('locale')&&locales.includes(normalizeLocale(p.get('locale')))?normalizeLocale(p.get('locale')):locales.includes(normalizeLocale(meta.selected_locale))?normalizeLocale(meta.selected_locale):(locales[0]||'fr');activateLanguage(socioContextLocale);clearStandardSuggestionReview();resultResources=normalizeResultResources(meta.result_buttons);renderSocioContext();renderSocio();renderResultResources();renderQuota();const clientFolderLink=$('param-client-folder');if(clientFolderLink){const showAdminFolder=currentUser.role==='admin'&&Boolean(meta.organization_id);clientFolderLink.hidden=!showAdminFolder;clientFolderLink.style.display=showAdminFolder?'':'none';if(showAdminFolder)clientFolderLink.href=`client.html?organizationId=${encodeURIComponent(meta.organization_id)}`;}$('param-back').href=`composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;$('param-back').textContent='← Revenir au contenu';const contentTop=$('param-content-top');if(contentTop)contentTop.href=`composer.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;
    initLegacySocioBaselines();if(isReadOnly())applyReadOnlyUI();else{if(project?.review_mode){const reviewUrl=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`,alert=$('param-alert');alert.hidden=false;alert.dataset.tone='success';alert.innerHTML='<strong>✎ Correction Me&YouToo active.</strong> Modifiez uniquement les paramètres nécessaires, puis revenez directement au contrôle qualité.';$('param-back').href=reviewUrl;$('param-back').textContent='← Retour au contrôle qualité';$('param-next').textContent='Enregistrer et revenir au contrôle qualité';if($('param-next-top'))$('param-next-top').textContent='Enregistrer et revenir au contrôle qualité';}updateNextState();await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:'parametrage'})});autosaveEnabled=true;lastSavedSettingsFingerprint=JSON.stringify(autosavePayload());lastSavedFingerprint=autosaveFingerprint(autosavePayload());autosaveStatus('✓ Enregistré automatiquement','saved');if(socioStructureRepair.changed){lastSavedFingerprint='';await autosaveNow();}}
    if(p.get('focus')==='intro')requestAnimationFrame(()=>{const field=$('intro');if(!field)return;for(let parent=field.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;field.focus({preventScroll:true});field.scrollIntoView({behavior:'smooth',block:'center'});});
  }catch(error){show(error.message);}}
  function syncCloseMin(){const d=$('launch-date').value;if(!d)return;const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+1);const min=x.toISOString().slice(0,10);$('close-date').min=min;if(!isReadOnly()&&$('close-date').value&&$('close-date').value<min)$('close-date').value='';}
  function invalidCriterion(c){return !String(c?.q||'').trim()||!Array.isArray(c?.opts)||c.opts.length<2||c.opts.some(o=>!String(o?.label||'').trim()||(o.subcriteria||[]).some(invalidCriterion));}
  function invalidSocio(){return socio.some(invalidCriterion);}
  $('add-socio').onclick=async()=>{if(isSocioReadOnly())return;const addCriterion=()=>{try{const index=socio.length;multilingualSocioAdd('root');openSocioPath(String(index));renderSocioContext();renderSocio();scheduleAutosave(0);setTimeout(()=>{const field=document.querySelector(`input[data-tree-q="${index}"]`);field?.focus({preventScroll:true});field?.scrollIntoView({behavior:'smooth',block:'center'});},80);}catch(error){return showSocioAddError(error);}};if(isSocioReferenceLocale())return addCriterion();const ref=socioReference(),refLoc=normalizeLocale(ref.locale);if(!refLoc)return;const ok=await window.StudioModal.confirm({eyebrow:'Données d’analyse multilingues',title:'La structure se construit dans la langue de référence',message:`Pour garantir les mêmes critères, réponses et sous-critères dans toutes les langues, ajoutez la donnée depuis ${localeLabel(refLoc)} (${refLoc.toUpperCase()}). Elle sera ensuite disponible dans toutes les langues du projet pour être traduite.`,type:'info',cancelLabel:'Rester ici',confirmLabel:`Passer en ${localeLabel(refLoc)} et ajouter`});if(!ok)return;storeActiveLanguageContent();activateLanguage(refLoc);renderSocioContext();renderSocio();addCriterion();};
  $('add-socio-top').onclick=()=>$('add-socio').click();
  $('intro').addEventListener('input',()=>{if(!isReadOnly()){updateNextState();scheduleAutosave();}});
  $('launch-date').addEventListener('change',()=>{if(!isReadOnly()){syncCloseMin();updateNextState();scheduleAutosave(0);}});
  $('close-date').addEventListener('change',()=>{if(!isReadOnly()){updateNextState();scheduleAutosave(0);}});
  document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{
    if(isReadOnly())return;
    const key=b.dataset.example,requestedLocale=normalizeLocale(socioContextLocale),refLoc=normalizeLocale(socioReference().locale)||requestedLocale;
    // La structure est créée une fois dans la langue de référence et les labels
    // correspondants sont remplis dans les langues disponibles du projet.
    storeActiveLanguageContent();
    if(requestedLocale!==refLoc)activateLanguage(refLoc);
    ensureAllLocaleSocioVariants();
    const index=key==='age'?-1:Number(key);
    if(key==='age'&&socio.some(isAgeCriterion)){
      if(requestedLocale!==refLoc)activateLanguage(requestedLocale);
      renderSocioContext();renderSocio();return;
    }
    const criterion=key==='age'?ageForLocale(refLoc):suggestedCriterion(index,refLoc);
    try{multilingualSocioAdd('root','',criterion,loc=>key==='age'?ageForLocale(loc):suggestedCriterion(index,loc));}
    catch(error){if(requestedLocale!==refLoc)activateLanguage(requestedLocale);renderSocioContext();renderSocio();showSocioAddError(error);return;}
    socioContextHasStored=true;
    insertingTranslatedSuggestion=true;
    try{storeActiveSocio();}finally{insertingTranslatedSuggestion=false;}
    clearStandardSuggestionReview();
    if(requestedLocale!==refLoc)activateLanguage(requestedLocale);
    renderSocioContext();renderSocio();scheduleAutosave(0);
  });
  $('add-result-resource').onclick=()=>openResourceModal();
  $('result-preview-toggle').onclick=()=>{const button=$('result-preview-toggle'),body=$('result-resources-preview'),open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));body.hidden=open;button.querySelector('span').textContent=open?'⌄':'⌃';};
  window.StudioParametragePreviewSnapshot=()=>{storeActiveLanguageContent();return {project:{theme:project?.theme_title||'',title:$('respondent-title')?.value.trim()||project?.respondent_title||baseTitle||'Autodiagnostic',intro:$('intro')?.value.trim()||'',socio:socio,result_buttons:resultResources.filter(resourceComplete)},respondent_context:{countryCode:socioContextCountry,locale:socioContextLocale}};};
  $('diffusion-slug')?.addEventListener('input',event=>{renderDiffusionSlugError();if(isReadOnly()||event.currentTarget.readOnly)return;const normalized=slugify(event.currentTarget.value,true);if(event.currentTarget.value!==normalized)event.currentTarget.value=normalized;diffusionDirty=true;renderDiffusionAddress();updateNextState();scheduleAutosave();});
  $('nb-respondents').oninput=()=>{if(isReadOnly())return;updateVigilance();renderQuota();scheduleAutosave();};
  $('close-packs').onclick=()=>{const panel=$('inline-packs');panel.hidden=true;const toggle=$('toggle-packs');if(toggle)toggle.textContent='Voir les packs disponibles';};window.addEventListener('studio:pack-requested',loadQuota);bindPackToggle();
  ['campaign-name','respondent-title'].forEach(id=>$(id)?.addEventListener('input',()=>scheduleAutosave()));
  $('param-next-top')?.addEventListener('click',()=>$('settings-form')?.requestSubmit());
  $('settings-form').noValidate=true;
  $('settings-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(isReadOnly()){location.href=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;return;}
    const missing=missingSettings();if(missing.length){await showMissingSettings(missing);return;}
    if(!await flushAutosave()){const pending=missingSettings();await showMissingSettings(pending.length?pending:[{id:'param-autosave-status',title:'Enregistrement à vérifier',message:lastAutosaveError||'Vos dernières modifications ne sont pas encore enregistrées. Vérifiez le message d’enregistrement avant de poursuivre.'}]);return;}
    const readiness=settingsReadiness();
    storeActiveLanguageContent();const campaignName=$('campaign-name').value.trim(),respondentTitle=$('respondent-title').value.trim(),primaryLocale=normalizeLocale(project?.selected_locale||(Array.isArray(project?.locales)&&project.locales[0])||'fr'),introductionHtml=reviewPrimaryIntroForSave(primaryLocale,readiness.intro,readiness.intro),launchDate=readiness.launch,closeDate=readiness.close;const rawRespondents=$('nb-respondents').value.trim(),nbRespondents=rawRespondents?Number(rawRespondents):null;
    if(!respondentTitle)return show('Le titre visible est obligatoire.');if(!isLegacyClientCampaign()&&!project?.review_mode&&launchDate<iso(5))return show('La date de lancement doit être au minimum à J+5.');if(closeDate<=launchDate)return show('La date de clôture doit être postérieure à la date de lancement.');if(!socio.length&&!optionalMinorityTheme())return show('Au moins une donnée d’analyse doit être présente.');if(invalidSocio())return show('Chaque donnée et chaque sous-critère doivent avoir un intitulé et au moins deux réponses renseignées.');const incompleteResource=resultResources.find(r=>!resourceComplete(r));if(incompleteResource)return show(incompleteResource.type==='legacy_document'?`Le PDF historique « ${incompleteResource.legacyFilename} » doit être rattaché avant de pouvoir être utilisé.`:'Chaque ressource doit avoir un texte et soit une URL valide, soit un fichier PDF.');const resultButtons=resultResources.filter(resourceComplete);
    try{await api(`/api/projects/${projectId}/settings`,{method:'PATCH',body:JSON.stringify({campaignName,respondentTitle,...introductionSettingsForSave(primaryLocale,introductionHtml),launchDate,closeDate,nbRespondents,sociodemo:isAdminLegacySocio()?undefined:(Array.isArray(project?.sociodemo)?project.sociodemo:socio),sociodemoLanguageVariants:isAdminLegacySocio()?undefined:(isLegacyClientCampaign()?project.sociodemo_language_variants:activeLanguageVariants(socioLanguageVariants)),translationReviewState:isLegacyClientCampaign()?project.translation_review_state:reviewState(),communicationShareUrl:readiness.shareUrl||null,resultButtons})});location.href=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;}catch(error){if(error.code==='DIFFUSION_URL_TAKEN'){renderDiffusionSlugError(error.message,true);}else if(error.code==='SOCIODEMO_TRANSLATIONS_INCOMPLETE'){const missing=incompleteSociodemo();await showMissingSettings(missing.length?missing:[{id:'socio-list',title:'Données d’analyse à compléter',message:error.message}]);}else if(error.code==='INTRODUCTIONS_INCOMPLETE'){const missing=missingSettings().filter(item=>item.id==='intro');await showMissingSettings(missing.length?missing:[{id:'intro',title:'Introductions à personnaliser',message:error.message}]);}else await showMissingSettings([{id:'param-autosave-status',title:'Enregistrement à vérifier',message:error.message||'Impossible d’enregistrer la campagne pour le moment.'}]);}
  });load();
})();
