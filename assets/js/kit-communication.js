(()=>{
  const p=new URLSearchParams(location.search),projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt),$=id=>document.getElementById(id);
  let availableAssets=[],brandFiles=[],deliveryFiles=[],currentUser=null,isAdminDeliveryMode=false,communication={},project=null,currentTemplate='launch';
  const date=v=>{if(!v)return '—';const d=String(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?new Date(d+'T12:00:00').toLocaleDateString('fr-FR'):'—';};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatSize=n=>n>=1048576?`${(n/1048576).toFixed(1).replace('.',',')} Mo`:`${Math.max(1,Math.round(n/1024))} Ko`;
  const statusLabel=s=>s?window.StudioStatus.label(s):'—';
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
  function renderAssets(assets){availableAssets=assets;const client=assets.filter(a=>a.kind==='client_brand'),delivery=assets.filter(a=>a.kind==='meayt_delivery');const html=list=>list.length?list.map(a=>{const canDelete=isAdminDeliveryMode||a.kind==='client_brand';return `<article class="kit-file-row"><div class="kit-file-icon">${a.mime_type==='application/pdf'?'PDF':'IMG'}</div><div class="kit-file-main"><strong>${esc(a.filename)}</strong><span>${formatSize(Number(a.size_bytes)||0)} · ${new Date(a.created_at).toLocaleDateString('fr-FR')}</span>${a.comment?`<small>${esc(a.comment)}</small>`:''}</div><div class="kit-file-actions"><button class="button button-secondary" type="button" data-download="${a.id}" data-name="${esc(a.filename)}">Télécharger</button>${canDelete?`<button class="button button-danger" type="button" data-delete-asset="${a.id}" data-name="${esc(a.filename)}">Supprimer</button>`:''}</div></article>`}).join(''):'<div class="kit-empty">Aucun fichier disponible pour le moment.</div>';$('client-assets').innerHTML=html(client);$('delivery-assets').innerHTML=html(delivery);document.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>downloadAsset(b.dataset.download,b.dataset.name));document.querySelectorAll('[data-delete-asset]').forEach(b=>b.onclick=()=>deleteAsset(b.dataset.deleteAsset,b.dataset.name));}
  function renderVideo(){const url=String(communication.videoDownloadUrl||communication.video_download_url||''),desc=String(communication.videoDescription||communication.video_description||'');if(isAdminDeliveryMode){$('video-url').value=url;$('video-description').value=desc;}$('video-client-box').innerHTML=url?`<div class="video-card-title">Vidéo disponible</div><div class="video-card-text">${esc(desc||'Votre vidéo de communication est prête à être téléchargée.')}</div><a class="button button-primary" href="${esc(url)}" target="_blank" rel="noopener">Télécharger la vidéo</a>`:'<div class="kit-empty">Aucune vidéo disponible pour le moment.</div>';}
  const formatLongDate=v=>{if(!v)return 'date à définir';const d=String(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?new Date(d+'T12:00:00').toLocaleDateString('fr-FR'):'date à définir';};
  const addDays=(value,days)=>{if(!value)return null;const d=new Date(String(value).slice(0,10)+'T12:00:00');if(Number.isNaN(d.getTime()))return null;d.setDate(d.getDate()+days);return d;};
  const dateObjFr=d=>d?d.toLocaleDateString('fr-FR'):'—';
  function copyText(value){if(!value)return;navigator.clipboard.writeText(value).then(()=>show('Copié dans le presse-papiers.','success')).catch(()=>show('Impossible de copier automatiquement.'));}
  function kitValidated(){return ['ready_to_publish','scheduled','published','active','closed','completed'].includes(project?.status);}
  function diffusionAvailable(){return isAdminDeliveryMode||(kitValidated()&&Boolean(communication.linksUpdatedAt||communication.links_updated_at));}
  function hasDelivery(){return availableAssets.some(asset=>asset.kind==='meayt_delivery')||Boolean(String(communication.videoDownloadUrl||communication.video_download_url||'').trim());}
  function kitTabLocked(name){return !isAdminDeliveryMode&&((name==='delivery'&&(!kitValidated()||!hasDelivery()))||(name==='diffusion'&&!diffusionAvailable()));}
  function renderKitAvailability(){
    document.querySelectorAll('[data-kit-tab],[data-process-tab]').forEach(button=>{
      const locked=kitTabLocked(button.dataset.kitTab||button.dataset.processTab);
      button.disabled=locked;button.setAttribute('aria-disabled',String(locked));
      button.style.opacity=locked?'0.45':'';button.style.cursor=locked?'not-allowed':'';
      button.title=locked?((button.dataset.kitTab||button.dataset.processTab)==='delivery'?'Disponible après validation, dès que Me&YouToo aura déposé un fichier ou une vidéo.':'Disponible après validation et préparation par Me&YouToo.'):'';
    });
    let note=$('kit-preparation-note');
    if(!note){note=document.createElement('p');note.id='kit-preparation-note';note.className='kit-client-waiting';document.querySelector('[data-kit-tab]')?.parentElement.after(note);}
    note.hidden=isAdminDeliveryMode||(diffusionAvailable()&&hasDelivery());
    note.textContent='Transmettez vos éléments graphiques. Les liens et le QR code seront accessibles après validation et préparation par Me&YouToo. L’onglet « Livraison Me&YouToo » sera activé dès qu’un fichier ou une vidéo sera mis à votre disposition après validation.';
    const active=document.querySelector('[data-kit-tab].is-active');
    if(active&&kitTabLocked(active.dataset.kitTab))activateKitTab('graphics');
  }
  function renderLinks(){
    const available=diffusionAvailable(),share=available?String(communication.shareUrl||communication.share_url||''):'',results=available?String(communication.resultsUrl||communication.results_url||''):'';
    const set=(value,textId,copyId,openId)=>{$(textId).textContent=value||'En préparation par Me&YouToo';$(copyId).disabled=!value;const open=$(openId);open.href=value||'#';open.setAttribute('aria-disabled',String(!value));open.classList.toggle('is-disabled',!value);};
    set(share,'share-url','share-copy','share-open');set(results,'results-url','results-copy','results-open');
    if(communication.resultsRestricted){$('results-url').textContent='Accès non autorisé pour votre compte';$('results-copy').disabled=true;$('results-open').setAttribute('aria-disabled','true');$('results-open').classList.add('is-disabled');}
    if(isAdminDeliveryMode){$('share-url-admin').value=share;$('results-url-admin').value=results;}$('links-admin-box').hidden=!isAdminDeliveryMode;if($('links-client-waiting'))$('links-client-waiting').hidden=isAdminDeliveryMode||Boolean(share||results);
    const qrUrl=share?`https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(share)}&v=${encodeURIComponent(String(communication.linksUpdatedAt||communication.links_updated_at||Date.now()))}`:'';$('qr-ready').hidden=!qrUrl;$('qr-empty').hidden=Boolean(qrUrl);if(qrUrl){$('qr-image').src=qrUrl;$('qr-download').href=qrUrl;}else{$('qr-image').removeAttribute('src');$('qr-download').removeAttribute('href');}
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
  // Textes français par thématique. Aucune dépendance aux intitulés personnalisés de campagne.
  const communicationCopy = {
    sexisme: {
      subject:'Une blague, un compliment, une remarque… où commence le sexisme ?',
      opening:'« C’était pour rire. » « Tu prends ça trop au sérieux. » Au travail, certaines paroles semblent anodines… mais le sont-elles pour tout le monde ?\n\nFace à une remarque, une plaisanterie ou une différence de traitement, que remarquez-vous ? Comment réagissez-vous ?',
      benefit:'Avec l’autodiagnostic Me&YouToo, confrontez vos réflexes à des situations concrètes et découvrez des repères pour reconnaître le sexisme et agir au quotidien.',
      invitation:'Prenez quelques minutes pour faire le point : vous pourriez être surpris de ce que vous découvrirez.',
      cta:'Je fais l’autodiagnostic',
      reminderSubject:'Une remarque sexiste pendant une réunion : que feriez-vous ?',
      reminder:'Une plaisanterie vous met mal à l’aise, mais personne ne réagit. Vous hésitez à intervenir…\n\nReconnaître une situation est une première étape. Savoir comment se positionner en est une autre. L’autodiagnostic vous invite à explorer vos réflexes et à découvrir des repères pour agir.',
      managers:'Votre équipe sait-elle repérer une remarque sexiste et se sent-elle à l’aise pour réagir ? Ce diagnostic ouvre une réflexion sur les paroles et les comportements qui peuvent être banalisés au quotidien.',
      last:'Une remarque, une plaisanterie, une réaction : prenez quelques minutes pour découvrir vos réflexes face au sexisme.',
      short:'Une blague qui fait rire les uns et met les autres mal à l’aise : où vous situez-vous ? Découvrez vos réflexes face au sexisme avec l’autodiagnostic Me&YouToo.',
      final:'Reconnaître les remarques et les comportements sexistes, y compris lorsqu’ils sont banalisés, aide à mieux réagir au quotidien.'
    },
    handicap: {
      subject:'Handicap au travail : et si cela nous concernait plus qu’on ne le pense ?',
      opening:'Une fatigue persistante, des difficultés à entendre dans une réunion, un problème de santé qui complique certains gestes… Au travail, certaines difficultés ne se voient pas et ne sont pas toujours connues des autres.\n\nQue ces situations vous concernent personnellement ou qu’elles touchent votre entourage professionnel, nous avons tous à gagner à mieux les comprendre.',
      benefit:'L’autodiagnostic Me&YouToo vous invite à explorer des situations concrètes, à questionner certaines idées reçues et à découvrir des repères utiles pour soi et pour les autres.',
      invitation:'Prenez quelques minutes pour faire le point, à votre rythme.',
      cta:'Je découvre l’autodiagnostic',
      reminderSubject:'Au travail, toutes les difficultés ne se voient pas',
      reminder:'Un aménagement que l’on ne comprend pas toujours, une difficulté que l’on préfère garder pour soi, une aide que l’on n’ose pas proposer…\n\nL’autodiagnostic permet de prendre du recul sur ces situations, qu’elles vous concernent ou qu’elles touchent un collègue. Quelques minutes pour mieux comprendre les besoins et questionner les idées reçues.',
      managers:'Une difficulté de santé peut avoir des effets sur le travail sans être visible ni connue de l’équipe. Ce diagnostic aide à questionner les idées reçues et à mieux comprendre les besoins, pour soi comme pour les autres. Invitez chacun à participer à son rythme, sans solliciter de témoignage personnel ni de déclaration de handicap.',
      last:'Pour soi ou pour mieux comprendre ses collègues : il est encore temps d’explorer les situations de handicap au travail et les difficultés parfois invisibles.',
      short:'Au travail, certaines difficultés ne se voient pas. Et si quelques minutes permettaient de mieux les comprendre, pour soi ou pour les autres ? Découvrez l’autodiagnostic Me&YouToo sur le handicap.',
      final:'Mieux comprendre les difficultés visibles ou invisibles permet de porter un regard plus attentif sur les besoins de chacun, y compris les siens.'
    },
    origines: {
      subject:'Un prénom, un accent… qu’imaginons-nous sans nous en rendre compte ?',
      opening:'« Tu viens d’où, vraiment ? » Une question peut sembler être une marque d’intérêt et pourtant renvoyer quelqu’un à une supposée origine ou différence.\n\nUn prénom, un accent ou une apparence peuvent aussi influencer nos premières impressions, parfois à notre insu.',
      benefit:'Avec l’autodiagnostic Me&YouToo, explorez des situations du quotidien professionnel pour découvrir ce que vous repérez, ce qui peut vous échapper et comment réagir.',
      invitation:'Une occasion de prendre du recul sur ses habitudes, sans avoir besoin de connaître toutes les réponses à l’avance.',
      cta:'Je fais le point',
      reminderSubject:'Une première impression : sur quoi repose-t-elle vraiment ?',
      reminder:'Vous associez spontanément un prénom à une origine ou un accent à un niveau de compétence. Que se passe-t-il dans ces premiers instants ?\n\nL’autodiagnostic vous propose de prendre du recul sur les raccourcis qui peuvent influencer nos échanges et nos décisions, même sans intention d’exclure.',
      managers:'Les premières impressions peuvent influencer la répartition des missions, la confiance ou la reconnaissance. Ce diagnostic permet de questionner les suppositions liées aux origines et de repérer les comportements qui peuvent mettre à l’écart.',
      last:'Un prénom, un accent, une question : prenez quelques minutes pour découvrir ce qui peut influencer votre regard sur les origines.',
      short:'Un prénom ou un accent influencent-ils votre première impression ? Explorez vos réflexes et vos idées reçues avec l’autodiagnostic Me&YouToo sur la diversité des origines.',
      final:'Prendre du recul sur les suppositions liées aux origines aide à mieux considérer chaque personne et à questionner ses premières impressions.'
    },
    religion: {
      subject:'Convictions et laïcité au travail : quels sont vos réflexes ?',
      opening:'Une discussion sur les croyances pendant une pause. Une remarque sur une pratique religieuse. Un désaccord sur ce que la laïcité permet ou interdit…\n\nCes situations peuvent susciter des questions que l’on n’ose pas toujours poser. Entre convictions personnelles, règles et idées reçues, nos repères sont-ils toujours aussi clairs qu’on le pense ?',
      benefit:'Avec l’autodiagnostic Me&YouToo, confrontez vos réflexes à des situations concrètes pour mieux comprendre les principes en jeu et échanger avec respect, quelles que soient les convictions de chacun.',
      invitation:'Prenez quelques minutes pour explorer le sujet.',
      cta:'Je découvre l’autodiagnostic',
      reminderSubject:'Laïcité, convictions : règle ou idée reçue ?',
      reminder:'« Au travail, la religion relève forcément de la vie privée. » « La laïcité impose la même chose partout. » Êtes-vous sûr de vos repères ?\n\nL’autodiagnostic vous invite à questionner vos réflexes à partir de situations concrètes, pour mieux distinguer les principes, les habitudes et les idées reçues.',
      managers:'Les questions de convictions et de laïcité peuvent susciter des hésitations ou des désaccords. Ce diagnostic permet à chacun de questionner ses repères et de réfléchir à des échanges respectueux des convictions de tous.',
      last:'Il est encore temps de faire le point sur vos repères en matière de convictions et de laïcité au travail.',
      short:'Convictions et laïcité au travail : vos repères sont-ils aussi clairs que vous le pensez ? Explorez des situations concrètes avec l’autodiagnostic Me&YouToo.',
      final:'Distinguer les principes, les habitudes et les idées reçues aide à aborder les questions de convictions et de laïcité avec davantage de clarté et de respect.'
    },
    lgbt: {
      subject:'Peut-on parler de son week-end aussi simplement que ses collègues ?',
      opening:'Évoquer son couple, raconter ses vacances, afficher une photo sur son bureau… Ces gestes ordinaires ne sont pas aussi simples pour tout le monde.\n\nCertaines suppositions, plaisanteries ou questions peuvent mettre à l’écart une personne LGBT+, même sans intention de blesser.',
      benefit:'Avec l’autodiagnostic Me&YouToo, découvrez comment vous réagiriez dans différentes situations et explorez les gestes qui permettent à chacun de se sentir à sa place.',
      invitation:'Pas besoin de maîtriser tout le vocabulaire pour participer : la curiosité est un bon point de départ.',
      cta:'Je découvre mes réflexes',
      reminderSubject:'Une conversation ordinaire, le même confort pour tout le monde ?',
      reminder:'Quand on parle de couple ou de famille, quelles suppositions fait-on spontanément ? Et comment réagir à une plaisanterie qui met une personne mal à l’aise ?\n\nPrenez quelques minutes pour explorer les gestes et les paroles qui peuvent faciliter, ou compliquer, le quotidien des personnes LGBT+ au travail.',
      managers:'Pouvoir parler simplement de sa vie ou choisir de ne pas en parler compte dans le sentiment d’être à sa place. Ce diagnostic invite à repérer les suppositions et les comportements qui peuvent exclure les personnes LGBT+. Encouragez la participation sans demander à quiconque de partager son orientation sexuelle, son identité de genre ou son vécu.',
      last:'Quelques minutes pour repérer les suppositions et les paroles qui peuvent mettre à l’écart les personnes LGBT+ : il est encore temps de participer.',
      short:'Parler de son week-end paraît simple… mais l’est-ce pour tout le monde ? Découvrez vos réflexes pour un quotidien professionnel plus inclusif envers les personnes LGBT+.',
      final:'Être attentif aux suppositions et aux paroles du quotidien contribue à ce que chacun puisse trouver sa place, sans avoir à se justifier.'
    },
    collaborateur: {
      subject:'Et vous, quelle place faites-vous aux autres au travail ?',
      opening:'Qui prend la parole en réunion ? Qui reste à l’écart des échanges ? Vers qui vous tournez-vous spontanément pour travailler ?\n\nL’inclusion se joue aussi dans ces habitudes que l’on ne remarque plus.',
      benefit:'Avec l’autodiagnostic Me&YouToo, glissez-vous dans des situations du quotidien professionnel et découvrez vos réflexes : ceux qui facilitent la place de chacun et ceux que vous pourriez faire évoluer.',
      invitation:'Nous avons tous des angles morts. Les découvrir, c’est se donner les moyens d’agir autrement.',
      cta:'Je fais le point sur mes pratiques',
      reminderSubject:'Qui n’a pas encore eu la parole ?',
      reminder:'Une personne est interrompue. Une autre n’est jamais invitée aux échanges informels. Vous travaillez toujours avec les mêmes collègues…\n\nNos habitudes peuvent ouvrir des portes ou laisser des personnes de côté. L’autodiagnostic vous aide à explorer ces réflexes et les gestes qui font une différence.',
      managers:'La coopération et la place de chacun se construisent dans les échanges du quotidien. Ce diagnostic invite chaque membre de l’équipe à questionner ses habitudes et à repérer des gestes simples pour mieux travailler ensemble.',
      last:'Qui écoutez-vous, qui sollicitez-vous, qui risque de rester à l’écart ? Prenez quelques minutes pour explorer vos pratiques inclusives.',
      short:'En réunion, dans les échanges ou sur un projet, quelle place faites-vous aux autres ? Découvrez vos réflexes de collègue inclusif avec Me&YouToo.',
      final:'Écouter, associer une personne à un échange ou questionner une habitude : chacun dispose de leviers pour faire une place aux autres.'
    },
    management: {
      subject:'Dans votre équipe, chacun a-t-il les mêmes chances de contribuer ?',
      opening:'À qui confiez-vous une mission visible ? Quel avis sollicitez-vous en premier ? Comment réagissez-vous lorsqu’une personne exprime un besoin différent ?\n\nCes décisions façonnent la place de chacun dans une équipe. Et même avec les meilleures intentions, certains automatismes peuvent nous échapper.',
      benefit:'L’autodiagnostic Me&YouToo vous propose de prendre du recul sur vos pratiques managériales à travers des situations concrètes.\n\nDécouvrez vos points d’appui et les réflexes que vous pourriez faire évoluer pour permettre à chaque membre de votre équipe de contribuer pleinement.',
      invitation:'Accordez-vous quelques minutes pour regarder vos décisions du quotidien sous un autre angle.',
      cta:'J’explore mes pratiques de management',
      reminderSubject:'À qui confiez-vous la prochaine mission visible ?',
      reminder:'On sollicite parfois les personnes les plus disponibles, les plus à l’aise à l’oral ou celles avec qui l’on travaille déjà souvent. Quelles opportunités laisse-t-on alors aux autres ?\n\nL’autodiagnostic vous propose de prendre du recul sur ces décisions et d’explorer vos pratiques de management inclusif.',
      managers:'Vous pouvez encourager les managers de votre périmètre à prendre un temps de recul sur leurs pratiques : répartition des opportunités, écoute des besoins et reconnaissance des contributions. Ce diagnostic leur propose des situations concrètes pour explorer leurs réflexes.',
      last:'Répartition des missions, écoute, reconnaissance : prenez quelques minutes pour faire le point sur vos pratiques de management inclusif.',
      short:'Dans votre équipe, chacun a-t-il la possibilité de contribuer et d’être reconnu ? Prenez du recul sur vos décisions avec l’autodiagnostic Management inclusif Me&YouToo.',
      final:'Questionner la répartition des opportunités, l’écoute et la reconnaissance permet de faire évoluer les pratiques de management au quotidien.'
    },
    mixite: {
      subject:'Pour faire avancer la mixité, que pouvons-nous changer au quotidien ?',
      opening:'Une mission confiée toujours aux mêmes personnes. Une idée qui passe inaperçue, puis est reprise par quelqu’un d’autre. Une supposition sur la disponibilité d’un parent…\n\nL’égalité entre les femmes et les hommes se joue aussi dans les décisions et les interactions ordinaires.',
      benefit:'Avec l’autodiagnostic Me&YouToo, découvrez comment vos réflexes peuvent contribuer à faire avancer la mixité et repérez des occasions d’agir à votre échelle.',
      invitation:'Quel que soit votre rôle, vous avez des leviers.',
      cta:'Je découvre comment agir',
      reminderSubject:'Faire avancer la mixité : quelle occasion d’agir aujourd’hui ?',
      reminder:'Une collègue hésite à se proposer pour une mission. On suppose qu’un parent ne sera pas disponible. Une contribution n’est pas reconnue…\n\nComment vous positionnez-vous ? L’autodiagnostic vous invite à repérer les stéréotypes et à découvrir vos leviers pour faire avancer la mixité.',
      managers:'La répartition des missions, la reconnaissance et les suppositions sur la disponibilité peuvent influencer les opportunités des femmes et des hommes. Ce diagnostic invite chacun à découvrir ses leviers pour devenir acteur de la mixité.',
      last:'Quel que soit votre rôle, vous pouvez agir pour la mixité. Il reste quelques jours pour découvrir vos leviers au quotidien.',
      short:'Une mission, une prise de parole, une opportunité : comment faire avancer la mixité au quotidien ? Découvrez vos leviers avec l’autodiagnostic Me&YouToo.',
      final:'Repérer les stéréotypes et agir sur les interactions ordinaires permet à chacun de contribuer à davantage d’égalité entre les femmes et les hommes.'
    },
    intergenerationnel: {
      subject:'« Trop jeune », « trop âgé »… et si l’âge brouillait notre regard ?',
      opening:'« À son âge, il maîtrise forcément le numérique. » « Elle ne voudra plus se former. » « Il manque d’expérience pour avoir un avis. »\n\nNous avons parfois des idées bien arrêtées sur les générations. Mais que nous disent-elles vraiment des personnes avec qui nous travaillons ?',
      benefit:'L’autodiagnostic Me&YouToo vous invite à explorer vos réflexes face à l’âge et à découvrir comment ils peuvent influencer la coopération, la confiance ou les opportunités.',
      invitation:'Une occasion de regarder ses collègues autrement et de mieux travailler ensemble.',
      cta:'Je questionne mes réflexes',
      reminderSubject:'Et si vous ne connaissiez pas son âge ?',
      reminder:'Confieriez-vous la même mission ? Accorderiez-vous la même confiance ? Feriez-vous les mêmes suppositions sur ses envies d’apprendre ?\n\nL’autodiagnostic vous invite à explorer ce que l’âge change dans votre regard et à questionner vos habitudes pour mieux coopérer.',
      managers:'Les suppositions liées à l’âge peuvent peser sur les missions confiées, les occasions d’apprendre ou la confiance accordée. Ce diagnostic invite à regarder les personnes au-delà des étiquettes générationnelles et à mieux coopérer.',
      last:'« Trop jeune », « trop âgé » : il est encore temps de découvrir comment l’âge peut influencer vos réflexes au travail.',
      short:'L’âge d’un collègue change-t-il votre regard sur ses compétences ou ses envies ? Questionnez vos réflexes avec l’autodiagnostic intergénérationnel Me&YouToo.',
      final:'Regarder les compétences et les besoins au-delà des étiquettes générationnelles ouvre des possibilités de coopération et de transmission.'
    },
    manager3: {
      subject:'Vos habitudes de management répondent-elles aux situations d’aujourd’hui ?',
      opening:'Donner de l’autonomie tout en restant disponible. Faire un retour difficile. Adapter son accompagnement sans perdre le cap collectif…\n\nManager, c’est faire des choix chaque jour, souvent sans avoir le temps de prendre du recul.',
      benefit:'L’autodiagnostic Me&YouToo vous propose cette pause : face à des situations concrètes, comment réagiriez-vous ? Quels réflexes vous aident ? Lesquels gagneraient à évoluer ?',
      invitation:'Prenez quelques minutes pour explorer votre manière de manager et identifier des pistes à mettre en pratique avec votre équipe.',
      cta:'Je prends du recul sur mes pratiques',
      reminderSubject:'Accompagner sans tout contrôler : quel est votre réflexe ?',
      reminder:'Une personne demande davantage d’autonomie. Une autre attend un retour précis. L’équipe a besoin d’un cap clair…\n\nComment adaptez-vous votre posture ? L’autodiagnostic Manager 3.0 vous invite à prendre du recul sur vos choix et à explorer d’autres façons d’accompagner votre équipe.',
      managers:'Accordez aux managers de votre périmètre un moment pour prendre du recul sur leur posture : autonomie, accompagnement, retours et dynamique collective. L’autodiagnostic Manager 3.0 propose une réflexion à partir de situations concrètes.',
      last:'Prenez un temps de recul sur votre manière de donner de l’autonomie, d’accompagner et de faire des retours avant la clôture.',
      short:'Autonomie, accompagnement, retours : quels sont vos réflexes de manager ? Prenez quelques minutes pour les explorer avec l’autodiagnostic Manager 3.0 Me&YouToo.',
      final:'Prendre du recul sur sa posture aide à ajuster l’accompagnement, les retours et l’autonomie aux situations rencontrées dans l’équipe.'
    },
    referents: {
      subject:'Une personne vous confie une situation de sexisme : par quoi commencez-vous ?',
      opening:'Trouver les premiers mots. Accueillir un récit sans tirer de conclusion trop vite. Savoir vers qui orienter la personne…\n\nLe rôle de référent confronte à des situations sensibles, dans lesquelles il n’est pas toujours évident de choisir la bonne posture.',
      benefit:'L’autodiagnostic Me&YouToo vous invite à faire le point sur vos réflexes à partir de situations concrètes : écouter, repérer, orienter et identifier les limites de votre rôle.',
      invitation:'Une occasion de reconnaître vos points d’appui et les sujets à approfondir pour exercer votre mission.',
      cta:'Je fais le point sur mes réflexes',
      reminderSubject:'Face à une confidence, quels seraient vos premiers mots ?',
      reminder:'Une personne hésite à raconter ce qui lui arrive. Vous cherchez à comprendre sans orienter son récit ni promettre ce qui ne dépend pas de vous.\n\nL’autodiagnostic vous invite à explorer votre posture de référent, vos points d’appui et les sujets sur lesquels renforcer vos repères.',
      managers:'Merci de relayer cet autodiagnostic auprès des référents concernés dans votre périmètre et de leur permettre de dégager un moment pour le réaliser. Il propose de réfléchir à l’écoute, au repérage, à l’orientation et aux limites du rôle de référent.',
      last:'Écouter, repérer, orienter : prenez quelques minutes pour faire le point sur vos réflexes de référent avant la clôture.',
      short:'Une confidence, une hésitation, une orientation à proposer : quels sont vos réflexes de référent ? Faites le point avec l’autodiagnostic Me&YouToo.',
      final:'Prendre du recul sur l’écoute, l’orientation et les limites de son rôle permet d’identifier les repères à consolider dans sa mission de référent.'
    },
    harcelement: {
      subject:'Une tension, un désaccord, des comportements répétés : que repérez-vous ?',
      opening:'Des remarques dévalorisantes qui se répètent. Une personne progressivement mise à l’écart. Des consignes contradictoires…\n\nAu travail, certaines situations interpellent sans que l’on sache toujours comment les comprendre ni comment réagir.',
      benefit:'L’autodiagnostic Me&YouToo sur le harcèlement moral vous invite à explorer des situations concrètes, à questionner vos réflexes et à découvrir des repères pour identifier les signaux d’alerte.',
      invitation:'Prenez quelques minutes pour faire le point sur ce que vous remarquez et sur votre manière de vous positionner.',
      cta:'Je découvre mes réflexes',
      reminderSubject:'Quand une situation se répète, que remarquez-vous ?',
      reminder:'Une remarque isolée peut déjà blesser. Des comportements qui se répètent ou une mise à l’écart qui s’installe appellent aussi notre attention.\n\nL’autodiagnostic vous invite à prendre du recul sur des situations professionnelles et à explorer vos repères face au harcèlement moral.',
      managers:'Repérer les comportements dévalorisants et les situations de mise à l’écart fait partie de la vigilance au quotidien. Ce diagnostic invite à questionner ses réflexes face aux signaux d’alerte de harcèlement moral, sans demander aux équipes de raconter des situations personnelles.',
      last:'Il est encore temps de faire le point sur vos repères et vos réactions face aux signaux d’alerte de harcèlement moral.',
      short:'Des remarques répétées, une mise à l’écart : quels signaux repérez-vous ? Explorez vos réflexes avec l’autodiagnostic Me&YouToo sur le harcèlement moral.',
      final:'Être attentif aux comportements répétés et aux situations de mise à l’écart aide à repérer les signaux d’alerte dans le quotidien professionnel.'
    },
    general: {
      subject:'Face à ces situations au travail, que feriez-vous ?',
      opening:'Une remarque qui vous fait hésiter. Une décision prise par habitude. Une personne qui reste à l’écart…\n\nAu travail, nous réagissons souvent sans avoir le temps de questionner nos réflexes.',
      benefit:'L’autodiagnostic Me&YouToo vous propose de prendre ce temps à travers des situations concrètes : découvrez vos points d’appui et les habitudes que vous pourriez faire évoluer.',
      invitation:'Pas besoin de connaître toutes les réponses à l’avance : partez de ce que vous feriez spontanément.',
      cta:'Je découvre l’autodiagnostic',
      reminderSubject:'Et si vous preniez quelques minutes pour découvrir vos réflexes ?',
      reminder:'Nous avons tous des habitudes et des angles morts. Une situation ordinaire peut être l’occasion de les découvrir.\n\nSi vous n’avez pas encore participé, l’autodiagnostic Me&YouToo vous propose de prendre du recul et d’explorer d’autres façons de réagir.',
      managers:'Ce diagnostic propose de prendre du recul sur ses réflexes à travers des situations professionnelles concrètes. Votre relais peut permettre à chacun de découvrir la démarche et de trouver un moment pour participer.',
      last:'Quelques minutes pour découvrir vos réflexes et prendre du recul sur vos habitudes au travail : il est encore temps de participer.',
      short:'Face aux situations du quotidien professionnel, quels sont vos réflexes ? Découvrez vos points d’appui et vos angles morts avec l’autodiagnostic Me&YouToo.',
      final:'Prendre du recul sur ses réflexes permet de questionner ses habitudes et d’explorer d’autres façons d’agir au quotidien.'
    }
  };

  function communicationThemeKey(value){
    const text=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if(!text)return '';
    // Les thèmes spécialisés passent avant les termes génériques « sexisme » et « manager ».
    if(/\breferents?\b/.test(text))return 'referents';
    if(/\bmanager\s*3(?:\s*0)?\b|\bmanager30\b/.test(text))return 'manager3';
    if(/harcelement moral/.test(text))return 'harcelement';
    if(/sexisme|sexiste/.test(text))return 'sexisme';
    if(/handicap/.test(text))return 'handicap';
    if(/origines?|racisme|raciale?/.test(text))return 'origines';
    if(/religio|religieu|conviction|laicite/.test(text))return 'religion';
    if(/lgbt/.test(text))return 'lgbt';
    if(/mixite|egalite femmes hommes/.test(text))return 'mixite';
    if(/intergeneration|generationnel/.test(text))return 'intergenerationnel';
    if(/collegue|collaborateur/.test(text))return 'collaborateur';
    if(/management|manager/.test(text))return 'management';
    return '';
  }

  function templates(){
    // Messages destinés aux collaborateurs : titre visible par les répondants, jamais le nom interne du Studio.
    const name=project?.respondent_title||project?.title||project?.campaign_name||'notre campagne';
    const share=diffusionAvailable()?String(communication.shareUrl||communication.share_url||'').trim():'';
    const link=share||'[LIEN DE CAMPAGNE À VENIR]';
    const close=formatLongDate(project?.close_date),launch=formatLongDate(project?.launch_date);
    // L’identifiant de thématique reste prioritaire. Le titre thématique couvre les imports Legacy.
    const key=communicationThemeKey(project?.theme_slug)||communicationThemeKey(project?.theme_title)||'general';
    const copy=communicationCopy[key];
    const anonymous='L’anonymat de vos réponses est garanti.';
    const campaign=`Campagne « ${name} »`;
    const email=(subject,paragraphs)=>`Objet : ${subject}\n\nBonjour à toutes et tous,\n\n${paragraphs.join('\n\n')}`;
    return {
      launch:{title:'Email lancement',meta:'À adresser aux personnes concernées au lancement',body:email(copy.subject,[copy.opening,copy.benefit,copy.invitation,anonymous,`${campaign}\n👉 ${copy.cta} : ${link}`,`Disponible du ${launch} au ${close}.`])},
      managers:{title:'Email managers',meta:'À adresser aux managers pour préparer et relayer la campagne',body:email(`Votre relais compte — ${name}`,[`La campagne « ${name} », conçue avec Me&YouToo, sera ouverte du ${launch} au ${close}.`,copy.managers,'Pour faciliter la participation, présentez la démarche lors d’un point d’équipe et proposez à chacun de réserver quelques minutes. Invitez les personnes concernées à répondre individuellement, sans leur demander leurs réponses ni leurs résultats personnels.',`L’anonymat des réponses est garanti. Vous pouvez transmettre le message ci-dessous :`,`« ${copy.short}\n\n${anonymous}\n\n👉 ${link}\nDisponible du ${launch} au ${close}. »`,'Merci pour votre relais et pour le temps accordé à cette démarche.'])},
      reminder:{title:'Relance',meta:'À envoyer à mi-parcours aux personnes concernées',body:email(copy.reminderSubject,[copy.reminder,anonymous,`${campaign}\n👉 ${copy.cta} : ${link}`,`Vous pouvez participer jusqu’au ${close}. Si vous avez déjà réalisé l’autodiagnostic, merci pour votre participation !`])},
      last:{title:'Dernière chance',meta:'À envoyer dans les derniers jours avant la clôture',body:email(`Derniers jours — ${copy.subject}`,[`La campagne « ${name} » se termine le ${close}.`,copy.last,anonymous,`👉 ${copy.cta} : ${link}`,'Vous avez déjà participé ? Merci d’avoir pris ce temps de réflexion !'])},
      channels:{title:'Teams / Slack',meta:'Message court à partager sur vos canaux internes',body:`${copy.short}\n\n${anonymous}\n\n${campaign}\n👉 ${link}\nDisponible du ${launch} au ${close}.`},
      intranet:{title:'Intranet',meta:'Article ou publication pour présenter la démarche',body:`${copy.subject}\n\n${copy.opening}\n\n${copy.benefit}\n\n${copy.invitation}\n\n${anonymous}\n\n${campaign}\nDisponible du ${launch} au ${close}.\n\n👉 ${copy.cta} : ${link}`},
      finalResults:{title:'Restitution finale',meta:'Remerciement après clôture — à compléter si une restitution est prévue',body:email(`Merci pour votre participation — ${name}`,[`La campagne « ${name} » est maintenant terminée. Merci à toutes celles et ceux qui ont pris le temps de réaliser cet autodiagnostic Me&YouToo.`,copy.final,'L’anonymat de vos réponses est garanti, y compris après la clôture de la campagne.','Merci pour votre participation à cette démarche.'])}
    };
  }

  function renderTemplate(name=currentTemplate){currentTemplate=name;const tpl=templates()[name]||templates().launch;$('tpl-title').textContent=tpl.title;$('tpl-meta').textContent=tpl.meta;$('tpl-body').textContent=tpl.body;document.querySelectorAll('.comm-tab').forEach(b=>b.classList.toggle('on',b.dataset.template===name));}


  function activateKitTab(name){
    if(!['graphics','messages','diffusion','delivery'].includes(name)||kitTabLocked(name))name='graphics';
    document.querySelectorAll('[data-kit-tab]').forEach(b=>{const on=b.dataset.kitTab===name;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on));});
    document.querySelectorAll('[data-kit-panel]').forEach(p=>{const on=p.dataset.kitPanel===name;p.hidden=!on;p.classList.toggle('is-active',on);});
    document.querySelectorAll('[data-process-tab]').forEach(b=>b.classList.toggle('is-current',b.dataset.processTab===name));
    try{sessionStorage.setItem('studio_kit_tab_'+projectId,name);}catch(e){}
  }
  function recommendedKitTab(){
    if(!isAdminDeliveryMode&&!kitValidated())return'graphics';
    const hasClientAssets=document.querySelectorAll('#client-assets .kit-file-row').length>0;
    if(hasDelivery())return'delivery';
    if(diffusionAvailable()&&(communication.shareUrl||communication.share_url))return'diffusion';
    if(hasClientAssets)return'messages';
    return'graphics';
  }

  async function refreshAssets(){const data=await api(`/api/projects/${projectId}/communication-assets`);communication=data.communication||{};renderAssets(data.assets||[]);renderVideo();renderLinks();renderTemplate();renderKitAvailability();}
  async function uploadBatch(files,kind,comment){
    for(let i=0;i<files.length;i++){const file=files[i],notify=i===files.length-1;await api(`/api/projects/${projectId}/communication-assets`,{method:'POST',body:JSON.stringify({filename:file.name,mimeType:file.type,sizeBytes:file.size,contentBase64:await fileToBase64(file),comment,kind,notify})});}
  }
  async function load(){if(!projectId){show('Aucune campagne sélectionnée.');return;}try{const [composer,me,assetsData]=await Promise.all([api(`/api/projects/${projectId}/composer`),api('/api/me'),api(`/api/projects/${projectId}/communication-assets`)]);project=composer.project;currentUser=me.user;isAdminDeliveryMode=currentUser?.role==='admin'&&sessionStorage.getItem('studio_interface_mode')!=='client';communication=assetsData.communication||{};$('kit-organization-name').textContent=project.organization_name||'Entreprise non renseignée';$('kit-commanditaire-name').textContent=project.commanditaire_name||'Non renseigné';$('kit-commanditaire-details').textContent=[project.commanditaire_job_title,project.commanditaire_email].filter(Boolean).join(' · ');$('kit-theme-name').textContent=project.theme_title||'Thématique non renseignée';$('kit-campaign-name').textContent=project.campaign_name||project.title||'Campagne';$('kit-respondent-title').textContent=project.respondent_title||'Non renseigné';$('kit-status-text').textContent=statusLabel(project.status);$('kit-project-status').textContent=statusLabel(project.status);$('kit-launch').textContent=date(project.launch_date);$('kit-close').textContent=date(project.close_date);$('admin-delivery-upload').hidden=!isAdminDeliveryMode;$('video-admin-box').hidden=!isAdminDeliveryMode;if(isAdminDeliveryMode){
      $('kit-page-eyebrow').textContent='Administration · Kit client';
      $('kit-page-intro').textContent='Pilotez la préparation et la livraison du kit de cette campagne. Consultez les éléments transmis par le client, déposez les livrables Me&YouToo et renseignez les liens de diffusion.';
      $('kit-back-link').textContent='← Retour au dossier client';
      $('kit-back-link').href='client.html?organizationId='+encodeURIComponent(project.organization_id)+'&projectId='+encodeURIComponent(project.id);
      $('graphics-tab-label').textContent='Éléments graphiques du client';
      $('client-assets-title').textContent='Éléments graphiques du client';
      $('client-assets-desc').textContent='Fichiers transmis par le client pour cette campagne.';
      $('kit-upload-title').textContent='🎨 Éléments graphiques du client';
      $('kit-upload-desc').textContent='Consultez ici les logos, chartes et consignes transmis par le client. Pour déposer vos livrables, utilisez l’onglet « Livraison Me&YouToo ».';
      $('brand-upload-button').hidden=true;$('brand-drop-zone').hidden=true;
    }else{
      $('kit-page-eyebrow').textContent='Après transmission';
      $('kit-back-link').textContent='← Mes campagnes';
      $('kit-back-link').href='mes-campagnes.html';
      $('graphics-tab-label').textContent='Vos éléments graphiques';
      $('client-assets-title').textContent='Vos éléments graphiques';
      $('client-assets-desc').textContent='Vous gardez ici la trace des fichiers transmis pour cette campagne.';
    }
    renderAssets(assetsData.assets||[]);renderVideo();renderLinks();renderTimeline();renderTemplate();renderKitAvailability();let saved='';try{saved=sessionStorage.getItem('studio_kit_tab_'+projectId)||'';}catch(e){}const requestedTab=p.get('tab');activateKitTab(!isAdminDeliveryMode&&!kitValidated()?'graphics':(['graphics','messages','diffusion','delivery'].includes(requestedTab)?requestedTab:(saved||recommendedKitTab())));}catch(e){show(e.message);}}
  bindDrop('brand-drop-zone','brand-input',brandFiles,'brand-selected','brand');bindDrop('delivery-drop-zone','delivery-input',deliveryFiles,'delivery-selected','delivery');
  $('brand-upload-button').onclick=async()=>{const files=pendingFiles(brandFiles,'brand-input');if(!files.length){show('Sélectionnez ou glissez-déposez au moins un fichier.');return;}const b=$('brand-upload-button');b.disabled=true;b.textContent='Envoi…';try{await uploadBatch(files,'client_brand',$('brand-comment').value.trim());brandFiles=[];$('brand-input').value='';renderSelected(brandFiles,'brand-selected','brand');$('brand-comment').value='';await refreshAssets();show('Vos éléments ont bien été transmis à Me&YouToo. Une notification a été envoyée à l’équipe Me&YouToo.','success');}catch(e){show(e.message);}finally{b.disabled=false;b.textContent='Envoyer à Me&YouToo';}};
  $('delivery-upload-button').onclick=async()=>{const files=pendingFiles(deliveryFiles,'delivery-input');if(!files.length){show('Ajoutez au moins un livrable.');return;}const b=$('delivery-upload-button');b.disabled=true;b.textContent='Mise à disposition…';try{await uploadBatch(files,'meayt_delivery',$('delivery-comment').value.trim());deliveryFiles=[];$('delivery-input').value='';renderSelected(deliveryFiles,'delivery-selected','delivery');$('delivery-comment').value='';await refreshAssets();show('Les ressources sont disponibles. Le client a été averti par mail et dans ses notifications Studio.','success');}catch(e){show(e.message);}finally{b.disabled=false;b.textContent='Mettre à disposition et notifier le client';}};
  $('video-save').onclick=async()=>{const url=$('video-url').value.trim(),description=$('video-description').value.trim();if(url&&!/^https:\/\//i.test(url)){show('Le lien vidéo doit commencer par https://');return;}try{const data=await api(`/api/projects/${projectId}/communication-video`,{method:'PATCH',body:JSON.stringify({videoDownloadUrl:url,videoDescription:description,notify:true})});communication=data.communication||{};renderVideo();renderKitAvailability();show('Le lien vidéo est enregistré et le client a été averti par mail.','success');}catch(e){show(e.message);}};
  $('video-clear').onclick=async()=>{try{const data=await api(`/api/projects/${projectId}/communication-video`,{method:'PATCH',body:JSON.stringify({videoDownloadUrl:'',videoDescription:'',notify:false})});communication=data.communication||{};renderVideo();renderKitAvailability();show('Le lien vidéo a été retiré.','success');}catch(e){show(e.message);}};
  $('share-copy').onclick=()=>diffusionAvailable()&&copyText(String(communication.shareUrl||communication.share_url||''));
  $('results-copy').onclick=()=>diffusionAvailable()&&copyText(String(communication.resultsUrl||communication.results_url||''));
  $('share-open').addEventListener('click',e=>{if(e.currentTarget.getAttribute('aria-disabled')==='true')e.preventDefault();});
  $('results-open').addEventListener('click',e=>{if(e.currentTarget.getAttribute('aria-disabled')==='true')e.preventDefault();});
  document.querySelectorAll('.comm-tab').forEach(b=>b.onclick=()=>renderTemplate(b.dataset.template));
  $('tpl-copy').onclick=()=>copyText($('tpl-body').textContent);
  $('links-save').onclick=async()=>{const shareUrl=$('share-url-admin').value.trim(),resultsUrl=$('results-url-admin').value.trim();if(shareUrl&&!/^https:\/\//i.test(shareUrl)){show('Le lien de campagne doit commencer par https://');return;}if(resultsUrl&&!/^https:\/\//i.test(resultsUrl)){show('Le lien de résultats doit commencer par https://');return;}try{const data=await api(`/api/projects/${projectId}/communication-links`,{method:'PATCH',body:JSON.stringify({shareUrl,resultsUrl,notify:true})});communication={...communication,...(data.communication||{})};renderLinks();renderTemplate();renderKitAvailability();show('Les liens sont enregistrés et le client a été averti par mail.','success');}catch(e){show(e.message);}};
  $('kit-delete-confirm').onclick=confirmDeleteAsset;
  $('kit-delete-cancel').onclick=closeDeleteModal;
  $('kit-delete-close').onclick=closeDeleteModal;
  $('kit-delete-modal').addEventListener('click',e=>{if(e.target===$('kit-delete-modal'))closeDeleteModal();});
  document.querySelectorAll('[data-kit-tab]').forEach(b=>b.onclick=()=>activateKitTab(b.dataset.kitTab));
  document.querySelectorAll('[data-process-tab]').forEach(b=>b.onclick=()=>activateKitTab(b.dataset.processTab));
  load();
})();
