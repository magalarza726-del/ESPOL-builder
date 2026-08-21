import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAMPUS, LANDMARKS } from '../src/config.js';
import { haversine } from '../src/core.js';
import { FIMCP_SPATIAL_CONTROL, insideFIMCPCore, controlPointList } from '../src/fimcp-spatial-control.js';

const { FIMCP_PARKING_SPAWN } = await import('../src/spawn-fimcp-v015.js');
const { PROJECT, VERTICAL_SLICE, insideVerticalSlice } = await import('../src/project-foundation-v016.js');
const { FIMCP_PHOTO_SURVEY, surveyCoverageIsComplete, surveyPhotoNumbers } = await import('../src/fimcp-photo-survey.js');

assert.equal(PROJECT.version, 'v0.16.0');
assert.equal(PROJECT.codename, 'FIMCP SPATIAL CONTROL + DAY/NIGHT');
assert.equal(PROJECT.featureFreeze, true);
assert.equal(PROJECT.targetFps, 60);
assert.equal(PROJECT.activeReconstruction, 'fimcp-spatial-v016');
assert.equal(VERTICAL_SLICE.id, 'fimcp-spatial-v016');
assert.equal(insideVerticalSlice(CAMPUS.spawn.lng, CAMPUS.spawn.lat), true);
assert.equal(insideFIMCPCore(CAMPUS.spawn.lng, CAMPUS.spawn.lat), true);
assert.equal(CAMPUS.spawn.lng, FIMCP_PARKING_SPAWN.lng);
assert.equal(CAMPUS.spawn.lat, FIMCP_PARKING_SPAWN.lat);

for (const id of VERTICAL_SLICE.landmarkIds) {
  const landmark = LANDMARKS.find(x => x.id === id);
  assert.ok(landmark, `FIMCP spatial landmark missing: ${id}`);
  assert.ok(insideFIMCPCore(landmark.lng, landmark.lat), `FIMCP spatial landmark outside core: ${id}`);
}

assert.equal(FIMCP_PHOTO_SURVEY.photoCount, 100);
assert.equal(surveyCoverageIsComplete(), true);
assert.deepEqual(surveyPhotoNumbers(), Array.from({ length: 100 }, (_, i) => i + 1));

const controls = controlPointList();
assert.ok(controls.length >= 7, 'spatial control network unexpectedly small');
for (const point of controls) {
  assert.ok(Number.isFinite(point.lng) && Number.isFinite(point.lat), `invalid control point: ${point.id}`);
  assert.ok(point.source && point.confidence, `control point lacks provenance: ${point.id}`);
}
assert.equal(FIMCP_SPATIAL_CONTROL.points.parking.lng, -79.96709);
assert.equal(FIMCP_SPATIAL_CONTROL.points.parking.lat, -2.14425);
assert.equal(FIMCP_SPATIAL_CONTROL.points.auditorium.lng, -79.96652);
assert.equal(FIMCP_SPATIAL_CONTROL.points.auditorium.lat, -2.14417);
assert.equal(FIMCP_SPATIAL_CONTROL.points.block18A.lng, -79.96604);
assert.equal(FIMCP_SPATIAL_CONTROL.points.block18A.lat, -2.14405);
assert.equal(FIMCP_SPATIAL_CONTROL.points.block24C.lng, -79.96583);
assert.equal(FIMCP_SPATIAL_CONTROL.points.block24C.lat, -2.14499);
assert.equal(FIMCP_SPATIAL_CONTROL.points.terminal.lng, -79.96532);
assert.equal(FIMCP_SPATIAL_CONTROL.points.terminal.lat, -2.14504);

const P = FIMCP_SPATIAL_CONTROL.points;
assert.ok(haversine(P.parking, P.auditorium) < 85);
assert.ok(haversine(P.auditorium, P.block18A) < 75);
assert.ok(haversine(P.block18A, P.block24C) < 135);
assert.ok(haversine(P.block24C, P.terminal) < 80);
assert.ok(haversine(P.parking, P.terminal) < 260);

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /game3d_v016\.js/);
assert.match(index, /v0\.16\.0 · FIMCP SPATIAL CONTROL · DÍA\/NOCHE/);
assert.match(index, /<option value="rpg">Día<\/option>/);
assert.match(index, /<option value="shooter">Noche<\/option>/);
assert.doesNotMatch(index, /<option value="explore">/);
assert.doesNotMatch(index, /<option value="horror">/);

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
assert.ok(app.indexOf('spawn-fimcp-v015.js') < app.indexOf('project-foundation-v016.js'));
assert.ok(app.indexOf('project-foundation-v016.js') < app.indexOf('building-sync-preload.js'));
assert.ok(app.indexOf('building-sync-preload.js') < app.indexOf('runtime.js'));

const composer = fs.readFileSync(new URL('../src/game3d_v016.js', import.meta.url), 'utf8');
assert.match(composer, /project-foundation-v016\.js/);
assert.match(composer, /installFIMCPSpatialReconstruction/);
assert.match(composer, /installDayNightExperience/);
assert.match(composer, /auditFoundation/);
assert.match(composer, /throw new Error\(message\)/);

const spatial = fs.readFileSync(new URL('../src/fimcp-spatial-v016.js', import.meta.url), 'utf8');
assert.match(spatial, /world\.__fimcpSpatialV016 = true/);
assert.match(spatial, /insideFIMCPCore/);
assert.match(spatial, /maxM = 28/);
assert.match(spatial, /unresolvedPhotoPlacement/);
assert.match(spatial, /No generic building is positioned from photo order/);

const dayNight = fs.readFileSync(new URL('../src/day-night-v016.js', import.meta.url), 'utf8');
assert.match(dayNight, /world\.__dayNightV016 = true/);
assert.match(dayNight, /baseApply\('horror'\)/);
assert.match(dayNight, /baseApply\('rpg'\)/);

const foundation = fs.readFileSync(new URL('../src/project-foundation-v016.js', import.meta.url), 'utf8');
assert.match(foundation, /fimcp-spatial-v016-not-installed/);
assert.match(foundation, /day-night-v016-not-installed/);
assert.match(foundation, /spawn-outside-fimcp-core/);

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
for (const file of ['game3d_v016.js', 'project-foundation-v016.js', 'fimcp-spatial-control.js', 'fimcp-spatial-v016.js', 'day-night-v016.js']) {
  assert.ok(packageJson.scripts.check.includes(file), `syntax check missing ${file}`);
}
assert.match(packageJson.scripts.test, /foundation\.mjs/);

console.log('ESPOL Builder v0.16 foundation tests: OK');
