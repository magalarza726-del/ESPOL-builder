export const CAMPUS = {
  // Bounding box published in Ching-Ávalos et al. (LACCEI 2020).
  bounds: {
    north: -2.1311111111,
    south: -2.1569444444,
    east: -79.9425,
    west: -79.9825
  },
  // Official/ESPOL-linked contact coordinate used as practical spawn in the academic core.
  spawn: { lng: -79.9669568, lat: -2.1477461 },
  studyAreaHa: 696,
  infrastructureHa: 91.91,
  bppStudyHa: 225.67,
  routesKm: 22.9831,
  roadWidthThresholdM: 1.8
};

export const MAP_SOURCES = {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  vector: 'https://tiles.openfreemap.org/planet',
  terrain: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
};

export const LANDMARKS = [
  { id:'academic-core', name:'Núcleo académico', lng:-79.9669568, lat:-2.1477461, note:'Punto de inicio en el núcleo académico de ESPOL.' },
  { id:'lake', name:'Lago ESPOL', lng:-79.9616, lat:-2.1473, note:'Embalse artificial y uno de los hitos más reconocibles del campus.' },
  { id:'fimcp', name:'Zona FIMCP', lng:-79.96619, lat:-2.14438, note:'Facultad de Ingeniería en Mecánica y Ciencias de la Producción.' },
  { id:'fimcp-aud', name:'Auditorio FIMCP', lng:-79.96652, lat:-2.14417, note:'Referencia cartográfica abierta para el sector FIMCP.' }
];

// Catálogo representativo de la página oficial de Biodiversidad del BPP.
// Las alturas aquí solo se fijan cuando la fuente institucional publicada da un máximo explícito.
export const TREE_SPECIES = [
  {name:'Ceibo', scientific:'Ceiba trichistandra', maxHeight:40, deciduous:true, weight:1.7},
  {name:'Algarrobo', scientific:'Prosopis juliflora', maxHeight:15, deciduous:true, weight:1.2},
  {name:'Pechiche', scientific:'Vitex gigantea', maxHeight:30, deciduous:true, weight:0.9},
  {name:'Samán', scientific:'Samanea saman', maxHeight:25, deciduous:false, weight:0.65},
  {name:'Muyuyo de montaña', scientific:'Tecoma castanifolia', maxHeight:6, deciduous:true, weight:0.7},
  {name:'Pretino (Pijío)', scientific:'Cavanillesia platanifolia', maxHeight:36, deciduous:true, weight:0.5},
  {name:'Palo Santo', scientific:'Bursera graveolens', maxHeight:12, deciduous:true, weight:1.4},
  {name:'Guayacán', scientific:'Tabebuia chrysantha', maxHeight:35, deciduous:true, weight:1.25},
  {name:'Guayacán negro', scientific:'Tabebuia billbergii', maxHeight:14, deciduous:true, weight:0.55},
  {name:'Nigüito', scientific:'Muntingia calabura', maxHeight:12, deciduous:false, weight:0.8},
  {name:'Amarillo', scientific:'—', maxHeight:18, deciduous:true, weight:0.55},
  {name:'Neem', scientific:'Azadirachta indica', maxHeight:20, deciduous:false, weight:0.25},
  {name:'Porotillo', scientific:'—', maxHeight:15, deciduous:true, weight:0.5},
  {name:'Polo polo', scientific:'—', maxHeight:15, deciduous:true, weight:0.45},
  {name:'Guázimu', scientific:'—', maxHeight:15, deciduous:false, weight:0.45},
  {name:'Fernán Sánchez', scientific:'—', maxHeight:22, deciduous:true, weight:0.6},
  {name:'Caracolí', scientific:'—', maxHeight:30, deciduous:false, weight:0.45},
  {name:'Mango', scientific:'Mangifera indica', maxHeight:22, deciduous:false, weight:0.35},
  {name:'Jacaranda', scientific:'—', maxHeight:18, deciduous:true, weight:0.3}
];
