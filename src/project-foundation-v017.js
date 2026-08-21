import { CAMPUS } from './config.js';
import { FIMCP_PHOTO_SURVEY, surveyCoverageIsComplete } from './fimcp-photo-survey.js';
import { FIMCP_SPATIAL_CONTROL, insideFIMCPCore, controlPointList } from './fimcp-spatial-control.js';
import { FACULTY_IDS } from './faculty-registry-v017.js';

export const PROJECT=Object.freeze({version:'v0.17.0',codename:'CAMPUS ARCHITECTURE + INTERIORS',purpose:'Master world ESPOL: edificios siempre visibles, fachadas e interiores trazables y colisiones con puertas transitables',featureFreeze:true,targetFps:60,minimumHealthyFps:45,activeReconstruction:'campus-architecture-v017'});
export const VERTICAL_SLICE=Object.freeze({id:'campus-architecture-v017',label:'Campus Architecture · FIMCP recovery',bounds:FIMCP_SPATIAL_CONTROL.coreBounds,qualityGates:Object.freeze({minTotalBuildings:10,minFIMCPBuildings:2,humanScaleMinM:1.5,humanScaleMaxM:2.1}),terrainSamples:Object.freeze([[FIMCP_SPATIAL_CONTROL.points.parking.lng,FIMCP_SPATIAL_CONTROL.points.parking.lat],[FIMCP_SPATIAL_CONTROL.points.auditorium.lng,FIMCP_SPATIAL_CONTROL.points.auditorium.lat],[FIMCP_SPATIAL_CONTROL.points.block18A.lng,FIMCP_SPATIAL_CONTROL.points.block18A.lat],[FIMCP_SPATIAL_CONTROL.points.block24C.lng,FIMCP_SPATIAL_CONTROL.points.block24C.lat]])});
export function insideVerticalSlice(lng,lat){return insideFIMCPCore(lng,lat);}
export function auditFoundation(world,structures={}){
  const hardErrors=[],warnings=[],metrics={};
  if(!world)hardErrors.push('world-missing');
  if(typeof world?.getElevation!=='function')hardErrors.push('terrain-sampler-missing');
  if(!world?.__terrainSurfaceInstalled)hardErrors.push('terrain-surface-not-unified');
  if(!world?.forestDatabase||!world?.__forestSystemV2)hardErrors.push('forest-v2-not-installed');
  if(typeof world?.resolvePosition!=='function')hardErrors.push('collision-resolver-missing');
  if(typeof world?.render!=='function')hardErrors.push('renderer-missing');
  if(!world?.__campusArchitectureV017)hardErrors.push('campus-architecture-v017-not-installed');
  if(!world?.__dayNightV016)hardErrors.push('day-night-v016-not-installed');
  if(!surveyCoverageIsComplete())hardErrors.push('fimcp-photo-survey-coverage-broken');
  if(!insideFIMCPCore(CAMPUS.spawn.lng,CAMPUS.spawn.lat))hardErrors.push('spawn-outside-fimcp-core');
  metrics.spawn={lng:CAMPUS.spawn.lng,lat:CAMPUS.spawn.lat,name:CAMPUS.spawnName};
  const elevations=VERTICAL_SLICE.terrainSamples.map(([lng,lat])=>world?.getElevation?.(lng,lat));metrics.terrainSamples=elevations.map(v=>Number.isFinite(v)?Math.round(v*10)/10:null);if(elevations.some(v=>!Number.isFinite(v)))hardErrors.push('fimcp-terrain-nonfinite');
  const architecture=world?.campusArchitectureReport||null;metrics.campusArchitecture=architecture;metrics.runtimeBuildingVolumes=structures?.buildings?.length||0;
  if(!architecture)hardErrors.push('architecture-report-missing');
  else{
    if(architecture.totalBuildings<VERTICAL_SLICE.qualityGates.minTotalBuildings)hardErrors.push('campus-building-set-too-small');
    if(architecture.fimcpVisibleBuildings<VERTICAL_SLICE.qualityGates.minFIMCPBuildings)hardErrors.push('fimcp-buildings-missing');
    if(architecture.interiors<1)hardErrors.push('interior-system-empty');
    if(architecture.facultyCoverage<FACULTY_IDS.length)warnings.push(`faculty-gis-label-coverage:${architecture.facultyCoverage}/${FACULTY_IDS.length}`);
    if(architecture.runtimeFallbackBuildings>architecture.totalBuildings*.65)warnings.push('building-capture-heavy-fallback');
  }
  const controls=controlPointList();metrics.controlPoints=controls.length;if(controls.some(p=>p.lng<CAMPUS.bounds.west||p.lng>CAMPUS.bounds.east||p.lat<CAMPUS.bounds.south||p.lat>CAMPUS.bounds.north))hardErrors.push('fimcp-control-point-outside-campus');
  metrics.photoCount=FIMCP_PHOTO_SURVEY.photoCount;metrics.facultyRegistryCount=FACULTY_IDS.length;metrics.avatarHeightM=CAMPUS.avatarHeightM;
  if(FACULTY_IDS.length!==8)hardErrors.push('faculty-registry-not-eight');
  if(CAMPUS.avatarHeightM<VERTICAL_SLICE.qualityGates.humanScaleMinM||CAMPUS.avatarHeightM>VERTICAL_SLICE.qualityGates.humanScaleMaxM)hardErrors.push('avatar-scale-invalid');
  return Object.freeze({version:PROJECT.version,phase:PROJECT.codename,slice:VERTICAL_SLICE.id,ok:hardErrors.length===0,degraded:hardErrors.length===0&&warnings.length>0,hardErrors:Object.freeze(hardErrors),warnings:Object.freeze(warnings),metrics:Object.freeze(metrics),generatedAt:new Date().toISOString()});
}
export function installProjectMetadata(){
  if(typeof document==='undefined')return;document.documentElement.dataset.espolBuilderVersion=PROJECT.version;document.body?.setAttribute('data-project-phase',PROJECT.codename);globalThis.__ESPOL_PROJECT__={PROJECT,VERTICAL_SLICE,FIMCP_SPATIAL_CONTROL,FIMCP_PHOTO_SURVEY,FACULTY_IDS};
  const badge=document.querySelector('.topbar .badge');if(badge)badge.textContent=`${PROJECT.version} · CAMPUS ARCHITECTURE · INTERIORES`;
  const buffer=globalThis.__ESPOL_RUNTIME_ERRORS__||=[];const remember=(type,payload)=>{buffer.push({type,payload:String(payload?.message||payload||'unknown'),at:new Date().toISOString()});if(buffer.length>40)buffer.splice(0,buffer.length-40);};addEventListener('error',e=>remember('error',e.error||e.message));addEventListener('unhandledrejection',e=>remember('unhandledrejection',e.reason));
  addEventListener('espol:foundation-audit',event=>{const report=event.detail,state=!report?.ok?'failed':report.degraded?'degraded':'ok';document.body.dataset.foundationState=state;if(badge){badge.dataset.foundationState=state;badge.title=report?.warnings?.length?`Foundation: ${state} · ${report.warnings.join(', ')}`:`Foundation: ${state}`;}});
}
