import { CAMPUS, MAP_SOURCES, LANDMARKS, TREE_SPECIES } from './config.js';
import { buildProceduralForest } from './forest.js';

const $ = (q)=>document.querySelector(q);
const loading=$('#loading'), loadingText=$('#loadingText'), loadingBar=$('#loadingBar');
const hud={distance:$('#distance'),altitude:$('#altitude'),speed:$('#speed'),bearing:$('#bearing'),objective:$('#objective')};
const toast=$('#toast');
let toastTimer;
function notify(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2400)}
function loadingStep(p,text){loadingBar.style.width=`${p}%`;loadingText.textContent=text}

const map = new maplibregl.Map({
  container:'map',
  style:MAP_SOURCES.style,
  center:[CAMPUS.spawn.lng,CAMPUS.spawn.lat],
  zoom:17.15,
  pitch:72,
  bearing:305,
  maxPitch:85,
  minZoom:12.5,
  maxZoom:20,
  canvasContextAttributes:{antialias:true},
  attributionControl:false,
  hash:false
});
map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');

const player={lng:CAMPUS.spawn.lng,lat:CAMPUS.spawn.lat,bearing:305,totalM:0,lastSpeed:0};
const playerEl=document.createElement('div');playerEl.className='player-marker';
const playerMarker=new maplibregl.Marker({element:playerEl,anchor:'center'}).setLngLat([player.lng,player.lat]).addTo(map);
let follow=true, terrainEnabled=true, season=0.25, lastFrame=performance.now();
const keys=new Set(), visited=new Set();

function rad(d){return d*Math.PI/180}
function normBearing(b){return(b%360+360)%360}
function metersToLng(m,lat){return m/(111320*Math.cos(rad(lat)))}
function metersToLat(m){return m/110574}
function haversine(a,b){const R=6371000;const p1=rad(a.lat),p2=rad(b.lat),dp=rad(b.lat-a.lat),dl=rad(b.lng-a.lng);const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function formatDistance(m){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(2)} km`}
function terrainElevation(lng,lat){try{return map.queryTerrainElevation([lng,lat],{exaggerated:false})}catch{return null}}

function moveBy(forward,right,meters){
  const b=rad(player.bearing);
  const north=(Math.cos(b)*forward-Math.sin(b)*right)*meters;
  const east=(Math.sin(b)*forward+Math.cos(b)*right)*meters;
  const before={lng:player.lng,lat:player.lat};
  player.lat+=metersToLat(north);player.lng+=metersToLng(east,player.lat);
  player.lng=Math.max(CAMPUS.bounds.west,Math.min(CAMPUS.bounds.east,player.lng));
  player.lat=Math.max(CAMPUS.bounds.south,Math.min(CAMPUS.bounds.north,player.lat));
  player.totalM+=haversine(before,player);
}

function updateHUD(){
  hud.distance.textContent=formatDistance(player.totalM);
  const elev=terrainElevation(player.lng,player.lat);
  hud.altitude.textContent=Number.isFinite(elev)?`${Math.round(elev)} m`:'—';
  hud.speed.textContent=`${player.lastSpeed.toFixed(1)} km/h`;
  hud.bearing.textContent=`${Math.round(normBearing(player.bearing))}°`;
}

function followCamera(){
  if(!follow)return;
  map.easeTo({center:[player.lng,player.lat],bearing:player.bearing,pitch:72,zoom:17.35,duration:0,easing:t=>t});
}

function checkLandmarks(){
  LANDMARKS.forEach(l=>{
    if(visited.has(l.id))return;
    const d=haversine(player,{lng:l.lng,lat:l.lat});
    if(d<90){visited.add(l.id);document.querySelector(`[data-poi="${l.id}"]`)?.classList.add('visited');renderProgress();notify(`Hito descubierto: ${l.name}`)}
  });
}
function renderProgress(){
  const wrap=$('#progressDots');wrap.innerHTML='';LANDMARKS.slice(0,3).forEach(l=>{const i=document.createElement('i');if(visited.has(l.id))i.classList.add('done');wrap.appendChild(i)});
  const n=LANDMARKS.slice(0,3).filter(l=>visited.has(l.id)).length;
  hud.objective.textContent=n>=3?'Objetivo completado · explora libremente':`Visita 3 hitos del campus (${n}/3)`;
}
renderProgress();

function gameLoop(now){
  const dt=Math.min(.06,(now-lastFrame)/1000);lastFrame=now;
  let f=0,r=0,rot=0;
  if(keys.has('KeyW')||keys.has('ArrowUp'))f+=1;
  if(keys.has('KeyS')||keys.has('ArrowDown'))f-=1;
  if(keys.has('KeyA'))r-=1;
  if(keys.has('KeyD'))r+=1;
  if(keys.has('KeyQ')||keys.has('ArrowLeft'))rot-=1;
  if(keys.has('KeyE')||keys.has('ArrowRight'))rot+=1;
  player.bearing=normBearing(player.bearing+rot*72*dt);
  const moving=f||r, run=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const ms=run?8.2:4.4;
  if(moving){const len=Math.hypot(f,r);moveBy(f/len,r/len,ms*dt);playerMarker.setLngLat([player.lng,player.lat]);player.lastSpeed=ms*3.6}else player.lastSpeed*=.86;
  followCamera();updateHUD();checkLandmarks();
  requestAnimationFrame(gameLoop);
}

function addCampusBounds(){
  const b=CAMPUS.bounds;
  map.addSource('campus-bounds',{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[[[b.west,b.south],[b.east,b.south],[b.east,b.north],[b.west,b.north],[b.west,b.south]]]},properties:{}}});
  map.addLayer({id:'campus-fill',type:'fill',source:'campus-bounds',paint:{'fill-color':'#36d7b7','fill-opacity':.035}});
  map.addLayer({id:'campus-outline',type:'line',source:'campus-bounds',paint:{'line-color':'#5ff1d5','line-width':2,'line-opacity':.75,'line-dasharray':[3,2]}});
}

function addTerrain(){
  map.addSource('terrain-dem',{type:'raster-dem',tiles:[MAP_SOURCES.terrain],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:'Terrain: Mapzen / AWS Open Data; global sources include SRTM/USGS'});
  map.setTerrain({source:'terrain-dem',exaggeration:1});
  map.addLayer({id:'terrain-hillshade',type:'hillshade',source:'terrain-dem',paint:{'hillshade-exaggeration':.18,'hillshade-shadow-color':'#183026','hillshade-highlight-color':'#d9f1dc'}});
}

function addBuildings(){
  if(!map.getSource('ofm'))map.addSource('ofm',{type:'vector',url:MAP_SOURCES.vector});
  const layers=map.getStyle().layers||[];let labelId=layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
  map.addLayer({id:'espol-buildings-3d',source:'ofm','source-layer':'building',type:'fill-extrusion',minzoom:14.5,filter:['!=',['get','hide_3d'],true],paint:{'fill-extrusion-color':['interpolate',['linear'],['coalesce',['get','render_height'],['get','height'],10],0,'#cfd7da',18,'#b9c7cd',45,'#8fa5af'],'fill-extrusion-height':['coalesce',['get','render_height'],['get','height'],10],'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0],'fill-extrusion-opacity':.78}},labelId);
}

function addForest(){
  const data=buildProceduralForest();
  map.addSource('procedural-forest',{type:'geojson',data});
  map.addLayer({id:'forest-shadow',type:'circle',source:'procedural-forest',minzoom:13.3,paint:{'circle-radius':['interpolate',['linear'],['zoom'],13,1.2,16,4.0,19,9.5],'circle-color':'#122317','circle-opacity':.35,'circle-blur':.15}});
  map.addLayer({id:'forest-canopy',type:'circle',source:'procedural-forest',minzoom:13.3,paint:{'circle-radius':['interpolate',['linear'],['zoom'],13,1,16,3.3,19,8.2],'circle-color':['case',['==',['get','deciduous'],1],'#6c8b52','#357452'],'circle-opacity':['interpolate',['linear'],['zoom'],13,.28,16,.58,19,.78],'circle-stroke-width':['interpolate',['linear'],['zoom'],16,0,19,1],'circle-stroke-color':'rgba(17,44,28,.65)'}});
  map.on('click','forest-canopy',e=>{const f=e.features?.[0];if(!f)return;new maplibregl.Popup({closeButton:false}).setLngLat(e.lngLat).setHTML(`<b>${f.properties.name}</b><br><small>${f.properties.scientific||''}</small><br><span>Altura procedural: ~${f.properties.height} m</span>`).addTo(map)});
  map.on('mouseenter','forest-canopy',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','forest-canopy',()=>map.getCanvas().style.cursor='');
}

function addLandmarks(){
  LANDMARKS.forEach(l=>{
    const el=document.createElement('div');el.className='poi-marker';el.dataset.poi=l.id;
    new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([l.lng,l.lat]).setPopup(new maplibregl.Popup({offset:18}).setHTML(`<b>${l.name}</b><br><small>${l.note}</small>`)).addTo(map);
  });
}

function setSeason(v){
  season=v;$('#seasonLabel').textContent=v<.5?'Seca':'Lluviosa';
  if(map.getLayer('forest-canopy')){
    const dry='#78834b', wet='#23764d';
    map.setPaintProperty('forest-canopy','circle-color',['case',['==',['get','deciduous'],1],v<.5?dry:wet,v<.5?'#496b45':'#266e4c']);
    map.setPaintProperty('forest-canopy','circle-opacity',['interpolate',['linear'],['zoom'],13,v<.5?.22:.34,16,v<.5?.48:.65,19,v<.5?.68:.84]);
  }
}

function bindUI(){
  document.addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(document.activeElement?.tagName))return;keys.add(e.code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyR')resetPlayer()});
  document.addEventListener('keyup',e=>keys.delete(e.code));
  $('#btnFollow').onclick=()=>{follow=!follow;$('#btnFollow').classList.toggle('active',follow);if(follow)notify('Cámara siguiendo al jugador')};
  $('#btnOverview').onclick=()=>{follow=false;$('#btnFollow').classList.remove('active');map.fitBounds([[CAMPUS.bounds.west,CAMPUS.bounds.south],[CAMPUS.bounds.east,CAMPUS.bounds.north]],{padding:60,pitch:50,bearing:0,duration:1200})};
  $('#btnFullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
  $('#terrainToggle').onchange=e=>{terrainEnabled=e.target.checked;map.setTerrain(terrainEnabled?{source:'terrain-dem',exaggeration:1}:null);if(map.getLayer('terrain-hillshade'))map.setLayoutProperty('terrain-hillshade','visibility',terrainEnabled?'visible':'none')};
  $('#buildingsToggle').onchange=e=>map.setLayoutProperty('espol-buildings-3d','visibility',e.target.checked?'visible':'none');
  $('#treesToggle').onchange=e=>['forest-shadow','forest-canopy'].forEach(id=>map.setLayoutProperty(id,'visibility',e.target.checked?'visible':'none'));
  $('#boundsToggle').onchange=e=>['campus-fill','campus-outline'].forEach(id=>map.setLayoutProperty(id,'visibility',e.target.checked?'visible':'none'));
  $('#season').oninput=e=>setSeason(+e.target.value/100);
  $('#gameMode').onchange=e=>{document.body.classList.remove('mode-horror','mode-rpg','mode-shooter');if(e.target.value!=='explore')document.body.classList.add(`mode-${e.target.value}`);if(e.target.value==='horror'){map.easeTo({pitch:78,zoom:17.7,duration:800});notify('Modo terror: iluminación visual reducida')}else notify(`Modo ${e.target.options[e.target.selectedIndex].text} activado`)};
  $('#panelToggle').onclick=()=>{$('#panel').hidden=true;$('#panelOpen').hidden=false};$('#panelOpen').onclick=()=>{$('#panel').hidden=false;$('#panelOpen').hidden=true};
}
function resetPlayer(){player.lng=CAMPUS.spawn.lng;player.lat=CAMPUS.spawn.lat;player.bearing=305;player.lastSpeed=0;playerMarker.setLngLat([player.lng,player.lat]);follow=true;$('#btnFollow').classList.add('active');notify('Jugador reiniciado')}

TREE_SPECIES.slice(0,18).forEach(s=>{const el=document.createElement('span');el.innerHTML=`<b>${s.name}</b><br>${s.scientific}`;$('#speciesList').appendChild(el)});

map.on('load',()=>{
  try{
    loadingStep(35,'Aplicando relieve real…');addTerrain();
    loadingStep(52,'Extruyendo edificios…');addBuildings();
    loadingStep(68,'Reconstruyendo bosque seco…');addForest();
    loadingStep(82,'Añadiendo límites e hitos…');addCampusBounds();addLandmarks();
    bindUI();setSeason(season);
    loadingStep(100,'Mundo listo');
    setTimeout(()=>{loading.classList.add('hide');requestAnimationFrame(gameLoop);notify('WASD para explorar ESPOL a escala 1:1')},650);
  }catch(err){console.error(err);loadingText.textContent='Se cargó el mapa, pero una capa opcional falló. Revisa la consola.';setTimeout(()=>{loading.classList.add('hide');bindUI();requestAnimationFrame(gameLoop)},1400)}
});
map.on('error',e=>console.warn('Map layer error',e.error||e));
