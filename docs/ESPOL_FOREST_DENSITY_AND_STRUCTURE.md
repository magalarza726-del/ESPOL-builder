# ESPOL Builder v0.7 — densidad, estructura y distribución de vegetación

Esta nota documenta las decisiones de la versión v0.7. El objetivo no es inventar un censo árbol-por-árbol, sino traducir a una escena jugable la **estructura ecológica que sí está publicada para el Bosque y Vegetación Protectora Prosperina (BVPP)**.

## Principio de modelado

- Las coordenadas de las plantas generadas son procedurales y reproducibles.
- Los estudios de ESPOL calibran densidad, clases diamétricas, composición por altitud, hábitos vegetales y carácter estacional.
- Un punto del GeoJSON no necesariamente representa un solo árbol: en v0.7 puede ser un **ancla de grupo**. El motor materializa varios fustes cerca del jugador y usa masas de dosel a media distancia.
- Esto permite representar un bosque visualmente cerrado sin cargar cientos de miles de mallas simultáneas.

## 1. Cobertura del campus

La página institucional de sostenibilidad de ESPOL reporta:

- área total del campus: 6.587.827 m²;
- vegetación forestal: 5.264.107 m², aproximadamente 80 %;
- edificaciones: 174.902 m², aproximadamente 3 %;
- vegetación plantada: menos del 10 %.

Fuente: https://sostenibilidad.espol.edu.ec/entorno-e-infraestructura

Consecuencia para el juego: el núcleo académico debe leerse como un claro dentro de una matriz verde mucho mayor. Por eso v0.7 reduce el antiguo sesgo que concentraba casi todo el bosque únicamente al oeste y mantiene una corona forestal más continua alrededor de las zonas edificadas.

## 2. Parcelas permanentes 2024/2025

La tesis de Mayra Adriano Macas estudió tres parcelas permanentes de 1.000 m² cada una, en zonas baja, media y alta, registrando árboles con DAP ≥ 5 cm.

Fuente: https://www.dspace.espol.edu.ec/handle/123456789/65962

En el conjunto se reportaron 245 árboles en 3.000 m². Como referencia estructural, eso equivale a aproximadamente **817 fustes/ha** para el umbral medido. No se extrapola literalmente a cada hectárea del campus: las parcelas son muestras, no un censo total.

El trabajo también reporta una concentración muy fuerte de individuos en las primeras clases diamétricas, de 5 a 15 cm de DAP. La interpretación del estudio es de sucesión ecológica y recuperación tras perturbaciones. v0.7 usa una fracción juvenil de 0,73 en la generación procedural para que el bosque no parezca compuesto sólo por árboles maduros espaciados.

### Parcela baja — 125 m

Especies de mayor IVI utilizadas por el generador:

- Handroanthus chrysanthus
- Cochlospermum vitifolium
- Machaerium millei
- Gliricidia brenningii
- Centrolobium ochroxylum
- Pseudalbizzia multiflora
- Randia armata
- Morisonia flexuosa

La parcela baja reporta 99 individuos en 1.000 m², equivalente a ~990 fustes/ha dentro de esa muestra.

### Parcela media — 179 m

- Machaerium millei
- Cochlospermum vitifolium
- Gliricidia brenningii
- Simira ecuadorensis
- Gliricidia sepium
- Handroanthus chrysanthus
- Pseudalbizzia multiflora
- Guazuma ulmifolia
- Eriotheca ruizii
- Randia armata
- Sapindus saponaria
- Morisonia flexuosa

La parcela media reporta 91 individuos en 1.000 m², ~910 fustes/ha dentro de esa muestra.

### Parcela alta — 226 m

El estudio muestra mayor diversidad y una composición distinta. El catálogo v0.7 incorpora:

- Ficus insipida
- Simira ecuadorensis
- Sorocea sprucei
- Eugenia concava
- Neea divaricata
- Cynometra bauhiniifolia
- Myrcia splendens
- Guarea glabra
- Trichilia elegans
- Triplaris cumingiana
- Bauhinia aculeata
- Gustavia angustifolia
- Pseudobombax millei

La zona alta también está asociada en el estudio a condiciones más húmedas alrededor de una quebrada estacional, por lo que el generador incrementa localmente helechos, epífitas y especies asociadas a humedad.

## 3. Sotobosque: no todo son árboles

El trabajo de Rubio y Vásquez sobre la zona alta del Bosque Protector Prosperina registró 32 especies no arbustivas:

- 15 herbáceas;
- 14 trepadoras;
- 3 epífitas/parásitas;
- 24 nativas, 6 endémicas y 2 introducidas.

Entre las especies con mayor importancia/cobertura aparecen Panicum maximum y Marsdenia ecuadoriensis.

Fuente: https://www.dspace.espol.edu.ec/handle/123456789/10919

Por eso el motor mantiene estratos independientes de herbáceas, arbustos, trepadoras y epífitas, con radio LOD menor que el estrato arbóreo.

## 4. Diversidad alrededor de las facultades

ESPOL publicó que el proyecto/libro **Los Gigantes del Bosque Seco** identificó 121 especies de árboles, además de algunos arbustos, cubriendo el área alrededor de las facultades y definiendo rutas botánicas.

Fuente: https://www.espol.edu.ec/en/node/9991

Esto es importante para el núcleo académico: no se trata de un espacio completamente desprovisto de árboles. v0.7 conserva arbolado de campus con grupos mucho más pequeños que los del BVPP, evitando bloquear plazas, vías y edificios.

## 5. Reforestación y carácter secundario/restaurado

La vegetación de La Prosperina no se modela como un bosque primario uniforme. La literatura institucional y los proyectos de manejo describen recuperación de áreas perturbadas y múltiples campañas de reforestación.

Por ejemplo, en 2019 ESPOL reportó cerca de 200 árboles de 10 variedades plantados en la zona alta del Sendero Mirador, incluyendo Ceibo, Laurel, Guayacán, Guachapelí, Cascol, Ébano y Fernán Sánchez.

Fuente: https://www.espol.edu.ec/es/noticias/reforestacion-inclusiva-en-el-bosque-protector-de-la-espol

Consecuencia visual: el generador admite parches de regeneración, árboles jóvenes abundantes, emergentes maduros, claros y sectores restaurados, en vez de una separación regular tipo plantación.

## 6. Estrategia de rendimiento v0.7

### Cerca del jugador

Se materializan grupos completos de fustes con tronco y copa. El presupuesto máximo de alta calidad es de ~1.600 árboles cercanos, además de sotobosque.

### Media distancia

Los grupos se sustituyen por masas de dosel instanciadas. Una sola forma representa visualmente un grupo de copas, evitando multiplicar geometría y draw calls.

### Lejos

El terreno y la masa cromática del paisaje dan continuidad. En Mapa GIS se usa un heatmap ponderado por tamaño de grupo.

### Adaptación automática

Si baja el rendimiento, el sistema reduce el presupuesto y la resolución interna antes de alterar la escala física del campus.

## 7. Colisiones

- Edificios: cajas AABB insertadas en una cuadrícula espacial.
- Árboles: colisión circular con los troncos de los grupos cercanos.
- Jugador: radio aproximado de 0,38 m.
- Resolución: primero se prueba el movimiento completo; si colisiona, se intenta deslizar por cada eje antes de detener al jugador.

La colisión no recorre todos los objetos del campus: consulta sólo celdas vecinas.

## 8. Edificios v0.7

La v0.6 podía perder edificios porque hacía una sola consulta a las entidades vectoriales después de encuadrar todo ESPOL. v0.7 realiza un barrido temporal del núcleo del campus a zoom alto, espera que cada sector cargue, deduplica las huellas y luego congela esa infraestructura en Three.js.

Además hay volúmenes de respaldo para hitos principales —FIEC, FIMCP, Biblioteca, Rectorado, terminal, coliseo y postgrado— para evitar que un fallo de streaming deje vacío el mundo jugable.

Las huellas recuperadas son cartográficas; el motor 3D actual simplifica cada edificio a un volumen optimizado. La mejora futura de fachadas debe mantener esta huella/colisión y sustituir sólo la representación visual.
