(()=>{
  const p=new URLSearchParams(location.search),theme=p.get('theme')||'sexisme',projectId=p.get('projectId')||'';
  const api=(url,opt={})=>window.StudioAPI.request(url,opt);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const colorRank=color=>{const c=String(color||'').toLowerCase();if(c.includes('ff847')||c.includes('ff84')||c.includes('b423')||c.includes('red'))return 0;if(c.includes('ffc')||c.includes('yellow'))return 1;if(c.includes('77cd')||c.includes('green'))return 2;return 3;};
  function card(ch,ci,pr,pi){return `<article class="profile-excel-card"><div class="profile-excel-head"><div><small>Chapitre ${ci+1} · Profil ${pi+1}/3</small><h3>${esc(ch.title)}</h3></div><span class="profile-color" style="background:${esc(pr.color)}"></span></div><div class="field"><label>Titre du profil</label><input data-profile-title="${pr.id}" value="${esc(pr.title)}"></div><div class="field"><label>Résumé du profil</label><textarea rows="4" data-profile-summary="${pr.id}">${esc(pr.summary)}</textarea></div><div class="field"><label>Contenu détaillé du profil</label><textarea rows="10" data-profile-content="${pr.id}">${esc(pr.content)}</textarea></div><div class="profile-method"><strong>Seuil :</strong> ${pr.scoring_min} → ${pr.scoring_max} · non modifiable</div></article>`;}
  async function load(){
    try{
      if(!projectId){const project=await window.StudioProject.createOrResume(theme);location.replace(`personnalisation.html?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(project.id)}`);return;}
      const d=await api(`/api/projects/${projectId}/composer`);const chapters=d.chapters||[];
      document.getElementById('theme-name').textContent=d.project?.theme_title||'Sexisme';
      document.getElementById('profiles-root').innerHTML=chapters.map((ch,ci)=>{const profiles=[...(ch.profiles||[])].sort((a,b)=>colorRank(a.color)-colorRank(b.color));return `<section class="profile-chapter"><div class="section-head"><div><h2 class="section-title">${esc(ch.title)}</h2><p class="section-desc">3 profils issus du référentiel Me&YouToo.</p></div></div><div class="profile-excel-grid">${profiles.map((pr,pi)=>card(ch,ci,pr,pi)).join('')}</div></section>`;}).join('');
      if(chapters.some(ch=>(ch.profiles||[]).length!==3))throw new Error('Le référentiel doit contenir exactement 3 profils par chapitre.');
      await api(`/api/projects/${projectId}/progress`,{method:'PATCH',body:JSON.stringify({currentStep:'personnalisation'})});
      bind();const q=`?theme=${encodeURIComponent(theme)}&projectId=${encodeURIComponent(projectId)}`;document.getElementById('back-link').href='composer.html'+q;document.getElementById('next-link').href='parametrage.html'+q;
    }catch(e){const a=document.getElementById('profiles-alert');a.hidden=false;a.textContent=e.message;}
  }
  function bind(){document.querySelectorAll('[data-profile-title],[data-profile-summary],[data-profile-content]').forEach(el=>el.addEventListener('change',async()=>{const id=el.dataset.profileTitle||el.dataset.profileSummary||el.dataset.profileContent;const key=el.dataset.profileTitle?'title':el.dataset.profileSummary?'summary':'content';try{await api(`/api/projects/${projectId}/profiles/${id}`,{method:'PATCH',body:JSON.stringify({[key]:el.value})});}catch(e){alert(e.message);}}));}
  load();
})();
