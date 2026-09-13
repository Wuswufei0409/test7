/**
 * Ocean block ids + small factory helpers (M5).
 *
 * VoxelWorld blocks are descriptor objects { id, solid, water, opaque,
 * solidHeight }. This file centralises the ids used by the ocean content so
 * the world / render layers and the automated tests share one source of truth.
 */

export const B = {
  AIR: 0,
  SAND: 3,
  GRAVEL: 4,
  STONE: 5,
  CORAL_BLOCK: 6,
  CORAL_FAN: 7,
  KELP: 8,
  SEAGRASS: 9,
  ICE: 10,
  WOOD: 11,
  PLANK: 12,
  STONEBRICK: 13,
  PRISMARINE: 14,
  CHEST: 15,
  WATER: 16,
};

/** Solid, opaque terrain/ocean-floor block descriptors. */
export const SOLID = {
  sand: { id: B.SAND, solid: true, opaque: true, solidHeight: 1 },
  gravel: { id: B.GRAVEL, solid: true, opaque: true, solidHeight: 1 },
  stone: { id: B.STONE, solid: true, opaque: true, solidHeight: 1 },
  coralBlock: { id: B.CORAL_BLOCK, solid: true, opaque: true, solidHeight: 1 },
  ice: { id: B.ICE, solid: true, opaque: false, solidHeight: 1 },
  wood: { id: B.WOOD, solid: true, opaque: true, solidHeight: 1 },
  plank: { id: B.PLANK, solid: true, opaque: true, solidHeight: 1 },
  stonebrick: { id: B.STONEBRICK, solid: true, opaque: true, solidHeight: 1 },
  prismarine: { id: B.PRISMARINE, solid: true, opaque: true, solidHeight: 1 },
  chest: { id: B.CHEST, solid: true, opaque: true, solidHeight: 1 },
};

/** Non-solid decorative/plant blocks (can be walked through / render as sprites). */
export const PLANT = {
  coralFan: { id: B.CORAL_FAN, solid: false, opaque: false, solidHeight: 0 },
  kelp: { id: B.KELP, solid: false, opaque: false, solidHeight: 0 },
  seagrass: { id: B.SEAGRASS, solid: false, opaque: false, solidHeight: 0 },
};
