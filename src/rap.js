// Rap rhythm minigame. A cursor sweeps across a beat bar; tap when it's inside
// the hot zone. Several rounds, getting faster/tighter. Fully touch-friendly
// (any tap or the action button triggers a hit attempt). Reports quality back
// so the game can compute the payout.

import { sfx } from './audio.js';

export class RapGame {
  constructor(opts, onComplete) {
    this.rounds = opts.rounds || 4;
    this.title = opts.title || 'Drop a verse!';
    this.rapBoost = opts.rapBoost || false;
    this.onComplete = onComplete;

    this.round = 0;
    this.cursor = 0;
    this.dir = 1;
    this.speed = 0.9; // fraction per second
    this.roundTime = 0;
    this.maxRoundTime = 2.4;
    this.results = [];
    this.flash = 0;
    this.flashGood = false;
    this.done = false;
    this.introTime = 0.8; // brief "get ready" so it doesn't start instantly
  }

  _hitWidth() {
    // Shrinks as rounds progress. Mic/boombox buff widens it (easier).
    const base = 0.20 - this.round * 0.02;
    return Math.max(0.09, base) * (this.rapBoost ? 1.4 : 1);
  }

  tap() {
    if (this.done || this.introTime > 0) return;
    const dist = Math.abs(this.cursor - 0.5);
    const hw = this._hitWidth();
    if (dist <= hw) {
      const quality = 1 - dist / hw;
      const perfect = dist < 0.05;
      this.results.push(quality);
      if (perfect) sfx.perfect();
      else sfx.rapHit(this.round);
      this.flash = 0.25; this.flashGood = true;
    } else {
      this.results.push(0);
      sfx.rapMiss();
      this.flash = 0.25; this.flashGood = false;
    }
    this._advance();
  }

  _advance() {
    this.round++;
    this.roundTime = 0;
    this.speed += 0.18;
    this.cursor = Math.random() < 0.5 ? 0 : 1;
    this.dir = this.cursor === 0 ? 1 : -1;
    if (this.round >= this.rounds) this._finish();
  }

  _finish() {
    this.done = true;
    const total = this.results.length || 1;
    const sum = this.results.reduce((a, b) => a + b, 0);
    const hits = this.results.filter((r) => r > 0).length;
    const quality = sum / total; // 0..1 average
    if (this.onComplete) {
      this.onComplete({ hits, total, quality, perfect: hits === total && quality > 0.85 });
    }
  }

  update(dt) {
    if (this.done) return;
    if (this.introTime > 0) { this.introTime -= dt; return; }
    if (this.flash > 0) this.flash -= dt;
    this.cursor += this.dir * this.speed * dt;
    if (this.cursor > 1) { this.cursor = 1; this.dir = -1; }
    if (this.cursor < 0) { this.cursor = 0; this.dir = 1; }
    this.roundTime += dt;
    if (this.roundTime > this.maxRoundTime) {
      // Timed out this round = miss.
      this.results.push(0);
      sfx.rapMiss();
      this.flash = 0.25; this.flashGood = false;
      this._advance();
    }
  }

  draw(ctx, w, h) {
    // Dim backdrop.
    ctx.fillStyle = 'rgba(10,8,20,0.72)';
    ctx.fillRect(0, 0, w, h);

    const barW = Math.min(w * 0.82, 520);
    const barH = 34;
    const bx = (w - barW) / 2;
    const by = h * 0.5 - barH / 2;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(this.title, w / 2, by - 70);

    if (this.introTime > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText('Get ready…', w / 2, by - 20);
    } else {
      ctx.fillStyle = '#eee';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('TAP in the yellow zone to the beat!', w / 2, by - 24);
    }

    // Track.
    ctx.fillStyle = '#222b3a';
    ctx.fillRect(bx, by, barW, barH);
    // Hot zone.
    const hw = this._hitWidth();
    ctx.fillStyle = 'rgba(255,213,79,0.35)';
    ctx.fillRect(bx + (0.5 - hw) * barW, by, hw * 2 * barW, barH);
    // Perfect center.
    ctx.fillStyle = 'rgba(76,175,80,0.6)';
    ctx.fillRect(bx + (0.5 - 0.05) * barW, by, 0.1 * barW, barH);
    // Cursor.
    ctx.fillStyle = this.flash > 0 ? (this.flashGood ? '#4caf50' : '#e53935') : '#fff';
    const cxp = bx + this.cursor * barW;
    ctx.fillRect(cxp - 3, by - 6, 6, barH + 12);

    // Round dots.
    const dotY = by + barH + 34;
    const totalDots = this.rounds;
    const startX = w / 2 - (totalDots * 18) / 2 + 9;
    for (let i = 0; i < totalDots; i++) {
      let color = '#556';
      if (i < this.results.length) color = this.results[i] > 0 ? '#4caf50' : '#e53935';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(startX + i * 18, dotY, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }
}
