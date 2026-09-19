(function(){
  const p=new URLSearchParams(location.search),slug=p.get('theme')||'',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(!slug){location.replace('bibliotheque.html');return;}

  function logicalChapterGroups(chapters){
    const groups=[],byChoice=new Map();
    (chapters||[]).forEach(chapter=>{
      const key=chapter.choice_group?`choice:${chapter.choice_group}`:`chapter:${chapter.id}`;
      if(chapter.choice_group){
        if(!byChoice.has(key)){
          const group={key,choiceGroup:chapter.choice_group,chapters:[],position:Number(chapter.position)||9999};
          byChoice.set(key,group);groups.push(group);
        }
        const group=byChoice.get(key);
        group.chapters.push(chapter);
        group.position=Math.min(group.position,Number(chapter.position)||9999);
      }else{
        groups.push({key,choiceGroup:null,chapters:[chapter],position:Number(chapter.position)||9999});
      }
    });
    return groups.sort((a,b)=>a.position-b.position);
  }

  function groupLabel(group,index,total){
    if(!group.choiceGroup)return '';
    if(index===0)return `Chapitre ${index+1} — Ouverture`;
    if(index===total-1)return `Chapitre ${index+1} — Conclusion`;
    return `Chapitre ${index+1} — Au choix`;
  }

  async function load(){
    try{
      const data=await StudioAPI.request('/api/catalog/themes/'+encodeURIComponent(slug)+'/template'),theme=data.theme||{},chapters=data.chapters||[];
      document.title=(theme.title||'Thématique')+' — Catalogue Me&YouToo';
      document.getElementById('dynamic-theme-eyebrow').textContent=theme.title||slug;
      document.getElementById('dynamic-theme-title').textContent=theme.title||slug;
      document.getElementById('dynamic-theme-description').textContent=theme.description||'Thématique du référentiel propriétaire Me&YouToo.';

      const total=chapters.reduce((n,c)=>n+(c.situations||[]).length,0);
      const logicalGroups=logicalChapterGroups(chapters);
      const choiceGroups=logicalGroups.filter(g=>g.choiceGroup);
      const choiceWord=choiceGroups.length===1?'variante':'variantes';
      document.getElementById('dynamic-theme-situations').textContent=total+' situation'+(total>1?'s':'')+' disponible'+(total>1?'s':'');
      document.getElementById('dynamic-theme-chapters').textContent=logicalGroups.length+' chapitre'+(logicalGroups.length>1?'s':'')+' dans le parcours'+(choiceGroups.length?` · ${choiceGroups.length===1?2:choiceGroups.reduce((n,g)=>n+g.chapters.length,0)} ${choiceWord}`:'');

      const start=document.getElementById('dynamic-theme-start');
      start.dataset.startTheme=slug;
      start.href='composer.html?theme='+encodeURIComponent(slug);
      const ill=document.getElementById('dynamic-theme-illustration');
      ill.innerHTML=`<img src="assets/img/illustrations/theme-${esc(slug)}.png" alt="" onerror="this.parentElement.style.display='none'">`;

      document.getElementById('dynamic-theme-body').innerHTML=logicalGroups.map((group,index)=>{
        if(group.choiceGroup){
          const ordered=[...group.chapters].sort((a,b)=>(Number(b.is_default_choice)-Number(a.is_default_choice))||((Number(a.position)||0)-(Number(b.position)||0))||Number(a.id)-Number(b.id));
          const options=ordered.map(c=>`<div class="theme-choice-option"><strong>${esc(c.choice_label||c.title)}</strong><span>${(c.situations||[]).length} situation${(c.situations||[]).length>1?'s':''}</span>${c.is_default_choice?'<small>Choix par défaut</small>':''}</div>`).join('');
          const available=ordered.reduce((n,c)=>n+(c.situations||[]).length,0);
          return `<tr class="theme-choice-row"><td><div class="theme-choice-heading"><strong>${esc(groupLabel(group,index,logicalGroups.length))}</strong><span>Choisissez une seule version dans Composer</span></div><div class="theme-choice-options">${options}</div></td><td>${available}<small class="theme-choice-count-note"> disponibles</small></td><td>Choix d’une variante complète dans Composer</td></tr>`;
        }
        const c=group.chapters[0];
        return `<tr><td><strong>${esc(c.title)}</strong></td><td>${(c.situations||[]).length}</td><td>${esc(c.locked?(c.lock_reason||'Obligatoire · non modifiable'):'Sélection personnalisable')}</td></tr>`;
      }).join('')||'<tr><td colspan="3">Aucun chapitre n’est encore publié pour cette thématique.</td></tr>';
    }catch(e){
      document.getElementById('dynamic-theme-title').textContent='Thématique indisponible';
      document.getElementById('dynamic-theme-description').textContent=e.message;
      document.getElementById('dynamic-theme-start').hidden=true;
    }
  }
  load();
})();
