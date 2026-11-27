import * as T from './vendor/three.module.min.js';
import { archiveArchitecture } from './archive.js';

const v = (x,y,z) => new T.Vector3(x,y,z);
const material = color => new T.MeshStandardMaterial({color,roughness:.82});
const stone=material(0x77726a), trim=material(0xc4b8a2), glass=material(0x314649);
const quay=material(0x777871);
const wood=material(0x75543b), dark=material(0x372b24), metal=material(0x333e39);

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
function floor(scene,w,d,x,z,materials) {
  const map=materials.color.clone(), normalMap=materials.normal.clone();
  for(const tile of [map,normalMap]) {
    tile.wrapS=tile.wrapT=T.RepeatWrapping;
    tile.repeat.set(w/2,d/2);
    tile.anisotropy=8;
    tile.needsUpdate=true;
  }
  const mat=new T.MeshStandardMaterial({map,normalMap,normalScale:new T.Vector2(.53,.53),roughness:.91,color:0xbcc5cb});
  const item=mesh(scene,new T.PlaneGeometry(w,d),mat,x,.035,z);
  item.rotation.x=-Math.PI/2;item.castShadow=false;
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
    ctx.globalAlpha=.21;
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
export function buildMarket(scene,materials) {
  scene.background=new T.Color(0xa9c0ca);
  scene.fog=new T.FogExp2(0xa9c0ca,.006);
  scene.add(new T.HemisphereLight(0xdce5e8,0x9e978a,1.55));
  const sun=new T.DirectionalLight(0xffe9d0,2.0);
  sun.position.set(-27,32,24);
  sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-48,right:48,top:42,bottom:-42,far:120});
  sun.shadow.mapSize.set(1536,1536);sun.shadow.normalBias=.045;
  scene.add(sun);
  sky(scene);
  water(scene);
  box(scene,stone,36,-.48,-26,190,1,46);
  box(scene,stone,-35,-.48,9,49,1,24);
  floor(scene,190,46,36,-26,materials);
  floor(scene,49,24,-35,9,materials);
  for(let x=-59;x<=122;x+=1.13)box(scene,quay,x,.042,-3.12,1.1,.10,.47);
  for(let z=-3;z<=21;z+=1.13)box(scene,quay,-10.63,.042,z,.47,.10,1.1);
  for(const x of [-9,-1,9,19,31])cylinder(scene,metal,x,.16,-3.67,.12,.19,.34,12);
  archiveArchitecture(scene,materials.archive);
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
  const boats=[[-7.2,7.6,-.45,5.5],[-4.2,1,1.2,5.1],[2.1,.6,1.15,5.5],[8.2,1.8,1.3,4.9],[15.6,2.5,1.5,5.9],[-6.9,13.7,-.17,6.2],[23,6.5,1.45,7.3]];
  boats.forEach((boatSpec,index)=>boat(scene,...boatSpec,index));
  harbourLaunch(scene);
  for(const x of [-24,-2,21,42]){
    cylinder(scene,metal,x,2.2,-4.1,.057,.085,4.4);
    mesh(scene,new T.SphereGeometry(.22,12,8),trim,x,4.4,-4.1).scale.y=1.26;
  }
  flush();
}
