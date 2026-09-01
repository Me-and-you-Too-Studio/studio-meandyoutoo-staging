(()=>{
  const p=new URLSearchParams(location.search),projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt),$=id=>document.getElementById(id);
  let brandFiles=[],deliveryFiles=[],currentUser=null,isAdminDeliveryMode=false,communication={},project=null,currentTemplate='launch';
  const date=v=>{if(!v)return '—';const d=String(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?new Date(d+'T12:00:00').toLocaleDateString('fr-FR'):'—';};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatSize=n=>n>=1048576?`${(n/1048576).toFixed(1).replace('.',',')} Mo`:`${Math.max(1,Math.round(n/1024))} Ko`;
  const statusLabel=s=>({draft:'Brouillon',configuration_submitted:'À relire',review_pending:'À relire',in_review:'En relecture',client_validation_required:'Validation client requise',ready_to_publish:'Prête à publier',scheduled:'Programmée',published:'Publiée',active:'En cours',closed:'Terminée',completed:'Terminée'}[s]||s||'—');
  function show(message,type='error'){const a=$('kit-alert');a.hidden=false;a.textContent=message;a.className='composer-alert'+(type==='success'?' is-success':'');a.scrollIntoView({behavior:'smooth',block:'nearest'});}
  function isAllowed(file){return ['application/pdf','image/png','image/jpeg'].includes(file.type)&&file.size>0&&file.size<=4*1024*1024;}
  function addFiles(target,files){for(const f of files){if(!isAllowed(f)){show(`${f.name} : format non accepté ou fichier supérieur à 4 Mo.`);continue;}if(!target.some(x=>x.name===f.name&&x.size===f.size))target.push(f);}}
  function renderSelected(target,rootId,prefix){const root=$(rootId);root.innerHTML=target.map((f,i)=>`<div class="kit-selected-file"><span>📎 ${esc(f.name)} <small>${formatSize(f.size)}</small></span><button type="button" data-${prefix}-remove="${i}" aria-label="Retirer">×</button></div>`).join('');root.querySelectorAll(`[data-${prefix}-remove]`).forEach(b=>b.onclick=()=>{target.splice(Number(b.dataset[`${prefix}Remove`]),1);renderSelected(target,rootId,prefix);});}
  function bindDrop(zoneId,inputId,target,rootId,prefix){const zone=$(zoneId),input=$(inputId);const consume=files=>{addFiles(target,[...files]);renderSelected(target,rootId,prefix);};input.addEventListener('change',()=>consume(input.files));['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag-over');}));['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag-over');}));zone.addEventListener('drop',e=>consume(e.dataTransfer.files));}
  function pendingFiles(target,inputId){
    const merged=[...target];
    const input=$(inputId);
    for(const file of [...(input?.files||[])]) if(!merged.some(x=>x.name===file.name&&x.size===file.size)) merged.push(file);
    return merged;
  }
  async function fileToBase64(file){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(new Error(`Impossible de lire ${file.name}`));r.readAsDataURL(file);});}
  async function downloadAsset(id,name){try{const token=localStorage.getItem('studio_token')||'',base=typeof window.StudioAPI?.base==='function'?window.StudioAPI.base():String(window.STUDIO_API_BASE||'').replace(/\/$/,'');const r=await fetch(`${base}/api/projects/${projectId}/communication-assets/${id}/download`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Téléchargement impossible');const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name||'fichier';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}catch(e){show(e.message);}}
  let pendingDeleteAsset=null;
  function deleteAsset(id,name){pendingDeleteAsset={id,name};$('kit-delete-text').textContent=`« ${name||'ce fichier'} » sera définitivement supprimé de cet espace.`;$('kit-delete-modal').hidden=false;document.body.classList.add('modal-open');}
  function closeDeleteModal(){pendingDeleteAsset=null;$('kit-delete-modal').hidden=true;document.body.classList.remove('modal-open');}
  async function confirmDeleteAsset(){if(!pendingDeleteAsset)return;const {id}=pendingDeleteAsset;const b=$('kit-delete-confirm');b.disabled=true;try{await api(`/api/projects/${projectId}/communication-assets/${id}`,{method:'DELETE'});closeDeleteModal();await refreshAssets();show('Le fichier a été supprimé.','success');}catch(e){show(e.message);}finally{b.disabled=false;}}
  function renderAssets(assets){const client=assets.filter(a=>a.kind==='client_brand'),delivery=assets.filter(a=>a.kind==='meayt_delivery');const html=list=>list.length?list.map(a=>{const canDelete=isAdminDeliveryMode||a.kind==='client_brand';return `<article class="kit-file-row"><div class="kit-file-icon">${a.mime_type==='application/pdf'?'PDF':'IMG'}</div><div class="kit-file-main"><strong>${esc(a.filename)}</strong><span>${formatSize(Number(a.size_bytes)||0)} · ${new Date(a.created_at).toLocaleDateString('fr-FR')}</span>${a.comment?`<small>${esc(a.comment)}</small>`:''}</div><div class="kit-file-actions"><button class="button button-secondary" type="button" data-download="${a.id}" data-name="${esc(a.filename)}">Télécharger</button>${canDelete?`<button class="button button-danger" type="button" data-delete-asset="${a.id}" data-name="${esc(a.filename)}">Supprimer</button>`:''}</div></article>`}).join(''):'<div class="kit-empty">Aucun fichier disponible pour le moment.</div>';$('client-assets').innerHTML=html(client);$('delivery-assets').innerHTML=html(delivery);document.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>downloadAsset(b.dataset.download,b.dataset.name));document.querySelectorAll('[data-delete-asset]').forEach(b=>b.onclick=()=>deleteAsset(b.dataset.deleteAsset,b.dataset.name));}
  function renderVideo(){const url=String(communication.videoDownloadUrl||communication.video_download_url||''),desc=String(communication.videoDescription||communication.video_description||'');if(isAdminDeliveryMode){$('video-url').value=url;$('video-description').value=desc;}$('video-client-box').innerHTML=url?`<div class="video-card-title">Vidéo disponible</div><div class="video-card-text">${esc(desc||'Votre vidéo de communication est prête à être téléchargée.')}</div><a class="button button-primary" href="${esc(url)}" target="_blank" rel="noopener">Télécharger la vidéo</a>`:'<div class="kit-empty">Aucune vidéo disponible pour le moment.</div>';}
  const formatLongDate=v=>{if(!v)return 'date à définir';const d=String(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?new Date(d+'T12:00:00').toLocaleDateString('fr-FR'):'date à définir';};
  const addDays=(value,days)=>{if(!value)return null;const d=new Date(String(value).slice(0,10)+'T12:00:00');if(Number.isNaN(d.getTime()))return null;d.setDate(d.getDate()+days);return d;};
  const dateObjFr=d=>d?d.toLocaleDateString('fr-FR'):'—';
  function copyText(value){if(!value)return;navigator.clipboard.writeText(value).then(()=>show('Copié dans le presse-papiers.','success')).catch(()=>show('Impossible de copier automatiquement.'));}
  function renderLinks(){
    const share=String(communication.shareUrl||communication.share_url||''),results=String(communication.resultsUrl||communication.results_url||'');
    const set=(value,textId,copyId,openId)=>{$(textId).textContent=value||'En préparation par Me&YouToo';$(copyId).disabled=!value;const open=$(openId);open.href=value||'#';open.setAttribute('aria-disabled',String(!value));open.classList.toggle('is-disabled',!value);};
    set(share,'share-url','share-copy','share-open');set(results,'results-url','results-copy','results-open');
    if(isAdminDeliveryMode){$('share-url-admin').value=share;$('results-url-admin').value=results;}$('links-admin-box').hidden=!isAdminDeliveryMode;if($('links-client-waiting'))$('links-client-waiting').hidden=isAdminDeliveryMode||Boolean(share||results);
    const qrUrl=share?`https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(share)}&v=${encodeURIComponent(String(communication.linksUpdatedAt||communication.links_updated_at||Date.now()))}`:'';$('qr-ready').hidden=!qrUrl;$('qr-empty').hidden=Boolean(qrUrl);if(qrUrl){$('qr-image').src=qrUrl;$('qr-download').href=qrUrl;}
  }
  function renderTimeline(){
    const launch=project?.launch_date,close=project?.close_date,launchObj=addDays(launch,0),closeObj=addDays(close,0);
    $('timeline-description').textContent=launch&&close?`Campagne prévue du ${formatLongDate(launch)} au ${formatLongDate(close)}.`:'Renseignez les dates de campagne pour obtenir le calendrier de relance.';
    if(!launchObj||!closeObj||closeObj<=launchObj){$('campaign-timeline').innerHTML='';return;}
    const duration=Math.round((closeObj-launchObj)/86400000),rows=[['J',dateObjFr(launchObj),'Lancement','Email de lancement + message sur vos canaux internes (Teams, Slack, intranet).']];
    if(duration===2){
      rows.push([`J+1`,dateObjFr(addDays(launch,1)),'Relance','Un rappel auprès des collaborateurs pour maintenir la participation.']);
    }else if(duration>=3){
      const firstOffset=Math.max(1,Math.min(14,Math.round(duration/3)));
      const lastOffset=Math.max(firstOffset+1,Math.min(duration-1,Math.round(duration*.75)));
      rows.push([`J+${firstOffset}`,dateObjFr(addDays(launch,firstOffset)),'Première relance','Un rappel auprès des collaborateurs pour maintenir la participation.']);
      rows.push([`J-${duration-lastOffset}`,dateObjFr(addDays(launch,lastOffset)),'Dernière chance','Dernière relance avant la clôture de la campagne.']);
    }
    rows.push(['Après',dateObjFr(addDays(close,1)),'Restitution','Remerciez les participants et partagez les premiers enseignements.']);
    $('campaign-timeline').innerHTML=rows.map(r=>`<div class="time-row"><div class="time-day">${r[0]}</div><div><div class="time-txt">${r[2]} <small>· ${r[1]}</small></div><div class="time-sub">${r[3]}</div></div></div>`).join('');
  }
  function templates(){const name=project?.campaign_name||project?.respondent_title||project?.title||'notre campagne';const share=String(communication.shareUrl||communication.share_url||'').trim();const link=share||'[LIEN DE CAMPAGNE À VENIR]';const close=formatLongDate(project?.close_date),launch=formatLongDate(project?.launch_date);return {
    launch:{title:'Email lancement',meta:'À adresser aux collaborateurs concernés',body:`Objet : Notre campagne « ${name} » débute aujourd’hui\n\nBonjour,\n\nNous lançons aujourd’hui avec Me&YouToo la campagne « ${name} ».\n\nCette campagne vous propose de vous positionner sur des situations concrètes du quotidien professionnel. Elle ne dure que quelques minutes et vos réponses restent anonymes.\n\nAccédez à la campagne : ${link}\n\nLa campagne est ouverte jusqu’au ${close}.\n\nMerci par avance pour votre participation.`},
    managers:{title:'Email managers',meta:'À adresser aux managers pour relayer la campagne',body:`Objet : Merci de relayer — campagne « ${name} »\n\nBonjour,\n\nLa campagne « ${name} » sera ouverte du ${launch} au ${close}.\n\nMerci de relayer ce message auprès de vos équipes et de les encourager à participer. La participation est anonyme et prend quelques minutes.\n\nLien à partager : ${link}\n\nMerci pour votre soutien.`},
    reminder:{title:'Relance',meta:'À envoyer à mi-parcours',body:`Objet : Avez-vous déjà participé à « ${name} » ?\n\nBonjour,\n\nNotre campagne « ${name} » est toujours ouverte.\n\nSi ce n’est pas encore fait, prenez quelques minutes pour participer : ${link}\n\nClôture : ${close}.\n\nMerci pour votre participation !`},
    last:{title:'Dernière chance',meta:'À envoyer avant la clôture',body:`Objet : Derniers jours pour participer — « ${name} »\n\nBonjour,\n\nLa campagne « ${name} » se termine le ${close}.\n\nIl est encore temps de participer : ${link}\n\nMerci à toutes et tous !`},
    channels:{title:'Teams / Slack',meta:'Message court pour vos canaux internes',body:`📣 La campagne « ${name} » est ouverte !\n\nQuelques minutes suffisent pour participer, de façon anonyme.\n\n👉 ${link}\n\nClôture le ${close}. Merci à toutes et tous !`},
    intranet:{title:'Intranet',meta:'Format article / post intranet',body:`Participez à notre campagne « ${name} »\n\nDu ${launch} au ${close}, nous vous invitons à participer à une campagne conçue avec l’expertise Me&YouToo.\n\nElle s’appuie sur des situations concrètes du quotidien professionnel. Vos réponses sont anonymes et les résultats seront restitués de façon collective.\n\nAccéder à la campagne : ${link}`},
    finalResults:{title:'Restitution finale',meta:'À envoyer après la clôture',body:`Objet : Merci pour votre participation à « ${name} »\n\nBonjour,\n\nMerci à toutes et tous pour votre participation à notre campagne « ${name} ».\n\nLes résultats collectifs et anonymes seront partagés prochainement, ainsi que les prochaines étapes de notre démarche.\n\nMerci encore pour votre engagement.`}
  };}
  function renderTemplate(name=currentTemplate){currentTemplate=name;const tpl=templates()[name]||templates().launch;$('tpl-title').textContent=tpl.title;$('tpl-meta').textContent=tpl.meta;$('tpl-body').textContent=tpl.body;document.querySelectorAll('.comm-tab').forEach(b=>b.classList.toggle('on',b.dataset.template===name));}


  function activateKitTab(name){
    document.querySelectorAll('[data-kit-tab]').forEach(b=>{const on=b.dataset.kitTab===name;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on));});
    document.querySelectorAll('[data-kit-panel]').forEach(p=>{const on=p.dataset.kitPanel===name;p.hidden=!on;p.classList.toggle('is-active',on);});
    document.querySelectorAll('[data-process-tab]').forEach(b=>b.classList.toggle('is-current',b.dataset.processTab===name));
    try{sessionStorage.setItem('studio_kit_tab_'+projectId,name);}catch(e){}
  }
  function recommendedKitTab(){
    const hasClientAssets=document.querySelectorAll('#client-assets .kit-file-row').length>0;
    const hasDelivery=document.querySelectorAll('#delivery-assets .kit-file-row').length>0||Boolean(communication.videoDownloadUrl||communication.video_download_url);
    if(hasDelivery)return'delivery';
    if(communication.shareUrl||communication.share_url)return'diffusion';
    if(hasClientAssets)return'messages';
    return'graphics';
  }

  async function refreshAssets(){const data=await api(`/api/projects/${projectId}/communication-assets`);communication=data.communication||{};renderAssets(data.assets||[]);renderVideo();renderLinks();renderTemplate();}
  async function uploadBatch(files,kind,comment){
    for(let i=0;i<files.length;i++){const file=files[i],notify=i===files.length-1;await api(`/api/projects/${projectId}/communication-assets`,{method:'POST',body:JSON.stringify({filename:file.name,mimeType:file.type,sizeBytes:file.size,contentBase64:await fileToBase64(file),comment,kind,notify})});}
  }
  async function load(){if(!projectId){show('Aucune campagne sélectionnée.');return;}try{const [composer,me,assetsData]=await Promise.all([api(`/api/projects/${projectId}/composer`),api('/api/me'),api(`/api/projects/${projectId}/communication-assets`)]);project=composer.project;currentUser=me.user;isAdminDeliveryMode=currentUser?.role==='admin'&&sessionStorage.getItem('studio_interface_mode')!=='client';communication=assetsData.communication||{};$('kit-campaign-name').textContent=project.campaign_name||project.title||'Campagne';$('kit-status-text').textContent=statusLabel(project.status);$('kit-project-status').textContent=statusLabel(project.status);$('kit-launch').textContent=date(project.launch_date);$('kit-close').textContent=date(project.close_date);$('admin-delivery-upload').hidden=!isAdminDeliveryMode;$('video-admin-box').hidden=!isAdminDeliveryMode;if(isAdminDeliveryMode){
      $('graphics-tab-label').textContent='Éléments graphiques du client';
      $('client-assets-title').textContent='Éléments graphiques du client';
      $('client-assets-desc').textContent='Fichiers transmis par le client pour cette campagne.';
      $('kit-upload-title').textContent='🎨 Éléments graphiques du client';
      $('kit-upload-desc').textContent='Consultez ici les logos, chartes et consignes transmis par le client. Pour déposer vos livrables, utilisez l’onglet « Livraison Me&YouToo ».';
      $('brand-upload-button').hidden=true;$('brand-drop-zone').hidden=true;
    }else{
      $('graphics-tab-label').textContent='Vos éléments graphiques';
      $('client-assets-title').textContent='Vos éléments graphiques';
      $('client-assets-desc').textContent='Vous gardez ici la trace des fichiers transmis pour cette campagne.';
    }
    renderAssets(assetsData.assets||[]);renderVideo();renderLinks();renderTimeline();renderTemplate();let saved='';try{saved=sessionStorage.getItem('studio_kit_tab_'+projectId)||'';}catch(e){}const requestedTab=p.get('tab');activateKitTab(['graphics','messages','diffusion','delivery'].includes(requestedTab)?requestedTab:(saved||recommendedKitTab()));}catch(e){show(e.message);}}
  bindDrop('brand-drop-zone','brand-input',brandFiles,'brand-selected','brand');bindDrop('delivery-drop-zone','delivery-input',deliveryFiles,'delivery-selected','delivery');
  $('brand-upload-button').onclick=async()=>{const files=pendingFiles(brandFiles,'brand-input');if(!files.length){show('Sélectionnez ou glissez-déposez au moins un fichier.');return;}const b=$('brand-upload-button');b.disabled=true;b.textContent='Envoi…';try{await uploadBatch(files,'client_brand',$('brand-comment').value.trim());brandFiles=[];$('brand-input').value='';renderSelected(brandFiles,'brand-selected','brand');$('brand-comment').value='';await refreshAssets();show('Vos éléments ont bien été transmis à Me&YouToo. Une notification a été envoyée à l’équipe Me&YouToo.','success');}catch(e){show(e.message);}finally{b.disabled=false;b.textContent='Envoyer à Me&YouToo';}};
  $('delivery-upload-button').onclick=async()=>{const files=pendingFiles(deliveryFiles,'delivery-input');if(!files.length){show('Ajoutez au moins un livrable.');return;}const b=$('delivery-upload-button');b.disabled=true;b.textContent='Mise à disposition…';try{await uploadBatch(files,'meayt_delivery',$('delivery-comment').value.trim());deliveryFiles=[];$('delivery-input').value='';renderSelected(deliveryFiles,'delivery-selected','delivery');$('delivery-comment').value='';await refreshAssets();show('Les ressources sont disponibles. Le client a été averti par mail et dans ses notifications Studio.','success');}catch(e){show(e.message);}finally{b.disabled=false;b.textContent='Mettre à disposition et notifier le client';}};
  $('video-save').onclick=async()=>{const url=$('video-url').value.trim(),description=$('video-description').value.trim();if(url&&!/^https:\/\//i.test(url)){show('Le lien vidéo doit commencer par https://');return;}try{const data=await api(`/api/projects/${projectId}/communication-video`,{method:'PATCH',body:JSON.stringify({videoDownloadUrl:url,videoDescription:description,notify:true})});communication=data.communication||{};renderVideo();show('Le lien vidéo est enregistré et le client a été averti par mail.','success');}catch(e){show(e.message);}};
  $('video-clear').onclick=async()=>{try{const data=await api(`/api/projects/${projectId}/communication-video`,{method:'PATCH',body:JSON.stringify({videoDownloadUrl:'',videoDescription:'',notify:false})});communication=data.communication||{};renderVideo();show('Le lien vidéo a été retiré.','success');}catch(e){show(e.message);}};
  $('share-copy').onclick=()=>copyText(String(communication.shareUrl||communication.share_url||''));
  $('results-copy').onclick=()=>copyText(String(communication.resultsUrl||communication.results_url||''));
  $('share-open').addEventListener('click',e=>{if(e.currentTarget.getAttribute('aria-disabled')==='true')e.preventDefault();});
  $('results-open').addEventListener('click',e=>{if(e.currentTarget.getAttribute('aria-disabled')==='true')e.preventDefault();});
  document.querySelectorAll('.comm-tab').forEach(b=>b.onclick=()=>renderTemplate(b.dataset.template));
  $('tpl-copy').onclick=()=>copyText($('tpl-body').textContent);
  $('links-save').onclick=async()=>{const shareUrl=$('share-url-admin').value.trim(),resultsUrl=$('results-url-admin').value.trim();if(shareUrl&&!/^https:\/\//i.test(shareUrl)){show('Le lien de campagne doit commencer par https://');return;}if(resultsUrl&&!/^https:\/\//i.test(resultsUrl)){show('Le lien de résultats doit commencer par https://');return;}try{const data=await api(`/api/projects/${projectId}/communication-links`,{method:'PATCH',body:JSON.stringify({shareUrl,resultsUrl,notify:true})});communication={...communication,...(data.communication||{})};renderLinks();renderTemplate();show('Les liens sont enregistrés et le client a été averti par mail.','success');}catch(e){show(e.message);}};
  $('kit-delete-confirm').onclick=confirmDeleteAsset;
  $('kit-delete-cancel').onclick=closeDeleteModal;
  $('kit-delete-close').onclick=closeDeleteModal;
  $('kit-delete-modal').addEventListener('click',e=>{if(e.target===$('kit-delete-modal'))closeDeleteModal();});
  document.querySelectorAll('[data-kit-tab]').forEach(b=>b.onclick=()=>activateKitTab(b.dataset.kitTab));
  document.querySelectorAll('[data-process-tab]').forEach(b=>b.onclick=()=>activateKitTab(b.dataset.processTab));
  load();
})();
