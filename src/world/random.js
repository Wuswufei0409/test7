/**
 * Deterministic pseudo-random helpers for the world generator.
 * All functions are pure functions of their integer seed inputs so that the
 * same seed reproduces identical terrain in any environment (browser / node).
 */

/** mulberry32: tiny, fast, deterministic PRNG from a 32-bit seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable hash of two integer coordinates -> uint32 (for lattice gradients). */
export function hash2i(x, z, seed) {
  let h = (seed >>> 0) ^ (x | 0) ^ Math.imul(z | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Value-noise 2D gradient at integer lattice points. */
function latticeGradient(x, z, seed) {
  const h = hash2i(x, z, seed);
  const angle = (h / 4294967296) * Math.PI * 2;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Value-noise (deterministic). Returns value in [-1, 1]. */
export function valueNoise2(x, z, seed) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = fade(xf);
  const v = fade(zf);

  const n00 = latticeGradient(xi, zi, seed);
  const n10 = latticeGradient(xi + 1, zi, seed);
  const n01 = latticeGradient(xi, zi + 1, seed);
  const n11 = latticeGradient(xi + 1, zi + 1, seed);

  const a = lerp(n00.x * xf + n00.z * zf, n10.x * (xf - 1) + n10.z * zf, u);
  const b = lerp(n01.x * xf + n01.z * (zf - 1), n11.x * (xf - 1) + n11.z * (zf - 1), u);
  return lerp(a, b, v);
}

/** Fractal Brownian motion (deterministic), frequency/octaves configurable. */
export function fbm2(x, z, seed, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, z * freq, seed + i * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Return a stable per-position float in [0,1). */
export function hashUnit(x, z, seed) {
  return hash2i(x, z, seed) / 4294967296;
}
