# ESPOL Builder — Campus Gustavo Galindo jugable 1:1

**v0.6.0 · Hybrid Performance** — plantilla web del Campus Gustavo Galindo de ESPOL, pensada como `master map` reutilizable para exploración, terror, RPG o shooter y desplegable en GitHub Pages.

La prioridad de esta versión es que el campus pueda jugarse con mucha más fluidez sin perder la escala 1:1 ni la investigación ecológica acumulada.

## Cambio arquitectónico principal

Hasta v0.5, MapLibre hacía simultáneamente de mapa GIS y de motor de cámara del videojuego. Eso obligaba a recalcular/reproyectar terreno, vector tiles, edificios y capas cartográficas cada vez que el personaje se movía.

Desde v0.6 hay **dos motores separados**:

### Mapa

- MapLibre GL JS.
- Terreno, edificios, nombres, POI y navegación cartográfica.
- Zoom, pan y orientación dentro de los límites de ESPOL.
- No se mueve ni se repinta como cámara de videojuego cuando estás en 1ª/3ª persona.

### Primera y tercera persona

- Three.js independiente en `#game3d`.
- Cámara de videojuego real.
- Materiales planos (`MeshBasicMaterial`), sin luces dinámicas, sombras ni texturas pesadas.
- Terreno, infraestructura y vegetación renderizados como datos locales métricos.

Esta separación elimina el `map.jumpTo()` que antes se ejecutaba continuamente durante gameplay.

## Relieve: Terrarium cacheado

`src/game3d.js` contiene un lector propio de Mapzen/AWS Terrarium.

Al iniciar:

1. calcula qué tiles de zoom 15 cubren el bounding box de ESPOL;
2. descarga únicamente esos tiles;
3. decodifica cada píxel a elevación en metros mediante el formato Terrarium;
4. conserva los datos en memoria;
5. todas las consultas posteriores de altura son locales y síncronas.

El personaje, árboles, carreteras y edificios dejan así de depender de `MapLibre.queryTerrainElevation()` durante gameplay.

El terreno jugable se genera en **12 chunks principales (4 × 3)**, cada uno con malla low-poly. Three.js aplica frustum culling y el motor desactiva chunks suficientemente alejados.

## Infraestructura local

Durante la carga inicial, mientras MapLibre ya tiene visibles los tiles de ESPOL, v0.6 extrae información de las capas abiertas:

- `building` → cajas 3D instanciadas;
- `transportation` → tramos viales instanciados.

Después de esa conversión, el mundo Three.js trabaja con esos datos locales y MapLibre queda pausado durante gameplay.

Las cajas son una aproximación optimizada de las huellas originales; no sustituyen todavía el modelado arquitectónico fino de FIEC, FIMCP, Rectorado, CIB, etc.

## Vegetación ESPOL

Se conserva el modelo ecológico desarrollado en v0.5:

- árboles;
- arbustos;
- herbáceas;
- trepadoras/lianas;
- epífitas.

La selección de especies se apoya en investigaciones del Bosque y Vegetación Protector Prosperina, parcelas florísticas baja/media/alta, estudios de herbáceas/trepadoras/epífitas y documentación de restauración del bosque.

Consulta el informe detallado en:

`docs/ESPOL_VEGETATION_RESEARCH.md`

### LOD adaptativo

La vegetación completa existe como base procedural, pero sólo una fracción se materializa en 3D alrededor del jugador.

El motor usa:

- índice espacial por celdas;
- radio distinto para árboles y sotobosque;
- `InstancedMesh`;
- geometrías low-poly;
- materiales planos;
- presupuesto dinámico según hardware y FPS;
- reducción automática de resolución interna y densidad si cae el rendimiento.

## Profiler integrado

La interfaz muestra en tiempo real:

- FPS;
- frametime;
- draw calls;
- triángulos;
- instancias vegetales visibles;
- chunks activos;
- porcentaje de calidad dinámica.

El objetivo es poder optimizar con mediciones reales en la computadora del usuario, no sólo por intuición.

## Escala y movimiento

- 1 unidad métrica del mundo ≈ 1 metro real.
- Spawn: exterior aproximado del Auditorio FIEC.
- Avatar: ~1,80 m.
- Ojos en primera persona: 1,68 m.
- Velocidad base actual: **7,8 m/s ≈ 28,1 km/h**.
- `Shift`: multiplicador **×2,5**, máximo aproximado **19,5 m/s ≈ 70,2 km/h**.
- El movimiento utiliza aceleración, frenado, suavizado direccional y subpasos para reducir saltos por variaciones de FPS.

## Controles

- `W/S`: avanzar / retroceder
- `A/D`: desplazamiento lateral
- `Q/E` o flechas izquierda/derecha: girar
- `Shift`: sprint ×2,5
- `R`: reaparecer junto al Auditorio FIEC
- `1`: Mapa GIS
- `2`: Tercera persona
- `3`: Primera persona
- En Mapa: rueda + arrastre
- En gameplay: arrastre del ratón para orientar la cámara/personaje

## Fuentes principales

La documentación ampliada de fuentes está en `docs/`.

Entre las fuentes utilizadas están:

- ESPOL — Entorno e infraestructura: https://sostenibilidad.espol.edu.ec/entorno-e-infraestructura
- Composición florística y estructura del BVPP: https://www.dspace.espol.edu.ec/handle/123456789/65962
- Herbáceas, trepadoras y epífitas del Bosque Protector Prosperina: https://www.dspace.espol.edu.ec/handle/123456789/10919
- Actualización del plan de manejo del Bosque Protector: https://www.dspace.espol.edu.ec/handle/123456789/56033
- Los Gigantes del Bosque Seco: https://www.espol.edu.ec/en/node/9991
- Cartografía base: OpenStreetMap / OpenFreeMap
- Elevación: Mapzen Terrain Tiles / AWS Open Data, formato Terrarium

Los individuos vegetales generados son una **reconstrucción procedural calibrada**, no un inventario georreferenciado árbol por árbol.

## Validación y GitHub Pages

El repositorio incluye `package.json` con:

```bash
npm run check
```

El workflow de GitHub Pages ejecuta esta validación sintáctica antes de publicar.

`.github/workflows/pages.yml` despliega automáticamente desde `main` cuando GitHub Pages está configurado para usar **GitHub Actions**.

## Próximos pasos

La siguiente mejora de fidelidad ya no debería ser aumentar indiscriminadamente la cantidad de polígonos. El mejor retorno sería:

1. guardar en el repositorio un extracto local definitivo de carreteras/edificios de ESPOL para no depender de OpenFreeMap durante arranque;
2. modelar fachadas icónicas con geometría low-poly específica;
3. añadir un editor de correcciones in-game;
4. calibrar el auto-LOD con mediciones del profiler en distintos PCs y móviles;
5. incorporar tracks GPS reales de senderos del BVPP cuando estén disponibles.
