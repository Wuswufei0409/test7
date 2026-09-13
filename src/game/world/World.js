/**
 * World interface + small voxel storage primitives shared by the game.
 *
 * The game is built from independent modules (world/render = R1/R2, player
 * controls = R3, ...). This file defines the *minimal* contract the player /
 * physics subsystem needs from the world, so R3 stays decoupled from the
 * final chunk system and can be tested in isolation.
 *
 * Contract required by the player physics:
 *   - isSolid(x, y, z): whether the integer block cell is collidable.
 *   - isWater(x, y, z): whether the cell is liquid (drives swimming).
 *   - getBlock(x, y, z): optional richer block descriptor (id, hardness...).
 *   - getSpawnPoint(): optional [x, y, z] feet position to stand on.
 */

/** Voxel world backed by a sparse Map. Fast for small test worlds. */
export class VoxelWorld {
  constructor({ seed = 0 } = {}) {
    this.seed = seed;
    this.cells = new Map(); // key `${x},${y},${z}` -> block descriptor
  }

  _key(x, y, z) {
    return `${x},${y},${z}`;
  }

  /** Set a block. desc: { id, solid?, water?, opaque?, solidHeight? } */
  setBlock(x, y, z, desc = {}) {
    const cell = { id: 0, solid: false, water: false, opaque: false, solidHeight: 1, ...desc };
    if (!cell.solid && !cell.water && !cell.id) {
      this.cells.delete(this._key(x, y, z));
    } else {
      this.cells.set(this._key(x, y, z), cell);
    }
  }

  getBlock(x, y, z) {
    return this.cells.get(this._key(x, y, z)) || { id: 0, solid: false, water: false, solidHeight: 1 };
  }

  isSolid(x, y, z) {
    return this.getBlock(x, y, z).solid === true;
  }

  isWater(x, y, z) {
    return this.getBlock(x, y, z).water === true;
  }

  /** Fill an axis-aligned box (inclusive integer bounds) with a block type. */
  fillBox(x0, y0, z0, x1, y1, z1, desc = {}) {
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          this.setBlock(x, y, z, desc);
        }
      }
    }
    return this;
  }

  /** Set a solid ground platform. Returns the standing Y. */
  buildGround(level = 0, options = {}) {
    const { x = [-6, 6], z = [-6, 6] } = options;
    this.fillBox(x[0], level, z[0], x[1], level, z[1], { id: 1, solid: true, opaque: true });
    const spawn = options.spawn || [0, level + 1, 0];
    this.spawnPoint = spawn;
    return spawn;
  }

  getSpawnPoint() {
    return this.spawnPoint ? [...this.spawnPoint] : [0, 1, 0];
  }
}
