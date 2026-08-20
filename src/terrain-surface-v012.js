import { CAMPUS } from './config.js';

const DEG = Math.PI / 180;
const METERS_LAT = 110574;
const METERS_LNG = 111320 * Math.cos(CAMPUS.spawn.lat * DEG);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lngLatToLocal = (lng, lat) => ({
  x: (lng - CAMPUS.spawn.lng) * METERS_LNG,
  z: -(lat - CAMPUS.spawn.lat) * METERS_LAT
});

function buildChunkSampler(mesh) {
  const position = mesh?.geometry?.getAttribute?.('position');
  if (!position?.count) return null;
  const side = Math.round(Math.sqrt(position.count));
  if (side < 2 || side * side !== position.count) return null;

  const x0 = position.getX(0);
  const x1 = position.getX(side - 1);
  const z0 = position.getZ(0);
  const z1 = position.getZ((side - 1) * side);
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
  const minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);

  const sample = (x, z) => {
    const uRaw = (x - x0) / ((x1 - x0) || 1) * (side - 1);
    const vRaw = (z - z0) / ((z1 - z0) || 1) * (side - 1);
    const u = clamp(uRaw, 0, side - 1 - 1e-7);
    const v = clamp(vRaw, 0, side - 1 - 1e-7);
    const ix = Math.floor(u), iz = Math.floor(v);
    const tx = u - ix, tz = v - iz;
    const a = iz * side + ix;
    const b = a + 1;
    const c = a + side;
    const d = c + 1;
    const ya = position.getY(a), yb = position.getY(b);
    const yc = position.getY(c), yd = position.getY(d);

    // Match the exact two triangles used by GameWorld.buildTerrain():
    // (a,c,b) and (b,c,d), split along the b-c diagonal.
    if (tx + tz <= 1) return ya + tx * (yb - ya) + tz * (yc - ya);
    return yd + (1 - tx) * (yc - yd) + (1 - tz) * (yb - yd);
  };

  return { minX, maxX, minZ, maxZ, sample };
}

export function installTerrainSurface(world) {
  if (!world?.terrainChunks?.length || world.__terrainSurfaceInstalled) return world;

  const rawElevation = world.getElevation.bind(world);
  const samplers = world.terrainChunks.map(buildChunkSampler).filter(Boolean);
  if (!samplers.length) return world;

  const sampleLocal = (x, z) => {
    for (const chunk of samplers) {
      if (x >= chunk.minX - 1e-5 && x <= chunk.maxX + 1e-5 && z >= chunk.minZ - 1e-5 && z <= chunk.maxZ + 1e-5) {
        return chunk.sample(x, z);
      }
    }
    return null;
  };

  const surfaceElevation = (lng, lat) => {
    const p = lngLatToLocal(lng, lat);
    const localY = sampleLocal(p.x, p.z);
    return Number.isFinite(localY) ? world.originElev + localY : rawElevation(lng, lat);
  };

  world.getRawElevation = rawElevation;
  world.getSurfaceElevation = surfaceElevation;
  world.getSurfaceLocalY = sampleLocal;
  world.getElevation = surfaceElevation;
  world.__terrainSurfaceInstalled = true;
  world.forceRefresh = true;
  return world;
}
