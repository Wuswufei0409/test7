import { AIR, BLOCK_IDS } from '../src/game/blocks/catalog.js';
import { Inventory } from '../src/game/inventory/Inventory.js';
import { MutableWorld } from '../src/game/world/MutableWorld.js';
import { raycastVoxel, placementPosition } from '../src/game/interaction/Raycast.js';
import { DropManager, MiningController, placeSelectedBlock } from '../src/game/interaction/Interaction.js';
import { createGameState, saveToStorage, loadFromStorage } from '../src/game/save/SaveGame.js';

const results = [];
function verify(name, run) {
  try {
    const detail = run();
    results.push(true);
    console.log(`PASS  [${name}]  ${detail}`);
  } catch (error) {
    results.push(false);
    console.log(`FAIL  [${name}]  ${error.message}`);
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}

verify('准星选块与 32 种方块采集→掉落→拾取→放置', () => {
  const targetWorld = new MutableWorld();
  targetWorld.setBlock(0, 1, -3, 'stone');
  const hit = raycastVoxel(targetWorld, [0.5, 1.5, 0.5], [0, 0, -1]);
  expect(hit && placementPosition(hit).join(',') === '0,1,-2', 'crosshair ray missed target');

  let completed = 0;
  for (const blockId of BLOCK_IDS) {
    const world = new MutableWorld();
    const inventory = new Inventory();
    const drops = new DropManager();
    world.setBlock(0, 0, 0, blockId);
    expect(new MiningController().update(world, [0, 0, 0], 20, drops).broken, `${blockId} did not break`);
    expect(world.getBlock(0, 0, 0) === AIR, `${blockId} remained in world`);
    expect(drops.pickupNearby(inventory, [0.5, 0.5, 0.5]) === 1, `${blockId} was not picked up`);
    expect(placeSelectedBlock(inventory, world, [1, 0, 0]), `${blockId} was not placed`);
    completed++;
  }
  return `selected=${hit.blockId} closedLoops=${completed}`;
});

verify('九格快捷栏/堆叠拆分交换/满背包/死亡掉落', () => {
  const inventory = new Inventory();
  inventory.add('stone', 65);
  inventory.split(0, 32, 2);
  inventory.swap(1, 2);
  inventory.select(2);
  expect(inventory.hotbarSize === 9 && inventory.current.count === 1, 'hotbar operations failed');
  for (let i = 0; i < inventory.size; i++) inventory.slots[i] = { itemId: 'dirt', count: 64 };
  expect(inventory.add('stone', 1) === 1, 'full inventory accepted an item');
  const deathDrops = inventory.dropAll([4, 5, 6]);
  expect(deathDrops.length === 36 && inventory.slots.every((slot) => !slot), 'death drop failed');
  return `hotbar=9 capacity=36 deathDrops=${deathDrops.length}`;
});

verify('刷新存档数量一致与损坏存档安全回退', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
  };
  const inventory = new Inventory();
  inventory.add('sand', 71);
  const world = new MutableWorld();
  world.setBlock(2, 3, 4, 'chest');
  const state = createGameState({
    seed: 77, player: { position: [1, 70, 2] }, inventory, time: 9000, world,
    containers: { chests: { '2,3,4': [{ itemId: 'sand', count: 4 }] }, furnaces: {} },
    entities: [{ type: 'dropped_item', itemId: 'dirt', count: 2, position: [1, 70, 2] }],
  });
  saveToStorage(storage, state);
  const fallback = () => createGameState({
    seed: 1, player: { position: [0, 80, 0] }, inventory: new Inventory(), world: new MutableWorld(),
  });
  const loaded = loadFromStorage(storage, fallback);
  expect(loaded.ok && Inventory.deserialize(loaded.state.inventory).count('sand') === 71, 'quantity changed after reload');
  values.set('bedrock-web.world.v1', 'corrupt');
  const recovered = loadFromStorage(storage, fallback);
  expect(!recovered.ok && recovered.error.code === 'CORRUPT_SAVE' && recovered.state.seed === 1, 'corrupt save was not recovered');
  return 'sand=71 error=CORRUPT_SAVE fallbackSeed=1';
});

console.log(`\n==== M1 gameplay verification: ${results.filter(Boolean).length}/${results.length} passed ====`);
if (results.some((result) => !result)) process.exitCode = 1;
