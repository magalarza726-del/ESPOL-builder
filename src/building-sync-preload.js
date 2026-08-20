// ESPOL Builder v0.10 — capture the exact building polygons loaded by MapLibre.
// This module MUST run before runtime.js creates/scans the map.

const registry = {
  map: null,
  buildings: new Map(),
  rawSetLayoutProperty: null,
  internalLayoutChange: false,
  captureCount: 0,
  getFeatures() { return [...this.buildings.values()]; }
};

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

function bounds(geometry) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  eachCoord(geometry?.coordinates, c => {
    minLng = Math.min(minLng, c[0]); maxLng = Math.max(maxLng, c[0]);
    minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]);
  });
  if (!Number.isFinite(minLng)) return null;
  return { minLng, maxLng, minLat, maxLat };
}

function approximateArea(geometry) {
  const b = bounds(geometry);
  if (!b) return 0;
  const lat = (b.minLat + b.maxLat) * .5;
  const w = (b.maxLng - b.minLng) * 111320 * Math.cos(lat * Math.PI / 180);
  const h = (b.maxLat - b.minLat) * 110574;
  return Math.abs(w * h);
}

function featureKey(feature) {
  const p = feature.properties || {};
  const stable = feature.id ?? p.osm_id ?? p.osm_way_id ?? p.id;
  if (stable != null) return `id:${stable}`;
  const b = bounds(feature.geometry);
  if (!b) return null;
  const label = String(p.ref || p.name || p.class || 'building').slice(0, 60);
  return `${label}:${b.minLng.toFixed(6)}:${b.minLat.toFixed(6)}:${b.maxLng.toFixed(6)}:${b.maxLat.toFixed(6)}`;
}

function capture(features, map) {
  registry.map = map;
  for (const feature of features || []) {
    if (!polygons(feature.geometry).length) continue;
    const key = featureKey(feature);
    if (!key) continue;
    const record = {
      key,
      id: feature.id ?? null,
      properties: { ...(feature.properties || {}) },
      geometry: JSON.parse(JSON.stringify(feature.geometry)),
      areaHint: approximateArea(feature.geometry)
    };
    const existing = registry.buildings.get(key);
    // Features can be clipped at vector-tile edges; retain the largest copy.
    if (!existing || record.areaHint > existing.areaHint) registry.buildings.set(key, record);
  }
  registry.captureCount = registry.buildings.size;
}

if (!globalThis.maplibregl?.Map) {
  console.error('building-sync-preload: MapLibre was not loaded before the preload module');
} else {
  const proto = globalThis.maplibregl.Map.prototype;
  const rawQuerySourceFeatures = proto.querySourceFeatures;
  const rawSetLayoutProperty = proto.setLayoutProperty;
  registry.rawSetLayoutProperty = rawSetLayoutProperty;

  proto.querySourceFeatures = function(sourceId, options) {
    const result = rawQuerySourceFeatures.call(this, sourceId, options);
    if (sourceId === 'ofm' && options?.sourceLayer === 'building') capture(result, this);
    return result;
  };

  // Once the synchronized layer exists, mirror the existing UI building toggle to it
  // while forcing the old vector extrusion to stay hidden.
  proto.setLayoutProperty = function(layerId, name, value, ...rest) {
    if (!registry.internalLayoutChange && layerId === 'espol-buildings-3d' && name === 'visibility' && this.getLayer?.('espol-buildings-synced-3d')) {
      rawSetLayoutProperty.call(this, 'espol-buildings-synced-3d', name, value, ...rest);
      return rawSetLayoutProperty.call(this, 'espol-buildings-3d', name, 'none', ...rest);
    }
    return rawSetLayoutProperty.call(this, layerId, name, value, ...rest);
  };
}

globalThis.__ESPOL_BUILDING_SYNC__ = registry;
