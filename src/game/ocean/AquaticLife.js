/**
 * AquaticLife — fish / dolphin entities and their swimming behaviour.
 *
 * Completion standard 16: dolphins, cod, salmon, tropical fish and pufferfish
 * with — dolphin basic swimming; pufferfish visible state change or damage when
 * a player approaches. Fish are catchable / releasable with a bucket (see
 * FishBucket.js); the dolphin is not bucket-caught.
 *
 * Positions are block-ish floats. Fish swim on their current heading through
 * water, kick off solid blocks / the surface and stay inside the world bounds.
 * The dolphin swims faster, can leap above the surface, and approaches a nearby
 * player (friendly follow), otherwise it roams near its anchor point.
 */

export const FISH_SPECIES = ['cod', 'salmon', 'tropical_fish', 'pufferfish'];

export const SPECIES_PROPS = {
  cod: { speed: 1.1, size: 0.5, hp: 1, catchable: true, meta: 'common' },
  salmon: { speed: 1.5, size: 0.7, hp: 1, catchable: true, meta: 'migratory' },
  tropical_fish: { speed: 1.2, size: 0.4, hp: 1, catchable: true, meta: 'colourful' },
  pufferfish: { speed: 0.9, size: 0.5, hp: 1, catchable: true, meta: 'puffs_neary' },
};

/** Wandering aquatic mob state. */
export class Fish {
  constructor(species, x, y, z, opts = {}) {
    if (!(species in SPECIES_PROPS)) {
      throw new Error(`Unknown fish species: ${species}`);
    }
    this.species = species;
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = opts.yaw ?? Math.random() * Math.PI * 2;
    this.speed = opts.speed ?? SPECIES_PROPS[species].speed;
    this.hp = SPECIES_PROPS[species].hp;
    this.size = SPECIES_PROPS[species].size;
    this.catchable = SPECIES_PROPS[species].catchable;
    // Pufferfish inflation state.
    this.puffed = false;
    this.inflate = 0; // 0..1 animation amount
    // Species-specific behaviour metadata.
    this.level = opts.level ?? (species === 'salmon' ? 3 : 1); // mid/upper water
  }
}

/** A dolphin: fast swimmer, friendly, leaps, follows a nearby player. */
export class Dolphin {
  constructor(x, y, z, opts = {}) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = opts.yaw ?? Math.random() * Math.PI * 2;
    this.speed = opts.speed ?? 2.6; // noticeably faster than fish
    this.size = 1.0;
    this.surface = opts.surface ?? 4; // target waterline for leaping
    this.leapTimer = 0;
    this.leaping = false;
  }
}

const EPS = 1e-3;

function inBounds(x, y, z, opts) {
  const { x0 = -10, x1 = 10, z0 = -10, z1 = 10, y0 = 1, y1 = 5 } = opts;
  return x >= x0 && x <= x1 && z >= z0 && z <= z1 && y >= y0 && y <= y1;
}

/**
 * Advance a wandering fish by dt. It swims along `yaw`; when it would leave the
 * water column or hit solid terrain it picks a new random heading (and returns
 * to its level band). Kept pure-ish: returns a "bounced" flag.
 */
export function updateFish(fish, world, dt, opts = {}) {
  const props = SPECIES_PROPS[fish.species];
  const bounds = opts.bounds ?? {};
  // Occasionally pick a new wander heading.
  if (Math.random() < (opts.retarget ?? 0.05)) {
    fish.yaw = Math.random() * Math.PI * 2;
  }
  const speed = (opts.speedFactor ?? 1) * props.speed;
  let nx = fish.x + Math.sin(fish.yaw) * speed * dt;
  let nz = fish.z + Math.cos(fish.yaw) * speed * dt;
  let ny = fish.y + (Math.random() - 0.5) * speed * 0.4 * dt;

  // Keep inside the water: wander back toward the species level band.
  const band = fish.level; // y band the fish prefers (1 = bottom, 3 = mid)
  const targetY = 1 + (band - 1) * 0.6;
  ny += (targetY - ny) * 0.3 * dt;

  let bounced = false;
  if (!world.isWater(Math.floor(nx), Math.floor(fish.y), Math.floor(nz))) {
    fish.yaw = Math.random() * Math.PI * 2;
    bounced = true;
  } else if (!world.isWater(Math.floor(fish.x), Math.floor(ny), Math.floor(fish.z))) {
    bounced = true;
  } else {
    fish.x = nx; fish.y = ny; fish.z = nz;
  }
  if (!inBounds(fish.x, fish.y, fish.z, bounds)) bounced = true;
  return { bounced };
}

/**
 * Advance a dolphin. It swims quickly, occasionally leaps above the surface, and
 * follows a nearby `player` (friendly). Returns { following, leaping }.
 */
export function updateDolphin(dolphin, world, dt, opts = {}) {
  const bounds = opts.bounds ?? {};
  const player = opts.player;
  const followRange = opts.followRange ?? 6;
  const speed = (opts.speedFactor ?? 1) * dolphin.speed;

  let following = false;
  if (player) {
    const d = Math.hypot(player.x - dolphin.x, player.z - dolphin.z);
    if (d < followRange) {
      following = true;
      // Head toward the player, keep near the surface so it can leap.
      const dx = player.x - dolphin.x, dz = player.z - dolphin.z;
      dolphin.yaw = Math.atan2(dx, dz);
      dolphin.x += Math.sin(dolphin.yaw) * speed * dt;
      dolphin.z += Math.cos(dolphin.yaw) * speed * dt;
      dolphin.y += (dolphin.surface - 0.5 - dolphin.y) * 0.27 * dt;
    }
  }

  if (!following) {
    // Roam near its anchor at the surface band.
    if (Math.random() < (opts.retarget ?? 0.04)) dolphin.yaw = Math.random() * Math.PI * 2;
    dolphin.x += Math.sin(dolphin.yaw) * speed * dt;
    dolphin.z += Math.cos(dolphin.yaw) * speed * dt;
    dolphin.y += (dolphin.surface - 0.5 - dolphin.y) * 0.2 * dt;
  }

  // Leaping: periodically pop above the surface then fall back.
  dolphin.leapTimer -= dt;
  if (dolphin.leapTimer <= 0 && !dolphin.leaping) {
    dolphin.leaping = true;
    dolphin.leapTimer = (opts.leapInterval ?? 4) + Math.random() * 2;
  }
  if (dolphin.leaping) {
    dolphin.y += speed * 0.6 * dt;
    if (dolphin.y >= dolphin.surface + 1.4) {
      dolphin.y = dolphin.surface + 1.4;
      dolphin.leaping = false;
    }
  }

  // Never swim into solid terrain or out of bounds.
  if (world.isSolid(Math.floor(dolphin.x), Math.floor(dolphin.y), Math.floor(dolphin.z))) {
    dolphin.yaw = Math.random() * Math.PI * 2;
  }
  if (!inBounds(dolphin.x, dolphin.y, dolphin.z, bounds)) {
    dolphin.x = Math.max(bounds.x0 ?? -10, Math.min(bounds.x1 ?? 10, dolphin.x));
    dolphin.z = Math.max(bounds.z0 ?? -10, Math.min(bounds.z1 ?? 10, dolphin.z));
  }
  return { following, leaping: dolphin.leaping };
}

/**
 * Pufferfish body: computes the inflation state from the player's proximity and
 * returns applied damage. When the player is within `puffRadius` the pufferfish
 * inflates (`inflate` ramps 0→1), and when puffed and the player is within
 * `damageRadius` it deals damage (once per second) via `player.takeDamage`.
 *
 * Returns { state: 'normal'|'puffed', inflate, damaged }.
 */
export function updatePufferfish(fish, world, dt, opts = {}) {
  const puffRadius = opts.puffRadius ?? 3.5;
  const damageRadius = opts.damageRadius ?? 1.0;
  const damage = opts.damage ?? 1;
  const player = opts.player;

  let dist = Infinity;
  if (player) {
    dist = Math.hypot(fish.x - player.x, fish.y - (player.y + 1), fish.z - player.z);
  }
  const near = dist <= puffRadius;
  fish.puffed = near;
  // Ramp the visual inflation amount smoothly.
  fish.inflate = Math.max(0, Math.min(1, fish.inflate + (near ? dt * 3 : -dt * 3)));

  let damaged = false;
  if (player && fish.puffed && dist <= damageRadius && typeof player.takeDamage === 'function') {
    fish._dmgAccum = (fish._dmgAccum ?? 0) + dt;
    if (fish._dmgAccum >= (opts.damageInterval ?? 1)) {
      fish._dmgAccum = 0;
      player.takeDamage(damage);
      damaged = true;
    }
  } else if (!fish.puffed) {
    fish._dmgAccum = 0;
  }

  return { state: fish.puffed ? 'puffed' : 'normal', inflate: fish.inflate, damaged };
}
