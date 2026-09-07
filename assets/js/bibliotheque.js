(function(){
  const root=document.getElementById('library-topics'),search=document.getElementById('search-topic');if(!root)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const known={sexisme:'theme-sexisme.html',handicap:'theme-handicap.html',lgbt:'theme-lgbt.html',origines:'theme-origines.html',religion:'theme-religion.html',intergenerationnel:'theme-intergenerationnel.html',management:'theme-management.html',collaborateur:'theme-collaborateur.html'};
  const fallbackDescriptions={management:'Équité, reconnaissance, décisions, feedback et coopération au quotidien.',sexisme:'Stéréotypes, micro-agressions, comportements sexistes et prévention.',handicap:"Recrutement, intégration, accessibilité et maintien dans l'emploi.",origines:'Préjugés, représentations, équité et inclusion au quotidien.',lgbt:'Inclusion, expressions de soi, alliances et discriminations ordinaires.',religion:'Comprendre, respecter la neutralité et gérer les situations sensibles.',intergenerationnel:'Coopération, transmission, représentations entre générations.',collaborateur:'Comportements du quotidien, coopération, vigilance et posture inclusive.'};
  const plannedThemes=[
    {slug:'sexisme',title:'Sexisme au travail',description:fallbackDescriptions.sexisme,situation_count:27,chapter_count:4},
    {slug:'handicap',title:'Handicap',description:fallbackDescriptions.handicap,situation_count:46,chapter_count:4},
    {slug:'lgbt',title:'LGBT+',description:fallbackDescriptions.lgbt,situation_count:38,chapter_count:4},
    {slug:'origines',title:'Diversité des origines',description:fallbackDescriptions.origines,situation_count:52,chapter_count:6},
    {slug:'religion',title:'Diversité religieuse et convictions',description:fallbackDescriptions.religion,situation_count:34,chapter_count:4},
    {slug:'intergenerationnel',title:'Intergénérationnel',description:fallbackDescriptions.intergenerationnel,situation_count:28,chapter_count:4},
    {slug:'management',title:'Management inclusif',description:fallbackDescriptions.management,situation_count:62,chapter_count:6},
    {slug:'collaborateur',title:'Collaborateur inclusif',description:fallbackDescriptions.collaborateur,situation_count:42,chapter_count:5}
  ];
  let themes=[];
  function href(t){return known[t.slug]||('theme.html?theme='+encodeURIComponent(t.slug));}
  function render(){const q=(search?.value||'').trim().toLowerCase(),filtered=themes.filter(t=>!q||[t.title,t.description,t.slug].some(v=>String(v||'').toLowerCase().includes(q)));root.innerHTML=filtered.map(t=>`<article class="card topic-card"><div class="topic-illustration"><img src="assets/img/illustrations/theme-${esc(t.slug)}.png" alt="" onerror="this.closest('.topic-illustration').style.display='none'"></div><div class="topic-body"><h3>${esc(t.title)}</h3><p>${esc(t.description||fallbackDescriptions[t.slug]||'Une thématique issue du référentiel propriétaire Me&YouToo.')}</p><div class="meta-row"><span class="meta">${Number(t.situation_count||0)} situations</span><span class="meta">${Number(t.chapter_count||0)} chapitres</span></div><a class="button button-secondary" href="${href(t)}">Découvrir les situations</a></div></article>`).join('')||'<article class="card topic-card"><div class="topic-body"><h3>Aucune thématique trouvée</h3><p>Essayez une autre recherche.</p></div></article>';}
  async function load(){
    try{
      const data=await StudioAPI.request('/api/catalog/themes');
      const live=new Map((data.themes||[]).map(t=>[t.slug,t]));
      themes=plannedThemes.map(base=>({...base,...(live.get(base.slug)||{})}));
      for(const t of data.themes||[])if(!themes.some(x=>x.slug===t.slug))themes.push(t);
      render();
    }catch(e){
      themes=plannedThemes.slice();
      render();
    }
  }
  if(search)search.addEventListener('input',render);load();
})();