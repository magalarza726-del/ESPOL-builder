import * as THREE from 'three';
import { CAMPUS, LANDMARKS } from './config.js';

const DEG = Math.PI / 180;
const METERS_LAT = 110574;
const METERS_LNG = 111320 * Math.cos(CAMPUS.spawn.lat * DEG);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lngLatToLocal = (lng, lat) => ({
  x: (lng - CAMPUS.spawn.lng) * METERS_LNG,
  z: -(lat - CAMPUS.spawn.lat) * METERS_LAT
});

function distanceM(aLng, aLat, bLng, bLat) {
  const dx = (aLng - bLng) * 111320 * Math.cos(((aLat + bLat) * .5) * DEG);
  const dz = (aLat - bLat) * METERS_LAT;
  return Math.hypot(dx, dz);
}

function polygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function localOuter(record) {
  const poly = polygons(record?.geometry)[0];
  if (!poly?.[0]?.length) return [];
  const ring = poly[0];
  const trimmed = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]
    ? ring.slice(0, -1)
    : ring;
  return trimmed.map(c => lngLatToLocal(c[0], c[1]));
}

function principalFrame(points, fallbackCenter) {
  let ex = { x: 1, z: 0 };
  let longest = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len > longest) {
      longest = len;
      ex = { x: dx / len, z: dz / len };
    }
  }
  let ez = { x: -ex.z, z: ex.x };
  // Rectorado's public/lawn facade faces generally south in the campus frame.
  // Local +Z in this engine is south, so choose the equivalent axis sign that
  // makes the decorative facade face the road/lawn instead of the rear service side.
  if (ez.z < 0) {
    ex = { x: -ex.x, z: -ex.z };
    ez = { x: -ez.x, z: -ez.z };
  }

  const origin = fallbackCenter;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of points) {
    const dx = p.x - origin.x, dz = p.z - origin.z;
    const u = dx * ex.x + dz * ex.z;
    const v = dx * ez.x + dz * ez.z;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  if (!Number.isFinite(minU)) return { center: origin, ex, ez, width: 58, depth: 28 };
  const midU = (minU + maxU) * .5, midV = (minV + maxV) * .5;
  return {
    center: {
      x: origin.x + ex.x * midU + ez.x * midV,
      z: origin.z + ex.z * midU + ez.z * midV
    },
    ex, ez,
    width: clamp(maxU - minU, 46, 88),
    depth: clamp(maxV - minV, 20, 42)
  };
}

function mat(color, { transparent = false, opacity = 1 } = {}) {
  return new THREE.MeshBasicMaterial({ color, transparent, opacity, toneMapped: false });
}

function box(group, material, x, y, z, sx, sy, sz, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  group.add(mesh);
  return mesh;
}

function sphere(group, material, x, y, z, sx, sy, sz, detail = 10) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, detail, Math.max(6, detail >> 1)), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  group.add(mesh);
  return mesh;
}

function cylinder(group, material, x, y, z, radius, height, radial = 10, rx = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radial), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  mesh.rotation.z = rz;
  group.add(mesh);
  return mesh;
}

function labelPlane(text, width, height, fg = '#24303a', bg = 'rgba(0,0,0,0)', font = '700 72px Arial') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bg !== 'rgba(0,0,0,0)') {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false })
  );
  mesh.userData.disposeTexture = texture;
  return mesh;
}

function addPhotovoltaicArray(group, width, depth, roofY) {
  // ESPOL research documents 180 modules on the 6A Rectorado roof. Render all
  // 180 as one InstancedMesh to preserve that identity without 180 draw calls.
  const cols = 18, rows = 10, count = cols * rows;
  const panel = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, .045, 1),
    mat(0x33454e),
    count
  );
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.10, 0, 0));
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const panelW = Math.min(1.45, width * .62 / cols);
  const panelD = Math.min(1.85, depth * .30 / rows);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -width * .31 + (c + .5) * (width * .62 / cols);
      const z = -depth * .30 + (r + .5) * (depth * .28 / rows);
      pos.set(x, roofY + .18 + r * .012, z);
      scale.set(panelW * .92, 1, panelD * .88);
      matrix.compose(pos, q, scale);
      panel.setMatrixAt(i++, matrix);
    }
  }
  panel.instanceMatrix.needsUpdate = true;
  group.add(panel);
}

function addTurtle(group, x, z, groundY) {
  const bronze = mat(0x454a49);
  const dark = mat(0x343938);
  sphere(group, bronze, x, groundY + 1.05, z, 2.15, .82, 1.58, 12);
  sphere(group, dark, x, groundY + 1.02, z + 1.56, .70, .62, .72, 10);
  for (const [dx, dz] of [[-1.52,1.00],[1.52,1.00],[-1.48,-.92],[1.48,-.92]]) {
    sphere(group, dark, x + dx, groundY + .50, z + dz, .56, .34, .78, 8);
  }
  cylinder(group, dark, x, groundY + .56, z - 1.65, .18, 1.1, 8, Math.PI / 2, 0);
}

function addSealMonument(group, x, z, groundY) {
  const charcoal = mat(0x272f35);
  const darker = mat(0x1b2227);
  const cyan = mat(0x68a7b5);
  box(group, darker, x, groundY + .20, z, 4.0, .40, 3.0);
  box(group, charcoal, x, groundY + 1.40, z, 2.3, 2.4, 1.65);
  box(group, charcoal, x + .10, groundY + 3.45, z, 1.55, 2.0, 1.25, -0.10);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, .22, 28), cyan);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(x, groundY + 6.15, z + .05);
  group.add(disc);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, .235, 28), mat(0xd9e6e7));
  inner.rotation.x = Math.PI / 2;
  inner.position.set(x, groundY + 6.15, z + .07);
  group.add(inner);
  const sealText = labelPlane('ESPOL', 2.15, .55, '#274b5a');
  sealText.position.set(x, groundY + 6.12, z + .20);
  group.add(sealText);
}

function addBust(group, x, z, groundY) {
  const stone = mat(0x343a3c);
  box(group, stone, x, groundY + .85, z, 1.15, 1.7, 1.05);
  sphere(group, stone, x, groundY + 2.15, z, .38, .48, .36, 10);
  box(group, stone, x, groundY + 1.72, z, .72, .38, .48);
}

function rectCollider(centerX, centerZ, width, depth, rotation) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const corners = [
    [-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]
  ].map(([x,z]) => ({ x: centerX + x*c + z*s, z: centerZ - x*s + z*c }));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of corners) {
    minX = Math.min(minX,p.x); maxX = Math.max(maxX,p.x); minZ = Math.min(minZ,p.z); maxZ = Math.max(maxZ,p.z);
  }
  return {
    x:(minX+maxX)/2,z:(minZ+maxZ)/2,hx:(maxX-minX)/2,hz:(maxZ-minZ)/2,
    minX,maxX,minZ,maxZ,
    polygon:{outer:corners,holes:[]},height:8,base:0
  };
}

function gridInsert(grid, cell, obj) {
  const minX = Math.floor((obj.x - obj.hx) / cell), maxX = Math.floor((obj.x + obj.hx) / cell);
  const minZ = Math.floor((obj.z - obj.hz) / cell), maxZ = Math.floor((obj.z + obj.hz) / cell);
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
    const k = `${x}:${z}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(obj);
  }
}

export function installRectoradoDetail(world, records = []) {
  const landmark = LANDMARKS.find(x => x.id === 'rectorado');
  if (!world || !landmark) return;

  let record = null;
  let best = Infinity;
  for (const candidate of records) {
    const d = distanceM(candidate.lng, candidate.lat, landmark.lng, landmark.lat);
    if (d < best && d < 75) { best = d; record = candidate; }
  }

  const landmarkLocal = lngLatToLocal(landmark.lng, landmark.lat);
  const points = localOuter(record);
  const recordCenter = record ? lngLatToLocal(record.lng, record.lat) : landmarkLocal;
  const frame = principalFrame(points, recordCenter);
  const width = frame.width;
  const depth = frame.depth;
  const rotation = Math.atan2(frame.ez.x, frame.ez.z);
  const ll = record || landmark;
  const ground = world.getElevation(ll.lng, ll.lat) - world.originElev;
  const bodyHeight = clamp(Math.max(record?.height || 7.4, 8.4), 8.4, 11.5);

  const group = new THREE.Group();
  group.name = 'Rectorado-6A-detail';
  group.position.set(frame.center.x, ground, frame.center.z);
  group.rotation.y = rotation;

  const ivory = mat(0xd8d5c8);
  const light = mat(0xe7e4da);
  const glass = mat(0x34434a, { transparent: true, opacity: .92 });
  const roof = mat(0xaeb7b8);
  const dark = mat(0x283238);
  const lawn = mat(0x6c8050);
  const hedge = mat(0x355a35);
  const flowers = mat(0xc45b35);
  const red = mat(0x8f3430);

  // Lawn apron and front planting bands visible in all supplied Rectorado photos.
  box(group, lawn, 0, .035, depth/2 + 8.4, width * .92, .07, 15.0);
  box(group, hedge, -width*.10, .42, depth/2 + 1.45, width*.55, .78, 1.15);
  box(group, flowers, -width*.10, .86, depth/2 + 1.55, width*.55, .16, .78);

  // Main glazed facade: tall full-height bays separated by broad ivory piers.
  const facadeW = width * .78;
  const frontZ = depth/2 + .08;
  box(group, glass, 0, 3.20, frontZ + .10, facadeW, 5.25, .12);
  const bays = 8;
  for (let i = 0; i <= bays; i++) {
    const x = -facadeW/2 + i * facadeW/bays;
    box(group, ivory, x, 3.25, frontZ + .34, .58, 6.5, .76);
  }
  box(group, ivory, 0, 6.35, frontZ + .18, facadeW + .8, .60, 1.10);

  // Upper horizontal office strip and central clerestory/skylight volume.
  box(group, glass, width*.12, bodyHeight - 1.20, frontZ + .10, width*.47, 1.15, .11);
  box(group, light, width*.06, bodyHeight + .52, -depth*.08, width*.48, 1.55, depth*.34);
  box(group, glass, width*.06, bodyHeight + .42, -depth*.08 + depth*.17 + .08, width*.41, .72, .08);
  box(group, roof, width*.06, bodyHeight + 1.38, -depth*.08, width*.50, .18, depth*.38);

  // Left angular entrance/canopy characteristic of the 6A facade.
  const left = new THREE.Group();
  left.position.set(-width*.36, 0, depth*.04);
  left.rotation.y = -0.18;
  box(left, ivory, 0, 3.15, depth*.43, width*.22, 6.3, .80);
  box(left, light, width*.02, 6.30, depth*.43, width*.28, .62, 3.0);
  box(left, glass, width*.02, 3.10, depth*.44 + .44, width*.17, 4.9, .10);
  group.add(left);

  // Side wing seen to the right of the main public facade.
  box(group, light, width*.40, 3.0, -depth*.04, width*.18, 5.8, depth*.72);
  box(group, glass, width*.40, 3.0, depth*.32 + .08, width*.14, 3.6, .10);

  // Compact runtime-generated signs instead of photographic textures.
  const espol = labelPlane('espol', Math.min(9.5, width*.16), 2.0, '#303b42', 'rgba(0,0,0,0)', '700 78px Arial');
  espol.position.set(-width*.33, bodyHeight + .20, frontZ + .55);
  group.add(espol);
  const sixA = labelPlane('6A', 1.5, 1.5, '#f1f3ee', '#26323a', '700 78px Arial');
  sixA.position.set(-width*.46, bodyHeight - 1.3, frontZ + .58);
  group.add(sixA);

  // 50 kW rooftop photovoltaic installation documented by ESPOL (180 modules).
  addPhotovoltaicArray(group, width, depth, bodyHeight + .35);

  // Red communications mast visible behind the roof in the supplied references.
  cylinder(group, red, width*.18, bodyHeight + 7.0, -depth*.28, .11, 12.0, 6);
  for (let y = bodyHeight + 2.2; y < bodyHeight + 12.0; y += 1.6) {
    box(group, red, width*.18, y, -depth*.28, 1.15, .08, .08);
  }

  // Emblem monument and iconic turtle sculpture on the front lawn.
  addSealMonument(group, width*.18, depth/2 + 11.2, 0);
  addTurtle(group, -width*.10, depth/2 + 9.1, 0);
  addBust(group, -width*.31, depth/2 + 5.4, 0);

  // Slim campus light poles along the front edge.
  for (const x of [-width*.47, width*.47]) {
    cylinder(group, dark, x, 5.3, depth/2 + 12.0, .09, 10.6, 6);
    box(group, dark, x + .38, 10.48, depth/2 + 12.0, .82, .12, .24, -0.08);
  }

  world.buildingGroup.add(group);
  world.rectoradoDetail = group;

  // Collide with the monument and turtle instead of letting the avatar pass through them.
  const monumentLocal = new THREE.Vector3(width*.18, 0, depth/2 + 11.2).applyAxisAngle(new THREE.Vector3(0,1,0), rotation);
  const turtleLocal = new THREE.Vector3(-width*.10, 0, depth/2 + 9.1).applyAxisAngle(new THREE.Vector3(0,1,0), rotation);
  for (const collider of [
    rectCollider(frame.center.x + monumentLocal.x, frame.center.z + monumentLocal.z, 4.2, 3.2, rotation),
    rectCollider(frame.center.x + turtleLocal.x, frame.center.z + turtleLocal.z, 4.8, 3.8, rotation)
  ]) {
    world.buildingColliders.push(collider);
    gridInsert(world.buildingGrid, world.buildingCellM, collider);
  }
  world.stats.colliders = world.buildingColliders.length;
}
