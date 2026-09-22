(()=>{
const previewSource=new URLSearchParams(location.search).get('source')||'live';
const liveProjectPreview=(new URLSearchParams(location.search).get('mode')||((new URLSearchParams(location.search).get('projectId'))?'project':'catalog'))==='project'&&previewSource!=='saved';
let previewLocale=String(new URLSearchParams(location.search).get('lang')||document.documentElement.lang||'fr').toLowerCase().replaceAll('_','-');
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),clean=h=>{let x=document.createElement('div');x.innerHTML=String(h||'').replace(/<\s*br\s*\/?\s*>/gi,'\n').replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi,'</$1>\n\n');return(x.textContent||'').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/([.!?])(?=[A-ZÀ-ÖØ-Þ])/g,'$1 ').trim()},q=new URLSearchParams(location.search),pid=q.get('projectId'),theme=q.get('theme')||'',mode=q.get('mode')||(pid?'project':'catalog'),root=$('#rp');
let d,ci=0,qi=0,step=-1,socioChoices={},answers={},chapterResults=[],availablePreviewLocales=['fr'],previewCountry='FR',previewCountries=[],previewCountryLocales={},contextLoading=false,contextError='';

function apiBase(){
  const host=String(location.hostname||'').toLowerCase(),path=String(location.pathname||'').toLowerCase();
  const staging=host==='localhost'||host==='127.0.0.1'||host.includes('staging')||path.includes('/studio-meandyoutoo-staging/');
  return staging?'https://studio-meandyoutoo-api-staging.osc-fr1.scalingo.io':'https://studio-meandyoutoo-api.osc-fr1.scalingo.io';
}
async function api(u){
  if(window.StudioAPI&&typeof window.StudioAPI.request==='function')return window.StudioAPI.request(u);
  const base=apiBase();
  const token=localStorage.getItem('studio_token')||'';
  const headers=token?{Authorization:'Bearer '+token}:{};
  let r=await fetch(base+u,{headers});
  let data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`Erreur API ${r.status}`);
  return data
}
function num(v,fallback=0){v=Number(v);return Number.isFinite(v)?v:fallback}
function randomIndex(max){if(max<=1)return 0;try{let a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%max}catch(_){return Math.floor(Math.random()*max)}}
function shuffle(list){const out=[...(list||[])];for(let i=out.length-1;i>0;i--){const j=randomIndex(i+1);[out[i],out[j]]=[out[j],out[i]]}return out}
function rawSubcriteria(option){return Array.isArray(option?.subcriteria)?option.subcriteria:(option?.subcriterion?[option.subcriterion]:[])}
function normalizeSocioCriterion(s,i,path){
  const options=(s?.opts||s?.options||[]).map((o,j)=>{
    const base=typeof o==='object'?{...o,label:o.label||o.text||o.value||`Réponse ${j+1}`}:{label:String(o)};
    base.subcriteria=rawSubcriteria(o).map((child,k)=>normalizeSocioCriterion(child,k,`${path}.${j}.${k}`)).filter(Boolean);
    return base;
  });
  if(!options.length)return null;
  return {key:String(s?.kind||s?.key||s?.source_id||path||i),label:s?.q||s?.question||s?.label||s?.name||s?.title||`Question ${i+1}`,options};
}
function normalizeSocio(list){return (Array.isArray(list)?list:[]).filter(Boolean).map((s,i)=>normalizeSocioCriterion(s,i,String(i))).filter(Boolean)}
function fallbackSocio(){return [{key:'gender',label:'Vous êtes :',options:[{label:'Une femme'},{label:'Un homme'},{label:'Non-binaire'},{label:'Autre'}]}]}
function normalizeProfile(p){return {...p,title:p.title||p.titre||'Profil',summary:clean(p.summary||p.resume||p.phrase||''),content:clean(p.content||p.description||p.desc||''),scoring_min:num(p.scoring_min??p.min,0),scoring_max:num(p.scoring_max??p.max,0),top_score:num(p.top_score,0)}}
function normalizeAnswer(a,i){return typeof a==='object'?{...a,label:a.text||a.content||a.label||`Réponse ${i+1}`,score:num(a.score,0),display_order:num(a.position??a.display_order??i,i)}:{label:String(a),score:0,display_order:i}}
function isFivePointScaleAnswers(list){
  const rows=(Array.isArray(list)?list:[]).map((a,i)=>normalizeAnswer(a,i));
  if(rows.length!==5)return false;
  const patterns=[
    /accord|désaccord|disaccord|tout à fait|pas du tout|plutôt|plutot|moyennement/i,
    /agree|disagree|strongly|neither/i,
    /acuerdo|desacuerdo|medianamente|totalmente|muy/i,
    /concordo|discordo|concordância|discordância|totalmente/i,
    /stimme|zustimm|lehne|weder/i,
    /d['’]accordo|disaccordo|abbastanza|totalmente/i,
    /eens|oneens|helemaal/i,
    /zgadzam|nie zgadzam/i,
    /соглас|несоглас/i
  ];
  const hits=rows.filter(a=>patterns.some(re=>re.test(String(a.label||'')))).length;
  return hits>=3;
}
function normalizeScaleAnswers(list){
  const rows=(Array.isArray(list)?list:[]).map(normalizeAnswer);
  const numericScores=rows.map(a=>Number(a.score));
  const validScores=numericScores.every(Number.isFinite)&&new Set(numericScores).size===rows.length;
  if(validScores)return rows.sort((a,b)=>Number(a.score)-Number(b.score));
  return rows.sort((a,b)=>Number(a.display_order)-Number(b.display_order));
}
function normalizeSituation(s,sidx,cidx){
  const raw=Array.isArray(s.answers)?s.answers:[];
  const scale=isFivePointScaleAnswers(raw);
  return {id:s.id||s.source_id||`${cidx}-${sidx}`,content:s.content||s.original_content||s.text||'',scaleType:scale?'five-point':null,answers:scale?normalizeScaleAnswers(raw):shuffle(raw.map(normalizeAnswer))};
}
function normalizeResources(list){return (Array.isArray(list)?list:[]).map((r,i)=>{const title=String(r?.title||r?.titre||r?.label||r?.text||`Ressource ${i+1}`).trim(),url=String(r?.url||r?.href||r?.link||'').trim(),documentId=String(r?.documentId??r?.document_id??'').trim(),legacyFilename=String(r?.legacyFilename||r?.legacy_filename||r?.filename||'').trim(),type=String(r?.type||'').toLowerCase()||(documentId?'document':legacyFilename&&!url?'legacy_document':'link');return{title,type,url,documentId,legacyFilename,filename:String(r?.filename||legacyFilename||'').trim()}}).filter(r=>r.title&&(r.type==='document'?r.documentId:r.type==='legacy_document'?r.legacyFilename:/^https?:\/\//i.test(r.url)))}
function normalizeMedia(list){const rows=(Array.isArray(list)?list:[]).map(m=>({id:m.id,title:String(m.title||'Vidéo'),placement:m.placement,profile_position:m.profile_position===null||m.profile_position===undefined?null:Number(m.profile_position),locale:String(m.locale||'').toLowerCase().replaceAll('_','-'),playback_path:String(m.playback_path||'')})).filter(m=>m.id&&m.playback_path);const exact=rows.filter(m=>m.locale===previewLocale);return exact.length?exact:(previewLocale==='fr'?rows.filter(m=>!m.locale):[])}
function norm(x){
  let pr=x.project||{},live=mode==='project'&&previewSource!=='saved'?JSON.parse(sessionStorage.getItem('meayt_preview')||'null'):null;
  const sourceSocio=Array.isArray(pr.sociodemo)&&pr.sociodemo.length?pr.sociodemo:(Array.isArray(x.theme?.sociodemo_default)?x.theme.sociodemo_default:[]);
  d={
    theme:pr.theme_title||x.theme?.title||theme||'Autodiagnostic',
    title:pr.respondent_title||pr.campaign_name||pr.theme_title||x.theme?.respondent_title_default||x.theme?.base_title||x.theme?.title||'Autodiagnostic',
    intro:clean(pr.introduction_html||pr.theme_introduction_html||x.theme?.introduction_html)||'Découvrez le parcours proposé aux répondants.',
    socio:normalizeSocio(sourceSocio),
    resources:normalizeResources(pr.result_buttons||x.theme?.result_buttons||[]),
    chapters:(x.chapters||[]).map((c,cidx)=>({
      id:c.id||c.source_id||cidx,title:c.title||`Partie ${cidx+1}`,
      profiles:(c.profiles||c.profils||[]).map(normalizeProfile),
      media:normalizeMedia(c.media||[]),
      situations:(c.situations||c.questions||[]).map((s,sidx)=>normalizeSituation(s,sidx,cidx))
    }))
  };
  if(live?.project){
    if(live.project.respondent_title||live.project.title)d.title=live.project.respondent_title||live.project.title;
    if(live.project.introduction_html||live.project.intro)d.intro=clean(live.project.introduction_html||live.project.intro);
    if(Array.isArray(live.project.sociodemo))d.socio=normalizeSocio(live.project.sociodemo);
    if(Array.isArray(live.project.result_buttons))d.resources=normalizeResources(live.project.result_buttons);
  }
  if(live?.chapters && !liveProjectPreview && previewLocale===String(pr.selected_locale||'fr').toLowerCase().replaceAll('_','-')){
    const profileMap=new Map(d.chapters.map(c=>[String(c.id),c.profiles]));
    d.chapters=live.chapters.map((c,cidx)=>({
      id:c.id||c.source_id||cidx,title:c.title||`Partie ${cidx+1}`,
      profiles:(c.profiles||profileMap.get(String(c.id))||[]).map(normalizeProfile),
      media:normalizeMedia(c.media||d.chapters.find(x=>String(x.id)===String(c.id))?.media||[]),
      situations:(c.situations||[]).map((s,sidx)=>normalizeSituation(s,sidx,cidx))
    }));
  }
  d.chapters=d.chapters.filter(c=>c.situations.length);
  // Un aperçu catalogue doit toujours illustrer l'étape de données d'analyse.
  if(mode==='catalog'&&!d.socio.length)d.socio=fallbackSocio();
}


function normalizeLocaleCode(value){return String(value||'').trim().toLowerCase().replaceAll('_','-')}
function normalizeCountryCode(value){return String(value||'').trim().toUpperCase()}
function projectPreviewContext(payload){
  const project=payload?.project||{},ctx=payload?.composer_context||{};
  const rawMap=(ctx.countryLocales&&typeof ctx.countryLocales==='object'&&!Array.isArray(ctx.countryLocales))
    ?ctx.countryLocales
    :((project.country_locales&&typeof project.country_locales==='object'&&!Array.isArray(project.country_locales))?project.country_locales:{});
  const countries=[...new Set([...(Array.isArray(ctx.countries)?ctx.countries:[]),...(Array.isArray(project.countries)?project.countries:[]),...Object.keys(rawMap||{}),project.selected_country_code].map(normalizeCountryCode).filter(Boolean))];
  const global=[...new Set([...(Array.isArray(project.locales)?project.locales:[]),project.selected_locale].map(normalizeLocaleCode).filter(Boolean))];
  const byCountry={};
  countries.forEach(code=>{
    const exact=[...new Set((Array.isArray(rawMap?.[code])?rawMap[code]:[]).map(normalizeLocaleCode).filter(Boolean))];
    byCountry[code]=exact.length?exact:(countries.length===1?global:[]);
  });
  return {countries,byCountry};
}
function countryLabel(code){
  const cc=normalizeCountryCode(code),special={WW:'International',WORLDWIDE:'International',INT:'International',GLOBAL:'International',ASIA:'Asie','250':'France','276':'Allemagne','032':'Argentine','040':'Autriche','076':'Brésil','124':'Canada','152':'Chili','156':'Chine','158':'Taïwan','208':'Danemark','724':'Espagne','840':'États-Unis','344':'Hong Kong','392':'Japon','484':'Mexique','578':'Norvège','591':'Panama','620':'Portugal','752':'Suède','756':'Suisse','858':'Uruguay','410':'Corée du Sud'};
  if(special[cc])return special[cc];
  try{return new Intl.DisplayNames(['fr'],{type:'region'}).of(cc)||cc}catch(_){return cc}
}
const localeNamesFr={fr:'Français',en:'Anglais',es:'Espagnol',de:'Allemand',it:'Italien',pt:'Portugais',br:'Portugais Brésil',bg:'Bulgare',ja:'Japonais','ko-kr':'Coréen',ko:'Coréen',zf:'Chinois simplifié',zh:'Chinois traditionnel',nl:'Néerlandais','nl-be':'Néerlandais (Belgique)',pl:'Polonais',ro:'Roumain',ru:'Russe','sv-se':'Suédois',tr:'Turc',cs:'Tchèque',sk:'Slovaque',id:'Indonésien',ar:'Arabe'};
function localeLabelFr(code){const loc=normalizeLocaleCode(code);return `${loc.toUpperCase()} · ${localeNamesFr[loc]||loc.toUpperCase()}`}
function resetPreviewProgress(){step=-1;ci=qi=0;socioChoices={};answers={};chapterResults=[]}
function contextSelectionState(){
  const countries=previewCountries||[],countryCount=countries.length;
  const locales=previewCountry?(previewCountryLocales[previewCountry]||[]):[];
  const needsCountry=countryCount>1;
  const needsLocale=Boolean(previewCountry&&locales.length>1);
  return {countryCount,locales,needsCountry,needsLocale,ready:Boolean(previewCountry&&previewLocale&&!contextLoading&&!contextError)};
}
function contextChooser(){
  if(!liveProjectPreview)return'';
  const state=contextSelectionState();
  if(state.countryCount===1&&state.locales.length===1)return'';
  const blocks=[];
  let stepNumber=1;
  if(state.needsCountry){
    const countryButtons=previewCountries.map(code=>`<button type="button" class="rp-context-choice ${code===previewCountry?'selected':''}" data-preview-country="${esc(code)}" aria-pressed="${code===previewCountry?'true':'false'}"><span>🌍</span><strong>${esc(countryLabel(code))}</strong></button>`).join('');
    blocks.push(`<div class="rp-context-step"><div class="rp-context-step-head"><span>${stepNumber++}</span><div><strong>Choisissez le périmètre</strong><small>${previewCountries.length} périmètres disponibles</small></div></div><div class="rp-context-options">${countryButtons||'<div class="rp-context-empty">Aucun périmètre configuré pour cette campagne.</div>'}</div></div>`);
  }
  if(previewCountry&&state.needsLocale){
    blocks.push(`<div class="rp-context-step ${state.needsCountry?'rp-context-language-step':''}"><div class="rp-context-step-head"><span>${stepNumber++}</span><div><strong>Choisissez la langue</strong><small>${state.locales.length} langues disponibles</small></div></div><div class="rp-context-options">${state.locales.map(loc=>`<button type="button" class="rp-context-choice rp-context-locale ${loc===previewLocale?'selected':''}" data-preview-locale="${esc(loc)}" aria-pressed="${loc===previewLocale?'true':'false'}"><strong>${esc(localeLabelFr(loc))}</strong></button>`).join('')}</div></div>`);
  }
  const loading=contextLoading?`<div class="rp-context-loading" role="status">Chargement du parcours…</div>`:'';
  const error=contextError?`<div class="rp-context-error" role="alert">${esc(contextError)}</div>`:'';
  const instruction=state.needsCountry&&(!previewCountry||!state.ready)?'Choisissez le périmètre correspondant au répondant.':state.needsLocale&&!previewLocale?'Choisissez la langue du répondant.':'Le parcours réel de la campagne est prêt.';
  return `<section class="rp-context-chooser" aria-label="Choix du parcours répondant"><div class="rp-context-intro"><strong>Prévisualisez le parcours réel d’un répondant</strong><p>${esc(instruction)}</p></div>${blocks.join('')}${loading}${error}</section>`;
}
async function loadSelectedPreviewContext(){
  if(!previewCountry||!previewLocale)return;
  contextError='';contextLoading=true;render();
  try{
    const payload=await api(`/api/projects/${pid}/composer?respondentPreview=1&countryCode=${encodeURIComponent(previewCountry)}&locale=${encodeURIComponent(previewLocale)}`);
    norm(payload);resetPreviewProgress();
  }catch(error){contextError=error.message||'Impossible de charger ce parcours.';previewLocale='';}
  finally{contextLoading=false;render();}
}
function bindContextChooser(){
  if(!liveProjectPreview)return;
  root.querySelectorAll('[data-preview-country]').forEach(button=>button.onclick=async()=>{
    const country=normalizeCountryCode(button.dataset.previewCountry);
    if(!country||contextLoading)return;
    previewCountry=country;
    availablePreviewLocales=previewCountryLocales[country]||[];
    previewLocale=availablePreviewLocales.length===1?availablePreviewLocales[0]:'';
    contextError='';resetPreviewProgress();
    if(previewLocale)await loadSelectedPreviewContext();else render();
  });
  root.querySelectorAll('[data-preview-locale]').forEach(button=>button.onclick=async()=>{
    const locale=normalizeLocaleCode(button.dataset.previewLocale);
    if(!previewCountry||!locale||contextLoading)return;
    previewLocale=locale;availablePreviewLocales=previewCountryLocales[previewCountry]||[];resetPreviewProgress();
    await loadSelectedPreviewContext();
  });
}

const modeLabel=()=>mode==='project'?'Votre campagne composée':'Version catalogue Me&YouToo';
const head=t=>`<header class="rp-head"><img src="assets/img/brand/logo-meayt-color.png"><div><b>${mode==='project'?'Aperçu de ma campagne':'Aperçu répondant'}</b><span>${esc(t||modeLabel())}</span></div>${liveProjectPreview?'':languagePicker()}</header>`;
function localeLabel(code){const k=String(code||'').toLowerCase().replaceAll('_','-'),n={fr:'Français',en:'English',es:'Español',de:'Deutsch',it:'Italiano',pt:'Português',br:'Português (Brasil)',nl:'Nederlands','nl-be':'Nederlands (België)',pl:'Polski',cs:'Čeština',sk:'Slovenčina',id:'Bahasa Indonesia',ja:'日本語','ko-kr':'한국어',ko:'한국어',zh:'繁體中文',zf:'简体中文',bg:'Български',ro:'Română',ru:'Русский','sv-se':'Svenska',tr:'Türkçe'};return (n[k]||k.toUpperCase())+' ('+k.toUpperCase()+')'}
function languagePicker(){if(availablePreviewLocales.length<2)return'';return `<div class="rp-language-picker"><label for="rp-lang">Langue</label><select id="rp-lang">${availablePreviewLocales.map(l=>`<option value="${esc(l)}" ${l===previewLocale?'selected':''}>${esc(localeLabel(l))}</option>`).join('')}</select></div>`}
function bindLanguagePicker(){const el=$('#rp-lang');if(el)el.onchange=async()=>{previewLocale=el.value;await loadPreviewData(true)}}
const totalSituations=()=>d.chapters.reduce((n,c)=>n+c.situations.length,0);
const situationNumber=()=>d.chapters.slice(0,ci).reduce((n,c)=>n+c.situations.length,0)+qi+1;
const answerKey=(c=ci,s=qi)=>`${c}:${s}`;

function intro(){
  const contextReady=!liveProjectPreview||Boolean(previewCountry&&previewLocale&&!contextLoading&&!contextError);
  const selection=contextSelectionState();
  const startLabel=!liveProjectPreview||contextReady?'Commencer l’autodiagnostic':selection.needsCountry&&!previewCountry?'Choisissez un périmètre':selection.needsLocale&&!previewLocale?'Choisissez une langue':'Chargement du parcours…';
  root.innerHTML=head()+`<section class="rp-card rp-intro"><em>${esc(modeLabel())}</em><h1>${esc(d.title)}</h1><p class="rp-intro-copy">${esc(d.intro)}</p>${contextChooser()}<aside>${mode==='project'?'Cet aperçu reprend le contenu actuellement composé et paramétré pour cette campagne.':'Cet aperçu présente le parcours standard proposé dans le catalogue, avant personnalisation.'} Les réponses utilisées ici servent uniquement à calculer le rendu de l’aperçu et ne sont jamais enregistrées.</aside><button id="start" class="button button-primary" ${contextReady?'':'disabled'}>${esc(startLabel)}</button></section>`;
  bindContextChooser();
  const start=$('#start');if(start)start.onclick=()=>{if(!contextReady)return;step=0;render()}
}

function visibleSocioCriteria(){
  const rows=[];
  const visit=(criterion,path,level)=>{
    rows.push({criterion,path,level});
    const selected=socioChoices[path];
    if(selected===undefined)return;
    const option=criterion.options[selected];
    (option?.subcriteria||[]).forEach((child,k)=>visit(child,`${path}.${selected}.${k}`,level+1));
  };
  d.socio.forEach((criterion,i)=>visit(criterion,String(i),1));
  return rows;
}
function clearSocioDescendants(path){Object.keys(socioChoices).forEach(key=>{if(key.startsWith(path+'.'))delete socioChoices[key];});}
function socio(){
  if(!d.socio.length){step=1;render();return}
  const visible=visibleSocioCriteria(),complete=visible.every(({path})=>socioChoices[path]!==undefined);
  root.innerHTML=head('Informations répondant')+`<section class="rp-card"><div class="rp-kicker">Données d’analyse</div><h1>Mieux comprendre les résultats collectifs</h1><p class="rp-help">Choisissez une réponse pour chaque critère. Les questions complémentaires apparaissent selon vos réponses. Dans cet aperçu, ces données sont fictives et ne sont pas enregistrées.</p><div class="rp-socio-list">${visible.map(({criterion:s,path,level})=>`<fieldset class="rp-socio ${level>1?'is-conditional':''}" style="--rp-socio-level:${Math.min(level,8)}"><legend>${level>1?`<span class="rp-socio-level">Niveau ${level}</span>`:''}${esc(s.label)} <span aria-hidden="true">*</span></legend><div class="rp-socio-options">${s.options.map((o,j)=>`<button type="button" class="rp-choice ${socioChoices[path]===j?'selected':''}" data-socio-path="${esc(path)}" data-option="${j}">${esc(o.label)}</button>`).join('')}</div></fieldset>`).join('')}</div><div class="rp-actions"><button id="next" class="button button-primary" ${complete?'':'disabled'}>Continuer</button></div></section>`;
  root.querySelectorAll('[data-socio-path]').forEach(b=>b.onclick=()=>{const path=b.dataset.socioPath;clearSocioDescendants(path);socioChoices[path]=Number(b.dataset.option);socio()});
  $('#next').onclick=()=>{if(!visibleSocioCriteria().every(({path})=>socioChoices[path]!==undefined))return;step=1;render()}
}


function mediaVideoHtml(media,headingTag='h3'){
  const src=apiBase()+media.playback_path;
  return `<div class="rp-video-block"><${headingTag}>${esc(media.title)}</${headingTag}><div class="rp-video-shell"><video class="rp-video-player" controls controlsList="nodownload" disablePictureInPicture preload="metadata" playsinline data-proxy-src="${esc(src)}"></video><div class="rp-video-loading" data-video-loading>Chargement de la vidéo…</div></div><p class="rp-video-note">Cette vidéo est diffusée directement dans le Studio.</p></div>`;
}
async function hydrateProfileVideos(scope=root){
  const videos=[...scope.querySelectorAll('video[data-proxy-src]:not([data-blob-ready])')];
  for(const video of videos){
    video.dataset.blobReady='loading';
    const loading=video.parentElement?.querySelector('[data-video-loading]');
    try{
      const response=await fetch(video.dataset.proxySrc,{cache:'no-store'});
      if(!response.ok)throw new Error(`Vidéo indisponible (${response.status})`);
      const blob=await response.blob();
      if(!String(blob.type||'').startsWith('video/'))throw new Error('Format vidéo invalide');
      const blobUrl=URL.createObjectURL(blob);
      video.dataset.blobUrl=blobUrl;
      video.src=blobUrl;
      video.dataset.blobReady='true';
      video.load();
      if(loading)loading.remove();
    }catch(error){
      video.dataset.blobReady='error';
      if(loading){loading.textContent='La vidéo ne peut pas être chargée.';loading.classList.add('is-error');}
      console.error('[MEAYT] Chargement vidéo impossible',error);
    }
  }
}
function profileMedia(ch,p){
  const profileIndex=Math.max(0,(ch?.profiles||[]).indexOf(p));
  return (ch?.media||[]).filter(m=>m.placement==='profile_result'&&(m.profile_position===null||Number(m.profile_position)===profileIndex));
}
function renderScaleAnswers(s,selected){
  const rows=Array.isArray(s?.answers)?s.answers:[];
  const displayValue=(a,i)=>{const score=Number(a?.score);return Number.isFinite(score)&&score>=1&&score<=5?score:i+1;};
  const byValue=value=>rows.find((a,i)=>displayValue(a,i)===value);
  return `<div class="rp-scale"><div class="rp-scale-grid">${rows.map((a,i)=>{const value=displayValue(a,i);return `<button type="button" class="rp-scale-option ${selected===i?'selected':''}" data-i="${i}" aria-label="${esc(`${value} - ${a.label}`)}"><span>${value}</span></button>`;}).join('')}</div><div class="rp-scale-legend"><div class="rp-scale-legend-item rp-scale-legend-1">${esc(byValue(1)?.label||rows[0]?.label||'')}</div><div class="rp-scale-legend-item rp-scale-legend-3">${esc(byValue(3)?.label||rows[2]?.label||'')}</div><div class="rp-scale-legend-item rp-scale-legend-5">${esc(byValue(5)?.label||rows[4]?.label||'')}</div></div></div>`;
}
function question(){
  let ch=d.chapters[ci],s=ch?.situations?.[qi];if(!s){done();return}
  const selected=answers[answerKey()],isScale=s.scaleType==='five-point';
  const answerBlock=isScale?renderScaleAnswers(s,selected):`<div class="rp-answers">${(s.answers||[]).map((a,i)=>`<button type="button" class="rp-answer ${selected===i?'selected':''}" data-i="${i}"><span>${String.fromCharCode(65+i)}</span>${esc(a.label)}</button>`).join('')}</div>`;
  const help=isScale?'Répondez à cette série de questions en choisissant une valeur de 1 à 5.':'Choisissez la réponse qui correspond le mieux à ce que vous pensez ou feriez spontanément.';
  root.innerHTML=head(`Partie ${ci+1} sur ${d.chapters.length}`)+`<section class="rp-card ${isScale?'rp-card-scale':''}"><div class="rp-progress-row"><div><span>Partie ${ci+1}/${d.chapters.length}</span><strong class="rp-chapter-title">${esc(ch.title)}</strong></div><span>Situation ${qi+1} / ${ch.situations.length}</span></div><div class="rp-bar"><i style="width:${Math.round(((qi+1)/Math.max(1,ch.situations.length))*100)}%"></i></div><h1>${esc(s.content)}</h1><p class="rp-help">${esc(help)}</p>${answerBlock}<div class="rp-actions"><button id="prev" class="button button-secondary">Précédent</button><button id="next" class="button button-primary" ${selected===undefined?'disabled':''}>Continuer</button></div></section>`;
  root.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{answers[answerKey()]=Number(b.dataset.i);question()});
  $('#prev').onclick=()=>{if(qi>0)qi--;else if(ci>0){ci--;qi=d.chapters[ci].situations.length-1;step=1}else{step=d.socio.length?0:-1}render()};
  $('#next').onclick=()=>{if(answers[answerKey()]===undefined)return;if(qi+1<ch.situations.length){qi++;render()}else{showChapterResult()}}
}

function chapterAverage(chapterIndex){
  const ch=d.chapters[chapterIndex];if(!ch?.situations?.length)return null;
  const vals=ch.situations.map((s,sidx)=>{const idx=answers[answerKey(chapterIndex,sidx)];return idx===undefined?NaN:num(s.answers[idx]?.score,NaN)}).filter(Number.isFinite);
  if(vals.length!==ch.situations.length)return null;
  return vals.reduce((a,b)=>a+b,0)/vals.length;
}
function profileForScore(profiles,avg){
  const list=Array.isArray(profiles)?profiles:[];if(!list.length)return null;
  const globalMax=Math.max(...list.map(p=>num(p.scoring_max,-Infinity)));
  let found=list.find(p=>avg>=num(p.scoring_min,-Infinity)&&(avg<num(p.scoring_max,Infinity)||(num(p.scoring_max,Infinity)===globalMax&&avg<=globalMax)));
  if(!found){found=list.reduce((best,p)=>{const min=num(p.scoring_min,0),max=num(p.scoring_max,0),dist=avg<min?min-avg:avg>max?avg-max:0;return !best||dist<best.dist?{p,dist}:best},null)?.p}
  return found||list[0];
}
function profileTone(p){const c=String(p?.color||'').toLowerCase();if(c.includes('77cd8a')||c.includes('green'))return'positive';if(c.includes('ffc744')||c.includes('yellow')||c.includes('orange'))return'mid';if(c.includes('ff847')||c.includes('red'))return'alert';return'neutral'}
function showChapterResult(){
  const ch=d.chapters[ci],avg=chapterAverage(ci),p=profileForScore(ch.profiles,avg),tone=profileTone(p);chapterResults[ci]={avg,profile:p};step=2;
  root.innerHTML=head(`Résultat de la partie ${ci+1}`)+`<section class="rp-card rp-profile ${tone}"><div class="rp-kicker rp-kicker-neutral">Votre profil · Partie ${ci+1}/${d.chapters.length}</div><div class="rp-profile-chapter">${esc(ch.title)}</div>${p?`${profileMedia(ch,p).map(m=>mediaVideoHtml(m)).join('')}<h1>${esc(p.title)}</h1>${p.summary?`<p class="rp-profile-summary">${esc(p.summary)}</p>`:''}${p.content&&p.content!==p.summary?`<div class="rp-profile-content">${esc(p.content)}</div>`:''}`:`<h1>Profil indisponible</h1><p>Le contenu de profil de cette partie n’est pas disponible.</p>`}<div class="rp-actions"><button id="next" class="button button-primary">${ci===d.chapters.length-1?'Voir le récapitulatif':'Continuer vers la partie suivante'}</button></div></section>`;
  hydrateProfileVideos(root);
  $('#next').onclick=()=>{if(ci<d.chapters.length-1){ci++;qi=0;step=1;render()}else done()}
}

function hashText(value){let h=2166136261;for(const c of String(value||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function colleagueDistribution(chapter,profile,chapterIndex){
  const profiles=chapter?.profiles||[];if(!profiles.length)return[];const own=Math.max(0,profiles.indexOf(profile));if(profiles.length===1)return[{profile:profiles[0],pct:100,own:true}];
  const seed=hashText(`${chapterIndex}|${profile?.title||''}|${chapter?.title||''}`),ownPct=45+(seed%19),remaining=100-ownPct;
  const others=profiles.map((p,i)=>({p,i,w:i===own?0:7+((hashText(`${seed}|${i}|${p.title}`)%24))}));const totalW=others.reduce((n,x)=>n+x.w,0)||1;let used=ownPct;
  const out=profiles.map((p,i)=>{if(i===own)return{profile:p,pct:ownPct,own:true};const pct=Math.floor(remaining*(others[i].w/totalW));used+=pct;return{profile:p,pct,own:false}});
  const diff=100-used;if(diff){const target=out.find(x=>!x.own)||out[own];target.pct+=diff}return out;
}
function colleaguesHtml(chapter,result,chapterIndex){
  const dist=colleagueDistribution(chapter,result?.profile,chapterIndex),mine=dist.find(x=>x.own)||dist[0];
  return `<div class="rp-colleague-wrap"><button type="button" class="rp-colleague-toggle" data-colleague-toggle="${chapterIndex}"><span>Afficher le résultat de mes collègues</span><span aria-hidden="true">⌄</span></button><div class="rp-colleague-body" data-colleague-body="${chapterIndex}" hidden><div class="rp-colleague-own"><strong>${mine?.pct??0}<small>%</small></strong><span>de vos collègues ont le même profil que vous</span></div><div class="rp-colleague-dist">${dist.map(x=>`<div class="rp-colleague-row"><span class="rp-colleague-dot ${profileTone(x.profile)}"></span><strong>${x.pct}%</strong><div><b>${esc(x.profile?.title||'Profil')}</b>${x.own?'<em>Votre profil</em>':''}</div></div>`).join('')}</div><p class="rp-fictive-note">Comparaison fictive affichée uniquement pour simuler la restitution répondant.</p></div></div>`;
}
async function downloadResourceDocument(documentId,filename){
  try{
    const base=typeof window.StudioAPI?.base==='function'?window.StudioAPI.base():apiBase();
    const token=localStorage.getItem('studio_token')||'';
    const response=await fetch(`${String(base).replace(/\/$/,'')}/api/projects/${encodeURIComponent(pid)}/resource-library/${encodeURIComponent(documentId)}/download`,{headers:token?{Authorization:`Bearer ${token}`}:{}});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Téléchargement impossible');}
    const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename||'document.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(error){const note=root.querySelector('[data-resource-download-note]');if(note){note.textContent=error.message;note.hidden=false;setTimeout(()=>{note.hidden=true},3200)}}
}
function bindFinalInteractions(){
  root.querySelectorAll('[data-colleague-toggle]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.colleagueToggle,body=root.querySelector(`[data-colleague-body="${id}"]`),open=body&&!body.hidden;if(body)body.hidden=open;btn.classList.toggle('open',!open);btn.querySelector('span:last-child').textContent=open?'⌄':'⌃';});
  const resourceToggle=root.querySelector('[data-resource-toggle]');if(resourceToggle)resourceToggle.onclick=()=>{const body=root.querySelector('[data-resource-body]'),open=body&&!body.hidden;if(body)body.hidden=open;resourceToggle.classList.toggle('open',!open);resourceToggle.querySelector('span:last-child').textContent=open?'⌄':'⌃';};
  root.querySelectorAll('[data-resource-document]').forEach(btn=>btn.onclick=()=>downloadResourceDocument(btn.dataset.resourceDocument,btn.dataset.resourceFilename));
  const reportBtn=root.querySelector('[data-report-download]');if(reportBtn)reportBtn.onclick=()=>{const note=root.querySelector('[data-report-note]');if(note){note.hidden=false;setTimeout(()=>{note.hidden=true},2600)}};
}
function resourcesHtml(){
  const catalogResources=[
    {title:'Contactez vos référents',type:'demo',url:''},
    {title:'Consultez notre règlement intérieur',type:'demo',url:''},
    {title:'Découvrez nos ressources internes',type:'demo',url:''}
  ];
  const list=mode==='catalog'?catalogResources:(d.resources||[]);
  if(!list.length)return'';
  const rows=list.map(r=>{
    if(r.type==='document'&&r.documentId)return `<button type="button" class="rp-resource-link" data-resource-document="${esc(r.documentId)}" data-resource-filename="${esc(r.filename||'document.pdf')}"><span>↓</span>${esc(r.title)}</button>`;
    if(r.type==='legacy_document')return `<button type="button" class="rp-resource-link rp-resource-link-demo" disabled title="Document historique à rattacher à la médiathèque"><span>PDF</span>${esc(r.title)}</button>`;
    if(r.url)return `<a class="rp-resource-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><span>↗</span>${esc(r.title)}</a>`;
    return `<button type="button" class="rp-resource-link rp-resource-link-demo" title="Exemple fictif dans l’aperçu"><span>›</span>${esc(r.title)}</button>`;
  }).join('');
  return `<section class="rp-resources"><button type="button" class="rp-resource-toggle" data-resource-toggle><span>Approfondissez vos connaissances</span><span aria-hidden="true">⌄</span></button><div class="rp-resource-body" data-resource-body hidden>${rows}<p class="rp-report-preview-note" data-resource-download-note hidden></p></div></section>`
}

function reportDownloadHtml(){return `<button type="button" class="rp-report-download" data-report-download>Téléchargez ce rapport (PDF)</button><p class="rp-report-preview-note" data-report-note hidden>Aperçu : aucun PDF n’est généré.</p>`}

function radarValue(result,chapter){
  const avg=result?.avg;if(!Number.isFinite(avg))return 0;
  const profiles=chapter.profiles||[];if(!profiles.length)return 50;
  const min=Math.min(...profiles.map(p=>num(p.scoring_min,0))),max=Math.max(...profiles.map(p=>num(p.scoring_max,0)));
  if(max<=min)return 50;
  return Math.max(8,Math.min(100,((avg-min)/(max-min))*100));
}
function radarSvg(){
  const n=d.chapters.length;if(n<3)return'';const cx=180,cy=170,r=112,pts=(radius)=>Array.from({length:n},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return[cx+Math.cos(a)*radius,cy+Math.sin(a)*radius]});
  const rings=[.25,.5,.75,1].map(f=>`<polygon points="${pts(r*f).map(p=>p.join(',')).join(' ')}" class="rp-radar-ring"/>`).join('');
  const axes=pts(r).map(p=>`<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" class="rp-radar-axis"/>`).join('');
  const vals=d.chapters.map((c,i)=>radarValue(chapterResults[i],c));
  const dataPts=Array.from({length:n},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n,rr=r*vals[i]/100;return[cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]});
  const labels=pts(r+28).map((p,i)=>`<text x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="middle" class="rp-radar-label">${esc((d.chapters[i].title||`Partie ${i+1}`).length>22?`Partie ${i+1}`:d.chapters[i].title)}</text>`).join('');
  return `<div class="rp-radar-wrap"><h2>Vue d’ensemble</h2><p>Position de vos scores sur l’échelle propre à chaque partie.</p><svg class="rp-radar" viewBox="0 0 360 340" role="img" aria-label="Graphique radar des scores par partie">${rings}${axes}<polygon points="${dataPts.map(p=>p.join(',')).join(' ')}" class="rp-radar-data"/>${dataPts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" class="rp-radar-dot"/>`).join('')}${labels}</svg></div>`
}
function done(){
  chapterResults=d.chapters.map((c,i)=>({avg:chapterAverage(i),profile:profileForScore(c.profiles,chapterAverage(i))}));
  root.innerHTML=head('Récapitulatif des résultats')+`<section class="rp-card rp-final"><div class="rp-kicker">Vos résultats</div><h1>Récapitulatif de vos profils</h1><p class="rp-help">Voici la restitution que verra le répondant. La comparaison avec les collègues est fictive dans cet aperçu et aucune donnée n’est enregistrée.</p>${radarSvg()}<div class="rp-final-list">${d.chapters.map((c,i)=>{const r=chapterResults[i],p=r.profile,t=profileTone(p);return`<article class="rp-final-profile ${t}"><div class="rp-final-profile-head"><span>Partie ${i+1}</span><strong>${esc(c.title)}</strong></div><h2>${esc(p?.title||'Profil indisponible')}</h2>${p?.summary?`<p>${esc(p.summary)}</p>`:''}${colleaguesHtml(c,r,i)}</article>`}).join('')}</div><div class="rp-final-tools">${reportDownloadHtml()}${resourcesHtml()}</div><div class="rp-actions"><button id="again" class="button button-secondary">Recommencer l’aperçu</button></div></section>`;
  bindFinalInteractions();
  $('#again').onclick=()=>{step=-1;ci=qi=0;socioChoices={};answers={};chapterResults=[];norm.lastShuffleSeed=Date.now();render()}
}
function render(){if(step<0)intro();else if(step===0)socio();else if(step===1)question();else if(step===2)showChapterResult();else if(step===3)showChapterResult();bindLanguagePicker()}
async function loadPreviewData(preserveStep=false){try{
  if(mode==='project'&&pid){
    if(liveProjectPreview){
      const base=await api(`/api/projects/${pid}/composer?respondentPreview=1`);
      const context=projectPreviewContext(base);
      previewCountries=context.countries;
      previewCountryLocales=context.byCountry;
      previewCountry=previewCountries.length===1?previewCountries[0]:'';
      availablePreviewLocales=previewCountry?(previewCountryLocales[previewCountry]||[]):[];
      previewLocale=availablePreviewLocales.length===1?availablePreviewLocales[0]:'';
      contextLoading=false;
      contextError='';
      if(previewCountry&&previewLocale){
        const exact=await api(`/api/projects/${pid}/composer?respondentPreview=1&countryCode=${encodeURIComponent(previewCountry)}&locale=${encodeURIComponent(previewLocale)}`);
        norm(exact);
      }else norm(base);
    }else{
      const base=await api(`/api/projects/${pid}/composer?respondentPreview=1&locale=${encodeURIComponent(previewLocale)}`);
      previewCountry=String(base.project?.selected_country_code||'FR').toUpperCase();
      const campaignLocale=String(base.project?.selected_locale||'fr').toLowerCase().replaceAll('_','-');
      availablePreviewLocales=[campaignLocale];
      previewLocale=campaignLocale;
      norm(base);
    }
  }else{
    previewCountry='FR';
    try{const v=await api(`/api/catalog/themes/${encodeURIComponent(theme)}/variants`);const fr=(v.variants||[]).find(x=>String(x.countryCode||'').toUpperCase()==='FR');availablePreviewLocales=(fr?.locales||['fr']).map(x=>String(x).toLowerCase().replaceAll('_','-'));if(!availablePreviewLocales.includes(previewLocale))previewLocale=availablePreviewLocales.includes('fr')?'fr':availablePreviewLocales[0];}catch(_){availablePreviewLocales=['fr'];previewLocale='fr';}
    norm(await api(`/api/catalog/themes/${encodeURIComponent(theme)}/template?countryCode=FR&locale=${encodeURIComponent(previewLocale)}`));
  }
  if(!preserveStep)resetPreviewProgress();
  render();bindLanguagePicker();
}catch(e){root.innerHTML=head()+`<section class="rp-card"><h1>Aperçu indisponible</h1><p>${esc(e.message)}</p></section>`;bindLanguagePicker();}}
loadPreviewData();})();
