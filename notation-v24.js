/* Mis Charts v2.4 — grabado rítmico compartido entre edición y hoja. */
(function(global){
'use strict';
var D={whole:4,half:2,quarter:1,eighth:.5,sixteenth:.25};
function type(e){return e&&e.kind==='rest'?'rest':'note';}
function length(e){return (D[e&&e.duration]||1)*(e&&e.dotted?1.5:1);}
function time(e,i){return typeof e.time==='number'&&isFinite(e.time)?e.time:i;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmt(n){return Math.round(n*100)/100;}
function compound(m){return /^([369]|12)\/8$/.test(String(m||''));}
function groupKey(t,m){var unit=compound(m)?3:1;return Math.floor((t+1e-5)/unit);}
function items(bar){return ((bar&&bar.notes)||[]).map(function(e,i){return{note:e,index:i,time:time(e,i)};}).sort(function(a,b){return a.time-b.time||a.index-b.index;});}
function clusters(events,meter){
 var groups=[],run=[];
 function finish(){if(run.length>=2)groups.push(run.slice());run=[];}
 for(var i=0;i<events.length;i++){
  var x=events[i],e=x.note,elig=type(e)==='note'&&(e.duration==='eighth'||e.duration==='sixteenth');
  if(!elig){finish();continue;}
  if(run.length){
   var last=run[run.length-1];
   if(groupKey(x.time,meter)!==groupKey(last.time,meter)||Math.abs(x.time-last.time-length(last.note))>.011)finish();
  }
  run.push(x);
 }
 finish();
 return groups;
}
function cfg(options){
 var o=options||{},editor=!!o.editor,hasChords=!!o.hasChords,baseW=o.width||900;
 var top=editor?112:hasChords?99:74,space=editor?20:16;
 return{editor:editor,hasChords:hasChords,width:baseW,height:editor?280:hasChords?204:178,
 left:editor?62:13,right:editor?baseW-54:baseW-13,top:top,space:space,
 rx:editor?13:10,ry:editor?8.4:6.8,stem:editor?60:48,
 nameSize:editor?24:21,nameY:editor?48:hasChords?57:38, chordY:editor?20:25,
 meter:o.meter||'4/4',pulses:o.pulses||4,showPulse:editor};
}
function pitchY(p,c){
 var m=/^([A-G])([#b]?)(\d)$/.exec(String(p||'E4'));
 if(!m)return c.top+4*c.space;
 var names='CDEFGAB',v=(+m[3]*7+names.indexOf(m[1]))-(4*7+2);
 return c.top+4*c.space-v*c.space/2;
}
function pointX(e,i,c){
 var t=time(e,i),mid=t+length(e)/2;
 return c.left+Math.max(0,Math.min(c.pulses,mid))/Math.max(1,c.pulses)*(c.right-c.left);
}
function groupMap(ev,c){
 var groups=clusters(ev,c.meter),lookup={};
 for(var g=0;g<groups.length;g++){
  var grp=groups[g],avg=0;
  grp.forEach(function(it){avg+=pitchY(it.note.pitch,c);});
  var up=avg/grp.length>=c.top+2*c.space;
  var pts=grp.map(function(it){return{x:pointX(it.note,it.index,c),y:pitchY(it.note.pitch,c),it:it};});
  var yBase=up?Math.min.apply(null,pts.map(function(p){return p.y-c.stem;})):Math.max.apply(null,pts.map(function(p){return p.y+c.stem;}));
  var span=Math.max(1,pts[pts.length-1].x-pts[0].x),slope=Math.max(-7,Math.min(7,(pts[pts.length-1].y-pts[0].y)*.16));
  var ob={items:grp,pts:pts,up:up,yBase:yBase,slope:slope,span:span};
  groups[g]=ob;
  grp.forEach(function(it){lookup[it.index]=ob;});
 }
 return{groups:groups,lookup:lookup};
}
function beamY(gr,x){return gr.yBase+gr.slope*(x-gr.pts[0].x)/gr.span;}
function isShort(e){return e.duration==='eighth'||e.duration==='sixteenth';}
function notesLayout(bar,options){
 var c=cfg(options),ev=items(bar),g=groupMap(ev,c);
 return{c:c,events:ev,beams:g.groups,beamLookup:g.lookup};
}
function renderSVG(bar,options){
 var z=notesLayout(bar,options),c=z.c,ev=z.events,lines=[];
 if(c.showPulse){
  for(var i=0;i<c.pulses;i++){
   var px=c.left+i*(c.right-c.left)/c.pulses,ww=(c.right-c.left)/c.pulses;
   lines.push('<rect x="'+fmt(px)+'" y="'+fmt(c.top-37)+'" width="'+fmt(ww)+'" height="'+fmt(c.space*4+78)+'" fill="'+(i%2?'#fff':'#f6f7f9')+'"/>');
   lines.push('<line x1="'+fmt(px)+'" y1="'+fmt(c.top-37)+'" x2="'+fmt(px)+'" y2="'+fmt(c.top+c.space*4+41)+'" stroke="#d7d8dc" stroke-dasharray="3 5"/>');
   lines.push('<text x="'+fmt(px+ww/2)+'" y="'+fmt(c.top+c.space*4+49)+'" font-size="17" font-weight="800" fill="#bf2d38" text-anchor="middle">'+(i+1)+'</text>');
  }
 }
 for(var l=0;l<5;l++){
  var yy=c.top+l*c.space;
  lines.push('<path d="M'+fmt(c.left)+' '+fmt(yy)+'H'+fmt(c.right)+'" fill="none" stroke="#24262a" stroke-width="'+(c.editor?1.65:1.3)+'"/>');
 }
 if(c.editor)lines.push('<path d="M'+c.left+' '+c.top+'v'+(4*c.space)+'M'+c.right+' '+c.top+'v'+(4*c.space)+'" stroke="#24262a" stroke-width="2.2" fill="none"/>');
 if(c.hasChords){
  for(var p=0;p<(bar.pulses||[]).length;p++){
   var pulse=bar.pulses[p]||{},positions=[];
   if(pulse.chord)positions.push({text:pulse.chord,off:pulse.split?.25:.5});
   if(pulse.split&&pulse.second)positions.push({text:pulse.second,off:.75});
   for(var q=0;q<positions.length;q++){
    var cx=c.left+(p+positions[q].off)/c.pulses*(c.right-c.left);
    var maxFont=Math.max(9,Math.min(18,(c.right-c.left)/c.pulses*.45/Math.max(1,String(positions[q].text).length*.5)));
    lines.push('<text x="'+fmt(cx)+'" y="'+c.chordY+'" text-anchor="middle" font-size="'+fmt(maxFont)+'" font-weight="900" fill="#171717">'+esc(positions[q].text)+'</text>');
   }
  }
 }
 for(var e=0;e<ev.length;e++){
  var it=ev[e],nt=it.note,x=pointX(nt,it.index,c),y=pitchY(nt.pitch,c);
  var isRest=type(nt)==='rest',gr=z.beamLookup[it.index],up=gr?gr.up:y>=c.top+c.space*2;
  var noteName=String(nt.pitch||'E4').replace(/#/g,'♯').replace(/b/g,'♭');
  var lblY=c.nameY;
  if(e&&Math.abs(it.time-ev[e-1].time)<.75&&e%2)lblY+=c.editor?28:24;
  var hit=c.editor?' data-note="'+it.index+'"':'';
  lines.push('<g'+hit+' class="'+(c.editor?'staff-note-hit':'staff-score-note')+'">');
  if(!isRest)lines.push('<text x="'+fmt(x)+'" y="'+fmt(lblY)+'" font-size="'+c.nameSize+'" font-family="Arial,sans-serif" font-weight="900" fill="#c32a37" text-anchor="middle">'+esc(noteName)+'</text>');
  // Línea adicional para C4 y notas por debajo, o A5 y superiores.
  if(!isRest){
   var low=c.top+4*c.space,high=c.top;
   for(var ledger=low+c.space;ledger<=y+2;ledger+=c.space)lines.push('<path d="M'+fmt(x-c.rx-6)+' '+fmt(ledger)+'h'+fmt((c.rx+6)*2)+'" stroke="#24262a" stroke-width="1.8"/>');
   for(var upper=high-c.space;upper>=y-2;upper-=c.space)lines.push('<path d="M'+fmt(x-c.rx-6)+' '+fmt(upper)+'h'+fmt((c.rx+6)*2)+'" stroke="#24262a" stroke-width="1.8"/>');
  }
  if(isRest){
   var restY=c.top+2*c.space;
   var dur=nt.duration||'quarter';
   if(dur==='whole'||dur==='half'){
    var ry=dur==='whole'?c.top+c.space:c.top+2*c.space;
    lines.push('<path d="M'+fmt(x-12)+' '+fmt(ry)+'h24v'+(dur==='whole'?10:-10)+'h-24Z" fill="#242528"/>');
   }else if(dur==='quarter'){
    lines.push('<path d="M'+fmt(x+3)+' '+fmt(restY-28)+'l-10 20 12 8-11 18 9 11-8 6 3-12-12-12 11-18-11-9Z" fill="#242528"/>');
   }else{
    var count=dur==='sixteenth'?2:1;
    lines.push('<path d="M'+fmt(x+8)+' '+fmt(restY-25)+'l-13 55" stroke="#242528" stroke-width="3.5" fill="none"/>');
    for(var dots=0;dots<count;dots++){
     var dy=restY-22+dots*15;
     lines.push('<circle cx="'+fmt(x-6)+'" cy="'+fmt(dy)+'" r="5.5" fill="#242528"/>');
     lines.push('<path d="M'+fmt(x-5)+' '+fmt(dy+3)+'q5 7 15 2" stroke="#242528" stroke-width="3" fill="none"/>');
    }
   }
   if(nt.dotted)lines.push('<circle cx="'+fmt(x+20)+'" cy="'+fmt(restY-3)+'" r="3.2" fill="#242528"/>');
  }else{
   var accident=/^([A-G])([#b])/.exec(String(nt.pitch||''));
   if(accident)lines.push('<text x="'+fmt(x-c.rx-14)+'" y="'+fmt(y+5)+'" font-size="'+(c.editor?23:17)+'" text-anchor="middle" fill="#242528">'+(accident[2]==='#'?'♯':'♭')+'</text>');
   var whole=nt.duration==='whole',hollow=whole||nt.duration==='half';
   lines.push('<ellipse cx="'+fmt(x)+'" cy="'+fmt(y)+'" rx="'+(whole?c.rx*1.12:c.rx)+'" ry="'+c.ry+'" transform="rotate(-19 '+fmt(x)+' '+fmt(y)+')" fill="'+(hollow?'#fff':'#242528')+'" stroke="#242528" stroke-width="'+(c.editor?2.4:1.9)+'"/>');
   if(!whole){
    var stemX=x+(up?c.rx-1:-c.rx+1),end=gr?beamY(gr,x):y+(up?-c.stem:c.stem);
    lines.push('<path d="M'+fmt(stemX)+' '+fmt(y)+'V'+fmt(end)+'" stroke="#242528" stroke-width="'+(c.editor?3.1:2.5)+'" fill="none"/>');
    if(isShort(nt)&&!gr){
     var dir=up?1:-1,fl=nt.duration==='sixteenth'?2:1;
     for(var flg=0;flg<fl;flg++){
      var at=end+(up?flg*12:-flg*12);
      lines.push('<path d="M'+fmt(stemX)+' '+fmt(at)+'q'+fmt(14*dir)+' '+fmt(7*dir)+' '+fmt(10*dir)+' '+fmt(25*dir)+'" stroke="#242528" stroke-width="'+(c.editor?3.2:2.5)+'" fill="none"/>');
     }
    }
   }
   if(nt.dotted)lines.push('<circle cx="'+fmt(x+c.rx+8)+'" cy="'+fmt(y-3)+'" r="'+(c.editor?4:3.1)+'" fill="#242528"/>');
  }
  if(c.editor)lines.push('<rect data-note="'+it.index+'" x="'+fmt(x-15)+'" y="'+fmt(y-20)+'" width="30" height="40" fill="transparent"/>');
  lines.push('</g>');
 }
 // Barras de unión agrupadas por pulso, con segunda barra para semicorcheas.
 for(var k=0;k<z.beams.length;k++){
  var group=z.beams[k],first=group.pts[0],last=group.pts[group.pts.length-1];
  var offset=group.up?c.rx-1:-c.rx+1,secondary=group.up?10:-10;
  var y0=beamY(group,first.x),y1=beamY(group,last.x);
  lines.push('<path d="M'+fmt(first.x+offset)+' '+fmt(y0)+'L'+fmt(last.x+offset)+' '+fmt(y1)+'" stroke="#242528" stroke-width="'+(c.editor?7.5:5.8)+'" fill="none" stroke-linecap="butt"/>');
  for(var a=0;a<group.items.length;a++){
   var item=group.items[a],nt=item.note;
   if(nt.duration!=='sixteenth')continue;
   var next=group.items[a+1],prev=group.items[a-1],join=next&&next.note.duration==='sixteenth'&&Math.abs(next.time-item.time-length(nt))<.011;
   var x0=pointX(nt,item.index,c),x1;
   if(join)x1=pointX(next.note,next.index,c);
   else if(prev&&prev.note.duration==='sixteenth')continue;
   else{
    // Barra parcial cuando solo una semicorchea acompaña a una corchea.
    var neighbor=next||prev;
    x1=x0+((neighbor&&neighbor.time<item.time)?-1:1)*Math.min(22,c.pulses?((c.right-c.left)/c.pulses)*.2:20);
   }
   lines.push('<path d="M'+fmt(x0+offset)+' '+fmt(beamY(group,x0)+secondary)+'L'+fmt(x1+offset)+' '+fmt(beamY(group,x1)+secondary)+'" stroke="#242528" stroke-width="'+(c.editor?6.7:5.1)+'" stroke-linecap="butt"/>');
  }
 }
 return{markup:lines.join(''),config:c,groups:z.beams};
}
function figureIcon(kind,duration){
 // Glifos musicales dibujados en SVG, sin depender de fuentes con caracteres ausentes.
 var p=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 70" aria-hidden="true" focusable="false">'];
 if(kind==='rest'){
  if(duration==='whole'||duration==='half'){
   p.push('<path d="M9 33H51" stroke="currentColor" stroke-width="2.5"/>');
   p.push(duration==='whole'?'<rect x="21" y="33" width="18" height="9" fill="currentColor"/>':'<rect x="21" y="24" width="18" height="9" fill="currentColor"/>');
  }else if(duration==='quarter'){
   p.push('<path d="M32 11L23 27L35 37L24 51L32 58L20 49L29 37L17 27L28 11Z" fill="currentColor"/>');
  }else{
   p.push('<path d="M39 14L27 59" stroke="currentColor" stroke-width="3.5" fill="none"/>');
   for(var y=0;y<(duration==='sixteenth'?2:1);y++){
    p.push('<circle cx="20" cy="'+(20+y*16)+'" r="5.5" fill="currentColor"/>');
    p.push('<path d="M21 '+(24+y*16)+'Q31 '+(32+y*16)+' 37 '+(21+y*16)+'" stroke="currentColor" stroke-width="3.2" fill="none"/>');
   }
  }
 }else{
  var whole=duration==='whole',half=duration==='half',fill=whole||half?'white':'currentColor';
  p.push('<ellipse cx="20" cy="48" rx="'+(whole?14:11)+'" ry="'+(whole?7:7.4)+'" transform="rotate(-18 20 48)" fill="'+fill+'" stroke="currentColor" stroke-width="3"/>');
  if(!whole){
   p.push('<path d="M30 47V10" stroke="currentColor" stroke-width="3.2" fill="none"/>');
   if(duration==='eighth'||duration==='sixteenth'){
    p.push('<path d="M30 10Q51 21 38 41" stroke="currentColor" stroke-width="3.4" fill="none"/>');
    if(duration==='sixteenth')p.push('<path d="M30 21Q51 33 38 51" stroke="currentColor" stroke-width="3.4" fill="none"/>');
   }
  }
 }
 p.push('</svg>');return p.join('');
}
/* Canvas exporter: misma geometría que el SVG (incluidos los grupos de barras). */
function drawCanvas(context,bar,options){
 var o=options||{},eng=notesLayout(bar,o),c=eng.c,ctx=context;
 ctx.save();ctx.translate(o.x||0,o.y||0);
 ctx.scale((o.drawWidth||c.width)/c.width,(o.drawHeight||c.height)/c.height);
 ctx.strokeStyle='#24262a';ctx.fillStyle='#242528';ctx.lineCap='butt';
 for(var l=0;l<5;l++){
  var yy=c.top+l*c.space;ctx.lineWidth=c.editor?1.65:1.3;
  ctx.beginPath();ctx.moveTo(c.left,yy);ctx.lineTo(c.right,yy);ctx.stroke();
 }
 if(c.hasChords){
  for(var i=0;i<(bar.pulses||[]).length;i++){
   var p=bar.pulses[i]||{},texts=[];
   if(p.chord)texts.push({v:p.chord,off:p.split?.25:.5});
   if(p.split&&p.second)texts.push({v:p.second,off:.75});
   for(var a=0;a<texts.length;a++){
    var x=c.left+(i+texts[a].off)/c.pulses*(c.right-c.left);
    var font=Math.max(9,Math.min(18,(c.right-c.left)/c.pulses*.45/Math.max(1,texts[a].v.length*.5)));
    ctx.fillStyle='#171717';ctx.textAlign='center';ctx.font='900 '+font+'px Arial,sans-serif';ctx.fillText(texts[a].v,x,c.chordY);
   }
  }
 }
 for(var j=0;j<eng.events.length;j++){
  var it=eng.events[j],nt=it.note,x=pointX(nt,it.index,c),y=pitchY(nt.pitch,c),isRest=type(nt)==='rest',gr=eng.beamLookup[it.index],up=gr?gr.up:y>=c.top+2*c.space;
  ctx.fillStyle='#242528';ctx.strokeStyle='#242528';
  if(isRest){
   var ry=c.top+2*c.space,d=nt.duration||'quarter';
   if(d==='whole'||d==='half'){
    var line=d==='whole'?c.top+c.space:c.top+2*c.space;
    ctx.fillRect(x-12,d==='whole'?line:line-10,24,10);
   }else if(d==='quarter'){
    ctx.beginPath();ctx.moveTo(x+3,ry-28);ctx.lineTo(x-7,ry-8);ctx.lineTo(x+5,ry);ctx.lineTo(x-6,ry+18);ctx.lineTo(x+3,ry+29);ctx.lineTo(x-8,ry+35);ctx.lineTo(x-5,ry+23);ctx.lineTo(x-17,ry+11);ctx.lineTo(x-6,ry-7);ctx.lineTo(x-17,ry-16);ctx.lineTo(x-6,ry-28);ctx.closePath();ctx.fill();
   }else{
    ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(x+8,ry-25);ctx.lineTo(x-5,ry+30);ctx.stroke();
    for(var k=0;k<(d==='sixteenth'?2:1);k++){
     ctx.beginPath();ctx.arc(x-6,ry-22+k*15,5.5,0,Math.PI*2);ctx.fill();
     ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-5,ry-19+k*15);ctx.quadraticCurveTo(x+7,ry-13+k*15,x+10,ry-20+k*15);ctx.stroke();
    }
   }
   if(nt.dotted){ctx.beginPath();ctx.arc(x+20,ry-3,3.2,0,Math.PI*2);ctx.fill();}
   continue;
  }
  var name=String(nt.pitch||'E4').replace(/#/g,'♯').replace(/b/g,'♭'),lbl=c.nameY;
  if(j&&Math.abs(it.time-eng.events[j-1].time)<.75&&j%2)lbl+=c.editor?28:24;
  ctx.font='900 '+c.nameSize+'px Arial,sans-serif';ctx.textAlign='center';ctx.fillStyle='#c32a37';ctx.fillText(name,x,lbl);
  ctx.strokeStyle='#24262a';ctx.lineWidth=1.8;
  for(var below=c.top+5*c.space;below<=y+2;below+=c.space){ctx.beginPath();ctx.moveTo(x-c.rx-6,below);ctx.lineTo(x+c.rx+6,below);ctx.stroke();}
  for(var above=c.top-c.space;above>=y-2;above-=c.space){ctx.beginPath();ctx.moveTo(x-c.rx-6,above);ctx.lineTo(x+c.rx+6,above);ctx.stroke();}
  var altered=/^([A-G])([#b])/.exec(String(nt.pitch||''));
  if(altered){ctx.font=(c.editor?23:17)+'px Arial';ctx.fillStyle='#242528';ctx.fillText(altered[2]==='#'?'♯':'♭',x-c.rx-14,y+5);}
  ctx.save();ctx.translate(x,y);ctx.rotate(-19*Math.PI/180);ctx.beginPath();
  ctx.ellipse(0,0,nt.duration==='whole'?c.rx*1.12:c.rx,c.ry,0,0,Math.PI*2);
  ctx.fillStyle=nt.duration==='whole'||nt.duration==='half'?'#fff':'#242528';ctx.fill();
  ctx.lineWidth=c.editor?2.4:1.9;ctx.strokeStyle='#242528';ctx.stroke();ctx.restore();
  if(nt.duration!=='whole'){
   var sx=x+(up?c.rx-1:-c.rx+1),end=gr?beamY(gr,x):y+(up?-c.stem:c.stem);
   ctx.strokeStyle='#242528';ctx.lineWidth=c.editor?3.1:2.5;ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx,end);ctx.stroke();
   if(isShort(nt)&&!gr){
    var dir=up?1:-1;
    for(var k=0;k<(nt.duration==='sixteenth'?2:1);k++){
     var fy=end+(up?k*12:-k*12);
     ctx.lineWidth=c.editor?3.2:2.5;ctx.beginPath();ctx.moveTo(sx,fy);
     ctx.quadraticCurveTo(sx+14*dir,fy+7*dir,sx+10*dir,fy+25*dir);ctx.stroke();
    }
   }
  }
  if(nt.dotted){ctx.fillStyle='#242528';ctx.beginPath();ctx.arc(x+c.rx+8,y-3,c.editor?4:3.1,0,Math.PI*2);ctx.fill();}
 }
 for(var b=0;b<eng.beams.length;b++){
  var gr=eng.beams[b],first=gr.pts[0],last=gr.pts[gr.pts.length-1],offset=gr.up?c.rx-1:-c.rx+1;
  ctx.strokeStyle='#242528';ctx.lineWidth=c.editor?7.5:5.8;
  ctx.beginPath();ctx.moveTo(first.x+offset,beamY(gr,first.x));ctx.lineTo(last.x+offset,beamY(gr,last.x));ctx.stroke();
  var sec=gr.up?10:-10;
  for(var a=0;a<gr.items.length;a++){
   var item=gr.items[a],nt=item.note;
   if(nt.duration!=='sixteenth')continue;
   var nx=gr.items[a+1],pv=gr.items[a-1],join=nx&&nx.note.duration==='sixteenth'&&Math.abs(nx.time-item.time-length(nt))<.011;
   var x0=pointX(nt,item.index,c),x1;
   if(join)x1=pointX(nx.note,nx.index,c);
   else if(pv&&pv.note.duration==='sixteenth')continue;
   else{
    var neighbor=nx||pv,step=neighbor&&neighbor.time<item.time?-1:1;
    x1=x0+step*Math.min(22,((c.right-c.left)/c.pulses)*.2);
   }
   ctx.lineWidth=c.editor?6.7:5.1;ctx.beginPath();
   ctx.moveTo(x0+offset,beamY(gr,x0)+sec);ctx.lineTo(x1+offset,beamY(gr,x1)+sec);ctx.stroke();
  }
 }
 ctx.restore();
}
global.MisNotation={cfg:cfg,items:items,clusters:clusters,notesLayout:notesLayout,renderSVG:renderSVG,figureIcon:figureIcon,length:length,pitchY:pitchY,pointX:pointX,drawCanvas:drawCanvas};
})(window);
