import { describe, expect, it } from 'vitest';
import { createSolvedCubeState } from '../src/cubeState';
import { applyCubeMove } from '../src/cubeStateManager';
import { DEFAULT_SCRAMBLE_LENGTH, generateScramble } from '../src/cubeScramble';
import { validateCube } from '../src/cubeValidation';

describe('cube scramble generation', () => {
  it('generates standard notation with the default length and no repeated adjacent face', () => {
    const moves = generateScramble();
    expect(moves).toHaveLength(DEFAULT_SCRAMBLE_LENGTH);
    expect(moves.every((move) => /^[UDLRFB](?:2|')?$/.test(move))).toBe(true);
    expect(moves.every((move, index) => index === 0 || move[0] !== moves[index - 1][0])).toBe(true);
  });

  it('applies generated moves to a solved cube to make a physically legal state', () => {
    const moves = generateScramble(Math.random, 25);
    const cube = moves.reduce(applyCubeMove, createSolvedCubeState());
    expect(validateCube(cube).valid).toBe(true);
  });

  it('supports deterministic random sources and requested lengths', () => {
    const values = [0, 0, 0.99, 0.5, 0.3, 0.75, 0.2, 0.1];
    let index = 0;
    const moves = generateScramble(() => values[index++ % values.length], 5);
    expect(moves).toHaveLength(5);
    expect(moves.every((move, moveIndex) =>
      moveIndex === 0 || move[0] !== moves[moveIndex - 1][0],
    )).toBe(true);
  });

  it('rejects invalid lengths and random source values', () => {
    expect(() => generateScramble(Math.random, 0)).toThrow(RangeError);
    expect(() => generateScramble(Math.random, 1.5)).toThrow(RangeError);
    expect(() => generateScramble(() => 1, 1)).toThrow(RangeError);
    expect(() => generateScramble(() => Number.NaN, 1)).toThrow(RangeError);
  });
});
