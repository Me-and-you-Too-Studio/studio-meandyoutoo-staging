/* Lecteur des tutoriels animés du Studio. Chaque tutoriel (tutos/<sujet>/index.html) déclare window.TUTO :
   { eyebrow, title, intro, audio?, scenes:[{img, box:[x,y,l,h] en % de la capture, text, zoom?, at?}], end:{title,text} }.
   Sans voix, chaque plan dure le temps de lire son texte ; avec un fichier audio, « at » (secondes) cale chaque plan sur la voix. */
(function(){
'use strict';
var T=window.TUTO;if(!T)return;
var CARD=2.5,END=4;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
// Rythme d’une voix posée (environ 3,2 mots par seconde), plus 2 secondes pour regarder l’écran.
function readTime(text){return Math.max(5,String(text).split(/\s+/).length/3.2+2.3);}
var root=document.getElementById('tuto');
var imgs=[];T.scenes.forEach(function(s){if(imgs.indexOf(s.img)<0)imgs.push(s.img);});
root.innerHTML='<div class="tuto-stage" role="region" aria-label="Tutoriel animé"><div class="tuto-frame"><div class="tuto-canvas">'+
  imgs.map(function(src){return '<img src="'+esc(src)+'" alt="">';}).join('')+
  '<div class="tuto-box" hidden></div><svg class="tuto-pointer" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.6-6.8L4 20z" fill="#fff" stroke="#1d2b4f" stroke-width="1.6" stroke-linejoin="round"/></svg></div></div>'+
  '<p class="tuto-caption" aria-live="polite"></p>'+
  '<div class="tuto-card" data-card="start"><p class="eyebrow">'+esc(T.eyebrow||'Tutoriel')+'</p><h1>'+esc(T.title)+'</h1><p>'+esc(T.intro||'')+'</p><button type="button" class="tuto-big" data-play>▶ Lancer le tutoriel</button></div>'+
  '<div class="tuto-card" data-card="end" hidden><p class="eyebrow">C’est terminé</p><h1>'+esc(T.end&&T.end.title||'À vous de jouer')+'</h1><p>'+esc(T.end&&T.end.text||'')+'</p><button type="button" class="tuto-big" data-restart>↺ Revoir</button></div></div>'+
  '<div class="tuto-bar"><button type="button" data-toggle aria-label="Lecture">▶</button><button type="button" data-prev aria-label="Plan précédent">⏮</button><button type="button" data-next aria-label="Plan suivant">⏭</button>'+
  '<div class="tuto-track" aria-hidden="true">'+T.scenes.map(function(){return '<span><i></i></span>';}).join('')+'</div><span class="tuto-time"></span><button type="button" data-text aria-pressed="false">Texte</button></div>'+
  '<div class="tuto-transcript"><ol>'+T.scenes.map(function(s){return '<li>'+esc(s.text)+'</li>';}).join('')+'</ol></div>';
var $=function(sel){return root.querySelector(sel);};
var canvas=$('.tuto-canvas'),box=$('.tuto-box'),pointer=$('.tuto-pointer'),caption=$('.tuto-caption'),startCard=$('[data-card="start"]'),endCard=$('[data-card="end"]');
var imgEls=[].slice.call(canvas.querySelectorAll('img')),segs=[].slice.call(root.querySelectorAll('.tuto-track i'));
var audio=null;
// Calendrier des plans : sur la voix si elle existe, sinon à la durée de lecture.
var starts=[],total=CARD;
function plan(useAudio){
  starts=[];total=CARD;
  T.scenes.forEach(function(s,i){
    var at=useAudio&&typeof s.at==='number'?s.at:total;starts.push(at);
    var next=useAudio&&T.scenes[i+1]&&typeof T.scenes[i+1].at==='number'?T.scenes[i+1].at:at+readTime(s.text);
    total=next;
  });
  if(useAudio&&audio&&audio.duration)total=Math.max(total,audio.duration);
}
plan(false);
if(T.audio){audio=new Audio(T.audio);audio.preload='auto';audio.addEventListener('loadedmetadata',function(){plan(true);render(true);});audio.addEventListener('error',function(){audio=null;plan(false);});}
var t=0,playing=false,last=0,current=-2;
function sceneAt(time){if(time<CARD&&!(audio&&T.scenes[0].at===0))return -1;for(var i=starts.length-1;i>=0;i--)if(time>=starts[i])return i;return -1;}
function fmt(s){s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
// La capture garde ses proportions (1456 × 818) dans la place disponible.
function fit(){var f=$('.tuto-frame'),w=f.clientWidth,h=f.clientHeight,r=1456/818;if(w/h>r)w=h*r;else h=w/r;if(w>1456){w=1456;h=818;}canvas.style.width=w+'px';canvas.style.height=h+'px';}
function frame(s){
  imgEls.forEach(function(el){el.classList.toggle('is-on',el.getAttribute('src')===s.img);});
  var W=canvas.offsetWidth,H=canvas.offsetHeight,b=s.box;
  if(!b){caption.classList.remove('is-top');box.hidden=true;canvas.style.transform='';pointer.style.opacity=0;return;}
  box.hidden=false;box.style.left=b[0]+'%';box.style.top=b[1]+'%';box.style.width=b[2]+'%';box.style.height=b[3]+'%';
  // Pas d’agrandissement : chaque plan a sa propre capture, nette à taille réelle.
  var k=1;
  var cx=(b[0]+b[2]/2)/100*W,cy=(b[1]+b[3]/2)/100*H;
  var tx=Math.min(0,Math.max(W-W*k,W/2-cx*k)),ty=Math.min(0,Math.max(H-H*k,H/2-cy*k));
  canvas.style.transform='translate('+tx+'px,'+ty+'px) scale('+k+')';
  // La légende passe en haut quand le cadre, une fois zoomé, occupe le bas de l'image.
  caption.classList.toggle('is-top',((b[1]+b[3])/100*H*k+ty)/H>.68&&(b[1]/100*H*k+ty)/H>.3);
  pointer.style.opacity=1;pointer.style.left=Math.min(b[0]+b[2]*.62,96)+'%';pointer.style.top=Math.min(b[1]+b[3]*.55,94)+'%';
  pointer.classList.remove('is-click');setTimeout(function(){pointer.classList.add('is-click');},1150);
}
function render(force){
  if(force)fit();
  var i=sceneAt(t);
  startCard.hidden=i!==-1||t>=CARD;endCard.hidden=t<total;
  if(i!==current||force){current=i;if(i>=0){frame(T.scenes[i]);caption.textContent=T.scenes[i].text;}else caption.textContent='';}
  if(t>=total)caption.textContent='';
  segs.forEach(function(seg,k){var a=starts[k],b=k+1<starts.length?starts[k+1]:total;seg.style.width=Math.max(0,Math.min(1,(t-a)/(b-a)))*100+'%';});
  $('.tuto-time').textContent=fmt(t)+' / '+fmt(total);
  $('[data-toggle]').textContent=playing?'⏸':'▶';$('[data-toggle]').setAttribute('aria-label',playing?'Pause':'Lecture');
}
function tick(now){
  if(!playing)return;
  if(audio&&!audio.paused)t=audio.currentTime;else{t+=(now-last)/1000;}
  last=now;
  if(t>=total){t=total;pause();}
  render();if(playing)requestAnimationFrame(tick);
}
function play(){if(t>=total)seek(0);playing=true;last=performance.now();if(audio){audio.currentTime=t;audio.play().catch(function(){});}render();requestAnimationFrame(tick);}
function pause(){playing=false;if(audio)audio.pause();render();}
function seek(time){t=Math.max(0,Math.min(total,time));if(audio)audio.currentTime=t;render(true);}
root.addEventListener('click',function(e){
  var el=e.target.closest('button,.tuto-track,.tuto-stage');if(!el)return;
  if(el.matches('[data-play],[data-restart]')){seek(0);play();}
  else if(el.matches('[data-toggle]'))playing?pause():play();
  else if(el.matches('[data-prev]')){var i=sceneAt(t);seek(i>0?starts[i-1]:0);}
  else if(el.matches('[data-next]')){var j=sceneAt(t)+1;seek(j<starts.length?starts[j]:total);}
  else if(el.matches('[data-text]')){var on=root.classList.toggle('show-text');el.setAttribute('aria-pressed',String(on));}
  else if(el.matches('.tuto-track')){var r=el.getBoundingClientRect(),k=Math.floor((e.clientX-r.left)/r.width*starts.length);seek(starts[Math.max(0,Math.min(starts.length-1,k))]);}
  else if(el.matches('.tuto-stage'))playing?pause():play();
});
document.addEventListener('keydown',function(e){if(e.key===' '||e.key==='k'){e.preventDefault();playing?pause():play();}else if(e.key==='ArrowRight')root.querySelector('[data-next]').click();else if(e.key==='ArrowLeft')root.querySelector('[data-prev]').click();});
window.addEventListener('resize',function(){render(true);});
render(true);
})();
