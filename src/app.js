import { CAMPUS, MAP_SOURCES, LANDMARKS, TREE_SPECIES, BUILDING_CATALOG } from './config.js';
import { UNDERSTORY_SPECIES } from './vegetation.js';
import { buildProceduralForest } from './forest.js';
import { createWorld3DLayer } from './player3d.js';

const $=(q)=>document.querySelector(q);
const loading=$('#loading'),loadingText=$('#loadingText'),loadingBar=$('#loadingBar');
const hud={distance:$('#distance'),altitude:$('#altitude'),speed:$('#speed'),bearing:$('#bearing'),objective:$('#objective'),viewMode:$('#viewMode'),coords:$('#coords'),pace:$('#pace')};
const toast=$('#toast');let toastTimer;
function notify(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2800)}
function loadingStep(p,text){loadingBar.style.width=`${p}%`;loadingText.textContent=text}

const CAMERA={map:{label:'Mapa ESPOL'},follow:{label:'3ª persona'},firstperson:{label:'1ª persona'}};
const CAMPUS_BOUNDS=[[CAMPUS.bounds.west,CAMPUS.bounds.south],[CAMPUS.bounds.east,CAMPUS.bounds.north]];
const BASE_SPEED_MPS=CAMPUS.jogSpeedMps*3;

const map=new maplibregl.Map({
  container:'map',style:MAP_SOURCES.style,center:[CAMPUS.spawn.lng,CAMPUS.spawn.lat],zoom:17.1,pitch:67,bearing:CAMPUS.spawnBearing,
  maxPitch:95,minZoom:14.2,maxZoom:21,maxBounds:CAMPUS_BOUNDS,renderWorldCopies:false,centerClampedToGround:false,
  fadeDuration:0,canvasContextAttributes:{antialias:false,powerPreference:'high-performance'},attributionControl:false,hash:false
});
map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
map.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true}),'bottom-right');
map.addControl(new maplibregl.ScaleControl({maxWidth:140,unit:'metric'}),'bottom-left');

const player={lng:CAMPUS.spawn.lng,lat:CAMPUS.spawn.lat,bearing:CAMPUS.spawnBearing,totalM:0,lastSpeedKmh:0,speedMps:0};
const playerEl=document.createElement('div');playerEl.className='player-marker';playerEl.innerHTML='<span class="player-arrow">▲</span>';
const playerMarker=new maplibregl.Marker({element:playerEl,anchor:'center'}).setLngLat([player.lng,player.lat]).addTo(map);

const state={
  cameraMode:'follow',terrainEnabled:true,treesEnabled:true,buildingsEnabled:true,imageryEnabled:false,season:.25,lastFrame:performance.now(),visited:new Set(),
  draggingLook:false,lastPointerX:0,pitchLook:0,forestData:null,moveForward:0,moveRight:0,currentSpeed:0,turnRate:0,lastHudUpdate:0,lastLandmarkCheck:0
};
const keys=new Set();

function rad(d){return d*Math.PI/180}
function normBearing(b){return(b%360+360)%360}
function metersToLng(m,lat){return m/(111320*Math.cos(rad(lat)))}
function metersToLat(m){return m/110574}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function moveTowards(current,target,maxDelta){if(Math.abs(target-current)<=maxDelta)return target;return current+Math.sign(target-current)*maxDelta}
function expApproach(current,target,responsiveness,dt){return target+(current-target)*Math.exp(-responsiveness*dt)}
function haversine(a,b){const R=6371000,p1=rad(a.lat),p2=rad(b.lat),dp=rad(b.lat-a.lat),dl=rad(b.lng-a.lng);const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function formatDistance(m){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(2)} km`}
function formatCoords(lng,lat){return `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
function terrainElevation(lng,lat){try{return map.queryTerrainElevation([lng,lat],{exaggerated:false})}catch{return null}}

function offsetLngLat(baseLng,baseLat,bearingDeg,forwardM=0,rightM=0){
  const b=rad(bearingDeg),north=Math.cos(b)*forwardM-Math.sin(b)*rightM,east=Math.sin(b)*forwardM+Math.cos(b)*rightM;
  return {lng:baseLng+metersToLng(east,baseLat),lat:baseLat+metersToLat(north)};
}
function moveBy(forward,right,meters){
  const next=offsetLngLat(player.lng,player.lat,player.bearing,forward*meters,right*meters),before={lng:player.lng,lat:player.lat};
  player.lng=clamp(next.lng,CAMPUS.bounds.west,CAMPUS.bounds.east);player.lat=clamp(next.lat,CAMPUS.bounds.south,CAMPUS.bounds.north);player.totalM+=haversine(before,player);
}
function moveStable(forward,right,distanceM){
  const maxStep=Math.max(.5,CAMPUS.movementSubstepM||1.25),steps=Math.max(1,Math.ceil(Math.abs(distanceM)/maxStep)),step=distanceM/steps;
  for(let i=0;i<steps;i++)moveBy(forward,right,step);
}
function updateMapMarker(){playerMarker.setLngLat([player.lng,player.lat]);playerEl.style.setProperty('--player-bearing',`${player.bearing}deg`);playerEl.style.opacity=state.cameraMode==='map'?'1':'0'}
function updateHUD(){
  hud.distance.textContent=formatDistance(player.totalM);const elev=terrainElevation(player.lng,player.lat);hud.altitude.textContent=Number.isFinite(elev)?`${Math.round(elev)} m`:'—';
  hud.speed.textContent=`${player.lastSpeedKmh.toFixed(1)} km/h`;hud.bearing.textContent=`${Math.round(normBearing(player.bearing))}°`;hud.viewMode.textContent=CAMERA[state.cameraMode].label;
  hud.coords.textContent=formatCoords(player.lng,player.lat);if(hud.pace)hud.pace.textContent=player.speedMps>.15?(player.speedMps>BASE_SPEED_MPS*1.08?'Sprint ×2.5':'Movimiento base ×3'):'Quieto';
}
function setMapInteractions(enabled){
  for(const name of ['dragPan','scrollZoom','boxZoom','doubleClickZoom','touchZoomRotate','dragRotate','touchPitch']){const h=map[name];if(!h)continue;try{enabled?h.enable():h.disable()}catch{}}
  try{map.keyboard.disable()}catch{}
}
function cameraOptionsFromTo(from,fromHeight,to,toHeight){
  const groundFrom=terrainElevation(from.lng,from.lat),groundTo=terrainElevation(to.lng,to.lat);if(!Number.isFinite(groundFrom)||!Number.isFinite(groundTo))return null;
  try{return map.calculateCameraOptionsFromTo([from.lng,from.lat],groundFrom+fromHeight,[to.lng,to.lat],groundTo+toHeight)}catch{return null}
}
function applyCamera(){
  if(state.cameraMode==='map')return;
  if(state.cameraMode==='follow'){
    const cameraPos=offsetLngLat(player.lng,player.lat,player.bearing+180,CAMPUS.thirdPersonDistanceM,0),opts=cameraOptionsFromTo(cameraPos,CAMPUS.thirdPersonCameraHeightM,player,1.12);
    if(opts){map.jumpTo({...opts,bearing:player.bearing});return}map.jumpTo({center:[player.lng,player.lat],bearing:player.bearing,pitch:72,zoom:18.4});return;
  }
  const target=offsetLngLat(player.lng,player.lat,player.bearing,22,0);target.lng=clamp(target.lng,CAMPUS.bounds.west,CAMPUS.bounds.east);target.lat=clamp(target.lat,CAMPUS.bounds.south,CAMPUS.bounds.north);
  const pg=terrainElevation(player.lng,player.lat),tg=terrainElevation(target.lng,target.lat);
  if(Number.isFinite(pg)&&Number.isFinite(tg)){try{map.jumpTo(map.calculateCameraOptionsFromTo([player.lng,player.lat],pg+CAMPUS.eyeHeightM,[target.lng,target.lat],tg+CAMPUS.eyeHeightM+state.pitchLook));return}catch{}}
  map.jumpTo({center:[target.lng,target.lat],bearing:player.bearing,pitch:84,zoom:19.4});
}
function syncVegetationPresentation(){
  const mapMode=state.cameraMode==='map';for(const id of ['forest-mass','forest-individuals'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',state.treesEnabled&&mapMode?'visible':'none');
}
function syncBasemapPresentation(){
  const showImagery=state.imageryEnabled&&state.cameraMode!=='map';
  if(map.getLayer('espol-imagery')){map.setLayoutProperty('espol-imagery','visibility',showImagery?'visible':'none');map.setPaintProperty('espol-imagery','raster-opacity',showImagery?.78:0)}
  if(map.getLayer('espol-buildings-3d'))map.setPaintProperty('espol-buildings-3d','fill-extrusion-opacity',.94);
}
function focusCampus({duration=650}={}){const padding=Math.max(34,Math.min(82,Math.round(Math.min(innerWidth,innerHeight)*.07)));map.fitBounds(CAMPUS_BOUNDS,{padding,duration,bearing:0,pitch:42})}
function lockMapToCampus(){map.setMaxBounds(CAMPUS_BOUNDS);try{const camera=map.cameraForBounds(CAMPUS_BOUNDS,{padding:48});if(camera&&Number.isFinite(camera.zoom))map.setMinZoom(Math.max(14.2,camera.zoom-.08))}catch{}}
function setCameraMode(mode,{notifyUser=true}={}){
  state.cameraMode=mode;$('#btnOverview').classList.toggle('active',mode==='map');$('#btnFollow').classList.toggle('active',mode==='follow');$('#btnFirstPerson').classList.toggle('active',mode==='firstperson');
  document.body.classList.toggle('fp-mode',mode==='firstperson');document.body.classList.toggle('map-mode',mode==='map');setMapInteractions(mode==='map');syncVegetationPresentation();syncBasemapPresentation();updateMapMarker();
  if(mode==='map'){focusCampus();if(notifyUser)notify('Mapa limitado a ESPOL · rueda = zoom · arrastra = desplazar')}else{applyCamera();if(notifyUser)notify(mode==='follow'?'Tercera persona · vegetación LOD optimizada':'Primera persona · vegetación LOD optimizada')}
  updateHUD();
}
function checkLandmarks(){for(const l of LANDMARKS){if(state.visited.has(l.id))continue;if(haversine(player,{lng:l.lng,lat:l.lat})<65){state.visited.add(l.id);document.querySelector(`[data-poi="${l.id}"]`)?.classList.add('visited');renderProgress();notify(`Hito descubierto: ${l.name}`)}}}
function renderProgress(){const targets=LANDMARKS.slice(0,3),wrap=$('#progressDots');wrap.innerHTML='';for(const l of targets){const i=document.createElement('i');if(state.visited.has(l.id))i.classList.add('done');wrap.appendChild(i)}const n=targets.filter(l=>state.visited.has(l.id)).length;hud.objective.textContent=n>=3?'Objetivo completado · explora libremente':`Visita 3 hitos del sector FIEC/FIMCP (${n}/3)`}
renderProgress();

function gameLoop(now){
  const dt=Math.min(.05,Math.max(0,(now-state.lastFrame)/1000));state.lastFrame=now;let rawForward=0,rawRight=0,rawRotate=0;
  if(keys.has('KeyW'))rawForward+=1;if(keys.has('KeyS'))rawForward-=1;if(keys.has('KeyA'))rawRight-=1;if(keys.has('KeyD'))rawRight+=1;if(keys.has('KeyQ')||keys.has('ArrowLeft'))rawRotate-=1;if(keys.has('KeyE')||keys.has('ArrowRight'))rawRotate+=1;
  const rawLen=Math.hypot(rawForward,rawRight);if(rawLen>0){rawForward/=rawLen;rawRight/=rawLen}
  state.moveForward=expApproach(state.moveForward,rawForward,CAMPUS.inputResponsiveness||18,dt);state.moveRight=expApproach(state.moveRight,rawRight,CAMPUS.inputResponsiveness||18,dt);
  if(rawLen===0&&Math.abs(state.moveForward)<.002)state.moveForward=0;if(rawLen===0&&Math.abs(state.moveRight)<.002)state.moveRight=0;
  const targetTurn=rawRotate*(CAMPUS.turnSpeedDegS||120);state.turnRate=expApproach(state.turnRate,targetTurn,CAMPUS.turnResponsiveness||16,dt);if(rawRotate===0&&Math.abs(state.turnRate)<.03)state.turnRate=0;player.bearing=normBearing(player.bearing+state.turnRate*dt);
  const moving=rawLen>0||Math.hypot(state.moveForward,state.moveRight)>.01,sprinting=keys.has('ShiftLeft')||keys.has('ShiftRight'),targetSpeed=moving?BASE_SPEED_MPS*(sprinting?CAMPUS.sprintMultiplier:1):0;
  const accel=targetSpeed>state.currentSpeed?(CAMPUS.accelerationMps2||34):(CAMPUS.brakingMps2||44);state.currentSpeed=moveTowards(state.currentSpeed,targetSpeed,accel*dt);if(!moving&&state.currentSpeed<.025)state.currentSpeed=0;
  const smoothLen=Math.hypot(state.moveForward,state.moveRight);if(state.currentSpeed>0&&smoothLen>.001)moveStable(state.moveForward/smoothLen,state.moveRight/smoothLen,state.currentSpeed*dt);
  player.speedMps=state.currentSpeed;player.lastSpeedKmh=state.currentSpeed*3.6;updateMapMarker();if(state.cameraMode!=='map'&&(state.currentSpeed>.001||Math.abs(state.turnRate)>.01))applyCamera();
  if(now-state.lastHudUpdate>(CAMPUS.hudIntervalMs||90)){state.lastHudUpdate=now;updateHUD()}if(now-state.lastLandmarkCheck>(CAMPUS.landmarkIntervalMs||260)){state.lastLandmarkCheck=now;checkLandmarks()}requestAnimationFrame(gameLoop);
}

function addCampusBounds(){
  const b=CAMPUS.bounds,campusRing=[[b.west,b.south],[b.east,b.south],[b.east,b.north],[b.west,b.north],[b.west,b.south]];
  map.addSource('campus-bounds',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[campusRing]}}});
  map.addLayer({id:'campus-fill',type:'fill',source:'campus-bounds',paint:{'fill-color':'#7c9b72','fill-opacity':.015}});map.addLayer({id:'campus-outline',type:'line',source:'campus-bounds',paint:{'line-color':'#587a61','line-width':1.2,'line-opacity':.48}});
  const worldRing=[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],holeRing=[[b.west,b.south],[b.west,b.north],[b.east,b.north],[b.east,b.south],[b.west,b.south]];
  map.addSource('outside-campus-mask',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[worldRing,holeRing]}}});map.addLayer({id:'outside-campus-mask',type:'fill',source:'outside-campus-mask',paint:{'fill-color':'#07131f','fill-opacity':1,'fill-antialias':false}});
}
function addTerrain(){
  map.addSource('terrain-dem',{type:'raster-dem',tiles:[MAP_SOURCES.terrain],bounds:[CAMPUS.bounds.west,CAMPUS.bounds.south,CAMPUS.bounds.east,CAMPUS.bounds.north],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:'Terrain: Mapzen/AWS elevation tiles'});map.setTerrain({source:'terrain-dem',exaggeration:1});
  map.addLayer({id:'terrain-hillshade',type:'hillshade',source:'terrain-dem',paint:{'hillshade-exaggeration':.10,'hillshade-shadow-color':'#71806a','hillshade-highlight-color':'#eef0e7','hillshade-accent-color':'#9da58f'}});
}
function addImagery(){
  map.addSource('espol-world-imagery',{type:'raster',tiles:[MAP_SOURCES.imagery],bounds:[CAMPUS.bounds.west,CAMPUS.bounds.south,CAMPUS.bounds.east,CAMPUS.bounds.north],tileSize:256,maxzoom:18,attribution:'Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community'});
  const layers=map.getStyle().layers||[],labelId=layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
  map.addLayer({id:'espol-imagery',type:'raster',source:'espol-world-imagery',minzoom:14,layout:{visibility:'none'},paint:{'raster-opacity':.78,'raster-saturation':-.25,'raster-contrast':-.02,'raster-fade-duration':0}},labelId);return labelId;
}
function addBuildings(){
  if(!map.getSource('ofm'))map.addSource('ofm',{type:'vector',url:MAP_SOURCES.vector});const layers=map.getStyle().layers||[],labelId=layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
  const height=['to-number',['coalesce',['get','render_height'],['get','height'],['*',['to-number',['get','levels'],2.35],3.15],7.4],7.4],base=['to-number',['coalesce',['get','render_min_height'],['get','min_height'],0],0];
  map.addLayer({id:'espol-buildings-3d',source:'ofm','source-layer':'building',type:'fill-extrusion',minzoom:14.2,filter:['!=',['get','hide_3d'],true],paint:{'fill-extrusion-color':'#c8cbc5','fill-extrusion-height':height,'fill-extrusion-base':base,'fill-extrusion-opacity':.94,'fill-extrusion-vertical-gradient':false}},labelId);return labelId;
}
function addForest(){
  state.forestData=buildProceduralForest();map.addSource('procedural-forest',{type:'geojson',data:state.forestData});
  map.addLayer({id:'forest-mass',type:'heatmap',source:'procedural-forest',maxzoom:17.25,paint:{'heatmap-weight':['case',['==',['get','habit'],'tree'],1,.32],'heatmap-intensity':['interpolate',['linear'],['zoom'],14,.32,16.5,.92],'heatmap-radius':['interpolate',['linear'],['zoom'],14,12,16.8,28],'heatmap-opacity':['interpolate',['linear'],['zoom'],14,.18,16.4,.34,17.25,0],'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(54,83,52,0)',.35,'rgba(82,111,64,.16)',.7,'rgba(57,91,53,.31)',1,'rgba(42,76,46,.42)']}});
  map.addLayer({id:'forest-individuals',type:'circle',source:'procedural-forest',minzoom:16.7,filter:['==',['get','habit'],'tree'],paint:{'circle-radius':['interpolate',['linear'],['zoom'],16.7,.9,18,1.9,20,3.2],'circle-color':['case',['==',['get','zone'],'campus'],'#73896a',['==',['get','deciduous'],1],'#6f784e','#49664b'],'circle-opacity':['interpolate',['linear'],['zoom'],16.7,.18,19,.52],'circle-stroke-width':0}});
  map.on('click','forest-individuals',e=>{if(state.cameraMode!=='map')return;const f=e.features?.[0];if(!f)return;const zone=f.properties.zone==='campus'?'arbolado del núcleo':'reconstrucción BVPP';new maplibregl.Popup({closeButton:false}).setLngLat(e.lngLat).setHTML(`<b>${f.properties.name}</b><br><small>${f.properties.scientific||''}</small><br><span>~${Math.round(f.properties.height)} m · DAP ~${f.properties.dbhCm} cm</span><br><em>${zone}; posición procedural</em>`).addTo(map)});
}
function addLandmarks(){
  const geo={type:'FeatureCollection',features:LANDMARKS.map(l=>({type:'Feature',properties:{...l},geometry:{type:'Point',coordinates:[l.lng,l.lat]}}))};map.addSource('campus-pois',{type:'geojson',data:geo});
  map.addLayer({id:'campus-poi-dots',type:'circle',source:'campus-pois',minzoom:14.8,paint:{'circle-radius':['interpolate',['linear'],['zoom'],15,3.2,18,5.2],'circle-color':['match',['get','category'],'FIEC','#00a6c8','FIMCP','#e0a139','Administración','#7a69c7','Servicios','#4f8e77','Movilidad','#de725f','Deporte','#5ca25c','#d1a63e'],'circle-stroke-color':'#ffffff','circle-stroke-width':1.4,'circle-opacity':.92}});
  map.addLayer({id:'campus-poi-labels',type:'symbol',source:'campus-pois',minzoom:15.2,layout:{'text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],15.2,10,19,13],'text-offset':[0,1.2],'text-anchor':'top','text-max-width':12,'text-allow-overlap':false},paint:{'text-color':'#34404a','text-halo-color':'rgba(255,255,255,.90)','text-halo-width':1.2}});
  for(const l of LANDMARKS){const el=document.createElement('div');el.className='poi-hit-marker';el.dataset.poi=l.id;new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([l.lng,l.lat]).setPopup(new maplibregl.Popup({offset:12}).setHTML(`<b>${l.name}</b><br><small>${l.note}</small>`)).addTo(map)}
}
function addWorld3D(beforeId){
  const layer=createWorld3DLayer({map,origin:CAMPUS.spawn,forestData:state.forestData,getTerrainElevation:terrainElevation,getState:()=>({lng:player.lng,lat:player.lat,bearing:player.bearing,speedMps:player.speedMps,cameraMode:state.cameraMode,season:state.season,treesEnabled:state.treesEnabled,jogSpeedMps:BASE_SPEED_MPS,sprintMultiplier:CAMPUS.sprintMultiplier})});map.addLayer(layer,beforeId);
}
function setSeason(v){state.season=v;$('#seasonLabel').textContent=v<.5?'Seca':'Lluviosa';if(map.getLayer('forest-individuals'))map.setPaintProperty('forest-individuals','circle-color',['case',['==',['get','zone'],'campus'],v<.5?'#7d8564':'#5f8567',['==',['get','deciduous'],1],v<.5?'#7d7c50':'#4e7854',v<.5?'#56694e':'#3f6b4d'])}
function bindLookControls(){
  const canvas=map.getCanvas();canvas.addEventListener('mousedown',e=>{if(state.cameraMode!=='firstperson')return;state.draggingLook=true;state.lastPointerX=e.clientX;e.preventDefault()});
  window.addEventListener('mousemove',e=>{if(!state.draggingLook||state.cameraMode!=='firstperson')return;const dx=e.clientX-state.lastPointerX;state.lastPointerX=e.clientX;player.bearing=normBearing(player.bearing+dx*.24);applyCamera();updateHUD()});
  window.addEventListener('mouseup',()=>state.draggingLook=false);canvas.addEventListener('mouseleave',()=>state.draggingLook=false);canvas.addEventListener('wheel',e=>{if(state.cameraMode!=='firstperson')return;state.pitchLook=clamp(state.pitchLook-e.deltaY*.006,-8,8);e.preventDefault();applyCamera()},{passive:false});
}
function bindUI(){
  document.addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(document.activeElement?.tagName))return;keys.add(e.code);if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyR')resetPlayer();if(e.code==='Digit1')setCameraMode('map');if(e.code==='Digit2')setCameraMode('follow');if(e.code==='Digit3')setCameraMode('firstperson')});
  document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());$('#btnOverview').onclick=()=>setCameraMode('map');$('#btnFollow').onclick=()=>setCameraMode('follow');$('#btnFirstPerson').onclick=()=>setCameraMode('firstperson');$('#btnFullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
  $('#terrainToggle').onchange=e=>{state.terrainEnabled=e.target.checked;map.setTerrain(state.terrainEnabled?{source:'terrain-dem',exaggeration:1}:null);if(map.getLayer('terrain-hillshade'))map.setLayoutProperty('terrain-hillshade','visibility',state.terrainEnabled?'visible':'none')};
  $('#buildingsToggle').onchange=e=>{state.buildingsEnabled=e.target.checked;if(map.getLayer('espol-buildings-3d'))map.setLayoutProperty('espol-buildings-3d','visibility',e.target.checked?'visible':'none')};
  $('#treesToggle').onchange=e=>{state.treesEnabled=e.target.checked;syncVegetationPresentation()};$('#imageryToggle').onchange=e=>{state.imageryEnabled=e.target.checked;syncBasemapPresentation();notify(e.target.checked?'Foto aérea activada: mayor carga GPU':'Modo plano activado: foto aérea apagada')};
  $('#boundsToggle').onchange=e=>['campus-fill','campus-outline'].forEach(id=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',e.target.checked?'visible':'none')});$('#labelsToggle').onchange=e=>['campus-poi-dots','campus-poi-labels'].forEach(id=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',e.target.checked?'visible':'none')});$('#season').oninput=e=>setSeason(+e.target.value/100);
  $('#gameMode').onchange=e=>{document.body.classList.remove('mode-horror','mode-rpg','mode-shooter');if(e.target.value!=='explore')document.body.classList.add(`mode-${e.target.value}`);notify(e.target.value==='horror'?'Preset terror activado':`Preset ${e.target.options[e.target.selectedIndex].text} activado`)};
  $('#panelToggle').onclick=()=>{$('#panel').hidden=true;$('#panelOpen').hidden=false};$('#panelOpen').onclick=()=>{$('#panel').hidden=false;$('#panelOpen').hidden=true};bindLookControls();
}
function resetPlayer(){player.lng=CAMPUS.spawn.lng;player.lat=CAMPUS.spawn.lat;player.bearing=CAMPUS.spawnBearing;player.lastSpeedKmh=0;player.speedMps=0;state.currentSpeed=0;state.moveForward=0;state.moveRight=0;state.turnRate=0;state.pitchLook=0;updateMapMarker();setCameraMode('follow',{notifyUser:false});notify(`Reinicio: ${CAMPUS.spawnName}`)}
function fillReferencePanels(){
  for(const s of TREE_SPECIES){const el=document.createElement('span');el.innerHTML=`<b>${s.name}</b><br>${s.scientific}`;$('#speciesList').appendChild(el)}
  for(const s of UNDERSTORY_SPECIES.slice(0,24)){const el=document.createElement('span');el.innerHTML=`<b>${s.name}</b><br>${s.scientific} · ${s.habit}`;$('#speciesList').appendChild(el)}
  for(const b of BUILDING_CATALOG){const el=document.createElement('article');el.innerHTML=`<b>${b.faculty}</b><span>${b.blocks}</span><small>${b.detail}</small>`;$('#buildingList').appendChild(el)}
}
fillReferencePanels();

map.on('load',()=>{
  try{
    loadingStep(16,'Limitando el mundo al Campus ESPOL…');lockMapToCampus();loadingStep(27,'Aplicando relieve métrico plano…');addTerrain();loadingStep(36,'Preparando foto aérea opcional…');addImagery();
    loadingStep(48,'Extruyendo edificios con material plano…');const labelsBefore=addBuildings();loadingStep(63,'Generando árboles, arbustos, herbáceas y lianas…');addForest();
    loadingStep(76,'Ocultando todo lo exterior al campus…');addCampusBounds();addLandmarks();loadingStep(89,'Construyendo LOD de vegetación instanciada…');addWorld3D(labelsBefore);
    loadingStep(96,'Activando modo de alto rendimiento…');bindUI();$('#imageryToggle').checked=false;setSeason(state.season);updateMapMarker();setCameraMode('follow',{notifyUser:false});updateHUD();loadingStep(100,'ESPOL Builder listo');
    setTimeout(()=>{loading.classList.add('hide');requestAnimationFrame(gameLoop);notify('v0.5 Vegetación · materiales planos · LOD adaptativo · foto aérea apagada')},450);
  }catch(err){console.error(err);loadingText.textContent='El mapa base cargó, pero una capa 3D falló. Revisa la consola.';setTimeout(()=>{loading.classList.add('hide');try{bindUI()}catch{}updateMapMarker();updateHUD();requestAnimationFrame(gameLoop)},1500)}
});
map.on('error',e=>console.warn('Map layer error',e.error||e));
