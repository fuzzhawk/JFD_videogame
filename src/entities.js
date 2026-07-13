// Game entities: Player, NPC, Pickup. Rendering is delegated to Character;
// these classes hold state + light AI.

import { Character } from './character.js';
import { TILE, T } from './world.js';

export const OUTFITS = [
  { skin: '#e0a878', shirt: '#d94141', pants: '#33447a', shoes: '#2a1a10', outline: '#20141a' },
  { skin: '#c98d5b', shirt: '#3f8f4f', pants: '#4a3a2a', shoes: '#222', outline: '#20141a' },
  { skin: '#f0c090', shirt: '#8e44ad', pants: '#2c3e50', shoes: '#111', outline: '#20141a' },
  { skin: '#a5764a', shirt: '#2980b9', pants: '#34495e', shoes: '#3a2a1a', outline: '#20141a' },
  { skin: '#e8b890', shirt: '#f39c12', pants: '#7f4a10', shoes: '#222', outline: '#20141a' },
  { skin: '#c98d5b', shirt: '#16a085', pants: '#2c2c2c', shoes: '#111', outline: '#20141a' },
];

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.baseSpeed = 130;
    this.radius = 7;
    this.character = new Character(OUTFITS[0], 'head_john');
    // Stats.
    this.money = 0;
    this.hotdogs = 3;
    this.fame = 0;
    this.earned = 0; // lifetime money earned (for score)
    // Buffs: name -> seconds remaining.
    this.buffs = { speed: 0, rap: 0 };
  }

  speed() {
    return this.baseSpeed * (this.buffs.speed > 0 ? 1.45 : 1);
  }

  score() {
    return Math.round(this.earned + this.fame + this.money);
  }

  update(dt) {
    for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    this.character.update(dt, this.vx, this.vy);
  }
}

// NPC "wants" and payout profiles.
export const NPC_TYPES = {
  customer: { want: 'food', head: 'head_customer', label: 'Hungry Customer', pay: [8, 16] },
  fan: { want: 'rap', head: 'head_fan', label: 'Fan', pay: [12, 30], rounds: 4 },
  rival: { want: 'battle', head: 'head_rival', label: 'Rival Rapper', pay: [40, 80], rounds: 6 },
  producer: { want: 'rap', head: 'head_producer', label: 'Producer', pay: [60, 120], rounds: 5 },
};

export class NPC {
  constructor(x, y, type, world) {
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.type = type;
    this.world = world;
    this.def = NPC_TYPES[type];
    this.radius = 7;
    const outfit = OUTFITS[Math.floor(Math.random() * OUTFITS.length)];
    this.character = new Character(outfit, this.def.head);
    this.vx = 0;
    this.vy = 0;
    this.cooldown = 0; // seconds until they can be served again
    this.wanderTimer = 0;
    this.target = null;
    this.speed = 42;
  }

  satisfied() {
    return this.cooldown > 0;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0 || !this.target) {
      this.wanderTimer = 1.5 + Math.random() * 2.5;
      // Wander within a small radius of spawn, staying on pavement.
      const ang = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 40;
      this.target = {
        x: this.spawnX + Math.cos(ang) * dist,
        y: this.spawnY + Math.sin(ang) * dist,
      };
    }
    let dx = this.target.x - this.x;
    let dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      dx /= d; dy /= d;
      const nx = this.x + dx * this.speed * dt;
      const ny = this.y + dy * this.speed * dt;
      const ttx = Math.floor(nx / TILE);
      const tty = Math.floor(ny / TILE);
      if (this.world.isWalkable(ttx, tty)) {
        this.x = nx; this.y = ny;
        this.vx = dx; this.vy = dy;
      } else {
        this.target = null;
        this.vx = 0; this.vy = 0;
      }
    } else {
      this.vx = 0; this.vy = 0;
    }
    this.character.update(dt, this.vx, this.vy);
  }
}

export class Pickup {
  constructor(x, y, key) {
    this.x = x;
    this.y = y;
    this.key = key;
    this.t = Math.random() * Math.PI * 2;
    this.taken = false;
    this.radius = 8;
  }
  update(dt) {
    this.t += dt * 3;
  }
}
