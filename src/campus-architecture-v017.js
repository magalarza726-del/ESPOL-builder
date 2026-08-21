import * as THREE from 'three';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js';
import { CAMPUS, LANDMARKS } from './config.js';
import { FIMCP_SPATIAL_CONTROL } from './fimcp-spatial-control.js';
import { FACULTY_REGISTRY, FACULTY_IDS, ESPOL_INTERIOR_REFERENCE, classifyFaculty, inferBuildingUsage, recordText } from './faculty-registry-v017.js';

const DEG=Math.PI/180, METERS_LAT=110574;
const METERS_LNG=111320*Math.cos(CAMPUS.spawn.lat*DEG);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const toLocal=(lng,lat)=>({x:(lng-CAMPUS.spawn.lng)*METERS_LNG,z:-(lat-CAMPUS.spawn.lat)*METERS_LAT});
const toLngLat=(x,z)=>({lng:CAMPUS.spawn.lng+x/METERS_LNG,lat:CAMPUS.spawn.lat-z/METERS_LAT});
const distM=(a,b)=>Math.hypot((a.lng-b.lng)*111320*Math.cos(((a.lat+b.lat)*.5)*DEG),(a.lat-b.lat)*METERS_LAT);

function polygons(g){if(g?.type==='Polygon')return[g.coordinates];if(g?.type==='MultiPolygon')return g.coordinates;return[];}
function cleanRing(ring=[]){return ring.length>1&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1]?ring.slice(0,-1):ring;}
function localPoly(rings){const outer=cleanRing(rings?.[0]).map(c=>toLocal(c[0],c[1]));const holes=(rings||[]).slice(1).map(cleanRing).filter(r=>r.length>=3).map(r=>r.map(c=>toLocal(c[0],c[1])));return outer.length>=3?{outer,holes}:null;}
function eachCoord(coords,fn){if(!Array.isArray(coords))return;if(coords.length>=2&&typeof coords[0]==='number'){fn(coords);return;}for(const c of coords)eachCoord(c,fn);}
function bounds(g){let minLng=Infinity,maxLng=-Infinity,minLat=Infinity,maxLat=-Infinity;eachCoord(g?.coordinates,c=>{minLng=Math.min(minLng,c[0]);maxLng=Math.max(maxLng,c[0]);minLat=Math.min(minLat,c[1]);maxLat=Math.max(maxLat,c[1]);});return Number.isFinite(minLng)?{minLng,maxLng,minLat,maxLat,lng:(minLng+maxLng)/2,lat:(minLat+maxLat)/2}:null;}
function rectGeometry(lng,lat,width,depth){const hw=width/(2*METERS_LNG),hh=depth/(2*METERS_LAT);return{type:'Polygon',coordinates:[[[lng-hw,lat-hh],[lng+hw,lat-hh],[lng+hw,lat+hh],[lng-hw,lat+hh],[lng-hw,lat-hh]]]};}
function normalizeRecord(record,source='gis'){const b=bounds(record?.geometry);if(!b)return null;const p=record.properties||{};const levels=Number.parseFloat(p.levels??p['building:levels']);const h=Number.parseFloat(record.height??p.render_height??p.height);return{...record,lng:record.lng??b.lng,lat:record.lat??b.lat,height:Number.isFinite(h)?h:(Number.isFinite(levels)?levels*3.15:7.4),base:Number(record.base)||0,properties:p,source};}
function runtimeRecord(b,index){if(!Number.isFinite(b?.lng)||!Number.isFinite(b?.lat))return null;const width=clamp(Number(b.width)||22,5,110),depth=clamp(Number(b.depth)||16,5,90);return normalizeRecord({geometry:rectGeometry(b.lng,b.lat,width,depth),properties:{name:b.name||'',ref:b.ref||'',runtimeFallback:true},lng:b.lng,lat:b.lat,height:clamp(Number(b.height)||7.4,3.2,42)},`runtime-${index}`);}
function controlFallback(point,ref,width,depth,height){return normalizeRecord({geometry:rectGeometry(point.lng,point.lat,width,depth),properties:{name:point.name,ref,faculty:'FIMCP',controlFallback:true},lng:point.lng,lat:point.lat,height},`control-${point.id}`);}
function mergeRecords(captured=[],structures={}){
  const out=captured.map(r=>normalizeRecord(r,'gis')).filter(Boolean);
  for(const [i,b] of (structures?.buildings||[]).entries()){
    const r=runtimeRecord(b,i);if(!r)continue;
    if(!out.some(x=>distM(x,r)<18))out.push(r);
  }
  const P=FIMCP_SPATIAL_CONTROL.points;
  const controls=[
    controlFallback(P.auditorium,'12H',46,30,10),
    controlFallback(P.block18A,'18A',38,22,7.4),
    controlFallback(P.comedor,'FIMCP comedor',32,20,6.2),
    controlFallback(P.block24C,'24C',48,26,6.4)
  ];
  for(const r of controls)if(!out.some(x=>distM(x,r)<20))out.push(r);
  return out;
}
function shape(poly){const s=new THREE.Shape();poly.outer.forEach((p,i)=>i?s.lineTo(p.x,-p.z):s.moveTo(p.x,-p.z));s.closePath();for(const ring of poly.holes){const h=new THREE.Path();ring.forEach((p,i)=>i?h.lineTo(p.x,-p.z):h.moveTo(p.x,-p.z));h.closePath();s.holes.push(h);}return s;}
function polyBounds(poly){let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const p of poly.outer){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}return{minX,maxX,minZ,maxZ,x:(minX+maxX)/2,z:(minZ+maxZ)/2,hx:(maxX-minX)/2,hz:(maxZ-minZ)/2};}
function pointInRing(x,z,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a.z>z)!==(b.z>z))&&x<(b.x-a.x)*(z-a.z)/((b.z-a.z)||1e-12)+a.x)inside=!inside;}return inside;}
function pointInPoly(x,z,poly){return pointInRing(x,z,poly.outer)&&!poly.holes.some(h=>pointInRing(x,z,h));}
function pseg(ax,az,bx,bz,px,pz){const vx=bx-ax,vz=bz-az,wx=px-ax,wz=pz-az,vv=vx*vx+vz*vz,t=vv>1e-9?clamp((wx*vx+wz*vz)/vv,0,1):0,dx=px-(ax+vx*t),dz=pz-(az+vz*t);return dx*dx+dz*dz;}
function orient(a,b,c){return(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);}
function intersect(a,b,c,d){const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);return((o1>0)!==(o2>0))&&((o3>0)!==(o4>0));}
function segSeg(a,b,c,d){if(intersect(a,b,c,d))return 0;return Math.min(pseg(a.x,a.z,b.x,b.z,c.x,c.z),pseg(a.x,a.z,b.x,b.z,d.x,d.z),pseg(c.x,c.z,d.x,d.z,a.x,a.z),pseg(c.x,c.z,d.x,d.z,b.x,b.z));}
function segmentPolyBlocked(a,b,poly,r){if(pointInPoly(a.x,a.z,poly)||pointInPoly(b.x,b.z,poly))return true;const rr=r*r;for(const ring of[poly.outer,...poly.holes])for(let i=0;i<ring.length;i++)if(segSeg(a,b,ring[i],ring[(i+1)%ring.length])<=rr)return true;return false;}

function principalFrame(poly){const c=polyBounds(poly);let ex={x:1,z:0},longest=0;for(let i=0;i<poly.outer.length;i++){const a=poly.outer[i],b=poly.outer[(i+1)%poly.outer.length],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l>longest){longest=l;ex={x:dx/l,z:dz/l};}}const ez={x:-ex.z,z:ex.x};let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;for(const p of poly.outer){const dx=p.x-c.x,dz=p.z-c.z,u=dx*ex.x+dz*ex.z,v=dx*ez.x+dz*ez.z;minU=Math.min(minU,u);maxU=Math.max(maxU,u);minV=Math.min(minV,v);maxV=Math.max(maxV,v);}return{center:{x:c.x,z:c.z},ex,ez,width:maxU-minU,depth:maxV-minV};}
function framePoint(frame,u,v){return{x:frame.center.x+frame.ex.x*u+frame.ez.x*v,z:frame.center.z+frame.ex.z*u+frame.ez.z*v};}
function material(color,opts={}){return new THREE.MeshBasicMaterial({color,toneMapped:false,transparent:!!opts.transparent,opacity:opts.opacity??1,side:opts.double?THREE.DoubleSide:THREE.FrontSide});}
function box(root,mat,x,y,z,sx,sy,sz,ry=0){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);m.rotation.y=ry;root.add(m);return m;}
function segmentBox(root,mat,a,b,y,h,thick=.18){const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.08)return null;return box(root,mat,(a.x+b.x)/2,y,(a.z+b.z)/2,len,h,thick,-Math.atan2(dz,dx));}
function label(text,color){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.clearRect(0,0,512,128);ctx.fillStyle='#ffffff';ctx.font='700 58px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(8,2),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,toneMapped:false,color}));m.userData.disposeTexture=tex;return m;}
function addSolid(root,record,poly,mat){const ground=record._ground;const g=new THREE.ExtrudeGeometry(shape(poly),{depth:clamp(record.height-record.base,2.5,45),bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,ground+record.base,0);const m=new THREE.Mesh(g,mat);root.add(m);return m;}
function addFloorRoof(root,record,poly,mats){const ground=record._ground;const floor=new THREE.ShapeGeometry(shape(poly));floor.rotateX(-Math.PI/2);floor.translate(0,ground+.035,0);root.add(new THREE.Mesh(floor,mats.tile));const roof=floor.clone();roof.translate(0,record.height-.07,0);root.add(new THREE.Mesh(roof,mats.ceiling));}
function addExterior(root,record,poly,faculty,mats,wallColliders){
  const ground=record._ground,h=clamp(record.height,3.2,25);let entrance={i:0,len:0};for(let i=0;i<poly.outer.length;i++){const a=poly.outer[i],b=poly.outer[(i+1)%poly.outer.length],len=Math.hypot(b.x-a.x,b.z-a.z);if(len>entrance.len)entrance={i,len};}
  for(let i=0;i<poly.outer.length;i++){
    const a=poly.outer[i],b=poly.outer[(i+1)%poly.outer.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<1)return;
    const ux=dx/len,uz=dz/len,door=i===entrance.i&&len>7,doorW=Math.min(2.4,len*.18),levels=Math.max(1,Math.min(4,Math.round(h/3.15)));
    const pieces=[];
    if(door){const gap0=(len-doorW)/2,gap1=(len+doorW)/2;pieces.push([0,gap0],[gap1,len]);for(const [s,e] of pieces){const p0={x:a.x+ux*s,z:a.z+uz*s},p1={x:a.x+ux*e,z:a.z+uz*e};segmentBox(root,mats.wall,p0,p1,ground+h/2,h,.18);wallColliders.push({a:p0,b:p1,height:h});}const c0={x:a.x+ux*gap0,z:a.z+uz*gap0},c1={x:a.x+ux*gap1,z:a.z+uz*gap1};segmentBox(root,mats.wall,c0,c1,ground+2.75+(h-2.75)/2,Math.max(.25,h-2.75),.18);
    }else{segmentBox(root,mats.wall,a,b,ground+h/2,h,.18);wallColliders.push({a,b,height:h});}
    if(len>5){const normal={x:-uz,z:ux};for(let level=0;level<levels;level++){const y=ground+1.55+level*3.1;const bays=Math.max(2,Math.min(12,Math.floor(len/3)));for(let n=0;n<bays;n++){const t=(n+.5)/bays;if(door&&level===0&&Math.abs(t-.5)<.13)continue;const p={x:a.x+dx*t+normal.x*.10,z:a.z+dz*t+normal.z*.10};box(root,mats.glass,p.x,y,p.z,Math.max(.65,len/bays-.55),1.05,.035,-Math.atan2(dz,dx));}}}
  }
  const frame=principalFrame(poly);const sign=label(faculty.id,faculty.palette.accent);const pos=framePoint(frame,0,frame.depth*.5+.16);sign.position.set(pos.x,ground+Math.min(h-.7,4.9),pos.z);sign.rotation.y=Math.atan2(frame.ez.x,frame.ez.z);root.add(sign);
}
function addDesk(root,mats,p,y,yaw=0){box(root,mats.desk,p.x,y+.72,p.z,1.05,.08,.52,yaw);box(root,mats.metal,p.x-.42,y+.36,p.z, .05,.72,.05,yaw);box(root,mats.metal,p.x+.42,y+.36,p.z,.05,.72,.05,yaw);}
function addChair(root,mats,p,y,yaw=0){box(root,mats.chair,p.x,y+.45,p.z,.52,.10,.48,yaw);box(root,mats.chair,p.x,y+.80,p.z+.21,.52,.65,.09,yaw);}
function addInterior(root,record,poly,faculty,usage,mats,wallColliders,objectColliders){
  const f=principalFrame(poly),ground=record._ground,w=Math.min(f.width*.68,22),d=Math.min(f.depth*.68,16);if(w<7||d<6)return false;
  const p1=framePoint(f,-w/2,0),p2=framePoint(f,-1.15,0),p3=framePoint(f,1.15,0),p4=framePoint(f,w/2,0);
  segmentBox(root,mats.innerWall,p1,p2,ground+1.45,2.9,.12);segmentBox(root,mats.innerWall,p3,p4,ground+1.45,2.9,.12);wallColliders.push({a:p1,b:p2,height:3},{a:p3,b:p4,height:3});
  const boardP=framePoint(f,0,-d*.38);box(root,mats.board,boardP.x,ground+1.55,boardP.z,Math.min(7,w*.45),1.45,.06,Math.atan2(f.ex.z,f.ex.x));
  const collaborative=faculty.id==='FCSH'||usage==='collaborative';
  if(collaborative){for(const u of[-w*.22,w*.22])for(const v of[-d*.18,d*.18]){const p=framePoint(f,u,v);const table=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.55,.09,16),mats.desk);table.position.set(p.x,ground+.74,p.z);root.add(table);for(let k=0;k<4;k++){const q=framePoint(f,u+Math.cos(k*Math.PI/2)*2.05,v+Math.sin(k*Math.PI/2)*2.05);addChair(root,mats,q,ground,k*Math.PI/2);}}}
  else if(['lab','life-science','marine','science','creative'].includes(usage)||faculty.labStyle!=='computing'){
    for(const u of[-w*.27,0,w*.27])for(const v of[-d*.20,d*.20]){const p=framePoint(f,u,v);box(root,mats.bench,p.x,ground+.78,p.z,2.2,.82,.72,Math.atan2(f.ex.z,f.ex.x));objectColliders.push({x:p.x,z:p.z,hx:1.25,hz:.55,height:1});}
  }else{
    const cols=Math.max(3,Math.min(6,Math.floor(w/2.5))),rows=Math.max(2,Math.min(4,Math.floor(d/3)));
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const u=-w*.38+(c+.5)*(w*.76/cols),v=-d*.28+(r+.5)*(d*.56/rows),p=framePoint(f,u,v);addDesk(root,mats,p,ground,Math.atan2(f.ex.z,f.ex.x));const q=framePoint(f,u,v+.85);addChair(root,mats,q,ground,Math.atan2(f.ex.z,f.ex.x)+Math.PI);}
  }
  const ac=framePoint(f,w*.34,-d*.40);box(root,mats.ac,ac.x,ground+2.55,ac.z,1.35,.38,.35,Math.atan2(f.ex.z,f.ex.x));
  const projector=framePoint(f,0,0);box(root,mats.projector,projector.x,ground+2.78,projector.z,.65,.18,.45,Math.atan2(f.ex.z,f.ex.x));
  return true;
}
function dispose(root){root?.traverse?.(o=>{o.userData?.disposeTexture?.dispose?.();o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m?.dispose?.());else o.material?.dispose?.();});root?.removeFromParent?.();}
function wallBlocked(a,b,c,r){return segSeg(a,b,c.a,c.b)<=r*r;}
function objectBlocked(a,b,o,r){const minX=o.x-o.hx-r,maxX=o.x+o.hx+r,minZ=o.z-o.hz-r,maxZ=o.z+o.hz+r;if((a.x>=minX&&a.x<=maxX&&a.z>=minZ&&a.z<=maxZ)||(b.x>=minX&&b.x<=maxX&&b.z>=minZ&&b.z<=maxZ))return true;for(const [c,d] of[[{x:minX,z:minZ},{x:maxX,z:minZ}],[{x:maxX,z:minZ},{x:maxX,z:maxZ}],[{x:maxX,z:maxZ},{x:minX,z:maxZ}],[{x:minX,z:maxZ},{x:minX,z:minZ}]])if(intersect(a,b,c,d))return true;return false;}

export function installCampusArchitectureV017(world,capturedRecords=[],structures={}){
  if(!world)return world;
  if(world.__campusArchitectureRootV017)dispose(world.__campusArchitectureRootV017);
  world.__campusArchitectureV017=true;
  for(const name of['FIMCP-spatial-reconstruction-v016','FIMCP-photo-reconstruction-v015'])dispose(world.scene.getObjectByName(name));
  if(world.buildingGroup)world.buildingGroup.visible=false;

  const records=mergeRecords(capturedRecords,structures);
  for(const r of records)r._ground=world.getElevation(r.lng,r.lat)-world.originElev;
  const facultyMap=new Map(FACULTY_IDS.map(id=>[id,[]]));
  for(const r of records){let f=classifyFaculty(r);if(!f&&r.properties?.faculty==='FIMCP')f=FACULTY_REGISTRY.FIMCP;if(!f){const lm=LANDMARKS.find(l=>l.category&&FACULTY_REGISTRY[l.category]&&distM(r,l)<48);if(lm)f=FACULTY_REGISTRY[lm.category];}r._faculty=f||null;if(f)facultyMap.get(f.id).push(r);}

  const root=new THREE.Group();root.name='CampusArchitecture-v017';world.scene.add(root);world.__campusArchitectureRootV017=root;
  const baseMats={generic:material(0xc5c8c1),tile:material(ESPOL_INTERIOR_REFERENCE.classroom.tile),ceiling:material(ESPOL_INTERIOR_REFERENCE.classroom.ceiling),innerWall:material(ESPOL_INTERIOR_REFERENCE.classroom.lowerWall),board:material(ESPOL_INTERIOR_REFERENCE.classroom.whiteboard),desk:material(ESPOL_INTERIOR_REFERENCE.classroom.desk),chair:material(ESPOL_INTERIOR_REFERENCE.classroom.chair),metal:material(0x32383d),bench:material(0x9a9b91),ac:material(0xe9ebe8),projector:material(0xd6d8d7)};
  const wallColliders=[],objectColliders=[],solidColliders=[];let interiorCount=0,detailedCount=0;
  const detailedSet=new Set();
  for(const [id,list] of facultyMap){list.sort((a,b)=>{const ta=recordText(a),tb=recordText(b);const pa=/auditorio|11a|12h|13h|14a|8a|3a|60a/.test(ta)?0:1,pb=/auditorio|11a|12h|13h|14a|8a|3a|60a/.test(tb)?0:1;return pa-pb;});for(const r of list.slice(0,Math.min(3,list.length)))detailedSet.add(r);}

  const simpleGeometries=[];
  for(const record of records){
    for(const rings of polygons(record.geometry)){
      const poly=localPoly(rings);if(!poly)continue;
      const faculty=record._faculty;
      if(!faculty||!detailedSet.has(record)){
        const ground=record._ground,g=new THREE.ExtrudeGeometry(shape(poly),{depth:clamp(record.height-record.base,2.5,45),bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,ground+record.base,0);simpleGeometries.push(g);solidColliders.push({poly,height:record.height});
        continue;
      }
      detailedCount++;const palette=faculty.palette,mats={...baseMats,wall:material(palette.wall),glass:material(palette.glass,{transparent:true,opacity:.72})};
      addFloorRoof(root,record,poly,mats);addExterior(root,record,poly,faculty,mats,wallColliders);const usage=inferBuildingUsage(record,faculty);if(addInterior(root,record,poly,faculty,usage,mats,wallColliders,objectColliders))interiorCount++;
    }
  }
  if(simpleGeometries.length){const merged=mergeGeometries(simpleGeometries,false);if(merged){const mesh=new THREE.Mesh(merged,baseMats.generic);mesh.name='CampusArchitecture-generic-shells';root.add(mesh);}simpleGeometries.forEach(g=>g.dispose());}

  const oldPath=world.pathBlockedBuilding?.bind(world);
  world.pathBlockedBuilding=function(a,b,radius){if(!this.buildingsEnabled)return false;const r=radius||.38;for(const s of solidColliders){if(this.verticalOffset>s.height+.6)continue;if(segmentPolyBlocked(a,b,s.poly,r))return true;}for(const w of wallColliders){if(this.verticalOffset>w.height+.6)continue;if(wallBlocked(a,b,w,r))return true;}for(const o of objectColliders){if(this.verticalOffset>o.height+.6)continue;if(objectBlocked(a,b,o,r))return true;}return false;};
  world.__campusArchitectureOldPath=oldPath;
  const upstreamToggle=world.setBuildingsEnabled?.bind(world);world.setBuildingsEnabled=v=>{upstreamToggle?.(v);root.visible=!!v;if(world.buildingGroup)world.buildingGroup.visible=false;};

  const facultyCounts=Object.fromEntries([...facultyMap].map(([id,list])=>[id,list.length]));
  const fimcpVisibleBuildings=facultyCounts.FIMCP||0;
  world.campusArchitectureReport={version:'v0.17.0',totalBuildings:records.length,gisBuildings:records.filter(r=>r.source==='gis').length,runtimeFallbackBuildings:records.filter(r=>String(r.source).startsWith('runtime-')).length,controlFallbackBuildings:records.filter(r=>String(r.source).startsWith('control-')).length,detailedBuildings:detailedCount,interiors:interiorCount,facultyCounts,facultyCoverage:FACULTY_IDS.filter(id=>facultyCounts[id]>0).length,fimcpVisibleBuildings,wallColliders:wallColliders.length,objectColliders:objectColliders.length,rule:'GIS first; runtime/control fallback only fills missing footprints; photos define local architectural vocabulary, never global coordinates.'};
  world.getCampusArchitectureReport=()=>world.campusArchitectureReport;
  console.info('ESPOL Builder v0.17 campus architecture',world.campusArchitectureReport);
  return world;
}
