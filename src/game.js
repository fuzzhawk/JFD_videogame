// Main game: world rendering, entity spawning, collision, interactions, HUD,
// the run timer, and the rap minigame hand-off. Talks to the DOM overlays in
// index.html for the title/game-over/leaderboard screens.

import { World, TILE, T, TILE_COLORS } from './world.js';
import { Player, NPC } from './entities.js';
import { Pickup } from './entities.js';
import { ITEMS, pickWeighted } from './items.js';
import { getSprite, initSprites } from './sprites.js';
import { Input } from './input.js';
import { sfx, resumeAudio, setMuted, isMuted } from './audio.js';
import { RapGame } from './rap.js';
import { Leaderboard } from './leaderboard.js';
import { makeRng } from './rng.js';

const DAY_LENGTH = 180; // seconds per run
const SPAWN_RADIUS = 15; // tiles
const MAX_PICKUPS = 46;
const MAX_NPCS = 16;

export class Game {
  constructor(canvas, dom) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dom = dom; // { hud fields, overlays }
    initSprites();

    this.state = 'title'; // title | playing | rap | over
    this.input = new Input(canvas);
    this.rng = makeRng((Math.random() * 1e9) | 0);

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.floaters = [];
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.vw = w;
    this.vh = h;
    const minDim = Math.min(w, h);
    this.zoom = Math.max(2, Math.min(3, Math.round(minDim / (TILE * 9))));
  }

  start(seed) {
    resumeAudio();
    this.world = new World(seed >>> 0);
    // Find a nice starting spot on land near a town.
    let sx = 0, sy = 0;
    for (let i = 0; i < 400; i++) {
      const tx = ((this.rng() * 2000) | 0) - 1000;
      const ty = ((this.rng() * 2000) | 0) - 1000;
      if (this.world.isPavement(tx, ty) || this.world.tileAt(tx, ty) === T.GRASS) {
        const w = this.world.findWalkable(tx, ty);
        sx = w.tx; sy = w.ty;
        if (this.world.isPavement(sx, sy)) break;
      }
    }
    this.player = new Player(sx * TILE + TILE / 2, sy * TILE + TILE / 2);
    this.pickups = [];
    this.npcs = [];
    this.floaters = [];
    this.timeLeft = DAY_LENGTH;
    this.rapGame = null;
    this.nearNpc = null;
    this.state = 'playing';
    this._populate(true);
  }

  // ---- Spawning ----------------------------------------------------------
  _randTileAround(minTiles, maxTiles) {
    const ang = this.rng() * Math.PI * 2;
    const dist = minTiles + this.rng() * (maxTiles - minTiles);
    const ptx = Math.floor(this.player.x / TILE);
    const pty = Math.floor(this.player.y / TILE);
    return {
      tx: ptx + Math.round(Math.cos(ang) * dist),
      ty: pty + Math.round(Math.sin(ang) * dist),
    };
  }

  _populate(initial) {
    // Pickups.
    let guard = 0;
    while (this.pickups.length < MAX_PICKUPS && guard++ < 300) {
      const { tx, ty } = this._randTileAround(initial ? 1 : 8, SPAWN_RADIUS);
      if (!this.world.isWalkable(tx, ty)) continue;
      const t = this.world.tileAt(tx, ty);
      if (t === T.WATER) continue;
      const key = pickWeighted(this.rng);
      this.pickups.push(new Pickup(tx * TILE + TILE / 2, ty * TILE + TILE / 2, key));
    }
    // NPCs — only on pavement (towns).
    guard = 0;
    while (this.npcs.length < MAX_NPCS && guard++ < 400) {
      const { tx, ty } = this._randTileAround(initial ? 2 : 7, SPAWN_RADIUS);
      if (!this.world.isPavement(tx, ty)) continue;
      const r = this.rng();
      let type = 'customer';
      if (r > 0.94) type = 'producer';
      else if (r > 0.80) type = 'rival';
      else if (r > 0.55) type = 'fan';
      this.npcs.push(new NPC(tx * TILE + TILE / 2, ty * TILE + TILE / 2, type, this.world));
    }
  }

  _despawnFar() {
    const px = this.player.x, py = this.player.y;
    const maxD = (SPAWN_RADIUS + 6) * TILE;
    this.pickups = this.pickups.filter((p) => Math.hypot(p.x - px, p.y - py) < maxD);
    this.npcs = this.npcs.filter((n) => Math.hypot(n.x - px, n.y - py) < maxD);
  }

  // ---- Update ------------------------------------------------------------
  _loop(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05; // clamp big frame gaps
    this.input.update();

    if (this.state === 'playing') this._updatePlaying(dt);
    else if (this.state === 'rap') this._updateRap(dt);

    this._render();
    requestAnimationFrame(this._loop);
  }

  _updatePlaying(dt) {
    const p = this.player;
    const sp = p.speed();
    p.vx = this.input.dir.x * sp;
    p.vy = this.input.dir.y * sp;
    this._moveEntity(p, p.vx * dt, p.vy * dt);
    p.update(dt);

    // Timer.
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this._endRun(); return; }

    // Entities.
    for (const pk of this.pickups) pk.update(dt);
    for (const n of this.npcs) n.update(dt);

    // Pickup collection.
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < p.radius + 10) this._collect(pk);
    }
    this.pickups = this.pickups.filter((pk) => !pk.taken);

    // Find nearest interactable NPC.
    this.nearNpc = null;
    let best = TILE * 1.3;
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < best && !n.satisfied()) { best = d; this.nearNpc = n; }
    }

    if (this.input.consumeAction() && this.nearNpc) this._interact(this.nearNpc);

    // Keep the world populated as the player roams.
    if (Math.random() < 0.35) { this._despawnFar(); this._populate(false); }

    // Floaters.
    this._updateFloaters(dt);
    this._syncHud();
  }

  _updateRap(dt) {
    this.rapGame.update(dt);
    if (this.input.consumeAction()) this.rapGame.tap();
    this._updateFloaters(dt);
  }

  _moveEntity(e, dx, dy) {
    const r = e.radius;
    // X axis.
    let nx = e.x + dx;
    if (!this._solidAt(nx + Math.sign(dx) * r, e.y)) e.x = nx;
    // Y axis.
    let ny = e.y + dy;
    if (!this._solidAt(e.x, ny + Math.sign(dy) * r)) e.y = ny;
  }

  _solidAt(wx, wy) {
    return this.world.isSolid(Math.floor(wx / TILE), Math.floor(wy / TILE));
  }

  _collect(pk) {
    pk.taken = true;
    const def = ITEMS[pk.key];
    const p = this.player;
    let text = '';
    if (def.money) { p.money += def.money; p.earned += def.money; text = '+$' + def.money; sfx.coin(); }
    else if (def.hotdogs) { p.hotdogs += def.hotdogs; text = '+' + def.hotdogs + ' 🌭'; sfx.hotdog(); }
    else if (def.buff) { p.buffs[def.buff] = Math.max(p.buffs[def.buff], def.duration); text = def.label + '!'; sfx.buff(); }
    else if (def.fame) { p.fame += def.fame; text = '+' + def.fame + ' fame'; sfx.buff(); }
    else { sfx.pickup(); }
    this._addFloater(pk.x, pk.y, text, def.money ? '#ffd54f' : def.hotdogs ? '#ffab40' : '#7cf');
  }

  _interact(npc) {
    const p = this.player;
    const def = npc.def;
    if (def.want === 'food') {
      if (p.hotdogs <= 0) {
        this._addFloater(p.x, p.y - 20, 'Need a hot dog!', '#ff7043');
        sfx.bad();
        return;
      }
      p.hotdogs -= 1;
      const pay = def.pay[0] + Math.floor(this.rng() * (def.pay[1] - def.pay[0] + 1));
      p.money += pay; p.earned += pay; p.fame += 2;
      npc.cooldown = 12;
      this._addFloater(npc.x, npc.y - 24, 'Sold! +$' + pay, '#4caf50');
      sfx.sell();
    } else {
      // Rap / battle.
      this.state = 'rap';
      const rapBoost = p.buffs.rap > 0;
      this.rapGame = new RapGame(
        { rounds: def.rounds || 4, title: def.want === 'battle' ? 'Rap Battle!' : 'Drop a verse!', rapBoost },
        (result) => this._rapDone(npc, result)
      );
    }
  }

  _rapDone(npc, result) {
    const p = this.player;
    const def = npc.def;
    const base = def.pay[0] + Math.floor((def.pay[1] - def.pay[0]) * result.quality);
    const boost = p.buffs.rap > 0 ? 1.3 : 1;
    const money = Math.round(base * boost);
    const fame = Math.round((10 + result.hits * 6) * (result.perfect ? 1.5 : 1) * boost);
    p.money += money; p.earned += money; p.fame += fame;
    npc.cooldown = 15;
    this.state = 'playing';
    this.rapGame = null;
    const msg = result.perfect ? 'PERFECT! ' : result.quality > 0.6 ? 'Nice flow! ' : result.quality > 0.2 ? 'Not bad. ' : 'Rough set. ';
    this._addFloater(npc.x, npc.y - 26, msg + '+$' + money, '#ba68c8');
    this._addFloater(npc.x, npc.y - 44, '+' + fame + ' fame', '#f06292');
  }

  // ---- Floating text -----------------------------------------------------
  _addFloater(x, y, text, color) {
    if (!text) return;
    this.floaters.push({ x, y, text, color, life: 1.1, vy: -28 });
  }
  _updateFloaters(dt) {
    for (const f of this.floaters) { f.y += f.vy * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  // ---- Rendering ---------------------------------------------------------
  _render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (this.state === 'title' || !this.world) return;

    const z = this.zoom;
    const camX = this.player.x - this.vw / 2 / z;
    const camY = this.player.y - this.vh / 2 / z;
    this._drawWorld(ctx, camX, camY, z);

    // Collect renderables and sort by feet-y for pseudo-depth.
    const items = [];
    for (const pk of this.pickups) items.push({ y: pk.y, kind: 'pickup', ref: pk });
    for (const n of this.npcs) items.push({ y: n.y, kind: 'npc', ref: n });
    items.push({ y: this.player.y, kind: 'player', ref: this.player });
    items.sort((a, b) => a.y - b.y);

    for (const it of items) {
      const sx = (it.ref.x - camX) * z;
      const sy = (it.ref.y - camY) * z;
      if (it.kind === 'pickup') this._drawPickup(ctx, it.ref, sx, sy, z);
      else this._drawCharacter(ctx, it.ref, sx, sy, z);
    }

    // Interaction prompt above near NPC.
    if (this.state === 'playing' && this.nearNpc) {
      const n = this.nearNpc;
      const sx = (n.x - camX) * z;
      const sy = (n.y - camY) * z - 52 * z / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px system-ui, sans-serif';
      const label = n.def.want === 'food' ? '🌭 Sell' : n.def.want === 'battle' ? '🎤 Battle' : '🎤 Rap';
      const tw = ctx.measureText(label).width + 14;
      ctx.fillRect(sx - tw / 2, sy - 40, tw, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, sx, sy - 26);
      ctx.textAlign = 'left';
    }

    // Floaters.
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      const sx = (f.x - camX) * z;
      const sy = (f.y - camY) * z;
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(f.text, sx + 1, sy + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';

    // Touch joystick.
    if (this.input.joyActive) this._drawJoystick(ctx);

    // Rap overlay.
    if (this.state === 'rap' && this.rapGame) this.rapGame.draw(ctx, this.vw, this.vh);
  }

  _drawWorld(ctx, camX, camY, z) {
    const ts = TILE * z;
    const startTx = Math.floor(camX / TILE) - 1;
    const startTy = Math.floor(camY / TILE) - 1;
    const cols = Math.ceil(this.vw / ts) + 3;
    const rows = Math.ceil(this.vh / ts) + 3;
    for (let ty = startTy; ty < startTy + rows; ty++) {
      for (let tx = startTx; tx < startTx + cols; tx++) {
        const type = this.world.tileAt(tx, ty);
        const x = (tx * TILE - camX) * z;
        const y = (ty * TILE - camY) * z;
        this._drawTile(ctx, type, tx, ty, x, y, ts);
      }
    }
  }

  _drawTile(ctx, type, tx, ty, x, y, ts) {
    if (type === T.BUILDING) {
      ctx.fillStyle = this.world.buildingColor(tx, ty);
      ctx.fillRect(x, y, ts, ts);
      // Roof shadow + window grid.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, y, ts, ts * 0.18);
      ctx.fillStyle = 'rgba(180,220,255,0.35)';
      ctx.fillRect(x + ts * 0.22, y + ts * 0.34, ts * 0.24, ts * 0.24);
      ctx.fillRect(x + ts * 0.56, y + ts * 0.34, ts * 0.24, ts * 0.24);
      return;
    }
    if (type === T.TREE) {
      ctx.fillStyle = TILE_COLORS[T.GRASS];
      ctx.fillRect(x, y, ts, ts);
      ctx.fillStyle = '#5a3b1a';
      ctx.fillRect(x + ts * 0.44, y + ts * 0.55, ts * 0.12, ts * 0.3);
      ctx.fillStyle = '#2e6b26';
      ctx.beginPath();
      ctx.arc(x + ts * 0.5, y + ts * 0.4, ts * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3d8a30';
      ctx.beginPath();
      ctx.arc(x + ts * 0.42, y + ts * 0.34, ts * 0.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    let color = TILE_COLORS[type] || '#333';
    // Subtle per-tile variation for natural tiles.
    if (type === T.GRASS || type === T.WATER || type === T.SAND) {
      const h = ((tx * 73856093) ^ (ty * 19349663)) & 7;
      const shift = (h - 3.5) * 3;
      ctx.fillStyle = this._shiftColor(color, shift);
    } else {
      ctx.fillStyle = color;
    }
    ctx.fillRect(x, y, ts, ts);
    if (type === T.ROAD) {
      // Center dashes on alternating tiles.
      if (((tx + ty) & 1) === 0) {
        ctx.fillStyle = 'rgba(255,235,150,0.55)';
        ctx.fillRect(x + ts * 0.45, y + ts * 0.2, ts * 0.1, ts * 0.6);
      }
    }
  }

  _shiftColor(hex, amt) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substring(0, 2), 16) + amt;
    let g = parseInt(c.substring(2, 4), 16) + amt;
    let b = parseInt(c.substring(4, 6), 16) + amt;
    r = Math.max(0, Math.min(255, r | 0));
    g = Math.max(0, Math.min(255, g | 0));
    b = Math.max(0, Math.min(255, b | 0));
    return `rgb(${r},${g},${b})`;
  }

  _drawPickup(ctx, pk, sx, sy, z) {
    const spr = getSprite(ITEMS[pk.key].sprite);
    const bob = Math.sin(pk.t) * 3;
    const size = 18 * (z / 2.2);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 6, size * 0.4, size * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    if (spr && (spr.complete === undefined || spr.complete)) {
      ctx.imageSmoothingEnabled = false;
      try { ctx.drawImage(spr, sx - size / 2, sy - size / 2 + bob - 6, size, size); } catch (e) {}
    }
  }

  _drawCharacter(ctx, e, sx, sy, z) {
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 9 * (z / 2), 4 * (z / 2), 0, 0, Math.PI * 2);
    ctx.fill();
    e.character.draw(ctx, sx, sy, z);
    // Marker for the near NPC.
    if (this.state === 'playing' && this.nearNpc === e) {
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 12 * (z / 2), 5 * (z / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawJoystick(ctx) {
    const o = this.input.joyOrigin;
    const p = this.input.joyPos;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(o.x, o.y, 55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill();
  }

  // ---- HUD & flow --------------------------------------------------------
  _syncHud() {
    const d = this.dom;
    const p = this.player;
    d.money.textContent = '$' + p.money;
    d.hotdogs.textContent = p.hotdogs;
    d.fame.textContent = p.fame;
    d.score.textContent = p.score();
    const m = Math.floor(this.timeLeft / 60);
    const s = Math.floor(this.timeLeft % 60);
    d.timer.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    // Buff chips.
    let buffs = '';
    if (p.buffs.speed > 0) buffs += `<span class="buff speed">⚡ ${Math.ceil(p.buffs.speed)}s</span>`;
    if (p.buffs.rap > 0) buffs += `<span class="buff rap">🎤 ${Math.ceil(p.buffs.rap)}s</span>`;
    d.buffs.innerHTML = buffs;
    d.action.textContent = this.nearNpc
      ? (this.nearNpc.def.want === 'food' ? '🌭 Sell' : this.nearNpc.def.want === 'battle' ? '🎤 Battle' : '🎤 Rap')
      : '·';
  }

  _endRun() {
    this.state = 'over';
    this.finalScore = this.player.score();
    this.dom.onGameOver(this.finalScore);
  }

  triggerAction() {
    // Used by the on-screen action button.
    this.input._action = true;
  }

  toggleMute() {
    setMuted(!isMuted());
    return isMuted();
  }
}
