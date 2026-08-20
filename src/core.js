export const DEG = Math.PI / 180;
export const EARTH_RADIUS_M = 6371000;
export const METERS_PER_DEG_LAT = 110574;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normBearing(value) {
  return (value % 360 + 360) % 360;
}

export function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

export function expApproach(current, target, responsiveness, dt) {
  return target + (current - target) * Math.exp(-responsiveness * dt);
}

export function metersPerDegreeLng(lat) {
  return 111320 * Math.cos(lat * DEG);
}

export function metersToLng(meters, lat) {
  return meters / metersPerDegreeLng(lat);
}

export function metersToLat(meters) {
  return meters / METERS_PER_DEG_LAT;
}

export function haversine(a, b) {
  const p1 = a.lat * DEG;
  const p2 = b.lat * DEG;
  const dp = (b.lat - a.lat) * DEG;
  const dl = (b.lng - a.lng) * DEG;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function insideBounds(lng, lat, bounds) {
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

export function offsetLngLat(baseLng, baseLat, bearingDeg, forwardM = 0, rightM = 0) {
  const b = bearingDeg * DEG;
  const north = Math.cos(b) * forwardM - Math.sin(b) * rightM;
  const east = Math.sin(b) * forwardM + Math.cos(b) * rightM;
  return {
    lng: baseLng + metersToLng(east, baseLat),
    lat: baseLat + metersToLat(north)
  };
}

export function finiteNumber(value, fallback = null) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

export function formatCoords(lng, lat) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
