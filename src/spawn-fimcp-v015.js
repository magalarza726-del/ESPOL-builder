import { CAMPUS, LANDMARKS } from './config.js';

// v0.15 field-photo reconstruction spawn.
// The supplied FIMCP survey has no embedded GPS. This point is therefore an
// explicit reconstruction anchor placed in the open front parking documented
// by photos 06-09 and constrained by the GIS location of Auditorio FIMCP.
export const FIMCP_PARKING_SPAWN = Object.freeze({
  id: 'fimcp-parking',
  name: 'Parqueadero frontal FIMCP',
  lng: -79.96678,
  lat: -2.14439,
  bearing: 48,
  evidence: 'FIMCP_06-09 + Auditorio FIMCP GIS',
  confidence: 'medium-high'
});

CAMPUS.spawn.lng = FIMCP_PARKING_SPAWN.lng;
CAMPUS.spawn.lat = FIMCP_PARKING_SPAWN.lat;
CAMPUS.spawnBearing = FIMCP_PARKING_SPAWN.bearing;
CAMPUS.spawnName = FIMCP_PARKING_SPAWN.name;

if (!LANDMARKS.some(item => item.id === FIMCP_PARKING_SPAWN.id)) {
  LANDMARKS.push({
    id: FIMCP_PARKING_SPAWN.id,
    name: FIMCP_PARKING_SPAWN.name,
    lng: FIMCP_PARKING_SPAWN.lng,
    lat: FIMCP_PARKING_SPAWN.lat,
    category: 'FIMCP',
    note: 'Respawn v0.15 en el parqueadero frontal documentado por FIMCP_06-09. Posición reconstruida con el levantamiento fotográfico y el ancla GIS del Auditorio.'
  });
}

export function installFIMCPSpawn() {
  return FIMCP_PARKING_SPAWN;
}
