import test from 'node:test';
import assert from 'node:assert/strict';
import { AIR, BLOCK_IDS } from '../src/game/blocks/catalog.js';
import { Inventory } from '../src/game/inventory/Inventory.js';
import { MutableWorld } from '../src/game/world/MutableWorld.js';
import { raycastVoxel, placementPosition } from '../src/game/interaction/Raycast.js';
import { DropManager, MiningController, canPlaceBlock, placeSelectedBlock } from '../src/game/interaction/Interaction.js';
import { createGameState, encodeGameState, decodeGameState, saveToStorage, loadFromStorage } from '../src/game/save/SaveGame.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test('crosshair voxel ray selects a block and reports its placement face', () => {
  const world = new MutableWorld();
  world.setBlock(0, 1, -3, 'stone');
  const hit = raycastVoxel(world, [0.5, 1.5, 0.5], [0, 0, -1]);
  assert.deepEqual(hit.position, [0, 1, -3]);
  assert.deepEqual(hit.normal, [0, 0, 1]);
  assert.deepEqual(placementPosition(hit), [0, 1, -2]);
});

test('all 32 blocks complete mining → drop → pickup → inventory → placement loop', () => {
  assert.ok(BLOCK_IDS.length >= 30);
  for (const blockId of BLOCK_IDS) {
    const world = new MutableWorld();
    const inventory = new Inventory();
    const drops = new DropManager();
    const mining = new MiningController();
    world.setBlock(0, 0, 0, blockId);
    const result = mining.update(world, [0, 0, 0], 20, drops, { toolSpeed: 1 });
    assert.equal(result.broken, true, `${blockId} can be harvested`);
    assert.equal(world.getBlock(0, 0, 0), AIR);
    assert.equal(drops.pickupNearby(inventory, [0.5, 0.5, 0.5]), 1);
    assert.equal(inventory.count(blockId), 1);
    assert.equal(placeSelectedBlock(inventory, world, [1, 0, 0]), true, `${blockId} can be placed`);
    assert.equal(world.getBlock(1, 0, 0), blockId);
  }
});

test('mining progress follows hardness and resets on target change', () => {
  const world = new MutableWorld();
  world.setBlock(0, 0, 0, 'obsidian');
  world.setBlock(1, 0, 0, 'dirt');
  const mining = new MiningController();
  const drops = new DropManager();
  assert.equal(mining.update(world, [0, 0, 0], 1, drops).broken, false);
  const dirt = mining.update(world, [1, 0, 0], 0.25, drops);
  assert.equal(dirt.broken, false);
  assert.equal(dirt.progress, 0.5);
  assert.equal(mining.update(world, [1, 0, 0], 0.25, drops).broken, true);
});

test('placement rejects occupied blocks and the player body', () => {
  const world = new MutableWorld();
  world.setBlock(1, 0, 0, 'stone');
  const player = { min: [0.2, 0, 0.2], max: [0.8, 1.8, 0.8] };
  assert.equal(canPlaceBlock(world, [1, 0, 0], 'dirt', player), false);
  assert.equal(canPlaceBlock(world, [0, 0, 0], 'dirt', player), false);
  assert.equal(canPlaceBlock(world, [2, 0, 0], 'dirt', player), true);
});

test('inventory supports stacking, split, swap, selected hotbar, full capacity and death drops', () => {
  const inventory = new Inventory();
  assert.equal(inventory.hotbarSize, 9);
  assert.equal(inventory.add('stone', 65), 0);
  assert.equal(inventory.slots[0].count, 64);
  assert.equal(inventory.slots[1].count, 1);
  assert.deepEqual(inventory.split(0, 32, 2), { itemId: 'stone', count: 32 });
  assert.equal(inventory.swap(1, 2), true);
  assert.equal(inventory.select(2), true);
  assert.equal(inventory.current.count, 1);

  for (let i = 0; i < inventory.size; i++) inventory.slots[i] = { itemId: 'dirt', count: 64 };
  assert.equal(inventory.add('stone', 1), 1, 'full inventory returns remainder');
  const drops = inventory.dropAll([4, 5, 6]);
  assert.equal(drops.length, 36);
  assert.ok(inventory.slots.every((slot) => slot === null));
  assert.deepEqual(drops[0].position, [4, 5, 6]);
});

test('save/load preserves seed, position, inventory counts, time, changes, containers and entities', () => {
  const world = new MutableWorld();
  world.setBlock(2, 3, 4, 'chest');
  world.setBlock(-2, 7, 1, AIR);
  const inventory = new Inventory();
  inventory.add('stone', 70);
  inventory.add('torch', 12);
  inventory.select(1);
  const state = createGameState({
    seed: 424242,
    player: { position: [1.25, 70, -3.5], health: 17, hunger: 14 },
    inventory,
    time: 18000,
    world,
    containers: {
      chests: { '2,3,4': [{ itemId: 'diamond_ore', count: 3 }] },
      furnaces: { '5,3,4': { input: 'iron_ore', fuel: 'oak_log', progress: 0.6 } },
    },
    entities: [{ type: 'dropped_item', itemId: 'dirt', count: 2, position: [0, 70, 0] }],
  });
  const restored = decodeGameState(encodeGameState(state));
  assert.deepEqual(restored, state);
  assert.equal(Inventory.deserialize(restored.inventory).count('stone'), 70);
});

test('refresh-style storage reload preserves quantities and corrupt saves fail clearly with safe fallback', () => {
  const storage = new MemoryStorage();
  const world = new MutableWorld();
  const inventory = new Inventory();
  inventory.add('sand', 64);
  inventory.add('sand', 7);
  const original = createGameState({ seed: 7, player: { position: [0, 65, 0] }, inventory, world });
  saveToStorage(storage, original);
  const fallback = () => createGameState({
    seed: 99, player: { position: [0, 80, 0] }, inventory: new Inventory(), world: new MutableWorld(),
  });
  const loaded = loadFromStorage(storage, fallback);
  assert.equal(loaded.ok, true);
  assert.equal(Inventory.deserialize(loaded.state.inventory).count('sand'), 71);

  storage.setItem('bedrock-web.world.v1', '{broken');
  const recovered = loadFromStorage(storage, fallback);
  assert.equal(recovered.ok, false);
  assert.equal(recovered.error.code, 'CORRUPT_SAVE');
  assert.match(recovered.error.message, /valid JSON/);
  assert.equal(recovered.state.seed, 99);
});
