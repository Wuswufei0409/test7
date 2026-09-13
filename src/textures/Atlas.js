/**
 * Atlas.js
 * R1 (MUL-34) — Original pixel-art texture atlas generator.
 *
 * All textures are produced procedurally at runtime with a 16x16 pixel-art
 * palette and hand-authored noise/palette rules. No pixel data is copied from
 * Minecraft or any commercial asset pack; the visual language (blocky, low-res,
 * high-contrast) is recreated from scratch as permitted by the task.
 *
 * The generator returns a THREE.CanvasTexture atlas plus per-face UV mapping
 * used by Block faces. It is deterministic (seeded) so screenshots are
 * reproducible across runs.
 */

import * as THREE from 'three';

const ATLAS_COLS = 8; // 8x8 grid of 16px tiles => 128x128 palette atlas

// Each block type maps to an atlas tile index (row-major). Faces that differ
// on top/bottom are assigned a different tile (e.g. grass).
export const TILES = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  water: 5,
  logSide: 6,
  logTop: 7,
  planks: 8,
  leaves: 9,
  cobble: 10,
  bricks: 11,
  snow: 12,
  bedrock: 13,
  gravel: 14,
  glass: 15,
  // second row for extended set
  sandstone: 16,
  coalOre: 17,
  ironOre: 18,
  goldOre: 19,
  diamondOre: 20,
  clay: 21,
  wool: 22,
  redMushroom: 23,
  brownMushroom: 24,
  tallGrass: 25,
  flower: 26,
  cactus: 27,
  obsidian: 28,
  ice: 29,
  coral: 30,
  kelp: 31,
};

// A tiny deterministic PRNG (mulberry32) so texture noise is stable per seed.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A pixel-art "brush" that draws a 16x16 tile using a small rule function.
 * rules(px, py, rnd) -> [r,g,b] or null to keep base color.
 */
function drawTile(base, rules, rnd, kind = 'flat') {
  const img = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = rules ? rules(x, y, rnd) : null;
      const rgb = c || base;
      const i = (y * 16 + x) * 4;
      img[i] = rgb[0];
      img[i + 1] = rgb[1];
      img[i + 2] = rgb[2];
      img[i + 3] = 255;
    }
  }
  return img;
}

// pixel helpers: dither a base color with small random variance
function vary(base, amt, rnd) {
  const d = (a) => Math.max(0, Math.min(255, a + Math.round((rnd() - 0.5) * 2 * amt)));
  return [d(base[0]), d(base[1]), d(base[2])];
}

const C = {
  grass: [106, 170, 64],
  grassDark: [92, 152, 58],
  dirt: [134, 96, 67],
  dirtDark: [114, 82, 57],
  stone: [125, 125, 125],
  stoneDark: [104, 104, 104],
  sand: [219, 207, 163],
  sandDark: [196, 184, 145],
  water: [63, 108, 252],
  logSide: [102, 82, 50],
  logDark: [74, 58, 36],
  logTop: [160, 130, 80],
  planks: [174, 140, 91],
  planksDark: [140, 112, 74],
  leaves: [70, 118, 52],
  leavesDark: [50, 94, 40],
  snow: [240, 246, 250],
  gravel: [129, 127, 124],
  glass: [220, 235, 240],
  sandstone: [216, 203, 156],
  oreBase: [125, 125, 125],
  coal: [40, 40, 40],
  iron: [216, 175, 147],
  gold: [252, 212, 64],
  diamond: [90, 228, 220],
  clay: [156, 164, 170],
  wool: [232, 232, 232],
  mushroomRed: [198, 58, 52],
  mushroomBrown: [150, 103, 62],
  stem: [230, 226, 210],
  obsidian: [20, 16, 34],
  ice: [135, 200, 240],
  coral: [238, 110, 130],
  kelp: [72, 150, 70],
  plankWood: [176, 138, 88],
};

function speckle(base, amt, n, rnd) {
  return (x, y) => {
    const col = vary(base, amt, rnd);
    // draw a few darker/lighter specks
    if ((x * 7 + y * 13 + n) % 11 < 2) {
      return [col[0] * 0.85 | 0, col[1] * 0.85 | 0, col[2] * 0.85 | 0];
    }
    return col;
  };
}

function stoneRules(rnd) {
  const phase = Math.floor(rnd() * 5);
  return (x, y) => {
    const cracks =
      ((x * 3 + y * 5 + phase) % 7 === 0) ||
      ((x + y * 2 + phase) % 13 === 0);
    if (cracks) return C.stoneDark;
    return vary(C.stone, 14, rnd);
  };
}

function oreRules(color, rnd) {
  const blob = Math.floor(rnd() * 6);
  return (x, y) => {
    // small ore blobs
    const inBlob =
      ((x * 3 + y * 3 + blob) % 9 < 3) || ((x * 5 + y + blob) % 9 < 3);
    if (inBlob) return vary(color, 20, rnd);
    return vary(C.oreBase, 12, rnd);
  };
}

function grassSideRules(rnd) {
  return (x, y) => {
    if (y < 3) return grassSideCol(x, rnd);
    return vary(C.dirt, 10, rnd);
  };
}
function grassSideCol(x, rnd) {
  const j = (x % 2 === 0) ? C.grass : C.grassDark;
  return vary(j, 26, rnd);
}

function grassTopRules(rnd) {
  const col = (x, y) => {
    const edge = (x + y) % 3;
    return edge === 0 ? C.grass : (edge === 1 ? C.grassDark : vary(C.grass, 16, rnd));
  };
  return (x, y) => col(x, y);
}

function sandRules(rnd) {
  return speckle(C.sand, 18, 3, rnd);
}
function waterRules(rnd) {
  return (x, y) => {
    const wave = (x + y) % 4 === 0 ? [70, 118, 250] : null;
    return wave || vary(C.water, 18, rnd);
  };
}
function logSideRules(rnd) {
  return (x, y) => {
    if (x % 4 === 0) return vary(C.logDark, 8, rnd);
    return vary(C.logSide, 12, rnd);
  };
}
function logTopRules(rnd) {
  return (x, y) => {
    if (Math.abs(x - 8) < 2 && Math.abs(y - 8) < 2) return vary(C.logTop, 30, rnd);
    return vary(C.logDark, 10, rnd);
  };
}
function planksRules(rnd) {
  return (x, y) => {
    const gap = (y === 0 || y === 8) ? C.planksDark : null;
    return gap || speckle(C.planks, 14, 5, rnd)(x, y);
  };
}
function leavesRules(rnd) {
  return (x, y) => {
    const dark = (x * 7 + y * 13) % 5 === 0;
    return dark ? vary(C.leavesDark, 20, rnd) : vary(C.leaves, 24, rnd);
  };
}
function snowRules(rnd) {
  return speckle(C.snow, 8, 2, rnd);
}
function gravelRules(rnd) {
  return (x, y) => (rnd() < 0.35 ? vary(C.stone, 28, rnd) : vary(C.gravel, 10, rnd));
}
function glassRules() {
  return (x, y) => {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    if (edge) return [188, 208, 216];
    const frag = (x + y) % 5 === 0;
    return frag ? [200, 224, 232] : vary([226, 240, 246], 12, () => 0.5);
  };
}
function sandstoneRules(rnd) {
  return (x, y) => {
    if (y % 4 === 0) return vary(C.sandDark, 10, rnd);
    return vary(C.sandstone, 10, rnd);
  };
}
function obsidianRules(rnd) {
  return (x, y) => {
    const gloss = (x + y) % 6 === 0 ? [44, 40, 62] : null;
    return gloss || vary(C.obsidian, 12, rnd);
  };
}
function iceRules() {
  return (x, y) => {
    const crack = (x * 5 + y * 3) % 9 === 0;
    return crack ? [110, 180, 224] : vary([150, 210, 245], 16, () => 0.5);
  };
}
function coralRules(rnd) {
  return (x, y) => {
    const col = (x * 3 + y * 5) % 4 === 0 ? [220, 90, 110] : [250, 140, 160];
    return vary(col, 22, rnd);
  };
}
function kelpRules(rnd) {
  return (x, y) => (y % 3 === 0 ? [52, 128, 52] : vary(C.kelp, 16, rnd));
}
function snowGrassSideRules(rnd) {
  return (x, y) => {
    if (y < 3) return vary(C.snow, 6, rnd);
    return vary(C.dirt, 8, rnd);
  };
}
function clayRules(rnd) {
  return speckle(C.clay, 12, 4, rnd);
}

// Map tile key -> generator function
const BUILDERS = {
  [TILES.grassTop]: (rnd) => ({ base: C.grass, rules: grassTopRules(rnd) }),
  [TILES.grassSide]: (rnd) => ({ base: C.dirt, rules: grassSideRules(rnd) }),
  [TILES.dirt]: (rnd) => ({ base: C.dirt, rules: speckle(C.dirt, 12, 2, rnd) }),
  [TILES.stone]: (rnd) => ({ base: C.stone, rules: stoneRules(rnd) }),
  [TILES.sand]: (rnd) => ({ base: C.sand, rules: sandRules(rnd) }),
  [TILES.water]: (rnd) => ({ base: C.water, rules: waterRules(rnd) }),
  [TILES.logSide]: (rnd) => ({ base: C.logSide, rules: logSideRules(rnd) }),
  [TILES.logTop]: (rnd) => ({ base: C.logTop, rules: logTopRules(rnd) }),
  [TILES.planks]: (rnd) => ({ base: C.planks, rules: planksRules(rnd) }),
  [TILES.leaves]: (rnd) => ({ base: C.leaves, rules: leavesRules(rnd) }),
  [TILES.cobble]: (rnd) => ({ base: C.stone, rules: stoneRules(rnd) }),
  [TILES.bricks]: (rnd) => ({ base: [150, 78, 64], rules: (x, y) => {
    const mortar = (x === 7 || x === 8 || y === 7 || y === 8) ? [168, 130, 110] : null;
    return mortar || vary([166, 90, 74], 14, rnd);
  }}),
  [TILES.snow]: (rnd) => ({ base: C.snow, rules: snowRules(rnd) }),
  [TILES.bedrock]: (rnd) => ({ base: [70, 70, 70], rules: (x, y) => vary([60, 60, 60], 40, rnd) }),
  [TILES.gravel]: (rnd) => ({ base: C.gravel, rules: gravelRules(rnd) }),
  [TILES.glass]: (rnd) => ({ base: C.glass, rules: glassRules() }),
  [TILES.sandstone]: (rnd) => ({ base: C.sandstone, rules: sandstoneRules(rnd) }),
  [TILES.coalOre]: (rnd) => ({ base: C.oreBase, rules: oreRules(C.coal, rnd) }),
  [TILES.ironOre]: (rnd) => ({ base: C.oreBase, rules: oreRules(C.iron, rnd) }),
  [TILES.goldOre]: (rnd) => ({ base: C.oreBase, rules: oreRules(C.gold, rnd) }),
  [TILES.diamondOre]: (rnd) => ({ base: C.oreBase, rules: oreRules(C.diamond, rnd) }),
  [TILES.clay]: (rnd) => ({ base: C.clay, rules: clayRules(rnd) }),
  [TILES.wool]: (rnd) => ({ base: C.wool, rules: (x, y) => (rnd() < 0.5 ? [244,244,244] : vary(C.wool, 8, rnd)) }),
  [TILES.redMushroom]: (rnd) => ({ base: C.mushroomRed, rules: (x, y) => (y % 2 === 0 ? vary(C.mushroomRed, 20, rnd) : vary([150,40,38], 20, rnd)) }),
  [TILES.brownMushroom]: (rnd) => ({ base: C.mushroomBrown, rules: (x, y) => vary(C.mushroomBrown, 18, rnd) }),
  [TILES.tallGrass]: (rnd) => ({ base: C.grass, rules: (x, y) => (y % 2 === 0 ? vary(C.grass, 30, rnd) : vary([120,190,80], 30, rnd)) }),
  [TILES.flower]: (rnd) => ({ base: [250, 60, 60], rules: (x, y) => (y % 2 === 0 ? [250,250,250] : [250,60,60]) }),
  [TILES.cactus]: (rnd) => ({ base: [66, 138, 60], rules: (x, y) => (x===0 || x===15 || y===0 || y===15) ? [50,110,50] : vary([80,150,68], 16, rnd) }),
  [TILES.obsidian]: (rnd) => ({ base: C.obsidian, rules: obsidianRules(rnd) }),
  [TILES.ice]: (rnd) => ({ base: C.ice, rules: iceRules() }),
  [TILES.coral]: (rnd) => ({ base: C.coral, rules: coralRules(rnd) }),
  [TILES.kelp]: (rnd) => ({ base: C.kelp, rules: kelpRules(rnd) }),
};

/**
 * Build a canvas texture atlas, deterministic given a seed.
 * Returns { texture, tileUV(tile, face) }.
 */
export function createAtlas(seed = 20260913) {
  const rnd = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * 16;
  canvas.height = ATLAS_COLS * 16;
  const ctx = canvas.getContext('2d');

  const count = Object.keys(BUILDERS).length;
  for (let t = 0; t < count; t++) {
    const builder = BUILDERS[t];
    if (!builder) continue;
    const { base, rules } = builder(rnd);
    const img = drawTile(base, rules, rnd);
    const imgData = ctx.createImageData(16, 16);
    imgData.data.set(img);
    ctx.putImageData(imgData, (t % ATLAS_COLS) * 16, Math.floor(t / ATLAS_COLS) * 16);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.flipY = false;

  // UV rect for a tile (in atlas uv space)
  const tileRect = (tile) => {
    const col = tile % ATLAS_COLS;
    const row = Math.floor(tile / ATLAS_COLS);
    return {
      u0: col / ATLAS_COLS,
      v0: row / ATLAS_COLS,
      u1: (col + 1) / ATLAS_COLS,
      v1: (row + 1) / ATLAS_COLS,
    };
  };
  return { texture: tex, tileRect, tileCount: count };
}

// A few extra seeded variants used for snow grass / multicolor faces
export { mulberry32 };

