export const CAMPUS = {
  // Bounding box used by Ching-Ávalos et al. (LACCEI 2020) for the campus GIS study.
  bounds: {
    north: -2.1311111111,
    south: -2.1569444444,
    east: -79.9425,
    west: -79.9825
  },
  // ~20 m al O-SO del centro cartografiado del Auditorio FIEC.
  // Es un spawn exterior aproximado: la puerta exacta debe validarse in situ.
  spawn: { lng: -79.96792, lat: -2.14502 },
  spawnBearing: 71,
  spawnName: 'Exterior del Auditorio FIEC',

  studyAreaHa: 696,
  officialCampusAreaM2: 6587827,
  officialForestAreaM2: 5264107,
  officialBuildingAreaM2: 174902,
  officialForestCoverage: 0.80,
  officialPlantedVegetationMax: 0.10,

  routesKm: 22.9831,
  roadWidthThresholdM: 1.8,

  // Unidades físicas: metros y segundos. El avatar mide ~1.80 m.
  avatarHeightM: 1.80,
  eyeHeightM: 1.68,
  jogSpeedMps: 2.6,
  sprintMultiplier: 2.5,
  thirdPersonDistanceM: 6.5,
  thirdPersonCameraHeightM: 2.9
};

export const MAP_SOURCES = {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  vector: 'https://tiles.openfreemap.org/planet',
  terrain: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  // Capa opcional: en Mapa se mantiene la cartografía actual; en 1ª/3ª persona
  // se puede drapear fotografía aérea para que el suelo se parezca más al campus real.
  imagery: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
};

// Coordenadas de apoyo cartográfico. OSM/Mapcarta se usa para centrar hitos;
// la geometría de edificios sigue viniendo de la capa vectorial abierta.
export const LANDMARKS = [
  { id:'aud-fiec', name:'Auditorio FIEC', lng:-79.96775, lat:-2.14496, category:'FIEC', note:'Auditorio del edificio principal 11A. Punto de referencia del spawn.' },
  { id:'fiec-stop', name:'FIEC / 11A', lng:-79.96803, lat:-2.14453, category:'FIEC', note:'Sector del edificio principal de FIEC y parada FIEC.' },
  { id:'fiec-11b', name:'FIEC · Bloque 11B', lng:-79.96731, lat:-2.14515, category:'FIEC', note:'Soporte, aulas híbridas y laboratorios de computación.' },
  { id:'fiec-11f', name:'FIEC · Bloque 11F', lng:-79.96656, lat:-2.14502, category:'FIEC', note:'Oficinas de profesores, clubes y sala de sesiones.' },
  { id:'aud-fimcp', name:'Auditorio FIMCP', lng:-79.96652, lat:-2.14417, category:'FIMCP', note:'Auditorio del sector FIMCP.' },
  { id:'fimcp-24c', name:'FIMCP · Bloque 24C', lng:-79.96583, lat:-2.14499, category:'FIMCP', note:'Bloque de aulas próximo al terminal.' },
  { id:'postgrado', name:'Edificio de Postgrado', lng:-79.96638, lat:-2.14363, category:'Servicios', note:'Edificio de postgrado del núcleo académico.' },
  { id:'terminal', name:'Terminal de Buses ESPOL', lng:-79.96532, lat:-2.14504, category:'Movilidad', note:'Terminal principal del núcleo académico.' },
  { id:'coliseo-nuevo', name:'Coliseo Nuevo', lng:-79.96722, lat:-2.14209, category:'Deporte', note:'Instalación deportiva al norte de FIEC.' },
  { id:'biblioteca', name:'Biblioteca Central · 7A', lng:-79.96611, lat:-2.14727, category:'Servicios', note:'Centro de Información Bibliotecaria, frente a Rectorado.' },
  { id:'rectorado', name:'Rectorado', lng:-79.96446, lat:-2.14765, category:'Administración', note:'Rectorado de ESPOL.' },
  { id:'lake', name:'Lago / Embalse ESPOL', lng:-79.96160, lat:-2.14730, category:'Paisaje', note:'Embalse del campus; existe un proyecto documentado de ciclovía alrededor del vaso.' }
];

// Catálogo institucional útil para entender el campus. No se inventan coordenadas
// para cada bloque: esto alimenta el panel de referencia y futuras fases de modelado.
export const BUILDING_CATALOG = [
  { faculty:'FIEC', blocks:'11A, 11B, 11C, 11D, 11F', detail:'11A es el edificio principal y contiene administración y Auditorio FIEC; 11B soporte/aulas híbridas/computación; 11C concentra laboratorios eléctricos, electrónicos, telecom y control; 11D aulas/asociaciones; 11F oficinas y clubes.' },
  { faculty:'FIMCP', blocks:'12I, 12E, 12G + edificio principal', detail:'12I termofluidos y Robota; 12E LEMAT, soldadura, materiales y metalografía; 12G alimentos, sólidos, microbiología y biblioteca.' },
  { faculty:'FICT', blocks:'13A, 13B, 13D, 13E, 13F, 13G, 13H', detail:'13A administración; 13B petrografía/geofísica/fotogeología/topografía; 13D sanitaria/minerales; 13E geotecnia; 13F petróleos; 13G asociación/biblioteca/computación; 13H aulas, auditorio y lectura.' },
  { faculty:'FADCOM', blocks:'14A, 14B, 14C, 3M, 7B', detail:'14A/14B concentran administración, aulas, laboratorios y talleres; 14C comedor/parqueadero; 3M talleres de carpintería/modelado/cerámica/corte; 7B Motion Lab.' },
  { faculty:'FCV', blocks:'sector FCV + Centro de Interpretación BVPP', detail:'Facultad ligada a laboratorios de ciencias de la vida, vivero y actividades de investigación/restauración del Bosque Protector.' },
  { faculty:'FCNM', blocks:'sector FCNM', detail:'Bloques de matemáticas/ciencias naturales, aulas, laboratorios y biblioteca del sector.' },
  { faculty:'FCSH', blocks:'sector FCSH', detail:'Bloques de Ciencias Sociales y Humanísticas, aulas, oficinas y laboratorios del sector.' },
  { faculty:'CIB', blocks:'7A', detail:'Biblioteca/Centro de Información Bibliotecaria, documentado oficialmente frente a Rectorado.' }
];

// Las tres parcelas permanentes del estudio florístico 2024/2025 fueron publicadas
// en UTM 17S. Aquí se almacenan sus centroides convertidos a WGS84 y su altitud.
// Los pesos son IVI (%) de las especies dominantes reportadas por parcela.
export const ECOLOGICAL_PLOTS = [
  {
    id:'low', label:'Bosque · parcela baja', lng:-79.9735866, lat:-2.1449699, altitudeM:125,
    species:[
      ['Handroanthus chrysanthus',34.72],
      ['Cochlospermum vitifolium',31.93],
      ['Machaerium millei',14.07],
      ['Gliricidia brenningii',7.88],
      ['Centrolobium ochroxylum',6.67]
    ]
  },
  {
    id:'mid', label:'Bosque · parcela media', lng:-79.9738972, lat:-2.1477584, altitudeM:179,
    species:[
      ['Machaerium millei',43.88],
      ['Cochlospermum vitifolium',17.22],
      ['Gliricidia brenningii',9.99],
      ['Simira ecuadorensis',9.90],
      ['Gliricidia sepium',6.25],
      ['Handroanthus chrysanthus',2.75]
    ]
  },
  {
    id:'high', label:'Bosque · parcela alta', lng:-79.9784023, lat:-2.1506086, altitudeM:226,
    species:[
      ['Ficus insipida',32.29],
      ['Simira ecuadorensis',16.68],
      ['Sorocea sprucei',12.01],
      ['Eugenia concava',9.45],
      ['Neea divaricata',8.12]
    ]
  }
];

// Especies documentadas en fuentes ESPOL/BVPP y en el estudio florístico reciente.
// `form` solo controla el arquetipo geométrico del árbol, no una reconstrucción botánica exacta.
export const TREE_SPECIES = [
  {name:'Ceibo', scientific:'Ceiba trichistandra', maxHeight:40, deciduous:true, weight:1.25, context:'native', form:'ceibo'},
  {name:'Guayacán', scientific:'Handroanthus chrysanthus', maxHeight:35, deciduous:true, weight:1.10, context:'native', form:'round'},
  {name:'Bototillo', scientific:'Cochlospermum vitifolium', maxHeight:18, deciduous:true, weight:.95, context:'native', form:'open'},
  {name:'Machaerium millei', scientific:'Machaerium millei', maxHeight:22, deciduous:true, weight:.88, context:'native', form:'round'},
  {name:'Gliricidia brenningii', scientific:'Gliricidia brenningii', maxHeight:18, deciduous:true, weight:.58, context:'native', form:'open'},
  {name:'Centrolobium ochroxylum', scientific:'Centrolobium ochroxylum', maxHeight:28, deciduous:true, weight:.42, context:'native', form:'round'},
  {name:'Simira ecuadorensis', scientific:'Simira ecuadorensis', maxHeight:22, deciduous:false, weight:.54, context:'native', form:'round'},
  {name:'Gliricidia sepium', scientific:'Gliricidia sepium', maxHeight:15, deciduous:true, weight:.42, context:'native', form:'open'},
  {name:'Higuerón', scientific:'Ficus insipida', maxHeight:30, deciduous:false, weight:.45, context:'native', form:'umbrella'},
  {name:'Sorocea sprucei', scientific:'Sorocea sprucei', maxHeight:18, deciduous:false, weight:.34, context:'native', form:'round'},
  {name:'Eugenia concava', scientific:'Eugenia concava', maxHeight:16, deciduous:false, weight:.32, context:'native', form:'round'},
  {name:'Neea divaricata', scientific:'Neea divaricata', maxHeight:15, deciduous:false, weight:.28, context:'native', form:'round'},
  {name:'Palo Santo', scientific:'Bursera graveolens', maxHeight:12, deciduous:true, weight:1.00, context:'native', form:'open'},
  {name:'Balsa', scientific:'Ochroma pyramidale', maxHeight:30, deciduous:false, weight:.60, context:'native', form:'round'},
  {name:'Algarrobo', scientific:'Prosopis juliflora', maxHeight:15, deciduous:true, weight:.75, context:'native', form:'umbrella'},
  {name:'Pechiche', scientific:'Vitex gigantea', maxHeight:30, deciduous:true, weight:.72, context:'both', form:'round'},
  {name:'Samán', scientific:'Samanea saman', maxHeight:25, deciduous:false, weight:.82, context:'both', form:'umbrella'},
  {name:'Fernán Sánchez', scientific:'—', maxHeight:22, deciduous:true, weight:.68, context:'native', form:'round'},
  {name:'Laurel', scientific:'—', maxHeight:24, deciduous:false, weight:.65, context:'native', form:'round'},
  {name:'Guachapelí', scientific:'—', maxHeight:25, deciduous:true, weight:.58, context:'native', form:'umbrella'},
  {name:'Ébano', scientific:'—', maxHeight:16, deciduous:true, weight:.38, context:'native', form:'round'},
  {name:'Cascol', scientific:'—', maxHeight:16, deciduous:true, weight:.42, context:'native', form:'open'},
  {name:'Roble', scientific:'—', maxHeight:25, deciduous:true, weight:.36, context:'native', form:'round'},
  {name:'Caoba', scientific:'Swietenia macrophylla', maxHeight:35, deciduous:false, weight:.26, context:'both', form:'round'},
  {name:'Nigüito', scientific:'Muntingia calabura', maxHeight:12, deciduous:false, weight:.52, context:'both', form:'round'},
  {name:'Neem', scientific:'Azadirachta indica', maxHeight:20, deciduous:false, weight:.24, context:'campus', form:'round'},
  {name:'Mango', scientific:'Mangifera indica', maxHeight:22, deciduous:false, weight:.34, context:'campus', form:'round'},
  {name:'Muyuyo de montaña', scientific:'Tecoma castanifolia', maxHeight:6, deciduous:true, weight:.32, context:'native', form:'open'},
  {name:'Pretino', scientific:'Cavanillesia platanifolia', maxHeight:36, deciduous:true, weight:.28, context:'native', form:'ceibo'},
  {name:'Guayacán negro', scientific:'—', maxHeight:14, deciduous:true, weight:.28, context:'native', form:'round'}
];
