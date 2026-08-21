# ESPOL Builder — Campus Gustavo Galindo jugable 1:1

**v0.17.0 · CAMPUS ARCHITECTURE · INTERIORES**

ESPOL Builder es un **master world web de ESPOL**. La prioridad es que terreno, edificios, bosque y colisiones sean estables y espacialmente coherentes antes de ampliar gameplay.

## v0.17: edificios resilientes

v0.16 hizo demasiado estricta la dependencia de la captura vectorial y podía dejar desaparecer FIMCP cuando algunas huellas no llegaban al registro. v0.17 cambia la regla:

**huella GIS exacta → primera prioridad**  
**volumen del escaneo runtime → respaldo cuando falta GIS**  
**punto de control FIMCP → último respaldo sólo para edificios con coordenada conocida**

Nunca se usa el orden de una foto para inventar una posición global.

`src/campus-architecture-v017.js` reconstruye una sola capa 3D y sustituye el collider sólido de los edificios detallados por paredes segmentadas con huecos de puerta transitables. Los edificios genéricos conservan colisión poligonal sólida.

## Ocho facultades

`src/faculty-registry-v017.js` reconoce por nombre/ref/bloque:

- FIEC — 11A/11B/11C/11D/11F.
- FIMCP — 12E/12G/12H/12I, 18A/18B/18C, 24C/24E.
- FICT — 13A/13B/13D/13E/13F/13G/13H.
- FADCOM — 14A/14B/14C, 3M, 7B.
- FCNM — 9C/9G/9H/9I, 8K.
- FCSH — 8A/8H, 32B/32C cuando el GIS los identifica.
- FCV — edificios identificados por FCV y nomenclaturas publicadas.
- FIMCM — edificio de aulas 60A y edificios identificados como FIMCM.

Las huellas siguen viniendo del GIS. La nomenclatura sólo clasifica el uso y la apariencia.

## Interiores

Los bloques de facultad identificados pueden recibir un interior representativo de planta baja con:

- puertas realmente abiertas en geometría y colisión;
- ventanas repetidas por nivel;
- piso, cielo raso, particiones interiores y pasillos;
- pizarra, proyector, aire acondicionado;
- aula convencional con pupitres/sillas;
- aula colaborativa con mesas y sillas;
- laboratorios con mesones según el tipo de facultad;
- oficinas/aulas mixtas mediante el mismo vocabulario ESPOL.

Los interiores son **reconstrucciones tipológicas**, no planos arquitectónicos certificados. Las fotografías del levantamiento FIMCP y las referencias fotográficas de aulas ESPOL gobiernan materiales, proporciones y mobiliario; no se usan como texturas pesadas.

## Dos modalidades

- **Día:** Shift ×5 + jetpack manteniendo Espacio.
- **Noche:** linterna con F + pistola con clic izquierdo.

## Arquitectura

```text
MapLibre / GIS
      │
      ├── huellas exactas capturadas
      │
Runtime scan ── fallback de volumen
      │
FIMCP control ─ fallback espacial acotado
      │
      ▼
Campus Architecture v0.17
      ├── shells genéricos exactos
      ├── fachadas de facultad
      ├── puertas/ventanas
      ├── interiores representativos
      └── colisión pared/puerta
      │
      ▼
Three.js master world
```

El entrypoint público enruta `./src/game3d.js` hacia `src/game3d_v017.js`.

## Fuentes de infraestructura

La clasificación de usos se apoya principalmente en páginas oficiales de ESPOL/FIEC/FIMCP/FICT/FADCOM/FCNM/FCSH/FCV/FIMCM. Véase `docs/FACULTY_ARCHITECTURE_V017.md`.

## Validación

Antes de desplegar Pages se ejecuta:

```bash
npm run verify
```

Los tests bloquean regresiones de escala FIMCP, pérdida del sistema forestal/terreno compartido, vuelta a cuatro modos, pérdida del registro de ocho facultades y desaparición completa de FIMCP.

## Regla de desarrollo

No crear un mundo paralelo para corregir otro. Una mejora debe consumir el terreno, edificios y bosque vigentes. Cuando falta información espacial, es preferible un fallback explícito y marcado a una posición inventada.
