'use strict';
/* TIME JUMP: six opt-in, static walkable dioramas. No remote model, 3D or map API calls. */
(() => {
const $ = id => document.getElementById(id);
const worlds = {
 helsinki: {title:'Helsinki · 1952',intro:'Tyylitelty Kauppatori olympiakesän aikaan. Täsmällinen katukuva ei ole varmennettu.',lat:60.1677,lon:24.9513,sky:'#a7cad1',ground:'#bfb29b',water:true,kind:'harbour',hint:'Kauppatori, Helsinki',story:'Helsingin olympialaiset järjestettiin kesällä 1952. Tämä kyltti ja ympäristö ovat taiteellisia havainne-elementtejä; tarkempi Helsinki 1952 -demo sisältää yksilöityjä lähteitä.',source:'https://historia.hel.fi/fi/alueet/etelainen/esplanadit-ja-kauppatori-kaupungin-sykkiva-sydan',cards:['Sataman elämä','Kauppahallin suunta','Olympiakesän vieraat']},
 punkalaidun: {title:'Punkalaidun · 1962',intro:'Kuvitteellinen 1960-luvun suomalainen kirkonkylän raitti – ei tarkka vuoden 1962 maastomalli.',query:'Punkalaidun keskusta, Suomi',sky:'#bad2d5',ground:'#9caf84',kind:'village',hint:'Punkalaitumen keskusta',story:'Punkalaitumen tarkat vuoden 1962 rakennukset, liikkeet ja katulinjaukset vaativat arkistokuvia ja paikallislähteitä. Tämän mallin rakennukset ovat tarkoituksella yleisluonteisia.',source:'https://fi.wikipedia.org/wiki/Punkalaidun',cards:['Kyläkaupan näyteikkuna','Linja-autopysäkki','Kirkonkylän raitti']},
 paris: {title:'Pariisi · 1900',intro:'Pariisin vuoden 1900 maailmannäyttelyn innoittama käveltävä kaupunkihavainne.',lat:48.8583,lon:2.2944,sky:'#bfd4d8',ground:'#c5b69d',kind:'paris',hint:'Eiffel-tornin ympäristö',story:'Eiffel-torni valmistui vuoden 1889 maailmannäyttelyyn. Vuoden 1900 Pariisi-havainne on kuvitteellinen sommitelma, ei tarkka kartoitus historiallisesta katutilasta.',source:'https://fi.wikipedia.org/wiki/Vuoden_1900_maailmann%C3%A4yttely',cards:['Eiffel-tornin hahmo','Kaupunki näyttelyvuonna','Vanha bulevardi']},
 newyork: {title:'New York · 1930',intro:'1930-luvun Manhattanin pilvenpiirtäjistä ja katuelämästä vaikutteita saanut 3D-havainne.',lat:40.7484,lon:-73.9857,sky:'#b6c7cd',ground:'#aaa8a2',kind:'nyc',hint:'Manhattan, New York',story:'1930-luvulla New Yorkin pilvenpiirtäjät muokkasivat kaupungin siluettia. Tämä kohtaus ei jäljennä tiettyä historiallista korttelia tai rakennuspiirustuksia.',source:'https://en.wikipedia.org/wiki/History_of_New_York_City_(1898%E2%80%931945)',cards:['Pilvenpiirtäjän juurella','Kaupungin vilinä','1930-luvun katulinja']},
 rome: {title:'Rooma · vuosi 100',intro:'Antiikin Rooman rakennustyyleihin perustuva kuvitteellinen Forum Romanumin havainne.',lat:41.8925,lon:12.4853,sky:'#b7c6ca',ground:'#d2bea0',kind:'rome',hint:'Forum Romanum, Rooma',story:'Forum Romanum oli antiikin Rooman keskeinen julkinen alue. Marmoripylväät ja portiikit ovat tyylillisiä havainne-elementtejä, eivät tarkka rekonstruktio juuri vuoden 100 rakennuksista.',source:'https://fi.wikipedia.org/wiki/Forum_Romanum',cards:['Pylväikkö','Roomalainen aukio','Kuviteltu kaupunkilainen']},
 laukeela: {title:'Urjala · Laukeela · 1962',intro:'Suomalaisen kirkonkylän keskustan innoittama raitti; historialliset rakennukset vielä tarkistamatta.',query:'Laukeela, Urjala, Suomi',sky:'#acc9d0',ground:'#a6b48a',kind:'village',hint:'Laukeelan keskusta',story:'Laukeela on Urjalan keskustaajama. Tämä vuoden 1962 havainne ei vielä väitä tuntevansa yksittäisten rakennusten ulkoasua, liikkeitä tai sijainteja.',source:'https://fi.wikipedia.org/wiki/Urjala',cards:['Keskustan raitti','Linja-auton odottelua','Pienen paikkakunnan kauppa']}
};
let active=null,cam={x:0,z:1.8,yaw:0},held=new Set(),raf=0,last=0,visible=false,drag=null,near=null,objects=[];
const canvas=$('scene'),ctx=canvas.getContext('2d',{alpha:false}),mini=$('mini'),mc=mini.getContext('2d');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const v=(x,y,z)=>({x,y,z});
function addFace(points,color,edge='#182a2a'){objects.push({points,color,edge});}
function box(x,z,w,d,h,colors){let [front,side,top]=colors;let x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;addFace([v(x0,0,z0),v(x1,0,z0),v(x1,h,z0),v(x0,h,z0)],front);addFace([v(x1,0,z0),v(x1,0,z1),v(x1,h,z1),v(x1,h,z0)],side);addFace([v(x0,0,z1),v(x0,0,z0),v(x0,h,z0),v(x0,h,z1)],side);addFace([v(x1,0,z1),v(x0,0,z1),v(x0,h,z1),v(x1,h,z1)],front);addFace([v(x0,h,z0),v(x1,h,z0),v(x1,h,z1),v(x0,h,z1)],top);}
function roof(x,z,w,d,h,c){let x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2,y=h+2;addFace([v(x0,h,z0),v(x1,h,z0),v(x,h+2,z0)],c);addFace([v(x0,h,z0),v(x0,h,z1),v(x,h+2,z1),v(x,h+2,z0)],c);addFace([v(x1,h,z1),v(x1,h,z0),v(x,h+2,z0),v(x,h+2,z1)],c);addFace([v(x0,h,z1),v(x1,h,z1),v(x,h+2,z1)],c);}
function building(x,z,w,d,h,palette,style='block'){
box(x,z,w,d,h,palette);
if(style==='roof') roof(x,z,w,d,h,'#8b514c');
if(style==='temple') {for(let k=-2;k<=2;k++){box(x+k*1.35,z-d/2-.5,.56,.56,h*.83,['#e4d5b7','#a99d85','#fbefcf']);}box(x,z-d/2-.2,w+1,.9,.6,['#e0d6bc','#bcaf9b','#f5ebd4']);}
let front=z-d/2-.018;
for(let xx=x-w/2+1.2;xx<x+w/2-.6;xx+=2.2)for(let yy=1.45;yy<h-.5;yy+=2.25){
addFace([v(xx-.34,yy-.4,front),v(xx+.34,yy-.4,front),v(xx+.34,yy+.46,front),v(xx-.34,yy+.46,front)],style==='temple'?'#917d58':'#718d94','#b7b6a1');}
}
function tree(x,z){box(x,z,.35,.4,3.5,['#655345','#554437','#7b6b51']);box(x,z,2.6,2.6,2.6,['#3e7359','#2d684e','#71906c']);}
function populate(world){
objects=[];
const village=world.kind==='village',rome=world.kind==='rome',nyc=world.kind==='nyc',paris=world.kind==='paris',harbour=world.kind==='harbour';
const left=[-12,-16,-12],right=[12,16,12];
for(let side of [-1,1])for(let i=0;i<6;i++){
let z=9+i*12,x=side*(11+(i%3)*1.5);
if(rome){building(x,z,8,7,4+i%2,['#b8a58e','#a08d7c','#ddd1bb'],'temple');}
else if(nyc){building(x,z,7,8,14+(i%3)*7,['#a68c77','#78665e','#c2ada0']);}
else if(paris){building(x,z,8,7,9+(i%2)*3,['#d8b99e','#a98c7c','#edcbb1']);}
else if(village){building(x,z,8,6,4+(i%2),['#d7c8a6','#b7aa8c','#ece2c4'],'roof'); if(i%2===0)tree(side*18,z+1);}
else {building(x,z,8,7,6+(i%3),['#cfc7aa','#aea58a','#e4d9c4'],'roof');}
}
if(rome){for(let i=0;i<8;i++){let z=14+i*8;box(-3.8,z,.65,.65,5.5,['#dfd2b6','#c6b99e','#eee4cb']);box(3.8,z,.65,.65,5.5,['#dfd2b6','#c6b99e','#eee4cb']);}}
if(paris){ // simplified distant open-frame landmark, not a 3D reconstruction
 for(let side of [-1,1])box(side*3,95,.8,.8,18,['#756f68','#655f59','#89817a']);
 box(0,95,6.5,.9,1.2,['#786f64','#645b52','#867b6f']);}
if(harbour){for(let i=0;i<7;i++)box(-18,10+i*12,.8,1.2,2.5,['#956c55','#80614e','#ad886a']);}
for(let i=0;i<6;i++){let z=17+i*12;let x=(i%2?3:-3);box(x,z,.42,.35,1.6,['#657b72','#556c63','#94ac9d']);}
near=null;
}
function resize(){
const rect=canvas.getBoundingClientRect();const ratio=Math.min(2,devicePixelRatio||1);
canvas.width=Math.max(340,Math.round(rect.width*ratio));canvas.height=Math.max(260,Math.round(rect.height*ratio));ctx.setTransform(ratio,0,0,ratio,0,0);
}
const worldToCam=p=>{
let dx=p.x-cam.x,dz=p.z-cam.z,s=Math.sin(cam.yaw),c=Math.cos(cam.yaw);
return {x:dx*c-dz*s,y:p.y-1.75,z:dx*s+dz*c};
};
function clipPoly(poly){
const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ain=a.z>=.25,bin=b.z>=.25;
if(ain)out.push(a);
if(ain!==bin){const t=(.25-a.z)/(b.z-a.z);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:.25});}}
return out;
}
function project(p,w,h){const focal=Math.min(w*1.2,h*1.24);return {x:w/2+p.x*focal/p.z,y:h*.52-p.y*focal/p.z};}
function scene(){
if(!active)return;const w=canvas.width/Math.min(2,devicePixelRatio||1),h=canvas.height/Math.min(2,devicePixelRatio||1),world=worlds[active];
ctx.fillStyle=world.sky;ctx.fillRect(0,0,w,h*.52);
ctx.fillStyle=world.ground;ctx.fillRect(0,h*.52,w,h*.48);
ctx.fillStyle=world.water?'#729a9d':world.kind==='rome'?'#b6a68d':'#777977';
const road=[v(-4,0,3),v(4,0,3),v(5.2,0,135),v(-5.2,0,135)].map(worldToCam);
const roadPoly=clipPoly(road).map(p=>project(p,w,h));
if(roadPoly.length){ctx.beginPath();roadPoly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
let items=[];for(const f of objects){let p=f.points.map(worldToCam),clipped=clipPoly(p);if(clipped.length<3)continue;let avg=p.reduce((a,b)=>a+b.z,0)/p.length;items.push({points:clipped.map(t=>project(t,w,h)),color:f.color,edge:f.edge,depth:avg});}
items.sort((a,b)=>b.depth-a.depth);
for(const t of items){ctx.fillStyle=t.color;ctx.strokeStyle=t.edge;ctx.lineWidth=.7;ctx.beginPath();t.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();}
ctx.fillStyle='#ffdfa6';for(let i=0;i<4;i++){let p=worldToCam(v(i%2?2:-2,1.6,19+i*16));if(p.z<=.5)continue;let q=project(p,w,h),size=clamp(30/p.z*6,2,24);ctx.fillRect(q.x-size*.2,q.y-size*.5,size*.4,size*1.4);}
ctx.strokeStyle='#f9e8d5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w/2-8,h/2);ctx.lineTo(w/2+8,h/2);ctx.moveTo(w/2,h/2-8);ctx.lineTo(w/2,h/2+8);ctx.stroke();
drawMini();$('scene-hud').textContent=world.hint+' · Kävellen '+Math.max(0,Math.round(cam.z))+' m';$('position').textContent='Havainnekartta: '+Math.round(cam.x)+' / '+Math.round(cam.z)+' · ei oikea GPS-reitti';
}
function drawMini(){let w=mini.width,h=mini.height;mc.clearRect(0,0,w,h);mc.fillStyle='#092125';mc.fillRect(0,0,w,h);let y=z=>h-15-z*1.05,x=v=>w/2+v*4.6;mc.fillStyle='#5c6663';mc.fillRect(x(-5),y(130),x(5)-x(-5),y(0)-y(130));for(let z=11;z<85;z+=12){mc.fillStyle='#b59d7f';mc.fillRect(x(-17),y(z+4),x(-9)-x(-17),9);mc.fillRect(x(9),y(z+4),x(17)-x(9),9);}
mc.save();mc.translate(x(cam.x),y(cam.z));mc.rotate(-cam.yaw);mc.fillStyle='#ffdc9d';mc.beginPath();mc.moveTo(0,-11);mc.lineTo(-5,6);mc.lineTo(5,6);mc.fill();mc.restore();}
function frame(t){if(!visible){raf=0;return;}if(!last)last=t;const dt=Math.min(.04,(t-last)/1000);last=t;
const forward=(held.has('forward')||held.has('w')||held.has('arrowup')?1:0)-(held.has('backward')||held.has('s')||held.has('arrowdown')?1:0);
const side=(held.has('right')||held.has('d')?1:0)-(held.has('left')||held.has('a')?1:0);
const turn=(held.has('turn-right')||held.has('arrowright')?1:0)-(held.has('turn-left')||held.has('arrowleft')?1:0);
cam.yaw+=turn*dt*1.5;
const speed=6.4;
cam.x=clamp(cam.x+(Math.sin(cam.yaw)*forward+Math.cos(cam.yaw)*side)*speed*dt,-5,5);
cam.z=clamp(cam.z+(Math.cos(cam.yaw)*forward-Math.sin(cam.yaw)*side)*speed*dt,2,98);
scene();raf=requestAnimationFrame(frame);
}
function reset(){cam={x:0,z:2,yaw:0};last=0;scene();}
function streetViewURL(world){
if(world.lat!=null&&world.lon!=null){const u=new URL('https://www.google.com/maps/@');u.searchParams.set('api','1');u.searchParams.set('map_action','pano');u.searchParams.set('viewpoint',world.lat+','+world.lon);return u.href;}
const u=new URL('https://www.google.com/maps/search/');u.searchParams.set('api','1');u.searchParams.set('query',world.query);return u.href;
}
function select(key){
const world=worlds[key];if(!world)return;
active=key;populate(world);$('walk-shell').hidden=false;$('walk-title').textContent=world.title;$('walk-intro').textContent=world.intro;
$('history').textContent=world.story;$('source').href=world.source;
$('street-view').href=streetViewURL(world);
$('street-view').textContent=(world.lat==null?'Avaa paikka Google Mapsissa ↗':'Avaa nykyinen Street View ↗');
$('helsinki-demo').hidden=key!=='helsinki';
for(const b of document.querySelectorAll('[data-world]'))b.setAttribute('aria-pressed',String(b.dataset.world===key));
held.clear();visible=true;reset();resize();if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
$('walk-shell').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
$('walk-title').focus({preventScroll:true});
}
document.querySelectorAll('[data-world]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.world)));
$('change-world').addEventListener('click',()=>{visible=false;held.clear();$('walk-shell').hidden=true;$('choices-heading').scrollIntoView();$('choices-heading').setAttribute('tabindex','-1');$('choices-heading').focus();});
$('reset').addEventListener('click',reset);
$('inspect').addEventListener('click',()=>{if(!active)return;const world=worlds[active];$('walk-intro').textContent=world.cards[Math.min(2,Math.floor(cam.z/33))]+': Havainne-elementti, jonka historiallinen tarkkuus vaatii lisälähteitä.';});
document.addEventListener('keydown',e=>{if(!visible)return;if(/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){held.add(k);e.preventDefault();}if(k==='e')$('inspect').click();});
document.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
document.addEventListener('visibilitychange',()=>{if(document.hidden)held.clear();});
window.addEventListener('blur',()=>held.clear());
for(const button of document.querySelectorAll('[data-move]')){
const action=button.dataset.move;const start=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);held.add(action);};
const stop=()=>held.delete(action);button.addEventListener('pointerdown',start);for(const ev of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,stop);
}
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;drag={x:e.clientX,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x;cam.yaw+=dx*.006;drag.x=e.clientX;});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>drag=null);
window.addEventListener('resize',()=>{if(visible){resize();scene();}});
})();
