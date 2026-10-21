import type { Face } from './cubeState';
import type { CubeMove } from './cubeStateManager';

const FACE_NAMES: Record<Face, string> = {
  U: 'top',
  D: 'bottom',
  F: 'front',
  B: 'back',
  L: 'left',
  R: 'right',
};

export interface MoveExplanation {
  notation: CubeMove;
  faceName: string;
  turnAmount: string;
  turnDirection: 'clockwise' | 'counterclockwise' | 'half-turn';
  direction: string;
  instruction: string;
}

export function explainCubeMove(move: CubeMove): MoveExplanation {
  const faceName = FACE_NAMES[move[0] as Face];
  const isHalfTurn = move.endsWith('2');
  const isCounterClockwise = move.endsWith("'");
  const turnDirection = isHalfTurn
    ? 'half-turn'
    : isCounterClockwise ? 'counterclockwise' : 'clockwise';
  const turnAmount = isHalfTurn ? 'a half-turn (180°)' : 'a quarter-turn (90°)';
  const direction = isHalfTurn
    ? 'Direction does not matter for a half-turn.'
    : `Turn ${isCounterClockwise ? 'counterclockwise' : 'clockwise'} when looking directly at the ${faceName} face from outside the cube.`;

  return {
    notation: move,
    faceName,
    turnAmount,
    turnDirection,
    direction,
    instruction: `Turn the ${faceName} layer ${turnAmount}. ${direction} Keep the rest of the cube in place.`,
  };
}

export function clampExplanationIndex(index: number, totalMoves: number): number {
  if (totalMoves <= 0 || !Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(totalMoves - 1, Math.trunc(index)));
}
