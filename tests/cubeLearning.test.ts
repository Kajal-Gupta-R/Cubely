import { describe, expect, it } from 'vitest';
import { clampExplanationIndex, explainCubeMove } from '../src/cubeLearning';
import type { CubeMove } from '../src/cubeStateManager';

describe('beginner move explanations', () => {
  it.each([
    ['U', 'top'],
    ['D', 'bottom'],
    ['F', 'front'],
    ['B', 'back'],
    ['L', 'left'],
    ['R', 'right'],
  ] satisfies [CubeMove, string][])(
    'explains each notation form for the %s (%s) face',
    (face, faceName) => {
      const moves: [CubeMove, string][] = [
        [face, 'clockwise'],
        [`${face}'` as CubeMove, 'counterclockwise'],
        [`${face}2` as CubeMove, 'half-turn'],
      ];
      for (const [move, description] of moves) {
        const explanation = explainCubeMove(move);
        expect(explanation.notation).toBe(move);
        expect(explanation.faceName).toBe(faceName);
        expect(explanation.instruction.toLowerCase()).toContain(description);
      }
    },
  );

  it('explains a half turn without assigning a misleading direction', () => {
    const explanation = explainCubeMove('R2');
    expect(explanation.instruction).toContain('180°');
    expect(explanation.instruction).toContain('Direction does not matter');
    expect(explanation.instruction).not.toContain('Turn clockwise');
  });

  it('keeps explanation navigation within the actual solution moves', () => {
    expect(clampExplanationIndex(-1, 3)).toBe(0);
    expect(clampExplanationIndex(1, 3)).toBe(1);
    expect(clampExplanationIndex(5, 3)).toBe(2);
    expect(clampExplanationIndex(2, 0)).toBe(0);
  });
});
