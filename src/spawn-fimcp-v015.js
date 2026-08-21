import { CAMPUS, LANDMARKS } from './config.js';

// v0.16 uses the mapped centroid of the shared FIEC/FIMCP student parking
// (OpenStreetMap way 126173977) instead of the provisional photo-derived point.
export const FIMCP_PARKING_SPAWN = Object.freeze({
  id: 'fimcp-parking',
  name: 'Parqueadero Alumnos FIEC y FIMCP',
  lng: -79.96709,
  lat: -2.14425,
  bearing: 82,
  evidence: 'OpenStreetMap way 126173977 + FIMCP_06-09',
  confidence: 'high'
});

CAMPUS.spawn.lng = FIMCP_PARKING_SPAWN.lng;
CAMPUS.spawn.lat = FIMCP_PARKING_SPAWN.lat;
CAMPUS.spawnBearing = FIMCP_PARKING_SPAWN.bearing;
CAMPUS.spawnName = FIMCP_PARKING_SPAWN.name;

const existing = LANDMARKS.find(item => item.id === FIMCP_PARKING_SPAWN.id);
if (existing) {
  Object.assign(existing, {
    name: FIMCP_PARKING_SPAWN.name,
    lng: FIMCP_PARKING_SPAWN.lng,
    lat: FIMCP_PARKING_SPAWN.lat,
    category: 'FIMCP',
    note: 'Respawn v0.16: centro cartográfico del parqueadero compartido FIEC/FIMCP, respaldado por OSM y las fotos 06-09.'
  });
} else {
  LANDMARKS.push({
    id: FIMCP_PARKING_SPAWN.id,
    name: FIMCP_PARKING_SPAWN.name,
    lng: FIMCP_PARKING_SPAWN.lng,
    lat: FIMCP_PARKING_SPAWN.lat,
    category: 'FIMCP',
    note: 'Respawn v0.16: centro cartográfico del parqueadero compartido FIEC/FIMCP, respaldado por OSM y las fotos 06-09.'
  });
}

const priorityIds = ['fimcp-parking', 'aud-fimcp', 'fimcp-24c'];
const prioritized = priorityIds.map(id => LANDMARKS.find(item => item.id === id)).filter(Boolean);
const remainder = LANDMARKS.filter(item => !priorityIds.includes(item.id));
LANDMARKS.splice(0, LANDMARKS.length, ...prioritized, ...remainder);

export function installFIMCPSpawn() {
  return FIMCP_PARKING_SPAWN;
}
