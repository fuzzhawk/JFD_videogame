// Entry point: wires the DOM overlays (title / HUD / game-over + leaderboard)
// to the Game engine.

import { Game } from './game.js';
import { Leaderboard } from './leaderboard.js';
import { resumeAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

const dom = {
  money: $('stat-money'),
  hotdogs: $('stat-hotdogs'),
  fame: $('stat-fame'),
  score: $('stat-score'),
  timer: $('stat-timer'),
  buffs: $('buffs'),
  action: $('btn-action-label'),
  onGameOver: showGameOver,
};

const canvas = $('game');
const game = new Game(canvas, dom);
// Exposed for debugging in the browser console.
window.game = game;

// --- Title screen ---
function randomSeed() {
  return (Math.random() * 1e9) | 0;
}

$('btn-play').addEventListener('click', () => {
  resumeAudio();
  const raw = $('seed-input').value.trim();
  let seed = raw ? hashString(raw) : randomSeed();
  $('title-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  game.start(seed);
});

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// --- Action & mute buttons ---
const actionBtn = $('btn-action');
actionBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); game.triggerAction(); });

$('btn-mute').addEventListener('click', () => {
  const muted = game.toggleMute();
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
});

$('btn-quit').addEventListener('click', () => {
  if (game.state === 'playing') game._endRun();
});

// --- Game over / leaderboard ---
async function showGameOver(score) {
  $('hud').classList.add('hidden');
  $('final-score').textContent = score;
  $('go-screen').classList.remove('hidden');
  await renderLeaderboard();
  $('submit-row').classList.remove('hidden');
  $('go-thanks').classList.add('hidden');
}

async function renderLeaderboard(highlightName) {
  const list = await Leaderboard.top(10);
  const el = $('leaderboard-list');
  el.innerHTML = '';
  list.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'lb-row' + (entry.name === highlightName ? ' me' : '');
    li.innerHTML = `<span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${escapeHtml(entry.name)}</span>
      <span class="lb-score">${entry.score}</span>`;
    el.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('btn-submit').addEventListener('click', async () => {
  const name = $('name-input').value.trim() || 'Anon';
  const res = await Leaderboard.submit(name, game.finalScore);
  $('submit-row').classList.add('hidden');
  $('go-thanks').classList.remove('hidden');
  $('go-rank').textContent = res.rank;
  await renderLeaderboard(name);
});

$('btn-again').addEventListener('click', () => {
  $('go-screen').classList.add('hidden');
  $('title-screen').classList.remove('hidden');
});
