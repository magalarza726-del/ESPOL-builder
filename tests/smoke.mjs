import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAMPUS, LANDMARKS, TREE_SPECIES } from '../src/config.js';
import { VEGETATION_PROFILE, UNDERSTORY_SPECIES } from '../src/vegetation.js';
import { GAME_MODES, MODE_IDS, getModeConfig } from '../src/modes.js';
import { haversine, insideBounds, normBearing, offsetLngLat } from '../src/core.js';
import { FIMCP_SPATIAL_CONTROL, insideFIMCPCore } from '../src/fimcp-spatial-control.js';
import { FACULTY_IDS, FACULTY_REGISTRY, classifyFaculty } from '../src/faculty-registry-v017.js';
const { FIMCP_PARKING_SPAWN } = await import('../src/spawn-fimcp-v015.js');

assert.ok(CAMPUS.bounds.west < CAMPUS.bounds.east && CAMPUS.bounds.south < CAMPUS.bounds.north);
assert.ok(insideBounds(CAMPUS.spawn.lng, CAMPUS.spawn.lat, CAMPUS.bounds));
assert.equal(CAMPUS.spawn.lng, FIMCP_PARKING_SPAWN.lng);
assert.equal(CAMPUS.spawn.lat, FIMCP_PARKING_SPAWN.lat);
assert.equal(insideFIMCPCore(CAMPUS.spawn.lng, CAMPUS.spawn.lat), true);
const ids = new Set(LANDMARKS.map(x => x.id));
for (const id of ['rectorado','aud-fiec','aud-fimcp','fimcp-parking','fimcp-24c','terminal']) assert.ok(ids.has(id));

assert.deepEqual(MODE_IDS, ['rpg','shooter']);
assert.equal(Object.keys(GAME_MODES).length, 2);
assert.equal(getModeConfig('rpg').id, 'day');
assert.equal(getModeConfig('rpg').sprintMultiplier, 5);
assert.equal(getModeConfig('shooter').id, 'horror');
assert.match(getModeConfig('shooter').hint, /linterna/i);
assert.match(getModeConfig('shooter').hint, /pistola/i);

assert.equal(normBearing(-10), 350);
const shifted = offsetLngLat(CAMPUS.spawn.lng, CAMPUS.spawn.lat, 0, 100, 0);
assert.ok(Math.abs(haversine(CAMPUS.spawn, shifted) - 100) < 1);
const P = FIMCP_SPATIAL_CONTROL.points, d = (a,b) => haversine(P[a], P[b]);
assert.ok(d('parking','auditorium') > 45 && d('parking','auditorium') < 85);
assert.ok(d('auditorium','block18A') > 35 && d('auditorium','block18A') < 75);
assert.ok(d('block18A','block24C') > 80 && d('block18A','block24C') < 135);
assert.ok(d('block24C','terminal') > 35 && d('block24C','terminal') < 80);

assert.equal(FACULTY_IDS.length, 8);
for (const id of ['FIEC','FIMCP','FICT','FADCOM','FCNM','FCSH','FCV','FIMCM']) assert.ok(FACULTY_REGISTRY[id]);
assert.equal(classifyFaculty({properties:{ref:'11C'}})?.id, 'FIEC');
assert.equal(classifyFaculty({properties:{ref:'18A'}})?.id, 'FIMCP');
assert.equal(classifyFaculty({properties:{ref:'13H'}})?.id, 'FICT');
assert.equal(classifyFaculty({properties:{ref:'14B'}})?.id, 'FADCOM');
assert.equal(classifyFaculty({properties:{ref:'9H'}})?.id, 'FCNM');
assert.equal(classifyFaculty({properties:{ref:'8H'}})?.id, 'FCSH');
assert.equal(classifyFaculty({properties:{ref:'60A'}})?.id, 'FIMCM');
assert.ok(VEGETATION_PROFILE.treeCount > 0 && VEGETATION_PROFILE.understoryPatchCount > 0);
assert.ok(TREE_SPECIES.length >= 10 && UNDERSTORY_SPECIES.length >= 10);

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /game3d_v018\.js/);
assert.match(index, /<option value="rpg">Día<\/option><option value="shooter">Noche<\/option>/);

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
assert.ok(app.indexOf('spawn-fimcp-v015.js') < app.indexOf('project-foundation-v018.js'));
assert.ok(app.indexOf('project-foundation-v018.js') < app.indexOf('building-sync-preload.js'));

const composer = fs.readFileSync(new URL('../src/game3d_v018.js', import.meta.url), 'utf8');
for (const token of ['buildFoundationModel','runWithFoundationCenters','installFoundationSkirts','installWalkSurface','auditBuildingFoundations','prepareStructureReloadV0181','installRuntimeStabilityV0181']) assert.match(composer, new RegExp(token));
assert.match(composer, /const baseBuildingToggle = world\.setBuildingsEnabled\.bind\(world\)/);

const foundations = fs.readFileSync(new URL('../src/building-foundation-v018.js', import.meta.url), 'utf8');
assert.match(foundations, /sampleGeometry/);
assert.match(foundations, /Math\.ceil\(len \/ 6\)/);
assert.match(foundations, /const floor = max \+ 0\.10/);
assert.match(foundations, /alreadyRepresented/);
assert.match(foundations, /this\.buildingFoundationModel/);
assert.match(foundations, /state\.buildingsEnabled/);
assert.doesNotMatch(foundations, /__buildingFoundationToggleV018/);
assert.doesNotMatch(foundations, /Math\.random\(/);

const stability = fs.readFileSync(new URL('../src/stability-v0181.js', import.meta.url), 'utf8');
for (const token of ['prepareStructureReloadV0181','disposeGroupChildren','legacyBuildingGroupDetachedV0181','enrichTreeColliders','snapUnderstoryToTerrain','topY','rectoradoDetail']) assert.match(stability, new RegExp(token));
assert.match(stability, /buildingGroup\?\.removeFromParent/);
assert.doesNotMatch(stability, /verticalOffset > 2\.4/);

const architecture = fs.readFileSync(new URL('../src/campus-architecture-v017.js', import.meta.url), 'utf8');
assert.match(architecture, /wallColliders/);
assert.match(architecture, /objectColliders/);
assert.doesNotMatch(architecture, /TextureLoader/);
const terrainSurface = fs.readFileSync(new URL('../src/terrain-surface-v012.js', import.meta.url), 'utf8');
assert.match(terrainSurface, /world\.getElevation = surfaceElevation/);
const forestV2 = fs.readFileSync(new URL('../src/forest-system-v2.js', import.meta.url), 'utf8');
assert.match(forestV2, /const CHUNK_M = 64/);
assert.match(forestV2, /activeTreeColliderGrid/);
assert.doesNotMatch(forestV2, /Math\.random\(/);

console.log('ESPOL Builder v0.18.1 smoke tests: OK');
