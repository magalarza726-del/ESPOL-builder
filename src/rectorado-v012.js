import * as THREE from 'three';
import { CAMPUS, LANDMARKS } from './config.js';
import { installRectoradoDetail } from './rectorado-detail.js';

const DEG = Math.PI / 180;
const METERS_LAT = 110574;
const METERS_LNG = 111320 * Math.cos(CAMPUS.spawn.lat * DEG);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lngLatToLocal = (lng, lat) => ({
  x: (lng - CAMPUS.spawn.lng) * METERS_LNG,
  z: -(lat - CAMPUS.spawn.lat) * METERS_LAT
});

function polygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}
function distanceM(aLng, aLat, bLng, bLat) {
  const dx = (aLng - bLng) * 111320 * Math.cos(((aLat + bLat) * .5) * DEG);
  const dz = (aLat - bLat) * METERS_LAT;
  return Math.hypot(dx, dz);
}
function localOuter(record) {
  const poly = polygons(record?.geometry)[0];
  const ring = poly?.[0] || [];
  const trimmed = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]
    ? ring.slice(0, -1) : ring;
  return trimmed.map(c => lngLatToLocal(c[0], c[1]));
}
function principalDimensions(points) {
  if (points.length < 3) return { width: 58, depth: 28 };
  let ex = { x: 1, z: 0 }, longest = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len > longest) { longest = len; ex = { x: dx / len, z: dz / len }; }
  }
  const ez = { x: -ex.z, z: ex.x };
  const cx = points.reduce((s,p)=>s+p.x,0)/points.length;
  const cz = points.reduce((s,p)=>s+p.z,0)/points.length;
  let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
  for (const p of points) {
    const dx=p.x-cx,dz=p.z-cz;
    const u=dx*ex.x+dz*ex.z,v=dx*ez.x+dz*ez.z;
    minU=Math.min(minU,u);maxU=Math.max(maxU,u);minV=Math.min(minV,v);maxV=Math.max(maxV,v);
  }
  let width=maxU-minU,depth=maxV-minV;
  if (depth>width) [width,depth]=[depth,width];
  return { width: clamp(width,46,88), depth: clamp(depth,20,42) };
}
function mat(color, transparent=false, opacity=1) {
  return new THREE.MeshBasicMaterial({ color, transparent, opacity, toneMapped:false });
}
function box(group, material, x,y,z,sx,sy,sz,ry=0) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);
  m.position.set(x,y,z);m.rotation.y=ry;group.add(m);return m;
}
function sphere(group, material, x,y,z,sx,sy,sz,detail=8) {
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,detail,Math.max(5,detail>>1)),material);
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);group.add(m);return m;
}
function cylinder(group, material, x,y,z,r,h,radial=8) {
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,radial),material);
  m.position.set(x,y,z);group.add(m);return m;
}
function addMullions(group,width,frontZ,bodyHeight,dark) {
  const count=17;
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,1,.09),dark,count);
  const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion();
  for(let i=0;i<count;i++){
    const x=-width*.36+i*(width*.72/(count-1));
    pos.set(x,3.0,frontZ+.43);scale.set(1,5.0,1);matrix.compose(pos,q,scale);mesh.setMatrixAt(i,matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;group.add(mesh);
  for(const y of [1.55,3.05,4.55]) box(group,dark,0,y,frontZ+.44,width*.72,.09,.09);

  // Narrow upper office ribbon visible across the right half of the facade.
  box(group,dark,width*.12,bodyHeight-1.23,frontZ+.42,width*.46,.07,.10);
  for(let i=0;i<12;i++){
    const x=-width*.10+i*(width*.44/11);
    box(group,dark,x,bodyHeight-1.2,frontZ+.43,.08,1.02,.08);
  }
}
function addEntranceDoors(group,width,depth,glass,dark,ivory) {
  const z=depth/2+.50;
  box(group,dark,-width*.04,1.50,z,9.2,3.0,.12);
  box(group,glass,-width*.04,1.50,z+.03,8.6,2.72,.08);
  for(const x of [-width*.04-3.2,-width*.04-1.05,-width*.04+1.05,-width*.04+3.2]){
    box(group,ivory,x,1.50,z+.09,.15,2.9,.16);
  }
  box(group,ivory,-width*.04,3.08,z+.06,9.7,.22,.48);
}
function addSlopedClerestory(group,width,depth,bodyHeight,roof,glass,ivory) {
  const w=width*.48,d=depth*.34,y=bodyHeight+1.25,z=-depth*.08;
  // Low trapezoidal skylight/clerestory cap seen in the supplied photos.
  const shape=new THREE.Shape();
  shape.moveTo(-w/2,0);shape.lineTo(-w*.40,.72);shape.lineTo(w*.40,.72);shape.lineTo(w/2,0);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1});
  g.rotateY(Math.PI/2);g.translate(-d/2,y,z+w/2);
  const m=new THREE.Mesh(g,roof);group.add(m);
  box(group,glass,0,bodyHeight+.48,z+depth*.17+.16,w*.84,.72,.08);
  box(group,ivory,0,bodyHeight+.86,z+depth*.17+.13,w*.90,.10,.13);
}
function addDriveAndCurbs(group,width,depth,road,curb,walk) {
  box(group,walk,0,.025,depth/2+4.7,width*.76,.05,5.2);
  const ring=new THREE.Mesh(new THREE.RingGeometry(12.5,18.5,40,1,0,Math.PI),road);
  ring.rotation.x=-Math.PI/2;ring.rotation.z=Math.PI;ring.position.set(0,.035,depth/2+11.5);group.add(ring);
  const curbOuter=new THREE.Mesh(new THREE.RingGeometry(18.5,19.05,40,1,0,Math.PI),curb);
  curbOuter.rotation.x=-Math.PI/2;curbOuter.rotation.z=Math.PI;curbOuter.position.copy(ring.position);curbOuter.position.y=.055;group.add(curbOuter);
  const curbInner=new THREE.Mesh(new THREE.RingGeometry(11.95,12.5,40,1,0,Math.PI),curb);
  curbInner.rotation.x=-Math.PI/2;curbInner.rotation.z=Math.PI;curbInner.position.copy(ring.position);curbInner.position.y=.055;group.add(curbInner);
}
function addFlowerDetail(group,width,depth,green,red,orange) {
  const count=72;
  const stem=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.045,.42,4),green,count);
  const bloom=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.16,0),red,count);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1);
  for(let i=0;i<count;i++){
    const t=i/(count-1),x=-width*.31+t*width*.62,z=depth/2+1.55+Math.sin(i*2.41)*.23;
    pos.set(x,.38,z);matrix.compose(pos,q,scale);stem.setMatrixAt(i,matrix);
    pos.set(x,.72,z);matrix.compose(pos,q,new THREE.Vector3(.8+(i%3)*.12,.8,.8));bloom.setMatrixAt(i,matrix);
    if(i%5===0) bloom.setColorAt(i,new THREE.Color(orange.color));
  }
  stem.instanceMatrix.needsUpdate=true;bloom.instanceMatrix.needsUpdate=true;if(bloom.instanceColor)bloom.instanceColor.needsUpdate=true;
  stem.frustumCulled=bloom.frustumCulled=false;group.add(stem,bloom);
}
function addMonumentSteps(group,width,depth,dark,stone) {
  const x=width*.18,z=depth/2+11.2;
  for(let i=0;i<3;i++) box(group,dark,x,0.11+i*.10,z+1.75+i*.35,4.8-i*.42,.22,1.1);
  box(group,stone,x,5.10,z+.02,2.05,.14,1.10);
}
function addTurtleScutes(group,width,depth,dark) {
  const x=-width*.10,z=depth/2+9.1;
  for(const [dx,dz,sx,sz] of [[0,0,.72,.52],[-.78,.18,.52,.40],[.78,.18,.52,.40],[0,-.72,.54,.38]]) {
    sphere(group,dark,x+dx,1.62,z+dz,sx,.08,sz,7);
  }
}
function addMastBracing(group,width,depth,red) {
  const x=width*.18,z=-depth*.28,base=9.4;
  for(let i=0;i<7;i++){
    const y=base+i*1.45;
    const a=box(group,red,x,y,z,.055,1.6,1.05);a.rotation.z=.68;
    const b=box(group,red,x,y,z,.055,1.6,1.05);b.rotation.z=-.68;
  }
}

export function installRectoradoV012(world, records=[]) {
  installRectoradoDetail(world, records);
  const group=world?.rectoradoDetail;
  const landmark=LANDMARKS.find(x=>x.id==='rectorado');
  if(!group||!landmark||group.userData.v012Enhanced) return;
  group.userData.v012Enhanced=true;

  let record=null,best=Infinity;
  for(const candidate of records){
    const d=distanceM(candidate.lng,candidate.lat,landmark.lng,landmark.lat);
    if(d<best&&d<75){best=d;record=candidate;}
  }
  const {width,depth}=principalDimensions(localOuter(record));
  const bodyHeight=clamp(Math.max(record?.height||7.4,8.4),8.4,11.5);
  const frontZ=depth/2+.08;

  const ivory=mat(0xe4e0d4),glass=mat(0x273942,true,.94),dark=mat(0x263138);
  const roof=mat(0xb8c1c1),road=mat(0x595f61),curb=mat(0xe9e7dc),walk=mat(0xb6b5ac);
  const green=mat(0x355a35),red=mat(0xc84b34),orange=mat(0xe27a32),mast=mat(0x91332f),stone=mat(0x3a4144);

  addMullions(group,width,frontZ,bodyHeight,dark);
  addEntranceDoors(group,width,depth,glass,dark,ivory);
  addSlopedClerestory(group,width,depth,bodyHeight,roof,glass,ivory);
  addDriveAndCurbs(group,width,depth,road,curb,walk);
  addFlowerDetail(group,width,depth,green,red,orange);
  addMonumentSteps(group,width,depth,dark,stone);
  addTurtleScutes(group,width,depth,dark);
  addMastBracing(group,width,depth,mast);

  // Side-office window ribbon and parapet, visible in the right-hand reference.
  box(group,glass,width*.40,4.15,depth*.31+.10,width*.145,1.15,.08);
  for(let i=0;i<7;i++) box(group,ivory,width*.34+i*width*.018,4.15,depth*.31+.15,.10,1.28,.12);
  box(group,ivory,width*.40,6.15,-depth*.04,width*.19,.32,depth*.76);

  // Entrance landing and shallow steps across the public face.
  box(group,walk,-width*.04,.10,depth/2+1.05,12.0,.20,2.0);
  box(group,curb,-width*.04,.20,depth/2+1.70,10.8,.18,.62);

  group.traverse(obj=>{ if(obj.isMesh){obj.castShadow=false;obj.receiveShadow=false;} });
  world.forceRefresh=true;
}
