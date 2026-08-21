import * as THREE from 'three';
import { CAMPUS } from './config.js';
import { FIMCP_SPATIAL_CONTROL } from './fimcp-spatial-control.js';

const DEG = Math.PI / 180;
const METERS_LAT = 110574;
const METERS_LNG = 111320 * Math.cos(CAMPUS.spawn.lat * DEG);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toLocal = (lng, lat) => ({ x: (lng - CAMPUS.spawn.lng) * METERS_LNG, z: -(lat - CAMPUS.spawn.lat) * METERS_LAT });
const toLngLat = (x, z) => ({ lng: CAMPUS.spawn.lng + x / METERS_LNG, lat: CAMPUS.spawn.lat - z / METERS_LAT });

function polygons(g) {
  if (g?.type === 'Polygon') return [g.coordinates];
  if (g?.type === 'MultiPolygon') return g.coordinates;
  return [];
}
function cleanRing(ring = []) {
  return ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
}
function bounds(g) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const walk = coords => {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number') {
      minLng = Math.min(minLng, coords[0]); maxLng = Math.max(maxLng, coords[0]);
      minLat = Math.min(minLat, coords[1]); maxLat = Math.max(maxLat, coords[1]); return;
    }
    for (const c of coords) walk(c);
  };
  walk(g?.coordinates);
  return Number.isFinite(minLng) ? { minLng, maxLng, minLat, maxLat, lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 } : null;
}
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (((a[1] > lat) !== (b[1] > lat)) && lng < (b[0] - a[0]) * (lat - a[1]) / ((b[1] - a[1]) || 1e-12) + a[0]) inside = !inside;
  }
  return inside;
}
function containsGeometry(g, lng, lat) {
  for (const rings of polygons(g)) {
    const outer = cleanRing(rings[0] || []);
    if (!pointInRing(lng, lat, outer)) continue;
    const inHole = (rings || []).slice(1).some(r => pointInRing(lng, lat, cleanRing(r)));
    if (!inHole) return true;
  }
  return false;
}
function rectGeometry(lng, lat, width, depth) {
  const hw = width / (2 * METERS_LNG), hh = depth / (2 * METERS_LAT);
  return { type: 'Polygon', coordinates: [[[lng-hw,lat-hh],[lng+hw,lat-hh],[lng+hw,lat+hh],[lng-hw,lat+hh],[lng-hw,lat-hh]]] };
}
function distanceM(a, b) {
  const dx = (a.lng - b.lng) * 111320 * Math.cos(((a.lat + b.lat) * .5) * DEG);
  const dz = (a.lat - b.lat) * METERS_LAT;
  return Math.hypot(dx, dz);
}
function recordCenter(record) {
  const b = bounds(record.geometry);
  return b ? { lng: record.lng ?? b.lng, lat: record.lat ?? b.lat } : null;
}
function runtimeRecord(b, index) {
  if (!Number.isFinite(b?.lng) || !Number.isFinite(b?.lat)) return null;
  const width = clamp(Number(b.width) || 22, 5, 110), depth = clamp(Number(b.depth) || 16, 5, 90);
  return { id: `runtime:${index}`, geometry: rectGeometry(b.lng, b.lat, width, depth), lng: b.lng, lat: b.lat, properties: { runtimeFallback: true } };
}
function controlRecords() {
  const P = FIMCP_SPATIAL_CONTROL.points;
  return [
    ['auditorium', 46, 30], ['block18A', 38, 22], ['comedor', 32, 20], ['block24C', 48, 26]
  ].map(([key, width, depth]) => {
    const p = P[key];
    return { id: `control:${p.id}`, geometry: rectGeometry(p.lng, p.lat, width, depth), lng: p.lng, lat: p.lat, properties: { controlFallback: true, faculty: 'FIMCP' } };
  });
}
function mergeRecords(structures = {}) {
  const captured = globalThis.__ESPOL_BUILDING_SYNC__?.getFeatures?.() || [];
  const out = captured.map((r, i) => ({ ...r, id: r.id ?? `gis:${i}` })).filter(r => polygons(r.geometry).length);
  for (const [i, b] of (structures.buildings || []).entries()) {
    const r = runtimeRecord(b, i); if (!r) continue;
    const c = recordCenter(r);
    if (!out.some(x => { const q = recordCenter(x); return q && distanceM(c, q) < 15; })) out.push(r);
  }
  for (const r of controlRecords()) {
    const c = recordCenter(r);
    if (!out.some(x => { const q = recordCenter(x); return q && distanceM(c, q) < 18; })) out.push(r);
  }
  return out;
}
function sampleGeometry(record, baseElevation) {
  const samples = [];
  const push = (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const elevation = baseElevation(lng, lat);
    if (Number.isFinite(elevation)) samples.push({ lng, lat, elevation });
  };
  for (const rings of polygons(record.geometry)) {
    const ring = cleanRing(rings[0] || []);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      push(a[0], a[1]);
      const A = toLocal(a[0], a[1]), B = toLocal(b[0], b[1]);
      const len = Math.hypot(B.x - A.x, B.z - A.z);
      const divisions = Math.max(1, Math.min(8, Math.ceil(len / 6)));
      for (let n = 1; n < divisions; n++) {
        const t = n / divisions;
        push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      }
    }
  }
  const b = bounds(record.geometry);
  if (b) {
    push(b.lng, b.lat);
    for (let ix = 1; ix <= 3; ix++) for (let iz = 1; iz <= 3; iz++) {
      const lng = b.minLng + (b.maxLng - b.minLng) * ix / 4;
      const lat = b.minLat + (b.maxLat - b.minLat) * iz / 4;
      if (containsGeometry(record.geometry, lng, lat)) push(lng, lat);
    }
  }
  return samples;
}
function shapeFromRings(rings) {
  const outer = cleanRing(rings[0] || []).map(c => toLocal(c[0], c[1]));
  if (outer.length < 3) return null;
  const shape = new THREE.Shape();
  outer.forEach((p, i) => i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z));
  shape.closePath();
  for (const holeRing of (rings || []).slice(1)) {
    const holePts = cleanRing(holeRing).map(c => toLocal(c[0], c[1]));
    if (holePts.length < 3) continue;
    const hole = new THREE.Path(); holePts.forEach((p, i) => i ? hole.lineTo(p.x, -p.z) : hole.moveTo(p.x, -p.z)); hole.closePath(); shape.holes.push(hole);
  }
  return shape;
}
function disposeGroup(group) {
  group?.traverse?.(o => { o.geometry?.dispose?.(); if (Array.isArray(o.material)) o.material.forEach(m => m?.dispose?.()); else o.material?.dispose?.(); });
  group?.removeFromParent?.();
}

export function buildFoundationModel(world, structures = {}) {
  if (!world?.getElevation) throw new Error('building-foundation-v018: world terrain sampler missing');
  const baseElevation = world.__terrainOnlyElevation || world.getElevation.bind(world);
  world.__terrainOnlyElevation = baseElevation;
  const records = mergeRecords(structures), foundations = [];
  for (const record of records) {
    const center = recordCenter(record); if (!center) continue;
    const samples = sampleGeometry(record, baseElevation); if (!samples.length) continue;
    const values = samples.map(s => s.elevation).sort((a,b) => a-b);
    const min = values[0], max = values.at(-1), median = values[Math.floor(values.length / 2)];
    // A building slab must never be intersected by the terrain. Put finished floor
    // just above the highest sampled terrain and fill the exposed difference with a foundation skirt.
    const floor = max + 0.10;
    foundations.push({
      id: String(record.id ?? record.key ?? `${center.lng}:${center.lat}`), record, center,
      minTerrain: min, maxTerrain: max, medianTerrain: median, floor,
      span: max - min, sampleCount: samples.length
    });
  }
  const model = {
    records: foundations,
    baseElevation,
    centerElevation(lng, lat) {
      let best = null, bestD = 1.8;
      for (const f of foundations) {
        const d = distanceM({lng,lat}, f.center);
        if (d < bestD) { best = f; bestD = d; }
      }
      return best ? best.floor : baseElevation(lng, lat);
    },
    walkElevation(lng, lat) {
      let best = null;
      for (const f of foundations) {
        if (!containsGeometry(f.record.geometry, lng, lat)) continue;
        if (!best || f.floor > best.floor) best = f;
      }
      return best ? best.floor : baseElevation(lng, lat);
    },
    foundationAt(lng, lat) {
      return foundations.find(f => containsGeometry(f.record.geometry, lng, lat)) || null;
    }
  };
  world.buildingFoundationModel = model;
  return model;
}

export function runWithFoundationCenters(world, model, fn) {
  const original = world.getElevation;
  world.getElevation = (lng, lat) => model.centerElevation(lng, lat);
  try { return fn(); } finally { world.getElevation = original; }
}

export function installFoundationSkirts(world, model) {
  const previous = world.scene.getObjectByName('BuildingFoundations-v018');
  if (previous) disposeGroup(previous);
  const root = new THREE.Group(); root.name = 'BuildingFoundations-v018';
  const mat = new THREE.MeshBasicMaterial({ color: 0x9c9d96, toneMapped: false });
  let meshes = 0;
  for (const f of model.records) {
    const depth = Math.max(.12, f.floor - f.minTerrain + .12);
    for (const rings of polygons(f.record.geometry)) {
      const shape = shapeFromRings(rings); if (!shape) continue;
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, f.minTerrain - world.originElev - .12, 0);
      const mesh = new THREE.Mesh(g, mat); root.add(mesh); meshes++;
    }
  }
  world.scene.add(root);
  world.__buildingFoundationRootV018 = root;
  world.__buildingFoundationV018 = true;
  world.buildingFoundationReport = {
    buildings: model.records.length,
    meshes,
    maxTerrainSpanM: model.records.reduce((m, f) => Math.max(m, f.span), 0),
    deepFoundations: model.records.filter(f => f.span > 2.5).length,
    sampleCount: model.records.reduce((n, f) => n + f.sampleCount, 0)
  };
}

export function installWalkSurface(world, model) {
  world.getWalkElevation = (lng, lat) => model.walkElevation(lng, lat);
  if (world.__walkSurfaceRenderV018) return;
  world.__walkSurfaceRenderV018 = true;
  const baseRender = world.render.bind(world);
  world.render = function(player, state, dt) {
    const rawGetElevation = this.getElevation;
    const playerPoint = { lng: player.lng, lat: player.lat };
    this.getElevation = (lng, lat) => {
      // Only substitute the player's own elevation query. Forest, roads and terrain keep
      // consuming the original terrain surface and cannot be lifted onto building slabs.
      if (distanceM(playerPoint, {lng,lat}) < 0.08) return model.walkElevation(lng, lat);
      return rawGetElevation(lng, lat);
    };
    try { return baseRender(player, state, dt); }
    finally { this.getElevation = rawGetElevation; }
  };
}

export function auditBuildingFoundations(world, model) {
  const hardErrors = [], warnings = [];
  if (!world.__buildingFoundationV018) hardErrors.push('building-foundation-v018-not-installed');
  if (!world.getWalkElevation) hardErrors.push('building-walk-surface-missing');
  if (!model?.records?.length) hardErrors.push('building-foundation-model-empty');
  for (const f of model?.records || []) {
    if (![f.minTerrain,f.maxTerrain,f.floor].every(Number.isFinite)) hardErrors.push(`nonfinite-foundation:${f.id}`);
    if (f.floor < f.maxTerrain + .05) hardErrors.push(`terrain-can-penetrate-floor:${f.id}`);
    if (f.span > 4.5) warnings.push(`steep-footprint:${f.id}:${f.span.toFixed(2)}m`);
  }
  return Object.freeze({
    ok: hardErrors.length === 0,
    degraded: hardErrors.length === 0 && warnings.length > 0,
    hardErrors: Object.freeze(hardErrors),
    warnings: Object.freeze(warnings),
    metrics: Object.freeze({ ...(world.buildingFoundationReport || {}) })
  });
}
