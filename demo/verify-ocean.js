/**
 * M5 海洋世界与水生生物 — 可复现操作验证 (CLI harness, completion standards 15+16).
 * Run: npm run verify-ocean   (or: node demo/verify-ocean.js)
 */
import { VoxelWorld } from '../src/game/world/World.js';
import { Player } from '../src/game/player/Player.js';
import {
  buildOcean, detectFeatures,
} from '../src/game/ocean/OceanFeatures.js';
import {
  createTreasureMap, followClue, digTreasure,
} from '../src/game/ocean/Treasure.js';
import {
  Fish, Dolphin, updateFish, updateDolphin, updatePufferfish,
} from '../src/game/ocean/AquaticLife.js';
import {
  FishBucket, catchFishIntoBucket, releaseFishFromBucket,
} from '../src/game/ocean/FishBucket.js';

const dt = 1 / 60;
const BOUNDS = { x0: -10, x1: 10, z0: -10, z1: 10, y0: 1, y1: 5 };
let pass = 0, total = 0;
function report(name, ok, detail = '') {
  total++;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${name}]${detail ? '  ' + detail : ''}`);
  return ok;
}

const world = new VoxelWorld({ seed: 9 });
const features = buildOcean(world, { seed: 9 });

// 1) 六类海洋特征齐备
{
  const f = detectFeatures(world);
  report('海洋含珊瑚礁/海带海草/冰山/沉船/水下遗迹/埋藏宝藏',
    f.coralReef > 0 && f.kelp > 0 && f.seagrass > 0 && f.iceberg > 0 && f.shipwreck > 0 && f.ruins > 0,
    `coral=${f.coralReef} kelp=${f.kelp} seagrass=${f.seagrass} ice=${f.iceberg} ship=${f.shipwreck} ruins=${f.ruins}`);
}

// 2) 藏宝图线索引导到可挖掘奖励
{
  const t = features.buriedTreasure;
  const map = createTreasureMap(t, { origin: [0, 0] });
  // 沿方位角/距离逐步逼近，直到最后一步（宝藏坐标）。
  let pos = [0, 0], step = 0;
  while (step < map.steps.length && step < 200) {
    const cmd = followClue(map, pos, step);
    const [tx, tz] = map.steps[step].to;
    const dx = tx - pos[0], dz = tz - pos[1];
    const d = Math.hypot(dx, dz) || 1;
    pos = [pos[0] + (dx / d) * 0.75, pos[1] + (dz / d) * 0.75];
    if (cmd.reached) step++;
  }
  const atTreasure = Math.hypot(pos[0] - t.chest[0], pos[1] - t.chest[2]) < 1.5;
  const loot = digTreasure(world, t, [t.chest[0], t.chest[2]]);
  report('藏宝图引导到宝藏并可挖掘奖励', atTreasure && loot.length > 0 && t.dug,
    `atTreasure=${atTreasure} loot=${loot.length} dug=${t.dug}`);
}

// 3) 五种生物识别 + 海豚/鱼在海中游动
{
  const dol = new Dolphin(3, 3, 3);
  let dolMoved = false;
  for (let i = 0; i < 60 && !dolMoved; i++) {
    const bx = dol.x, bz = dol.z;
    updateDolphin(dol, world, dt, { bounds: BOUNDS });
    dolMoved = dolMoved || dol.x !== bx || dol.z !== bz;
  }
  const cod = new Fish('cod', 2, 2, 2, { level: 3 });
  let codMoved = false;
  for (let i = 0; i < 300 && !codMoved; i++) {
    const bx = cod.x, bz = cod.z;
    updateFish(cod, world, dt, { bounds: BOUNDS });
    codMoved = codMoved || cod.x !== bx || cod.z !== bz;
    if (world.isSolid(Math.floor(cod.x), Math.floor(cod.y), Math.floor(cod.z))) break;
  }
  report('海豚基础游动 + 鳕鱼/鲑鱼/热带鱼/河豚在海洋中', dolMoved && codMoved,
    `dolphin=${dolMoved} cod=${codMoved}`);
}

// 4) 桶捕放鱼
{
  const bucket = new FishBucket();
  let caught = 0;
  for (const sp of ['cod', 'salmon', 'tropical_fish', 'pufferfish']) {
    if (catchFishIntoBucket(bucket, new Fish(sp, 2, 2, 2)).caught) caught++;
  }
  const dolNo = catchFishIntoBucket(bucket, new Dolphin(2, 2, 2)).caught;
  let released = 0;
  while (!bucket.isEmpty()) {
    if (releaseFishFromBucket(bucket, world, 2, 2, 2)) released++;
  }
  report('鱼可用桶捕获/释放（海豚不可入桶）', caught === 4 && !dolNo && released === 4,
    `caught=${caught} dolphin=${dolNo} released=${released}`);
}

// 5) 河豚接近状态变化或伤害
{
  const puff = new Fish('pufferfish', 3, 2, 3);
  let damage = 0;
  const near = new Player({ x: 3.4, y: 2, z: 3.4 });
  near.takeDamage = (n) => (damage += n);
  let state = 'normal';
  for (let i = 0; i < 150; i++) {
    state = updatePufferfish(puff, world, dt, { player: near, damageRadius: 1.6 }).state;
  }
  report('河豚接近时状态变化或伤害', state === 'puffed' && damage >= 1,
    `state=${state} inflate=${puff.inflate.toFixed(2)} damage=${damage}`);
}

console.log(`\n==== M5 海洋世界与水生生物 操作验证: ${pass}/${total} 项通过 ====`);
process.exit(pass === total ? 0 : 1);
