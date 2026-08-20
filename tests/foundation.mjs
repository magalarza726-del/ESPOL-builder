import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAMPUS, LANDMARKS } from '../src/config.js';
import { PROJECT, VERTICAL_SLICE, insideVerticalSlice } from '../src/project-foundation.js';
import { FIMCP_PHOTO_SURVEY, FIMCP_PHOTO_SLICE, surveyCoverageIsComplete, surveyPhotoNumbers } from '../src/fimcp-photo-survey.js';

assert.equal(PROJECT.version, 'v0.15.0');
assert.equal(PROJECT.featureFreeze, true, 'foundation phase must freeze horizontal feature growth');
assert.equal(PROJECT.targetFps, 60);
assert.ok(PROJECT.minimumHealthyFps >= 30 && PROJECT.minimumHealthyFps <= PROJECT.targetFps);
assert.equal(PROJECT.activeReconstruction, FIMCP_PHOTO_SLICE.id);

const b = VERTICAL_SLICE.bounds;
assert.ok(b.west < b.east && b.south < b.north, 'FIEC baseline bounds must be ordered');
assert.ok(insideVerticalSlice(CAMPUS.spawn.lng, CAMPUS.spawn.lat), 'FIEC spawn must stay inside the baseline slice');
for (const id of VERTICAL_SLICE.landmarkIds) {
  const landmark = LANDMARKS.find(x => x.id === id);
  assert.ok(landmark, `vertical-slice landmark missing: ${id}`);
  assert.ok(insideVerticalSlice(landmark.lng, landmark.lat), `vertical-slice landmark drifted outside slice: ${id}`);
}

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
assert.doesNotMatch(index, /v0\.7\.0 · Forest Density/);

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
assert.ok(app.indexOf('project-foundation.js') < app.indexOf('building-sync-preload.js')),
  'foundation metadata/error capture must load before GIS building capture');
assert.ok(app.indexOf('building-sync-preload.js') < app.indexOf('runtime.js'),
  'building capture must still load before runtime');

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
assert.match(packageJson.scripts.check, /fimcp-photo-survey\.js/);
assert.match(packageJson.scripts.check, /fimcp-detail-v015\.js/);
assert.match(packageJson.scripts.test, /foundation\.mjs/);

console.log('ESPOL Builder v0.15 FIMCP foundation tests: OK');
