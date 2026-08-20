import fs from 'node:fs';

const runtimePath = 'src/runtime.js';
const gamePath = 'src/game3d.js';
const indexPath = 'index.html';

function replaceBetween(text, startMarker, endMarker, replacement) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker: ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker: ${endMarker}`);
  return text.slice(0, start) + replacement + text.slice(end);
}

let runtime = fs.readFileSync(runtimePath, 'utf8');
runtime = runtime.replace("const VERSION = 'v0.9.0 · STABILITY REFACTOR';", "const VERSION = 'v0.10.0 · BUILDING SYNC';");

const structuresBlock = String.raw`function createStructureAccumulator() {
  return { buildingsByKey: new Map(), roads: [], roadKeys: new Set() };
}

const DOCUMENTED_FLOOR_HINTS = [
  // FIEC: 11A tiene espacios 0xx/1xx/2xx; 11B, 11D y 11F documentan planta baja + alta.
  { landmarkId: 'fiec-stop', levels: 3, radiusM: 24, source: 'FIEC 11A · infraestructura oficial' },
  { landmarkId: 'fiec-11b', levels: 2, radiusM: 20, source: 'FIEC 11B · infraestructura oficial' },
  { landmarkId: 'fiec-11f', levels: 2, radiusM: 20, source: 'FIEC 11F · infraestructura oficial' },
  // FIMCP: su página oficial describe planta baja + planta alta para el edificio principal.
  { landmarkId: 'aud-fimcp', levels: 2, radiusM: 24, source: 'FIMCP · infraestructura oficial' },
  // La infraestructura histórica de FIMCP describe 24C con planta baja + planta alta.
  { landmarkId: 'fimcp-24c', levels: 2, radiusM: 22, source: 'FIMCP 24C · infraestructura oficial' }
];

function geometryPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function buildingGeometryBounds(geometry) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  eachCoord(geometry?.coordinates, coord => {
    minLng = Math.min(minLng, coord[0]); maxLng = Math.max(maxLng, coord[0]);
    minLat = Math.min(minLat, coord[1]); maxLat = Math.max(maxLat, coord[1]);
  });
  if (!Number.isFinite(minLng)) return null;
  return { minLng, maxLng, minLat, maxLat, lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 };
}

function ringAreaM2(ring, lat) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  const mx = metersPerDegreeLng(lat);
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * mx * ring[i][1] * METERS_PER_DEG_LAT - ring[i][0] * mx * ring[j][1] * METERS_PER_DEG_LAT;
  }
  return Math.abs(area) * 0.5;
}

function buildingGeometryAreaM2(geometry, lat) {
  let total = 0;
  for (const polygon of geometryPolygons(geometry)) {
    if (!polygon.length) continue;
    total += ringAreaM2(polygon[0], lat);
    for (let i = 1; i < polygon.length; i++) total -= ringAreaM2(polygon[i], lat);
  }
  return Math.max(0, total);
}

function documentedFloorHint(lng, lat) {
  let best = null;
  for (const hint of DOCUMENTED_FLOOR_HINTS) {
    const landmark = LANDMARKS.find(item => item.id === hint.landmarkId);
    if (!landmark) continue;
    const distance = haversine({ lng, lat }, landmark);
    if (distance <= hint.radiusM && (!best || distance < best.distance)) best = { ...hint, distance };
  }
  return best;
}

function resolveBuildingVertical(properties, lng, lat) {
  const p = properties || {};
  const explicitHeight = finiteNumber(p.render_height) ?? finiteNumber(p.height);
  const sourceLevels = finiteNumber(p.levels);
  const hint = explicitHeight == null && sourceLevels == null ? documentedFloorHint(lng, lat) : null;
  const levels = sourceLevels ?? hint?.levels ?? null;
  const height = explicitHeight ?? (levels ? levels * 3.15 : 7.4);
  const base = finiteNumber(p.render_min_height) ?? finiteNumber(p.min_height) ?? 0;
  return {
    height: Math.max(base + 2.5, height),
    base: Math.max(0, base),
    levels,
    documented: !!hint,
    heightSource: explicitHeight != null ? 'vector-height' : sourceLevels != null ? 'vector-levels' : hint?.source || 'default'
  };
}

function stableBuildingKey(feature, geometry, bounds) {
  const p = feature.properties || {};
  const stableId = feature.id ?? p.osm_id ?? p.osm_way_id ?? p.id;
  if (stableId != null) return `id:${stableId}`;
  const label = String(p.ref || p.name || p.class || 'building').slice(0, 50);
  return `${label}:${bounds.minLng.toFixed(6)}:${bounds.minLat.toFixed(6)}:${bounds.maxLng.toFixed(6)}:${bounds.maxLat.toFixed(6)}`;
}

function collectBuildingFeature(acc, feature) {
  if (!geometryPolygons(feature.geometry).length) return;
  const bounds = buildingGeometryBounds(feature.geometry);
  if (!bounds || !insideBounds(bounds.lng, bounds.lat, CAMPUS.bounds)) return;
  const areaM2 = buildingGeometryAreaM2(feature.geometry, bounds.lat);
  if (areaM2 < 3 || areaM2 > 90000) return;
  const vertical = resolveBuildingVertical(feature.properties, bounds.lng, bounds.lat);
  const key = stableBuildingKey(feature, feature.geometry, bounds);
  const building = {
    key,
    lng: bounds.lng,
    lat: bounds.lat,
    geometry: JSON.parse(JSON.stringify(feature.geometry)),
    height: vertical.height,
    base: vertical.base,
    levels: vertical.levels,
    heightSource: vertical.heightSource,
    documentedHeight: vertical.documented,
    areaM2,
    properties: {
      name: feature.properties?.name || '',
      ref: feature.properties?.ref || '',
      class: feature.properties?.class || ''
    }
  };
  const existing = acc.buildingsByKey.get(key);
  // Vector tiles pueden devolver el mismo edificio recortado en más de un tile: conservar la huella de mayor área.
  if (!existing || building.areaM2 > existing.areaM2) acc.buildingsByKey.set(key, building);
}

function roadWidth(properties = {}) {
  const cls = String(properties.class || properties.subclass || '').toLowerCase();
  if (cls.includes('motorway')) return 9;
  if (cls.includes('trunk')) return 8;
  if (cls.includes('primary')) return 7;
  if (cls.includes('secondary')) return 6;
  if (cls.includes('tertiary')) return 5;
  if (cls.includes('residential')) return 4;
  if (cls.includes('service')) return 3;
  if (cls.includes('path') || cls.includes('foot')) return 1.3;
  if (cls.includes('track')) return 2.2;
  return 3.2;
}

function collectLoadedStructures(acc) {
  try {
    for (const feature of map.querySourceFeatures('ofm', { sourceLayer: 'building' })) collectBuildingFeature(acc, feature);
  } catch (error) {
    console.warn('building extraction', error);
  }

  try {
    for (const feature of map.querySourceFeatures('ofm', { sourceLayer: 'transportation' })) {
      const lines = [];
      collectLines(feature.geometry?.coordinates, lines);
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i];
          const lng = (a[0] + b[0]) / 2, lat = (a[1] + b[1]) / 2;
          if (!insideBounds(lng, lat, CAMPUS.bounds)) continue;
          const forwardKey = `${a[0].toFixed(5)}:${a[1].toFixed(5)}:${b[0].toFixed(5)}:${b[1].toFixed(5)}`;
          const reverseKey = `${b[0].toFixed(5)}:${b[1].toFixed(5)}:${a[0].toFixed(5)}:${a[1].toFixed(5)}`;
          if (acc.roadKeys.has(forwardKey) || acc.roadKeys.has(reverseKey)) continue;
          acc.roadKeys.add(forwardKey);
          acc.roads.push({ a, b, width: roadWidth(feature.properties) });
          if (acc.roads.length >= 7500) return;
        }
      }
    }
  } catch (error) {
    console.warn('road extraction', error);
  }
}

function buildingFeatureCollection(buildings) {
  return {
    type: 'FeatureCollection',
    features: buildings.map((building, index) => ({
      type: 'Feature',
      id: index,
      properties: {
        height: building.height,
        base: building.base || 0,
        levels: building.levels ?? 0,
        heightSource: building.heightSource,
        documentedHeight: building.documentedHeight ? 1 : 0,
        name: building.properties?.name || '',
        ref: building.properties?.ref || ''
      },
      geometry: building.geometry
    }))
  };
}

function synchronizeBuildingMapLayer(buildings) {
  const data = buildingFeatureCollection(buildings);
  const source = map.getSource('espol-buildings-synced');
  if (source?.setData) source.setData(data);
  else safeAddSource('espol-buildings-synced', { type: 'geojson', data });

  safeAddLayer({
    id: 'espol-buildings-synced-3d',
    source: 'espol-buildings-synced',
    type: 'fill-extrusion',
    minzoom: 14.2,
    paint: {
      'fill-extrusion-color': '#c8cbc5',
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base'],
      'fill-extrusion-opacity': 0.92,
      'fill-extrusion-vertical-gradient': false
    }
  }, firstLabelLayer());
  if (map.getLayer('espol-buildings-3d')) map.setLayoutProperty('espol-buildings-3d', 'visibility', 'none');
  if (map.getLayer('espol-buildings-synced-3d')) map.setLayoutProperty('espol-buildings-synced-3d', 'visibility', state.buildingsEnabled ? 'visible' : 'none');
}

async function scanCampusStructures() {
  const acc = createStructureAccumulator();
  const xs = [-79.9710,-79.9650,-79.9590,-79.9530,-79.9470];
  const ys = [-2.1530,-2.1470,-2.1410,-2.1350];
  const total = xs.length * ys.length;
  let done = 0;
  for (const lat of ys) {
    for (const lng of xs) {
      map.jumpTo({ center: [lng, lat], zoom: 17.8, pitch: 0, bearing: 0 });
      await waitForMapIdle(720);
      collectLoadedStructures(acc);
      done++;
      loadingStep(62 + done / total * 18, `Sincronizando huellas ESPOL · sector ${done}/${total} · ${acc.buildingsByKey.size} edificios`);
    }
  }
  const buildings = Array.from(acc.buildingsByKey.values()).slice(0, 3500);
  synchronizeBuildingMapLayer(buildings);
  focusCampus({ duration: 0 });
  return { buildings, roads: acc.roads.slice(0, 7500) };
}

`;
runtime = replaceBetween(runtime, 'function createStructureAccumulator() {', 'function bindLookControls() {', structuresBlock + 'function bindLookControls() {');

runtime = runtime.replace(
  "if (map.getLayer('espol-buildings-3d')) map.setLayoutProperty('espol-buildings-3d', 'visibility', state.buildingsEnabled ? 'visible' : 'none');",
  "for (const id of ['espol-buildings-synced-3d','espol-buildings-3d']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', id === 'espol-buildings-synced-3d' && state.buildingsEnabled ? 'visible' : 'none');"
);
runtime = runtime.replace(
  "loadingStep(84, `Construyendo campus · ${structures.buildings.length} edificios · ${structures.roads.length} tramos`);",
  "loadingStep(84, `Construyendo huellas sincronizadas · ${structures.buildings.length} edificios · ${structures.roads.length} tramos`);"
);
runtime = runtime.replace(
  "notify(`${VERSION} · ${structures.buildings.length} edificios · runtime estabilizado`);",
  "notify(`${VERSION} · ${structures.buildings.length} huellas idénticas en Mapa y 3D`);"
);

let game = fs.readFileSync(gamePath, 'utf8');
if (!game.includes('BufferGeometryUtils')) {
  game = game.replace("import * as THREE from 'three';", "import * as THREE from 'three';\nimport { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js';");
}

const polygonHelpers = String.raw`
function polygonRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}
function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    const crosses = ((a.z > z) !== (b.z > z)) && (x < (b.x - a.x) * (z - a.z) / ((b.z - a.z) || 1e-12) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}
function pointInPolygon(x, z, polygon) {
  if (!polygon?.outer?.length || !pointInRing(x, z, polygon.outer)) return false;
  return !(polygon.holes || []).some(hole => pointInRing(x, z, hole));
}
function orient2d(a, b, c) { return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x); }
function segmentsIntersect2d(a, b, c, d) {
  const o1 = orient2d(a, b, c), o2 = orient2d(a, b, d), o3 = orient2d(c, d, a), o4 = orient2d(c, d, b);
  return ((o1 > 0) !== (o2 > 0)) && ((o3 > 0) !== (o4 > 0));
}
function segmentSegmentDistanceSq(a, b, c, d) {
  if (segmentsIntersect2d(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistanceSq(a.x, a.z, b.x, b.z, c.x, c.z),
    pointSegmentDistanceSq(a.x, a.z, b.x, b.z, d.x, d.z),
    pointSegmentDistanceSq(c.x, c.z, d.x, d.z, a.x, a.z),
    pointSegmentDistanceSq(c.x, c.z, d.x, d.z, b.x, b.z)
  );
}
function segmentPolygonBlocked(a, b, polygon, radius) {
  if (pointInPolygon(a.x, a.z, polygon) || pointInPolygon(b.x, b.z, polygon)) return true;
  const r2 = radius * radius;
  for (const ring of [polygon.outer, ...(polygon.holes || [])]) {
    for (let i = 0; i < ring.length; i++) {
      const c = ring[i], d = ring[(i + 1) % ring.length];
      if (segmentSegmentDistanceSq(a, b, c, d) <= r2) return true;
    }
  }
  return false;
}
function localPolygonFromRings(rings) {
  if (!rings?.length) return null;
  const convert = ring => ring.slice(0, -1).map(coord => {
    const p = lngLatToLocal(coord[0], coord[1]);
    return { x: p.x, z: p.z };
  });
  const outer = convert(rings[0]);
  if (outer.length < 3) return null;
  const holes = rings.slice(1).map(convert).filter(ring => ring.length >= 3);
  return { outer, holes };
}
function boundsForLocalPolygon(polygon) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of polygon.outer) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ, x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, hx: (maxX - minX) / 2, hz: (maxZ - minZ) / 2 };
}
function shapeFromLocalPolygon(polygon) {
  const shape = new THREE.Shape();
  polygon.outer.forEach((p, i) => i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z));
  shape.closePath();
  for (const holeRing of polygon.holes) {
    const hole = new THREE.Path();
    holeRing.forEach((p, i) => i ? hole.lineTo(p.x, -p.z) : hole.moveTo(p.x, -p.z));
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}
`;
if (!game.includes('function polygonRings(')) {
  game = game.replace('class TerrariumHeightCache {', polygonHelpers + '\nclass TerrariumHeightCache {');
}

const setStructuresBlock = String.raw`  setStructures({ buildings = [], roads = [] } = {}) {
    this.buildingGroup.clear();
    this.roadGroup.clear();
    this.buildingColliders = [];
    this.buildingGrid.clear();

    if (buildings.length) {
      const material = flatMat(0xbfc3bc);
      this.materials.building = material;
      const geometries = [];

      for (const building of buildings) {
        const height = clamp((building.height || 7.4) - (building.base || 0), 2.5, 55);
        const base = Math.max(0, building.base || 0);
        const centerGround = this.getElevation(building.lng, building.lat) - this.originElev;
        for (const rings of polygonRings(building.geometry)) {
          const polygon = localPolygonFromRings(rings);
          if (!polygon) continue;
          const shape = shapeFromLocalPolygon(polygon);
          const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 1 });
          geometry.rotateX(-Math.PI / 2);
          geometry.translate(0, centerGround + base, 0);
          geometry.deleteAttribute('normal');
          geometry.deleteAttribute('uv');
          geometries.push(geometry);

          const bounds = boundsForLocalPolygon(polygon);
          const collider = { ...bounds, polygon, height: base + height, base };
          const containsSpawn = pointInPolygon(0, 0, polygon);
          if (!containsSpawn) {
            this.buildingColliders.push(collider);
            gridInsert(this.buildingGrid, this.buildingCellM, collider);
          }
        }
      }

      if (geometries.length) {
        const merged = mergeGeometries(geometries, false);
        for (const geometry of geometries) geometry.dispose();
        if (merged) {
          merged.computeBoundingSphere();
          const mesh = new THREE.Mesh(merged, material);
          mesh.frustumCulled = true;
          this.buildingGroup.add(mesh);
        }
      }
    }

    if (roads.length) {
      const mat = flatMat(0x686c69);
      this.materials.road = mat;
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, roads.length);
      const axis = new THREE.Vector3(0, 1, 0);
      roads.forEach((r, i) => {
        const a = lngLatToLocal(r.a[0], r.a[1]), b = lngLatToLocal(r.b[0], r.b[1]);
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.max(.5, Math.hypot(dx, dz));
        const lng = (r.a[0] + r.b[0]) / 2, lat = (r.a[1] + r.b[1]) / 2;
        const y = this.getElevation(lng, lat) - this.originElev + .1;
        const angle = Math.atan2(dx, dz);
        this.tmpP.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
        this.tmpS.set(r.width || 3, .1, len);
        this.tmpQ.setFromAxisAngle(axis, angle);
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
        mesh.setMatrixAt(i, this.tmpM);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.roadGroup.add(mesh);
    }
    this.stats.colliders = this.buildingColliders.length;
  }

`;
game = replaceBetween(game, '  setStructures({ buildings = [], roads = [] } = {}) {', '  setMode(mode) {', setStructuresBlock + '  setMode(mode) {');

game = game.replace(
  /  pathBlockedBuilding\(a, b, r\) \{[\s\S]*?\n  \}\n\n  pathBlockedTree\(a, b, r\) \{/,
  String.raw`  pathBlockedBuilding(a, b, r) {
    if (!this.buildingsEnabled) return false;
    for (const building of this.buildingCandidatesAlong(a.x, a.z, b.x, b.z)) {
      if (this.verticalOffset > building.height + .6) continue;
      if (!segmentAABB(
        a.x, a.z, b.x, b.z,
        building.minX - r, building.maxX + r,
        building.minZ - r, building.maxZ + r
      )) continue;
      if (segmentPolygonBlocked(a, b, building.polygon, r)) return true;
    }
    return false;
  }

  pathBlockedTree(a, b, r) {`
);

fs.writeFileSync(runtimePath, runtime);
fs.writeFileSync(gamePath, game);

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace('v0.9.0 · STABILITY REFACTOR', 'v0.10.0 · BUILDINGS = MAP');
html = html.replace('Qué cambió en v0.9', 'Qué cambió en v0.10');
html = html.replace(
  /Refactor de estabilidad:[^<]*GitHub Pages\./,
  'Sincronización arquitectónica: Mapa y mundo 3D comparten ahora exactamente el mismo dataset poligonal de edificios. Se eliminan las cajas envolventes como representación visual; las alturas usan el mismo valor en ambas vistas y aprovechan alturas/niveles del vector, con calibración documental puntual cuando la fuente no publica niveles.'
);
fs.writeFileSync(indexPath, html);

console.log('Applied v0.10 building synchronization refactor.');
