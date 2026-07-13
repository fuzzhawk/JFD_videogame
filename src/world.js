// Side-scrolling beat-em-up world. The world runs left -> right and is divided
// into alternating SEGMENTS:
//   - TOWN: the walkable band PINCHES narrow (a tight brawl corridor) with a
//     dense city backdrop, enemies, and a few friendly NPCs to sell/rap to.
//   - OPEN: the band WIDENS after a town, with blob-shaped forests, lots of
//     pickups, and roaming random enemies.
// The band is the horizontal lane the fighters walk in (classic beat-em-up
// depth plane). Everything is deterministic from a seed and generated lazily.

import { hash2, makeRng } from './rng.js';

export const SEG = { OPEN: 'open', TOWN: 'town' };

// Band vertical extents, as fractions of the viewport height. The BOTTOM (where
// feet can reach nearest the camera) is constant; the TOP moves to pinch/widen.
export const BAND_BOTTOM = 0.90;
export const OPEN_TOP = 0.46;
export const TOWN_TOP = 0.66;
const TRANS = 240; // px over which the band interpolates near a boundary

// Forest / tile palette reused for the blob forests.
export const T = { GRASS: 'grass', TREE: 'tree' };
export const TILE_COLORS = { grass: '#5a9a44', tree: '#3d7a30' };

export class World {
  constructor(seed = 12345) {
    this.seed = seed >>> 0;
    this.segments = [];
    this.minX = 0;
    this._ensureIndex(0);
  }

  _segWidth(index, type) {
    const h = hash2(index, 7, this.seed);
    if (type === SEG.TOWN) return 820 + Math.floor(h * 360);   // pinched brawl
    return 1500 + Math.floor(h * 900);                          // open stretch
  }

  _typeFor(index) {
    // index 0 = open outskirts of Dawson, then alternate town/open.
    if (index === 0) return SEG.OPEN;
    return index % 2 === 1 ? SEG.TOWN : SEG.OPEN;
  }

  _ensureIndex(index) {
    while (this.segments.length <= index) {
      const i = this.segments.length;
      const type = this._typeFor(i);
      const x0 = i === 0 ? 0 : this.segments[i - 1].x1;
      const width = this._segWidth(i, type);
      const seg = { index: i, type, x0, x1: x0 + width, width, seed: (this.seed ^ (i * 2654435761)) >>> 0 };
      this.segments.push(seg);
    }
  }

  ensureUpTo(worldX) {
    let i = this.segments.length - 1;
    while (this.segments[i].x1 < worldX + 200) { this._ensureIndex(i + 1); i++; }
  }

  segmentAt(worldX) {
    this.ensureUpTo(worldX);
    for (const s of this.segments) if (worldX >= s.x0 && worldX < s.x1) return s;
    return this.segments[this.segments.length - 1];
  }

  _topFor(type) { return type === SEG.TOWN ? TOWN_TOP : OPEN_TOP; }

  // Interpolated band top fraction at worldX (creates the pinch transitions).
  bandTopFrac(worldX) {
    const seg = this.segmentAt(worldX);
    let base = this._topFor(seg.type);
    // Blend toward neighbour near boundaries.
    if (worldX - seg.x0 < TRANS && seg.index > 0) {
      const prev = this.segments[seg.index - 1];
      const t = smooth((worldX - seg.x0) / TRANS);
      base = lerp(this._topFor(prev.type), base, t);
    } else if (seg.x1 - worldX < TRANS) {
      this._ensureIndex(seg.index + 1);
      const next = this.segments[seg.index + 1];
      const t = smooth((seg.x1 - worldX) / TRANS);
      base = lerp(this._topFor(next.type), base, t);
    }
    return base;
  }

  bandAt(worldX) {
    return { topF: this.bandTopFrac(worldX), botF: BAND_BOTTOM };
  }

  // Cached background scenery for a segment.
  scenery(seg) {
    if (seg._scenery) return seg._scenery;
    const rng = makeRng(seg.seed ^ 0x9e37);
    const buildings = [];
    const forest = [];
    if (seg.type === SEG.TOWN) {
      let x = seg.x0 - 40;
      while (x < seg.x1 + 40) {
        const w = 70 + Math.floor(rng() * 90);
        const h = 0.30 + rng() * 0.34; // fraction of viewport height
        buildings.push({ x, w, h, tone: Math.floor(rng() * 6), lit: rng() > 0.5 });
        x += w + 6 + Math.floor(rng() * 16);
      }
    } else {
      // Sparse buildings on the town-facing edges, forest blobs in the middle.
      const nb = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < nb; i++) {
        const edge = rng() > 0.5 ? seg.x0 + rng() * 160 : seg.x1 - rng() * 160;
        buildings.push({ x: edge, w: 60 + rng() * 60, h: 0.22 + rng() * 0.18, tone: Math.floor(rng() * 6), lit: rng() > 0.6 });
      }
      const nBlobs = 3 + Math.floor(rng() * 4);
      for (let i = 0; i < nBlobs; i++) {
        const cx = seg.x0 + 120 + rng() * (seg.width - 240);
        const cy = 0.30 + rng() * 0.13; // sit near the horizon (treeline behind the band)
        const r = 60 + rng() * 90;
        // Pre-place a few tree tiles inside the blob.
        const trees = [];
        const nt = 5 + Math.floor(rng() * 8);
        for (let t = 0; t < nt; t++) {
          const a = rng() * Math.PI * 2;
          const rr = rng() * r * 0.8;
          trees.push({ dx: Math.cos(a) * rr, dy: Math.sin(a) * rr * 0.55, s: 0.7 + rng() * 0.7 });
        }
        forest.push({ cx, cy, r, trees });
      }
    }
    seg._scenery = { buildings, forest };
    return seg._scenery;
  }

  // Deterministic spawn plan for a segment. fieldY values are fractions (0..1)
  // of the viewport height, sampled inside the band at that x.
  spawnPlan(seg) {
    if (seg._plan) return seg._plan;
    const rng = makeRng(seg.seed ^ 0x1234abcd);
    const enemies = [];
    const pickups = [];
    const npcs = [];
    const yInBand = (x) => {
      const top = this.bandTopFrac(x);
      return top + rng() * (BAND_BOTTOM - top);
    };
    const spanX = () => seg.x0 + 100 + rng() * (seg.width - 200);

    if (seg.type === SEG.TOWN) {
      const ne = 4 + Math.floor(rng() * 4);
      for (let i = 0; i < ne; i++) {
        const x = spanX();
        enemies.push({ x, y: yInBand(x), type: rng() > 0.75 ? 'brute' : 'thug' });
      }
      const nn = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < nn; i++) {
        const x = spanX();
        const r = rng();
        const type = r > 0.9 ? 'producer' : r > 0.55 ? 'fan' : 'customer';
        npcs.push({ x, y: yInBand(x), type });
      }
      const np = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < np; i++) { const x = spanX(); pickups.push({ x, y: yInBand(x) }); }
    } else {
      const ne = seg.index === 0 ? 1 : 2 + Math.floor(rng() * 3);
      for (let i = 0; i < ne; i++) {
        const x = spanX();
        enemies.push({ x, y: yInBand(x), type: rng() > 0.7 ? 'brute' : 'thug' });
      }
      const np = 8 + Math.floor(rng() * 6);
      for (let i = 0; i < np; i++) { const x = spanX(); pickups.push({ x, y: yInBand(x) }); }
      if (rng() > 0.5) { const x = spanX(); npcs.push({ x, y: yInBand(x), type: rng() > 0.5 ? 'fan' : 'customer' }); }
    }
    seg._plan = { enemies, pickups, npcs };
    return seg._plan;
  }

  buildingTone(tone) {
    const palette = ['#3a4a63', '#45526b', '#525b6e', '#5a4f63', '#4a5560', '#63586b'];
    return palette[tone % palette.length];
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
