import * as THREE from 'three';
import { CAMPUS } from './config.js';
import { FIMCP_PHOTO_SURVEY } from './fimcp-photo-survey.js';
import { FIMCP_SPATIAL_CONTROL, insideFIMCPCore } from './fimcp-spatial-control.js';

const DEG = Math.PI / 180;
const METERS_LAT = 110574;
const METERS_LNG = 111320 * Math.cos(CAMPUS.spawn.lat * DEG);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toLocal = (lng, lat) => ({ x: (lng - CAMPUS.spawn.lng) * METERS_LNG, z: -(lat - CAMPUS.spawn.lat) * METERS_LAT });

function distanceM(a, b) {
  const dx = (a.lng - b.lng) * 111320 * Math.cos(((a.lat + b.lat) * .5) * DEG);
  const dz = (a.lat - b.lat) * METERS_LAT;
  return Math.hypot(dx, dz);
}
function polygons(geometry) {
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}
function localOuter(record) {
  const ring = polygons(record?.geometry)?.[0]?.[0] || [];
  const clean = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
  return clean.map(c => toLocal(c[0], c[1]));
}
function recordText(record) {
  const p = record?.properties || {};
  return [p.name, p.ref, p['addr:housename'], p['building:part'], p.description]
    .filter(Boolean).join(' ').toLowerCase();
}
function principalFrame(record) {
  const points = localOuter(record);
  const origin = toLocal(record.lng, record.lat);
  let ex = { x: 1, z: 0 }, longest = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len > longest) { longest = len; ex = { x: dx / len, z: dz / len }; }
  }
  let ez = { x: -ex.z, z: ex.x };
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of points) {
    const dx = p.x - origin.x, dz = p.z - origin.z;
    const u = dx * ex.x + dz * ex.z, v = dx * ez.x + dz * ez.z;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  if (!Number.isFinite(minU)) return { center: origin, ex, ez, width: 20, depth: 12, rotation: 0 };
  const midU = (minU + maxU) * .5, midV = (minV + maxV) * .5;
  const center = { x: origin.x + ex.x * midU + ez.x * midV, z: origin.z + ex.z * midU + ez.z * midV };
  return {
    center, ex, ez,
    width: clamp(maxU - minU, 4, 100),
    depth: clamp(maxV - minV, 4, 70),
    rotation: Math.atan2(ez.x, ez.z)
  };
}
function faceFrameToward(frame, point) {
  const target = toLocal(point.lng, point.lat);
  const vx = target.x - frame.center.x, vz = target.z - frame.center.z;
  if (vx * frame.ez.x + vz * frame.ez.z >= 0) return frame;
  const ex = { x: -frame.ex.x, z: -frame.ex.z };
  const ez = { x: -frame.ez.x, z: -frame.ez.z };
  return { ...frame, ex, ez, rotation: Math.atan2(ez.x, ez.z) };
}
function mat(color, options = {}) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: !!options.transparent, opacity: options.opacity ?? 1, side: options.double ? THREE.DoubleSide : THREE.FrontSide });
}
function box(group, material, x, y, z, sx, sy, sz, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z); mesh.rotation.y = ry; group.add(mesh); return mesh;
}
function cylinder(group, material, x, y, z, radius, height, radial = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radial), material);
  mesh.position.set(x, y, z); group.add(mesh); return mesh;
}
function sphere(group, material, x, y, z, sx, sy, sz, detail = 8) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, detail, Math.max(5, detail >> 1)), material);
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh); return mesh;
}
function labelPlane(text, width, height, fg = '#fff', bg = 'rgba(0,0,0,0)', font = '700 54px Arial') {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bg !== 'rgba(0,0,0,0)') { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 3);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  mesh.userData.disposeTexture = texture; return mesh;
}
function groupFor(world, record, name, facePoint) {
  const frame = facePoint ? faceFrameToward(principalFrame(record), facePoint) : principalFrame(record);
  const ground = world.getElevation(record.lng, record.lat) - world.originElev;
  const group = new THREE.Group(); group.name = name; group.position.set(frame.center.x, ground, frame.center.z); group.rotation.y = frame.rotation;
  return { group, frame, ground };
}
function nearestRecord(records, point, maxM = 28, used = new Set()) {
  let best = null, bestD = maxM;
  for (const r of records) {
    if (used.has(r)) continue;
    const d = distanceM(r, point);
    if (d < bestD) { best = r; bestD = d; }
  }
  return best;
}
function namedRecord(records, tokens, used = new Set()) {
  return records.find(r => !used.has(r) && tokens.some(t => recordText(r).includes(t))) || null;
}
function disposeGroup(group) {
  group?.traverse?.(obj => {
    obj.userData?.disposeTexture?.dispose?.();
    obj.geometry?.dispose?.();
    if (Array.isArray(obj.material)) obj.material.forEach(m => m?.dispose?.()); else obj.material?.dispose?.();
  });
  group?.removeFromParent?.();
}

function addParapetAndWindows(world, root, record, materials, name, facePoint, label = null) {
  if (!record) return null;
  const { group, frame } = groupFor(world, record, name, facePoint);
  const h = clamp(record.height || 7.4, 4.2, 14.5), front = frame.depth / 2 + .15;
  box(group, materials.blue, 0, h + .16, front, frame.width * .98, .42, .30);
  box(group, materials.blue, 0, h + .16, -front, frame.width * .98, .42, .30);
  const levels = Math.max(1, Math.min(3, Math.round(h / 3.15)));
  const n = clamp(Math.round(frame.width / 3.1), 4, 16);
  for (let level = 0; level < levels; level++) {
    const y = 1.65 + level * 3.05;
    const usable = frame.width * .82;
    for (let i = 0; i < n; i++) {
      const x = -usable / 2 + (i + .5) * usable / n;
      box(group, materials.glass, x, y, front + .04, Math.max(.65, usable / n - .22), 1.02, .08);
    }
  }
  if (levels >= 2) box(group, materials.ochre, 0, 3.48, front + .18, frame.width * .92, .28, .16);
  if (label) {
    const sign = labelPlane(label, Math.min(11, frame.width * .55), .82, '#f4f7f8', '#1767a5', '700 48px Arial');
    sign.position.set(0, Math.min(h - .35, 5.5), front + .31); group.add(sign);
  }
  root.add(group);
  return group;
}
function addAuditorium(world, root, record, materials, controls) {
  if (!record) return;
  const { group, frame } = groupFor(world, record, 'FIMCP-Auditorium-v016', controls.parking);
  const h = clamp(record.height || 8.5, 7, 12.5), front = frame.depth / 2 + .16;
  box(group, materials.blueDark, -frame.width * .31, h * .48, front + .52, frame.width * .12, h * .78, 1.05);
  box(group, materials.blue, -frame.width * .08, h * .73, front + .56, frame.width * .48, .66, 1.12);
  const sign = labelPlane('FIMCP - AUDITORIUM', Math.min(13, frame.width * .50), .95);
  sign.position.set(-frame.width * .08, h * .73, front + 1.18); group.add(sign);
  const glassW = frame.width * .46, bays = 5;
  for (let i = 0; i < bays; i++) box(group, materials.glass, -frame.width * .10 - glassW / 2 + (i + .5) * glassW / bays, 2.1, front + .34, glassW / bays - .18, 3.5, .10);
  for (let i = 0; i < 6; i++) box(group, materials.paver, -frame.width * .07, .08 + i * .13, front + 4.15 - i * .54, Math.min(20, frame.width * .58) - i * .30, .16, .64);
  root.add(group);
}
function addParking(world, root, materials, controls) {
  const p = controls.parking, a = controls.auditorium;
  const lp = toLocal(p.lng, p.lat), la = toLocal(a.lng, a.lat);
  const yaw = Math.atan2(la.x - lp.x, la.z - lp.z) - Math.PI / 2;
  const ground = world.getElevation(p.lng, p.lat) - world.originElev;
  const group = new THREE.Group(); group.name = 'FIMCP-parking-v016'; group.position.set(lp.x, ground, lp.z); group.rotation.y = yaw;
  box(group, materials.asphalt, 0, .025, 0, 64, .05, 34);
  for (let i = -6; i <= 6; i++) box(group, materials.marking, i * 4.25, .06, 4.5, .08, .02, 5.5, -.18);
  box(group, materials.marking, 0, .06, -1.2, 54, .02, .08);
  const canopyZ = 11.5, canopyW = 36;
  box(group, materials.blue, 0, 3.0, canopyZ, canopyW, .26, 3.2);
  for (let i = 0; i < 7; i++) cylinder(group, materials.darkMetal, -canopyW / 2 + i * canopyW / 6, 1.5, canopyZ, .085, 3, 6);
  for (const x of [-18, 18]) {
    cylinder(group, materials.darkMetal, x, 4.2, -7.5, .09, 8.4, 7);
    box(group, materials.darkMetal, x - .38, 8.25, -7.5, .82, .08, .12, .16);
    box(group, materials.darkMetal, x + .38, 8.25, -7.5, .82, .08, .12, -.16);
  }
  root.add(group);
}
function addComedorAndLandscape(world, root, record, materials, controls) {
  if (!record) return;
  const group = addParapetAndWindows(world, root, record, materials, 'FIMCP-Comedor-v016', controls.block24C, 'FIMCP');
  if (!group) return;
  for (const x of [-5.5, 0, 5.5]) {
    cylinder(group, materials.trunk, x, 2.4, 7.0, .24, 4.8, 8);
    sphere(group, materials.canopy, x, 5.8, 7.0, 2.6, 1.7, 2.6, 8);
  }
}
function addServiceDetail(world, root, record, materials) {
  if (!record) return;
  const { group, frame } = groupFor(world, record, 'FIMCP-service-detail-v016');
  const z = frame.depth / 2 + 4.0;
  for (const x of [-3.6, -1.3, 1.4, 3.7]) {
    cylinder(group, materials.orange, x, 1.0, z, .11, 2.0, 8);
    box(group, materials.orange, x + .48, 1.85, z, .96, .16, .16);
  }
  box(group, materials.green, 5.2, .72, z, 1.15, 1.44, .62);
  root.add(group);
}
function addTerminalMarker(world, root, materials, controls) {
  const p = controls.terminal, lp = toLocal(p.lng, p.lat);
  const ground = world.getElevation(p.lng, p.lat) - world.originElev;
  const group = new THREE.Group(); group.name = 'FIMCP-terminal-context-v016'; group.position.set(lp.x, ground, lp.z);
  const board = labelPlane('TERMINAL FIMCP', 3.6, .72, '#ffffff', '#1c4f78', '700 44px Arial'); board.position.set(0, 2.1, 0); group.add(board);
  cylinder(group, materials.darkMetal, -1.55, 1.0, 0, .06, 2.0, 6); cylinder(group, materials.darkMetal, 1.55, 1.0, 0, .06, 2.0, 6);
  root.add(group);
}

export function installFIMCPSpatialReconstruction(world, records = [], structures = {}) {
  if (!world || world.__fimcpSpatialV016) return world;
  world.__fimcpSpatialV016 = true;

  const old = world.scene.getObjectByName('FIMCP-photo-reconstruction-v015');
  if (old) disposeGroup(old);

  const controls = FIMCP_SPATIAL_CONTROL.points;
  const candidates = records.filter(r => insideFIMCPCore(r.lng, r.lat) && polygons(r.geometry).length)
    .filter(r => !/fiec|11b|11c|11d|11f|postgrado/.test(recordText(r)));
  const used = new Set();

  const auditorium = namedRecord(candidates, ['auditorio fimcp', '12h'], used) || nearestRecord(candidates, controls.auditorium, 24, used);
  if (auditorium) used.add(auditorium);
  const block18A = namedRecord(candidates, ['18-a', '18a', '12i'], used) || nearestRecord(candidates, controls.block18A, 24, used);
  if (block18A) used.add(block18A);
  const block24C = namedRecord(candidates, ['24c', '24-c'], used) || nearestRecord(candidates, controls.block24C, 24, used);
  if (block24C) used.add(block24C);
  const comedor = namedRecord(candidates, ['comedor fimcp'], used) || nearestRecord(candidates, controls.comedor, 20, used);
  if (comedor) used.add(comedor);
  const block24E = namedRecord(candidates, FIMCP_SPATIAL_CONTROL.unresolved.block24E.tokens, used);
  if (block24E) used.add(block24E);
  const lemat = namedRecord(candidates, FIMCP_SPATIAL_CONTROL.unresolved.lemat.tokens, used);
  if (lemat) used.add(lemat);

  const P = FIMCP_PHOTO_SURVEY.palette;
  const materials = {
    blue: mat(P.espolBlue), blueDark: mat(P.blueDark), glass: mat(P.glass, { transparent: true, opacity: .93 }),
    ochre: mat(P.upperOchre), paver: mat(P.paver), asphalt: mat(P.asphalt), marking: mat(0xe7e7df),
    darkMetal: mat(0x313a3e), trunk: mat(0x6b4c35), canopy: mat(0x4d7048), orange: mat(P.serviceOrange), green: mat(0x486b51)
  };

  const root = new THREE.Group(); root.name = 'FIMCP-spatial-reconstruction-v016';
  root.userData.methodology = FIMCP_SPATIAL_CONTROL.methodology;
  world.scene.add(root);

  addAuditorium(world, root, auditorium, materials, controls);
  addParapetAndWindows(world, root, block18A, materials, 'FIMCP-18A-v016', controls.auditorium, 'FIMCP 18-A');
  addParapetAndWindows(world, root, block24C, materials, 'FIMCP-24C-v016', controls.terminal, '24C');
  addComedorAndLandscape(world, root, comedor, materials, controls);
  if (block24E) addParapetAndWindows(world, root, block24E, materials, 'FIMCP-24E-v016', controls.block24C, '24E');
  if (lemat) {
    addParapetAndWindows(world, root, lemat, materials, 'FIMCP-LEMAT-v016', controls.auditorium, 'LEMAT');
    addServiceDetail(world, root, lemat, materials);
  } else if (block24E) addServiceDetail(world, root, block24E, materials);
  addParking(world, root, materials, controls);
  addTerminalMarker(world, root, materials, controls);

  const resolved = { auditorium: !!auditorium, block18A: !!block18A, block24C: !!block24C, comedor: !!comedor, block24E: !!block24E, lemat: !!lemat };
  world.fimcpSpatialReport = Object.freeze({
    version: FIMCP_SPATIAL_CONTROL.version,
    controlPoints: Object.keys(controls).length,
    candidateFootprints: candidates.length,
    resolved,
    unresolvedPhotoPlacement: Object.freeze([
      ...(lemat ? [] : ['LEMAT absolute footprint']),
      ...(block24E ? [] : ['24E absolute footprint']),
      'central courtyard camera positions 55-65'
    ]),
    scaleGuard: 'No generic building is positioned from photo order; GIS/control point required.'
  });
  world.getFIMCPSpatialReport = () => world.fimcpSpatialReport;
  world.fimcpDetailRoot = root;
  return world;
}
