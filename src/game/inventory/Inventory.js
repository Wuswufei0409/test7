import { getBlockDefinition } from '../blocks/catalog.js';

function cloneStack(stack) {
  return stack ? { itemId: stack.itemId, count: stack.count } : null;
}

function validateStack(stack) {
  if (!stack || !getBlockDefinition(stack.itemId) || !Number.isInteger(stack.count) || stack.count < 1) {
    throw new Error('Invalid inventory stack');
  }
  const max = getBlockDefinition(stack.itemId).maxStack ?? 64;
  if (stack.count > max) throw new Error('Stack exceeds maximum');
}

export class Inventory {
  constructor({ size = 36, hotbarSize = 9 } = {}) {
    if (hotbarSize !== 9 || size < hotbarSize) throw new Error('Inventory requires a 9-slot hotbar');
    this.size = size;
    this.hotbarSize = hotbarSize;
    this.slots = Array(size).fill(null);
    this.selected = 0;
  }

  get current() {
    return this.slots[this.selected];
  }

  select(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.hotbarSize) return false;
    this.selected = index;
    return true;
  }

  add(itemId, count = 1) {
    const definition = getBlockDefinition(itemId);
    if (!definition || itemId === 'air' || !Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid item stack: ${itemId} x${count}`);
    }
    const max = definition.maxStack ?? 64;
    let remaining = count;
    for (const stack of this.slots) {
      if (stack?.itemId !== itemId || stack.count >= max) continue;
      const moved = Math.min(max - stack.count, remaining);
      stack.count += moved;
      remaining -= moved;
      if (!remaining) return 0;
    }
    for (let i = 0; i < this.slots.length && remaining; i++) {
      if (this.slots[i]) continue;
      const moved = Math.min(max, remaining);
      this.slots[i] = { itemId, count: moved };
      remaining -= moved;
    }
    return remaining;
  }

  remove(index, count = 1) {
    const stack = this.slots[index];
    if (!stack || !Number.isInteger(count) || count < 1) return null;
    const removed = Math.min(count, stack.count);
    const result = { itemId: stack.itemId, count: removed };
    stack.count -= removed;
    if (stack.count === 0) this.slots[index] = null;
    return result;
  }

  split(index, count = null, targetIndex = null) {
    const stack = this.slots[index];
    if (!stack || stack.count < 2) return null;
    const amount = count ?? Math.ceil(stack.count / 2);
    if (!Number.isInteger(amount) || amount < 1 || amount >= stack.count) return null;
    if (targetIndex !== null && (targetIndex < 0 || targetIndex >= this.size || this.slots[targetIndex])) return null;
    const split = { itemId: stack.itemId, count: amount };
    stack.count -= amount;
    if (targetIndex !== null) this.slots[targetIndex] = split;
    return cloneStack(split);
  }

  swap(a, b) {
    if (![a, b].every((i) => Number.isInteger(i) && i >= 0 && i < this.size)) return false;
    [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
    return true;
  }

  dropAll(position = [0, 0, 0]) {
    const drops = [];
    for (let i = 0; i < this.slots.length; i++) {
      const stack = this.slots[i];
      if (!stack) continue;
      drops.push({ ...cloneStack(stack), position: [...position] });
      this.slots[i] = null;
    }
    return drops;
  }

  count(itemId) {
    return this.slots.reduce((sum, stack) => sum + (stack?.itemId === itemId ? stack.count : 0), 0);
  }

  serialize() {
    return { size: this.size, hotbarSize: this.hotbarSize, selected: this.selected, slots: this.slots.map(cloneStack) };
  }

  static deserialize(data) {
    if (!data || !Number.isInteger(data.size) || !Array.isArray(data.slots) || data.slots.length !== data.size) {
      throw new Error('Invalid inventory data');
    }
    const inventory = new Inventory({ size: data.size, hotbarSize: data.hotbarSize });
    inventory.slots = data.slots.map((stack) => {
      if (stack) validateStack(stack);
      return cloneStack(stack);
    });
    if (!inventory.select(data.selected)) throw new Error('Invalid selected hotbar slot');
    return inventory;
  }
}

