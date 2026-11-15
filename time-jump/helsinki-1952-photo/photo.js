'use strict';

const byId=id=>document.getElementById(id);
const viewport=byId('viewport');
const hero=byId('hero-photo');
const compare=byId('compare');
const comparison=byId('comparison');
const reveal=byId('reveal');
const left=byId('look-left');
const right=byId('look-right');
let look=0;
let pendingFrame=0;
let drag;

function setLook(next) {
  look=Math.max(-1,Math.min(1,next));
  if(pendingFrame)return;
  pendingFrame=requestAnimationFrame(()=>{
    viewport.style.setProperty('--look',String(look));
    left.disabled=look===-1;
    right.disabled=look===1;
    pendingFrame=0;
  });
}
function finish(event) {
  if(drag?.id!==event.pointerId)return;
  drag=null;
  viewport.classList.remove('dragging');
}
function setComparison(open) {
  compare.setAttribute('aria-pressed',String(open));
  compare.textContent=open?'Sulje vertailu':'Vertaa arkistokuvaan';
  viewport.classList.toggle('comparing',open);
  byId('original').hidden=!open;
  byId('compare-labels').hidden=!open;
  comparison.hidden=!open;
  if(open) {
    if(Math.abs(look)<.12)setLook(.65);
    reveal.focus({preventScroll:true});
    viewport.scrollIntoView({block:'nearest'});
  } else {
    compare.focus({preventScroll:true});
  }
}
function enable() {
  viewport.tabIndex=0;
  viewport.setAttribute('aria-label','Rajattu näkymä Kolera-altaalle');
  viewport.setAttribute('aria-describedby','instruction');
  byId('actions').hidden=false;
}
function unavailable() {
  const notice=byId('notice');
  notice.textContent='Arkistokuvaa ei saatu ladattua. Lähdelinkit löytyvät alempaa.';
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
  if(viewport.tabIndex!==0||comparison.contains(event.target)||!event.isPrimary||event.button!==0)return;
  drag={id:event.pointerId,x:event.clientX,look};
  viewport.setPointerCapture(event.pointerId);
  if(event.pointerType==='mouse')viewport.focus({preventScroll:true});
  viewport.classList.add('dragging');
});
viewport.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return;
  const travel=Math.min(180,viewport.clientWidth*.38);
  setLook(drag.look+(drag.x-event.clientX)/travel);
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,finish);
viewport.addEventListener('dragstart',event=>event.preventDefault());
viewport.addEventListener('keydown',event=>{
  if(event.target!==viewport)return;
  if(event.key==='ArrowLeft')setLook(look-.28);
  else if(event.key==='ArrowRight')setLook(look+.28);
  else if(event.key==='Home')setLook(0);
  else return;
  event.preventDefault();
});
left.addEventListener('click',()=>setLook(look-.28));
right.addEventListener('click',()=>setLook(look+.28));
byId('reset').addEventListener('click',()=>setLook(0));
compare.addEventListener('click',()=>setComparison(comparison.hidden));
byId('close-compare').addEventListener('click',()=>setComparison(false));
comparison.addEventListener('keydown',event=>{
  if(event.key==='Escape')setComparison(false);
});
reveal.addEventListener('input',()=>viewport.style.setProperty('--split',reveal.value+'%'));
