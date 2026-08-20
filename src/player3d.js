import * as THREE from 'three';
import { VEGETATION_PROFILE } from './vegetation.js';

const DEG=Math.PI/180;

function flatMat(color,opts={}){
  return new THREE.MeshBasicMaterial({color,side:opts.double?THREE.DoubleSide:THREE.FrontSide,transparent:false,toneMapped:false});
}
function box(w,h,d,material,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);return m}
function capsule(radius,length,material){return new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,3,6),material)}
function limb(radius,length,material,x,y,z=0){
  const pivot=new THREE.Group();pivot.position.set(x,y,z);
  const mesh=capsule(radius,length,material);mesh.position.y=-(length*.5+radius);pivot.add(mesh);return pivot;
}
function geoOffsetM(origin,lng,lat){
  const r=origin.lat*DEG;
  return {east:(lng-origin.lng)*111320*Math.cos(r),north:(lat-origin.lat)*110574};
}
function dist2Local(e1,n1,e2,n2){const dx=e1-e2,dz=n1-n2;return dx*dx+dz*dz}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

function buildAgent(){
  const root=new THREE.Group();root.name='ESPOL-survival-agent-flat';
  const skin=flatMat(0xd3a47c),hair=flatMat(0xb4935d),jacket=flatMat(0x6d563d),jacketDark=flatMat(0x423329);
  const shirt=flatMat(0x171e24),trousers=flatMat(0x343e47),boots=flatMat(0x151719),metal=flatMat(0x70777a),eye=flatMat(0x252a2f);

  const leftLeg=limb(.072,.65,trousers,-.105,.90),rightLeg=limb(.072,.65,trousers,.105,.90);root.add(leftLeg,rightLeg);
  root.add(box(.17,.13,.29,boots,-.105,.065,.055),box(.17,.13,.29,boots,.105,.065,.055));
  root.add(box(.36,.19,.22,trousers,0,.89,0),box(.46,.52,.25,jacket,0,1.20,0),box(.19,.37,.012,shirt,0,1.22,.132));
  root.add(box(.47,.065,.27,jacketDark,0,.95,0),box(.068,.047,.028,metal,0,.952,.153));

  const leftArm=limb(.061,.51,jacket,-.285,1.43),rightArm=limb(.061,.51,jacket,.285,1.43);root.add(leftArm,rightArm);
  const handGeo=new THREE.IcosahedronGeometry(.071,0);
  const handL=new THREE.Mesh(handGeo,skin);handL.position.set(-.285,.82,0);
  const handR=new THREE.Mesh(handGeo,skin);handR.position.set(.285,.82,0);root.add(handL,handR);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.073,.083,.105,6),skin);neck.position.y=1.515;root.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.142,8,5),skin);head.scale.set(.88,1.12,.94);head.position.y=1.68;root.add(head);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.150,8,5,0,Math.PI*2,0,Math.PI*.62),hair);hairCap.scale.set(.95,.88,1);hairCap.position.set(0,1.755,-.006);root.add(hairCap);
  const fringe=new THREE.Mesh(new THREE.ConeGeometry(.07,.19,4),hair);fringe.rotation.z=72*DEG;fringe.rotation.x=18*DEG;fringe.position.set(-.065,1.735,.118);root.add(fringe);
  root.add(box(.026,.018,.012,eye,-.052,1.695,.136),box(.026,.018,.012,eye,.052,1.695,.136));
  root.add(box(.035,.50,.024,jacketDark,-.13,1.20,.143),box(.035,.50,.024,jacketDark,.13,1.20,.143));

  root.userData.rig={leftArm,rightArm,leftLeg,rightLeg,head};
  root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.matrixAutoUpdate=true}});
  return root;
}

function makeCrossGeometry(){
  const p=new Float32Array([
    -.5,0,0, .5,0,0, .5,1,0, -.5,0,0, .5,1,0, -.5,1,0,
    0,0,-.5, 0,0,.5, 0,1,.5, 0,0,-.5, 0,1,.5, 0,1,-.5
  ]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.computeBoundingSphere();return g;
}
function makeInstanced(geometry,maxInstances,material){
  const mesh=new THREE.InstancedMesh(geometry,material,maxInstances);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;return mesh;
}
function makeVegetationMeshes(limits){
  const trunk=makeInstanced(new THREE.CylinderGeometry(1,1,1,5),limits.maxTrees,flatMat(0x6d523d));
  const leafMat=flatMat(0xffffff);
  const canopies={
    round:makeInstanced(new THREE.IcosahedronGeometry(.5,0),limits.maxTrees,leafMat.clone()),
    umbrella:makeInstanced(new THREE.SphereGeometry(.5,6,3),limits.maxTrees,leafMat.clone()),
    open:makeInstanced(new THREE.OctahedronGeometry(.5,0),limits.maxTrees,leafMat.clone()),
    ceibo:makeInstanced(new THREE.IcosahedronGeometry(.5,0),limits.maxTrees,leafMat.clone())
  };
  const shrub=makeInstanced(new THREE.IcosahedronGeometry(.5,0),limits.maxShrubs,flatMat(0xffffff));
  const cross=makeCrossGeometry();
  const herb=makeInstanced(cross,limits.maxHerbs,flatMat(0xffffff,{double:true}));
  const vine=makeInstanced(cross,limits.maxVines,flatMat(0xffffff,{double:true}));
  const epiphyte=makeInstanced(new THREE.OctahedronGeometry(.5,0),limits.maxEpiphytes,flatMat(0xffffff));
  return {trunk,canopies,shrub,herb,vine,epiphyte,limits};
}
function colorTree(p,season){
  const wet=clamp(season,0,1),c=new THREE.Color();
  if(+p.deciduous===1)c.set(wet>.52?0x477d49:0x777a45);else c.set(wet>.52?0x315f42:0x496446);
  c.offsetHSL((+p.rand-.5)*.025,0,(+p.rand-.5)*.06);return c;
}
function colorUnderstory(p,season){
  const wet=clamp(season,0,1),c=new THREE.Color();
  if(p.habit==='shrub')c.set(wet>.5?0x496f45:0x657044);
  else if(p.habit==='vine')c.set(wet>.5?0x3e7848:0x687542);
  else if(p.habit==='epiphyte')c.set(wet>.5?0x57925d:0x667d49);
  else if(p.form==='cactus')c.set(0x607a52);
  else if(p.form==='fern')c.set(wet>.5?0x397a49:0x5e7041);
  else c.set(wet>.5?0x578f45:0x8a844a);
  c.offsetHSL((+p.rand-.5)*.02,0,(+p.rand-.5)*.05);return c;
}

function makeGrid(features,origin,cellM){
  const grid=new Map();
  for(const f of features){
    const [lng,lat]=f.geometry.coordinates,off=geoOffsetM(origin,lng,lat);
    f.properties._east=off.east;f.properties._north=off.north;
    const cx=Math.floor(off.east/cellM),cz=Math.floor(off.north/cellM),key=`${cx}:${cz}`;
    if(!grid.has(key))grid.set(key,[]);grid.get(key).push(f);
  }
  return grid;
}
function queryGrid(grid,east,north,radius,cellM){
  const out=[],r2=radius*radius;
  const minX=Math.floor((east-radius)/cellM),maxX=Math.floor((east+radius)/cellM);
  const minZ=Math.floor((north-radius)/cellM),maxZ=Math.floor((north+radius)/cellM);
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
    const bucket=grid.get(`${x}:${z}`);if(!bucket)continue;
    for(const f of bucket){const p=f.properties,d2=dist2Local(east,north,+p._east,+p._north);if(d2<=r2)out.push([d2,f])}
  }
  out.sort((a,b)=>a[0]-b[0]);return out;
}

export function createWorld3DLayer({map,getState,getTerrainElevation,forestData,origin}){
  return {
    id:'espol-world-3d',type:'custom',renderingMode:'3d',
    onAdd(mapInstance,gl){
      this.map=mapInstance;this.camera=new THREE.Camera();this.scene=new THREE.Scene();
      this.scene.rotateX(Math.PI/2);this.scene.scale.multiply(new THREE.Vector3(1,1,-1));
      this.agent=buildAgent();this.scene.add(this.agent);

      const hc=navigator.hardwareConcurrency||8,mem=navigator.deviceMemory||8;
      const factor=hc<=4||mem<=4?.58:hc<=8?.80:1;
      const base=VEGETATION_PROFILE.lod;
      this.limits={
        maxTrees:Math.max(80,Math.floor(base.maxTrees*factor)),maxShrubs:Math.max(80,Math.floor(base.maxShrubs*factor)),
        maxHerbs:Math.max(100,Math.floor(base.maxHerbs*factor)),maxVines:Math.max(36,Math.floor(base.maxVines*factor)),
        maxEpiphytes:Math.max(16,Math.floor(base.maxEpiphytes*factor)),factor
      };
      this.veg=makeVegetationMeshes(this.limits);
      this.scene.add(this.veg.trunk,...Object.values(this.veg.canopies),this.veg.shrub,this.veg.herb,this.veg.vine,this.veg.epiphyte);

      this.gridCellM=base.gridCellM;this.grid=makeGrid(forestData.features,origin,this.gridCellM);
      this.renderer=new THREE.WebGLRenderer({canvas:mapInstance.getCanvas(),context:gl,antialias:false,alpha:true,powerPreference:'high-performance'});
      this.renderer.autoClear=false;this.renderer.setPixelRatio(1);
      this.lastT=performance.now();this.walkPhase=0;
      this.lastRefresh=0;this.lastEast=Infinity;this.lastNorth=Infinity;this.lastSeason=-1;this.lastTreesEnabled=null;this.lastMode='';
      this.tmpMatrix=new THREE.Matrix4();this.tmpQuat=new THREE.Quaternion();this.tmpPos=new THREE.Vector3();this.tmpScale=new THREE.Vector3();
      this.originElev=getTerrainElevation(origin.lng,origin.lat)??0;
    },

    clearVegetation(){
      this.veg.trunk.count=0;for(const m of Object.values(this.veg.canopies))m.count=0;
      this.veg.shrub.count=0;this.veg.herb.count=0;this.veg.vine.count=0;this.veg.epiphyte.count=0;
    },

    setInstance(mesh,index,x,y,z,sx,sy,sz,color){
      this.tmpPos.set(x,y,z);this.tmpScale.set(sx,sy,sz);this.tmpMatrix.compose(this.tmpPos,this.tmpQuat,this.tmpScale);
      mesh.setMatrixAt(index,this.tmpMatrix);if(color)mesh.setColorAt(index,color);
    },

    refreshNearbyVegetation(state,now){
      const playerOff=geoOffsetM(origin,state.lng,state.lat);
      const moved=Number.isFinite(this.lastEast)?Math.hypot(playerOff.east-this.lastEast,playerOff.north-this.lastNorth):Infinity;
      const base=VEGETATION_PROFILE.lod;
      const signatureChanged=this.lastTreesEnabled!==state.treesEnabled||this.lastMode!==state.cameraMode;
      if(!signatureChanged&&now-this.lastRefresh<base.refreshMs&&moved<base.refreshMoveM&&Math.abs(state.season-this.lastSeason)<.04)return;
      this.lastRefresh=now;this.lastEast=playerOff.east;this.lastNorth=playerOff.north;this.lastSeason=state.season;this.lastTreesEnabled=state.treesEnabled;this.lastMode=state.cameraMode;

      if(!state.treesEnabled||state.cameraMode==='map'){this.clearVegetation();return}
      const radius=Math.max(base.treeRadiusM,base.understoryRadiusM);
      const candidates=queryGrid(this.grid,playerOff.east,playerOff.north,radius,this.gridCellM);
      const trees=[],shrubs=[],herbs=[],vines=[],epiphytes=[];
      for(const row of candidates){
        const [d2,f]=row,p=f.properties;
        if(p.habit==='tree'){if(d2<=base.treeRadiusM**2&&trees.length<this.limits.maxTrees)trees.push(row)}
        else if(d2<=base.understoryRadiusM**2){
          if(p.habit==='shrub'&&shrubs.length<this.limits.maxShrubs)shrubs.push(row);
          else if(p.habit==='herb'&&herbs.length<this.limits.maxHerbs)herbs.push(row);
          else if(p.habit==='vine'&&vines.length<this.limits.maxVines)vines.push(row);
          else if(p.habit==='epiphyte'&&epiphytes.length<this.limits.maxEpiphytes)epiphytes.push(row);
        }
      }

      let ti=0;const ci={round:0,umbrella:0,open:0,ceibo:0};
      const dry=state.season<.5;
      for(const [,f] of trees){
        const p=f.properties,[lng,lat]=f.geometry.coordinates,ground=getTerrainElevation(lng,lat);if(!Number.isFinite(ground))continue;
        const y=ground-this.originElev,h=Math.max(2.8,+p.height||7),canopy=Math.max(1.1,+p.canopyM||2.4),trunkR=Math.max(.035,+p.trunkRadiusM||.08);
        this.setInstance(this.veg.trunk,ti++,+p._east,y+h*.34,+p._north,trunkR,h*.68,trunkR,null);
        const form=this.veg.canopies[p.form]?p.form:'round',mesh=this.veg.canopies[form],idx=ci[form]++;
        const leafLoss=dry&&+p.deciduous===1?(.62+state.season*.42):1;
        const cy=form==='ceibo'?h*.79:h*.73;
        let sx=canopy,sy=canopy*.88,sz=canopy;
        if(form==='umbrella'){sx*=1.18;sy*=.48;sz*=1.18}else if(form==='open'){sx*=.88;sy*=.72;sz*=.88}else if(form==='ceibo'){sx*=1.08;sy*=.72;sz*=1.08}
        this.setInstance(mesh,idx,+p._east,y+cy,+p._north,sx*leafLoss,sy*leafLoss,sz*leafLoss,colorTree(p,state.season));
      }
      this.veg.trunk.count=ti;this.veg.trunk.instanceMatrix.needsUpdate=true;
      for(const [form,mesh] of Object.entries(this.veg.canopies)){mesh.count=ci[form];mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true}

      const wet=clamp(state.season,0,1);
      const fillUnderstory=(rows,mesh,habit)=>{
        let count=0;
        for(const [,f] of rows){
          const p=f.properties,[lng,lat]=f.geometry.coordinates;
          const visibility=+p.seasonalDry===1?(1-.55*wet):clamp((+p.dryPersistence||.45)+(1-(+p.dryPersistence||.45))*wet,0,1);
          if((+p.rand||.5)>visibility)continue;
          const ground=getTerrainElevation(lng,lat);if(!Number.isFinite(ground))continue;
          const y=ground-this.originElev,baseScale=Math.max(.22,+p.scale||.6),density=Math.max(1,+p.density||1);
          const copies=Math.min(density,habit==='herb'?3:2);
          for(let j=0;j<copies&&count<mesh.instanceMatrix.count;j++){
            const angle=(+p.rand*6.283+j*2.2),spread=habit==='herb'?1.25:.65;
            const x=+p._east+Math.cos(angle)*spread*j*.55,z=+p._north+Math.sin(angle)*spread*j*.55;
            let sx=baseScale,sy=baseScale,sz=baseScale;
            if(habit==='herb'){
              if(p.form==='grass'){sx=.22*baseScale;sy=1.45*baseScale;sz=.22*baseScale}
              else if(p.form==='fern'){sx=1.15*baseScale;sy=.72*baseScale;sz=1.15*baseScale}
              else if(p.form==='cactus'){sx=.35*baseScale;sy=1.25*baseScale;sz=.35*baseScale}
              else {sx=.65*baseScale;sy=.88*baseScale;sz=.65*baseScale}
            }else if(habit==='vine'){sx=.22*baseScale;sy=2.25*baseScale;sz=.22*baseScale}
            else if(habit==='epiphyte'){sx=.40*baseScale;sy=.28*baseScale;sz=.40*baseScale}
            else {sx=1.05*baseScale;sy=.82*baseScale;sz=1.05*baseScale}
            this.setInstance(mesh,count++,x,y+(habit==='vine'?sy*.45:habit==='epiphyte'?.7:0),z,sx,sy,sz,colorUnderstory(p,state.season));
          }
        }
        mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      };
      fillUnderstory(shrubs,this.veg.shrub,'shrub');
      fillUnderstory(herbs,this.veg.herb,'herb');
      fillUnderstory(vines,this.veg.vine,'vine');
      fillUnderstory(epiphytes,this.veg.epiphyte,'epiphyte');
    },

    render(gl,args){
      const state=getState(),now=performance.now(),dt=Math.min(.05,(now-this.lastT)/1000);this.lastT=now;
      const speedNorm=Math.min(1,Math.abs(state.speedMps)/(state.jogSpeedMps*state.sprintMultiplier));
      if(speedNorm>.015)this.walkPhase+=dt*(6+speedNorm*7);
      const ground=getTerrainElevation(state.lng,state.lat),off=geoOffsetM(origin,state.lng,state.lat);
      this.agent.position.set(off.east,Number.isFinite(ground)?ground-this.originElev+.03:.03,off.north);
      this.agent.rotation.y=state.bearing*DEG;this.agent.visible=state.cameraMode==='follow';
      const rig=this.agent.userData.rig,swing=Math.sin(this.walkPhase)*.62*speedNorm;
      rig.leftLeg.rotation.x=swing;rig.rightLeg.rotation.x=-swing;rig.leftArm.rotation.x=-swing*.72;rig.rightArm.rotation.x=swing*.72;
      rig.head.rotation.y=Math.sin(this.walkPhase*.5)*.025*speedNorm;this.agent.position.y+=Math.abs(Math.sin(this.walkPhase*2))*.016*speedNorm;

      this.refreshNearbyVegetation(state,now);
      const originMercator=maplibregl.MercatorCoordinate.fromLngLat([origin.lng,origin.lat],this.originElev);
      const scale=originMercator.meterInMercatorCoordinateUnits();
      const m=new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const l=new THREE.Matrix4().makeTranslation(originMercator.x,originMercator.y,originMercator.z).scale(new THREE.Vector3(scale,-scale,scale));
      this.camera.projectionMatrix=m.multiply(l);
      this.renderer.resetState();this.renderer.render(this.scene,this.camera);
      // No triggerRepaint permanente: cuando el jugador está quieto, la GPU puede descansar.
    }
  };
}
