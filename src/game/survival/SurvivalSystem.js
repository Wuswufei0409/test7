import { getBlockDefinition } from '../blocks/catalog.js';

export const DIFFICULTY = Object.freeze({
  peaceful: { hostileDamage: 0, hostileHealth: 0, starvationFloor: 20 },
  easy: { hostileDamage: 2, hostileHealth: 0.75, starvationFloor: 10 },
  normal: { hostileDamage: 3, hostileHealth: 1, starvationFloor: 1 },
  hard: { hostileDamage: 4.5, hostileHealth: 1.5, starvationFloor: 0 },
});

export class SurvivalSystem {
  constructor(state = {}) {
    this.maxHealth = 20;
    this.maxHunger = 20;
    this.health = state.health ?? 20;
    this.hunger = state.hunger ?? 20;
    this.saturation = state.saturation ?? 5;
    this.difficulty = DIFFICULTY[state.difficulty] ? state.difficulty : 'normal';
    this.spawnPoint = state.spawnPoint ? [...state.spawnPoint] : null;
    this.dead = !!state.dead;
    this.exhaustion = state.exhaustion ?? 0;
    this.starveClock = 0;
    this.lastDamage = null;
  }

  setDifficulty(value) {
    if (!DIFFICULTY[value]) throw new Error(`Unknown difficulty: ${value}`);
    this.difficulty = value;
  }

  damage(amount, source = 'generic') {
    const applied = Math.max(0, Number(amount) || 0);
    if (this.dead || !applied) return 0;
    this.health = Math.max(0, this.health - applied);
    this.lastDamage = { source, amount: applied };
    if (this.health === 0) this.dead = true;
    return applied;
  }

  hostileHit(baseDamage = 3) {
    return this.damage(baseDamage * DIFFICULTY[this.difficulty].hostileDamage / 3, 'hostile');
  }

  fall(distance) {
    return this.damage(Math.max(0, Math.floor(distance - 3)), 'fall');
  }

  drown(secondsWithoutAir = 0) {
    return secondsWithoutAir >= 2 ? this.damage(2, 'drowning') : 0;
  }

  melee(amount = 1) {
    return this.damage(amount, 'melee');
  }

  addExhaustion(amount) {
    this.exhaustion += Math.max(0, amount);
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }
  }

  eat(inventory, slot = inventory.selected) {
    const stack = inventory.slots[slot];
    const food = getBlockDefinition(stack?.itemId);
    if (!stack || !food?.food || this.hunger >= this.maxHunger) return false;
    inventory.remove(slot, 1);
    this.hunger = Math.min(this.maxHunger, this.hunger + food.food);
    this.saturation = Math.min(this.hunger, this.saturation + food.saturation);
    return true;
  }

  tick(seconds) {
    if (this.dead) return;
    this.addExhaustion(seconds * 0.05);
    if (this.hunger >= 18 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + seconds * 0.15);
      this.addExhaustion(seconds * 0.25);
    }
    if (this.hunger === 0) {
      this.starveClock += seconds;
      while (this.starveClock >= 4) {
        this.starveClock -= 4;
        if (this.health > DIFFICULTY[this.difficulty].starvationFloor) this.damage(1, 'starvation');
      }
    }
  }

  setSpawnPoint(position) { this.spawnPoint = [...position]; }

  respawn(fallbackPosition) {
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.saturation = 5;
    this.dead = false;
    this.lastDamage = null;
    return [...(this.spawnPoint ?? fallbackPosition)];
  }

  serialize() {
    return { health: this.health, hunger: this.hunger, saturation: this.saturation, difficulty: this.difficulty, spawnPoint: this.spawnPoint, dead: this.dead, exhaustion: this.exhaustion };
  }
}
