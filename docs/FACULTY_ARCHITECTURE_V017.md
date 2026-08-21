# ESPOL Builder v0.17 — Faculty Architecture + Interiors

## Objetivo

Restaurar FIMCP y evitar que una captura GIS incompleta haga desaparecer edificios. La capa 3D de edificios combina una jerarquía explícita de evidencia:

1. Huella Polygon/MultiPolygon capturada desde OpenFreeMap/MapLibre.
2. Volumen del escaneo runtime si la huella exacta no fue capturada.
3. Sólo para FIMCP, puntos de control espacial de alta confianza para Auditorio 12H, 18A, Comedor y 24C cuando faltan ambos anteriores.
4. Fotografías: apariencia, distribución local y vocabulario interior; nunca coordenadas globales.

## Levantamiento FIMCP

Se conservan las 100 vistas del levantamiento en `fimcp-photo-survey.js`. Las fotos 01–12 y 93–100 aportan detalle de mayor resolución; el PDF conserva la continuidad 13–92. El recorrido documenta Auditorio, parqueadero, bloques/laboratorios, corredores, patio, servicios y borde de transporte.

## Vocabulario interior ESPOL

Las referencias fotográficas de aulas entregadas para v0.17 se traducen a geometría ligera:

- Aula convencional: piso cerámico claro, pared inferior crema, pared superior verde agua, cielo raso modular, luminarias, A/C, pizarra y filas de pupitres/sillas azules.
- Aula colaborativa: paredes claras, varias pizarras, proyector de techo, mesas redondas/ovaladas de madera y sillas grises.

No se empaquetan las fotografías como texturas de runtime.

## Usos documentados por facultad

### FIEC
Fuente oficial: https://www.fiec.espol.edu.ec/es/infraestructura

11A combina administración, auditorio, aulas, oficinas y laboratorios. 11B aloja laboratorios de computación; 11C concentra laboratorios eléctricos/electrónicos, telecomunicaciones, IoT, potencia y control.

### FIMCP
Fuentes oficiales:
- https://www.fimcp.espol.edu.ec/es/infraestructura
- https://www.fimcp.espol.edu.ec/en/infraestructure

El edificio principal contiene Decanato/Subdecanato, coordinaciones, secretarías y oficinas. 12I/18A se asocia a termofluidos/robótica/mecatrónica; 12E/18C a LEMAT, soldadura, materiales y metalografía; 12G/18B a alimentos, microbiología y sólidos; 24C/24E a aulas y computación.

### FICT
Fuente oficial: https://www.fict.espol.edu.ec/archive/es/node/17

13A administración; 13B petrografía/geofísica/fotogeología/topografía; 13D sanitaria/minerales; 13E geotecnia; 13F petróleos/fluidos de perforación; 13G biblioteca/computación; 13H aulas, computación, auditorio y lectura.

### FADCOM
Fuente oficial: https://www.fadcom.espol.edu.ec/es/infraestructura

14A/14B combinan administración, aulas, fotografía, laboratorios informáticos, sonido, audiovisual y talleres creativos. 14C es comedor/parqueadero; 3M agrupa talleres de carpintería/modelado/pintura/cerámica/corte; 7B contiene Motion Lab.

### FCNM
Fuentes oficiales:
- https://www.fcnm.espol.edu.ec/es/centros-y-laboratorios
- https://www.fcnm.espol.edu.ec/es/area-de-sistemas

9H/9G y 8K concentran laboratorios de química, procesos, física y operaciones unitarias; 9C/9I alojan laboratorios de computación.

### FCSH
Fuentes oficiales:
- https://www.fcsh.espol.edu.ec/es/noticias/la-facultad-fortalece-su-infraestructura-tecnologica-con-nuevos-laboratorios-para
- https://www.fcsh.espol.edu.ec/es/vida-estudiantil

El edificio 8H contiene laboratorios informáticos recientes. El hall 8A se documenta como espacio amplio de estudio; los laboratorios también funcionan como aulas.

### FCV
Fuente oficial: https://www.fcv.espol.edu.ec/es/infraestructura

La infraestructura combina administración, aulas y laboratorios de fitosanidad, biotransformación, zoología, ecotoxicología, suelos, biotecnología, microbiología, nutrición, ecología acuática y computación.

### FIMCM
Fuente oficial: https://www.fimcm.espol.edu.ec/archive/en/facilities

Incluye edificio de gobierno, oficinas de docentes, edificio de aulas 60A, biblioteca/IT y laboratorios de planctonología, oceanografía, ingeniería naval, biología, calidad de agua y otras ciencias marinas.

## Colisiones

- Edificio genérico: collider poligonal sólido.
- Edificio de facultad detallado: collider por segmentos de pared.
- La puerta principal se divide en dos segmentos y el hueco central queda libre.
- Particiones interiores repiten el mismo criterio y dejan un hueco de paso.
- Mesones pesados pueden usar AABB simples.
- El jetpack continúa ignorando colisión de edificio cuando la altura vertical supera el edificio.

## Limitaciones declaradas

- Un interior es tipológico hasta disponer de planos o levantamiento interior específico del bloque.
- Un bloque sin `name/ref` suficiente puede permanecer genérico aunque físicamente pertenezca a una facultad.
- No se inventan coordenadas de facultades faltantes a partir de un croquis ilustrativo.
- Las fachadas procedurales buscan reconocimiento y continuidad, no sustituyen un modelo BIM.
