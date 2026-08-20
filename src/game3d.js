import * as THREE from 'three';
import { CAMPUS, LANDMARKS } from './config.js';
import { VEGETATION_PROFILE } from './vegetation.js';

const DEG = Math.PI / 180;
const METERS_LAT = 110574;
const METERS_LNG = 111320 * Math.cos(CAMPUS.spawn.lat * DEG);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lngLatToLocal = (lng, lat) => ({ x: (lng - CAMPUS.spawn.lng) * METERS_LNG, z: -(lat - CAMPUS.spawn.lat) * METERS_LAT });
const localToLngLat = (x, z) => ({ lng: CAMPUS.spawn.lng + x / METERS_LNG, lat: CAMPUS.spawn.lat - z / METERS_LAT });
const flatMat = (color, opts = {}) => new THREE.MeshBasicMaterial({
  color,
  side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
  vertexColors: !!opts.vertexColors,
  transparent: !!opts.transparent,
  opacity: opts.opacity ?? 1,
  depthWrite: opts.depthWrite ?? true,
  blending: opts.blending ?? THREE.NormalBlending,
  toneMapped: false
});
function hash01(n) { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453123; return x - Math.floor(x); }
function clusterOffset(p, i) {
  if (i === 0) return { x: 0, z: 0 };
  const id = (+p.id || 1) * 37 + i * 101;
  const angle = hash01(id) * Math.PI * 2;
  const r = Math.sqrt(hash01(id + 17)) * Math.max(2, +p.clusterSpreadM || 8);
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

class TerrariumHeightCache {
  constructor(template, bounds, zoom = 15) { this.template = template; this.bounds = bounds; this.zoom = zoom; this.n = 2 ** zoom; this.tiles = new Map(); this.fallback = 120; }
  tileFloat(lng, lat) {
    const x = (lng + 180) / 360 * this.n, rad = lat * DEG;
    const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * this.n;
    return { x, y };
  }
  key(x, y) { return `${x}:${y}`; }
  url(x, y) { return this.template.replace('{z}', this.zoom).replace('{x}', x).replace('{y}', y); }
  async decodeTile(x, y) {
    const key = this.key(x, y); if (this.tiles.has(key)) return this.tiles.get(key);
    try {
      const res = await fetch(this.url(x, y), { mode: 'cors', cache: 'force-cache' });
      if (!res.ok) throw new Error(`terrain ${res.status}`);
      const blob = await res.blob();
      const image = 'createImageBitmap' in window ? await createImageBitmap(blob) : await new Promise((resolve, reject) => {
        const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = reject; img.src = URL.createObjectURL(blob);
      });
      const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, 256, 256);
      const tile = { data: ctx.getImageData(0, 0, 256, 256).data }; this.tiles.set(key, tile); image.close?.(); return tile;
    } catch (err) { console.warn('Terrarium tile failed', x, y, err); this.tiles.set(key, null); return null; }
  }
  async preload(onProgress = () => {}) {
    const nw = this.tileFloat(this.bounds.west, this.bounds.north), se = this.tileFloat(this.bounds.east, this.bounds.south), jobs = [];
    for (let x = Math.floor(nw.x); x <= Math.floor(se.x); x++) for (let y = Math.floor(nw.y); y <= Math.floor(se.y); y++) jobs.push([x, y]);
    let done = 0;
    await Promise.all(jobs.map(async ([x, y]) => { await this.decodeTile(x, y); done++; onProgress(done / jobs.length, jobs.length); }));
    const spawn = this.elevation(CAMPUS.spawn.lng, CAMPUS.spawn.lat); if (Number.isFinite(spawn)) this.fallback = spawn;
  }
  elevation(lng, lat) {
    const f = this.tileFloat(lng, lat), x = Math.floor(f.x), y = Math.floor(f.y), tile = this.tiles.get(this.key(x, y));
    if (!tile) return this.fallback;
    const px = clamp(Math.floor((f.x - x) * 256), 0, 255), py = clamp(Math.floor((f.y - y) * 256), 0, 255), i = (py * 256 + px) * 4, d = tile.data;
    return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
  }
}

function makeCrossGeometry() {
  const p = new Float32Array([-.5,0,0,.5,0,0,.5,1,0,-.5,0,0,.5,1,0,-.5,1,0, 0,0,-.5,0,0,.5,0,1,.5,0,0,-.5,0,1,.5,0,1,-.5]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.computeBoundingSphere(); return g;
}
function makeInstanced(geometry, max, material) { const m = new THREE.InstancedMesh(geometry, material, max); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = true; m.userData.capacity = max; return m; }

function buildPistol() {
  const g = new THREE.Group();
  const metal = flatMat(0x24282b), grip = flatMat(0x171717), sight = flatMat(0x55585a);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(.09, .10, .30), metal); slide.position.z = -.11;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.085, .20, .10), grip); handle.position.set(0, -.12, .00); handle.rotation.x = -.22;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .16, 6), metal); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, -.015, -.29);
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(.018, .025, .035), sight); frontSight.position.set(0, .065, -.24);
  const flash = new THREE.Mesh(new THREE.ConeGeometry(.08, .24, 6), flatMat(0xffd36a, { transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending }));
  flash.rotation.x = -Math.PI / 2; flash.position.set(0, 0, -.46); flash.visible = false;
  g.add(slide, handle, barrel, frontSight, flash); g.userData.flash = flash; return g;
}
function buildJetpack() {
  const g = new THREE.Group(), metal = flatMat(0x4d5960), dark = flatMat(0x23282b), flameMat = flatMat(0xff8c32, { transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const x of [-.13, .13]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .42, 6), metal); tank.position.set(x, 0, .09); g.add(tank);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.035, .055, .08, 6), dark); nozzle.position.set(x, -.25, .09); g.add(nozzle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.055, .32, 6), flameMat); flame.position.set(x, -.46, .09); flame.rotation.z = Math.PI; flame.visible = false; g.add(flame);
    (g.userData.flames ??= []).push(flame);
  }
  return g;
}
function buildAgent() {
  const root = new THREE.Group(), skin = flatMat(0xd0a078), hair = flatMat(0xa88b5b), jacket = flatMat(0x66513b), dark = flatMat(0x332b26), pants = flatMat(0x303a43), boots = flatMat(0x151719), shirt = flatMat(0x192027);
  const box = (w,h,d,mat,x,y,z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); return m; };
  const limb = (x,y,mat) => { const pivot = new THREE.Group(); pivot.position.set(x,y,0); const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(.065,.56,2,5),mat); mesh.position.y=-.33; pivot.add(mesh); return pivot; };
  const ll=limb(-.105,.91,pants), rl=limb(.105,.91,pants), la=limb(-.28,1.42,jacket), ra=limb(.28,1.42,jacket); root.add(ll,rl,la,ra);
  root.add(box(.18,.13,.28,boots,-.105,.07,.05),box(.18,.13,.28,boots,.105,.07,.05),box(.44,.54,.24,jacket,0,1.20,0),box(.18,.36,.012,shirt,0,1.22,.128),box(.43,.07,.25,dark,0,.96,0));
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.15,1),skin);head.scale.set(.88,1.1,.93);head.position.y=1.68;root.add(head);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.153,7,4,0,Math.PI*2,0,Math.PI*.60),hair);hairCap.position.y=1.755;root.add(hairCap);
  const fringe=new THREE.Mesh(new THREE.ConeGeometry(.065,.18,4),hair);fringe.rotation.z=1.24;fringe.position.set(-.06,1.735,.115);root.add(fringe);
  const pistol = buildPistol(); pistol.position.set(0,-.67,-.15); pistol.rotation.set(-.02,0,0); ra.add(pistol);
  const jetpack = buildJetpack(); jetpack.position.set(0,1.28,.18); root.add(jetpack);
  root.userData.rig={ll,rl,la,ra,head,pistol,jetpack}; root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}}); return root;
}

function vegetationMeshes(capacity) {
  const trunkMat=flatMat(0x674d39), white=flatMat(0xffffff), trunk=makeInstanced(new THREE.CylinderGeometry(1,1,1,5),capacity.trees,trunkMat);
  const canopies={round:makeInstanced(new THREE.IcosahedronGeometry(.5,0),capacity.trees,white.clone()),umbrella:makeInstanced(new THREE.SphereGeometry(.5,6,3),capacity.trees,white.clone()),open:makeInstanced(new THREE.OctahedronGeometry(.5,0),capacity.trees,white.clone()),ceibo:makeInstanced(new THREE.IcosahedronGeometry(.5,0),capacity.trees,white.clone())};
  const cross=makeCrossGeometry();
  return { trunk, canopies, canopyMass:makeInstanced(new THREE.IcosahedronGeometry(.5,0),capacity.mass,white.clone()), shrub:makeInstanced(new THREE.IcosahedronGeometry(.5,0),capacity.shrubs,white.clone()), herb:makeInstanced(cross,capacity.herbs,flatMat(0xffffff,{double:true})), vine:makeInstanced(cross,capacity.vines,flatMat(0xffffff,{double:true})), epiphyte:makeInstanced(new THREE.OctahedronGeometry(.5,0),capacity.epiphytes,white.clone()) };
}
function treeColor(p,season){const c=new THREE.Color(+p.deciduous===1?(season>.52?0x477b47:0x77784a):(season>.52?0x315e40:0x4b6547));c.offsetHSL((+p.rand-.5)*.02,0,(+p.rand-.5)*.05);return c;}
function understoryColor(p,season){const wet=season>.5,c=new THREE.Color();if(p.habit==='shrub')c.set(wet?0x4c7146:0x6a7045);else if(p.habit==='vine')c.set(wet?0x397647:0x687243);else if(p.habit==='epiphyte')c.set(wet?0x57905a:0x66794a);else if(p.form==='cactus')c.set(0x60764f);else if(p.form==='fern')c.set(wet?0x397747:0x5c6d41);else c.set(wet?0x598b46:0x898049);return c;}
function makeSpatialGrid(features,cell=95){const grid=new Map();for(const f of features){const [lng,lat]=f.geometry.coordinates,p=lngLatToLocal(lng,lat);f.properties._x=p.x;f.properties._z=p.z;const k=`${Math.floor(p.x/cell)}:${Math.floor(p.z/cell)}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(f);}return {grid,cell};}
function queryGrid(index,x,z,r){const out=[],{grid,cell}=index,r2=r*r,minX=Math.floor((x-r)/cell),maxX=Math.floor((x+r)/cell),minZ=Math.floor((z-r)/cell),maxZ=Math.floor((z+r)/cell);for(let cx=minX;cx<=maxX;cx++)for(let cz=minZ;cz<=maxZ;cz++){const bucket=grid.get(`${cx}:${cz}`);if(!bucket)continue;for(const f of bucket){const p=f.properties,dx=x-p._x,dz=z-p._z,d2=dx*dx+dz*dz;if(d2<=r2)out.push([d2,f]);}}return out;}
function gridInsert(grid,cell,obj){const minX=Math.floor((obj.x-obj.hx)/cell),maxX=Math.floor((obj.x+obj.hx)/cell),minZ=Math.floor((obj.z-obj.hz)/cell),maxZ=Math.floor((obj.z+obj.hz)/cell);for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const k=`${x}:${z}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(obj);}}

class GameWorld {
  constructor(canvas,heightCache,forestData){
    this.canvas=canvas;this.heightCache=heightCache;this.originElev=heightCache.elevation(CAMPUS.spawn.lng,CAMPUS.spawn.lat);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',precision:'mediump'});this.renderer.setClearColor(0x89999b,1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(62,1,.08,7000);this.agent=buildAgent();this.scene.add(this.agent);
    this.terrainGroup=new THREE.Group();this.buildingGroup=new THREE.Group();this.roadGroup=new THREE.Group();this.scene.add(this.terrainGroup,this.roadGroup,this.buildingGroup);
    const base=VEGETATION_PROFILE.lod;this.base=base;this.capacity={trees:base.maxTrees,mass:base.maxCanopyMass,shrubs:base.maxShrubs,herbs:base.maxHerbs,vines:base.maxVines,epiphytes:base.maxEpiphytes};
    this.veg=vegetationMeshes(this.capacity);this.scene.add(this.veg.canopyMass,this.veg.trunk,...Object.values(this.veg.canopies),this.veg.shrub,this.veg.herb,this.veg.vine,this.veg.epiphyte);
    this.index=makeSpatialGrid(forestData.features,base.gridCellM||95);this.mode='follow';this.season=.25;this.treesEnabled=true;this.buildingsEnabled=true;this.terrainEnabled=true;
    this.tmpM=new THREE.Matrix4();this.tmpQ=new THREE.Quaternion();this.identityQ=new THREE.Quaternion();this.tmpP=new THREE.Vector3();this.tmpS=new THREE.Vector3();this.walkPhase=0;this.lastRefresh=0;this.lastVX=Infinity;this.lastVZ=Infinity;this.forceRefresh=true;
    this.buildingColliders=[];this.buildingGrid=new Map();this.buildingCellM=80;this.verticalOffset=0;this.verticalVelocity=0;this.spaceDown=false;this.jumpQueued=false;this.flashlightOn=true;this.shotTime=0;this.lastGameMode='';
    this.materials={terrain:null,building:null,road:null,vegetation:[this.veg.trunk.material,this.veg.canopyMass.material,...Object.values(this.veg.canopies).map(m=>m.material),this.veg.shrub.material,this.veg.herb.material,this.veg.vine.material,this.veg.epiphyte.material].map(m=>({m,base:m.color.clone()}))};
    const hc=navigator.hardwareConcurrency||8,mem=navigator.deviceMemory||8;this.hardwareFactor=hc<=4||mem<=4?.55:hc<=8?.78:1;this.dynamicFactor=this.hardwareFactor;
    this.perfTime=0;this.perfFrames=0;this.stats={fps:60,frameMs:16.7,drawCalls:0,triangles:0,chunks:0,vegetation:0,quality:this.dynamicFactor,colliders:0};this.cameraPos=new THREE.Vector3(NaN,NaN,NaN);
    this.buildTerrain();this.buildLake();this.buildFlashlight();this.bindModeInput();this.resize();window.addEventListener('resize',()=>this.resize());
  }
  bindModeInput(){
    window.addEventListener('keydown',e=>{if(e.code==='Space'){this.spaceDown=true;if(!e.repeat)this.jumpQueued=true;}if(e.code==='KeyF'&&this.currentGameMode()==='horror'){this.flashlightOn=!this.flashlightOn;}});
    window.addEventListener('keyup',e=>{if(e.code==='Space')this.spaceDown=false;});
    this.canvas.addEventListener('pointerdown',e=>{if(e.button===0&&this.currentGameMode()==='shooter'&&this.mode!=='map'){this.shotTime=.16;e.preventDefault();}});
  }
  currentGameMode(){return document.querySelector('#gameMode')?.value||'explore';}
  resize(){const w=Math.max(1,this.canvas.clientWidth||innerWidth),h=Math.max(1,this.canvas.clientHeight||innerHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();const ratio=Math.max(.52,Math.min(1,(window.devicePixelRatio||1)*this.dynamicFactor));this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h,false);}
  resetCamera(){this.cameraPos.set(NaN,NaN,NaN);}
  getElevation(lng,lat){return this.heightCache.elevation(lng,lat);}
  buildTerrain(){
    const west=(CAMPUS.bounds.west-CAMPUS.spawn.lng)*METERS_LNG,east=(CAMPUS.bounds.east-CAMPUS.spawn.lng)*METERS_LNG,north=-(CAMPUS.bounds.north-CAMPUS.spawn.lat)*METERS_LAT,south=-(CAMPUS.bounds.south-CAMPUS.spawn.lat)*METERS_LAT,cols=4,rows=3,seg=28;
    const mat=flatMat(0xffffff,{vertexColors:true});this.materials.terrain=mat;this.terrainChunks=[];
    for(let cx=0;cx<cols;cx++)for(let cz=0;cz<rows;cz++){
      const x0=west+(east-west)*cx/cols,x1=west+(east-west)*(cx+1)/cols,z0=north+(south-north)*cz/rows,z1=north+(south-north)*(cz+1)/rows,positions=[],colors=[],indices=[];
      for(let iz=0;iz<=seg;iz++)for(let ix=0;ix<=seg;ix++){const x=x0+(x1-x0)*ix/seg,z=z0+(z1-z0)*iz/seg,ll=localToLngLat(x,z),e=this.getElevation(ll.lng,ll.lat),y=e-this.originElev,academic=ll.lng>-79.9707&&ll.lng<-79.9575&&ll.lat>-2.1530&&ll.lat<-2.1395,c=new THREE.Color(academic?0x777b61:e>210?0x536445:e>155?0x5b6b49:0x63704b);positions.push(x,y,z);colors.push(c.r,c.g,c.b);}
      for(let iz=0;iz<seg;iz++)for(let ix=0;ix<seg;ix++){const a=iz*(seg+1)+ix,b=a+1,c=a+(seg+1),d=c+1;indices.push(a,c,b,b,c,d);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeBoundingSphere();const mesh=new THREE.Mesh(g,mat);mesh.userData.center=new THREE.Vector2((x0+x1)/2,(z0+z1)/2);this.terrainGroup.add(mesh);this.terrainChunks.push(mesh);
    }
  }
  buildLake(){const l=LANDMARKS.find(x=>x.id==='lake');if(!l)return;const p=lngLatToLocal(l.lng,l.lat),y=this.getElevation(l.lng,l.lat)-this.originElev+.18,mesh=new THREE.Mesh(new THREE.CircleGeometry(1,24),flatMat(0x557f86,{double:true}));mesh.rotation.x=-Math.PI/2;mesh.scale.set(115,72,1);mesh.position.set(p.x,y,p.z);this.scene.add(mesh);}
  buildFlashlight(){
    this.flashGroup=new THREE.Group();
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.18,4.6,20,12,1,true),flatMat(0xfff4c7,{transparent:true,opacity:.13,depthWrite:false,blending:THREE.AdditiveBlending}));
    beam.userData.axis=new THREE.Vector3(0,1,0);this.flashGroup.add(beam);this.flashBeam=beam;
    const pool=new THREE.Mesh(new THREE.CircleGeometry(3.3,18),flatMat(0xfff3bd,{transparent:true,opacity:.24,depthWrite:false,blending:THREE.AdditiveBlending,double:true}));pool.rotation.x=-Math.PI/2;this.scene.add(pool);this.flashPool=pool;this.scene.add(this.flashGroup);this.flashGroup.visible=false;pool.visible=false;
  }
  setStructures({buildings=[],roads=[]}={}){
    this.buildingGroup.clear();this.roadGroup.clear();this.buildingColliders=[];this.buildingGrid.clear();
    if(buildings.length){const mat=flatMat(0xbfc3bc);this.materials.building=mat;const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,buildings.length),q=new THREE.Quaternion();
      buildings.forEach((b,i)=>{const p=lngLatToLocal(b.lng,b.lat),h=clamp(b.height||7.5,2.5,55),w=Math.max(2,b.width||8),d=Math.max(2,b.depth||8),y=this.getElevation(b.lng,b.lat)-this.originElev+h/2;this.tmpP.set(p.x,y,p.z);this.tmpS.set(w,h,d);this.tmpM.compose(this.tmpP,q,this.tmpS);mesh.setMatrixAt(i,this.tmpM);
        const col={x:p.x,z:p.z,hx:w*.5,hz:d*.5,height:h};
        const containsSpawn=Math.abs(p.x)<col.hx+1.2&&Math.abs(p.z)<col.hz+1.2;
        if(!containsSpawn){this.buildingColliders.push(col);gridInsert(this.buildingGrid,this.buildingCellM,col);} });mesh.instanceMatrix.needsUpdate=true;this.buildingGroup.add(mesh);}
    if(roads.length){const mat=flatMat(0x686c69);this.materials.road=mat;const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,roads.length),axis=new THREE.Vector3(0,1,0);roads.forEach((r,i)=>{const a=lngLatToLocal(r.a[0],r.a[1]),b=lngLatToLocal(r.b[0],r.b[1]),dx=b.x-a.x,dz=b.z-a.z,len=Math.max(.5,Math.hypot(dx,dz)),lng=(r.a[0]+r.b[0])/2,lat=(r.a[1]+r.b[1])/2,y=this.getElevation(lng,lat)-this.originElev+.1,angle=Math.atan2(dx,dz);this.tmpP.set((a.x+b.x)/2,y,(a.z+b.z)/2);this.tmpS.set(r.width||3,.1,len);this.tmpQ.setFromAxisAngle(axis,angle);this.tmpM.compose(this.tmpP,this.tmpQ,this.tmpS);mesh.setMatrixAt(i,this.tmpM);});mesh.instanceMatrix.needsUpdate=true;this.roadGroup.add(mesh);}
    this.stats.colliders=this.buildingColliders.length;
  }
  setMode(mode){this.mode=mode;this.agent.visible=mode==='follow';this.forceRefresh=true;this.resetCamera();}
  setSeason(v){this.season=v;this.forceRefresh=true;}
  setTreesEnabled(v){this.treesEnabled=v;this.forceRefresh=true;}
  setBuildingsEnabled(v){this.buildingsEnabled=v;this.buildingGroup.visible=v;}
  setTerrainEnabled(v){this.terrainEnabled=v;this.terrainGroup.visible=v;}
  instance(mesh,index,x,y,z,sx,sy,sz,color,quat=this.identityQ){this.tmpP.set(x,y,z);this.tmpS.set(sx,sy,sz);this.tmpM.compose(this.tmpP,quat,this.tmpS);mesh.setMatrixAt(index,this.tmpM);if(color)mesh.setColorAt(index,color);}
  clearVegetation(){this.veg.canopyMass.count=this.veg.trunk.count=0;for(const m of Object.values(this.veg.canopies))m.count=0;this.veg.shrub.count=this.veg.herb.count=this.veg.vine.count=this.veg.epiphyte.count=0;this.stats.vegetation=0;}
  refreshVegetation(x,z,now){
    const moved=Math.hypot(x-this.lastVX,z-this.lastVZ),refreshMs=(this.base.refreshMs||620)/Math.max(.6,this.dynamicFactor),refreshMove=this.base.refreshMoveM||18;if(!this.forceRefresh&&now-this.lastRefresh<refreshMs&&moved<refreshMove)return;
    this.forceRefresh=false;this.lastRefresh=now;this.lastVX=x;this.lastVZ=z;if(!this.treesEnabled){this.clearVegetation();return;}
    const treeR=(this.base.treeRadiusM||105)*(0.76+0.24*this.dynamicFactor),underR=(this.base.understoryRadiusM||78)*(0.74+0.26*this.dynamicFactor),massR=(this.base.canopyMassRadiusM||620)*(0.82+0.18*this.dynamicFactor),rows=queryGrid(this.index,x,z,massR);
    const budget={tree:Math.max(260,Math.floor(this.capacity.trees*this.dynamicFactor)),mass:Math.max(180,Math.floor(this.capacity.mass*this.dynamicFactor)),shrub:Math.floor(this.capacity.shrubs*this.dynamicFactor),herb:Math.floor(this.capacity.herbs*this.dynamicFactor),vine:Math.floor(this.capacity.vines*this.dynamicFactor),epiphyte:Math.floor(this.capacity.epiphytes*this.dynamicFactor)};
    const under2=underR*underR,tree2=treeR*treeR,treeRows=[],under={shrub:[],herb:[],vine:[],epiphyte:[]};let massN=0;
    for(const [d2,f] of rows){const p=f.properties,h=p.habit||'tree';if(h==='tree'){if(d2<=tree2)treeRows.push([d2,f]);else if(massN<budget.mass){const y=this.getElevation(f.geometry.coordinates[0],f.geometry.coordinates[1])-this.originElev,hgt=Math.max(4,+p.height||7),can=Math.max(2,+p.canopyM||3),cl=Math.max(5,+p.clusterSize||10),scale=can*(1.7+Math.min(2.2,Math.sqrt(cl)*.32));this.instance(this.veg.canopyMass,massN++,p._x,y+hgt*.68,p._z,scale,scale*.48,scale,treeColor(p,this.season));}}else if(d2<=under2&&under[h]&&under[h].length<budget[h])under[h].push([d2,f]);}
    this.veg.canopyMass.count=massN;this.veg.canopyMass.instanceMatrix.needsUpdate=true;if(this.veg.canopyMass.instanceColor)this.veg.canopyMass.instanceColor.needsUpdate=true;
    let ti=0,ci={round:0,umbrella:0,open:0,ceibo:0};for(const [,f] of treeRows){const p=f.properties,[lng,lat]=f.geometry.coordinates,baseY=this.getElevation(lng,lat)-this.originElev,copies=Math.max(1,Math.min(+p.clusterSize||1,22));for(let j=0;j<copies&&ti<budget.tree;j++){const off=clusterOffset(p,j),jitter=.78+hash01((+p.id||1)*71+j*13)*.46,h=Math.max(2.5,(+p.height||7)*jitter),can=Math.max(1,(+p.canopyM||2.4)*(.82+hash01(j+(+p.id||1)*9)*.36)),tr=Math.max(.035,(+p.trunkRadiusM||.08)*(.72+hash01(j*5+(+p.id||1))*.55)),tx=p._x+off.x,tz=p._z+off.z;this.instance(this.veg.trunk,ti,tx,baseY+h*.34,tz,tr,h*.68,tr,null);const form=this.veg.canopies[p.form]?p.form:'round',mesh=this.veg.canopies[form],idx=ci[form]++,loss=this.season<.5&&+p.deciduous===1?.66+this.season*.38:1;let sx=can,sy=can*.85,sz=can;if(form==='umbrella'){sx*=1.2;sy*=.5;sz*=1.2}else if(form==='open'){sx*=.88;sy*=.72;sz*=.88}else if(form==='ceibo'){sx*=1.08;sy*=.72;sz*=1.08}this.instance(mesh,idx,tx,baseY+h*.74,tz,sx*loss,sy*loss,sz*loss,treeColor(p,this.season));ti++;}if(ti>=budget.tree)break;}
    this.veg.trunk.count=ti;this.veg.trunk.instanceMatrix.needsUpdate=true;for(const [k,m] of Object.entries(this.veg.canopies)){m.count=ci[k];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
    const fill=(list,mesh,habit)=>{let n=0,cap=Math.min(mesh.userData.capacity,budget[habit]);for(const [,f] of list){const p=f.properties,vis=+p.seasonalDry===1?1-.55*this.season:clamp((+p.dryPersistence||.45)+(1-(+p.dryPersistence||.45))*this.season,0,1);if((+p.rand||.5)>vis)continue;const [lng,lat]=f.geometry.coordinates,y=this.getElevation(lng,lat)-this.originElev,s=Math.max(.22,+p.scale||.6),copies=Math.min(+p.density||1,habit==='herb'?5:habit==='shrub'?3:2);for(let j=0;j<copies&&n<cap;j++){const a=(+p.rand||.5)*6.283+j*2.1,sp=habit==='herb'?1.35:.72,xx=p._x+Math.cos(a)*sp*j*.45,zz=p._z+Math.sin(a)*sp*j*.45;let sx=s,sy=s,sz=s;if(habit==='herb'){if(p.form==='grass'){sx=.22*s;sy=1.45*s;sz=.22*s}else if(p.form==='fern'){sx=1.15*s;sy=.72*s;sz=1.15*s}else if(p.form==='cactus'){sx=.35*s;sy=1.25*s;sz=.35*s}else{sx=.65*s;sy=.88*s;sz=.65*s}}else if(habit==='vine'){sx=.22*s;sy=2.1*s;sz=.22*s}else if(habit==='epiphyte'){sx=.4*s;sy=.28*s;sz=.4*s}else{sx=1.05*s;sy=.82*s;sz=1.05*s}this.instance(mesh,n++,xx,y+(habit==='epiphyte'?.8:0),zz,sx,sy,sz,understoryColor(p,this.season));}}mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;return n;};
    const s=fill(under.shrub,this.veg.shrub,'shrub'),h=fill(under.herb,this.veg.herb,'herb'),v=fill(under.vine,this.veg.vine,'vine'),e=fill(under.epiphyte,this.veg.epiphyte,'epiphyte');this.stats.vegetation=massN+ti+Object.values(ci).reduce((a,b)=>a+b,0)+s+h+v+e;
  }
  buildingCandidates(x,z){const cx=Math.floor(x/this.buildingCellM),cz=Math.floor(z/this.buildingCellM),out=[],seen=new Set();for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const bucket=this.buildingGrid.get(`${cx+dx}:${cz+dz}`);if(!bucket)continue;for(const b of bucket){if(seen.has(b))continue;seen.add(b);out.push(b);}}return out;}
  blockedBuilding(x,z,r){if(!this.buildingsEnabled)return false;for(const b of this.buildingCandidates(x,z)){if(this.verticalOffset>b.height+.6)continue;if(Math.abs(x-b.x)<b.hx+r&&Math.abs(z-b.z)<b.hz+r)return true;}return false;}
  blockedTree(x,z,r){if(!this.treesEnabled||this.verticalOffset>2.4)return false;for(const [,f] of queryGrid(this.index,x,z,14)){const p=f.properties;if((p.habit||'tree')!=='tree')continue;const copies=Math.max(1,Math.min(+p.clusterSize||1,22));for(let j=0;j<copies;j++){const o=clusterOffset(p,j),dx=x-(p._x+o.x),dz=z-(p._z+o.z),rr=r+Math.max(.11,+p.trunkRadiusM||.08);if(dx*dx+dz*dz<rr*rr)return true;}}return false;}
  blocked(x,z,r){return this.blockedBuilding(x,z,r)||this.blockedTree(x,z,r);}
  resolvePosition(fromLng,fromLat,toLng,toLat,radius=.38){
    const a=lngLatToLocal(fromLng,fromLat),b=lngLatToLocal(toLng,toLat);if(!this.blocked(b.x,b.z,radius))return {lng:toLng,lat:toLat,collided:false};
    const fromBlocked=this.blocked(a.x,a.z,radius);if(fromBlocked){const dx=b.x-a.x,dz=b.z-a.z;if(Math.abs(dx)+Math.abs(dz)>.0001)return {lng:toLng,lat:toLat,collided:true};}
    if(!this.blocked(b.x,a.z,radius))return {...localToLngLat(b.x,a.z),collided:true};if(!this.blocked(a.x,b.z,radius))return {...localToLngLat(a.x,b.z),collided:true};return {lng:fromLng,lat:fromLat,collided:true};
  }
  updateVertical(mode,dt){
    if(mode==='rpg'){
      if(this.spaceDown){this.verticalVelocity=Math.min(15,this.verticalVelocity+28*dt);this.jumpQueued=false;}else this.verticalVelocity-=11*dt;
      this.verticalOffset+=this.verticalVelocity*dt;this.verticalOffset=clamp(this.verticalOffset,0,70);if(this.verticalOffset<=0&&this.verticalVelocity<0)this.verticalVelocity=0;
    }else{
      if(this.jumpQueued&&this.verticalOffset<=.02){this.verticalVelocity=6.3;this.jumpQueued=false;}else if(this.jumpQueued)this.jumpQueued=false;
      this.verticalVelocity-=17*dt;this.verticalOffset+=this.verticalVelocity*dt;if(this.verticalOffset<=0){this.verticalOffset=0;if(this.verticalVelocity<0)this.verticalVelocity=0;}
    }
  }
  applyGameModeVisuals(mode){
    if(this.lastGameMode===mode)return;this.lastGameMode=mode;const horror=mode==='horror',factor=horror?.18:1;
    this.renderer.setClearColor(horror?0x05090b:0x89999b,1);if(this.materials.terrain)this.materials.terrain.color.setScalar(factor);if(this.materials.building)this.materials.building.color.set(horror?0x25292a:0xbfc3bc);if(this.materials.road)this.materials.road.color.set(horror?0x16191a:0x686c69);for(const v of this.materials.vegetation)v.m.color.copy(v.base).multiplyScalar(factor);
    this.agent.userData.rig.pistol.visible=mode==='shooter';this.agent.userData.rig.jetpack.visible=mode==='rpg';this.flashGroup.visible=horror&&this.flashlightOn;this.flashPool.visible=horror&&this.flashlightOn;this.forceRefresh=true;
  }
  updateFlashlight(playerY,forward,right,mode){
    const on=mode==='horror'&&this.flashlightOn;this.flashGroup.visible=on;this.flashPool.visible=on;if(!on)return;
    const origin=this.camera.position.clone(),dir=forward.clone().add(new THREE.Vector3(0,-.18,0)).normalize(),mid=origin.clone().addScaledVector(dir,10);this.flashBeam.position.copy(mid);this.flashBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);this.flashPool.position.copy(origin.clone().addScaledVector(dir,18));this.flashPool.position.y=Math.max(playerY+.03,this.flashPool.position.y);
  }
  animateAgent(mode,player,dt){
    const rig=this.agent.userData.rig,speedNorm=clamp(player.speedMps/19.5,0,1);if(player.speedMps>.1)this.walkPhase+=dt*(8+Math.min(10,player.speedMps*.55));const swing=Math.sin(this.walkPhase)*.65*speedNorm;
    rig.ll.rotation.x=swing;rig.rl.rotation.x=-swing;
    if(mode==='shooter'){const recoil=this.shotTime>0?Math.sin((this.shotTime/.16)*Math.PI)*.28:0;rig.ra.rotation.x=-1.33+recoil;rig.ra.rotation.z=-.08;rig.la.rotation.x=-1.12;rig.la.rotation.z=.25;rig.pistol.userData.flash.visible=this.shotTime>.10;}
    else{rig.la.rotation.x=-swing*.7;rig.ra.rotation.x=swing*.7;rig.la.rotation.z=rig.ra.rotation.z=0;rig.pistol.userData.flash.visible=false;}
    const flames=rig.jetpack.userData.flames||[];for(const f of flames)f.visible=mode==='rpg'&&this.spaceDown;this.shotTime=Math.max(0,this.shotTime-dt);
  }
  adaptPerformance(dt){this.perfTime+=dt;this.perfFrames++;if(this.perfTime<2.2)return;const fps=this.perfFrames/this.perfTime;this.stats.fps=fps;this.stats.frameMs=1000/Math.max(1,fps);let next=this.dynamicFactor;if(fps<42)next-=.12;else if(fps<50)next-=.06;else if(fps>58&&next<this.hardwareFactor)next+=.05;next=clamp(next,.42,this.hardwareFactor);if(Math.abs(next-this.dynamicFactor)>.02){this.dynamicFactor=next;this.stats.quality=next;this.forceRefresh=true;this.resize();}this.perfTime=0;this.perfFrames=0;}
  render(player,state,dt,now){
    const gameMode=this.currentGameMode();this.applyGameModeVisuals(gameMode);this.updateVertical(gameMode,dt);this.setSeason(state.season);if(this.treesEnabled!==state.treesEnabled)this.setTreesEnabled(state.treesEnabled);this.buildingGroup.visible=state.buildingsEnabled;this.terrainGroup.visible=state.terrainEnabled;
    const p=lngLatToLocal(player.lng,player.lat),ground=this.getElevation(player.lng,player.lat)-this.originElev,y=ground+this.verticalOffset,forward=new THREE.Vector3(Math.sin(player.bearing*DEG),0,-Math.cos(player.bearing*DEG)),right=new THREE.Vector3(Math.cos(player.bearing*DEG),0,Math.sin(player.bearing*DEG));
    this.agent.position.set(p.x,y+.03,p.z);this.agent.rotation.y=-player.bearing*DEG;this.agent.visible=this.mode==='follow';this.animateAgent(gameMode,player,dt);
    if(this.mode==='firstperson'){
      this.camera.position.set(p.x,y+CAMPUS.eyeHeightM,p.z);const pitch=(state.pitchLook||0)*DEG,target=this.camera.position.clone().add(forward.clone().multiplyScalar(Math.cos(pitch)*25)).add(new THREE.Vector3(0,Math.sin(pitch)*25,0));this.camera.lookAt(target);
    }else{
      const aiming=gameMode==='shooter',back=aiming?3.15:4.35,shoulder=aiming?1.05:1.22,height=aiming?2.05:2.20;
      const desired=new THREE.Vector3(p.x,y+height,p.z).addScaledVector(forward,-back).addScaledVector(right,shoulder);const alpha=1-Math.exp(-12*dt);if(!Number.isFinite(this.cameraPos.x))this.cameraPos.copy(desired);else this.cameraPos.lerp(desired,alpha);this.camera.position.copy(this.cameraPos);const target=new THREE.Vector3(p.x,y+1.48,p.z).addScaledVector(forward,aiming?10:5.5).addScaledVector(right,.08);this.camera.lookAt(target);
    }
    this.updateFlashlight(y,forward,right,gameMode);this.refreshVegetation(p.x,p.z,now);let active=0;for(const ch of this.terrainChunks){const c=ch.userData.center,d=Math.hypot(p.x-c.x,p.z-c.y);ch.visible=this.terrainEnabled&&d<3300;if(ch.visible)active++;}this.stats.chunks=active;this.resize();this.renderer.render(this.scene,this.camera);this.stats.drawCalls=this.renderer.info.render.calls;this.stats.triangles=this.renderer.info.render.triangles;this.adaptPerformance(dt);
  }
  getStats(){return {...this.stats};}
}

export async function createGameWorld({canvas,forestData,terrainUrl,onProgress=()=>{}}){const cache=new TerrariumHeightCache(terrainUrl,CAMPUS.bounds,15);await cache.preload((p,total)=>onProgress(p,total));return new GameWorld(canvas,cache,forestData);}
