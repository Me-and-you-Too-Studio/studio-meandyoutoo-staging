(()=>{
  const p=new URLSearchParams(location.search),theme=p.get('theme')||'sexisme',projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt);
  let baseTitle='';let socio=[];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stripHtml=v=>{let html=String(v||'');const start=html.indexOf('« Nous entendons');if(start>=0)html=html.slice(start);const d=document.createElement('div');d.innerHTML=html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<\/li>/gi,'\n');return (d.textContent||'').replace(/\n{3,}/g,'\n\n').trim();};
  const iso=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10);};
  const defaultSocio=()=>[
    {q:'Quel est votre genre ?',opts:[{label:'Femme',n:0},{label:'Homme',n:0},{label:'Autre / Je ne souhaite pas répondre',n:0}]},
    {q:'Quelle est votre tranche d’âge ?',opts:[{label:'Moins de 30 ans',n:0},{label:'30 à 44 ans',n:0},{label:'45 à 54 ans',n:0},{label:'55 ans et plus',n:0}]}
  ];
  function show(m){const a=$('param-alert');a.hidden=false;a.textContent=m;}
  function renderSocio(){
    $('socio-list').innerHTML=socio.map((s,i)=>`<article class="socio-card"><div class="socio-card-head"><span class="socio-number"><small>Critère</small>${i+1}</span><div class="field socio-question"><label>Question posée aux répondants</label><input data-socio-q="${i}" value="${esc(s.q)}"></div><button class="button button-danger-soft" type="button" data-socio-remove="${i}" ${socio.length<=1?'disabled':''}>Supprimer</button></div><div class="socio-options-title"><span>Réponses proposées</span><span>Effectif estimé</span></div><div class="socio-options">${s.opts.map((o,j)=>`<div class="socio-option"><input data-opt-label="${i}:${j}" value="${esc(o.label)}" aria-label="Réponse possible"><input data-opt-n="${i}:${j}" type="number" min="0" value="${Number(o.n)||0}" aria-label="Effectif estimé"><button type="button" class="socio-option-remove" data-opt-remove="${i}:${j}" ${s.opts.length<=2?'disabled':''}>×</button></div>`).join('')}</div><button class="button button-ghost" type="button" data-opt-add="${i}">+ Ajouter une réponse</button></article>`).join('');
    bindSocio();updateVigilance();
  }
  function bindSocio(){
    document.querySelectorAll('[data-socio-q]').forEach(el=>el.oninput=()=>{socio[+el.dataset.socioQ].q=el.value;});
    document.querySelectorAll('[data-opt-label]').forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.optLabel.split(':').map(Number);socio[i].opts[j].label=el.value;});
    document.querySelectorAll('[data-opt-n]').forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.optN.split(':').map(Number);socio[i].opts[j].n=Number(el.value)||0;updateVigilance();});
    document.querySelectorAll('[data-socio-remove]').forEach(el=>el.onclick=()=>{socio.splice(+el.dataset.socioRemove,1);renderSocio();});
    document.querySelectorAll('[data-opt-remove]').forEach(el=>el.onclick=()=>{const [i,j]=el.dataset.optRemove.split(':').map(Number);socio[i].opts.splice(j,1);renderSocio();});
    document.querySelectorAll('[data-opt-add]').forEach(el=>el.onclick=()=>{socio[+el.dataset.optAdd].opts.push({label:'Nouvelle réponse',n:0});renderSocio();});
  }
  function updateVigilance(){
    const total=Number($('nb-respondents').value)||0;const counts=socio.flatMap(s=>s.opts.map(o=>Number(o.n)||0)).filter(n=>n>0);const min=counts.length?Math.min(...counts):0;const missing=socio.flatMap(s=>s.opts).filter(o=>!Number(o.n)).length;let level='Faible',cls='low',text='Les groupes estimés sont suffisamment larges.';if(!total||!counts.length){level='À compléter';cls='';text='Renseignez les effectifs estimés par option.';}else if(min<8||socio.length>=4){level='Élevé';cls='high';text='Des groupes sont trop petits ou les croisements sont trop nombreux.';}else if(min<10||socio.length>=3){level='Modéré';cls='medium';text='Certains croisements devront être interprétés avec prudence.';}
    $('anonymity-level').textContent=level;$('anonymity-level').className='anonymity-level '+cls;$('anonymity-summary-text').textContent=text;$('anonymity-metrics').innerHTML=`<span>${socio.length} critère(s)</span><span>Plus petit groupe : ${min||'—'}</span><span>${missing} effectif(s) manquant(s)</span>`;
  }
  async function load(){
    try{
      if(!projectId){const project=await window.StudioProject.createOrResume(theme);location.replace(`parametrage.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(project.id)}`);return;}
      const d=await api(`/api/projects/${projectId}/composer`),meta=d.project||{};baseTitle=meta.base_title||meta.theme_title||meta.title||'Compréhension du sexisme';
      $('param-theme').textContent=meta.theme_title||'Compréhension du sexisme';$('campaign-name').value=meta.campaign_name||baseTitle;$('respondent-title').value=meta.respondent_title||meta.respondent_title_default||baseTitle;$('intro').value=stripHtml(meta.introduction_html||meta.theme_introduction_html||'');$('launch-date').min=iso(5);$('launch-date').value=meta.launch_date?String(meta.launch_date).slice(0,10):iso(5);$('close-date').value=meta.close_date?String(meta.close_date).slice(0,10):'';$('nb-respondents').value=meta.estimated_respondents||'';socio=Array.isArray(meta.sociodemo)&&meta.sociodemo.length?meta.sociodemo:defaultSocio();renderSocio();$('param-back').href=`personnalisation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:'parametrage'})});
    }catch(e){show(e.message);}
  }
  $('add-socio').onclick=()=>{socio.push({q:'Nouvelle donnée',opts:[{label:'Réponse 1',n:0},{label:'Réponse 2',n:0}]});renderSocio();};$('nb-respondents').oninput=updateVigilance;
  $('settings-form').addEventListener('submit',async e=>{e.preventDefault();const campaignName=$('campaign-name').value.trim(),respondentTitle=$('respondent-title').value.trim(),introductionHtml=$('intro').value.trim(),launchDate=$('launch-date').value,closeDate=$('close-date').value,nbRespondents=Number($('nb-respondents').value)||0;if(!respondentTitle||!introductionHtml)return show('Le titre visible et l’introduction sont obligatoires.');if(launchDate<iso(5))return show('La date de lancement doit être au minimum à J+5.');if(closeDate&&closeDate<=launchDate)return show('La date de clôture doit être postérieure à la date de lancement.');if(!nbRespondents||!socio.length)return show('Indiquez le nombre de répondants et au moins une donnée d’analyse.');if(socio.some(s=>!s.q.trim()||s.opts.length<2||s.opts.some(o=>!o.label.trim())))return show('Chaque donnée doit avoir un intitulé et au moins deux réponses renseignées.');try{await api(`/api/projects/${projectId}/settings`,{method:'PATCH',body:JSON.stringify({campaignName,respondentTitle,introductionHtml,launchDate,closeDate,nbRespondents,sociodemo:socio})});location.href=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;}catch(err){show(err.message);}});
  load();
})();
