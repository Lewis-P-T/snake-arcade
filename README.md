# Snake Arcade

Browser Snake game with levels, power-ups, high scores and an AI demo. No dependencies, no build step.

**Play live:** https://lewis-p-t.github.io/snake-arcade/ — or clone and open `index.html`.

## Controls
| Action | Keyboard | Touch |
|---|---|---|
| Steer | Arrow keys / WASD (two quick turns are buffered) | Swipe on the board |
| Pause / resume | P or Esc | Tap the board |
| Start / play again | Enter or Space | Start button |
| High scores | H (from menu) | Button |
| Demo (autopilot) | D (from menu), any key exits | Button, tap exits |

## Features
- **Modes:** Slow / Normal / Turbo speed × solid walls or wrap-around edges; sound on/off. Settings are saved.
- **Levels:** a new obstacle layout every 5 food (+50 bonus); food never spawns on the snake or walls.
- **Power-ups:** `S` slow-mo, `2` score ×2, `-` shrink — timed, shown in the HUD, blink before expiring.
- **High scores:** top 10 per mode in `localStorage`, with name entry when you qualify.
- **Demo mode:** BFS autopilot that only goes for food if it can still reach its own tail afterwards, otherwise it chases its tail.
- **Sound:** small WebAudio blips for eating, power-ups, level-ups and death (no audio files).

## Files
- `game.js` — pure game logic (movement, collisions, levels, power-ups, scores, BFS autopilot); runs in Node too: `node -e "console.log(Object.keys(require('./game.js')))"`.
- `script.js` — canvas rendering, screens, input, sound, storage.
- `index.html`, `style.css` — page and responsive layout.
