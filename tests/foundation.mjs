import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAMPUS } from '../src/config.js';
import { haversine } from '../src/core.js';
import { FIMCP_SPATIAL_CONTROL, insideFIMCPCore, controlPointList } from '../src/fimcp-spatial-control.js';
import { FACULTY_IDS } from '../src/faculty-registry-v017.js';
const { FIMCP_PARKING_SPAWN } = await import('../src/spawn-fimcp-v015.js');
const { PROJECT } = await import('../src/project-foundation-v018.js');
const { FIMCP_PHOTO_SURVEY, surveyCoverageIsComplete, surveyPhotoNumbers } = await import('../src/fimcp-photo-survey.js');

assert.equal(PROJECT.version, 'v0.18.1');
assert.equal(PROJECT.codename, 'AGGRESSIVE BUGFIX + TERRAIN FOUNDATION STABILITY');
assert.equal(PROJECT.featureFreeze, true);
assert.equal(PROJECT.targetFps, 60);
assert.equal(PROJECT.activeReconstruction, 'stability-v0181');
assert.equal(insideFIMCPCore(CAMPUS.spawn.lng,CAMPUS.spawn.lat), true);
assert.equal(CAMPUS.spawn.lng,FIMCP_PARKING_SPAWN.lng);
assert.equal(CAMPUS.spawn.lat,FIMCP_PARKING_SPAWN.lat);

assert.equal(FIMCP_PHOTO_SURVEY.photoCount,100);
assert.equal(surveyCoverageIsComplete(),true);
assert.deepEqual(surveyPhotoNumbers(),Array.from({length:100},(_,i)=>i+1));
assert.equal(FACULTY_IDS.length,8);
const controls=controlPointList();
assert.ok(controls.length>=7);
for(const p of controls) assert.ok(Number.isFinite(p.lng)&&Number.isFinite(p.lat)&&p.source&&p.confidence);
const P=FIMCP_SPATIAL_CONTROL.points;
assert.ok(haversine(P.parking,P.auditorium)<85);
assert.ok(haversine(P.auditorium,P.block18A)<75);
assert.ok(haversine(P.block18A,P.block24C)<135);
assert.ok(haversine(P.block24C,P.terminal)<80);

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(index,/game3d_v018\.js/);

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const spawnImport="await import('./spawn-fimcp-v015.js')";
const metadataImport="await import('./project-foundation-v018.js')";
const preloadImport="await import('./building-sync-preload.js')";
const runtimeImport="await import('./runtime.js')";
for(const token of [spawnImport,metadataImport,preloadImport,runtimeImport]) assert.ok(app.includes(token),`missing ${token}`);
assert.ok(app.indexOf(spawnImport)<app.indexOf(metadataImport));
assert.ok(app.indexOf(metadataImport)<app.indexOf(preloadImport));
assert.ok(app.indexOf(preloadImport)<app.indexOf(runtimeImport));

const composer=fs.readFileSync(new URL('../src/game3d_v018.js',import.meta.url),'utf8');
assert.match(composer,/createV017World/);
assert.match(composer,/prepareStructureReloadV0181\(world\)/);
assert.match(composer,/runWithFoundationCenters\(world, model/);
assert.match(composer,/installFoundationSkirts\(world, model\)/);
assert.match(composer,/installWalkSurface\(world, model\)/);
assert.match(composer,/installRuntimeStabilityV0181\(world/);
assert.match(composer,/Building foundation audit failed/);
assert.ok(composer.indexOf('buildFoundationModel')<composer.indexOf('v017SetStructures'));
assert.ok(composer.indexOf('runWithFoundationCenters')<composer.indexOf('installFoundationSkirts'));
assert.ok(composer.indexOf('installWalkSurface')<composer.indexOf('installRuntimeStabilityV0181'));

const foundations=fs.readFileSync(new URL('../src/building-foundation-v018.js',import.meta.url),'utf8');
for(const token of ['buildFoundationModel','sampleGeometry','centerElevation','walkElevation','alreadyRepresented','installFoundationSkirts','installWalkSurface','auditBuildingFoundations']) assert.match(foundations,new RegExp(token));
assert.match(foundations,/floor = max \+ 0\.10/);
assert.match(foundations,/f\.floor < f\.maxTerrain \+ \.05/);
assert.match(foundations,/steep-footprint/);
assert.match(foundations,/controlFallback/);
assert.match(foundations,/buildingFoundationModel/);
assert.doesNotMatch(foundations,/__buildingFoundationToggleV018/);
assert.doesNotMatch(foundations,/Math\.random\(/);

const stability=fs.readFileSync(new URL('../src/stability-v0181.js',import.meta.url),'utf8');
assert.match(stability,/disposeGroupChildren\(world\.buildingGroup\)/);
assert.match(stability,/world\.buildingGroup\?\.removeFromParent/);
assert.match(stability,/world\.scene\.add\(world\.rectoradoDetail\)/);
assert.match(stability,/world\.pathBlockedTree = function/);
assert.match(stability,/feetY > tree\.topY \+ \.25/);
assert.match(stability,/snapUnderstoryToTerrain/);
assert.match(stability,/world\.__campusArchitectureRootV017\.visible = enabled/);
assert.match(stability,/world\.__buildingFoundationRootV018\.visible = enabled/);

const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
for(const file of ['game3d_v018.js','project-foundation-v018.js','building-foundation-v018.js','stability-v0181.js','game3d_v017.js','campus-architecture-v017.js']) assert.ok(pkg.scripts.check.includes(file),`syntax check missing ${file}`);
assert.match(pkg.scripts.test,/foundation\.mjs/);

console.log('ESPOL Builder v0.18.1 foundation tests: OK');
