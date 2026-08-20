import { createGameWorld as createSyncedWorld } from './game3d_sync.js';
import { installTerrainSurface } from './terrain-surface-v012.js';
import { installForestSystemV2 } from './forest-system-v2.js';
import { installRectoradoV012 } from './rectorado-v012.js';

function finite(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}
function eachCoord(coords, fn) {
  if (!Array.isArray(coords)) return;
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    fn(coords);
    return;
  }
  for (const child of coords) eachCoord(child, fn);
}
function normalizeCapturedBuildings() {
  const features = globalThis.__ESPOL_BUILDING_SYNC__?.getFeatures?.() || [];
  const out = [];
  for (const feature of features) {
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    eachCoord(feature.geometry?.coordinates, c => {
      minLng = Math.min(minLng, c[0]); maxLng = Math.max(maxLng, c[0]);
      minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]);
    });
    if (!Number.isFinite(minLng)) continue;
    const p = feature.properties || {};
    const levels = finite(p.levels) ?? finite(p['building:levels']);
    const height = finite(p.render_height) ?? finite(p.height) ?? (levels ? levels * 3.15 : 7.4);
    out.push({ ...feature, lng: (minLng + maxLng) * .5, lat: (minLat + maxLat) * .5, height });
  }
  return out;
}

export async function createGameWorld(options) {
  const world = await createSyncedWorld(options);

  // One visible terrain surface, one deterministic forest database, one building set.
  installTerrainSurface(world);
  installForestSystemV2(world);

  const syncedSetStructures = world.setStructures.bind(world);
  world.setStructures = structures => {
    syncedSetStructures(structures);
    installRectoradoV012(world, normalizeCapturedBuildings());
    world.forceRefresh = true;
  };
  return world;
}
