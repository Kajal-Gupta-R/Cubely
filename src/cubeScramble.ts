import { FACES, type Face } from './cubeState';
import type { CubeMove } from './cubeStateManager';

export const DEFAULT_SCRAMBLE_LENGTH = 25;

export function generateScramble(
  random: () => number = Math.random,
  length = DEFAULT_SCRAMBLE_LENGTH,
): CubeMove[] {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError('Scramble length must be a positive integer.');
  }

  const moves: CubeMove[] = [];
  let previousFace: Face | null = null;

  while (moves.length < length) {
    const eligibleFaces = FACES.filter((face) => face !== previousFace);
    const face = eligibleFaces[randomIndex(random, eligibleFaces.length)];
    const suffixes = ['', "'", '2'] as const;
    const suffix = suffixes[randomIndex(random, suffixes.length)];
    moves.push(`${face}${suffix}` as CubeMove);
    previousFace = face;
  }

  return moves;
}

function randomIndex(random: () => number, length: number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('Random source must return a value in the range [0, 1).');
  }
  return Math.floor(value * length);
}
