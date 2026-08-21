# ESPOL Builder v0.16 — FIMCP Spatial Control + Día/Noche

## Objetivo
Corregir la distorsión espacial observada en la reconstrucción fotográfica v0.15 y reducir las cuatro modalidades públicas a dos.

## Control espacial FIMCP
La secuencia fotográfica conserva valor como evidencia visual, pero ya no determina posiciones absolutas. v0.16 usa una red de control GIS/OSM para el parqueadero FIEC/FIMCP, Auditorio FIMCP, Bloque 18-A, Comedor FIMCP, Bloque 24C, Terminal y Postgrado.

Reglas:
- una huella debe estar dentro del núcleo FIMCP;
- un edificio identificado por punto de control sólo acepta una huella cercana;
- LEMAT/24E no se posicionan por orden de foto si no existe identificación espacial suficiente;
- no se vuelve a inferir un patio global desde un rectángulo amplio de huellas;
- tests de distancia bloquean regresiones del orden de ~20x.

## Modalidades
- Día: Shift x5 + jetpack con Espacio.
- Noche: iluminación nocturna + linterna con F + pistola con clic.

Los dos modos reutilizan los controladores internos que ya estaban estabilizados; no duplican física ni mundo.
