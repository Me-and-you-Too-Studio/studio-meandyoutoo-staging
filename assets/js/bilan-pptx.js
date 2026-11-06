// PowerPoint COMEX du Bilan D&I : 8 slides modifiables, fabriquées dans le navigateur à partir des données du Bilan.
// Rien n'est envoyé à un autre service. Le budget du client n'en fait jamais partie.
(function(){
  'use strict';
  var NAVY='273A64',TEAL='007883',YELLOW='FFC000',MUTED='54607E',SOFT='E6F4F5',TINT='F5F7FB',LINE='E2E7F1',FONT='Calibri';
  var COLUMN_COLORS=[['FFC000','FFF4CF','273A64'],['273A64','E4E8F3','FFFFFF'],['007883','E0F1F2','FFFFFF'],['5669A9','E9ECF7','FFFFFF'],['7A5EA8','EFE9F7','FFFFFF']];
  var library=null;
  function loadLibrary(){
    if(window.PptxGenJS)return Promise.resolve();
    return library=library||new Promise(function(resolve,reject){var s=document.createElement('script');s.src='assets/js/vendor/pptxgen-4.0.1.bundle.js';s.onload=resolve;s.onerror=function(){library=null;reject(new Error('Bibliothèque PowerPoint indisponible'));};document.head.appendChild(s);});
  }
  async function asDataUrl(url){
    if(!url)return '';
    if(String(url).indexOf('data:')===0)return url;
    try{var blob=await (await fetch(url)).blob();return await new Promise(function(resolve){var r=new FileReader();r.onload=function(){resolve(r.result);};r.onerror=function(){resolve('');};r.readAsDataURL(blob);});}catch(e){return '';}
  }
  function num(v){return new Intl.NumberFormat('fr-FR').format(Number(v)||0).replace(/ /g,' ');}
  function cut(v,n){v=String(v||'');return v.length>n?v.slice(0,n-1)+'…':v;}

  async function build(data){
    await loadLibrary();
    var pres=new window.PptxGenJS();
    pres.layout='LAYOUT_WIDE';pres.title='Bilan D&I '+data.year+(data.org?' — '+data.org:'');pres.author=data.org||'Studio Me&YouToo';pres.company=data.org||'';
    var rect=pres.ShapeType.rect,round=pres.ShapeType.roundRect;
    function slide(title){
      var s=pres.addSlide();s.background={color:'FFFFFF'};
      s.addText(title,{x:0.6,y:0.35,w:12.1,h:0.7,fontFace:FONT,fontSize:30,bold:true,color:NAVY,margin:0});
      s.addShape(rect,{x:0.6,y:1.05,w:1.3,h:0.06,fill:{color:YELLOW},line:{color:YELLOW}});
      s.addText((data.org?data.org+' · ':'')+'Bilan D&I '+data.year,{x:0.6,y:7.02,w:10,h:0.3,fontFace:FONT,fontSize:10,color:MUTED,margin:0});
      return s;
    }
    function empty(s,text){s.addText(text,{x:0.6,y:1.5,w:12.1,h:0.6,fontFace:FONT,fontSize:18,color:MUTED,margin:0});}
    var cell=function(text,o){return {text:String(text==null?'':text),options:o||{}};};
    var head=function(text,align){return cell(text,{bold:true,color:'FFFFFF',fill:{color:NAVY},align:align||'left'});};
    var tableOptions=function(colW,size){return {x:0.6,y:1.45,w:colW.reduce(function(a,b){return a+b;},0),colW:colW,fontFace:FONT,fontSize:size||13,color:NAVY,border:{type:'solid',pt:0.75,color:LINE},valign:'middle',autoPage:false};};

    // 1. Couverture
    var s=pres.addSlide();s.background={color:NAVY};
    s.addShape(rect,{x:0,y:6.9,w:13.33,h:0.6,fill:{color:TEAL},line:{color:TEAL}});
    s.addText('Bilan diversité & inclusion',{x:0.8,y:1.7,w:8,h:0.6,fontFace:FONT,fontSize:22,color:YELLOW,bold:true,margin:0});
    s.addText(String(data.year),{x:0.8,y:2.3,w:8,h:1.5,fontFace:FONT,fontSize:80,bold:true,color:'FFFFFF',margin:0});
    if(data.org)s.addText(data.org,{x:0.8,y:3.9,w:8,h:0.7,fontFace:FONT,fontSize:26,color:'FFFFFF',margin:0});
    var logo=await asDataUrl(data.logo);
    if(logo){
      s.addShape(round,{x:9.3,y:2.1,w:3.2,h:2.2,fill:{color:'FFFFFF'},line:{color:'FFFFFF'},rectRadius:0.12});
      try{s.addImage({data:logo,x:9.5,y:2.3,w:2.8,h:1.8,sizing:{type:'contain',w:2.8,h:1.8}});}catch(e){}
    }
    s.addText('Réalisé avec le Studio Me&YouToo',{x:0.8,y:6.98,w:11.7,h:0.45,fontFace:FONT,fontSize:12,color:'FFFFFF',margin:0});

    // 2. L'année en chiffres
    s=slide('L’année en chiffres');
    var kpis=[[data.ind.done,Number(data.ind.done)>1?'actions et diagnostics réalisés':'action ou diagnostic réalisé'],[data.ind.peopleReached,'personnes touchées'],[data.ind.themes,'thématiques couvertes'],[data.ind.formats,'formats utilisés']];
    if(data.participation!=null)kpis.push([data.participation+' %','participation moyenne aux diagnostics']);
    if(data.activeQuarters!=null&&kpis.length<5)kpis.push([data.activeQuarters+' / 4','trimestres actifs']);
    var w=(12.1-0.25*(kpis.length-1))/kpis.length;
    kpis.forEach(function(k,i){var x=0.6+i*(w+0.25);
      s.addShape(round,{x:x,y:1.7,w:w,h:2.6,fill:{color:i===0?SOFT:TINT},line:{color:i===0?SOFT:TINT},rectRadius:0.1});
      s.addText(typeof k[0]==='number'?num(k[0]):String(k[0]),{x:x+0.1,y:1.95,w:w-0.2,h:1.1,fontFace:FONT,fontSize:40,bold:true,color:TEAL,align:'center',margin:0});
      s.addText(k[1],{x:x+0.15,y:3.1,w:w-0.3,h:1,fontFace:FONT,fontSize:15,color:NAVY,align:'center',valign:'top',margin:0});});
    if(data.ind.planned)s.addText(num(data.ind.planned)+(Number(data.ind.planned)>1?' autres actions ou diagnostics en cours ou prévus':' autre action ou diagnostic en cours ou prévu')+' sur l’année.',{x:0.6,y:4.7,w:12.1,h:0.5,fontFace:FONT,fontSize:16,color:MUTED,margin:0});

    // 3. Priorités et objectifs
    s=slide('Priorités et objectifs '+data.year);
    if(data.objectives.length){
      var rows=[[head('Objectif'),head('Résultat')]].concat(data.objectives.slice(0,7).map(function(o){return [cell(cut(o.title,110)),cell(o.figure+(o.missing?' · reste : '+o.missing:''),{color:o.reached?TEAL:NAVY,bold:Boolean(o.reached)})];}));
      s.addTable(rows,tableOptions([7.6,4.5],14));
    }else empty(s,'Aucun objectif chiffré n’a été fixé pour '+data.year+'.');

    // 4. Couverture du programme
    s=slide('La couverture du programme');
    if(data.coverage.rows.length){
      var hdr=[head('Thématique')].concat(data.coverage.columns.map(function(c){return head(c,'center');}));
      var body=data.coverage.rows.slice(0,11).map(function(r){return [cell((r.priority?'★ ':'')+r.theme,{bold:true})].concat(r.cells.map(function(v,i){var c=COLUMN_COLORS[i];
        return cell(v,{align:'center',bold:true,color:v==='✓'?c[2]:NAVY,fill:{color:v==='✓'?c[0]:v==='○'?c[1]:'FFFFFF'}});}));});
      s.addTable([hdr].concat(body),tableOptions([3.1,1.8,1.8,1.8,1.8,1.8],13));
      s.addText('✓ réalisé · ○ prévu · ★ priorité de l’année',{x:0.6,y:6.6,w:12.1,h:0.3,fontFace:FONT,fontSize:11,color:MUTED,margin:0});
    }else empty(s,'Aucune action enregistrée sur '+data.year+'.');

    // 5. Temps forts et dispositifs
    s=slide('Dispositifs et actions marquantes');
    var col=function(x,wd,title,items,none){
      s.addText(title,{x:x,y:1.4,w:wd,h:0.45,fontFace:FONT,fontSize:18,bold:true,color:TEAL,margin:0});
      if(!items.length){s.addText(none,{x:x,y:1.95,w:wd,h:0.5,fontFace:FONT,fontSize:15,color:MUTED,margin:0});return;}
      s.addText(items.map(function(t){return {text:t,options:{bullet:true,breakLine:true,paraSpaceAfter:8}};}),{x:x,y:1.95,w:wd,h:4.8,fontFace:FONT,fontSize:15,color:NAVY,valign:'top',margin:0});
    };
    col(0.6,5.85,data.dispositifs.length>1?data.dispositifs.length+' dispositifs déployés':'Dispositifs',data.dispositifs.slice(0,6).map(function(g){return cut(g.name,60)+' : '+g.count+(g.count>1?' éléments':' élément');}),'Aucun dispositif sur '+data.year+'.');
    col(6.85,5.85,'Actions marquantes',data.highlights.slice(0,7).map(function(h){return cut(h.title,55)+(h.people?' : '+num(h.people)+' personnes':'');}),'Aucune action réalisée pour le moment.');

    // 6. Diagnostics
    s=slide('Diagnostics comportementaux');
    if(data.diagnostics.length){
      var dr=[[head('Campagne'),head('Thématique'),head('Période'),head('Participations','right')]].concat(data.diagnostics.slice(0,9).map(function(c){return [cell(cut(c.name,60)),cell(cut(c.theme,40)),cell(c.period),cell(c.people==null?'—':num(c.people),{align:'right',bold:true})];}));
      s.addTable(dr,tableOptions([5,3,2.5,1.6],13));
    }else empty(s,'Aucun diagnostic comportemental sur '+data.year+'.');

    // 7. Avancement
    s=slide('Avancement du programme');
    var labels=data.quarters.map(function(q){return 'T'+q.quarter;});
    var series=function(name,fn){return {name:name,labels:labels,values:data.quarters.map(fn)};};
    s.addChart(pres.ChartType.bar,[series('Réalisées',function(q){return q.done;}),series('Prévues',function(q){return q.planned+q.late;}),series('Reportées',function(q){return q.postponed||0;})],
      {x:0.6,y:1.35,w:7.8,h:5.4,barDir:'col',barGrouping:'stacked',chartColors:[TEAL,'5669A9','D9A066'],showLegend:true,legendPos:'b',legendFontFace:FONT,legendFontSize:13,catAxisLabelFontFace:FONT,catAxisLabelFontSize:13,valAxisLabelFontFace:FONT,valAxisLabelFontSize:11,valAxisMinVal:0,valAxisMajorUnit:1,valAxisLabelFormatCode:'0',valGridLine:{color:LINE,size:0.75}});
    var sum=function(fn){return data.quarters.reduce(function(n,q){return n+fn(q);},0);};
    var word=function(n,one,many){return n>1?many:one;},done=sum(function(q){return q.done;}),planned=sum(function(q){return q.planned+q.late;}),late=sum(function(q){return q.postponed||0;});
    [[done,word(done,'réalisée','réalisées'),TEAL],[planned,word(planned,'prévue ou en cours','prévues ou en cours'),'5669A9'],[late,word(late,'reportée','reportées'),'B87A3D']].forEach(function(k,i){var y=1.5+i*1.45;
      s.addShape(round,{x:8.8,y:y,w:3.9,h:1.25,fill:{color:TINT},line:{color:TINT},rectRadius:0.08});
      s.addText(num(k[0]),{x:8.95,y:y,w:1.4,h:1.25,fontFace:FONT,fontSize:34,bold:true,color:k[2],align:'center',margin:0});
      s.addText(k[1],{x:10.35,y:y,w:2.25,h:1.25,fontFace:FONT,fontSize:15,color:NAVY,margin:0});});

    // 8. Perspectives
    s=slide('Perspectives '+(data.year+1));
    var third=3.9,block=function(i,title,items,none){var x=0.6+i*(third+0.2);
      s.addShape(round,{x:x,y:1.4,w:third,h:5.3,fill:{color:TINT},line:{color:TINT},rectRadius:0.06});
      s.addText(title,{x:x+0.2,y:1.5,w:third-0.4,h:0.5,fontFace:FONT,fontSize:17,bold:true,color:TEAL,margin:0});
      if(items.length)s.addText(items.map(function(t){return {text:t,options:{bullet:true,breakLine:true,paraSpaceAfter:6}};}),{x:x+0.2,y:2.05,w:third-0.4,h:4.5,fontFace:FONT,fontSize:14,color:NAVY,valign:'top',margin:0});
      else s.addText(none,{x:x+0.2,y:2.05,w:third-0.4,h:0.8,fontFace:FONT,fontSize:14,color:MUTED,valign:'top',margin:0});};
    block(0,'Déjà prévu',data.next.actions.slice(0,8).map(function(a){return a.date+' : '+cut(a.title,46);}),'Rien de prévu pour le moment.');
    block(1,'Objectifs',data.next.objectives.slice(0,6).map(function(t){return cut(t,160);}),'À définir.');
    block(2,'Temps forts à ne pas manquer',data.next.events.slice(0,8).map(function(e){return e[0]+' : '+cut(e[1],90);}),'—');
    s.addText('Réalisé avec le Studio Me&YouToo',{x:9.2,y:7.02,w:3.5,h:0.3,fontFace:FONT,fontSize:10,color:MUTED,align:'right',margin:0});
    return pres;
  }
  async function download(data){
    var pres=await build(data);
    await pres.writeFile({fileName:'Bilan D&I '+data.year+(data.org?' - '+String(data.org).replace(/[\\/:*?"<>|]/g,' '):'')+'.pptx'});
  }
  window.StudioBilanPptx={build:build,download:download};
})();
