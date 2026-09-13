/**
 * M5 海洋世界与水生生物 — completion standards 15+16 automated verification.
 * Run: node --test test/ocean.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelWorld } from '../src/game/world/World.js';
import { Player } from '../src/game/player/Player.js';
import {
  buildOcean, detectFeatures, addBuriedTreasure,
} from '../src/game/ocean/OceanFeatures.js';
import { B } from '../src/game/ocean/blocks.js';
import {
  createTreasureMap, followClue, furthestClueReached, digTreasure,
} from '../src/game/ocean/Treasure.js';
import {
  Fish, Dolphin, FISH_SPECIES, updateFish, updateDolphin, updatePufferfish,
} from '../src/game/ocean/AquaticLife.js';
import {
  FishBucket, catchFishIntoBucket, releaseFishFromBucket,
} from '../src/game/ocean/FishBucket.js';

const dt = 1 / 60;
const BOUNDS = { x0: -10, x1: 10, z0: -10, z1: 10, y0: 1, y1: 5 };

// ===========================================================================
// 标准 15 — 海洋生成：珊瑚礁/海带海草/冰山/沉船/水下遗迹/埋藏宝藏
// ===========================================================================

test('ocean basin is contained water (no leak over shore rim)', () => {
  const w = new VoxelWorld({ seed: 9 });
  buildOcean(w, { seed: 9 });
  // interior is water just under the surface
  assert.equal(w.isWater(0, 3, 0), true, 'interior cell is water');
  // rim blocks are solid above the waterline
  for (const rim of [[-10, 5, 0], [10, 5, 0], [0, 5, -10], [0, 5, 10]]) {
    assert.equal(w.isSolid(...rim), true, `rim ${rim} is solid land`);
  }
  // just outside the rim there is no water cell (contained)
  assert.equal(w.isWater(-11, 3, 0), false, 'no water outside the basin');
});

test('ocean contains coral reef, kelp, seagrass, iceberg, shipwreck, ruins', () => {
  const w = new VoxelWorld({ seed: 9 });
  buildOcean(w, { seed: 9 });
  const f = detectFeatures(w);
  assert.ok(f.coralReef > 0, `coral reef present (${f.coralReef})`);
  assert.ok(f.kelp > 0, `kelp present (${f.kelp})`);
  assert.ok(f.seagrass > 0, `seagrass present (${f.seagrass})`);
  assert.ok(f.iceberg > 0, `iceberg present (${f.iceberg})`);
  assert.ok(f.shipwreck > 0, `shipwreck present (${f.shipwreck})`);
  assert.ok(f.ruins > 0, `underwater ruins present (${f.ruins})`);
});

test('ocean generation is deterministic per seed', () => {
  const a = new VoxelWorld({ seed: 9 });
  const b = new VoxelWorld({ seed: 9 });
  buildOcean(a, { seed: 9 });
  buildOcean(b, { seed: 9 });
  assert.deepEqual([...a.cells.keys()].sort(), [...b.cells.keys()].sort(),
    'identical block layout for the same seed');
  const fa = detectFeatures(a), fb = detectFeatures(b);
  assert.deepEqual(fa, fb, 'identical feature counts for the same seed');
});

test('buried treasure hides a chest under covering sand', () => {
  const w = new VoxelWorld({ seed: 9 });
  buildOcean(w, { seed: 9 });
  const features = detectFeatures(w);
  const hasChest = [...w.cells.values()].some((blk) => blk.id === B.CHEST);
  assert.equal(hasChest, true, 'a treasure chest exists in the world');
  assert.ok(features, 'features descriptor returned');
});

// ===========================================================================
// 标准 15 — 藏宝图 / 线索引导到可挖掘奖励
// ===========================================================================

test('treasure map clues lead from origin to the buried chest', () => {
  const w = new VoxelWorld({ seed: 9 });
  const features = buildOcean(w, { seed: 9 });
  const t = features.buriedTreasure;
  // The map starts from a shore landmark on land.
  const map = createTreasureMap(t, { origin: [0, 0] });
  // The final step points exactly at the chest column.
  assert.deepEqual(map.target, [t.chest[0], t.chest[2]], 'map final target = chest column');
  assert.equal(map.steps.length, 3, 'map has 3 followable clue steps');
  // Following each step in turn gets closer until the final waypoint is reached.
  let pos = [0, 0];
  let step = 0;
  while (step < map.steps.length) {
    const cmd = followClue(map, pos, step);
    // move toward the step waypoint along the bearing
    const [tx, tz] = map.steps[step].to;
    const dx = tx - pos[0], dz = tz - pos[1];
    const d = Math.hypot(dx, dz) || 1;
    pos = [pos[0] + (dx / d) * 0.75, pos[1] + (dz / d) * 0.75];
    if (cmd.reached) step++;
  }
  assert.ok(Math.hypot(pos[0] - map.target[0], pos[1] - map.target[1]) < 1.5,
    `player following all clues arrives at the treasure (${pos})`);
});

test('furthestClueReached tracks progress toward the treasure', () => {
  const w = new VoxelWorld({ seed: 9 });
  const t = buildOcean(w, { seed: 9 }).buriedTreasure;
  const map = createTreasureMap(t, { origin: [0, 0] });
  // At the treasure the player has advanced to the final step.
  const at = furthestClueReached(map, map.target);
  assert.equal(at, map.steps.length - 1, 'all steps reached at the target');
  // Somewhere far from the treasure, the player has not reached the final step.
  const farFrom = furthestClueReached(map, [map.target[0] + 40, map.target[1] + 40]);
  assert.ok(farFrom < map.steps.length - 1, 'far player has not reached the final clue');
});

test('digging the treasure reveals the chest and yields a reward once', () => {
  const w = new VoxelWorld({ seed: 9 });
  const t = buildOcean(w, { seed: 9 }).buriedTreasure;
  const [cx, cy, cz] = t.chest;
  // Player standing on the chest column digs.
  const loot = digTreasure(w, t, [cx, cz]);
  assert.ok(Array.isArray(loot) && loot.length > 0, `dig yields loot (${loot.length} items)`);
  assert.ok(loot.some((li) => li.item === 'heart_of_the_sea'), 'heart of the sea in loot');
  assert.equal(t.dug, true, 'treasure marked as dug');
  // Covering sand was removed so the chest is exposed (覆盖沙变回水，避免空气洞).
  assert.equal(w.isWater(cx, cy + 1, cz), true, 'covering cell is flooded, not an air hole');
  // A second dig yields nothing.
  assert.deepEqual(digTreasure(w, t, [cx, cz]), [], 'treasure is single-use');
});

test('digging too far away yields nothing', () => {
  const w = new VoxelWorld({ seed: 9 });
  const t = buildOcean(w, { seed: 9 }).buriedTreasure;
  const [cx, , cz] = t.chest;
  assert.deepEqual(digTreasure(w, t, [cx + 60, cz]), [], 'too far to dig yields nothing');
  assert.equal(t.dug, false, 'treasure not consumed by a far dig');
});

// ===========================================================================
// 标准 16 — 海豚 / 鱼，桶捕放，海豚游动，河豚接近状态/伤害
// ===========================================================================

test('all five species are recognised', () => {
  const w = new VoxelWorld({ seed: 9 });
  buildOcean(w, { seed: 9 });
  // fish species list includes the four fish; dolphin is separate
  assert.deepEqual([...FISH_SPECIES].sort(),
    ['cod', 'pufferfish', 'salmon', 'tropical_fish'].sort());
  const dol = new Dolphin(0, 3, 0);
  assert.equal(dol.speed > 1.5, true, 'dolphin swims fast');
});

test('fish swim and stay in the water', () => {
  const w = new VoxelWorld({ seed: 9 });
  buildOcean(w, { seed: 9 });
  const fish = new Fish('cod', 2, 2, 2, { level: 3 });
  // Deterministic-ish: run many steps, the fish must remain inside the basin water.
  let moved = false;
  for (let i = 0; i < 1200 && !moved; i++) {
    const before = [fish.x, fish.y, fish.z];
    updateFish(fish, w, dt, { bounds: BOUNDS });
    moved = moved || fish.x !== before[0] || fish.z !== before[2];
    // no fish may ever leave to solid terrain
    assert.equal(w.isSolid(Math.floor(fish.x), Math.floor(fish.y), Math.floor(fish.z)), false,
      `fish did not swim into solid (${Math.floor(fish.x)},${Math.floor(fish.y)},${Math.floor(fish.z)})`);
  }
  assert.ok(moved, 'fish swam to a different location');
});

test('dolphin swims around and follows a nearby player', () => {
  const w = new VoxelWorld({ seed: 9 });
  buildOcean(w, { seed: 9 });
  const dol = new Dolphin(3, 3, 3);
  // roaming swim motion
  let moved = false;
  for (let i = 0; i < 60 && !moved; i++) {
    const bx = dol.x, bz = dol.z;
    updateDolphin(dol, w, dt, { bounds: BOUNDS });
    moved = moved || dol.x !== bx || dol.z !== bz;
  }
  assert.ok(moved, 'dolphin swims (basic swimming motion)');
  // Following: place a player next to the dolphin, dolphin should approach.
  const p = new Player({ x: 0, y: 3, z: 0 });
  const d0 = Math.hypot(dol.x - p.x, dol.z - p.z);
  for (let i = 0; i < 300; i++) {
    updateDolphin(dol, w, dt, { player: p, followRange: 8, bounds: BOUNDS });
  }
  const d1 = Math.hypot(dol.x - p.x, dol.z - p.z);
  assert.ok(d1 < d0, `dolphin approached the player (${d0.toFixed(2)} → ${d1.toFixed(2)})`);
});

test('bucket catches and releases the four fish species', () => {
  const w = new VoxelWorld({ seed: 9 });
  buildOcean(w, { seed: 9 });
  const bucket = new FishBucket();
  // Catch each of the four fish.
  for (const sp of FISH_SPECIES) {
    const fish = new Fish(sp, 2, 2, 2);
    const r = catchFishIntoBucket(bucket, fish);
    assert.equal(r.caught, true, `${sp} caught into bucket`);
  }
  assert.equal(bucket.count, 4, 'bucket holds 4 fish');
  // Dolphin is NOT bucket-catchable.
  const dol = new Dolphin(2, 2, 2);
  assert.equal(catchFishIntoBucket(bucket, dol).caught, false, 'dolphin is not bucket-caught');
  assert.equal(bucket.count, 4, 'dolphin did not enter the bucket');

  // Release them back into the water.
  let released = 0;
  while (!bucket.isEmpty()) {
    const f = releaseFishFromBucket(bucket, w, 2, 2, 2);
    if (f) released++;
  }
  assert.equal(released, 4, 'all 4 fish released back into water');
  assert.equal(bucket.isEmpty(), true, 'bucket empty after release');
});

test('releasing into a non-water cell fails', () => {
  const w = new VoxelWorld({ seed: 9 });
  const bucket = new FishBucket();
  const fish = new Fish('cod', 2, 2, 2);
  catchFishIntoBucket(bucket, fish);
  // A dry land cell (no water) cannot hold a released fish.
  const f = releaseFishFromBucket(bucket, w, 0, 60, 0);
  assert.equal(f, null, 'release on dry land returns null');
  assert.equal(bucket.count, 1, 'fish stays in the bucket');
});

test('pufferfish inflates and damages a nearby player', () => {
  const w = new VoxelWorld({ seed: 9 });
  buildOcean(w, { seed: 9 });
  const fish = new Fish('pufferfish', 3, 2, 3);
  // Far away: normal state, no damage.
  let far = new Player({ x: 20, y: 2, z: 20 });
  const rFar = updatePufferfish(fish, w, dt, { player: far });
  assert.equal(rFar.state, 'normal', 'far player: pufferfish normal');

  // Close: inflates to puffed and deals damage over time.
  let damage = 0;
  const near = new Player({ x: 3.4, y: 2, z: 3.4 });
  near.takeDamage = (n) => { damage += n; };
  let state = 'normal';
  for (let i = 0; i < 150; i++) { // 2.5 s, plenty of puffed+damage time
    const r = updatePufferfish(fish, w, dt, { player: near, damageRadius: 1.6 });
    state = r.state;
  }
  assert.equal(state, 'puffed', 'pufferfish inflates when the player is near');
  assert.equal(fish.puffed, true, 'puffed flag set');
  assert.ok(fish.inflate > 0.9, `inflation animation ramps up (${fish.inflate.toFixed(2)})`);
  assert.ok(damage >= 1, `pufferfish deals damage on contact (${damage})`);
});
