/**
 * WorldChunkManager: owns a bounded set of loaded chunks over a deterministic
 * WorldGenerator. Provides load/unload, world-coordinate block access
 * (generating chunks on demand), and a fixed-seed reproducibility guarantee.
 */

import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, generateColumn,
  classifyBiome, landHeight } from './generator.js';
import { Block } from './blocks.js';
import { Chunk } from './chunk.js';

export function worldToChunk(coord) {
  return Math.floor(coord / CHUNK_SIZE);
}

export function chunkToWorld(coord) {
  return coord * CHUNK_SIZE;
}

export class WorldChunkManager {
  constructor(seed, {
    maxLoadedChunks = 512,
    applyFeatures = true,
  } = {}) {
    this.seed = seed >>> 0;
    this.maxLoadedChunks = maxLoadedChunks;
    this.applyFeatures = applyFeatures;
    this.chunks = new Map(); // key `${cx},${cz}` -> Chunk
  }

  key(cx, cz) {
    return `${cx},${cz}`;
  }

  /** True if the chunk is currently loaded. */
  isLoaded(cx, cz) {
    return this.chunks.has(this.key(cx, cz));
  }

  /** Evict (unload) one chunk. Returns removed block ids for persistence. */
  unload(cx, cz) {
    const k = this.key(cx, cz);
    const c = this.chunks.get(k);
    if (!c) return null;
    this.chunks.delete(k);
    const snapshot = {
      cx, cz,
      blocks: Array.from(c.blocks),
      biomes: c.biomes.slice(),
      heightmap: Array.from(c.heightmap),
      features: c.features,
    };
    return snapshot;
  }

  /** Load (or generate-and-load) a chunk, returning it. */
  loadChunk(cx, cz) {
    const k = this.key(cx, cz);
    let c = this.chunks.get(k);
    if (c) return c;
    c = this.#generateChunk(cx, cz);
    this.chunks.set(k, c);
    this.#enforceBudget();
    return c;
  }

  /** Generate a fresh chunk deterministically (used by load). */
  #generateChunk(cx, cz) {
    const c = new Chunk(cx, cz);
    const x0 = chunkToWorld(cx);
    const z0 = chunkToWorld(cz);
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = x0 + lx;
        const wz = z0 + lz;
        const biome = classifyBiome(wx, wz, this.seed);
        const height = landHeight(wx, wz, this.seed);
        const { col } = generateColumn(wx, wz, this.seed);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          c.setBlock(lx, y, lz, col[y]);
        }
        c.biomes[lz * CHUNK_SIZE + lx] = biome;
        c.heightmap[lz * CHUNK_SIZE + lx] = height;
      }
    }
    if (this.applyFeatures) this.#decorate(c);
    return c;
  }

  /** Deterministic decoration: trees in forest columns (world-coordinate safe). */
  #decorate(c) {
    const x0 = chunkToWorld(c.cx);
    const z0 = chunkToWorld(c.cz);
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = x0 + lx;
        const wz = z0 + lz;
        const biome = c.getBiome(lx, lz);
        if (biome !== 'forest') continue;
        const h = c.getHeight(lx, lz);
        if (h <= SEA_LEVEL) continue;
        // deterministic per-column tree chance
        const g = loadHash(wx, wz, this.seed);
        if (g < 0.18) placeTree(c, wx, wz, h, this.seed);
      }
    }
  }

  /** Ensure we do not exceed the loaded-chunk budget (LRU-ish eviction). */
  #enforceBudget() {
    while (this.chunks.size > this.maxLoadedChunks) {
      const oldestKey = this.chunks.keys().next().value;
      this.chunks.delete(oldestKey);
    }
  }

  /** Get an individual block at world coordinates (generates chunk if needed). */
  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return Block.AIR;
    const cx = worldToChunk(wx);
    const cz = worldToChunk(wz);
    const c = this.loadChunk(cx, cz);
    return c.getBlock(wx - chunkToWorld(cx), wy, wz - chunkToWorld(cz));
  }

  /** Topmost non-air block y for world column (fast via chunk heightmap). */
  getSurfaceY(wx, wz) {
    const cx = worldToChunk(wx);
    const cz = worldToChunk(wz);
    const c = this.loadChunk(cx, cz);
    return c.getHeight(wx - chunkToWorld(cx), wz - chunkToWorld(cz));
  }

  getBiomeAt(wx, wz) {
    const cx = worldToChunk(wx);
    const cz = worldToChunk(wz);
    const c = this.loadChunk(cx, cz);
    return c.getBiome(wx - chunkToWorld(cx), wz - chunkToWorld(cz));
  }

  /** How many chunks currently loaded. */
  get loadedCount() {
    return this.chunks.size;
  }
}

/** Deterministic 0..1 pseudo-random per column for decoration decisions. */
function loadHash(x, z, seed) {
  return (hashRaw(x, z, seed) >>> 0) / 4294967296;
}

/** Place a deterministic tree anchored at a world column + its leaves. */
function placeTree(c, wx, wz, h, seed) {
  const rng = mulberryFrom(hashRaw(wx, wz, seed));
  const trunkH = 4 + Math.floor(rng() * 3);
  const top = h + trunkH;
  const lx = wx - chunkToWorld(c.cx);
  const lz = wz - chunkToWorld(c.cz);
  for (let y = h + 1; y <= top; y++) c.setBlock(lx, y, lz, Block.WOOD_LOG);
  // leaves: 3x3 box around trunk top (+ extra layer)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const nlx = lx + dx;
      const nlz = lz + dz;
      if (nlx < 0 || nlx >= CHUNK_SIZE || nlz < 0 || nlz >= CHUNK_SIZE) continue;
      if (dx === 0 && dz === 0) continue;
      for (let ly = top - 1; ly <= top; ly++) {
        if (c.getBlock(nlx, ly, nlz) === Block.AIR) c.setBlock(nlx, ly, nlz, Block.LEAVES);
      }
    }
  }
  // canopy cap
  if (c.getBlock(lx, top + 1, lz) === Block.AIR) c.setBlock(lx, top + 1, lz, Block.LEAVES);
}

function mulberryFrom(a) {
  a |= 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashRaw(x, z, seed) {
  let h = (seed >>> 0) ^ (x | 0) ^ Math.imul(z | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return h ^ (h >>> 16);
}
