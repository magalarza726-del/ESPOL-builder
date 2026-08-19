import { CAMPUS, TREE_SPECIES, ECOLOGICAL_PLOTS } from './config.js';

function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function gaussianLike(rng){return (rng()+rng()+rng()+rng())/4}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

const ACADEMIC_CORE={west:-79.9706,east:-79.9582,south:-2.1525,north:-2.1405};
const FIEC_FIMCP_CORE={west:-79.9700,east:-79.9638,south:-2.1470,north:-2.1412};
const SPECIES_BY_SCI=new Map(TREE_SPECIES.map(s=>[s.scientific,s]));

function inRect(lng,lat,r){return lng>=r.west&&lng<=r.east&&lat>=r.south&&lat<=r.north}
function dist2M(a,b){
  const r=((a.lat+b.lat)*.5)*Math.PI/180;
  const dx=(a.lng-b.lng)*111320*Math.cos(r);
  const dy=(a.lat-b.lat)*110574;
  return dx*dx+dy*dy;
}

function weightedFromList(rng,src,weightGetter){
  const total=src.reduce((sum,s)=>sum+Math.max(0,weightGetter(s)),0);
  if(total<=0)return src[0];
  let x=rng()*total;
  for(const s of src){x-=Math.max(0,weightGetter(s));if(x<=0)return s}
  return src[src.length-1];
}

function weightedSpecies(rng,context='native'){
  const pool=TREE_SPECIES.filter(s=>s.context===context||s.context==='both'||context==='any');
  const src=pool.length?pool:TREE_SPECIES;
  return weightedFromList(rng,src,s=>s.weight);
}

function nearestEcologicalPlot(lng,lat){
  let best=ECOLOGICAL_PLOTS[0],bestD=Infinity;
  for(const p of ECOLOGICAL_PLOTS){const d=dist2M({lng,lat},p);if(d<bestD){best=p;bestD=d}}
  return {plot:best,distanceM:Math.sqrt(bestD)};
}

function speciesFromPlot(rng,plot){
  const row=weightedFromList(rng,plot.species,x=>x[1]);
  return SPECIES_BY_SCI.get(row[0])||weightedSpecies(rng,'native');
}

function makeTree(rng,lng,lat,zone,index,ecology=null){
  let s;
  if(zone==='campus'){
    s=weightedSpecies(rng,'campus');
  }else if(ecology){
    // Las parcelas son muestras pequeñas, no mapas continuos. Cerca de ellas
    // usamos su IVI como calibración fuerte; al alejarnos mezclamos más el catálogo general.
    const plotInfluence=clamp(.82-(ecology.distanceM/2600)*.38,.38,.82);
    s=rng()<plotInfluence?speciesFromPlot(rng,ecology.plot):weightedSpecies(rng,'native');
  }else{
    s=weightedSpecies(rng,'native');
  }

  // El estudio florístico reciente reporta concentración de individuos juveniles
  // en clases de DAP 5–15 cm. Se conserva una cola de árboles maduros para que
  // el bosque seco no parezca una plantación uniforme.
  const juvenile=rng()<0.64;
  const dbhCm=juvenile ? 5+rng()*10 : 15+Math.pow(rng(),1.6)*55;
  const maturity=juvenile ? (0.24+0.34*gaussianLike(rng)) : (0.52+0.48*gaussianLike(rng));
  const height=clamp(s.maxHeight*maturity,2.8,s.maxHeight);
  let canopyM=height*(0.22+0.13*rng());
  if(s.form==='umbrella')canopyM*=1.30;
  if(s.form==='ceibo')canopyM*=1.18;
  if(s.form==='open')canopyM*=.88;
  canopyM=clamp(canopyM,1.25,10.5);
  const trunkRadiusM=clamp(dbhCm/200,0.035,0.46);

  return {
    type:'Feature',
    properties:{
      id:index,
      name:s.name,
      scientific:s.scientific,
      height:+height.toFixed(2),
      canopyM:+canopyM.toFixed(2),
      trunkRadiusM:+trunkRadiusM.toFixed(3),
      dbhCm:+dbhCm.toFixed(1),
      deciduous:s.deciduous?1:0,
      form:s.form||'round',
      zone,
      ecologicalBand:ecology?.plot?.id||'campus',
      ecologicalAltitudeM:ecology?.plot?.altitudeM||0,
      rand:rng()
    },
    geometry:{type:'Point',coordinates:[lng,lat]}
  };
}

function randomPoint(rng){
  const {west,east,north,south}=CAMPUS.bounds;
  return [west+(east-west)*rng(),south+(north-south)*rng()];
}

/**
 * Reconstrucción ecológica procedural, NO inventario georreferenciado.
 *
 * v0.3 mejora la distribución de dos formas:
 * 1) separa bosque natural de arbolado del núcleo académico;
 * 2) interpola de manera heurística la composición de especies a partir de las
 *    tres parcelas permanentes (125, 179 y 226 m) del estudio ESPOL 2024/2025.
 *
 * Esto reproduce mejor la identidad ecológica, pero NO implica que un árbol
 * generado exista exactamente en esa coordenada.
 */
export function buildProceduralForest(count=5200,seed=24071991){
  const rng=mulberry32(seed);
  const features=[];
  const naturalTarget=Math.round(count*0.90);
  const {west,east}=CAMPUS.bounds;

  // Bosque/BVPP: fuerte sesgo a la mitad occidental y bordes del núcleo.
  let guard=0;
  while(features.length<naturalTarget&&guard<count*90){
    guard++;
    const [lng,lat]=randomPoint(rng);
    const westness=(east-lng)/(east-west);
    const inCore=inRect(lng,lat,ACADEMIC_CORE);
    const inFiec=inRect(lng,lat,FIEC_FIMCP_CORE);

    // El estudio GIS sitúa buena parte de los accesos forestales hacia el oeste.
    // No se interpreta esto como un límite exacto del BVPP: es un bias visual.
    let accept=0.17+0.83*Math.pow(clamp(westness,0,1),0.70);
    if(inCore)accept*=0.030;
    if(inFiec)accept*=0.18;
    if(lng>-79.955)accept*=0.14;
    if(rng()>accept)continue;

    const ecology=nearestEcologicalPlot(lng,lat);
    features.push(makeTree(rng,lng,lat,'bpp',features.length,ecology));
  }

  // Arbolado del campus: densidad mucho menor en facultades/servicios.
  // La ficha institucional indica que la vegetación plantada representa <10% del campus.
  guard=0;
  while(features.length<count&&guard<count*70){
    guard++;
    const lng=ACADEMIC_CORE.west+(ACADEMIC_CORE.east-ACADEMIC_CORE.west)*rng();
    const lat=ACADEMIC_CORE.south+(ACADEMIC_CORE.north-ACADEMIC_CORE.south)*rng();
    const dFiec=Math.hypot((lng+79.9674)*111250,(lat+2.1449)*110574);
    if(dFiec<80&&rng()<0.78)continue;
    features.push(makeTree(rng,lng,lat,'campus',features.length,null));
  }

  return {type:'FeatureCollection',features};
}
