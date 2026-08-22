(function(){
  function packCodeFromLink(link){
    try{return new URL(link.href,location.href).searchParams.get('volume')||'';}catch(error){return'';}
  }
  function setStatus(message,type){
    var root=document.getElementById('pack-request-status');
    if(!root){root=document.createElement('div');root.id='pack-request-status';root.className='pack-request-status';var panel=document.getElementById('inline-packs')||document.querySelector('.pack-chip-grid');if(panel)panel.insertAdjacentElement('afterend',root);}
    if(root){root.className='pack-request-status '+(type||'');root.textContent=message||'';root.hidden=!message;}
  }
  async function requestPack(link){
    var code=packCodeFromLink(link);if(!code)return;
    var label=code==='illimite'?'Illimité':Number(code).toLocaleString('fr-FR')+' passations';
    var confirmed=window.StudioModal?await StudioModal.confirm({eyebrow:'Pack de passations',title:'Envoyer cette demande ?',message:'Pack choisi : '+label+'\n\nLa demande sera enregistrée et transmise à Me&YouToo. Votre pack sera crédité après validation administrative.',confirmLabel:'Envoyer la demande'}):true;
    if(!confirmed)return;
    var links=[].slice.call(document.querySelectorAll('.inline-pack-grid a,.pack-chip-cta'));links.forEach(function(item){item.setAttribute('aria-disabled','true');});
    setStatus('Envoi de votre demande…','loading');
    try{
      var data=await StudioAPI.request('/api/me/pack-requests',{method:'POST',body:JSON.stringify({packCode:code})});
      var expiry=data.request&&data.request.expires_at?new Date(String(data.request.expires_at).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR'):'dans 12 mois';
      setStatus('✓ Demande enregistrée. Elle attend la validation de Me&YouToo.','success');
      if(window.StudioModal)await StudioModal.alert({eyebrow:'Demande enregistrée',title:'Votre demande a bien été envoyée',message:'Me&YouToo et les administrateurs ont été notifiés. Après validation, le pack sera valable jusqu’au '+expiry+'.',confirmLabel:'Fermer'});
      window.dispatchEvent(new CustomEvent('studio:pack-requested',{detail:data}));
    }catch(error){setStatus(error.message||'Impossible d’envoyer la demande.','error');if(window.StudioModal)await StudioModal.alert({type:'error',eyebrow:'Demande de pack',title:'Envoi impossible',message:error.message||'Une erreur est survenue.',confirmLabel:'Fermer'});}
    finally{links.forEach(function(item){item.removeAttribute('aria-disabled');});}
  }
  document.addEventListener('click',function(event){var link=event.target.closest('.inline-pack-grid a,.pack-chip-cta');if(!link)return;event.preventDefault();if(link.getAttribute('aria-disabled')==='true')return;requestPack(link);});
})();
