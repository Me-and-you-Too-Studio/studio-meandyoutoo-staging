(()=>{
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),clean=h=>{let x=document.createElement('div');x.innerHTML=h||'';return(x.textContent||'').trim()},q=new URLSearchParams(location.search),pid=q.get('projectId'),theme=q.get('theme')||'',mode=q.get('mode')||(pid?'project':'catalog'),root=$('#rp');
let d,ci=0,qi=0,step=-1,socioChoices={},answers={},chapterResults=[];

async function api(u){
  if(window.StudioAPI&&typeof window.StudioAPI.request==='function')return window.StudioAPI.request(u);
  const host=String(location.hostname||'').toLowerCase(),path=String(location.pathname||'').toLowerCase();
  const staging=host==='localhost'||host==='127.0.0.1'||host.includes('staging')||path.includes('/studio-meandyoutoo-staging/');
  const base=staging?'https://studio-meandyoutoo-api-staging.osc-fr1.scalingo.io':'https://studio-meandyoutoo-api.osc-fr1.scalingo.io';
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
function normalizeOptions(s){return (s.opts||s.options||[]).map((o,i)=>typeof o==='object'?{...o,label:o.label||o.text||o.value||`Réponse ${i+1}`}:{label:String(o)})}
function normalizeSocio(list){return (Array.isArray(list)?list:[]).filter(Boolean).map((s,i)=>({key:String(s.kind||s.key||s.source_id||i),label:s.q||s.question||s.label||s.name||s.title||`Question ${i+1}`,options:normalizeOptions(s)})).filter(s=>s.options.length)}
function fallbackSocio(){return [{key:'gender',label:'Vous êtes :',options:[{label:'Une femme'},{label:'Un homme'},{label:'Non-binaire'},{label:'Autre'}]}]}
function normalizeProfile(p){return {...p,title:p.title||p.titre||'Profil',summary:clean(p.summary||p.resume||p.phrase||''),content:clean(p.content||p.description||p.desc||''),scoring_min:num(p.scoring_min??p.min,0),scoring_max:num(p.scoring_max??p.max,0),top_score:num(p.top_score,0)}}
function normalizeAnswer(a,i){return typeof a==='object'?{...a,label:a.text||a.content||a.label||`Réponse ${i+1}`,score:num(a.score,0)}:{label:String(a),score:0}}
function normalizeResources(list){return (Array.isArray(list)?list:[]).map((r,i)=>({title:String(r?.title||r?.titre||r?.label||r?.text||`Ressource ${i+1}`).trim(),url:String(r?.url||r?.href||r?.link||'').trim()})).filter(r=>r.title&&/^https?:\/\//i.test(r.url))}
function norm(x){
  let pr=x.project||{},live=mode==='project'?JSON.parse(sessionStorage.getItem('meayt_preview')||'null'):null;
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
      situations:(c.situations||c.questions||[]).map((s,sidx)=>({id:s.id||s.source_id||`${cidx}-${sidx}`,content:s.content||s.original_content||s.text||'',answers:shuffle((s.answers||[]).map(normalizeAnswer))}))
    }))
  };
  if(live?.project){
    if(live.project.respondent_title||live.project.title)d.title=live.project.respondent_title||live.project.title;
    if(live.project.introduction_html||live.project.intro)d.intro=clean(live.project.introduction_html||live.project.intro);
    if(Array.isArray(live.project.sociodemo))d.socio=normalizeSocio(live.project.sociodemo);
    if(Array.isArray(live.project.result_buttons))d.resources=normalizeResources(live.project.result_buttons);
  }
  if(live?.chapters){
    const profileMap=new Map(d.chapters.map(c=>[String(c.id),c.profiles]));
    d.chapters=live.chapters.map((c,cidx)=>({
      id:c.id||c.source_id||cidx,title:c.title||`Partie ${cidx+1}`,
      profiles:(c.profiles||profileMap.get(String(c.id))||[]).map(normalizeProfile),
      situations:(c.situations||[]).map((s,sidx)=>({id:s.id||s.source_id||`${cidx}-${sidx}`,content:s.content||s.original_content||'',answers:shuffle((s.answers||[]).map(normalizeAnswer))}))
    }));
  }
  d.chapters=d.chapters.filter(c=>c.situations.length);
  // Un aperçu catalogue doit toujours illustrer l'étape de données d'analyse.
  if(mode==='catalog'&&!d.socio.length)d.socio=fallbackSocio();
}

const modeLabel=()=>mode==='project'?'Votre campagne composée':'Version catalogue Me&YouToo';
const head=t=>`<header class="rp-head"><img src="assets/img/brand/logo-meayt-color.png"><div><b>${mode==='project'?'Aperçu de ma campagne':'Aperçu répondant'}</b><span>${esc(t||modeLabel())}</span></div></header>`;
const totalSituations=()=>d.chapters.reduce((n,c)=>n+c.situations.length,0);
const situationNumber=()=>d.chapters.slice(0,ci).reduce((n,c)=>n+c.situations.length,0)+qi+1;
const answerKey=(c=ci,s=qi)=>`${c}:${s}`;

function intro(){root.innerHTML=head()+`<section class="rp-card rp-intro"><em>${esc(modeLabel())}</em><h1>${esc(d.title)}</h1><p class="rp-intro-copy">${esc(d.intro)}</p><aside>${mode==='project'?'Cet aperçu reprend le contenu actuellement composé et paramétré pour cette campagne.':'Cet aperçu présente le parcours standard proposé dans le catalogue, avant personnalisation.'} Les réponses utilisées ici servent uniquement à calculer le rendu de l’aperçu et ne sont jamais enregistrées.</aside><button id="start" class="button button-primary">Commencer l’autodiagnostic</button></section>`;$('#start').onclick=()=>{step=0;render()}}

function socio(){
  if(!d.socio.length){step=1;render();return}
  root.innerHTML=head('Informations répondant')+`<section class="rp-card"><div class="rp-kicker">Données d’analyse</div><h1>Mieux comprendre les résultats collectifs</h1><p class="rp-help">Choisissez une réponse pour chaque critère. Dans cet aperçu, ces données sont fictives et ne sont pas enregistrées.</p><div class="rp-socio-list">${d.socio.map((s,i)=>`<fieldset class="rp-socio"><legend>${esc(s.label)} <span aria-hidden="true">*</span></legend><div class="rp-socio-options">${s.options.map((o,j)=>`<button type="button" class="rp-choice ${socioChoices[i]===j?'selected':''}" data-socio="${i}" data-option="${j}">${esc(o.label)}</button>`).join('')}</div></fieldset>`).join('')}</div><div class="rp-actions"><button id="next" class="button button-primary" ${d.socio.every((_,i)=>socioChoices[i]!==undefined)?'':'disabled'}>Continuer</button></div></section>`;
  root.querySelectorAll('[data-socio]').forEach(b=>b.onclick=()=>{socioChoices[Number(b.dataset.socio)]=Number(b.dataset.option);socio()});
  $('#next').onclick=()=>{if(!d.socio.every((_,i)=>socioChoices[i]!==undefined))return;step=1;render()}
}

function question(){
  let ch=d.chapters[ci],s=ch?.situations?.[qi];if(!s){done();return}
  const selected=answers[answerKey()];
  root.innerHTML=head(`Partie ${ci+1} sur ${d.chapters.length}`)+`<section class="rp-card"><div class="rp-progress-row"><div><span>Partie ${ci+1}/${d.chapters.length}</span><strong class="rp-chapter-title">${esc(ch.title)}</strong></div><span>Situation ${qi+1} / ${ch.situations.length}</span></div><div class="rp-bar"><i style="width:${Math.round(((qi+1)/Math.max(1,ch.situations.length))*100)}%"></i></div><h1>${esc(s.content)}</h1><p class="rp-help">Choisissez la réponse qui correspond le mieux à ce que vous pensez ou feriez spontanément.</p><div class="rp-answers">${(s.answers||[]).map((a,i)=>`<button type="button" class="rp-answer ${selected===i?'selected':''}" data-i="${i}"><span>${String.fromCharCode(65+i)}</span>${esc(a.label)}</button>`).join('')}</div><div class="rp-actions"><button id="prev" class="button button-secondary">Précédent</button><button id="next" class="button button-primary" ${selected===undefined?'disabled':''}>Continuer</button></div></section>`;
  root.querySelectorAll('.rp-answer').forEach(b=>b.onclick=()=>{answers[answerKey()]=Number(b.dataset.i);question()});
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
  root.innerHTML=head(`Résultat de la partie ${ci+1}`)+`<section class="rp-card rp-profile ${tone}"><div class="rp-kicker rp-kicker-neutral">Votre profil · Partie ${ci+1}/${d.chapters.length}</div><div class="rp-profile-chapter">${esc(ch.title)}</div>${p?`<h1>${esc(p.title)}</h1>${p.summary?`<p class="rp-profile-summary">${esc(p.summary)}</p>`:''}${p.content&&p.content!==p.summary?`<div class="rp-profile-content">${esc(p.content)}</div>`:''}`:`<h1>Profil indisponible</h1><p>Le contenu de profil de cette partie n’est pas disponible.</p>`}<div class="rp-actions"><button id="next" class="button button-primary">${ci===d.chapters.length-1?'Voir le récapitulatif':'Continuer vers la partie suivante'}</button></div></section>`;
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
function bindFinalInteractions(){
  root.querySelectorAll('[data-colleague-toggle]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.colleagueToggle,body=root.querySelector(`[data-colleague-body="${id}"]`),open=body&&!body.hidden;if(body)body.hidden=open;btn.classList.toggle('open',!open);btn.querySelector('span:last-child').textContent=open?'⌄':'⌃';});
  const resourceToggle=root.querySelector('[data-resource-toggle]');if(resourceToggle)resourceToggle.onclick=()=>{const body=root.querySelector('[data-resource-body]'),open=body&&!body.hidden;if(body)body.hidden=open;resourceToggle.classList.toggle('open',!open);resourceToggle.querySelector('span:last-child').textContent=open?'⌄':'⌃';};
  const reportBtn=root.querySelector('[data-report-download]');if(reportBtn)reportBtn.onclick=()=>{const note=root.querySelector('[data-report-note]');if(note){note.hidden=false;setTimeout(()=>{note.hidden=true},2600)}};
}
function resourcesHtml(){
  const catalogResources=[
    {title:'Contactez vos référents',url:''},
    {title:'Consultez notre règlement intérieur',url:''},
    {title:'Découvrez nos ressources internes',url:''}
  ];
  const list=mode==='catalog'?catalogResources:(d.resources||[]);
  if(!list.length)return'';
  return `<section class="rp-resources"><button type="button" class="rp-resource-toggle" data-resource-toggle><span>Approfondissez vos connaissances</span><span aria-hidden="true">⌄</span></button><div class="rp-resource-body" data-resource-body hidden>${list.map((r,i)=>r.url?`<a class="rp-resource-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><span>↗</span>${esc(r.title)}</a>`:`<button type="button" class="rp-resource-link rp-resource-link-demo" title="Exemple fictif dans l’aperçu"><span>›</span>${esc(r.title)}</button>`).join('')}</div></section>`
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
function render(){if(step<0)intro();else if(step===0)socio();else if(step===1)question();else if(step===2)showChapterResult()}
(async()=>{try{let x=mode==='project'&&pid?await api(`/api/projects/${pid}/composer`):await api(`/api/catalog/themes/${theme}/template`);norm(x);render()}catch(e){root.innerHTML=head()+`<section class="rp-card"><h1>Aperçu indisponible</h1><p>${esc(e.message)}</p></section>`}})()})();
