/**
 * M4 水体核心 — 可复现操作验证 (CLI harness, completion standard 14).
 * Run: npm run verify-water   (or: node demo/verify-water.js)
 */
import { VoxelWorld } from '../src/game/world/World.js';
import { Player } from '../src/game/player/Player.js';
import { PlayerPhysics } from '../src/game/player/Physics.js';
import { AirSupply } from '../src/game/water/AirSupply.js';
import { underwaterFogDistance } from '../src/game/water/WaterVisibility.js';
import { Item, updateFloat } from '../src/game/water/ItemBuoyancy.js';
import { placeSolidUnderwater, findErroneousAirHoles } from '../src/game/water/WaterPlacement.js';

const dt = 1 / 60;
let pass = 0, total = 0;
function report(name, ok, detail = '') {
  total++;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${name}]${detail ? '  ' + detail : ''}`);
  return ok;
}

function tank() {
  const w = new VoxelWorld({ seed: 3 });
  w.fillBox(-1, 0, -1, 5, 0, 5, { solid: true, solidHeight: 1 });
  w.fillBox(-1, 1, -1, -1, 4, 5, { solid: true, solidHeight: 1 });
  w.fillBox(5, 1, -1, 5, 4, 5, { solid: true, solidHeight: 1 });
  w.fillBox(-1, 1, -1, 5, 4, -1, { solid: true, solidHeight: 1 });
  w.fillBox(-1, 1, 5, 5, 4, 5, { solid: true, solidHeight: 1 });
  w.fillBox(0, 1, 0, 4, 4, 4, { water: true });
  return w;
}

// 1) 氧气条 + 溺水
{
  const w = tank();
  const p = new Player({ x: 2, y: 1, z: 2 });
  let dmg = 0; p.takeDamage = (n) => (dmg += n);
  const air = new AirSupply(p, { maxAir: 0.5, drownDamageRate: 2 });
  let depleted = false;
  for (let i = 0; i < 60 && !depleted; i++) { air.update(w, dt); if (air.air <= 0) depleted = true; }
  for (let i = 0; i < 120; i++) air.update(w, dt);
  p.y = 6;
  for (let i = 0; i < 60; i++) air.update(w, dt);
  report('氧气条/溺水/回满', depleted && dmg > 0 && air.air === air.maxAir,
    `depleted=${depleted} dmg=${dmg} air=${air.air.toFixed(2)}`);
}

// 2) 水下能见度
{
  const w = tank();
  const deep = new Player({ x: 2, y: 1.5, z: 2, swimming: true });
  const shallow = new Player({ x: 2, y: 3.5, z: 2, swimming: true });
  const land = new Player({ x: 2, y: 6, z: 2 });
  const d = underwaterFogDistance(deep, w);
  const s = underwaterFogDistance(shallow, w);
  const c = underwaterFogDistance(land, w);
  report('水下能见度随深度缩减且陆上清晰', d < s && c > 100, `deep=${d} shallow=${s} land=${c}`);
}

// 3) 疾跑游泳
{
  const w = tank();
  w.fillBox(0, 1, 0, 40, 4, 4, { water: true }); // long pool along X
  const a = new Player({ x: 2, y: 1.5, z: 2, yaw: -Math.PI / 2 });
  const b = new Player({ x: 2, y: 1.5, z: 2, yaw: -Math.PI / 2 });
  for (let i = 0; i < 120; i++) new PlayerPhysics(a, w).step(dt, { z: 1, sprint: true, jump: true });
  for (let i = 0; i < 120; i++) new PlayerPhysics(b, w).step(dt, { z: 1, jump: true });
  report('疾跑游泳更快', Math.abs(a.x - 2) > Math.abs(b.x - 2) * 1.2,
    `sprint=${Math.abs(a.x - 2).toFixed(2)} swim=${Math.abs(b.x - 2).toFixed(2)}`);
}

// 4) 1x1 水道通过
{
  const w = new VoxelWorld({ seed: 5 });
  w.fillBox(-4, 0, -3, 4, 0, 3, { solid: true, solidHeight: 1 });
  w.fillBox(-4, 1, -3, -1, 4, 3, { water: true });
  w.fillBox(1, 1, -3, 4, 4, 3, { water: true });
  for (let z = -3; z <= 3; z++) for (let y = 1; y <= 4; y++) w.setBlock(0, y, z, { solid: true, solidHeight: 1 });
  w.setBlock(0, 1, 0, { water: true }); // 1x1 opening
  const p = new Player({ x: -2, y: 1.5, z: 0.5, yaw: -Math.PI / 2 });
  const phys = new PlayerPhysics(p, w);
  let passed = false;
  for (let i = 0; i < 360 && !passed; i++) { phys.step(dt, { z: 1, sneak: true }); if (p.x > 1.5) passed = true; }
  report('1x1 水道通过', passed, `x=${p.x.toFixed(2)}`);
}

// 5) 掉落物上浮
{
  const w = tank();
  const it = new Item(2, 1, 2);
  for (let i = 0; i < 400; i++) updateFloat(it, w, dt);
  const stable = it.y;
  for (let i = 0; i < 60; i++) updateFloat(it, w, dt);
  report('掉落物上浮并停在水面', it.y > 4 && it.inWater === false && Math.abs(it.y - stable) < 1e-6,
    `y=${it.y.toFixed(2)} inWater=${it.inWater}`);
}

// 6) 水下放置无错误空气洞
{
  const w = tank();
  const holesBefore = findErroneousAirHoles(w);
  placeSolidUnderwater(w, 2, 2, 2, { id: 5 });
  const holesAfter = findErroneousAirHoles(w);
  const nbWater = w.isWater(3, 2, 2) && w.isWater(2, 3, 2);
  report('水下放置无错误空气洞', holesBefore === 0 && holesAfter === 0 && nbWater,
    `holes ${holesBefore}->${holesAfter} nbWater=${nbWater}`);
}

console.log(`\n==== M4 水体核心 操作验证: ${pass}/${total} 项通过 ====`);
process.exit(pass === total ? 0 : 1);
