import * as THREE from 'three';

const DEG = Math.PI / 180;

function material(color, roughness = 0.72, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w, h, d, mat, y, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(0, y, z);
  return mesh;
}

function capsule(radius, length, mat) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 10), mat);
}

function limb(radius, length, mat, x, y, z = 0) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const mesh = capsule(radius, length, mat);
  mesh.position.y = -(length * 0.5 + radius);
  pivot.add(mesh);
  return pivot;
}

/**
 * Procedural, original survival-agent avatar.
 * Proportions are real-world metres: total height ~= 1.80 m.
 * Visual cues (sand-blond hair, field jacket, cargo trousers) evoke the requested
 * survival-horror archetype without reproducing a copyrighted game model.
 */
function buildAgent() {
  const root = new THREE.Group();
  root.name = 'ESPOL-survival-agent';

  const skin = material(0xd6aa83, 0.9);
  const hair = material(0xb08b55, 0.84);
  const jacket = material(0x6f563b, 0.82);
  const jacketDark = material(0x4b392a, 0.85);
  const shirt = material(0x182027, 0.88);
  const trousers = material(0x38414a, 0.92);
  const boots = material(0x17191b, 0.8);
  const belt = material(0x2a211a, 0.75);
  const metal = material(0x6d7579, 0.35, 0.5);

  // Feet / lower legs / upper legs. Hip joint ~= 0.94 m.
  const leftLeg = limb(0.075, 0.70, trousers, -0.105, 0.93);
  const rightLeg = limb(0.075, 0.70, trousers, 0.105, 0.93);
  leftLeg.children[0].position.y = -0.39;
  rightLeg.children[0].position.y = -0.39;
  root.add(leftLeg, rightLeg);

  const leftBoot = box(0.17, 0.13, 0.30, boots, 0.075, 0.07);
  const rightBoot = leftBoot.clone();
  leftBoot.position.x = -0.105;
  rightBoot.position.x = 0.105;
  root.add(leftBoot, rightBoot);

  // Pelvis, torso, jacket and shirt.
  root.add(box(0.37, 0.20, 0.22, trousers, 0.89));
  root.add(box(0.46, 0.54, 0.25, jacket, 1.20));
  const shirtPanel = box(0.20, 0.38, 0.012, shirt, 1.22, 0.132);
  root.add(shirtPanel);
  root.add(box(0.48, 0.07, 0.27, belt, 0.94));

  // Belt buckle and two simple pouches.
  root.add(box(0.07, 0.05, 0.03, metal, 0.95, 0.155));
  const pouchL = box(0.10, 0.13, 0.07, jacketDark, 0.89, 0.15);
  const pouchR = pouchL.clone();
  pouchL.position.x = -0.15;
  pouchR.position.x = 0.15;
  root.add(pouchL, pouchR);

  // Arms pivot at shoulders. Hands extend to around mid-thigh.
  const leftArm = limb(0.064, 0.54, jacket, -0.285, 1.43);
  const rightArm = limb(0.064, 0.54, jacket, 0.285, 1.43);
  root.add(leftArm, rightArm);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin);
  const handR = handL.clone();
  handL.position.set(-0.285, 0.81, 0);
  handR.position.set(0.285, 0.81, 0);
  root.add(handL, handR);

  // Neck + head. Overall top reaches about 1.80 m.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.11, 10), skin);
  neck.position.y = 1.51;
  root.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12), skin);
  head.scale.set(0.88, 1.12, 0.94);
  head.position.y = 1.68;
  root.add(head);

  // Asymmetric swept hair silhouette.
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.151, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.61), hair);
  hairCap.scale.set(0.94, 0.88, 1.0);
  hairCap.position.set(0, 1.755, -0.005);
  root.add(hairCap);
  const fringe = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.20, 5), hair);
  fringe.rotation.z = 72 * DEG;
  fringe.rotation.x = 22 * DEG;
  fringe.position.set(-0.07, 1.74, 0.12);
  root.add(fringe);

  // Shoulder harness: readable at close map zoom, still inexpensive.
  const strapL = box(0.035, 0.52, 0.025, jacketDark, 1.20, 0.142);
  const strapR = strapL.clone();
  strapL.position.x = -0.13;
  strapR.position.x = 0.13;
  root.add(strapL, strapR);

  root.userData.rig = { leftArm, rightArm, leftLeg, rightLeg, head };
  root.userData.baseY = 0;
  return root;
}

export function createPlayer3DLayer({ map, getState, getTerrainElevation }) {
  const layer = {
    id: 'player-agent-3d',
    type: 'custom',
    renderingMode: '3d',
    onAdd(mapInstance, gl) {
      this.map = mapInstance;
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      this.agent = buildAgent();
      this.scene.add(this.agent);

      this.scene.add(new THREE.HemisphereLight(0xe8f3ff, 0x415132, 2.0));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(-3, -5, 9).normalize();
      this.scene.add(sun);

      this.renderer = new THREE.WebGLRenderer({
        canvas: mapInstance.getCanvas(),
        context: gl,
        antialias: true
      });
      this.renderer.autoClear = false;
      this.lastT = performance.now();
      this.walkPhase = 0;
    },
    render(gl, args) {
      const state = getState();
      const elevation = getTerrainElevation(state.lng, state.lat);
      const fallbackAltitude = Number.isFinite(state.groundAltitudeM) ? state.groundAltitudeM : 88;
      const altitude = Number.isFinite(elevation) ? elevation + 0.04 : fallbackAltitude + 0.04;
      const mc = maplibregl.MercatorCoordinate.fromLngLat([state.lng, state.lat], altitude);
      const scale = mc.meterInMercatorCoordinateUnits();

      const now = performance.now();
      const dt = Math.min(0.06, (now - this.lastT) / 1000);
      this.lastT = now;
      const normalizedSpeed = Math.min(1, Math.abs(state.speedMps) / 4.25);
      if (normalizedSpeed > 0.03) this.walkPhase += dt * (6.2 + normalizedSpeed * 3.4);

      const rig = this.agent.userData.rig;
      const swing = Math.sin(this.walkPhase) * 0.58 * normalizedSpeed;
      rig.leftLeg.rotation.x = swing;
      rig.rightLeg.rotation.x = -swing;
      rig.leftArm.rotation.x = -swing * 0.72;
      rig.rightArm.rotation.x = swing * 0.72;
      rig.head.rotation.y = Math.sin(this.walkPhase * 0.5) * 0.035 * normalizedSpeed;
      this.agent.position.y = Math.abs(Math.sin(this.walkPhase * 2)) * 0.018 * normalizedSpeed;
      this.agent.rotation.y = -state.bearing * DEG;
      this.agent.visible = state.viewMode !== 'firstperson';

      const rotationX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      const mapMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const modelMatrix = new THREE.Matrix4()
        .makeTranslation(mc.x, mc.y, mc.z)
        .scale(new THREE.Vector3(scale, -scale, scale))
        .multiply(rotationX);

      this.camera.projectionMatrix = mapMatrix.multiply(modelMatrix);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.map.triggerRepaint();
    }
  };
  return layer;
}
