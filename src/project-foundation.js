import { CAMPUS, LANDMARKS } from './config.js';

export const PROJECT = Object.freeze({
  version: 'v0.14.0',
  codename: 'FOUNDATION HARDENING',
  purpose: 'Master world de ESPOL antes que juego',
  featureFreeze: true,
  targetFps: 60,
  minimumHealthyFps: 45
});

export const VERTICAL_SLICE = Object.freeze({
  id: 'fiec-auditorio',
  label: 'FIEC + Auditorio',
  // Zona patrón: suficientemente pequeña para validar fidelidad y suficientemente
  // grande para incluir 11A/Auditorio y bloques inmediatos sin reconstruir todo ESPOL.
  bounds: Object.freeze({
    west: -79.96935,
    east: -79.96585,
    south: -2.14635,
    north: -2.14325
  }),
  landmarkIds: Object.freeze(['aud-fiec', 'fiec-stop', 'fiec-11b', 'fiec-11f']),
  qualityGates: Object.freeze({
    minCapturedBuildingFootprints: 4,
    maxTerrainSampleJumpM: 55,
    minForestChunkSizeM: 32,
    maxForestChunkSizeM: 128,
    humanScaleMinM: 1.5,
    humanScaleMaxM: 2.1
  }),
  terrainSamples: Object.freeze([
    [CAMPUS.spawn.lng, CAMPUS.spawn.lat],
    [-79.96803, -2.14453],
    [-79.96731, -2.14515],
    [-79.96656, -2.14502]
  ])
});

export function insideVerticalSlice(lng, lat) {
  const b = VERTICAL_SLICE.bounds;
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;
}

function geometryCenter(feature) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const walk = coords => {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      minLng = Math.min(minLng, coords[0]); maxLng = Math.max(maxLng, coords[0]);
      minLat = Math.min(minLat, coords[1]); maxLat = Math.max(maxLat, coords[1]);
      return;
    }
    for (const child of coords) walk(child);
  };
  walk(feature?.geometry?.coordinates);
  if (!Number.isFinite(minLng)) return null;
  return { lng: (minLng + maxLng) * .5, lat: (minLat + maxLat) * .5 };
}

export function auditFoundation(world, structures = {}) {
  const hardErrors = [];
  const warnings = [];
  const metrics = {};

  if (!world) hardErrors.push('world-missing');
  if (typeof world?.getElevation !== 'function') hardErrors.push('terrain-sampler-missing');
  if (!world?.__terrainSurfaceInstalled) hardErrors.push('terrain-surface-not-unified');
  if (!world?.forestDatabase || !world?.__forestSystemV2) hardErrors.push('forest-v2-not-installed');
  if (typeof world?.resolvePosition !== 'function') hardErrors.push('collision-resolver-missing');
  if (typeof world?.render !== 'function') hardErrors.push('renderer-missing');

  const elevations = [];
  for (const [lng, lat] of VERTICAL_SLICE.terrainSamples) {
    const h = world?.getElevation?.(lng, lat);
    if (!Number.isFinite(h)) hardErrors.push(`terrain-nonfinite:${lng},${lat}`);
    else elevations.push(h);
  }
  metrics.terrainSamples = elevations.map(v => Math.round(v * 10) / 10);
  if (elevations.length > 1) {
    const jump = Math.max(...elevations) - Math.min(...elevations);
    metrics.verticalSliceTerrainRangeM = Math.round(jump * 10) / 10;
    if (jump > VERTICAL_SLICE.qualityGates.maxTerrainSampleJumpM) warnings.push('vertical-slice-terrain-range-suspicious');
  }

  const captured = globalThis.__ESPOL_BUILDING_SYNC__?.getFeatures?.() || [];
  const sliceFootprints = captured.filter(feature => {
    const c = geometryCenter(feature);
    return c && insideVerticalSlice(c.lng, c.lat);
  }).length;
  metrics.capturedBuildingFootprints = captured.length;
  metrics.verticalSliceBuildingFootprints = sliceFootprints;
  metrics.runtimeBuildingVolumes = structures?.buildings?.length || 0;
  metrics.runtimeRoadSegments = structures?.roads?.length || 0;
  if (sliceFootprints < VERTICAL_SLICE.qualityGates.minCapturedBuildingFootprints) warnings.push('fiec-building-capture-incomplete');

  const sliceLandmarks = LANDMARKS.filter(l => VERTICAL_SLICE.landmarkIds.includes(l.id));
  metrics.verticalSliceLandmarks = sliceLandmarks.length;
  if (sliceLandmarks.length !== VERTICAL_SLICE.landmarkIds.length) hardErrors.push('vertical-slice-landmark-contract-broken');

  metrics.avatarHeightM = CAMPUS.avatarHeightM;
  if (CAMPUS.avatarHeightM < VERTICAL_SLICE.qualityGates.humanScaleMinM || CAMPUS.avatarHeightM > VERTICAL_SLICE.qualityGates.humanScaleMaxM) {
    hardErrors.push('avatar-scale-invalid');
  }

  const report = Object.freeze({
    version: PROJECT.version,
    phase: PROJECT.codename,
    slice: VERTICAL_SLICE.id,
    ok: hardErrors.length === 0,
    degraded: hardErrors.length === 0 && warnings.length > 0,
    hardErrors: Object.freeze(hardErrors),
    warnings: Object.freeze(warnings),
    metrics: Object.freeze(metrics),
    generatedAt: new Date().toISOString()
  });
  return report;
}

export function installProjectMetadata() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.espolBuilderVersion = PROJECT.version;
  document.body?.setAttribute('data-project-phase', PROJECT.codename);
  globalThis.__ESPOL_PROJECT__ = { PROJECT, VERTICAL_SLICE };

  const badge = document.querySelector('.topbar .badge');
  if (badge) badge.textContent = `${PROJECT.version} · ${PROJECT.codename} · FIEC VERTICAL SLICE`;

  const buffer = globalThis.__ESPOL_RUNTIME_ERRORS__ ||= [];
  const remember = (type, payload) => {
    buffer.push({ type, payload: String(payload?.message || payload || 'unknown'), at: new Date().toISOString() });
    if (buffer.length > 40) buffer.splice(0, buffer.length - 40);
  };
  addEventListener('error', event => remember('error', event.error || event.message));
  addEventListener('unhandledrejection', event => remember('unhandledrejection', event.reason));
}
