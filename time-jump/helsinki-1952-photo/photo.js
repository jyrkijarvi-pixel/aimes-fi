'use strict';

const tr=window.AimesLanguage.t;
window.AimesLanguage.apply();

const byId=id=>document.getElementById(id);
const viewport=byId('viewport');
const photo=byId('photograph');
const hero=byId('hero-photo');
const compare=byId('compare');
const comparison=byId('comparison');
const reveal=byId('reveal');
const note=byId('spot-note');
const lite=byId('lite');
const zoomIn=byId('zoom-in');
const zoomOut=byId('zoom-out');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const markers=[...document.querySelectorAll('.marker')];

const spots={
  city:{x:.28,y:.27,title:tr('Kaupungintalo'),description:tr('Vaalea julkisivu näkyy torin takana. Vuoden 1952 kuvassa Börje Dilén tallensi saman rakennuksen toisesta suunnasta.'),source:'https://www.finna.fi/Record/hkm.429E061A-83E3-4F8C-AFE2-AACC8CA07B86'},
  market:{x:.53,y:.40,title:tr('Torikojut'),description:tr('Kojurivi erottaa torin ja rantareunan. Torikauppa ja kalastajien myyntiveneet kuuluivat Kauppatorin arkeen.'),source:'https://historia.hel.fi/fi/alueet/etelainen/esplanadit-ja-kauppatori-kaupungin-sykkiva-sydan'},
  boats:{x:.47,y:.60,title:tr('Kolera-altaan veneet'),description:tr('Kajantien kuvassa näkyvät rinnakkain sidotut puuveneet, niiden penkit ja rantaan asettuneet ihmiset.'),source:'https://hkm.finna.fi/Record/hkm.87455276-66CB-47DF-98AF-DF2A3EA7C062'}
};
const zoomLevels=[1.05,1.36,1.83,2.42];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
let level=0;
let panX=0;
let panY=0;
let pendingFrame=0;
let drag;
let activeSpot;
let spotTrigger;

function frameGeometry() {
  const scale=zoomLevels[level];
  return {width:photo.offsetWidth*scale,height:photo.offsetHeight*scale,x:photo.offsetLeft,y:photo.offsetTop};
}
function setPan(x,y) {
  const frame=frameGeometry();
  panX=clamp(x,viewport.clientWidth-frame.x-frame.width/2,frame.width/2-frame.x);
  panY=clamp(y,viewport.clientHeight-frame.y-frame.height/2,frame.height/2-frame.y);
  if(pendingFrame)return;
  pendingFrame=requestAnimationFrame(render);
}
function render() {
  pendingFrame=0;
  const frame=frameGeometry();
  viewport.style.setProperty('--pan-x',panX+'px');
  viewport.style.setProperty('--pan-y',panY+'px');
  viewport.style.setProperty('--zoom',String(zoomLevels[level]));
  viewport.style.setProperty('--depth-shift',clamp(panX/9,-7,7)+'px');
  viewport.classList.toggle('zoomed',level>0);
  zoomIn.disabled=level===zoomLevels.length-1;
  zoomOut.disabled=level===0;
  for(const marker of markers) {
    const spot=spots[marker.dataset.spot];
    const x=frame.x+panX+(spot.x-.5)*frame.width;
    const y=frame.y+panY+(spot.y-.5)*frame.height;
    marker.hidden=x<25||x>viewport.clientWidth-25||y<25||y>viewport.clientHeight-25;
    marker.style.left=x+'px';
    marker.style.top=y+'px';
  }
}
function setZoom(next) {
  const old=frameGeometry();
  const x=(viewport.clientWidth/2-old.x-panX)/old.width;
  const y=(viewport.clientHeight/2-old.y-panY)/old.height;
  level=clamp(next,0,zoomLevels.length-1);
  const frame=frameGeometry();
  setPan(viewport.clientWidth/2-frame.x-x*frame.width,viewport.clientHeight/2-frame.y-y*frame.height);
}
function closeSpot(returnFocus=false) {
  if(!activeSpot)return;
  activeSpot=null;
  note.hidden=true;
  if(returnFocus) {
    const target=spotTrigger?.getClientRects().length ? spotTrigger : viewport;
    target.focus({preventScroll:true});
  }
}
function reset() {
  closeSpot();
  level=0;
  setPan(0,0);
}
function openSpot(event) {
  if(!comparison.hidden)setComparison(false,false);
  const target=event.currentTarget;
  const spot=spots[target.dataset.spot];
  activeSpot=spot;
  spotTrigger=target;
  level=1;
  const frame=frameGeometry();
  setPan(viewport.clientWidth/2-frame.x-(spot.x-.5)*frame.width,
    viewport.clientHeight*.41-frame.y-(spot.y-.5)*frame.height);
  byId('spot-title').textContent=spot.title;
  byId('spot-description').textContent=spot.description;
  byId('spot-source').href=spot.source;
  note.hidden=false;
  note.focus({preventScroll:true});
  viewport.scrollIntoView({block:'nearest'});
}
function finish(event) {
  if(drag?.id!==event.pointerId)return;
  drag=null;
  viewport.classList.remove('dragging');
}
function setComparison(open,returnFocus=true) {
  compare.setAttribute('aria-pressed',String(open));
  compare.textContent=open?tr('Sulje vertailu'):tr('Vertaa arkistokuvaan');
  viewport.classList.toggle('comparing',open);
  byId('original').hidden=!open;
  byId('compare-labels').hidden=!open;
  comparison.hidden=!open;
  if(open) {
    closeSpot();
    if(Math.abs(panX)<6)setPan(-18,panY);
    reveal.focus({preventScroll:true});
    viewport.scrollIntoView({block:'nearest'});
  } else if(returnFocus) compare.focus({preventScroll:true});
}
function setLite(active) {
  viewport.classList.toggle('lite',active);
  lite.setAttribute('aria-pressed',String(active));
}
function enable() {
  viewport.tabIndex=0;
  byId('actions').hidden=false;
  byId('markers').hidden=false;
  byId('spot-links').hidden=false;
  setLite(reduced.matches||(navigator.deviceMemory>0&&navigator.deviceMemory<=2));
  new ResizeObserver(()=>setPan(panX,panY)).observe(viewport);
  reset();
}
function unavailable() {
  const notice=byId('notice');
  notice.textContent=tr('Arkistokuvaa ei saatu ladattua. Lähdelinkit löytyvät alempaa.');
  notice.hidden=false;
}
if(hero.complete) {
  if(hero.naturalWidth)enable();
  else unavailable();
} else {
  hero.addEventListener('load',enable,{once:true});
  hero.addEventListener('error',unavailable,{once:true});
}

viewport.addEventListener('pointerdown',event=>{
  if(viewport.tabIndex!==0||event.target.closest('button,input,a,aside,.comparison')||!event.isPrimary||event.button!==0)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,panX,panY};
  viewport.setPointerCapture(event.pointerId);
  if(event.pointerType==='mouse')viewport.focus({preventScroll:true});
  viewport.classList.add('dragging');
});
viewport.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return;
  const gain=level===0?.36:1;
  setPan(drag.panX+(event.clientX-drag.x)*gain,drag.panY+(level>0?event.clientY-drag.y:0));
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,finish);
viewport.addEventListener('dragstart',event=>event.preventDefault());
viewport.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&activeSpot){closeSpot(true);return;}
  if(event.target!==viewport)return;
  const move={ArrowLeft:[20,0],ArrowRight:[-20,0],ArrowUp:[0,20],ArrowDown:[0,-20]}[event.key];
  if(move)setPan(panX+move[0],panY+move[1]);
  else if(event.key==='+'||event.key==='=')setZoom(level+1);
  else if(event.key==='-')setZoom(level-1);
  else if(event.key==='Home')reset();
  else return;
  event.preventDefault();
});
for(const trigger of document.querySelectorAll('[data-spot]'))trigger.addEventListener('click',openSpot);
byId('close-spot').addEventListener('click',()=>closeSpot(true));
zoomIn.addEventListener('click',()=>setZoom(level+1));
zoomOut.addEventListener('click',()=>setZoom(level-1));
byId('reset').addEventListener('click',()=>{
  if(!comparison.hidden)setComparison(false,false);
  reset();
});
lite.addEventListener('click',()=>setLite(lite.getAttribute('aria-pressed')!=='true'));
reduced.addEventListener('change',event=>{if(event.matches)setLite(true);});
compare.addEventListener('click',()=>setComparison(comparison.hidden));
byId('close-compare').addEventListener('click',()=>setComparison(false));
comparison.addEventListener('keydown',event=>{if(event.key==='Escape')setComparison(false);});
reveal.addEventListener('input',()=>viewport.style.setProperty('--split',reveal.value+'%'));
