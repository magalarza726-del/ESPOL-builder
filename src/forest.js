import { CAMPUS, TREE_SPECIES } from './config.js';

function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function weightedSpecies(rng){const total=TREE_SPECIES.reduce((s,x)=>s+x.weight,0);let x=rng()*total;for(const s of TREE_SPECIES){x-=s.weight;if(x<=0)return s}return TREE_SPECIES[0]}
function gaussianLike(rng){return (rng()+rng()+rng()+rng())/4}

// No inventa inventario forestal: genera una capa visual reproducible dentro del
// área de estudio y evita concentrar árboles en el núcleo académico aproximado.
export function buildProceduralForest(count=1450, seed=24071991){
  const rng=mulberry32(seed);
  const features=[];
  const {west,east,north,south}=CAMPUS.bounds;
  for(let i=0;i<count;i++){
    const lng=west+(east-west)*rng();
    const lat=south+(north-south)*rng();
    const dCore=Math.hypot((lng-CAMPUS.spawn.lng)*111000,(lat-CAMPUS.spawn.lat)*111000);
    const westness=(east-lng)/(east-west);
    const hillBias=0.28+0.72*Math.pow(westness,0.65);
    const corePenalty=dCore<720 ? 0.18 : dCore<1250 ? 0.55 : 1;
    if(rng()>hillBias*corePenalty){i--;continue}
    const s=weightedSpecies(rng);
    const h=Math.max(3,s.maxHeight*(0.35+0.65*gaussianLike(rng)));
    features.push({
      type:'Feature',
      properties:{name:s.name,scientific:s.scientific,height:Math.round(h),deciduous:s.deciduous?1:0,rand:rng()},
      geometry:{type:'Point',coordinates:[lng,lat]}
    });
  }
  return {type:'FeatureCollection',features};
}
