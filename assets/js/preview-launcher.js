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
    m.innerHTML=`<div class="rp-window"><header><div><b>${isProject?'Aperçu de ma campagne':'Aperçu répondant du diagnostic'}</b><span>${isProject?'Version composée par le client — aucune réponse enregistrée':'Version catalogue Me&YouToo — aucune réponse enregistrée'}</span></div><button aria-label="Fermer">×</button></header><iframe title="${isProject?'Aperçu de ma campagne':'Aperçu répondant du diagnostic'}"></iframe></div>`;
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
      ?'Voir exactement le parcours répondant avec le contenu réellement composé et enregistré pour cette campagne'
      :'Découvrir le parcours répondant standard de ce diagnostic Me&YouToo';
    b.onclick=open;
    return b;
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
      if(t&&!document.querySelector('[data-rp="top"]')){
        const topButton=makeButton('top');
        topButton.classList.add('rp-trigger');
        t.appendChild(topButton);
      }

      const sticky=document.querySelector('.creation-sticky-actions');
      if(sticky&&!document.querySelector('[data-rp="sticky"]')){
        const stickyButton=makeButton('sticky');
        stickyButton.classList.add('rp-trigger-sticky');
        const primary=sticky.querySelector('.button-primary');
        if(primary)sticky.insertBefore(stickyButton,primary);
        else sticky.appendChild(stickyButton);
      }

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

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',add):add();
})();
