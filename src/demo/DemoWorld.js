/**
 * DemoWorld.js
 * R1 (MUL-34) — Seedable placeholder terrain for the render core.
 *
 * This is deliberately owned by R1 so the first-person voxel scene is visible
 * and reproducible for screenshots. It is a simple, fully supervised heightmap
 * world: grass/dirt/stone columns, sandstone+water at low elevation, sand near
 * water, a few trees and ore patches. R2 (world generation & chunks) replaces
 * this with biome-accurate, chunk-loaded terrain; it should reuse Blocks.js and
 * the same getBlock(region) contract so the renderer does not change.
 *
 * The same `seed` reproduces the same world (reproducibility requirement).
 */

import { Block } from '../world/Blocks.js';
import { mulberry32 } from '../textures/Atlas.js';

// Small seeded value-noise for a natural heightmap.
class ValueNoise {
  constructor(seed) {
    const rnd = mulberry32(seed);
    this.perms = new Int32Array(512);
    for (let i = 0; i < 256; i++) this.perms[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = this.perms[i];
      this.perms[i] = this.perms[j];
      this.perms[j] = tmp;
    }
    for (let i = 0; i < 256; i++) this.perms[i + 256] = this.perms[i];
  }
  smooth(t) { return t * t * (3 - 2 * t); }
  value2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const p = this.perms;
    const a = p[p[xi & 255] + (yi & 255) ] / 255;
    const b = p[p[(xi + 1) & 255] + (yi & 255)] / 255;
    const c = p[p[xi & 255] + ((yi + 1) & 255)] / 255;
    const d = p[p[(xi + 1) & 255] + ((yi + 1) & 255)] / 255;
    const sx = this.smooth(xf), sy = this.smooth(yf);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  fbm(x, y, octaves) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += this.value2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }
}

const SEA_LEVEL = 34;

export class DemoWorld {
  constructor(seed = 20260913) {
    this.seed = seed;
    this.noise = new ValueNoise(seed);
    this.plantRnd = mulberry32(seed ^ 0x9e3779b9);
  }

  heightAt(x, z) {
    // broad continent + hills
    const h =
      this.noise.fbm(x * 0.01, z * 0.01, 4) * 26 +
      this.noise.fbm(x * 0.05, z * 0.05, 3) * 5 +
      26; // base
    return Math.floor(h);
  }

  blockAt(x, y, z) {
    // underground ores (simple scatter, deterministic from coords)
    const oreHash = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
    const r = (Math.abs(oreHash) % 100000) / 100000;
    if (y < 20 && r < 0.03) return Block.COAL_ORE;
    if (y < 16 && r < 0.018) return Block.IRON_ORE;
    if (y < 10 && r < 0.01) return Block.GOLD_ORE;
    if (y < 8 && r < 0.006) return Block.DIAMOND_ORE;

    const h = this.heightAt(x, z);
    const top = h;
    if (y > top) {
      // above surface
      if (y === SEA_LEVEL && h < SEA_LEVEL && h > SEA_LEVEL - 8) return Block.WATER;
      return Block.AIR;
    }
    if (y === top) {
      // surface block
      if (h < SEA_LEVEL + 1 && h > SEA_LEVEL - 8) return Block.SAND;
      if (h >= SEA_LEVEL + 7) return Block.SNOW;
      return Block.GRASS;
    }
    if (y >= top - 3) return Block.DIRT;
    if (y === 0) return Block.BEDROCK;
    return Block.STONE;
  }

  /**
   * Populate a region with blocks. `onBlock(x,y,z,id)` is called for every
   * non-air block, enabling sparse/event-driven construction.
   */
  fillRegion({ minX, maxX, minY, maxY, minZ, maxZ }, onBlock) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const id = this.blockAt(x, y, z);
          if (id !== Block.AIR) onBlock(x, y, z, id);
        }
      }
    }
    // trees (placed sparsely, deterministic)
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const tree = this.plantRnd();
        if (tree < 0.012) this.placeTree(x, z, onBlock);
      }
    }
  }

  placeTree(x, z, onBlock) {
    const h = this.heightAt(x, z);
    if (h < SEA_LEVEL + 1 || h > SEA_LEVEL + 7) return; // only on grass plains
    const trunkH = 4 + Math.floor(this.plantRnd() * 2);
    for (let y = h + 1; y <= h + trunkH; y++) onBlock(x, y, z, Block.LOG);
    const topY = h + trunkH;
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy <= -1 ? 2 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          onBlock(x + dx, topY + dy, z + dz, Block.LEAVES);
        }
      }
    }
  }
}

