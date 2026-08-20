import * as THREE from 'three';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js';
import { CAMPUS, LANDMARKS } from './config.js';
import { createGameWorld as createBaseWorld } from './game3d.js?base';

const DEG = Math.PI / 180;
const METERS_LAT = 110574;
const METERS_LNG = 111320 * Math.cos(CAMPUS.spawn.lat * DEG);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lngLatToLocal = (lng, lat) => ({
  x: (lng - CAMPUS.spawn.lng) * METERS_LNG,
  z: -(lat - CAMPUS.spawn.lat) * METERS_LAT
});

const DOCUMENTED_BLOCK_LEVELS = [
  { match: /\b11\s*[- ]?a\b/i, levels: 3, source: 'FIEC 11A' },
  { match: /\b11\s*[- ]?b\b/i, levels: 2, source: 'FIEC 11B' },
  { match: /\b11\s*[- ]?c\b/i, levels: 2, source: 'FIEC 11C' },
  { match: /\b11\s*[- ]?d\b/i, levels: 2, source: 'FIEC 11D' },
  { match: /\b11\s*[- ]?f\b/i, levels: 2, source: 'FIEC 11F' },
  { match: /\b12\s*[- ]?i\b/i, levels: 2, source: 'FIMCP 12I' },
  { match: /\b12\s*[- ]?e\b/i, levels: 3, source: 'FIMCP 12E' },
  { match: /\b12\s*[- ]?g\b/i, levels: 2, source: 'FIMCP 12G' },
  { match: /\b24\s*[- ]?c\b/i, levels: 2, source: 'FIMCP 24C (archivo institucional)' }
];

const DOCUMENTED_LANDMARK_LEVELS = [
  { id: 'fiec-stop', levels: 3, radiusM: 24, source: 'FIEC 11A' },
  { id: 'fiec-11b', levels: 2, radiusM: 20, source: 'FIEC 11B' },
  { id: 'fiec-11f', levels: 2, radiusM: 20, source: 'FIEC 11F' },
  { id: 'aud-fimcp', levels: 2, radiusM: 24, source: 'FIMCP edificio principal' },
  { id: 'fimcp-24c', levels: 2, radiusM: 22, source: 'FIMCP 24C' }
];

function finite(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function polygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function eachCoord(coords, fn) {
  if (!Array.isArray(coords)) return;
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    fn(coords);
    return;
  }
  for (const child of coords) eachCoord(child, fn);
}

function geometryBounds(geometry) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  eachCoord(geometry?.coordinates, c => {
    minLng = Math.min(minLng, c[0]); maxLng = Math.max(maxLng, c[0]);
    minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]);
  });
  if (!Number.isFinite(minLng)) return null;
  return { minLng, maxLng, minLat, maxLat, lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 };
}

function distanceM(aLng, aLat, bLng, bLat) {
  const dx = (aLng - bLng) * 111320 * Math.cos(((aLat + bLat) * .5) * DEG);
  const dy = (aLat - bLat) * METERS_LAT;
  return Math.hypot(dx, dy);
}

function documentedLevels(properties, lng, lat) {
  const text = [properties?.name, properties?.ref, properties?.['addr:housename'], properties?.['building:part']]
    .filter(Boolean).join(' ');
  for (const rule of DOCUMENTED_BLOCK_LEVELS) if (rule.match.test(text)) return rule;

  let best = null;
  for (const rule of DOCUMENTED_LANDMARK_LEVELS) {
    const landmark = LANDMARKS.find(item => item.id === rule.id);
    if (!landmark) continue;
    const distance = distanceM(lng, lat, landmark.lng, landmark.lat);
    if (distance <= rule.radiusM && (!best || distance < best.distance)) best = { ...rule, distance };
  }
  return best;
}

function resolveVertical(record) {
  const p = record.properties || {};
  const b = geometryBounds(record.geometry);
  if (!b) return null;
  const explicitHeight = finite(p.render_height) ?? finite(p.height);
  const sourceLevels = finite(p.levels) ?? finite(p['building:levels']);
  const doc = explicitHeight == null && sourceLevels == null ? documentedLevels(p, b.lng, b.lat) : null;
  const levels = sourceLevels ?? doc?.levels ?? null;
  const base = Math.max(0, finite(p.render_min_height) ?? finite(p.min_height) ?? 0);
  const height = Math.max(base + 2.5, explicitHeight ?? (levels ? levels * 3.15 : 7.4));
  return {
    ...record,
    lng: b.lng,
    lat: b.lat,
    base,
    height,
    levels,
    heightSource: explicitHeight != null ? 'vector-height' : sourceLevels != null ? 'vector-levels' : doc ? `document:${doc.source}` : 'default-7.4m'
  };
}

function convertRing(ring) {
  const trimmed = ring?.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]
    ? ring.slice(0, -1)
    : ring || [];
  return trimmed.map(c => lngLatToLocal(c[0], c[1]));
}

function localPolygon(rings) {
  if (!rings?.length) return null;
  const outer = convertRing(rings[0]);
  if (outer.length < 3) return null;
  return { outer, holes: rings.slice(1).map(convertRing).filter(r => r.length >= 3) };
}

function shapeFromPolygon(poly) {
  const shape = new THREE.Shape();
  poly.outer.forEach((p, i) => i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z));
  shape.closePath();
  for (const ring of poly.holes) {
    const hole = new THREE.Path();
    ring.forEach((p, i) => i ? hole.lineTo(p.x, -p.z) : hole.moveTo(p.x, -p.z));
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

function polygonBounds(poly) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of poly.outer) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  return {
    minX, maxX, minZ, maxZ,
    x: (minX + maxX) * .5,
    z: (minZ + maxZ) * .5,
    hx: Math.max(.1, (maxX - minX) * .5),
    hz: Math.max(.1, (maxZ - minZ) * .5)
  };
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (((a.z > z) !== (b.z > z)) && x < (b.x - a.x) * (z - a.z) / ((b.z - a.z) || 1e-12) + a.x) inside = !inside;
  }
  return inside;
}

function pointInPolygon(x, z, poly) {
  if (!pointInRing(x, z, poly.outer)) return false;
  return !poly.holes.some(h => pointInRing(x, z, h));
}

function gridInsert(grid, cell, obj) {
  const minX = Math.floor((obj.x - obj.hx) / cell), maxX = Math.floor((obj.x + obj.hx) / cell);
  const minZ = Math.floor((obj.z - obj.hz) / cell), maxZ = Math.floor((obj.z + obj.hz) / cell);
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      const key = `${x}:${z}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(obj);
    }
  }
}

function buildSyncedRecords() {
  const registry = globalThis.__ESPOL_BUILDING_SYNC__;
  const features = registry?.getFeatures?.() || [];
  return features.map(resolveVertical).filter(Boolean).filter(b => polygons(b.geometry).length);
}

function syncMapLayer(records) {
  const registry = globalThis.__ESPOL_BUILDING_SYNC__;
  const map = registry?.map;
  if (!map || !records.length) return;
  const data = {
    type: 'FeatureCollection',
    features: records.map((b, i) => ({
      type: 'Feature', id: i,
      properties: {
        height: b.height,
        base: b.base,
        levels: b.levels ?? 0,
        heightSource: b.heightSource,
        name: b.properties?.name || '',
        ref: b.properties?.ref || ''
      },
      geometry: b.geometry
    }))
  };

  const existing = map.getSource('espol-buildings-synced');
  if (existing?.setData) existing.setData(data);
  else map.addSource('espol-buildings-synced', { type: 'geojson', data });

  if (!map.getLayer('espol-buildings-synced-3d')) {
    const before = (map.getStyle().layers || []).find(l => l.type === 'symbol' && l.layout?.['text-field'])?.id;
    map.addLayer({
      id: 'espol-buildings-synced-3d',
      type: 'fill-extrusion',
      source: 'espol-buildings-synced',
      minzoom: 14.2,
      paint: {
        'fill-extrusion-color': '#c8cbc5',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': .92,
        'fill-extrusion-vertical-gradient': false
      }
    }, before);
  }

  if (registry.rawSetLayoutProperty) {
    registry.internalLayoutChange = true;
    try {
      if (map.getLayer('espol-buildings-3d')) registry.rawSetLayoutProperty.call(map, 'espol-buildings-3d', 'visibility', 'none');
      registry.rawSetLayoutProperty.call(map, 'espol-buildings-synced-3d', 'visibility', 'visible');
    } finally {
      registry.internalLayoutChange = false;
    }
  }
}

function installExactBuildings(world, records) {
  world.buildingGroup.clear();
  world.buildingColliders = [];
  world.buildingGrid.clear();

  const material = new THREE.MeshBasicMaterial({ color: 0xbfc3bc, toneMapped: false });
  world.materials.building = material;
  const geometries = [];

  for (const record of records) {
    const ground = world.getElevation(record.lng, record.lat) - world.originElev;
    const depth = clamp(record.height - record.base, 2.5, 55);
    for (const rings of polygons(record.geometry)) {
      const poly = localPolygon(rings);
      if (!poly) continue;
      const shape = shapeFromPolygon(poly);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 1 });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, ground + record.base, 0);
      geometry.deleteAttribute('normal');
      geometry.deleteAttribute('uv');
      geometries.push(geometry);

      const box = polygonBounds(poly);
      const collider = { ...box, height: record.height, base: record.base };
      if (!pointInPolygon(0, 0, poly)) {
        world.buildingColliders.push(collider);
        gridInsert(world.buildingGrid, world.buildingCellM, collider);
      }
    }
  }

  if (geometries.length) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (merged) {
      merged.computeBoundingSphere();
      world.buildingGroup.add(new THREE.Mesh(merged, material));
    }
  }
  world.stats.colliders = world.buildingColliders.length;
}

export async function createGameWorld(options) {
  const world = await createBaseWorld(options);
  const baseSetStructures = world.setStructures.bind(world);

  world.setStructures = structures => {
    // Let the original engine create roads and reset its groups/collision index.
    baseSetStructures({ buildings: [], roads: structures?.roads || [] });
    const records = buildSyncedRecords();
    if (!records.length) {
      // Safety fallback: if MapLibre capture failed, retain the previous box pipeline.
      baseSetStructures(structures);
      console.warn('ESPOL building sync: no polygon features captured; fallback boxes enabled');
      return;
    }
    syncMapLayer(records);
    installExactBuildings(world, records);
    console.info(`ESPOL building sync: ${records.length} polygon footprints shared by Map and gameplay`);
  };

  return world;
}
