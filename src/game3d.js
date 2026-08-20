import * as THREE from 'three';
import { CAMPUS } from './config.js';
import { VEGETATION_PROFILE } from './vegetation.js';

const DEG=Math.PI/180;
const METERS_LAT=110574;
const METERS_LNG=111320*Math.cos(CAMPUS.spawn.lat*DEG);

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function lngLatToLocal(lng,lat){return {x:(lng-CAMPUS.spawn.lng)*METERS_LNG,z:-(lat-CAMPUS.spawn.lat)*METERS_LAT}}
function localToLngLat(x,z){return {lng:CAMPUS.spawn.lng+x/METERS_LNG,lat:CAMPUS.spawn.lat-z/METERS_LAT}}
function flatMat(color,{double=false,vertexColors=false}={}){return new THREE.MeshBasicMaterial({color,side:double?THREE.DoubleSide:THREE.FrontSide,vertexColors,toneMapped:false})}

class TerrariumHeightCache{
  constructor(template,bounds,zoom=15){this.template=template;this.bounds=bounds;this.zoom=zoom;this.n=2**zoom;this.tiles=new Map();this.fallback=120}
  tileFloat(lng,lat){
    const x=(lng+180)/360*this.n,rad=lat*DEG;
    const y=(1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*this.n;
    return {x,y};
  }
  key(x,y){return `${x}:${y}`}
  url(x,y){return this.template.replace('{z}',this.zoom).replace('{x}',x).replace('{y}',y)}
  async decodeTile(x,y){
    const key=this.key(x,y);if(this.tiles.has(key))return this.tiles.get(key);
    try{
      const res=await fetch(this.url(x,y),{mode:'cors',cache:'force-cache'});if(!res.ok)throw new Error(`terrain ${res.status}`);
      const blob=await res.blob();let image;
      if('createImageBitmap' in window)image=await createImageBitmap(blob);
      else image=await new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=reject;img.src=URL.createObjectURL(blob)});
      const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(256,256):Object.assign(document.createElement('canvas'),{width:256,height:256});
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,256,256);const data=ctx.getImageData(0,0,256,256).data;
      const tile={data};this.tiles.set(key,tile);if(image.close)image.close();return tile;
    }catch(err){console.warn('Terrarium tile failed',x,y,err);this.tiles.set(key,null);return null}
  }
  async preload(onProgress=()=>{}){
    const nw=this.tileFloat(this.bounds.west,this.bounds.north),se=this.tileFloat(this.bounds.east,this.bounds.south);
    const minX=Math.floor(nw.x),maxX=Math.floor(se.x),minY=Math.floor(nw.y),maxY=Math.floor(se.y),jobs=[];
    for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)jobs.push([x,y]);
    let done=0;await Promise.all(jobs.map(async([x,y])=>{await this.decodeTile(x,y);done++;onProgress(done/jobs.length,jobs.length)}));
    const spawn=this.elevation(CAMPUS.spawn.lng,CAMPUS.spawn.lat);if(Number.isFinite(spawn))this.fallback=spawn;
  }
  elevation(lng,lat){
    const f=this.tileFloat(lng,lat),x=Math.floor(f.x),y=Math.floor(f.y),tile=this.tiles.get(this.key(x,y));if(!tile)return this.fallback;
    const px=clamp(Math.floor((f.x-x)*256),0,255),py=clamp(Math.floor((f.y-y)*256),0,255),i=(py*256+px)*4,d=tile.data;
    return d[i]*256+d[i+1]+d[i+2]/256-32768;
  }
}

function makeCrossGeometry(){
  const p=new Float32Array([-.5,0,0,.5,0,0,.5,1,0,-.5,0,0,.5,1,0,-.5,1,0,0,0,-.5,0,0,.5,0,1,.5,0,0,-.5,0,1,.5,0,1,-.5]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.computeBoundingSphere();return g;
}
function makeInstanced(geometry,max,material){const m=new THREE.InstancedMesh(geometry,material,max);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.count=0;m.frustumCulled=true;return m}

function buildAgent(){
  const root=new THREE.Group();
  const skin=flatMat(0xd0a078),hair=flatMat(0xa88b5b),jacket=flatMat(0x66513b),dark=flatMat(0x332b26),pants=flatMat(0x303a43),boots=flatMat(0x151719),shirt=flatMat(0x192027);
  const box=(w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return m};
  const limb=(x,y,mat)=>{const pivot=new THREE.Group();pivot.position.set(x,y,0);const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(.065,.56,2,5),mat);mesh.position.y=-.33;pivot.add(mesh);return pivot};
  const ll=limb(-.105,.91,pants),rl=limb(.105,.91,pants),la=limb(-.28,1.42,jacket),ra=limb(.28,1.42,jacket);root.add(ll,rl,la,ra);
  root.add(box(.18,.13,.28,boots,-.105,.07,.05),box(.18,.13,.28,boots,.105,.07,.05),box(.44,.54,.24,jacket,0,1.20,0),box(.18,.36,.012,shirt,0,1.22,.128),box(.43,.07,.25,dark,0,.96,0));
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.15,1),skin);head.scale.set(.88,1.1,.93);head.position.y=1.68;root.add(head);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.153,7,4,0,Math.PI*2,0,Math.PI*.60),hair);hairCap.position.y=1.755;root.add(hairCap);
  const fringe=new THREE.Mesh(new THREE.ConeGeometry(.065,.18,4),hair);fringe.rotation.z=1.24;fringe.position.set(-.06,1.735,.115);root.add(fringe);
  root.userData.rig={ll,rl,la,ra,head};root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});return root;
}

function vegetationMeshes(capacity){
  const trunk=makeInstanced(new THREE.CylinderGeometry(1,1,1,5),capacity.trees,flatMat(0x674d39));
  const white=flatMat(0xffffff),canopies={round:makeInstanced(new THREE.IcosahedronGeometry(.5,0),capacity.trees,white.clone()),umbrella:makeInstanced(new THREE.SphereGeometry(.5,6,3),capacity.trees,white.clone()),open:makeInstanced(new THREE.OctahedronGeometry(.5,0),capacity.trees,white.clone()),ceibo:makeInstanced(new THREE.IcosahedronGeometry(.5,0),capacity.trees,white.clone())};
  const cross=makeCrossGeometry();return {trunk,canopies,shrub:makeInstanced(new THREE.IcosahedronGeometry(.5,0),capacity.shrubs,white.clone()),herb:makeInstanced(cross,capacity.herbs,flatMat(0xffffff,{double:true})),vine:makeInstanced(cross,capacity.vines,flatMat(0xffffff,{double:true})),epiphyte:makeInstanced(new THREE.OctahedronGeometry(.5,0),capacity.epiphytes,white.clone())};
}
function treeColor(p,season){const c=new THREE.Color(+p.deciduous===1?(season>.52?0x477b47:0x77784a):(season>.52?0x315e40:0x4b6547));c.offsetHSL((+p.rand-.5)*.02,0,(+p.rand-.5)*.05);return c}
function understoryColor(p,season){const wet=season>.5,c=new THREE.Color();if(p.habit==='shrub')c.set(wet?0x4c7146:0x6a7045);else if(p.habit==='vine')c.set(wet?0x397647:0x687243);else if(p.habit==='epiphyte')c.set(wet?0x57905a:0x66794a);else if(p.form==='cactus')c.set(0x60764f);else if(p.form==='fern')c.set(wet?0x397747:0x5c6d41);else c.set(wet?0x598b46:0x898049);return c}

function makeSpatialGrid(features,cell=150){const grid=new Map();for(const f of features){const [lng,lat]=f.geometry.coordinates,p=lngLatToLocal(lng,lat);f.properties._x=p.x;f.properties._z=p.z;const k=`${Math.floor(p.x/cell)}:${Math.floor(p.z/cell)}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(f)}return {grid,cell}}
function queryGrid(index,x,z,r){const out=[],{grid,cell}=index,r2=r*r,minX=Math.floor((x-r)/cell),maxX=Math.floor((x+r)/cell),minZ=Math.floor((z-r)/cell),maxZ=Math.floor((z+r)/cell);for(let cx=minX;cx<=maxX;cx++)for(let cz=minZ;cz<=maxZ;cz++){const bucket=grid.get(`${cx}:${cz}`);if(!bucket)continue;for(const f of bucket){const p=f.properties,dx=x-p._x,dz=z-p._z,d2=dx*dx+dz*dz;if(d2<=r2)out.push([d2,f])}}return out}

function terrainColor(lng,lat,elev){
  const academic=lng>-79.9707&&lng<-79.9575&&lat>-2.1530&&lat<-2.1395;
  if(academic)return new THREE.Color(0x88886a);
  if(elev>210)return new THREE.Color(0x5b6748);
  if(elev>155)return new THREE.Color(0x64704d);
  return new THREE.Color(0x6f744f);
}

class GameWorld{
  constructor(canvas,heightCache,forestData){
    this.canvas=canvas;this.heightCache=heightCache;this.originElev=heightCache.elevation(CAMPUS.spawn.lng,CAMPUS.spawn.lat);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',precision:'mediump'});this.renderer.setClearColor(0x9db2b5,1);this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(66,1,.08,7000);this.agent=buildAgent();this.scene.add(this.agent);
    this.terrainGroup=new THREE.Group();this.scene.add(this.terrainGroup);this.structureGroup=new THREE.Group();this.scene.add(this.structureGroup);
    const base=VEGETATION_PROFILE.lod;this.base=base;this.capacity={trees:Math.max(180,base.maxTrees||160),shrubs:Math.max(200,base.maxShrubs||180),herbs:Math.max(260,base.maxHerbs||240),vines:Math.max(90,base.maxVines||72),epiphytes:Math.max(40,base.maxEpiphytes||32)};
    this.veg=vegetationMeshes(this.capacity);this.scene.add(this.veg.trunk,...Object.values(this.veg.canopies),this.veg.shrub,this.veg.herb,this.veg.vine,this.veg.epiphyte);
    this.index=makeSpatialGrid(forestData.features,150);this.mode='follow';this.season=.25;this.treesEnabled=true;this.buildingsEnabled=true;this.terrainEnabled=true;
    this.tmpM=new THREE.Matrix4();this.tmpQ=new THREE.Quaternion();this.tmpP=new THREE.Vector3();this.tmpS=new THREE.Vector3();this.walkPhase=0;this.lastRefresh=0;this.lastVX=Infinity;this.lastVZ=Infinity;this.forceRefresh=true;
    const hc=navigator.hardwareConcurrency||8,mem=navigator.deviceMemory||8;this.hardwareFactor=hc<=4||mem<=4?.55:hc<=8?.78:1;this.dynamicFactor=this.hardwareFactor;
    this.perfTime=0;this.perfFrames=0;this.lastFps=60;this.stats={fps:60,frameMs:16.7,drawCalls:0,triangles:0,chunks:0,vegetation:0,quality:this.dynamicFactor};
    this.cameraPos=new THREE.Vector3();this.resize();window.addEventListener('resize',()=>this.resize());this.buildTerrain();
  }
  resize(){const w=Math.max(1,this.canvas.clientWidth||innerWidth),h=Math.max(1,this.canvas.clientHeight||innerHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();const ratio=Math.max(.55,Math.min(1,(window.devicePixelRatio||1)*this.dynamicFactor));this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h,false)}
  getElevation(lng,lat){return this.heightCache.elevation(lng,lat)}
  localHeight(x,z){const ll=localToLngLat(x,z);return this.getElevation(ll.lng,ll.lat)-this.originElev}
  buildTerrain(){
    const west=(CAMPUS.bounds.west-CAMPUS.spawn.lng)*METERS_LNG,east=(CAMPUS.bounds.east-CAMPUS.spawn.lng)*METERS_LNG,north=-(CAMPUS.bounds.north-CAMPUS.spawn.lat)*METERS_LAT,south=-(CAMPUS.bounds.south-CAMPUS.spawn.lat)*METERS_LAT;
    const cols=4,rows=3,seg=28,mat=flatMat(0xffffff,{vertexColors:true});this.terrainChunks=[];
    for(let cx=0;cx<cols;cx++)for(let cz=0;cz<rows;cz++){
      const x0=west+(east-west)*cx/cols,x1=west+(east-west)*(cx+1)/cols,z0=north+(south-north)*cz/rows,z1=north+(south-north)*(cz+1)/rows;
      const positions=[],colors=[],indices=[];
      for(let iz=0;iz<=seg;iz++)for(let ix=0;ix<=seg;ix++){
        const x=x0+(x1-x0)*ix/seg,z=z0+(z1-z0)*iz/seg,ll=localToLngLat(x,z),e=this.getElevation(ll.lng,ll.lat),y=e-this.originElev,c=terrainColor(ll.lng,ll.lat,e);positions.push(x,y,z);colors.push(c.r,c.g,c.b);
      }
      for(let iz=0;iz<seg;iz++)for(let ix=0;ix<seg;ix++){const a=iz*(seg+1)+ix,b=a+1,c=a+(seg+1),d=c+1;indices.push(a,c,b,b,c,d)}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeBoundingSphere();
      const mesh=new THREE.Mesh(g,mat);mesh.frustumCulled=true;mesh.userData.center=new THREE.Vector2((x0+x1)/2,(z0+z1)/2);this.terrainGroup.add(mesh);this.terrainChunks.push(mesh);
    }
  }
  setStructures({buildings=[],roads=[]}={}){
    this.structureGroup.clear();
    if(buildings.length){const geom=new THREE.BoxGeometry(1,1,1),mesh=new THREE.InstancedMesh(geom,flatMat(0xbfc3bc),buildings.length);mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);const q=new THREE.Quaternion();buildings.forEach((b,i)=>{const p=lngLatToLocal(b.lng,b.lat),h=clamp(b.height||7.5,2.5,55),y=this.getElevation(b.lng,b.lat)-this.originElev+h/2;this.tmpP.set(p.x,y,p.z);this.tmpS.set(Math.max(2,b.width||8),h,Math.max(2,b.depth||8));this.tmpM.compose(this.tmpP,q,this.tmpS);mesh.setMatrixAt(i,this.tmpM)});mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=true;mesh.name='buildings';this.structureGroup.add(mesh)}
    if(roads.length){const geom=new THREE.BoxGeometry(1,1,1),mesh=new THREE.InstancedMesh(geom,flatMat(0x6f7270),roads.length);mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);roads.forEach((r,i)=>{const a=lngLatToLocal(r.a[0],r.a[1]),b=lngLatToLocal(r.b[0],r.b[1]),dx=b.x-a.x,dz=b.z-a.z,len=Math.max(.5,Math.hypot(dx,dz)),lng=(r.a[0]+r.b[0])/2,lat=(r.a[1]+r.b[1])/2,y=this.getElevation(lng,lat)-this.originElev+.08,angle=Math.atan2(dx,dz);this.tmpP.set((a.x+b.x)/2,y,(a.z+b.z)/2);this.tmpS.set(r.width||3,.10,len);this.tmpQ.setFromAxisAngle(new THREE.Vector3(0,1,0),angle);this.tmpM.compose(this.tmpP,this.tmpQ,this.tmpS);mesh.setMatrixAt(i,this.tmpM)});mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=true;mesh.name='roads';this.structureGroup.add(mesh)}
    this.structureGroup.visible=this.buildingsEnabled;
  }
  setMode(mode){this.mode=mode;this.agent.visible=mode==='follow';this.forceRefresh=true}
  setSeason(v){this.season=v;this.forceRefresh=true}
  setTreesEnabled(v){this.treesEnabled=v;this.forceRefresh=true}
  setBuildingsEnabled(v){this.buildingsEnabled=v;this.structureGroup.visible=v}
  setTerrainEnabled(v){this.terrainEnabled=v;this.terrainGroup.visible=v}
  instance(mesh,index,x,y,z,sx,sy,sz,color,quat=null){this.tmpP.set(x,y,z);this.tmpS.set(sx,sy,sz);this.tmpM.compose(this.tmpP,quat||new THREE.Quaternion(),this.tmpS);mesh.setMatrixAt(index,this.tmpM);if(color)mesh.setColorAt(index,color)}
  clearVegetation(){this.veg.trunk.count=0;for(const m of Object.values(this.veg.canopies))m.count=0;this.veg.shrub.count=this.veg.herb.count=this.veg.vine.count=this.veg.epiphyte.count=0;this.stats.vegetation=0}
  refreshVegetation(x,z,now){
    const moved=Math.hypot(x-this.lastVX,z-this.lastVZ),refreshMs=(this.base.refreshMs||900)/Math.max(.6,this.dynamicFactor),refreshMove=this.base.refreshMoveM||38;
    if(!this.forceRefresh&&now-this.lastRefresh<refreshMs&&moved<refreshMove)return;this.forceRefresh=false;this.lastRefresh=now;this.lastVX=x;this.lastVZ=z;
    if(!this.treesEnabled){this.clearVegetation();return}
    const treeR=(this.base.treeRadiusM||330)*(0.72+0.28*this.dynamicFactor),underR=(this.base.understoryRadiusM||135)*(0.72+0.28*this.dynamicFactor),rows=queryGrid(this.index,x,z,treeR);
    const budget={tree:Math.floor(this.capacity.trees*this.dynamicFactor),shrub:Math.floor(this.capacity.shrubs*this.dynamicFactor),herb:Math.floor(this.capacity.herbs*this.dynamicFactor),vine:Math.floor(this.capacity.vines*this.dynamicFactor),epiphyte:Math.floor(this.capacity.epiphytes*this.dynamicFactor)};
    const list={tree:[],shrub:[],herb:[],vine:[],epiphyte:[]},under2=underR*underR;
    for(const row of rows){const h=row[1].properties.habit||'tree';if(!list[h])continue;if(h!=='tree'&&row[0]>under2)continue;if(list[h].length<budget[h])list[h].push(row)}
    let ti=0,ci={round:0,umbrella:0,open:0,ceibo:0};
    for(const [,f] of list.tree){const p=f.properties,lng=f.geometry.coordinates[0],lat=f.geometry.coordinates[1],y=this.getElevation(lng,lat)-this.originElev,h=Math.max(2.8,+p.height||7),can=Math.max(1.1,+p.canopyM||2.4),tr=Math.max(.035,+p.trunkRadiusM||.08);this.instance(this.veg.trunk,ti++,p._x,y+h*.34,p._z,tr,h*.68,tr,null);const form=this.veg.canopies[p.form]?p.form:'round',mesh=this.veg.canopies[form],idx=ci[form]++,loss=this.season<.5&&+p.deciduous===1?.68+this.season*.35:1;let sx=can,sy=can*.85,sz=can;if(form==='umbrella'){sx*=1.2;sy*=.5;sz*=1.2}else if(form==='open'){sx*=.88;sy*=.72;sz*=.88}else if(form==='ceibo'){sx*=1.08;sy*=.72;sz*=1.08}this.instance(mesh,idx,p._x,y+h*.74,p._z,sx*loss,sy*loss,sz*loss,treeColor(p,this.season))}
    this.veg.trunk.count=ti;this.veg.trunk.instanceMatrix.needsUpdate=true;for(const [k,m] of Object.entries(this.veg.canopies)){m.count=ci[k];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}
    const fill=(rows,mesh,habit)=>{let n=0;for(const [,f] of rows){const p=f.properties,vis=+p.seasonalDry===1?1-.55*this.season:clamp((+p.dryPersistence||.45)+(1-(+p.dryPersistence||.45))*this.season,0,1);if((+p.rand||.5)>vis)continue;const lng=f.geometry.coordinates[0],lat=f.geometry.coordinates[1],y=this.getElevation(lng,lat)-this.originElev,s=Math.max(.22,+p.scale||.6);let sx=s,sy=s,sz=s;if(habit==='herb'){if(p.form==='grass'){sx=.22*s;sy=1.45*s;sz=.22*s}else if(p.form==='fern'){sx=1.15*s;sy=.72*s;sz=1.15*s}else if(p.form==='cactus'){sx=.35*s;sy=1.25*s;sz=.35*s}else{sx=.65*s;sy=.88*s;sz=.65*s}}else if(habit==='vine'){sx=.22*s;sy=2.1*s;sz=.22*s}else if(habit==='epiphyte'){sx=.4*s;sy=.28*s;sz=.4*s}else{sx=1.05*s;sy=.82*s;sz=1.05*s}this.instance(mesh,n++,p._x,y+(habit==='epiphyte'?.8:0),p._z,sx,sy,sz,understoryColor(p,this.season));if(n>=mesh.instanceMatrix.count)break}mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;return n};
    const s=fill(list.shrub,this.veg.shrub,'shrub'),h=fill(list.herb,this.veg.herb,'herb'),v=fill(list.vine,this.veg.vine,'vine'),e=fill(list.epiphyte,this.veg.epiphyte,'epiphyte');this.stats.vegetation=ti+Object.values(ci).reduce((a,b)=>a+b,0)+s+h+v+e;
  }
  adaptPerformance(dt){
    this.perfTime+=dt;this.perfFrames++;if(this.perfTime<2.2)return;const fps=this.perfFrames/this.perfTime;this.lastFps=fps;this.stats.fps=fps;this.stats.frameMs=1000/Math.max(1,fps);let next=this.dynamicFactor;if(fps<42)next-=.12;else if(fps<50)next-=.06;else if(fps>58&&this.dynamicFactor<this.hardwareFactor)next+=.05;next=clamp(next,.42,this.hardwareFactor);if(Math.abs(next-this.dynamicFactor)>.02){this.dynamicFactor=next;this.stats.quality=next;this.forceRefresh=true;this.resize()}this.perfTime=0;this.perfFrames=0;
  }
  render(player,state,dt,now){
    this.setSeason(state.season);this.treesEnabled=state.treesEnabled;this.structureGroup.visible=state.buildingsEnabled;this.terrainGroup.visible=state.terrainEnabled;
    const p=lngLatToLocal(player.lng,player.lat),ground=this.getElevation(player.lng,player.lat)-this.originElev,y=ground,forward=new THREE.Vector3(Math.sin(player.bearing*DEG),0,-Math.cos(player.bearing*DEG));
    this.walkPhase+=dt*(player.speedMps>.1?8+Math.min(10,player.speedMps*.55):0);this.agent.position.set(p.x,y+.03,p.z);this.agent.rotation.y=-player.bearing*DEG;this.agent.visible=this.mode==='follow';
    const rig=this.agent.userData.rig,speedNorm=clamp(player.speedMps/19.5,0,1),swing=Math.sin(this.walkPhase)*.65*speedNorm;rig.ll.rotation.x=swing;rig.rl.rotation.x=-swing;rig.la.rotation.x=-swing*.7;rig.ra.rotation.x=swing*.7;
    if(this.mode==='firstperson'){
      this.camera.position.set(p.x,y+CAMPUS.eyeHeightM,p.z);const pitch=(state.pitchLook||0)*DEG,target=this.camera.position.clone().add(forward.clone().multiplyScalar(Math.cos(pitch)*25)).add(new THREE.Vector3(0,Math.sin(pitch)*25,0));this.camera.lookAt(target);
    }else{
      const desired=new THREE.Vector3(p.x,y+CAMPUS.thirdPersonCameraHeightM,p.z).addScaledVector(forward,-CAMPUS.thirdPersonDistanceM),alpha=1-Math.exp(-10*dt);if(!Number.isFinite(this.cameraPos.x)||this.cameraPos.lengthSq()===0)this.cameraPos.copy(desired);else this.cameraPos.lerp(desired,alpha);this.camera.position.copy(this.cameraPos);this.camera.lookAt(new THREE.Vector3(p.x,y+1.15,p.z));
    }
    this.refreshVegetation(p.x,p.z,now);let active=0;for(const ch of this.terrainChunks){const c=ch.userData.center,d=Math.hypot(p.x-c.x,p.z-c.y);ch.visible=this.terrainEnabled&&d<3300;if(ch.visible)active++}this.stats.chunks=active;
    this.resize();this.renderer.render(this.scene,this.camera);this.stats.drawCalls=this.renderer.info.render.calls;this.stats.triangles=this.renderer.info.render.triangles;this.adaptPerformance(dt);
  }
  getStats(){return {...this.stats}}
}

export async function createGameWorld({canvas,forestData,terrainUrl,onProgress=()=>{}}){
  const cache=new TerrariumHeightCache(terrainUrl,CAMPUS.bounds,15);await cache.preload((p,total)=>onProgress(p,total));return new GameWorld(canvas,cache,forestData);
}
