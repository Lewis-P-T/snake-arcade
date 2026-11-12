const { createGame, turn, step, SPEEDS } = SnakeGame;
const canvas = document.getElementById('board'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const scoreEl = $('score'), modeEl = $('mode'), overlay = $('overlay');
const COLS = 20, ROWS = 20, CELL = canvas.width / COLS;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n);

// Settings persist between visits (best effort — private mode may block storage).
let settings = { speed: 'normal', wrap: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('snake-settings')) || {}); } catch {}
const saveSettings = () => { try { localStorage.setItem('snake-settings', JSON.stringify(settings)); } catch {} };

// Screen state machine: menu -> playing <-> paused -> over -> (playing | menu)
let screen = 'menu', game = createGame(COLS, ROWS, Math.random, settings), timer = null;

function setScreen(next) {
  screen = next;
  clearInterval(timer); timer = null;
  if (next === 'playing') timer = setInterval(tick, SPEEDS[settings.speed]);
  renderOverlay(); draw();
}

function start() { game = createGame(COLS, ROWS, Math.random, settings); setScreen('playing'); }

function tick() {
  step(game);
  if (game.over) setScreen('over'); else draw();
}

const label = s => s[0].toUpperCase() + s.slice(1);
function renderOverlay() {
  overlay.hidden = screen === 'playing';
  modeEl.textContent = `${label(settings.speed)} · ${settings.wrap ? 'Wrap' : 'Walls'}`;
  if (screen === 'menu') {
    overlay.innerHTML = `<h2>Snake Arcade</h2>
      <div class="row">Speed: ${Object.keys(SPEEDS).map(s =>
        `<button data-speed="${s}" aria-pressed="${settings.speed === s}">${label(s)}</button>`).join('')}</div>
      <div class="row">Edges: <button data-wrap="0" aria-pressed="${!settings.wrap}">Solid walls</button><button data-wrap="1" aria-pressed="${settings.wrap}">Wrap around</button></div>
      <button class="primary" data-act="start">Start (Enter)</button>`;
  } else if (screen === 'paused') {
    overlay.innerHTML = `<h2>Paused</h2><button class="primary" data-act="resume">Resume (P)</button><button data-act="menu">Menu (M)</button>`;
  } else if (screen === 'over') {
    const secs = (game.ticks * SPEEDS[settings.speed] / 1000).toFixed(1);
    overlay.innerHTML = `<h2>Game Over</h2>
      <dl><dt>Score</dt><dd>${game.score}</dd><dt>Length</dt><dd>${game.snake.length}</dd>
      <dt>Food eaten</dt><dd>${game.eaten}</dd><dt>Time</dt><dd>${secs}s</dd></dl>
      <button class="primary" data-act="start">Play again (Enter)</button><button data-act="menu">Menu (M)</button>`;
  }
}

overlay.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.speed) { settings.speed = b.dataset.speed; saveSettings(); renderOverlay(); }
  else if (b.dataset.wrap) { settings.wrap = b.dataset.wrap === '1'; saveSettings(); renderOverlay(); }
  else ({ start, resume: () => setScreen('playing'), menu: () => setScreen('menu') })[b.dataset.act]();
});

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
document.addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (screen === 'playing') {
    if (KEYS[k]) { e.preventDefault(); turn(game, KEYS[k]); }
    else if (k === 'p' || k === 'Escape') setScreen('paused');
  } else if (screen === 'paused') {
    if (k === 'p' || k === 'Escape') setScreen('playing');
    else if (k === 'm') setScreen('menu');
  } else if (k === 'Enter' || k === ' ') { e.preventDefault(); start(); }
  else if (screen === 'over' && k === 'm') setScreen('menu');
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (game.food) { ctx.fillStyle = css('--food'); ctx.fillRect(game.food[0] * CELL + 2, game.food[1] * CELL + 2, CELL - 4, CELL - 4); }
  game.snake.forEach(([x, y], i) => {
    ctx.fillStyle = css(i ? '--snake' : '--head');
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  });
  scoreEl.textContent = game.score;
}

document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'playing') setScreen('paused'); });
setScreen('menu');
