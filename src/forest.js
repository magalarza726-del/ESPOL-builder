import { CAMPUS, TREE_SPECIES, ECOLOGICAL_PLOTS } from './config.js';
import { UNDERSTORY_SPECIES, VEGETATION_PROFILE } from './vegetation.js';

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
  return weightedFromList(rng,pool.length?pool:TREE_SPECIES,s=>s.weight);
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
function randomPoint(rng){
  const {west,east,north,south}=CAMPUS.bounds;
  return [west+(east-west)*rng(),south+(north-south)*rng()];
}
function naturalAcceptance(lng,lat){
  const {west,east}=CAMPUS.bounds;
  const westness=(east-lng)/(east-west);
  let accept=0.14+0.86*Math.pow(clamp(westness,0,1),0.68);
  if(inRect(lng,lat,ACADEMIC_CORE))accept*=0.024;
  if(inRect(lng,lat,FIEC_FIMCP_CORE))accept*=0.16;
  if(lng>-79.955)accept*=0.12;
  return accept;
}

function makeTree(rng,lng,lat,zone,index,ecology=null){
  let s;
  if(zone==='campus')s=weightedSpecies(rng,'campus');
  else if(ecology){
    const plotInfluence=clamp(.84-(ecology.distanceM/2600)*.40,.36,.84);
    s=rng()<plotInfluence?speciesFromPlot(rng,ecology.plot):weightedSpecies(rng,'native');
  }else s=weightedSpecies(rng,'native');

  const juvenile=rng()<0.66;
  const dbhCm=juvenile?5+rng()*10:15+Math.pow(rng(),1.7)*55;
  const maturity=juvenile?(0.24+0.34*gaussianLike(rng)):(0.52+0.48*gaussianLike(rng));
  const height=clamp(s.maxHeight*maturity,2.8,s.maxHeight);
  let canopyM=height*(0.21+0.13*rng());
  if(s.form==='umbrella')canopyM*=1.30;
  if(s.form==='ceibo')canopyM*=1.18;
  if(s.form==='open')canopyM*=.88;
  canopyM=clamp(canopyM,1.20,10.2);

  return {
    type:'Feature',
    properties:{
      id:index,habit:'tree',name:s.name,scientific:s.scientific,
      height:+height.toFixed(2),canopyM:+canopyM.toFixed(2),
      trunkRadiusM:+clamp(dbhCm/200,.035,.46).toFixed(3),dbhCm:+dbhCm.toFixed(1),
      deciduous:s.deciduous?1:0,form:s.form||'round',zone,
      ecologicalBand:ecology?.plot?.id||'campus',ecologicalAltitudeM:ecology?.plot?.altitudeM||0,
      dryPersistence:s.deciduous?.58:.90,rand:rng()
    },
    geometry:{type:'Point',coordinates:[lng,lat]}
  };
}

function chooseHabit(rng,ecology){
  const mix={...VEGETATION_PROFILE.habitMix};
  // La parcela alta y quebrada estacional aportan más humedad, helechos y epífitas.
  if(ecology?.plot?.id==='high'&&ecology.distanceM<VEGETATION_PROFILE.highMoistureRadiusM){
    mix.herb+=.07;mix.epiphyte+=.05;mix.shrub-=.04;mix.vine-=.08;
  }
  const rows=Object.entries(mix);
  return weightedFromList(rng,rows,r=>r[1])[0];
}
function chooseUnderstorySpecies(rng,habit,ecology){
  let pool=UNDERSTORY_SPECIES.filter(s=>s.habit===habit);
  if(!pool.length)pool=UNDERSTORY_SPECIES;

  const highMoist=ecology?.plot?.id==='high'&&ecology.distanceM<VEGETATION_PROFILE.highMoistureRadiusM;
  return weightedFromList(rng,pool,s=>{
    let w=s.weight;
    if(highMoist&&(s.moisture==='high'||s.moisture==='ravine'))w*=VEGETATION_PROFILE.ravineBoost;
    if(!highMoist&&s.moisture==='ravine')w*=.20;
    if(s.moisture==='dry'&&ecology?.plot?.id==='low')w*=1.5;
    return w;
  });
}
function makeUnderstoryPatch(rng,lng,lat,index,ecology){
  const habit=chooseHabit(rng,ecology);
  const s=chooseUnderstorySpecies(rng,habit,ecology);
  const isHigh=ecology?.plot?.id==='high';
  const scale=habit==='shrub'?.8+rng()*1.8:habit==='herb'?.28+rng()*.85:habit==='vine'?.7+rng()*2.2:.25+rng()*.45;
  const density=habit==='herb'?2+Math.floor(rng()*6):habit==='shrub'?1+Math.floor(rng()*3):habit==='vine'?1+Math.floor(rng()*2):1;

  return {
    type:'Feature',
    properties:{
      id:index,habit,name:s.name,scientific:s.scientific,form:s.form,
      zone:'bpp',ecologicalBand:ecology?.plot?.id||'mid',
      dryPersistence:s.dryPersistence??.5,seasonalDry:s.seasonalDry?1:0,
      moisture:s.moisture||'normal',scale:+scale.toFixed(2),density,
      highMoist:isHigh?1:0,rand:rng()
    },
    geometry:{type:'Point',coordinates:[lng,lat]}
  };
}

/**
 * Reconstrucción procedural del BVPP para tiempo real.
 *
 * La capa distingue dos escalas:
 * - estrato arbóreo, calibrado con IVI y parcelas ESPOL 2024/2025;
 * - sotobosque (arbustos, herbáceas, trepadoras y epífitas), calibrado con el
 *   monitoreo ESPOL 2010 y observaciones recientes de la parcela alta.
 *
 * Los puntos son parches visuales reproducibles, NO coordenadas de inventario.
 * La cantidad global se mantiene moderada porque la fidelidad cercana se resuelve
 * mediante LOD e instancias 3D, no llenando GitHub Pages con millones de plantas.
 */
export function buildProceduralForest(treeCount=VEGETATION_PROFILE.treeCount,seed=24071991){
  const rng=mulberry32(seed),features=[];
  const naturalTarget=Math.round(treeCount*.90);

  let guard=0;
  while(features.length<naturalTarget&&guard<treeCount*95){
    guard++;
    const [lng,lat]=randomPoint(rng);
    if(rng()>naturalAcceptance(lng,lat))continue;
    const ecology=nearestEcologicalPlot(lng,lat);
    features.push(makeTree(rng,lng,lat,'bpp',features.length,ecology));
  }

  // Arbolado plantado del núcleo académico: mucho más escaso y separado del BVPP.
  guard=0;
  while(features.filter(f=>f.properties.habit==='tree').length<treeCount&&guard<treeCount*75){
    guard++;
    const lng=ACADEMIC_CORE.west+(ACADEMIC_CORE.east-ACADEMIC_CORE.west)*rng();
    const lat=ACADEMIC_CORE.south+(ACADEMIC_CORE.north-ACADEMIC_CORE.south)*rng();
    const dFiec=Math.hypot((lng+79.9674)*111250,(lat+2.1449)*110574);
    if(dFiec<80&&rng()<.80)continue;
    features.push(makeTree(rng,lng,lat,'campus',features.length,null));
  }

  // Sotobosque: se generan parches en zona natural, no cada hoja individual.
  const understoryTarget=VEGETATION_PROFILE.understoryPatchCount;
  guard=0;let made=0;
  while(made<understoryTarget&&guard<understoryTarget*100){
    guard++;
    const [lng,lat]=randomPoint(rng);
    if(inRect(lng,lat,ACADEMIC_CORE)&&rng()<.985)continue;
    if(rng()>naturalAcceptance(lng,lat)*1.08)continue;
    const ecology=nearestEcologicalPlot(lng,lat);
    features.push(makeUnderstoryPatch(rng,lng,lat,features.length,ecology));
    made++;
  }

  return {type:'FeatureCollection',features};
}
