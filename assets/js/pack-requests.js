(function(){
  var number=new Intl.NumberFormat('fr-FR');
  function formatDate(value){if(!value)return'';var d=new Date(String(value).slice(0,10)+'T12:00:00');return Number.isNaN(d.getTime())?'':d.toLocaleDateString('fr-FR');}
  function renderBalance(organization){
    var root=document.getElementById('pack-credit-balance');if(!root||!organization)return;
    var value=document.getElementById('pack-balance-value'),detail=document.getElementById('pack-balance-detail'),bar=document.getElementById('pack-balance-bar');
    var unlimited=Boolean(organization.pack_unlimited),quota=Number(organization.passations_quota)||0,used=Number(organization.passations_used)||0;
    var remaining=organization.passations_remaining==null?Math.max(0,quota-used):Number(organization.passations_remaining);
    var percent=unlimited?100:(quota?Math.max(0,Math.min(100,Math.round(remaining/quota*100))):0);
    value.textContent=unlimited?'Illimité':number.format(remaining);
    var expiry=formatDate(organization.pack_expires_at);
    detail.textContent=(unlimited?'passations sans limite':('passation'+(remaining>1?'s':'')+' disponible'+(remaining>1?'s':'')))+(expiry?' · valable jusqu’au '+expiry:' · aucune échéance renseignée');
    if(bar)bar.style.width=percent+'%';root.dataset.level=percent<=10?'danger':percent<=25?'warning':'good';
    var pending=organization.pending_pack_request;
    if(pending){var volume=pending.unlimited?'illimité':number.format(pending.volume||0);setStatus('⏳ Une demande de pack '+volume+' est déjà en attente de validation par Me&YouToo.','pending');setPackLinksDisabled(true);}else{setPackLinksDisabled(false);}
  }
  async function loadBalance(){
    var root=document.getElementById('pack-credit-balance');if(!root)return;
    try{var data=await StudioAPI.request('/api/me/organization-quota');if(!data.organization)throw new Error('Organisation introuvable');renderBalance(data.organization);}
    catch(error){document.getElementById('pack-balance-value').textContent='—';document.getElementById('pack-balance-detail').textContent='Solde indisponible';root.dataset.level='danger';}
  }
  function setPackLinksDisabled(disabled){[].slice.call(document.querySelectorAll('.inline-pack-grid a,.pack-chip-cta')).forEach(function(item){if(disabled)item.setAttribute('aria-disabled','true');else item.removeAttribute('aria-disabled');});}
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
    setPackLinksDisabled(true);
    setStatus('Envoi de votre demande…','loading');
    try{
      var data=await StudioAPI.request('/api/me/pack-requests',{method:'POST',body:JSON.stringify({packCode:code})});
      var expiry=data.request&&data.request.expires_at?new Date(String(data.request.expires_at).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR'):'dans 12 mois';
      setStatus('✓ Demande enregistrée. Elle attend la validation de Me&YouToo.','success');
      if(window.StudioModal)await StudioModal.alert({eyebrow:'Demande enregistrée',title:'Votre demande a bien été envoyée',message:'Me&YouToo et les administrateurs ont été notifiés. Après validation, le pack sera valable jusqu’au '+expiry+'.',confirmLabel:'Fermer'});
      window.dispatchEvent(new CustomEvent('studio:pack-requested',{detail:data}));
    }catch(error){setStatus(error.message||'Impossible d’envoyer la demande.','error');if(window.StudioModal)await StudioModal.alert({type:'error',eyebrow:'Demande de pack',title:'Envoi impossible',message:error.message||'Une erreur est survenue.',confirmLabel:'Fermer'});}
    finally{loadBalance();}
  }
  document.addEventListener('click',function(event){var link=event.target.closest('.inline-pack-grid a,.pack-chip-cta');if(!link)return;event.preventDefault();if(link.getAttribute('aria-disabled')==='true')return;requestPack(link);});
  loadBalance();
})();
