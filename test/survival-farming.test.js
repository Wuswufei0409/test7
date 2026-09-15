import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/game/inventory/Inventory.js';
import { MutableWorld } from '../src/game/world/MutableWorld.js';
import { SurvivalSystem } from '../src/game/survival/SurvivalSystem.js';
import { DayNightSystem } from '../src/game/survival/DayNightSystem.js';
import { FarmingSystem } from '../src/game/farming/FarmingSystem.js';

test('health, hunger, food, four damage sources, death and bed respawn are deterministic', () => {
  const inventory = new Inventory();
  inventory.add('bread', 2);
  const survival = new SurvivalSystem({ health: 20, hunger: 12, difficulty: 'normal' });
  assert.equal(survival.fall(8), 5);
  assert.equal(survival.drown(2), 2);
  assert.equal(survival.melee(2), 2);
  assert.equal(survival.hostileHit(3), 3);
  assert.equal(survival.health, 8);
  assert.equal(survival.eat(inventory, 0), true);
  assert.equal(survival.hunger, 17);
  assert.equal(inventory.count('bread'), 1);
  survival.setSpawnPoint([8, 64, -3]);
  survival.damage(100, 'hostile');
  assert.equal(survival.dead, true);
  assert.deepEqual(survival.respawn([0, 70, 0]), [8, 64, -3]);
  assert.equal(survival.health, 20);
});

test('difficulty changes hostile health/damage and starvation rules', () => {
  const easy = new SurvivalSystem({ difficulty: 'easy' });
  const hard = new SurvivalSystem({ difficulty: 'hard' });
  assert.ok(easy.hostileHit() < hard.hostileHit());
  easy.health = 20;
  hard.health = 3;
  easy.hunger = hard.hunger = 0;
  easy.tick(80);
  hard.tick(80);
  assert.equal(easy.health, 10, 'easy starvation never passes five hearts');
  assert.equal(hard.dead, true, 'hard starvation can kill');
});

test('day/night brightness, night spawning, undead daylight burning and sleep work', () => {
  const clock = new DayNightSystem({ time: 12500 });
  clock.advance(1000, 'hard');
  assert.equal(clock.isNight, true);
  assert.equal(clock.hostiles.length, 1);
  assert.equal(clock.hostiles[0].health, 30);
  const survival = new SurvivalSystem();
  assert.equal(clock.sleep([2, 65, 2], survival), true);
  assert.equal(clock.time, 0);
  assert.deepEqual(survival.spawnPoint, [2, 65, 2]);
  assert.equal(clock.hostiles[0].burning, true);
});

test('till, plant and repeated light-dependent ticks grow and harvest all three crops', () => {
  for (const [seed, crop, produce] of [
    ['wheat_seeds', 'wheat', 'wheat'], ['carrot', 'carrots', 'carrot'], ['potato', 'potatoes', 'potato'],
  ]) {
    const world = new MutableWorld();
    const inventory = new Inventory();
    const farming = new FarmingSystem();
    world.setBlock(1, 2, 3, 'grass');
    inventory.add(seed, 1);
    assert.equal(farming.till(world, [1, 2, 3]), true);
    assert.equal(farming.plant([1, 2, 3], inventory, 0), true);
    assert.equal(farming.get([1, 2, 3]).crop, crop);
    assert.equal(farming.tick(5000, 4), 0, 'low light blocks growth');
    let events = 0;
    for (let i = 0; i < 7; i++) events += farming.tick(1200, 15);
    assert.equal(events, 7);
    assert.equal(farming.get([1, 2, 3]).stage, 7);
    const result = farming.harvest([1, 2, 3], inventory);
    assert.equal(result.produce, produce);
    assert.ok(inventory.count(produce) >= 3);
  }
});

test('survival, clock and farmland serialize cleanly for persistence', () => {
  const world = new MutableWorld();
  world.setBlock(0, 0, 0, 'dirt');
  const inventory = new Inventory();
  inventory.add('wheat_seeds', 1);
  const farming = new FarmingSystem();
  farming.till(world, [0, 0, 0]);
  farming.plant([0, 0, 0], inventory, 0);
  const survival = new SurvivalSystem({ difficulty: 'hard', health: 13 });
  const clock = new DayNightSystem({ time: 18000 });
  assert.equal(new SurvivalSystem(survival.serialize()).health, 13);
  assert.equal(new DayNightSystem(clock.serialize()).isNight, true);
  assert.equal(new FarmingSystem(farming.serialize()).get([0, 0, 0]).crop, 'wheat');
});
