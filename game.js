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
      dir: 'right', turns: [],
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
    // Buffer up to 2 turns so fast taps (e.g. up+left within one tick) both land.
    const last = g.turns.length ? g.turns[g.turns.length - 1] : g.dir;
    const [dx, dy] = DIRS[dir], [cx, cy] = DIRS[last];
    if (dir !== last && (dx !== -cx || dy !== -cy) && g.turns.length < 2) g.turns.push(dir); // no 180° reversal
  }

  function levelUp(g) {
    g.level++;
    g.walls = buildWalls(g.level, g.cols, g.rows);
    g.snake = startSnake(g.cols, g.rows); // fresh start so new walls never overlap the snake
    g.dir = 'right'; g.turns = [];
    g.powerup = null; g.food = null;
    g.score += 50;
    g.food = spawnFood(g);
    g.events.push('level');
  }

  function step(g) {
    g.events = [];
    if (g.over) return g;
    if (g.turns.length) g.dir = g.turns.shift();
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

  // ---- High scores: top N per mode (speed + edge rule), highest first, ties keep the earlier entry above.
  const MAX_SCORES = 10;
  const modeKey = (speed, wrap) => `${speed}-${wrap ? 'wrap' : 'walls'}`;
  const qualifies = (list, score) => score > 0 && (list.length < MAX_SCORES || score > list[list.length - 1].score);
  function insertScore(list, entry) {
    const out = list.slice();
    let i = out.findIndex(e => entry.score > e.score);
    if (i < 0) i = out.length;
    out.splice(i, 0, entry);
    return { list: out.slice(0, MAX_SCORES), rank: i < MAX_SCORES ? i : -1 };
  }

  // ---- Autopilot: BFS to food, but only if the snake could still reach its own tail afterwards
  // (so it never seals itself in). Otherwise chase the tail, else take the move with most room.
  function neighbor(g, [x, y], d) {
    let nx = x + DIRS[d][0], ny = y + DIRS[d][1];
    if (g.wrap) { nx = (nx + g.cols) % g.cols; ny = (ny + g.rows) % g.rows; }
    else if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) return null;
    return g.walls.has(key(nx, ny)) ? null : [nx, ny];
  }

  // Shortest path from snake head to target; the tail cell counts as free (it moves away). Returns dir list or null.
  function bfs(g, snake, target) {
    const blocked = new Set(snake.slice(0, -1).map(c => key(...c)));
    const start = key(...snake[0]), goal = key(...target);
    const prev = new Map([[start, null]]), queue = [snake[0]];
    for (let qi = 0; qi < queue.length; qi++) {
      const cell = queue[qi], ck = key(...cell);
      if (ck === goal && qi > 0) {
        const path = [];
        for (let k = ck; prev.get(k); k = prev.get(k)[0]) path.unshift(prev.get(k)[1]);
        return path;
      }
      for (const d in DIRS) {
        const n = neighbor(g, cell, d); if (!n) continue;
        const nk = key(...n);
        if (nk === goal && !prev.has(nk) || !prev.has(nk) && !blocked.has(nk)) { prev.set(nk, [ck, d]); queue.push(n); }
      }
    }
    return null;
  }

  function floodSize(g, snake, from) {
    const blocked = new Set(snake.map(c => key(...c)));
    const seen = new Set([key(...from)]), queue = [from];
    for (let qi = 0; qi < queue.length; qi++)
      for (const d in DIRS) {
        const n = neighbor(g, queue[qi], d); if (!n) continue;
        const nk = key(...n);
        if (!seen.has(nk) && !blocked.has(nk)) { seen.add(nk); queue.push(n); }
      }
    return seen.size;
  }

  // Move the virtual snake one cell; it grows when it lands on food.
  function advance(snake, cell, food) {
    const grow = food && cell[0] === food[0] && cell[1] === food[1];
    return [cell, ...(grow ? snake : snake.slice(0, -1))];
  }

  function autopilot(g) {
    const legal = Object.keys(DIRS).filter(d => {
      const [dx, dy] = DIRS[d], [cx, cy] = DIRS[g.dir];
      if (dx === -cx && dy === -cy) return false;
      const n = neighbor(g, g.snake[0], d);
      return n && !g.snake.slice(0, -1).some(c => c[0] === n[0] && c[1] === n[1]);
    });
    if (!legal.length) return g.dir;
    if (g.food) {
      const path = bfs(g, g.snake, g.food);
      if (path && legal.includes(path[0])) {
        let s = g.snake;
        for (const d of path) s = advance(s, neighbor(g, s[0], d), g.food);
        if (s.length < 4 || bfs(g, s, s[s.length - 1])) return path[0]; // tail reachable: safe to eat
      }
    }
    // Stall safely: among moves that keep the tail reachable, prefer the one furthest from the tail.
    let best = null, bestScore = -1;
    for (const d of legal) {
      const s = advance(g.snake, neighbor(g, g.snake[0], d), g.food);
      const toTail = bfs(g, s, s[s.length - 1]);
      const score = toTail ? 10000 + toTail.length : floodSize(g, s, s[0]);
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  // Tick delay for the UI: slow-mo halves the pace.
  const tickMs = (g, speed) => SPEEDS[speed] * (g.effects.slow ? 2 : 1);

  const api = { DIRS, SPEEDS, LEVELS, POWERUPS, FOOD_PER_LEVEL, MAX_SCORES, createGame, spawnFood, buildWalls, turn, step, tickMs, modeKey, qualifies, insertScore, bfs, autopilot };
  if (typeof module !== 'undefined') module.exports = api; else root.SnakeGame = api;
})(this);
