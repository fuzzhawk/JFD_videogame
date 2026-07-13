// Sprite & animation editor: procedural body-animation preview/export plus PNG
// upload/testing for every named sprite the game uses. Everything shares the
// sprite registry with the game (localStorage), so edits here show up in-game.

import {
  initSprites, getSprite, saveCustomSprite, HEAD_NAMES,
  hasCustom, resetHeadPlaceholder, resetItemPlaceholder,
} from './sprites.js';
import { ITEMS } from './items.js';
import { generateBodySheet } from './spritegen.js';
import { Character, dirFromVec } from './character.js';
import { OUTFITS } from './entities.js';
import { getWordsText, setWords, resetWords, isCustomWords, DEFAULT_WORDS } from './words.js';

initSprites();

const $ = (id) => document.getElementById(id);
const DIRS = ['down', 'left', 'right', 'up'];

// ---- Body animation preview -------------------------------------------------
function currentColors() {
  return {
    skin: $('c-skin').value,
    shirt: $('c-shirt').value,
    pants: $('c-pants').value,
    shoes: $('c-shoes').value,
    outline: '#20141a',
  };
}

// One walking character per direction.
const previewChars = DIRS.map((d) => {
  const c = new Character(currentColors(), 'head_john');
  c.facing = d;
  c.moving = true;
  return c;
});

function syncCharColors() {
  const cols = currentColors();
  const head = $('head-select').value;
  for (const c of previewChars) { c.colors = cols; c.headName = head; }
}

['c-skin', 'c-shirt', 'c-pants', 'c-shoes'].forEach((id) =>
  $(id).addEventListener('input', syncCharColors));
$('head-select').addEventListener('change', syncCharColors);

// Head dropdown.
const headSel = $('head-select');
HEAD_NAMES.forEach((name) => {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name.replace('head_', '').replace(/^\w/, (c) => c.toUpperCase());
  headSel.appendChild(opt);
});

// Outfit presets.
const presetSel = $('preset-select');
OUTFITS.forEach((o, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = 'Outfit ' + (i + 1);
  presetSel.appendChild(opt);
});
presetSel.addEventListener('change', () => {
  const o = OUTFITS[+presetSel.value];
  if (!o) return;
  $('c-skin').value = o.skin;
  $('c-shirt').value = o.shirt;
  $('c-pants').value = o.pants;
  $('c-shoes').value = o.shoes;
  syncCharColors();
});

const previewCanvas = $('anim-preview');
const pctx = previewCanvas.getContext('2d');
let lastT = performance.now();

function animLoop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  // Responsive width, fixed height, crisp pixels.
  const cw = previewCanvas.clientWidth || 360;
  if (previewCanvas.width !== cw) previewCanvas.width = cw;
  const H = previewCanvas.height;

  pctx.imageSmoothingEnabled = false;
  pctx.fillStyle = '#0d1420';
  pctx.fillRect(0, 0, previewCanvas.width, H);

  const play = $('anim-play').checked;
  const zoom = +$('anim-zoom').value;

  const gap = previewCanvas.width / 4;
  DIRS.forEach((d, i) => {
    const c = previewChars[i];
    c.moving = play;
    if (play) c.walkTimer += dt * 8;
    const footX = gap * i + gap / 2;
    const footY = H * 0.5 + 12 * zoom / 2;
    c.draw(pctx, footX, footY, zoom);
    // Label.
    pctx.fillStyle = '#ffffff88';
    pctx.font = '11px system-ui, sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText(d, footX, H - 8);
  });
  pctx.textAlign = 'left';
  requestAnimationFrame(animLoop);
}
requestAnimationFrame(animLoop);

// Export spritesheet PNG.
$('btn-export-sheet').addEventListener('click', () => {
  const scale = +$('export-scale').value || 4;
  const { canvas } = generateBodySheet(currentColors(), scale);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `body_spritesheet_x${scale}.png`;
  a.click();
});

// ---- Sprite slots -----------------------------------------------------------
let uploadTarget = null; // { name, kind }
const fileInput = $('file-input');

function drawSlotPreview(canvas, spriteName) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const spr = getSprite(spriteName);
  if (!spr) return;
  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    // Fit sprite into the square, preserving aspect.
    const sw = spr.width || spr.naturalWidth || 16;
    const sh = spr.height || spr.naturalHeight || 16;
    const scale = Math.min(canvas.width / sw, canvas.height / sh);
    const dw = sw * scale, dh = sh * scale;
    try { ctx.drawImage(spr, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh); } catch (e) {}
  };
  if (spr.complete === false) spr.addEventListener('load', render, { once: true });
  render();
}

function makeSlot(spriteName, label, kind) {
  const div = document.createElement('div');
  div.className = 'slot';
  const canvas = document.createElement('canvas');
  canvas.width = 48; canvas.height = 48;
  div.appendChild(canvas);

  const name = document.createElement('div');
  name.className = 'slot-name';
  name.textContent = label;
  div.appendChild(name);

  const badge = document.createElement('span');
  div.appendChild(badge);

  const btns = document.createElement('div');
  btns.className = 'slot-btns';
  const up = document.createElement('button');
  up.className = 'up'; up.textContent = 'Upload';
  up.addEventListener('click', () => {
    uploadTarget = { name: spriteName, kind };
    fileInput.value = '';
    fileInput.click();
  });
  const reset = document.createElement('button');
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => {
    if (kind === 'head') resetHeadPlaceholder(spriteName);
    else resetItemPlaceholder(spriteName);
    refreshSlot(div, spriteName, badge, canvas);
  });
  btns.appendChild(up); btns.appendChild(reset);
  div.appendChild(btns);

  refreshSlot(div, spriteName, badge, canvas);
  div._refresh = () => refreshSlot(div, spriteName, badge, canvas);
  div._sprite = spriteName;
  return div;
}

function refreshSlot(div, spriteName, badge, canvas) {
  drawSlotPreview(canvas, spriteName);
  const custom = hasCustom(spriteName);
  badge.className = 'slot-badge ' + (custom ? 'custom' : 'placeholder');
  badge.textContent = custom ? 'custom PNG' : 'placeholder';
}

const headSlotsEl = $('head-slots');
const itemSlotsEl = $('item-slots');
const allSlots = [];

HEAD_NAMES.forEach((name) => {
  const label = name.replace('head_', '');
  const s = makeSlot(name, label, 'head');
  headSlotsEl.appendChild(s);
  allSlots.push(s);
});

Object.keys(ITEMS).forEach((key) => {
  const it = ITEMS[key];
  const s = makeSlot(it.sprite, it.label, 'item');
  itemSlotsEl.appendChild(s);
  allSlots.push(s);
});

// Handle uploads.
fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file || !uploadTarget) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    // Validate it's a decodable image before saving.
    const img = new Image();
    img.onload = () => {
      saveCustomSprite(uploadTarget.name, dataUrl);
      const slot = allSlots.find((s) => s._sprite === uploadTarget.name);
      if (slot && slot._refresh) slot._refresh();
      syncCharColors(); // heads update the animated preview
      uploadTarget = null;
    };
    img.onerror = () => { alert('Could not read that image. Please use a PNG/JPG.'); };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
});

$('btn-reset-all').addEventListener('click', () => {
  if (!confirm('Reset all sprites back to placeholders?')) return;
  HEAD_NAMES.forEach((n) => resetHeadPlaceholder(n));
  Object.keys(ITEMS).forEach((k) => resetItemPlaceholder(ITEMS[k].sprite));
  allSlots.forEach((s) => s._refresh && s._refresh());
  syncCharColors();
});

// ---- Rap words / lyrics -----------------------------------------------------
const wordsArea = $('rap-words');
const wordsStatus = $('words-status');
function refreshWordsStatus() {
  const custom = isCustomWords();
  wordsStatus.textContent = custom ? 'Using your custom words.' : `Using ${DEFAULT_WORDS.length} default words.`;
}
wordsArea.value = getWordsText();
refreshWordsStatus();

$('btn-save-words').addEventListener('click', () => {
  const arr = setWords(wordsArea.value);
  wordsArea.value = arr.join('\n');
  refreshWordsStatus();
  wordsStatus.textContent = `Saved ${arr.length} words. ` + wordsStatus.textContent;
});
$('btn-reset-words').addEventListener('click', () => {
  const arr = resetWords();
  wordsArea.value = arr.join('\n');
  refreshWordsStatus();
});
