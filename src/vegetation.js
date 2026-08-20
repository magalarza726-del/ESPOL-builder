// Catálogo compacto para la representación procedural del sotobosque del BVPP.
// Fuentes principales:
// - Adriano Macas (ESPOL 2024/2025): 245 árboles DAP>=5 cm en 3000 m²,
//   con 73% de individuos en las clases de DAP 5–15 cm; parcelas baja/media/alta.
// - Rubio & Vásquez (ESPOL 2010): herbáceas, trepadoras y epífitas de zona alta.
// - Plan de manejo BVPP (ESPOL 2021): bosque seco restaurado/secundario con parches.
//
// IMPORTANTE: la densidad observada en parcelas sirve como referencia estructural.
// No se extrapola como un censo exacto árbol-por-árbol de todo el campus.

export const UNDERSTORY_SPECIES = [
  {name:'Pasto guinea',scientific:'Panicum maximum',habit:'herb',form:'grass',weight:9.88,native:false,dryPersistence:.72},
  {name:'Dicliptera',scientific:'Dicliptera unguiculata',habit:'herb',form:'broad',weight:6.17,native:true,dryPersistence:.48},
  {name:'Alternanthera',scientific:'Alternanthera sp.',habit:'herb',form:'broad',weight:5.40,native:true,dryPersistence:.52},
  {name:'Panicum',scientific:'Panicum sp.',habit:'herb',form:'grass',weight:5.40,native:true,dryPersistence:.68},
  {name:'Heliconia',scientific:'Heliconia metallica',habit:'herb',form:'broad',weight:2.00,native:true,dryPersistence:.24,moisture:'high'},
  {name:'Heliotropium',scientific:'Heliotropium angiospermum',habit:'herb',form:'broad',weight:1.39,native:true,dryPersistence:.55},
  {name:'Lasiacis',scientific:'Lasiacis ligulata',habit:'herb',form:'grass',weight:2.78,native:true,dryPersistence:.58},
  {name:'Liabum',scientific:'Liabum stipulatum',habit:'herb',form:'broad',weight:2.01,native:true,dryPersistence:.44},
  {name:'Lycoseris',scientific:'Lycoseris trinervis',habit:'herb',form:'broad',weight:2.93,native:true,dryPersistence:.50},
  {name:'Tetramerium',scientific:'Tetramerium nervosum',habit:'herb',form:'broad',weight:2.01,native:true,dryPersistence:.45},
  {name:'Triumfetta',scientific:'Triumfetta sp.',habit:'herb',form:'broad',weight:1.39,native:true,dryPersistence:.52},
  {name:'Verbesina',scientific:'Verbesina sp.',habit:'herb',form:'broad',weight:1.35,native:true,dryPersistence:.42},
  {name:'Senna',scientific:'Senna sp.',habit:'herb',form:'broad',weight:.92,native:true,dryPersistence:.50},
  {name:'Eucrosia',scientific:'Eucrosia bicolor',habit:'herb',form:'broad',weight:.70,native:true,dryPersistence:1.0,seasonalDry:true},
  {name:'Helecho de quebrada',scientific:'Pteridophyta sp.',habit:'herb',form:'fern',weight:1.9,native:true,dryPersistence:.18,moisture:'ravine'},
  {name:'Cactácea de bosque seco',scientific:'Cactaceae sp.',habit:'herb',form:'cactus',weight:.75,native:true,dryPersistence:1.0,moisture:'dry'},

  {name:'Marsdenia',scientific:'Marsdenia ecuadoriensis',habit:'vine',form:'vine',weight:6.48,native:true,dryPersistence:.72},
  {name:'Arrabidaea',scientific:'Arrabidaea sp.',habit:'vine',form:'vine',weight:5.40,native:true,dryPersistence:.70},
  {name:'Coccosypselum',scientific:'Coccosypselum vel aff.',habit:'vine',form:'vine',weight:5.09,native:true,dryPersistence:.62},
  {name:'Passiflora',scientific:'Passiflora reflexiflora',habit:'vine',form:'vine',weight:4.47,native:true,dryPersistence:.62},
  {name:'Merremia',scientific:'Merremia umbellata',habit:'vine',form:'vine',weight:4.17,native:true,dryPersistence:.68},
  {name:'Combretum',scientific:'Combretum fruticosum',habit:'vine',form:'vine',weight:3.70,native:true,dryPersistence:.78},
  {name:'Plumbago',scientific:'Plumbago scandens',habit:'vine',form:'vine',weight:3.39,native:true,dryPersistence:.70},
  {name:'Acacia trepadora',scientific:'Acacia tenuifolia',habit:'vine',form:'vine',weight:4.79,native:true,dryPersistence:.74},
  {name:'Canavalia',scientific:'Canavalia rosea',habit:'vine',form:'vine',weight:2.01,native:true,dryPersistence:.60},
  {name:'Paullinia',scientific:'Paullinia dasystachya',habit:'vine',form:'vine',weight:2.01,native:true,dryPersistence:.66},
  {name:'Paullinia pinnata',scientific:'Paullinia pinnata',habit:'vine',form:'vine',weight:1.39,native:true,dryPersistence:.64},
  {name:'Prestonia mollis',scientific:'Prestonia mollis',habit:'vine',form:'vine',weight:1.08,native:true,dryPersistence:.64},
  {name:'Prestonia parvifolia',scientific:'Prestonia parvifolia',habit:'vine',form:'vine',weight:2.31,native:true,dryPersistence:.66},
  {name:'Serjania',scientific:'Serjania sp.',habit:'vine',form:'vine',weight:1.08,native:true,dryPersistence:.68},
  {name:'Tetrapterys',scientific:'Tetrapterys jamesonii',habit:'vine',form:'vine',weight:1.08,native:true,dryPersistence:.68},

  {name:'Lockhartia',scientific:'Lockhartia serra',habit:'epiphyte',form:'epiphyte',weight:.92,native:true,dryPersistence:.42,moisture:'high'},
  {name:'Oncidium',scientific:'Oncidium onustum',habit:'epiphyte',form:'epiphyte',weight:2.00,native:true,dryPersistence:.55,moisture:'high'},
  {name:'Oryctanthus',scientific:'Oryctanthus florulentus',habit:'epiphyte',form:'epiphyte',weight:2.78,native:true,dryPersistence:.72},
  {name:'Epidendrum',scientific:'Epidendrum sp.',habit:'epiphyte',form:'epiphyte',weight:.65,native:true,dryPersistence:.38,moisture:'ravine'},

  {name:'Morisonia',scientific:'Morisonia flexuosa',habit:'shrub',form:'shrub',weight:2.3,native:true,dryPersistence:.72},
  {name:'Clavija',scientific:'Clavija pungens',habit:'shrub',form:'shrub',weight:1.7,native:true,dryPersistence:.64},
  {name:'Randia',scientific:'Randia armata',habit:'shrub',form:'shrub',weight:1.8,native:true,dryPersistence:.68},
  {name:'Ipomoea arbustiva',scientific:'Ipomoea carnea',habit:'shrub',form:'shrub',weight:1.1,native:true,dryPersistence:.62},
  {name:'Croton',scientific:'Croton sp.',habit:'shrub',form:'shrub',weight:1.3,native:true,dryPersistence:.70},
  {name:'Bauhinia',scientific:'Bauhinia aculeata',habit:'shrub',form:'shrub',weight:1.2,native:true,dryPersistence:.70}
];

export const VEGETATION_PROFILE = {
  // v0.8.1: +500% de densidad efectiva frente a v0.8 = 6×.
  // Para conservar fluidez no se sextuplica el número de GeoJSON: se duplican
  // las anclas y se triplica el tamaño de los grupos naturales (2×3 = 6×).
  densityMultiplier: 6,
  treeCount: 18000,
  understoryPatchCount: 8400,
  sampledTreeDensityHa: 817,
  lowPlotTreeDensityHa: 990,
  midPlotTreeDensityHa: 910,
  juvenileShare: .73,
  habitMix: {herb:.46,vine:.29,shrub:.20,epiphyte:.05},
  highMoistureRadiusM: 720,
  ravineBoost: 2.4,
  cluster: {
    naturalMin: 24,
    naturalMax: 66,
    campusMin: 1,
    campusMax: 5,
    renderMax: 66,
    collisionMax: 32,
    spreadM: 10.5
  },
  lod: {
    // Más densidad cercana, manteniendo instancing y auto-LOD.
    treeRadiusM: 125,
    understoryRadiusM: 92,
    canopyMassRadiusM: 700,
    maxTrees: 3000,
    maxCanopyMass: 1400,
    maxShrubs: 700,
    maxHerbs: 1150,
    maxVines: 280,
    maxEpiphytes: 120,
    refreshMs: 680,
    refreshMoveM: 22,
    gridCellM: 85
  }
};
