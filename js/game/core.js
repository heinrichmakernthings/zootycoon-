// CUTISE ZOO — front end: shared state, saving, sound and the clock.
// The files in js/game/ share one scope and load in the order index.html lists them.
// Every change to the zoo goes through act() → ZooSim.apply(). The screen never edits state.
const D = ZooData;
const Sim = ZooSim;
const SAVE_KEY = 'cutise-zoo-save';
const PREFS_KEY = 'cutise-zoo-prefs';

let S = null; // the zoo
const ui = {
  mode: null, // null (look and tap), 'build', 'bulldoze'
  canUndo: false, // the last thing placed in this build session can be taken back
  autoPaused: false, // paused because you're building (prefs.pauseWhileBuilding)
  follow: null, // animal id the camera is following
  naming: false, // the welcome pop-up is asking for the zoo's name
  buildKey: null,
  hover: null, // {x, y} tile under the pointer
  panel: null, // what the side panel is showing
  seenNews: 0,
  reportDay: 0, // the last end-of-day report shown
  speed: 1,
  paused: false,
};

// ---------- prefs (this device only) ----------
const prefs = (() => {
  const base = {
    sound: true,
    pauseWhileBuilding: true,
    reduceMotion: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
  };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch (e) {
    return base;
  }
})();
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {}
}

// ---------- the one way in ----------
function act(cmd) {
  const res = Sim.apply(S, cmd);
  if (!res.ok) {
    toast(res.error, 'bad');
    sfx('nope');
  }
  updateHud();
  return res;
}

// ---------- saving ----------
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: S, savedAt: Date.now() }));
  } catch (e) {}
}
function loadSave() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  } catch (e) {}
  if (!raw || !raw.state) {
    S = Sim.createState((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    return { fresh: true };
  }
  S = Sim.load(raw.state);
  const away = Math.floor((Date.now() - (raw.savedAt || Date.now())) / 1000);
  const out = away > 60 ? { away: Sim.catchUp(S, away) } : {};
  // News and reports from before you opened the game are summed up in "while you were away".
  ui.seenNews = S.newsId;
  ui.reportDay = S.report ? S.report.day : 0;
  return out;
}
function newZoo() {
  S = Sim.createState((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  ui.seenNews = 0;
  ui.reportDay = 0;
  save();
  updateHud();
}

// ---------- sound: tiny synth blips, no files needed ----------
let audio = null;
function sfx(kind) {
  if (!prefs.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const notes = {
      pet: [660, 880],
      coin: [988, 1319],
      build: [392, 523],
      nope: [220, 180],
      level: [523, 659, 784, 1047],
      baby: [784, 988, 1175],
      pop: [600],
    }[kind] || [440];
    notes.forEach((f, i) => {
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = kind === 'nope' ? 'square' : 'triangle';
      o.frequency.value = f;
      const t0 = audio.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g).connect(audio.destination);
      o.start(t0);
      o.stop(t0 + 0.2);
    });
  } catch (e) {}
}

// ---------- the clock ----------
// One zoo second per real second (or faster). News from the rules becomes toasts.
let lastTick = 0;
function clock(now) {
  if (!ui.paused && now - lastTick >= 1000 / ui.speed) {
    lastTick = now;
    Sim.tick(S);
    if (S.t % 10 === 0) save();
    if (S.report && S.report.day !== ui.reportDay) {
      ui.reportDay = S.report.day;
      showDayReport(S.report);
    }
    updateHud();
  }
  for (const n of S.news) {
    if (n.id <= ui.seenNews) continue;
    ui.seenNews = n.id;
    if (n.kind === 'baby' || n.kind === 'offer') sfx('baby');
    if (n.kind === 'stage') {
      sfx('level');
      celebrate();
    }
    toast(n.text, n.kind);
  }
  render.frame(now);
  requestAnimationFrame(clock);
}

// ---------- shared little helpers ----------
const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n)));
