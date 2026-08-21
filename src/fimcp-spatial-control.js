export const FIMCP_SPATIAL_CONTROL = Object.freeze({
  version: 'v0.16.0',
  methodology: 'OSM/ESPOL control points + GIS footprints + photo sequence as local visual evidence',
  coreBounds: Object.freeze({
    west: -79.96728,
    east: -79.96560,
    south: -2.14510,
    north: -2.14388
  }),
  points: Object.freeze({
    parking: Object.freeze({
      id: 'fimcp-parking',
      name: 'Parqueadero Alumnos FIEC y FIMCP',
      lng: -79.96709,
      lat: -2.14425,
      source: 'OpenStreetMap way 126173977 / Mapcarta',
      photoRange: Object.freeze([6, 9]),
      confidence: 'high'
    }),
    auditorium: Object.freeze({
      id: 'aud-fimcp',
      name: 'Auditorio FIMCP / 12H',
      lng: -79.96652,
      lat: -2.14417,
      source: 'OpenStreetMap way 584436190 / ESPOL',
      photoRange: Object.freeze([1, 5]),
      confidence: 'high'
    }),
    block18A: Object.freeze({
      id: 'fimcp-18a',
      name: 'Bloque 18-A',
      lng: -79.96604,
      lat: -2.14405,
      source: 'OpenStreetMap way 584436188',
      photoRange: Object.freeze([12, 24]),
      confidence: 'high'
    }),
    comedor: Object.freeze({
      id: 'fimcp-comedor',
      name: 'Comedor FIMCP',
      lng: -79.96621,
      lat: -2.14484,
      source: 'OpenStreetMap way 323159485',
      photoRange: Object.freeze([55, 75]),
      confidence: 'high'
    }),
    block24C: Object.freeze({
      id: 'fimcp-24c',
      name: 'FIMCP Aulas - Bloque 24C',
      lng: -79.96583,
      lat: -2.14499,
      source: 'OpenStreetMap way 126174070 / FIMCP',
      photoRange: Object.freeze([43, 75]),
      confidence: 'high'
    }),
    terminal: Object.freeze({
      id: 'terminal',
      name: 'Terminal de Buses ESPOL',
      lng: -79.96532,
      lat: -2.14504,
      source: 'OpenStreetMap way 352361438',
      photoRange: Object.freeze([93, 100]),
      confidence: 'high'
    }),
    postgrado: Object.freeze({
      id: 'postgrado',
      name: 'Edificio de Postgrado ESPOL',
      lng: -79.96638,
      lat: -2.14363,
      source: 'OpenStreetMap way 1101728170',
      photoRange: null,
      confidence: 'high',
      exclusionOnly: true
    })
  }),
  unresolved: Object.freeze({
    lemat: Object.freeze({
      tokens: Object.freeze(['lemat', '18-c', '18c', '12e']),
      rule: 'Use only an explicitly named GIS footprint. Never infer absolute position from photo order alone.'
    }),
    block24E: Object.freeze({
      tokens: Object.freeze(['24e', '24-e']),
      rule: 'Use only an explicitly named GIS footprint until a surveyed coordinate is available.'
    }),
    courtyard: Object.freeze({
      photoRange: Object.freeze([55, 65]),
      rule: 'Visual vocabulary only until surrounding FIMCP footprints are positively identified.'
    })
  })
});

export function insideFIMCPCore(lng, lat) {
  const b = FIMCP_SPATIAL_CONTROL.coreBounds;
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;
}

export function controlPointList() {
  return Object.values(FIMCP_SPATIAL_CONTROL.points);
}
