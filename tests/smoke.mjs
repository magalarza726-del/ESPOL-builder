import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAMPUS, LANDMARKS, TREE_SPECIES } from '../src/config.js';
import { VEGETATION_PROFILE, UNDERSTORY_SPECIES } from '../src/vegetation.js';
import { GAME_MODES, MODE_IDS, getModeConfig } from '../src/modes.js';
import { haversine, insideBounds, normBearing, offsetLngLat } from '../src/core.js';
import { FIMCP_SPATIAL_CONTROL, insideFIMCPCore } from '../src/fimcp-spatial-control.js';

// Browser boot installs the mapped FIMCP parking spawn before the runtime.
const { FIMCP_PARKING_SPAWN } = await import('../src/spawn-fimcp-v015.js');

const finite = value => Number.isFinite(Number(value));

assert.ok(CAMPUS.bounds.west < CAMPUS.bounds.east);
assert.ok(CAMPUS.bounds.south < CAMPUS.bounds.north);
assert.ok(insideBounds(CAMPUS.spawn.lng, CAMPUS.spawn.lat, CAMPUS.bounds));
assert.ok(CAMPUS.playerRadiusM > 0 && CAMPUS.playerRadiusM < 2);
assert.ok(CAMPUS.jogSpeedMps > 0);
assert.equal(CAMPUS.spawn.lng, FIMCP_PARKING_SPAWN.lng);
assert.equal(CAMPUS.spawn.lat, FIMCP_PARKING_SPAWN.lat);
assert.equal(CAMPUS.spawnName, 'Parqueadero Alumnos FIEC y FIMCP');
assert.equal(insideFIMCPCore(CAMPUS.spawn.lng, CAMPUS.spawn.lat), true);

const ids = new Set();
for (const landmark of LANDMARKS) {
  assert.ok(landmark.id && !ids.has(landmark.id), `landmark id must be unique: ${landmark.id}`);
  ids.add(landmark.id);
  assert.ok(insideBounds(landmark.lng, landmark.lat, CAMPUS.bounds), `landmark outside campus: ${landmark.id}`);
}
for (const id of ['rectorado', 'aud-fiec', 'aud-fimcp', 'fimcp-parking', 'fimcp-24c', 'terminal']) assert.ok(ids.has(id), `required landmark missing: ${id}`);

// Public experience is now exactly two modes. Internally they reuse proven RPG/shooter controllers.
assert.deepEqual(MODE_IDS, ['rpg', 'shooter']);
assert.equal(Object.keys(GAME_MODES).length, 2);
assert.equal(getModeConfig('rpg').id, 'day');
assert.equal(getModeConfig('rpg').engineId, 'rpg');
assert.equal(getModeConfig('rpg').sprintMultiplier, 5);
assert.match(getModeConfig('rpg').hint, /jetpack/i);
assert.equal(getModeConfig('shooter').id, 'horror');
assert.equal(getModeConfig('shooter').engineId, 'shooter');
assert.match(getModeConfig('shooter').hint, /linterna/i);
assert.match(getModeConfig('shooter').hint, /pistola/i);
assert.equal(getModeConfig('unknown').id, 'day');
for (const mode of Object.values(GAME_MODES)) assert.ok(finite(mode.sprintMultiplier) && mode.sprintMultiplier >= 1);

// Metric coordinate sanity.
assert.equal(normBearing(-10), 350);
assert.equal(normBearing(721), 1);
const shifted = offsetLngLat(CAMPUS.spawn.lng, CAMPUS.spawn.lat, 0, 100, 0);
assert.ok(Math.abs(haversine(CAMPUS.spawn, shifted) - 100) < 1);

// v0.16 scale guards from mapped control points. These ranges deliberately allow map-centroid uncertainty
// but reject the ~20x separation regression reported in v0.15.
const P = FIMCP_SPATIAL_CONTROL.points;
const d = (a, b) => haversine(P[a], P[b]);
assert.ok(d('parking', 'auditorium') > 45 && d('parking', 'auditorium') < 85, `parking-auditorium scale invalid: ${d('parking','auditorium')}`);
assert.ok(d('auditorium', 'block18A') > 35 && d('auditorium', 'block18A') < 75, `auditorium-18A scale invalid: ${d('auditorium','block18A')}`);
assert.ok(d('block18A', 'block24C') > 80 && d('block18A', 'block24C') < 135, `18A-24C scale invalid: ${d('block18A','block24C')}`);
assert.ok(d('block24C', 'terminal') > 35 && d('block24C', 'terminal') < 80, `24C-terminal scale invalid: ${d('block24C','terminal')}`);
assert.ok(d('parking', 'terminal') < 260, 'FIMCP control network must remain compact');

assert.ok(VEGETATION_PROFILE.treeCount > 0);
assert.ok(VEGETATION_PROFILE.understoryPatchCount > 0);
assert.ok(TREE_SPECIES.length >= 10);
assert.ok(UNDERSTORY_SPECIES.length >= 10);

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /"\.\/src\/game3d\.js":"\.\/src\/game3d_v016\.js"/);
assert.match(index, /v0\.16\.0 · FIMCP SPATIAL CONTROL · DÍA\/NOCHE/);
assert.match(index, /<option value="rpg">Día<\/option><option value="shooter">Noche<\/option>/);
assert.doesNotMatch(index, /<option value="explore">/);
assert.doesNotMatch(index, /<option value="horror">/);
assert.match(index, /reaparecer FIMCP/);

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
assert.ok(app.indexOf('spawn-fimcp-v015.js') < app.indexOf('project-foundation-v016.js'));
assert.ok(app.indexOf('project-foundation-v016.js') < app.indexOf('building-sync-preload.js'));
assert.ok(app.indexOf('building-sync-preload.js') < app.indexOf('runtime.js'));

const composer = fs.readFileSync(new URL('../src/game3d_v016.js', import.meta.url), 'utf8');
assert.match(composer, /project-foundation-v016\.js/);
assert.match(composer, /installFIMCPSpatialReconstruction/);
assert.match(composer, /installDayNightExperience/);
assert.doesNotMatch(composer, /installFIMCPPhotoReconstruction/);

const spatial = fs.readFileSync(new URL('../src/fimcp-spatial-v016.js', import.meta.url), 'utf8');
assert.match(spatial, /insideFIMCPCore/);
assert.match(spatial, /nearestRecord/);
assert.match(spatial, /maxM = 28/);
assert.match(spatial, /No generic building is positioned from photo order/);
assert.match(spatial, /FIMCP-parking-v016/);
assert.doesNotMatch(spatial, /findCourtyard\(/, 'v0.16 must not invent a courtyard position from a broad footprint cloud');

const dayNight = fs.readFileSync(new URL('../src/day-night-v016.js', import.meta.url), 'utf8');
assert.match(dayNight, /baseApply\('horror'\)/);
assert.match(dayNight, /baseApply\('rpg'\)/);
assert.match(dayNight, /rig\.pistol\.visible = true/);
assert.match(dayNight, /rig\.jetpack\.visible = true/);

const buildingSync = fs.readFileSync(new URL('../src/game3d_sync.js', import.meta.url), 'utf8');
assert.match(buildingSync, /ExtrudeGeometry/);
assert.match(buildingSync, /installExactBuildingCollision/);
const terrainSurface = fs.readFileSync(new URL('../src/terrain-surface-v012.js', import.meta.url), 'utf8');
assert.match(terrainSurface, /world\.getElevation = surfaceElevation/);
const forestV2 = fs.readFileSync(new URL('../src/forest-system-v2.js', import.meta.url), 'utf8');
assert.match(forestV2, /const CHUNK_M = 64/);
assert.match(forestV2, /activeTreeColliderGrid/);
assert.doesNotMatch(forestV2, /Math\.random\(/);

console.log('ESPOL Builder v0.16 smoke tests: OK');
