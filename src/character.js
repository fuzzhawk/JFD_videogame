// A drawable character: a generated body spritesheet + a head sprite composited
// on top, with 4-direction walk animation. Body sheets are cached by their
// color signature so many NPCs sharing an outfit share one sheet.

import { generateBodySheet, headAnchor, DIRS, CELL_W, CELL_H } from './spritegen.js';
import { getSprite } from './sprites.js';

const WALK_COLS = [0, 1, 0, 2]; // stand, stepA, stand, stepB

const sheetCache = new Map();
function getSheet(colors) {
  const sig = `${colors.skin}|${colors.shirt}|${colors.pants}|${colors.shoes}`;
  let s = sheetCache.get(sig);
  if (!s) {
    s = generateBodySheet(colors, 1);
    sheetCache.set(sig, s);
  }
  return s;
}

export function dirFromVec(vx, vy) {
  if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) return null;
  if (Math.abs(vx) > Math.abs(vy)) return vx < 0 ? 'left' : 'right';
  return vy < 0 ? 'up' : 'down';
}

export class Character {
  constructor(colors, headName) {
    this.colors = colors;
    this.headName = headName;
    this.facing = 'down';
    this.walkTimer = 0;
    this.moving = false;
  }

  update(dt, vx, vy) {
    const d = dirFromVec(vx, vy);
    this.moving = d !== null;
    if (d) this.facing = d;
    if (this.moving) this.walkTimer += dt * (6 + Math.min(6, Math.hypot(vx, vy) * 3));
    else this.walkTimer = 0;
  }

  // Draw so that (footX, footY) in screen space is the character's feet center.
  draw(ctx, footX, footY, scale) {
    const sheet = getSheet(this.colors);
    const row = DIRS.indexOf(this.facing);
    const col = this.moving ? WALK_COLS[Math.floor(this.walkTimer) % 4] : 0;
    const cellLeft = footX - (CELL_W / 2) * scale;
    const cellTop = footY - (CELL_H - 2) * scale; // feet near y=22 of the 24-tall cell

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sheet.canvas,
      col * CELL_W, row * CELL_H, CELL_W, CELL_H,
      cellLeft, cellTop, CELL_W * scale, CELL_H * scale
    );

    // Head.
    const head = getSprite(this.headName);
    if (head && (head.complete === undefined || head.complete)) {
      const anchor = headAnchor(this.facing, col);
      const hw = 14 * scale;
      const hh = 14 * scale;
      const hcx = cellLeft + anchor.cx * scale;
      const hbottom = cellTop + (11 + anchor.bob) * scale;
      try {
        ctx.drawImage(head, hcx - hw / 2, hbottom - hh, hw, hh);
      } catch (e) { /* image not ready */ }
    }
  }
}
