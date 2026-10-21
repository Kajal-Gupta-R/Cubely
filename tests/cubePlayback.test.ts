import { describe, expect, it } from 'vitest';
import {
  COLORS,
  FACES,
  createSolvedCubeState,
  type CubeState,
  type Face,
} from '../src/cubeState';
import { applyCubeMove, type CubeMove } from '../src/cubeStateManager';
import { getCubeMoveRotation } from '../src/cube3d';
import {
  cubeAtPlaybackCursor,
  createPlaybackState,
  invertCubeMove,
  isCubeSolved,
  playbackReducer,
  replayPlaybackMoves,
} from '../src/cubePlayback';

type Vector = [number, number, number];

function faceletDescriptor(face: Face, index: number): { position: Vector; normal: Vector } {
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

function rotateVector(vector: Vector, axis: Vector, angle: number): Vector {
  const cross: Vector = [
    axis[1] * vector[2] - axis[2] * vector[1],
    axis[2] * vector[0] - axis[0] * vector[2],
    axis[0] * vector[1] - axis[1] * vector[0],
  ];
  const dot = axis[0] * vector[0] + axis[1] * vector[1] + axis[2] * vector[2];
  return vector.map((coordinate, index) => Math.round(
    coordinate * Math.cos(angle)
      + cross[index] * Math.sin(angle)
      + axis[index] * dot * (1 - Math.cos(angle)),
  )) as Vector;
}

function locateFacelet(position: Vector, normal: Vector): [Face, number] {
  for (const face of FACES) {
    for (let index = 0; index < 9; index += 1) {
      const descriptor = faceletDescriptor(face, index);
      if (
        descriptor.position.every((coordinate, axis) => coordinate === position[axis])
        && descriptor.normal.every((coordinate, axis) => coordinate === normal[axis])
      ) return [face, index];
    }
  }
  throw new Error('Rotated sticker does not map to a cube facelet.');
}

function makeDistinctiveCube(): CubeState {
  const cube = createSolvedCubeState();
  FACES.forEach((face, faceIndex) => {
    cube[face] = cube[face].map((_, index) =>
      COLORS[(faceIndex * 9 + index) % COLORS.length].color,
    );
  });
  return cube;
}

describe('3D move animation', () => {
  it('rotates each 3D face layer consistently with the cube-state move convention', () => {
    const cube = makeDistinctiveCube();
    const moves: CubeMove[] = [];
    for (const face of FACES) moves.push(face, `${face}'`, `${face}2`);

    for (const move of moves) {
      const { axis, angleRadians } = getCubeMoveRotation(move);
      const turned = applyCubeMove(cube, move);
      for (const face of FACES) {
        for (let index = 0; index < 9; index += 1) {
          const sticker = faceletDescriptor(face, index);
          const layer = sticker.position.reduce(
            (total, coordinate, dimension) => total + coordinate * axis[dimension],
            0,
          );
          const [targetFace, targetIndex] = layer === 1
            ? locateFacelet(
              rotateVector(sticker.position, [...axis], angleRadians),
              rotateVector(sticker.normal, [...axis], angleRadians),
            )
            : [face, index];
          expect(turned[targetFace][targetIndex], `${move} ${face}[${index}]`)
            .toBe(cube[face][index]);
        }
      }
    }
  });
});

describe('cube playback navigation', () => {
  const moves: CubeMove[] = ['R', 'U', "F'"];

  it('advances and reverses the cursor in order', () => {
    const initial = createPlaybackState();
    const first = playbackReducer(initial, { type: 'next', totalMoves: moves.length, solved: false });
    const second = playbackReducer(first, { type: 'next', totalMoves: moves.length, solved: false });
    const reversed = playbackReducer(second, { type: 'previous' });

    expect(first.cursor).toBe(1);
    expect(second.cursor).toBe(2);
    expect(reversed.cursor).toBe(1);
    expect(cubeAtPlaybackCursor(createSolvedCubeState(), moves, 2)).toEqual(
      applyCubeMove(applyCubeMove(createSolvedCubeState(), moves[0]), moves[1]),
    );
  });

  it('does not advance past the end or move before the start', () => {
    const initial = createPlaybackState();
    expect(playbackReducer(initial, { type: 'previous' })).toBe(initial);
    const completed = playbackReducer(initial, { type: 'next', totalMoves: 1, solved: true });
    expect(completed).toMatchObject({ cursor: 1, status: 'completed' });
    expect(playbackReducer(completed, {
      type: 'next',
      totalMoves: 1,
      solved: true,
    })).toBe(completed);
  });

  it('starts, pauses, and restarts playback without changing selected speed', () => {
    const initial = createPlaybackState();
    const playing = playbackReducer(initial, { type: 'play', totalMoves: 3 });
    const paused = playbackReducer(playing, { type: 'pause' });
    const advanced = playbackReducer(paused, { type: 'next', totalMoves: 3, solved: false });
    const restarted = playbackReducer(advanced, { type: 'restart' });

    expect(playing.status).toBe('playing');
    expect(paused.status).toBe('paused');
    expect(restarted).toMatchObject({ cursor: 0, status: 'idle', speed: initial.speed });
  });

  it('clamps playback speed to the supported range', () => {
    expect(playbackReducer(createPlaybackState(), { type: 'set-speed', speed: 0.1 }).speed).toBe(0.5);
    expect(playbackReducer(createPlaybackState(), { type: 'set-speed', speed: 5 }).speed).toBe(2);
  });

  it('plays move inverses to restore the starting cube and verifies the final state', () => {
    const start = createSolvedCubeState();
    const scramble: CubeMove[] = ['R', 'U', "F'"];
    const scrambled = replayPlaybackMoves(start, scramble);
    const solution = ["F", "U'", "R'"] satisfies CubeMove[];

    expect(isCubeSolved(replayPlaybackMoves(scrambled, solution))).toBe(true);
    expect(isCubeSolved(scrambled)).toBe(false);
    expect(invertCubeMove("F'")).toBe('F');
    expect(invertCubeMove('R2')).toBe('R2');
    const solved = replayPlaybackMoves(scrambled, solution);
    expect(replayPlaybackMoves(
      solved,
      [...solution].reverse().map(invertCubeMove),
    )).toEqual(scrambled);
  });

  it('does not mark the playback complete unless the resulting cube is solved', () => {
    const result = playbackReducer(createPlaybackState(), {
      type: 'next',
      totalMoves: 1,
      solved: false,
    });
    expect(result).toMatchObject({ cursor: 1, status: 'paused' });
  });

  it('restarts an applied solution by animating inverse moves in reverse order', () => {
    const start = createSolvedCubeState();
    const scramble: CubeMove[] = ['R', 'U', "F'"];
    const scrambled = replayPlaybackMoves(start, scramble);
    const solution: CubeMove[] = ['F', "U'", "R'"];
    const afterTwoMoves = replayPlaybackMoves(scrambled, solution.slice(0, 2));
    const restarted = [...solution.slice(0, 2)].reverse().map(invertCubeMove)
      .reduce(applyCubeMove, afterTwoMoves);

    expect(restarted).toEqual(scrambled);
    expect(playbackReducer(
      { cursor: 2, status: 'paused', speed: 1.5 },
      { type: 'restart' },
    )).toMatchObject({ cursor: 0, status: 'idle', speed: 1.5 });
  });

  it('treats an empty solution as already completed and solved only for a solved start', () => {
    const solved = createSolvedCubeState();
    expect(replayPlaybackMoves(solved, [])).toEqual(solved);
    expect(isCubeSolved(replayPlaybackMoves(solved, []))).toBe(true);
    expect(playbackReducer(createPlaybackState(), { type: 'play', totalMoves: 0 }).status).toBe('idle');
  });
});
