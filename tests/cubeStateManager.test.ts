import { describe, expect, it } from 'vitest';
import {
  createEmptyCubeState,
  createSolvedCubeState,
  setSticker,
  type CubeState,
  type Face,
} from '../src/cubeState';
import { mapCubeStateToCubelets } from '../src/cube3d';
import {
  CUBE_STORAGE_KEY,
  applyCubeMove,
  createCubeHistory,
  cubeHistoryReducer,
  isRestorableCube,
  loadCube,
  removeSavedCube,
  saveCube,
  type CubeMove,
  type StorageLike,
} from '../src/cubeStateManager';
import { validateCube } from '../src/cubeValidation';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  failReads = false;
  failWrites = false;
  failRemoves = false;

  getItem(key: string): string | null {
    if (this.failReads) throw new Error('read failed');
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('write failed');
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    if (this.failRemoves) throw new Error('remove failed');
    this.values.delete(key);
  }
}

function makeEditedCube(): CubeState {
  return setSticker(createEmptyCubeState(), 'F', 0, 'red');
}

function faceSticker(cube: CubeState, face: Face, index: number) {
  return mapCubeStateToCubelets(cube).flatMap((cubelet) => cubelet.stickers)
    .find((sticker) => sticker.face === face && sticker.index === index);
}

describe('cube history', () => {
  it('undoes and redoes sticker edits', () => {
    const original = createEmptyCubeState();
    const edited = makeEditedCube();
    const afterEdit = cubeHistoryReducer(createCubeHistory(original), { type: 'replace', cube: edited });

    const undone = cubeHistoryReducer(afterEdit, { type: 'undo' });
    expect(undone.present).toEqual(original);
    expect(undone.future).toEqual([edited]);

    const redone = cubeHistoryReducer(undone, { type: 'redo' });
    expect(redone.present).toEqual(edited);
    expect(redone.future).toEqual([]);
  });

  it('supports undo and redo for face moves and clears the redo branch after a new edit', () => {
    const solved = createSolvedCubeState();
    const turned = applyCubeMove(solved, 'R');
    const afterMove = cubeHistoryReducer(createCubeHistory(solved), { type: 'move', move: 'R' });
    expect(afterMove.present).toEqual(turned);

    const undone = cubeHistoryReducer(afterMove, { type: 'undo' });
    expect(undone.present).toEqual(solved);
    expect(cubeHistoryReducer(undone, { type: 'redo' }).present).toEqual(turned);

    const branched = cubeHistoryReducer(undone, {
      type: 'replace',
      cube: setSticker(solved, 'F', 0, 'red'),
    });
    expect(branched.future).toEqual([]);
    expect(cubeHistoryReducer(branched, { type: 'redo' })).toBe(branched);
  });

  it('performs standard clockwise, inverse, and half turns while retaining legal centers', () => {
    const solved = createSolvedCubeState();
    const faces: Face[] = ['U', 'D', 'F', 'B', 'L', 'R'];
    for (const face of faces) {
      expect(applyCubeMove(applyCubeMove(solved, face), `${face}'` as CubeMove)).toEqual(solved);
      expect(applyCubeMove(applyCubeMove(solved, `${face}2` as CubeMove), `${face}2` as CubeMove)).toEqual(solved);
      expect(applyCubeMove(
        applyCubeMove(applyCubeMove(solved, face), face),
        face,
      )).toEqual(applyCubeMove(solved, `${face}'` as CubeMove));
    }

    const scramble: CubeMove[] = ['R', 'U', "F'", 'L2', 'D', "B'"];
    const scrambled = scramble.reduce(
      (cube, move) => applyCubeMove(cube, move),
      solved,
    );
    expect(validateCube(scrambled).valid).toBe(true);
  });

  it('records reset as a reversible state change', () => {
    const edited = makeEditedCube();
    const reset = createEmptyCubeState();
    const afterReset = cubeHistoryReducer(createCubeHistory(edited), { type: 'replace', cube: reset });
    expect(afterReset.present).toEqual(reset);
    expect(cubeHistoryReducer(afterReset, { type: 'undo' }).present).toEqual(edited);
    expect(cubeHistoryReducer(afterReset, { type: 'redo' }).present).toEqual(reset);
  });

  it('keeps mapped preview stickers synchronized after undo and redo', () => {
    const original = createEmptyCubeState();
    const edited = makeEditedCube();
    const afterEdit = cubeHistoryReducer(createCubeHistory(original), { type: 'replace', cube: edited });
    expect(faceSticker(afterEdit.present, 'F', 0)?.color).toBe('red');

    const undone = cubeHistoryReducer(afterEdit, { type: 'undo' });
    expect(faceSticker(undone.present, 'F', 0)?.color).toBeNull();

    const redone = cubeHistoryReducer(undone, { type: 'redo' });
    expect(faceSticker(redone.present, 'F', 0)?.color).toBe('red');
  });

  it('keeps the preview synchronized after a turn and its undo', () => {
    const solved = createSolvedCubeState();
    const turned = cubeHistoryReducer(createCubeHistory(solved), { type: 'move', move: 'R' });
    expect(mapCubeStateToCubelets(turned.present)).toHaveLength(27);
    expect(turned.present).toEqual(applyCubeMove(solved, 'R'));

    const undone = cubeHistoryReducer(turned, { type: 'undo' });
    expect(undone.present).toEqual(solved);
  });
});

describe('cube persistence', () => {
  it('saves and restores an edited cube', () => {
    const storage = new MemoryStorage();
    const cube = makeEditedCube();
    expect(saveCube(storage, cube)).toEqual({ ok: true });
    expect(storage.values.has(CUBE_STORAGE_KEY)).toBe(true);
    expect(loadCube(storage).cube).toEqual(cube);
  });

  it('starts with a fresh cube when saved JSON is corrupted', () => {
    const storage = new MemoryStorage();
    storage.values.set(CUBE_STORAGE_KEY, '{not json');
    const loaded = loadCube(storage);
    expect(loaded.cube).toEqual(createEmptyCubeState());
    expect(loaded.message).toMatch(/could not be read/);
  });

  it('rejects structurally invalid saved states without using them', () => {
    const storage = new MemoryStorage();
    storage.values.set(CUBE_STORAGE_KEY, JSON.stringify({ ...makeEditedCube(), extra: [] }));
    const loaded = loadCube(storage);
    expect(loaded.cube).toEqual(createEmptyCubeState());
    expect(loaded.message).toMatch(/invalid/);
    expect(isRestorableCube({ ...makeEditedCube(), extra: [] })).toBe(false);
  });

  it('rejects malformed stickers, incorrect face lengths, and changed centers', () => {
    const valid = createEmptyCubeState();
    expect(isRestorableCube(valid)).toBe(true);

    const wrongColor: unknown = {
      ...valid,
      F: [...valid.F.slice(0, 4), 'purple', ...valid.F.slice(5)],
    };
    expect(isRestorableCube(wrongColor)).toBe(false);

    const wrongLength = structuredClone(valid);
    wrongLength.B.pop();
    expect(isRestorableCube(wrongLength)).toBe(false);

    const wrongCenter = structuredClone(valid);
    wrongCenter.U[4] = 'yellow';
    expect(isRestorableCube(wrongCenter)).toBe(false);
  });

  it('removes saved data when requested', () => {
    const storage = new MemoryStorage();
    saveCube(storage, makeEditedCube());
    expect(removeSavedCube(storage)).toEqual({ ok: true });
    expect(loadCube(storage).cube).toEqual(createEmptyCubeState());
  });

  it('reports storage read, write, and removal failures', () => {
    const storage = new MemoryStorage();
    storage.failReads = true;
    expect(loadCube(storage).message).toMatch(/could not be read/);

    storage.failReads = false;
    storage.failWrites = true;
    expect(saveCube(storage, makeEditedCube())).toMatchObject({ ok: false });

    storage.failWrites = false;
    storage.failRemoves = true;
    expect(removeSavedCube(storage)).toMatchObject({ ok: false });
  });
});
