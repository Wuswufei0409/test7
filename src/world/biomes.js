/**
 * Biome definitions and classification.
 *
 * Biomes are classified deterministically from three continuous climate
 * fields (temperature, humidity, elevation/euler) so the same seed always
 * yields the same biome at a given (x, z). We separate "land biomes"
 * (planes / forest / desert / mountains) from "ocean biomes" (cold / warm /
 * shallow / deep oceans) so the generator can decide block layering and
 * water coverage separately.
 */

export const BIOMES = {
  OCEAN: 'ocean', // generic deep/cold water body
  DEEP_OCEAN: 'deep_ocean',
  WARM_OCEAN: 'warm_ocean',
  COLD_OCEAN: 'cold_ocean',
  SHALLOW_OCEAN: 'shallow_ocean',
  PLAINS: 'plains',
  FOREST: 'forest',
  DESERT: 'desert',
  MOUNTAINS: 'mountains',
  BEACH: 'beach',
};

export const BIOME_NAMES = Object.freeze(Object.fromEntries(
  Object.entries(BIOMES).map(([k, v]) => [v, k])
));
