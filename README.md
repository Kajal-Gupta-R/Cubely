# Cubely

Cubely is a browser-based 3×3 Rubik’s Cube editor and learning companion. Enter a
cube, inspect it in an interactive 3D preview, validate its physical legality,
and follow an animated, verified solution.

## Run locally

```sh
npm install
npm run dev
```

Run the checks with `npm test`, `npm run lint`, and `npm run build`.

## Cube solving and learning

Cubely converts the six-face editor state into cubing.js 3×3×3 cubie
coordinates, validates physical legality first, and verifies each returned
standard face-turn sequence by replaying it against the editor state. The
solver uses the `experimentalSolve3x3x3IgnoringCenters` API; its algorithm and
performance may change with future cubing.js releases. A 30-second timeout
reports failure, but the library does not expose cancellation, so timed-out
worker computation may continue in the background.

Solution playback animates real 3D face turns, updates the shared editor cube
after each completed turn, supports navigation and speed changes, and verifies
the final cube is solved. The learning panel explains each move in the verified
sequence. Browsing explanations does not change the playback position or cube;
the explanation and playback progress are shown separately. Move direction is
defined as clockwise or counterclockwise when looking directly at the named face
from outside the cube. Reduced-motion preferences skip tweening while still
applying each actual move.

The editor, preview, undo/redo history, and local browser persistence share the
same cube state. Unentered stickers are shown as dark cubelet faces; solving
requires a complete, physically legal state. The learning mode currently
explains individual face turns, not broader solving algorithms or cubie
notation.

## Scramble practice

Practice mode generates a 25-move standard face-turn scramble with no
consecutive turns of the same face. It starts from a solved cube and replaces
the current editor state as one undoable history action; Undo restores the
previous cube. The editor, 3D preview, undo/redo, and existing cube-state
persistence use the same shared state.

The timer starts only when **Start** is pressed after generating a scramble.
During an attempt, sticker editing, reset, undo/redo, restore, and solver
playback are locked; applying standard face turns remains available. **Stop
and save** becomes available only when the cube is solved. **Reset attempt**
discards the current time without deleting saved results. Solve times are
measured from monotonic clock timestamps and stored separately in browser
localStorage under `cubely.practice-history.v1`. Individual attempts can be
deleted, and clearing all history requires confirmation. Best and average
times are computed from the saved attempts. The move-based scramble generator
creates legal reachable states but does not promise a uniform random-state
distribution.

The `cubing` package is licensed under MPL-2.0 OR GPL-3.0-or-later; review its
licensing terms for your distribution.
