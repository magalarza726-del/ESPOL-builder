# FIMCP Photo Reconstruction - v0.15

## Objetivo

Convertir el levantamiento secuencial `2026-08-20_ESPOL/FIMCP/FIMCP_01.jpg` ... `FIMCP_100.jpg` en restricciones reproducibles del master world de ESPOL.

No se publican los JPG dentro de GitHub Pages. La reconstrucción combina:

1. huellas Polygon/MultiPolygon capturadas del mismo GIS que usa Mapa;
2. niveles/alturas vectoriales y documentación ESPOL cuando existen;
3. las 100 fotos para fachada, materialidad, conexiones, paisaje y vocabulario de circulación.

## Integridad del ZIP recibido

- 100 nombres de fotografías están presentes en el directorio central del ZIP.
- `FIMCP_01-12` y `FIMCP_93-100` son recuperables a 4096x3072: 20 originales.
- las entradas locales de `FIMCP_13-92` están dañadas/ausentes en el ZIP recibido;
- el PDF incorporado conserva las 100 vistas en orden, pero las vistas 13-92 están rasterizadas como referencias de aproximadamente 128x64 px.
- no existe GPS EXIF en los originales recuperables.

Por eso v0.15 distingue **fidelidad geométrica GIS** de **fidelidad visual fotográfica**. No inventa posiciones centimétricas para elementos cuya posición sólo puede deducirse por continuidad visual.

## Recorrido inferido y evidencia usada

| Fotos | Segmento | Restricciones incorporadas |
|---|---|---|
| 01-03 | Frente Auditorio FIMCP | portal azul, letrero, escalera ancha, vidrio oscuro, pavers, accesibilidad |
| 04-05 | Lateral Auditorio | árbol maduro, seto, tuberías, bahía técnica, acera |
| 06-09 | Estacionamiento frontal | bahías, postes dobles, cubierta azul larga, arbolado |
| 10-11 | LEMAT | paleta crema/azul, ventanal industrial, rótulo, marca molecular, apron de servicio |
| 12-18 | Callejón técnico A | separaciones estrechas, ventanas enrejadas, drenaje, equipo exterior, barandas amarillas |
| 19-24 | Circulación académica A | bloques de dos niveles, escalera/rampa exterior, franja ocre, placas azules, corredores |
| 25-27 | Salida a estacionamiento | paso estrecho, marcas de borde, transición a área abierta |
| 28-33 | Jardín/borde parking | árboles, pavers, bins, pequeños bloques azul/blanco |
| 34-36 | Parking de servicio | camión, patios vehiculares, edificios técnicos bajos |
| 37-42 | Borde seco | hojarasca, cubiertas azules, sendero exterior, cercado, vegetación |
| 43-54 | Núcleo de corredores | pasajes cubiertos, pisos, ventanas continuas, puertas, escaleras, cruces |
| 55-65 | Patio central | jardín, árboles/palmas, setos, bordes elevados, escaleras y corredores |
| 66-75 | Parking grande/hall | cubierta azul, luminarias, hall gris/ocre, carga, maceteros |
| 76-81 | Patio industrial | edificio utilitario blanco, tubería/equipo naranja, gabinete verde, pavers |
| 82-92 | Cinturón perimetral | parking, árboles, suelo seco, bordillo amarillo, acceso y carretera |
| 93 | Estación GBP | plano institucional usado como ancla topológica del final del recorrido |
| 94-100 | Avenida exterior | avenida ancha, árboles grandes, palmas, señal de transporte/QR, espera, postes y bus amarillo |

## Implementación

`src/fimcp-photo-survey.js`
- conserva cobertura 01-100 sin huecos;
- describe confianza y rasgos observados por segmento;
- define la paleta fotográfica y límites amplios del slice FIMCP.

`src/fimcp-detail-v015.js`
- nunca reemplaza la huella GIS;
- decora edificios sincronizados de FIMCP;
- identifica Auditorio por el landmark existente;
- intenta identificar LEMAT por `LEMAT/12E` y usa un heurístico espacial sólo como respaldo;
- añade escalera/portal/letrero del Auditorio, tratamiento LEMAT, bandas/ventanas de bloques, estacionamiento/cubierta, patio, zona técnica y vocabulario del borde de transporte;
- no crea colliders decorativos paralelos: las colisiones principales siguen ligadas a la geometría GIS sincronizada.

`src/game3d_v014.js`
- continúa siendo el compositor endurecido que carga la base v0.13;
- instala la reconstrucción FIMCP después de `setStructures`, cuando ya existen huellas y carreteras reales;
- ejecuta después el foundation audit.

## Regla para futuras capturas

Si se repite el recorrido, conservar:

- numeración secuencial;
- GPS EXIF activado;
- orientación/brújula si la app puede almacenarla;
- fotos solapadas del mismo volumen desde varios ángulos;
- una fotografía de referencia/cartel al cambiar de sector.

Con GPS, la misma arquitectura puede sustituir las inferencias relativas por puntos de cámara verificables sin reescribir el renderer.
