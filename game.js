// Pure game logic — no DOM. Works in the browser (global) and in node (require).
(function (root) {
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  const SPEEDS = { slow: 180, normal: 120, turbo: 70 }; // ms per tick
  const FOOD_PER_LEVEL = 5;

  // Obstacle layouts, one per level (cycles after the last). Each returns [x, y] cells.
  const LEVELS = [
    () => [],
    (c, r) => { // four corner brackets
      const out = [];
      for (let i = 2; i < 6; i++) out.push([i, 2], [2, i], [c - 1 - i, 2], [c - 3, i], [i, r - 3], [2, r - 1 - i], [c - 1 - i, r - 3], [c - 3, r - 1 - i]);
      return out;
    },
    (c, r) => { // two long horizontal bars
      const out = [];
      for (let x = 3; x < c - 3; x++) out.push([x, Math.floor(r / 4)], [x, r - 1 - Math.floor(r / 4)]);
      return out;
    },
    (c, r) => { // centre cross
      const out = [];
      for (let i = 3; i < c - 3; i++) out.push([i, Math.floor(r / 2) - 3]);
      for (let i = 3; i < r - 3; i++) out.push([Math.floor(c / 2), i]);
      return out;
    },
    (c, r) => { // inner box with four doorways
      const out = [], x0 = 3, y0 = 3, x1 = c - 4, y1 = r - 4, mx = Math.floor(c / 2), my = Math.floor(r / 2);
      for (let x = x0; x <= x1; x++) if (Math.abs(x - mx) > 1) out.push([x, y0], [x, y1]);
      for (let y = y0; y <= y1; y++) if (Math.abs(y - my) > 1) out.push([x0, y], [x1, y]);
      return out;
    },
  ];

  // Power-ups: timed effects (ticks) or instant (shrink).
  const POWERUPS = { slow: 40, multi: 60, shrink: 0 };
  const POWERUP_CHANCE = 0.35, POWERUP_LIFE = 50;

  const key = (x, y) => x + ',' + y;

  function startSnake(cols, rows) {
    const mid = [Math.floor(cols / 2), Math.floor(rows / 2)];
    return [mid, [mid[0] - 1, mid[1]], [mid[0] - 2, mid[1]]]; // head first
  }

  // Walls for a level, minus a safe runway around the start position.
  function buildWalls(level, cols, rows) {
    const mx = Math.floor(cols / 2), my = Math.floor(rows / 2);
    const cells = LEVELS[(level - 1) % LEVELS.length](cols, rows);
    return new Set(cells
      .filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows)
      .filter(([x, y]) => !(y === my && x >= mx - 4 && x <= mx + 5))
      .map(([x, y]) => key(x, y)));
  }

  function createGame(cols = 20, rows = 20, rand = Math.random, opts = {}) {
    const g = {
      cols, rows, rand,
      snake: startSnake(cols, rows),
      dir: 'right', nextDir: 'right',
      food: null, powerup: null, effects: {},
      score: 0, over: false, wrap: !!opts.wrap, eaten: 0, ticks: 0,
      level: 1, walls: buildWalls(1, cols, rows), events: [],
    };
    g.food = spawnFood(g);
    return g;
  }

  // Uniformly random free cell: never on snake, walls, food or power-up.
  function spawnFood(g) {
    const taken = new Set(g.snake.map(([x, y]) => key(x, y)));
    if (g.walls) for (const w of g.walls) taken.add(w);
    if (g.food) taken.add(key(...g.food));
    if (g.powerup) taken.add(key(g.powerup.x, g.powerup.y));
    const free = [];
    for (let y = 0; y < g.rows; y++)
      for (let x = 0; x < g.cols; x++)
        if (!taken.has(key(x, y))) free.push([x, y]);
    return free.length ? free[Math.floor(g.rand() * free.length)] : null;
  }

  function turn(g, dir) {
    const [dx, dy] = DIRS[dir], [cx, cy] = DIRS[g.dir];
    if (dx !== -cx || dy !== -cy) g.nextDir = dir; // no 180° reversal
  }

  function levelUp(g) {
    g.level++;
    g.walls = buildWalls(g.level, g.cols, g.rows);
    g.snake = startSnake(g.cols, g.rows); // fresh start so new walls never overlap the snake
    g.dir = g.nextDir = 'right';
    g.powerup = null; g.food = null;
    g.score += 50;
    g.food = spawnFood(g);
    g.events.push('level');
  }

  function step(g) {
    g.events = [];
    if (g.over) return g;
    g.dir = g.nextDir;
    const [dx, dy] = DIRS[g.dir];
    let head = [g.snake[0][0] + dx, g.snake[0][1] + dy];
    if (g.wrap) head = [(head[0] + g.cols) % g.cols, (head[1] + g.rows) % g.rows];
    g.ticks++;
    for (const k in g.effects) if (--g.effects[k] <= 0) delete g.effects[k];
    if (g.powerup && --g.powerup.life <= 0) g.powerup = null;

    const eats = g.food && head[0] === g.food[0] && head[1] === g.food[1];
    const body = eats ? g.snake : g.snake.slice(0, -1); // tail moves away unless growing
    const hitEdge = head[0] < 0 || head[1] < 0 || head[0] >= g.cols || head[1] >= g.rows;
    const hitWall = g.walls.has(key(...head));
    const hitSelf = body.some(([x, y]) => x === head[0] && y === head[1]);
    if (hitEdge || hitWall || hitSelf) { g.over = true; g.events.push('die'); return g; }
    g.snake = [head, ...body];

    if (g.powerup && head[0] === g.powerup.x && head[1] === g.powerup.y) {
      const t = g.powerup.type;
      if (t === 'shrink') g.snake = g.snake.slice(0, Math.max(3, g.snake.length - 3));
      else g.effects[t] = POWERUPS[t];
      g.powerup = null;
      g.events.push('power:' + t);
    }

    if (eats) {
      g.score += 10 * (g.effects.multi ? 2 : 1);
      g.eaten++;
      g.events.push('eat');
      if (g.eaten % FOOD_PER_LEVEL === 0) return levelUp(g), g;
      g.food = null;
      g.food = spawnFood(g);
      if (!g.food) { g.over = true; return g; }
      if (!g.powerup && g.rand() < POWERUP_CHANCE) {
        const types = Object.keys(POWERUPS);
        const cell = spawnFood(g);
        if (cell) g.powerup = { type: types[Math.floor(g.rand() * types.length)], x: cell[0], y: cell[1], life: POWERUP_LIFE };
      }
    }
    return g;
  }

  // Tick delay for the UI: slow-mo halves the pace.
  const tickMs = (g, speed) => SPEEDS[speed] * (g.effects.slow ? 2 : 1);

  const api = { DIRS, SPEEDS, LEVELS, POWERUPS, FOOD_PER_LEVEL, createGame, spawnFood, buildWalls, turn, step, tickMs };
  if (typeof module !== 'undefined') module.exports = api; else root.SnakeGame = api;
})(this);
