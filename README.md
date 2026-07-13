# 🎤 John from Dawson: Rap Game 🌭

A mobile-friendly, **side-scrolling beat-em-up** (Streets of Rage / River City
Ransom style) about **John from Dawson**, a small-town rapper making it in the
big world. Brawl your way left-to-right: **punch** and **jump** past thugs,
collect **money** and **hot dogs**, **sell hot dogs** to hungry folks, and **rap
for the crowd** to stack fame — then climb the **leaderboard** before the day
runs out.

The world is built from alternating **segments**: **towns** *pinch* the walkable
band into a tight brawl corridor with a city backdrop; push through and the world
**opens up** into wide green stretches with blob-shaped forests, more pickups, and
roaming enemies.

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
| **Move** | WASD / arrows (up-down changes lane) | drag the **left** side of the screen (virtual joystick) |
| **Attack** | J / F / Enter | the pink **HIT** button |
| **Jump** | Space / K | the blue **JUMP** button |

- **Punch** thugs and brutes — brutes are bigger, tougher, and hit harder. Watch
  for the red **!** telegraph before they swing. Knock them out for cash + fame.
- **Pickups** are everywhere — coins, cash, hot dogs & ingredients (all add hot
  dogs), plus **buffs** (soda/coffee = speed, mic/boombox = better rap payouts)
  and **style** items (chains, diamonds, records… = instant fame).
- Walk up to a **Hungry Customer** (no enemies nearby) and press Attack to **sell
  a hot dog** for cash.
- Walk up to a **Fan** or **Producer** to start a **rap minigame** — a random word
  is shown to spit on each beat; tap in the yellow zone in time. Better timing =
  more money + fame. Paste your own lyrics in the editor.
- Keep your **health** up — get knocked out and the run ends early.
- Each run is a timed "day". When time's up (or you're KO'd) your **score** (money
  earned + fame + knockouts) is submitted to the leaderboard.

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
- **Rap Words & Lyrics** — paste your own words/lyrics (one per line or
  comma-separated); they become the random words shown during the rap minigame.
  Saved to `localStorage`; **Reset** restores the default bank.

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
  game.js           Engine: side-scroll render, spawning, combat, interactions
  world.js          Segmented world: pinched towns + open forest stretches
  rng.js            Seeded hashing + value/fractal noise
  spritegen.js      Procedural SNES-style body walk-cycle generator
  character.js      Body + head compositing and walk animation (side/4-dir)
  sprites.js        Sprite registry (placeholders + uploaded PNG overrides)
  items.js          Pickup definitions + placeholder icons
  entities.js       Player (jump/combat), Enemy AI, friendly NPC, Pickup
  input.js          Keyboard + touch joystick + attack/jump buttons
  rap.js            Rap rhythm minigame (random words)
  words.js          Rap word bank (default + editor-pasted, backend-free)
  audio.js          Web Audio SFX
  leaderboard.js    Dummy session leaderboard (backend-ready interface)
  editor.js         Editor logic
```

## 🛠️ Roadmap / plug-in points

- Swap the dummy leaderboard for a real backend (`src/leaderboard.js`).
- Drop in real head & item PNGs via the editor (or auto-load from `assets/`).
- Add more NPC types, quests, and a shop to spend money.
