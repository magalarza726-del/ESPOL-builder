# ESPOL Builder v0.14 — Quality Gates

Esta fase no se considera terminada por número de funciones. Se considera terminada cuando el **vertical slice FIEC + Auditorio** cumple criterios medibles.

## Bloqueadores de release

Cualquiera de estos errores impide considerar una build estable:

- personaje atraviesa el terreno o queda flotando de forma sistemática;
- árbol invisible produce colisión;
- árbol detallado desaparece al entrar en rango sin representación de respaldo;
- Mapa y 3D usan huellas diferentes para el mismo edificio;
- spawn queda dentro de un collider;
- `getElevation()` devuelve valores no finitos dentro del vertical slice;
- Forest System V2 no está instalado o aparece un segundo runtime forestal paralelo;
- caída reproducible/crash durante recorrido normal;
- error JavaScript no controlado durante inicialización.

## FIEC + Auditorio

Antes de expandir la reconstrucción del campus, esta zona debe demostrar:

1. spawn exterior reconocible y caminable;
2. 11A/Auditorio, 11B y 11F capturados en posición coherente;
3. alturas documentadas/vectoriales compartidas Mapa↔3D;
4. caminos principales transitables;
5. vegetación sin huecos de LOD ni colliders invisibles;
6. pendientes transitables sin penetración de pies;
7. 15 minutos continuos de recorrido sin bug grave;
8. 60 FPS como objetivo y 45 FPS como piso saludable en el equipo de referencia;
9. comparación visual desde posiciones repetibles antes/después de cada cambio de fidelidad.

## Reglas arquitectónicas

### Terreno

Una sola fuente física/visual. Ningún subsistema debe consultar una altura alternativa si `terrain-surface-v012.js` está instalado.

### Edificios

Una huella sincronizada alimenta Mapa, render Three.js y colisión. Las fachadas detalladas pueden sustituir sólo la malla visual, no inventar una segunda posición base.

### Bosque

Una sola `ForestDatabase`. Cada árbol derivado tiene identidad estable. Render y física consumen el mismo Tree ID. Los LOD pueden cambiar; la identidad/posición no.

### Modos

Exploración, Terror, RPG y Shooter son harnesses de prueba. Pueden cambiar cámara, iluminación o capacidad del avatar, pero no crear copias de terreno, edificio o bosque.

## Diagnóstico

En ejecución:

```js
window.__ESPOL_FOUNDATION_REPORT__
window.__ESPOL_RUNTIME_ERRORS__
```

`__ESPOL_FOUNDATION_REPORT__` debe tener `ok: true`. `degraded: true` permite arrancar cuando un proveedor externo devuelve datos incompletos, pero esa build no debe usarse como referencia de fidelidad.

## Política de expansión

Orden recomendado después de aprobar FIEC:

1. Rectorado + Biblioteca
2. FIMCP
3. eje central / lago
4. demás facultades
5. periferia técnica/deportiva
6. interiores seleccionados

No ampliar dos zonas nuevas simultáneamente mientras la zona anterior tenga bloqueadores abiertos.
