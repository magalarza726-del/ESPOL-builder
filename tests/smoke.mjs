import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAMPUS, LANDMARKS, TREE_SPECIES } from '../src/config.js';
import { VEGETATION_PROFILE, UNDERSTORY_SPECIES } from '../src/vegetation.js';
import { GAME_MODES, getModeConfig } from '../src/modes.js';
import { haversine, insideBounds, normBearing, offsetLngLat } from '../src/core.js';

const finite = value => Number.isFinite(Number(value));

assert.ok(CAMPUS.bounds.west < CAMPUS.bounds.east, 'campus longitude bounds must be ordered');
assert.ok(CAMPUS.bounds.south < CAMPUS.bounds.north, 'campus latitude bounds must be ordered');
assert.ok(insideBounds(CAMPUS.spawn.lng, CAMPUS.spawn.lat, CAMPUS.bounds), 'spawn must be inside campus bounds');
assert.ok(CAMPUS.playerRadiusM > 0 && CAMPUS.playerRadiusM < 2, 'player radius should remain human-scale');
assert.ok(CAMPUS.jogSpeedMps > 0, 'base movement speed must be positive');

const ids = new Set();
for (const landmark of LANDMARKS) {
  assert.ok(landmark.id && !ids.has(landmark.id), `landmark id must be unique: ${landmark.id}`);
  ids.add(landmark.id);
  assert.ok(insideBounds(landmark.lng, landmark.lat, CAMPUS.bounds), `landmark must be in ESPOL bounds: ${landmark.id}`);
}
assert.ok(ids.has('rectorado'), 'Rectorado landmark is required by the detailed 6A model');

assert.equal(getModeConfig('explore').sprintMultiplier, 5, 'exploration sprint is ×5');
for (const [id, mode] of Object.entries(GAME_MODES)) {
  assert.equal(mode.id, id);
  assert.ok(finite(mode.sprintMultiplier) && mode.sprintMultiplier >= 1, `${id} sprint multiplier is valid`);
  assert.ok(mode.hint.length > 5, `${id} has a control hint`);
}
assert.equal(getModeConfig('unknown').id, 'explore', 'unknown modes fall back safely');

assert.equal(normBearing(-10), 350);
assert.equal(normBearing(721), 1);
const shifted = offsetLngLat(CAMPUS.spawn.lng, CAMPUS.spawn.lat, 0, 100, 0);
const shiftedDistance = haversine(CAMPUS.spawn, shifted);
assert.ok(Math.abs(shiftedDistance - 100) < 1, `metric coordinate conversion drifted: ${shiftedDistance}`);

assert.ok(VEGETATION_PROFILE.treeCount > 0);
assert.ok(VEGETATION_PROFILE.understoryPatchCount > 0);
assert.ok(VEGETATION_PROFILE.cluster.naturalMin <= VEGETATION_PROFILE.cluster.naturalMax);
assert.ok(VEGETATION_PROFILE.cluster.collisionMax <= VEGETATION_PROFILE.cluster.renderMax,
  'tree collision budget cannot exceed rendered cluster budget');
for (const key of ['maxTrees','maxCanopyMass','maxShrubs','maxHerbs','maxVines','maxEpiphytes']) {
  assert.ok(finite(VEGETATION_PROFILE.lod[key]) && VEGETATION_PROFILE.lod[key] > 0, `LOD ${key} must be positive`);
}
assert.ok(TREE_SPECIES.length >= 10, 'tree catalogue unexpectedly small');
assert.ok(UNDERSTORY_SPECIES.length >= 10, 'understory catalogue unexpectedly small');
for (const species of [...TREE_SPECIES, ...UNDERSTORY_SPECIES]) {
  assert.ok(species.name && species.scientific, 'species entries need common/display and scientific names');
}

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /\.\/src\/app\.js/);
assert.doesNotMatch(index, /<script[^>]+src="\.\/src\/player3d\.js"/);
assert.match(index, /"\.\/src\/game3d\.js":"\.\/src\/game3d_v012\.js"/,
  'import map must route runtime through the v0.12 world composer');
assert.match(index, /v0\.12\.0 · ENGINE STABILITY · RECTORADO 6A/,
  'visible version should identify the stability refactor');

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
assert.ok(app.indexOf("building-sync-preload.js") < app.indexOf("runtime.js"),
  'building capture must preload before runtime creates MapLibre');

const buildingPreload = fs.readFileSync(new URL('../src/building-sync-preload.js', import.meta.url), 'utf8');
assert.match(buildingPreload, /querySourceFeatures/);
assert.match(buildingPreload, /sourceLayer === 'building'/);

const buildingSync = fs.readFileSync(new URL('../src/game3d_sync.js', import.meta.url), 'utf8');
assert.match(buildingSync, /espol-buildings-synced-3d/);
assert.match(buildingSync, /ExtrudeGeometry/);
assert.match(buildingSync, /installExactBuildingCollision/);

const composer = fs.readFileSync(new URL('../src/game3d_v012.js', import.meta.url), 'utf8');
assert.match(composer, /installTerrainSurface/);
assert.match(composer, /installForestRuntime/);
assert.match(composer, /installRectoradoV012/);

const terrainSurface = fs.readFileSync(new URL('../src/terrain-surface-v012.js', import.meta.url), 'utf8');
assert.match(terrainSurface, /tx \+ tz <= 1/,
  'surface sampler must match the terrain triangle split');
assert.match(terrainSurface, /world\.getElevation = surfaceElevation/,
  'all runtime height consumers should use the rendered surface');

const forestRuntime = fs.readFileSync(new URL('../src/forest-runtime-v012.js', import.meta.url), 'utf8');
assert.match(forestRuntime, /frustumCulled = false/,
  'dynamic vegetation instances should not use stale frustum bounds');
assert.match(forestRuntime, /transitionMass/,
  'forest LOD needs an overlap/fallback band');
assert.match(forestRuntime, /activeTreeColliderGrid/,
  'tree collision must be derived from visible detailed trunks');
assert.match(forestRuntime, /farTrunk/,
  'distant forest must retain representative trunks');

const rectorado = fs.readFileSync(new URL('../src/rectorado-detail.js', import.meta.url), 'utf8');
assert.match(rectorado, /Rectorado-6A-detail/);
assert.match(rectorado, /180/);
assert.match(rectorado, /addTurtle/);
assert.match(rectorado, /addSealMonument/);
const rectoradoV012 = fs.readFileSync(new URL('../src/rectorado-v012.js', import.meta.url), 'utf8');
assert.match(rectoradoV012, /addMullions/);
assert.match(rectoradoV012, /addEntranceDoors/);
assert.match(rectoradoV012, /addSlopedClerestory/);
assert.match(rectoradoV012, /addDriveAndCurbs/);
assert.match(rectoradoV012, /addFlowerDetail/);

const runtime = fs.readFileSync(new URL('../src/runtime.js', import.meta.url), 'utf8');
assert.doesNotMatch(runtime, /CAMPUS\.sprintMultiplier\s*=/, 'runtime must not mutate global sprint configuration');
assert.match(runtime, /state\.cameraMode === 'map'/, 'runtime should explicitly gate gameplay in map mode');

console.log('ESPOL Builder smoke tests: OK');
