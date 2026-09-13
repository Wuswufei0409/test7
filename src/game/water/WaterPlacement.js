/**
 * WaterPlacement — placing a solid block underwater without creating an
 * erroneous air hole.
 *
 * 标准 14：方块水下放置不产生错误空气洞。
 *
 * placeSolidUnderwater replaces exactly the target water cell with a solid block.
 * It never zeroes neighbouring cells, so surrounding water is preserved and no
 * spurious air pocket appears. findErroneousAirHoles validates a world: it counts
 * air cells that are (a) not connected to the open sky and (b) immediately
 * adjacent to water — i.e. a void that should have been water.
 */

/**
 * Replace a water cell with a solid block. Returns true if the cell was water.
 */
export function placeSolidUnderwater(world, x, y, z, blockDesc = {}) {
  const wasWater = world.isWater(x, y, z);
  world.setBlock(x, y, z, { ...blockDesc, solid: true, water: false, solidHeight: 1 });
  return wasWater;
}

/**
 * Count cells that have become erroneous air: not reachable from the sky and
 * touching water (should be liquid). Scans the populated world bounds.
 */
export function findErroneousAirHoles(world, opts = {}) {
  // Find world bounds from stored cells, expanded by a margin for the sky.
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const key of world.cells.keys()) {
    const [x, y, z] = key.split(',').map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  if (!isFinite(minX)) return 0;
  const pad = opts.pad ?? 1;
  minX -= pad; maxX += pad;
  minZ -= pad; maxZ += pad;
  const topY = maxY + 1; // open sky band

  const isOpen = (x, y, z) => !world.isSolid(x, y, z);

  // BFS from every open sky cell.
  const reached = new Set();
  const queue = [];
  const add = (x, y, z) => {
    if (x < minX || x > maxX || z < minZ || z > maxZ || y < minY || y > topY) return;
    const k = `${x},${y},${z}`;
    if (reached.has(k)) return;
    if (!isOpen(x, y, z)) return;
    reached.add(k);
    queue.push([x, y, z]);
  };
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) add(x, topY, z);
  }
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  while (queue.length) {
    const [x, y, z] = queue.pop();
    for (const [dx, dy, dz] of dirs) add(x + dx, y + dy, z + dz);
  }

  // Count enclosed air cells that are adjacent to water (should be liquid).
  let holes = 0;
  for (const key of world.cells.keys()) {
    if (reached.has(key)) continue;
    const [x, y, z] = key.split(',').map(Number);
    const blk = world.getBlock(x, y, z);
    if (blk.solid || blk.water) continue; // it's air
    const touchesWater = dirs.some(([dx, dy, dz]) => world.isWater(x + dx, y + dy, z + dz));
    if (touchesWater) holes++;
  }
  return holes;
}
