// Central sprite registry. Holds procedurally-generated placeholder art and
// lets uploaded PNGs override any named sprite. Custom sprites persist in
// localStorage as data URLs so the editor and game share them.

import { buildItemIcons, ITEMS } from './items.js';
import { generatePlaceholderHead } from './spritegen.js';

const LS_KEY = 'jfd_custom_sprites_v1';

// name -> drawable (HTMLCanvasElement or HTMLImageElement)
const registry = new Map();
// name -> data URL (only for custom/uploaded)
let custom = {};

function loadCustom() {
  try {
    custom = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch (e) {
    custom = {};
  }
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(custom));
  } catch (e) {
    /* storage may be full/unavailable; keep in-memory only */
  }
}

function imageFromDataUrl(url) {
  const img = new Image();
  img.src = url;
  return img;
}

// Head roster used by the game (player + NPC types). Real PNGs replace these.
export const HEAD_NAMES = ['head_john', 'head_customer', 'head_fan', 'head_rival', 'head_producer'];

const HEAD_STYLES = {
  head_john: { skin: '#e0a878', hair: '#2a1a10', cap: '#d94141' },
  head_customer: { skin: '#c98d5b', hair: '#3a2a18', cap: '#3f8f4f' },
  head_fan: { skin: '#f0c090', hair: '#5a3010', cap: '#8e44ad' },
  head_rival: { skin: '#a5764a', hair: '#101010', cap: '#222' },
  head_producer: { skin: '#e8b890', hair: '#4a3020', cap: '#f39c12' },
};

let initialized = false;

export function initSprites() {
  if (initialized) return;
  initialized = true;
  loadCustom();

  // Placeholder pickup icons.
  const icons = buildItemIcons();
  for (const key in ITEMS) registry.set(ITEMS[key].sprite, icons[key]);

  // Placeholder heads.
  for (const name of HEAD_NAMES) {
    registry.set(name, generatePlaceholderHead(HEAD_STYLES[name] || {}));
  }

  // Apply any uploaded overrides.
  for (const name in custom) registry.set(name, imageFromDataUrl(custom[name]));
}

export function getSprite(name) {
  return registry.get(name) || null;
}

export function setSprite(name, drawable) {
  registry.set(name, drawable);
}

// Save an uploaded PNG (data URL) under `name`, overriding any placeholder.
export function saveCustomSprite(name, dataUrl) {
  custom[name] = dataUrl;
  persist();
  registry.set(name, imageFromDataUrl(dataUrl));
}

export function removeCustomSprite(name, restoreDrawable) {
  delete custom[name];
  persist();
  if (restoreDrawable) registry.set(name, restoreDrawable);
  else registry.delete(name);
}

export function listCustomSprites() {
  return { ...custom };
}

export function hasCustom(name) {
  return Object.prototype.hasOwnProperty.call(custom, name);
}

// Reset a head back to its procedural placeholder (used by the editor).
export function resetHeadPlaceholder(name) {
  removeCustomSprite(name, generatePlaceholderHead(HEAD_STYLES[name] || {}));
}

export function resetItemPlaceholder(spriteName) {
  for (const key in ITEMS) {
    if (ITEMS[key].sprite === spriteName) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ITEMS[key].draw(ctx);
      removeCustomSprite(spriteName, c);
      return;
    }
  }
  removeCustomSprite(spriteName);
}
