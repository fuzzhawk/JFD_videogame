# 🎤 John from Dawson: Rap Game 🌭

A mobile-friendly, top-down exploration game about **John from Dawson**, a
small-town rapper trying to make it in the big world. Roam a procedurally
generated world, collect **money** and **hot dogs**, **sell hot dogs** to hungry
folks, **rap for the crowd** to stack fame, and climb the **leaderboard** before
the day runs out.

Built with **vanilla JavaScript + HTML5 Canvas** — no build step, no framework,
works on desktop and touch devices.

## ▶ Run it

ES modules must be served over HTTP (they won't load from `file://`), so:

```bash
npm start          # then open http://localhost:8080/
# or:  node serve.mjs
# or any static server, e.g.  python3 -m http.server 8080
```

- **Game:** `http://localhost:8080/`
- **Sprite & Animation Editor:** `http://localhost:8080/editor.html`

## 🎮 How to play

| | Desktop | Touch |
|---|---|---|
| **Move** | WASD / arrow keys | drag the **left** side of the screen (virtual joystick) |
| **Action** | Space / E / Enter | the pink **●** button, or tap the **right** side |

- **Pickups** are everywhere — coins, cash, hot dogs & ingredients (all add hot
  dogs), plus **buffs** (soda/coffee = speed, mic/boombox = better rap payouts)
  and **style** items (chains, diamonds, records… = instant fame).
- Walk up to a **Hungry Customer** and hit Action to **sell a hot dog** for cash.
- Walk up to a **Fan**, **Rival**, or **Producer** to start a **rap minigame** —
  tap in time with the beat. Better timing = more money + fame.
- Each run is a timed "day". When time's up your **score** (money earned + fame)
  is submitted to the leaderboard.

## 🎨 Sprites & animation

All art is **placeholder art generated in code** so the game is fully playable
today. Real PNG art can be dropped in later without touching game code.

- **Character bodies** are procedurally drawn SNES-JRPG-style walk cycles
  (4 directions × 4 frames). See `src/spritegen.js`.
- **Heads** are composited onto the body separately, so they can be swapped
  independently (placeholder capped faces for now).
- **Pickup icons** are drawn procedurally too, and any of them can be replaced.

### The editor (`editor.html`)

- **Body Animation Generator** — pick skin/shirt/pants/shoes colors and a head,
  preview the walk cycle live in all four directions, and **export the body
  spritesheet as a PNG**.
- **Sprite Slots** — upload a PNG to replace any head or pickup icon. Uploads are
  saved to `localStorage` and are used by the game immediately (same browser).
  Each slot has **Reset** to restore its placeholder.

Sprite slot names the game looks for: `head_john`, `head_customer`, `head_fan`,
`head_rival`, `head_producer`, and `item_*` for every pickup (see `src/items.js`).

## 🏆 Leaderboard

Currently a **dummy** leaderboard scoped to the current browser session
(`sessionStorage`), seeded with some fictional rappers. The interface in
`src/leaderboard.js` is already **async** and shaped like a real API, so wiring
it to a backend is a drop-in change — replace the bodies of `top()` and
`submit()` with `fetch()` calls (there's a worked example at the bottom of that
file). No UI changes required.

## 🔊 Audio

Simple sound effects (coins, sells, rap hits/misses, buffs) are synthesized at
runtime with the Web Audio API (`src/audio.js`) — no audio files needed. Tap 🔊
in-game to mute.

## 📁 Project structure

```
index.html          Game page + HUD/overlays
editor.html         Sprite & animation editor
styles.css          Shared styles     editor.css  Editor-only styles
serve.mjs           Zero-dependency dev server
src/
  main.js           Game bootstrap: title/HUD/game-over wiring
  game.js           Engine: world render, spawning, collision, interactions
  world.js          Procedural terrain + towns (roads/buildings)
  rng.js            Seeded hashing + value/fractal noise
  spritegen.js      Procedural SNES-style body walk-cycle generator
  character.js      Body + head compositing and walk animation
  sprites.js        Sprite registry (placeholders + uploaded PNG overrides)
  items.js          Pickup definitions + placeholder icons
  entities.js       Player, NPC, Pickup
  input.js          Keyboard + touch joystick/action
  rap.js            Rap rhythm minigame
  audio.js          Web Audio SFX
  leaderboard.js    Dummy session leaderboard (backend-ready interface)
  editor.js         Editor logic
```

## 🛠️ Roadmap / plug-in points

- Swap the dummy leaderboard for a real backend (`src/leaderboard.js`).
- Drop in real head & item PNGs via the editor (or auto-load from `assets/`).
- Add more NPC types, quests, and a shop to spend money.
