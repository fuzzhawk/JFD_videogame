// Pickup / item definitions. Each item draws a placeholder 16x16 pixel icon in
// code (real PNG art can override it later via the sprite registry, keyed by
// `sprite`). Effects are interpreted by the game when collected.

function mk(draw) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return c;
}
const P = (ctx, x, y, w, h, col) => {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
};

// category: money | food | buff | style
export const ITEMS = {
  coin: {
    label: 'Coin', category: 'money', money: 5, weight: 22, sprite: 'item_coin',
    draw: (ctx) => { P(ctx, 5, 4, 6, 8, '#b8860b'); P(ctx, 6, 3, 4, 10, '#ffd700'); P(ctx, 7, 6, 2, 4, '#b8860b'); },
  },
  bill: {
    label: 'Cash', category: 'money', money: 15, weight: 14, sprite: 'item_bill',
    draw: (ctx) => { P(ctx, 2, 5, 12, 6, '#2e7d32'); P(ctx, 3, 6, 10, 4, '#43a047'); P(ctx, 7, 7, 2, 2, '#c8e6c9'); },
  },
  stack: {
    label: 'Money Stack', category: 'money', money: 50, weight: 5, sprite: 'item_stack',
    draw: (ctx) => { P(ctx, 2, 8, 12, 5, '#1b5e20'); P(ctx, 2, 5, 12, 5, '#2e7d32'); P(ctx, 3, 6, 10, 3, '#66bb6a'); P(ctx, 7, 6, 2, 2, '#e8f5e9'); },
  },
  hotdog: {
    label: 'Hot Dog', category: 'food', hotdogs: 1, weight: 20, sprite: 'item_hotdog',
    draw: (ctx) => { P(ctx, 2, 6, 12, 4, '#e8b56b'); P(ctx, 3, 7, 10, 2, '#b5502a'); P(ctx, 4, 6, 8, 1, '#ffd54f'); P(ctx, 5, 9, 6, 1, '#e53935'); },
  },
  bun: {
    label: 'Bun', category: 'food', hotdogs: 1, weight: 12, sprite: 'item_bun',
    draw: (ctx) => { P(ctx, 3, 6, 10, 5, '#d9a441'); P(ctx, 4, 6, 8, 2, '#f0c56b'); },
  },
  sausage: {
    label: 'Sausage', category: 'food', hotdogs: 1, weight: 12, sprite: 'item_sausage',
    draw: (ctx) => { P(ctx, 3, 7, 10, 3, '#a0341f'); P(ctx, 4, 7, 8, 1, '#c0503a'); },
  },
  ketchup: {
    label: 'Ketchup', category: 'food', hotdogs: 1, weight: 8, sprite: 'item_ketchup',
    draw: (ctx) => { P(ctx, 6, 3, 4, 3, '#eee'); P(ctx, 5, 6, 6, 7, '#d32f2f'); P(ctx, 7, 8, 2, 3, '#fff'); },
  },
  mustard: {
    label: 'Mustard', category: 'food', hotdogs: 1, weight: 8, sprite: 'item_mustard',
    draw: (ctx) => { P(ctx, 6, 3, 4, 3, '#eee'); P(ctx, 5, 6, 6, 7, '#f9a825'); P(ctx, 7, 8, 2, 3, '#fff'); },
  },
  soda: {
    label: 'Soda', category: 'buff', buff: 'speed', duration: 10, weight: 8, sprite: 'item_soda',
    draw: (ctx) => { P(ctx, 5, 3, 6, 10, '#c62828'); P(ctx, 5, 6, 6, 2, '#eee'); P(ctx, 6, 2, 4, 1, '#999'); },
  },
  coffee: {
    label: 'Coffee', category: 'buff', buff: 'speed', duration: 12, weight: 6, sprite: 'item_coffee',
    draw: (ctx) => { P(ctx, 4, 5, 7, 8, '#fff'); P(ctx, 5, 6, 5, 6, '#5d4037'); P(ctx, 11, 6, 2, 3, '#ddd'); },
  },
  mic: {
    label: 'Microphone', category: 'buff', buff: 'rap', duration: 20, weight: 5, sprite: 'item_mic',
    draw: (ctx) => { P(ctx, 6, 2, 4, 5, '#9e9e9e'); P(ctx, 6, 2, 4, 2, '#bdbdbd'); P(ctx, 7, 7, 2, 6, '#424242'); },
  },
  boombox: {
    label: 'Boombox', category: 'buff', buff: 'rap', duration: 25, weight: 3, sprite: 'item_boombox',
    draw: (ctx) => { P(ctx, 2, 5, 12, 7, '#37474f'); P(ctx, 4, 7, 3, 3, '#eee'); P(ctx, 9, 7, 3, 3, '#eee'); P(ctx, 4, 4, 8, 1, '#607d8b'); },
  },
  chain: {
    label: 'Gold Chain', category: 'style', fame: 25, weight: 5, sprite: 'item_chain',
    draw: (ctx) => { P(ctx, 4, 5, 1, 3, '#ffd700'); P(ctx, 6, 6, 1, 3, '#ffd700'); P(ctx, 8, 6, 1, 3, '#ffd700'); P(ctx, 10, 5, 1, 3, '#ffd700'); P(ctx, 6, 9, 4, 3, '#ffea00'); },
  },
  diamond: {
    label: 'Diamond', category: 'style', fame: 40, weight: 3, sprite: 'item_diamond',
    draw: (ctx) => { P(ctx, 5, 4, 6, 2, '#4dd0e1'); P(ctx, 4, 6, 8, 2, '#26c6da'); P(ctx, 6, 8, 4, 3, '#b2ebf2'); P(ctx, 7, 11, 2, 1, '#00acc1'); },
  },
  vinyl: {
    label: 'Vinyl Record', category: 'style', fame: 20, weight: 6, sprite: 'item_vinyl',
    draw: (ctx) => { P(ctx, 4, 4, 8, 8, '#212121'); P(ctx, 6, 6, 4, 4, '#e53935'); P(ctx, 7, 7, 2, 2, '#212121'); },
  },
  cap: {
    label: 'Snapback', category: 'style', fame: 15, weight: 8, sprite: 'item_cap',
    draw: (ctx) => { P(ctx, 4, 5, 8, 3, '#1565c0'); P(ctx, 4, 8, 10, 1, '#0d47a1'); P(ctx, 5, 4, 6, 1, '#1976d2'); },
  },
  sneaker: {
    label: 'Fresh Kicks', category: 'style', fame: 18, weight: 7, sprite: 'item_sneaker',
    draw: (ctx) => { P(ctx, 3, 8, 10, 3, '#eee'); P(ctx, 3, 6, 6, 3, '#e53935'); P(ctx, 3, 11, 10, 1, '#bdbdbd'); },
  },
};

// Precompute placeholder icons.
export function buildItemIcons() {
  const icons = {};
  for (const key in ITEMS) icons[key] = mk(ITEMS[key].draw);
  return icons;
}

// Weighted random item key using a supplied [0,1) sampler.
export function pickWeighted(rand) {
  let total = 0;
  for (const k in ITEMS) total += ITEMS[k].weight;
  let r = rand() * total;
  for (const k in ITEMS) {
    r -= ITEMS[k].weight;
    if (r <= 0) return k;
  }
  return 'coin';
}
