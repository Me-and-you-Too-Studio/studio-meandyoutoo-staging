(()=>{
  const p=new URLSearchParams(location.search);
  const pid=p.get('projectId')||'';
  const theme=p.get('theme')||document.querySelector('[data-start-theme]')?.dataset.startTheme||'';
  const isProject=Boolean(pid);

  function modal(){
    let m=document.querySelector('#rp-modal');
    if(m)return m;
    m=document.createElement('div');
    m.id='rp-modal';
    m.hidden=true;
    m.innerHTML=`<div class="rp-window"><header><div><b>${isProject?'Aperçu de ma campagne':'Aperçu répondant du diagnostic'}</b><span>${isProject?'Contenu réel enregistré pour cette campagne — aucune réponse enregistrée':'Version catalogue Me&YouToo — aucune réponse enregistrée'}</span></div><button aria-label="Fermer">×</button></header><iframe title="${isProject?'Aperçu de ma campagne':'Aperçu répondant du diagnostic'}"></iframe></div>`;
    document.body.appendChild(m);
    m.querySelector('header button').onclick=close;
    m.onclick=e=>{if(e.target===m)close()};
    return m;
  }

  function close(){
    const m=modal();
    m.hidden=true;
    m.querySelector('iframe').src='about:blank';
    document.body.classList.remove('rp-open');
  }

  function open(){
    const live=isProject?(window.StudioComposerPreviewSnapshot?.()||window.StudioParametragePreviewSnapshot?.()||null):null;
    if(live)sessionStorage.setItem('meayt_preview',JSON.stringify(live));
    else sessionStorage.removeItem('meayt_preview');
    const m=modal();
    m.querySelector('iframe').src=isProject
      ?`apercu-repondant.html?mode=project&projectId=${encodeURIComponent(pid)}&theme=${encodeURIComponent(theme)}`
      :`apercu-repondant.html?mode=catalog&theme=${encodeURIComponent(theme)}`;
    m.hidden=false;
    document.body.classList.add('rp-open');
  }

  function makeButton(kind){
    const b=document.createElement('button');
    b.type='button';
    b.dataset.rp=kind||'1';
    b.className='button button-secondary';
    b.innerHTML=isProject?'👁 Aperçu de ma campagne':'👁 Voir l’aperçu répondant';
    b.title=isProject
      ?'Voir le parcours répondant avec le contenu réel enregistré pour cette campagne'
      :'Découvrir le parcours répondant standard de ce diagnostic Me&YouToo';
    b.onclick=open;
    return b;
  }

  function makeSettingsAction(){
    if(!isProject)return null;
    const user=window.StudioAPI?.user?.()||{};
    const isAdmin=user.role==='admin'&&(!window.StudioAPI?.interfaceMode||window.StudioAPI.interfaceMode()!=='client');
    const wrap=document.createElement('span');
    wrap.className='campaign-settings-shortcut';
    const a=document.createElement('a');
    a.className='button button-primary campaign-settings-shortcut-link';
    a.href=`parametrage.html?projectId=${encodeURIComponent(pid)}`;
    a.innerHTML='⚙️ Paramétrage';
    a.setAttribute('aria-label',isAdmin?'Ouvrir le paramétrage de la campagne':'Consulter le paramétrage de la campagne');
    const info=document.createElement('span');
    info.className='campaign-settings-info-wrap';
    const dot=document.createElement('button');
    dot.type='button';
    dot.className='campaign-settings-info-dot';
    dot.textContent='i';
    dot.setAttribute('aria-label','Que contient le paramétrage ?');
    const bubble=document.createElement('span');
    bubble.className='campaign-settings-info-bubble';
    bubble.innerHTML=isAdmin
      ?'<strong>Paramétrage de la campagne</strong>Vous y retrouvez notamment l’introduction, les questions socio-démographiques (DSD), les dates de campagne, les ressources après résultats et les autres réglages de diffusion.'
      :'<strong>Paramétrage de la campagne</strong>Vous pouvez consulter ici l’introduction, les questions socio-démographiques (DSD), les dates de campagne, les ressources après résultats et les autres réglages. Si la campagne est verrouillée, utilisez « Demander un ajustement » : vous ne modifiez pas directement ces éléments.';
    info.append(dot,bubble);
    wrap.append(a,info);
    return wrap;
  }

  function addTopActions(target){
    if(!isProject||!target)return;
    if(target.querySelector('.campaign-preview-settings-actions'))return;
    const actions=document.createElement('div');
    actions.className='campaign-preview-settings-actions';
    const preview=makeButton('top');
    preview.classList.add('rp-trigger');
    const settings=makeSettingsAction();
    actions.append(preview);
    if(settings)actions.append(settings);
    target.appendChild(actions);
  }

  function syncSticky(){
    if(!isProject)return;
    const sticky=document.querySelector('.creation-sticky-actions');
    if(!sticky)return;
    const existing=sticky.querySelector('[data-rp="sticky"]');
    const onPersonalisation=location.pathname.toLowerCase().endsWith('/personnalisation.html')||location.pathname.toLowerCase().endsWith('personnalisation.html');
    const allowed=onPersonalisation&&document.body.classList.contains('rp-sticky-preview-enabled');
    if(!allowed){if(existing)existing.remove();return;}
    if(existing)return;
    const stickyButton=makeButton('sticky');
    stickyButton.classList.add('rp-trigger-sticky');
    const primary=sticky.querySelector('.button-primary');
    if(primary)sticky.insertBefore(stickyButton,primary);else sticky.appendChild(stickyButton);
  }

  function add(){
    const start=document.querySelector('.hero-panel [data-start-theme]');
    if(start&&!document.querySelector('[data-rp="catalog"]')){
      const b=makeButton('catalog');
      b.style.margin='16px 0 0 8px';
      start.after(b);
      return;
    }

    if(isProject){
      const t=document.querySelector('.compact-topbar>div')||document.querySelector('.topbar>div');
      if(t&&!document.querySelector('[data-rp="top"]'))addTopActions(t);

      syncSticky();

      const bottomActions=document.querySelector('#settings-form .top-actions');
      if(bottomActions&&!document.querySelector('[data-rp="bottom"]')){
        const bottomButton=makeButton('bottom');
        bottomButton.classList.add('rp-trigger-bottom');
        const primary=bottomActions.querySelector('.button-primary');
        if(primary)bottomActions.insertBefore(bottomButton,primary);
        else bottomActions.appendChild(bottomButton);
      }
      return;
    }

    if(!document.querySelector('[data-rp]')){
      const t=document.querySelector('.compact-topbar>div')||document.querySelector('.topbar>div');
      if(t){
        const b=makeButton('top');
        b.classList.add('rp-trigger');
        t.appendChild(b);
      }
    }
  }

  document.addEventListener('studio:preview-layout-changed',syncSticky);
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',add):add();
})();
