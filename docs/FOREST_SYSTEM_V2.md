# Forest System V2 — ESPOL Builder v0.13

## Motivo

Las versiones anteriores mezclaban en `refreshVegetation()` tres responsabilidades diferentes: ecología, render y física. Con densidad ×6, LOD adaptativo y movimiento rápido esto produjo árboles que desaparecían, colliders invisibles y transiciones inconsistentes.

## Arquitectura

Forest V2 separa esas responsabilidades:

1. **Datos ecológicos**: `forest.js`, `vegetation.js` y las anclas procedurales investigadas siguen determinando especies, tamaño de grupos y sotobosque.
2. **Base forestal determinista**: `forest-system-v2.js` agrupa las anclas en chunks de 64×64 m. Cada individuo derivado obtiene un ID, posición, altura, radio de tronco, tamaño de copa y forma estables.
3. **Render**: la distancia selecciona una representación del mismo individuo/del mismo grupo, no genera un árbol nuevo.
4. **Física**: únicamente los Tree ID que realmente tienen tronco detallado visible cerca del jugador producen collider.

## Chunks

Los árboles se derivan de forma determinista por chunk. Los chunks cercanos se guardan en una caché LRU. Si un chunk se elimina de memoria y se vuelve a visitar, se reconstruye con los mismos IDs y coordenadas.

Tamaño: **64 m × 64 m**.

## LOD e histéresis

- Entrada a detalle: ~60 m.
- Salida de detalle: ~78 m.
- La diferencia funciona como histéresis para impedir que el árbol cambie de LOD repetidamente en el límite.
- Desde ~52 m existe solapamiento entre detalle y masa forestal.
- Una masa sólo desaparece por completo cuando todos los árboles de ese grupo que deberían representarse en detalle han sido asignados al presupuesto de instancias.
- Si el presupuesto de detalle se llena, la masa continúa visible: nunca se crea un hueco intencional.

## Colisiones

`activeTreeColliderGrid` se reconstruye exclusivamente desde árboles detallados que fueron renderizados en esa actualización. Por diseño:

- árbol invisible lejano → sin collider;
- árbol detallado visible → collider de tronco;
- masa de dosel → sin collider;
- sotobosque → sin collider duro.

La física de edificios permanece separada.

## Terreno

Forest V2 se instala después de `installTerrainSurface()`. Por ello las alturas de árboles y personaje provienen de la misma superficie triangular que se dibuja, no de una segunda interpolación independiente del DEM.

## Rendimiento

Se conserva `InstancedMesh` para troncos, copas, masas, arbustos, herbáceas, lianas y epífitas. El `frustumCulled` de los meshes dinámicos se mantiene desactivado porque sus matrices cambian y el LOD espacial ya limita la carga visible.

La calidad dinámica puede reducir presupuestos de render, pero **no cambia la identidad ni la posición de los árboles**.

## Regla para futuras versiones

No crear otro generador forestal en paralelo. Cualquier mejora visual, ecológica o física debe consumir el mismo `ForestDatabase` o ampliar su esquema. El objetivo es conservar una sola fuente de verdad para cada árbol.