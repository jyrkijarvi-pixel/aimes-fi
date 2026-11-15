import * as T from './vendor/three.module.min.js';

const v = (x,y,z) => new T.Vector3(x,y,z);
const material = color => new T.MeshStandardMaterial({color,roughness:.82});
const stone=material(0x77726a), trim=material(0xc4b8a2), glass=material(0x314649);
const wood=material(0x75543b), dark=material(0x372b24), metal=material(0x333e39);
let plasterMap;
const boxGeometry=new T.BoxGeometry();
const batches=new Map();
function box(parent,mat,x,y,z,w,h,d) {
  const object=new T.Object3D();
  object.position.set(x,y,z);
  object.scale.set(w,h,d);
  object.updateMatrix();
  if (!batches.has(parent)) batches.set(parent,new Map());
  const group=batches.get(parent);
  if (!group.has(mat)) group.set(mat,[]);
  group.get(mat).push(object.matrix);
}
function flush() {
  for (const [parent,group] of batches) for (const [mat,matrices] of group) {
    const mesh=new T.InstancedMesh(boxGeometry,mat,matrices.length);
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
    mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh);
  }
  batches.clear();
}
function mesh(parent,geometry,mat,x,y,z) {
  const item=new T.Mesh(geometry,mat);
  item.position.set(x,y,z); item.castShadow=true; item.receiveShadow=true; parent.add(item);
  return item;
}
function cylinder(parent,mat,x,y,z,top,bottom,height,sides=12) {
  return mesh(parent,new T.CylinderGeometry(top,bottom,height,sides),mat,x,y,z);
}
let seed=32529;
function random() {
  seed=(1664525*seed+1013904223)>>>0;
  return seed/4294967296;
}
function texture(draw) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=512;
  draw(canvas.getContext('2d'));
  const img=new T.CanvasTexture(canvas);
  img.colorSpace=T.SRGBColorSpace;
  img.wrapS=img.wrapT=T.RepeatWrapping;
  img.anisotropy=4;
  return img;
}
function cobbles() {
  return texture(ctx=>{
    ctx.fillStyle='#494744';ctx.fillRect(0,0,512,512);
    for(let row=-1;row<=16;row++) for(let col=-1;col<=16;col++) {
      const x=col*32+(row%2)*16, y=row*32;
      const value=Math.round(90+random()*41);
      ctx.fillStyle='rgb('+value+','+(value-4)+','+(value-10)+')';
      ctx.beginPath();ctx.roundRect(x+1,y+1,30,30,4);ctx.fill();
      ctx.strokeStyle='#d4cbb454';ctx.beginPath();ctx.moveTo(x+4,y+4);ctx.lineTo(x+28,y+4);ctx.stroke();
    }
    for(let i=0;i<22000;i++){
      ctx.fillStyle=random()<.45?'#eee1d220':'#1a150c23';
      ctx.fillRect(random()*512,random()*512,1+random()*3,1+random()*2);
    }
  });
}
function floor(scene,w,d,x,z) {
  const mat=new T.MeshStandardMaterial({map:cobbles(),roughness:.93});
  mat.map.repeat.set(w/4,d/4);
  const item=mesh(scene,new T.PlaneGeometry(w,d),mat,x,.035,z);
  item.rotation.x=-Math.PI/2; item.castShadow=false;
}
function roof(parent,mat,w,d,rise,y) {
  const points=[-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2,-w*.42,rise,0,w*.42,rise,0];
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(points,3));
  g.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0]);
  g.computeVertexNormals();
  return mesh(parent,g,mat,0,y,0);
}
function triangle(parent,mat,w,h,x,y,z) {
  const shape=new T.Shape();
  shape.moveTo(-w/2,0); shape.lineTo(w/2,0);shape.lineTo(0,h);shape.closePath();
  mesh(parent,new T.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false}),mat,x,y,z);
}
function facade(scene,{x,z,w,d,h,stories,bays,color,civic=false}) {
  const group=new T.Group();group.position.set(x,0,z);scene.add(group);
  const plaster=material(color), slate=material(0x3e555b);
  plaster.map=plasterMap;
  const front=d/2;
  box(group,plaster,0,h/2,0,w,h,d);
  box(group,stone,0,.42,front+.04,w+.13,.84,.22);
  box(group,trim,0,h-.14,front+.14,w+.3,.42,.38);
  box(group,plaster,0,h-.62,front+.11,w,.25,.24);
  roof(group,slate,w+.5,d+.45,w*.063,h);
  const spacing=w/(bays+1), level=(h-1.55)/stories;
  for(let row=0;row<stories;row++) {
    const y=.9+(row+.5)*level;
    for(let column=1;column<=bays;column++) {
      const px=column*spacing-w/2;
      const width=Math.min(1.36,spacing*.59), height=level*(row===0?.63:.58);
      box(group,trim,px,y,front+.09,width+.22,height+.23,.20);
      box(group,glass,px,y,front+.21,width,height,.055);
      box(group,trim,px,y,front+.26,.07,height,.07);
      box(group,trim,px,y+.12,front+.26,width,.055,.07);
      box(group,trim,px,y-height/2-.06,front+.20,width+.37,.11,.32);
    }
    if(row===0 || civic) box(group,trim,0,.94+(row+1)*level,front+.12,w,.15,.26);
  }
  for(const cx of [-w/2+.22,w/2-.22]) {
    for(let y=1.05;y<h-.6;y+=.58) box(group,trim,cx,y,front+.13,.4,.4,.21);
  }
  for(let cx=-w*.39;cx<w*.44;cx+=w*.18) box(group,slate,cx,h+1,.9,.45,1.5,.55);
  if(civic) {
    const portico=w*.38;
    box(group,trim,0,h-.69,front+.71,portico+.7,.44,1.45);
    triangle(group,trim,portico+.8,1.8,0,h-.47,front+.46);
    box(group,trim,0,h-1.2,front+.66,portico+.46,.24,1.32);
    box(group,stone,0,.24,front+.78,portico+.72,.48,1.55);
    for(let i=0;i<6;i++) {
      const px=portico*(i/5-.5);
      cylinder(group,trim,px,(h-.85)/2,front+1,.22,.29,h-1.3,14);
      box(group,trim,px,h-1.4,front+1,.65,.34,.64);
      box(group,trim,px,.62,front+1,.65,.25,.66);
    }
    box(group,metal,0,1.45,front+.24,1.9,2.8,.15);
  }
}
function canopy(group,w,d,color) {
  const cloth=material(color), pale=material(0xd9c797);
  cloth.side=pale.side=T.DoubleSide;
  const stripe=w/10;
  for(let i=0;i<10;i++) {
    const left=-w/2+i*stripe;
    const right=left+stripe;
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute([
      left,2.25,-d/2,right,2.25,-d/2,left,2.75,0,right,2.75,0,left,2.25,d/2,right,2.25,d/2
    ],3));
    g.setIndex([0,2,1,1,2,3,2,4,3,3,4,5]);g.computeVertexNormals();
    mesh(group,g,i%3===1?pale:cloth,0,0,0);
    box(group,i%3===1?pale:cloth,left+stripe/2,2.14,d/2,stripe,.26,.06);
  }
}
const fruit=[0x8b442e,0xaa753b,0x586541,0xab904e].map(material);
function stall(scene,x,z,color) {
  const group=new T.Group();group.position.set(x,0,z);scene.add(group);
  const w=3.9,d=2.65;
  canopy(group,w,d,color);
  for(const sx of [-1,1])for(const sz of [-1,1])box(group,wood,sx*1.81,1.12,sz*1.22,.093,2.27,.095);
  box(group,wood,0,.91,.74,3.27,.14,1.04);
  for(const x of [-1.42,1.42])box(group,dark,x,.45,.75,.12,.85,.8);
  for(let i=0;i<4;i++) {
    const x=(i-1.5)*.73;
    box(group,wood,x,1.05,.75,.63,.18,.55);
    for(let n=0;n<8;n++) mesh(group,new T.IcosahedronGeometry(.066+random()*.026,1),fruit[i],x+(random()-.5)*.51,1.18,.75+(random()-.5)*.4);
  }
}
const hullColors=[material(0x563f31),material(0x714a34),material(0x38332b),material(0x80593d)];
function boat(scene,x,z,yaw,length,index) {
  const group=new T.Group();group.position.set(x,-.38,z);group.rotation.y=yaw;scene.add(group);
  const width=length*.25;
  const levels=[[0,.45],[.32,1]];
  const g=new T.BufferGeometry(), pos=[], indices=[];
  for(const [height,scale] of levels) for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2;
    pos.push(Math.sin(a)*width/2*scale*(.88-.16*Math.cos(a)),height,Math.cos(a)*length/2);
  }
  for(let i=0;i<32;i++){const n=(i+1)%32; indices.push(i,n,32+i,n,32+n,32+i);}
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();
  const mat=hullColors[index%hullColors.length];mat.side=T.DoubleSide;
  mesh(group,g,mat,0,0,0);
  const ring=Array.from({length:32},(_,i)=>{const a=i/32*Math.PI*2;return v(Math.sin(a)*width/2*(.88-.16*Math.cos(a)),.33,Math.cos(a)*length/2);});
  mesh(group,new T.TubeGeometry(new T.CatmullRomCurve3(ring,true),32,.035,5,true),wood,0,0,0);
  box(group,dark,0,.03,0,width*.49,.055,length*.71);
  for(const z of [-.22,0,.21])box(group,wood,0,.23,length*z,width*.78,.067,.24);
}
function human(scene,x,z,height,coat,yaw,skirt=false) {
  const root=new T.Group();root.position.set(x,0,z);root.rotation.y=yaw;root.scale.setScalar(height/1.73);scene.add(root);
  const skin=material(0xb88765), clothing=material(coat);
  for(const side of [-1,1]) {
    cylinder(root,dark,side*.1,.36,0,.082,.058,.67,8);
    mesh(root,new T.SphereGeometry(.103,10,7),metal,side*.1,.081,.054).scale.set(.72,.48,1.54);
    const arm=cylinder(root,clothing,side*.224,1.05,0,.062,.056,.45,9);
    arm.rotation.z=side*.16;
    mesh(root,new T.SphereGeometry(.055,9,6),skin,side*.254,.806,0);
  }
  cylinder(root,clothing,0,1.05,0,.22,skirt?.28:.17,.65,12).scale.z=.58;
  mesh(root,new T.SphereGeometry(.122,12,9),skin,0,1.49,0).scale.set(.79,1,.84);
  cylinder(root,dark,0,1.58,0,.086,.12,.09,12);
  cylinder(root,dark,0,1.55,0,.14,.14,.024,14);
}
function car(scene,x,z) {
  const g=new T.Group();g.position.set(x,0,z);scene.add(g);
  const paint=material(0x394944), rubber=material(0x241f1b);
  const body=mesh(g,new T.SphereGeometry(1,22,12),paint,0,.6,0);body.scale.set(2.15,.56,.83);
  const cabin=mesh(g,new T.SphereGeometry(1,22,12),paint,-.25,1.05,0);cabin.scale.set(1.11,.54,.69);
  for(const side of [-1,1]){
    const window=mesh(g,new T.SphereGeometry(1,14,8),glass,-.25,1.17,side*.51);
    window.scale.set(.81,.25,.15);
    box(g,paint,-.26,1.16,side*.65,.07,.47,.045);
    for(const x of [-1.22,1.32]) {
      const wheel=cylinder(g,rubber,x,.38,side*.72,.37,.37,.18,18);wheel.rotation.x=Math.PI/2;
      const cap=cylinder(g,trim,x,.38,side*.83,.17,.17,.055,14);cap.rotation.x=Math.PI/2;
    }
    const lamp=mesh(g,new T.SphereGeometry(.12,12,8),trim,1.86,.65,side*.51);lamp.scale.x=.55;
  }
  box(g,trim,1.9,.39,0,.24,.10,1.47);
}
function water(scene) {
  const geometry=new T.PlaneGeometry(240,180,96,72);
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i);
    positions.setZ(i,.075*Math.sin(x*2.1+y*.55)+.055*Math.sin(y*3.4-x*.33));
  }
  geometry.computeVertexNormals();
  const map=texture(ctx=>{
    ctx.fillStyle='#526d75';ctx.fillRect(0,0,512,512);
    ctx.globalAlpha=.3;
    for(let i=0;i<2900;i++){
      ctx.strokeStyle=random()>.52?'#b6cbca':'#233c48';
      const x=random()*512,y=random()*512;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+8,y-1,x+16+random()*28,y+1);ctx.stroke();
    }
  });
  map.repeat.set(24,17);
  const item=mesh(scene,geometry,new T.MeshStandardMaterial({map,color:0xadc1c5,roughness:.32,metalness:.13}),0,-.64,66);
  item.rotation.x=-Math.PI/2;item.castShadow=false;
}
function sky(scene) {
  const geometry=new T.SphereGeometry(150,24,16);
  const mat=new T.ShaderMaterial({
    side:T.BackSide, depthWrite:false,
    vertexShader:`
      varying vec3 direction;
      void main() {
        direction = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader:`
      varying vec3 direction;
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p);
        f=f*f*(3.0-2.0*f);
        vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),
          dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+vec2(1),vec2(127.1,311.7))))*43758.54);
        return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
      }
      void main() {
        vec3 d=normalize(direction);
        float h=max(d.y,0.0);
        vec3 color=mix(vec3(.71,.78,.78),vec3(.30,.52,.68),pow(h,.55));
        vec2 p=d.xz/max(.09,d.y+.2)*4.0;
        float n=noise(p)*.64+noise(p*2.13)*.25+noise(p*4.5)*.11;
        float clouds=smoothstep(.46,.82,n)*smoothstep(.01,.20,h);
        gl_FragColor=vec4(mix(color,vec3(.91,.90,.84),clouds*.66),1.0);
      }`
  });
  const dome=new T.Mesh(geometry,mat);
  dome.renderOrder=-1;
  scene.add(dome);
}
function harbourLaunch(scene) {
  const group=new T.Group();
  group.position.set(25,-.55,15);scene.add(group);
  const cream=material(0xdad1b4);
  const hull=mesh(group,new T.SphereGeometry(1,28,12),dark,0,.24,0);
  hull.scale.set(4.5,.53,1.06);
  box(group,cream,0,.65,0,7.2,.36,1.61);
  box(group,cream,-.5,1.35,0,4.5,1.18,1.43);
  box(group,cream,-.5,1.99,0,4.67,.17,1.58);
  for(const side of [-1,1]) for(let i=0;i<6;i++) box(group,glass,-2.24+i*.68,1.53,side*.725,.51,.43,.036);
  cylinder(group,metal,-1.73,2.21,0,.089,.104,.45);
}
export function buildMarket(scene) {
  scene.background=new T.Color(0xa9c0ca);
  scene.fog=new T.FogExp2(0xa9c0ca,.006);
  scene.add(new T.HemisphereLight(0xdce5e8,0xa28a66,2.0));
  const sun=new T.DirectionalLight(0xffe0af,2.6);
  sun.position.set(-28,43,21);
  sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-48,right:48,top:42,bottom:-42,far:120});
  sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.035;
  scene.add(sun);
  sky(scene);
  plasterMap=texture(ctx=>{
    ctx.fillStyle='#f7f1e4';ctx.fillRect(0,0,512,512);
    for(let i=0;i<16000;i++){
      ctx.fillStyle=random()>.5?'#75675420':'#b5a99027';
      ctx.fillRect(random()*512,random()*512,1+random()*6,1+random()*4);
    }
  });
  water(scene);
  box(scene,stone,4,-.48,-13,122,1,36);
  box(scene,stone,-35,-.48,13,49,1,16);
  floor(scene,122,36,4,-13);floor(scene,49,16,-35,13);
  for(let x=-59;x<=62;x+=1.13)box(scene,trim,x,.042,4.89,1.1,.10,.47);
  for(let z=5;z<=21;z+=1.13)box(scene,trim,-10.63,.042,z,.47,.10,1.1);
  for(const x of [-9,-1,9,19,31])cylinder(scene,metal,x,.16,4.06,.12,.19,.34,12);
  facade(scene,{x:-46,z:-32,w:22,d:13,h:13,stories:3,bays:6,color:0xbaba9a});
  facade(scene,{x:-11,z:-33,w:48,d:14,h:14.5,stories:3,bays:15,color:0xa8bbb9,civic:true});
  facade(scene,{x:25,z:-33,w:22,d:13,h:12.6,stories:3,bays:7,color:0xcfb997});
  facade(scene,{x:47,z:-34,w:21,d:14,h:14.5,stories:4,bays:8,color:0xb1a18f});
  facade(scene,{x:66,z:-34,w:15,d:14,h:12.9,stories:3,bays:5,color:0xd1bd9b});
  const dome=material(0x638477);
  cylinder(scene,trim,-31,17,-43,2.22,2.33,4.4,18);
  const crown=mesh(scene,new T.SphereGeometry(2.38,24,12,0,Math.PI*2,0,Math.PI/2),dome,-31,19.2,-43);
  crown.scale.y=.83;
  cylinder(scene,metal,-31,21.65,-43,.025,.16,1.0,9);
  box(scene,metal,-31,21.98,-43,.51,.06,.07);
  box(scene,stone,14,.23,-12,1.7,.45,1.7);
  box(scene,trim,14,.7,-12,1.24,.58,1.24);
  const obelisk=cylinder(scene,material(0xad978b),14,2.45,-12,.21,.42,2.95,4);obelisk.rotation.y=Math.PI/4;
  mesh(scene,new T.OctahedronGeometry(.25),metal,14,4.09,-12).scale.set(1.55,.75,.83);
  const stallColors=[0x944b3d,0x76634b,0x7b836d,0xa5744b,0x6c7370];
  for(let i=0;i<11;i++){
    const x=-24+i*5.9;
    if(i!==6)stall(scene,x,-8+(i%2)*.28,stallColors[i%5]);
  }
  for(let i=0;i<5;i++)stall(scene,-22+i*6.1,-16.4,stallColors[(i+2)%5]);
  const boats=[[-7.4,9,-.45,5.5],[-3,7.4,1.2,5.1],[3.3,7.6,1.15,5.5],[8.5,8.4,1.3,4.9],[15.6,8.6,1.5,5.9],[-6.9,15.6,-.14,6.2],[23,11,1.45,7.3]];
  boats.forEach((boatSpec,index)=>boat(scene,...boatSpec,index));
  harbourLaunch(scene);
  for(const [x,z] of [[-17,-10],[-9,-5],[1,-11],[8,-6],[20,-13],[29,-5],[-12,-1],[-25,7],[-28,1],[6,-18],[-25,-13],[33,-12]]) {
    const coats=[0x5a5142,0x4b5059,0x877960,0x777d6e,0x5b3e38];
    human(scene,x,z,1.55+random()*.25,coats[Math.floor(random()*coats.length)],random()*5,random()>.67);
  }
  car(scene,22,-21.8);
  for(const x of [-24,-2,21,42]){
    cylinder(scene,metal,x,2.2,-4.1,.057,.085,4.4);
    mesh(scene,new T.SphereGeometry(.22,12,8),trim,x,4.4,-4.1).scale.y=1.26;
  }
  flush();
}
