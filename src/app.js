import { CAMPUS, MAP_SOURCES, LANDMARKS, TREE_SPECIES, BUILDING_CATALOG } from './config.js';
import { UNDERSTORY_SPECIES } from './vegetation.js';
import { buildProceduralForest } from './forest.js';
import { createGameWorld } from './game3d.js';

const $=(q)=>document.querySelector(q);
const loading=$('#loading'),loadingText=$('#loadingText'),loadingBar=$('#loadingBar');
const hud={distance:$('#distance'),altitude:$('#altitude'),speed:$('#speed'),bearing:$('#bearing'),objective:$('#objective'),viewMode:$('#viewMode'),coords:$('#coords'),pace:$('#pace')};
const perf={fps:$('#perfFps'),ms:$('#perfMs'),draws:$('#perfDraws'),tris:$('#perfTris'),veg:$('#perfVeg'),chunks:$('#perfChunks'),quality:$('#perfQuality')};
const toast=$('#toast');let toastTimer,gameWorld=null;
function notify(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2600)}
function loadingStep(p,text){loadingBar.style.width=`${p}%`;loadingText.textContent=text}

const CAMERA={map:{label:'Mapa ESPOL'},follow:{label:'3ª persona'},firstperson:{label:'1ª persona'}};
const CAMPUS_BOUNDS=[[CAMPUS.bounds.west,CAMPUS.bounds.south],[CAMPUS.bounds.east,CAMPUS.bounds.north]];
const BASE_SPEED_MPS=CAMPUS.jogSpeedMps*3;

const map=new maplibregl.Map({
  container:'map',style:MAP_SOURCES.style,center:[CAMPUS.spawn.lng,CAMPUS.spawn.lat],zoom:17.1,pitch:60,bearing:CAMPUS.spawnBearing,
  maxPitch:85,minZoom:14.2,maxZoom:21,maxBounds:CAMPUS_BOUNDS,renderWorldCopies:false,centerClampedToGround:false,fadeDuration:0,
  canvasContextAttributes:{antialias:false,powerPreference:'high-performance'},attributionControl:false,hash:false
});
map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
map.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true}),'bottom-right');
map.addControl(new maplibregl.ScaleControl({maxWidth:140,unit:'metric'}),'bottom-left');

const player={lng:CAMPUS.spawn.lng,lat:CAMPUS.spawn.lat,bearing:CAMPUS.spawnBearing,totalM:0,lastSpeedKmh:0,speedMps:0};
const playerEl=document.createElement('div');playerEl.className='player-marker';playerEl.innerHTML='<span class="player-arrow">▲</span>';
const playerMarker=new maplibregl.Marker({element:playerEl,anchor:'center'}).setLngLat([player.lng,player.lat]).addTo(map);

const state={
  cameraMode:'follow',terrainEnabled:true,treesEnabled:true,buildingsEnabled:true,imageryEnabled:false,season:.25,lastFrame:performance.now(),visited:new Set(),
  draggingLook:false,lastPointerX:0,lastPointerY:0,pitchLook:0,forestData:null,moveForward:0,moveRight:0,currentSpeed:0,turnRate:0,lastHudUpdate:0,lastLandmarkCheck:0,lastMapMarkerUpdate:0,lastPerfUpdate:0
};
const keys=new Set();

function rad(d){return d*Math.PI/180}
function normBearing(b){return(b%360+360)%360}
function metersToLng(m,lat){return m/(111320*Math.cos(rad(lat)))}
function metersToLat(m){return m/110574}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function moveTowards(current,target,maxDelta){if(Math.abs(target-current)<=maxDelta)return target;return current+Math.sign(target-current)*maxDelta}
function expApproach(current,target,responsiveness,dt){return target+(current-target)*Math.exp(-responsiveness*dt)}
function haversine(a,b){const R=6371000,p1=rad(a.lat),p2=rad(b.lat),dp=rad(b.lat-a.lat),dl=rad(b.lng-a.lng),h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function formatDistance(m){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(2)} km`}
function formatCoords(lng,lat){return `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
function terrainElevation(lng,lat){if(gameWorld)return gameWorld.getElevation(lng,lat);try{return map.queryTerrainElevation([lng,lat],{exaggerated:false})}catch{return null}}
function insideCampus(lng,lat){return lng>=CAMPUS.bounds.west&&lng<=CAMPUS.bounds.east&&lat>=CAMPUS.bounds.south&&lat<=CAMPUS.bounds.north}

function offsetLngLat(baseLng,baseLat,bearingDeg,forwardM=0,rightM=0){const b=rad(bearingDeg),north=Math.cos(b)*forwardM-Math.sin(b)*rightM,east=Math.sin(b)*forwardM+Math.cos(b)*rightM;return {lng:baseLng+metersToLng(east,baseLat),lat:baseLat+metersToLat(north)}}
function moveBy(forward,right,meters){const next=offsetLngLat(player.lng,player.lat,player.bearing,forward*meters,right*meters),before={lng:player.lng,lat:player.lat};player.lng=clamp(next.lng,CAMPUS.bounds.west,CAMPUS.bounds.east);player.lat=clamp(next.lat,CAMPUS.bounds.south,CAMPUS.bounds.north);player.totalM+=haversine(before,player)}
function moveStable(forward,right,distanceM){const maxStep=Math.max(.5,CAMPUS.movementSubstepM||1.25),steps=Math.max(1,Math.ceil(Math.abs(distanceM)/maxStep)),step=distanceM/steps;for(let i=0;i<steps;i++)moveBy(forward,right,step)}
function updateMapMarker(){playerMarker.setLngLat([player.lng,player.lat]);playerEl.style.setProperty('--player-bearing',`${player.bearing}deg`);playerEl.style.opacity=state.cameraMode==='map'?'1':'0'}
function updateHUD(){
  hud.distance.textContent=formatDistance(player.totalM);const elev=terrainElevation(player.lng,player.lat);hud.altitude.textContent=Number.isFinite(elev)?`${Math.round(elev)} m`:'—';hud.speed.textContent=`${player.lastSpeedKmh.toFixed(1)} km/h`;hud.bearing.textContent=`${Math.round(normBearing(player.bearing))}°`;hud.viewMode.textContent=CAMERA[state.cameraMode].label;hud.coords.textContent=formatCoords(player.lng,player.lat);if(hud.pace)hud.pace.textContent=player.speedMps>.15?(player.speedMps>BASE_SPEED_MPS*1.08?'Sprint ×2.5':'Movimiento base ×3'):'Quieto';
}
function updateProfiler(){
  if(!gameWorld||state.cameraMode==='map'){perf.fps.textContent='MAP';perf.ms.textContent='—';perf.draws.textContent='—';perf.tris.textContent='—';perf.veg.textContent='—';perf.chunks.textContent='—';perf.quality.textContent='GIS';return}
  const s=gameWorld.getStats();perf.fps.textContent=Math.round(s.fps);perf.ms.textContent=`${s.frameMs.toFixed(1)} ms`;perf.draws.textContent=s.drawCalls;perf.tris.textContent=s.triangles>999?`${(s.triangles/1000).toFixed(1)}k`:s.triangles;perf.veg.textContent=s.vegetation;perf.chunks.textContent=s.chunks;perf.quality.textContent=`${Math.round(s.quality*100)}%`;
}
function setMapInteractions(enabled){for(const name of ['dragPan','scrollZoom','boxZoom','doubleClickZoom','touchZoomRotate','dragRotate','touchPitch']){const h=map[name];if(!h)continue;try{enabled?h.enable():h.disable()}catch{}}try{map.keyboard.disable()}catch{}}
function focusCampus({duration=500}={}){const padding=Math.max(32,Math.min(78,Math.round(Math.min(innerWidth,innerHeight)*.065)));map.fitBounds(CAMPUS_BOUNDS,{padding,duration,bearing:0,pitch:38})}
function lockMapToCampus(){map.setMaxBounds(CAMPUS_BOUNDS);try{const camera=map.cameraForBounds(CAMPUS_BOUNDS,{padding:48});if(camera&&Number.isFinite(camera.zoom))map.setMinZoom(Math.max(14.2,camera.zoom-.08))}catch{}}
function syncMapPresentation(){
  const mapMode=state.cameraMode==='map';for(const id of ['forest-mass','forest-individuals'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',state.treesEnabled&&mapMode?'visible':'none');
  if(map.getLayer('espol-imagery')){const show=mapMode&&state.imageryEnabled;map.setLayoutProperty('espol-imagery','visibility',show?'visible':'none');map.setPaintProperty('espol-imagery','raster-opacity',show?.72:0)}
}
function setCameraMode(mode,{notifyUser=true}={}){
  state.cameraMode=mode;$('#btnOverview').classList.toggle('active',mode==='map');$('#btnFollow').classList.toggle('active',mode==='follow');$('#btnFirstPerson').classList.toggle('active',mode==='firstperson');
  document.body.classList.toggle('map-mode',mode==='map');document.body.classList.toggle('game-mode',mode!=='map');document.body.classList.toggle('fp-mode',mode==='firstperson');setMapInteractions(mode==='map');syncMapPresentation();updateMapMarker();gameWorld?.setMode(mode);
  if(mode==='map'){map.resize();focusCampus();if(notifyUser)notify('Mapa GIS pausado durante el juego · aquí sólo se usa para navegación')}else{map.stop();gameWorld?.resetCamera?.();if(notifyUser)notify(mode==='follow'?'Three.js independiente · 3ª persona':'Three.js independiente · 1ª persona')}
  updateHUD();updateProfiler();
}

function checkLandmarks(){for(const l of LANDMARKS){if(state.visited.has(l.id))continue;if(haversine(player,{lng:l.lng,lat:l.lat})<65){state.visited.add(l.id);document.querySelector(`[data-poi="${l.id}"]`)?.classList.add('visited');renderProgress();notify(`Hito descubierto: ${l.name}`)}}}
function renderProgress(){const targets=LANDMARKS.slice(0,3),wrap=$('#progressDots');wrap.innerHTML='';for(const l of targets){const i=document.createElement('i');if(state.visited.has(l.id))i.classList.add('done');wrap.appendChild(i)}const n=targets.filter(l=>state.visited.has(l.id)).length;hud.objective.textContent=n>=3?'Objetivo completado · explora libremente':`Visita 3 hitos del sector FIEC/FIMCP (${n}/3)`}
renderProgress();

function gameLoop(now){
  const dt=Math.min(.045,Math.max(0,(now-state.lastFrame)/1000));state.lastFrame=now;let rawForward=0,rawRight=0,rawRotate=0;
  if(keys.has('KeyW'))rawForward+=1;if(keys.has('KeyS'))rawForward-=1;if(keys.has('KeyA'))rawRight-=1;if(keys.has('KeyD'))rawRight+=1;if(keys.has('KeyQ')||keys.has('ArrowLeft'))rawRotate-=1;if(keys.has('KeyE')||keys.has('ArrowRight'))rawRotate+=1;
  const rawLen=Math.hypot(rawForward,rawRight);if(rawLen>0){rawForward/=rawLen;rawRight/=rawLen}
  state.moveForward=expApproach(state.moveForward,rawForward,CAMPUS.inputResponsiveness||18,dt);state.moveRight=expApproach(state.moveRight,rawRight,CAMPUS.inputResponsiveness||18,dt);if(rawLen===0&&Math.abs(state.moveForward)<.002)state.moveForward=0;if(rawLen===0&&Math.abs(state.moveRight)<.002)state.moveRight=0;
  const targetTurn=rawRotate*(CAMPUS.turnSpeedDegS||120);state.turnRate=expApproach(state.turnRate,targetTurn,CAMPUS.turnResponsiveness||16,dt);if(rawRotate===0&&Math.abs(state.turnRate)<.03)state.turnRate=0;player.bearing=normBearing(player.bearing+state.turnRate*dt);
  const moving=rawLen>0||Math.hypot(state.moveForward,state.moveRight)>.01,sprinting=keys.has('ShiftLeft')||keys.has('ShiftRight'),targetSpeed=moving?BASE_SPEED_MPS*(sprinting?CAMPUS.sprintMultiplier:1):0,accel=targetSpeed>state.currentSpeed?(CAMPUS.accelerationMps2||34):(CAMPUS.brakingMps2||44);state.currentSpeed=moveTowards(state.currentSpeed,targetSpeed,accel*dt);if(!moving&&state.currentSpeed<.025)state.currentSpeed=0;
  const smoothLen=Math.hypot(state.moveForward,state.moveRight);if(state.currentSpeed>0&&smoothLen>.001)moveStable(state.moveForward/smoothLen,state.moveRight/smoothLen,state.currentSpeed*dt);player.speedMps=state.currentSpeed;player.lastSpeedKmh=state.currentSpeed*3.6;

  if(state.cameraMode!=='map'&&gameWorld)gameWorld.render(player,state,dt,now);
  if(state.cameraMode==='map'&&now-state.lastMapMarkerUpdate>80){state.lastMapMarkerUpdate=now;updateMapMarker()}
  if(now-state.lastHudUpdate>(CAMPUS.hudIntervalMs||100)){state.lastHudUpdate=now;updateHUD()}if(now-state.lastLandmarkCheck>(CAMPUS.landmarkIntervalMs||280)){state.lastLandmarkCheck=now;checkLandmarks()}if(now-state.lastPerfUpdate>450){state.lastPerfUpdate=now;updateProfiler()}
  requestAnimationFrame(gameLoop);
}

function addCampusBounds(){
  const b=CAMPUS.bounds,campusRing=[[b.west,b.south],[b.east,b.south],[b.east,b.north],[b.west,b.north],[b.west,b.south]];map.addSource('campus-bounds',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[campusRing]}}});map.addLayer({id:'campus-fill',type:'fill',source:'campus-bounds',paint:{'fill-color':'#7c9b72','fill-opacity':.015}});map.addLayer({id:'campus-outline',type:'line',source:'campus-bounds',paint:{'line-color':'#587a61','line-width':1.2,'line-opacity':.48}});
  const worldRing=[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],holeRing=[[b.west,b.south],[b.west,b.north],[b.east,b.north],[b.east,b.south],[b.west,b.south]];map.addSource('outside-campus-mask',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[worldRing,holeRing]}}});map.addLayer({id:'outside-campus-mask',type:'fill',source:'outside-campus-mask',paint:{'fill-color':'#07131f','fill-opacity':1,'fill-antialias':false}});
}
function addTerrain(){map.addSource('terrain-dem',{type:'raster-dem',tiles:[MAP_SOURCES.terrain],bounds:[CAMPUS.bounds.west,CAMPUS.bounds.south,CAMPUS.bounds.east,CAMPUS.bounds.north],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:'Terrain: Mapzen/AWS elevation tiles'});map.setTerrain({source:'terrain-dem',exaggeration:1});map.addLayer({id:'terrain-hillshade',type:'hillshade',source:'terrain-dem',paint:{'hillshade-exaggeration':.08,'hillshade-shadow-color':'#71806a','hillshade-highlight-color':'#eef0e7','hillshade-accent-color':'#9da58f'}})}
function addImagery(){map.addSource('espol-world-imagery',{type:'raster',tiles:[MAP_SOURCES.imagery],bounds:[CAMPUS.bounds.west,CAMPUS.bounds.south,CAMPUS.bounds.east,CAMPUS.bounds.north],tileSize:256,maxzoom:18,attribution:'Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community'});const layers=map.getStyle().layers||[],labelId=layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;map.addLayer({id:'espol-imagery',type:'raster',source:'espol-world-imagery',minzoom:14,layout:{visibility:'none'},paint:{'raster-opacity':.72,'raster-saturation':-.25,'raster-contrast':-.02,'raster-fade-duration':0}},labelId);return labelId}
function addBuildings(){if(!map.getSource('ofm'))map.addSource('ofm',{type:'vector',url:MAP_SOURCES.vector});const layers=map.getStyle().layers||[],labelId=layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id,height=['to-number',['coalesce',['get','render_height'],['get','height'],['*',['to-number',['get','levels'],2.35],3.15],7.4],7.4],base=['to-number',['coalesce',['get','render_min_height'],['get','min_height'],0],0];map.addLayer({id:'espol-buildings-3d',source:'ofm','source-layer':'building',type:'fill-extrusion',minzoom:14.2,filter:['!=',['get','hide_3d'],true],paint:{'fill-extrusion-color':'#c8cbc5','fill-extrusion-height':height,'fill-extrusion-base':base,'fill-extrusion-opacity':.92,'fill-extrusion-vertical-gradient':false}},labelId);return labelId}
function addForest(){
  state.forestData=buildProceduralForest();map.addSource('procedural-forest',{type:'geojson',data:state.forestData});map.addLayer({id:'forest-mass',type:'heatmap',source:'procedural-forest',maxzoom:17.25,paint:{'heatmap-weight':['case',['==',['get','habit'],'tree'],1,.32],'heatmap-intensity':['interpolate',['linear'],['zoom'],14,.32,16.5,.92],'heatmap-radius':['interpolate',['linear'],['zoom'],14,12,16.8,28],'heatmap-opacity':['interpolate',['linear'],['zoom'],14,.18,16.4,.34,17.25,0],'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(54,83,52,0)',.35,'rgba(82,111,64,.16)',.7,'rgba(57,91,53,.31)',1,'rgba(42,76,46,.42)']}});map.addLayer({id:'forest-individuals',type:'circle',source:'procedural-forest',minzoom:16.7,filter:['==',['get','habit'],'tree'],paint:{'circle-radius':['interpolate',['linear'],['zoom'],16.7,.9,18,1.9,20,3.2],'circle-color':['case',['==',['get','zone'],'campus'],'#73896a',['==',['get','deciduous'],1],'#6f784e','#49664b'],'circle-opacity':['interpolate',['linear'],['zoom'],16.7,.18,19,.52],'circle-stroke-width':0}});
}
function addLandmarks(){const geo={type:'FeatureCollection',features:LANDMARKS.map(l=>({type:'Feature',properties:{...l},geometry:{type:'Point',coordinates:[l.lng,l.lat]}}))};map.addSource('campus-pois',{type:'geojson',data:geo});map.addLayer({id:'campus-poi-dots',type:'circle',source:'campus-pois',minzoom:14.8,paint:{'circle-radius':['interpolate',['linear'],['zoom'],15,3.2,18,5.2],'circle-color':['match',['get','category'],'FIEC','#00a6c8','FIMCP','#e0a139','Administración','#7a69c7','Servicios','#4f8e77','Movilidad','#de725f','Deporte','#5ca25c','#d1a63e'],'circle-stroke-color':'#ffffff','circle-stroke-width':1.4,'circle-opacity':.92}});map.addLayer({id:'campus-poi-labels',type:'symbol',source:'campus-pois',minzoom:15.2,layout:{'text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],15.2,10,19,13],'text-offset':[0,1.2],'text-anchor':'top','text-max-width':12,'text-allow-overlap':false},paint:{'text-color':'#34404a','text-halo-color':'rgba(255,255,255,.90)','text-halo-width':1.2}});for(const l of LANDMARKS){const el=document.createElement('div');el.className='poi-hit-marker';el.dataset.poi=l.id;new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([l.lng,l.lat]).setPopup(new maplibregl.Popup({offset:12}).setHTML(`<b>${l.name}</b><br><small>${l.note}</small>`)).addTo(map)}}

function num(v){const n=parseFloat(v);return Number.isFinite(n)?n:null}
function eachCoord(coords,fn){if(!Array.isArray(coords))return;if(coords.length>=2&&typeof coords[0]==='number'&&typeof coords[1]==='number'){fn(coords);return}for(const c of coords)eachCoord(c,fn)}
function collectLines(coords,out){if(!Array.isArray(coords)||!coords.length)return;if(Array.isArray(coords[0])&&coords[0].length>=2&&typeof coords[0][0]==='number'){out.push(coords);return}for(const c of coords)collectLines(c,out)}
function extractWorldStructures(){
  const buildings=[],roads=[],bSeen=new Set(),rSeen=new Set();
  try{
    const features=map.querySourceFeatures('ofm',{sourceLayer:'building'});for(const f of features){let minLng=Infinity,maxLng=-Infinity,minLat=Infinity,maxLat=-Infinity;eachCoord(f.geometry?.coordinates,c=>{minLng=Math.min(minLng,c[0]);maxLng=Math.max(maxLng,c[0]);minLat=Math.min(minLat,c[1]);maxLat=Math.max(maxLat,c[1])});if(!Number.isFinite(minLng))continue;const lng=(minLng+maxLng)/2,lat=(minLat+maxLat)/2;if(!insideCampus(lng,lat))continue;const width=(maxLng-minLng)*111320*Math.cos(lat*DEG),depth=(maxLat-minLat)*110574;if(width<1.5||depth<1.5||width>280||depth>280)continue;const p=f.properties||{},height=num(p.render_height)||num(p.height)||(num(p.levels)?num(p.levels)*3.15:null)||7.4,key=`${lng.toFixed(5)}:${lat.toFixed(5)}:${Math.round(width)}:${Math.round(depth)}`;if(bSeen.has(key))continue;bSeen.add(key);buildings.push({lng,lat,width,depth,height})}
  }catch(err){console.warn('building extraction',err)}
  try{
    const features=map.querySourceFeatures('ofm',{sourceLayer:'transportation'}),widthFor=(p)=>{const cls=(p.class||p.subclass||'').toLowerCase();if(cls.includes('motorway'))return 9;if(cls.includes('trunk'))return 8;if(cls.includes('primary'))return 7;if(cls.includes('secondary'))return 6;if(cls.includes('tertiary'))return 5;if(cls.includes('residential'))return 4;if(cls.includes('service'))return 3;if(cls.includes('path')||cls.includes('foot'))return 1.3;if(cls.includes('track'))return 2.2;return 3.2};
    for(const f of features){const lines=[];collectLines(f.geometry?.coordinates,lines);for(const line of lines)for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],lng=(a[0]+b[0])/2,lat=(a[1]+b[1])/2;if(!insideCampus(lng,lat))continue;const key=`${a[0].toFixed(5)}:${a[1].toFixed(5)}:${b[0].toFixed(5)}:${b[1].toFixed(5)}`;if(rSeen.has(key))continue;rSeen.add(key);roads.push({a,b,width:widthFor(f.properties||{})});if(roads.length>=6000)break}if(roads.length>=6000)break}
  }catch(err){console.warn('road extraction',err)}
  return {buildings:buildings.slice(0,2200),roads};
}
function waitForMapIdle(timeout=2200){return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;resolve()};map.once('idle',finish);setTimeout(finish,timeout)})}

function bindLookControls(){
  const canvas=$('#game3d');canvas.addEventListener('mousedown',e=>{if(state.cameraMode==='map')return;state.draggingLook=true;state.lastPointerX=e.clientX;state.lastPointerY=e.clientY;e.preventDefault()});window.addEventListener('mousemove',e=>{if(!state.draggingLook||state.cameraMode==='map')return;const dx=e.clientX-state.lastPointerX,dy=e.clientY-state.lastPointerY;state.lastPointerX=e.clientX;state.lastPointerY=e.clientY;player.bearing=normBearing(player.bearing+dx*.22);state.pitchLook=clamp(state.pitchLook-dy*.12,-55,55)});window.addEventListener('mouseup',()=>state.draggingLook=false);canvas.addEventListener('mouseleave',()=>state.draggingLook=false);
}
function bindUI(){
  document.addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(document.activeElement?.tagName))return;keys.add(e.code);if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyR')resetPlayer();if(e.code==='Digit1')setCameraMode('map');if(e.code==='Digit2')setCameraMode('follow');if(e.code==='Digit3')setCameraMode('firstperson')});document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
  $('#btnOverview').onclick=()=>setCameraMode('map');$('#btnFollow').onclick=()=>setCameraMode('follow');$('#btnFirstPerson').onclick=()=>setCameraMode('firstperson');$('#btnFullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
  $('#terrainToggle').onchange=e=>{state.terrainEnabled=e.target.checked;map.setTerrain(state.terrainEnabled?{source:'terrain-dem',exaggeration:1}:null);if(map.getLayer('terrain-hillshade'))map.setLayoutProperty('terrain-hillshade','visibility',state.terrainEnabled?'visible':'none');gameWorld?.setTerrainEnabled(e.target.checked)};
  $('#buildingsToggle').onchange=e=>{state.buildingsEnabled=e.target.checked;if(map.getLayer('espol-buildings-3d'))map.setLayoutProperty('espol-buildings-3d','visibility',e.target.checked?'visible':'none');gameWorld?.setBuildingsEnabled(e.target.checked)};
  $('#treesToggle').onchange=e=>{state.treesEnabled=e.target.checked;syncMapPresentation();gameWorld?.setTreesEnabled(e.target.checked)};
  $('#imageryToggle').onchange=e=>{state.imageryEnabled=e.target.checked;syncMapPresentation();notify(e.target.checked?'Foto aérea activada sólo en Mapa':'Mapa vectorial plano activado')};
  $('#boundsToggle').onchange=e=>['campus-fill','campus-outline'].forEach(id=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',e.target.checked?'visible':'none'});
  $('#labelsToggle').onchange=e=>['campus-poi-dots','campus-poi-labels'].forEach(id=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',e.target.checked?'visible':'none'});
  $('#season').oninput=e=>{setSeason(+e.target.value/100)};$('#gameMode').onchange=e=>{document.body.classList.remove('mode-horror','mode-rpg','mode-shooter');if(e.target.value!=='explore')document.body.classList.add(`mode-${e.target.value}`);notify(`Preset ${e.target.options[e.target.selectedIndex].text} activado`)};$('#panelToggle').onclick=()=>{$('#panel').hidden=true;$('#panelOpen').hidden=false};$('#panelOpen').onclick=()=>{$('#panel').hidden=false;$('#panelOpen').hidden=true};bindLookControls();
}
function setSeason(v){state.season=v;$('#seasonLabel').textContent=v<.5?'Seca':'Lluviosa';gameWorld?.setSeason(v);if(map.getLayer('forest-individuals'))map.setPaintProperty('forest-individuals','circle-color',['case',['==',['get','zone'],'campus'],v<.5?'#7d8564':'#5f8567',['==',['get','deciduous'],1],v<.5?'#7d7c50':'#4e7854',v<.5?'#56694e':'#3f6b4d'])}
function resetPlayer(){player.lng=CAMPUS.spawn.lng;player.lat=CAMPUS.spawn.lat;player.bearing=CAMPUS.spawnBearing;player.lastSpeedKmh=0;player.speedMps=0;state.currentSpeed=0;state.moveForward=0;state.moveRight=0;state.turnRate=0;state.pitchLook=0;gameWorld?.resetCamera?.();updateMapMarker();setCameraMode('follow',{notifyUser:false});notify(`Reinicio: ${CAMPUS.spawnName}`)}
function fillReferencePanels(){for(const s of TREE_SPECIES){const el=document.createElement('span');el.innerHTML=`<b>${s.name}</b><br>${s.scientific}`;$('#speciesList').appendChild(el)}for(const s of UNDERSTORY_SPECIES.slice(0,24)){const el=document.createElement('span');el.innerHTML=`<b>${s.name}</b><br>${s.scientific} · ${s.habit}`;$('#speciesList').appendChild(el)}for(const b of BUILDING_CATALOG){const el=document.createElement('article');el.innerHTML=`<b>${b.faculty}</b><span>${b.blocks}</span><small>${b.detail}</small>`;$('#buildingList').appendChild(el)}}
fillReferencePanels();

map.on('load',async()=>{
  try{
    loadingStep(10,'Preparando Mapa ESPOL…');lockMapToCampus();addTerrain();addImagery();addBuildings();addForest();addCampusBounds();addLandmarks();focusCampus({duration:0});
    loadingStep(24,'Generando base ecológica…');const worldPromise=createGameWorld({canvas:$('#game3d'),forestData:state.forestData,terrainUrl:MAP_SOURCES.terrain,onProgress:(p,total)=>loadingStep(28+p*42,`Precalculando relieve ESPOL · ${Math.round(p*100)}% · ${total} tiles`) });
    await waitForMapIdle();loadingStep(73,'Extrayendo infraestructura local desde los tiles ya cargados…');const structures=extractWorldStructures();
    gameWorld=await worldPromise;loadingStep(88,`Construyendo mundo jugable · ${structures.buildings.length} edificios · ${structures.roads.length} tramos`);gameWorld.setStructures(structures);gameWorld.setSeason(state.season);gameWorld.setTreesEnabled(state.treesEnabled);gameWorld.setBuildingsEnabled(state.buildingsEnabled);gameWorld.setTerrainEnabled(state.terrainEnabled);
    loadingStep(95,'Desacoplando MapLibre del bucle del juego…');bindUI();$('#imageryToggle').checked=false;setCameraMode('follow',{notifyUser:false});updateHUD();updateProfiler();loadingStep(100,'ESPOL Builder listo');
    setTimeout(()=>{loading.classList.add('hide');state.lastFrame=performance.now();requestAnimationFrame(gameLoop);notify('v0.6 · MapLibre sólo para Mapa · Three.js para jugar · profiler activo')},350);
  }catch(err){console.error(err);loadingText.textContent='Falló la inicialización del mundo híbrido. Revisa la consola.';setTimeout(()=>loading.classList.add('hide'),1800)}
});
map.on('error',e=>console.warn('Map layer error',e.error||e));
