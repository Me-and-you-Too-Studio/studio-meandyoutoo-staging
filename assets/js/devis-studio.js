// Demande de devis Studio : envoi direct au formulaire HubSpot « Demande de devis STUDIO MEAYT ».
// Sert la page devis-studio.html et, sur les autres pages publiques (tarifs), ouvre le formulaire
// dans une fenêtre au clic sur un lien « Demander un devis » (sans JavaScript, le lien mène à la page).
(function(){
  'use strict';
  var HUBSPOT_PORTAL_ID='139575435',HUBSPOT_FORM_GUID='5134e270-0672-432b-8e5f-86e8a61ca536';
  var CONSENT='J’accepte que Me&YouToo utilise ces informations pour répondre à ma demande.';
  var PRIVATE_DOMAINS=['gmail.com','googlemail.com','hotmail.com','hotmail.fr','outlook.com','outlook.fr','live.com','live.fr','yahoo.com','yahoo.fr','icloud.com','me.com','mac.com','orange.fr','wanadoo.fr','free.fr','sfr.fr','laposte.net','proton.me','protonmail.com','gmx.com','gmx.fr'];
  var PLANS={annual:'Abonnement annuel Studio',monthly:'Abonnement mensuel Studio',passations:'Passations Studio'};
  var PLAN_LABELS={annual:'Abonnement annuel — 2 500 € HT / an',monthly:'Abonnement mensuel — 250 € HT / mois',passations:'Passations / volume de déploiement'};
  // ?plan=annual|monthly, ou ?subject=passations (bouton « Parler de mes besoins en passations »).
  function planFrom(params){return params.get('subject')==='passations'?'passations':params.get('plan');}

  function wire(form,ui,onSent){
    form.addEventListener('submit',function(e){
      e.preventDefault();ui.error.hidden=true;ui.success.hidden=true;
      if(!form.checkValidity()){form.reportValidity();return;}
      var email=String(form.elements.email.value||'').trim().toLowerCase();
      if(PRIVATE_DOMAINS.indexOf(email.split('@')[1]||'')>=0){ui.error.textContent='Merci d’utiliser votre adresse e-mail professionnelle.';ui.error.hidden=false;form.elements.email.focus();return;}
      var fields=Array.from(form.elements).filter(function(el){return el.name&&el.name!=='consent'&&String(el.value).trim();})
        .map(function(el){return {name:el.name,value:String(el.value).trim()};});
      var label=ui.submit.textContent;ui.submit.disabled=true;ui.submit.textContent='Envoi…';
      fetch('https://api-eu1.hsforms.com/submissions/v3/integration/submit/'+HUBSPOT_PORTAL_ID+'/'+HUBSPOT_FORM_GUID,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({fields:fields,context:{pageUri:location.href,pageName:document.title},legalConsentOptions:{consent:{consentToProcess:true,text:CONSENT}}})})
      .then(function(res){if(!res.ok)throw new Error();ui.success.hidden=false;onSent();})
      .catch(function(){ui.error.textContent='Une erreur est survenue lors de l’envoi. Vous pouvez aussi nous contacter à contact@meandyoutoo.app.';ui.error.hidden=false;})
      .finally(function(){ui.submit.disabled=false;ui.submit.textContent=label;});
    });
  }

  // Page devis-studio.html
  var pageForm=document.getElementById('studioQuoteForm');
  if(pageForm){
    var select=document.getElementById('offerSelect'),plan=planFrom(new URLSearchParams(location.search));
    if(PLANS[plan])select.value=PLANS[plan];
    wire(pageForm,{submit:document.getElementById('quoteSubmit'),error:document.getElementById('quoteError'),success:document.getElementById('quoteSuccess')},
      function(){var chosen=select.value;pageForm.reset();select.value=chosen;});
    return;
  }

  // Autres pages : fenêtre de devis
  function openDialog(plan){
    var dlg=document.createElement('dialog');dlg.className='offer-dialog';
    var options=Object.keys(PLANS).map(function(k){return '<option value="'+PLANS[k]+'"'+(k===plan?' selected':'')+'>'+PLAN_LABELS[k]+'</option>';}).join('');
    dlg.innerHTML='<form novalidate><p class="offer-cat">Demande de devis</p><h2>Parlons de votre accès au Studio</h2>'+
      '<div class="offer-field-row"><label class="offer-field"><span>Prénom *</span><input name="firstname" required autocomplete="given-name"></label><label class="offer-field"><span>Nom *</span><input name="lastname" required autocomplete="family-name"></label></div>'+
      '<label class="offer-field"><span>E-mail professionnel *</span><input name="email" type="email" required autocomplete="email"></label>'+
      '<div class="offer-field-row"><label class="offer-field"><span>Entreprise *</span><input name="company" required autocomplete="organization"></label><label class="offer-field"><span>Intitulé du poste *</span><input name="jobtitle" required autocomplete="organization-title"></label></div>'+
      '<div class="offer-field-row"><label class="offer-field"><span>Formule souhaitée *</span><select name="formule_studio_souhaitee" required>'+options+'</select></label><label class="offer-field"><span>Collaborateurs concernés</span><input name="nombre_de_collaborateurs_concernes" type="number" min="1" inputmode="numeric"></label></div>'+
      '<label class="offer-field"><span>Votre message</span><textarea name="message_ou_besoins_specifiques" rows="3" placeholder="Contexte, calendrier, volumes envisagés, contraintes achats…"></textarea></label>'+
      '<label class="offer-check"><input type="checkbox" name="consent" required> '+CONSENT.replace('&','&amp;')+' *</label>'+
      '<p class="offer-form-error" hidden></p><p class="offer-form-ok" hidden>Merci ! Votre demande de devis a bien été transmise à l’équipe Me&amp;YouToo, qui revient vers vous rapidement.</p>'+
      '<div class="offer-dialog-actions"><button type="button" class="btn secondary" data-close>Fermer</button><button type="submit" class="btn primary">Envoyer ma demande de devis</button></div></form>';
    document.body.appendChild(dlg);
    var form=dlg.querySelector('form'),submit=form.querySelector('[type=submit]');
    dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
    dlg.addEventListener('close',function(){dlg.remove();});
    wire(form,{submit:submit,error:dlg.querySelector('.offer-form-error'),success:dlg.querySelector('.offer-form-ok')},function(){
      form.querySelectorAll('input,select,textarea').forEach(function(el){el.disabled=true;});submit.style.display='none';
    });
    dlg.showModal();form.elements.firstname.focus();
  }
  document.addEventListener('click',function(e){
    var link=e.target.closest&&e.target.closest('a[href^="devis-studio.html"]');
    if(!link||typeof HTMLDialogElement==='undefined'||e.ctrlKey||e.metaKey||e.shiftKey)return;
    e.preventDefault();openDialog(planFrom(new URL(link.href,location.href).searchParams));
  });
})();
