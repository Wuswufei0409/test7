/**
 * Treasure — buried-treasure map / clue guidance and the diggable reward.
 *
 * Completion standard 15: a treasure map (or equivalent clues) guides the player
 * to a diggable reward. The treasure is a chest buried in the sea floor (see
 * OceanFeatures.addBuriedTreasure). This module:
 *
 *   - computes a `bearing` + `distance` course from a shore landmark to the
 *     buried chest, split into followable clue steps (a "treasure map"),
 *   - `followClue` tells the player the remaining bearing/distance from an
 *     arbitrary position and when a step (or the final target) is reached,
 *   - `digTreasure` digs the covering sand to reveal the chest and returns the
 *     loot once (second dig yields nothing).
 */

import { B, SOLID } from './blocks.js';

const DEFAULT_LOOT = [
  { item: 'heart_of_the_sea', count: 1 },
  { item: 'gold_ingot', count: 3 },
  { item: 'tropical_fish_bucket', count: 1 },
  { item: 'nautilus_shell', count: 2 },
];

/** Distance between two (x,z) points. */
export function horizontalDistance(ax, az, bx, bz) {
  return Math.hypot(bx - ax, bz - az);
}

/**
 * Compass bearing in degrees (0 = -Z / north, clockwise) from (ax,az) to (bx,bz),
 * matching the World-space convention used by the player physics.
 */
export function bearingDeg(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  let deg = (Math.atan2(dx, -dz) * 180) / Math.PI; // 0 = -Z, +CW
  return ((deg % 360) + 360) % 360;
}

/**
 * Build a treasure map that leads from a shore landmark (`origin`) to a buried
 * chest at (`treasure.chest`).
 *
 * Returns:
 *   {
 *     origin: [x, z],
 *     target: [x, z],
 *     steps: [ { to: [x,z], hint } ],           // 2 intermediate waypoints then the target
 *     loot,
 *   }
 */
export function createTreasureMap(treasure, opts = {}) {
  const origin = opts.origin ?? [0, 0];
  const [tx, , tz] = treasure.chest;
  const loot = opts.loot ?? DEFAULT_LOOT;

  // Interpolate two intermediate waypoints: 1/3 and 2/3 of the way.
  const seg = [
    [origin[0] + (tx - origin[0]) / 3, origin[1] + (tz - origin[1]) / 3],
    [origin[0] + (2 * (tx - origin[0])) / 3, origin[1] + (2 * (tz - origin[1])) / 3],
  ];
  const steps = [
    {
      to: seg[0],
      hint: `${Math.round(bearingDeg(origin[0], origin[1], seg[0][0], seg[0][1]))}°, 约 ${Math.round(horizontalDistance(origin[0], origin[1], seg[0][0], seg[0][1]))} 格`,
    },
    {
      to: seg[1],
      hint: `${Math.round(bearingDeg(seg[0][0], seg[0][1], seg[1][0], seg[1][1]))}°, 约 ${Math.round(horizontalDistance(seg[0][0], seg[0][1], seg[1][0], seg[1][1]))} 格`,
    },
    {
      to: [tx, tz],
      hint: '宝藏就在你脚下的海底，用铲子挖开覆盖的沙。',
    },
  ];
  return { origin: [...origin], target: [tx, tz], steps, loot };
}

/**
 * Follow the map's `stepIndex`-th clue from `pos = [x, z]`.
 * Returns { bearing, distance, reached, hint } where `reached` is true when the
 * player is within `tolerance` blocks of that step's waypoint.
 */
export function followClue(map, pos, stepIndex = 0, opts = {}) {
  const tolerance = opts.tolerance ?? 1.5;
  const step = map.steps[Math.min(stepIndex, map.steps.length - 1)];
  const [px, pz] = pos;
  const [tx, tz] = step.to;
  const distance = horizontalDistance(px, pz, tx, tz);
  return {
    bearing: bearingDeg(px, pz, tx, tz),
    distance,
    reached: distance <= tolerance,
    hint: step.hint,
    step: Math.min(stepIndex, map.steps.length - 1),
    totalSteps: map.steps.length,
  };
}

/** Convenience: the highest step index whose waypoint the player is currently at. */
export function furthestClueReached(map, pos, opts = {}) {
  let reached = -1;
  for (let i = 0; i < map.steps.length; i++) {
    if (followClue(map, pos, i, opts).reached) reached = i;
  }
  return reached;
}

/**
 * Dig the treasure. Requires the player to be standing on / facing the chest
 * column (within `reach`). Removes the covering sand so the chest is exposed,
 * and returns the loot items — once. A second call returns [].
 */
export function digTreasure(world, treasure, pos, opts = {}) {
  const reach = opts.reach ?? 2.5;
  const [cx, cy, cz] = treasure.chest;
  const [px, pz] = pos;
  if (treasure.dug) return [];
  if (horizontalDistance(px, pz, cx, cz) > reach) return []; // too far to dig
  // Unearth the chest (remove covering sand) and reveal it.
  for (const [x, y, z] of treasure.cover) {
    const blk = world.getBlock(x, y, z);
    if (blk.id === B.SAND) world.setBlock(x, y, z, SOLID_WATER_OR_AIR(x, y, z, world));
  }
  treasure.dug = true;
  return treasure.loot ? [...treasure.loot] : [...DEFAULT_LOOT];
}

/**
 * When removing the covering sand, reveal water in the water column (so no
 * erroneous air hole / the column stays flooded) if the cell is underwater.
 */
function SOLID_WATER_OR_AIR(x, y, z, world) {
  // A covering cell at/below sea level should become water again, not air.
  return { id: B.WATER, water: true, solid: false };
}
