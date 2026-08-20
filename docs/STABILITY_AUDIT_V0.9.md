# ESPOL Builder — Auditoría de estabilidad v0.9

Fecha: 2026-08-20

Esta versión congela temporalmente la expansión de funcionalidades y prioriza estabilidad, legibilidad y reducción de regresiones.

## Problemas corregidos

- **Dos fuentes de verdad para los modos de juego.** `app.js` y `gameplay.js` modificaban por separado clases, textos y velocidad. Ahora `modes.js` contiene la configuración canónica y `runtime.js` la aplica.
- **Movimiento invisible en Mapa.** El bucle seguía procesando WASD aunque MapLibre estuviera activo. El movimiento se detiene y se limpia al entrar al mapa.
- **Teclas pegadas al cambiar de ventana/vista.** Se limpia el estado de movimiento en `blur`, `visibilitychange` y al cambiar de cámara.
- **Salto/linterna activados desde controles HTML o desde Mapa.** Se bloquea la propagación de teclas de gameplay en esos contextos.
- **HUD de sprint inconsistente.** Se eliminó el MutationObserver que corregía a posteriori el texto; HUD y velocidad usan la misma configuración de modo.
- **Listeners `idle` acumulados durante el barrido GIS.** El listener se elimina tanto al recibir `idle` como al vencer el timeout.
- **Tramos de carretera duplicados en sentido inverso.** La deduplicación considera A→B y B→A.
- **Heatmap forestal calibrado para grupos antiguos de 22 fustes.** Ahora usa el máximo vigente del perfil de vegetación.
- **Código 3D legado duplicado.** Se eliminó `player3d.js`, que pertenecía a la arquitectura MapLibre+Three anterior y ya no era utilizado por el runtime híbrido.
- **Versión y mensajes de carga desfasados.** La aplicación anuncia v0.9.0 y ya no muestra mensajes heredados de v0.7.
- **Errores silenciosos de inicialización.** La pantalla de carga conserva el error visible y registra el detalle en consola.
- **Fuentes/capas duplicadas.** La inicialización utiliza funciones seguras que comprueban existencia antes de añadir fuentes o capas.
- **HTML dinámico innecesario.** Paneles de referencia y popups utilizan nodos/textContent para reducir fallos de marcado e inyección accidental.

## Refactor realizado

- `src/runtime.js`: orquestación de mapa, mundo, input, UI, carga y bucle principal.
- `src/modes.js`: configuración única de Exploración/Terror/RPG/Shooter.
- `src/core.js`: matemáticas y utilidades puras reutilizables/testeables.
- `src/app.js`: shim mínimo para compatibilidad con cachés antiguas de GitHub Pages.
- `src/gameplay.js`: fachada de compatibilidad sin estado ni listeners duplicados.
- `tests/smoke.mjs`: invariantes básicas del campus, modos, geometría métrica, vegetación y estructura del build.

GitHub Pages ejecuta ahora `npm run verify` antes del despliegue: primero comprueba sintaxis y luego ejecuta smoke tests.

## Riesgos/limitaciones conocidas (no esconder)

1. **Colisiones de edificios:** el mundo 3D utiliza cajas AABB derivadas de bounds. Un edificio rotado, curvo o con patios puede tener una colisión demasiado grande o pequeña. La solución correcta es exportar polígonos/OBB simplificados por edificio.
2. **Colisiones de árboles:** corresponden a troncos procedurales, no a posiciones censadas reales. La física y la fidelidad espacial sólo podrán converger cuando exista un dataset de vegetación georreferenciado o una campaña de captura.
3. **Edificios de OpenFreeMap/OSM:** las huellas y alturas dependen de la cobertura del proveedor. Los edificios prioritarios deben migrar gradualmente a assets/versiones propias verificadas.
4. **Pruebas de navegador:** los smoke tests detectan regresiones de datos y sintaxis, pero no sustituyen pruebas E2E WebGL/MapLibre en Chrome/Firefox/Android.
5. **Servicios externos:** mapa, DEM e imágenes dependen de CDNs/tiles externos. Para una versión archivística/reproducible conviene hornear los datos permitidos y servir sólo el subconjunto ESPOL.
6. **Densidad ×6:** es densidad efectiva/procedural, no evidencia de que ESPOL tenga seis veces una densidad medida. Debe entenderse como parámetro artístico sujeto a recalibración con parcelas/fotos de validación.
7. **Profiler de vegetación:** es una métrica de elementos visuales/LOD, no un conteo botánico de individuos reales.

## Criterio para siguientes versiones

No añadir una nueva mecánica si rompe alguna de estas pruebas manuales mínimas:

1. Cargar desde cero y llegar al mundo 3D sin error.
2. Caminar 5 minutos alrededor de FIEC sin bloqueo de movimiento.
3. Cambiar Mapa ↔ 3ª ↔ 1ª persona repetidamente sin conservar teclas pegadas.
4. Cambiar los cuatro modos y comprobar sus controles exclusivos.
5. Chocar contra edificio y árbol sin atravesarlos ni quedar atrapado permanentemente.
6. Entrar/salir de pestaña y recuperar el juego sin salto de posición.
7. Mantener rendimiento estable con auto-LOD durante una ruta bosque ↔ núcleo académico.

La siguiente fase recomendada es un **vertical slice FIEC/Auditorio** con geometría, colisiones y vegetación verificadas visualmente antes de seguir ampliando el campus.
