/**
 * OceanFeatures — ocean terrain generation with the M5 feature set.
 *
 * Completion standard 15: the ocean contains coral reefs, kelp / sea-grass,
 * icebergs, shipwrecks, underwater ruins and buried treasure. A treasure map or
 * equivalent clues (see Treasure.js) guides the player to a diggable reward.
 *
 * This module builds a self-contained, deterministic ocean basin (floor +
 * water column + shore rim), then scatters the six feature types. Every feature
 * function is also exported so tests / demos can place them independently.
 */

import { B, SOLID, PLANT } from './blocks.js';

/** Deterministic PRNG (mulberry32) so generation is reproducible per seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Build a complete ocean basin: sand floor at `floorY`, water from floorY+1 up
 * to `seaLevel`, and a solid shore rim at `shoreY = seaLevel + 1` on all four
 * sides so the water is contained (like the M4 test tank). Features are then
 * placed at deterministic positions derived from `seed`.
 *
 * Returns the placed `features` descriptor.
 */
export function buildOcean(world, opts = {}) {
  const {
    seed = 1,
    x0 = -10, z0 = -10, x1 = 10, z1 = 10,
    floorY = 0, seaLevel = 4, shoreY = 5,
    coralBlocks = 22, kelpColumns = 6, seagrassPatches = 5,
  } = opts;
  const rng = mulberry32(seed);

  // Floor (sand + some gravel patches).
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const desc = rng() < 0.15 ? SOLID.gravel : SOLID.sand;
      world.setBlock(x, floorY, z, desc);
    }
  }
  // Water column.
  world.fillBox(x0, floorY + 1, z0, x1, seaLevel, z1, { id: B.WATER, water: true, solid: false });
  // Shore rim (solid land above water) on all four edges.
  world.fillBox(x0, shoreY, z0, x1, shoreY + 1, z1, { ...SOLID.sand }); // outer ring top
  world.fillBox(x0, seaLevel + 1, z0, x0, shoreY + 1, z1, { ...SOLID.sand });
  world.fillBox(x1, seaLevel + 1, z0, x1, shoreY + 1, z1, { ...SOLID.sand });
  world.fillBox(x0, seaLevel + 1, z0, x1, shoreY + 1, z0, { ...SOLID.sand });
  world.fillBox(x0, seaLevel + 1, z1, x1, shoreY + 1, z1, { ...SOLID.sand });

  // Deterministic feature placement inside the basin (away from rim).
  const cx = Math.floor((x0 + x1) / 2), cz = Math.floor((z0 + z1) / 2);

  const coral = addCoralReef(world, {
    center: [cx - 4, cz - 5], blocks: coralBlocks, rng,
  });
  const kelp = addKelpForest(world, {
    base: [cx + 1, cz + 4], columns: kelpColumns, seaLevel, rng,
  });
  const seagrass = addSeagrassField(world, {
    center: [cx + 4, cz + 5], patches: seagrassPatches, rng,
  });
  const iceberg = addIceberg(world, {
    center: [cx + 6, cz - 6], seaLevel,
  });
  const shipwreck = addShipwreck(world, {
    origin: [cx - 6, cz + 6], floorY, seaLevel,
  });
  const ruins = addUnderwaterRuins(world, {
    origin: [cx + 6, cz + 6], floorY,
  });
  const treasure = addBuriedTreasure(world, {
    at: [cx - 1, cz - 7], floorY,
  });

  return {
    coralReef: coral,
    kelp: kelp,
    seagrass: seagrass,
    iceberg,
    shipwreck,
    ruins,
    buriedTreasure: treasure,
  };
}

/** Cluster of coral blocks + fans on the sea floor. */
export function addCoralReef(world, opts) {
  const [[cx, cz], { blocks = 20, rng = mulberry32(7) } = {}] = [opts.center, opts];
  const minY = opts.minY ?? 1, maxY = opts.maxY ?? 2;
  for (let i = 0; i < blocks; i++) {
    const x = cx + randInt(rng, -3, 3);
    const z = cz + randInt(rng, -3, 3);
    const y = minY + randInt(rng, 0, maxY - minY);
    // Only place in water / on water-covered floor; skip features & rim.
    if (world.isSolid(x, y, z)) continue;
    const blk = world.getBlock(x, y, z);
    if (blk.water) {
      world.setBlock(x, y, z, { ...SOLID.coralBlock });
    }
  }
  // A few non-solid coral fans on top for colour.
  for (let i = 0; i < 6; i++) {
    const x = cx + randInt(rng, -3, 3);
    const z = cz + randInt(rng, -3, 3);
    const y = 2;
    if (!world.isSolid(x, y, z) && !world.isSolid(x, 1, z) && world.isWater(x, y, z)) {
      world.setBlock(x, y, z, { ...PLANT.coralFan });
    }
  }
  return { type: 'coralReef', center: [cx, cz], blocks };
}

/** Tall kelp columns rising from the floor, plus a seagrass ring at the base. */
export function addKelpForest(world, opts) {
  const [[bx, bz], { columns = 5, seaLevel = 4, rng = mulberry32(11) } = {}] = [opts.base, opts];
  const made = [];
  for (let i = 0; i < columns; i++) {
    const x = bx + randInt(rng, -2, 2);
    const z = bz + randInt(rng, -2, 2);
    const floor = 1; // water starts at floorY+1 (floorY=0)
    // grow from the floor up toward but not above the surface
    const height = seaLevel - floor - randInt(rng, 0, 1); // 1..3 tall
    let ok = true;
    for (let y = floor; y < floor + height; y++) {
      if (world.isSolid(x, y, z)) { ok = false; break; }
    }
    if (!ok) continue;
    for (let y = floor; y < floor + height; y++) {
      world.setBlock(x, y, z, { ...PLANT.kelp });
    }
    made.push([x, floor, z]);
  }
  return { type: 'kelpForest', base: [bx, bz], grown: made.length };
}

/** Scattered seagrass patches on the sea floor. */
export function addSeagrassField(world, opts) {
  const [[cx, cz], { patches = 5, rng = mulberry32(13) } = {}] = [opts.center, opts];
  let count = 0;
  for (let i = 0; i < patches * 4; i++) {
    const x = cx + randInt(rng, -4, 4);
    const z = cz + randInt(rng, -4, 4);
    const y = 1;
    if (world.isSolid(x, y, z)) continue;
    if (!world.isWater(x, y, z)) continue;
    if (world.isSolid(x, y - 1, z)) { // growing out of the sand floor
      world.setBlock(x, y, z, { ...PLANT.seagrass });
      count++;
    }
  }
  return { type: 'seagrass', center: [cx, cz], grown: count };
}

/** Iceberg: a cluster of ice blocks partially above and below the waterline. */
export function addIceberg(world, opts) {
  const [[cx, cz], { seaLevel = 4, rng = mulberry32(17) } = {}] = [opts.center, opts];
  const made = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > 3) continue; // roughly round
      if (rng() < 0.25) continue; // ragged edges
      const x = cx + dx, z = cz + dz;
      // submerged part y=2..3, surface/above part y=4..5
      for (let y = 2; y <= seaLevel + 1; y++) {
        if (world.isSolid(x, y, z)) continue;
        world.setBlock(x, y, z, { ...SOLID.ice });
        made.push([x, y, z]);
      }
    }
  }
  return { type: 'iceberg', center: [cx, cz], blocks: made.length, seaLevel };
}

/** Sunken shipwreck: deck planks + partial hull + a mast, resting on the floor. */
export function addShipwreck(world, opts) {
  const [[ox, oz], { floorY = 0, seaLevel = 4, rng = mulberry32(23) } = {}] = [opts.origin, opts];
  const d = 3; // half-length
  const deckY = floorY + 2;
  for (let dx = -d; dx <= d; dx++) {
    for (let dz = -d; dz <= d; dz++) {
      // deck (planks) at deckY
      if (Math.abs(dx) <= d && Math.abs(dz) <= d && !world.isSolid(ox + dx, deckY, oz + dz)) {
        world.setBlock(ox + dx, deckY, oz + dz, { ...SOLID.plank });
      }
      // hull sides (wood) a bit lower, with a few missing planks for character
      if (Math.abs(dx) === d || Math.abs(dz) === d) {
        if (rng() < 0.35) continue; // broken hull gaps
        if (!world.isSolid(ox + dx, floorY + 1, oz + dz)) {
          world.setBlock(ox + dx, floorY + 1, oz + dz, { ...SOLID.wood });
        }
      }
    }
  }
  // mast rising from the deck
  for (let y = deckY + 1; y <= seaLevel + 1; y++) {
    if (!world.isSolid(ox, y, oz)) world.setBlock(ox, y, oz, { ...SOLID.wood });
  }
  return { type: 'shipwreck', origin: [ox, oz], deckY, seaLevel };
}

/** Underwater ruins: prismarine/stonebrick pillars + a broken arch. */
export function addUnderwaterRuins(world, opts) {
  const [[ox, oz], { floorY = 0, rng = mulberry32(29) } = {}] = [opts.origin, opts];
  const made = [];
  const pillars = [
    [-3, -3], [-3, 3], [3, -3], [3, 3],
    [0, -3], [0, 3], [-3, 0], [3, 0],
  ];
  for (const [px, pz] of pillars) {
    const h = 1 + randInt(rng, 1, 3);
    for (let y = floorY + 1; y <= floorY + h && y >= floorY + 1; y++) {
      if (world.isSolid(ox + px, y, oz + pz)) continue;
      const mat = Math.abs(px) + Math.abs(pz) === 6 ? SOLID.prismarine : SOLID.stonebrick;
      world.setBlock(ox + px, y, oz + pz, { ...mat });
      made.push([ox + px, y, oz + pz]);
    }
  }
  // a broken arch across the west pillars
  for (let pz = -3; pz <= 3; pz++) {
    const y = floorY + 2;
    if (world.isSolid(ox - 3, y, oz + pz)) continue;
    if (rng() < 0.3) continue; // broken section
    world.setBlock(ox - 3, y, oz + pz, { ...SOLID.stonebrick });
    made.push([ox - 3, y, oz + pz]);
  }
  return { type: 'underwaterRuins', origin: [ox, oz], made: made.length };
}

/**
 * Bury a treasure chest in the sea floor: chest at (x, floorY, z) covered by
 * sand at (x, floorY+1, z). Digging the sand reveals the chest, which yields
 * the reward (see Treasure.digTreasure).
 */
export function addBuriedTreasure(world, opts) {
  const [[bx, bz], { floorY = 0 } = {}] = [opts.at, opts];
  const chestX = bx, chestY = floorY, chestZ = bz;
  // Replace the sand floor cell with a chest and cover it with sand.
  world.setBlock(chestX, chestY, chestZ, { ...SOLID.chest });
  world.setBlock(chestX, chestY + 1, chestZ, { ...SOLID.sand });
  world.setBlock(chestX, chestY + 2, chestZ, { ...SOLID.sand }); // fully buried
  return {
    type: 'buriedTreasure',
    chest: [chestX, chestY, chestZ],
    cover: [[chestX, chestY + 1, chestZ], [chestX, chestY + 2, chestZ]],
    dug: false,
  };
}

/** Count how many of the six feature types are present in the world. */
export function detectFeatures(world) {
  const out = { coralReef: 0, kelp: 0, seagrass: 0, iceberg: 0, shipwreck: 0, ruins: 0 };
  for (const key of world.cells.keys()) {
    const blk = world.getBlock(...key.split(',').map(Number));
    switch (blk.id) {
      case B.CORAL_BLOCK:
      case B.CORAL_FAN: out.coralReef++; break;
      case B.KELP: out.kelp++; break;
      case B.SEAGRASS: out.seagrass++; break;
      case B.ICE: out.iceberg++; break;
      case B.WOOD:
      case B.PLANK: out.shipwreck++; break;
      case B.STONEBRICK:
      case B.PRISMARINE: out.ruins++; break;
    }
  }
  return out;
}
