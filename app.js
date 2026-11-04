/* Mis Charts 1.7 — JavaScript ES5 compatible con Safari antiguo.
   No librerías, servidores, micrófono ni reconocimiento de escritura. */
(function(){'use strict';
var KEY='mis-charts-buttons-v1.7', charts=[], chart=null, sec=0, line=0, bar=0, beat=0, half=0, zoom=false, previewMode=false, previewPreviousZoom=false, previewFont=18, previewAuto=true, previewGap=1;
var mode='', clipboard=null, builder=null, undoStack=[], noteDuration='♩', noteAcc='', toastTimer=null, lastPreview='';
var chartHistory=[],staffHistory=[],chosenDuration='quarter',chosenAcc='',dragDuration='',lastTapTime=0,lastTapKey='',tapWindow=430;
var editPinchZoom=1,previewPinchZoom=1,pinchGesture=null,pinchTapBlockUntil=0;
var TYPES=['m','Maj7','7','m7b5','m7','sus2','sus4','dim7','aug7','alt'];
var TENSIONS=['b5','#5','b9','9','#9','11','#11','b13','13','#13'];
var OTHERS=['Maj','mMaj7','6','m6','6/9','m6/9','maj9','m9','9','m11','11','maj13','m13','13','dim','aug','aug7','7sus4','7sus2','m7add11','7alt','power5'];
var EXTRAS=['add2','add4','add9','add11','add13','no3','no5','b11','#5','b6'];
var $=function(id){return document.getElementById(id);};
var show=function(s){var els=document.querySelectorAll('.screen'); for(var i=0;i<els.length;i++)els[i].className=els[i].className.replace(/\s*hide/g,''); for(var j=0;j<els.length;j++)if(els[j].id!==s)els[j].className+=' hide'; window.scrollTo(0,0);};
function repaintToolbar(){
 var screen=$('chart-screen');if(!screen||screen.className.indexOf('hide')!==-1||screen.className.indexOf('preview-mode')!==-1)return;
 var toolbar=screen.querySelector('.chart-toolbar');if(!toolbar)return;
 // Al volver de un editor, invalidar la capa de composición del encabezado.
 toolbar.classList.remove('toolbar-repaint');void toolbar.offsetHeight;
 toolbar.classList.add('toolbar-repaint');
 window.requestAnimationFrame(function(){window.requestAnimationFrame(function(){toolbar.classList.remove('toolbar-repaint');});});
}
function say(t){$('toast').textContent=t;$('toast').className='toast';clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').className='toast hide';},2300);}
function esc(v){return String(v===undefined?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function clone(v){return JSON.parse(JSON.stringify(v));}
function defaultBeat(){return{chord:'',second:'',split:false,kick:false};}
function numBeats(){return chart?Math.max(1,Math.min(12,parseInt(chart.meter,10)||4)):4;}
function newBar(){var a=[];for(var i=0;i<numBeats();i++)a.push(defaultBeat());return{pulses:a,first:'',second:'',volta:0,repeatStart:false,repeatEnd:false,segno:false,coda:false,staff:false,notes:[]};}
function newLine(){return{repeat:1,bars:[newBar(),newBar(),newBar(),newBar()]};}
function newSection(name){return{name:name,lines:[newLine()]};}
function safeRead(){
 charts=[];var sourceKeys=[KEY,'mis-charts-buttons-v1.6','mis-charts-buttons-v1.5','mis-charts-buttons-v1.4','mis-charts-buttons-v1.3','mis-charts-buttons-v1.2','mis-charts-buttons-v1.1'];
 var seen={};
 for(var ki=0;ki<sourceKeys.length;ki++){
  try{
   var raw=localStorage.getItem(sourceKeys[ki]);if(!raw)continue;
   var data=JSON.parse(raw);if(Object.prototype.toString.call(data)!=='[object Array]')continue;
   for(var ci=0;ci<data.length;ci++){
    var c=data[ci];if(!c||!c.id||!c.sections)continue;
    if(!seen[String(c.id)]){charts.push(c);seen[String(c.id)]=true;}
   }
  }catch(e){say('Un respaldo antiguo no se pudo leer; se conserva intacto');}
 }
 // Escribimos la copia v1.6; nunca borramos ni modificamos las versiones anteriores.
 if(charts.length){try{localStorage.setItem(KEY,JSON.stringify(charts));}catch(e){}}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(charts));$('chart-status').textContent='Guardado local ✓';return true;}catch(e){say('No se pudo guardar. Exporta un respaldo.');$('chart-status').textContent='ERROR DE GUARDADO';return false;}}
function currentSection(){return chart.sections[sec];}
function currentLine(){return currentSection().lines[line];}
function currentBar(){return currentLine().bars[bar];}
function currentBeat(){var b=currentBar(); while(b.pulses.length<numBeats())b.pulses.push(defaultBeat());return b.pulses[beat];}
function renderLibrary(){var node=$('library-list');node.innerHTML='';if(!charts.length){node.innerHTML='<p class="quiet">Todavía no hay charts. Pulsa Nuevo para empezar.</p>';return;}for(var i=charts.length-1;i>=0;i--){(function(c){var row=document.createElement('div');row.className='library-row';row.innerHTML='<button class="library-item"><span>'+esc(c.title)+'</span><small>'+esc(c.artist)+' · '+esc(c.meter)+' · '+c.sections.length+' secciones</small></button><button class="library-delete">Eliminar</button>';row.querySelector('.library-item').onclick=function(){chart=c;sec=line=bar=beat=half=0;mode='';openChart();};row.querySelector('.library-delete').onclick=function(){if(confirm('¿Eliminar este chart guardado? Esta acción no se puede deshacer.')){charts.splice(charts.indexOf(c),1);save();renderLibrary();}};node.appendChild(row);})(charts[i]);}}
function openChart(){chartHistory=[];lastTapKey='';clipboard=null;mode='';editPinchZoom=1;previewPinchZoom=1;pinchGesture=null;previewMode=false;$('chart-screen').className='screen screen-light';$('preview-close').className='preview-close hide';show('chart-screen');$('chart-top-name').textContent=chart.title;renderChart();repaintToolbar();}
function totalRows(){var n=0;for(var i=0;i<chart.sections.length;i++)n+=chart.sections[i].lines.length;return n;}
// Presentación musical: una posición por negra, o dos por negra subdividida.
// Un pulso vacío después de un acorde se indica con «/»; nunca estiramos
// la palabra para simular su duración. El slash es un marcador de continuidad.
function sectionShort(name){
 var k=String(name||'').toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u').replace(/[^a-z]/g,'');
 var m={intro:'In',verso:'Vers',precoro:'Pre',coro:'Coro',puente:'Puen',solo:'Solo',interludio:'Inter',instrumental:'Instru',outro:'Out',final:'Fin'};
 return m[k]||String(name||'').substr(0,5);
}
function sectionLabelWidth(size){
 if(!chart)return 84;
 var ctx=document.createElement('canvas').getContext('2d'),v=84;
 ctx.font='900 '+size+'px Arial,sans-serif';
 for(var i=0;i<chart.sections.length;i++)v=Math.max(v,Math.ceil(ctx.measureText(sectionShort(chart.sections[i].name)).width)+14);
 return v;
}
function staffBarRequiredWidth(b){
 var n=numBeats(),a=(b&&b.notes)||[],min=1;
 for(var i=0;i<a.length;i++)for(var j=i+1;j<a.length;j++){
  var t=typeof a[i].time==='number'?a[i].time:i,z=typeof a[j].time==='number'?a[j].time:j,d=Math.abs(t-z);
  if(d>.001)min=Math.min(min,d);
 }
 return Math.max(156,Math.min(520,Math.ceil(30*n/min)));
}
function staffPositionX(note,index,span,left,beats){
 var d=staffNoteLength(note.duration||'quarter'),t=typeof note.time==='number'?note.time:index;
 return left+Math.max(0,Math.min(beats,t+d/2))/Math.max(1,beats)*span;
}
function barHasChords(b){
 return !!(b&&b.pulses&&b.pulses.some(function(p){return p&&(p.chord||(p.split&&p.second));}));
}
function staffScoreSize(b){return barHasChords(b)?204:178;}
function staffEffectiveLength(e){return MisNotation.length(e);}
function rhythmCells(b){
 var cells=[],sounding=false,indices=[],end;
 for(var i=0;i<b.pulses.length;i++){
  var p=b.pulses[i]||defaultBeat();
  if(p.split){
   cells.push({label:p.chord||'',half:true});
   cells.push({label:p.second||'',half:true});
  }else{cells.push({label:p.chord||'',half:false});}
 }
 for(var j=0;j<cells.length;j++)if(cells[j].label)indices.push(j);
 var empty=indices.length===0;
 if(empty)return {cells:[],empty:true,solo:false};
 var first=indices[0],last=indices[indices.length-1];
 // Las barras / solo aparecen ENTRE dos acordes distintos en el compás;
 // no llenamos el resto del compás de slashes innecesarios.
 for(var k=first+1;k<last;k++)if(!cells[k].label)cells[k].label='/';
 // Un solo acorde escrito en la primera negra ocupa visualmente el centro.
 // Los acordes escritos en otros tiempos conservan su posición.
 var solo=indices.length===1&&first===0;
 return {cells:cells,empty:false,solo:solo,soloLabel:cells[first].label};
}
function widthForChord(txt,ctx){return Math.ceil(ctx.measureText(txt||'/').width)+8;}
function rhythmCellWidth(c,ctx){if(!c.label)return c.half?7:10;return Math.max(c.half?18:22,widthForChord(c.label,ctx)+5);}
function renderBarStaffPreview(b,width){
 var options={width:Math.max(85,width-6),pulses:numBeats(),meter:chart.meter,hasChords:barHasChords(b)};
 var engraving=MisNotation.renderSVG(b,options);
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+engraving.config.width+' '+engraving.config.height+'" preserveAspectRatio="none" role="img" aria-label="Pentagrama con agrupación rítmica correcta">'+engraving.markup+'</svg>';
}
function repeatBarline(which){
 var el=document.createElement('span');
 el.className='repeat-boundary repeat-'+which+'-boundary';
 el.setAttribute('aria-hidden','true');
 // Barras de repetición al estilo musical: dos líneas verdes y dos puntos.
 // Sustituyen el límite negro del compás, no son texto superpuesto.
 if(which==='start'){
  el.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 30" preserveAspectRatio="none"><path d="M3 0V30" stroke="#0BBD62" stroke-width="4.5"/><path d="M9 0V30" stroke="#0BBD62" stroke-width="1.8"/><circle cx="15.5" cy="11.2" r="2.25" fill="#0BBD62"/><circle cx="15.5" cy="19" r="2.25" fill="#0BBD62"/></svg>';
 }else{
  el.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 30" preserveAspectRatio="none"><circle cx="4.5" cy="11.2" r="2.25" fill="#0BBD62"/><circle cx="4.5" cy="19" r="2.25" fill="#0BBD62"/><path d="M11 0V30" stroke="#0BBD62" stroke-width="1.8"/><path d="M17 0V30" stroke="#0BBD62" stroke-width="4.5"/></svg>';
 }
 return el;
}
function barVolta(b){var n=Number(b.volta||0);return n===1||n===2?n:0;}
// Ajuste tipográfico exclusivo de Preview. Conserva la estructura de compases.
function previewWidths(l,size,ctx){
 ctx.font='800 '+size+'px Arial, sans-serif';
 var list=[],sum=0;
 for(var b=0;b<l.bars.length;b++){
  var pk=rhythmCells(l.bars[b]),need=0;
  for(var i=0;i<pk.cells.length;i++)need+=rhythmCellWidth(pk.cells[i],ctx);
  var w=l.bars[b].staff?Math.max(staffBarRequiredWidth(l.bars[b]),need+10,barHasChords(l.bars[b])?160:0):pk.empty?65:pk.solo?Math.max(76,widthForChord(pk.soloLabel,ctx)+17):Math.max(96,need+10);
  list.push(w);sum+=w;
 }
 return {widths:list,total:sum};
}
function previewStats(size){
 var ctx=document.createElement('canvas').getContext('2d'),height=0,lines=0,limit=686-sectionLabelWidth(size);
 for(var si=0;si<chart.sections.length;si++)for(var li=0;li<chart.sections[si].lines.length;li++){
  var l=chart.sections[si].lines[li],base=previewWidths(l,18,ctx),trial=previewWidths(l,size,ctx);
  var split=base.total>limit&&l.bars.length>2,mid=split?Math.ceil(l.bars.length/2):l.bars.length;
  var sums=[0,0],volta=[false,false],staff=[false,false];
  for(var k=0;k<l.bars.length;k++){
   var ix=k<mid?0:1;
   sums[ix]+=trial.widths[k];
   if(barVolta(l.bars[k]))volta[ix]=true;
   if(l.bars[k].staff)staff[ix]=true;
  }
  if(sums[0]>limit-6||sums[1]>limit-6)return null;
  var barH=Math.max(36,Math.ceil(size*1.38));
  height+=Math.max(barH,staff[0]?204:0)+6+(volta[0]?30:0);
  if(split)height+=Math.max(barH,staff[1]?204:0)+6+(volta[1]?30:0);
  lines++;
 }
 return {height:height,lines:lines};
}
function previewMaxFont(){
 if(!chart)return 18;
 for(var sz=74;sz>=20;sz-=2){
  var stats=previewStats(sz);
  if(stats&&stats.height+stats.lines*5<850)return sz;
 }
 return 18;
}
function layoutPreview(){
 if(!previewMode)return;
 var max=previewMaxFont();
 if(previewAuto)previewFont=max;else previewFont=Math.max(18,Math.min(max,previewFont));
 var stats=previewStats(previewFont);
 previewGap=stats?Math.min(30,Math.max(1,Math.floor((835-stats.height)/Math.max(1,stats.lines+1)))):1;
 $('preview-auto').className=previewAuto?'selected':'';
 $('preview-smaller').disabled=previewFont<=18;
 $('preview-larger').disabled=previewFont>=max;
 $('paper').style.setProperty('--show-chord-size',previewFont+'px');
 $('paper').style.setProperty('--show-section-size',previewFont+'px');
 $('paper').style.setProperty('--show-title-size',Math.min(48,Math.max(30,previewFont*.75))+'px');
}
function changePreview(delta){
 if(!previewMode)return;
 var max=previewMaxFont(),next=Math.min(max,Math.max(18,previewFont+delta));
 if(next===previewFont){say(delta>0?'Máximo tamaño que cabe en esta hoja':'Mínimo tamaño');return;}
 previewAuto=false;previewFont=next;renderChart();
}
function renderChart(){if(!chart)return;if(previewMode)layoutPreview();
 $('paper-title').textContent=chart.title;$('paper-artist').textContent=chart.artist||' ';$('paper-meter').textContent=chart.meter;
 $('line-info').textContent=currentSection().name+' · línea '+(line+1)+' · '+currentLine().bars.length+' compases · x'+currentLine().repeat;
 var body=$('paper-body');body.innerHTML='';
 var measure=document.createElement('canvas').getContext('2d');measure.font='800 '+(previewMode?previewFont:18)+'px Arial, sans-serif';
 for(var si=0;si<chart.sections.length;si++){
  var section=chart.sections[si];
  for(var li=0;li<section.lines.length;li++){
   (function(si,li,s,l){
    var wr=document.createElement('div');wr.className='line-wrapper';if(previewMode)wr.style.marginBottom=previewGap+'px';
    // Cada línea de datos puede contener una o dos filas de visualización.
    var packs=[],needs=[],total=0;
    for(var bi=0;bi<l.bars.length;bi++){
     var pack=rhythmCells(l.bars[bi]);packs.push(pack);
     var beatNeed=0;
     for(var pi=0;pi<pack.cells.length;pi++)beatNeed+=rhythmCellWidth(pack.cells[pi],measure);
     // Compases con un solo acorde, centrados y con ancho compacto.
     var width=l.bars[bi].staff?Math.max(staffBarRequiredWidth(l.bars[bi]),beatNeed+10,barHasChords(l.bars[bi])?160:0):pack.empty?65:pack.solo?Math.max(76,widthForChord(pack.soloLabel,measure)+17):Math.max(96,beatNeed+10);
     needs.push(width);total+=width;
    }
    var labelWidth=sectionLabelWidth(previewMode?previewFont:Math.max(30,previewMaxFont()));
     var avail=686-labelWidth; // La etiqueta se ensancha cuando necesita el mismo tamaño de letra.
    var widths=[],rowHeight=36;
    var spare=Math.max(0,avail-total)/Math.max(1,needs.length);
    for(var k=0;k<needs.length;k++)widths.push(needs[k]+spare);
    // Si la línea está muy llena, conservamos el tamaño de la fuente;
    // el renderizador añade otro renglón visual más abajo.
    var splitVisual=(previewMode?previewWidths(l,18,document.createElement('canvas').getContext('2d')).total:total)>avail&&l.bars.length>2;
    // Organizar los compases en una o dos filas visuales si la tipografía
    // no cabe; nunca cortamos ni comprimimos acordes individualmente.
    var groups=[];
    if(splitVisual){
     var mid=Math.ceil(l.bars.length/2);
     groups.push({from:0,to:mid});groups.push({from:mid,to:l.bars.length});
    }else{groups.push({from:0,to:l.bars.length});}
    for(var gi=0;gi<groups.length;gi++){
     var gg=groups[gi],sum=0;
     for(var zi=gg.from;zi<gg.to;zi++)sum+=needs[zi];
     var room=(avail-sum)/Math.max(1,gg.to-gg.from);
     var visualLine=document.createElement('div');visualLine.className='chart-line';
     var hasVolta=false;
     for(var ei=gg.from;ei<gg.to;ei++){if(barVolta(l.bars[ei]))hasVolta=true;}
     var hasStaff=false;for(var z=gg.from;z<gg.to;z++)if(l.bars[z].staff)hasStaff=true;
      var staffHeight=0;for(var sh=gg.from;sh<gg.to;sh++)if(l.bars[sh].staff)staffHeight=Math.max(staffHeight,staffScoreSize(l.bars[sh]));
      var showBarH=Math.max(staffHeight,previewMode?Math.max(36,Math.ceil(previewFont*1.38)):30);
      visualLine.style.height=(showBarH+6+(hasVolta?30:0))+'px';
      if(hasVolta)visualLine.style.paddingTop='30px';
     var label=document.createElement('div');label.className='section-label';
     label.style.width=labelWidth+'px';label.style.flex='0 0 '+labelWidth+'px';label.style.setProperty('--live-section-font',(previewMode?previewFont:Math.max(30,previewMaxFont()))+'px');
     label.textContent=(li===0&&gi===0)?sectionShort(s.name):'';
     if(label.textContent.length>=5)label.className+=' section-label-long';
     label.title='Seleccionar sección';
     label.onclick=function(e){e.stopPropagation();handleSectionTap(si,li);};visualLine.appendChild(label);
     var bs=document.createElement('div');bs.className='bars-line';bs.style.height=showBarH+'px';
     for(var bidx=gg.from;bidx<gg.to;bidx++)(function(bi){
      var b=l.bars[bi],pack=packs[bi],bt=document.createElement('div');
      bt.className='bar-item'+(si===sec&&li===line&&bi===bar?' selected':'');
      if(b.repeatStart)bt.className+=' repeat-at-start';
      if(b.repeatEnd)bt.className+=' repeat-at-end';
      if(bi>0&&l.bars[bi-1].repeatEnd)bt.className+=' after-repeat-end';
      var w=(needs[bi]+Math.max(0,room));
      // Si los compases no caben, no hacer reducciones de letra ocultas.
      bt.style.cssText='height:'+showBarH+'px;flex:0 0 '+w.toFixed(2)+'px;width:'+w.toFixed(2)+'px;';
      bt.setAttribute('data-index',bi);bt.setAttribute('data-sec',si);bt.setAttribute('data-line',li);bt.setAttribute('role','button');bt.setAttribute('tabindex','0');bt.setAttribute('aria-label','Compás '+(bi+1)+'. Un toque selecciona, dos editan.');
      // Solo Segno/Coda siguen siendo signos sobre el compás.
      // Las repeticiones reemplazan físicamente la barra de límite.
      if(b.repeatStart)bt.appendChild(repeatBarline('start'));
      if(b.repeatEnd)bt.appendChild(repeatBarline('end'));
      var sym='';if(b.segno)sym+='𝄋';if(b.coda)sym+='𝄌';
      if(sym){var sm=document.createElement('span');sm.className='bar-symbol';sm.textContent=sym;bt.appendChild(sm);}
      if(b.staff){
       bt.className+=' staff-bar';
       var staff=document.createElement('span');staff.className='staff-in-bar';staff.innerHTML=renderBarStaffPreview(b,w);bt.appendChild(staff);
      }else{
       var flow=document.createElement('div');flow.className='chord-flow rhythm-flow';
       flow.style.display='flex';flow.style.flexDirection='row';flow.style.flexWrap='nowrap';
       if(pack.empty||pack.solo){
        var tok=document.createElement('span');tok.className='chord-token'+(pack.empty?' empty':'');tok.textContent=pack.empty?'/':pack.soloLabel;flow.appendChild(tok);
       }else{
        for(var ci=0;ci<pack.cells.length;ci++){
         var c=pack.cells[ci],tok=document.createElement('span');
         tok.className='chord-token beat-chord'+(c.label==='/'?' empty':'');
         tok.textContent=c.label||'\u00A0';
         tok.style.display='flex';tok.style.fontSize=(previewMode?previewFont:18)+'px';
         tok.style.flex=String(rhythmCellWidth(c,measure))+' '+String(rhythmCellWidth(c,measure))+' 0';
         flow.appendChild(tok);
        }
       }
       bt.appendChild(flow);
      }
      // Casilla 1.ª / 2.ª vuelta grabada SOBRE el compás.
      var volta=barVolta(b);
      if(volta){
       var en=document.createElement('span');en.className='volta-bracket';
       en.innerHTML='<span class="volta-numeral">'+volta+'.</span>';
       bt.appendChild(en);
      }
      for(var pp=0;pp<b.pulses.length;pp++)if(b.pulses[pp].kick){var kick=document.createElement('span');kick.className='bar-kick';bt.appendChild(kick);break;}
      bt.onclick=function(){handleBarTap(si,li,bi);};bt.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();sec=si;line=li;bar=bi;if(currentBar().staff)openStaff();else openEditor();}else if(e.key===' '){e.preventDefault();sec=si;line=li;bar=bi;refreshSelectedBar();}};bs.appendChild(bt);
     })(bidx);
     visualLine.appendChild(bs);
     var rep=document.createElement('div');rep.className='repeat-label red-repeat';rep.textContent=gi===groups.length-1&&l.repeat>1?'×'+l.repeat:'';
     visualLine.appendChild(rep);wr.appendChild(visualLine);
    }
    body.appendChild(wr);
   })(si,li,section,section.lines[li]);
  }
 }
 $('chart-status').textContent='Un toque selecciona · Doble toque edita';renderSelectedBarControls();updateClipboardUI();
 if(body.offsetHeight>900){say('El contenido supera una hoja A4; reduce líneas o divide el chart.');}fitPaper();
}
function setPreviewMode(enabled){
 if(!chart)return;
 previewMode=!!enabled;
 if(previewMode){
  previewPreviousZoom=zoom;zoom=false;previewAuto=true;pinchGesture=null;previewPinchZoom=1;
  $('chart-screen').className='screen screen-light preview-mode';
  $('preview-close').className='preview-close';$('preview-controls').className='preview-controls';
 }else{
  zoom=previewPreviousZoom;pinchGesture=null;
  $('chart-screen').className='screen screen-light';
  $('preview-close').className='preview-close hide';$('preview-controls').className='preview-controls hide';
  $('paper').style.removeProperty('--show-chord-size');
  $('paper').style.removeProperty('--show-section-size');
  $('paper').style.removeProperty('--show-title-size');
 }
 renderChart();
}
function fitPaper(){
 var sc=$('paper-scroll'),w=sc.clientWidth-16,base;
 if(previewMode){
  var vw=window.innerWidth||document.documentElement.clientWidth,vh=window.innerHeight||document.documentElement.clientHeight;
  base=Math.min(1,Math.max(.1,(vw-24)/780),Math.max(.1,(vh-90)/1103));
 }else{base=zoom?1:Math.min(1,w/780);}
 var factor=base*(previewMode?previewPinchZoom:editPinchZoom);
 if(!isFinite(factor)||factor<=0)factor=base;
 var stage=$('page-scaler');
 stage.style.width=(780*factor)+'px';stage.style.height=(1103*factor)+'px';
 $('paper').style.webkitTransform='scale('+factor+')';$('paper').style.transform='scale('+factor+')';
 sc.className='paper-scroll'+(!previewMode&&zoom?' zoomed':'');
 return factor;
}
function pinchDistance(a,b){var dx=b.clientX-a.clientX,dy=b.clientY-a.clientY;return Math.sqrt(dx*dx+dy*dy);}
function pinchCenter(a,b){return{x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};}
function setupSheetPinchZoom(){
 var sc=$('paper-scroll');
 sc.addEventListener('touchstart',function(e){
  if(!chart||e.touches.length!==2)return;
  var a=e.touches[0],b=e.touches[1],mid=pinchCenter(a,b);
  var factor=fitPaper(),box=$('page-scaler').getBoundingClientRect();
  pinchGesture={distance:Math.max(1,pinchDistance(a,b)),zoom:previewMode?previewPinchZoom:editPinchZoom,mode:previewMode,
   anchorX:(mid.x-box.left)/factor,anchorY:(mid.y-box.top)/factor};
  pinchTapBlockUntil=Date.now()+650;
  if(e.cancelable)e.preventDefault();
 },{passive:false});
 sc.addEventListener('touchmove',function(e){
  if(!pinchGesture||e.touches.length<2||previewMode!==pinchGesture.mode)return;
  if(e.cancelable)e.preventDefault();
  var a=e.touches[0],b=e.touches[1],mid=pinchCenter(a,b);
  var next=pinchGesture.zoom*pinchDistance(a,b)/pinchGesture.distance;
  // Margen técnico contra tamaños infinitos: zoom de lectura muy amplio.
  next=Math.max(.025,Math.min(64,next));
  if(previewMode)previewPinchZoom=next;else editPinchZoom=next;
  var factor=fitPaper(),box=$('page-scaler').getBoundingClientRect();
  sc.scrollLeft+=box.left+pinchGesture.anchorX*factor-mid.x;
  sc.scrollTop+=box.top+pinchGesture.anchorY*factor-mid.y;
  pinchTapBlockUntil=Date.now()+500;
 },{passive:false});
 function finish(e){if(pinchGesture&&(!e.touches||e.touches.length<2)){pinchGesture=null;pinchTapBlockUntil=Date.now()+500;}}
 sc.addEventListener('touchend',finish,{passive:true});
 sc.addEventListener('touchcancel',finish,{passive:true});
 // Safari antiguo puede enviar eventos gesture además de touch.
 sc.addEventListener('gesturestart',function(e){if(e.cancelable)e.preventDefault();},{passive:false});
 sc.addEventListener('gesturechange',function(e){if(e.cancelable)e.preventDefault();},{passive:false});
 sc.addEventListener('gestureend',function(e){if(e.cancelable)e.preventDefault();},{passive:false});
}
function handleSectionTap(si,li){sec=si;line=li;bar=0;lastTapKey='';renderChart();}
function updateClipboardUI(){
 var paste=$('paste-clipboard'),cancel=$('cancel-copy'),status=$('clipboard-status');
 if(!paste||!cancel||!status)return;
 var kind=clipboard&&clipboard.kind;
 paste.disabled=!kind;
 paste.textContent='Pegar';
 paste.title=kind==='section'?'Pegar la sección copiada después de la seleccionada':kind==='bar'?'Pegar el compás copiado en el seleccionado (vacío)':'Primero copia un compás o sección';
 cancel.className=kind?'':'hide';
 status.textContent=kind==='bar'?'Compás copiado · selecciona uno vacío y pulsa Pegar':kind==='section'?'Sección copiada · selecciona dónde insertarla y pulsa Pegar':'Selecciona el origen y pulsa Copiar';
}
function barIsEmptyForPaste(b){
 if(!b||b.first||b.second||b.volta||b.repeatStart||b.repeatEnd||b.segno||b.coda||b.staff||(b.notes&&b.notes.length))return false;
 var p=b.pulses||[];
 for(var i=0;i<p.length;i++)if(p[i]&&(p[i].chord||p[i].second||p[i].kick||p[i].split))return false;
 return true;
}
function copySelectedBar(){
 clipboard={kind:'bar',data:clone(currentBar())};lastTapKey='';updateClipboardUI();
 say('Compás copiado. Selecciona uno vacío y pulsa Pegar');
}
function copySelectedSection(){
 clipboard={kind:'section',data:clone(currentSection())};lastTapKey='';updateClipboardUI();
 say('Sección copiada. Selecciona la sección de destino y pulsa Pegar');
}
function pasteSelected(){
 if(!clipboard){say('Primero copia un compás o sección');return;}
 lastTapKey='';
 if(clipboard.kind==='bar'){
  if(!barIsEmptyForPaste(currentBar())){say('El compás tiene contenido; selecciona uno vacío');return;}
  pushChartHistory();
  currentLine().bars[bar]=clone(clipboard.data);
  save();renderChart();say('Compás pegado. Puedes pegar otra copia');
 }else if(clipboard.kind==='section'){
  pushChartHistory();
  chart.sections.splice(sec+1,0,clone(clipboard.data));
  sec++;line=bar=0;
  save();renderChart();say('Sección pegada después de la seleccionada');
 }
}
function refreshSelectedBar(){
 var all=$('paper-body').querySelectorAll('.bar-item');
 for(var k=0;k<all.length;k++){
  var el=all[k],on=Number(el.getAttribute('data-sec'))===sec&&Number(el.getAttribute('data-line'))===line&&Number(el.getAttribute('data-index'))===bar;
  var bs=chart.sections[Number(el.getAttribute('data-sec'))].lines[Number(el.getAttribute('data-line'))].bars;
  var ix=Number(el.getAttribute('data-index')),cb=bs[ix];
  el.className='bar-item'+(on?' selected':'')+(cb.repeatStart?' repeat-at-start':'')+(cb.repeatEnd?' repeat-at-end':'')+(ix>0&&bs[ix-1].repeatEnd?' after-repeat-end':'');
  el.setAttribute('aria-pressed',on?'true':'false');
 }
 renderSelectedBarControls();
}
function handleBarTap(si,li,bi){
if(Date.now()<pinchTapBlockUntil)return;
var key=String(si)+'-'+String(li)+'-'+String(bi),now=Date.now();
 var twice=lastTapKey===key&&(now-lastTapTime)<tapWindow;
 lastTapTime=now;lastTapKey=key;
 sec=si;line=li;bar=bi;beat=half=0;
 if(twice){lastTapKey='';if(currentBar().staff)openStaff();else openEditor();}else{refreshSelectedBar();}
}
function openEditor(){show('editor-screen');$('editor-title').textContent=currentSection().name+' · Compás '+(bar+1);undoStack=[];builder=parseChord(getSlot());renderEditor();}
function getSlot(){var v=currentBeat();return half===1?v.second:v.chord;}
function setSlot(v){var p=currentBeat();if(half===1){p.second=v;p.split=true;}else p.chord=v;}

function pushChartHistory(){
 if(!chart)return;
 chartHistory.push({chart:clone(chart),sec:sec,line:line,bar:bar});
 if(chartHistory.length>70)chartHistory.shift();
}
function undoChart(){
 lastTapKey='';if(!chartHistory.length){say('No hay cambios en la hoja para deshacer');return;}
 var prior=chartHistory.pop(),idx=-1;
 for(var i=0;i<charts.length;i++)if(charts[i].id===chart.id){idx=i;break;}
 if(idx<0)return;
 charts[idx]=prior.chart;chart=charts[idx];
 sec=Math.min(prior.sec,chart.sections.length-1);
 line=Math.min(prior.line,currentSection().lines.length-1);
 bar=Math.min(prior.bar,currentLine().bars.length-1);
 save();renderChart();say('Último cambio deshecho');
}
function renderSelectedBarControls(){
 if(!chart)return;
 var b=currentBar(),s=currentSection();
 $('selected-bar-label').textContent=s.name+' · Línea '+(line+1)+' · Compás '+(bar+1);
 var keys=[['repeat-start','repeatStart'],['repeat-end','repeatEnd'],['chart-segno','segno'],['chart-coda','coda']];
 for(var i=0;i<keys.length;i++){
  var el=$(keys[i][0]);el.className='score-symbol symbol-only'+(b[keys[i][1]]?' active':'');
 }
 // Vuelta 1 y 2 son marcas de notación, no campos de texto.
 var v=barVolta(b);
 $('volta-one').className='volta-button'+(v===1?' active':'');
 $('volta-two').className='volta-button'+(v===2?' active':'');
 $('volta-clear').disabled=(v===0);
 $('open-staff').className='score-staff'+(b.staff?' active':'');
}
function toggleBarMark(name){lastTapKey='';pushChartHistory();var b=currentBar();b[name]=!b[name];save();renderChart();}
function setVolta(which){
 lastTapKey='';var b=currentBar(),number=which===1||which===2?which:0;
 var next=barVolta(b)===number?0:number;
 if(barVolta(b)===next)return;
 pushChartHistory();b.volta=next;save();renderChart();
 say(next?'Vuelta '+next+' colocada sobre el compás':'Vuelta quitada');
}

function parseChord(text){text=String(text||'');var p={root:'',acc:'',quality:'',tensions:[],bass:'',bassAcc:'',pendingBass:false};var parts=text.split('/');var left=parts[0],match=/^([A-G])([#b]?)(.*)$/.exec(left);if(match){p.root=match[1];p.acc=match[2];var t=match[3];var opts=OTHERS.concat(TYPES).concat(['maj7']).sort(function(a,b){return b.length-a.length;});for(var i=0;i<opts.length;i++)if(t.indexOf(opts[i])===0){p.quality=opts[i];t=t.slice(opts[i].length);break;}if(t){var matches=t.match(/(?:add13|add11|add9|add4|add2|no3|no5|b13|#13|#11|b11|b9|#9|b5|#5|13|11|9)/g);if(matches)p.tensions=matches;}}if(parts.length>1){var bm=/^([A-G])([#b]?)$/.exec(parts[parts.length-1]);if(bm){p.bass=bm[1];p.bassAcc=bm[2];}}return p;}
function buildChord(){var b=builder;if(!b.root)return '';var v=b.root+b.acc+b.quality;for(var i=0;i<b.tensions.length;i++)v+=b.tensions[i];if(b.bass)v+='/'+b.bass+b.bassAcc;return v;}
function selectPulse(p,h){beat=p;half=h||0;builder=parseChord(getSlot());undoStack=[];renderEditor();}
function renderEditor(){if(!chart)return;var b=currentBar(),p=currentBeat();$('editor-title').textContent=currentSection().name+' · Compás '+(bar+1);$('beat-index').textContent=String(beat+1);
var row=$('beats');row.innerHTML='';for(var i=0;i<numBeats();i++)(function(i){var v=b.pulses[i]||defaultBeat();var btn=document.createElement('button');btn.className='beat'+(i===beat?' active':'');btn.innerHTML=(i+1)+'<b>'+esc(v.chord||'♩')+(v.split?' / '+esc(v.second||'♪'):'')+'</b>';btn.onclick=function(){selectPulse(i,0);};row.appendChild(btn);})(i);
$('half-controls').className=p.split?'half-controls':'half-controls hide';var hh=$('half-controls').querySelectorAll('button');for(var j=0;j<hh.length;j++){hh[j].className=Number(hh[j].getAttribute('data-half'))===half?'active':'';}
if(!builder)builder=parseChord(getSlot());$('chord-preview').value=buildChord()||getSlot();lastPreview=$('chord-preview').value;renderPalette();$('subdivide').textContent=p.split?'Quitar subdivisión':'Subdividir negra';$('kick').textContent=p.kick?'Kick: sí':'Kick: no';$('kick').className=p.kick?'on':'';
}
function createKeys(id,values,action){var el=$(id);el.innerHTML='';for(var i=0;i<values.length;i++)(function(v){var btn=document.createElement('button');btn.type='button';btn.textContent=v;btn.setAttribute('data-key',v);btn.onclick=function(){action(v);};el.appendChild(btn);})(values[i]);}
function markActive(id,fn){var e=$(id).querySelectorAll('button');for(var i=0;i<e.length;i++){var v=e[i].getAttribute('data-key');e[i].className=fn(v)?'active':'';}}
function renderPalette(){markActive('root-row',function(v){return builder.root===v&&!builder.pendingBass;});markActive('common-row',function(v){return builder.quality===(v==='Maj7'?'maj7':v);});markActive('other-row',function(v){return builder.quality===v;});markActive('tension-row',function(v){return builder.tensions.indexOf(v)!==-1;});markActive('extra-row',function(v){return builder.tensions.indexOf(v)!==-1;});markActive('alter-row',function(v){return v==='/'&&builder.pendingBass;});}
function touchBuild(previousInput){
 undoStack.push({builder:clone(builder),preview:previousInput===undefined?$('chord-preview').value:previousInput,slot:getSlot()});
 if(undoStack.length>45)undoStack.shift();
}
function undoChord(){
 if(!undoStack.length){say('No hay cambios para deshacer');return;}
 var previous=undoStack.pop();
 if(getSlot()!==previous.slot){setSlot(previous.slot);save();}
 builder=previous.builder;
 renderEditor();
 $('chord-preview').value=previous.preview;
 lastPreview=previous.preview;
 renderPalette();
 say('Último cambio deshecho');
}
function clearChord(){
 if(!$('chord-preview').value&&!getSlot()){say('Este pulso ya está vacío');return;}
 touchBuild();pushChartHistory();setSlot('');builder=parseChord('');save();renderEditor();
 $('chord-preview').value='';lastPreview='';
 $('chord-hint').textContent='Acorde completo borrado de este pulso';
 say('Acorde borrado');
}
function updateBuild(){var val=buildChord();$('chord-preview').value=val;lastPreview=val;renderPalette();}
function rootClick(v){touchBuild();if(builder.pendingBass){builder.bass=v;builder.bassAcc='';builder.pendingBass=false;}else{builder.root=v;builder.acc='';builder.bass='';builder.bassAcc='';}updateBuild();}
function alteration(v){touchBuild();if(v==='/'){builder.pendingBass=true;builder.bass='';builder.bassAcc='';say('Ahora elige la nota del bajo: C D E F G A B');}else if(builder.bass){builder.bassAcc=v==='♮'?'':v;}else{builder.acc=v==='♮'?'':v;}updateBuild();}
function quality(v){touchBuild();if(v==='Maj7')v='maj7';builder.quality=builder.quality===v?'':v;updateBuild();}
function tension(v){touchBuild();var idx=builder.tensions.indexOf(v);if(idx===-1)builder.tensions.push(v);else builder.tensions.splice(idx,1);updateBuild();}
function apply(){var v=$('chord-preview').value.replace(/^\s+|\s+$/g,'');if(!/^[A-G](?:#|b)?(?:[^\s]*)$/.test(v)){say('Primero elige una nota C D E F G A B');return;}touchBuild();pushChartHistory();setSlot(v);builder=parseChord(v);save();renderEditor();$('chord-hint').textContent='Aplicado: '+v+' · pulso '+(beat+1);say(v+' guardado en el pulso');}
function symbolClick(name){var b=currentBar();b[name]=!b[name];save();renderEditor();}
function initKeyboard(){createKeys('root-row',['C','D','E','F','G','A','B'],rootClick);createKeys('alter-row',['/','#','b','♮'],alteration);createKeys('common-row',TYPES,quality);createKeys('tension-row',TENSIONS,tension);createKeys('other-row',OTHERS,quality);createKeys('extra-row',EXTRAS,tension);}
var jpgUrl='',jpgName='';
function closeJPGSheet(){$('jpg-sheet').className='jpg-sheet hide';$('jpg-preview-image').removeAttribute('src');if(jpgUrl){URL.revokeObjectURL(jpgUrl);jpgUrl='';}}
function downloadPreviewJPG(){if(!jpgUrl)return;var a=document.createElement('a');a.href=jpgUrl;a.download=jpgName;document.body.appendChild(a);a.click();document.body.removeChild(a);}
function showJPG(blob,name){closeJPGSheet();jpgName=name;jpgUrl=URL.createObjectURL(blob);$('jpg-preview-image').src=jpgUrl;$('jpg-sheet').className='jpg-sheet';}
function makeJPG(){
 var paper=$('paper'),origin=paper.getBoundingClientRect(),ratio=origin.width/780,cv=document.createElement('canvas');
 cv.width=1560;cv.height=2206;var g=cv.getContext('2d');g.scale(2,2);g.fillStyle='#fff';g.fillRect(0,0,780,1103);
 function rect(e){var r=e.getBoundingClientRect();return{x:(r.left-origin.left)/ratio,y:(r.top-origin.top)/ratio,w:r.width/ratio,h:r.height/ratio};}
 function paint(t,x,y,sz,col,wt,al){if(!t)return;g.fillStyle=col;g.font=(wt||800)+' '+sz+'px Arial,sans-serif';g.textAlign=al||'center';g.textBaseline='middle';g.fillText(t,x,y);}
 function size(e,f){return parseFloat(window.getComputedStyle(e).fontSize)||f;}
 var el=$('paper-title'),p=rect(el);paint(el.textContent,p.x+p.w/2,p.y+p.h/2,size(el,32),'#ce2833',900);
 el=$('paper-artist');p=rect(el);paint(el.textContent,p.x+p.w/2,p.y+p.h/2,size(el,15),'#111',800);
 el=$('paper-meter');p=rect(el);paint(el.textContent,p.x,p.y+p.h/2,size(el,14),'#111',800,'left');
 var els=paper.querySelectorAll('.section-label');for(var i=0;i<els.length;i++){el=els[i];p=rect(el);paint(el.textContent,p.x,p.y+p.h/2,size(el,18),'#ca2835',900,'left');}
 els=paper.querySelectorAll('.bar-item');
 for(var j=0;j<els.length;j++){
  el=els[j];p=rect(el);var si=+el.getAttribute('data-sec'),li=+el.getAttribute('data-line'),bi=+el.getAttribute('data-index'),barData=chart.sections[si].lines[li].bars[bi];
  g.strokeStyle='#111';g.lineWidth=2;
  if(!barData.repeatStart){g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x,p.y+p.h);g.stroke();}
  var last=!el.nextElementSibling||el.nextElementSibling.className.indexOf('bar-item')<0;
  if(last&&!barData.repeatEnd){g.beginPath();g.moveTo(p.x+p.w,p.y);g.lineTo(p.x+p.w,p.y+p.h);g.stroke();}
  function green(x,dir){
   g.strokeStyle='#0BBD62';g.lineWidth=3;g.beginPath();g.moveTo(x+dir*2,p.y);g.lineTo(x+dir*2,p.y+p.h);g.stroke();
   g.lineWidth=1.5;g.beginPath();g.moveTo(x+dir*7,p.y);g.lineTo(x+dir*7,p.y+p.h);g.stroke();
   for(var d=0;d<2;d++){g.fillStyle='#0BBD62';g.beginPath();g.arc(x+dir*12,p.y+p.h*(d?.65:.35),2,0,6.3);g.fill();}
  }
  if(barData.repeatStart)green(p.x,1);if(barData.repeatEnd)green(p.x+p.w,-1);
  if(barData.staff){
   MisNotation.drawCanvas(g,barData,{
    x:p.x+3,y:p.y,width:Math.max(85,p.w-6),drawWidth:Math.max(85,p.w-6),drawHeight:p.h,
    pulses:Math.max(1,parseInt(chart.meter,10)||4),meter:chart.meter,hasChords:barHasChords(barData)
   });
  }else{
   var tokens=el.querySelectorAll('.chord-token');for(var k=0;k<tokens.length;k++){var tok=tokens[k],b=rect(tok);paint(tok.textContent,b.x+b.w/2,b.y+b.h/2,size(tok,18),tok.className.indexOf('empty')>=0?'#888':'#111',800);}
  }
  if(barData.volta){g.strokeStyle='#222';g.lineWidth=1.5;g.beginPath();g.moveTo(p.x,p.y-18);g.lineTo(p.x+p.w,p.y-18);g.moveTo(p.x,p.y-18);g.lineTo(p.x,p.y-2);g.stroke();paint(barData.volta+'.',p.x+11,p.y-25,14,'#222',800);}
  if(barData.segno)paint('𝄋',p.x+p.w-10,p.y-7,13,'#ba2b36',800);
  if(barData.coda)paint('𝄌',p.x+p.w-20,p.y-7,13,'#ba2b36',800);
 }
 els=paper.querySelectorAll('.repeat-label.red-repeat');for(var q=0;q<els.length;q++){el=els[q];p=rect(el);paint(el.textContent,p.x+p.w/2,p.y+p.h/2,size(el,19),'#c92734',900);}
 paint('MIS CHARTS · A4',390,1082,8,'#aaa',500);return cv;
}
function exportPreviewJPG(){
 if(!chart||!previewMode)return;
 try{
  var cv=makeJPG(),data=cv.toDataURL('image/jpeg',.95).split(',')[1],raw=atob(data),arr=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);
  var blob=new Blob([arr],{type:'image/jpeg'}),name='MisCharts-'+chart.title.replace(/[^A-Za-z0-9_-]/g,'_')+'.jpg';
  if(navigator.share&&navigator.canShare&&typeof File!=='undefined'){
   var f=new File([blob],name,{type:'image/jpeg'});
   if(navigator.canShare({files:[f]})){navigator.share({files:[f],title:chart.title}).catch(function(e){if(!e||e.name!=='AbortError')showJPG(blob,name);});return;}
  }
  showJPG(blob,name);
 }catch(e){say('No fue posible crear el JPG en este navegador');}
}
function fileDownload(name,data,mime){var a=document.createElement('a');var blob=new Blob([data],{type:mime||'application/json'});var url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},1000);}
function saveImportText(text){try{var d=JSON.parse(text);var arr=Object.prototype.toString.call(d)==='[object Array]'?d:[d];var count=0;for(var i=0;i<arr.length;i++){var c=arr[i];if(c&&c.title&&c.meter&&c.sections&&c.sections.length){c.id=String(c.id||Date.now()+Math.random());var taken=false;for(var j=0;j<charts.length;j++)if(charts[j].id===c.id)taken=true;if(taken)c.id=String(Date.now()+Math.random());charts.push(c);count++;}}if(count){save();renderLibrary();say(count+' chart(s) importados');}else say('Archivo JSON sin charts válidos');}catch(e){say('JSON no válido');}}
/* Editor dedicado de pentagrama. Coordenadas internas SVG: 900 × 228. */
function staffBeatCount(){return numBeats();}
/* Mis Charts 2.4: editor de partitura, silencios, puntillo y notas desplazables. */
var chosenKind='note',chosenDotted=false,selectedStaffNote=-1,staffHold=null,staffHoldTimer=null;
function staffBeatCount(){return numBeats();}
function notePitchFromY(y){
 var steps=Math.round((192-y)/10),v=2+steps,letters='CDEFGAB';
 var oct=4+Math.floor(v/7),letter=letters[(v%7+7)%7];
 return letter+String(Math.max(2,Math.min(7,oct)));
}
function staffPitchY(pitch){
 var p=/^([A-G])([#b]?)(\d)$/.exec(String(pitch||'E4'));
 if(!p)return 156;
 return 156-9*((+p[3]-4)*7+'CDEFGAB'.indexOf(p[1])-2);
}
function staffNoteLength(duration){return duration==='whole'?4:duration==='half'?2:duration==='eighth'?.5:duration==='sixteenth'?.25:duration==='thirtysecond'?.125:duration==='sixtyfourth'?.0625:1;}
function staffUpdateChoice(){
 var list=$('staff-screen').querySelectorAll('[data-duration],[data-rest]');
 for(var i=0;i<list.length;i++){
  var e=list[i],k=e.hasAttribute('data-rest')?'rest':'note',d=e.getAttribute('data-rest')||e.getAttribute('data-duration');
  e.className='duration-chip'+(chosenKind===k&&chosenDuration===d?' active':'');
 }
 $('staff-dot').className=chosenDotted?'active':'';
 $('staff-dot').setAttribute('aria-pressed',chosenDotted?'true':'false');
 var words={whole:'redonda',half:'blanca',quarter:'negra',eighth:'corchea',sixteenth:'semicorchea',thirtysecond:'fusa',sixtyfourth:'semifusa'};
 $('chosen-duration').textContent='Seleccionado: '+(chosenKind==='rest'?'silencio de ':'')+words[chosenDuration]+(chosenDotted?' con puntillo':'');
}
function staffChooseDuration(v){chosenKind='note';chosenDuration=v;staffUpdateChoice();}
function staffChooseRest(v){chosenKind='rest';chosenDuration=v;staffUpdateChoice();}
function staffChooseAcc(v){
 chosenAcc=v;
 var btns=$('staff-screen').querySelectorAll('[data-acc]');
 for(var i=0;i<btns.length;i++)btns[i].className=btns[i].getAttribute('data-acc')===v?'active':'';
}
function staffSaveHistory(){
 var b=currentBar();staffHistory.push(clone(b.notes||[]));
 if(staffHistory.length>70)staffHistory.shift();pushChartHistory();
}
function staffToggleDot(){
 var next=!chosenDotted,b=currentBar(),selected=b.notes&&b.notes[selectedStaffNote];
 if(selected){
  var trial=clone(selected);trial.dotted=next;
  if((typeof trial.time==='number'?trial.time:0)+MisNotation.length(trial)>staffBeatCount()+.001){
   say('La figura con puntillo excede el compás');return;
  }
  staffSaveHistory();selected.dotted=next;save();renderFullStaff();
 }
 chosenDotted=next;staffUpdateChoice();
}
function openStaff(){
 var b=currentBar();if(!b.notes)b.notes=[];
 if(!b.staff){pushChartHistory();b.staff=true;save();}
 staffHistory=[];selectedStaffNote=-1;chosenDotted=false;staffChooseDuration('quarter');staffChooseAcc('');
 $('staff-title').textContent=currentSection().name+' · Compás '+(bar+1);
 $('staff-meter').textContent=chart.meter;
 $('staff-screen').querySelector('.staff-topline span').textContent=staffBeatCount()+' pulsos';
 show('staff-screen');renderFullStaff();
}
function staffLocation(clientX,clientY,el){
 var rect=el.getBoundingClientRect();
 return{x:(clientX-rect.left)*900/rect.width,y:(clientY-rect.top)*280/rect.height};
}
function staffDurationStep(d){return d==='sixtyfourth'?.0625:d==='thirtysecond'?.125:d==='sixteenth'?.25:d==='eighth'?.5:.25;}
function staffTimeForX(x,duration,dotted){
 var beats=staffBeatCount(),w=784/beats;
 var len=staffNoteLength(duration)*(dotted?1.5:1);
 var step=staffDurationStep(duration);
 var time=Math.round((((x-62)/w)-(len/2))/step)*step;
 if(beats-len<0)return -1;
 return Math.max(0,Math.min(beats-len,time));
}
function staffDropAt(clientX,clientY,duration,kind,dotted){
 var loc=staffLocation(clientX,clientY,$('staff-svg')),d=duration||chosenDuration;
 kind=kind||chosenKind;
 dotted=typeof dotted==='boolean'?dotted:chosenDotted;
 if(loc.x<50||loc.x>854||loc.y<63||loc.y>252){say('Coloca la figura dentro del compás');return;}
 var t=staffTimeForX(loc.x,d,dotted);
 if(t<0){say('La figura no cabe en este compás');return;}
 var note={duration:d,time:t,kind:kind,dotted:!!dotted};
 if(kind==='note'){
  var pitch=notePitchFromY(loc.y);
  if(chosenAcc)pitch=pitch.replace(/(\d)$/,chosenAcc+'$1');
  note.pitch=pitch;
 }
 var b=currentBar();if(!b.notes)b.notes=[];
 staffSaveHistory();b.notes.push(note);selectedStaffNote=b.notes.length-1;
 b.staff=true;save();renderFullStaff();
 say((kind==='rest'?'Silencio':note.pitch)+' · pulso '+(Math.floor(t)+1));
}
function staffMoveAt(index,clientX,clientY){
 var b=currentBar(),note=b.notes&&b.notes[index];
 if(!note)return;
 var p=staffLocation(clientX,clientY,$('staff-svg'));
 if(p.x<50||p.x>854||p.y<56||p.y>252)return;
 var t=staffTimeForX(p.x,note.duration,note.dotted);
 if(t<0)return;
 var next=clone(note);next.time=t;
 if(next.kind!=='rest'){
  var alteration=String(next.pitch||'').match(/^[A-G]([#b])/);
  var newPitch=notePitchFromY(p.y);
  if(alteration)newPitch=newPitch.replace(/(\d)$/,alteration[1]+'$1');
  next.pitch=newPitch;
 }
 if(next.time===note.time&&next.pitch===note.pitch)return;
 staffSaveHistory();b.notes[index]=next;save();selectedStaffNote=index;
 renderFullStaff();say('Figura movida');
}
function staffRemoveAt(index){
 var b=currentBar();if(!b.notes||!b.notes[index])return;
 staffSaveHistory();b.notes.splice(index,1);selectedStaffNote=-1;
 save();renderFullStaff();say('Figura eliminada');
}
function staffUndo(){
 if(!staffHistory.length){say('No hay cambios para deshacer');return;}
 var b=currentBar();pushChartHistory();b.notes=staffHistory.pop();selectedStaffNote=-1;
 save();renderFullStaff();say('Deshecho');
}
function staffEsc(v){return esc(v);}
function renderFullStaff(){
 var svg=$('staff-svg'),b=currentBar();
 svg.setAttribute('viewBox','0 0 900 280');
 var engraving=MisNotation.renderSVG(b,{width:900,editor:true,pulses:staffBeatCount(),meter:chart.meter,hasChords:barHasChords(b)});
 svg.innerHTML='<rect x="0" y="0" width="900" height="280" fill="white"/>'+engraving.markup;
 if(selectedStaffNote>=0){
  var selected=svg.querySelector('.staff-note-hit[data-note="'+selectedStaffNote+'"]');
  if(selected)selected.classList.add('selected-note');
 }
}
function staffNoteIndex(el){
 if(!el)return null;
 var node=el.closest?el.closest('[data-note]'):null;
 if(!node||!$('staff-svg').contains(node))return null;
 var n=parseInt(node.getAttribute('data-note'),10);
 return isNaN(n)?null:n;
}
function staffGhost(x,y){
 var svg=$('staff-svg'),old=svg.querySelector('#staff-drag-ghost');
 if(!old){old=document.createElementNS('http://www.w3.org/2000/svg','circle');old.id='staff-drag-ghost';svg.appendChild(old);}
 var p=staffLocation(x,y,svg);
 old.setAttribute('cx',p.x);old.setAttribute('cy',p.y);
 old.setAttribute('r','16');old.setAttribute('fill','#cf2b3b');old.setAttribute('fill-opacity','.32');
 old.setAttribute('stroke','#cf2b3b');old.setAttribute('stroke-width','3');
}
function cancelStaffHold(){
 if(staffHoldTimer){clearTimeout(staffHoldTimer);staffHoldTimer=null;}
 var ghost=$('staff-svg').querySelector('#staff-drag-ghost');if(ghost)ghost.remove();
 staffHold=null;
}
function wireStaff(){
 var svg=$('staff-svg'),chips=$('staff-screen').querySelectorAll('[data-duration],[data-rest]');
 for(var i=0;i<chips.length;i++)(function(btn){
  var kind=btn.hasAttribute('data-rest')?'rest':'note';
  var duration=btn.getAttribute('data-duration')||btn.getAttribute('data-rest');
  var select=function(){if(kind==='rest')staffChooseRest(duration);else staffChooseDuration(duration);};
  btn.onclick=select;
  btn.ondragstart=function(e){dragDuration=duration;select();if(e.dataTransfer)e.dataTransfer.setData('text/plain',kind+':'+duration);};
  btn.addEventListener('touchstart',function(){dragDuration=duration;select();},{passive:true});
  btn.addEventListener('touchmove',function(e){if(e.cancelable)e.preventDefault();},{passive:false});
  btn.addEventListener('touchend',function(e){
   if(!e.changedTouches||!e.changedTouches.length)return;
   var p=e.changedTouches[0],rect=svg.getBoundingClientRect();
   if(p.clientX>=rect.left&&p.clientX<=rect.right&&p.clientY>=rect.top&&p.clientY<=rect.bottom){
    staffDropAt(p.clientX,p.clientY,duration,kind,chosenDotted);staffIgnoreClickUntil=Date.now()+600;
   }
  },{passive:false});
  var symbol=btn.querySelector('.duration-glyph');
  if(symbol)symbol.innerHTML=MisNotation.figureIcon(kind,duration);
 })(chips[i]);
 var acc=$('staff-screen').querySelectorAll('[data-acc]');
 for(var j=0;j<acc.length;j++)(function(button){button.onclick=function(){staffChooseAcc(button.getAttribute('data-acc'));};})(acc[j]);
 $('staff-dot').onclick=staffToggleDot;
 svg.addEventListener('dragover',function(e){e.preventDefault();});
 svg.addEventListener('drop',function(e){e.preventDefault();
  var raw=e.dataTransfer&&e.dataTransfer.getData('text/plain'),parts=raw?raw.split(':'):[];
  staffDropAt(e.clientX,e.clientY,parts[1]||dragDuration||chosenDuration,parts[0]||chosenKind,chosenDotted);
  staffIgnoreClickUntil=Date.now()+600;
 });
 svg.addEventListener('click',function(e){
  if(Date.now()<staffIgnoreClickUntil)return;
  var index=staffNoteIndex(e.target);
  if(index!==null){selectedStaffNote=index;renderFullStaff();return;}
  selectedStaffNote=-1;staffDropAt(e.clientX,e.clientY,chosenDuration,chosenKind,chosenDotted);
 });
 function beginHold(e,index,x,y){
  cancelStaffHold();staffHold={index:index,x:x,y:y,armed:false,moved:false};
  staffHoldTimer=setTimeout(function(){
   if(staffHold&&staffHold.index===index){staffHold.armed=true;selectedStaffNote=index;staffGhost(x,y);}
  },380);
 }
 function moveHold(e,x,y){
  if(!staffHold)return;
  var dis=Math.hypot(x-staffHold.x,y-staffHold.y);
  if(!staffHold.armed&&dis>14){cancelStaffHold();return;}
  if(staffHold.armed){if(e.cancelable)e.preventDefault();staffHold.moved=true;staffGhost(x,y);}
 }
 function endHold(e,x,y){
  if(!staffHold)return;
  var hold=staffHold,index=hold.index,armed=hold.armed;
  cancelStaffHold();
  if(armed){if(e.cancelable)e.preventDefault();staffIgnoreClickUntil=Date.now()+700;staffMoveAt(index,x,y);}
 }
 svg.addEventListener('touchstart',function(e){
  if(e.touches.length!==1)return;var index=staffNoteIndex(e.target);
  if(index===null)return;
  beginHold(e,index,e.touches[0].clientX,e.touches[0].clientY);
 },{passive:true});
 svg.addEventListener('touchmove',function(e){if(staffHold&&e.touches.length===1)moveHold(e,e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
 svg.addEventListener('touchend',function(e){if(staffHold&&e.changedTouches.length)endHold(e,e.changedTouches[0].clientX,e.changedTouches[0].clientY);},{passive:false});
 svg.addEventListener('touchcancel',cancelStaffHold,{passive:true});
 // Mouse y Apple Pencil: sostener y arrastrar una nota ya escrita.
 svg.addEventListener('pointerdown',function(e){if(e.pointerType==='touch'||e.button!==0)return;
  var index=staffNoteIndex(e.target);if(index!==null)beginHold(e,index,e.clientX,e.clientY);
 });
 svg.addEventListener('pointermove',function(e){if(e.pointerType!=='touch'&&staffHold)moveHold(e,e.clientX,e.clientY);});
 svg.addEventListener('pointerup',function(e){if(e.pointerType!=='touch'&&staffHold)endHold(e,e.clientX,e.clientY);});
 svg.addEventListener('pointercancel',cancelStaffHold);
 $('staff-undo').onclick=staffUndo;
 $('staff-delete').onclick=function(){
  var b=currentBar();if(!b.notes||!b.notes.length){say('No hay notas');return;}
  staffRemoveAt(selectedStaffNote>=0?selectedStaffNote:b.notes.length-1);
 };
}
var staffIgnoreClickUntil=0;

function wire(){
$('new-button').onclick=function(){show('new-screen');setTimeout(function(){$('song-title').focus();},100);};$('open-button').onclick=function(){renderLibrary();show('library-screen');};$('new-back').onclick=$('library-back').onclick=function(){show('home-screen');};
$('new-form').onsubmit=function(e){e.preventDefault();var title=$('song-title').value.replace(/^\s+|\s+$/g,'');if(!title){say('Escribe el nombre del tema');return false;}chart={id:String(Date.now())+String(Math.random()).substr(2,5),title:title,artist:$('song-artist').value,meter:$('song-meter').value,sections:[]};chart.sections=[newSection('Intro')];charts.push(chart);save();sec=line=bar=beat=half=0;openChart();this.reset();return false;};
$('chart-back').onclick=function(){save();renderLibrary();show('library-screen');};$('edit-first').onclick=function(){beat=half=0;openEditor();};
$('section-plus').onclick=function(){pushChartHistory();var name=$('section-kind').value;chart.sections.push(newSection(name));sec=chart.sections.length-1;line=bar=0;save();renderChart();};$('section-minus').onclick=function(){if(chart.sections.length===1){say('Debe quedar al menos una sección');return;}if(!confirm('¿Eliminar sección '+currentSection().name+'?'))return;pushChartHistory();chart.sections.splice(sec,1);sec=Math.max(0,sec-1);line=bar=0;save();renderChart();};
$('line-plus').onclick=function(){pushChartHistory();currentSection().lines.push(newLine());line=currentSection().lines.length-1;bar=0;save();renderChart();};
$('bar-plus').onclick=function(){if(currentLine().bars.length>=10){say('Máximo 10 compases por línea');return;}pushChartHistory();currentLine().bars.push(newBar());save();renderChart();};$('bar-minus').onclick=function(){if(currentLine().bars.length<=1){say('Debe quedar al menos un compás');return;}pushChartHistory();currentLine().bars.pop();bar=Math.min(bar,currentLine().bars.length-1);save();renderChart();};
$('repeat-plus').onclick=function(){pushChartHistory();currentLine().repeat=Math.min(16,currentLine().repeat+1);save();renderChart();};$('repeat-minus').onclick=function(){pushChartHistory();currentLine().repeat=Math.max(1,currentLine().repeat-1);save();renderChart();};
$('zoom-button').onclick=function(){zoom=!zoom;this.textContent=zoom?'Ajustar A4':'Ampliar lectura';fitPaper();};
$('preview-button').onclick=function(){setPreviewMode(true);};
$('preview-close').onclick=function(){setPreviewMode(false);};
$('preview-smaller').onclick=function(){changePreview(-4);};
$('preview-larger').onclick=function(){changePreview(4);};
$('preview-auto').onclick=function(){previewAuto=true;renderChart();};
$('tools-toggle').onclick=function(){var p=$('advanced-tools'),open=p.className.indexOf('hide')>=0;p.className=open?'advanced-tools':'advanced-tools hide';this.setAttribute('aria-expanded',open?'true':'false');this.textContent=open?'Cerrar ▴':'Herramientas ▾';};
$('export-jpg-button').onclick=exportPreviewJPG;
$('jpg-close').onclick=closeJPGSheet;
$('jpg-download').onclick=downloadPreviewJPG;
document.addEventListener('keydown',function(e){if(previewMode&&e.key==='Escape')setPreviewMode(false);});
$('copy-bar').onclick=copySelectedBar;$('copy-section').onclick=copySelectedSection;$('paste-clipboard').onclick=pasteSelected;$('cancel-copy').onclick=function(){clipboard=null;mode='';lastTapKey='';updateClipboardUI();say('Copia cancelada');};
$('editor-back').onclick=$('editor-done').onclick=function(){save();show('chart-screen');renderChart();repaintToolbar();};
$('apply-chord').onclick=apply;$('chord-preview').oninput=function(){touchBuild(lastPreview);lastPreview=this.value;builder=parseChord(this.value);renderPalette();};
$('erase-chord').onclick=clearChord;$('undo-chord').onclick=undoChord;
$('subdivide').onclick=function(){pushChartHistory();var p=currentBeat();p.split=!p.split;if(!p.split){p.second='';half=0;}save();renderEditor();};$('kick').onclick=function(){pushChartHistory();currentBeat().kick=!currentBeat().kick;save();renderEditor();};
$('half-controls').onclick=function(e){var t=e.target;if(t.tagName==='BUTTON')selectPulse(beat,parseInt(t.getAttribute('data-half'),10)||0);};
$('expand-chords').onclick=function(){var a=$('advanced'),open=a.className==='hide';a.className=open?'':'hide';this.textContent=open?'Ocultar tipos adicionales ▴':'Más tipos de acorde y modificadores ▾';this.setAttribute('aria-expanded',open?'true':'false');};
$('previous-bar').onclick=function(){if(bar>0){bar--;beat=half=0;builder=null;renderEditor();}else say('Primer compás de esta línea');};$('next-bar').onclick=function(){if(bar<currentLine().bars.length-1){bar++;beat=half=0;builder=null;renderEditor();}else say('Último compás de esta línea');};
$('chart-undo').onclick=undoChart;
 $('repeat-start').onclick=function(){toggleBarMark('repeatStart');};
 $('repeat-end').onclick=function(){toggleBarMark('repeatEnd');};
 $('chart-segno').onclick=function(){toggleBarMark('segno');};
 $('chart-coda').onclick=function(){toggleBarMark('coda');};
$('volta-one').onclick=function(){setVolta(1);};
$('volta-two').onclick=function(){setVolta(2);};
$('volta-clear').onclick=function(){setVolta(0);};
 $('open-staff').onclick=openStaff;
 $('staff-back').onclick=$('staff-done').onclick=function(){save();show('chart-screen');renderChart();repaintToolbar();};
 $('staff-chords').onclick=function(){save();openEditor();};
 $('editor-open-staff').onclick=function(){save();openStaff();};
 wireStaff();setupSheetPinchZoom();
$('import-button').onclick=function(){$('import-file').click();};$('import-file').onchange=function(e){var f=this.files&&this.files[0];if(!f)return;var reader=new FileReader();reader.onload=function(){saveImportText(reader.result);};reader.readAsText(f);this.value='';};window.addEventListener('resize',function(){if(chart&&$('chart-screen').className.indexOf('hide')===-1)fitPaper();});
}
function ensureData(){for(var c=0;c<charts.length;c++){var ob=charts[c];if(!ob.sections)ob.sections=[];for(var s=0;s<ob.sections.length;s++){var section=ob.sections[s];if(!section.lines)section.lines=[];for(var l=0;l<section.lines.length;l++){var ln=section.lines[l];if(!ln.bars)ln.bars=[];if(!ln.repeat)ln.repeat=1;for(var b=0;b<ln.bars.length;b++){var br=ln.bars[b];if(!br.pulses)br.pulses=[];if(!br.notes)br.notes=[];if(br.volta===undefined)br.volta=0;for(var p=0;p<br.pulses.length;p++){if(br.pulses[p].second===undefined)br.pulses[p].second='';}}}}}}
function start(){safeRead();ensureData();initKeyboard();wire();show('home-screen');if('serviceWorker'in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('sw-v25.js?v=2.5.0').catch(function(){});});}}
start();
})();
