import { describe, expect, it } from 'vitest';
import {
  createEmptyCubeState,
  createSolvedCubeState,
  resetFace,
  setSticker,
  type CubeState,
  type Face,
  type StickerColor,
} from '../src/cubeState';
import { validateCube } from '../src/cubeValidation';

const FACE_ORDER: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
const CORNERS = [
  [[ 'U', 8 ], [ 'R', 0 ], [ 'F', 2 ]],
  [[ 'U', 6 ], [ 'F', 0 ], [ 'L', 2 ]],
  [[ 'U', 0 ], [ 'L', 0 ], [ 'B', 2 ]],
  [[ 'U', 2 ], [ 'B', 0 ], [ 'R', 2 ]],
  [[ 'D', 2 ], [ 'F', 8 ], [ 'R', 6 ]],
  [[ 'D', 0 ], [ 'L', 8 ], [ 'F', 6 ]],
  [[ 'D', 6 ], [ 'B', 8 ], [ 'L', 6 ]],
  [[ 'D', 8 ], [ 'R', 8 ], [ 'B', 6 ]],
] as const;
const EDGES = [
  [[ 'U', 5 ], [ 'R', 1 ]], [[ 'U', 7 ], [ 'F', 1 ]],
  [[ 'U', 3 ], [ 'L', 1 ]], [[ 'U', 1 ], [ 'B', 1 ]],
  [[ 'D', 5 ], [ 'R', 7 ]], [[ 'D', 1 ], [ 'F', 7 ]],
  [[ 'D', 3 ], [ 'L', 7 ]], [[ 'D', 7 ], [ 'B', 7 ]],
  [[ 'F', 5 ], [ 'R', 3 ]], [[ 'F', 3 ], [ 'L', 5 ]],
  [[ 'B', 5 ], [ 'L', 3 ]], [[ 'B', 3 ], [ 'R', 5 ]],
] as const;

function sticker(cube: CubeState, face: Face, index: number): StickerColor {
  return cube[face][index] as StickerColor;
}

function setPieceColors(
  cube: CubeState,
  positions: readonly (readonly [Face, number])[],
  colors: readonly StickerColor[],
) {
  positions.forEach(([face, index], slot) => {
    cube[face][index] = colors[slot];
  });
}

function scrambleCube(): CubeState {
  const cube = createSolvedCubeState();
  const cornerColors = CORNERS.map((position) =>
    position.map(([face, index]) => sticker(cube, face, index)),
  );
  const edgeColors = EDGES.map((position) =>
    position.map(([face, index]) => sticker(cube, face, index)),
  );

  [1, 2, 0, 3, 4, 5, 6, 7].forEach((piece, position) => {
    setPieceColors(cube, CORNERS[position], cornerColors[piece]);
  });
  [1, 2, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach((piece, position) => {
    setPieceColors(cube, EDGES[position], edgeColors[piece]);
  });
  return cube;
}

type Vector = [number, number, number];

function faceletPosition(face: Face, index: number): { position: Vector; normal: Vector } {
  const row = Math.floor(index / 3);
  const column = index % 3;
  switch (face) {
    case 'U': return { position: [column - 1, 1, row - 1], normal: [0, 1, 0] };
    case 'D': return { position: [column - 1, -1, 1 - row], normal: [0, -1, 0] };
    case 'F': return { position: [column - 1, 1 - row, 1], normal: [0, 0, 1] };
    case 'B': return { position: [1 - column, 1 - row, -1], normal: [0, 0, -1] };
    case 'L': return { position: [-1, 1 - row, column - 1], normal: [-1, 0, 0] };
    case 'R': return { position: [1, 1 - row, 1 - column], normal: [1, 0, 0] };
  }
}

function faceletIndex(face: Face, position: Vector): number {
  const [x, y, z] = position;
  let row: number;
  let column: number;
  switch (face) {
    case 'U': row = z + 1; column = x + 1; break;
    case 'D': row = 1 - z; column = x + 1; break;
    case 'F': row = 1 - y; column = x + 1; break;
    case 'B': row = 1 - y; column = 1 - x; break;
    case 'L': row = 1 - y; column = z + 1; break;
    case 'R': row = 1 - y; column = 1 - z; break;
  }
  return row * 3 + column;
}

function rotateClockwise(vector: Vector, axis: Vector): Vector {
  const cross: Vector = [
    axis[1] * vector[2] - axis[2] * vector[1],
    axis[2] * vector[0] - axis[0] * vector[2],
    axis[0] * vector[1] - axis[1] * vector[0],
  ];
  const dot = axis[0] * vector[0] + axis[1] * vector[1] + axis[2] * vector[2];
  return [
    -cross[0] + axis[0] * dot,
    -cross[1] + axis[1] * dot,
    -cross[2] + axis[2] * dot,
  ];
}

function turn(cube: CubeState, face: Face, quarterTurns = 1): CubeState {
  const axis = faceletPosition(face, 0).normal;
  let current = cube;
  for (let turnNumber = 0; turnNumber < quarterTurns; turnNumber += 1) {
    const next = structuredClone(current);
    for (const sourceFace of FACE_ORDER) {
      for (let index = 0; index < 9; index += 1) {
        const { position, normal } = faceletPosition(sourceFace, index);
        if (position[0] * axis[0] + position[1] * axis[1] + position[2] * axis[2] !== 1) continue;
        const targetNormal = rotateClockwise(normal, axis);
        const targetFace = FACE_ORDER.find((candidate) =>
          faceletPosition(candidate, 4).normal.every((value, dimension) => value === targetNormal[dimension]),
        );
        if (!targetFace) throw new Error('Unable to map rotated facelet.');
        const targetPosition = rotateClockwise(position, axis);
        next[targetFace][faceletIndex(targetFace, targetPosition)] = current[sourceFace][index];
      }
    }
    current = next;
  }
  return current;
}

describe('cube state helpers', () => {
  it('creates a six-face editor state with fixed centers and empty other stickers', () => {
    const cube = createEmptyCubeState();
    expect(FACE_ORDER).toHaveLength(6);
    expect(FACE_ORDER.every((face) => cube[face].length === 9)).toBe(true);
    expect(cube.U[4]).toBe('white');
    expect(cube.D[4]).toBe('yellow');
    expect(cube.F[4]).toBe('green');
    expect(cube.B[4]).toBe('blue');
    expect(cube.L[4]).toBe('orange');
    expect(cube.R[4]).toBe('red');
    expect(cube.F.filter((value) => value === null)).toHaveLength(8);
  });

  it('updates a sticker immutably and prevents changing centers', () => {
    const cube = createEmptyCubeState();
    const changed = setSticker(cube, 'F', 0, 'red');
    expect(changed.F[0]).toBe('red');
    expect(cube.F[0]).toBeNull();
    expect(() => setSticker(cube, 'F', 4, 'red')).toThrow(/center/);
  });

  it('resets only the selected face and preserves its standard center', () => {
    const cube = setSticker(createEmptyCubeState(), 'F', 0, 'red');
    const reset = resetFace(cube, 'F');
    expect(reset.F[0]).toBeNull();
    expect(reset.F[4]).toBe('green');
    expect(cube.F[0]).toBe('red');
  });
});

describe('validateCube', () => {
  it('accepts a solved cube', () => {
    expect(validateCube(createSolvedCubeState())).toEqual({ valid: true, issues: [] });
  });

  it('accepts a legal scrambled cubie state', () => {
    expect(validateCube(scrambleCube()).valid).toBe(true);
  });

  it('accepts states produced by standard face turns', () => {
    const moves: [Face, number][] = [
      ['R', 1], ['U', 1], ['F', 3], ['L', 2],
      ['D', 1], ['B', 3], ['R', 2], ['U', 3],
    ];
    const cube = moves.reduce(
      (state, [face, turns]) => turn(state, face, turns),
      createSolvedCubeState(),
    );
    expect(validateCube(cube)).toEqual({ valid: true, issues: [] });
  });

  it('reports missing stickers and incorrect color counts', () => {
    const emptyResult = validateCube(createEmptyCubeState());
    expect(emptyResult.issues.some((entry) => entry.code === 'sticker-count')).toBe(true);

    const wrongCounts = createSolvedCubeState();
    wrongCounts.F[0] = 'red';
    const countResult = validateCube(wrongCounts);
    expect(countResult.issues.some((entry) => entry.code === 'color-count')).toBe(true);
  });

  it('rejects incorrect centers', () => {
    const cube = createSolvedCubeState();
    cube.U[4] = 'yellow';
    expect(validateCube(cube).issues.some((entry) => entry.code === 'center')).toBe(true);
  });

  it('rejects duplicated corner pieces', () => {
    const cube = createSolvedCubeState();
    const first = CORNERS[0].map(([face, index]) => sticker(cube, face, index));
    setPieceColors(cube, CORNERS[1], [first[2], first[0], first[1]]);
    expect(validateCube(cube).issues.some((entry) => entry.code === 'duplicate-corner')).toBe(true);
  });

  it('rejects duplicated edge pieces', () => {
    const cube = createSolvedCubeState();
    const first = EDGES[0].map(([face, index]) => sticker(cube, face, index));
    setPieceColors(cube, EDGES[1], [first[1], first[0]]);
    expect(validateCube(cube).issues.some((entry) => entry.code === 'duplicate-edge')).toBe(true);
  });

  it('rejects an impossible corner color combination', () => {
    const cube = createSolvedCubeState();
    const [first, second] = CORNERS[0];
    [cube[first[0]][first[1]], cube[second[0]][second[1]]] =
      [cube[second[0]][second[1]], cube[first[0]][first[1]]];
    expect(validateCube(cube).issues.some((entry) => entry.code === 'invalid-corner')).toBe(true);
  });

  it('rejects an impossible edge color combination', () => {
    const cube = createSolvedCubeState();
    const [, second] = EDGES[0];
    const donor = EDGES[5][0];
    [cube[second[0]][second[1]], cube[donor[0]][donor[1]]] =
      [cube[donor[0]][donor[1]], cube[second[0]][second[1]]];
    expect(validateCube(cube).issues.some((entry) => entry.code === 'invalid-edge')).toBe(true);
  });

  it('rejects a single twisted corner', () => {
    const cube = createSolvedCubeState();
    const [first, second, third] = CORNERS[0];
    const colors = [cube[first[0]][first[1]], cube[second[0]][second[1]], cube[third[0]][third[1]]];
    [first, second, third].forEach(([face, index], slot) => {
      cube[face][index] = colors[(slot + 1) % 3];
    });
    expect(validateCube(cube).issues.some((entry) => entry.code === 'corner-twist')).toBe(true);
  });

  it('rejects a single flipped edge', () => {
    const cube = createSolvedCubeState();
    const [first, second] = EDGES[0];
    [cube[first[0]][first[1]], cube[second[0]][second[1]]] =
      [cube[second[0]][second[1]], cube[first[0]][first[1]]];
    expect(validateCube(cube).issues.some((entry) => entry.code === 'edge-flip')).toBe(true);
  });

  it('rejects corner and edge permutation parity mismatch', () => {
    const cube = createSolvedCubeState();
    const firstCorner = CORNERS[0].map(([face, index]) => sticker(cube, face, index));
    const secondCorner = CORNERS[1].map(([face, index]) => sticker(cube, face, index));
    setPieceColors(cube, CORNERS[0], secondCorner);
    setPieceColors(cube, CORNERS[1], firstCorner);
    expect(validateCube(cube).issues.some((entry) => entry.code === 'parity')).toBe(true);
  });
});
