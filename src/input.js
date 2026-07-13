// Unified input for the side-scroller: WASD/arrows to move, plus Attack and Jump
// (keyboard + on-screen buttons). Touch uses a floating virtual joystick on the
// left; Attack/Jump are DOM buttons wired in main.js via triggerAttack/Jump.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.dir = { x: 0, y: 0 };
    this._attack = false;
    this._jump = false;

    this.joyActive = false;
    this.joyId = null;
    this.joyOrigin = { x: 0, y: 0 };
    this.joyPos = { x: 0, y: 0 };
    this.joyVec = { x: 0, y: 0 };

    this._bindKeyboard();
    this._bindTouch();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (e.repeat) { this.keys.add(k); return; }
      // Attack: J / F / Enter.  Jump: Space / K.
      if (k === 'j' || k === 'f' || k === 'enter') this._attack = true;
      if (k === ' ' || k === 'k') this._jump = true;
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  _bindTouch() {
    const c = this.canvas;
    const rectOf = () => c.getBoundingClientRect();

    const onDown = (e) => {
      const rect = rectOf();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Left ~60% starts the movement joystick; the right side is for buttons.
      if (x < rect.width * 0.6 && !this.joyActive) {
        this.joyActive = true;
        this.joyId = e.pointerId;
        this.joyOrigin = { x, y };
        this.joyPos = { x, y };
        this.joyVec = { x: 0, y: 0 };
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
      }
    };
    const onMove = (e) => {
      if (!this.joyActive || e.pointerId !== this.joyId) return;
      const rect = rectOf();
      let dx = e.clientX - rect.left - this.joyOrigin.x;
      let dy = e.clientY - rect.top - this.joyOrigin.y;
      const max = 55;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      this.joyPos = { x: this.joyOrigin.x + dx, y: this.joyOrigin.y + dy };
      this.joyVec = { x: dx / max, y: dy / max };
    };
    const onUp = (e) => {
      if (e.pointerId === this.joyId) {
        this.joyActive = false; this.joyId = null; this.joyVec = { x: 0, y: 0 };
      }
    };
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update() {
    let x = 0, y = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) x -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) x += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) y -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); x /= l; y /= l; }
    if (this.joyActive) {
      const jl = Math.hypot(this.joyVec.x, this.joyVec.y);
      if (jl > 0.18) { x = this.joyVec.x; y = this.joyVec.y; }
    }
    this.dir.x = x;
    this.dir.y = y;
  }

  triggerAttack() { this._attack = true; }
  triggerJump() { this._jump = true; }

  consumeAttack() { if (this._attack) { this._attack = false; return true; } return false; }
  consumeJump() { if (this._jump) { this._jump = false; return true; } return false; }
}
