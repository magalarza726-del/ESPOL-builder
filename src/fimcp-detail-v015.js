import * as THREE from 'three';
import { CAMPUS, LANDMARKS } from './config.js';
import { FIMCP_PHOTO_SURVEY, FIMCP_PHOTO_SLICE, insideFIMCPPhotoSlice } from './fimcp-photo-survey.js';

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
function principalFrame(record) {
  const points = localOuter(record);
  const center = toLocal(record.lng, record.lat);
  let ex = { x: 1, z: 0 }, longest = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len > longest) { longest = len; ex = { x: dx / len, z: dz / len }; }
  }
  let ez = { x: -ex.z, z: ex.x };
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of points) {
    const dx = p.x - center.x, dz = p.z - center.z;
    const u = dx * ex.x + dz * ex.z, v = dx * ez.x + dz * ez.z;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  if (!Number.isFinite(minU)) return { center, ex, ez, width: 24, depth: 15, rotation: 0 };
  const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
  const c = { x: center.x + ex.x * midU + ez.x * midV, z: center.z + ex.z * midU + ez.z * midV };
  return {
    center: c, ex, ez,
    width: clamp(maxU - minU, 6, 120), depth: clamp(maxV - minV, 5, 90),
    rotation: Math.atan2(ez.x, ez.z)
  };
}
function mat(color, options = {}) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: !!options.transparent, opacity: options.opacity ?? 1, side: options.double ? THREE.DoubleSide : THREE.FrontSide });
}
function box(group, material, x, y, z, sx, sy, sz, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  m.position.set(x, y, z); m.rotation.y = ry; group.add(m); return m;
}
function cylinder(group, material, x, y, z, radius, height, radial = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radial), material);
  m.position.set(x, y, z); group.add(m); return m;
}
function sphere(group, material, x, y, z, sx, sy, sz, detail = 8) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, detail, Math.max(5, detail >> 1)), material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); group.add(m); return m;
}
function labelPlane(text, width, height, fg = '#f4f6f5', bg = 'rgba(0,0,0,0)', font = '700 62px Arial') {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bg !== 'rgba(0,0,0,0)') { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  mesh.userData.disposeTexture = texture; return mesh;
}
function frameGroup(world, record, name) {
  const frame = principalFrame(record);
  const ground = world.getElevation(record.lng, record.lat) - world.originElev;
  const group = new THREE.Group(); group.name = name; group.position.set(frame.center.x, ground, frame.center.z); group.rotation.y = frame.rotation;
  return { group, frame, ground };
}
function recordText(record) {
  const p = record.properties || {};
  return [p.name, p.ref, p['addr:housename'], p['building:part']].filter(Boolean).join(' ').toLowerCase();
}
function nearestRecord(records, landmark, max = 80, exclude = new Set()) {
  let best = null, dBest = max;
  for (const record of records) {
    if (exclude.has(record)) continue;
    const d = distanceM(record, landmark);
    if (d < dBest) { best = record; dBest = d; }
  }
  return best;
}
function pickLEMAT(records, auditorium) {
  const explicit = records.find(r => /lemat|12\s*[- ]?e/.test(recordText(r)));
  if (explicit) return explicit;
  if (!auditorium) return records[1] || records[0] || null;
  let best = null, scoreBest = Infinity;
  for (const r of records) {
    if (r === auditorium) continue;
    const f = principalFrame(r); const area = f.width * f.depth; const d = distanceM(r, auditorium);
    if (d < 18 || d > 125) continue;
    const score = Math.abs(d - 58) + Math.abs(Math.sqrt(area) - 23) * .65;
    if (score < scoreBest) { scoreBest = score; best = r; }
  }
  return best;
}

function addWindowStrip(group, materials, width, z, y, height = 1.15, segments = 8) {
  const usable = width * .82, gap = .22, w = Math.max(.7, usable / segments - gap);
  for (let i = 0; i < segments; i++) {
    const x = -usable / 2 + (i + .5) * usable / segments;
    box(group, materials.glass, x, y, z, w, height, .08);
  }
}
function addBlueParapet(group, materials, width, depth, y) {
  box(group, materials.blue, 0, y, depth / 2 + .12, width, .42, .28);
  box(group, materials.blue, 0, y, -depth / 2 - .12, width, .42, .28);
  box(group, materials.blue, width / 2 + .12, y, 0, .28, .42, depth);
  box(group, materials.blue, -width / 2 - .12, y, 0, .28, .42, depth);
}
function decorateAcademicBlock(world, root, record, materials, index) {
  const { group, frame } = frameGroup(world, record, `FIMCP-photo-block-${index}`);
  const h = clamp(record.height || 7.4, 4.2, 15);
  addBlueParapet(group, materials, frame.width * .97, frame.depth * .97, h + .15);
  const levels = Math.max(1, Math.round(h / 3.15));
  for (let level = 0; level < Math.min(3, levels); level++) {
    const y = 1.7 + level * 3.05;
    addWindowStrip(group, materials, frame.width, frame.depth / 2 + .14, y, 1.0, clamp(Math.round(frame.width / 3.2), 4, 14));
    addWindowStrip(group, materials, frame.width, -frame.depth / 2 - .14, y, 1.0, clamp(Math.round(frame.width / 3.2), 4, 14));
  }
  if (levels >= 2) box(group, materials.ochre, 0, 3.55, frame.depth / 2 + .25, frame.width * .94, .32, .20);
  root.add(group);
}
function decorateAuditorium(world, root, record, materials) {
  if (!record) return;
  const { group, frame } = frameGroup(world, record, 'FIMCP-Auditorium-photo-detail');
  const front = frame.depth / 2 + .18, w = frame.width, h = clamp(record.height || 8.5, 7, 13);
  addBlueParapet(group, materials, w, frame.depth, h + .25);
  box(group, materials.blueDark, -w * .30, h * .50, front + .50, w * .12, h * .78, 1.05);
  box(group, materials.blue, -w * .08, h * .73, front + .55, w * .46, .65, 1.20);
  addWindowStrip(group, materials, w * .54, front + .20, h * .46, 1.25, 6);
  for (let i = 0; i < 4; i++) box(group, materials.glass, -w * .18 + i * 1.45, 1.55, front + .57, 1.18, 2.75, .11);
  const sign = labelPlane('FIMCP - AUDITORIUM', Math.min(13, w * .46), 1.0, '#f5f7f5'); sign.position.set(-w * .08, h * .73, front + 1.18); group.add(sign);
  const steps = 6, stairW = Math.min(w * .58, 20);
  for (let i = 0; i < steps; i++) box(group, materials.paver, -w * .07, .09 + i * .14, front + 4.2 - i * .58, stairW - i * .34, .18 + i * .01, .68);
  box(group, materials.redPaver, -w * .07, .08, front + 5.35, stairW * .88, .10, 1.05);
  const exit = labelPlane('PUNTO DE ENCUENTRO', 2.7, .85, '#ffffff', '#138356', '700 46px Arial'); exit.position.set(-w * .36, 3.5, front + 1.05); group.add(exit);
  // Side service vocabulary visible in photos 04-05: screened bay + exposed pipes.
  box(group, materials.darkMetal, w * .48, 2.8, frame.depth * .12, .12, 4.8, frame.depth * .36);
  box(group, materials.pipe, w * .505, 3.9, frame.depth * .14, .22, .22, frame.depth * .26);
  box(group, materials.pipe, w * .505, 2.9, frame.depth * .24, .22, 2.2, .22);
  root.add(group);
}
function decorateLEMAT(world, root, record, materials) {
  if (!record) return;
  const { group, frame } = frameGroup(world, record, 'FIMCP-LEMAT-photo-detail');
  const front = frame.depth / 2 + .18, w = frame.width, h = clamp(record.height || 6.5, 4.8, 10);
  addBlueParapet(group, materials, w, frame.depth, h + .18);
  box(group, materials.glass, w * .12, h * .46, front + .20, w * .52, h * .62, .10);
  const cols = clamp(Math.round(w / 2.4), 5, 11);
  for (let i = 0; i <= cols; i++) box(group, materials.darkMetal, -w * .14 + i * (w * .52 / cols), h * .46, front + .28, .08, h * .62, .16);
  box(group, materials.wallLight, -w * .29, h * .42, front + .24, w * .24, h * .70, .24);
  const logo = labelPlane('●  ●  LEMAT', Math.min(8.5, w * .38), 1.55, '#21659b', 'rgba(235,232,219,.92)', '700 58px Arial'); logo.position.set(-w * .27, h * .45, front + .39); group.add(logo);
  // Service apron and small plant line visible in 10-11.
  box(group, materials.paver, 0, .035, front + 3.2, w * .92, .07, 5.6);
  for (let i = 0; i < 5; i++) sphere(group, materials.vegetation, -w * .31 + i * 1.35, .40, front + .80, .42, .46, .42, 7);
  root.add(group);
}
function addParkingAndCanopy(world, root, auditorium, materials) {
  if (!auditorium) return;
  const { group, frame } = frameGroup(world, auditorium, 'FIMCP-front-parking-photo-detail');
  const front = frame.depth / 2 + 12.5;
  box(group, materials.asphalt, 0, .025, front, Math.min(58, frame.width * 1.35), .05, 24);
  const lineMat = materials.marking;
  const stalls = 12, spread = Math.min(52, frame.width * 1.20);
  for (let i = 0; i <= stalls; i++) {
    const x = -spread / 2 + i * spread / stalls;
    box(group, lineMat, x, .065, front + 3.0, .09, .025, 5.2, -.24);
  }
  box(group, materials.marking, 0, .065, front - 2.0, spread, .025, .09);
  // Long blue shelter/canopy repeatedly visible in photos 05-09 and 66-68.
  const canopyZ = front + 8.8, canopyW = Math.min(38, frame.width * .90);
  box(group, materials.blue, 0, 3.05, canopyZ, canopyW, .26, 3.4);
  for (let i = 0; i < 7; i++) {
    const x = -canopyW / 2 + i * canopyW / 6;
    cylinder(group, materials.darkMetal, x, 1.55, canopyZ, .085, 3.1, 6);
  }
  // Double-head parking lamps.
  for (const x of [-spread * .30, spread * .30]) {
    cylinder(group, materials.darkMetal, x, 4.2, front - 4.5, .09, 8.4, 7);
    box(group, materials.darkMetal, x - .40, 8.25, front - 4.5, .85, .09, .12, .18);
    box(group, materials.darkMetal, x + .40, 8.25, front - 4.5, .85, .09, .12, -.18);
  }
  root.add(group);
}
function aabb(frame) {
  // Conservative AABB; sufficient only for finding an empty visual courtyard.
  const c = frame.center, r = Math.hypot(frame.width, frame.depth) * .5;
  return { minX: c.x - r, maxX: c.x + r, minZ: c.z - r, maxZ: c.z + r };
}
function findCourtyard(records) {
  if (records.length < 3) return null;
  const frames = records.map(principalFrame), boxes = frames.map(aabb);
  const cx = frames.reduce((s, f) => s + f.center.x, 0) / frames.length;
  const cz = frames.reduce((s, f) => s + f.center.z, 0) / frames.length;
  let best = null, bestScore = -Infinity;
  for (let x = cx - 55; x <= cx + 55; x += 5) for (let z = cz - 55; z <= cz + 55; z += 5) {
    let inside = false, nearest = Infinity, nearby = 0;
    for (const b of boxes) {
      if (x > b.minX - 3 && x < b.maxX + 3 && z > b.minZ - 3 && z < b.maxZ + 3) { inside = true; break; }
      const dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ);
      const d = Math.hypot(dx, dz); nearest = Math.min(nearest, d); if (d < 32) nearby++;
    }
    if (inside || nearest < 5 || nearby < 2) continue;
    const score = nearby * 9 - Math.hypot(x - cx, z - cz) * .18 - Math.abs(nearest - 10) * .25;
    if (score > bestScore) { bestScore = score; best = { x, z }; }
  }
  return best;
}
function addCourtyard(world, root, records, materials) {
  const p = findCourtyard(records); if (!p) return;
  const ll = { lng: CAMPUS.spawn.lng + p.x / METERS_LNG, lat: CAMPUS.spawn.lat - p.z / METERS_LAT };
  const ground = world.getElevation(ll.lng, ll.lat) - world.originElev;
  const group = new THREE.Group(); group.name = 'FIMCP-central-courtyard-photo-detail'; group.position.set(p.x, ground, p.z);
  box(group, materials.vegetation, 0, .055, 0, 17, .11, 11);
  box(group, materials.paver, 0, .075, 0, 2.0, .05, 15);
  box(group, materials.paver, 0, .078, 0, 21, .05, 1.6);
  for (const x of [-7.4, 7.4]) box(group, materials.hedge, x, .38, 0, 1.0, .72, 9.5);
  for (const [x, z] of [[-5,-3],[5,3],[0,4.2]]) {
    cylinder(group, materials.trunk, x, 2.25, z, .22, 4.5, 8);
    sphere(group, materials.canopy, x, 5.25, z, 2.6, 1.7, 2.6, 8);
  }
  root.add(group);
}
function addServiceYard(world, root, record, materials) {
  if (!record) return;
  const { group, frame } = frameGroup(world, record, 'FIMCP-service-yard-photo-detail');
  const side = frame.depth / 2 + 10;
  box(group, materials.paver, 0, .025, side, Math.min(32, frame.width * .85), .05, 14);
  // Orange industrial piping/equipment from photos 76-79.
  for (const x of [-5.5, -2.7, 2.4, 5.2]) {
    cylinder(group, materials.serviceOrange, x, 1.15, side + 1.7, .12, 2.3, 8);
    box(group, materials.serviceOrange, x + .55, 2.15, side + 1.7, 1.1, .18, .18);
  }
  box(group, materials.wallLight, 0, 1.45, side + 5.0, 10.5, 2.9, 4.8);
  box(group, materials.greenCabinet, 6.5, .75, side + 2.0, 1.2, 1.5, .65);
  root.add(group);
}
function addRoadsideSurveyDetail(world, root, roads, materials) {
  const candidates = [];
  for (const road of roads || []) {
    const lng = (road.a[0] + road.b[0]) * .5, lat = (road.a[1] + road.b[1]) * .5;
    if (!insideFIMCPPhotoSlice(lng, lat)) continue;
    const a = toLocal(road.a[0], road.a[1]), b = toLocal(road.b[0], road.b[1]);
    const len = Math.hypot(b.x - a.x, b.z - a.z); if (len < 7) continue;
    candidates.push({ road, a, b, len, lng, lat });
  }
  candidates.sort((a, b) => b.len - a.len);
  for (const item of candidates.slice(0, 5)) {
    const dx = item.b.x - item.a.x, dz = item.b.z - item.a.z, len = item.len;
    const yaw = Math.atan2(dx, dz), mx = (item.a.x + item.b.x) / 2, mz = (item.a.z + item.b.z) / 2;
    const ground = world.getElevation(item.lng, item.lat) - world.originElev;
    const g = new THREE.Group(); g.position.set(mx, ground, mz); g.rotation.y = yaw;
    box(g, materials.curbYellow, -(item.road.width || 3) * .62, .10, 0, .18, .20, len * .92);
    root.add(g);
  }
  // The final sequence (93-100) documents station/transport vocabulary. Place a
  // lightweight wayfinding cluster at the most exterior surveyed road point,
  // without modifying collision or claiming GPS precision.
  const station = candidates
    .sort((a, b) => (b.lng + b.lat * .15) - (a.lng + a.lat * .15))[0];
  if (!station) return;
  const ground = world.getElevation(station.lng, station.lat) - world.originElev;
  const p = toLocal(station.lng, station.lat);
  const g = new THREE.Group(); g.name = 'FIMCP-GBP-transport-vocabulary'; g.position.set(p.x, ground, p.z);
  box(g, materials.blueDark, 0, 1.25, 0, 2.5, 2.5, .18);
  const board = labelPlane('ESTACION GBP', 2.1, .52, '#ffffff', '#1e426a', '700 46px Arial'); board.position.set(0, 1.78, .11); g.add(board);
  box(g, materials.darkMetal, 4.2, .45, 0, 3.0, .14, .55); box(g, materials.darkMetal, 3.0, .72, 0, .12, 1.45, .55); box(g, materials.darkMetal, 5.4, .72, 0, .12, 1.45, .55);
  for (const x of [-8.5, -12.5]) { cylinder(g, materials.trunk, x, 3.2, 1.2, .34, 6.4, 8); sphere(g, materials.canopy, x, 7.1, 1.2, 3.3, 2.0, 3.3, 8); }
  for (const x of [9, 13]) { cylinder(g, materials.trunk, x, 3.3, 1.0, .30, 6.6, 8); sphere(g, materials.palm, x, 7.3, 1.0, 2.1, .80, 2.1, 8); }
  root.add(g);
}

export function installFIMCPPhotoReconstruction(world, records = [], structures = {}) {
  if (!world || world.__fimcpPhotoDetailV015) return world;
  world.__fimcpPhotoDetailV015 = true;
  const fimcpRecords = records.filter(r => insideFIMCPPhotoSlice(r.lng, r.lat) && polygons(r.geometry).length);
  const audLandmark = LANDMARKS.find(l => l.id === 'aud-fimcp');
  const blockLandmark = LANDMARKS.find(l => l.id === 'fimcp-24c');
  const auditorium = audLandmark ? nearestRecord(fimcpRecords, audLandmark, 65) : null;
  const lemat = pickLEMAT(fimcpRecords, auditorium);
  const block24 = blockLandmark ? nearestRecord(fimcpRecords, blockLandmark, 60, new Set([auditorium, lemat])) : null;

  const P = FIMCP_PHOTO_SURVEY.palette;
  const materials = {
    wall: mat(P.wall), wallLight: mat(P.wallLight), blue: mat(P.espolBlue), blueDark: mat(P.blueDark),
    glass: mat(P.glass, { transparent: true, opacity: .93 }), ochre: mat(P.upperOchre),
    rail: mat(P.railYellow), paver: mat(P.paver), redPaver: mat(0xa87368), asphalt: mat(P.asphalt),
    marking: mat(0xe8e7df), curbYellow: mat(P.curbYellow), serviceOrange: mat(P.serviceOrange),
    vegetation: mat(P.vegetation), hedge: mat(0x3f633a), trunk: mat(0x6b4c35), canopy: mat(0x4d7048), palm: mat(0x608248),
    darkMetal: mat(0x313a3e), pipe: mat(0xc38f57), greenCabinet: mat(0x486b51)
  };

  const root = new THREE.Group(); root.name = 'FIMCP-photo-reconstruction-v015';
  root.userData.photoSurvey = FIMCP_PHOTO_SURVEY.id;
  root.userData.photoCount = FIMCP_PHOTO_SURVEY.photoCount;
  root.userData.methodology = FIMCP_PHOTO_SURVEY.methodology;
  world.scene.add(root);

  // Dress the synchronized GIS masses instead of replacing their footprints.
  const generic = fimcpRecords
    .filter(r => r !== auditorium && r !== lemat)
    .sort((a, b) => distanceM(a, audLandmark || a) - distanceM(b, audLandmark || b))
    .slice(0, 10);
  generic.forEach((record, index) => decorateAcademicBlock(world, root, record, materials, index));
  decorateAuditorium(world, root, auditorium, materials);
  decorateLEMAT(world, root, lemat, materials);
  addParkingAndCanopy(world, root, auditorium, materials);
  addCourtyard(world, root, fimcpRecords.slice(0, 14), materials);
  addServiceYard(world, root, block24 || generic.at(-1), materials);
  addRoadsideSurveyDetail(world, root, structures.roads || [], materials);

  world.fimcpPhotoReport = Object.freeze({
    surveyId: FIMCP_PHOTO_SURVEY.id,
    photosUsed: FIMCP_PHOTO_SURVEY.photoCount,
    fullResolutionEvidence: FIMCP_PHOTO_SURVEY.originalResolutionPhotos.length,
    pdfFallbackEvidence: FIMCP_PHOTO_SURVEY.pdfFallbackRange[1] - FIMCP_PHOTO_SURVEY.pdfFallbackRange[0] + 1,
    syncedFootprintsInSlice: fimcpRecords.length,
    decoratedFootprints: generic.length + (auditorium ? 1 : 0) + (lemat ? 1 : 0),
    auditoriumResolved: !!auditorium,
    lematResolved: !!lemat,
    block24Resolved: !!block24,
    placementAccuracy: 'GIS anchored; photo route relative where EXIF GPS is absent'
  });
  world.getFIMCPPhotoReport = () => world.fimcpPhotoReport;
  return world;
}
