(()=>{
  const p=new URLSearchParams(location.search);let theme=p.get('theme')||'',projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt);let baseTitle='',socio=[],socioLanguageVariants={},introVariants={},introResolvedVariants={},socioContextCountry='',socioContextLocale='',socioContextBaseline='',socioContextHasStored=false,introContextBaseline='',introContextHasStored=false,resultResources=[],resourceLibrary=[],quota=null,referenceIntro='',project=null;
  let autosaveTimer=null,autosaveInFlight=null,autosavePending=false,autosaveEnabled=false,lastSavedFingerprint='';
  const currentUser=window.StudioAPI.user&&window.StudioAPI.user()||{},canOrder=currentUser.role==='admin'||Boolean(currentUser.permissions&&currentUser.permissions.order_passations);
  const isReadOnly=()=>Boolean(project&&project.can_edit===false);
  const isLegacyClientCampaign=()=>Boolean(project&&(project.source_type==='legacy_client'||project.legacy_history===true||project.legacy_source==='meayt-legacy'));
  const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stripHtml=v=>{let html=String(v||'');const start=html.indexOf('« Nous entendons');if(start>=0)html=html.slice(start);const d=document.createElement('div');d.innerHTML=html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<\/li>/gi,'\n');return(d.textContent||'').replace(/\n{3,}/g,'\n\n').trim();};
  const slugify=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' et ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  const iso=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10);};
  const defaultSocio=()=>theme==='sexisme'?[{kind:'gender',q:'Quel est votre genre ?',opts:[{label:'Homme',n:0},{label:'Femme',n:0},{label:'Non binaire',n:0},{label:'Autre',n:0}]}]:[];
  const AGE={kind:'age',q:'Votre âge',opts:['Moins de 20 ans','Entre 20 et 34 ans','Entre 35 et 49 ans','Entre 50 et 65 ans','Plus de 65 ans'].map(label=>({label,n:0}))};
  const EXAMPLES=[['Business Unit',['Business Unit 1','Business Unit 2']],['Régions',['Région 1','Région 2']],['Fonction',['Fonction 1','Fonction 2']],['Manager ou collaborateur',['Manager','Collaborateur']]];
  const newSubcriterion=()=>({q:'Précisez votre choix',opts:[{label:'Sous-réponse 1',n:0},{label:'Sous-réponse 2',n:0}],subcriteria:[]});
  const rawSubcriteria=option=>Array.isArray(option?.subcriteria)?option.subcriteria:(option?.subcriterion?[option.subcriterion]:[]);
  function normalizeCriterion(item){
    return {
      ...(item?.kind?{kind:String(item.kind)}:{}),
      ...(item?.source_id!==undefined?{source_id:item.source_id}:{}),
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
  const normalizeLocale=value=>String(value||'fr').trim().toLowerCase().replaceAll('_','-')||'fr';
  const normalizeSocioLanguageVariants=(value,sourceSurveyId='')=>{const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;const surveyId=String(sourceSurveyId||'').trim();const scoped=surveyId&&value.bySurvey&&typeof value.bySurvey==='object'&&!Array.isArray(value.bySurvey)&&value.bySurvey[surveyId]&&typeof value.bySurvey[surveyId]==='object'&&!Array.isArray(value.bySurvey[surveyId])?value.bySurvey[surveyId]:value;const add=(locale,items)=>{const loc=normalizeLocale(locale);if(loc&&Array.isArray(items)&&!out[loc])out[loc]=normalizedSocio(items);};for(const [key,items] of Object.entries(scoped)){if(key==='bySurvey')continue;if(Array.isArray(items))add(key,items);}const buckets=Object.entries(scoped).filter(([key,val])=>key!=='bySurvey'&&val&&typeof val==='object'&&!Array.isArray(val));buckets.sort(([a],[b])=>{const rank=k=>k==='250'?0:['ALL','*','default'].includes(k)?1:2;return rank(a)-rank(b)||String(a).localeCompare(String(b));});for(const [,locales] of buckets)for(const [locale,items] of Object.entries(locales||{}))add(locale,items);return out;};
  const normalizeIntroVariants=value=>{const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;for(const [locale,text] of Object.entries(value)){const loc=normalizeLocale(locale),v=String(text??'').trim();if(loc&&v)out[loc]=v;}return out;};
  const countryLabel=code=>{try{return new Intl.DisplayNames(['fr'],{type:'region'}).of(code)||code}catch(_){return code}};
  const localeLabel=code=>{const labels={fr:'Français',en:'Anglais',de:'Allemand',es:'Espagnol',it:'Italien',pt:'Portugais',br:'Portugais (Brésil)','pt-br':'Portugais (Brésil)',nl:'Néerlandais','nl-be':'Néerlandais (Belgique)',pl:'Polonais',ro:'Roumain',ru:'Russe',tr:'Turc',bg:'Bulgare',ja:'Japonais',ko:'Coréen','ko-kr':'Coréen',zh:'Chinois',zf:'Chinois traditionnel','sv-se':'Suédois',ar:'Arabe',sk:'Slovaque'};return labels[normalizeLocale(code)]||String(code||'').toUpperCase();};
  function projectCountries(){const raw=Array.isArray(project?.countries)?project.countries:[];const selected=normalizeCountry(project?.selected_country_code);return [...new Set([...raw.map(normalizeCountry),selected].filter(Boolean))];}
  function projectLocales(){const values=[];if(Array.isArray(project?.content_locales))values.push(...project.content_locales);if(Array.isArray(project?.locales))values.push(...project.locales);if(project?.selected_locale)values.push(project.selected_locale);const map=project?.country_locales&&typeof project.country_locales==='object'&&!Array.isArray(project.country_locales)?project.country_locales:{};for(const rows of Object.values(map))if(Array.isArray(rows))values.push(...rows);values.push(...Object.keys(socioLanguageVariants||{}),...Object.keys(introVariants||{}),...Object.keys(introResolvedVariants||{}));return [...new Set(values.map(normalizeLocale).filter(Boolean))];}
  function socioForLocale(locale){const loc=normalizeLocale(locale);return Array.isArray(socioLanguageVariants?.[loc])?clone(socioLanguageVariants[loc]):null;}
  function introForLocale(locale){const loc=normalizeLocale(locale),primary=normalizeLocale(project?.selected_locale||(Array.isArray(project?.locales)&&project.locales[0])||'fr');if(introVariants?.[loc]!==undefined)return String(introVariants[loc]||'');if(introResolvedVariants?.[loc]!==undefined)return String(introResolvedVariants[loc]||'');return loc===primary?String(project?.introduction_html??project?.theme_introduction_html??''):'';}
  function storeActiveSocio(){if(!socioContextLocale)return;const normalized=normalizedSocio(socio),serialized=JSON.stringify(normalized);if(!socioContextHasStored&&serialized===socioContextBaseline)return;const loc=normalizeLocale(socioContextLocale);socioLanguageVariants[loc]=clone(normalized);socioContextHasStored=true;socioContextBaseline=serialized;}
  function storeActiveIntro(){if(!socioContextLocale||!$('intro'))return;const current=String($('intro').value||'').trim();if(!introContextHasStored&&current===introContextBaseline)return;const loc=normalizeLocale(socioContextLocale);if(current)introVariants[loc]=current;else delete introVariants[loc];introContextHasStored=Boolean(current);introContextBaseline=current;}
  function storeActiveLanguageContent(){storeActiveSocio();storeActiveIntro();}
  function activateLanguage(locale){socioContextLocale=normalizeLocale(locale);const countries=projectCountries();socioContextCountry=normalizeCountry(project?.selected_country_code)||(countries[0]||'');const exact=socioForLocale(socioContextLocale);socio=normalizeSexismeCriteria(normalizedSocio(exact||(Array.isArray(project?.sociodemo)&&project.sociodemo.length?project.sociodemo:defaultSocio())));socioContextHasStored=Boolean(exact);socioContextBaseline=JSON.stringify(normalizedSocio(socio));const intro=stripHtml(introForLocale(socioContextLocale));if($('intro'))$('intro').value=intro;introContextHasStored=Boolean(introVariants?.[socioContextLocale]);introContextBaseline=String(intro||'').trim();socioOpenRoots.clear();socioOpenBranches.clear();}
  function renderSocioContext(){const introWrap=$('socio-context'),introSelect=$('socio-locale'),introNote=$('socio-context-note'),dsdWrap=$('socio-dsd-context'),dsdSelect=$('socio-dsd-locale'),dsdNote=$('socio-dsd-context-note');if(!introWrap||!introSelect)return;const locales=projectLocales();if(!locales.length){introWrap.hidden=true;if(dsdWrap)dsdWrap.hidden=true;return;}introWrap.hidden=false;if(dsdWrap)dsdWrap.hidden=false;const currentLocale=locales.includes(normalizeLocale(socioContextLocale))?normalizeLocale(socioContextLocale):(locales[0]||'fr');const options=locales.map(loc=>`<option value="${esc(loc)}">${esc(localeLabel(loc))} (${esc(loc.toUpperCase())})</option>`).join('');introSelect.innerHTML=options;introSelect.value=currentLocale;if(dsdSelect){dsdSelect.innerHTML=options;dsdSelect.value=currentLocale;}socioContextLocale=currentLocale;if(introNote)introNote.textContent='Cette version de l’introduction est enregistrée pour la langue sélectionnée.';if(dsdNote)dsdNote.textContent='Cette version des DSD est enregistrée pour la langue sélectionnée.';const changeLocale=nextLocale=>{storeActiveLanguageContent();scheduleAutosave(0);activateLanguage(nextLocale);renderSocioContext();renderSocio();};introSelect.onchange=()=>changeLocale(introSelect.value);if(dsdSelect)dsdSelect.onchange=()=>changeLocale(dsdSelect.value);}
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

  function normalizeSexismeCriteria(items){
    if(theme!=='sexisme')return items.filter(c=>!isBlankAutoCriterion(c));
    let cleaned=items.filter(c=>!isBlankAutoCriterion(c));
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
    const ro=isReadOnly(),stats=criterionStats(criterion),isOpen=socioOpenBranches.has(path);
    const options=(criterion.opts||[]).map((option,j)=>{
      const optionPath=`${path}|${j}`;
      const children=(option.subcriteria||[]).map((child,k)=>renderNestedCriterion(child,`${path}.${j}.${k}`,level+1,option.label)).join('');
      return `<div class="socio-option-block">${answerRow(option,optionPath,criterion.opts.length>2)}${children}${ro?'':`<button class="socio-add-sub" type="button" data-tree-child-add="${optionPath}">+ Ajouter une sous-question pour cette réponse</button>`}</div>`;
    }).join('');
    const nestedLabel=stats.nested?` · ${stats.nested} sous-branche${stats.nested>1?'s':''}`:'';
    const depthLabel=stats.maxDepth>1?` · jusqu’au niveau ${level+stats.maxDepth-1}`:'';
    return `<div class="socio-subcriterion ${isOpen?'is-open':'is-collapsed'}" style="--socio-depth:${Math.min(level,8)}">
      <div class="socio-sub-summary">
        <button type="button" class="socio-sub-toggle" data-socio-branch-toggle="${path}" aria-expanded="${isOpen}">
          <span class="socio-sub-summary-main"><span class="socio-level-badge">Niveau ${level} · si « ${esc(conditionLabel||'cette réponse')} »</span><strong>${esc(criterion.q||'Question complémentaire')}</strong><small>${stats.responses} réponse${stats.responses>1?'s':''}${nestedLabel}${depthLabel}</small></span>
          <span class="socio-chevron" aria-hidden="true">⌄</span>
        </button>
        ${ro?'':`<button type="button" class="socio-sub-remove" data-tree-criterion-remove="${path}">Retirer</button>`}
      </div>
      <div class="socio-sub-body" ${isOpen?'':'hidden'}>
        <div class="field"><label>Question complémentaire</label><input data-tree-q="${path}" value="${esc(criterion.q)}" ${ro?'readonly tabindex="-1"':''}></div>
        <div class="socio-sub-options">${options}</div>
        ${ro?'':`<button class="button button-ghost" type="button" data-tree-option-add="${path}">+ Ajouter une sous-réponse</button>`}
      </div>
    </div>`;
  }
  function renderSocio(){
    initSocioOpenState();
    const ro=isReadOnly();
    const toolbar=`<div class="socio-tree-toolbar"><div><strong>Données socio-démographiques</strong><span>Repliez les critères et ouvrez uniquement la branche que vous souhaitez modifier.</span></div><div class="socio-tree-toolbar-actions"><button type="button" class="button button-ghost button-small" data-socio-collapse-all>Tout replier</button><button type="button" class="button button-secondary button-small" data-socio-expand-all>Tout déplier</button></div></div>`;
    $('socio-list').innerHTML=toolbar+socio.map((criterion,i)=>{
      const path=String(i),isGender=theme==='sexisme'&&criterion.kind==='gender',isAge=theme==='sexisme'&&criterion.kind==='age',locked=isGender||isAge||ro,isOpen=socioOpenRoots.has(path),stats=criterionStats(criterion);
      const optionsHtml=criterion.opts.map((option,j)=>{
        const optionPath=`${path}|${j}`;
        if(locked){
          const state=optionState(option.n),genderRequired=isGender&&(option.label==='Homme'||option.label==='Femme'),canRemove=!ro&&isGender&&!genderRequired;
          const removeControl=canRemove?`<button type="button" class="socio-option-remove socio-option-remove-visible" data-tree-option-remove="${optionPath}" aria-label="Supprimer ${esc(option.label)}" title="Supprimer cette réponse facultative">×</button>`:`<span class="socio-option-spacer" aria-hidden="true"></span>`;
          const children=(option.subcriteria||[]).map((child,k)=>renderNestedCriterion(child,`${path}.${j}.${k}`,2,option.label)).join('');
          return `<div class="socio-option-block"><div class="socio-option-unit locked-option"><div class="socio-option"><div class="socio-answer-field locked-field"><span>Réponse figée</span><input value="${esc(option.label)}" readonly tabindex="-1" aria-label="Réponse non modifiable"></div><div class="socio-count-field ${state.cls}"><span>Effectif estimé</span><input data-tree-n="${optionPath}" type="number" min="0" value="${Number(option.n)||''}" readonly tabindex="-1"></div>${removeControl}</div><div class="socio-option-hint ${state.cls}">${state.hint}</div></div>${children}</div>`;
        }
        const children=(option.subcriteria||[]).map((child,k)=>renderNestedCriterion(child,`${path}.${j}.${k}`,2,option.label)).join('');
        return `<div class="socio-option-block">${answerRow(option,optionPath,criterion.opts.length>2)}${children}${ro?'':`<button class="socio-add-sub" type="button" data-tree-child-add="${optionPath}">+ Ajouter un sous-critère pour cette réponse</button>`}</div>`;
      }).join('');
      const lockText=ro?'Campagne en lecture seule.':isGender?'Obligatoire · réponses standardisées. Homme et Femme sont obligatoires ; Non binaire et Autre peuvent être supprimés.':isAge?'Tranches d’âge figées pour garantir des benchmarks comparables d’une organisation à l’autre.':'';
      const headerAction=ro?'<span class="socio-required-badge">🔒 Lecture seule</span>':isGender?`<span class="socio-required-badge">Obligatoire</span>`:`<button class="button button-danger-soft" type="button" data-socio-remove="${i}" ${socio.length<=1?'disabled':''}>Supprimer le critère</button>`;
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
          <div class="socio-card-head"><span class="socio-number socio-number-spacer" aria-hidden="true"></span><div class="field socio-question"><label>Question posée aux répondants ${locked?'<span class="socio-lock-badge">🔒 Figé</span>':''}</label><input data-tree-q="${path}" value="${esc(criterion.q)}" ${locked?'readonly tabindex="-1"':''}>${locked?`<span class="socio-lock-help">${lockText}</span>`:''}</div><span></span></div>
          <div class="socio-options">${optionsHtml}</div>${locked?'':`<button class="button button-ghost" type="button" data-tree-option-add="${path}">+ Ajouter une réponse</button>`}
        </div>
      </article>`;
    }).join('');bindSocio();updateVigilance();
  }
  function bindSocio(){
    document.querySelectorAll('[data-socio-root-toggle]').forEach(el=>el.onclick=()=>{const path=el.dataset.socioRootToggle;socioOpenRoots.has(path)?socioOpenRoots.delete(path):socioOpenRoots.add(path);renderSocio();});
    document.querySelectorAll('[data-socio-branch-toggle]').forEach(el=>el.onclick=()=>{const path=el.dataset.socioBranchToggle;socioOpenBranches.has(path)?socioOpenBranches.delete(path):socioOpenBranches.add(path);renderSocio();});
    document.querySelector('[data-socio-collapse-all]')?.addEventListener('click',()=>{socioOpenRoots.clear();socioOpenBranches.clear();renderSocio();});
    document.querySelector('[data-socio-expand-all]')?.addEventListener('click',()=>{socioOpenRoots.clear();socioOpenBranches.clear();socio.forEach((c,i)=>{const root=String(i);socioOpenRoots.add(root);const visit=(criterion,path)=>{(criterion.opts||[]).forEach((o,j)=>(o.subcriteria||[]).forEach((child,k)=>{const childPath=`${path}.${j}.${k}`;socioOpenBranches.add(childPath);visit(child,childPath);}));};visit(c,root);});renderSocio();});
    if(isReadOnly())return;
    document.querySelectorAll('[data-tree-q]').forEach(el=>el.oninput=()=>{const criterion=getCriterionByPath(el.dataset.treeQ);if(criterion){criterion.q=el.value;scheduleAutosave();}});
    document.querySelectorAll('[data-tree-label]').forEach(el=>el.oninput=()=>{const option=getOptionByPath(el.dataset.treeLabel);if(option){option.label=el.value;scheduleAutosave();}});
    document.querySelectorAll('[data-tree-n]').forEach(el=>el.oninput=()=>{const option=getOptionByPath(el.dataset.treeN);if(option){option.n=Number(el.value)||0;updateOptionVisual(el);scheduleAutosave();}});
    document.querySelectorAll('[data-socio-remove]').forEach(el=>el.onclick=()=>{socio.splice(+el.dataset.socioRemove,1);renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-tree-option-remove]').forEach(el=>el.onclick=()=>{const [criterionPath,index]=el.dataset.treeOptionRemove.split('|'),criterion=getCriterionByPath(criterionPath);criterion?.opts?.splice(Number(index),1);renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-tree-option-add]').forEach(el=>el.onclick=()=>{const criterion=getCriterionByPath(el.dataset.treeOptionAdd);criterion?.opts?.push({label:el.dataset.treeOptionAdd.includes('.')?'Nouvelle sous-réponse':'Nouvelle réponse',n:0,subcriteria:[]});renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-tree-child-add]').forEach(el=>el.onclick=()=>{const option=getOptionByPath(el.dataset.treeChildAdd);if(!option)return;option.subcriteria=Array.isArray(option.subcriteria)?option.subcriteria:[];option.subcriteria.push(newSubcriterion());renderSocio();scheduleAutosave(0);});
    document.querySelectorAll('[data-tree-criterion-remove]').forEach(el=>el.onclick=()=>{const info=criterionParentInfo(el.dataset.treeCriterionRemove);if(!info)return;const parent=getCriterionByPath(info.parentPath);parent?.opts?.[info.optionIndex]?.subcriteria?.splice(info.childIndex,1);renderSocio();scheduleAutosave(0);});
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
  function settingsReadiness(){const intro=$('intro').value.trim(),launch=$('launch-date').value,close=$('close-date').value;return{introChanged:Boolean(intro)&&normalizeIntro(intro)!==normalizeIntro(referenceIntro),launchFilled:Boolean(launch),closeFilled:Boolean(close),intro,launch,close};}
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
      sociodemoLanguageVariants:socioLanguageVariants
    };
  }
  function autosaveFingerprint(payload){try{return JSON.stringify(payload);}catch(_){return String(Date.now());}}
  async function autosaveNow(){
    if(!autosaveEnabled||isReadOnly()||!projectId)return true;
    if(autosaveInFlight){autosavePending=true;await autosaveInFlight;if(autosavePending){autosavePending=false;return autosaveNow();}return true;}
    const payload=autosavePayload(),fingerprint=autosaveFingerprint(payload);
    if(fingerprint===lastSavedFingerprint){autosaveStatus('✓ Enregistré automatiquement','saved');return true;}
    autosaveStatus('Enregistrement…','saving');
    autosaveInFlight=(async()=>{
      try{
        const data=await api(`/api/projects/${projectId}/settings/autosave`,{method:'PATCH',body:JSON.stringify(payload)});
        if(data?.project)project={...project,...data.project};
        lastSavedFingerprint=fingerprint;
        autosaveStatus('✓ Enregistré automatiquement','saved');
        return true;
      }catch(error){
        const message=String(error?.message||'').trim();
        if(/intitulé|réponse|critère|socio|date de clôture/i.test(message))autosaveStatus('Saisie en cours — enregistrement dès que le bloc est complet','pending');
        else autosaveStatus('⚠ Enregistrement automatique interrompu','error');
        return false;
      }finally{autosaveInFlight=null;}
    })();
    const ok=await autosaveInFlight;
    if(autosavePending){autosavePending=false;return autosaveNow();}
    return ok;
  }
  function scheduleAutosave(delay=700){
    if(!autosaveEnabled||isReadOnly())return;
    clearTimeout(autosaveTimer);autosaveStatus('Modifications en cours…','saving');
    autosaveTimer=setTimeout(()=>{autosaveTimer=null;autosaveNow();},delay);
  }
  async function flushAutosave(){clearTimeout(autosaveTimer);autosaveTimer=null;return autosaveNow();}
  function updateNextState(){const button=$('param-next');if(!button)return;if(isReadOnly()){button.classList.remove('is-disabled');button.setAttribute('aria-disabled','false');button.dataset.ready='true';button.title='';button.textContent='Revoir la transmission →';return;}const state=settingsReadiness(),ready=state.introChanged&&state.launchFilled&&state.closeFilled;button.classList.toggle('is-disabled',!ready);button.setAttribute('aria-disabled',String(!ready));button.dataset.ready=ready?'true':'false';button.title=ready?'':!state.introChanged?'Adaptez l’introduction avant de poursuivre.':'Renseignez les deux dates avant de poursuivre.';}
  async function showReadinessModal(){const state=settingsReadiness(),missing=[];if(!state.introChanged)missing.push('adapter l’introduction Me&YouToo à votre organisation');if(!state.launchFilled)missing.push('renseigner la date de lancement');if(!state.closeFilled)missing.push('renseigner la date de clôture');await window.StudioModal.alert({eyebrow:'Paramétrage incomplet',title:'Complétez les éléments obligatoires',message:`Avant de passer à l’étape suivante, vous devez ${missing.join(', puis ')}.`,type:'info',confirmLabel:'J’ai compris'});}
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
    const data=await api(`/api/projects/${projectId}/composer`),meta=data.project||{};project=meta;if(!theme)theme=meta.theme_slug||'';await Promise.all([loadQuota(),loadResourceLibrary()]);
    baseTitle=meta.base_title||meta.theme_title||meta.title||'Autodiagnostic';referenceIntro=stripHtml(meta.theme_introduction_html||'');$('param-theme').textContent=meta.theme_title||'Autodiagnostic';$('campaign-name').value=meta.campaign_name||baseTitle;$('respondent-title').value=meta.respondent_title||meta.respondent_title_default||baseTitle;const organizationName=meta.organization_name||quota?.name||'votre-entreprise';$('organization-slug').value=slugify(organizationName)||'votre-entreprise';$('organization-slug-note').textContent=`Généré depuis « ${organizationName} », renseigné dans Mon compte. Le lien définitif sera fourni par Me&YouToo.`;$('launch-date').min=isLegacyClientCampaign()?'':iso(5);$('launch-date').value=meta.launch_date?String(meta.launch_date).slice(0,10):(isLegacyClientCampaign()?'':iso(5));$('close-date').value=meta.close_date?String(meta.close_date).slice(0,10):'';syncCloseMin();$('nb-respondents').value=meta.estimated_respondents||'';const sourceSurveyId=String(meta.legacy_survey_id||meta.theme_legacy_id||'').trim(),themeSocioVariants=normalizeSocioLanguageVariants(meta.theme_sociodemo_variants,sourceSurveyId),legacyProjectSocioVariants=normalizeSocioLanguageVariants(meta.sociodemo_variants,sourceSurveyId),resolvedSocioVariants=normalizeSocioLanguageVariants(meta.sociodemo_language_variants_resolved||{},sourceSurveyId),storedSocioVariants=normalizeSocioLanguageVariants(meta.sociodemo_language_variants||{},sourceSurveyId);socioLanguageVariants={...themeSocioVariants,...legacyProjectSocioVariants,...resolvedSocioVariants,...storedSocioVariants};introResolvedVariants=normalizeIntroVariants(meta.introduction_variants_resolved||{});introVariants=normalizeIntroVariants(meta.introduction_variants||{});const countries=projectCountries();socioContextCountry=normalizeCountry(meta.selected_country_code)||(countries[0]||'');const locales=projectLocales();socioContextLocale=locales.includes(normalizeLocale(meta.selected_locale))?normalizeLocale(meta.selected_locale):(locales[0]||'fr');activateLanguage(socioContextLocale);resultResources=normalizeResultResources(meta.result_buttons);renderSocioContext();renderSocio();renderResultResources();renderQuota();const clientFolderLink=$('param-client-folder');if(clientFolderLink&&currentUser.role==='admin'&&meta.organization_id){clientFolderLink.hidden=false;clientFolderLink.href=`client.html?organizationId=${encodeURIComponent(meta.organization_id)}`;}$('param-back').href=`personnalisation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;
    if(isReadOnly())applyReadOnlyUI();else{if(project?.review_mode){const reviewUrl=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`,alert=$('param-alert');alert.hidden=false;alert.dataset.tone='success';alert.innerHTML='<strong>✎ Correction Me&YouToo active.</strong> Modifiez uniquement les paramètres nécessaires, puis revenez directement au contrôle qualité.';$('param-back').href=reviewUrl;$('param-back').textContent='← Retour au contrôle qualité';$('param-next').textContent='Enregistrer et revenir au contrôle qualité';}updateNextState();await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:'parametrage'})});autosaveEnabled=true;lastSavedFingerprint=autosaveFingerprint(autosavePayload());autosaveStatus('✓ Enregistré automatiquement','saved');}
  }catch(error){show(error.message);}}
  function syncCloseMin(){const d=$('launch-date').value;if(!d)return;const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+1);const min=x.toISOString().slice(0,10);$('close-date').min=min;if(!isReadOnly()&&$('close-date').value&&$('close-date').value<min)$('close-date').value='';}
  function invalidCriterion(c){return !String(c?.q||'').trim()||!Array.isArray(c?.opts)||c.opts.length<2||c.opts.some(o=>!String(o?.label||'').trim()||(o.subcriteria||[]).some(invalidCriterion));}
  function invalidSocio(){return socio.some(invalidCriterion);}
  $('add-socio').onclick=()=>{if(isReadOnly())return;socio.push({q:'',opts:[{label:'',n:0},{label:'',n:0}]});renderSocio();scheduleAutosave(0);};
  $('intro').addEventListener('input',()=>{if(!isReadOnly()){updateNextState();scheduleAutosave();}});
  $('launch-date').addEventListener('change',()=>{if(!isReadOnly()){syncCloseMin();updateNextState();scheduleAutosave(0);}});
  $('close-date').addEventListener('change',()=>{if(!isReadOnly()){updateNextState();scheduleAutosave(0);}});
  document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{if(isReadOnly())return;const k=b.dataset.example;if(k==='age'){if(!socio.some(c=>c.kind==='age'||c.q==='Votre âge'))socio.push(clone(AGE));}else{const e=EXAMPLES[+k];socio.push({q:e[0],opts:e[1].map(label=>({label,n:0}))});}renderSocio();scheduleAutosave(0);});
  $('add-result-resource').onclick=()=>openResourceModal();
  $('result-preview-toggle').onclick=()=>{const button=$('result-preview-toggle'),body=$('result-resources-preview'),open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));body.hidden=open;button.querySelector('span').textContent=open?'⌄':'⌃';};
  window.StudioParametragePreviewSnapshot=()=>{storeActiveLanguageContent();return {project:{theme:project?.theme_title||'',title:$('respondent-title')?.value.trim()||project?.respondent_title||baseTitle||'Autodiagnostic',intro:$('intro')?.value.trim()||'',socio:socio,result_buttons:resultResources.filter(resourceComplete)},respondent_context:{countryCode:socioContextCountry,locale:socioContextLocale}};};
  $('nb-respondents').oninput=()=>{if(isReadOnly())return;updateVigilance();renderQuota();scheduleAutosave();};
  $('close-packs').onclick=()=>{const panel=$('inline-packs');panel.hidden=true;const toggle=$('toggle-packs');if(toggle)toggle.textContent='Voir les packs disponibles';};window.addEventListener('studio:pack-requested',loadQuota);bindPackToggle();
  ['campaign-name','respondent-title'].forEach(id=>$(id)?.addEventListener('input',()=>scheduleAutosave()));
  $('param-next-top')?.addEventListener('click',()=>$('settings-form')?.requestSubmit());
  $('settings-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(isReadOnly()){location.href=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;return;}
    await flushAutosave();
    const readiness=settingsReadiness();if(!readiness.introChanged||!readiness.launchFilled||!readiness.closeFilled){await showReadinessModal();return;}
    storeActiveLanguageContent();const campaignName=$('campaign-name').value.trim(),respondentTitle=$('respondent-title').value.trim(),primaryLocale=normalizeLocale(project?.selected_locale||(Array.isArray(project?.locales)&&project.locales[0])||'fr'),introductionHtml=socioContextLocale===primaryLocale?readiness.intro:String(project?.introduction_html||readiness.intro),launchDate=readiness.launch,closeDate=readiness.close;const rawRespondents=$('nb-respondents').value.trim(),nbRespondents=rawRespondents?Number(rawRespondents):null;
    if(!respondentTitle)return show('Le titre visible est obligatoire.');if(!isLegacyClientCampaign()&&!project?.review_mode&&launchDate<iso(5))return show('La date de lancement doit être au minimum à J+5.');if(closeDate<=launchDate)return show('La date de clôture doit être postérieure à la date de lancement.');if(!socio.length)return show('Au moins une donnée d’analyse doit être présente.');if(invalidSocio())return show('Chaque donnée et chaque sous-critère doivent avoir un intitulé et au moins deux réponses renseignées.');const incompleteResource=resultResources.find(r=>!resourceComplete(r));if(incompleteResource)return show(incompleteResource.type==='legacy_document'?`Le PDF historique « ${incompleteResource.legacyFilename} » doit être rattaché avant de pouvoir être utilisé.`:'Chaque ressource doit avoir un texte et soit une URL valide, soit un fichier PDF.');const resultButtons=resultResources.filter(resourceComplete);
    try{await api(`/api/projects/${projectId}/settings`,{method:'PATCH',body:JSON.stringify({campaignName,respondentTitle,introductionHtml,introductionVariants:introVariants,launchDate,closeDate,nbRespondents,sociodemo:Array.isArray(project?.sociodemo)?project.sociodemo:socio,sociodemoLanguageVariants:socioLanguageVariants,resultButtons})});location.href=`validation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;}catch(error){show(error.message);}
  });load();
})();
