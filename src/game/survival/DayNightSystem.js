import { DIFFICULTY } from './SurvivalSystem.js';

const DAY_TICKS = 24000;

export class DayNightSystem {
  constructor(state = {}) {
    this.time = ((state.time ?? 1000) % DAY_TICKS + DAY_TICKS) % DAY_TICKS;
    this.day = state.day ?? 1;
    this.hostiles = (state.hostiles ?? []).map((mob) => ({ ...mob }));
    this.nextMobId = state.nextMobId ?? 1;
    this.spawnClock = state.spawnClock ?? 0;
  }

  get isNight() { return this.time >= 13000 && this.time < 23000; }
  get brightness() {
    const phase = this.time / DAY_TICKS * Math.PI * 2;
    return Math.max(0.12, Math.min(1, 0.56 + Math.cos(phase - 0.25) * 0.5));
  }

  advance(ticks, difficulty = 'normal') {
    const previous = this.time;
    this.time = (this.time + ticks) % DAY_TICKS;
    if (previous + ticks >= DAY_TICKS) this.day += Math.floor((previous + ticks) / DAY_TICKS);
    if (this.isNight && difficulty !== 'peaceful') {
      this.spawnClock += ticks;
      while (this.spawnClock >= 600 && this.hostiles.length < 6) {
        this.spawnClock -= 600;
        this.spawnHostile(difficulty);
      }
    } else this.spawnClock = 0;
    this.burnUndead(ticks / 20);
    return this.snapshot();
  }

  spawnHostile(difficulty = 'normal', type = 'zombie') {
    if (difficulty === 'peaceful') return null;
    const mob = {
      id: this.nextMobId++, type,
      health: Math.round(20 * DIFFICULTY[difficulty].hostileHealth),
      damage: DIFFICULTY[difficulty].hostileDamage,
      burning: false,
    };
    this.hostiles.push(mob);
    return mob;
  }

  burnUndead(seconds = 1) {
    const daytime = !this.isNight && this.brightness > 0.65;
    for (const mob of this.hostiles) {
      mob.burning = daytime && ['zombie', 'skeleton'].includes(mob.type);
      if (mob.burning) mob.health = Math.max(0, mob.health - seconds);
    }
    this.hostiles = this.hostiles.filter((mob) => mob.health > 0);
  }

  sleep(position, survival) {
    if (!this.isNight) return false;
    survival.setSpawnPoint(position);
    this.time = 0;
    this.day += 1;
    this.burnUndead();
    return true;
  }

  snapshot() { return { time: this.time, day: this.day, isNight: this.isNight, brightness: this.brightness, hostiles: this.hostiles.map((mob) => ({ ...mob })) }; }
  serialize() { return { time: this.time, day: this.day, hostiles: this.hostiles, nextMobId: this.nextMobId, spawnClock: this.spawnClock }; }
}
