/**
 * R3 玩家控制 — 可复现操作验证 (CLI harness).
 *
 * Runs a deterministic, seeded scenario through the real PlayerPhysics and
 * prints a per-criterion PASS/FAIL report. This is the reproducible
 * "operation verification" evidence for completion standard 04.
 * Run: npm run verify   (or: node demo/verify.js)
 */
import { VoxelWorld } from '../src/game/world/World.js';
import { Player } from '../src/game/player/Player.js';
import { PlayerPhysics } from '../src/game/player/Physics.js';
import { PlayerController } from '../src/game/player/PlayerController.js';

const FPS = 60;
const dt = 1 / FPS;

function report(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${name}]${detail ? '  ' + detail : ''}`);
  return ok;
}

function ground() {
  const w = new VoxelWorld({ seed: 42 });
  w.buildGround(0, { x: [-30, 30], z: [-30, 30] });
  return w;
}

const runners = new Map();

// 1) 重力 + 落地
{
  const w = ground();
  const p = new Player({ x: 0, y: 8, z: 0 });
  const phys = new PlayerPhysics(p, w);
  for (let i = 0; i < 900 && !p.onGround; i++) phys.step(dt, {});
  runners.set('gravity-landing', report(
    '重力+落地', p.onGround && p.y > 0.95 && p.y < 1.05 && Math.abs(p.vy) < 1e-6,
    `y=${p.y.toFixed(3)} vy=${p.vy.toFixed(3)} onGround=${p.onGround}`));
}

// 2) 碰撞:不能穿过实体方块
{
  const w = ground();
  w.fillBox(0, 1, -8, 0, 8, 8, { id: 1, solid: true, solidHeight: 1 });
  const p = new Player({ x: -5, y: 1, z: 0, yaw: -Math.PI / 2 });
  const phys = new PlayerPhysics(p, w);
  for (let i = 0; i < 240; i++) phys.step(dt, { z: 1, sprint: true });
  runners.set('collision-no-through', report('碰撞不穿墙', p.x <= 0, `x=${p.x.toFixed(3)}`));
}

// 3) 落地不卡入地形
{
  const w = ground();
  const p = new Player({ x: 2, y: 1, z: 2 });
  const phys = new PlayerPhysics(p, w);
  let minY = Infinity;
  for (let i = 0; i < 600; i++) { phys.step(dt, {}); minY = Math.min(minY, p.y); }
  runners.set('no-stuck', report('不卡入地形(稳定站立)', p.y > 0.98 && p.y < 1.02, `y=${p.y.toFixed(3)} minY=${minY.toFixed(3)}`));
}

// 4) 台阶跨越
{
  const w = ground();
  w.setBlock(1, 1, 0, { id: 20, solid: true, solidHeight: 0.5 });
  const p = new Player({ x: -1, y: 1, z: 0, yaw: -Math.PI / 2 });
  const phys = new PlayerPhysics(p, w);
  let peak = 1;
  for (let i = 0; i < 80; i++) { phys.step(dt, { z: 1 }); peak = Math.max(peak, p.y); }
  runners.set('step-up', report('台阶跨越(半格,不跳)', peak > 1.4, `peakY=${peak.toFixed(3)}`));
}

// 5) 跳跃
{
  const w = ground();
  const p = new Player({ x: 0, y: 1, z: 0 });
  const phys = new PlayerPhysics(p, w);
  let peak = 1;
  for (let i = 0; i < 30; i++) { phys.step(dt, { jump: true }); peak = Math.max(peak, p.y); }
  for (let i = 0; i < 120 && !p.onGround; i++) phys.step(dt, {});
  runners.set('jump', report('跳跃+落地', peak > 1.5 && p.onGround && p.y > 0.95, `peak=${peak.toFixed(3)} y=${p.y.toFixed(3)}`));
}

// 6) 疾跑 vs 行走
{
  const w = ground();
  const a = new Player({ x: 0, y: 1, z: 0 });
  const b = new Player({ x: 0, y: 1, z: 0 });
  for (let i = 0; i < 120; i++) new PlayerPhysics(a, w).step(dt, { z: 1, sprint: true });
  for (let i = 0; i < 120; i++) new PlayerPhysics(b, w).step(dt, { z: 1 });
  runners.set('sprint', report('疾跑更快', Math.abs(a.z) > Math.abs(b.z) * 1.2,
    `sprint=${Math.abs(a.z).toFixed(2)} walk=${Math.abs(b.z).toFixed(2)}`));
}

// 7) 下蹲 (更慢 + 高度)
{
  const w = ground();
  const p = new Player({ x: 0, y: 1, z: 0 });
  const phys = new PlayerPhysics(p, w);
  phys.step(dt, { z: 1, sneak: true });
  runners.set('sneak-height', report('下蹲降低身高', phys.height() === 1.5, `height=${phys.height()}`));
}

// 8) WASD + 鼠标视角锁定 (controller-level)
{
  const p = new Player({ x: 0, y: 1, z: 0, yaw: 0 });
  const ctrl = new PlayerController(p, new PlayerPhysics(p, ground()));
  ctrl.press('KeyW');
  const s = ctrl.readState();
  ctrl.pointerLocked = true;
  ctrl.onMouseMove(80, -30);
  const yawChanged = p.yaw !== 0;
  runners.set('wasd+look', report('WASD/视角锁定可操作', s.z === 1 && yawChanged,
    `readState.z=${s.z} yawChanged=${yawChanged}`));
}

// 9) 游泳 (水中上浮)
{
  const w = new VoxelWorld({ seed: 7 });
  w.fillBox(0, 0, 0, 4, 0, 4, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(0, 1, 0, 0, 4, 4, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(4, 1, 0, 4, 4, 4, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(0, 1, 0, 4, 4, 0, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(0, 1, 4, 4, 4, 4, { id: 1, solid: true, solidHeight: 1 });
  w.fillBox(1, 1, 1, 3, 4, 3, { water: true });
  const p = new Player({ x: 2, y: 1, z: 2 });
  const phys = new PlayerPhysics(p, w);
  let sawSwim = false, maxY = 1;
  for (let i = 0; i < 60; i++) { phys.step(dt, { jump: true }); if (p.swimming) sawSwim = true; maxY = Math.max(maxY, p.y); }
  runners.set('swim', report('游泳/上浮', sawSwim && maxY > 2.0, `maxY=${maxY.toFixed(3)} sawSwim=${sawSwim}`));
}

const passes = [...runners.values()].filter(Boolean).length;
const total = runners.size;
console.log(`\n==== R3 玩家控制 操作验证: ${passes}/${total} 项通过 ====`);
process.exit(runners.size === passes ? 0 : 1);
