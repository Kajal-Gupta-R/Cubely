import { describe, expect, it } from 'vitest';
import {
  PRACTICE_HISTORY_STORAGE_KEY,
  addPracticeAttempt,
  clearPracticeHistory,
  createPracticeTimer,
  deletePracticeAttempt,
  formatPracticeTime,
  isPracticeAttempt,
  loadPracticeHistory,
  practiceTimerReducer,
  savePracticeHistory,
  type PracticeAttempt,
} from '../src/practice';
import { CUBE_STORAGE_KEY, type StorageLike } from '../src/cubeStateManager';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  failReads = false;
  failWrites = false;
  failRemoves = false;

  getItem(key: string): string | null {
    if (this.failReads) throw new Error('read failure');
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('write failure');
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    if (this.failRemoves) throw new Error('remove failure');
    this.values.delete(key);
  }
}

describe('practice timer', () => {
  it('starts once and measures elapsed time from timestamps instead of ticks', () => {
    const idle = createPracticeTimer();
    const running = practiceTimerReducer(idle, { type: 'start', now: 1000 });
    expect(running).toMatchObject({ status: 'running', startedAt: 1000 });
    expect(practiceTimerReducer(running, { type: 'start', now: 2000 })).toBe(running);

    const displayed = practiceTimerReducer(running, { type: 'tick', now: 2375 });
    expect(displayed.elapsedMs).toBe(1375);
    const stopped = practiceTimerReducer(displayed, { type: 'stop', now: 2842 });
    expect(stopped).toMatchObject({ status: 'stopped', startedAt: null, elapsedMs: 1842 });
    expect(practiceTimerReducer(stopped, { type: 'stop', now: 4000 })).toBe(stopped);
  });

  it('ignores invalid transitions and resets an active attempt', () => {
    const idle = createPracticeTimer();
    expect(practiceTimerReducer(idle, { type: 'stop', now: 100 })).toBe(idle);
    expect(practiceTimerReducer(idle, { type: 'start', now: Number.NaN })).toBe(idle);
    const running = practiceTimerReducer(idle, { type: 'start', now: 500 });
    expect(practiceTimerReducer(running, { type: 'tick', now: Number.POSITIVE_INFINITY })).toBe(running);
    expect(practiceTimerReducer(running, { type: 'reset' })).toEqual(idle);
  });

  it('formats times to centiseconds and clamps negative values', () => {
    expect(formatPracticeTime(0)).toBe('0:00.00');
    expect(formatPracticeTime(61_239)).toBe('1:01.23');
    expect(formatPracticeTime(-100)).toBe('0:00.00');
  });
});

describe('practice history persistence', () => {
  const first: PracticeAttempt = { id: 'attempt-one', elapsedMs: 61_250, completedAt: 1_700_000_000_000 };
  const second: PracticeAttempt = { id: 'attempt-two', elapsedMs: 58_900, completedAt: 1_700_000_001_000 };

  it('saves, loads, deletes individual attempts, and clears the separate history key', () => {
    const storage = new MemoryStorage();
    storage.values.set(CUBE_STORAGE_KEY, 'existing cube data');
    expect(savePracticeHistory(storage, [first])).toEqual({ ok: true });
    expect(storage.values.has(PRACTICE_HISTORY_STORAGE_KEY)).toBe(true);
    expect(loadPracticeHistory(storage)).toEqual({ attempts: [first], message: null });

    const added = addPracticeAttempt(storage, [first], second);
    expect(added.attempts).toEqual([second, first]);
    expect(loadPracticeHistory(storage).attempts).toEqual([second, first]);

    const deleted = deletePracticeAttempt(storage, added.attempts, first.id);
    expect(deleted.attempts).toEqual([second]);
    expect(loadPracticeHistory(storage).attempts).toEqual([second]);

    expect(clearPracticeHistory(storage)).toEqual({ ok: true });
    expect(loadPracticeHistory(storage)).toEqual({ attempts: [], message: null });
    expect(storage.values.get(CUBE_STORAGE_KEY)).toBe('existing cube data');
  });

  it('rejects corrupted JSON and invalid attempt records safely', () => {
    const storage = new MemoryStorage();
    storage.values.set(PRACTICE_HISTORY_STORAGE_KEY, '{broken');
    expect(loadPracticeHistory(storage)).toMatchObject({ attempts: [], message: expect.any(String) });

    storage.values.set(PRACTICE_HISTORY_STORAGE_KEY, JSON.stringify([first, { ...second, elapsedMs: -1 }]));
    expect(loadPracticeHistory(storage)).toMatchObject({ attempts: [], message: expect.stringContaining('invalid') });
    expect(isPracticeAttempt(first)).toBe(true);
    expect(isPracticeAttempt({ ...first, completedAt: Number.NaN })).toBe(false);
    expect(isPracticeAttempt({ ...first, completedAt: 1e300 })).toBe(false);
    storage.values.set(PRACTICE_HISTORY_STORAGE_KEY, JSON.stringify([first, { ...first, id: first.id }]));
    expect(loadPracticeHistory(storage)).toMatchObject({ attempts: [], message: expect.stringContaining('invalid') });
  });

  it('reports storage errors and keeps in-memory history intact when writes fail', () => {
    const storage = new MemoryStorage();
    storage.failReads = true;
    expect(loadPracticeHistory(storage).message).toMatch(/could not be read/);

    storage.failReads = false;
    storage.failWrites = true;
    expect(savePracticeHistory(storage, [first])).toMatchObject({ ok: false });
    expect(addPracticeAttempt(storage, [first], second)).toMatchObject({ attempts: [first] });

    storage.failWrites = false;
    storage.failRemoves = true;
    expect(clearPracticeHistory(storage)).toMatchObject({ ok: false });
  });
});
