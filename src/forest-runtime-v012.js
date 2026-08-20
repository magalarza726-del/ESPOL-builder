import * as THREE from 'three';
import { CAMPUS } from './config.js';
import { VEGETATION_PROFILE } from './vegetation.js';

const DEG = Math.PI / 180;
const METERS_LAT = 110574;
const METERS_LNG = 111320 * Math.cos(CAMPUS.spawn.lat * DEG);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hash01(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}
function clusterOffset(p, i) {
  if (i === 0) return { x: 0, z: 0 };
  const id = (+p.id || 1) * 37 + i * 101;
  const angle = hash01(id) * Math.PI * 2;
  const r = Math.sqrt(hash01(id + 17)) * Math.max(2, +p.clusterSpreadM || 8);
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}
function localToLngLat(x, z) {
  return {
    lng: CAMPUS.spawn.lng + x / METERS_LNG,
    lat: CAMPUS.spawn.lat - z / METERS_LAT
  };
}
function queryGrid(index, x, z, r) {
  const out = [], { grid, cell } = index, r2 = r * r;
  const minX = Math.floor((x - r) / cell), maxX = Math.floor((x + r) / cell);
  const minZ = Math.floor((z - r) / cell), maxZ = Math.floor((z + r) / cell);
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cz = minZ; cz <= maxZ; cz++) {
      const bucket = grid.get(`${cx}:${cz}`);
      if (!bucket) continue;
      for (const f of bucket) {
        const p = f.properties, dx = x - p._x, dz = z - p._z;
        const d2 = dx * dx + dz * dz;
        if (d2 <= r2) out.push([d2, f]);
      }
    }
  }
  return out;
}
function treeColor(p, season) {
  const c = new THREE.Color(+p.deciduous === 1
    ? (season > .52 ? 0x477b47 : 0x77784a)
    : (season > .52 ? 0x315e40 : 0x4b6547));
  c.offsetHSL((+p.rand - .5) * .02, 0, (+p.rand - .5) * .05);
  return c;
}
function understoryColor(p, season) {
  const wet = season > .5, c = new THREE.Color();
  if (p.habit === 'shrub') c.set(wet ? 0x4c7146 : 0x6a7045);
  else if (p.habit === 'vine') c.set(wet ? 0x397647 : 0x687243);
  else if (p.habit === 'epiphyte') c.set(wet ? 0x57905a : 0x66794a);
  else if (p.form === 'cactus') c.set(0x60764f);
  else if (p.form === 'fern') c.set(wet ? 0x397747 : 0x5c6d41);
  else c.set(wet ? 0x598b46 : 0x898049);
  return c;
}
function pointSegmentDistanceSq(ax, az, bx, bz, px, pz) {
  const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
  const vv = vx * vx + vz * vz;
  const t = vv > 1e-8 ? clamp((wx * vx + wz * vz) / vv, 0, 1) : 0;
  const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
  return dx * dx + dz * dz;
}
function makeInstanced(geometry, capacity, material) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.userData.capacity = capacity;
  return mesh;
}
function colliderInsert(grid, cell, c) {
  const k = `${Math.floor(c.x / cell)}:${Math.floor(c.z / cell)}`;
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push(c);
}
function candidateColliders(grid, cell, a, b, pad = 1) {
  const minX = Math.floor((Math.min(a.x, b.x) - pad) / cell);
  const maxX = Math.floor((Math.max(a.x, b.x) + pad) / cell);
  const minZ = Math.floor((Math.min(a.z, b.z) - pad) / cell);
  const maxZ = Math.floor((Math.max(a.z, b.z) + pad) / cell);
  const out = [];
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
    const bucket = grid.get(`${x}:${z}`);
    if (bucket) out.push(...bucket);
  }
  return out;
}

export function installForestRuntime(world) {
  if (!world?.veg || world.__forestRuntimeV012) return world;
  world.__forestRuntimeV012 = true;

  // Dynamic InstancedMesh bounds become stale after matrices are rewritten. For
  // this forest the entire mesh may otherwise be culled when the camera moves,
  // which is the main cause of "trees vanish as I approach". The forest already
  // has spatial LOD, so GPU frustum-culling these few instanced draw calls is not
  // useful; keep them always eligible for rendering.
  for (const mesh of [
    world.veg.trunk, world.veg.canopyMass,
    ...Object.values(world.veg.canopies),
    world.veg.shrub, world.veg.herb, world.veg.vine, world.veg.epiphyte
  ]) if (mesh) mesh.frustumCulled = false;

  const farCapacity = Math.max(1200, (world.capacity?.mass || 1400) * 2);
  const farTrunkMaterial = new THREE.MeshBasicMaterial({ color: 0x5e4636, toneMapped: false });
  const farTrunk = makeInstanced(new THREE.CylinderGeometry(1, 1, 1, 4), farCapacity, farTrunkMaterial);
  farTrunk.name = 'forest-far-trunks';
  world.scene.add(farTrunk);
  world.veg.farTrunk = farTrunk;
  world.materials?.vegetation?.push?.({ m: farTrunkMaterial, base: farTrunkMaterial.color.clone() });

  world.base.treeRadiusM = 64;
  world.base.understoryRadiusM = Math.max(72, Number(world.base.understoryRadiusM) || 72);
  world.base.canopyMassRadiusM = Math.max(900, Number(world.base.canopyMassRadiusM) || 900);
  world.base.refreshMoveM = 3.0;
  world.base.refreshMs = 150;

  world.activeTreeColliders = [];
  world.activeTreeColliderGrid = new Map();
  world.treeColliderCellM = 18;

  world.clearVegetation = function() {
    this.veg.canopyMass.count = this.veg.trunk.count = this.veg.farTrunk.count = 0;
    for (const m of Object.values(this.veg.canopies)) m.count = 0;
    this.veg.shrub.count = this.veg.herb.count = this.veg.vine.count = this.veg.epiphyte.count = 0;
    this.activeTreeColliders.length = 0;
    this.activeTreeColliderGrid.clear();
    this.stats.vegetation = 0;
  };

  world.pathBlockedTree = function(a, b, radius) {
    if (!this.treesEnabled || this.verticalOffset > 2.4) return false;
    const list = candidateColliders(this.activeTreeColliderGrid, this.treeColliderCellM, a, b, radius + .8);
    for (const tree of list) {
      const rr = radius + tree.r;
      if (pointSegmentDistanceSq(a.x, a.z, b.x, b.z, tree.x, tree.z) <= rr * rr) return true;
    }
    return false;
  };

  world.refreshVegetation = function(x, z, now) {
    const moved = Math.hypot(x - this.lastVX, z - this.lastVZ);
    const refreshMs = (this.base.refreshMs || 150) / Math.max(.65, this.dynamicFactor);
    const refreshMove = this.base.refreshMoveM || 3;
    if (!this.forceRefresh && now - this.lastRefresh < refreshMs && moved < refreshMove) return;

    this.forceRefresh = false;
    this.lastRefresh = now;
    this.lastVX = x;
    this.lastVZ = z;
    if (!this.treesEnabled) {
      this.clearVegetation();
      return;
    }

    const detailR = (this.base.treeRadiusM || 64) * (.88 + .12 * this.dynamicFactor);
    const blendStartR = detailR * .68;
    const underR = (this.base.understoryRadiusM || 72) * (.82 + .18 * this.dynamicFactor);
    const massR = (this.base.canopyMassRadiusM || 900) * (.88 + .12 * this.dynamicFactor);
    const rows = queryGrid(this.index, x, z, massR);

    const budget = {
      tree: Math.max(720, Math.floor(this.capacity.trees * this.dynamicFactor)),
      mass: Math.max(300, Math.floor(this.capacity.mass * this.dynamicFactor)),
      farTrunk: Math.max(500, Math.floor(this.veg.farTrunk.userData.capacity * this.dynamicFactor)),
      shrub: Math.floor(this.capacity.shrubs * this.dynamicFactor),
      herb: Math.floor(this.capacity.herbs * this.dynamicFactor),
      vine: Math.floor(this.capacity.vines * this.dynamicFactor),
      epiphyte: Math.floor(this.capacity.epiphytes * this.dynamicFactor)
    };

    const detail2 = detailR * detailR, blend2 = blendStartR * blendStartR, under2 = underR * underR;
    const detail = [], far = [], under = { shrub: [], herb: [], vine: [], epiphyte: [] };
    for (const row of rows) {
      const [d2, f] = row;
      const habit = f.properties.habit || 'tree';
      if (habit === 'tree') {
        if (d2 <= detail2) detail.push(row);
        else far.push(row);
      } else if (d2 <= under2 && under[habit]) under[habit].push(row);
    }
    detail.sort((a, b) => a[0] - b[0]);

    this.activeTreeColliders.length = 0;
    this.activeTreeColliderGrid.clear();

    let ti = 0;
    const ci = { round: 0, umbrella: 0, open: 0, ceibo: 0 };
    const transitionMass = [];
    const renderMax = VEGETATION_PROFILE.cluster.renderMax || 66;

    for (const [d2, f] of detail) {
      const p = f.properties;
      const copies = Math.max(1, Math.min(+p.clusterSize || 1, renderMax));
      let rendered = 0;
      for (let j = 0; j < copies && ti < budget.tree; j++) {
        const off = clusterOffset(p, j);
        const jitter = .78 + hash01((+p.id || 1) * 71 + j * 13) * .46;
        const h = Math.max(2.5, (+p.height || 7) * jitter);
        const can = Math.max(1, (+p.canopyM || 2.4) * (.82 + hash01(j + (+p.id || 1) * 9) * .36));
        const tr = Math.max(.035, (+p.trunkRadiusM || .08) * (.72 + hash01(j * 5 + (+p.id || 1)) * .55));
        const tx = p._x + off.x, tz = p._z + off.z;
        const ll = localToLngLat(tx, tz);
        const baseY = this.getElevation(ll.lng, ll.lat) - this.originElev;

        this.instance(this.veg.trunk, ti, tx, baseY + h * .34, tz, tr, h * .68, tr, null);
        const form = this.veg.canopies[p.form] ? p.form : 'round';
        const canopy = this.veg.canopies[form], idx = ci[form]++;
        const loss = this.season < .5 && +p.deciduous === 1 ? .66 + this.season * .38 : 1;
        let sx = can, sy = can * .85, sz = can;
        if (form === 'umbrella') { sx *= 1.2; sy *= .5; sz *= 1.2; }
        else if (form === 'open') { sx *= .88; sy *= .72; sz *= .88; }
        else if (form === 'ceibo') { sx *= 1.08; sy *= .72; sz *= 1.08; }
        this.instance(canopy, idx, tx, baseY + h * .74, tz, sx * loss, sy * loss, sz * loss, treeColor(p, this.season));

        const collider = { x: tx, z: tz, r: Math.max(.11, tr) };
        this.activeTreeColliders.push(collider);
        colliderInsert(this.activeTreeColliderGrid, this.treeColliderCellM, collider);
        ti++;
        rendered++;
      }
      // Preserve the medium LOD until the detailed representation is fully
      // allocated. The outer 32% of the detail disk deliberately overlaps both
      // LODs, so crossing the threshold cannot create a visible hole.
      if (rendered < copies || d2 >= blend2) transitionMass.push([d2, f]);
    }

    this.veg.trunk.count = ti;
    this.veg.trunk.instanceMatrix.needsUpdate = true;
    for (const [key, mesh] of Object.entries(this.veg.canopies)) {
      mesh.count = ci[key];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    let massN = 0, farN = 0;
    const addMass = ([, f], priorityScale = 1) => {
      if (massN >= budget.mass) return;
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const y = this.getElevation(lng, lat) - this.originElev;
      const h = Math.max(4, +p.height || 7), can = Math.max(2, +p.canopyM || 3);
      const cluster = Math.max(5, +p.clusterSize || 10);
      const scale = can * (1.32 + Math.min(2.45, Math.sqrt(cluster) * .28)) * priorityScale;
      this.instance(this.veg.canopyMass, massN++, p._x, y + h * .68, p._z,
        scale, scale * .48, scale, treeColor(p, this.season));

      const reps = cluster >= 34 ? 2 : 1;
      for (let j = 0; j < reps && farN < budget.farTrunk; j++) {
        const off = clusterOffset(p, j * 3);
        const tx = p._x + off.x, tz = p._z + off.z;
        const ll = localToLngLat(tx, tz);
        const ty = this.getElevation(ll.lng, ll.lat) - this.originElev;
        const th = h * (.72 + hash01((+p.id || 1) * 17 + j) * .18);
        const radius = Math.max(.055, (+p.trunkRadiusM || .08) * 1.15);
        this.instance(this.veg.farTrunk, farN++, tx, ty + th * .33, tz, radius, th * .66, radius, null);
      }
    };

    // Near overflow and transition anchors are always represented before distant
    // forest, preventing the exact invisible-tree bug reported in v0.11.
    transitionMass.sort((a, b) => a[0] - b[0]);
    for (const row of transitionMass) addMass(row, .92);
    for (const row of far) {
      if (massN >= budget.mass) break;
      addMass(row, 1);
    }

    this.veg.canopyMass.count = massN;
    this.veg.canopyMass.instanceMatrix.needsUpdate = true;
    if (this.veg.canopyMass.instanceColor) this.veg.canopyMass.instanceColor.needsUpdate = true;
    this.veg.farTrunk.count = farN;
    this.veg.farTrunk.instanceMatrix.needsUpdate = true;

    const fill = (list, mesh, habit) => {
      let n = 0;
      const cap = Math.min(mesh.userData.capacity, budget[habit]);
      for (const [, f] of list) {
        const p = f.properties;
        const vis = +p.seasonalDry === 1
          ? 1 - .55 * this.season
          : clamp((+p.dryPersistence || .45) + (1 - (+p.dryPersistence || .45)) * this.season, 0, 1);
        if ((+p.rand || .5) > vis) continue;
        const s = Math.max(.22, +p.scale || .6);
        const copies = Math.min(+p.density || 1, habit === 'herb' ? 7 : habit === 'shrub' ? 4 : 3);
        for (let j = 0; j < copies && n < cap; j++) {
          const angle = (+p.rand || .5) * 6.283 + j * 2.1;
          const spread = habit === 'herb' ? 1.15 : .65;
          const xx = p._x + Math.cos(angle) * spread * j * .42;
          const zz = p._z + Math.sin(angle) * spread * j * .42;
          const ll = localToLngLat(xx, zz);
          const y = this.getElevation(ll.lng, ll.lat) - this.originElev;
          let sx = s, sy = s, sz = s;
          if (habit === 'herb') {
            if (p.form === 'grass') { sx = .22 * s; sy = 1.45 * s; sz = .22 * s; }
            else if (p.form === 'fern') { sx = 1.15 * s; sy = .72 * s; sz = 1.15 * s; }
            else if (p.form === 'cactus') { sx = .35 * s; sy = 1.25 * s; sz = .35 * s; }
            else { sx = .65 * s; sy = .88 * s; sz = .65 * s; }
          } else if (habit === 'vine') { sx = .22 * s; sy = 2.1 * s; sz = .22 * s; }
          else if (habit === 'epiphyte') { sx = .4 * s; sy = .28 * s; sz = .4 * s; }
          else { sx = 1.05 * s; sy = .82 * s; sz = 1.05 * s; }
          this.instance(mesh, n++, xx, y + (habit === 'epiphyte' ? .8 : 0), zz,
            sx, sy, sz, understoryColor(p, this.season));
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return n;
    };

    const shrubs = fill(under.shrub, this.veg.shrub, 'shrub');
    const herbs = fill(under.herb, this.veg.herb, 'herb');
    const vines = fill(under.vine, this.veg.vine, 'vine');
    const epiphytes = fill(under.epiphyte, this.veg.epiphyte, 'epiphyte');
    this.stats.vegetation = ti + Object.values(ci).reduce((a, b) => a + b, 0) + massN + farN + shrubs + herbs + vines + epiphytes;
    this.stats.treeColliders = this.activeTreeColliders.length;
  };

  world.forceRefresh = true;
  return world;
}
