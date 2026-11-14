const { createGame, turn, step, SPEEDS, tickMs, modeKey, qualifies, insertScore, autopilot } = SnakeGame;
const canvas = document.getElementById('board'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const scoreEl = $('score'), modeEl = $('mode'), levelEl = $('level'), fxEl = $('effects'), overlay = $('overlay');
const COLS = 20, ROWS = 20, CELL = canvas.width / COLS;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n);

// Settings persist between visits (best effort — private mode may block storage).
let settings = { speed: 'normal', wrap: false, sound: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('snake-settings')) || {}); } catch {}
const saveSettings = () => { try { localStorage.setItem('snake-settings', JSON.stringify(settings)); } catch {} };

// High scores: { 'normal-walls': [{ name, score, level, date }], ... }
let scores = {};
try { scores = JSON.parse(localStorage.getItem('snake-scores')) || {}; } catch {}
const saveScores = () => { try { localStorage.setItem('snake-scores', JSON.stringify(scores)); } catch {} };
const currentMode = () => modeKey(settings.speed, settings.wrap);
let lastRank = -1, pendingEntry = false;

// Sound: tiny WebAudio blips, no files. AudioContext is created on first use (browsers need a user gesture).
let audio = null;
function beep(freq, ms = 70, type = 'square') {
  if (!settings.sound || screen === 'demo') return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + ms / 1000);
  } catch {}
}
const SOUNDS = { eat: () => beep(660), level: () => { beep(523, 90); setTimeout(() => beep(784, 140), 90); },
  power: () => beep(990, 120, 'triangle'), die: () => beep(110, 300, 'sawtooth') };
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// Screen state machine: menu -> playing <-> paused -> over -> (playing | menu); menu <-> scores; menu <-> demo
let screen = 'menu', game = createGame(COLS, ROWS, Math.random, settings), timer = null;

function setScreen(next) {
  screen = next;
  clearTimeout(timer); timer = null;
  if (next === 'playing' || next === 'demo') schedule();
  renderOverlay(); draw();
}

function start() { game = createGame(COLS, ROWS, Math.random, settings); flash = 0; lastRank = -1; setScreen('playing'); }
function startDemo() { game = createGame(COLS, ROWS, Math.random, settings); flash = 0; setScreen('demo'); }

function gameOver() {
  pendingEntry = qualifies(scores[currentMode()] || [], game.score);
  setScreen('over');
  if (pendingEntry) $('nameIn').focus();
}
function submitScore(name) {
  const entry = { name: name.trim().slice(0, 12) || 'Anon', score: game.score, level: game.level, date: new Date().toISOString().slice(0, 10) };
  const r = insertScore(scores[currentMode()] || [], entry);
  scores[currentMode()] = r.list; lastRank = r.rank; saveScores();
  try { localStorage.setItem('snake-name', entry.name); } catch {}
  pendingEntry = false; setScreen('scores');
}

// setTimeout chain (not setInterval) so slow-mo can change the pace tick by tick.
function schedule() { timer = setTimeout(tick, tickMs(game, settings.speed)); }
let flash = 0, flashText = '';
function tick() {
  if (screen === 'demo') turn(game, autopilot(game));
  step(game);
  for (const ev of game.events) {
    SOUNDS[ev.split(':')[0]]?.();
    if (ev === 'level') { flash = 12; flashText = `Level ${game.level}!`; }
    else if (ev.startsWith('power:')) { flash = 8; flashText = POWER_LABEL[ev.slice(6)]; }
  }
  if (game.over && screen === 'demo') { flash = 0; game = createGame(COLS, ROWS, Math.random, settings); draw(); schedule(); }
  else if (game.over) gameOver(); else { draw(); schedule(); }
}
const POWER_LABEL = { slow: 'Slow-mo!', multi: 'Score x2!', shrink: 'Shrink!' };
const POWER_ICON = { slow: '🐢', multi: '×2', shrink: '✂' };

const label = s => s[0].toUpperCase() + s.slice(1);
const storedName = () => { try { return localStorage.getItem('snake-name') || ''; } catch { return ''; } };
function renderOverlay() {
  overlay.hidden = screen === 'playing' || screen === 'demo';
  modeEl.textContent = `${label(settings.speed)} · ${settings.wrap ? 'Wrap' : 'Walls'}${screen === 'demo' ? ' · DEMO (any key to exit)' : ''}`;
  if (screen === 'menu') {
    overlay.innerHTML = `<h2>Snake Arcade</h2>
      <div class="row">Speed: ${Object.keys(SPEEDS).map(s =>
        `<button data-speed="${s}" aria-pressed="${settings.speed === s}">${label(s)}</button>`).join('')}</div>
      <div class="row">Edges: <button data-wrap="0" aria-pressed="${!settings.wrap}">Solid walls</button><button data-wrap="1" aria-pressed="${settings.wrap}">Wrap around</button></div>
      <div class="row">Sound: <button data-act="sound" aria-pressed="${settings.sound}">${settings.sound ? 'On' : 'Off'}</button></div>
      <button class="primary" data-act="start">Start (Enter)</button>
      <div class="row"><button data-act="scores">High scores (H)</button><button data-act="demo">Watch demo (D)</button></div>`;
  } else if (screen === 'scores') {
    const list = scores[currentMode()] || [];
    overlay.innerHTML = `<h2>High Scores</h2><p class="sub">${label(settings.speed)} · ${settings.wrap ? 'Wrap' : 'Walls'}</p>
      ${list.length ? `<table><tr><th>#</th><th>Name</th><th>Score</th><th>Lvl</th><th>Date</th></tr>${list.map((e, i) =>
        `<tr${i === lastRank ? ' class="new"' : ''}><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.level}</td><td>${esc(e.date)}</td></tr>`).join('')}</table>`
        : '<p>No scores yet for this mode.</p>'}
      <div class="row"><button class="primary" data-act="start">Play (Enter)</button><button data-act="menu">Menu (M)</button></div>`;
  } else if (screen === 'paused') {
    overlay.innerHTML = `<h2>Paused</h2><button class="primary" data-act="resume">Resume (P)</button><button data-act="menu">Menu (M)</button>`;
  } else if (screen === 'over') {
    const secs = (game.ticks * SPEEDS[settings.speed] / 1000).toFixed(1); // approx: ignores slow-mo stretch
    overlay.innerHTML = `<h2>Game Over</h2>
      <dl><dt>Score</dt><dd>${game.score}</dd><dt>Length</dt><dd>${game.snake.length}</dd>
      <dt>Level</dt><dd>${game.level}</dd><dt>Food eaten</dt><dd>${game.eaten}</dd><dt>Time</dt><dd>${secs}s</dd></dl>
      ${pendingEntry ? `<form id="nameForm" class="row"><label>New high score! Name: <input id="nameIn" maxlength="12" autocomplete="off" value="${esc(storedName())}"></label><button class="primary">Save</button></form>`
        : `<button class="primary" data-act="start">Play again (Enter)</button><button data-act="menu">Menu (M)</button>`}`;
  }
}

overlay.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.speed) { settings.speed = b.dataset.speed; saveSettings(); renderOverlay(); }
  else if (b.dataset.wrap) { settings.wrap = b.dataset.wrap === '1'; saveSettings(); renderOverlay(); }
  else if (b.dataset.act) ({ start, demo: startDemo, scores: () => { lastRank = -1; setScreen('scores'); },
    resume: () => setScreen('playing'), menu: () => setScreen('menu'),
    sound: () => { settings.sound = !settings.sound; saveSettings(); renderOverlay(); beep(660); } })[b.dataset.act]();
});
overlay.addEventListener('submit', e => { e.preventDefault(); submitScore($('nameIn').value); });
canvas.addEventListener('click', () => { if (screen === 'demo') setScreen('menu'); });

// Touch: swipe on the board to steer; tap to pause/resume. touch-action:none in CSS stops page scroll.
let touch0 = null;
canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') touch0 = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => {
  if (!touch0) return;
  const dx = e.clientX - touch0[0], dy = e.clientY - touch0[1]; touch0 = null;
  if (screen === 'demo') return setScreen('menu');
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { // a tap, not a swipe
    if (screen === 'playing') setScreen('paused'); else if (screen === 'paused') setScreen('playing');
    return;
  }
  if (screen === 'playing') turn(game, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
canvas.addEventListener('pointercancel', () => { touch0 = null; });

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return; // typing a name: let the form handle Enter
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (screen === 'demo') { e.preventDefault(); setScreen('menu'); return; }
  if (screen === 'playing') {
    if (KEYS[k]) { e.preventDefault(); turn(game, KEYS[k]); }
    else if (k === 'p' || k === 'Escape') setScreen('paused');
  } else if (screen === 'paused') {
    if (k === 'p' || k === 'Escape') setScreen('playing');
    else if (k === 'm') setScreen('menu');
  } else if (screen === 'over' && pendingEntry) return; // must save the score first
  else if (k === 'Enter' || k === ' ') { e.preventDefault(); start(); }
  else if (k === 'm' && screen !== 'menu') setScreen('menu');
  else if (screen === 'menu' && k === 'h') { lastRank = -1; setScreen('scores'); }
  else if (screen === 'menu' && k === 'd') startDemo();
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = css('--wall');
  for (const w of game.walls) { const [x, y] = w.split(',').map(Number); ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
  const p = game.powerup;
  if (p && (p.life > 15 || p.life % 2)) { // blink when about to expire
    ctx.fillStyle = css('--power'); ctx.beginPath();
    ctx.arc(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = `bold ${CELL * 0.55}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText({ slow: 'S', multi: '2', shrink: '-' }[p.type], p.x * CELL + CELL / 2, p.y * CELL + CELL / 2 + 1);
  }
  if (game.food) { ctx.fillStyle = css('--food'); ctx.fillRect(game.food[0] * CELL + 2, game.food[1] * CELL + 2, CELL - 4, CELL - 4); }
  game.snake.forEach(([x, y], i) => {
    ctx.fillStyle = css(i ? '--snake' : '--head');
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  });
  if (flash > 0) {
    flash--;
    ctx.fillStyle = css('--head'); ctx.font = 'bold 32px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(flashText, canvas.width / 2, canvas.height / 3);
  }
  scoreEl.textContent = game.score;
  levelEl.textContent = game.level;
  fxEl.textContent = Object.entries(game.effects).map(([k, t]) => `${POWER_ICON[k]} ${t}`).join('  ');
}

document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'playing') setScreen('paused'); });
setScreen('menu');
