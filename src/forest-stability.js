// ESPOL Builder v0.11 — stable forest LOD transition.
// With the ×6 ecological density, the previous 125 m detailed-tree radius could
// contain more stems than the fixed InstancedMesh budget. Anchors entering the
// detailed band were then removed from canopy-mass LOD before their detailed
// instances could be allocated, producing the apparent "trees disappear when I
// approach them" bug.

export function stabilizeForestLOD(world) {
  if (!world?.base) return;

  // Keep the detailed disk small enough that all nearby stems fit in the fixed
  // instance budget even in dense La Prosperina clusters. Medium-distance canopy
  // mass remains visible immediately outside this disk.
  world.base.treeRadiusM = Math.min(Number(world.base.treeRadiusM) || 125, 52);
  world.base.understoryRadiusM = Math.min(Number(world.base.understoryRadiusM) || 92, 68);
  world.base.canopyMassRadiusM = Math.max(Number(world.base.canopyMassRadiusM) || 700, 780);

  // Refresh before the player can outrun the LOD boundary. This is cheap because
  // the spatial grid limits the candidate set.
  world.base.refreshMoveM = Math.min(Number(world.base.refreshMoveM) || 22, 7.5);
  world.base.refreshMs = Math.min(Number(world.base.refreshMs) || 680, 240);

  world.forceRefresh = true;
}
