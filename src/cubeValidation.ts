import {
  CENTER_COLORS,
  FACES,
  type CubeState,
  type Face,
  type StickerColor,
} from './cubeState';

export type ValidationCode =
  | 'shape'
  | 'sticker-count'
  | 'color-count'
  | 'center'
  | 'invalid-corner'
  | 'duplicate-corner'
  | 'corner-twist'
  | 'invalid-edge'
  | 'duplicate-edge'
  | 'edge-flip'
  | 'parity';

export interface ValidationIssue {
  code: ValidationCode;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const COLOR_SET = new Set<StickerColor>([
  'white',
  'yellow',
  'green',
  'blue',
  'orange',
  'red',
]);
const FACE_ORDER: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];

// Face grids are viewed directly from outside. Indices are row-major.
// These standard facelet positions use Kociemba's U, R, F, D, L, B ordering.
const CORNER_FACELETS = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
] as const;
const EDGE_FACELETS = [
  [5, 10], [7, 19], [3, 37], [1, 46],
  [32, 16], [28, 25], [30, 43], [34, 52],
  [23, 12], [21, 41], [50, 39], [48, 14],
] as const;

function issue(code: ValidationCode, message: string): ValidationIssue {
  return { code, message };
}

function permutationParity(permutation: number[]): number {
  let parity = 0;
  for (let first = 0; first < permutation.length; first += 1) {
    for (let second = first + 1; second < permutation.length; second += 1) {
      if (permutation[first] > permutation[second]) parity ^= 1;
    }
  }
  return parity;
}

export function validateCube(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      valid: false,
      issues: [issue('shape', 'Cube data must contain six face arrays.')],
    };
  }

  const cube = input as Partial<Record<Face, unknown>>;
  const suppliedFaces = Object.keys(input);
  let shapeIsValid = suppliedFaces.length === FACES.length
    && suppliedFaces.every((face) => FACES.includes(face as Face));
  let stickerTotal = 0;
  let hasMissingOrUnknownSticker = false;
  const colorCounts = new Map<StickerColor, number>(
    [...COLOR_SET].map((color) => [color, 0]),
  );

  for (const face of FACES) {
    const stickers = cube[face];
    if (!Array.isArray(stickers) || stickers.length !== 9) {
      shapeIsValid = false;
      continue;
    }

    stickerTotal += stickers.length;
    for (const sticker of stickers) {
      if (typeof sticker === 'string' && COLOR_SET.has(sticker as StickerColor)) {
        const color = sticker as StickerColor;
        colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
      } else {
        hasMissingOrUnknownSticker = true;
      }
    }
  }

  if (!shapeIsValid) {
    issues.push(issue('shape', 'Each face must contain exactly nine stickers.'));
  }
  if (stickerTotal !== 54) {
    issues.push(issue('sticker-count', 'A 3×3 cube must contain exactly 54 stickers.'));
  }
  if (hasMissingOrUnknownSticker) {
    issues.push(issue('sticker-count', 'Fill every sticker using one of the six standard colors.'));
  }
  if (!shapeIsValid || stickerTotal !== 54 || hasMissingOrUnknownSticker) {
    return { valid: false, issues };
  }

  for (const color of COLOR_SET) {
    if (colorCounts.get(color) !== 9) {
      issues.push(issue('color-count', `Use exactly nine ${color} stickers.`));
    }
  }
  for (const face of FACES) {
    const stickers = cube[face] as unknown[];
    if (stickers[4] !== CENTER_COLORS[face]) {
      issues.push(issue(
        'center',
        `${face} (${faceName(face)}) center must be ${CENTER_COLORS[face]}.`,
      ));
    }
  }
  if (issues.some((entry) => entry.code === 'center')) {
    return { valid: false, issues };
  }

  const state = cube as CubeState;
  const facelets = FACE_ORDER.flatMap((face) => state[face]);
  const solvedFacelets = FACE_ORDER.flatMap((face) =>
    Array<string>(9).fill(CENTER_COLORS[face]),
  );
  const solvedCorners = CORNER_FACELETS.map((position) =>
    position.map((index) => solvedFacelets[index]),
  );
  const solvedEdges = EDGE_FACELETS.map((position) =>
    position.map((index) => solvedFacelets[index]),
  );

  const cornerPermutation: number[] = [];
  let cornerTwist = 0;
  for (const position of CORNER_FACELETS) {
    const colors = position.map((index) => facelets[index]);
    let cubie = -1;
    let orientation = -1;
    for (let candidate = 0; candidate < solvedCorners.length && cubie === -1; candidate += 1) {
      for (let rotation = 0; rotation < 3; rotation += 1) {
        if (colors.every(
          (color, index) => color === solvedCorners[candidate][(index + rotation) % 3],
        )) {
          cubie = candidate;
          orientation = rotation;
          break;
        }
      }
    }
    if (cubie === -1) {
      issues.push(issue('invalid-corner', 'A corner has colors that cannot belong together. Check the entered face colors.'));
      continue;
    }
    cornerPermutation.push(cubie);
    cornerTwist += orientation;
  }

  if (cornerPermutation.length === CORNER_FACELETS.length) {
    if (new Set(cornerPermutation).size !== CORNER_FACELETS.length) {
      issues.push(issue('duplicate-corner', 'A corner piece appears more than once. Recheck the three stickers at each corner.'));
    }
    if (cornerTwist % 3 !== 0) {
      issues.push(issue('corner-twist', 'One or more corners are twisted. A legal cube must have a total corner twist divisible by three.'));
    }
  }

  const edgePermutation: number[] = [];
  let edgeFlip = 0;
  for (const position of EDGE_FACELETS) {
    const colors = position.map((index) => facelets[index]);
    let cubie = -1;
    let orientation = -1;
    for (let candidate = 0; candidate < solvedEdges.length && cubie === -1; candidate += 1) {
      if (colors[0] === solvedEdges[candidate][0] && colors[1] === solvedEdges[candidate][1]) {
        cubie = candidate;
        orientation = 0;
      } else if (
        colors[0] === solvedEdges[candidate][1]
        && colors[1] === solvedEdges[candidate][0]
      ) {
        cubie = candidate;
        orientation = 1;
      }
    }
    if (cubie === -1) {
      issues.push(issue('invalid-edge', 'An edge has colors that cannot belong together. Check the entered face colors.'));
      continue;
    }
    edgePermutation.push(cubie);
    edgeFlip += orientation;
  }

  if (edgePermutation.length === EDGE_FACELETS.length) {
    if (new Set(edgePermutation).size !== EDGE_FACELETS.length) {
      issues.push(issue('duplicate-edge', 'An edge piece appears more than once. Recheck the two stickers at each edge.'));
    }
    if (edgeFlip % 2 !== 0) {
      issues.push(issue('edge-flip', 'A single edge appears flipped. A legal cube must have an even number of flipped edges.'));
    }
  }

  if (
    cornerPermutation.length === CORNER_FACELETS.length
    && edgePermutation.length === EDGE_FACELETS.length
    && permutationParity(cornerPermutation) !== permutationParity(edgePermutation)
  ) {
    issues.push(issue('parity', 'The corner and edge swaps do not match. This arrangement cannot be reached with legal turns.'));
  }

  return { valid: issues.length === 0, issues };
}

function faceName(face: Face): string {
  return {
    U: 'Up',
    D: 'Down',
    F: 'Front',
    B: 'Back',
    L: 'Left',
    R: 'Right',
  }[face];
}
