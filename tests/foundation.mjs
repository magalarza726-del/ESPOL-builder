import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAMPUS, LANDMARKS } from '../src/config.js';

// Browser boot installs this before project-foundation.js. Reproduce that order
// so CAMPUS-derived constants are tested exactly as they run on GitHub Pages.
const { FIMCP_PARKING_SPAWN } = await import('../src/spawn-fimcp-v015.js');
const { PROJECT, VERTICAL_SLICE, insideVerticalSlice } = await import('../src/project-foundation.js');
const { FIMCP_PHOTO_SURVEY, FIMCP_PHOTO_SLICE, insideFIMCPPhotoSlice, surveyCoverageIsComplete, surveyPhotoNumbers } = await import('../src/fimcp-photo-survey.js');

assert.equal(PROJECT.version, 'v0.15.0');
assert.equal(PROJECT.featureFreeze, true, 'foundation phase must freeze horizontal feature growth');
assert.equal(PROJECT.targetFps, 60);
assert.ok(PROJECT.minimumHealthyFps >= 30 && PROJECT.minimumHealthyFps <= PROJECT.targetFps);
assert.equal(PROJECT.activeReconstruction, FIMCP_PHOTO_SLICE.id);

// FIEC remains a regression baseline, but v0.15 intentionally starts in FIMCP.
const b = VERTICAL_SLICE.bounds;
assert.ok(b.west < b.east && b.south < b.north, 'FIEC baseline bounds must be ordered');
for (const id of VERTICAL_SLICE.landmarkIds) {
  const landmark = LANDMARKS.find(x => x.id === id);
  assert.ok(landmark, `FIEC baseline landmark missing: ${id}`);
  assert.ok(insideVerticalSlice(landmark.lng, landmark.lat), `FIEC baseline landmark drifted outside slice: ${id}`);
}
assert.equal(CAMPUS.spawn.lng, FIMCP_PARKING_SPAWN.lng);
assert.equal(CAMPUS.spawn.lat, FIMCP_PARKING_SPAWN.lat);
assert.equal(CAMPUS.spawnName, 'Parqueadero frontal FIMCP');
assert.equal(insideFIMCPPhotoSlice(CAMPUS.spawn.lng, CAMPUS.spawn.lat), true, 'spawn must be inside FIMCP photo slice');
assert.ok(LANDMARKS.some(x => x.id === 'fimcp-parking'), 'FIMCP parking spawn must be exposed as a landmark');

assert.equal(FIMCP_PHOTO_SURVEY.photoCount, 100);
assert.equal(FIMCP_PHOTO_SURVEY.originalResolutionPhotos.length, 20);
assert.deepEqual(FIMCP_PHOTO_SURVEY.pdfFallbackRange, [13, 92]);
assert.equal(surveyCoverageIsComplete(), true, 'photo segments must cover 01-100 exactly once and in order');
assert.deepEqual(surveyPhotoNumbers(), Array.from({ length: 100 }, (_, i) => i + 1));
for (const id of FIMCP_PHOTO_SLICE.anchorIds) {
  assert.ok(LANDMARKS.some(x => x.id === id), `FIMCP survey anchor missing: ${id}`);
}
assert.ok(FIMCP_PHOTO_SURVEY.segments.some(s => s.id === 'auditorium-front'));
assert.ok(FIMCP_PHOTO_SURVEY.segments.some(s => s.id === 'lemat-front'));
assert.ok(FIMCP_PHOTO_SURVEY.segments.some(s => s.id === 'central-courtyard'));
assert.ok(FIMCP_PHOTO_SURVEY.segments.some(s => s.id === 'industrial-service-yard'));
assert.ok(FIMCP_PHOTO_SURVEY.segments.some(s => s.id === 'external-avenue'));

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /game3d_v014\.js/, 'public import map still routes through the hardened composer');
assert.match(index, /v0\.15\.0 · FIMCP PHOTO SURVEY · 100 VISTAS/);
assert.match(index, /reaparecer FIMCP/);
assert.doesNotMatch(index, /v0\.7\.0 · Forest Density/);

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
assert.ok(app.indexOf('spawn-fimcp-v015.js') < app.indexOf('project-foundation.js'),
  'FIMCP spawn must install before project metadata evaluates CAMPUS-derived constants');
assert.ok(app.indexOf('project-foundation.js') < app.indexOf('building-sync-preload.js'),
  'foundation metadata/error capture must load before GIS building capture');
assert.ok(app.indexOf('building-sync-preload.js') < app.indexOf('runtime.js'),
  'building capture must still load before runtime');

const spawnModule = fs.readFileSync(new URL('../src/spawn-fimcp-v015.js', import.meta.url), 'utf8');
assert.match(spawnModule, /FIMCP_06-09/);
assert.match(spawnModule, /Parqueadero frontal FIMCP/);
assert.match(spawnModule, /CAMPUS\.spawn\.lng/);
assert.match(spawnModule, /LANDMARKS\.push/);

const composer = fs.readFileSync(new URL('../src/game3d_v014.js', import.meta.url), 'utf8');
assert.match(composer, /installFIMCPPhotoReconstruction/);
assert.match(composer, /capturedBuildingRecords/);
assert.match(composer, /auditFoundation/);
assert.match(composer, /__ESPOL_FOUNDATION_REPORT__/);
assert.match(composer, /throw new Error\(message\)/, 'hard foundation failures must abort readiness');

const detail = fs.readFileSync(new URL('../src/fimcp-detail-v015.js', import.meta.url), 'utf8');
assert.match(detail, /FIMCP-photo-reconstruction-v015/);
assert.match(detail, /FIMCP - AUDITORIUM/);
assert.match(detail, /LEMAT/);
assert.match(detail, /FIMCP-central-courtyard-photo-detail/);
assert.match(detail, /FIMCP-service-yard-photo-detail/);
assert.match(detail, /ESTACION GBP/);
assert.match(detail, /syncedFootprintsInSlice/);
assert.doesNotMatch(detail, /new THREE\.TextureLoader/, 'survey photographs must not be shipped as heavy runtime textures');

const forest = fs.readFileSync(new URL('../src/forest-system-v2.js', import.meta.url), 'utf8');
assert.match(forest, /const CHUNK_M = 64/);
assert.match(forest, /forestDetailIds/);
assert.match(forest, /activeTreeColliderGrid/);
assert.doesNotMatch(forest, /Math\.random\(/, 'Forest V2 must remain deterministic');

const terrain = fs.readFileSync(new URL('../src/terrain-surface-v012.js', import.meta.url), 'utf8');
assert.match(terrain, /world\.__terrainSurfaceInstalled = true/);
assert.match(terrain, /world\.getElevation = surfaceElevation/);

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.match(packageJson.scripts.check, /spawn-fimcp-v015\.js/);
assert.match(packageJson.scripts.check, /fimcp-photo-survey\.js/);
assert.match(packageJson.scripts.check, /fimcp-detail-v015\.js/);
assert.match(packageJson.scripts.test, /foundation\.mjs/);

console.log('ESPOL Builder v0.15 FIMCP foundation tests: OK');