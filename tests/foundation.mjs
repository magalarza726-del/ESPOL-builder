import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAMPUS, LANDMARKS } from '../src/config.js';
import { PROJECT, VERTICAL_SLICE, insideVerticalSlice } from '../src/project-foundation.js';

assert.equal(PROJECT.version, 'v0.14.0');
assert.equal(PROJECT.featureFreeze, true, 'foundation phase must freeze horizontal feature growth');
assert.equal(PROJECT.targetFps, 60);
assert.ok(PROJECT.minimumHealthyFps >= 30 && PROJECT.minimumHealthyFps <= PROJECT.targetFps);

const b = VERTICAL_SLICE.bounds;
assert.ok(b.west < b.east && b.south < b.north, 'vertical-slice bounds must be ordered');
assert.ok(insideVerticalSlice(CAMPUS.spawn.lng, CAMPUS.spawn.lat), 'FIEC spawn must stay inside the vertical slice');
for (const id of VERTICAL_SLICE.landmarkIds) {
  const landmark = LANDMARKS.find(x => x.id === id);
  assert.ok(landmark, `vertical-slice landmark missing: ${id}`);
  assert.ok(insideVerticalSlice(landmark.lng, landmark.lat), `vertical-slice landmark drifted outside slice: ${id}`);
}
assert.ok(VERTICAL_SLICE.qualityGates.minCapturedBuildingFootprints >= 4);

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /game3d_v014\.js/, 'public runtime must use v0.14 composer');
assert.match(index, /v0\.14\.0 · FOUNDATION HARDENING · FIEC VERTICAL SLICE/);
assert.doesNotMatch(index, /v0\.7\.0 · Forest Density/);

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
assert.ok(app.indexOf('project-foundation.js') < app.indexOf('building-sync-preload.js')),
  'foundation metadata/error capture must load before GIS building capture');
assert.ok(app.indexOf('building-sync-preload.js') < app.indexOf('runtime.js')),
  'building capture must still load before runtime');

const composer = fs.readFileSync(new URL('../src/game3d_v014.js', import.meta.url), 'utf8');
assert.match(composer, /createV013World/);
assert.match(composer, /auditFoundation/);
assert.match(composer, /__ESPOL_FOUNDATION_REPORT__/);
assert.match(composer, /throw new Error\(message\)/, 'hard foundation failures must abort readiness');

const forest = fs.readFileSync(new URL('../src/forest-system-v2.js', import.meta.url), 'utf8');
assert.match(forest, /const CHUNK_M = 64/);
assert.match(forest, /forestDetailIds/);
assert.match(forest, /activeTreeColliderGrid/);
assert.match(forest, /forest-v2-mass/);
assert.match(forest, /forest-v2-trunks/);
assert.doesNotMatch(forest, /Math\.random\(/, 'Forest V2 must remain deterministic');

const terrain = fs.readFileSync(new URL('../src/terrain-surface-v012.js', import.meta.url), 'utf8');
assert.match(terrain, /world\.__terrainSurfaceInstalled = true/);
assert.match(terrain, /world\.getElevation = surfaceElevation/);

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.match(packageJson.scripts.check, /game3d_v014\.js/);
assert.match(packageJson.scripts.check, /project-foundation\.js/);
assert.match(packageJson.scripts.test, /foundation\.mjs/);

console.log('ESPOL Builder foundation tests: OK');
