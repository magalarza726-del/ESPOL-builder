# ESPOL Builder — Campus Gustavo Galindo jugable 1:1

**v0.14.0 · FOUNDATION HARDENING · FIEC VERTICAL SLICE**

ESPOL Builder es un **master world web de ESPOL**, no un juego específico. El objetivo es construir una plantilla espacial estable, métrica y reutilizable sobre la que luego puedan vivir modos de exploración, terror, RPG o shooter sin duplicar terreno, edificios, bosque ni colisiones.

## Prioridad actual

La fase v0.14 congela el crecimiento horizontal de funciones. Antes de añadir nuevas mecánicas, el proyecto debe cumplir cinco condiciones:

1. locomoción estable durante recorridos largos;
2. una sola superficie de relieve para render y física;
3. un solo dataset de edificios para Mapa y mundo 3D;
4. una sola base forestal determinista para render y colisión;
5. FIEC + Auditorio como **vertical slice** de alta fidelidad y referencia para ampliar el resto del campus.

Los modos Terror/RPG/Shooter se conservan como *harnesses* de prueba del master world, pero no deben introducir sistemas paralelos del campus.

## Arquitectura vigente

```text
GitHub Pages
    │
    ├── MapLibre GL JS ── Mapa GIS / navegación / captura vectorial
    │
    └── Three.js ──────── mundo jugable 1ª/3ª persona
             │
             ├── Terrain Surface ─ una superficie física=visual
             ├── Building Sync ─── mismas huellas/alturas Mapa↔3D
             ├── Forest System V2 ─ ForestDatabase + chunks 64 m
             └── Foundation Audit ─ invariantes antes de declarar READY
```

El entrypoint público enruta `./src/game3d.js` hacia `src/game3d_v014.js`. Ese compositor reutiliza v0.13 y añade la auditoría de fundación.

## Vertical slice: FIEC + Auditorio

La zona patrón está declarada en `src/project-foundation.js` y contiene el spawn, Auditorio FIEC, 11A, 11B y 11F.

La intención es perfeccionar primero esta zona en:

- escala y pendientes;
- huellas y alturas;
- caminos/aceras;
- vegetación y claros;
- colisiones;
- fachadas y landmarks;
- rendimiento;
- comparación visual con referencias reales.

Sólo después debe repetirse el pipeline en Rectorado, Biblioteca, FIMCP y el resto del campus.

## Forest System V2

`src/forest-system-v2.js` sustituyó el runtime forestal incremental anterior.

Principios:

- chunks deterministas de **64×64 m**;
- IDs persistentes por árbol derivado;
- una `ForestDatabase` única;
- histéresis entre LOD cercano y lejano;
- masa forestal de respaldo cuando el presupuesto de detalle se agota;
- troncos lejanos simplificados;
- colliders generados desde los mismos Tree ID detallados que se representan;
- sin `Math.random()` durante la generación de identidad/posición;
- caché de chunks para evitar regeneración continua.

La investigación ecológica sigue sirviendo para densidad, composición, tamaños y estratos; **no se presenta como un censo exacto georreferenciado árbol por árbol**.

## Terreno

El relieve parte de tiles Terrarium precargados. `terrain-surface-v012.js` interpola exactamente los mismos triángulos de la malla visible y reemplaza `world.getElevation`, de modo que jugador, vegetación y edificios consultan la misma superficie que se dibuja.

## Edificios

`building-sync-preload.js` captura geometrías vectoriales y `game3d_sync.js` las reutiliza en MapLibre y Three.js.

Jerarquía de altura:

1. `render_height` / `height` del vector;
2. `levels` / `building:levels`;
3. niveles documentados de bloques identificables de ESPOL;
4. fallback explícito cuando no existe información suficiente.

La igualdad Mapa↔3D es un objetivo arquitectónico. La exactitud física en metros depende de los datos públicos disponibles y debe validarse edificio por edificio en los landmarks importantes.

## Auditoría de fundación

`src/project-foundation.js` define versión, fase, vertical slice y *quality gates*.

Después de construir las estructuras, `game3d_v014.js` ejecuta una auditoría que comprueba como mínimo:

- superficie física de terreno instalada;
- Forest System V2 instalado;
- resolver de colisión disponible;
- renderer disponible;
- muestras de elevación finitas en FIEC;
- landmarks contractuales del vertical slice;
- escala humana del avatar;
- cantidad de huellas capturadas en la zona patrón.

El resultado queda disponible en:

```js
window.__ESPOL_FOUNDATION_REPORT__
```

Los errores no controlados del navegador se conservan temporalmente en:

```js
window.__ESPOL_RUNTIME_ERRORS__
```

Un fallo duro de fundación impide que el mundo se declare listo silenciosamente. Un problema de datos externos puede marcar el reporte como `degraded` sin fingir que la reconstrucción es completa.

## Rendimiento

El runtime mantiene:

- MapLibre separado del loop de gameplay;
- DEM en memoria;
- `InstancedMesh`;
- materiales planos;
- sin sombras dinámicas;
- LOD adaptativo;
- profiler de FPS, frame time, draw calls, triángulos, vegetación y chunks.

Objetivo actual: **60 FPS**, considerando menos de 45 FPS sostenidos como señal de degradación que debe investigarse antes de subir fidelidad.

## Escala

La intención sigue siendo **1 m del mundo ≈ 1 m real**. El avatar está definido a escala humana y el spawn está fuera del Auditorio FIEC.

## Pruebas y despliegue

Antes de publicar, GitHub Actions ejecuta:

```bash
npm run verify
```

que incluye:

```bash
npm run check
npm run test
```

Los tests cubren invariantes generales, Forest V2, edificio sincronizado, terreno unificado y el contrato v0.14/FIEC.

## Fuentes de ESPOL ya incorporadas

La documentación de investigación se conserva en `docs/`:

- `ESPOL_DATA_SOURCES.md`
- `ESPOL_VEGETATION_RESEARCH.md`
- `ESPOL_FOREST_DENSITY_AND_STRUCTURE.md`
- `BUILDING_SYNC_V0.10.md`
- `FOREST_SYSTEM_V2.md`
- auditorías de estabilidad previas

Entre las fuentes utilizadas están publicaciones y páginas institucionales de ESPOL sobre infraestructura, Bosque Protector La Prosperina, composición florística, sotobosque, reforestación y cartografía del campus.

## Regla para próximas versiones

No crear un nuevo sistema paralelo para resolver un bug de uno existente.

Si una mejora necesita terreno, edificios o árboles, debe consumir respectivamente:

- la superficie de terreno existente;
- el dataset sincronizado de edificios;
- `ForestDatabase` / Tree ID de Forest System V2.

La siguiente mejora importante debe aumentar la **calidad del vertical slice**, no la cantidad de funciones del juego.
