import { CAMPUS, LANDMARKS } from './config.js';
import { FIMCP_PHOTO_SURVEY, surveyCoverageIsComplete } from './fimcp-photo-survey.js';
import { FIMCP_SPATIAL_CONTROL, insideFIMCPCore, controlPointList } from './fimcp-spatial-control.js';

export const PROJECT = Object.freeze({
  version: 'v0.16.0',
  codename: 'FIMCP SPATIAL CONTROL + DAY/NIGHT',
  purpose: 'Master world ESPOL con ubicación controlada antes que detalle inferido',
  featureFreeze: true,
  targetFps: 60,
  minimumHealthyFps: 45,
  activeReconstruction: 'fimcp-spatial-v016'
});

export const VERTICAL_SLICE = Object.freeze({
  id: 'fimcp-spatial-v016',
  label: 'FIMCP control espacial',
  bounds: FIMCP_SPATIAL_CONTROL.coreBounds,
  landmarkIds: Object.freeze(['fimcp-parking', 'aud-fimcp', 'fimcp-24c']),
  qualityGates: Object.freeze({
    minCapturedBuildingFootprints: 3,
    minResolvedCoreBuildings: 3,
    humanScaleMinM: 1.5,
    humanScaleMaxM: 2.1
  }),
  terrainSamples: Object.freeze([
    [FIMCP_SPATIAL_CONTROL.points.parking.lng, FIMCP_SPATIAL_CONTROL.points.parking.lat],
    [FIMCP_SPATIAL_CONTROL.points.auditorium.lng, FIMCP_SPATIAL_CONTROL.points.auditorium.lat],
    [FIMCP_SPATIAL_CONTROL.points.block18A.lng, FIMCP_SPATIAL_CONTROL.points.block18A.lat],
    [FIMCP_SPATIAL_CONTROL.points.block24C.lng, FIMCP_SPATIAL_CONTROL.points.block24C.lat]
  ])
});

export function insideVerticalSlice(lng, lat) {
  return insideFIMCPCore(lng, lat);
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
  const hardErrors = [], warnings = [], metrics = {};

  if (!world) hardErrors.push('world-missing');
  if (typeof world?.getElevation !== 'function') hardErrors.push('terrain-sampler-missing');
  if (!world?.__terrainSurfaceInstalled) hardErrors.push('terrain-surface-not-unified');
  if (!world?.forestDatabase || !world?.__forestSystemV2) hardErrors.push('forest-v2-not-installed');
  if (typeof world?.resolvePosition !== 'function') hardErrors.push('collision-resolver-missing');
  if (typeof world?.render !== 'function') hardErrors.push('renderer-missing');
  if (!world?.__fimcpSpatialV016) hardErrors.push('fimcp-spatial-v016-not-installed');
  if (!world?.__dayNightV016) hardErrors.push('day-night-v016-not-installed');
  if (!surveyCoverageIsComplete()) hardErrors.push('fimcp-photo-survey-coverage-broken');

  if (!insideFIMCPCore(CAMPUS.spawn.lng, CAMPUS.spawn.lat)) hardErrors.push('spawn-outside-fimcp-core');
  metrics.spawn = Object.freeze({ lng: CAMPUS.spawn.lng, lat: CAMPUS.spawn.lat, name: CAMPUS.spawnName });

  const elevations = VERTICAL_SLICE.terrainSamples.map(([lng, lat]) => world?.getElevation?.(lng, lat));
  metrics.terrainSamples = elevations.map(v => Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
  if (elevations.some(v => !Number.isFinite(v))) hardErrors.push('fimcp-terrain-nonfinite');

  const captured = globalThis.__ESPOL_BUILDING_SYNC__?.getFeatures?.() || [];
  const coreFootprints = captured.filter(feature => {
    const c = geometryCenter(feature);
    return c && insideFIMCPCore(c.lng, c.lat);
  }).length;
  metrics.capturedBuildingFootprints = captured.length;
  metrics.fimcpCoreFootprints = coreFootprints;
  metrics.runtimeBuildingVolumes = structures?.buildings?.length || 0;
  if (coreFootprints < VERTICAL_SLICE.qualityGates.minCapturedBuildingFootprints) warnings.push('fimcp-core-building-capture-incomplete');

  const report = world?.fimcpSpatialReport || null;
  metrics.fimcpSpatialReport = report;
  const resolvedCount = report ? Object.values(report.resolved || {}).filter(Boolean).length : 0;
  metrics.resolvedFIMCPBuildings = resolvedCount;
  if (resolvedCount < VERTICAL_SLICE.qualityGates.minResolvedCoreBuildings) warnings.push('fimcp-spatial-underresolved');

  const controls = controlPointList();
  metrics.controlPoints = controls.length;
  if (controls.some(p => p.lng < CAMPUS.bounds.west || p.lng > CAMPUS.bounds.east || p.lat < CAMPUS.bounds.south || p.lat > CAMPUS.bounds.north)) {
    hardErrors.push('fimcp-control-point-outside-campus');
  }

  for (const id of VERTICAL_SLICE.landmarkIds) {
    if (!LANDMARKS.some(l => l.id === id)) hardErrors.push(`fimcp-landmark-missing:${id}`);
  }

  metrics.photoCount = FIMCP_PHOTO_SURVEY.photoCount;
  metrics.avatarHeightM = CAMPUS.avatarHeightM;
  if (CAMPUS.avatarHeightM < VERTICAL_SLICE.qualityGates.humanScaleMinM || CAMPUS.avatarHeightM > VERTICAL_SLICE.qualityGates.humanScaleMaxM) hardErrors.push('avatar-scale-invalid');

  return Object.freeze({
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
}

export function installProjectMetadata() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.espolBuilderVersion = PROJECT.version;
  document.body?.setAttribute('data-project-phase', PROJECT.codename);
  globalThis.__ESPOL_PROJECT__ = { PROJECT, VERTICAL_SLICE, FIMCP_SPATIAL_CONTROL, FIMCP_PHOTO_SURVEY };

  const badge = document.querySelector('.topbar .badge');
  if (badge) badge.textContent = `${PROJECT.version} · FIMCP SPATIAL CONTROL · DÍA/NOCHE`;

  const buffer = globalThis.__ESPOL_RUNTIME_ERRORS__ ||= [];
  const remember = (type, payload) => {
    buffer.push({ type, payload: String(payload?.message || payload || 'unknown'), at: new Date().toISOString() });
    if (buffer.length > 40) buffer.splice(0, buffer.length - 40);
  };
  addEventListener('error', event => remember('error', event.error || event.message));
  addEventListener('unhandledrejection', event => remember('unhandledrejection', event.reason));

  addEventListener('espol:foundation-audit', event => {
    const report = event.detail;
    const state = !report?.ok ? 'failed' : report.degraded ? 'degraded' : 'ok';
    document.body.dataset.foundationState = state;
    if (badge) {
      badge.dataset.foundationState = state;
      badge.title = report?.warnings?.length ? `Foundation: ${state} · ${report.warnings.join(', ')}` : `Foundation: ${state}`;
    }
  });

  const toast = document.querySelector('#toast');
  if (toast && typeof MutationObserver !== 'undefined') {
    const normalizeToastVersion = () => {
      const text = toast.textContent || '';
      if (/^v0\.\d+\.\d+/.test(text) && text.includes('runtime estabilizado') && !text.startsWith(PROJECT.version)) toast.textContent = text.replace(/^v0\.\d+\.\d+/, PROJECT.version);
    };
    new MutationObserver(normalizeToastVersion).observe(toast, { childList: true, characterData: true, subtree: true });
  }
}
