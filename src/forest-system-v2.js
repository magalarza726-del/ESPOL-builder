import * as THREE from 'three';
import { CAMPUS } from './config.js';
import { VEGETATION_PROFILE } from './vegetation.js';

const DEG = Math.PI / 180;
const METERS_LAT = 110574;
const METERS_LNG = 111320 * Math.cos(CAMPUS.spawn.lat * DEG);
const CHUNK_M = 64;
const DETAIL_IN_M = 60;
const DETAIL_OUT_M = 78;
const MASS_IN_M = 52;
const MASS_OUT_M = 900;
const UNDERSTORY_M = 78;
const CACHE_LIMIT = 96;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hash01(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}
function localToLngLat(x, z) {
  return {
    lng: CAMPUS.spawn.lng + x / METERS_LNG,
    lat: CAMPUS.spawn.lat - z / METERS_LAT
  };
}
function chunkCoord(v) { return Math.floor(v / CHUNK_M); }
function chunkKey(cx, cz) { return `${cx}:${cz}`; }
function clusterOffset(p, i) {
  if (i === 0) return { x: 0, z: 0 };
  const id = (+p.id || 1) * 37 + i * 101;
  const angle = hash01(id) * Math.PI * 2;
  const r = Math.sqrt(hash01(id + 17)) * Math.max(2, +p.clusterSpreadM || 8);
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
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
function colliderInsert(grid, cell, collider) {
  const key = `${Math.floor(collider.x / cell)}:${Math.floor(collider.z / cell)}`;
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(collider);
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
function uniqueForestFeatures(index) {
  const seen = new Set(), out = [];
  for (const bucket of index?.grid?.values?.() || []) {
    for (const feature of bucket) {
      if (seen.has(feature)) continue;
      seen.add(feature);
      out.push(feature);
    }
  }
  return out;
}
function addFeature(map, feature) {
  const p = feature.properties || {};
  const key = chunkKey(chunkCoord(p._x), chunkCoord(p._z));
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(feature);
}
function keysInRadius(x, z, radius) {
  const keys = [];
  const minX = chunkCoord(x - radius), maxX = chunkCoord(x + radius);
  const minZ = chunkCoord(z - radius), maxZ = chunkCoord(z + radius);
  for (let cx = minX; cx <= maxX; cx++) for (let cz = minZ; cz <= maxZ; cz++) {
    keys.push(chunkKey(cx, cz));
  }
  return keys;
}

class ForestDatabase {
  constructor(world) {
    this.world = world;
    this.anchorChunks = new Map();
    this.underChunks = new Map();
    this.treeCache = new Map();
    this.cacheClock = 0;
    for (const feature of uniqueForestFeatures(world.index)) {
      const habit = feature.properties?.habit || 'tree';
      addFeature(habit === 'tree' ? this.anchorChunks : this.underChunks, feature);
    }
  }

  anchorsAround(x, z, radius) {
    const out = [];
    const r2 = radius * radius;
    for (const key of keysInRadius(x, z, radius + CHUNK_M)) {
      for (const f of this.anchorChunks.get(key) || []) {
        const p = f.properties, dx = p._x - x, dz = p._z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 <= r2) out.push([d2, f]);
      }
    }
    return out;
  }

  understoryAround(x, z, radius) {
    const out = [];
    const r2 = radius * radius;
    for (const key of keysInRadius(x, z, radius + CHUNK_M)) {
      for (const f of this.underChunks.get(key) || []) {
        const p = f.properties, dx = p._x - x, dz = p._z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 <= r2) out.push([d2, f]);
      }
    }
    return out;
  }

  treeChunk(key) {
    let cached = this.treeCache.get(key);
    if (cached) {
      cached.used = ++this.cacheClock;
      return cached.trees;
    }
    const trees = [];
    for (const f of this.anchorChunks.get(key) || []) {
      const p = f.properties || {};
      const copies = Math.max(1, Math.min(+p.clusterSize || 1, VEGETATION_PROFILE.cluster.renderMax || 66));
      for (let j = 0; j < copies; j++) {
        const off = clusterOffset(p, j);
        const jitter = .78 + hash01((+p.id || 1) * 71 + j * 13) * .46;
        trees.push({
          id: `${p.id ?? 'a'}:${j}`,
          x: p._x + off.x,
          z: p._z + off.z,
          height: Math.max(2.5, (+p.height || 7) * jitter),
          canopy: Math.max(1, (+p.canopyM || 2.4) * (.82 + hash01(j + (+p.id || 1) * 9) * .36)),
          trunk: Math.max(.035, (+p.trunkRadiusM || .08) * (.72 + hash01(j * 5 + (+p.id || 1)) * .55)),
          form: p.form || 'round',
          props: p,
          y: null
        });
      }
    }
    this.treeCache.set(key, { trees, used: ++this.cacheClock });
    this.prune();
    return trees;
  }

  detailedTreesAround(x, z, radius) {
    const out = [];
    const r2 = radius * radius;
    for (const key of keysInRadius(x, z, radius + CHUNK_M)) {
      for (const tree of this.treeChunk(key)) {
        const dx = tree.x - x, dz = tree.z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 <= r2) out.push([d2, tree]);
      }
    }
    return out;
  }

  surfaceY(tree) {
    if (Number.isFinite(tree.y)) return tree.y;
    const ll = localToLngLat(tree.x, tree.z);
    tree.y = this.world.getElevation(ll.lng, ll.lat) - this.world.originElev;
    return tree.y;
  }

  prune() {
    if (this.treeCache.size <= CACHE_LIMIT) return;
    const victims = [...this.treeCache.entries()]
      .sort((a, b) => a[1].used - b[1].used)
      .slice(0, this.treeCache.size - CACHE_LIMIT);
    for (const [key] of victims) this.treeCache.delete(key);
  }
}

export function installForestSystemV2(world) {
  if (!world?.veg || world.__forestSystemV2) return world;
  world.__forestSystemV2 = true;

  const db = new ForestDatabase(world);
  world.forestDatabase = db;

  for (const mesh of [
    world.veg.trunk, world.veg.canopyMass,
    ...Object.values(world.veg.canopies),
    world.veg.shrub, world.veg.herb, world.veg.vine, world.veg.epiphyte
  ]) if (mesh) mesh.frustumCulled = false;

  const massCapacity = Math.max(2600, (world.capacity?.mass || 1400) * 2);
  const farTrunkCapacity = Math.max(3000, massCapacity);
  const massMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const farTrunkMaterial = new THREE.MeshBasicMaterial({ color: 0x5e4636, toneMapped: false });
  const farMass = makeInstanced(new THREE.IcosahedronGeometry(.5, 0), massCapacity, massMaterial);
  const farTrunk = makeInstanced(new THREE.CylinderGeometry(1, 1, 1, 4), farTrunkCapacity, farTrunkMaterial);
  farMass.name = 'forest-v2-mass';
  farTrunk.name = 'forest-v2-trunks';
  world.scene.add(farMass, farTrunk);
  world.veg.canopyMass.count = 0;
  world.veg.farMassV2 = farMass;
  world.veg.farTrunkV2 = farTrunk;
  world.materials?.vegetation?.push?.(
    { m: massMaterial, base: massMaterial.color.clone() },
    { m: farTrunkMaterial, base: farTrunkMaterial.color.clone() }
  );

  world.activeTreeColliders = [];
  world.activeTreeColliderGrid = new Map();
  world.treeColliderCellM = 18;
  world.forestDetailIds = new Set();
  world.forestLastChunk = '';
  world.forestLastX = NaN;
  world.forestLastZ = NaN;
  world.forestLastRefresh = 0;

  world.clearVegetation = function() {
    this.veg.trunk.count = 0;
    for (const m of Object.values(this.veg.canopies)) m.count = 0;
    this.veg.canopyMass.count = 0;
    this.veg.farMassV2.count = 0;
    this.veg.farTrunkV2.count = 0;
    this.veg.shrub.count = this.veg.herb.count = this.veg.vine.count = this.veg.epiphyte.count = 0;
    this.activeTreeColliders.length = 0;
    this.activeTreeColliderGrid.clear();
    this.forestDetailIds.clear();
    this.stats.vegetation = 0;
  };

  world.pathBlockedTree = function(a, b, radius) {
    if (!this.treesEnabled || this.verticalOffset > 2.4) return false;
    for (const tree of candidateColliders(this.activeTreeColliderGrid, this.treeColliderCellM, a, b, radius + .8)) {
      const rr = radius + tree.r;
      if (pointSegmentDistanceSq(a.x, a.z, b.x, b.z, tree.x, tree.z) <= rr * rr) return true;
    }
    return false;
  };

  world.refreshVegetation = function(x, z, now) {
    const playerChunk = chunkKey(chunkCoord(x), chunkCoord(z));
    const moved = Number.isFinite(this.forestLastX) ? Math.hypot(x - this.forestLastX, z - this.forestLastZ) : Infinity;
    const chunkChanged = playerChunk !== this.forestLastChunk;
    if (!this.forceRefresh && !chunkChanged && moved < 9 && now - this.forestLastRefresh < 220) return;

    this.forceRefresh = false;
    this.forestLastChunk = playerChunk;
    this.forestLastX = x;
    this.forestLastZ = z;
    this.forestLastRefresh = now;
    if (!this.treesEnabled) {
      this.clearVegetation();
      return;
    }

    const treeBudget = Math.max(800, Math.floor((this.capacity?.trees || 3000) * this.dynamicFactor));
    const massBudget = Math.max(700, Math.floor(this.veg.farMassV2.userData.capacity * this.dynamicFactor));
    const farTrunkBudget = Math.max(900, Math.floor(this.veg.farTrunkV2.userData.capacity * this.dynamicFactor));
    const detailRows = db.detailedTreesAround(x, z, DETAIL_OUT_M).sort((a, b) => a[0] - b[0]);
    const anchorRows = db.anchorsAround(x, z, MASS_OUT_M).sort((a, b) => a[0] - b[0]);
    const underRows = db.understoryAround(x, z, UNDERSTORY_M).sort((a, b) => a[0] - b[0]);

    const previousDetail = this.forestDetailIds;
    const nextDetail = new Set();
    const selectedAnchorIds = new Set();
    this.activeTreeColliders.length = 0;
    this.activeTreeColliderGrid.clear();

    let ti = 0;
    const ci = { round: 0, umbrella: 0, open: 0, ceibo: 0 };
    for (const [d2, tree] of detailRows) {
      const d = Math.sqrt(d2);
      const wanted = d <= DETAIL_IN_M || (previousDetail.has(tree.id) && d <= DETAIL_OUT_M);
      if (!wanted || ti >= treeBudget) continue;
      const p = tree.props;
      const y = db.surfaceY(tree);
      this.instance(this.veg.trunk, ti, tree.x, y + tree.height * .34, tree.z,
        tree.trunk, tree.height * .68, tree.trunk, null);
      const form = this.veg.canopies[tree.form] ? tree.form : 'round';
      const canopy = this.veg.canopies[form];
      const idx = ci[form]++;
      const loss = this.season < .5 && +p.deciduous === 1 ? .66 + this.season * .38 : 1;
      let sx = tree.canopy, sy = tree.canopy * .85, sz = tree.canopy;
      if (form === 'umbrella') { sx *= 1.2; sy *= .5; sz *= 1.2; }
      else if (form === 'open') { sx *= .88; sy *= .72; sz *= .88; }
      else if (form === 'ceibo') { sx *= 1.08; sy *= .72; sz *= 1.08; }
      this.instance(canopy, idx, tree.x, y + tree.height * .74, tree.z,
        sx * loss, sy * loss, sz * loss, treeColor(p, this.season));

      const collider = { id: tree.id, x: tree.x, z: tree.z, r: Math.max(.11, tree.trunk) };
      this.activeTreeColliders.push(collider);
      colliderInsert(this.activeTreeColliderGrid, this.treeColliderCellM, collider);
      nextDetail.add(tree.id);
      selectedAnchorIds.add(String(tree.id).split(':')[0]);
      ti++;
    }

    this.veg.trunk.count = ti;
    this.veg.trunk.instanceMatrix.needsUpdate = true;
    for (const [key, mesh] of Object.entries(this.veg.canopies)) {
      mesh.count = ci[key];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.forestDetailIds = nextDetail;

    let massN = 0, farN = 0;
    for (const [d2, f] of anchorRows) {
      if (massN >= massBudget) break;
      const p = f.properties || {};
      const d = Math.sqrt(d2);
      const anchorId = String(p.id ?? 'a');
      const fullyNear = d < MASS_IN_M && selectedAnchorIds.has(anchorId);
      if (fullyNear) continue;
      const [lng, lat] = f.geometry.coordinates;
      const y = this.getElevation(lng, lat) - this.originElev;
      const h = Math.max(4, +p.height || 7), can = Math.max(2, +p.canopyM || 3);
      const cluster = Math.max(5, +p.clusterSize || 10);
      const transitionBoost = d < DETAIL_OUT_M ? .82 : 1;
      const scale = can * (1.28 + Math.min(2.35, Math.sqrt(cluster) * .27)) * transitionBoost;
      this.instance(this.veg.farMassV2, massN++, p._x, y + h * .68, p._z,
        scale, scale * .48, scale, treeColor(p, this.season));

      const reps = cluster >= 42 ? 3 : cluster >= 24 ? 2 : 1;
      for (let j = 0; j < reps && farN < farTrunkBudget; j++) {
        const off = clusterOffset(p, j * 3);
        const tx = p._x + off.x, tz = p._z + off.z;
        const ll = localToLngLat(tx, tz);
        const ty = this.getElevation(ll.lng, ll.lat) - this.originElev;
        const th = h * (.72 + hash01((+p.id || 1) * 17 + j) * .18);
        const radius = Math.max(.055, (+p.trunkRadiusM || .08) * 1.12);
        this.instance(this.veg.farTrunkV2, farN++, tx, ty + th * .32, tz,
          radius, th * .64, radius, null);
      }
    }
    this.veg.farMassV2.count = massN;
    this.veg.farMassV2.instanceMatrix.needsUpdate = true;
    if (this.veg.farMassV2.instanceColor) this.veg.farMassV2.instanceColor.needsUpdate = true;
    this.veg.farTrunkV2.count = farN;
    this.veg.farTrunkV2.instanceMatrix.needsUpdate = true;

    const underBudget = {
      shrub: Math.floor((this.capacity?.shrubs || 700) * this.dynamicFactor),
      herb: Math.floor((this.capacity?.herbs || 1150) * this.dynamicFactor),
      vine: Math.floor((this.capacity?.vines || 280) * this.dynamicFactor),
      epiphyte: Math.floor((this.capacity?.epiphytes || 120) * this.dynamicFactor)
    };
    const lists = { shrub: [], herb: [], vine: [], epiphyte: [] };
    for (const row of underRows) {
      const habit = row[1].properties?.habit;
      if (lists[habit] && lists[habit].length < underBudget[habit]) lists[habit].push(row);
    }
    const fill = (list, mesh, habit) => {
      let n = 0;
      const cap = Math.min(mesh.userData.capacity, underBudget[habit]);
      for (const [, f] of list) {
        const p = f.properties || {};
        const vis = +p.seasonalDry === 1
          ? 1 - .55 * this.season
          : clamp((+p.dryPersistence || .45) + (1 - (+p.dryPersistence || .45)) * this.season, 0, 1);
        if ((+p.rand || .5) > vis) continue;
        const [lng, lat] = f.geometry.coordinates;
        const y = this.getElevation(lng, lat) - this.originElev;
        const s = Math.max(.22, +p.scale || .6);
        const copies = Math.min(+p.density || 1, habit === 'herb' ? 7 : habit === 'shrub' ? 4 : 3);
        for (let j = 0; j < copies && n < cap; j++) {
          const a = (+p.rand || .5) * Math.PI * 2 + j * 2.1;
          const sp = habit === 'herb' ? 1.15 : .65;
          const xx = p._x + Math.cos(a) * sp * j * .42;
          const zz = p._z + Math.sin(a) * sp * j * .42;
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

    const shrubs = fill(lists.shrub, this.veg.shrub, 'shrub');
    const herbs = fill(lists.herb, this.veg.herb, 'herb');
    const vines = fill(lists.vine, this.veg.vine, 'vine');
    const epiphytes = fill(lists.epiphyte, this.veg.epiphyte, 'epiphyte');
    this.stats.vegetation = ti + massN + farN + shrubs + herbs + vines + epiphytes;
    this.stats.colliders = (this.buildingColliders?.length || 0) + this.activeTreeColliders.length;
  };

  world.forceRefresh = true;
  return world;
}
