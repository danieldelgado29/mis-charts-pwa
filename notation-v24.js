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
  if(c.editor)lines.push('<rect data-note="'+it.index+'" x="'+fmt(x-22)+'" y="'+fmt(c.top-60)+'" width="44" height="'+fmt(4*c.space+95)+'" fill="transparent"/>');
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
 var bar={notes:[{kind:kind,duration:duration,time:0,pitch:'B4'}]},raw=renderSVG(bar,{editor:false,width:85,pulses:1,meter:'1/4'});
 // Los iconos comparten el mismo motor de cabezas, plicas y silencios.
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 85 178" aria-hidden="true" focusable="false">'+raw.markup+'</svg>';
}
global.MisNotation={cfg:cfg,items:items,clusters:clusters,notesLayout:notesLayout,renderSVG:renderSVG,figureIcon:figureIcon,length:length,pitchY:pitchY,pointX:pointX};
})(window);
