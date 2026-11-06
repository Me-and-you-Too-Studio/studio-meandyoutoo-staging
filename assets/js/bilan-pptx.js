// PowerPoint COMEX du Bilan D&I : 8 slides modifiables, fabriquées dans le navigateur à partir des données du Bilan.
// Rien n'est envoyé à un autre service. Le budget du client n'en fait jamais partie.
(function(){
  'use strict';
  var NAVY='273A64',TEAL='007883',YELLOW='FFC000',MUTED='54607E',SOFT='E0F1F2',TINT='F5F7FB',LINE='E2E7F1',VIOLET='7A5EA8',BLUE='5669A9',WHITE='FFFFFF',FONT='Calibri';
  var FAMILY=[['FFC000','FFF4CF','273A64'],['273A64','E4E8F3','FFFFFF'],['007883','E0F1F2','FFFFFF'],['5669A9','E9ECF7','FFFFFF'],['7A5EA8','EFE9F7','FFFFFF']];
  var library=null;
  function loadLibrary(){
    if(window.PptxGenJS)return Promise.resolve();
    return library=library||new Promise(function(resolve,reject){var s=document.createElement('script');s.src='assets/js/vendor/pptxgen-4.0.1.bundle.js';s.onload=resolve;s.onerror=function(){library=null;reject(new Error('Bibliothèque PowerPoint indisponible'));};document.head.appendChild(s);});
  }
  // Les logos du Studio sont souvent en WebP, que PowerPoint ne lit pas : on les convertit en PNG.
  async function asPng(url){
    if(!url)return null;
    try{
      var src=String(url);
      if(src.indexOf('data:')!==0){
        var response=await fetch(url);if(!response.ok)return null;
        var blob=await response.blob();if(blob.type.indexOf('image/')!==0)return null;
        src=URL.createObjectURL(blob);
      }
      var im=await new Promise(function(resolve,reject){var i=new Image();i.onload=function(){resolve(i);};i.onerror=reject;i.src=src;});
      var scale=Math.min(1,800/Math.max(im.naturalWidth,im.naturalHeight)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));
      canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);
      if(src.indexOf('blob:')===0)URL.revokeObjectURL(src);
      return {data:canvas.toDataURL('image/png'),w:canvas.width,h:canvas.height};
    }catch(e){return null;}
  }
  function num(v){return new Intl.NumberFormat('fr-FR').format(Number(v)||0).replace(/ /g,' ');}
  function cut(v,n){v=String(v||'');return v.length>n?v.slice(0,n-1)+'…':v;}
  function s_(n,one,many){return Number(n)>1?many:one;}

  async function build(data){
    await loadLibrary();
    var pres=new window.PptxGenJS();
    pres.layout='LAYOUT_WIDE';pres.title='Bilan D&I '+data.year+(data.org?' — '+data.org:'');pres.author=data.org||'Studio Me&YouToo';pres.company=data.org||'';
    var rect=pres.ShapeType.rect,round=pres.ShapeType.roundRect,oval=pres.ShapeType.ellipse;
    var box=function(s,x,y,w,h,fill,radius){s.addShape(radius===0?rect:round,{x:x,y:y,w:w,h:h,fill:{color:fill},line:{color:fill},rectRadius:radius==null?0.09:radius});};
    var text=function(s,t,x,y,w,h,o){s.addText(t,Object.assign({x:x,y:y,w:w,h:h,fontFace:FONT,color:NAVY,margin:0},o||{}));};
    var page=0;
    // Le titre porte le message de la slide : c'est ce qu'un COMEX retient.
    function slide(eyebrow,message){
      page++;var s=pres.addSlide();s.background={color:WHITE};
      box(s,0,0,0.22,7.5,TEAL,0);box(s,0,0,0.22,1.25,YELLOW,0);
      text(s,eyebrow.toUpperCase(),0.6,0.32,9,0.3,{fontSize:12,bold:true,color:TEAL,charSpacing:1.5});
      text(s,message,0.6,0.6,12.1,0.75,{fontSize:26,bold:true,valign:'top',fit:'shrink'});
      text(s,(data.org?data.org+'  ·  ':'')+'Bilan D&I '+data.year,0.6,7.08,9,0.26,{fontSize:10,color:MUTED});
      text(s,String(page+1),11.7,7.08,1,0.26,{fontSize:10,color:MUTED,align:'right'});
      return s;
    }
    function none(s,t){box(s,0.6,1.7,12.1,1.2,TINT);text(s,t,0.9,1.7,11.5,1.2,{fontSize:18,color:MUTED,valign:'middle'});}

    // 1. Couverture
    var s=pres.addSlide();s.background={color:NAVY};
    s.addShape(oval,{x:8.6,y:-2.4,w:7.6,h:7.6,fill:{color:TEAL},line:{color:TEAL}});
    s.addShape(oval,{x:11.1,y:3.6,w:4.4,h:4.4,fill:{color:YELLOW},line:{color:YELLOW}});
    s.addShape(oval,{x:-1.3,y:5.6,w:3.2,h:3.2,fill:{color:'33497A'},line:{color:'33497A'}});
    text(s,'BILAN DIVERSITÉ & INCLUSION',0.8,1.75,7.6,0.45,{fontSize:17,bold:true,color:YELLOW,charSpacing:2});
    text(s,String(data.year),0.8,2.15,7.6,1.75,{fontSize:115,bold:true,color:WHITE});
    if(data.org)text(s,data.org,0.8,3.95,7.6,0.7,{fontSize:30,color:WHITE});
    text(s,'Présentation à la direction',0.8,4.62,7.6,0.4,{fontSize:16,color:'C9D3E6'});
    var logo=await asPng(data.logo)||await asPng('assets/img/brand/logo-studio-blue.png');
    if(logo){box(s,9.55,1.15,3,2.1,WHITE,0.12);
      var k=Math.min(2.6/logo.w,1.74/logo.h),lw=logo.w*k,lh=logo.h*k;
      s.addImage({data:logo.data,x:9.75+(2.6-lw)/2,y:1.33+(1.74-lh)/2,w:lw,h:lh});}
    text(s,'Réalisé avec le Studio Me&YouToo',0.8,6.75,6,0.3,{fontSize:12,color:'C9D3E6'});

    // 2. L'année en chiffres
    var ind=data.ind;
    s=slide('L’année en chiffres',num(ind.done)+' '+s_(ind.done,'action ou diagnostic réalisé','actions et diagnostics réalisés')+', '+num(ind.peopleReached)+' personnes touchées');
    var kpis=[[num(ind.done),s_(ind.done,'action ou diagnostic réalisé','actions et diagnostics réalisés'),TEAL,WHITE],[num(ind.peopleReached),'personnes touchées',NAVY,WHITE],[num(ind.themes),s_(ind.themes,'thématique au programme','thématiques au programme'),YELLOW,NAVY],[data.activeQuarters+' / 4','trimestres actifs',VIOLET,WHITE]];
    if(data.participation!=null)kpis[3]=[data.participation+' %','participation moyenne aux diagnostics',VIOLET,WHITE];
    var kw=(12.1-0.2*3)/4;
    kpis.forEach(function(k,i){var x=0.6+i*(kw+0.2);box(s,x,1.5,kw,1.75,k[2]);
      text(s,k[0],x+0.2,1.58,kw-0.4,0.95,{fontSize:40,bold:true,color:k[3],valign:'middle'});
      text(s,k[1],x+0.2,2.5,kw-0.4,0.65,{fontSize:14,color:k[3],valign:'top'});});
    var chart=function(title,rows,x,w,color){
      text(s,title,x,3.45,w,0.35,{fontSize:15,bold:true,color:TEAL});
      if(!rows.length){text(s,'Pas encore de données.',x,3.9,w,0.4,{fontSize:13,color:MUTED});return;}
      var list=rows.slice(0,6).reverse();
      s.addChart(pres.ChartType.bar,[{name:'Actions',labels:list.map(function(r){return cut(r[0],26);}),values:list.map(function(r){return r[1];})}],
        {x:x,y:3.78,w:w,h:3.2,barDir:'bar',chartColors:[color],showLegend:false,showValue:true,dataLabelFontFace:FONT,dataLabelFontSize:12,dataLabelColor:NAVY,dataLabelFormatCode:'0',catAxisLabelFontFace:FONT,catAxisLabelFontSize:12,catAxisLabelColor:NAVY,valAxisHidden:true,valGridLine:{style:'none'},catGridLine:{style:'none'},barGapWidthPct:45});
    };
    chart('Réalisé, par thématique',data.byTheme,0.6,5.9,TEAL);chart('Réalisé, par famille d’actions',data.byFamily,6.8,5.9,NAVY);
    if(data.diagnostics.length)text(s,'un diagnostic compte dans 2 familles',9.7,3.48,3,0.3,{fontSize:11,color:MUTED,align:'right'});

    // 3. Priorités et objectifs
    var reachedCount=data.objectives.filter(function(o){return o.reached;}).length;
    s=slide('Priorités et objectifs',data.objectives.length?num(reachedCount)+' '+s_(data.objectives.length,'objectif atteint','objectifs atteints')+' sur '+num(data.objectives.length):'Des objectifs à fixer pour piloter l’année');
    if(data.objectives.length){
      var rowH=Math.min(1.25,5.3/Math.min(5,data.objectives.length));
      data.objectives.slice(0,5).forEach(function(o,i){var y=1.55+i*(rowH+0.06);
        box(s,0.6,y,12.1,rowH-0.04,TINT);
        text(s,cut(o.title,95),0.85,y+0.08,6.3,rowH-0.24,{fontSize:16,bold:true,valign:'middle',fit:'shrink'});
        if(o.missing)text(s,'Reste : '+cut(o.missing,70),0.85,y+rowH-0.34,6.3,0.24,{fontSize:11,color:MUTED});
        box(s,7.3,y+rowH/2-0.12,2.4,0.2,LINE,0.04);
        if(o.percent>0)box(s,7.3,y+rowH/2-0.12,Math.max(0.1,2.4*o.percent/100),0.2,o.reached?TEAL:YELLOW,0.04);
        text(s,o.figure,9.85,y,2.7,rowH-0.04,{fontSize:13,bold:true,color:o.reached?TEAL:NAVY,align:'right',valign:'middle',fit:'shrink'});});
    }else none(s,'Aucun objectif n’a été fixé pour '+data.year+'.');

    // 4. Couverture du programme : mosaïque de formes, comme dans le Cockpit
    var rowsC=data.coverage.rows.slice(0,10),worked=data.coverage.rows.filter(function(r){return r.cells.indexOf('✓')>=0;}).length,planned0=data.coverage.rows.length;
    s=slide('Couverture du programme',num(worked)+' '+s_(worked,'thématique travaillée','thématiques travaillées')+' sur '+num(planned0)+' au programme');
    if(rowsC.length){
      var cw=1.86,gx=0.09,x0=3.15,hy=1.45;
      data.coverage.columns.forEach(function(c,i){var x=x0+i*(cw+gx),f=FAMILY[i];box(s,x,hy,cw,0.55,f[1],0.05);box(s,x,hy,cw,0.07,f[0],0);text(s,c,x+0.05,hy+0.08,cw-0.1,0.47,{fontSize:13,bold:true,align:'center',valign:'middle'});});
      var th=Math.min(0.78,(6.55-2.1)/rowsC.length-0.06);
      rowsC.forEach(function(r,j){var y=2.1+j*(th+0.06);
        text(s,(r.priority?'★ ':'')+cut(r.theme,28),0.6,y,2.5,th,{fontSize:13,bold:true,color:r.priority?TEAL:NAVY,valign:'middle'});
        r.cells.forEach(function(v,i){var x=x0+i*(cw+gx),f=FAMILY[i];
          if(v==='✓'){box(s,x,y,cw,th,f[0],0.05);text(s,'✓',x,y,cw,th,{fontSize:15,bold:true,color:f[2],align:'center',valign:'middle'});}
          else if(v==='○'){s.addShape(round,{x:x,y:y,w:cw,h:th,fill:{color:f[1]},line:{color:f[0],width:1.5},rectRadius:0.05});text(s,'○',x,y,cw,th,{fontSize:13,color:NAVY,align:'center',valign:'middle'});}
          else box(s,x,y,cw,th,TINT,0.05);});});
      text(s,'✓ réalisé   ○ prévu   ★ priorité de l’année',0.6,6.68,8,0.26,{fontSize:11,color:MUTED});
    }else none(s,'Aucune action enregistrée sur '+data.year+'.');

    // 5. Dispositifs et actions marquantes
    s=slide('Temps forts de l’année',data.dispositifs.length?num(data.dispositifs.length)+' '+s_(data.dispositifs.length,'dispositif déployé','dispositifs déployés')+' et des actions marquantes':'Les actions marquantes de l’année');
    var full=!data.dispositifs.length,hx=full?0.6:6.8,hw=full?12.1:5.9;
    if(!full){text(s,'Dispositifs',0.6,1.45,5.9,0.35,{fontSize:15,bold:true,color:TEAL});
      var dn2=Math.min(4,data.dispositifs.length),dh=(4.7-(dn2-1)*0.12)/dn2;
      data.dispositifs.slice(0,4).forEach(function(g,i){var y=1.9+i*(dh+0.12);box(s,0.6,y,5.9,dh,TINT);box(s,0.6,y,0.09,dh,TEAL,0);
        if(dh>=1.6&&g.items&&g.items.length)text(s,g.items.slice(0,Math.floor((dh-1.15)/0.32)).map(function(t){return {text:cut(t,60),options:{bullet:{characterCode:'25CF',indent:13},breakLine:true,paraSpaceAfter:5}};}),0.85,y+1.05,5.4,dh-1.15,{fontSize:13,valign:'top'});
        text(s,cut(g.name,48),0.85,y+0.1,4.3,0.5,{fontSize:15,bold:true,valign:'middle',fit:'shrink'});
        if(g.objective)text(s,cut(g.objective,62),0.85,y+0.6,4.3,0.38,{fontSize:12,color:MUTED,valign:'top'});
        text(s,num(g.count),5.15,y+0.1,1.2,0.6,{fontSize:26,bold:true,color:TEAL,align:'right',valign:'middle'});
        text(s,s_(g.count,'élément','éléments'),5.15,y+0.68,1.2,0.3,{fontSize:11,color:MUTED,align:'right'});});}
    text(s,'Actions marquantes',hx,1.45,hw,0.35,{fontSize:15,bold:true,color:TEAL});
    if(data.highlights.length)data.highlights.slice(0,6).forEach(function(h,i){var y=1.9+i*0.8;box(s,hx,y,hw,0.7,i===0?SOFT:TINT);
      text(s,cut(h.title,full?90:44),hx+0.22,y,hw-1.9,0.7,{fontSize:14,bold:i===0,valign:'middle',fit:'shrink'});
      if(h.people)text(s,num(h.people)+' pers.',hx+hw-1.6,y,1.4,0.7,{fontSize:14,bold:true,color:TEAL,align:'right',valign:'middle'});});
    else text(s,'Aucune action réalisée pour le moment.',hx,1.9,hw,0.5,{fontSize:15,color:MUTED});

    // 6. Diagnostics
    var total=data.diagnostics.reduce(function(n,c){return n+(Number(c.people)||0);},0);
    s=slide('Diagnostics comportementaux',data.diagnostics.length?num(data.diagnostics.length)+' '+s_(data.diagnostics.length,'diagnostic','diagnostics')+(total?', '+num(total)+' participations':''):'Pas de diagnostic comportemental cette année');
    if(data.diagnostics.length){
      var dn=Math.min(6,data.diagnostics.length),dw=dn>3?5.95:(12.1-0.2*(dn-1))/dn;
      data.diagnostics.slice(0,6).forEach(function(c,i){var col=dn>3?i%2:i,line=dn>3?Math.floor(i/2):0,big=dn<=3,h=big?5:1.6,x=0.6+col*(dw+0.2),y=1.55+line*(h+0.15);
        box(s,x,y,dw,h,TINT);box(s,x,y,dw,0.09,TEAL,0);
        text(s,cut(c.name,46),x+0.25,y+0.2,dw-0.5,0.5,{fontSize:15,bold:true,valign:'top',fit:'shrink'});
        text(s,[c.theme,c.period].filter(Boolean).join('  ·  '),x+0.25,y+0.7,dw-0.5,0.3,{fontSize:12,color:MUTED,fit:'shrink'});
        text(s,c.people==null?'—':num(c.people),x+0.25,big?y+1.75:y+h-0.72,dw-0.5,big?1.2:0.62,{fontSize:big?66:30,bold:true,color:TEAL,valign:big?'middle':'bottom'});
        if(c.people!=null)text(s,'participations',x+0.25,big?y+2.95:y+h-0.72,dw-0.5,big?0.4:0.6,{fontSize:big?16:12,color:MUTED,align:big?'left':'right',valign:big?'top':'bottom'});});
    }else none(s,'Le diagnostic comportemental sensibilise et mesure : une piste pour l’année à venir.');

    // 7. Avancement
    var sum=function(fn){return data.quarters.reduce(function(n,q){return n+fn(q);},0);};
    var done=sum(function(q){return q.done;}),planned=sum(function(q){return q.planned+q.late;}),later=sum(function(q){return q.postponed||0;});
    s=slide('Avancement du programme',num(done)+' '+s_(done,'réalisée','réalisées')+', '+num(planned)+' '+s_(planned,'prévue ou en cours','prévues ou en cours')+(later?', '+num(later)+' '+s_(later,'reportée','reportées'):''));
    var labels=data.quarters.map(function(q){return 'T'+q.quarter;});
    var series=function(name,fn){return {name:name,labels:labels,values:data.quarters.map(fn)};};
    s.addChart(pres.ChartType.bar,[series('Réalisées',function(q){return q.done;}),series('Prévues ou en cours',function(q){return q.planned+q.late;}),series('Reportées',function(q){return q.postponed||0;})],
      {x:0.6,y:1.45,w:8.1,h:5.45,barDir:'col',barGrouping:'stacked',chartColors:[TEAL,BLUE,'D9A066'],barGapWidthPct:55,showLegend:true,legendPos:'b',legendFontFace:FONT,legendFontSize:13,catAxisLabelFontFace:FONT,catAxisLabelFontSize:14,catAxisLabelColor:NAVY,valAxisLabelFontFace:FONT,valAxisLabelFontSize:11,valAxisLabelColor:MUTED,valAxisMinVal:0,valAxisMajorUnit:1,valAxisLabelFormatCode:'0',valGridLine:{color:LINE,size:0.75},catGridLine:{style:'none'}});
    [[done,s_(done,'réalisée','réalisées'),TEAL,WHITE],[planned,s_(planned,'prévue ou en cours','prévues ou en cours'),BLUE,WHITE],[later,s_(later,'reportée','reportées'),'F3E2CF',NAVY]].forEach(function(k,i){var y=1.55+i*1.75;
      box(s,9,y,3.7,1.55,k[2]);text(s,num(k[0]),9.2,y+0.1,3.3,0.85,{fontSize:40,bold:true,color:k[3],valign:'middle'});text(s,k[1],9.2,y+0.95,3.3,0.45,{fontSize:15,color:k[3]});});

    // 8. Perspectives
    var nextYear=data.year+1;
    s=slide('Perspectives '+nextYear,data.next.actions.length?num(data.next.actions.length)+' '+s_(data.next.actions.length,'action déjà prévue','actions déjà prévues')+' pour '+nextYear:'Le programme '+nextYear+' reste à construire');
    var third=3.9,block=function(i,title,color,fg,items,empty){var x=0.6+i*(third+0.2);
      box(s,x,1.5,third,5.35,TINT);box(s,x,1.5,third,0.62,color,0.09);text(s,title,x+0.2,1.5,third-0.4,0.62,{fontSize:16,bold:true,color:fg,valign:'middle'});
      if(items.length)text(s,items.map(function(t){return {text:t,options:{bullet:{characterCode:'25CF',indent:13},breakLine:true,paraSpaceAfter:7}};}),x+0.2,2.25,third-0.4,4.45,{fontSize:14,valign:'top',fit:'shrink'});
      else text(s,empty,x+0.2,2.25,third-0.4,0.8,{fontSize:14,color:MUTED,valign:'top'});};
    block(0,'Déjà prévu',TEAL,WHITE,data.next.actions.slice(0,7).map(function(a){return a.date+' : '+cut(a.title,50);}),'Rien de prévu pour le moment.');
    block(1,'Objectifs',NAVY,WHITE,data.next.objectives.slice(0,5).map(function(t){return cut(t,150);}),'À définir.');
    block(2,'Temps forts à ne pas manquer',YELLOW,NAVY,data.next.events.slice(0,7).map(function(e){return e[0]+' : '+cut(e[1],80);}),'—');
    text(s,'Réalisé avec le Studio Me&YouToo',7.2,7.08,4.4,0.26,{fontSize:10,color:MUTED,align:'right'});
    return pres;
  }
  async function download(data){
    var pres=await build(data);
    await pres.writeFile({fileName:'Bilan D&I '+data.year+(data.org?' - '+String(data.org).replace(/[\\/:*?"<>|]/g,' '):'')+'.pptx'});
  }
  window.StudioBilanPptx={build:build,download:download};
})();
