'use strict';
/* TIME JUMP / free exploration: stylised walkable diorama, no remote assets or API. */
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('walk-canvas');
  const minimap = $('walk-mini');
  const ctx = canvas.getContext('2d', { alpha:false });
  const mini = minimap.getContext('2d');
  const keys = new Set();
  const touch = new Set();
  const ZONES = [
    {
      name:'Kauppatori', subtitle:'Torikauppaa ja satamaelämää', accent:'#d7bc87',
      start:{x:0,z:4,yaw:0}, boundary:{minX:-10,maxX:10,minZ:3,maxZ:43},
      points:[{x:-5,z:18,title:'Torikauppa',find:0},{x:5,z:33,title:'Kuvitteellinen kohtaaminen',find:1}]
    },
    {
      name:'Senaatintori', subtitle:'Kivinen aukio ja kaupungin maamerkit', accent:'#c4d8ba',
      start:{x:0,z:4,yaw:0}, boundary:{minX:-11,maxX:11,minZ:3,maxZ:43},
      points:[{x:0,z:23,title:'Aleksanteri II:n muistomerkki',find:0},{x:7,z:36,title:'Rekonstruoitu katukuva',find:1}]
    },
    {
      name:'Olympiastadion', subtitle:'Helsingin olympiakesä 1952', accent:'#e9c89e',
      start:{x:0,z:4,yaw:0}, boundary:{minX:-11,maxX:11,minZ:3,maxZ:43},
      points:[{x:-6,z:30,title:'Olympiatulen historia',find:0},{x:6,z:18,title:'Kuvitteellinen viesti',find:1}]
    }
  ];
  let zoneIndex=0, running=false, visible=false, last=0, raf=0;
  let cam={x:0,z:4,yaw:0};
  let width=1000, height=580, focal=680, geometry=[];
  let nearest=null, dragging=false, lastPointerX=0, hovered=null;
  const sceneryColors={sky:'#91b7bb',horizon:'#f4d8a9',ground:'#afaa91'};
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function rgba(hex,alpha=1){return hex;}
  function face(vertices,color,outline,kind){ geometry.push({vertices,color,outline,kind}); }
  function quad(a,b,c,d,color,outline){ face([a,b,c,d],color,outline); }
  const v=(x,y,z)=>({x,y,z});
  function box(x,z,w,d,h,colors){
    const l=x-w/2,r=x+w/2,n=z-d/2,f=z+d/2;
    const palette=Array.isArray(colors)?colors:[colors,colors,colors,colors];
    quad(v(l,0,n),v(r,0,n),v(r,h,n),v(l,h,n),palette[0],'#142e3033');
    quad(v(r,0,n),v(r,0,f),v(r,h,f),v(r,h,n),palette[1],'#142e3033');
    quad(v(l,0,f),v(l,0,n),v(l,h,n),v(l,h,f),palette[2],'#142e3033');
    quad(v(r,0,f),v(l,0,f),v(l,h,f),v(r,h,f),palette[2],'#142e3033');
    quad(v(l,h,n),v(r,h,n),v(r,h,f),v(l,h,f),palette[3],'#142e3033');
  }
  function frontWindows(x,z,w,h,cols,rows,color){
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
      const mid=x-w/2 + w*(i+1)/(cols+1), bottom=1.25+j*2.75;
      quad(v(mid-.4,bottom,z-.012),v(mid+.4,bottom,z-.012),v(mid+.4,bottom+1.15,z-.012),v(mid-.4,bottom+1.15,z-.012), color,'#7d8b80');
      quad(v(mid-.46,bottom+.52,z-.02),v(mid+.46,bottom+.52,z-.02),v(mid+.46,bottom+.59,z-.02),v(mid-.46,bottom+.59,z-.02),'#c1aa76');
    }
  }
  function paving(){
    // Distinct paved pedestrian corridor: this ground plane is an illustrative layout, not real coordinates.
    quad(v(-11,0,0),v(11,0,0),v(11,0,55),v(-11,0,55),'#aaa997');
    quad(v(-2,0.008,0),v(2,0.008,0),v(2,0.008,51),v(-2,0.008,51),'#b9b4a1');
    for(let z=2;z<=52;z+=3){
      quad(v(-11,.014,z),v(11,.014,z),v(11,.014,z+.09),v(-11,.014,z+.09),'#6f817b');
    }
    for(let x=-10;x<=10;x+=2.5){
      quad(v(x,.016,0),v(x+.04,.016,0),v(x+.04,.016,53),v(x,.016,53),'#7e877f');
    }
  }
  function building(x,z,w,d,h,colors){
    box(x,z,w,d,h,colors);
    if(z-d/2>0)frontWindows(x,z-d/2,w,h, Math.max(2,Math.floor(w/2.8)),Math.floor((h-1)/2.75),'#b8bcab');
  }
  function tree(x,z){
    box(x,z,.32,.32,3.0,['#665445','#554738','#68533c','#6b5647']);
    // layered low-poly canopy
    box(x,z,2.4,2.4,1.2,['#577260','#4b6857','#476a58','#719075']);
    box(x,z,1.9,1.9,4.1,['#648669','#567a61','#50775e','#789772']);
  }
  function lamp(x,z){
    box(x,z,.15,.15,4.0,['#405157','#374449','#374449','#54656a']);
    box(x,z,.52,.5,4.4,['#f2db9c','#f0d7a0','#e4cc96','#53645e']);
  }
  function market(){
    paving();
    quad(v(11.1,-.09,0),v(44,-.09,0),v(44,-.09,60),v(11.1,-.09,60),'#386b74');
    quad(v(10.3,.09,0),v(11.15,.09,0),v(11.15,.09,56),v(10.3,.09,56),'#b1b6aa');
    for(let i=0;i<18;i++){
      const z=i*3.2+2;
      quad(v(12,-.084,z),v(39,-.084,z+.4),v(39,-.084,z+.5),v(12,-.084,z+.16),'#5a8c8c');
    }
    building(-18,22,13,18,11,['#c7b9a0','#9c967f','#999184','#a8aa9c']);
    building(-18,44,13,18,10,['#c8bda7','#a0a18b','#969485','#acb5aa']);
    for(let z of [12,24,36]){
      box(-6,z,4.2,3,1.25,['#ad7753','#815c43','#866048','#d1b18a']);
      quad(v(-8.3,2.7,z-1.6),v(-3.7,2.7,z-1.6),v(-3.7,2.7,z+1.6),v(-8.3,2.7,z+1.6),'#a85846');
      box(-7.7,z-1.3,.15,.15,2.7,'#685746'); box(-4.1,z-1.3,.15,.15,2.7,'#685746');
    }
    // Decorative quay / boat silhouettes, not historical replicas.
    box(14,27,5.5,2.5,.6,['#6e4f3c','#654a39','#745342','#a27e58']);
    box(15,27,.35,1.5,5,['#d3bd95','#9c8f76','#9c8f76','#dbc89b']);
    for(let z of [9,20,32,43]) lamp(8.5,z);
    tree(-9,42);
  }
  function square(){
    paving();
    for(let x of [-20,20]){
      building(x,20,16,27,13,['#c7c4ad','#a7aaa0','#b1aa91','#abae9c']);
      building(x,47,16,20,14,['#c9c8bb','#a9b0a9','#b5b2a0','#c0bfaf']);
    }
    // Neoclassical church silhouette at the far end; not to scale.
    box(0,51,24,9,10,['#e9e9d9','#becac2','#c7d5d0','#d9ded1']);
    for(let x of [-8,-5,-2,1,4,7])box(x,45.5,.7,.7,10,['#efece2','#d8e1d8','#d8e1d8','#f6f3e6']);
    box(0,51,8,6,15,['#e0e3d6','#b1c3b8','#c0cac0','#e8ece5']);
    box(0,51,5.2,5.2,18,['#63867d','#3f6665','#3f6665','#65867e']);
    for(let i=0;i<4;i++)quad(v(-9+i*.8,.2+i*.2,43.0-i*.8),v(9-i*.8,.2+i*.2,43.0-i*.8),v(9-i*.8,.2+i*.2,45),v(-9+i*.8,.2+i*.2,45),'#c9c6b9');
    // Historical marker: artistic sculptural stand-in, not an accurate statue copy.
    box(0,23,2.4,2.4,2.6,['#777b73','#5b6964','#67716a','#81867b']);
    box(0,23,.7,.8,4.1,['#9c9f91','#777a6d','#8e8c7a','#a9a999']);
    for(let x of [-8,8]) for(let z of [12,33])lamp(x,z);
    tree(-10,11);tree(10,40);
  }
  function stadium(){
    paving();
    for(let z of [15,31]){
      for(let x of [-15,15])tree(x,z);
    }
    building(-19,40,11,27,10,['#c2c6b6','#9ca79c','#979e92','#cdd0bf']);
    building(19,40,11,27,10,['#c5c7b8','#aab0a4','#a2aa9d','#ded9cc']);
    // Stark off-white stadium tower silhouette
    box(-12,49,3.3,3.3,22,['#e4e1d3','#a9b2aa','#b8c2b4','#eeecdd']);
    box(-12,49,4.7,3.8,23,['#e8dfcc','#bbc4b6','#b7b6a6','#e3dfce']);
    box(-12,49,2.1,2.1,25,['#d9cba9','#a7b5aa','#acb8aa','#e8ddc1']);
    box(0,55,25,5,8,['#d7cfc0','#a2a99d','#a4ad9e','#d8d3c5']);
    box(0,55,18,5,10,['#dbd8c8','#b9bdb1','#b5bdad','#d5d4c8']);
    box(5,18,5,3,3,['#98846c','#7c7060','#8b7a6a','#b0a08c']);
    for(let x of [-8.5,8.5])for(let z of [13,28,41])lamp(x,z);
    quad(v(-9,.04,45),v(9,.04,45),v(9,.04,46),v(-9,.04,46),'#e0d9bf');
  }
  function buildGeometry(){
    geometry=[];
    [market,square,stadium][zoneIndex]();
  }
  function cameraPoint(p){
    const dx=p.x-cam.x,dz=p.z-cam.z, c=Math.cos(cam.yaw),s=Math.sin(cam.yaw);
    return {x:dx*c-dz*s,y:p.y-1.7,z:dx*s+dz*c};
  }
  function nearClip(points){
    let out=[]; const near=.16;
    for(let i=0;i<points.length;i++){
      const a=points[i], b=points[(i+1)%points.length];
      const ain=a.z>=near,bin=b.z>=near;
      if(ain)out.push(a);
      if(ain!==bin){const t=(near-a.z)/(b.z-a.z);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:near});}
    }
    return out;
  }
  function proj(p){return {x:width/2+p.x*focal/p.z,y:height*.485-p.y*focal/p.z,z:p.z};}
  function drawGeometry(){
    const drawables=[];
    for(const shape of geometry){
      const camera=shape.vertices.map(cameraPoint);
      if(camera.every(p=>p.z<.16))continue;
      const clipped=nearClip(camera);
      if(clipped.length<3)continue;
      const avg=camera.reduce((sum,p)=>sum+p.z,0)/camera.length;
      if(avg>155)continue;
      drawables.push({poly:clipped.map(proj),depth:avg,color:shape.color,outline:shape.outline});
    }
    drawables.sort((a,b)=>b.depth-a.depth);
    for(const shape of drawables){
      ctx.beginPath();ctx.moveTo(shape.poly[0].x,shape.poly[0].y);
      for(let i=1;i<shape.poly.length;i++)ctx.lineTo(shape.poly[i].x,shape.poly[i].y);
      ctx.closePath();ctx.fillStyle=shape.color;ctx.fill();
      if(shape.outline){ctx.strokeStyle=shape.outline;ctx.lineWidth=Math.max(.3,1.3/Math.max(1,shape.depth)*7);ctx.stroke();}
    }
  }
  function drawPerson(x,z,color){
    const p=cameraPoint(v(x,0,z)); if(p.z<.5)return;
    const foot=proj(p),head=proj({x:p.x,y:1.55-1.7,z:p.z});
    const h=foot.y-head.y;if(h<3 || h>height*3)return;
    ctx.strokeStyle='#374d50';ctx.lineWidth=Math.max(1,h*.075);
    ctx.beginPath();ctx.moveTo(foot.x-h*.09,foot.y);ctx.lineTo(foot.x,foot.y-h*.38);ctx.lineTo(foot.x+h*.09,foot.y);ctx.stroke();
    ctx.fillStyle=color;ctx.fillRect(foot.x-h*.15,head.y+h*.24,h*.3,h*.46);
    ctx.beginPath();ctx.arc(foot.x,head.y+h*.12,h*.11,0,Math.PI*2);ctx.fillStyle='#d7af8c';ctx.fill();
  }
  function sky(){
    const horizon=height*.48;
    const grad=ctx.createLinearGradient(0,0,0,horizon);
    grad.addColorStop(0,'#6d9fae');grad.addColorStop(.64,'#a9c3ba');grad.addColorStop(1,'#e5cbab');
    ctx.fillStyle=grad;ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#6c938a';ctx.fillRect(0,horizon,width,height-horizon);
    // Distant haze, deliberately stylised.
    const haze=ctx.createLinearGradient(0,horizon-15,0,horizon+110);
    haze.addColorStop(0,'#d8c7a2bb');haze.addColorStop(1,'#8a9c88aa');
    ctx.fillStyle=haze;ctx.fillRect(0,horizon-15,width,125);
  }
  function drawMarkers(){
    const points=ZONES[zoneIndex].points;
    hovered=null;
    for(const point of points){
      const a=cameraPoint(v(point.x,1.5,point.z));
      if(a.z<=.5)continue;
      const xy=proj(a);
      if(xy.x<-80||xy.x>width+80||xy.y<-80||xy.y>height+80)continue;
      const dist=Math.hypot(point.x-cam.x,point.z-cam.z);
      const size=clamp(focal/a.z*.18,11,32);
      ctx.beginPath();ctx.arc(xy.x,xy.y,size,0,Math.PI*2);
      ctx.fillStyle=dist<5?'#ffe8ad':'#152d2fe6';ctx.fill();ctx.strokeStyle='#ffe3a3';ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle=dist<5?'#20302c':'#ffe8ad';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${size*1.1}px Segoe UI`;ctx.fillText('+',xy.x,xy.y-1);
      ctx.textAlign='center';ctx.font=`600 ${Math.max(14,Math.min(19,size*.85))}px Segoe UI`;
      const txt=point.title;const textWidth=Math.min(width-20,ctx.measureText(txt).width+22);
      ctx.fillStyle='#102728e8';ctx.fillRect(xy.x-textWidth/2,xy.y-size-31,textWidth,25);
      ctx.fillStyle='#fff1d4';ctx.fillText(txt,xy.x,xy.y-size-18);
      if(!hovered || dist<hovered.dist)hovered={point,dist};
    }
  }
  function drawMini(){
    const w=minimap.width,h=minimap.height;
    mini.fillStyle='#142b2b';mini.fillRect(0,0,w,h);
    const left=26,top=14,sx=(w-52)/24,sz=(h-28)/46;
    const X=x=>w/2+x*sx,Z=z=>h-14-z*sz;
    mini.fillStyle='#8b8f80';mini.fillRect(X(-11),Z(46),22*sx,46*sz);
    mini.strokeStyle='#cfbe95';mini.strokeRect(X(-11),Z(46),22*sx,46*sz);
    if(zoneIndex===0){mini.fillStyle='#3e7e83';mini.fillRect(X(10.5),Z(46),9,46*sz);}
    for(const point of ZONES[zoneIndex].points){mini.beginPath();mini.arc(X(point.x),Z(point.z),5,0,Math.PI*2);mini.fillStyle='#f5d18a';mini.fill();}
    mini.translate(X(cam.x),Z(cam.z));mini.rotate(-cam.yaw);
    mini.fillStyle='#dcfae3';mini.beginPath();mini.moveTo(0,-11);mini.lineTo(-7,9);mini.lineTo(7,9);mini.closePath();mini.fill();
    mini.setTransform(1,0,0,1,0,0);
    mini.font='11px Segoe UI';mini.textAlign='left';mini.fillStyle='#fff3d1';mini.fillText('SUUNTAA ANTAVA',9,12);
  }
  function frame(timestamp){
    if(!running)return;
    const dt=last?Math.min((timestamp-last)/1000,.055):0;last=timestamp;
    if($('discovery').open)keys.clear();
    const down=k=>keys.has(k)||touch.has(k);
    const forward=Number(down('w')||down('ArrowUp'))-Number(down('s')||down('ArrowDown'));
    const strafe=Number(down('d'))-Number(down('a'));
    const turn=Number(down('ArrowRight')||down('turn-right'))-Number(down('ArrowLeft')||down('turn-left'));
    cam.yaw+=turn*1.65*dt;
    const speed=5.2*dt*(down('Shift')?1.6:1);
    const dx=Math.sin(cam.yaw)*forward+Math.cos(cam.yaw)*strafe;
    const dz=Math.cos(cam.yaw)*forward-Math.sin(cam.yaw)*strafe;
    const bounds=ZONES[zoneIndex].boundary;
    cam.x=clamp(cam.x+dx*speed,bounds.minX,bounds.maxX);
    cam.z=clamp(cam.z+dz*speed,bounds.minZ,bounds.maxZ);
    sky();drawGeometry();
    const people=zoneIndex===0?[[2,24,'#394650'],[5,38,'#937d65'],[-2,34,'#475e52']]:zoneIndex===1?[[-5,17,'#596352'],[6,27,'#827365']]:[[4,33,'#475d64'],[-2,25,'#ad845b']];
    for(const p of people.sort((a,b)=>Math.hypot(b[0]-cam.x,b[1]-cam.z)-Math.hypot(a[0]-cam.x,a[1]-cam.z)))drawPerson(...p);
    drawMarkers();drawMini();
    nearest=ZONES[zoneIndex].points.map((p,i)=>({point:p,index:i,dist:Math.hypot(cam.x-p.x,cam.z-p.z)})).sort((a,b)=>a.dist-b.dist)[0];
    const active=nearest && nearest.dist<=5;
    $('walk-interact').hidden=!active;
    if(active){$('walk-interact-label').textContent=nearest.point.title; $('walk-interact-help').textContent='Paina E tai avaa löytö tästä';}
    $('walk-position').textContent=`Koealueen sijainti: ${Math.round(cam.x)} / ${Math.round(cam.z)} · suunta ${Math.round(((cam.yaw*180/Math.PI)%360+360)%360)}°`;
    raf=requestAnimationFrame(frame);
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();if(!rect.width || !rect.height)return;
    const dpr=Math.min(1.5,window.devicePixelRatio||1);
    width=Math.round(rect.width*dpr);height=Math.round(rect.height*dpr);
    canvas.width=width;canvas.height=height;
    focal=height*.98;
    // normalize drawing to actual canvas backing resolution
  }
  function switchZone(i){
    if(i<0||i>=ZONES.length)return;
    zoneIndex=i;cam={...ZONES[i].start};
    buildGeometry();
    $('walk-title').textContent=ZONES[i].name;
    $('walk-subtitle').textContent=ZONES[i].subtitle;
    $('walk-interact').hidden=true;
    $('walk-prev').disabled=i===0;
    $('walk-next').disabled=i===ZONES.length-1;
    nearest=null;
    if(visible)resize();
  }
  function setMode(mode){
    visible=mode==='walk';
    $('walk-shell').hidden=!visible;
    $('scene').hidden=visible;
    $('walk-mode-btn').setAttribute('aria-pressed',String(visible));
    $('photo-mode-btn').setAttribute('aria-pressed',String(!visible));
    if(visible){resize();start();canvas.focus({preventScroll:true});}
    else stop();
  }
  function start(){if(running)return;running=true;last=0;resize();raf=requestAnimationFrame(frame);}
  function stop(){running=false;cancelAnimationFrame(raf);keys.clear();touch.clear();last=0;}
  function activate(){
    if(!nearest || nearest.dist>5)return;
    if(typeof window.timeJumpOpenFind==='function')window.timeJumpOpenFind(zoneIndex,nearest.index);
  }
  $('walk-interact-button').addEventListener('click',activate);
  $('walk-mode-btn').addEventListener('click',()=>setMode('walk'));
  $('photo-mode-btn').addEventListener('click',()=>setMode('photo'));
  $('walk-reset').addEventListener('click',()=>switchZone(zoneIndex));
  $('walk-prev').addEventListener('click',()=>window.timeJumpShowPlace?.(zoneIndex-1));
  $('walk-next').addEventListener('click',()=>window.timeJumpShowPlace?.(zoneIndex+1));
  $('walk-photo').addEventListener('click',()=>setMode('photo'));
  $('walk-mini').width=236;$('walk-mini').height=170;
  const allowKeys=new Set(['w','a','s','d','e','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift']);
  document.addEventListener('keydown',event=>{
    if(!visible || $('journey').hidden || $('discovery').open)return;
    const focus=document.activeElement;
    if(['INPUT','SELECT','TEXTAREA'].includes(focus?.tagName))return;
    const k=event.key.length===1?event.key.toLowerCase():event.key;
    if(!allowKeys.has(k))return;
    if(k==='e' && !event.repeat){activate(); event.preventDefault();return;}
    if(k!=='e'){keys.add(k);event.preventDefault();}
  });
  document.addEventListener('keyup',event=>keys.delete(event.key.length===1?event.key.toLowerCase():event.key));
  window.addEventListener('blur',()=>{keys.clear();touch.clear();});
  canvas.addEventListener('pointerdown',event=>{dragging=true;lastPointerX=event.clientX;canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!dragging)return;cam.yaw+=(event.clientX-lastPointerX)*.0065;lastPointerX=event.clientX;});
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(evt,()=>dragging=false);
  for(const b of document.querySelectorAll('[data-walk-hold]')){
    const key=b.getAttribute('data-walk-hold');
    b.addEventListener('pointerdown',e=>{e.preventDefault();touch.add(key);b.setPointerCapture(e.pointerId);});
    for(const evt of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(evt,()=>touch.delete(key));
  }
  canvas.addEventListener('click',event=>{
    if(!hovered || !nearest || nearest.dist>5)return;
    // E is the primary accessible action, pointer may select nearby landmark directly.
    activate();
  });
  window.addEventListener('resize',()=>{if(visible)resize();});
  window.TimeJumpWalk={switchZone,start:()=>setMode('walk'),stop,activate,setMode,getState:()=>({...cam,zoneIndex,running})};
  switchZone(0);
})();
