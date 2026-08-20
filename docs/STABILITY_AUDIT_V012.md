# ESPOL Builder v0.12 — Stability refactor

## Bugs addressed

### 1. Trees disappeared when approaching
The previous forest used dynamic `InstancedMesh` objects with frustum culling enabled, but their instance transforms changed continuously without rebuilding reliable world bounds. In addition, an anchor entering the detailed LOD band was removed from the canopy-mass LOD before all of its detailed stems were guaranteed to fit in the instance budget.

v0.12 fixes both causes:
- dynamic vegetation meshes use spatial LOD and no longer rely on stale mesh-level frustum bounds;
- the outer part of the detailed disk overlaps with canopy-mass LOD;
- anchors that cannot allocate all detailed stems retain a medium-LOD fallback;
- nearby anchors are prioritized by distance.

### 2. Invisible tree collisions
Previously tree collision was reconstructed independently from procedural cluster data, so a stem could collide even if its render instance was omitted by LOD/budget.

v0.12 rebuilds a small collision grid from the detailed trunks that were actually rendered. A procedural tree that is not visible as a detailed trunk cannot create a close-range trunk collider.

### 3. Distant forest had crowns but no trunks
The canopy-mass LOD now has an additional low-poly representative-trunk instanced layer. Large clusters receive up to two representative trunks at medium/far distance while detailed trunks are still reserved for the near field.

### 4. Character intersected the visible terrain
The visual terrain is a coarse piecewise-planar triangle surface while the player previously sampled the underlying DEM independently. On slopes those two surfaces can differ enough for the feet to appear underground.

v0.12 derives a sampler directly from the vertices and triangle split used by the visible terrain chunks. After world creation, player height, buildings, roads and vegetation all query this same surface.

## Rectorado 6A
v0.12 retains the synchronized GIS footprint and expands the procedural landmark layer based on the supplied photographic references and public ESPOL information. Added/refined elements include:
- mullions and horizontal divisions across the tall glazed public facade;
- multi-panel entrance doors and entrance landing;
- upper office ribbon;
- sloped clerestory/skylight cap;
- front pedestrian apron, curved drive representation and curbs;
- denser flower planting detail;
- monument steps and additional turtle-shell detail;
- communications mast bracing;
- side-office window divisions and parapet.

The model remains procedural/low-poly for GitHub Pages performance. It should be treated as a high-recognition game asset, not an architectural survey or photogrammetric reconstruction.
