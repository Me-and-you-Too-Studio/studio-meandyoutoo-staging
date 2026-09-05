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

  function add(){
    if(document.querySelector('[data-rp]'))return;
    const start=document.querySelector('.hero-panel [data-start-theme]');
    const b=document.createElement('button');
    b.type='button';
    b.dataset.rp='1';
    b.className='button button-secondary';
    b.innerHTML=isProject?'👁 Aperçu de ma campagne':'👁 Voir l’aperçu répondant';
    b.title=isProject
      ?'Voir exactement le parcours répondant avec le contenu composé pour cette campagne'
      :'Découvrir le parcours répondant standard de ce diagnostic Me&YouToo';
    b.onclick=open;
    if(start){
      b.style.margin='16px 0 0 8px';
      start.after(b);
    }else{
      const t=document.querySelector('.compact-topbar>div')||document.querySelector('.topbar>div');
      if(t){b.classList.add('rp-trigger');t.appendChild(b)}
    }
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',add):add();
})();
