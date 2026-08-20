# ESPOL Builder — Campus Gustavo Galindo jugable 1:1

**v0.15.0 · FIMCP PHOTO RECONSTRUCTION**

ESPOL Builder es un **master world web de ESPOL**, no un juego específico. El objetivo es construir una plantilla espacial estable, métrica y reutilizable sobre la que luego puedan vivir exploración, terror, RPG o shooter sin duplicar terreno, edificios, bosque ni colisiones.

## Prioridad actual

La fase v0.15 mantiene el *feature freeze* de v0.14 y agrega el primer levantamiento fotográfico de campo: **100 vistas secuenciales de FIMCP tomadas el 20 de agosto de 2026**.

La estrategia ahora es:

1. FIEC + Auditorio sigue siendo el baseline técnico del spawn y de los invariantes del motor.
2. FIMCP pasa a ser el primer **vertical slice fotográfico** para demostrar fidelidad perceptual real.
3. Mapa y mundo 3D siguen compartiendo huellas GIS.
4. Las fotos sólo agregan información visual/topológica: fachadas, accesos, estacionamientos, corredores, patios, servicio y borde de transporte.
5. No se añaden las fotografías de ~500 MB como texturas del runtime.

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
             ├── FIMCP Photo Survey ─ 100 vistas → restricciones visuales
             └── Foundation Audit ─ invariantes antes de declarar READY
```

El entrypoint público sigue enrutando `./src/game3d.js` hacia `src/game3d_v014.js`. En v0.15 ese compositor endurecido instala además `fimcp-detail-v015.js` después de que ya existen las huellas y carreteras sincronizadas.

## FIMCP: levantamiento 2026-08-20

`src/fimcp-photo-survey.js` conserva la trazabilidad 01–100.

Evidencia recibida:

- 100 nombres de fotos en el ZIP;
- 20 originales recuperables a 4096×3072 (`01–12`, `93–100`);
- las entradas `13–92` están dañadas en el ZIP recibido;
- el PDF incluido conserva las 100 vistas en orden, y se usa como referencia visual de continuidad para `13–92`;
- no hay GPS EXIF en los originales recuperables.

Por tanto, la reconstrucción separa claramente:

- **posición/huella:** GIS sincronizado;
- **altura:** vector/niveles/documentación ESPOL;
- **apariencia y conexiones:** levantamiento fotográfico;
- **elementos sin GPS:** posición relativa inferida, nunca presentada como levantamiento centimétrico.

### Rasgos incorporados

Las 100 fotos cubren:

- Auditorio FIMCP: portal azul, letrero, escalinata, vidrio y pavers;
- lateral técnico del auditorio;
- estacionamientos y cubierta azul larga;
- LEMAT y su lenguaje crema/azul/ventanal industrial;
- callejones y corredores estrechos;
- bloques de dos niveles con bandas ocres, placas azules y barandas amarillas;
- núcleo de corredores cubiertos y escaleras;
- patio central ajardinado;
- estacionamiento grande / hall de servicio;
- patio industrial con tuberías/equipo naranja;
- cinturón de árboles y bordillos amarillos;
- Estación GBP y avenida exterior con palmas, señalética, espera y transporte.

La trazabilidad completa está en `docs/FIMCP_PHOTO_RECONSTRUCTION_V015.md`.

## FIEC baseline

FIEC + Auditorio continúa declarado en `src/project-foundation.js` porque el jugador aparece allí y sirve para verificar:

- locomoción;
- superficie de terreno;
- edificios sincronizados;
- Forest System V2;
- colisiones;
- escala humana.

FIMCP no reemplaza este baseline: añade un segundo contrato, orientado a fidelidad fotográfica.

## Forest System V2

`src/forest-system-v2.js` usa:

- chunks deterministas de **64×64 m**;
- IDs persistentes;
- una `ForestDatabase` única;
- histéresis LOD;
- masa forestal de respaldo;
- troncos lejanos simplificados;
- colliders derivados de los mismos Tree ID detallados;
- sin `Math.random()` para identidad/posición.

## Terreno

`terrain-surface-v012.js` interpola exactamente los mismos triángulos de la malla visible y reemplaza `world.getElevation`, por lo que jugador, vegetación y edificios consultan la misma superficie dibujada.

## Edificios

`building-sync-preload.js` captura geometrías vectoriales y `game3d_sync.js` las reutiliza en MapLibre y Three.js.

Jerarquía de altura:

1. `render_height` / `height`;
2. `levels` / `building:levels`;
3. niveles documentados de bloques identificables;
4. fallback explícito.

La reconstrucción FIMCP **decora esas mismas masas**; no crea otro mapa de edificios ni otro sistema de colisiones.

## Auditoría de fundación

`project-foundation.js` comprueba ahora también:

- instalación de FIMCP Photo Reconstruction;
- cobertura exacta de fotos 01–100;
- anchors FIMCP contractuales;
- cantidad de huellas GIS capturadas en el slice FIMCP;
- cantidad de edificios efectivamente decorados.

Reportes de desarrollo:

```js
window.__ESPOL_FOUNDATION_REPORT__
window.__ESPOL_RUNTIME_ERRORS__
world.getFIMCPPhotoReport?.()
```

## Rendimiento

Objetivo: **60 FPS**. Menos de 45 FPS sostenidos se considera degradación que debe investigarse antes de seguir aumentando fidelidad.

Los detalles fotográficos se construyen con geometría simple y materiales planos; no se distribuye el dataset fotográfico original con Pages.

## Pruebas

```bash
npm run verify
```

ejecuta sintaxis + smoke tests + foundation tests. Además `.github/workflows/ci.yml` verifica branches/PRs sin desplegarlos y el workflow de Pages sigue verificando `main` antes de publicar.

## Regla de arquitectura

No crear sistemas paralelos para resolver bugs.

- relieve → superficie única;
- edificios → dataset sincronizado;
- bosque → ForestDatabase / Tree ID;
- reconstrucción fotográfica → decoración/constraints sobre esos mismos datos.

La siguiente mejora debe aumentar la correspondencia visual **foto real ↔ punto virtual**, no añadir más funciones de juego.
