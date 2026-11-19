import * as T from './vendor/three.module.min.js';
import { buildMarket } from './market.js';
import { archiveSize, reference } from './archive.js';

const canvas=document.querySelector('#view');
const enter=document.querySelector('#enter');
const arrival=document.querySelector('#arrival');
const overlay=document.querySelector('#overlay');
const status=document.querySelector('#status');
const quality=document.querySelector('#quality');
const compare=document.querySelector('#compare');
const archive=document.querySelector('#archive-layer');
const comparisonTools=document.querySelector('#comparison-tools');
const archiveShare=document.querySelector('#archive-share');
const resume=document.querySelector('#resume');
const stage=canvas.closest('.stage');
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(reference.fov,1,.08,180);
const narrow=matchMedia('(max-width:720px)');
const start={...reference,yaw:narrow.matches ? .35 : .47};
const pose={...start};
const keys=new Set();
const heldPointers=new Map();
let renderer;
let active=false;
let frame=0, previous=0;
let dirty=true;
let drag=null;
let comparing=false;

function fail(message) {
  active=false;
  cancelAnimationFrame(frame);
  enter.disabled=true;
  setComparison(false);
  overlay.hidden=true;
  arrival.hidden=false;
  status.textContent=message;
}
function size() {
  if (!renderer) return;
  const rect=canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const light=quality.value==='light';
  renderer.setPixelRatio(Math.min(devicePixelRatio,light ? .9 : 1.55));
  renderer.setSize(rect.width,rect.height,false);
  renderer.shadowMap.enabled=!light;
  renderer.shadowMap.needsUpdate=true;
  camera.aspect=comparing ? archiveSize.width/archiveSize.height : rect.width/rect.height;
  const horizontalLimit=2*Math.atan(Math.tan(T.MathUtils.degToRad(reference.fov)/2)*1.42/camera.aspect);
  camera.fov=comparing ? reference.fov : Math.min(narrow.matches ? 69 : reference.fov,T.MathUtils.radToDeg(horizontalLimit));
  camera.updateProjectionMatrix();
  dirty=true;
}
function walkable(x,z) {
  if(x< -42||x>37||z< -21||z>19) return false;
  if(z> -3.7 && x> -11.18) return false;
  if(Math.abs(x-14)<1.05 && Math.abs(z+12)<1.05) return false;
  for(let i=0;i<11;i++) {
    if(i!==6 && Math.abs(x-(-24+i*5.9))<2.11 && Math.abs(z-(-8+(i%2)*.28))<1.55) return false;
  }
  for(let i=0;i<5;i++) if(Math.abs(x-(-22+i*6.1))<2.11 && Math.abs(z+16.4)<1.55) return false;
  return true;
}
function pressed(key) {
  return keys.has(key)||[...heldPointers.values()].includes(key);
}
function update(dt) {
  if(comparing)return;
  const x=Number(pressed('d'))-Number(pressed('a'));
  const z=Number(pressed('w'))-Number(pressed('s'));
  const turn=Number(pressed('ArrowRight'))-Number(pressed('ArrowLeft'));
  const look=Number(pressed('ArrowUp'))-Number(pressed('ArrowDown'));
  if (!(x||z||turn||look)) return;
  pose.yaw+=turn*dt*1.35;
  pose.pitch=T.MathUtils.clamp(pose.pitch+look*dt*.94,-1.04,1.04);
  const distance=dt*(pressed('Shift')?4.45:2.7)/(Math.hypot(x,z)||1);
  const nx=pose.x+(Math.cos(pose.yaw)*x+Math.sin(pose.yaw)*z)*distance;
  const nz=pose.z+(Math.sin(pose.yaw)*x-Math.cos(pose.yaw)*z)*distance;
  if(walkable(nx,pose.z)) pose.x=nx;
  if(walkable(pose.x,nz)) pose.z=nz;
  dirty=true;
}
function render() {
  const view=comparing ? reference : pose;
  camera.position.set(view.x,view.height,view.z);
  camera.rotation.set(view.pitch,-view.yaw,0,'YXZ');
  renderer.render(scene,camera);
  dirty=false;
}
function tick(time) {
  if(!active)return;
  const dt=previous ? Math.min(.05,(time-previous)/1000) : 0;
  previous=time;
  update(dt);
  if(dirty)render();
  frame=requestAnimationFrame(tick);
}
function clearInputs() {
  keys.clear();
  heldPointers.clear();
  drag=null;
  previous=0;
}
function setComparison(value) {
  comparing=value;
  clearInputs();
  stage.classList.toggle('is-comparing',value);
  archive.hidden=!value;
  comparisonTools.hidden=!value;
  compare.setAttribute('aria-pressed',String(value));
  size();
}
async function setup() {
  quality.value=matchMedia('(pointer:coarse)').matches||navigator.hardwareConcurrency<=4?'light':'full';
  try {
    renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,failIfMajorPerformanceCaveat:false});
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.12;
    renderer.shadowMap.type=T.PCFShadowMap;
    renderer.shadowMap.autoUpdate=false;
    const loader=new T.TextureLoader();
    const [photo,color,normal]=await Promise.all(['kolera-allas.webp','graniitti-vari.jpg','graniitti-normaali.jpg'].map(path=>loader.loadAsync(path)));
    photo.colorSpace=color.colorSpace=T.SRGBColorSpace;
    buildMarket(scene,{archive:photo,color,normal});
    size();
    render();
  } catch (error) {
    console.warn('Kauppatorin 3D-näkymää ei voitu avata.',error);
    fail('3D-näkymää ei saatu ladattua. Se tarvitsee WebGL 2 -tuen ja paikalliset kuvatiedostot. Arkistokuva ja lähteet löytyvät alta.');
    return;
  }
  new ResizeObserver(size).observe(canvas);
  enter.disabled=false;
  status.textContent='';
}
enter.addEventListener('click',()=>{
  if (!renderer||active)return;
  active=true;
  arrival.hidden=true;
  overlay.hidden=false;
  window.scrollTo(0,0);
  canvas.focus({preventScroll:true});
  dirty=true;
  frame=requestAnimationFrame(tick);
});
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();
  clearInputs();
  fail('3D-yhteys katkesi. Voit yrittää uudelleen päivittämällä sivun.');
});
quality.addEventListener('change',()=>{size();canvas.focus({preventScroll:true});});
compare.addEventListener('click',()=>{
  setComparison(true);
  archiveShare.focus({preventScroll:true});
  comparisonTools.scrollIntoView({block:'nearest'});
});
archiveShare.addEventListener('input',()=>archive.style.setProperty('--archive-share',archiveShare.value+'%'));
resume.addEventListener('click',()=>{
  setComparison(false);
  canvas.focus({preventScroll:true});
  window.scrollTo(0,0);
});
document.querySelector('#reset').addEventListener('click',()=>{
  Object.assign(pose,start);
  dirty=true;
  canvas.focus({preventScroll:true});
});
const allowed=new Set(['w','a','s','d','Shift','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
canvas.addEventListener('keydown',event=>{
  const key=event.key.length===1?event.key.toLowerCase():event.key;
  if(active&&allowed.has(key)){keys.add(key);event.preventDefault();}
});
window.addEventListener('keyup',event=>keys.delete(event.key.length===1?event.key.toLowerCase():event.key));
canvas.addEventListener('blur',()=>keys.clear());
window.addEventListener('blur',clearInputs);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInputs();});
canvas.addEventListener('pointerdown',event=>{
  if(!active||comparing||drag||event.button!==0)return;
  canvas.focus({preventScroll:true});
  canvas.setPointerCapture(event.pointerId);
  drag={id:event.pointerId,x:event.clientX,y:event.clientY};
});
canvas.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return;
  pose.yaw+=(drag.x-event.clientX)*.0043;
  pose.pitch=T.MathUtils.clamp(pose.pitch+(event.clientY-drag.y)*.0039,-1.04,1.04);
  drag.x=event.clientX;
  drag.y=event.clientY;
  dirty=true;
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag?.id===e.pointerId)drag=null;});
for(const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    heldPointers.set(event.pointerId,button.dataset.key);
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>heldPointers.delete(e.pointerId));
}
setup();
