// Rap word bank for the rhythm minigame. A default set ships in code; the editor
// lets you paste your own lyrics/words, which are saved to localStorage and used
// by the game.

const LS_KEY = 'jfd_rap_words_v1';

const DEFAULT_WORDS = [
  'Dawson', 'hustle', 'hot dog', 'mustard', 'flow', 'grind', 'money', 'mic drop',
  'ketchup', 'streets', 'bars', 'freestyle', 'cypher', 'beat', 'rhyme', 'sizzle',
  'grip', 'stack', 'block', 'crew', 'small town', 'big dreams', 'boombox', 'vinyl',
  'gold chain', 'fresh', 'kicks', 'legend', 'spotlight', 'encore', 'верс', 'no sleep',
  'relish', 'onions', 'napkin', 'change', 'corner', 'cold cut', 'glizzy', 'crown',
];

function parse(text) {
  return String(text)
    .split(/[\n,]+/)                 // newlines or commas separate entries
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && w.length <= 24)
    .slice(0, 400);
}

export function getWords() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch (e) { /* ignore */ }
  return DEFAULT_WORDS;
}

// Save from a raw pasted string. Empty input restores the default bank.
export function setWords(text) {
  const arr = parse(text);
  try {
    if (arr.length) localStorage.setItem(LS_KEY, JSON.stringify(arr));
    else localStorage.removeItem(LS_KEY);
  } catch (e) { /* ignore */ }
  return arr.length ? arr : DEFAULT_WORDS;
}

export function getWordsText() {
  return getWords().join('\n');
}

export function isCustomWords() {
  try { return !!localStorage.getItem(LS_KEY); } catch (e) { return false; }
}

export function resetWords() {
  try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
  return DEFAULT_WORDS;
}

// n random words (no immediate repeats).
export function randomWords(n) {
  const bank = getWords();
  const out = [];
  let last = -1;
  for (let i = 0; i < n; i++) {
    let idx = Math.floor(Math.random() * bank.length);
    if (bank.length > 1 && idx === last) idx = (idx + 1) % bank.length;
    last = idx;
    out.push(bank[idx]);
  }
  return out;
}

export { DEFAULT_WORDS };
