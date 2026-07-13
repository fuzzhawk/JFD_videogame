// Procedural top-down world. Infinite & deterministic from a seed: terrain from
// fractal noise (water/sand/grass/forest) with towns (road grids + buildings)
// layered on top where an "urbanization" field is high. Tiles are queried
// on demand by the renderer/collision, so there is no fixed map size.

import { fractalNoise, hash2 } from './rng.js';

export const TILE = 24; // logical tile size in world units (px before camera zoom)

export const T = {
  WATER: 0,
  SAND: 1,
  GRASS: 2,
  TREE: 3,
  ROAD: 4,
  SIDEWALK: 5,
  BUILDING: 6,
  PLAZA: 7,
};

const BLOCK = 8; // town block size in tiles (roads sit on the grid lines)

export class World {
  constructor(seed = 12345) {
    this.seed = seed >>> 0;
    this._cache = new Map();
  }

  _urban(tx, ty) {
    return fractalNoise(tx * 0.012 + 100, ty * 0.012 + 100, this.seed + 7, 3, 0.5);
  }

  // Returns a tile type for world tile (tx,ty). Cached per tile.
  tileAt(tx, ty) {
    const key = tx + ',' + ty;
    const c = this._cache.get(key);
    if (c !== undefined) return c;
    const t = this._compute(tx, ty);
    if (this._cache.size > 20000) this._cache.clear();
    this._cache.set(key, t);
    return t;
  }

  _compute(tx, ty) {
    const elev = fractalNoise(tx * 0.03, ty * 0.03, this.seed, 4, 0.55);
    if (elev < 0.30) return T.WATER;
    if (elev < 0.35) return T.SAND;

    const urban = this._urban(tx, ty);
    if (urban > 0.56) {
      // Town: road grid on block boundaries.
      const lx = ((tx % BLOCK) + BLOCK) % BLOCK;
      const ly = ((ty % BLOCK) + BLOCK) % BLOCK;
      if (lx === 0 || ly === 0) return T.ROAD;
      if (lx === 1 || lx === BLOCK - 1 || ly === 1 || ly === BLOCK - 1) return T.SIDEWALK;
      // Interior of a block: building or plaza depending on the block.
      const bx = Math.floor(tx / BLOCK);
      const by = Math.floor(ty / BLOCK);
      const blockRoll = hash2(bx, by, this.seed + 99);
      if (blockRoll > 0.32) return T.BUILDING;
      return T.PLAZA;
    }

    // Countryside: forest clumps over grass.
    const forest = fractalNoise(tx * 0.09 + 40, ty * 0.09 + 40, this.seed + 3, 3, 0.5);
    if (forest > 0.62 && hash2(tx, ty, this.seed + 5) > 0.35) return T.TREE;
    return T.GRASS;
  }

  isSolid(tx, ty) {
    const t = this.tileAt(tx, ty);
    return t === T.WATER || t === T.BUILDING || t === T.TREE;
  }

  isWalkable(tx, ty) {
    return !this.isSolid(tx, ty);
  }

  // Good ground for NPCs (town pavement).
  isPavement(tx, ty) {
    const t = this.tileAt(tx, ty);
    return t === T.SIDEWALK || t === T.PLAZA;
  }

  buildingColor(tx, ty) {
    const bx = Math.floor(tx / BLOCK);
    const by = Math.floor(ty / BLOCK);
    const h = hash2(bx, by, this.seed + 123);
    const palette = ['#8d6e63', '#a1887f', '#90a4ae', '#b0857a', '#9c8f7a', '#7e8a97'];
    return palette[Math.floor(h * palette.length) % palette.length];
  }

  // Find a walkable spawn near a target tile (spiral search).
  findWalkable(tx, ty, maxR = 6) {
    if (this.isWalkable(tx, ty)) return { tx, ty };
    for (let r = 1; r <= maxR; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (this.isWalkable(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
        }
      }
    }
    return { tx, ty };
  }
}

export const TILE_COLORS = {
  [T.WATER]: '#2f6fb0',
  [T.SAND]: '#e0cf95',
  [T.GRASS]: '#5a9a44',
  [T.TREE]: '#3d7a30',
  [T.ROAD]: '#565b63',
  [T.SIDEWALK]: '#9aa0a6',
  [T.PLAZA]: '#8f9aa0',
  [T.BUILDING]: '#8d6e63',
};
