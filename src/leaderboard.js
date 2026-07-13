// Leaderboard. Currently a DUMMY implementation backed by sessionStorage so
// scores last for the current browser session only. The async interface mirrors
// what a real backend would expose, so swapping in `fetch()` calls later is a
// drop-in change (see BACKEND NOTES at the bottom).

const KEY = 'jfd_leaderboard_session_v1';

const SEED_SCORES = [
  { name: 'MC Dawson', score: 4200 },
  { name: 'Lil Ketchup', score: 3100 },
  { name: 'DJ Bun', score: 2450 },
  { name: 'Frank N. Furter', score: 1875 },
  { name: 'Vinyl Vince', score: 1200 },
  { name: 'Sizzle', score: 950 },
  { name: 'Glizzy G', score: 700 },
  { name: 'Coldcut Carl', score: 400 },
];

function load() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  const seeded = SEED_SCORES.slice();
  save(seeded);
  return seeded;
}

function save(list) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) { /* ignore */ }
}

// Simulate network latency so UI code is written for async from day one.
function delay(v, ms = 120) {
  return new Promise((res) => setTimeout(() => res(v), ms));
}

export const Leaderboard = {
  // Returns top `limit` entries, sorted desc.
  async top(limit = 10) {
    const list = load().slice().sort((a, b) => b.score - a.score);
    return delay(list.slice(0, limit));
  },

  // Submit a score; returns { rank, entries }.
  async submit(name, score) {
    name = (name || 'Anon').toString().slice(0, 16).trim() || 'Anon';
    score = Math.max(0, Math.round(score));
    const list = load();
    list.push({ name, score, ts: Date.now() });
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, 50);
    save(trimmed);
    const rank = trimmed.findIndex((e) => e.name === name && e.score === score) + 1;
    return delay({ rank, entries: trimmed.slice(0, 10) });
  },

  async reset() {
    try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    return delay(true);
  },
};

// BACKEND NOTES
// -------------
// To connect a real backend, replace the bodies of top()/submit() with fetch:
//
//   async top(limit = 10) {
//     const r = await fetch(`${API}/leaderboard?limit=${limit}`);
//     return r.json();
//   },
//   async submit(name, score) {
//     const r = await fetch(`${API}/leaderboard`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ name, score }),
//     });
//     return r.json();
//   }
//
// Keep the return shapes identical and no UI changes are required.
