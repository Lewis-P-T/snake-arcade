// Pure game logic — no DOM. Works in the browser (global) and in node (require).
(function (root) {
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function createGame(cols = 20, rows = 20, rand = Math.random) {
    const mid = [Math.floor(cols / 2), Math.floor(rows / 2)];
    const g = {
      cols, rows, rand,
      snake: [mid, [mid[0] - 1, mid[1]], [mid[0] - 2, mid[1]]], // head first
      dir: 'right', nextDir: 'right',
      food: null, score: 0, over: false,
    };
    g.food = spawnFood(g);
    return g;
  }

  function spawnFood(g) {
    const taken = new Set(g.snake.map(([x, y]) => x + ',' + y));
    const free = [];
    for (let y = 0; y < g.rows; y++)
      for (let x = 0; x < g.cols; x++)
        if (!taken.has(x + ',' + y)) free.push([x, y]);
    return free.length ? free[Math.floor(g.rand() * free.length)] : null;
  }

  function turn(g, dir) {
    const [dx, dy] = DIRS[dir], [cx, cy] = DIRS[g.dir];
    if (dx !== -cx || dy !== -cy) g.nextDir = dir; // no 180° reversal
  }

  function step(g) {
    if (g.over) return g;
    g.dir = g.nextDir;
    const [dx, dy] = DIRS[g.dir];
    const head = [g.snake[0][0] + dx, g.snake[0][1] + dy];
    const eats = g.food && head[0] === g.food[0] && head[1] === g.food[1];
    const body = eats ? g.snake : g.snake.slice(0, -1); // tail moves away unless growing
    const hitWall = head[0] < 0 || head[1] < 0 || head[0] >= g.cols || head[1] >= g.rows;
    const hitSelf = body.some(([x, y]) => x === head[0] && y === head[1]);
    if (hitWall || hitSelf) { g.over = true; return g; }
    g.snake = [head, ...body];
    if (eats) { g.score += 10; g.food = spawnFood(g); if (!g.food) g.over = true; }
    return g;
  }

  const api = { DIRS, createGame, spawnFood, turn, step };
  if (typeof module !== 'undefined') module.exports = api; else root.SnakeGame = api;
})(this);
