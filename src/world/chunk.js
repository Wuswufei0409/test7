/**
 * Chunk data structure. A chunk is CHUNK_SIZE x WORLD_HEIGHT x CHUNK_SIZE
 * blocks addressed as block[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x].
 * Chunk coordinates are world coords divided by CHUNK_SIZE (floor).
 */

import { CHUNK_SIZE, WORLD_HEIGHT } from './generator.js';
import { Block } from './blocks.js';

export const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    // Uint8 storage for compactness.
    this.blocks = new Uint8Array(CHUNK_BLOCK_COUNT);
    this.biomes = new Array(CHUNK_SIZE * CHUNK_SIZE).fill(null);
    this.heightmap = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    this.features = []; // decoration (trees) placed into world coords
  }

  index(lx, y, lz) {
    return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
  }

  getBlock(lx, y, lz) {
    if (y < 0 || y >= WORLD_HEIGHT) return Block.AIR;
    return this.blocks[this.index(lx, y, lz)];
  }

  setBlock(lx, y, lz, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    this.blocks[this.index(lx, y, lz)] = id;
  }

  getBiome(lx, lz) {
    return this.biomes[lz * CHUNK_SIZE + lx];
  }

  /** Surface height (max solid block y) for a local column. */
  getHeight(lx, lz) {
    return this.heightmap[lz * CHUNK_SIZE + lx];
  }
}
