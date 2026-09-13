/**
 * ItemBuoyancy — dropped item entities float in water.
 *
 * 标准 14：掉落物上浮。物品在水中的单元格里上浮，到达水面（上方不再是水）后
 * 悬浮在水面，不会继续上蹿。脱离水体后静止在所在位置（供拾取/存档模块复用）。
 */

export class Item {
  constructor(x, y, z, opts = {}) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.size = opts.size ?? 1;
    this.inWater = false;
  }

  get blockX() { return Math.floor(this.x); }
  get blockY() { return Math.floor(this.y); }
  get blockZ() { return Math.floor(this.z); }
}

/** Advance a floating item by dt. Returns updated item. */
export function updateFloat(item, world, dt, opts = {}) {
  const rise = opts.rise ?? 1.5; // blocks/s upward while in water
  const bx = item.blockX, by = item.blockY, bz = item.blockZ;
  const inWater = world.isWater(bx, by, bz);
  item.inWater = inWater;

  if (inWater) {
    item.y += rise * dt;
  }
  // Do not rise above the water surface: clamp to the top of the water column.
  const top = waterSurfaceTop(world, bx, bz);
  if (top !== null && item.y > top) {
    item.y = top;
    item.inWater = false; // now floating at the surface
  }
  return item;
}

/** Top y (exclusive) of the water column at (bx,bz), or null if no water. */
export function waterSurfaceTop(world, bx, bz) {
  let top = null;
  for (let y = 0; y <= 64; y++) {
    if (world.isWater(bx, y, bz)) top = y + 1; // water cell spans [y, y+1]
    else if (top !== null) break;
  }
  return top;
}
