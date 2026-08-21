# ESPOL Builder — Campus Gustavo Galindo jugable 1:1

**v0.16.0 · FIMCP SPATIAL CONTROL · DÍA/NOCHE**

ESPOL Builder es un **master world web de ESPOL**. La prioridad actual es representar el campus con escala, posición y continuidad espacial confiables antes de ampliar gameplay.

## v0.16: corrección espacial de FIMCP

La primera reconstrucción fotográfica demostró que el orden de las fotos no es suficiente para fijar posiciones absolutas. Desde v0.16 la regla es:

**GIS/control espacial → posición y huella. Fotos → apariencia, circulación y detalle local.**

`src/fimcp-spatial-control.js` define una red de control para:

- Parqueadero Alumnos FIEC y FIMCP;
- Auditorio FIMCP / 12H;
- Bloque 18-A;
- Comedor FIMCP;
- FIMCP Aulas - Bloque 24C;
- Terminal de Buses ESPOL;
- Postgrado como referencia/exclusión.

Las 100 fotos siguen documentadas en `src/fimcp-photo-survey.js`, pero ya no pueden estirar el conjunto ni ubicar edificios por inferencia global. LEMAT, 24E y posiciones exactas del patio permanecen sin colocar si falta un ancla espacial suficientemente confiable.

## Dos modalidades

La interfaz pública se reduce a:

- **Día:** Shift ×5 + jetpack manteniendo Espacio.
- **Noche:** iluminación nocturna + linterna con F + pistola con clic izquierdo.

Ambas reutilizan controladores internos ya estabilizados y no crean mundos o físicas paralelas.

## Arquitectura

```text
GitHub Pages
    │
    ├── MapLibre GL JS ── GIS / mapa / huellas
    │
    └── Three.js ──────── mundo jugable
             │
             ├── Terrain Surface ─ física = malla visible
             ├── Building Sync ─── Mapa = 3D
             ├── Forest System V2 ─ chunks deterministas 64 m
             ├── FIMCP Spatial ─── puntos de control + fotos locales
             └── Foundation Audit ─ invariantes antes de READY
```

El entrypoint público enruta `./src/game3d.js` hacia `src/game3d_v016.js`.

## Escala y pruebas

La intención es **1 m del mundo ≈ 1 m real**. Los tests de v0.16 verifican distancias entre parqueadero, Auditorio, 18-A, 24C y Terminal para bloquear una regresión similar al desfase de aproximadamente 20× detectado en v0.15.

Antes de desplegar Pages se ejecuta:

```bash
npm run verify
```

que incluye sintaxis, smoke tests y foundation tests.

## Sistemas compartidos

- `terrain-surface-v012.js`: una sola superficie física/visual.
- `game3d_sync.js`: mismas huellas/alturas en Mapa y 3D.
- `forest-system-v2.js`: ForestDatabase, IDs persistentes, chunks 64 m y colisión derivada del bosque detallado.
- `fimcp-spatial-v016.js`: detalle FIMCP sólo sobre huellas controladas espacialmente.
- `day-night-v016.js`: composición de las dos modalidades.

## Documentación

- `docs/V016_RELEASE_NOTES.md`
- `docs/FIMCP_PHOTO_RECONSTRUCTION_V015.md`
- `docs/FOREST_SYSTEM_V2.md`
- `docs/BUILDING_SYNC_V0.10.md`
- `docs/ESPOL_DATA_SOURCES.md`

## Regla de desarrollo

No crear un sistema paralelo para corregir otro. Una mejora debe consumir el terreno, edificios y bosque vigentes. En reconstrucción fotográfica, una foto puede gobernar aspecto y relaciones locales; una posición absoluta necesita un ancla espacial verificable.
