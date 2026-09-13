import { AIR, getBlockDefinition, requireBlockDefinition } from '../blocks/catalog.js';

function intersectsPlayer(position, bounds) {
  if (!bounds) return false;
  const [x, y, z] = position;
  return x < bounds.max[0] && x + 1 > bounds.min[0] &&
    y < bounds.max[1] && y + 1 > bounds.min[1] &&
    z < bounds.max[2] && z + 1 > bounds.min[2];
}

export class DropManager {
  constructor() {
    this.entities = [];
    this.nextId = 1;
  }

  spawn(itemId, count, position) {
    const entity = { id: this.nextId++, itemId, count, position: [...position], age: 0 };
    this.entities.push(entity);
    return entity;
  }

  pickupNearby(inventory, position, radius = 1.75) {
    let picked = 0;
    this.entities = this.entities.filter((entity) => {
      if (Math.hypot(...entity.position.map((value, i) => value - position[i])) > radius) return true;
      const remainder = inventory.add(entity.itemId, entity.count);
      picked += entity.count - remainder;
      entity.count = remainder;
      return remainder > 0;
    });
    return picked;
  }

  serialize() {
    return this.entities.map((entity) => ({ ...entity, position: [...entity.position] }));
  }
}

export class MiningController {
  constructor() {
    this.targetKey = null;
    this.progress = 0;
  }

  reset() {
    this.targetKey = null;
    this.progress = 0;
  }

  update(world, position, seconds, drops, { toolSpeed = 1, canHarvest = true, dropItem = null } = {}) {
    const targetKey = position.join(',');
    if (targetKey !== this.targetKey) {
      this.targetKey = targetKey;
      this.progress = 0;
    }
    const blockId = world.getBlock(...position);
    const block = getBlockDefinition(blockId);
    if (!block || blockId === AIR || !Number.isFinite(block.hardness)) return { broken: false, progress: 0 };
    this.progress += Math.max(0, seconds) * Math.max(0.01, toolSpeed);
    const ratio = Math.min(1, this.progress / block.hardness);
    if (ratio < 1) return { broken: false, progress: ratio };
    world.setBlock(...position, AIR);
    const drop = canHarvest ? drops.spawn(dropItem ?? block.drop, 1, position.map((value) => value + 0.5)) : null;
    this.reset();
    return { broken: true, progress: 1, drop };
  }
}

export function canPlaceBlock(world, position, blockId, playerBounds = null) {
  const block = requireBlockDefinition(blockId);
  if (!block.placeable || world.getBlock(...position) !== AIR) return false;
  return !intersectsPlayer(position, playerBounds);
}

export function placeSelectedBlock(inventory, world, position, playerBounds = null) {
  const stack = inventory.current;
  if (!stack || !canPlaceBlock(world, position, stack.itemId, playerBounds)) return false;
  world.setBlock(...position, stack.itemId);
  inventory.remove(inventory.selected, 1);
  return true;
}
