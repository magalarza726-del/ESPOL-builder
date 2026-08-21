# ESPOL Builder — Campus Gustavo Galindo jugable 1:1

**v0.18.0 · TERRAIN FOUNDATIONS · STABILITY**

ESPOL Builder es un **master world web de ESPOL**. v0.18 congela nuevamente las funciones y se concentra en estabilidad geométrica: un edificio no puede usar una altura distinta para fachada, interior, cimiento y locomoción.

## v0.18: por qué había edificios hundidos y flotando

Hasta v0.17 la arquitectura detallada calculaba la base de cada edificio consultando el relieve **una sola vez en el centro de su huella**. En un terreno inclinado el edificio permanecía horizontal, pero el DEM seguía cambiando bajo sus esquinas. Por eso una esquina podía quedar enterrada y la opuesta suspendida.

v0.18 sustituye ese supuesto por `src/building-foundation-v018.js`:

1. parte de la misma huella GIS/fallback que ya utiliza Campus Architecture;
2. muestrea vértices, segmentos de borde, centro y una rejilla interior;
3. conserva mínimo, máximo y mediana del relieve bajo la huella;
4. fija la cota terminada de planta **10 cm sobre la muestra más alta**;
5. genera un zócalo/cimiento desde el punto bajo hasta la cota de planta;
6. instala esa misma cota temporalmente antes de que v0.17 construya fachadas e interiores;
7. cuando el jugador entra por una puerta, su superficie caminable usa exactamente la misma cota.

El terreno y el bosque mantienen el sampler original. El reemplazo de altura durante `render()` se limita a la consulta exacta de posición del jugador para evitar levantar árboles o carreteras sobre las losas.

## Jerarquía de edificios

Se conserva la regla de v0.17:

**huella GIS exacta → primera prioridad**  
**volumen del escaneo runtime → respaldo cuando falta GIS**  
**punto de control FIMCP → último respaldo sólo para edificios con coordenada conocida**

El modelo de cimentación consume esa misma lista; no crea otra distribución paralela.

## Ocho facultades e interiores

`src/faculty-registry-v017.js` continúa clasificando FIEC, FIMCP, FICT, FADCOM, FCNM, FCSH, FCV y FIMCM. `src/campus-architecture-v017.js` mantiene ventanas, puertas transitables, aulas, oficinas y laboratorios tipológicos. En v0.18 esas piezas se construyen sobre la cota de planta calculada para toda la huella.

Los interiores son reconstrucciones tipológicas, no planos arquitectónicos certificados.

## Arquitectura

```text
Terrain Surface v0.12
       │
       ├── muestreo completo de huella
       ▼
Building Foundation v0.18
       ├── min / max / mediana de terreno
       ├── cota de planta horizontal
       ├── zócalo/cimiento
       └── superficie caminable
       │
       ▼
Campus Architecture v0.17
       ├── shell / fachadas
       ├── puertas y ventanas
       ├── aulas / oficinas / labs
       └── colisión pared/puerta
       │
       ▼
Three.js master world
```

El entrypoint público enruta `./src/game3d.js` hacia `src/game3d_v018.js`.

## Auditoría agresiva

`auditBuildingFoundations()` bloquea la build si:

- no existe el modelo de cimentación;
- falta la superficie caminable;
- una cota no es finita;
- una planta queda por debajo del máximo de terreno de su propia huella.

También reporta huellas con más de 4.5 m de variación de relieve para revisión manual, porque probablemente requieren terrazas/escalonamiento arquitectónico en una futura reconstrucción de mayor precisión.

El reporte queda disponible en:

```js
window.__ESPOL_BUILDING_FOUNDATION_REPORT__
```

## Dos modalidades

- **Día:** Shift ×5 + jetpack manteniendo Espacio.
- **Noche:** linterna con F + pistola con clic izquierdo.

## Validación

GitHub Pages ejecuta antes de publicar:

```bash
npm run verify
```

Los tests v0.18 comprueban el compositor nuevo, muestreo de huellas, cota por máximo de terreno, cimientos, superficie caminable, control espacial FIMCP, ocho facultades, Terrain Surface y Forest System V2.

## Regla de desarrollo

No corregir una incoherencia creando otro mundo. Terreno, edificios, interiores, bosque y física deben consumir fuentes explícitas y compartidas. Cuando una pendiente supera lo que un único piso horizontal puede representar razonablemente, se marca para revisión en vez de ocultarla con offsets arbitrarios.
