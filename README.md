# ESPOL Builder — Campus Gustavo Galindo jugable 1:1

**v0.5.0 · Vegetation / Flat LOD** — plantilla web de mundo abierto del Campus Gustavo Galindo de ESPOL, diseñada como `master map` reutilizable para exploración, terror, RPG o shooter y para funcionar como sitio estático en GitHub Pages.

La meta no es afirmar que existe un gemelo digital arquitectónico o botánico perfecto. La meta es conservar **escala, relieve, estructura del campus, masa forestal, estratos vegetales e hitos reconocibles**, separando siempre dato medido, cartografía pública e inferencia procedural.

## v0.5 — enfoque en fluidez y vegetación

Esta versión rehace el sistema visual con prioridad en rendimiento:

- materiales 3D **planos** (`MeshBasicMaterial`), sin mapas de textura, normal maps, roughness maps, luces dinámicas ni sombras;
- edificios con un material plano y sin gradiente vertical;
- sombreado del terreno reducido;
- foto aérea **apagada por defecto** y disponible sólo como opción;
- antialias del renderer 3D desactivado;
- interfaz sin `backdrop-filter`, blur, gradientes pesados ni grandes sombras;
- geometrías low-poly;
- `InstancedMesh` para árboles y sotobosque;
- LOD por distancia;
- límites de instancias adaptados a `hardwareConcurrency` y `deviceMemory` cuando el navegador los expone;
- índice espacial en celdas de 150 m para evitar recorrer todo el bosque en cada actualización;
- actualización de vegetación espaciada en tiempo y distancia;
- el custom layer deja de forzar `triggerRepaint()` cuando la escena está quieta.

## Vegetación ESPOL

El sistema ya no representa el bosque únicamente como árboles. Distingue cinco hábitos visuales:

1. árboles;
2. arbustos;
3. herbáceas;
4. trepadoras/lianas;
5. epífitas.

A distancia, el BVPP se resume como **masa vegetal**. Cerca del jugador se materializan instancias 3D planas dentro de radios limitados. Así se conserva la sensación de densidad sin dibujar miles de plantas completas al mismo tiempo.

La investigación completa está documentada en [`docs/ESPOL_VEGETATION_RESEARCH.md`](docs/ESPOL_VEGETATION_RESEARCH.md).

### Fuentes ecológicas principales

**Composición florística y estructura del Bosque y Vegetación Protectora Prosperina — ESPOL, proyecto 2024 / publicado 2025**  
https://dspace.espol.edu.ec/handle/123456789/65962

- bosque semideciduo;
- parcelas permanentes baja, media y alta;
- árboles, arbustos y herbáceas;
- Fabaceae, Rubiaceae y Bixaceae especialmente abundantes/frecuentes;
- predominio de árboles juveniles en DAP 5–15 cm;
- especies dominantes diferentes según altitud;
- parcela alta con contexto más húmedo y registros de helechos, Cactaceae y una orquídea presumiblemente `Epidendrum`.

**Monitoreo de herbáceas, trepadoras y epífitas de la zona alta — ESPOL, 2010**  
https://www.dspace.espol.edu.ec/handle/123456789/10919

- 32 especies no arbustivas;
- 15 herbáceas;
- 14 trepadoras;
- 3 epífitas/parásitas;
- `Panicum maximum` e `Marsdenia ecuadoriensis` entre las especies de mayor importancia ecológica del estudio.

**Actualización del plan de manejo del Bosque Protector La Prosperina — ESPOL, 2021**  
https://www.dspace.espol.edu.ec/handle/123456789/56033

Documenta la historia de intervención del área y revegetación/reforestación. Por eso el juego evita representar el BVPP como un bosque primario homogéneo y mezcla regeneración juvenil, árboles maduros y zonas de aspecto restaurado.

**Sostenibilidad ESPOL**  
https://sostenibilidad.espol.edu.ec/entorno-e-infraestructura

- campus: 6.587.827 m²;
- vegetación forestal: 5.264.107 m² (~80 %);
- edificaciones: 174.902 m² (~3 %);
- vegetación plantada: <10 %.

**Los Gigantes del Bosque Seco**  
https://www.espol.edu.ec/en/node/9991

ESPOL reporta 121 especies de árboles, además de algunos arbustos, identificadas en el entorno de las facultades. El libro incluye distribución, morfología, listado taxonómico y rutas botánicas. Mientras el dataset georreferenciado completo no esté disponible públicamente, el juego usa esa fuente para diversidad e identidad, no para inventar coordenadas individuales.

## Escala, relieve y movimiento

- longitud/latitud reales;
- **1 m del juego ≈ 1 m real** a escala local;
- relieve mediante Mapzen/AWS Terrarium, exageración vertical 1×;
- mundo visual y navegación limitados al área ESPOL usada por el estudio GIS;
- spawn exterior aproximado del Auditorio FIEC;
- avatar ~1,80 m y cámara de primera persona a ~1,68 m;
- velocidad base actual: **7,8 m/s ≈ 28,1 km/h**;
- `Shift`: ×2,5, hasta **19,5 m/s ≈ 70,2 km/h**;
- aceleración, frenado, giro y dirección suavizados;
- integración por subpasos para evitar saltos cuando cae el FPS.

## Cámaras

- `1` — **Mapa ESPOL**: zoom con rueda, pan con arrastre y navegación confinada al campus.
- `2` — **Tercera persona**: cámara física detrás del avatar.
- `3` — **Primera persona**: cámara a altura de ojos sobre el DEM.

## Edificios e infraestructura

Las huellas 3D proceden de OpenStreetMap/OpenFreeMap. Cuando hay alturas o niveles públicos se usan; cuando faltan, se aplica una altura de respaldo. La identidad de sectores y bloques se contrasta con documentación institucional de FIEC, FIMCP, FICT, FADCOM y otros sectores.

Las fachadas exactas, materiales arquitectónicos, mobiliario, antenas y accesos siguen siendo una fase de modelado posterior. En v0.5 se prioriza deliberadamente **vegetación + rendimiento**.

## Cómo funciona el LOD vegetal

El generador produce una base procedural reproducible de aproximadamente:

- 3.600 árboles;
- 1.800 parches de sotobosque.

Eso **no significa que sólo existan 5.400 plantas en ESPOL**. Son muestras visuales de una comunidad muchísimo mayor.

En 3D sólo se materializa una fracción cercana:

- árboles: radio aproximado 330 m, con un máximo adaptativo;
- sotobosque: radio aproximado 135 m;
- límites separados para arbustos, hierbas, lianas y epífitas.

Los equipos modestos reciben automáticamente un presupuesto de instancias menor.

## Estacionalidad

El slider seco ↔ lluvioso modifica:

- volumen aparente de copas deciduas;
- color plano del follaje;
- presencia visual del estrato herbáceo;
- persistencia de especies tolerantes a sequía;
- mayor peso visual de vegetación húmeda en el contexto de la parcela alta.

No se usan texturas fotográficas de hojas. La identidad se construye con forma, escala, densidad, color y estratificación.

## Fidelidad: qué es real y qué es procedural

### Alta fidelidad de base

- escala y coordenadas;
- DEM sin exageración;
- estructura general de campus/bosque;
- muchas huellas de edificios y vías;
- composición vegetal anclada a estudios ESPOL;
- separación bosque natural/seminatural vs. vegetación plantada del núcleo;
- diversidad de hábitos vegetales.

### Procedural / aproximado

- posición de cada árbol o planta individual;
- interpolación entre parcelas;
- geometría exacta de cada especie;
- localización exacta de todos los parches históricos de restauración;
- fachadas y detalles arquitectónicos no disponibles como datos abiertos.

## Arquitectura

- MapLibre GL JS 5.24 — mapa, terreno, capas y cámaras;
- Three.js 0.169 — avatar y vegetación cercana mediante instancias;
- OpenFreeMap / OpenStreetMap — cartografía;
- Mapzen/AWS Terrarium — elevación;
- World Imagery — capa aérea opcional, apagada por defecto;
- sitio estático, sin backend.

## GitHub Pages

El repositorio contiene `.github/workflows/pages.yml`. Con **Settings → Pages → Source → GitHub Actions**, cada actualización de `main` puede desplegarse automáticamente.

## Licencias y atribuciones

- código propio: ver `LICENSE`;
- OpenStreetMap: © OpenStreetMap contributors;
- OpenFreeMap: según sus términos de atribución;
- Terrain Tiles: Mapzen/AWS Open Data y fuentes del dataset;
- World Imagery: © Esri y proveedores indicados por el servicio;
- las publicaciones de ESPOL se usan como fuentes de investigación; este repositorio no redistribuye sus PDFs, libros ni fotografías.
