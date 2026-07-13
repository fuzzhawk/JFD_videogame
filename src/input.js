// Unified input: WASD/arrow keys on desktop, a floating virtual joystick +
// action button on touch devices. Exposes a normalized direction vector and an
// edge-triggered action.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.dir = { x: 0, y: 0 };
    this._action = false; // edge flag
    this._actionHeld = false;

    // Joystick state (touch).
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
      if (k === ' ' || k === 'e' || k === 'enter') {
        if (!this.keys.has('action')) this._action = true;
        this.keys.add('action');
        this._actionHeld = true;
      }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'e' || k === 'enter') {
        this.keys.delete('action');
        this._actionHeld = false;
      }
      this.keys.delete(k);
    });
  }

  _bindTouch() {
    const c = this.canvas;
    const rectOf = () => c.getBoundingClientRect();

    const onDown = (e) => {
      const rect = rectOf();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Right third of the screen = action button.
      if (x > rect.width * 0.62) {
        this._action = true;
        this._actionHeld = true;
        this._actionPointerId = e.pointerId;
      } else if (!this.joyActive) {
        this.joyActive = true;
        this.joyId = e.pointerId;
        this.joyOrigin = { x, y };
        this.joyPos = { x, y };
        this.joyVec = { x: 0, y: 0 };
      }
      c.setPointerCapture && c.setPointerCapture(e.pointerId);
    };

    const onMove = (e) => {
      if (!this.joyActive || e.pointerId !== this.joyId) return;
      const rect = rectOf();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let dx = x - this.joyOrigin.x;
      let dy = y - this.joyOrigin.y;
      const max = 55;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      this.joyPos = { x: this.joyOrigin.x + dx, y: this.joyOrigin.y + dy };
      this.joyVec = { x: dx / max, y: dy / max };
    };

    const onUp = (e) => {
      if (e.pointerId === this.joyId) {
        this.joyActive = false;
        this.joyId = null;
        this.joyVec = { x: 0, y: 0 };
      }
      if (e.pointerId === this._actionPointerId) {
        this._actionHeld = false;
        this._actionPointerId = null;
      }
    };

    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Compute current movement vector from keys + joystick.
  update() {
    let x = 0, y = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) x -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) x += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) y -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) y += 1;
    if (x || y) {
      const l = Math.hypot(x, y);
      x /= l; y /= l;
    }
    if (this.joyActive) {
      const jl = Math.hypot(this.joyVec.x, this.joyVec.y);
      if (jl > 0.18) { x = this.joyVec.x; y = this.joyVec.y; }
    }
    this.dir.x = x;
    this.dir.y = y;
  }

  // True once per press.
  consumeAction() {
    if (this._action) {
      this._action = false;
      return true;
    }
    return false;
  }
}
