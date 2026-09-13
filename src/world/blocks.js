/**
 * Block registry. Original block-type table (not copied from any Minecraft
 * asset). We use integer ids internally; a separate rendering/interaction
 * module maps ids to textures/hardness + behaviors. This module owns the
 * canonical id set so the world generator and later systems share one source.
 */

export const Block = Object.freeze({
  AIR: 0,
  STONE: 1,
  DIRT: 2,
  GRASS: 3,
  SAND: 4,
  SANDSTONE: 5,
  WATER: 8,
  WOOD_LOG: 17,
  LEAVES: 18,
  GRAVEL: 13,
  SNOW: 78,
  BEDROCK: 7,
});

/** Surface/layer blocks per biome, decided by the generator. */
export const LAYER = Object.freeze({
  surface: {
    plains: Block.GRASS,
    forest: Block.GRASS,
    desert: Block.SAND,
    mountains: Block.STONE,
    beach: Block.SAND,
  },
  subsurface: {
    plains: Block.DIRT,
    forest: Block.DIRT,
    desert: Block.SANDSTONE,
    mountains: Block.STONE,
    beach: Block.SAND,
  },
  oceanFloor: {
    warm: Block.SAND,
    cold: Block.SAND,
    deep: Block.GRAVEL,
    shallow: Block.SAND,
  },
});
