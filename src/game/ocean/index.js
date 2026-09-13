/**
 * M5 海洋世界与水生生物 (completion standards 15+16) — public surface.
 */
export { B, SOLID, PLANT } from './blocks.js';
export {
  buildOcean, addCoralReef, addKelpForest, addSeagrassField,
  addIceberg, addShipwreck, addUnderwaterRuins, addBuriedTreasure,
  detectFeatures, mulberry32, randInt,
} from './OceanFeatures.js';
export {
  createTreasureMap, followClue, furthestClueReached, digTreasure,
  bearingDeg, horizontalDistance,
} from './Treasure.js';
export {
  Fish, Dolphin, FISH_SPECIES, SPECIES_PROPS,
  updateFish, updateDolphin, updatePufferfish,
} from './AquaticLife.js';
export {
  FishBucket, catchFishIntoBucket, releaseFishFromBucket,
} from './FishBucket.js';
