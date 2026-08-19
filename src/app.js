import { CAMPUS, MAP_SOURCES, LANDMARKS, TREE_SPECIES, BUILDING_CATALOG } from './config.js';
import { buildProceduralForest } from './forest.js';
import { createWorld3DLayer } from './player3d.js';

const $=(q)=>document.querySelector(q);
const loading=$('#loading'),loadingText=$('#loadingText'),loadingBar=$('#loadingBar');
const hud={
  distance:$('#distance'),altitude:$('#altitude'),speed:$('#speed'),bearing:$('#bearing'),
  objective:$('#objective'),viewMode:$('#viewMode'),coords:$('#coords'),pace:$('#pace')
};
const toast=$('#toast');
let toastTimer;
function notify(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2800)}
function loadingStep(p,text){loadingBar.style.width=`${p}%`;loadingText.textContent=text}

const CAMERA={
  map:{label:'Mapa libre'},
  follow:{label:'3ª persona'},
  firstperson:{label:'1ª persona'}
};

const map=new maplibregl.Map({
  container:'map',
  style:MAP_SOURCES.style,
  center:[CAMPUS.spawn.lng,CAMPUS.spawn.lat],
  zoom:17.1,
  pitch:67,
  bearing:CAMPUS.spawnBearing,
  maxPitch:95,
  minZoom:12.2,
  maxZoom:21,
  centerClampedToGround:false,
  canvasContextAttributes:{antialias:true,powerPreference:'high-performance'},
  attributionControl:false,
  hash:false
});
map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
map.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true}),'bottom-right');
map.addControl(new maplibregl.ScaleControl({maxWidth:140,unit:'metric'}),'bottom-left');

const player={
  lng:CAMPUS.spawn.lng,
  lat:CAMPUS.spawn.lat,
  bearing:CAMPUS.spawnBearing,
  totalM:0,
  lastSpeedKmh:0,
  speedMps:0
};

// Marcador 2D solo para la vista de mapa. En tercera persona se usa el modelo 3D métrico.
const playerEl=document.createElement('div');
playerEl.className='player-marker';
playerEl.innerHTML='<span class="player-arrow">▲</span>';
const playerMarker=new maplibregl.Marker({element:playerEl,anchor:'center'})
  .setLngLat([player.lng,player.lat]).addTo(map);

const state={
  cameraMode:'follow',
  terrainEnabled:true,
  treesEnabled:true,
  buildingsEnabled:true,
  imageryEnabled:true,
  season:.25,
  lastFrame:performance.now(),
  visited:new Set(),
  draggingLook:false,
  lastPointerX:0,
  pitchLook:0,
  forestData:null
};
const keys=new Set();

function rad(d){return d*Math.PI/180}
function normBearing(b){return(b%360+360)%360}
function metersToLng(m,lat){return m/(111320*Math.cos(rad(lat)))}
function metersToLat(m){return m/110574}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function haversine(a,b){const R=6371000;const p1=rad(a.lat),p2=rad(b.lat),dp=rad(b.lat-a.lat),dl=rad(b.lng-a.lng);const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function formatDistance(m){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(2)} km`}
function formatCoords(lng,lat){return `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
function terrainElevation(lng,lat){try{return map.queryTerrainElevation([lng,lat],{exaggerated:false})}catch{return null}}

function offsetLngLat(baseLng,baseLat,bearingDeg,forwardM=0,rightM=0){
  const b=rad(bearingDeg);
  const north=Math.cos(b)*forwardM-Math.sin(b)*rightM;
  const east=Math.sin(b)*forwardM+Math.cos(b)*rightM;
  return {lng:baseLng+metersToLng(east,baseLat),lat:baseLat+metersToLat(north)};
}

function moveBy(forward,right,meters){
  const next=offsetLngLat(player.lng,player.lat,player.bearing,forward*meters,right*meters);
  const before={lng:player.lng,lat:player.lat};
  player.lng=clamp(next.lng,CAMPUS.bounds.west,CAMPUS.bounds.east);
  player.lat=clamp(next.lat,CAMPUS.bounds.south,CAMPUS.bounds.north);
  player.totalM+=haversine(before,player);
}

function updateMapMarker(){
  playerMarker.setLngLat([player.lng,player.lat]);
  playerEl.style.setProperty('--player-bearing',`${player.bearing}deg`);
  playerEl.style.opacity=state.cameraMode==='map'?'1':'0';
}

function updateHUD(){
  hud.distance.textContent=formatDistance(player.totalM);
  const elev=terrainElevation(player.lng,player.lat);
  hud.altitude.textContent=Number.isFinite(elev)?`${Math.round(elev)} m`:'—';
  hud.speed.textContent=`${player.lastSpeedKmh.toFixed(1)} km/h`;
  hud.bearing.textContent=`${Math.round(normBearing(player.bearing))}°`;
  hud.viewMode.textContent=CAMERA[state.cameraMode].label;
  hud.coords.textContent=formatCoords(player.lng,player.lat);
  if(hud.pace)hud.pace.textContent=player.speedMps>.01?(player.speedMps>CAMPUS.jogSpeedMps*1.05?'Sprint ×2.5':'Trote'):'Quieto';
}

function setMapInteractions(enabled){
  const handlers=['dragPan','scrollZoom','boxZoom','doubleClickZoom','touchZoomRotate','dragRotate','touchPitch'];
  for(const name of handlers){
    const h=map[name];if(!h)continue;
    try{enabled?h.enable():h.disable()}catch{}
  }
  // WASD/QE son del jugador, no del teclado de MapLibre.
  try{map.keyboard.disable()}catch{}
}

function cameraOptionsFromTo(from,fromHeight,to,toHeight){
  const groundFrom=terrainElevation(from.lng,from.lat);
  const groundTo=terrainElevation(to.lng,to.lat);
  if(!Number.isFinite(groundFrom)||!Number.isFinite(groundTo))return null;
  try{
    return map.calculateCameraOptionsFromTo(
      [from.lng,from.lat],groundFrom+fromHeight,
      [to.lng,to.lat],groundTo+toHeight
    );
  }catch{return null}
}

function applyCamera(){
  if(state.cameraMode==='map')return;

  if(state.cameraMode==='follow'){
    const cameraPos=offsetLngLat(player.lng,player.lat,player.bearing+180,CAMPUS.thirdPersonDistanceM,0);
    const opts=cameraOptionsFromTo(cameraPos,CAMPUS.thirdPersonCameraHeightM,player,1.12);
    if(opts){map.jumpTo({...opts,bearing:player.bearing});return}
    map.jumpTo({center:[player.lng,player.lat],bearing:player.bearing,pitch:72,zoom:18.4});
    return;
  }

  // Cámara realmente situada a altura de ojos, no un “zoom muy inclinado”.
  const lookDistance=22;
  const target=offsetLngLat(player.lng,player.lat,player.bearing,lookDistance,0);
  const playerGround=terrainElevation(player.lng,player.lat);
  const targetGround=terrainElevation(target.lng,target.lat);
  if(Number.isFinite(playerGround)&&Number.isFinite(targetGround)){
    try{
      const opts=map.calculateCameraOptionsFromTo(
        [player.lng,player.lat],playerGround+CAMPUS.eyeHeightM,
        [target.lng,target.lat],targetGround+CAMPUS.eyeHeightM+state.pitchLook
      );
      map.jumpTo(opts);return;
    }catch{}
  }
  map.jumpTo({center:[target.lng,target.lat],bearing:player.bearing,pitch:84,zoom:19.4});
}

function syncVegetationPresentation(){
  const mapMode=state.cameraMode==='map';
  if(map.getLayer('forest-mass'))map.setLayoutProperty('forest-mass','visibility',state.treesEnabled&&mapMode?'visible':'none');
  if(map.getLayer('forest-individuals'))map.setLayoutProperty('forest-individuals','visibility',state.treesEnabled&&mapMode?'visible':'none');
}

function syncBasemapPresentation(){
  // La vista Mapa conserva la cartografía limpia que ya funcionaba bien.
  // Las cámaras jugables pueden usar fotografía aérea drapeada sobre el DEM.
  const showImagery=state.imageryEnabled&&state.cameraMode!=='map';
  if(map.getLayer('espol-imagery')){
    map.setLayoutProperty('espol-imagery','visibility',showImagery?'visible':'none');
    map.setPaintProperty('espol-imagery','raster-opacity',showImagery ? .84 : 0);
  }
  if(map.getLayer('espol-buildings-3d')){
    map.setPaintProperty('espol-buildings-3d','fill-extrusion-opacity',showImagery ? .89 : .94);
  }
}

function setCameraMode(mode,{notifyUser=true}={}){
  state.cameraMode=mode;
  $('#btnOverview').classList.toggle('active',mode==='map');
  $('#btnFollow').classList.toggle('active',mode==='follow');
  $('#btnFirstPerson').classList.toggle('active',mode==='firstperson');
  document.body.classList.toggle('fp-mode',mode==='firstperson');
  document.body.classList.toggle('map-mode',mode==='map');
  setMapInteractions(mode==='map');
  syncVegetationPresentation();
  syncBasemapPresentation();
  updateMapMarker();

  if(mode==='map'){
    map.easeTo({center:[player.lng,player.lat],bearing:0,pitch:54,zoom:16.65,duration:650});
    if(notifyUser)notify('Mapa libre: rueda = zoom · arrastra = desplazar · clic derecho = rotar');
  }else{
    applyCamera();
    if(notifyUser)notify(mode==='follow'?'Tercera persona a escala real':'Primera persona a 1,68 m sobre el terreno');
  }
  updateHUD();
}

function checkLandmarks(){
  for(const l of LANDMARKS){
    if(state.visited.has(l.id))continue;
    if(haversine(player,{lng:l.lng,lat:l.lat})<65){
      state.visited.add(l.id);
      document.querySelector(`[data-poi="${l.id}"]`)?.classList.add('visited');
      renderProgress();notify(`Hito descubierto: ${l.name}`);
    }
  }
}
function renderProgress(){
  const targets=LANDMARKS.slice(0,3),wrap=$('#progressDots');wrap.innerHTML='';
  for(const l of targets){const i=document.createElement('i');if(state.visited.has(l.id))i.classList.add('done');wrap.appendChild(i)}
  const n=targets.filter(l=>state.visited.has(l.id)).length;
  hud.objective.textContent=n>=3?'Objetivo completado · explora libremente':`Visita 3 hitos del sector FIEC/FIMCP (${n}/3)`;
}
renderProgress();

function gameLoop(now){
  const dt=Math.min(.055,(now-state.lastFrame)/1000);state.lastFrame=now;
  let forward=0,strafe=0,rotate=0;
  if(keys.has('KeyW'))forward+=1;if(keys.has('KeyS'))forward-=1;
  if(keys.has('KeyA'))strafe-=1;if(keys.has('KeyD'))strafe+=1;
  if(keys.has('KeyQ')||keys.has('ArrowLeft'))rotate-=1;
  if(keys.has('KeyE')||keys.has('ArrowRight'))rotate+=1;
  player.bearing=normBearing(player.bearing+rotate*92*dt);

  const moving=forward||strafe;
  const sprinting=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const speedMps=CAMPUS.jogSpeedMps*(sprinting?CAMPUS.sprintMultiplier:1);
  if(moving){
    const len=Math.hypot(forward,strafe)||1;
    moveBy(forward/len,strafe/len,speedMps*dt);
    player.speedMps=speedMps;player.lastSpeedKmh=speedMps*3.6;
  }else{
    player.speedMps=0;player.lastSpeedKmh*=.72;if(player.lastSpeedKmh<.08)player.lastSpeedKmh=0;
  }

  updateMapMarker();
  if(state.cameraMode!=='map')applyCamera();
  updateHUD();checkLandmarks();
  requestAnimationFrame(gameLoop);
}

function addCampusBounds(){
  const b=CAMPUS.bounds;
  map.addSource('campus-bounds',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[b.west,b.south],[b.east,b.south],[b.east,b.north],[b.west,b.north],[b.west,b.south]]]}}});
  map.addLayer({id:'campus-fill',type:'fill',source:'campus-bounds',paint:{'fill-color':'#36d7b7','fill-opacity':.018}});
  map.addLayer({id:'campus-outline',type:'line',source:'campus-bounds',paint:{'line-color':'#45d6c0','line-width':1.5,'line-opacity':.58,'line-dasharray':[3,2]}});
}

function addTerrain(){
  map.addSource('terrain-dem',{type:'raster-dem',tiles:[MAP_SOURCES.terrain],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:'Terrain: Mapzen/AWS elevation tiles'});
  map.setTerrain({source:'terrain-dem',exaggeration:1});
  map.addLayer({id:'terrain-hillshade',type:'hillshade',source:'terrain-dem',paint:{
    'hillshade-exaggeration':.27,
    'hillshade-shadow-color':'#213126',
    'hillshade-highlight-color':'#f4f0dd',
    'hillshade-accent-color':'#7a8b6c'
  }});
}

function addImagery(){
  map.addSource('espol-world-imagery',{
    type:'raster',
    tiles:[MAP_SOURCES.imagery],
    tileSize:256,
    maxzoom:19,
    attribution:'Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community'
  });
  const layers=map.getStyle().layers||[];
  const labelId=layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
  map.addLayer({
    id:'espol-imagery',type:'raster',source:'espol-world-imagery',minzoom:13,
    layout:{visibility:'none'},
    paint:{'raster-opacity':.84,'raster-saturation':-.08,'raster-contrast':.05,'raster-fade-duration':180}
  },labelId);
  return labelId;
}

function addBuildings(){
  if(!map.getSource('ofm'))map.addSource('ofm',{type:'vector',url:MAP_SOURCES.vector});
  const layers=map.getStyle().layers||[];
  const labelId=layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
  const height=['to-number',['coalesce',['get','render_height'],['get','height'],['*',['to-number',['get','levels'],2.35],3.15],7.4],7.4];
  const base=['to-number',['coalesce',['get','render_min_height'],['get','min_height'],0],0];
  map.addLayer({
    id:'espol-buildings-3d',source:'ofm','source-layer':'building',type:'fill-extrusion',minzoom:14.2,
    filter:['!=',['get','hide_3d'],true],
    paint:{
      'fill-extrusion-color':['interpolate',['linear'],height,0,'#e3e1d8',8,'#d4d5d2',18,'#c3c8c6',36,'#aeb9b8'],
      'fill-extrusion-height':height,
      'fill-extrusion-base':base,
      'fill-extrusion-opacity':.94,
      'fill-extrusion-vertical-gradient':true
    }
  },labelId);
  return labelId;
}

function addForest(){
  state.forestData=buildProceduralForest();
  map.addSource('procedural-forest',{type:'geojson',data:state.forestData});

  // A distancia se percibe una masa forestal continua, no miles de “lunares”.
  map.addLayer({id:'forest-mass',type:'heatmap',source:'procedural-forest',maxzoom:17.4,paint:{
    'heatmap-weight':['case',['==',['get','zone'],'bpp'],1,.38],
    'heatmap-intensity':['interpolate',['linear'],['zoom'],12.5,.38,16,1.1],
    'heatmap-radius':['interpolate',['linear'],['zoom'],12.5,15,16.8,34],
    'heatmap-opacity':['interpolate',['linear'],['zoom'],12.5,.22,16.5,.42,17.4,0],
    'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(41,83,53,0)',.25,'rgba(71,111,62,.18)',.55,'rgba(59,106,54,.36)',.85,'rgba(40,91,51,.50)',1,'rgba(32,79,46,.58)']
  }});

  map.addLayer({id:'forest-individuals',type:'circle',source:'procedural-forest',minzoom:16.2,paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],16.2,1.0,18,2.4,20,4.2],
    'circle-color':['case',['==',['get','zone'],'campus'],'#5c8557',['==',['get','deciduous'],1],'#66814c','#35684a'],
    'circle-opacity':['interpolate',['linear'],['zoom'],16.2,.22,18,.48,20,.62],
    'circle-stroke-width':['interpolate',['linear'],['zoom'],17,0,20,.65],
    'circle-stroke-color':'rgba(25,55,32,.55)'
  }});

  map.on('click','forest-individuals',e=>{
    if(state.cameraMode!=='map')return;
    const f=e.features?.[0];if(!f)return;
    const zone=f.properties.zone==='campus'?'arbolado del núcleo':'reconstrucción BVPP';
    new maplibregl.Popup({closeButton:false}).setLngLat(e.lngLat)
      .setHTML(`<b>${f.properties.name}</b><br><small>${f.properties.scientific||''}</small><br><span>~${Math.round(f.properties.height)} m · DAP ~${f.properties.dbhCm} cm</span><br><em>${zone}; posición procedural</em>`).addTo(map);
  });
}

function addLandmarks(){
  const geo={type:'FeatureCollection',features:LANDMARKS.map(l=>({type:'Feature',properties:{...l},geometry:{type:'Point',coordinates:[l.lng,l.lat]}}))};
  map.addSource('campus-pois',{type:'geojson',data:geo});
  map.addLayer({id:'campus-poi-dots',type:'circle',source:'campus-pois',minzoom:14.8,paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],15,3.2,18,5.2],
    'circle-color':['match',['get','category'],'FIEC','#00a6c8','FIMCP','#e0a139','Administración','#7a69c7','Servicios','#4f8e77','Movilidad','#de725f','Deporte','#5ca25c','#d1a63e'],
    'circle-stroke-color':'#ffffff','circle-stroke-width':1.7,'circle-opacity':.95
  }});
  map.addLayer({id:'campus-poi-labels',type:'symbol',source:'campus-pois',minzoom:15.2,layout:{
    'text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],15.2,10,19,13],
    'text-offset':[0,1.2],'text-anchor':'top','text-max-width':12,'text-allow-overlap':false
  },paint:{'text-color':'#34404a','text-halo-color':'rgba(255,255,255,.92)','text-halo-width':1.4}});

  // Marcadores HTML solo para estado de “visitado”, invisibles como iconos grandes.
  for(const l of LANDMARKS){
    const el=document.createElement('div');el.className='poi-hit-marker';el.dataset.poi=l.id;
    new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([l.lng,l.lat])
      .setPopup(new maplibregl.Popup({offset:12}).setHTML(`<b>${l.name}</b><br><small>${l.note}</small>`)).addTo(map);
  }
}

function addWorld3D(beforeId){
  const layer=createWorld3DLayer({
    map,
    origin:CAMPUS.spawn,
    forestData:state.forestData,
    getTerrainElevation:terrainElevation,
    getState:()=>({
      lng:player.lng,lat:player.lat,bearing:player.bearing,speedMps:player.speedMps,
      cameraMode:state.cameraMode,season:state.season,treesEnabled:state.treesEnabled,
      jogSpeedMps:CAMPUS.jogSpeedMps,sprintMultiplier:CAMPUS.sprintMultiplier
    })
  });
  map.addLayer(layer,beforeId);
}

function setSeason(v){
  state.season=v;$('#seasonLabel').textContent=v<.5?'Seca':'Lluviosa';
  if(map.getLayer('forest-individuals')){
    map.setPaintProperty('forest-individuals','circle-color',[
      'case',['==',['get','zone'],'campus'],v<.5?'#6f8552':'#4d8a5b',
      ['==',['get','deciduous'],1],v<.5?'#79834b':'#347a4c',v<.5?'#486b45':'#27684a'
    ]);
  }
}

function bindLookControls(){
  const canvas=map.getCanvas();
  canvas.addEventListener('mousedown',e=>{
    if(state.cameraMode!=='firstperson')return;
    state.draggingLook=true;state.lastPointerX=e.clientX;e.preventDefault();
  });
  window.addEventListener('mousemove',e=>{
    if(!state.draggingLook||state.cameraMode!=='firstperson')return;
    const dx=e.clientX-state.lastPointerX;state.lastPointerX=e.clientX;
    player.bearing=normBearing(player.bearing+dx*.24);applyCamera();updateHUD();
  });
  window.addEventListener('mouseup',()=>state.draggingLook=false);
  canvas.addEventListener('mouseleave',()=>state.draggingLook=false);
  canvas.addEventListener('wheel',e=>{
    if(state.cameraMode!=='firstperson')return;
    state.pitchLook=clamp(state.pitchLook-e.deltaY*.006,-8,8);e.preventDefault();applyCamera();
  },{passive:false});
}

function bindUI(){
  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT'].includes(document.activeElement?.tagName))return;
    keys.add(e.code);
    if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    if(e.code==='KeyR')resetPlayer();
    if(e.code==='Digit1')setCameraMode('map');
    if(e.code==='Digit2')setCameraMode('follow');
    if(e.code==='Digit3')setCameraMode('firstperson');
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>keys.clear());

  $('#btnOverview').onclick=()=>setCameraMode('map');
  $('#btnFollow').onclick=()=>setCameraMode('follow');
  $('#btnFirstPerson').onclick=()=>setCameraMode('firstperson');
  $('#btnFullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();

  $('#terrainToggle').onchange=e=>{
    state.terrainEnabled=e.target.checked;
    map.setTerrain(state.terrainEnabled?{source:'terrain-dem',exaggeration:1}:null);
    if(map.getLayer('terrain-hillshade'))map.setLayoutProperty('terrain-hillshade','visibility',state.terrainEnabled?'visible':'none');
  };
  $('#buildingsToggle').onchange=e=>{state.buildingsEnabled=e.target.checked;if(map.getLayer('espol-buildings-3d'))map.setLayoutProperty('espol-buildings-3d','visibility',e.target.checked?'visible':'none')};
  $('#treesToggle').onchange=e=>{state.treesEnabled=e.target.checked;syncVegetationPresentation()};
  $('#imageryToggle').onchange=e=>{state.imageryEnabled=e.target.checked;syncBasemapPresentation();notify(e.target.checked?'Foto aérea activada en vistas jugables':'Foto aérea desactivada')};
  $('#boundsToggle').onchange=e=>['campus-fill','campus-outline'].forEach(id=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',e.target.checked?'visible':'none')});
  $('#labelsToggle').onchange=e=>['campus-poi-dots','campus-poi-labels'].forEach(id=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',e.target.checked?'visible':'none')});
  $('#season').oninput=e=>setSeason(+e.target.value/100);

  $('#gameMode').onchange=e=>{
    document.body.classList.remove('mode-horror','mode-rpg','mode-shooter');
    if(e.target.value!=='explore')document.body.classList.add(`mode-${e.target.value}`);
    notify(e.target.value==='horror'?'Preset terror activado':`Preset ${e.target.options[e.target.selectedIndex].text} activado`);
  };
  $('#panelToggle').onclick=()=>{$('#panel').hidden=true;$('#panelOpen').hidden=false};
  $('#panelOpen').onclick=()=>{$('#panel').hidden=false;$('#panelOpen').hidden=true};
  bindLookControls();
}

function resetPlayer(){
  player.lng=CAMPUS.spawn.lng;player.lat=CAMPUS.spawn.lat;player.bearing=CAMPUS.spawnBearing;
  player.lastSpeedKmh=0;player.speedMps=0;state.pitchLook=0;
  updateMapMarker();setCameraMode('follow',{notifyUser:false});notify(`Reinicio: ${CAMPUS.spawnName}`);
}

function fillReferencePanels(){
  for(const s of TREE_SPECIES){
    const el=document.createElement('span');el.innerHTML=`<b>${s.name}</b><br>${s.scientific}`;$('#speciesList').appendChild(el);
  }
  for(const b of BUILDING_CATALOG){
    const el=document.createElement('article');el.innerHTML=`<b>${b.faculty}</b><span>${b.blocks}</span><small>${b.detail}</small>`;$('#buildingList').appendChild(el);
  }
}
fillReferencePanels();

map.on('load',()=>{
  try{
    loadingStep(20,'Aplicando relieve métrico…');addTerrain();
    loadingStep(34,'Preparando fotografía aérea opcional…');addImagery();
    loadingStep(47,'Extruyendo edificios de cartografía abierta…');const labelsBefore=addBuildings();
    loadingStep(62,'Calibrando bosque con parcelas ESPOL…');addForest();
    loadingStep(74,'Añadiendo hitos reales del campus…');addCampusBounds();addLandmarks();
    loadingStep(86,'Creando avatar y vegetación 3D cercana…');addWorld3D(labelsBefore);
    loadingStep(94,'Configurando cámaras y controles…');bindUI();setSeason(state.season);updateMapMarker();setCameraMode('follow',{notifyUser:false});updateHUD();
    loadingStep(100,'ESPOL Builder listo');
    setTimeout(()=>{
      loading.classList.add('hide');requestAnimationFrame(gameLoop);
      notify('Spawn exterior del Auditorio FIEC · 1 Mapa · 2 Tercera · 3 Primera persona');
    },550);
  }catch(err){
    console.error(err);loadingText.textContent='El mapa base cargó, pero una capa 3D falló. Revisa la consola.';
    setTimeout(()=>{loading.classList.add('hide');try{bindUI()}catch{}updateMapMarker();updateHUD();requestAnimationFrame(gameLoop)},1500);
  }
});
map.on('error',e=>console.warn('Map layer error',e.error||e));
