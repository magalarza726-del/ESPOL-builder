import { CAMPUS, MAP_SOURCES, LANDMARKS, TREE_SPECIES, BUILDING_CATALOG } from './config.js';
import { UNDERSTORY_SPECIES, VEGETATION_PROFILE } from './vegetation.js';
import { buildProceduralForest } from './forest.js';
import { createGameWorld } from './game3d.js';
import { getModeConfig, MODE_IDS } from './modes.js';
import {
  DEG, clamp, normBearing, moveTowards, expApproach, haversine,
  insideBounds, offsetLngLat, finiteNumber, formatDistance, formatCoords,
  metersPerDegreeLng, METERS_PER_DEG_LAT
} from './core.js';

const VERSION = 'v0.9.0 · STABILITY REFACTOR';
const BASE_SPEED_MPS = CAMPUS.jogSpeedMps * 3;
const CAMERA = Object.freeze({
  map: { label: 'Mapa ESPOL' },
  follow: { label: '3ª persona' },
  firstperson: { label: '1ª persona' }
});
const CAMERA_IDS = new Set(Object.keys(CAMERA));
const CAMPUS_BOUNDS = [
  [CAMPUS.bounds.west, CAMPUS.bounds.south],
  [CAMPUS.bounds.east, CAMPUS.bounds.north]
];

const $ = selector => document.querySelector(selector);
const required = selector => {
  const el = $(selector);
  if (!el) throw new Error(`Falta el elemento requerido ${selector}`);
  return el;
};

const ui = {
  loading: required('#loading'),
  loadingText: required('#loadingText'),
  loadingBar: required('#loadingBar'),
  toast: required('#toast'),
  distance: required('#distance'),
  altitude: required('#altitude'),
  speed: required('#speed'),
  bearing: required('#bearing'),
  objective: required('#objective'),
  viewMode: required('#viewMode'),
  coords: required('#coords'),
  pace: required('#pace'),
  perfFps: required('#perfFps'),
  perfMs: required('#perfMs'),
  perfDraws: required('#perfDraws'),
  perfTris: required('#perfTris'),
  perfVeg: required('#perfVeg'),
  perfChunks: required('#perfChunks'),
  perfQuality: required('#perfQuality'),
  season: required('#season'),
  seasonLabel: required('#seasonLabel'),
  gameMode: required('#gameMode'),
  modeHint: required('#modeActionHint'),
  sprintLegend: required('#sprintLegend'),
  progressDots: required('#progressDots')
};

let toastTimer = 0;
let gameWorld = null;
let initialized = false;
let animationFrame = 0;

const player = {
  lng: CAMPUS.spawn.lng,
  lat: CAMPUS.spawn.lat,
  bearing: CAMPUS.spawnBearing,
  totalM: 0,
  lastSpeedKmh: 0,
  speedMps: 0
};

const state = {
  cameraMode: 'follow',
  terrainEnabled: true,
  treesEnabled: true,
  buildingsEnabled: true,
  imageryEnabled: false,
  season: 0.25,
  visited: new Set(),
  forestData: null,
  draggingLook: false,
  pointerId: null,
  lastPointerX: 0,
  lastPointerY: 0,
  pitchLook: 0,
  moveForward: 0,
  moveRight: 0,
  currentSpeed: 0,
  turnRate: 0,
  lastFrame: performance.now(),
  lastHudUpdate: 0,
  lastLandmarkCheck: 0,
  lastMapMarkerUpdate: 0,
  lastPerfUpdate: 0
};

const keys = new Set();

function notify(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2400);
}

function loadingStep(percent, message) {
  ui.loadingBar.style.width = `${clamp(percent, 0, 100)}%`;
  ui.loadingText.textContent = message;
}

function currentMode() {
  return getModeConfig(ui.gameMode.value);
}

function setModePresentation(modeId = ui.gameMode.value, { announce = false } = {}) {
  const mode = getModeConfig(modeId);
  for (const id of MODE_IDS) document.body.classList.remove(`mode-${id}`);
  document.body.classList.remove('mode-explore', 'mode-horror', 'mode-rpg', 'mode-shooter');
  if (mode.bodyClass) document.body.classList.add(mode.bodyClass);
  document.body.dataset.gameMode = mode.id;
  ui.modeHint.textContent = mode.hint;
  ui.sprintLegend.textContent = `sprint ×${mode.sprintMultiplier}`;
  syncFlashlightClass();
  updateHUD();
  if (announce) notify(`Preset ${mode.label} activado`);
}

function syncFlashlightClass() {
  const horror = currentMode().id === 'horror';
  const enabled = horror && (gameWorld?.flashlightOn ?? true);
  document.body.classList.toggle('flashlight-off', horror && !enabled);
}

const map = new maplibregl.Map({
  container: 'map',
  style: MAP_SOURCES.style,
  center: [CAMPUS.spawn.lng, CAMPUS.spawn.lat],
  zoom: 17.1,
  pitch: 60,
  bearing: CAMPUS.spawnBearing,
  maxPitch: 85,
  minZoom: 14.2,
  maxZoom: 21,
  maxBounds: CAMPUS_BOUNDS,
  renderWorldCopies: false,
  centerClampedToGround: false,
  fadeDuration: 0,
  canvasContextAttributes: { antialias: false, powerPreference: 'high-performance' },
  attributionControl: false,
  hash: false
});
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 140, unit: 'metric' }), 'bottom-left');

const playerEl = document.createElement('div');
playerEl.className = 'player-marker';
const playerArrow = document.createElement('span');
playerArrow.className = 'player-arrow';
playerArrow.textContent = '▲';
playerEl.appendChild(playerArrow);
const playerMarker = new maplibregl.Marker({ element: playerEl, anchor: 'center' })
  .setLngLat([player.lng, player.lat])
  .addTo(map);

function terrainElevation(lng, lat) {
  if (gameWorld) return gameWorld.getElevation(lng, lat);
  try {
    const value = map.queryTerrainElevation([lng, lat], { exaggerated: false });
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function updateMapMarker() {
  playerMarker.setLngLat([player.lng, player.lat]);
  playerEl.style.setProperty('--player-bearing', `${player.bearing}deg`);
  playerEl.style.opacity = state.cameraMode === 'map' ? '1' : '0';
}

function updateHUD() {
  ui.distance.textContent = formatDistance(player.totalM);
  const elevation = terrainElevation(player.lng, player.lat);
  ui.altitude.textContent = Number.isFinite(elevation) ? `${Math.round(elevation)} m` : '—';
  ui.speed.textContent = `${player.lastSpeedKmh.toFixed(1)} km/h`;
  ui.bearing.textContent = `${Math.round(normBearing(player.bearing))}°`;
  ui.viewMode.textContent = CAMERA[state.cameraMode]?.label || CAMERA.follow.label;
  ui.coords.textContent = formatCoords(player.lng, player.lat);
  if (player.speedMps <= 0.15) ui.pace.textContent = 'Quieto';
  else if (player.speedMps > BASE_SPEED_MPS * 1.08) ui.pace.textContent = `Sprint ×${currentMode().sprintMultiplier}`;
  else ui.pace.textContent = 'Movimiento base ×3';
}

function updateProfiler() {
  if (!gameWorld || state.cameraMode === 'map') {
    ui.perfFps.textContent = 'MAP';
    ui.perfMs.textContent = '—';
    ui.perfDraws.textContent = '—';
    ui.perfTris.textContent = '—';
    ui.perfVeg.textContent = '—';
    ui.perfChunks.textContent = '—';
    ui.perfQuality.textContent = 'GIS';
    return;
  }
  const stats = gameWorld.getStats();
  ui.perfFps.textContent = Math.round(stats.fps || 0);
  ui.perfMs.textContent = `${Number(stats.frameMs || 0).toFixed(1)} ms`;
  ui.perfDraws.textContent = stats.drawCalls ?? '—';
  const triangles = stats.triangles || 0;
  ui.perfTris.textContent = triangles > 999 ? `${(triangles / 1000).toFixed(1)}k` : triangles;
  ui.perfVeg.textContent = stats.vegetation ?? '—';
  ui.perfChunks.textContent = stats.chunks ?? '—';
  ui.perfQuality.textContent = `${Math.round((stats.quality ?? 1) * 100)}%`;
}

function setMapInteractions(enabled) {
  const handlers = ['dragPan', 'scrollZoom', 'boxZoom', 'doubleClickZoom', 'touchZoomRotate', 'dragRotate', 'touchPitch'];
  for (const name of handlers) {
    const handler = map[name];
    if (!handler) continue;
    try { enabled ? handler.enable() : handler.disable(); } catch { }
  }
  try { enabled ? map.keyboard.enable() : map.keyboard.disable(); } catch { }
}

function focusCampus({ duration = 450 } = {}) {
  const padding = Math.max(32, Math.min(78, Math.round(Math.min(innerWidth, innerHeight) * 0.065)));
  map.fitBounds(CAMPUS_BOUNDS, { padding, duration, bearing: 0, pitch: 38 });
}

function lockMapToCampus() {
  map.setMaxBounds(CAMPUS_BOUNDS);
  try {
    const camera = map.cameraForBounds(CAMPUS_BOUNDS, { padding: 48 });
    if (camera && Number.isFinite(camera.zoom)) map.setMinZoom(Math.max(14.2, camera.zoom - 0.08));
  } catch { }
}

function syncMapPresentation() {
  const mapMode = state.cameraMode === 'map';
  for (const id of ['forest-mass', 'forest-individuals']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', state.treesEnabled && mapMode ? 'visible' : 'none');
  }
  if (map.getLayer('espol-imagery')) {
    const show = mapMode && state.imageryEnabled;
    map.setLayoutProperty('espol-imagery', 'visibility', show ? 'visible' : 'none');
    map.setPaintProperty('espol-imagery', 'raster-opacity', show ? 0.72 : 0);
  }
}

function clearMotion() {
  keys.clear();
  state.moveForward = 0;
  state.moveRight = 0;
  state.currentSpeed = 0;
  state.turnRate = 0;
  player.speedMps = 0;
  player.lastSpeedKmh = 0;
}

function setCameraMode(mode, { announce = true } = {}) {
  if (!CAMERA_IDS.has(mode)) mode = 'follow';
  if (state.cameraMode === mode && initialized) return;
  state.cameraMode = mode;
  required('#btnOverview').classList.toggle('active', mode === 'map');
  required('#btnFollow').classList.toggle('active', mode === 'follow');
  required('#btnFirstPerson').classList.toggle('active', mode === 'firstperson');
  document.body.classList.toggle('map-mode', mode === 'map');
  document.body.classList.toggle('game-mode', mode !== 'map');
  document.body.classList.toggle('fp-mode', mode === 'firstperson');
  setMapInteractions(mode === 'map');
  syncMapPresentation();
  updateMapMarker();
  gameWorld?.setMode(mode);
  clearMotion();

  if (mode === 'map') {
    map.resize();
    focusCampus();
    if (announce) notify('Mapa GIS: zoom, teclado y desplazamiento libres dentro de ESPOL');
  } else {
    map.stop();
    gameWorld?.resetCamera?.();
    if (announce) notify(mode === 'follow' ? 'Mundo 3D · colisiones activas' : 'Primera persona · colisiones activas');
  }
  updateHUD();
  updateProfiler();
}

function moveBy(forward, right, meters) {
  const before = { lng: player.lng, lat: player.lat };
  const raw = offsetLngLat(player.lng, player.lat, player.bearing, forward * meters, right * meters);
  const target = {
    lng: clamp(raw.lng, CAMPUS.bounds.west, CAMPUS.bounds.east),
    lat: clamp(raw.lat, CAMPUS.bounds.south, CAMPUS.bounds.north)
  };
  const resolved = gameWorld
    ? gameWorld.resolvePosition(before.lng, before.lat, target.lng, target.lat, CAMPUS.playerRadiusM || 0.38)
    : { ...target, collided: false };
  if (!Number.isFinite(resolved.lng) || !Number.isFinite(resolved.lat)) return;
  player.lng = resolved.lng;
  player.lat = resolved.lat;
  player.totalM += haversine(before, player);
  if (resolved.collided) state.currentSpeed = Math.min(state.currentSpeed, BASE_SPEED_MPS * 0.75);
}

function moveStable(forward, right, distanceM) {
  if (!Number.isFinite(distanceM) || Math.abs(distanceM) < 1e-6) return;
  const maxStep = Math.max(0.5, CAMPUS.movementSubstepM || 2.5);
  const steps = Math.max(1, Math.ceil(Math.abs(distanceM) / maxStep));
  const step = distanceM / steps;
  for (let i = 0; i < steps; i++) moveBy(forward, right, step);
}

function checkLandmarks() {
  for (const landmark of LANDMARKS) {
    if (state.visited.has(landmark.id)) continue;
    if (haversine(player, landmark) < 65) {
      state.visited.add(landmark.id);
      document.querySelector(`[data-poi="${CSS.escape(landmark.id)}"]`)?.classList.add('visited');
      renderProgress();
      notify(`Hito descubierto: ${landmark.name}`);
    }
  }
}

function renderProgress() {
  const targets = LANDMARKS.slice(0, 3);
  ui.progressDots.replaceChildren();
  let completed = 0;
  for (const landmark of targets) {
    const dot = document.createElement('i');
    if (state.visited.has(landmark.id)) {
      dot.classList.add('done');
      completed++;
    }
    ui.progressDots.appendChild(dot);
  }
  ui.objective.textContent = completed >= targets.length
    ? 'Objetivo completado · explora libremente'
    : `Visita ${targets.length} hitos del sector FIEC/FIMCP (${completed}/${targets.length})`;
}

function readMovementInput() {
  let forward = 0, right = 0, rotate = 0;
  if (keys.has('KeyW')) forward++;
  if (keys.has('KeyS')) forward--;
  if (keys.has('KeyA')) right--;
  if (keys.has('KeyD')) right++;
  if (keys.has('KeyQ') || keys.has('ArrowLeft')) rotate--;
  if (keys.has('KeyE') || keys.has('ArrowRight')) rotate++;
  const length = Math.hypot(forward, right);
  if (length > 0) { forward /= length; right /= length; }
  return { forward, right, rotate, length };
}

function updateMovement(dt) {
  if (state.cameraMode === 'map' || !gameWorld) {
    clearMotion();
    return;
  }
  const input = readMovementInput();
  state.moveForward = expApproach(state.moveForward, input.forward, CAMPUS.inputResponsiveness || 19, dt);
  state.moveRight = expApproach(state.moveRight, input.right, CAMPUS.inputResponsiveness || 19, dt);
  if (!input.length && Math.abs(state.moveForward) < 0.002) state.moveForward = 0;
  if (!input.length && Math.abs(state.moveRight) < 0.002) state.moveRight = 0;

  const targetTurn = input.rotate * (CAMPUS.turnSpeedDegS || 120);
  state.turnRate = expApproach(state.turnRate, targetTurn, CAMPUS.turnResponsiveness || 17, dt);
  if (!input.rotate && Math.abs(state.turnRate) < 0.03) state.turnRate = 0;
  player.bearing = normBearing(player.bearing + state.turnRate * dt);

  const moving = input.length > 0 || Math.hypot(state.moveForward, state.moveRight) > 0.01;
  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const sprintMultiplier = currentMode().sprintMultiplier;
  const targetSpeed = moving ? BASE_SPEED_MPS * (sprinting ? sprintMultiplier : 1) : 0;
  const acceleration = targetSpeed > state.currentSpeed
    ? (CAMPUS.accelerationMps2 || 34)
    : (CAMPUS.brakingMps2 || 46);
  state.currentSpeed = moveTowards(state.currentSpeed, targetSpeed, acceleration * dt);
  if (!moving && state.currentSpeed < 0.025) state.currentSpeed = 0;

  const smoothLength = Math.hypot(state.moveForward, state.moveRight);
  if (state.currentSpeed > 0 && smoothLength > 0.001) {
    moveStable(state.moveForward / smoothLength, state.moveRight / smoothLength, state.currentSpeed * dt);
  }
  player.speedMps = state.currentSpeed;
  player.lastSpeedKmh = state.currentSpeed * 3.6;
}

function gameLoop(now) {
  const dt = Math.min(0.045, Math.max(0, (now - state.lastFrame) / 1000));
  state.lastFrame = now;
  updateMovement(dt);

  if (state.cameraMode !== 'map' && gameWorld) gameWorld.render(player, state, dt, now);
  if (state.cameraMode === 'map' && now - state.lastMapMarkerUpdate > 80) {
    state.lastMapMarkerUpdate = now;
    updateMapMarker();
  }
  if (now - state.lastHudUpdate > (CAMPUS.hudIntervalMs || 100)) {
    state.lastHudUpdate = now;
    updateHUD();
  }
  if (now - state.lastLandmarkCheck > (CAMPUS.landmarkIntervalMs || 280)) {
    state.lastLandmarkCheck = now;
    checkLandmarks();
  }
  if (now - state.lastPerfUpdate > 450) {
    state.lastPerfUpdate = now;
    updateProfiler();
    syncFlashlightClass();
  }
  animationFrame = requestAnimationFrame(gameLoop);
}

function safeAddSource(id, source) {
  if (!map.getSource(id)) map.addSource(id, source);
}

function safeAddLayer(layer, beforeId) {
  if (map.getLayer(layer.id)) return;
  map.addLayer(layer, beforeId && map.getLayer(beforeId) ? beforeId : undefined);
}

function firstLabelLayer() {
  return (map.getStyle().layers || []).find(layer => layer.type === 'symbol' && layer.layout?.['text-field'])?.id;
}

function addCampusBounds() {
  const b = CAMPUS.bounds;
  const campusRing = [[b.west,b.south],[b.east,b.south],[b.east,b.north],[b.west,b.north],[b.west,b.south]];
  safeAddSource('campus-bounds', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [campusRing] } } });
  safeAddLayer({ id: 'campus-fill', type: 'fill', source: 'campus-bounds', paint: { 'fill-color': '#7c9b72', 'fill-opacity': 0.015 } });
  safeAddLayer({ id: 'campus-outline', type: 'line', source: 'campus-bounds', paint: { 'line-color': '#587a61', 'line-width': 1.2, 'line-opacity': 0.48 } });

  const worldRing = [[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]];
  const holeRing = [[b.west,b.south],[b.west,b.north],[b.east,b.north],[b.east,b.south],[b.west,b.south]];
  safeAddSource('outside-campus-mask', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [worldRing, holeRing] } } });
  safeAddLayer({ id: 'outside-campus-mask', type: 'fill', source: 'outside-campus-mask', paint: { 'fill-color': '#07131f', 'fill-opacity': 1, 'fill-antialias': false } });
}

function addTerrain() {
  safeAddSource('terrain-dem', {
    type: 'raster-dem', tiles: [MAP_SOURCES.terrain],
    bounds: [CAMPUS.bounds.west,CAMPUS.bounds.south,CAMPUS.bounds.east,CAMPUS.bounds.north],
    encoding: 'terrarium', tileSize: 256, maxzoom: 15,
    attribution: 'Terrain: Mapzen/AWS elevation tiles'
  });
  map.setTerrain({ source: 'terrain-dem', exaggeration: 1 });
  safeAddLayer({
    id: 'terrain-hillshade', type: 'hillshade', source: 'terrain-dem',
    paint: {
      'hillshade-exaggeration': 0.08,
      'hillshade-shadow-color': '#71806a',
      'hillshade-highlight-color': '#eef0e7',
      'hillshade-accent-color': '#9da58f'
    }
  });
}

function addImagery() {
  safeAddSource('espol-world-imagery', {
    type: 'raster', tiles: [MAP_SOURCES.imagery],
    bounds: [CAMPUS.bounds.west,CAMPUS.bounds.south,CAMPUS.bounds.east,CAMPUS.bounds.north],
    tileSize: 256, maxzoom: 18,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community'
  });
  safeAddLayer({
    id: 'espol-imagery', type: 'raster', source: 'espol-world-imagery', minzoom: 14,
    layout: { visibility: 'none' },
    paint: { 'raster-opacity': 0.72, 'raster-saturation': -0.25, 'raster-contrast': -0.02, 'raster-fade-duration': 0 }
  }, firstLabelLayer());
}

function addBuildings() {
  safeAddSource('ofm', { type: 'vector', url: MAP_SOURCES.vector });
  const height = ['to-number', ['coalesce', ['get','render_height'], ['get','height'], ['*', ['to-number', ['get','levels'], 2.35], 3.15], 7.4], 7.4];
  const base = ['to-number', ['coalesce', ['get','render_min_height'], ['get','min_height'], 0], 0];
  safeAddLayer({
    id: 'espol-buildings-3d', source: 'ofm', 'source-layer': 'building', type: 'fill-extrusion', minzoom: 14.2,
    filter: ['!=', ['get','hide_3d'], true],
    paint: {
      'fill-extrusion-color': '#c8cbc5',
      'fill-extrusion-height': height,
      'fill-extrusion-base': base,
      'fill-extrusion-opacity': 0.92,
      'fill-extrusion-vertical-gradient': false
    }
  }, firstLabelLayer());
}

function addForest() {
  state.forestData = buildProceduralForest();
  safeAddSource('procedural-forest', { type: 'geojson', data: state.forestData });
  const maxCluster = VEGETATION_PROFILE.cluster.renderMax || VEGETATION_PROFILE.cluster.naturalMax || 22;
  safeAddLayer({
    id: 'forest-mass', type: 'heatmap', source: 'procedural-forest', maxzoom: 17.3,
    paint: {
      'heatmap-weight': ['case', ['==',['get','habit'],'tree'], ['interpolate',['linear'],['coalesce',['get','clusterSize'],1],1,0.35,maxCluster,2.1], 0.20],
      'heatmap-intensity': ['interpolate',['linear'],['zoom'],14,0.46,16.5,1.18],
      'heatmap-radius': ['interpolate',['linear'],['zoom'],14,13,16.8,32],
      'heatmap-opacity': ['interpolate',['linear'],['zoom'],14,0.28,16.4,0.48,17.3,0],
      'heatmap-color': ['interpolate',['linear'],['heatmap-density'],0,'rgba(42,72,43,0)',0.25,'rgba(65,100,56,.24)',0.55,'rgba(50,91,49,.48)',0.82,'rgba(36,77,43,.67)',1,'rgba(28,67,39,.78)']
    }
  });
  safeAddLayer({
    id: 'forest-individuals', type: 'circle', source: 'procedural-forest', minzoom: 16.8,
    filter: ['==',['get','habit'],'tree'],
    paint: {
      'circle-radius': ['interpolate',['linear'],['zoom'],16.8,0.8,18,1.7,20,2.8],
      'circle-color': ['case',['==',['get','zone'],'campus'],'#73896a',['==',['get','deciduous'],1],'#6f784e','#49664b'],
      'circle-opacity': ['interpolate',['linear'],['zoom'],16.8,0.14,19,0.42],
      'circle-stroke-width': 0
    }
  });
}

function addLandmarks() {
  const geo = {
    type: 'FeatureCollection',
    features: LANDMARKS.map(landmark => ({
      type: 'Feature', properties: { ...landmark },
      geometry: { type: 'Point', coordinates: [landmark.lng, landmark.lat] }
    }))
  };
  safeAddSource('campus-pois', { type: 'geojson', data: geo });
  safeAddLayer({
    id: 'campus-poi-dots', type: 'circle', source: 'campus-pois', minzoom: 14.8,
    paint: {
      'circle-radius': ['interpolate',['linear'],['zoom'],15,3.2,18,5.2],
      'circle-color': ['match',['get','category'],'FIEC','#00a6c8','FIMCP','#e0a139','Administración','#7a69c7','Servicios','#4f8e77','Movilidad','#de725f','Deporte','#5ca25c','#d1a63e'],
      'circle-stroke-color': '#fff', 'circle-stroke-width': 1.4, 'circle-opacity': 0.92
    }
  });
  safeAddLayer({
    id: 'campus-poi-labels', type: 'symbol', source: 'campus-pois', minzoom: 15.2,
    layout: {
      'text-field': ['get','name'], 'text-size': ['interpolate',['linear'],['zoom'],15.2,10,19,13],
      'text-offset': [0,1.2], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false
    },
    paint: { 'text-color': '#34404a', 'text-halo-color': 'rgba(255,255,255,.90)', 'text-halo-width': 1.2 }
  });

  for (const landmark of LANDMARKS) {
    const el = document.createElement('div');
    el.className = 'poi-hit-marker';
    el.dataset.poi = landmark.id;
    const popupContent = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = landmark.name;
    const note = document.createElement('small');
    note.textContent = landmark.note || '';
    popupContent.append(title, document.createElement('br'), note);
    new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([landmark.lng, landmark.lat])
      .setPopup(new maplibregl.Popup({ offset: 12 }).setDOMContent(popupContent))
      .addTo(map);
  }
}

function eachCoord(coords, callback) {
  if (!Array.isArray(coords)) return;
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    callback(coords);
    return;
  }
  for (const child of coords) eachCoord(child, callback);
}

function collectLines(coords, output) {
  if (!Array.isArray(coords) || !coords.length) return;
  if (Array.isArray(coords[0]) && coords[0].length >= 2 && typeof coords[0][0] === 'number') {
    output.push(coords);
    return;
  }
  for (const child of coords) collectLines(child, output);
}

function waitForMapIdle(timeout = 650) {
  return new Promise(resolve => {
    let finished = false;
    let timer = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      map.off('idle', finish);
      resolve();
    };
    map.on('idle', finish);
    timer = setTimeout(finish, timeout);
  });
}

function createStructureAccumulator() {
  return { buildings: [], roads: [], buildingKeys: new Set(), roadKeys: new Set() };
}

function roadWidth(properties = {}) {
  const cls = String(properties.class || properties.subclass || '').toLowerCase();
  if (cls.includes('motorway')) return 9;
  if (cls.includes('trunk')) return 8;
  if (cls.includes('primary')) return 7;
  if (cls.includes('secondary')) return 6;
  if (cls.includes('tertiary')) return 5;
  if (cls.includes('residential')) return 4;
  if (cls.includes('service')) return 3;
  if (cls.includes('path') || cls.includes('foot')) return 1.3;
  if (cls.includes('track')) return 2.2;
  return 3.2;
}

function collectLoadedStructures(acc) {
  try {
    for (const feature of map.querySourceFeatures('ofm', { sourceLayer: 'building' })) {
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      eachCoord(feature.geometry?.coordinates, coord => {
        minLng = Math.min(minLng, coord[0]); maxLng = Math.max(maxLng, coord[0]);
        minLat = Math.min(minLat, coord[1]); maxLat = Math.max(maxLat, coord[1]);
      });
      if (!Number.isFinite(minLng)) continue;
      const lng = (minLng + maxLng) / 2, lat = (minLat + maxLat) / 2;
      if (!insideBounds(lng, lat, CAMPUS.bounds)) continue;
      const width = (maxLng - minLng) * metersPerDegreeLng(lat);
      const depth = (maxLat - minLat) * METERS_PER_DEG_LAT;
      if (width < 1.5 || depth < 1.5 || width > 300 || depth > 300) continue;
      const p = feature.properties || {};
      const levels = finiteNumber(p.levels);
      const height = finiteNumber(p.render_height) ?? finiteNumber(p.height) ?? (levels ? levels * 3.15 : 7.4);
      const key = `${lng.toFixed(5)}:${lat.toFixed(5)}:${Math.round(width)}:${Math.round(depth)}`;
      if (acc.buildingKeys.has(key)) continue;
      acc.buildingKeys.add(key);
      acc.buildings.push({ lng, lat, width, depth, height });
    }
  } catch (error) {
    console.warn('building extraction', error);
  }

  try {
    for (const feature of map.querySourceFeatures('ofm', { sourceLayer: 'transportation' })) {
      const lines = [];
      collectLines(feature.geometry?.coordinates, lines);
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i];
          const lng = (a[0] + b[0]) / 2, lat = (a[1] + b[1]) / 2;
          if (!insideBounds(lng, lat, CAMPUS.bounds)) continue;
          const forwardKey = `${a[0].toFixed(5)}:${a[1].toFixed(5)}:${b[0].toFixed(5)}:${b[1].toFixed(5)}`;
          const reverseKey = `${b[0].toFixed(5)}:${b[1].toFixed(5)}:${a[0].toFixed(5)}:${a[1].toFixed(5)}`;
          if (acc.roadKeys.has(forwardKey) || acc.roadKeys.has(reverseKey)) continue;
          acc.roadKeys.add(forwardKey);
          acc.roads.push({ a, b, width: roadWidth(feature.properties) });
          if (acc.roads.length >= 7500) return;
        }
      }
    }
  } catch (error) {
    console.warn('road extraction', error);
  }
}

function fallbackBuildings() {
  const definitions = [
    ['aud-fiec',48,30,9], ['fiec-stop',58,32,10], ['fiec-11b',46,26,9], ['fiec-11f',38,23,8],
    ['aud-fimcp',46,30,10], ['fimcp-24c',48,26,9], ['postgrado',42,28,10], ['terminal',74,28,6],
    ['coliseo-nuevo',82,56,13], ['biblioteca',58,42,13], ['rectorado',48,36,11]
  ];
  return definitions.map(([id,width,depth,height]) => {
    const landmark = LANDMARKS.find(item => item.id === id);
    return landmark ? { lng: landmark.lng, lat: landmark.lat, width, depth, height, fallback: true } : null;
  }).filter(Boolean);
}

function mergeFallbackBuildings(acc) {
  for (const fallback of fallbackBuildings()) {
    const duplicate = acc.buildings.some(existing => haversine(fallback, existing) < 24);
    if (!duplicate) acc.buildings.push(fallback);
  }
}

async function scanCampusStructures() {
  const acc = createStructureAccumulator();
  const xs = [-79.9710,-79.9650,-79.9590,-79.9530,-79.9470];
  const ys = [-2.1530,-2.1470,-2.1410,-2.1350];
  const total = xs.length * ys.length;
  let done = 0;
  for (const lat of ys) {
    for (const lng of xs) {
      map.jumpTo({ center: [lng, lat], zoom: 17.05, pitch: 0, bearing: 0 });
      await waitForMapIdle(610);
      collectLoadedStructures(acc);
      done++;
      loadingStep(62 + done / total * 18, `Recuperando edificios ESPOL · sector ${done}/${total} · ${acc.buildings.length} volúmenes`);
    }
  }
  mergeFallbackBuildings(acc);
  focusCampus({ duration: 0 });
  return { buildings: acc.buildings.slice(0, 3000), roads: acc.roads.slice(0, 7500) };
}

function bindLookControls() {
  const canvas = required('#game3d');
  canvas.addEventListener('pointerdown', event => {
    if (state.cameraMode === 'map' || event.button !== 0) return;
    state.draggingLook = true;
    state.pointerId = event.pointerId;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    try { canvas.setPointerCapture(event.pointerId); } catch { }
    event.preventDefault();
  });
  canvas.addEventListener('pointermove', event => {
    if (!state.draggingLook || state.pointerId !== event.pointerId || state.cameraMode === 'map') return;
    const dx = event.clientX - state.lastPointerX;
    const dy = event.clientY - state.lastPointerY;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    player.bearing = normBearing(player.bearing + dx * 0.22);
    state.pitchLook = clamp(state.pitchLook - dy * 0.12, -55, 55);
  });
  const end = event => {
    if (state.pointerId !== null && event.pointerId !== undefined && state.pointerId !== event.pointerId) return;
    state.draggingLook = false;
    state.pointerId = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
}

function isFormControl(target) {
  return target instanceof Element && ['INPUT','SELECT','TEXTAREA','BUTTON'].includes(target.tagName);
}

function resetPlayer() {
  player.lng = CAMPUS.spawn.lng;
  player.lat = CAMPUS.spawn.lat;
  player.bearing = CAMPUS.spawnBearing;
  player.lastSpeedKmh = 0;
  player.speedMps = 0;
  state.pitchLook = 0;
  clearMotion();
  gameWorld?.resetCamera?.();
  updateMapMarker();
  setCameraMode('follow', { announce: false });
  notify(`Reinicio: ${CAMPUS.spawnName}`);
}

function setSeason(value) {
  const next = clamp(value, 0, 1);
  if (Math.abs(next - state.season) < 0.001) return;
  state.season = next;
  ui.seasonLabel.textContent = next < 0.5 ? 'Seca' : 'Lluviosa';
  gameWorld?.setSeason(next);
  if (map.getLayer('forest-individuals')) {
    map.setPaintProperty('forest-individuals', 'circle-color', [
      'case', ['==',['get','zone'],'campus'], next < 0.5 ? '#7d8564' : '#5f8567',
      ['==',['get','deciduous'],1], next < 0.5 ? '#7d7c50' : '#4e7854',
      next < 0.5 ? '#56694e' : '#3f6b4d'
    ]);
  }
}

function toggleFlashlight() {
  if (!gameWorld || currentMode().id !== 'horror') return;
  gameWorld.flashlightOn = !gameWorld.flashlightOn;
  syncFlashlightClass();
  notify(gameWorld.flashlightOn ? 'Linterna encendida' : 'Linterna apagada');
}

function bindUI() {
  document.addEventListener('keydown', event => {
    if (isFormControl(event.target) || isFormControl(document.activeElement)) {
      keys.delete(event.code);
      event.stopPropagation();
      return;
    }
    if (event.code === 'KeyF' && currentMode().id === 'horror') {
      event.preventDefault();
      event.stopPropagation();
      toggleFlashlight();
      return;
    }
    if (state.cameraMode !== 'map') keys.add(event.code);
    if (state.cameraMode !== 'map' && ['ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'KeyR') resetPlayer();
    else if (event.code === 'Digit1') setCameraMode('map');
    else if (event.code === 'Digit2') setCameraMode('follow');
    else if (event.code === 'Digit3') setCameraMode('firstperson');
  });
  document.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', clearMotion);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearMotion();
    state.lastFrame = performance.now();
  });

  required('#btnOverview').addEventListener('click', () => setCameraMode('map'));
  required('#btnFollow').addEventListener('click', () => setCameraMode('follow'));
  required('#btnFirstPerson').addEventListener('click', () => setCameraMode('firstperson'));
  required('#btnFullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      console.warn('fullscreen', error);
      notify('El navegador bloqueó el modo de pantalla completa');
    }
  });

  required('#terrainToggle').addEventListener('change', event => {
    state.terrainEnabled = event.target.checked;
    map.setTerrain(state.terrainEnabled ? { source: 'terrain-dem', exaggeration: 1 } : null);
    if (map.getLayer('terrain-hillshade')) map.setLayoutProperty('terrain-hillshade', 'visibility', state.terrainEnabled ? 'visible' : 'none');
    gameWorld?.setTerrainEnabled(state.terrainEnabled);
  });
  required('#buildingsToggle').addEventListener('change', event => {
    state.buildingsEnabled = event.target.checked;
    if (map.getLayer('espol-buildings-3d')) map.setLayoutProperty('espol-buildings-3d', 'visibility', state.buildingsEnabled ? 'visible' : 'none');
    gameWorld?.setBuildingsEnabled(state.buildingsEnabled);
  });
  required('#treesToggle').addEventListener('change', event => {
    state.treesEnabled = event.target.checked;
    syncMapPresentation();
    gameWorld?.setTreesEnabled(state.treesEnabled);
  });
  required('#imageryToggle').addEventListener('change', event => {
    state.imageryEnabled = event.target.checked;
    syncMapPresentation();
    notify(state.imageryEnabled ? 'Foto aérea activada sólo en Mapa' : 'Mapa vectorial plano activado');
  });
  required('#boundsToggle').addEventListener('change', event => {
    for (const id of ['campus-fill','campus-outline']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', event.target.checked ? 'visible' : 'none');
  });
  required('#labelsToggle').addEventListener('change', event => {
    for (const id of ['campus-poi-dots','campus-poi-labels']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', event.target.checked ? 'visible' : 'none');
  });
  ui.season.addEventListener('input', event => setSeason(Number(event.target.value) / 100));
  ui.gameMode.addEventListener('change', () => setModePresentation(ui.gameMode.value, { announce: true }));

  required('#panelToggle').addEventListener('click', () => {
    required('#panel').hidden = true;
    required('#panelOpen').hidden = false;
  });
  required('#panelOpen').addEventListener('click', () => {
    required('#panel').hidden = false;
    required('#panelOpen').hidden = true;
  });

  bindLookControls();
}

function fillReferencePanels() {
  const speciesList = required('#speciesList');
  const buildingList = required('#buildingList');
  speciesList.replaceChildren();
  buildingList.replaceChildren();

  for (const species of TREE_SPECIES) {
    const el = document.createElement('span');
    const name = document.createElement('b');
    name.textContent = species.name;
    el.append(name, document.createElement('br'), document.createTextNode(species.scientific));
    speciesList.appendChild(el);
  }
  for (const species of UNDERSTORY_SPECIES.slice(0, 24)) {
    const el = document.createElement('span');
    const name = document.createElement('b');
    name.textContent = species.name;
    el.append(name, document.createElement('br'), document.createTextNode(`${species.scientific} · ${species.habit}`));
    speciesList.appendChild(el);
  }
  for (const building of BUILDING_CATALOG) {
    const article = document.createElement('article');
    const faculty = document.createElement('b'); faculty.textContent = building.faculty;
    const blocks = document.createElement('span'); blocks.textContent = building.blocks;
    const detail = document.createElement('small'); detail.textContent = building.detail;
    article.append(faculty, blocks, detail);
    buildingList.appendChild(article);
  }
}

function startLoop() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  state.lastFrame = performance.now();
  animationFrame = requestAnimationFrame(gameLoop);
}

async function initialize() {
  if (initialized) return;
  initialized = true;
  try {
    loadingStep(6, 'Preparando Mapa ESPOL…');
    lockMapToCampus();
    addTerrain();
    addImagery();
    addBuildings();
    addForest();
    addCampusBounds();
    addLandmarks();
    focusCampus({ duration: 0 });

    loadingStep(18, 'Generando bosque ecológico y validando datos…');
    const worldPromise = createGameWorld({
      canvas: required('#game3d'),
      forestData: state.forestData,
      terrainUrl: MAP_SOURCES.terrain,
      onProgress: (progress, total) => loadingStep(20 + progress * 40, `Precalculando relieve ESPOL · ${Math.round(progress * 100)}% · ${total} tiles`)
    });
    const structuresPromise = scanCampusStructures();
    const [world, structures] = await Promise.all([worldPromise, structuresPromise]);
    gameWorld = world;

    loadingStep(84, `Construyendo campus · ${structures.buildings.length} edificios · ${structures.roads.length} tramos`);
    gameWorld.setStructures(structures);
    gameWorld.setSeason(state.season);
    gameWorld.setTreesEnabled(state.treesEnabled);
    gameWorld.setBuildingsEnabled(state.buildingsEnabled);
    gameWorld.setTerrainEnabled(state.terrainEnabled);

    loadingStep(94, 'Activando controles y comprobaciones de estabilidad…');
    bindUI();
    fillReferencePanels();
    required('#imageryToggle').checked = false;
    ui.seasonLabel.textContent = state.season < 0.5 ? 'Seca' : 'Lluviosa';
    setModePresentation(ui.gameMode.value);
    setCameraMode('follow', { announce: false });
    renderProgress();
    updateHUD();
    updateProfiler();

    loadingStep(100, 'ESPOL Builder listo');
    setTimeout(() => {
      ui.loading.classList.add('hide');
      startLoop();
      notify(`${VERSION} · ${structures.buildings.length} edificios · runtime estabilizado`);
    }, 250);
  } catch (error) {
    console.error(error);
    initialized = false;
    ui.loadingText.textContent = `Falló la inicialización: ${error?.message || 'error desconocido'}`;
    ui.loadingBar.style.width = '100%';
    ui.loadingBar.style.background = '#b95555';
  }
}

fillReferencePanels();
renderProgress();
setModePresentation(ui.gameMode.value);
map.on('load', initialize);
map.on('error', event => console.warn('Map layer error', event.error || event));
