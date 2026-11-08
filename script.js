const { createGame, turn, step } = SnakeGame;
const canvas = document.getElementById('board'), ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score'), msgEl = document.getElementById('msg');
const COLS = 20, ROWS = 20, CELL = canvas.width / COLS, TICK_MS = 120;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n);
let game = createGame(COLS, ROWS);

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
document.addEventListener('keydown', e => {
  const dir = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (dir) { e.preventDefault(); turn(game, dir); }
  else if (e.key === ' ' && game.over) { e.preventDefault(); game = createGame(COLS, ROWS); msgEl.textContent = 'Go!'; }
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

setInterval(() => {
  const wasOver = game.over;
  step(game);
  if (game.over && !wasOver) msgEl.textContent = `Game over! Score ${game.score}. Press Space to restart.`;
  draw();
}, TICK_MS);
draw();
