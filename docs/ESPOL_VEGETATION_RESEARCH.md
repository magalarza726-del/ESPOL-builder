# ESPOL Builder v0.5 — investigación y modelo de vegetación

Esta versión trata la vegetación como parte central de la identidad del Campus Gustavo Galindo. La meta es representar **el carácter del Bosque y Vegetación Protector Prosperina (BVPP)** sin convertir un sitio estático de GitHub Pages en una escena con millones de polígonos.

La regla de fidelidad es: una especie o tendencia ecológica puede incorporarse si está documentada; la coordenada de un individuo sólo se considera real si existe un inventario georreferenciado que la respalde. Las plantas generadas por el juego son, por tanto, una **reconstrucción procedural calibrada**, no un censo árbol por árbol.

## 1. Fuentes principales

### Composición florística y estructura del BVPP — ESPOL, 2024 / publicado 2025

Mayra Alexandra Adriano Macas, proyecto integrador FCV.

Fuente: https://dspace.espol.edu.ec/handle/123456789/65962

Aportes usados en v0.5:

- El BVPP se describe como **bosque semideciduo**.
- Se estudiaron parcelas permanentes en zona baja, media y alta.
- El muestreo incluyó árboles, arbustos y herbáceas.
- Se identificaron 16 familias botánicas; Fabaceae, Rubiaceae y Bixaceae fueron particularmente abundantes/frecuentes.
- La estructura arbórea está concentrada en clases juveniles de **DAP 5–15 cm**, consistente con sucesión y recuperación después de disturbios.
- El muestreo reciente registró 245 individuos arbóreos en 3000 m², 9 arbustos en 300 m² y 24 individuos/herbáceas registrados en 6 m² de subparcelas; estos tamaños de muestreo son diferentes y por eso el juego no compara directamente sus densidades.
- En la parcela alta se describió un ambiente más húmedo asociado a la Quebrada de los Monos, con presencia observada de helechos, Cactaceae y una orquídea presumiblemente del género `Epidendrum`.

Las especies arbóreas dominantes publicadas por parcela alimentan la selección ponderada del generador.

**Parcela baja:** `Handroanthus chrysanthus`, `Cochlospermum vitifolium`, `Machaerium millei`, `Gliricidia brenningii`, `Centrolobium ochroxylum`.

**Parcela media:** `Machaerium millei`, `Cochlospermum vitifolium`, `Gliricidia brenningii`, `Simira ecuadorensis`, `Gliricidia sepium`.

**Parcela alta:** `Ficus insipida`, `Simira ecuadorensis`, `Sorocea sprucei`, `Eugenia concava`, `Neea divaricata`, entre otras.

### Monitoreo de herbáceas, trepadoras y epífitas — ESPOL, 2010

Rubio y Vásquez.

Fuente: https://www.dspace.espol.edu.ec/handle/123456789/10919

Aunque es una fuente más antigua, es especialmente valiosa porque estudió **el componente no arbustivo de la zona alta del propio Bosque Protector Prosperina**, un estrato que normalmente se pierde al modelar un bosque para videojuegos.

Resultados incorporados:

- 32 especies en total: **15 herbáceas, 14 trepadoras y 3 epífitas/parásitas**.
- 24 nativas, 6 endémicas y 2 introducidas.
- La forma de vida dominante fue hemicriptófita (41 %).
- `Panicum maximum`: 14,68 % de cobertura e IVI 9,88 %.
- `Marsdenia ecuadoriensis`: 7,88 % de cobertura e IVI 6,48 %.
- `Panicum maximum` y `Combretum fruticosum`: 5,08 % de frecuencia.

El catálogo de `src/vegetation.js` incorpora, entre otras: `Dicliptera unguiculata`, `Heliconia metallica`, `Lasiacis ligulata`, `Liabum stipulatum`, `Lycoseris trinervis`, `Marsdenia ecuadoriensis`, `Merremia umbellata`, `Passiflora reflexiflora`, `Plumbago scandens`, `Prestonia mollis`, `Prestonia parvifolia`, `Paullinia pinnata`, `Oncidium onustum`, `Oryctanthus florulentus` y `Lockhartia serra`.

### Actualización del plan de manejo del Bosque Protector — ESPOL, 2021

Fuente: https://www.dspace.espol.edu.ec/handle/123456789/56033

Este trabajo es importante para la **forma del paisaje**, no sólo para su lista de especies. Documenta que el área fue históricamente intervenida por tala, pastizales y maizales, y que zonas fueron revegetadas por un programa de reforestación liderado por ESPOL entre 1998 y 2000.

Por eso v0.5 no representa un bosque primario homogéneo: mezcla regeneración juvenil, copas maduras, claros y sectores de aspecto restaurado.

### Sostenibilidad ESPOL

Fuente: https://sostenibilidad.espol.edu.ec/entorno-e-infraestructura

Datos usados:

- campus: 6.587.827 m²;
- vegetación forestal: 5.264.107 m², aproximadamente **80 %**;
- edificaciones: 174.902 m², aproximadamente 3 %;
- vegetación plantada: menos del 10 %.

Esto justifica separar el **BVPP natural/seminatural** del arbolado ornamental del núcleo académico.

### Los Gigantes del Bosque Seco — ESPOL

Fuente institucional: https://www.espol.edu.ec/en/node/9991

El proyecto identificó **121 especies arbóreas, además de algunos arbustos**, cubriendo el entorno de las facultades. La publicación contiene distribución geográfica, morfología, listado taxonómico y rutas botánicas. Para v0.5 se usa como evidencia de que el campus no debe reducirse a cuatro especies icónicas; sin embargo, mientras el dataset georreferenciado completo no esté disponible públicamente, el proyecto no inventa coordenadas exactas a partir del libro.

### Reforestación y vivero Nativo

Fuentes:

- https://www.espol.edu.ec/noticias/reforestacion-inclusiva-en-el-bosque-protector-de-la-espol
- https://www.espol.edu.ec/es/noticias/el-bosque-protector-la-prosperina-fue-escenario-del-primer-siembraton-del-ano
- https://www.espol.edu.ec/es/noticias/en-espol-se-reproducen-especies-de-plantas-nativas-para-guayaquil

Las campañas documentan uso de Ceibo, Laurel, Guayacán, Guachapelí, Cascol, Ébano, Fernán Sánchez, Roble, Laurel negro/blanco y otras especies de bosque seco. El vivero Nativo reproduce especies como Guayacán, Caoba, Laurel y Pechiche para restauración.

## 2. Estratos representados

La escena diferencia cinco hábitos/estratos visuales:

1. **Árboles** — individuos estructurales y copas del bosque.
2. **Arbustos** — masas de 0,8–2,6 m aproximadamente.
3. **Herbáceas** — gramíneas, hierbas de hoja ancha, helechos y cactáceas.
4. **Trepadoras/lianas** — geometría vertical ligera mezclada con el estrato arbóreo y arbustivo.
5. **Epífitas** — pequeñas formas asociadas visualmente a las zonas más húmedas y altas.

No se pretende que la proporción de instancias 3D sea equivalente a una densidad científica por hectárea. Los estudios usaron unidades de muestreo diferentes según hábito. Las proporciones del motor están ajustadas para **lectura visual + rendimiento**.

## 3. Estacionalidad

El bosque seco cambia mucho entre estación seca y lluviosa. El control de estación modifica:

- volumen aparente de copa de árboles deciduos;
- colores planos de copa y sotobosque;
- probabilidad de aparición del estrato herbáceo;
- persistencia de especies más tolerantes a sequía;
- mayor presencia visual de helechos/epífitas en el contexto húmedo de la parcela alta.

No se usan texturas fotográficas para simular hojas. La diferencia se logra con **forma, densidad, escala y color plano**.

## 4. Arquitectura de rendimiento

### A distancia

La vegetación se resume como una masa verde muy barata mediante una capa de densidad. No se dibujan árboles 3D individuales a kilómetros del jugador.

### Cerca del jugador

El motor activa instancias 3D dentro de radios limitados:

- árboles: ~330 m;
- sotobosque: ~135 m;
- límites estrictos por tipo de instancia.

Los límites se reducen automáticamente en equipos con pocos núcleos o poca memoria reportada por el navegador.

### Índice espacial

Las plantas se indexan una sola vez en una cuadrícula de celdas de 150 m. Al desplazarse el jugador se consultan únicamente las celdas vecinas. Esto reemplaza el barrido y ordenamiento de todos los individuos del bosque que realizaban versiones anteriores.

### Materiales planos

El mundo 3D usa `MeshBasicMaterial`:

- sin mapas de textura;
- sin normal maps;
- sin roughness maps;
- sin luces dinámicas;
- sin sombras;
- antialias del renderer 3D desactivado;
- geometría low-poly e instanciada.

La fotografía aérea queda **apagada por defecto**. Puede reactivarse manualmente, pero se considera una capa opcional de mayor coste.

### Repaint

El custom layer ya no fuerza un `triggerRepaint()` permanente. Cuando el personaje y la cámara están quietos, el navegador puede dejar de redibujar la capa 3D de forma innecesaria.

## 5. Qué sigue siendo aproximado

- No existe en las fuentes públicas consultadas un inventario completo con coordenada de cada árbol, arbusto, liana y hierba del campus.
- Las tres parcelas recientes son muestras, no un mapa continuo de comunidades vegetales.
- El inventario no arbustivo de 2010 representa una zona alta de menor actividad antrópica, no todo el campus.
- Los parches de restauración se representan como tendencia estructural; no se dibuja un polígono de reforestación exacto si no hay geometría pública suficiente.

Por eso la fidelidad buscada es **ecológica y perceptual**, no una afirmación de censo botánico individual.
