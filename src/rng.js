// Seeded, deterministic RNG + value noise used for procedural world generation.
// All functions are pure with respect to their integer inputs so a given world
// seed always regenerates the same world.

// A fast integer hash (based on Wang / xxhash-style mixing). Returns a float in [0,1).
export function hash2(x, y, seed = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  // Convert to unsigned then normalize.
  return (h >>> 0) / 4294967296;
}

export function hash1(x, seed = 0) {
  return hash2(x, 0x9e3779b9, seed);
}

// Smooth interpolation.
function smooth(t) {
  return t * t * (3 - 2 * t);
}

// 2D value noise sampled at floating point coords. `scale` is tiles-per-cell.
export function valueNoise(x, y, seed = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const v00 = hash2(x0, y0, seed);
  const v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);
  const top = v00 + (v10 - v00) * fx;
  const bot = v01 + (v11 - v01) * fx;
  return top + (bot - top) * fy;
}

// Fractal (multi-octave) noise in [0,1].
export function fractalNoise(x, y, seed = 0, octaves = 4, persistence = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, y * freq, seed + o * 1013) * amp;
    norm += amp;
    amp *= persistence;
    freq *= 2;
  }
  return sum / norm;
}

// A small mutable RNG (mulberry32) for non-deterministic per-session things.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
