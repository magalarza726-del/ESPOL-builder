# Building Foundation v0.18

## Objetivo

Eliminar de raíz edificios hundidos o flotantes causados por utilizar una sola altura de terreno en el centro de la huella.

## Regla vertical

Cada edificio se resuelve con una sola cota terminada de planta. `building-foundation-v018.js` toma la misma huella empleada por Campus Architecture y muestrea:

- vértices;
- bordes con paso máximo aproximado de 6 m;
- centro de bounding box;
- puntos interiores de una rejilla 4×4 cuando caen dentro del polígono.

Se guardan `minTerrain`, `maxTerrain`, `medianTerrain` y `span`. La planta se fija en `maxTerrain + 0.10 m`, por lo que el terreno muestreado no puede atravesarla.

## Cimientos

Se extruye la huella desde `minTerrain - 0.12 m` hasta la cota de planta. La parte que queda expuesta en una ladera funciona como zócalo/cimiento visual. No se modifica el DEM global ni se aplana el bosque.

## Superficie caminable

El terreno base continúa siendo la única superficie para terreno, carreteras y vegetación. Solamente la consulta exacta usada para posicionar al personaje se sustituye por la cota de planta cuando el jugador está dentro de una huella de edificio y la capa de edificios está activa.

Esto evita elevar árboles accidentalmente sobre los interiores.

## Ciclo de vida

`game3d_v018.js`:

1. crea el mundo v0.17;
2. construye el Foundation Model antes de instalar estructuras;
3. durante la instalación, sustituye únicamente consultas de centro de edificio por la cota calculada;
4. v0.17 genera arquitectura/interiores sobre esa cota;
5. v0.18 añade cimientos y superficie caminable;
6. ejecuta una auditoría bloqueante.

El radio de coincidencia de centro es 0.35 m para evitar que consultas de carretera o vegetación sean confundidas con edificios.

## Auditoría

Errores bloqueantes:

- modelo vacío;
- sampler de superficie caminable ausente;
- alturas no finitas;
- planta debajo del máximo de terreno.

Advertencias:

- variación de relieve >4.5 m dentro de una huella. Esos casos probablemente requieren modelado de terrazas o niveles escalonados en vez de una sola planta horizontal.

## Diagnóstico

El reporte runtime se publica en:

```js
window.__ESPOL_BUILDING_FOUNDATION_REPORT__
```

Incluye número de edificios, mallas de cimiento, máximo desnivel encontrado, cimientos profundos y total de muestras de terreno.
