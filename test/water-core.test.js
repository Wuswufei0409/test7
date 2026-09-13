/**
 * M4 水体核心 — completion standard 14 automated verification.
 * Run: node --test test/water-core.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelWorld } from '../src/game/world/World.js';
import { Player } from '../src/game/player/Player.js';
import { PlayerPhysics } from '../src/game/player/Physics.js';
import { AirSupply } from '../src/game/water/AirSupply.js';
import { underwaterFogDistance } from '../src/game/water/WaterVisibility.js';
import { Item, updateFloat } from '../src/game/water/ItemBuoyancy.js';
import { placeSolidUnderwater, findErroneousAirHoles } from '../src/game/water/WaterPlacement.js';

const dt = 1 / 60;

/** A water tank: solid floor + 4 walls + water column. */
function makeTank(x0 = 0, y0 = 1, z0 = 0, x1 = 4, y1 = 4, z1 = 4, depth = 4) {
  const w = new VoxelWorld({ seed: 3 });
  w.fillBox(x0 - 1, y0 - 1, z0 - 1, x1 + 1, y0 - 1, z1 + 1, { id: 1, solid: true, solidHeight: 1 }); // floor
  w.fillBox(x0 - 1, y0, z0 - 1, x0 - 1, y1, z1 + 1, { id: 1, solid: true, solidHeight: 1 }); // wall
  w.fillBox(x1 + 1, y0, z0 - 1, x1 + 1, y1, z1 + 1, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(x0 - 1, y0, z0 - 1, x1 + 1, y1, z0 - 1, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(x0 - 1, y0, z1 + 1, x1 + 1, y1, z1 + 1, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(x0, y0, z0, x1, depth, z1, { water: true }); // water up to `depth`
  return w;
}

// ---------- 氧气条 / 溺水 ----------
test('oxygen depletes underwater and refills at the surface', () => {
  const w = makeTank();
  const p = new Player({ x: 2, y: 1, z: 2 });
  const air = new AirSupply(p, { maxAir: 1, refillRate: 10 }); // 1s air, fast refill
  // underwater: head in water
  for (let i = 0; i < 30; i++) air.update(w, dt); // 0.5s
  assert.ok(air.air < 0.999, `air depletes underwater, air=${air.air.toFixed(2)}`);
  // surface: move player up so head is out of water
  p.y = 5; // above water
  for (let i = 0; i < 30; i++) air.update(w, dt);
  assert.equal(air.air, air.maxAir, 'air refills to max at surface');
});

test('drowning applies damage when air hits zero', () => {
  const w = makeTank();
  const p = new Player({ x: 2, y: 1, z: 2 });
  let damaged = 0;
  p.takeDamage = (n) => { damaged += n; };
  const air = new AirSupply(p, { maxAir: 0.5, drownDamageRate: 2 }); // 0.5s air
  // stay underwater well past zero air
  for (let i = 0; i < 120; i++) air.update(w, dt); // 2s
  assert.equal(air.air, 0, 'air hits zero');
  assert.ok(air.drowning, 'drowning state true');
  assert.ok(damaged > 0, `drowning deals damage, damaged=${damaged}`);
});

// ---------- 水下能见度 ----------
test('underwater visibility shrinks with depth; clear above water', () => {
  const w = makeTank();
  const p = new Player({ x: 2, y: 1.5, z: 2, swimming: true }); // deep
  const deep = underwaterFogDistance(p, w);
  const p2 = new Player({ x: 2, y: 3.5, z: 2, swimming: true }); // shallow (near surface)
  const shallow = underwaterFogDistance(p2, w);
  const p3 = new Player({ x: 2, y: 6, z: 2 }); // on land, not swimming
  const clear = underwaterFogDistance(p3, w);
  assert.ok(deep < shallow, `deeper = less visibility: deep ${deep} < shallow ${shallow}`);
  assert.ok(clear > 100, `clear visibility above water: ${clear}`);
});

// ---------- 疾跑游泳 ----------
test('sprint swimming is faster than normal swimming', () => {
  const w = makeTank(0, 1, 0, 40, 4, 4); // long tank along X
  const a = new Player({ x: 4, y: 1.5, z: 2, yaw: -Math.PI / 2 }); // swim +X
  const b = new Player({ x: 4, y: 1.5, z: 2, yaw: -Math.PI / 2 });
  const pa = new PlayerPhysics(a, w);
  const pb = new PlayerPhysics(b, w);
  for (let i = 0; i < 120; i++) pa.step(dt, { z: 1, sprint: true, jump: true });
  for (let i = 0; i < 120; i++) pb.step(dt, { z: 1, jump: true });
  const da = Math.abs(a.x - 4), db = Math.abs(b.x - 4);
  assert.ok(da > db * 1.2, `sprint swim ${da.toFixed(2)} > normal swim ${db.toFixed(2)}`);
});

// ---------- 1x1 水道通过 ----------
test('player swims through a 1x1 (1-wide x 1-tall) water channel', () => {
  const w = new VoxelWorld({ seed: 5 });
  // floor spanning the whole area
  w.fillBox(-4, 0, -3, 4, 0, 3, { id: 1, solid: true, solidHeight: 1 });
  // water basins filling both sides, y=1..4
  w.fillBox(-4, 1, -3, -1, 4, 3, { water: true });
  w.fillBox(1, 1, -3, 4, 4, 3, { water: true });
  // wall across X=0 leaving a single 1x1 opening at (0,1,0): cell [0,1]x[1,2]x[0,1]
  for (let z = -3; z <= 3; z++) {
    for (let y = 1; y <= 4; y++) {
      w.setBlock(0, y, z, { id: 1, solid: true, solidHeight: 1 });
    }
  }
  w.setBlock(0, 1, 0, { water: true }); // carve the 1x1 opening
  // player centered on z=0.5 to fit the 1-wide opening
  const p = new Player({ x: -2, y: 1.5, z: 0.5, yaw: -Math.PI / 2 }); // +X
  const phys = new PlayerPhysics(p, w);
  // dive (sneak) + swim forward to align with the 1-tall opening and pass through
  let passed = false;
  for (let i = 0; i < 360; i++) {
    phys.step(dt, { z: 1, sneak: true, jump: false, sprint: false });
    if (p.x > 1.5) { passed = true; break; }
  }
  assert.ok(passed, `player swam through 1x1 channel, reached x=${p.x.toFixed(2)}`);
});

// ---------- 掉落物上浮 ----------
test('dropped item floats up to the surface and stops', () => {
  const w = makeTank(0, 1, 0, 4, 4, 4, 4); // water y=1..4
  const item = new Item(2, 1, 2); // resting on the floor, inside water
  assert.equal(item.inWater, false);
  for (let i = 0; i < 400; i++) updateFloat(item, w, dt); // wait until floated & stable
  // surface top of the water column: water occupies y=1..4 (cells), topmost cell y=4 spans [4,5]
  const top = 5;
  assert.ok(item.y > 4.0, `item rose to surface, y=${item.y.toFixed(2)}`);
  assert.ok(item.y <= top + 0.01, `item floats at surface, not above: y=${item.y.toFixed(2)}`);
  assert.equal(item.inWater, false, 'item floating at surface (no longer rising)');
  // stays stable: no further rise
  const yBefore = item.y;
  for (let i = 0; i < 60; i++) updateFloat(item, w, dt);
  assert.ok(Math.abs(item.y - yBefore) < 1e-6, 'item is stable at surface');
});

// ---------- 水下放置无错误空气洞 ----------
test('placing a block underwater preserves water and creates no air hole', () => {
  const w = makeTank(0, 1, 0, 4, 4, 4, 4);
  assert.equal(findErroneousAirHoles(w), 0, 'open tank has no erroneous air holes');
  const n = w.cells.size;
  // place a solid block in the middle of the water column (cell (2,2,2) is water)
  const wasWater = placeSolidUnderwater(w, 2, 2, 2, { id: 5 });
  assert.equal(wasWater, true, 'placed into a water cell');
  const blk = w.getBlock(2, 2, 2);
  assert.equal(blk.solid, true, 'placed block is solid');
  assert.equal(blk.water, false, 'placed block is not water');
  // neighbours must still be water (no accidental air)
  assert.equal(w.isWater(1, 2, 2), true, 'x-1 neighbour remains water');
  assert.equal(w.isWater(3, 2, 2), true, 'x+1 neighbour remains water');
  assert.equal(w.isWater(2, 3, 2), true, 'above neighbour remains water');
  // exactly one cell changed (the placed one): no spurious air/water mutation
  assert.equal(w.cells.size, n, 'only the placed cell changed');
  // no erroneous air hole introduced
  assert.equal(findErroneousAirHoles(w), 0, 'no erroneous air hole after placement');
});
