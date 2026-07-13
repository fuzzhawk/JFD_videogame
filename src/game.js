// Side-scrolling beat-em-up engine (Streets-of-Rage / River City style).
// World scrolls left->right; the player fights along a walkable band that pinches
// through towns and widens into open forest stretches. Handles movement, jump,
// melee combat, spawning per world segment, pickups, selling/rapping NPCs, the
// rap minigame hand-off, HUD, run timer, and defeat.

import { World, SEG, BAND_BOTTOM } from './world.js';
import { Player, Enemy, NPC, Pickup } from './entities.js';
import { ITEMS, pickWeighted } from './items.js';
import { getSprite, initSprites } from './sprites.js';
import { Input } from './input.js';
import { sfx, resumeAudio, setMuted, isMuted } from './audio.js';
import { RapGame } from './rap.js';
import { makeRng } from './rng.js';

const DAY_LENGTH = 180;

export class Game {
  constructor(canvas, dom) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dom = dom;
    initSprites();

    this.state = 'title';
    this.input = new Input(canvas);
    this.rng = makeRng((Math.random() * 1e9) | 0);

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.floaters = [];
    this.effects = [];
    this.shake = 0;
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.vw = w; this.vh = h;
    this.zoom = Math.max(2, Math.min(4, Math.round(h / 240)));
  }

  start(seed) {
    resumeAudio();
    this.world = new World(seed >>> 0);
    this.player = new Player(120, (this.world.bandAt(120).topF + BAND_BOTTOM) / 2);
    this.enemies = [];
    this.npcs = [];
    this.pickups = [];
    this.floaters = [];
    this.effects = [];
    this.spawned = new Set();
    this.camX = 0;
    this.timeLeft = DAY_LENGTH;
    this.rapGame = null;
    this.nearNpc = null;
    this.shake = 0;
    this.state = 'playing';
    this._spawnAhead();
  }

  band(worldX) { return this.world.bandAt(worldX); }

  // ---- Spawning ----------------------------------------------------------
  _spawnAhead() {
    const rightEdge = this.camX + this.vw + 400;
    this.world.ensureUpTo(rightEdge);
    for (const seg of this.world.segments) {
      if (seg.x0 > rightEdge) break;
      if (this.spawned.has(seg.index)) continue;
      this.spawned.add(seg.index);
      const plan = this.world.spawnPlan(seg);
      for (const e of plan.enemies) this.enemies.push(new Enemy(e.x, e.y, e.type));
      for (const n of plan.npcs) this.npcs.push(new NPC(n.x, n.y, n.type));
      for (const p of plan.pickups) this.pickups.push(new Pickup(p.x, p.y, pickWeighted(this.rng)));
    }
  }

  _despawnBehind() {
    const left = this.camX - 240;
    this.enemies = this.enemies.filter((e) => (e.worldX > left || !e.dead) && e.worldX > left - 200);
    this.pickups = this.pickups.filter((p) => p.worldX > left);
    this.npcs = this.npcs.filter((n) => n.worldX > left);
  }

  // ---- Loop --------------------------------------------------------------
  _loop(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.input.update();
    if (this.state === 'playing') this._updatePlaying(dt);
    else if (this.state === 'rap') this._updateRap(dt);
    this._render();
    requestAnimationFrame(this._loop);
  }

  _updatePlaying(dt) {
    const p = this.player;

    // Jump.
    if (this.input.consumeJump()) p.jump();

    // Attack / interact.
    if (this.input.consumeAttack()) this._attackOrInteract();

    // Movement.
    const band = this.band(p.worldX);
    if (p.hitstun <= 0) {
      p.vx = this.input.dir.x;
      p.vy = this.input.dir.y;
      p.worldX += p.vx * p.speed() * dt;
      p.fieldY += (p.vy * p.depthSpeed * dt) / this.vh;
    } else {
      p.vx = 0; p.vy = 0;
    }
    // Knockback.
    if (p.kbVx) { p.worldX += p.kbVx * dt; p.kbVx *= 0.85; if (Math.abs(p.kbVx) < 2) p.kbVx = 0; }
    p.worldX = Math.max(this.world.minX + 20, p.worldX);
    p.fieldY = Math.max(band.topF, Math.min(band.botF, p.fieldY));
    p.update(dt);

    // Timer.
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this._endRun('time'); return; }

    // Camera.
    const targetCam = Math.max(this.world.minX, p.worldX - this.vw * 0.35);
    this.camX += (targetCam - this.camX) * Math.min(1, dt * 8);
    this._spawnAhead();

    // Update entities.
    for (const pk of this.pickups) pk.update(dt);
    for (const n of this.npcs) n.update(dt, this.band(n.worldX));
    for (const e of this.enemies) e.update(dt, p, this.band(e.worldX));

    // Player attack hitbox.
    if (p.attackActive()) this._resolvePlayerAttack();

    // Enemy strikes.
    for (const e of this.enemies) {
      if (e.dead || !e.attackActive() || e.hitLanded) continue;
      const dx = Math.abs(e.worldX - p.worldX);
      const dy = Math.abs(e.fieldY - p.fieldY);
      if (dx < e.def.range + 6 && dy < 0.06 && p.invuln <= 0) {
        e.hitLanded = true;
        p.takeHit(e.def.damage, Math.sign(p.worldX - e.worldX) || 1);
        this._addFloater(p.worldX, p.fieldY, '-' + e.def.damage, '#ff5252');
        this.shake = 6;
        sfx.bad();
      }
    }

    // Remove dead enemies after their fall.
    for (const e of this.enemies) if (e.dead && e.deathTimer <= 0 && !e._cashed) this._enemyDefeated(e);
    this.enemies = this.enemies.filter((e) => !(e.dead && e.deathTimer <= 0));

    // Pickups.
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (Math.abs(pk.worldX - p.worldX) < 26 && Math.abs(pk.fieldY - p.fieldY) < 0.06) this._collect(pk);
    }
    this.pickups = this.pickups.filter((pk) => !pk.taken);

    // Nearest friendly NPC (for the prompt).
    this.nearNpc = this._nearestFriendly();

    if (p.health <= 0) { this._endRun('ko'); return; }

    this._despawnBehind();
    this._updateFxAndFloaters(dt);
    this._syncHud();
  }

  _updateRap(dt) {
    this.rapGame.update(dt);
    if (this.input.consumeAttack() || this.input.consumeJump()) this.rapGame.tap();
    this._updateFxAndFloaters(dt);
  }

  _nearestFriendly() {
    const p = this.player;
    let best = null, bd = 34;
    for (const n of this.npcs) {
      if (n.satisfied()) continue;
      const dx = Math.abs(n.worldX - p.worldX);
      if (dx < bd && Math.abs(n.fieldY - p.fieldY) < 0.07) { bd = dx; best = n; }
    }
    return best;
  }

  _enemyNearAttack() {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.worldX - p.worldX) < 60 && Math.abs(e.fieldY - p.fieldY) < 0.08) return true;
    }
    return false;
  }

  _attackOrInteract() {
    const p = this.player;
    const friendly = this._nearestFriendly();
    if (friendly && p.onGround() && !this._enemyNearAttack()) { this._interact(friendly); return; }
    p.startAttack();
    sfx.rapHit(0);
  }

  _resolvePlayerAttack() {
    const p = this.player;
    const dir = p.facing === 'left' ? -1 : 1;
    const x0 = dir > 0 ? p.worldX + 4 : p.worldX - 40;
    const x1 = dir > 0 ? p.worldX + 40 : p.worldX - 4;
    for (const e of this.enemies) {
      if (e.dead || p.attackHit.has(e)) continue;
      if (e.worldX >= x0 && e.worldX <= x1 && Math.abs(e.fieldY - p.fieldY) < 0.07) {
        p.attackHit.add(e);
        e.takeHit(14, dir);
        this._addEffect(e.worldX, e.fieldY - 0.02, 'POW!');
        this.shake = 4;
        sfx.rapHit(2);
      }
    }
  }

  _enemyDefeated(e) {
    e._cashed = true;
    const p = this.player;
    p.defeated += 1;
    p.fame += 8;
    // Drop cash.
    const key = Math.random() > 0.5 ? 'bill' : (Math.random() > 0.5 ? 'coin' : 'stack');
    this.pickups.push(new Pickup(e.worldX, Math.min(BAND_BOTTOM, e.fieldY), key));
    this._addFloater(e.worldX, e.fieldY - 0.04, 'KO! +8 fame', '#ffca28');
    sfx.perfect();
  }

  _collect(pk) {
    pk.taken = true;
    const def = ITEMS[pk.key];
    const p = this.player;
    let text = '', color = '#7cf';
    if (def.money) { p.money += def.money; p.earned += def.money; text = '+$' + def.money; color = '#ffd54f'; sfx.coin(); }
    else if (def.hotdogs) { p.hotdogs += def.hotdogs; text = '+' + def.hotdogs + ' 🌭'; color = '#ffab40'; sfx.hotdog(); }
    else if (def.buff) { p.buffs[def.buff] = Math.max(p.buffs[def.buff], def.duration); text = def.label + '!'; color = '#4fc3f7'; sfx.buff(); }
    else if (def.fame) { p.fame += def.fame; text = '+' + def.fame + ' fame'; color = '#f06292'; sfx.buff(); }
    else sfx.pickup();
    this._addFloater(pk.worldX, pk.fieldY, text, color);
  }

  _interact(npc) {
    const p = this.player;
    const def = npc.def;
    if (def.want === 'food') {
      if (p.hotdogs <= 0) { this._addFloater(p.worldX, p.fieldY - 0.05, 'Need a hot dog!', '#ff7043'); sfx.bad(); return; }
      p.hotdogs -= 1;
      const pay = def.pay[0] + Math.floor(this.rng() * (def.pay[1] - def.pay[0] + 1));
      p.money += pay; p.earned += pay; p.fame += 2;
      npc.cooldown = 12;
      this._addFloater(npc.worldX, npc.fieldY - 0.05, 'Sold! +$' + pay, '#4caf50');
      sfx.sell();
    } else {
      this.state = 'rap';
      const rapBoost = p.buffs.rap > 0;
      this.rapGame = new RapGame(
        { rounds: def.rounds || 4, title: 'Drop a verse!', rapBoost },
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
    this._addFloater(npc.worldX, npc.fieldY - 0.05, msg + '+$' + money, '#ba68c8');
    this._addFloater(npc.worldX, npc.fieldY - 0.09, '+' + fame + ' fame', '#f06292');
  }

  // ---- Effects -----------------------------------------------------------
  _addFloater(worldX, fieldY, text, color) {
    if (!text) return;
    this.floaters.push({ worldX, fieldY, text, color, life: 1.1, vy: -0.05 });
  }
  _addEffect(worldX, fieldY, text) { this.effects.push({ worldX, fieldY, text, life: 0.3 }); }
  _updateFxAndFloaters(dt) {
    for (const f of this.floaters) { f.fieldY += f.vy * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 40);
  }

  // ---- Rendering ---------------------------------------------------------
  _sx(worldX, parallax = 1) { return worldX - this.camX * parallax; }

  _render() {
    const ctx = this.ctx;
    ctx.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0);
    if (this.state !== 'title' && this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this._drawSky(ctx);
    if (this.state === 'title' || !this.world) return;

    this._drawScenery(ctx);
    this._drawGround(ctx);

    // Entities depth-sorted by fieldY.
    const list = [];
    for (const pk of this.pickups) list.push({ y: pk.fieldY, kind: 'pickup', ref: pk });
    for (const e of this.enemies) list.push({ y: e.fieldY, kind: 'enemy', ref: e });
    for (const n of this.npcs) list.push({ y: n.fieldY, kind: 'npc', ref: n });
    list.push({ y: this.player.fieldY, kind: 'player', ref: this.player });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.kind === 'pickup') this._drawPickup(ctx, it.ref);
      else if (it.kind === 'enemy') this._drawEnemy(ctx, it.ref);
      else this._drawFighter(ctx, it.ref, it.kind);
    }

    this._drawPrompt(ctx);
    this._drawFloaters(ctx);
    this._drawEffects(ctx);
    if (this.input.joyActive) this._drawJoystick(ctx);
    if (this.state === 'rap' && this.rapGame) this.rapGame.draw(ctx, this.vw, this.vh);
  }

  _drawSky(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.vh);
    g.addColorStop(0, '#2a3a6a');
    g.addColorStop(0.45, '#6a6aa0');
    g.addColorStop(0.7, '#c88a6a');
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, this.vw + 40, this.vh + 40);
  }

  _drawScenery(ctx) {
    const vh = this.vh;
    // Draw scenery for visible segments.
    for (const seg of this.world.segments) {
      if (seg.x1 - this.camX < -100 || seg.x0 - this.camX > this.vw + 100) continue;
      const sc = this.world.scenery(seg);
      // Buildings (drawn 1:1 so they stay anchored to their town segment).
      for (const b of sc.buildings) {
        const x = this._sx(b.x);
        if (x + b.w < -40 || x > this.vw + 40) continue;
        const horizon = this.world.bandTopFrac(b.x) * vh;
        const bh = b.h * vh;
        ctx.fillStyle = this.world.buildingTone(b.tone);
        ctx.fillRect(x, horizon - bh, b.w, bh + 20);
        // Windows.
        ctx.fillStyle = b.lit ? 'rgba(255,225,150,0.5)' : 'rgba(180,210,255,0.25)';
        for (let wy = horizon - bh + 12; wy < horizon - 12; wy += 22) {
          for (let wx = x + 8; wx < x + b.w - 10; wx += 20) ctx.fillRect(wx, wy, 10, 12);
        }
        // Roof line.
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, horizon - bh, b.w, 4);
      }
      // Forest blobs (anchored to their open segment).
      for (const f of sc.forest) {
        const cx = this._sx(f.cx);
        const cy = f.cy * vh;
        if (cx + f.r < -60 || cx - f.r > this.vw + 60) continue;
        ctx.fillStyle = '#2e6b26';
        ctx.beginPath();
        ctx.ellipse(cx, cy, f.r, f.r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const t of f.trees) {
          const tx = cx + t.dx, ty = cy + t.dy;
          ctx.fillStyle = '#5a3b1a';
          ctx.fillRect(tx - 2 * t.s, ty, 4 * t.s, 10 * t.s);
          ctx.fillStyle = '#3d8a30';
          ctx.beginPath();
          ctx.arc(tx, ty, 9 * t.s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  _groundColors(type) {
    return type === SEG.TOWN
      ? { base: '#565b63', bar: '#4a4f57', edge: '#787d86', curb: '#3a3e45' }
      : { base: '#6a9a4a', bar: '#5e8c40', edge: '#84b25e', curb: '#4d7a33' };
  }

  _drawGround(ctx) {
    const vh = this.vh, STEP = 22;
    for (let sx = -STEP; sx < this.vw + STEP; sx += STEP) {
      const worldX = sx + this.camX;
      const seg = this.world.segmentAt(worldX);
      const topF = this.world.bandTopFrac(worldX);
      const top = topF * vh, bottom = BAND_BOTTOM * vh;
      const c = this._groundColors(seg.type);
      ctx.fillStyle = c.base;
      ctx.fillRect(sx, top, STEP + 1, bottom - top);
      // Back edge (walkway) highlight — the long horizontal bar.
      ctx.fillStyle = c.edge;
      ctx.fillRect(sx, top, STEP + 1, 6);
      // A mid horizontal bar.
      ctx.fillStyle = c.bar;
      ctx.fillRect(sx, top + (bottom - top) * 0.5, STEP + 1, 5);
      // Curb near the bottom.
      ctx.fillStyle = c.curb;
      ctx.fillRect(sx, bottom - 6, STEP + 1, 6);
      // Scrolling vertical seams for motion.
      const seam = Math.ceil(worldX / 64) * 64;
      if (seam >= worldX && seam < worldX + STEP) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(seam - this.camX, top + 6, 2, bottom - top - 12);
      }
    }
    // Ground below the band (foreground apron).
    ctx.fillStyle = '#20242a';
    ctx.fillRect(-20, BAND_BOTTOM * vh, this.vw + 40, vh);
  }

  _feet(entity) {
    return { x: this._sx(entity.worldX), y: entity.fieldY * this.vh - (entity.jumpZ || 0) };
  }

  _shadow(ctx, entity, w) {
    const x = this._sx(entity.worldX);
    const y = entity.fieldY * this.vh;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, w, w * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawPickup(ctx, pk) {
    const spr = getSprite(ITEMS[pk.key].sprite);
    const x = this._sx(pk.worldX);
    const y = pk.fieldY * this.vh;
    if (x < -30 || x > this.vw + 30) return;
    const bob = Math.sin(pk.t) * 3;
    const size = 20 * (this.zoom / 2.4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 4, size * 0.4, size * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    if (spr && (spr.complete === undefined || spr.complete)) {
      ctx.imageSmoothingEnabled = false;
      try { ctx.drawImage(spr, x - size / 2, y - size + bob - 4, size, size); } catch (e) {}
    }
  }

  _drawFighter(ctx, e, kind) {
    const x = this._sx(e.worldX);
    if (x < -60 || x > this.vw + 60) return;
    this._shadow(ctx, e, 10 * (this.zoom / 2));
    const feet = this._feet(e);
    if (e.flash > 0) { ctx.save(); ctx.globalAlpha = 0.6; }
    e.character.draw(ctx, feet.x, feet.y, this.zoom);
    if (e.flash > 0) ctx.restore();
    // Player punch effect.
    if (kind === 'player' && e.attackActive()) {
      const dir = e.facing === 'left' ? -1 : 1;
      ctx.fillStyle = '#fff';
      const fx = feet.x + dir * 16 * this.zoom / 2;
      const fy = feet.y - 22 * this.zoom / 2;
      ctx.beginPath(); ctx.arc(fx, fy, 5 * this.zoom / 2, 0, Math.PI * 2); ctx.fill();
    }
    if (this.nearNpc === e) {
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(feet.x, this.player.fieldY * 0 + feet.y + (e.jumpZ || 0) + 2, 12 * this.zoom / 2, 5 * this.zoom / 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  _drawEnemy(ctx, e) {
    const x = this._sx(e.worldX);
    if (x < -60 || x > this.vw + 60) return;
    this._shadow(ctx, e, 11 * e.def.scale * (this.zoom / 2));
    const feet = this._feet(e);
    ctx.save();
    if (e.dead) { ctx.globalAlpha = Math.max(0, e.deathTimer / 0.5); ctx.translate(0, (0.5 - e.deathTimer) * 26); }
    else if (e.flash > 0) ctx.globalAlpha = 0.6;
    // Scale up brutes.
    e.character.draw(ctx, feet.x, feet.y, this.zoom * e.def.scale);
    ctx.restore();
    if (e.dead) return;
    // Health bar.
    if (e.health < e.maxHealth) {
      const bw = 26 * e.def.scale, top = feet.y - 30 * this.zoom / 2 * e.def.scale;
      ctx.fillStyle = '#000a'; ctx.fillRect(feet.x - bw / 2, top, bw, 4);
      ctx.fillStyle = '#e53935'; ctx.fillRect(feet.x - bw / 2, top, bw * Math.max(0, e.health / e.maxHealth), 4);
    }
    // Windup telegraph.
    if (e.windup > 0) {
      ctx.fillStyle = '#ff5252'; ctx.textAlign = 'center';
      ctx.font = 'bold 18px system-ui'; ctx.fillText('!', feet.x, feet.y - 40 * this.zoom / 2 * e.def.scale);
      ctx.textAlign = 'left';
    }
  }

  _drawPrompt(ctx) {
    if (this.state !== 'playing' || !this.nearNpc) return;
    const n = this.nearNpc;
    const x = this._sx(n.worldX);
    const y = n.fieldY * this.vh - 44 * this.zoom / 2;
    const label = n.def.want === 'food' ? '🌭 Sell (attack)' : '🎤 Rap (attack)';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px system-ui, sans-serif';
    const tw = ctx.measureText(label).width + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - tw / 2, y - 18, tw, 21);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x, y - 3);
    ctx.textAlign = 'left';
  }

  _drawFloaters(ctx) {
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      const x = this._sx(f.worldX), y = f.fieldY * this.vh - 30;
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(f.text, x + 1, y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  _drawEffects(ctx) {
    ctx.textAlign = 'center';
    for (const e of this.effects) {
      const x = this._sx(e.worldX), y = e.fieldY * this.vh - 24;
      const s = 1 + (0.3 - e.life) * 3;
      ctx.save();
      ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.15);
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = '#ffca28'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(e.text, 0, 0); ctx.fillText(e.text, 0, 0);
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  _drawJoystick(ctx) {
    const o = this.input.joyOrigin, p = this.input.joyPos;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(o.x, o.y, 55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill();
  }

  // ---- HUD & flow --------------------------------------------------------
  _syncHud() {
    const d = this.dom, p = this.player;
    d.money.textContent = '$' + p.money;
    d.hotdogs.textContent = p.hotdogs;
    d.fame.textContent = p.fame;
    d.score.textContent = p.score();
    const m = Math.floor(this.timeLeft / 60), s = Math.floor(this.timeLeft % 60);
    d.timer.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    if (d.health) d.health.style.width = Math.max(0, (p.health / p.maxHealth) * 100) + '%';
    let buffs = '';
    if (p.buffs.speed > 0) buffs += `<span class="buff speed">⚡ ${Math.ceil(p.buffs.speed)}s</span>`;
    if (p.buffs.rap > 0) buffs += `<span class="buff rap">🎤 ${Math.ceil(p.buffs.rap)}s</span>`;
    d.buffs.innerHTML = buffs;
  }

  _endRun(reason) {
    this.state = 'over';
    this.finalScore = this.player.score();
    this.dom.onGameOver(this.finalScore, reason);
  }

  toggleMute() { setMuted(!isMuted()); return isMuted(); }
}
