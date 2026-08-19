# Fuentes de datos y fidelidad — ESPOL Builder

Este documento registra fuentes públicas encontradas para acercar el master map a la geometría, infraestructura y ecología del Campus Gustavo Galindo. La regla del proyecto es sencilla: **si una fuente no permite derivar una geometría con suficiente confianza, se documenta pero no se inventa**.

## Prioridad A — datos que ya alimentan v0.3.1

### Límites, rutas y senderos

**Ching-Ávalos et al. — GIS/cartographic baseline of trails in Gustavo Galindo Campus.**

Uso actual:
- bounding box del área de trabajo;
- referencia de escala/cobertura;
- 696 ha analizadas;
- ~22,9831 km de rutas;
- clasificación entre accesos mayores y menores de 1,8 m.

### Relieve

**Mapzen Terrain Tiles / AWS Open Data — Terrarium.**

Uso actual:
- DEM del navegador;
- elevación en metros;
- exageración vertical 1×.

**Topografía institucional citada en tesis ESPOL.**

Existe documentación de un levantamiento/plano con curvas principales cada 5 m. Si se recupera el CAD/GIS original, debe sustituir al DEM global para las zonas construidas.

### Bosque y vegetación

**ESPOL — Composición florística y estructura del Bosque y Vegetación Protectora Prosperina (2024/2025).**

Uso actual:
- tres parcelas permanentes, baja/media/alta;
- altitudes 125/179/226 m;
- IVI de especies dominantes por parcela;
- predominio de individuos juveniles en DAP 5–15 cm;
- bosque semideciduo.

**ESPOL — Entorno e infraestructura / sostenibilidad.**

Uso actual:
- 6.587.827 m² de campus;
- 5.264.107 m² de vegetación forestal (~80%);
- 174.902 m² de edificaciones (~3%);
- vegetación plantada <10%.

**Los Gigantes del Bosque Seco + campañas de restauración/vivero Nativo.**

Uso actual:
- ampliación del catálogo de especies;
- arquetipos de copa y mezcla de especies nativas/campus;
- referencias de Guayacán, Ceibo, Balsa, Palo Santo, Laurel, Pechiche, Fernán Sánchez, Guachapelí, Cascol, Ébano, etc.

## Prioridad A — edificios e infraestructura institucional

### FIEC

Fuente oficial de infraestructura FIEC.

Bloques documentados:
- 11A: edificio principal, administración, Auditorio FIEC, aulas, oficinas y laboratorios;
- 11B: soporte, administración, aulas híbridas y laboratorios de computación;
- 11C: laboratorios eléctricos/electrónicos/telecom/control y grupos de investigación;
- 11D: aulas, profesores, asociaciones, IEEE y clubes;
- 11F: profesores, clubes y sala de sesiones.

Uso actual:
- nomenclatura del mapa;
- spawn próximo al Auditorio FIEC;
- catálogo de referencia para futuras correcciones de volumen/fachada.

### FIMCP

Fuente oficial de infraestructura FIMCP.

Elementos documentados:
- edificio principal;
- 12I: termofluidos / Robota;
- 12E: LEMAT, soldadura, metalografía y materiales;
- 12G: alimentos, microbiología, sólidos, operaciones unitarias y biblioteca.

### FICT

Fuente oficial de infraestructura FICT.

Bloques documentados:
- 13A, 13B, 13D, 13E, 13F, 13G y 13H.

### FADCOM

Fuente oficial de infraestructura FADCOM.

Bloques documentados:
- 14A, 14B, 14C, 3M y 7B;
- 14C: comedor/parqueadero;
- 3M: talleres;
- 7B: Motion Lab.

## Prioridad A+ — fuentes encontradas para una futura v0.4/v0.5

### 1. PolitoMap — navegación interactiva del Campus Gustavo Galindo (2024)

Proyecto integrador ESPOL/FIEC: **Plataforma de Navegación Interactiva con Realidad Aumentada para Exploración en el Campus Gustavo Galindo**.

Relevancia:
- implementó un mapa interactivo del campus;
- trabaja con geolocalización y destinos/bloques;
- puede contener o haber requerido un catálogo de POI más rico que el disponible públicamente en OSM.

Acción recomendada:
- recuperar repositorio/dataset o anexos si están públicamente disponibles;
- comparar su catálogo de destinos con `LANDMARKS` y OSM;
- no copiar assets protegidos; extraer únicamente datos abiertos o recreables.

### 2. SIG para planificación física del campus (2005)

Trabajo ESPOL: **Sistema de información geográfico de ayuda para la toma de decisiones en la planificación física del Campus Gustavo Galindo V.**

Relevancia:
- fue diseñado para la Unidad de Planificación;
- describe consultas interactivas mediante planos;
- buscaba mostrar localización y estado de edificaciones/instalaciones.

Este es probablemente uno de los rastros públicos más interesantes para reconstrucción histórica del catastro del campus.

Acción recomendada:
- localizar tesis completa, anexos, shapefiles, tablas o base de datos original;
- si solo existen figuras raster, georreferenciarlas contra la red actual y OSM;
- usarlo como referencia histórica, porque la planta física cambió desde 2005.

### 3. Red de control geodésica ESPOL–REGME (2015)

Tesis FICT: **Implantación de una red de control geodésica enlazada a la REGME dentro del Campus Gustavo Galindo**.

Relevancia:
- puntos de control con coordenadas precisas bajo un mismo datum;
- altitudes referenciadas al nivel medio del mar;
- ideal para validar DEM, recorridos GPS y levantamientos de edificios.

Acción recomendada:
- recuperar tabla de hitos geodésicos;
- crear `data/geodetic_control.geojson`;
- comparar elevación DEM vs. cotas de control y calcular corrección local.

### 4. Topografía de la zona 11 / FIEC (2020)

Proyecto de diagnóstico de colectores de agua residual de la zona de ingenierías desde FIEC.

Relevancia:
- realizó trabajo de campo para topografía de la zona 11;
- registró cajas, cotas y elementos de infraestructura;
- puede ayudar a afinar el entorno inmediato de FIEC, que es el spawn principal.

Acción recomendada:
- revisar planos/anexos del PDF;
- extraer únicamente geometría pública útil para cotas, plataformas y corredores exteriores.

### 5. Geología y geositios del campus

El estudio de geositios del Campus Gustavo Galindo documenta la relación con la Cordillera Chongón–Colonche y sitios geomorfológicos/petrológicos de interés.

Relevancia para juego:
- tipos de roca, cortes, taludes y zonas de interés geológico;
- mejor materialización visual de cerros y afloramientos;
- puntos naturales para exploración, RPG o terror.

## Capas que aún faltan para ~80% de fidelidad perceptual

1. `building_overrides.geojson`: huellas, alturas, pisos, techos y materiales verificados para edificios icónicos.
2. `campus_props.geojson`: paradas, luminarias, postes, letreros, cercas, antenas, transformadores, bancas, monumentos y mobiliario.
3. `trails.geojson`: Sendero Mirador, Huella Ecológica, Gavilán Dorsigrís y caminos secundarios validados.
4. `roads_override.geojson`: ancho, aceras, bordillos, sentidos, intersecciones y estacionamientos.
5. `landcover.geojson`: bosque, césped, suelo desnudo, cancha, agua y zonas construidas con polígonos reales.
6. `tree_inventory.geojson`: solo si ESPOL publica un inventario árbol-a-árbol; mientras tanto se mantiene procedural.
7. `geodetic_control.geojson`: hitos de precisión y correcciones de elevación.
8. `facade_profiles.json`: paleta, ventanas, pilares, techos y rasgos visuales por bloque.

## Estrategia de captura manual

Cuando una fuente pública no tenga suficiente detalle, la forma más eficiente de cerrar el último 20% es una campaña de campo:

- recorridos GPS alrededor de cada bloque;
- fotografía/video de cuatro fachadas;
- una referencia de escala conocida por edificio;
- fotos de señalética y mobiliario;
- tracks de senderos;
- registro de antenas/torres visibles desde áreas de acceso público;
- fotografías de tipos de vegetación, no de cada individuo.

El objetivo no es fotogrametría masiva de todo ESPOL. Primero se corrigen **landmarks y siluetas**, porque son los elementos que más influyen en que una persona reconozca inmediatamente el campus.

## Principio de procedencia

Cada capa futura debe marcar su procedencia:

- `measured`: levantamiento/cota/dato institucional verificable;
- `open_map`: OSM/OpenFreeMap;
- `research`: publicación/tesis ESPOL;
- `field`: captura propia;
- `procedural`: generación visual inferida.

Así el juego puede mejorar sin confundir una aproximación artística con un dato topográfico real.
