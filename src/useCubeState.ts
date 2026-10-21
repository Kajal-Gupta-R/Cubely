import { useReducer, useState } from 'react';
import {
  CUBE_STORAGE_KEY,
  createCubeHistory,
  cubeHistoryReducer,
  loadCube,
  removeSavedCube,
  saveCube,
  type CubeHistoryState,
  type CubeMove,
} from './cubeStateManager';
import type { CubeState } from './cubeState';

function getInitialHistory(): {
  history: CubeHistoryState;
  message: string | null;
  saved: boolean;
} {
  if (typeof window === 'undefined') {
    return { history: createCubeHistory(), message: null, saved: false };
  }
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return {
      history: createCubeHistory(),
      message: 'Browser storage is unavailable; cube changes will not persist.',
      saved: false,
    };
  }
  const loaded = loadCube(storage);
  return {
    history: createCubeHistory(loaded.cube),
    message: loaded.message,
    saved: loaded.saved,
  };
}

export function useCubeState() {
  const [initial] = useState(getInitialHistory);
  const [history, dispatch] = useReducer(cubeHistoryReducer, initial.history);
  const [storageMessage, setStorageMessage] = useState<string | null>(initial.message);
  const [saved, setSaved] = useState(initial.saved);

  function persistCube(cube: CubeState): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const result = saveCube(window.localStorage, cube, CUBE_STORAGE_KEY);
      setSaved(result.ok);
      setStorageMessage(result.ok ? null : result.message);
      return result.ok;
    } catch {
      setSaved(false);
      setStorageMessage('Browser storage is unavailable; cube changes will not persist.');
      return false;
    }
  }

  function updateHistory(action: Parameters<typeof cubeHistoryReducer>[1]): CubeState {
    const next = cubeHistoryReducer(history, action);
    dispatch(action);
    if (next !== history) persistCube(next.present);
    return next.present;
  }

  function saveCurrentCube() {
    if (typeof window === 'undefined') return;
    if (persistCube(history.present)) {
      setStorageMessage('Cube saved in this browser.');
    }
  }

  function restoreSavedCube() {
    if (typeof window === 'undefined') return;
    try {
      const loaded = loadCube(window.localStorage, CUBE_STORAGE_KEY);
      setStorageMessage(loaded.message ?? 'Saved cube restored.');
      if (loaded.message === null) {
        dispatch({ type: 'restore', cube: loaded.cube });
        setSaved(loaded.saved);
      }
    } catch {
      setStorageMessage('Browser storage is unavailable; saved cube could not be restored.');
    }
  }

  function clearSavedCube() {
    if (typeof window === 'undefined') return;
    try {
      const result = removeSavedCube(window.localStorage, CUBE_STORAGE_KEY);
      if (result.ok) setSaved(false);
      setStorageMessage(result.ok ? 'Saved cube data removed.' : result.message);
    } catch {
      setStorageMessage('Browser storage is unavailable; saved cube data could not be removed.');
    }
  }

  return {
    cube: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: () => updateHistory({ type: 'undo' }),
    redo: () => updateHistory({ type: 'redo' }),
    updateCube: (cube: CubeState) => updateHistory({ type: 'replace', cube }),
    applyMove: (move: CubeMove) => updateHistory({ type: 'move', move }),
    applyScramble: (moves: readonly CubeMove[]) => updateHistory({ type: 'scramble', moves }),
    saveCurrentCube,
    restoreSavedCube,
    clearSavedCube,
    storageMessage,
    saved,
  };
}
