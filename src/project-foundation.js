import { CAMPUS, LANDMARKS } from './config.js';
import { FIMCP_PHOTO_SURVEY, FIMCP_PHOTO_SLICE, insideFIMCPPhotoSlice, surveyCoverageIsComplete } from './fimcp-photo-survey.js';

export const PROJECT = Object.freeze({
  version: 'v0.15.0',
  codename: 'FIMCP PHOTO RECONSTRUCTION',
  purpose: 'Master world de ESPOL antes que juego',
  featureFreeze: true,
  targetFps: 60,
  minimumHealthyFps: 45,
  activeReconstruction: FIMCP_PHOTO_SLICE.id
});

// FIEC remains the baseline systems-validation slice because the player spawns
// there. v0.15 adds FIMCP as the first field-photo reconstruction slice rather
// than replacing that stable contract.
export const VERTICAL_SLICE = Object.freeze({
  id: 'fiec-auditorio',
  label: 'FIEC + Auditorio',
  bounds: Object.freeze({ west: -79.96935, east: -79.96585, south: -2.14635, north: -2.14325 }),
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
  if (!world?.__fimcpPhotoDetailV015) hardErrors.push('fimcp-photo-reconstruction-not-installed');
  if (!surveyCoverageIsComplete()) hardErrors.push('fimcp-photo-survey-coverage-broken');

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
  const fiecFootprints = captured.filter(feature => {
    const c = geometryCenter(feature);
    return c && insideVerticalSlice(c.lng, c.lat);
  }).length;
  const fimcpFootprints = captured.filter(feature => {
    const c = geometryCenter(feature);
    return c && insideFIMCPPhotoSlice(c.lng, c.lat);
  }).length;
  metrics.capturedBuildingFootprints = captured.length;
  metrics.verticalSliceBuildingFootprints = fiecFootprints;
  metrics.fimcpSyncedBuildingFootprints = fimcpFootprints;
  metrics.runtimeBuildingVolumes = structures?.buildings?.length || 0;
  metrics.runtimeRoadSegments = structures?.roads?.length || 0;
  if (fiecFootprints < VERTICAL_SLICE.qualityGates.minCapturedBuildingFootprints) warnings.push('fiec-building-capture-incomplete');
  if (fimcpFootprints < FIMCP_PHOTO_SLICE.qualityGates.minimumSyncedFootprints) warnings.push('fimcp-building-capture-incomplete');

  const sliceLandmarks = LANDMARKS.filter(l => VERTICAL_SLICE.landmarkIds.includes(l.id));
  metrics.verticalSliceLandmarks = sliceLandmarks.length;
  if (sliceLandmarks.length !== VERTICAL_SLICE.landmarkIds.length) hardErrors.push('vertical-slice-landmark-contract-broken');
  const fimcpAnchors = LANDMARKS.filter(l => FIMCP_PHOTO_SLICE.anchorIds.includes(l.id));
  metrics.fimcpAnchors = fimcpAnchors.length;
  if (fimcpAnchors.length !== FIMCP_PHOTO_SLICE.anchorIds.length) hardErrors.push('fimcp-photo-anchor-contract-broken');

  metrics.fimcpPhotoCount = FIMCP_PHOTO_SURVEY.photoCount;
  metrics.fimcpFullResolutionEvidence = FIMCP_PHOTO_SURVEY.originalResolutionPhotos.length;
  metrics.fimcpPdfFallbackEvidence = FIMCP_PHOTO_SURVEY.pdfFallbackRange[1] - FIMCP_PHOTO_SURVEY.pdfFallbackRange[0] + 1;
  metrics.fimcpPhotoReport = world?.fimcpPhotoReport || null;
  if (world?.fimcpPhotoReport?.decoratedFootprints < FIMCP_PHOTO_SLICE.qualityGates.minimumDecoratedFootprints) {
    warnings.push('fimcp-photo-detail-underresolved');
  }

  metrics.avatarHeightM = CAMPUS.avatarHeightM;
  if (CAMPUS.avatarHeightM < VERTICAL_SLICE.qualityGates.humanScaleMinM || CAMPUS.avatarHeightM > VERTICAL_SLICE.qualityGates.humanScaleMaxM) {
    hardErrors.push('avatar-scale-invalid');
  }

  return Object.freeze({
    version: PROJECT.version,
    phase: PROJECT.codename,
    slice: VERTICAL_SLICE.id,
    photoSlice: FIMCP_PHOTO_SLICE.id,
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
  globalThis.__ESPOL_PROJECT__ = { PROJECT, VERTICAL_SLICE, FIMCP_PHOTO_SLICE, FIMCP_PHOTO_SURVEY };

  const badge = document.querySelector('.topbar .badge');
  if (badge) badge.textContent = `${PROJECT.version} · FIMCP PHOTO SURVEY · 100 VISTAS`;

  // Keep the existing HTML shell small; update its explanatory panel at runtime
  // so v0.15 can be deployed without duplicating the UI architecture.
  const changeSummary = [...document.querySelectorAll('details > summary')].find(x => /Qué cambió/i.test(x.textContent || ''));
  if (changeSummary) {
    changeSummary.textContent = 'Qué cambió en v0.15';
    const p = changeSummary.parentElement?.querySelector('.fineprint');
    if (p) p.textContent = 'FIMCP es el primer vertical slice reconstruido con levantamiento fotográfico de campo: 100 vistas secuenciales del Auditorio, estacionamientos, LEMAT, corredores, patios, zonas de servicio y borde de transporte. Las huellas siguen viniendo del GIS; las fotos gobiernan fachadas, colores, circulaciones y vocabulario arquitectónico. No se cargan las fotos de 500 MB en runtime.';
  }

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
      const f = report?.metrics?.fimcpPhotoReport;
      badge.title = f
        ? `FIMCP: ${f.syncedFootprintsInSlice} huellas · ${f.decoratedFootprints} decoradas · 100 fotos` 
        : `Foundation: ${state}`;
    }
  });

  // Compatibility bridge for the legacy startup toast only; this does not alter
  // world state or create a second version source.
  const toast = document.querySelector('#toast');
  if (toast && typeof MutationObserver !== 'undefined') {
    const normalizeToastVersion = () => {
      const text = toast.textContent || '';
      if (/^v0\.\d+\.\d+/.test(text) && text.includes('runtime estabilizado') && !text.startsWith(PROJECT.version)) {
        toast.textContent = text.replace(/^v0\.\d+\.\d+/, PROJECT.version);
      }
    };
    new MutationObserver(normalizeToastVersion).observe(toast, { childList: true, characterData: true, subtree: true });
  }
}
