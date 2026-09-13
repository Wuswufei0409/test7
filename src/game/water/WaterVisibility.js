/**
 * WaterVisibility — underwater visibility (fog) model.
 *
 * 标准 14：水下能见度。返回可见距离（方块数）：越深可见越短。渲染层（R1）消费
 * 该值设置水下雾效。非水下返回一个很大的“清晰”值。
 */

export const DEFAULT_VISIBILITY = 200; // blocks when not underwater

/**
 * @returns {number} visibility distance in blocks for the player.
 */
export function underwaterFogDistance(player, world, opts = {}) {
  const head = Math.floor(player.y + 1.6);
  const under = player.swimming
    || player.underwater
    || world.isWater(Math.floor(player.x), head, Math.floor(player.z));
  if (!under) return opts.default ?? DEFAULT_VISIBILITY;
  const near = opts.near ?? 8; // blocks visible just under the surface
  const far = opts.far ?? 2;   // at greatest depth
  const depth = waterDepthAbove(player, world);
  const falloff = opts.falloff ?? 1.2;
  const d = near - depth * falloff;
  return Math.max(far, Math.round(d * 10) / 10);
}

/** Number of consecutive water cells directly above the player's head. */
export function waterDepthAbove(player, world) {
  const hy = Math.floor(player.y + 1.6);
  let depth = 0;
  for (let y = hy; y <= hy + 40; y++) {
    if (world.isWater(Math.floor(player.x), y, Math.floor(player.z))) depth++;
    else break;
  }
  return depth;
}
