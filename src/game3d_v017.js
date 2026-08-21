import { createGameWorld as createV013World } from './game3d_v013.js';
import { auditFoundation, PROJECT } from './project-foundation-v017.js';
import { installCampusArchitectureV017 } from './campus-architecture-v017.js';
import { installDayNightExperience } from './day-night-v016.js';

function publishAudit(report){globalThis.__ESPOL_FOUNDATION_REPORT__=report;if(typeof dispatchEvent==='function'&&typeof CustomEvent==='function')dispatchEvent(new CustomEvent('espol:foundation-audit',{detail:report}));}
function finite(value){const n=Number.parseFloat(value);return Number.isFinite(n)?n:null;}
function eachCoord(coords,fn){if(!Array.isArray(coords))return;if(coords.length>=2&&typeof coords[0]==='number'&&typeof coords[1]==='number'){fn(coords);return;}for(const child of coords)eachCoord(child,fn);}
function capturedBuildingRecords(){const features=globalThis.__ESPOL_BUILDING_SYNC__?.getFeatures?.()||[],out=[];for(const feature of features){let minLng=Infinity,maxLng=-Infinity,minLat=Infinity,maxLat=-Infinity;eachCoord(feature.geometry?.coordinates,c=>{minLng=Math.min(minLng,c[0]);maxLng=Math.max(maxLng,c[0]);minLat=Math.min(minLat,c[1]);maxLat=Math.max(maxLat,c[1]);});if(!Number.isFinite(minLng))continue;const p=feature.properties||{},levels=finite(p.levels)??finite(p['building:levels']),height=finite(p.render_height)??finite(p.height)??(levels?levels*3.15:7.4);out.push({...feature,lng:(minLng+maxLng)*.5,lat:(minLat+maxLat)*.5,height,levels});}return out;}

export async function createGameWorld(options){
  const world=await createV013World(options);installDayNightExperience(world);const upstreamSetStructures=world.setStructures.bind(world);
  world.setStructures=structures=>{upstreamSetStructures(structures);installCampusArchitectureV017(world,capturedBuildingRecords(),structures);const report=auditFoundation(world,structures);world.foundationReport=report;publishAudit(report);if(!report.ok){const message=`Foundation audit failed: ${report.hardErrors.join(', ')}`;console.error(message,report);throw new Error(message);}if(report.warnings.length)console.warn(`${PROJECT.version} foundation audit: degraded`,report);else console.info(`${PROJECT.version} foundation audit: OK`,report);};
  world.getFoundationReport=()=>world.foundationReport||null;return world;
}
