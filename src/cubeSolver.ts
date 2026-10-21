import type { KPatternData } from 'cubing/kpuzzle';
import {
  CENTER_COLORS,
  FACES,
  type CubeState,
  type StickerColor,
} from './cubeState';
import { applyCubeMove, type CubeMove } from './cubeStateManager';
import {
  CORNER_FACELETS,
  EDGE_FACELETS,
  FACELET_FACE_ORDER,
  validateCube,
} from './cubeValidation';

export type CubeSolveResult =
  | { ok: true; moves: CubeMove[] }
  | { ok: false; reason: 'invalid' | 'timeout' | 'solver'; message: string };

export const DEFAULT_SOLVE_TIMEOUT_MS = 30_000;

const CUBING_CORNER_TO_KOCIEMBA = [0, 3, 2, 1, 4, 5, 6, 7] as const;
const CUBING_EDGE_TO_KOCIEMBA = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10] as const;

function isSolved(cube: CubeState): boolean {
  return FACES.every((face) => cube[face].every((sticker) => sticker === CENTER_COLORS[face]));
}

export function cubeStateToKPatternData(
  cube: CubeState,
  defaultData: KPatternData,
): KPatternData {
  const facelets = FACELET_FACE_ORDER.flatMap((face) => cube[face]);
  const solvedFacelets = FACELET_FACE_ORDER.flatMap((face) =>
    Array<StickerColor>(9).fill(CENTER_COLORS[face]),
  );
  const solvedCorners = CORNER_FACELETS.map((position) =>
    position.map((index) => solvedFacelets[index]),
  );
  const solvedEdges = EDGE_FACELETS.map((position) =>
    position.map((index) => solvedFacelets[index]),
  );

  const cornerPieces: number[] = [];
  const cornerOrientations: number[] = [];
  for (const position of CORNER_FACELETS) {
    const colors = position.map((index) => facelets[index]);
    const cubie = solvedCorners.findIndex((candidate) =>
      [0, 1, 2].some((orientation) =>
        colors.every((color, index) =>
          color === candidate[(index + orientation) % 3],
        ),
      ),
    );
    if (cubie < 0) throw new Error('Cube corner could not be mapped to a solver cubie.');
    const orientation = [0, 1, 2].find((rotation) =>
      colors.every((color, index) =>
        color === solvedCorners[cubie][(index + rotation) % 3],
      ),
    );
    if (orientation === undefined) throw new Error('Cube corner orientation could not be mapped.');
    cornerPieces.push(cubie);
    cornerOrientations.push(orientation);
  }

  const edgePieces: number[] = [];
  const edgeOrientations: number[] = [];
  for (const position of EDGE_FACELETS) {
    const colors = position.map((index) => facelets[index]);
    const cubie = solvedEdges.findIndex((candidate) =>
      (colors[0] === candidate[0] && colors[1] === candidate[1])
      || (colors[0] === candidate[1] && colors[1] === candidate[0]),
    );
    if (cubie < 0) throw new Error('Cube edge could not be mapped to a solver cubie.');
    edgePieces.push(cubie);
    edgeOrientations.push(colors[0] === solvedEdges[cubie][0] ? 0 : 1);
  }

  // cubing.js uses different corner/edge orbit orders and the opposite corner twist sign.
  const kociembaCornerToCubing = CUBING_CORNER_TO_KOCIEMBA.map((_, cubingIndex) =>
    CUBING_CORNER_TO_KOCIEMBA.indexOf(cubingIndex as (typeof CUBING_CORNER_TO_KOCIEMBA)[number]),
  );
  const kociembaEdgeToCubing = CUBING_EDGE_TO_KOCIEMBA.map((_, cubingIndex) =>
    CUBING_EDGE_TO_KOCIEMBA.indexOf(cubingIndex as (typeof CUBING_EDGE_TO_KOCIEMBA)[number]),
  );
  const cubingCornerPieces = CUBING_CORNER_TO_KOCIEMBA.map((kociembaIndex) =>
    kociembaCornerToCubing[cornerPieces[kociembaIndex]],
  );
  const cubingCornerOrientations = CUBING_CORNER_TO_KOCIEMBA.map((kociembaIndex) =>
    (3 - cornerOrientations[kociembaIndex]) % 3,
  );
  const cubingEdgePieces = CUBING_EDGE_TO_KOCIEMBA.map((kociembaIndex) =>
    kociembaEdgeToCubing[edgePieces[kociembaIndex]],
  );
  const cubingEdgeOrientations = CUBING_EDGE_TO_KOCIEMBA.map((kociembaIndex) =>
    edgeOrientations[kociembaIndex],
  );

  return {
    ...defaultData,
    CORNERS: {
      ...defaultData.CORNERS,
      pieces: cubingCornerPieces,
      orientation: cubingCornerOrientations,
    },
    EDGES: {
      ...defaultData.EDGES,
      pieces: cubingEdgePieces,
      orientation: cubingEdgeOrientations,
    },
  };
}

export async function withSolveTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('CUBE_SOLVE_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function parseFaceMoves(algorithm: string): CubeMove[] {
  const moves = algorithm.trim().split(/\s+/).filter(Boolean);
  if (!moves.every((move) => /^[URFDLB](?:2|')?$/.test(move))) {
    throw new Error('The solver returned unsupported move notation.');
  }
  return moves as CubeMove[];
}

export async function solveCube(
  cube: CubeState,
  timeoutMs = DEFAULT_SOLVE_TIMEOUT_MS,
): Promise<CubeSolveResult> {
  const validation = validateCube(cube);
  if (!validation.valid) {
    return {
      ok: false,
      reason: 'invalid',
      message: validation.issues.map((entry) => entry.message).join(' '),
    };
  }
  if (isSolved(cube)) return { ok: true, moves: [] };
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { ok: false, reason: 'solver', message: 'Solver timeout must be a positive number.' };
  }

  try {
    const operation = (async () => {
      const [{ cube3x3x3 }, { experimentalSolve3x3x3IgnoringCenters }, { KPattern }] =
        await Promise.all([
          import('cubing/puzzles'),
          import('cubing/search'),
          import('cubing/kpuzzle'),
        ]);
      const kpuzzle = await cube3x3x3.kpuzzle();
      const defaultPattern = kpuzzle.defaultPattern();
      const pattern = new KPattern(
        kpuzzle,
        cubeStateToKPatternData(cube, defaultPattern.patternData),
      );
      const algorithm = await experimentalSolve3x3x3IgnoringCenters(pattern);
      const moves = parseFaceMoves(algorithm.toString());
      const result = moves.reduce((state, move) => applyCubeMove(state, move), cube);
      if (!isSolved(result)) {
        throw new Error('The solver returned moves that did not solve this cube.');
      }
      return moves;
    })();
    const moves = await withSolveTimeout(operation, timeoutMs);
    return { ok: true, moves };
  } catch (error) {
    if (error instanceof Error && error.message === 'CUBE_SOLVE_TIMEOUT') {
      return {
        ok: false,
        reason: 'timeout',
        message: `Solving exceeded the ${timeoutMs} ms time limit.`,
      };
    }
    return {
      ok: false,
      reason: 'solver',
      message: error instanceof Error ? error.message : 'An unknown solver error occurred.',
    };
  }
}
