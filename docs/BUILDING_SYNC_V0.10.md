# ESPOL Builder v0.10 — sincronización de edificios

## Objetivo

Desde v0.10 la vista Mapa y las vistas jugables no deben mantener dos representaciones arquitectónicas distintas.

El flujo es:

1. MapLibre carga las huellas de edificios de la fuente vectorial usada por el mapa.
2. `building-sync-preload.js` captura esas mismas geometrías Polygon/MultiPolygon durante el barrido GIS.
3. `game3d_sync.js` calcula una sola altura final por edificio.
4. El Mapa oculta la extrusión vectorial original y muestra `espol-buildings-synced-3d`, construida con el dataset capturado.
5. Three.js extruye exactamente las mismas huellas y usa exactamente la misma altura final.
6. Las colisiones usan el contorno poligonal de esas huellas; la caja AABB sólo sirve como índice espacial rápido.

Esto elimina el problema anterior, donde Three.js reemplazaba cada edificio por el rectángulo de su bounding box.

## Prioridad para altura

La altura se resuelve en este orden:

1. `render_height` / `height` del dato vectorial.
2. `levels` / `building:levels` del dato vectorial × 3.15 m por nivel.
3. Número de plantas documentado por ESPOL cuando el bloque puede identificarse con suficiente confianza.
4. Fallback explícito de 7.4 m si no existe ningún dato mejor.

El valor final se guarda una sola vez y alimenta tanto MapLibre como Three.js.

## Calibración documental

### FIEC

Fuente oficial: https://www.fiec.espol.edu.ec/es/infraestructura

- 11A: el portal documenta espacios 2xx y el edificio principal con administración, aulas, laboratorios y Auditorio; se usa como referencia de 3 niveles cuando el vector no publica niveles.
- 11B: documentación de espacios 0xx/1xx; referencia de 2 niveles.
- 11C: la página separa explícitamente planta alta y planta baja; referencia de 2 niveles.
- 11D: espacios 0xx y 1xx; referencia de 2 niveles.
- 11F: oficinas 1xx y dependencias inferiores; referencia de 2 niveles.

Fuente complementaria: https://www.fiec.espol.edu.ec/archive/es/descargas

### FIMCP

Fuente oficial actual: https://www.fimcp.espol.edu.ec/es/infraestructura

La página describe planta baja y planta alta para su edificio principal.

Fuente institucional archivada: https://www.fimcp.espol.edu.ec/archive/en/infrastructure

La versión archivada detalla edificios con dos y tres plantas, entre ellos bloques históricamente identificados como 24C/24E.

## Limitación importante

Las páginas institucionales citadas describen plantas y distribución funcional, pero normalmente no publican la altura de fachada en metros. Por ello, `3.15 m/nivel` sigue siendo una conversión geométrica del prototipo, no una medición topográfica de cada edificio.

La garantía de v0.10 es que **Mapa y gameplay usan la misma huella y la misma altura calculada**. No significa todavía que cada altura sea una medición real al centímetro.

## Próximo nivel de fidelidad

Para sustituir estimaciones de altura por valores reales se necesitaría al menos una de estas fuentes:

- planos arquitectónicos con cotas;
- modelos BIM/CAD autorizados;
- nube de puntos/LiDAR;
- fotogrametría calibrada;
- medición de campo con puntos de control.
