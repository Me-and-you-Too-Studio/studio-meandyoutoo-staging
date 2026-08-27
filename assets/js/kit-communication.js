(()=>{
  const p=new URLSearchParams(location.search),projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt),$=id=>document.getElementById(id);
  let selectedFiles=[],currentUser=null;
  const date=v=>{if(!v)return '—';const d=String(v).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return '—';return new Date(d+'T12:00:00').toLocaleDateString('fr-FR');};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusLabel=status=>({draft:'Brouillon',configuration_submitted:'Configuration transmise',published:'Publiée',active:'En cours',closed:'Clôturée'}[status]||status||'—');
  const formatSize=n=>n>=1048576?`${(n/1048576).toFixed(1).replace('.',',')} Mo`:`${Math.max(1,Math.round(n/1024))} Ko`;
  function show(message,type='error'){const a=$('kit-alert');a.hidden=false;a.textContent=message;a.className=`composer-alert ${type==='success'?'is-success':''}`;}
  function renderSelected(){
    $('brand-selected').innerHTML=selectedFiles.length?selectedFiles.map((f,i)=>`<div class="kit-selected-file"><span>📎 ${esc(f.name)} <small>${formatSize(f.size)}</small></span><button type="button" data-remove-file="${i}" aria-label="Retirer">×</button></div>`).join(''):'';
    document.querySelectorAll('[data-remove-file]').forEach(b=>b.onclick=()=>{selectedFiles.splice(Number(b.dataset.removeFile),1);renderSelected();});
  }
  async function fileToBase64(file){
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(new Error(`Impossible de lire ${file.name}`));r.readAsDataURL(file);});
  }
  async function downloadAsset(id,name){
    try{
      const token=localStorage.getItem('studio_token')||'';
      const base=window.StudioAPI.baseUrl||window.STUDIO_API_BASE||'';
      const response=await fetch(`${base}/api/projects/${projectId}/communication-assets/${id}/download`,{headers:{Authorization:`Bearer ${token}`}});
      if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Téléchargement impossible');
      const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name||'fichier';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){show(e.message);}
  }
  function renderAssets(assets){
    const client=assets.filter(a=>a.kind==='client_brand'),delivery=assets.filter(a=>a.kind==='meayt_delivery');
    const html=list=>list.length?list.map(a=>`<article class="kit-file-row"><div class="kit-file-icon">${a.mime_type==='application/pdf'?'PDF':'IMG'}</div><div class="kit-file-main"><strong>${esc(a.filename)}</strong><span>${formatSize(Number(a.size_bytes)||0)} · ${new Date(a.created_at).toLocaleDateString('fr-FR')}</span>${a.comment?`<small>${esc(a.comment)}</small>`:''}</div><button class="button button-secondary" type="button" data-download="${a.id}" data-name="${esc(a.filename)}">Télécharger</button></article>`).join(''):'<div class="kit-empty">Aucun fichier disponible pour le moment.</div>';
    $('client-assets').innerHTML=html(client);$('delivery-assets').innerHTML=html(delivery);
    document.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>downloadAsset(b.dataset.download,b.dataset.name));
  }
  async function load(){
    if(!projectId){show('Aucune campagne sélectionnée.');$('brand-upload-button').disabled=true;return;}
    try{
      const [composer,me,assetsData]=await Promise.all([api(`/api/projects/${projectId}/composer`),api('/api/me'),api(`/api/projects/${projectId}/communication-assets`)]);
      const project=composer.project;currentUser=me.user;
      $('kit-campaign-name').textContent=project.campaign_name||project.title||'Campagne';
      $('kit-status-text').textContent=statusLabel(project.status);$('kit-project-status').textContent=statusLabel(project.status);
      $('kit-launch').textContent=date(project.launch_date);$('kit-close').textContent=date(project.close_date);
      if(currentUser?.role==='admin'){
        $('kit-upload-title').textContent='Déposer un livrable Me&YouToo';
        $('kit-upload-desc').textContent='Ajoutez ici les affiches, bannières ou autres fichiers finalisés pour que le client puisse les télécharger.';
        $('brand-upload-button').textContent='Mettre à disposition du client';
      }
      renderAssets(assetsData.assets||[]);
    }catch(e){show(e.message);}
  }
  $('brand-input').addEventListener('change',()=>{
    const files=[...$('brand-input').files],allowed=new Set(['application/pdf','image/png','image/jpeg']);
    for(const file of files){
      if(!allowed.has(file.type)){show(`${file.name} : format non accepté.`);continue;}
      if(file.size>4*1024*1024){show(`${file.name} dépasse 4 Mo.`);continue;}
      selectedFiles.push(file);
    }
    $('brand-input').value='';renderSelected();
  });
  $('brand-upload-button').onclick=async()=>{
    if(!selectedFiles.length){show('Sélectionnez au moins un fichier.');return;}
    const button=$('brand-upload-button');button.disabled=true;button.textContent='Envoi…';
    try{
      const comment=$('brand-comment').value.trim();
      for(const file of selectedFiles){
        const contentBase64=await fileToBase64(file);
        await api(`/api/projects/${projectId}/communication-assets`,{method:'POST',body:JSON.stringify({filename:file.name,mimeType:file.type,sizeBytes:file.size,contentBase64,comment})});
      }
      selectedFiles=[];renderSelected();$('brand-comment').value='';
      const data=await api(`/api/projects/${projectId}/communication-assets`);renderAssets(data.assets||[]);
      show(currentUser?.role==='admin'?'Le livrable est maintenant disponible pour le client.':'Vos éléments ont bien été transmis à Me&YouToo.','success');
    }catch(e){show(e.message);}
    finally{button.disabled=false;button.textContent=currentUser?.role==='admin'?'Mettre à disposition du client':'Envoyer à Me&YouToo';}
  };
  load();
})();