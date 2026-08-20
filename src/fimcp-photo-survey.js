import { LANDMARKS } from './config.js';

// Field survey supplied on 2026-08-20. The ZIP contains 100 sequential FIMCP
// photographs. Originals 01-12 and 93-100 are readable at 4096x3072; the ZIP
// local entries for 13-92 are damaged, but the bundled PDF preserves all 100
// views in sequence as 128x64 reference frames. Geometry below never pretends
// those thumbnail-only views contain millimetric measurements: they constrain
// topology, architectural vocabulary and route continuity.
export const FIMCP_PHOTO_SURVEY = Object.freeze({
  id: 'fimcp-2026-08-20',
  photoCount: 100,
  originalResolutionPhotos: Object.freeze([
    ...Array.from({ length: 12 }, (_, i) => i + 1),
    ...Array.from({ length: 8 }, (_, i) => i + 93)
  ]),
  pdfFallbackRange: Object.freeze([13, 92]),
  captureStart: '2026-08-20T16:09:32-05:00',
  captureEnd: '2026-08-20T16:25:39-05:00',
  gpsEmbedded: false,
  methodology: 'GIS footprint + documented levels + sequential photo constraints',
  palette: Object.freeze({
    wall: 0xd6d2c4,
    wallLight: 0xe8e5dc,
    espolBlue: 0x1767a5,
    blueDark: 0x174b71,
    glass: 0x35444c,
    upperOchre: 0xc9953e,
    railYellow: 0xd7b62f,
    paver: 0x8f948f,
    asphalt: 0x666b69,
    curbYellow: 0xd5b522,
    serviceOrange: 0xc96c2d,
    vegetation: 0x4f7046
  }),
  segments: Object.freeze([
    Object.freeze({ range: [1, 3], id: 'auditorium-front', confidence: 'high',
      features: Object.freeze(['FIMCP-AUDITORIUM sign','deep blue portal/fascia','cream walls','wide stepped entrance','dark glazed doors/windows','accessible parking/signage','gray-red interlocking pavers']) }),
    Object.freeze({ range: [4, 5], id: 'auditorium-side', confidence: 'high',
      features: Object.freeze(['large mature shade tree','trimmed hedge','cream side wall','exposed service pipes','screened/metal service bay','paver sidewalk','curb']) }),
    Object.freeze({ range: [6, 9], id: 'front-parking', confidence: 'high',
      features: Object.freeze(['large parking field','painted bays','double-head dark light poles','long blue parking/transit canopy','mature shade trees','vehicle circulation']) }),
    Object.freeze({ range: [10, 11], id: 'lemat-front', confidence: 'high',
      features: Object.freeze(['LEMAT facade','orange molecular mark','blue roof/fascia','cream walls','large dark industrial window grid','service apron','low planting']) }),
    Object.freeze({ range: [12, 18], id: 'service-alley-a', confidence: 'medium-high',
      features: Object.freeze(['narrow building separation','barred windows/doors','concrete strip paving','drainage','external equipment','yellow safety rails','trees visible at alley exit']) }),
    Object.freeze({ range: [19, 24], id: 'academic-circulation-a', confidence: 'medium',
      features: Object.freeze(['two-storey academic blocks','external concrete stair/ramp','ochre upper horizontal bands','cream walls','blue room plates','covered corridors','accessible doors','yellow rails']) }),
    Object.freeze({ range: [25, 27], id: 'alley-to-parking', confidence: 'medium',
      features: Object.freeze(['long narrow service passage','parking reveal','yellow/black edge marking','small planted edge']) }),
    Object.freeze({ range: [28, 33], id: 'garden-parking-edge', confidence: 'medium',
      features: Object.freeze(['tree-filled garden edge','waste/recycling bins','blue-white small academic/service blocks','parking perimeter','paver paths','shade trees']) }),
    Object.freeze({ range: [34, 36], id: 'service-parking-truck', confidence: 'medium',
      features: Object.freeze(['parking/service yard','large box truck','tree canopy','low industrial/service buildings']) }),
    Object.freeze({ range: [37, 42], id: 'dry-side-yard', confidence: 'medium',
      features: Object.freeze(['dry leaf litter','blue roof edges','narrow exterior walk','chain-link/green fence','dense edge vegetation','service-side walls']) }),
    Object.freeze({ range: [43, 54], id: 'interior-corridor-core', confidence: 'medium',
      features: Object.freeze(['deep covered corridors','tiled/concrete floors','continuous window bands','service doors','internal staircases','cross-passages','strong shade/daylight transitions']) }),
    Object.freeze({ range: [55, 65], id: 'central-courtyard', confidence: 'medium',
      features: Object.freeze(['landscaped courtyard','mature trees/palms','grass beds','trimmed hedges','raised planting edges','two-storey enclosing blocks','external stairs','yellow rails','covered walkways']) }),
    Object.freeze({ range: [66, 75], id: 'large-parking-and-hall', confidence: 'medium',
      features: Object.freeze(['large parking field','long blue canopy','dark double-head lamps','gray/tan hall','truck/loading activity','planters','tree shade']) }),
    Object.freeze({ range: [76, 81], id: 'industrial-service-yard', confidence: 'medium',
      features: Object.freeze(['service yard','small white utility building','orange industrial pipes/equipment','green service cabinet','interlocking pavers','loading access']) }),
    Object.freeze({ range: [82, 92], id: 'perimeter-tree-belt', confidence: 'medium',
      features: Object.freeze(['perimeter parking','tree belt','dry leaf ground','yellow curbs','access/guard elements','road edge','low cream buildings behind vegetation']) }),
    Object.freeze({ range: [93, 93], id: 'gbp-campus-map', confidence: 'high',
      features: Object.freeze(['Estacion GBP wayfinding board','official campus plan used as route/topology anchor']) }),
    Object.freeze({ range: [94, 100], id: 'external-avenue', confidence: 'high',
      features: Object.freeze(['broad campus avenue','landscaped median/edges','large shade trees','row of palms','transport sign/QR','bench/waiting area','utility poles and overhead wires','yellow campus/public transport vehicle']) })
  ])
});

export const FIMCP_PHOTO_SLICE = Object.freeze({
  id: 'fimcp-photo-slice',
  label: 'FIMCP - recorrido fotografico 2026-08-20',
  // Deliberately wider than the two existing FIMCP landmarks: photographs 66-100
  // leave the inner block complex and reach parking/perimeter/transport edges.
  bounds: Object.freeze({ west: -79.96810, east: -79.96415, south: -2.14635, north: -2.14295 }),
  anchorIds: Object.freeze(['aud-fimcp', 'fimcp-24c']),
  qualityGates: Object.freeze({
    expectedPhotoCount: 100,
    minimumFullResolutionEvidence: 20,
    minimumSyncedFootprints: 5,
    minimumDecoratedFootprints: 3
  })
});

export function insideFIMCPPhotoSlice(lng, lat) {
  const b = FIMCP_PHOTO_SLICE.bounds;
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;
}

export function surveyPhotoNumbers() {
  const numbers = [];
  for (const segment of FIMCP_PHOTO_SURVEY.segments) {
    for (let n = segment.range[0]; n <= segment.range[1]; n++) numbers.push(n);
  }
  return numbers;
}

export function surveyCoverageIsComplete() {
  const photos = surveyPhotoNumbers();
  if (photos.length !== FIMCP_PHOTO_SURVEY.photoCount) return false;
  return photos.every((n, i) => n === i + 1);
}

export function fimcpAnchors() {
  return FIMCP_PHOTO_SLICE.anchorIds
    .map(id => LANDMARKS.find(item => item.id === id))
    .filter(Boolean);
}
