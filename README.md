# ESPOL Builder — Campus Gustavo Galindo jugable 1:1

Prototipo web de mundo abierto del Campus Gustavo Galindo de ESPOL. Está diseñado como **master map reutilizable** para exploración, terror, RPG o shooter y funciona como sitio estático en GitHub Pages.

## Qué es fiel y qué no

### Geometría y escala

- El mundo usa coordenadas geográficas reales; el desplazamiento del jugador se calcula en metros sobre WGS84 aproximado localmente. **1 metro de movimiento del juego corresponde aproximadamente a 1 metro sobre el terreno.**
- El rectángulo de trabajo se tomó del levantamiento GIS publicado para el Campus Gustavo Galindo: 2°07′52″–2°09′25″ S y 79°56′33″–79°58′57″ W.
- El relieve proviene de **Mapzen Terrain Tiles / AWS Open Data** en formato Terrarium. La elevación se representa en metros y MapLibre la renderiza como terreno 3D.
- Los edificios se extruyen desde datos de OpenStreetMap/OpenFreeMap cuando existe altura cartografiada; cuando no existe, la capa usa una altura visual por defecto.

### Bosque y árboles

La distribución **de árboles individuales no pretende ser un censo real**. ESPOL publica especies, biodiversidad, características y contexto ecológico, pero no encontramos en esta pasada un inventario abierto completo con coordenadas de cada árbol. Por ello la app usa una nube procedural reproducible que:

- favorece el sector occidental y áreas fuera del núcleo académico;
- usa únicamente especies documentadas en el catálogo institucional del Bosque Protector Prosperina para el conjunto principal;
- aplica alturas máximas publicadas para varias especies (por ejemplo Ceibo, Guayacán, Pechiche, Samán, Palo Santo, Algarrobo, Pretino y Muyuyo);
- cambia visualmente entre estación seca y lluviosa de acuerdo con la descripción del bosque seco estacional.

## Datos usados y decisiones de diseño

### Campus, rutas y zonificación

**Ching-Ávalos et al. (2020), “Use of Geographic Information Systems for mapping a cartographic baseline of trails in Gustavo Galindo Campus”.**

- El área de estudio se delimita por las coordenadas citadas arriba.
- El trabajo realizó mediciones de longitud y ancho de rutas con GPS y cinta métrica y luego procesamiento GIS.
- Reporta aproximadamente 696 ha en el área analizada.
- Reporta 225,67 ha para BPP dentro de su zonificación, 91,91 ha de infraestructura y 378,33 ha de zona no clasificada.
- Clasifica accesos mayores a 1,8 m y senderos menores a 1,8 m.
- Registra unos 22,98 km combinados de rutas en sus tablas y señala accesos del oeste hacia torres de radiofrecuencia, líneas eléctricas y el gasoducto Monteverde–Pascuales.

Fuente: https://www.researchgate.net/publication/344463996_Use_of_Geographic_Information_Systems_for_mapping_a_cartographic_baseline_of_trails_in_Gustavo_Galindo_Campus

### Topografía e hidrología

**Luna Cabrera & Méndez (2017), proyecto ESPOL sobre la ciclovía/lago.**

- Documenta un plano topográfico del Campus Gustavo Galindo de 2016 con curvas de nivel principales cada 5 m.
- Documenta topobatimetría del lago y la existencia de cinco subcuencas principales.
- Describe la Formación Cayo y materiales residuales/meteorizados en sectores del campus.

Fuente: https://dspace.espol.edu.ec/bitstream/123456789/43456/1/D-CD70248.pdf

**Sánchez Aguas (2015).** Describe la topografía del BPP desde regular hasta muy irregular y pendientes de medianas a fuertemente pronunciadas.

Fuente: https://www.dspace.espol.edu.ec/bitstream/123456789/39629/1/T-76459%20SANCHEZ%20AGUAS.pdf

### Biodiversidad y árboles

**Bosque y Vegetación Protector Prosperina — Biodiversidad (ESPOL).** Catálogo institucional con especies de flora. Entre las especies incorporadas al generador están Ceibo, Algarrobo, Pechiche, Samán, Palo Santo, Guayacán, Guayacán negro, Nigüito, Muyuyo de montaña, Pretino, Fernán Sánchez, Caracolí, Mango, etc.

Fuente: https://www.bosqueprotector.espol.edu.ec/biodiversidad/

**Castillo Sánchez (2021), Actualización del plan de manejo del BPP: aportes de biodiversidad.**

- Identificó 272 especies de flora en 74 familias; 99 arbóreas en 40 familias.
- Describe al BPP como bosque seco tropical, con cambios de cobertura visual marcados entre época lluviosa y seca.
- Menciona especies como mango, ceibo, palo santo y nigüito.

Fuente: https://www.dspace.espol.edu.ec/bitstream/123456789/56033/1/T-112370%20Castillo_S%C3%A1nchez.pdf

**Sostenibilidad ESPOL — Entorno e infraestructura.** Señala al Guayacán, Balsa, Ceibo y Palo Santo entre los árboles presentes y publica métricas institucionales de cobertura forestal del campus.

Fuente: https://sostenibilidad.espol.edu.ec/entorno-e-infraestructura

### Elevación y cartografía web

- AWS Open Data — Terrain Tiles: https://registry.opendata.aws/terrain-tiles/
- Tilezen/Joerd — formato Terrarium: https://github.com/tilezen/joerd/blob/master/docs/formats.md
- MapLibre GL JS — terreno 3D y extrusión de edificios: https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/ y https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/
- OpenFreeMap: https://openfreemap.org/
- OpenStreetMap contributors: https://www.openstreetmap.org/copyright

## Controles

- `W / S`: avanzar / retroceder
- `A / D`: desplazamiento lateral
- `Q / E`: girar
- `Shift`: correr
- `R`: volver al punto inicial
- Botón **Mapa**: ver el área completa
- Botón **Seguir**: activar/desactivar cámara del jugador

## GitHub Pages

El repositorio incluye `.github/workflows/pages.yml` con despliegue mediante GitHub Actions. Si Pages no está habilitado aún en el repositorio, ve a **Settings → Pages → Source → GitHub Actions** una sola vez. Después cada `push` a `main` vuelve a desplegar automáticamente.

## Limitaciones actuales

1. Es un **prototipo geoespacial jugable**, todavía no una réplica arquitectónica 80 % terminada.
2. La elevación es un DEM global; para máxima fidelidad habría que reemplazarlo en una futura versión con el levantamiento topográfico institucional de curvas cada 5 m si ESPOL libera el archivo CAD/GIS fuente.
3. OpenStreetMap no tiene necesariamente todos los edificios, alturas, senderos o antenas del campus.
4. Los árboles son poblaciones procedurales ecológicamente inspiradas, no ubicaciones censadas.
5. Los modos Terror/RPG/Shooter son presets visuales/base; todavía no incluyen enemigos, inventario o narrativa.

## Próxima versión recomendada

La v0.2 debería incorporar un **Editor ESPOL** dentro del navegador: dibujar/corregir edificios, senderos, postes, antenas y zonas de vegetación sobre el terreno 3D, guardar cambios en GeoJSON y exportar el master map. Eso permite que el 20 % de trabajo manual se convierta en una corrección visual sobre datos reales, en vez de modelar el campus desde cero.
