import * as THREE from 'three';

const DEG=Math.PI/180;

function mat(color,roughness=.78,metalness=.02){
  return new THREE.MeshStandardMaterial({color,roughness,metalness});
}
function box(w,h,d,material,x,y,z){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  m.position.set(x,y,z);return m;
}
function capsule(radius,length,material){
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,5,10),material);
}
function limb(radius,length,material,x,y,z=0){
  const pivot=new THREE.Group();pivot.position.set(x,y,z);
  const mesh=capsule(radius,length,material);
  mesh.position.y=-(length*.5+radius);
  pivot.add(mesh);return pivot;
}
function geoOffsetM(origin,lng,lat){
  const r=origin.lat*DEG;
  return {east:(lng-origin.lng)*111320*Math.cos(r),north:(lat-origin.lat)*110574};
}
function dist2M(a,b){
  const r=((a.lat+b.lat)*.5)*DEG;
  const dx=(a.lng-b.lng)*111320*Math.cos(r);
  const dz=(a.lat-b.lat)*110574;
  return dx*dx+dz*dz;
}

/**
 * Avatar original de agente de supervivencia, ~1.80 m.
 * Usa el arquetipo visual solicitado (cabello claro barrido, chaqueta de campo,
 * pantalón cargo y arnés), sin reutilizar ni clonar el modelo de RE4.
 */
function buildAgent(){
  const root=new THREE.Group();root.name='ESPOL-survival-agent';

  const skin=mat(0xd3a47c,.9);
  const hair=mat(0xb4935d,.86);
  const jacket=mat(0x6d563d,.84);
  const jacketDark=mat(0x423329,.86);
  const shirt=mat(0x171e24,.9);
  const trousers=mat(0x343e47,.92);
  const boots=mat(0x151719,.82);
  const metal=mat(0x70777a,.34,.45);
  const eye=mat(0x252a2f,.75);

  // Piernas y botas: cadera ~0.9 m, altura total ~1.80 m.
  const leftLeg=limb(.072,.65,trousers,-.105,.90);
  const rightLeg=limb(.072,.65,trousers,.105,.90);
  root.add(leftLeg,rightLeg);
  root.add(box(.17,.13,.29,boots,-.105,.065,.055));
  root.add(box(.17,.13,.29,boots,.105,.065,.055));

  // Torso: chaqueta marrón de campo, camiseta oscura y cinturón utilitario.
  root.add(box(.36,.19,.22,trousers,0,.89,0));
  root.add(box(.46,.52,.25,jacket,0,1.20,0));
  root.add(box(.19,.37,.012,shirt,0,1.22,.132));
  root.add(box(.47,.065,.27,jacketDark,0,.95,0));
  root.add(box(.068,.047,.028,metal,0,.952,.153));
  root.add(box(.10,.13,.07,jacketDark,-.15,.89,.15));
  root.add(box(.10,.13,.07,jacketDark,.15,.89,.15));

  const leftArm=limb(.061,.51,jacket,-.285,1.43);
  const rightArm=limb(.061,.51,jacket,.285,1.43);
  root.add(leftArm,rightArm);
  const handGeo=new THREE.SphereGeometry(.071,10,8);
  const handL=new THREE.Mesh(handGeo,skin);handL.position.set(-.285,.82,0);
  const handR=new THREE.Mesh(handGeo,skin);handR.position.set(.285,.82,0);
  root.add(handL,handR);

  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.073,.083,.105,10),skin);
  neck.position.y=1.515;root.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.142,16,12),skin);
  head.scale.set(.88,1.12,.94);head.position.y=1.68;root.add(head);

  // Cabello asimétrico barrido: identifica la silueta sin copiar un peinado/modelo exacto.
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.150,14,10,0,Math.PI*2,0,Math.PI*.62),hair);
  hairCap.scale.set(.95,.88,1);hairCap.position.set(0,1.755,-.006);root.add(hairCap);
  const fringe=new THREE.Mesh(new THREE.ConeGeometry(.07,.19,5),hair);
  fringe.rotation.z=72*DEG;fringe.rotation.x=18*DEG;fringe.position.set(-.065,1.735,.118);root.add(fringe);

  // Ojos mínimos para que el avatar se lea como humano a zoom cercano.
  root.add(box(.026,.018,.012,eye,-.052,1.695,.136));
  root.add(box(.026,.018,.012,eye,.052,1.695,.136));

  // Arnés, hombreras y cuello de chaqueta.
  root.add(box(.035,.50,.024,jacketDark,-.13,1.20,.143));
  root.add(box(.035,.50,.024,jacketDark,.13,1.20,.143));
  root.add(box(.14,.06,.05,jacketDark,-.18,1.44,.02));
  root.add(box(.14,.06,.05,jacketDark,.18,1.44,.02));
  const collarL=box(.11,.10,.04,jacketDark,-.07,1.475,.11);collarL.rotation.z=-.34;
  const collarR=box(.11,.10,.04,jacketDark,.07,1.475,.11);collarR.rotation.z=.34;
  root.add(collarL,collarR);

  root.userData.rig={leftArm,rightArm,leftLeg,rightLeg,head};
  root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});
  return root;
}

function makeInstanced(geometry,maxInstances){
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,metalness:0});
  const mesh=new THREE.InstancedMesh(geometry,material,maxInstances);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled=false;mesh.count=0;
  return mesh;
}

function makeTreeMeshes(maxInstances=420){
  const trunkMaterial=mat(0x70523b,.98);
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,7),trunkMaterial,maxInstances);
  trunk.instanceMatrix.setUsage(THREE.DynamicDrawUsage);trunk.frustumCulled=false;trunk.count=0;

  // Cuatro arquetipos de copa. Son deliberadamente low-poly para mantener Pages fluido.
  const round=makeInstanced(new THREE.DodecahedronGeometry(.5,1),maxInstances);
  const umbrella=makeInstanced(new THREE.SphereGeometry(.5,9,6),maxInstances);
  const open=makeInstanced(new THREE.IcosahedronGeometry(.5,0),maxInstances);
  const ceibo=makeInstanced(new THREE.DodecahedronGeometry(.5,0),maxInstances);
  return {trunk,canopies:{round,umbrella,open,ceibo},maxInstances};
}

function canopyColor(deciduous,wet,rand=0){
  const c=new THREE.Color();
  if(deciduous)c.set(wet?0x3a8050:0x7b824b);
  else c.set(wet?0x285f43:0x456a45);
  const shift=(rand-.5)*.10;
  c.offsetHSL(shift*.12,shift*.10,shift);
  return c;
}

export function createWorld3DLayer({map,getState,getTerrainElevation,forestData,origin}){
  return {
    id:'espol-world-3d',type:'custom',renderingMode:'3d',

    onAdd(mapInstance,gl){
      this.map=mapInstance;this.camera=new THREE.Camera();this.scene=new THREE.Scene();
      // Patrón métrico recomendado por MapLibre: x=este, y=arriba, z=norte.
      this.scene.rotateX(Math.PI/2);
      this.scene.scale.multiply(new THREE.Vector3(1,1,-1));

      this.agent=buildAgent();this.scene.add(this.agent);
      this.trees=makeTreeMeshes(420);
      this.scene.add(this.trees.trunk,...Object.values(this.trees.canopies));

      const hemi=new THREE.HemisphereLight(0xf0f6ff,0x46563b,2.0);this.scene.add(hemi);
      const sun=new THREE.DirectionalLight(0xfff8df,2.25);sun.position.set(60,90,-40).normalize();this.scene.add(sun);

      this.renderer=new THREE.WebGLRenderer({canvas:mapInstance.getCanvas(),context:gl,antialias:true});
      this.renderer.autoClear=false;
      this.lastT=performance.now();this.walkPhase=0;
      this.lastForestRefresh=0;this.lastForestLng=Infinity;this.lastForestLat=Infinity;this.lastSeason=-1;
      this.tmpMatrix=new THREE.Matrix4();this.tmpQuat=new THREE.Quaternion();this.tmpPos=new THREE.Vector3();this.tmpScale=new THREE.Vector3();
    },

    clearTrees(){
      this.trees.trunk.count=0;
      for(const m of Object.values(this.trees.canopies))m.count=0;
    },

    refreshNearbyTrees(state,now){
      const moved=Number.isFinite(this.lastForestLng)?Math.sqrt(dist2M(state,{lng:this.lastForestLng,lat:this.lastForestLat})):Infinity;
      if(now-this.lastForestRefresh<650&&moved<28&&Math.abs(state.season-this.lastSeason)<.05)return;
      this.lastForestRefresh=now;this.lastForestLng=state.lng;this.lastForestLat=state.lat;this.lastSeason=state.season;

      if(!state.treesEnabled||state.cameraMode==='map'){this.clearTrees();return}

      const maxD2=450*450,nearby=[];
      for(const f of forestData.features){
        const [lng,lat]=f.geometry.coordinates,d2=dist2M(state,{lng,lat});
        if(d2<maxD2)nearby.push([d2,f]);
      }
      nearby.sort((a,b)=>a[0]-b[0]);
      const selected=nearby.slice(0,this.trees.maxInstances);
      let ti=0;
      const ci={round:0,umbrella:0,open:0,ceibo:0};
      const originElev=getTerrainElevation(origin.lng,origin.lat)??0;
      const wet=state.season>=.5;

      for(const [,f] of selected){
        const p=f.properties,[lng,lat]=f.geometry.coordinates;
        const off=geoOffsetM(origin,lng,lat),ground=getTerrainElevation(lng,lat);
        if(!Number.isFinite(ground))continue;
        const y=ground-originElev,h=Math.max(2.8,+p.height||7),canopy=Math.max(1.2,+p.canopyM||2.5),trunkR=Math.max(.035,+p.trunkRadiusM||.08);

        this.tmpPos.set(off.east,y+h*.43,off.north);
        this.tmpScale.set(trunkR,h*.68,trunkR);
        this.tmpMatrix.compose(this.tmpPos,this.tmpQuat,this.tmpScale);
        this.trees.trunk.setMatrixAt(ti++,this.tmpMatrix);

        const form=this.trees.canopies[p.form]?p.form:'round';
        const mesh=this.trees.canopies[form];
        const idx=ci[form]++;
        const canopyY=form==='ceibo'?h*.79:h*.73;
        this.tmpPos.set(off.east,y+canopyY,off.north);
        if(form==='umbrella')this.tmpScale.set(canopy*1.18,canopy*.46,canopy*1.18);
        else if(form==='open')this.tmpScale.set(canopy*.88,canopy*.74,canopy*.88);
        else if(form==='ceibo')this.tmpScale.set(canopy*1.08,canopy*.73,canopy*1.08);
        else this.tmpScale.set(canopy,canopy*.90,canopy);
        this.tmpMatrix.compose(this.tmpPos,this.tmpQuat,this.tmpScale);
        mesh.setMatrixAt(idx,this.tmpMatrix);
        mesh.setColorAt(idx,canopyColor(+p.deciduous===1,wet,+p.rand||.5));
      }

      this.trees.trunk.count=ti;this.trees.trunk.instanceMatrix.needsUpdate=true;
      for(const [form,mesh] of Object.entries(this.trees.canopies)){
        mesh.count=ci[form];mesh.instanceMatrix.needsUpdate=true;
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      }
    },

    render(gl,args){
      const state=getState(),now=performance.now();
      const dt=Math.min(.06,(now-this.lastT)/1000);this.lastT=now;
      const speedNorm=Math.min(1,Math.abs(state.speedMps)/(state.jogSpeedMps*state.sprintMultiplier));
      if(speedNorm>.015)this.walkPhase+=dt*(6.0+speedNorm*7.0);

      const originElev=getTerrainElevation(origin.lng,origin.lat)??0;
      const ground=getTerrainElevation(state.lng,state.lat),off=geoOffsetM(origin,state.lng,state.lat);
      this.agent.position.set(off.east,Number.isFinite(ground)?ground-originElev+.03:.03,off.north);
      this.agent.rotation.y=state.bearing*DEG;
      this.agent.visible=state.cameraMode==='follow';

      const rig=this.agent.userData.rig,swing=Math.sin(this.walkPhase)*.62*speedNorm;
      rig.leftLeg.rotation.x=swing;rig.rightLeg.rotation.x=-swing;
      rig.leftArm.rotation.x=-swing*.72;rig.rightArm.rotation.x=swing*.72;
      rig.head.rotation.y=Math.sin(this.walkPhase*.5)*.025*speedNorm;
      this.agent.position.y+=Math.abs(Math.sin(this.walkPhase*2))*.016*speedNorm;

      this.refreshNearbyTrees(state,now);

      const originMercator=maplibregl.MercatorCoordinate.fromLngLat([origin.lng,origin.lat],originElev);
      const scale=originMercator.meterInMercatorCoordinateUnits();
      const m=new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const l=new THREE.Matrix4().makeTranslation(originMercator.x,originMercator.y,originMercator.z).scale(new THREE.Vector3(scale,-scale,scale));
      this.camera.projectionMatrix=m.multiply(l);
      this.renderer.resetState();this.renderer.render(this.scene,this.camera);this.map.triggerRepaint();
    }
  };
}
