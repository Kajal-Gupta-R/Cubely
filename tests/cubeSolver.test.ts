import { describe, expect, it } from 'vitest';
import { cube3x3x3 } from 'cubing/puzzles';
import {
  createSolvedCubeState,
  type Face,
} from '../src/cubeState';
import { applyCubeMove, type CubeMove } from '../src/cubeStateManager';
import {
  cubeStateToKPatternData,
  solveCube,
  withSolveTimeout,
} from '../src/cubeSolver';

describe('cube solver mapping', () => {
  it('maps each face turn and standard suffix to the cubing.js pattern convention', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = createSolvedCubeState();
    const moves: CubeMove[] = [];
    for (const face of ['U', 'D', 'F', 'B', 'L', 'R'] satisfies Face[]) {
      moves.push(face, `${face}'`, `${face}2`);
    }

    for (const move of moves) {
      const cube = applyCubeMove(solved, move);
      const mapped = cubeStateToKPatternData(cube, kpuzzle.defaultPattern().patternData);
      const expected = kpuzzle.defaultPattern().applyMove(move).patternData;
      expect([mapped.CORNERS, mapped.EDGES], `mapping mismatch for ${move}`).toEqual([
        expected.CORNERS,
        expected.EDGES,
      ]);
    }
  });

  it('maps a longer legal scramble to the same pattern as cubing.js', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const moves: CubeMove[] = ['R', 'U', "F'", 'L2', 'D', "B'"];
    const cube = moves.reduce(applyCubeMove, createSolvedCubeState());
    const expected = moves.reduce(
      (pattern, move) => pattern.applyMove(move),
      kpuzzle.defaultPattern(),
    );

    const mapped = cubeStateToKPatternData(cube, kpuzzle.defaultPattern().patternData);
    expect([mapped.CORNERS, mapped.EDGES]).toEqual([
      expected.patternData.CORNERS,
      expected.patternData.EDGES,
    ]);
  });
});

describe('solveCube', () => {
  it('returns an empty solution for a solved cube', async () => {
    await expect(solveCube(createSolvedCubeState())).resolves.toEqual({ ok: true, moves: [] });
  });

  it('rejects incomplete or illegal cube states before calling the solver', async () => {
    const result = await solveCube({
      ...createSolvedCubeState(),
      F: Array(9).fill(null),
    });
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });

    const singleFlippedEdge = createSolvedCubeState();
    [singleFlippedEdge.U[5], singleFlippedEdge.R[1]] =
      [singleFlippedEdge.R[1], singleFlippedEdge.U[5]];
    await expect(solveCube(singleFlippedEdge)).resolves.toMatchObject({
      ok: false,
      reason: 'invalid',
    });
  });

  it('solves and independently replays a legal scramble using standard face moves', async () => {
    const scramble: CubeMove[] = ['R', 'U', "F'", 'L2', 'D', "B'"];
    const cube = scramble.reduce(applyCubeMove, createSolvedCubeState());
    const result = await solveCube(cube, 60_000);

    if (!result.ok) throw new Error(result.message);
    expect(result.ok).toBe(true);
    expect(result.moves.length).toBeGreaterThan(0);
    expect(result.moves.every((move) => /^[URFDLB](?:2|')?$/.test(move))).toBe(true);
    expect(result.moves.reduce(applyCubeMove, cube)).toEqual(createSolvedCubeState());
  });

  it('reports a timeout rather than returning an unverified result', async () => {
    await expect(withSolveTimeout(new Promise<never>(() => {}), 1))
      .rejects.toThrow('CUBE_SOLVE_TIMEOUT');
  });
});
