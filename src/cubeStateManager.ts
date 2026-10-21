import {
  CENTER_COLORS,
  FACES,
  createEmptyCubeState,
  type CubeState,
  type Face,
} from './cubeState';

export type CubeMove = Face | `${Face}'` | `${Face}2`;

export interface CubeHistoryState {
  past: CubeState[];
  present: CubeState;
  future: CubeState[];
}

export type CubeHistoryAction =
  | { type: 'replace'; cube: CubeState }
  | { type: 'move'; move: CubeMove }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'restore'; cube: CubeState };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageResult =
  | { ok: true }
  | { ok: false; message: string };

export interface LoadedCube {
  cube: CubeState;
  message: string | null;
  saved: boolean;
}

export const CUBE_STORAGE_KEY = 'cubely.cube-state.v1';
const HISTORY_LIMIT = 50;
const COLOR_VALUES = new Set([
  'white',
  'yellow',
  'green',
  'blue',
  'orange',
  'red',
]);
const FACE_NORMALS: Record<Face, Vector> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  L: [-1, 0, 0],
  R: [1, 0, 0],
};

type Vector = [number, number, number];

interface FaceletPosition {
  face: Face;
  index: number;
  position: Vector;
  normal: Vector;
}

function descriptor(face: Face, index: number): FaceletPosition {
  const row = Math.floor(index / 3);
  const column = index % 3;
  let position: Vector;

  switch (face) {
    case 'U': position = [column - 1, 1, row - 1]; break;
    case 'D': position = [column - 1, -1, 1 - row]; break;
    case 'F': position = [column - 1, 1 - row, 1]; break;
    case 'B': position = [1 - column, 1 - row, -1]; break;
    case 'L': position = [-1, 1 - row, column - 1]; break;
    case 'R': position = [1, 1 - row, 1 - column]; break;
  }

  return { face, index, position, normal: FACE_NORMALS[face] };
}

function positionToIndex(face: Face, position: Vector): number {
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

function resolveFace(normal: Vector): Face {
  const face = FACES.find((candidate) =>
    FACE_NORMALS[candidate].every((coordinate, axis) => coordinate === normal[axis]),
  );
  if (!face) throw new Error('Cube turn produced an invalid face orientation.');
  return face;
}

export function applyCubeMove(cube: CubeState, move: CubeMove): CubeState {
  const face = move[0] as Face;
  const suffix = move.slice(1);
  const turns = suffix === '2' ? 2 : suffix === "'" ? 3 : 1;
  const axis = FACE_NORMALS[face];
  let current = cube;

  for (let turn = 0; turn < turns; turn += 1) {
    const next = Object.fromEntries(
      FACES.map((currentFace) => [currentFace, [...current[currentFace]]]),
    ) as CubeState;

    for (const currentFace of FACES) {
      for (let index = 0; index < 9; index += 1) {
        const source = descriptor(currentFace, index);
        const layer = source.position[0] * axis[0]
          + source.position[1] * axis[1]
          + source.position[2] * axis[2];
        if (layer !== 1) continue;

        const targetFace = resolveFace(rotateClockwise(source.normal, axis));
        const targetPosition = rotateClockwise(source.position, axis);
        const targetIndex = positionToIndex(targetFace, targetPosition);
        next[targetFace][targetIndex] = current[currentFace][index];
      }
    }
    current = next;
  }

  return current;
}

export function createCubeHistory(cube: CubeState = createEmptyCubeState()): CubeHistoryState {
  return { past: [], present: cube, future: [] };
}

export function cubeHistoryReducer(
  state: CubeHistoryState,
  action: CubeHistoryAction,
): CubeHistoryState {
  switch (action.type) {
    case 'replace':
    case 'move': {
      const present = action.type === 'replace'
        ? action.cube
        : applyCubeMove(state.present, action.move);
      if (areCubeStatesEqual(state.present, present)) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present,
        future: [],
      };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: state.future[0],
        future: state.future.slice(1),
      };
    }
    case 'restore':
      return createCubeHistory(action.cube);
  }
}

export function areCubeStatesEqual(first: CubeState, second: CubeState): boolean {
  return FACES.every((face) =>
    first[face].length === second[face].length
    && first[face].every((sticker, index) => sticker === second[face][index]),
  );
}

export function isRestorableCube(input: unknown): input is CubeState {
  // Partial editor states are restorable; check structure and fixed centers,
  // leaving full physical legality feedback to the cube validator.
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return false;
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== FACES.length || !FACES.every((face) => keys.includes(face))) return false;

  return FACES.every((face) => {
    const stickers = record[face];
    if (!Array.isArray(stickers) || stickers.length !== 9) return false;
    if (!stickers.every((sticker) => sticker === null || COLOR_VALUES.has(sticker))) return false;
    return stickers[4] === CENTER_COLORS[face];
  });
}

export function loadCube(storage: StorageLike, key = CUBE_STORAGE_KEY): LoadedCube {
  try {
    const serialized = storage.getItem(key);
    if (serialized === null) {
      return { cube: createEmptyCubeState(), message: null, saved: false };
    }
    const parsed: unknown = JSON.parse(serialized);
    if (!isRestorableCube(parsed)) {
      return {
        cube: createEmptyCubeState(),
        message: 'Saved cube data was invalid, so a fresh cube was loaded.',
        saved: false,
      };
    }
    return { cube: parsed, message: null, saved: true };
  } catch {
    return {
      cube: createEmptyCubeState(),
      message: 'Saved cube data could not be read, so a fresh cube was loaded.',
      saved: false,
    };
  }
}

export function saveCube(
  storage: StorageLike,
  cube: CubeState,
  key = CUBE_STORAGE_KEY,
): StorageResult {
  try {
    storage.setItem(key, JSON.stringify(cube));
    return { ok: true };
  } catch {
    return { ok: false, message: 'Cube could not be saved. Check browser storage settings.' };
  }
}

export function removeSavedCube(
  storage: StorageLike,
  key = CUBE_STORAGE_KEY,
): StorageResult {
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Saved cube data could not be removed.' };
  }
}
