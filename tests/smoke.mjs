import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAMPUS, LANDMARKS, TREE_SPECIES } from '../src/config.js';
import { VEGETATION_PROFILE, UNDERSTORY_SPECIES } from '../src/vegetation.js';
import { GAME_MODES, getModeConfig } from '../src/modes.js';
import { haversine, insideBounds, normBearing, offsetLngLat } from '../src/core.js';

await import('../src/spawn-fimcp-v015.js');

const finite = value => Number.isFinite(Number(value));

assert.ok(CAMPUS.bounds.west < CAMPUS.bounds.east, 'campus longitude bounds must be ordered');
assert.ok(CAMPUS.bounds.south < CAMPUS.bounds.north, 'campus latitude bounds must be ordered');
assert.ok(insideBounds(CAMPUS.spawn.lng, CAMPUS.spawn.lat, CAMPUS.bounds), 'spawn must be inside campus bounds');
assert.ok(CAMPUS.playerRadiusM > 0 && CAMPUS.playerRadiusM < 2, 'player radius should remain human-scale');
assert.ok(CAMPUS.jogSpeedMps > 0, 'base movement speed must be positive');
assert.equal(CAMPUS.spawnName, 'Parqueadero frontal FIMCP');

const ids = new Set();
for (const landmark of LANDMARKS) {
  assert.ok(landmark.id && !ids.has(landmark.id), `landmark id must be unique: ${landmark.id}`);
  ids.add(landmark.id);
  assert.ok(insideBounds(landmark.lng, landmark.lat, CAMPUS.bounds), `landmark must be in ESPOL bounds: ${landmark.id}`);
}
assert.ok(ids.has('rectorado'), 'Rectorado landmark is required');
assert.ok(ids.has('aud-fiec'), 'FIEC auditorium landmark is required by the regression baseline');
assert.ok(ids.has('aud-fimcp'), 'FIMCP auditorium landmark is required');
assert.ok(ids.has('fimcp-parking'), 'FIMCP parking respawn landmark is required');

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
assert.ok(TREE_SPECIES.length >= 10, 'tree catalogue unexpectedly small');
assert.ok(UNDERSTORY_SPECIES.length >= 10, 'understory catalogue unexpectedly small');
for (const species of [...TREE_SPECIES, ...UNDERSTORY_SPECIES]) {
  assert.ok(species.name && species.scientific, 'species entries need display and scientific names');
}

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /\.\/src\/app\.js/);
assert.doesNotMatch(index, /<script[^>]+src="\.\/src\/player3d\.js"/);
assert.match(index, /"\.\/src\/game3d\.js":"\.\/src\/game3d_v014\.js"/,
  'import map must route runtime through the hardened v0.14 composer carrying v0.15 FIMCP reconstruction');
assert.match(index, /v0\.15\.0 · FIMCP PHOTO SURVEY · 100 VISTAS/);
assert.match(index, /reaparecer FIMCP/);

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
assert.ok(app.indexOf('spawn-fimcp-v015.js') < app.indexOf('project-foundation.js'));
assert.ok(app.indexOf('project-foundation.js') < app.indexOf('building-sync-preload.js'));
assert.ok(app.indexOf('building-sync-preload.js') < app.indexOf('runtime.js'));

const buildingPreload = fs.readFileSync(new URL('../src/building-sync-preload.js', import.meta.url), 'utf8');
assert.match(buildingPreload, /querySourceFeatures/);
assert.match(buildingPreload, /sourceLayer === 'building'/);

const buildingSync = fs.readFileSync(new URL('../src/game3d_sync.js', import.meta.url), 'utf8');
assert.match(buildingSync, /espol-buildings-synced-3d/);
assert.match(buildingSync, /ExtrudeGeometry/);
assert.match(buildingSync, /installExactBuildingCollision/);

const composer13 = fs.readFileSync(new URL('../src/game3d_v013.js', import.meta.url), 'utf8');
assert.match(composer13, /installTerrainSurface/);
assert.match(composer13, /installForestSystemV2/);
assert.match(composer13, /installRectoradoV012/);
const composer14 = fs.readFileSync(new URL('../src/game3d_v014.js', import.meta.url), 'utf8');
assert.match(composer14, /installFIMCPPhotoReconstruction/);
assert.match(composer14, /auditFoundation/);
assert.match(composer14, /foundationReport/);

const survey = fs.readFileSync(new URL('../src/fimcp-photo-survey.js', import.meta.url), 'utf8');
assert.match(survey, /photoCount: 100/);
assert.match(survey, /auditorium-front/);
assert.match(survey, /lemat-front/);
assert.match(survey, /central-courtyard/);
assert.match(survey, /external-avenue/);

const detail = fs.readFileSync(new URL('../src/fimcp-detail-v015.js', import.meta.url), 'utf8');
assert.match(detail, /FIMCP-photo-reconstruction-v015/);
assert.match(detail, /FIMCP - AUDITORIUM/);
assert.match(detail, /LEMAT/);
assert.match(detail, /ESTACION GBP/);
assert.doesNotMatch(detail, /new THREE\.TextureLoader/);

const terrainSurface = fs.readFileSync(new URL('../src/terrain-surface-v012.js', import.meta.url), 'utf8');
assert.match(terrainSurface, /tx \+ tz <= 1/,
  'surface sampler must match the terrain triangle split');
assert.match(terrainSurface, /world\.getElevation = surfaceElevation/,
  'all runtime height consumers should use the rendered surface');

const forestV2 = fs.readFileSync(new URL('../src/forest-system-v2.js', import.meta.url), 'utf8');
assert.match(forestV2, /const CHUNK_M = 64/, 'Forest V2 must use stable 64 m chunks');
assert.match(forestV2, /class ForestDatabase/);
assert.match(forestV2, /treeCache/);
assert.match(forestV2, /DETAIL_IN_M/);
assert.match(forestV2, /DETAIL_OUT_M/);
assert.match(forestV2, /activeTreeColliderGrid/);
assert.match(forestV2, /forest-v2-trunks/);
assert.match(forestV2, /frustumCulled = false/);
assert.doesNotMatch(forestV2, /Math\.random\(/, 'Forest V2 must remain deterministic');

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

for (const obsolete of ['src/forest-runtime-v012.js', 'src/game3d_v012.js']) {
  assert.equal(fs.existsSync(new URL(`../${obsolete}`, import.meta.url)), false, `${obsolete} should remain removed`);
}

console.log('ESPOL Builder v0.15 smoke tests: OK');