// Side-scrolling beat-em-up entities.
//
// Coordinate model:
//   worldX  - horizontal world position in px (camera scrolls along this)
//   fieldY  - position within the walkable band, as a fraction 0..1 of the
//             viewport height (the beat-em-up "depth" plane)
//   jumpZ   - visual hop height in px (>=0), does not affect fieldY/collision
//
// The game clamps fieldY to the band [top,bottom] returned by the world.

import { Character } from './character.js';

export const OUTFITS = [
  { skin: '#e0a878', shirt: '#d94141', pants: '#33447a', shoes: '#2a1a10', outline: '#20141a' },
  { skin: '#c98d5b', shirt: '#3f8f4f', pants: '#4a3a2a', shoes: '#222', outline: '#20141a' },
  { skin: '#f0c090', shirt: '#8e44ad', pants: '#2c3e50', shoes: '#111', outline: '#20141a' },
  { skin: '#a5764a', shirt: '#2980b9', pants: '#34495e', shoes: '#3a2a1a', outline: '#20141a' },
  { skin: '#e8b890', shirt: '#f39c12', pants: '#7f4a10', shoes: '#222', outline: '#20141a' },
  { skin: '#c98d5b', shirt: '#16a085', pants: '#2c2c2c', shoes: '#111', outline: '#20141a' },
];

const ENEMY_OUTFITS = {
  thug: { skin: '#b07a4a', shirt: '#5a2a2a', pants: '#222', shoes: '#111', outline: '#160d0d' },
  brute: { skin: '#9a6a3a', shirt: '#3a2a4a', pants: '#1a1a22', shoes: '#000', outline: '#120a12' },
};

export const GRAVITY = 900;
export const JUMP_V = 360;

export class Player {
  constructor(worldX, fieldY) {
    this.worldX = worldX;
    this.fieldY = fieldY;
    this.jumpZ = 0;
    this.jumpVz = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 'right';
    this.baseSpeed = 165;
    this.depthSpeed = 110;
    this.radius = 10;

    this.maxHealth = 100;
    this.health = 100;
    this.hitstun = 0;
    this.invuln = 0;
    this.flash = 0;

    this.attackTimer = 0;   // >0 while a swing is animating
    this.attackCooldown = 0;
    this.attackHit = new Set();

    this.money = 0;
    this.hotdogs = 3;
    this.fame = 0;
    this.earned = 0;
    this.defeated = 0;
    this.buffs = { speed: 0, rap: 0 };

    this.character = new Character(OUTFITS[0], 'head_john', 'side');
  }

  speed() { return this.baseSpeed * (this.buffs.speed > 0 ? 1.4 : 1); }
  onGround() { return this.jumpZ <= 0.01; }
  attacking() { return this.attackTimer > 0; }
  // The brief active window of a punch (front-loaded in the swing).
  attackActive() { return this.attackTimer > 0.06 && this.attackTimer < 0.20; }
  score() { return Math.round(this.earned + this.fame + this.money + this.defeated * 15); }

  update(dt) {
    for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    this.hitstun = Math.max(0, this.hitstun - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);

    // Jump physics.
    if (this.jumpZ > 0 || this.jumpVz > 0) {
      this.jumpZ += this.jumpVz * dt;
      this.jumpVz -= GRAVITY * dt;
      if (this.jumpZ <= 0) { this.jumpZ = 0; this.jumpVz = 0; }
    }
    this.character.update(dt, this.vx, this.vy);
    if (this.vx < -0.01) this.facing = 'left';
    else if (this.vx > 0.01) this.facing = 'right';
  }

  jump() {
    if (this.onGround() && this.hitstun <= 0) { this.jumpVz = JUMP_V; this.jumpZ = 0.01; }
  }

  startAttack() {
    if (this.attackCooldown <= 0 && this.hitstun <= 0) {
      this.attackTimer = 0.26;
      this.attackCooldown = 0.34;
      this.attackHit.clear();
      return true;
    }
    return false;
  }

  takeHit(dmg, dir) {
    if (this.invuln > 0) return;
    this.health = Math.max(0, this.health - dmg);
    this.hitstun = 0.28;
    this.invuln = 0.6;
    this.flash = 0.3;
    this.kbVx = dir * 150;
  }
}

export const NPC_TYPES = {
  customer: { want: 'food', head: 'head_customer', label: 'Hungry Customer', pay: [8, 16] },
  fan: { want: 'rap', head: 'head_fan', label: 'Fan', pay: [12, 30], rounds: 4 },
  producer: { want: 'rap', head: 'head_producer', label: 'Producer', pay: [60, 120], rounds: 5 },
};

export class NPC {
  constructor(worldX, fieldY, type) {
    this.worldX = worldX;
    this.fieldY = fieldY;
    this.homeX = worldX;
    this.homeY = fieldY;
    this.jumpZ = 0;
    this.type = type;
    this.def = NPC_TYPES[type];
    this.radius = 10;
    this.friendly = true;
    this.character = new Character(OUTFITS[1 + Math.floor(Math.random() * (OUTFITS.length - 1))], this.def.head, 'side');
    this.vx = 0; this.vy = 0;
    this.cooldown = 0;
    this.wanderTimer = 0;
    this.target = null;
  }
  satisfied() { return this.cooldown > 0; }

  update(dt, band) {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0 || !this.target) {
      this.wanderTimer = 2 + Math.random() * 3;
      this.target = { x: this.homeX + (Math.random() - 0.5) * 90, y: this.homeY + (Math.random() - 0.5) * 0.16 };
    }
    let dx = this.target.x - this.worldX;
    let dy = (this.target.y - this.fieldY) * 400; // scale fraction to px-ish
    const d = Math.hypot(dx, dy);
    if (d > 3) {
      dx /= d; dy /= d;
      this.worldX += dx * 26 * dt;
      this.fieldY += (dy * 26 * dt) / 400;
      this.vx = dx * 0.4; this.vy = dy * 0.4;
    } else { this.vx = 0; this.vy = 0; }
    if (band) this.fieldY = Math.max(band.topF, Math.min(band.botF, this.fieldY));
    this.character.update(dt, this.vx, this.vy);
  }
}

export const ENEMY_TYPES = {
  thug: { head: 'head_rival', maxHealth: 30, speed: 70, damage: 8, scale: 1, range: 26, label: 'Thug' },
  brute: { head: 'head_rival', maxHealth: 60, speed: 46, damage: 14, scale: 1.34, range: 30, label: 'Brute' },
};

export class Enemy {
  constructor(worldX, fieldY, type) {
    this.worldX = worldX;
    this.fieldY = fieldY;
    this.jumpZ = 0;
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.maxHealth = this.def.maxHealth;
    this.health = this.maxHealth;
    this.radius = 11 * this.def.scale;
    this.facing = 'left';
    this.vx = 0; this.vy = 0;
    this.hitstun = 0;
    this.flash = 0;
    this.kbVx = 0;
    this.windup = 0;    // >0 telegraph before a hit
    this.attackTimer = 0; // >0 while strike is live
    this.attackCooldown = 0;
    this.hitLanded = false;
    this.dead = false;
    this.deathTimer = 0;
    this.character = new Character(ENEMY_OUTFITS[type], this.def.head, 'side');
  }

  attackActive() { return this.attackTimer > 0; }

  takeHit(dmg, dir) {
    this.health -= dmg;
    this.hitstun = 0.3;
    this.flash = 0.25;
    this.kbVx = dir * 220;
    this.windup = 0; this.attackTimer = 0;
    if (this.health <= 0 && !this.dead) { this.dead = true; this.deathTimer = 0.5; }
  }

  update(dt, player, band) {
    if (this.dead) { this.deathTimer -= dt; this.character.update(dt, 0, 0); return; }
    this.flash = Math.max(0, this.flash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    // Knockback slide with friction.
    if (Math.abs(this.kbVx) > 1) {
      this.worldX += this.kbVx * dt;
      this.kbVx *= 0.86;
    }

    if (this.hitstun > 0) {
      this.hitstun -= dt;
      this.vx = 0; this.vy = 0;
      this.character.update(dt, 0, 0);
      return;
    }

    const dx = player.worldX - this.worldX;
    const dy = (player.fieldY - this.fieldY);
    const dist = Math.abs(dx);
    this.facing = dx < 0 ? 'left' : 'right';

    if (this.windup > 0) {
      this.windup -= dt;
      this.vx = 0; this.vy = 0;
      if (this.windup <= 0) { this.attackTimer = 0.18; this.hitLanded = false; }
    } else if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      this.vx = 0; this.vy = 0;
    } else if (dist < this.def.range && Math.abs(dy) < 0.06 && this.attackCooldown <= 0) {
      this.windup = 0.32; // telegraph
      this.attackCooldown = 1.1;
    } else {
      // Chase.
      const sp = this.def.speed;
      const nx = Math.sign(dx) * sp * dt;
      const ny = Math.sign(dy) * (sp * 0.7) * dt;
      this.worldX += nx;
      this.fieldY += ny / (band ? 500 : 500);
      this.vx = Math.sign(dx); this.vy = Math.sign(dy) * 0.3;
    }
    if (band) this.fieldY = Math.max(band.topF, Math.min(band.botF, this.fieldY));
    this.character.update(dt, this.vx, this.vy);
  }
}

export class Pickup {
  constructor(worldX, fieldY, key) {
    this.worldX = worldX;
    this.fieldY = fieldY;
    this.key = key;
    this.t = Math.random() * Math.PI * 2;
    this.taken = false;
  }
  update(dt) { this.t += dt * 3; }
}
