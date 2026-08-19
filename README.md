# ESPOL Builder — Campus Gustavo Galindo jugable 1:1

**v0.3.1** — plantilla web de mundo abierto del Campus Gustavo Galindo de ESPOL, pensada como `master map` reutilizable para exploración, terror, RPG o shooter y desplegable como sitio estático en GitHub Pages.

La meta no es afirmar que existe un gemelo digital arquitectónico perfecto. La meta es que el mundo conserve **escala, relieve, estructura del campus, masa forestal e hitos reconocibles**, y que cada mejora esté separada entre dato medido, cartografía pública e inferencia procedural.

## Novedades v0.3.1

- Vista **Mapa** separada de la cámara del jugador: ahora la rueda hace zoom y el arrastre desplaza el mapa sin que el `gameLoop` vuelva a centrarlo cada frame.
- **Tercera persona** con cámara física detrás del jugador.
- **Primera persona** con cámara situada a **1,68 m sobre el terreno**.
- Avatar humano procedural original de ~**1,80 m**, con estética de agente de survival-horror (cabello claro, chaqueta de campo, pantalón cargo y arnés) sin copiar ni redistribuir un modelo de un videojuego comercial.
- Spawn exterior aproximado del **Auditorio FIEC / bloque 11A**.
- Trote base **2,6 m/s = 9,36 km/h**.
- `Shift` multiplica la velocidad exactamente **×2,5**: **6,5 m/s = 23,4 km/h**.
- Foto aérea opcional en 1ª/3ª persona; el modo Mapa conserva la cartografía vectorial actual.
- Árboles 3D con varias siluetas: copa redonda, parasol, abierta y ceibo/gran emergente.
- Reconstrucción forestal calibrada con las **tres parcelas permanentes** del estudio florístico ESPOL 2024/2025, no solo con una lista genérica de especies.
- Catálogo de bloques FIEC/FIMCP/FICT/FADCOM y otros sectores para orientar próximas correcciones arquitectónicas.

## Escala, relieve y movimiento

- Las posiciones usan longitud/latitud reales.
- El movimiento se integra en metros: **1 m del juego ≈ 1 m del mundo real** a escala local.
- El rectángulo de trabajo se tomó del estudio GIS del Campus Gustavo Galindo: aproximadamente **2°07′52″–2°09′25″ S** y **79°56′33″–79°58′57″ W**.
- El estudio GIS analiza unas **696 ha**, clasifica accesos >1,8 m y senderos <1,8 m y documenta cerca de **22,98 km** de rutas combinadas.
- El relieve se obtiene de **Mapzen Terrain Tiles / AWS Open Data** en formato Terrarium. MapLibre lo interpreta en metros y se usa **exageración vertical 1×**.
- Una tesis de ESPOL documenta un plano topográfico institucional de 2016 con **curvas de nivel principales cada 5 m**. El archivo CAD/GIS original no está publicado dentro de este repositorio; si ESPOL lo libera, sería una fuente superior al DEM global.

## Cámaras

### 1 — Mapa

Es la vista cartográfica. No recibe correcciones de cámara desde el bucle del jugador.

- rueda: zoom;
- arrastre: pan;
- clic derecho/gesto equivalente: rotación/inclinación;
- controles `+/-` de MapLibre disponibles;
- escala métrica visible.

### 2 — Tercera persona

La cámara se coloca físicamente aproximadamente **6,5 m detrás** del personaje y a **2,9 m** sobre el terreno, mirando hacia el avatar. El personaje está modelado en metros y no como un icono de tamaño arbitrario.

### 3 — Primera persona

La cámara se coloca sobre la coordenada del jugador a **1,68 m sobre la elevación del terreno** y mira hacia un objetivo espacial situado delante. Esto evita simular primera persona simplemente con mucho `pitch` y `zoom`.

La implementación usa `Map.calculateCameraOptionsFromTo` de MapLibre para calcular una cámara entre dos posiciones/altitudes reales.

## Edificios e infraestructura: investigación incorporada

La huella 3D base sigue procediendo de OpenStreetMap/OpenFreeMap. Cuando una altura existe en los datos se usa; si no, se utiliza `building:levels` y después una altura de respaldo. Esto permite conservar geometrías reales sin inventar planos completos.

La documentación oficial de las facultades sirve para corregir identidad y nomenclatura:

### FIEC

Fuente oficial: https://www.fiec.espol.edu.ec/es/infraestructura

- **11A**: edificio principal; administración, Decanato/Subdecanato, Auditorio FIEC, aulas, oficinas y laboratorios.
- **11B**: soporte técnico, administración, aulas híbridas y laboratorios de computación.
- **11C**: laboratorios de electrónica, telecomunicaciones, potencia, redes, control, IoT y grupos de investigación.
- **11D**: aulas, profesores, asociación de estudiantes, IEEE y clubes.
- **11F**: profesores, clubes y sala de sesiones.

La página de servicios FIEC confirma explícitamente `11A — Auditorio FIEC`.

### FIMCP

Fuente oficial: https://www.fimcp.espol.edu.ec/es/infraestructura

- edificio principal con Decanato, coordinaciones, profesores, postgrado y salas;
- **12I**: Termofluidos en planta baja y Robota/espacios de personal arriba;
- **12E**: LEMAT, soldadura, metalografía y materiales;
- **12G**: microbiología, alimentos, biblioteca, sólidos y operaciones unitarias.

### FICT

Fuente oficial: https://www.fict.espol.edu.ec/archive/es/node/17

- **13A** administración;
- **13B** petrografía, geofísica, fotogeología y topografía;
- **13D** sanitaria, preparación de minerales y mineralogía;
- **13E** geotecnia y construcción;
- **13F** petróleos y fluidos de perforación;
- **13G** asociación, biblioteca y computación;
- **13H** aulas, computación, auditorio y lectura.

### FADCOM

Fuente oficial: https://www.fadcom.espol.edu.ec/es/infraestructura

La facultad documenta **14A, 14B, 14C, 3M y 7B**, además de niveles, auditorios, laboratorios y talleres. `14C` contiene comedor/parqueadero, `3M` talleres y `7B` el Motion Lab.

### Biblioteca Central

La documentación institucional identifica el **Centro de Información Bibliotecaria como edificio 7A, frente a Rectorado**.

## Bosque: de “puntos verdes” a estructura ecológica

ESPOL publica para el campus:

- área total: **6.587.827 m²**;
- vegetación forestal: **5.264.107 m²**, aproximadamente **80 %**;
- edificaciones: **174.902 m²**, aproximadamente **3 %**;
- relación de área abierta >**95 %**;
- vegetación plantada <**10 %**.

Fuente: https://sostenibilidad.espol.edu.ec/entorno-e-infraestructura

Por eso el bosque no se representa como un puñado de árboles ornamentales. En vista Mapa se usa una **masa forestal continua**; cerca del jugador se sustituyen por instancias 3D ligeras.

### Calibración con parcelas reales

El estudio `Composición florística y estructura del Bosque y Vegetación Protectora Prosperina` (ESPOL, proyecto 2024; publicado en DSpace en 2025) levantó tres parcelas permanentes. La tesis publica coordenadas UTM y alturas. Para el prototipo se convirtieron de **UTM 17S / EPSG:32717 a WGS84** y se usaron sus centroides:

| Parcela | Altitud | Centro aproximado WGS84 |
|---|---:|---|
| Baja | 125 m | -2.144970, -79.973587 |
| Media | 179 m | -2.147758, -79.973897 |
| Alta | 226 m | -2.150609, -79.978402 |

Fuente: https://www.dspace.espol.edu.ec/handle/123456789/65962

El trabajo registró **245 individuos arbóreos, 25 especies y 11 familias** en 3000 m² de parcelas arbóreas y concluyó que Fabaceae, Rubiaceae y Bixaceae son especialmente abundantes/frecuentes. También encontró concentración de individuos juveniles en **DAP 5–15 cm**.

El generador usa esas observaciones para que ~64 % de los individuos tengan estructura juvenil y mezcla especies por proximidad a las parcelas. Es una **interpolación visual**, no una afirmación científica de que la composición sea idéntica entre parcelas.

#### Parcela baja — principales IVI

- `Handroanthus chrysanthus` — 34,72 %
- `Cochlospermum vitifolium` — 31,93 %
- `Machaerium millei` — 14,07 %
- `Gliricidia brenningii` — 7,88 %
- `Centrolobium ochroxylum` — 6,67 %

#### Parcela media — principales IVI

- `Machaerium millei` — 43,88 %
- `Cochlospermum vitifolium` — 17,22 %
- `Gliricidia brenningii` — 9,99 %
- `Simira ecuadorensis` — 9,90 %
- `Gliricidia sepium` — 6,25 %

#### Parcela alta — principales IVI

- `Ficus insipida` — 32,29 %
- `Simira ecuadorensis` — 16,68 %
- `Sorocea sprucei` — 12,01 %
- `Eugenia concava` — 9,45 %
- `Neea divaricata` — 8,12 %

### Especies e identidad del bosque seco

ESPOL caracteriza el BVPP como **bosque semideciduo de tierras bajas**. También documenta Guayacán, Balsa, Ceibo y Palo Santo como especies características del campus.

`Los Gigantes del Bosque Seco` identificó **121 especies arbóreas** (más algunos arbustos) en recorridos que cubren el entorno de las facultades y publicó información de distribución/morfología y rutas botánicas.

Fuente: https://www.espol.edu.ec/en/node/9991

Las campañas de restauración del Sendero Mirador han utilizado Ceibo, Laurel, Guayacán, Guachapelí, Cascol, Ébano, Fernán Sánchez, Roble y otras especies. El vivero `Nativo` de ESPOL reproduce Guayacán, Caoba, Laurel y Pechiche, entre otras.

Fuentes:

- https://www.espol.edu.ec/es/noticias/reforestacion-inclusiva-en-el-bosque-protector-de-la-espol
- https://www.espol.edu.ec/es/noticias/el-bosque-protector-la-prosperina-fue-escenario-del-primer-siembraton-del-ano
- https://www.espol.edu.ec/es/noticias/en-espol-se-reproducen-especies-de-plantas-nativas-para-guayaquil

## Senderos del BVPP

La documentación institucional y académica confirma, entre otros, los senderos **Mirador**, **Huella Ecológica** y la ruta de avistamiento **Gavilán Dorsigrís**. La versión actual no dibuja recorridos inventados si no dispone de su geometría GIS pública exacta; se conservan los caminos existentes en la cartografía abierta.

Fuente: https://www.dspace.espol.edu.ec/handle/123456789/53740

## Foto aérea

En primera/tercera persona se puede activar una capa `World_Imagery` para que suelo, claros, cubiertas y masa vegetal se lean con mayor fidelidad que un mapa vectorial. Se mantiene apagada en la vista **Mapa** para conservar el aspecto cartográfico solicitado.

La capa se solicita al servicio World Imagery de Esri. La documentación de Esri describe el producto como una compilación mundial de fotografía aérea y satelital y exige atribución a sus proveedores.

Attribution: **Esri, Maxar, Earthstar Geographics y GIS User Community**.

## Controles

- `W / S`: avanzar / retroceder
- `A / D`: desplazamiento lateral
- `Q / E` o flechas izquierda/derecha: girar
- `Shift` mantenido: sprint ×2,5
- `R`: reaparecer fuera del Auditorio FIEC
- `1`: Mapa
- `2`: Tercera persona
- `3`: Primera persona
- En Mapa: rueda + arrastre + controles de navegación
- En primera persona: arrastre horizontal para mirar; rueda para variar ligeramente la dirección vertical de la mirada

## Arquitectura web

- **MapLibre GL JS 5.24** — mapa, terreno, capas vectoriales y cámaras.
- **Three.js 0.169** — avatar humano y vegetación 3D cercana mediante `InstancedMesh`.
- **OpenFreeMap / OpenStreetMap** — cartografía y huellas de edificios.
- **Mapzen/AWS Terrarium** — elevación.
- **World Imagery** — fotografía aérea opcional.
- Sitio completamente estático: no necesita backend para ejecutarse en GitHub Pages.

## Qué es fiel y qué todavía no

### Alto grado de fidelidad

- coordenadas y escala horizontal;
- elevación del DEM sin exageración vertical;
- ubicación general de carreteras, edificios y muchos POI derivados de OSM;
- estructura de áreas forestales vs. núcleo urbano;
- especies y composición forestal ancladas a investigación ESPOL;
- bloques/funciones de facultades documentados institucionalmente.

### Aproximado / procedural

- spawn respecto a la **puerta exacta** del Auditorio FIEC;
- altura de edificios sin `height`/`building:levels` público;
- fachadas/ventanas/materiales de cada edificio;
- coordenada de cada árbol individual;
- interpolación de composición entre las tres parcelas florísticas.

### Próximo salto de fidelidad

Para alcanzar un verdadero **~80 % perceptual** hace falta una capa manual de corrección:

1. capturar fotos/vídeo 360 o recorridos alrededor de los edificios icónicos;
2. medir/verificar accesos y alturas clave de FIEC, Rectorado, CIB, FIMCP, FADCOM, FICT y zonas deportivas;
3. exportar correcciones a GeoJSON/JSON;
4. incorporar mobiliario reconocible: postes, luminarias, señalética, paradas, antenas, cercas, canchas y estacionamientos;
5. georreferenciar Sendero Mirador/Huella/Gavilán con tracks GPS si la geometría pública no es suficiente.

Ese trabajo debería hacerse en un **Editor ESPOL** dentro del navegador, no modificando código a mano.

## GitHub Pages

El repositorio incluye `.github/workflows/pages.yml`. Con **Settings → Pages → Source → GitHub Actions**, cada `push` a `main` vuelve a desplegar el sitio.

## Licencias y atribuciones

- Código propio: ver `LICENSE`.
- OpenStreetMap: © OpenStreetMap contributors.
- OpenFreeMap: consultar sus términos/atribución.
- Terrain Tiles: Mapzen/AWS Open Data y fuentes indicadas por el dataset.
- World Imagery: © Esri y proveedores indicados en la atribución del servicio.
- Las publicaciones de ESPOL se usan como **fuentes de investigación/referencia**; el repositorio no redistribuye sus imágenes, planos o PDFs.
