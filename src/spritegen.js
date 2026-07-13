// Procedural pixel-art body animation generator with an SNES JRPG feel.
//
// It draws small (16x24) character bodies entirely in code, producing a walk
// spritesheet laid out as: rows = facing directions (down, left, right, up),
// columns = 4 walk frames [stand, stepA, stand, stepB].
//
// Heads are intentionally NOT drawn onto the body — the game composites a head
// PNG (real art later, placeholder now) at the returned head anchor so heads
// can be swapped/uploaded independently.

export const DIRS = ['down', 'left', 'right', 'up'];
export const CELL_W = 16;
export const CELL_H = 24;
export const COLS = 4;
export const ROWS = 4;
// Walk cycle: stand, stepA, stand, stepB.
const FRAME_PHASE = [0, 1, 0, 2];

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function shade(hex, amt) {
  // amt in [-1,1]; negative = darker.
  const c = hex.replace('#', '');
  let r = parseInt(c.substring(0, 2), 16);
  let g = parseInt(c.substring(2, 4), 16);
  let b = parseInt(c.substring(4, 6), 16);
  r = Math.max(0, Math.min(255, Math.round(r + amt * 255)));
  g = Math.max(0, Math.min(255, Math.round(g + amt * 255)));
  b = Math.max(0, Math.min(255, Math.round(b + amt * 255)));
  return `rgb(${r},${g},${b})`;
}

export const DEFAULT_BODY = {
  skin: '#e0a878',
  shirt: '#d94141',
  pants: '#33447a',
  shoes: '#3a2a1a',
  outline: '#20141a',
};

// Draw one body cell at origin (ox,oy) in base pixels.
// phase: 0 = standing, 1 = step A (left leg fwd), 2 = step B (right leg fwd).
function drawBody(ctx, ox, oy, dir, phase, colors) {
  const o = colors.outline;
  const shirt = colors.shirt;
  const shirtD = shade(shirt, -0.15);
  const pants = colors.pants;
  const pantsD = shade(pants, -0.15);
  const skin = colors.skin;
  const shoe = colors.shoes;

  // Body vertical layout inside the 16x24 cell (head zone is 0..8).
  const torsoY = 9;
  const legY = 17;
  const footY = 21;

  // Leg swing per phase.
  const legA = phase === 1 ? 1 : phase === 2 ? -1 : 0; // left leg vertical offset
  const legB = -legA; // right leg

  if (dir === 'down' || dir === 'up') {
    const facingUp = dir === 'up';
    // Torso.
    px(ctx, ox + 4, oy + torsoY - 1, 8, 8, o); // outline block
    px(ctx, ox + 5, oy + torsoY, 6, 6, shirt);
    px(ctx, ox + 5, oy + torsoY + 4, 6, 2, shirtD);
    // Arms.
    px(ctx, ox + 3, oy + torsoY, 2, 5, skin);
    px(ctx, ox + 11, oy + torsoY, 2, 5, skin);
    // Legs (pants).
    px(ctx, ox + 5, oy + legY + Math.max(0, legA), 2, 4, pants);
    px(ctx, ox + 9, oy + legY + Math.max(0, legB), 2, 4, pants);
    px(ctx, ox + 5, oy + legY + 2 + Math.max(0, legA), 2, 2, pantsD);
    px(ctx, ox + 9, oy + legY + 2 + Math.max(0, legB), 2, 2, pantsD);
    // Shoes.
    px(ctx, ox + 5, oy + footY + Math.max(0, legA) + 1, 2, 2, shoe);
    px(ctx, ox + 9, oy + footY + Math.max(0, legB) + 1, 2, 2, shoe);
    // A little back detail when facing up.
    if (facingUp) px(ctx, ox + 6, oy + torsoY + 1, 4, 4, shirtD);
  } else {
    // Side view (left/right). We draw a right-facing body then mirror for left.
    const flip = dir === 'left';
    const cx = ox; // we draw in local coords then optionally mirror
    const save = ctx.getTransform ? ctx.getTransform() : null;
    if (flip) {
      ctx.save();
      ctx.translate(ox + CELL_W, oy);
      ctx.scale(-1, 1);
      ctx.translate(-ox, -oy);
    }
    // Torso (narrower, profile).
    px(ctx, ox + 5, oy + torsoY - 1, 7, 8, o);
    px(ctx, ox + 6, oy + torsoY, 5, 6, shirt);
    px(ctx, ox + 6, oy + torsoY + 4, 5, 2, shirtD);
    // Front arm swings opposite to legs.
    const armSwing = phase === 1 ? 1 : phase === 2 ? -1 : 0;
    px(ctx, ox + 9, oy + torsoY + 1 - armSwing, 2, 5, skin);
    // Legs swing front/back.
    px(ctx, ox + 6, oy + legY, 2, 4 + legA, pants);
    px(ctx, ox + 9, oy + legY, 2, 4 + legB, pants);
    px(ctx, ox + 6, oy + footY + legA, 3, 2, shoe);
    px(ctx, ox + 9, oy + footY + legB, 3, 2, shoe);
    if (flip) ctx.restore();
    if (save) { /* transform restored above */ }
  }
}

// Head anchor (center x, top y) and vertical bob for a given frame column.
export function headAnchor(dir, col) {
  const phase = FRAME_PHASE[col];
  const bob = phase === 0 ? 0 : -1; // slight bounce on steps
  return { cx: CELL_W / 2, top: 3 + bob, bob };
}

export function frameCount() {
  return COLS;
}

// Build the full body spritesheet onto a fresh canvas. Returns metadata.
export function generateBodySheet(colors = DEFAULT_BODY, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * COLS * scale;
  canvas.height = CELL_H * ROWS * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (scale !== 1) ctx.scale(scale, scale);
  for (let r = 0; r < ROWS; r++) {
    const dir = DIRS[r];
    for (let c = 0; c < COLS; c++) {
      drawBody(ctx, c * CELL_W, r * CELL_H, dir, FRAME_PHASE[c], colors);
    }
  }
  return { canvas, cellW: CELL_W, cellH: CELL_H, cols: COLS, rows: ROWS, dirs: DIRS };
}

// A placeholder head PNG-equivalent canvas (face + cap) so the game is playable
// before real head art is uploaded. 16x16.
export function generatePlaceholderHead(opts = {}) {
  const skin = opts.skin || '#e0a878';
  const hair = opts.hair || '#2a1a10';
  const cap = opts.cap || '#1b7a3a';
  const outline = opts.outline || '#20141a';
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // Face.
  px(ctx, 3, 4, 10, 10, outline);
  px(ctx, 4, 5, 8, 8, skin);
  // Cheeks shade.
  px(ctx, 4, 11, 8, 2, shade(skin, -0.1));
  // Eyes.
  px(ctx, 6, 8, 1, 2, outline);
  px(ctx, 9, 8, 1, 2, outline);
  // Mouth.
  px(ctx, 7, 11, 2, 1, shade(skin, -0.35));
  // Hair sides.
  px(ctx, 4, 5, 1, 5, hair);
  px(ctx, 11, 5, 1, 5, hair);
  // Cap (a nod to the rapper vibe).
  px(ctx, 3, 2, 10, 3, outline);
  px(ctx, 4, 3, 8, 2, cap);
  px(ctx, 11, 4, 4, 1, shade(cap, -0.2)); // brim
  return canvas;
}
