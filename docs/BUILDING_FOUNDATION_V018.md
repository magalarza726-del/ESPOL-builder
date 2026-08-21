# Building Foundation v0.18

v0.18 elimina el supuesto de que la elevación del centro representa toda la huella de un edificio.

## Resolución vertical

Cada edificio reutiliza la misma huella de Campus Architecture y muestrea vértices, bordes (~6 m máximo entre muestras), centro y una rejilla interior. Se almacenan mínimo, máximo, mediana y rango del terreno. La planta terminada se fija en `maxTerrain + 0.10 m`, evitando que el relieve atraviese pisos o interiores.

## Cimiento

La huella se extruye desde `minTerrain - 0.12 m` hasta la cota de planta. En laderas, la diferencia queda visible como zócalo/cimiento en vez de dejar una esquina flotando.

## Locomoción

Terreno, bosque y carreteras continúan consumiendo el sampler de terreno original. Sólo la consulta exacta usada para colocar al jugador pasa a la cota de planta cuando está dentro de un edificio con la capa activa. De este modo los árboles no se levantan sobre los pisos.

## Instalación

`game3d_v018.js` ejecuta:

1. `buildFoundationModel()`;
2. `runWithFoundationCenters()` durante la construcción v0.17;
3. `installFoundationSkirts()`;
4. `installWalkSurface()`;
5. `auditBuildingFoundations()`.

La coincidencia temporal de centros usa un radio de sólo 0.35 m para no contaminar consultas de carreteras o vegetación.

## Auditoría

La build falla si falta el sistema, faltan cotas finitas o una planta queda por debajo del terreno máximo muestreado. Huellas con desnivel superior a 4.5 m quedan como advertencia para futuro modelado escalonado/terrazas.

Reporte runtime:

```js
window.__ESPOL_BUILDING_FOUNDATION_REPORT__
```
