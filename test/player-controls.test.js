/**
 * R3 玩家控制 — completion standard 04 automated verification.
 * Run: npm test  (or: node --test test/)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelWorld } from '../src/game/world/World.js';
import { Player } from '../src/game/player/Player.js';
import { PlayerPhysics } from '../src/game/player/Physics.js';
import { PlayerController } from '../src/game/player/PlayerController.js';

const FPS = 60;
const dt = 1 / FPS;

function makeGroundWorld() {
  const w = new VoxelWorld({ seed: 42 });
  w.buildGround(0, { x: [-20, 20], z: [-20, 20] });
  return w;
}

function makePlayer(world, x = 0, z = 0) {
  const [_, sy, sz] = [x, 0, z];
  const p = new Player({ x, y: 1.0, z: sz, yaw: 0 });
  return new PlayerPhysics(p, world);
}

function run(phys, ticks, inputFn) {
  for (let i = 0; i < ticks; i++) {
    const input = typeof inputFn === 'function' ? inputFn(i) : inputFn;
    phys.step(dt, input);
  }
  return phys.player;
}

// ----- 重力 + 落地 -----
test('gravity pulls the player down and landing stops on the ground', () => {
  const w = makeGroundWorld();
  const player = new Player({ x: 0, y: 5, z: 0 });
  const phys = new PlayerPhysics(player, w);
  let maxFallY = 5;
  // fall until grounded
  for (let i = 0; i < 600 && !player.onGround; i++) {
    phys.step(dt, { x: 0, z: 0, jump: false, sprint: false, sneak: false });
    maxFallY = Math.min(maxFallY, player.y);
  }
  // reached ground top (~y=1.0), did not sink below
  assert.ok(player.onGround, 'player should be grounded after falling');
  assert.ok(player.y > 0.95 && player.y < 1.05, `resting y=${player.y} on ground`);
  assert.ok(player.vy < 1e-6, `vertical velocity settles, got ${player.vy}`);
});

test('player does not sink through flat standing ground over many ticks', () => {
  const w = makeGroundWorld();
  const player = new Player({ x: 0, y: 1.0, z: 0 });
  const phys = new PlayerPhysics(player, w);
  for (let i = 0; i < 600; i++) {
    phys.step(dt, { x: 0, z: 0, jump: false, sprint: false, sneak: false });
    assert.ok(player.y > 0.95, `no sink at tick ${i}, y=${player.y}`);
  }
  assert.ok(player.y > 0.98 && player.y < 1.02, `stable y=${player.y}`);
});

// ----- 碰撞: 不能穿过实体方块 -----
test('player cannot pass through a solid wall', () => {
  const w = makeGroundWorld();
  // vertical solid wall occupying the X plane at x=0..0
  w.fillBox(0, 1, -5, 0, 5, 5, { id: 1, solid: true, solidHeight: 1 });
  const p = new Player({ x: -4, y: 1.0, z: 0, yaw: -Math.PI / 2 }); // facing +X
  const phys = new PlayerPhysics(p, w);
  // push forward (into the wall) for 3 seconds
  run(phys, 180, { x: 0, z: 1, jump: false, sprint: false, sneak: false });
  assert.ok(p.x <= -0.29, `player must stop before wall, x=${p.x}`);
  // never crossed the wall plane
  assert.ok(p.x <= 0, 'player must not cross x=0 wall plane');
});

test('no tunneling: even high sprint velocity cannot cross a thin wall', () => {
  const w = makeGroundWorld();
  w.fillBox(0, 1, -5, 0, 5, 5, { id: 1, solid: true, solidHeight: 1 });
  const p = new Player({ x: -4, y: 1.0, z: 0, yaw: -Math.PI / 2 });
  const phys = new PlayerPhysics(p, w);
  run(phys, 240, { x: 0, z: 1, jump: false, sprint: true, sneak: false });
  assert.ok(p.x <= 0, `no tunneling through wall, x=${p.x}`);
});

// ----- 台阶跨越 (slab auto-step; full block requires jump) -----
test('player auto-steps onto a slab (step height within reach) without jumping', () => {
  const w = makeGroundWorld();
  // slab at x=1, bottom y=1, top y=1.5 (half block on top of ground)
  w.setBlock(1, 1, 0, { id: 20, solid: true, solidHeight: 0.5 });
  const p = new Player({ x: -1, y: 1.0, z: 0, yaw: -Math.PI / 2 });
  const phys = new PlayerPhysics(p, w);
  // hold forward, watching for the moment the auto-step lifts the feet
  let peakY = 1.0;
  for (let i = 0; i < 80; i++) {
    phys.step(1 / 60, { x: 0, z: 1, jump: false, sprint: false, sneak: false });
    peakY = Math.max(peakY, p.y);
  }
  assert.ok(peakY > 1.4, `feet were auto-lifted onto the slab, peakY=${peakY}`);
  assert.ok(p.x > 0.5, `player moved past the slab, x=${p.x}`);
});

test('full-height block is NOT auto-stepped (needs jump)', () => {
  const w = makeGroundWorld();
  w.setBlock(1, 1, 0, { id: 1, solid: true, solidHeight: 1 }); // top y=2
  const p = new Player({ x: -1, y: 1.0, z: 0, yaw: -Math.PI / 2 });
  const phys = new PlayerPhysics(p, w);
  run(phys, 90, { x: 0, z: 1, jump: false, sprint: false, sneak: false });
  assert.ok(p.x <= 0.7, `player should be blocked by full block, x=${p.x}`);
  assert.ok(p.y > 0.95 && p.y < 1.1, `player stays at ground level, y=${p.y}`);
});

// ----- 跳跃 -----
test('jump launches the player upward then lands back', () => {
  const w = makeGroundWorld();
  const p = new Player({ x: 0, y: 1.0, z: 0 });
  const phys = new PlayerPhysics(p, w);
  let maxY = 1.0;
  // jump for 20 ticks, then fall
  for (let i = 0; i < 60; i++) {
    phys.step(dt, { x: 0, z: 0, jump: i < 20, sprint: false, sneak: false });
    maxY = Math.max(maxY, p.y);
  }
  assert.ok(maxY > 1.5, `jump apex ${maxY} above ground`);
  // after falling it should land back on the ground
  for (let i = 0; i < 120 && !p.onGround; i++) {
    phys.step(dt, { x: 0, z: 0, jump: false, sprint: false, sneak: false });
  }
  assert.ok(p.onGround, 'lands after jump');
  assert.ok(p.y > 0.95 && p.y < 1.05, `resting y=${p.y} after landing`);
});

// ----- 疾跑 vs 行走 -----
test('sprint moves faster than walk', () => {
  const w = makeGroundWorld();
  const walkP = new Player({ x: 0, y: 1.0, z: 0, yaw: 0 });
  const sprintP = new Player({ x: 0, y: 1.0, z: 0, yaw: 0 });
  const walkPhys = new PlayerPhysics(walkP, w);
  const sprintPhys = new PlayerPhysics(sprintP, w);
  run(walkPhys, 120, { x: 0, z: 1, jump: false, sprint: false, sneak: false });
  run(sprintPhys, 120, { x: 0, z: 1, jump: false, sprint: true, sneak: false });
  const dWalk = Math.abs(walkP.z);
  const dSprint = Math.abs(sprintP.z);
  assert.ok(dSprint > dWalk * 1.2, `sprint ${dSprint} > walk ${dWalk}`);
});

// ----- 下蹲: 更慢 + 身高降低 -----
test('sneak slows the player and lowers the hitbox height', () => {
  const w = makeGroundWorld();
  const p = new Player({ x: 0, y: 1.0, z: 0, yaw: 0 });
  const phys = new PlayerPhysics(p, w);
  phys.step(dt, { x: 0, z: 1, jump: false, sprint: false, sneak: true });
  assert.equal(phys.height(), 1.5, 'sneak height 1.5');
  assert.equal(p.sneaking, true);
  // measure distances
  const sneakP = new Player({ x: 0, y: 1.0, z: 0, yaw: 0 });
  const walkP = new Player({ x: 0, y: 1.0, z: 0, yaw: 0 });
  run(new PlayerPhysics(sneakP, w), 120, { x: 0, z: 1, jump: false, sprint: false, sneak: true });
  run(new PlayerPhysics(walkP, w), 120, { x: 0, z: 1, jump: false, sprint: false, sneak: false });
  assert.ok(Math.abs(sneakP.z) < Math.abs(walkP.z) * 0.6,
    `sneak ${Math.abs(sneakP.z)} slower than walk ${Math.abs(walkP.z)}`);
});

// ----- WASD 方向映射 -----
test('WASD map to correct world directions relative to yaw', () => {
  const w = makeGroundWorld();
  // yaw = PI/2 => forward is -X by our yaw convention; left is +Z.
  const fwd = new Player({ x: 0, y: 1.0, z: 0, yaw: Math.PI / 2 });
  run(new PlayerPhysics(fwd, w), 30, { x: 0, z: 1, jump: false, sprint: false, sneak: false });
  assert.ok(fwd.x < -0.2, `W moves -X, x=${fwd.x}`);
  assert.ok(Math.abs(fwd.z) < 0.01, 'W does not move Z');

  const left = new Player({ x: 0, y: 1.0, z: 0, yaw: Math.PI / 2 });
  run(new PlayerPhysics(left, w), 30, { x: 1, z: 0, jump: false, sprint: false, sneak: false });
  assert.ok(left.z > 0.2, `A moves +Z (left), z=${left.z}`);
  assert.ok(Math.abs(left.x) < 0.01, 'A does not move X');

  // back = -forward
  const back = new Player({ x: 0, y: 1.0, z: 0, yaw: Math.PI / 2 });
  run(new PlayerPhysics(back, w), 30, { x: 0, z: -1, jump: false, sprint: false, sneak: false });
  assert.ok(back.x > 0.2, `S moves +X, x=${back.x}`);
});

// ----- 鼠标视角锁定 (pointer-lock pitch/yaw math) -----
test('mouse look updates yaw/pitch and clamps pitch', () => {
  const w = makeGroundWorld();
  const p = new Player({ x: 0, y: 1.0, z: 0 });
  const phys = new PlayerPhysics(p, w);
  const ctrl = new PlayerController(p, phys);
  ctrl.pointerLocked = true;
  const y0 = p.yaw, p0 = p.pitch;
  ctrl.onMouseMove(100, 50); // right + down
  assert.ok(p.yaw < y0, 'moving mouse right turns yaw negative (left look rotates)');
  assert.ok(p.pitch > p0, 'moving mouse down raises pitch');
  // pitch clamp
  for (let i = 0; i < 1000; i++) ctrl.onMouseMove(0, 100);
  assert.ok(p.pitch <= Math.PI / 2 - 1e-3, `pitch clamped, ${p.pitch}`);
  for (let i = 0; i < 1000; i++) ctrl.onMouseMove(0, -100);
  assert.ok(p.pitch >= -(Math.PI / 2 - 1e-3), `pitch clamped low, ${p.pitch}`);
});

// ----- 游泳 -----
test('player swims upward in water and does not fall through floor', () => {
  const w = new VoxelWorld({ seed: 7 });
  // tank: solid floor + 4 walls, water inside
  w.fillBox(0, 0, 0, 4, 0, 4, { id: 1, solid: true, solidHeight: 1 }); // floor
  w.fillBox(0, 1, 0, 0, 4, 4, { id: 1, solid: true, solidHeight: 1 }); // wall x=0
  w.fillBox(4, 1, 0, 4, 4, 4, { id: 1, solid: true, solidHeight: 1 }); // wall x=4
  w.fillBox(0, 1, 0, 4, 4, 0, { id: 1, solid: true, solidHeight: 1 }); // wall z=0
  w.fillBox(0, 1, 4, 4, 4, 4, { id: 1, solid: true, solidHeight: 1 }); // wall z=4
  w.fillBox(1, 1, 1, 3, 4, 3, { water: true }); // water column y=1..4

  const p = new Player({ x: 2, y: 1.0, z: 2 });
  const phys = new PlayerPhysics(p, w);
  let sawSwimming = false;
  let maxY = 1.0;
  for (let i = 0; i < 60; i++) {
    phys.step(1 / 60, { x: 0, z: 0, jump: true, sprint: false, sneak: false });
    if (p.swimming) sawSwimming = true;
    maxY = Math.max(maxY, p.y);
  }
  assert.ok(sawSwimming, 'recognized swimming while submerged');
  assert.ok(maxY > 2.0, `player swam up, maxY=${maxY}`);
  assert.ok(p.y > 0.95, 'never fell through floor');
});

test('water dampens gravity (no slam-down like dry fall)', () => {
  const w = new VoxelWorld({ seed: 7 });
  w.fillBox(0, 0, 0, 4, 0, 4, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(0, 1, 0, 0, 4, 4, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(4, 1, 0, 4, 4, 4, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(0, 1, 0, 4, 4, 0, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(0, 1, 4, 4, 4, 4, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(1, 1, 1, 3, 4, 3, { water: true });
  const p = new Player({ x: 2, y: 4, z: 2 });
  const phys = new PlayerPhysics(p, w);
  const dry = new PlayerPhysics(new Player({ x: 2, y: 4, z: 2 }), makeGroundWorld());
  run(phys, 40, { x: 0, z: 0, jump: false, sprint: false, sneak: false });
  run(dry, 40, { x: 0, z: 0, jump: false, sprint: false, sneak: false });
  // in water the downward drift is much slower than free-fall gravity
  const waterFall = 4 - p.y;
  const dryFall = 4 - dry.player.y;
  assert.ok(waterFall < dryFall * 0.7,
    `water dampens fall: water ${waterFall} vs dry ${dryFall}`);
});
