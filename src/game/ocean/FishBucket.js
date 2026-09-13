/**
 * FishBucket — bucket capture / release of fish (M5, standard 16).
 *
 * The four fish species (cod, salmon, tropical fish, pufferfish) can be caught
 * with a water bucket and released back into water. The dolphin is a mammal and
 * is NOT bucket-catchable (matching the source behaviour). A bucket holds a
 * stack of caught fish species; releasing places one back into the water when a
 * valid underwater cell is given.
 */

import { Fish } from './AquaticLife.js';

export class FishBucket {
  constructor(opts = {}) {
    this.capacity = opts.capacity ?? 64;
    this.contents = []; // species tags held in the bucket
    this.water = opts.water ?? true; // a water bucket always contains water
  }

  get count() {
    return this.contents.length;
  }

  get full() {
    return this.contents.length >= this.capacity;
  }

  isEmpty() {
    return this.contents.length === 0;
  }

  /** Add one caught fish species; returns true if it fit. */
  add(species) {
    if (this.full) return false;
    if (!species || species === 'dolphin') return false; // dolphin is not bucket-caught
    this.contents.push(species);
    return true;
  }

  /** Remove one fish (LIFO is fine) and return the species tag, or null. */
  take() {
    return this.contents.length ? this.contents.pop() : null;
  }
}

/**
 * Catch `fish` into `bucket`: requires the fish to be catchable and the bucket
 * to have room. The fish is removed from the world (its position is forgotten)
 * and its species is added to the bucket.
 *
 * Returns { caught: boolean, fish }.
 */
export function catchFishIntoBucket(bucket, fish) {
  if (!fish || !fish.catchable) return { caught: false, fish };
  if (bucket.full) return { caught: false, fish };
  bucket.add(fish.species);
  return { caught: true, fish: null }; // fish removed from water
}

/**
 * Release one fish from `bucket` into the world at (x, y, z). The target cell
 * must be water for the fish to survive. Returns the spawned Fish or null.
 */
export function releaseFishFromBucket(bucket, world, x, y, z, opts = {}) {
  if (bucket.isEmpty()) return null;
  if (!world.isWater(Math.floor(x), Math.floor(y), Math.floor(z)) &&
      !world.isWater(Math.floor(x), Math.floor(y + 1), Math.floor(z))) {
    return null; // not a valid water cell
  }
  const species = bucket.take();
  if (!species) return null;
  const fish = new Fish(species, x, y, z, opts);
  return fish;
}
