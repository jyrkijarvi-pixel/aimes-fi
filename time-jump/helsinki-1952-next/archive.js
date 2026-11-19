import * as T from './vendor/three.module.min.js';

// The color photograph frames the projection. The distances are estimates
// from the basin layout, not measured camera or building survey data.
export const archiveSize={width:1200,height:793};
export const reference={x:-11.65,z:15.5,yaw:.52,pitch:-.161,height:1.66,fov:54};

// Silhouettes traced against Kajantie's photograph, in source image pixels.
// Crop above the market crowd so people and cars do not become wall textures.
const panels=[
  {z:-34, outline:[[0,126],[70,129],[139,142],[167,156],[235,142],[307,151],[383,153],[459,156],[509,167],[565,181],[566,286],[0,275]]},
  {z:-37, outline:[[567,203],[613,199],[645,187],[694,188],[721,184],[771,199],[779,208],[780,284],[565,285]]},
  {z:-42, outline:[[781,173],[831,175],[879,170],[945,179],[1019,184],[1040,190],[1040,283],[779,282]]},
  {z:-45, outline:[[1041,200],[1095,202],[1136,201],[1148,202],[1200,192],[1200,278],[1041,278]]},
  {z:-50, outline:[[0,42],[11,48],[30,54],[46,70],[53,88],[55,111],[53,132],[0,128]]},
  {z:-33, outline:[[165,248],[319,249],[325,279],[163,277]]}
];

export function archiveArchitecture(scene,photo) {
  const camera=new T.PerspectiveCamera(reference.fov,archiveSize.width/archiveSize.height,.08,180);
  camera.position.set(reference.x,reference.height,reference.z);
  camera.rotation.set(reference.pitch,-reference.yaw,0,'YXZ');
  camera.updateMatrixWorld();

  const surface=new T.MeshBasicMaterial({map:photo,side:T.DoubleSide,toneMapped:false,fog:false});
  const plinth=new T.MeshStandardMaterial({color:0x66635a,roughness:.95,side:T.DoubleSide});
  // Keep the photographic perspective correct across triangles, even when
  // the visitor moves away from the source camera.
  surface.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec3 archiveUV; varying vec3 photoUV;')
      .replace('#include <uv_vertex>','#include <uv_vertex>\nphotoUV = archiveUV;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 photoUV;')
      .replace('#include <map_fragment>','diffuseColor *= texture2D(map, photoUV.xy / photoUV.z);');
  };
  for (const {z,outline} of panels) {
    const vertices=[],uv=[];
    for (const [x,y] of outline) {
      const u=x/archiveSize.width, v=1-y/archiveSize.height;
      const ray=new T.Vector3(u*2-1,v*2-1,.5).unproject(camera).sub(camera.position);
      const point=ray.multiplyScalar((z-camera.position.z)/ray.z).add(camera.position);
      const depth=-point.clone().applyMatrix4(camera.matrixWorldInverse).z;
      vertices.push(point.x,point.y,point.z);
      uv.push(u*depth,v*depth,depth);
    }
    const triangles=T.ShapeUtils.triangulateShape(outline.map(([x,y])=>new T.Vector2(x,y)),[]).flat();
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('archiveUV',new T.Float32BufferAttribute(uv,3));
    geometry.setIndex(triangles);
    scene.add(new T.Mesh(geometry,surface));
    if(z>=-45&&z!==-33) {
      const [rx,ry,rz,lx,ly,lz]=vertices.slice(-6);
      const base=new T.BufferGeometry();
      base.setAttribute('position',new T.Float32BufferAttribute([
        rx,ry,rz,lx,ly,lz,lx,0,lz,rx,0,rz
      ],3));
      base.setIndex([0,1,2,0,2,3]);
      base.computeVertexNormals();
      const wall=new T.Mesh(base,plinth);
      wall.receiveShadow=true;
      scene.add(wall);
    }
  }
}
