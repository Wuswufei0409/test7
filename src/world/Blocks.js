/**
 * Blocks.js
 * R1 (MUL-34) — Block registry mapping block ids to atlas tiles per face.
 * This is a render-level registry consumed by the chunk mesher. The M1
 * (interaction/inventory) issue will extend it with hardness/tool/stack
 * semantics; here we keep it render-focused so the world is visible.
 */

import { TILES } from '../textures/Atlas.js';

// Rock types available to the renderer (>=30 distinguishable blocks is the
// M1 acceptance bar; the renderer supports the full set here so the closed
// loop can light up once interaction lands.)
export const Block = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  LOG: 6,
  PLANKS: 7,
  LEAVES: 8,
  COBBLE: 9,
  BRICKS: 10,
  SNOW: 11,
  BEDROCK: 12,
  GRAVEL: 13,
  GLASS: 14,
  SANDSTONE: 15,
  COAL_ORE: 16,
  IRON_ORE: 17,
  GOLD_ORE: 18,
  DIAMOND_ORE: 19,
  CLAY: 20,
  WOOL: 21,
  RED_MUSHROOM: 22,
  BROWN_MUSHROOM: 23,
  TALL_GRASS: 24,
  FLOWER: 25,
  CACTUS: 26,
  OBSIDIAN: 27,
  ICE: 28,
  CORAL: 29,
  KELP: 30,
};

export const SOLID_BLOCKS = new Set(Object.values(Block).filter((b) => b !== Block.AIR));

/**
 * Face tiles: top, bottom, side (south), plus north/east/west use 'side'
 * unless overridden by per-direction map.
 */
const FACE = {
  [Block.GRASS]: { top: TILES.grassTop, bottom: TILES.dirt, side: TILES.grassSide },
  [Block.DIRT]: { top: TILES.dirt, bottom: TILES.dirt, side: TILES.dirt },
  [Block.STONE]: { top: TILES.stone, bottom: TILES.stone, side: TILES.stone },
  [Block.SAND]: { top: TILES.sand, bottom: TILES.sand, side: TILES.sand },
  [Block.WATER]: { top: TILES.water, bottom: TILES.water, side: TILES.water, transparent: true },
  [Block.LOG]: { top: TILES.logTop, bottom: TILES.logTop, side: TILES.logSide },
  [Block.PLANKS]: { top: TILES.planks, bottom: TILES.planks, side: TILES.planks },
  [Block.LEAVES]: { top: TILES.leaves, bottom: TILES.leaves, side: TILES.leaves, transparent: true },
  [Block.COBBLE]: { top: TILES.cobble, bottom: TILES.cobble, side: TILES.cobble },
  [Block.BRICKS]: { top: TILES.bricks, bottom: TILES.bricks, side: TILES.bricks },
  [Block.SNOW]: { top: TILES.snow, bottom: TILES.snow, side: TILES.snow },
  [Block.BEDROCK]: { top: TILES.bedrock, bottom: TILES.bedrock, side: TILES.bedrock },
  [Block.GRAVEL]: { top: TILES.gravel, bottom: TILES.gravel, side: TILES.gravel },
  [Block.GLASS]: { top: TILES.glass, bottom: TILES.glass, side: TILES.glass, transparent: true },
  [Block.SANDSTONE]: { top: TILES.sandstone, bottom: TILES.sandstone, side: TILES.sandstone },
  [Block.COAL_ORE]: { top: TILES.coalOre, bottom: TILES.coalOre, side: TILES.coalOre },
  [Block.IRON_ORE]: { top: TILES.ironOre, bottom: TILES.ironOre, side: TILES.ironOre },
  [Block.GOLD_ORE]: { top: TILES.goldOre, bottom: TILES.goldOre, side: TILES.goldOre },
  [Block.DIAMOND_ORE]: { top: TILES.diamondOre, bottom: TILES.diamondOre, side: TILES.diamondOre },
  [Block.CLAY]: { top: TILES.clay, bottom: TILES.clay, side: TILES.clay },
  [Block.WOOL]: { top: TILES.wool, bottom: TILES.wool, side: TILES.wool, transparent: true },
  [Block.RED_MUSHROOM]: { top: TILES.redMushroom, bottom: TILES.redMushroom, side: TILES.redMushroom, transparent: true },
  [Block.BROWN_MUSHROOM]: { top: TILES.brownMushroom, bottom: TILES.brownMushroom, side: TILES.brownMushroom, transparent: true },
  [Block.TALL_GRASS]: { top: TILES.tallGrass, bottom: TILES.tallGrass, side: TILES.tallGrass, transparent: true },
  [Block.FLOWER]: { top: TILES.flower, bottom: TILES.flower, side: TILES.flower, transparent: true },
  [Block.CACTUS]: { top: TILES.cactus, bottom: TILES.cactus, side: TILES.cactus, transparent: true },
  [Block.OBSIDIAN]: { top: TILES.obsidian, bottom: TILES.obsidian, side: TILES.obsidian },
  [Block.ICE]: { top: TILES.ice, bottom: TILES.ice, side: TILES.ice, transparent: true },
  [Block.CORAL]: { top: TILES.coral, bottom: TILES.coral, side: TILES.coral, transparent: true },
  [Block.KELP]: { top: TILES.kelp, bottom: TILES.kelp, side: TILES.kelp, transparent: true },
};

export function isOpaque(blockId) {
  if (blockId === Block.AIR) return false;
  const f = FACE[blockId];
  return !(f && f.transparent);
}
export function isTransparent(blockId) {
  return !isOpaque(blockId);
}
export function faceTiles(blockId) {
  return FACE[blockId] || FACE[Block.STONE];
}
export const BLOCK_NAME = {
  [Block.GRASS]: 'Grass Block',
  [Block.DIRT]: 'Dirt',
  [Block.STONE]: 'Stone',
  [Block.SAND]: 'Sand',
  [Block.WATER]: 'Water',
  [Block.LOG]: 'Oak Log',
  [Block.PLANKS]: 'Oak Planks',
  [Block.LEAVES]: 'Oak Leaves',
  [Block.COBBLE]: 'Cobblestone',
  [Block.BRICKS]: 'Bricks',
  [Block.SNOW]: 'Snow Block',
  [Block.BEDROCK]: 'Bedrock',
  [Block.GRAVEL]: 'Gravel',
  [Block.GLASS]: 'Glass',
  [Block.SANDSTONE]: 'Sandstone',
  [Block.COAL_ORE]: 'Coal Ore',
  [Block.IRON_ORE]: 'Iron Ore',
  [Block.GOLD_ORE]: 'Gold Ore',
  [Block.DIAMOND_ORE]: 'Diamond Ore',
  [Block.CLAY]: 'Clay',
  [Block.WOOL]: 'White Wool',
  [Block.RED_MUSHROOM]: 'Red Mushroom',
  [Block.BROWN_MUSHROOM]: 'Brown Mushroom',
  [Block.TALL_GRASS]: 'Tall Grass',
  [Block.FLOWER]: 'Poppy',
  [Block.CACTUS]: 'Cactus',
  [Block.OBSIDIAN]: 'Obsidian',
  [Block.ICE]: 'Ice',
  [Block.CORAL]: 'Coral',
  [Block.KELP]: 'Kelp',
};

