/**
 * World generator: deterministic, seed-reproducible procedural terrain.
 *
 * All terrain values are pure functions of the integer world coordinates and
 * the seed, so generating any chunk independently (in any order, any time)
 * yields identical block data. This is what lets us verify that a fixed seed
 * reproduces identical terrain.
 *
 * The generator is decoupled from rendering: it operates on integer block
 * coordinates and returns block ids / biome for queries. Chunking is handled
 * by WorldChunkManager over this generator.
 */

import { fbm2, hashUnit } from './random.js';
import { Block, LAYER } from './blocks.js';
import { BIOMES } from './biomes.js';

export const SEA_LEVEL = 18; // water surface height (blocks)
export const WORLD_HEIGHT = 64; // column height (blocks above bedrock)
export const CHUNK_SIZE = 16;

/** Continuous climate fields at an (x, z) world position. All pure. */
export function climate(x, z, seed) {
  // continentalness: large-scale land mass vs ocean; larger => more land.
  // Bias so roughly half the world is land.
  const continent = fbm2(x * 0.004, z * 0.004, seed * 31 + 1, 5) * 0.6 +
                    fbm2(x * 0.011, z * 0.011, seed * 31 + 3, 3) * 0.4;
  // elevation detail (hills / mountains sculpting).
  const euler = fbm2(x * 0.02, z * 0.02, seed * 17 + 7, 4);
  // temperature: warm at low noise, cold at high; mix a latitude-ish term.
  const temp = fbm2(x * 0.008, z * 0.008, seed * 5 + 13, 3) * 0.7 +
               fbm2(x * 0.002, z * 0.002, seed * 5 + 29, 2) * 0.3;
  // humidity: high => forests/green, low => desert.
  const humid = fbm2(x * 0.012, z * 0.012, seed * 7 + 41, 4);
  return { continent, euler, temp, humid };
}

/** Surface land height at (x, z) in the range roughly [SEA_LEVEL-9, SEA_LEVEL+40]. */
export function landHeight(x, z, seed) {
  const { continent, euler } = climate(x, z, seed);
  // Base terrain follows continental shape + local hills, biased up so that
  // a good fraction of the world is above sea level.
  const base = SEA_LEVEL + 2 + continent * 26 + euler * 8;
  // Mountains: a distinct high-frequency mask that pushes extreme peaks.
  const mountMask = fbm2(x * 0.012, z * 0.012, seed * 11 + 61, 4);
  let h = base;
  if (mountMask > 0.12) h += (mountMask - 0.12) * 110;
  return Math.round(h);
}

/** Classify a column into a biome based on climate fields. */
export function classifyBiome(x, z, seed) {
  const { temp, humid } = climate(x, z, seed);
  const h = landHeight(x, z, seed);
  const seaDiff = SEA_LEVEL - h; // >0 means below sea level

  if (seaDiff > 1) {
    // Ocean biome by depth + temperature.
    if (seaDiff > 12) return BIOMES.DEEP_OCEAN;
    if (temp > 0.15) return BIOMES.WARM_OCEAN;
    if (temp < -0.15) return BIOMES.COLD_OCEAN;
    return BIOMES.OCEAN;
  }

  // Land.
  if (h > SEA_LEVEL + 16) return BIOMES.MOUNTAINS;
  if (h <= SEA_LEVEL + 1) return BIOMES.BEACH;
  if (humid < -0.12) return BIOMES.DESERT;
  if (humid > 0.04) return BIOMES.FOREST;
  return BIOMES.PLAINS;
}

/** Map any ocean-ish biome to a floor layer bucket. */
function oceanBucket(biome) {
  if (biome === BIOMES.DEEP_OCEAN) return 'deep';
  if (biome === BIOMES.WARM_OCEAN) return 'warm';
  if (biome === BIOMES.COLD_OCEAN) return 'cold';
  return 'shallow'; // generic ocean / shallow
}

/**
 * Fill one vertical column of blocks for a given world (x, z).
 * Returns the column block ids indexed by y in [0, WORLD_HEIGHT).
 */
export function generateColumn(x, z, seed) {
  const biome = classifyBiome(x, z, seed);
  const height = landHeight(x, z, seed);
  const col = new Array(WORLD_HEIGHT).fill(Block.AIR);
  col[0] = Block.BEDROCK;

  const isOcean = [BIOMES.OCEAN, BIOMES.DEEP_OCEAN, BIOMES.WARM_OCEAN,
    BIOMES.COLD_OCEAN, BIOMES.SHALLOW_OCEAN].includes(biome);

  if (isOcean) {
    const floor = LAYER.oceanFloor[oceanBucket(biome)] ?? Block.SAND;
    for (let y = 1; y <= height; y++) {
      col[y] = y === height ? floor : Block.STONE;
    }
    // water column above the floor up to sea level.
    for (let y = height + 1; y <= SEA_LEVEL; y++) col[y] = Block.WATER;
    return { biome, height, col };
  }

  const surface = LAYER.surface[biome] ?? Block.GRASS;
  const subsurface = LAYER.subsurface[biome] ?? Block.DIRT;
  for (let y = 1; y <= height; y++) {
    if (y === height) col[y] = surface;
    else if (y >= height - 2) col[y] = subsurface;
    else col[y] = Block.STONE;
  }

  return { biome, height, col };
}
