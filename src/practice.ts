import type { StorageLike } from './cubeStateManager';

export type PracticeTimerStatus = 'idle' | 'running' | 'stopped';

export interface PracticeTimerState {
  status: PracticeTimerStatus;
  startedAt: number | null;
  elapsedMs: number;
}

export type PracticeTimerAction =
  | { type: 'start'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'stop'; now: number }
  | { type: 'reset' };

export interface PracticeAttempt {
  id: string;
  elapsedMs: number;
  completedAt: number;
}

export const PRACTICE_HISTORY_STORAGE_KEY = 'cubely.practice-history.v1';

export function createPracticeTimer(): PracticeTimerState {
  return { status: 'idle', startedAt: null, elapsedMs: 0 };
}

export function practiceTimerReducer(
  state: PracticeTimerState,
  action: PracticeTimerAction,
): PracticeTimerState {
  switch (action.type) {
    case 'start':
      if (state.status !== 'idle' || !Number.isFinite(action.now)) return state;
      return { status: 'running', startedAt: action.now, elapsedMs: 0 };
    case 'tick':
      if (state.status !== 'running' || state.startedAt === null || !Number.isFinite(action.now)) {
        return state;
      }
      return {
        ...state,
        elapsedMs: Math.max(0, action.now - state.startedAt),
      };
    case 'stop':
      if (state.status !== 'running' || state.startedAt === null || !Number.isFinite(action.now)) {
        return state;
      }
      return {
        status: 'stopped',
        startedAt: null,
        elapsedMs: Math.max(0, action.now - state.startedAt),
      };
    case 'reset':
      return createPracticeTimer();
  }
}

export function formatPracticeTime(milliseconds: number): string {
  const centiseconds = Math.floor(Math.max(0, milliseconds) / 10);
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const fraction = centiseconds % 100;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}`;
}

export function isPracticeAttempt(value: unknown): value is PracticeAttempt {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const attempt = value as Record<string, unknown>;
  return typeof attempt.id === 'string'
    && attempt.id.length > 0
    && typeof attempt.elapsedMs === 'number'
    && Number.isFinite(attempt.elapsedMs)
    && attempt.elapsedMs > 0
    && attempt.elapsedMs <= Number.MAX_SAFE_INTEGER
    && typeof attempt.completedAt === 'number'
    && Number.isFinite(attempt.completedAt)
    && attempt.completedAt >= 0
    && attempt.completedAt <= 8.64e15;
}

export function loadPracticeHistory(storage: StorageLike): {
  attempts: PracticeAttempt[];
  message: string | null;
} {
  try {
    const serialized = storage.getItem(PRACTICE_HISTORY_STORAGE_KEY);
    if (serialized === null) return { attempts: [], message: null };
    const parsed: unknown = JSON.parse(serialized);
    if (
      !Array.isArray(parsed)
      || !parsed.every(isPracticeAttempt)
      || new Set(parsed.map((attempt: PracticeAttempt) => attempt.id)).size !== parsed.length
    ) {
      return {
        attempts: [],
        message: 'Saved practice history was invalid and has been ignored.',
      };
    }
    return { attempts: parsed, message: null };
  } catch {
    return {
      attempts: [],
      message: 'Practice history could not be read from browser storage.',
    };
  }
}

export function savePracticeHistory(
  storage: StorageLike,
  attempts: readonly PracticeAttempt[],
): { ok: true } | { ok: false; message: string } {
  try {
    storage.setItem(PRACTICE_HISTORY_STORAGE_KEY, JSON.stringify(attempts));
    return { ok: true };
  } catch {
    return { ok: false, message: 'Practice history could not be saved in browser storage.' };
  }
}

export function addPracticeAttempt(
  storage: StorageLike,
  attempts: readonly PracticeAttempt[],
  attempt: PracticeAttempt,
): { attempts: PracticeAttempt[]; message: string | null } {
  const nextAttempts = [attempt, ...attempts];
  const result = savePracticeHistory(storage, nextAttempts);
  return result.ok
    ? { attempts: nextAttempts, message: 'Practice time saved.' }
    : { attempts: [...attempts], message: result.message };
}

export function deletePracticeAttempt(
  storage: StorageLike,
  attempts: readonly PracticeAttempt[],
  id: string,
): { attempts: PracticeAttempt[]; message: string | null } {
  const nextAttempts = attempts.filter((attempt) => attempt.id !== id);
  const result = savePracticeHistory(storage, nextAttempts);
  return result.ok
    ? { attempts: nextAttempts, message: 'Practice attempt deleted.' }
    : { attempts: [...attempts], message: result.message };
}

export function clearPracticeHistory(
  storage: StorageLike,
): { ok: true } | { ok: false; message: string } {
  try {
    storage.removeItem(PRACTICE_HISTORY_STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Practice history could not be cleared from browser storage.' };
  }
}
