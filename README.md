# ESPOL Builder — Campus Gustavo Galindo jugable 1:1

**v0.7.0 · Forest Density / Collision** — plantilla web del Campus Gustavo Galindo de ESPOL, pensada como `master map` reutilizable para exploración, terror, RPG o shooter y desplegable en GitHub Pages.

La arquitectura mantiene dos motores separados:

- **Mapa:** MapLibre GL JS para GIS, zoom, pan, POI y cartografía.
- **Juego:** Three.js independiente para primera/tercera persona, terreno cacheado, vegetación, infraestructura y colisiones.

## Novedades v0.7

### Bosque mucho más denso

El modelo anterior representaba muy pocos fustes. La v0.7 usa como referencia estructural las parcelas florísticas de ESPOL y trabaja con **anclas de grupos**:

- 9.000 anclas arbóreas procedurales;
- cada ancla natural puede representar aproximadamente 8–22 fustes cercanos;
- 4.200 anclas de sotobosque;
- hasta ~1.600 árboles completos cercanos en calidad máxima;
- hasta ~950 masas de dosel a media distancia;
- adaptación automática de calidad según FPS.

Esto no significa que existan esas coordenadas exactas en el campus. La distribución es una reconstrucción procedural calibrada con publicaciones de ESPOL.

El muestreo reciente registró 245 árboles con DAP ≥5 cm en 3.000 m² y una fuerte concentración de individuos jóvenes en clases DAP 5–15 cm. Por eso el generador usa 73 % de individuos juveniles y evita el aspecto anterior de árboles grandes aislados.

Informe detallado:

`docs/ESPOL_FOREST_DENSITY_AND_STRUCTURE.md`

Investigación botánica general:

`docs/ESPOL_VEGETATION_RESEARCH.md`

### Distribución espacial

La página de sostenibilidad de ESPOL reporta alrededor de 80 % del campus cubierto por vegetación forestal y alrededor de 3 % por edificaciones. En consecuencia:

- el núcleo académico funciona como un gran claro urbano;
- la matriz forestal rodea el núcleo de forma mucho más continua;
- el oeste conserva mayor peso del BVPP;
- el este no queda artificialmente vacío;
- dentro de facultades se usa arbolado de campus en grupos pequeños.

### Composición por altitud

Las parcelas baja, media y alta alimentan pesos distintos. v0.7 amplía el catálogo con especies publicadas en las tablas de IVI, incluyendo entre otras:

- `Pseudalbizzia multiflora`
- `Guazuma ulmifolia`
- `Eriotheca ruizii`
- `Sapindus saponaria`
- `Cynometra bauhiniifolia`
- `Myrcia splendens`
- `Guarea glabra`
- `Trichilia elegans`
- `Triplaris cumingiana`
- `Gustavia angustifolia`
- `Pseudobombax millei`

La zona alta conserva además un sesgo hacia especies/estratos asociados a mayor humedad alrededor de la quebrada estacional descrita en la investigación.

## Edificios recuperados

La v0.6 podía iniciar el mundo 3D sin muchos edificios porque hacía una consulta única a los vector tiles después de encuadrar todo ESPOL.

La v0.7 realiza antes del gameplay un **barrido sectorial a zoom alto**:

1. recorre temporalmente una cuadrícula sobre el núcleo del campus;
2. espera la carga de tiles de cada sector;
3. extrae `building` y `transportation`;
4. deduplica geometrías;
5. convierte edificios y carreteras a `InstancedMesh` locales;
6. congela MapLibre y empieza gameplay.

Además existen volúmenes de respaldo para FIEC, FIMCP, Biblioteca, Rectorado, terminal, coliseo y postgrado cuando un tile no devuelve una huella utilizable.

Las formas Three.js siguen siendo volúmenes optimizados. Una fase posterior puede sustituir su malla visual por fachadas más fieles sin modificar ubicación ni colisión.

## Colisiones

### Edificios

- caja AABB por volumen;
- índice espacial en celdas de 80 m;
- sólo se inspeccionan objetos vecinos.

### Árboles

- colisión circular con troncos cercanos;
- utiliza la misma distribución determinista que el render de grupos;
- no recorre todos los árboles del campus.

### Jugador

- radio aproximado: 0,38 m;
- subpasos de movimiento de ~0,75 m para evitar atravesar objetos a alta velocidad;
- si un movimiento completo colisiona, el sistema intenta deslizar por X o Z antes de detener al jugador.

## Rendimiento

La v0.6 confirmó la utilidad de separar MapLibre y Three.js. v0.7 conserva:

- materiales `MeshBasicMaterial`;
- sin luces dinámicas ni sombras;
- `InstancedMesh`;
- DEM Terrarium precargado en memoria;
- terreno en 12 chunks;
- resolución interna adaptativa;
- LOD adaptativo;
- profiler de FPS, frametime, draw calls, triángulos, vegetación y chunks.

La mayor densidad forestal se consigue principalmente con grupos deterministas y masas de dosel, no multiplicando draw calls uno por uno.

## Relieve

`src/game3d.js` precarga los tiles Terrarium de zoom 15 que cubren el área de trabajo. Las consultas de elevación durante gameplay son locales y síncronas.

## Controles

- `W / S`: avanzar / retroceder
- `A / D`: desplazamiento lateral
- `Q / E`: girar
- `Shift`: sprint ×2,5
- `1`: Mapa
- `2`: tercera persona
- `3`: primera persona
- `R`: reaparecer fuera del Auditorio FIEC
- arrastrar en gameplay: mirar

## Escala

Las coordenadas continúan en longitud/latitud y las conversiones locales usan metros. La intención sigue siendo **1 m del mundo ≈ 1 m real** dentro de la aproximación del DEM y la cartografía pública.

## Fuentes principales

- Composición florística y estructura del BVPP, ESPOL: https://www.dspace.espol.edu.ec/handle/123456789/65962
- Monitoreo de herbáceas, trepadoras y epífitas, ESPOL: https://www.dspace.espol.edu.ec/handle/123456789/10919
- Sostenibilidad / entorno e infraestructura: https://sostenibilidad.espol.edu.ec/entorno-e-infraestructura
- Los Gigantes del Bosque Seco: https://www.espol.edu.ec/en/node/9991
- Reforestación inclusiva en Sendero Mirador: https://www.espol.edu.ec/es/noticias/reforestacion-inclusiva-en-el-bosque-protector-de-la-espol

## GitHub Pages

El workflow `.github/workflows/pages.yml` ejecuta `npm run check` antes de publicar. Ese comando valida sintaxis de los módulos JavaScript principales con `node --check`.

Con Pages configurado para **GitHub Actions**, cada push a `main` vuelve a desplegar el sitio.
