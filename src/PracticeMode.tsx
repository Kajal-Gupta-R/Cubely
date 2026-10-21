import { useEffect, useReducer, useRef, useState } from 'react';
import type { CubeState } from './cubeState';
import { areCubeStatesEqual, type StorageLike, type CubeMove } from './cubeStateManager';
import { isCubeSolved } from './cubePlayback';
import { DEFAULT_SCRAMBLE_LENGTH, generateScramble } from './cubeScramble';
import {
  addPracticeAttempt,
  clearPracticeHistory,
  createPracticeTimer,
  deletePracticeAttempt,
  formatPracticeTime,
  loadPracticeHistory,
  practiceTimerReducer,
  type PracticeAttempt,
} from './practice';
import './PracticeMode.css';

interface PracticeModeProps {
  cube: CubeState;
  onApplyScramble: (moves: readonly CubeMove[]) => CubeState;
  onTimerRunningChange: (running: boolean) => void;
}

interface InitialPracticeHistory {
  attempts: PracticeAttempt[];
  message: string | null;
  storage: StorageLike | null;
}

function getInitialPracticeHistory(): InitialPracticeHistory {
  if (typeof window === 'undefined') {
    return { attempts: [], message: null, storage: null };
  }
  try {
    const storage = window.localStorage;
    return { ...loadPracticeHistory(storage), storage };
  } catch {
    return {
      attempts: [],
      message: 'Browser storage is unavailable; practice times will not persist.',
      storage: null,
    };
  }
}

function makeAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function PracticeMode({ cube, onApplyScramble, onTimerRunningChange }: PracticeModeProps) {
  const [initialHistory] = useState(getInitialPracticeHistory);
  const storage = initialHistory.storage;
  const [attempts, setAttempts] = useState(initialHistory.attempts);
  const [timer, dispatch] = useReducer(practiceTimerReducer, undefined, createPracticeTimer);
  const [scramble, setScramble] = useState<readonly CubeMove[] | null>(null);
  const [message, setMessage] = useState(initialHistory.message);
  const [confirmClear, setConfirmClear] = useState(false);
  const expectedScramble = useRef<CubeState | null>(null);

  useEffect(() => {
    if (timer.status !== 'running') return undefined;
    const interval = window.setInterval(() => {
      dispatch({ type: 'tick', now: performance.now() });
    }, 50);
    return () => window.clearInterval(interval);
  }, [timer.status]);

  function startAttempt() {
    if (timer.status !== 'idle' || scramble === null) return;
    if (expectedScramble.current === null || !areCubeStatesEqual(cube, expectedScramble.current)) {
      expectedScramble.current = null;
      setScramble(null);
      setMessage('Cube changed since this scramble. Generate a new scramble before starting the timer.');
      return;
    }
    setMessage('Timer started. Solve the displayed scramble, then stop to save your time.');
    onTimerRunningChange(true);
    dispatch({ type: 'start', now: performance.now() });
  }

  function stopAttempt() {
    if (timer.status !== 'running' || timer.startedAt === null) return;
    const now = performance.now();
    const elapsedMs = Math.max(0, now - timer.startedAt);
    dispatch({ type: 'stop', now });
    onTimerRunningChange(false);
    expectedScramble.current = null;
    setScramble(null);
    if (!isCubeSolved(cube)) {
      setMessage('Attempt stopped without a saved time because the cube is not solved. Reset to discard it.');
      return;
    }
    if (elapsedMs <= 0) {
      setMessage('No time was recorded because the attempt had no elapsed time.');
      return;
    }
    if (!storage) {
      setMessage('Attempt stopped, but browser storage is unavailable; the time was not saved.');
      return;
    }
    const result = addPracticeAttempt(storage, attempts, {
      id: makeAttemptId(),
      elapsedMs,
      completedAt: Date.now(),
    });
    setAttempts(result.attempts);
    setMessage(result.message);
  }

  function resetAttempt() {
    dispatch({ type: 'reset' });
    onTimerRunningChange(false);
    expectedScramble.current = null;
    setScramble(null);
    setMessage('Current attempt reset. Generate a new scramble to try again; saved times were kept.');
  }

  function createScramble() {
    if (timer.status === 'running') return;
    const nextScramble = generateScramble();
    try {
      expectedScramble.current = onApplyScramble(nextScramble);
      setScramble(nextScramble);
      dispatch({ type: 'reset' });
      onTimerRunningChange(false);
      setMessage('Scramble applied to the cube. Start the timer when ready.');
    } catch (error) {
      expectedScramble.current = null;
      setScramble(null);
      setMessage(error instanceof Error ? error.message : 'A new scramble could not be applied.');
    }
  }

  function removeAttempt(id: string) {
    if (!storage) {
      setMessage('Browser storage is unavailable; this attempt could not be deleted.');
      return;
    }
    const result = deletePracticeAttempt(storage, attempts, id);
    setAttempts(result.attempts);
    setMessage(result.message);
  }

  function clearHistory() {
    if (!storage) {
      setMessage('Browser storage is unavailable; practice history could not be cleared.');
      return;
    }
    const result = clearPracticeHistory(storage);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setAttempts([]);
    setConfirmClear(false);
    setMessage('Practice history cleared.');
  }

  const bestTime = attempts.length > 0
    ? attempts.reduce((best, attempt) => Math.min(best, attempt.elapsedMs), Number.POSITIVE_INFINITY)
    : null;
  const averageTime = attempts.length > 0
    ? attempts.reduce((total, attempt) => total + attempt.elapsedMs, 0) / attempts.length
    : null;

  return (
    <section className="practice-section" aria-labelledby="practice-title">
      <div className="practice-heading">
        <span className="section-kicker">SCRAMBLE. SOLVE. PRACTICE.</span>
        <h2 id="practice-title">Practice mode</h2>
        <p>
          Generate a {DEFAULT_SCRAMBLE_LENGTH}-move scramble from a solved cube. It replaces the current cube
          as one undoable change; Undo restores your previous cube. Start the timer
          when you are ready to solve and stop it to save your attempt.
        </p>
      </div>

      <div className="practice-card">
        <div className="practice-scramble">
          <div>
            <h3>Scramble</h3>
            <p aria-live="polite">
              {scramble ? scramble.join(' ') : 'Generate a scramble to begin practicing.'}
            </p>
          </div>
          <button
            className="editor-button primary"
            type="button"
            disabled={timer.status === 'running'}
            onClick={createScramble}
          >
            New Scramble
          </button>
        </div>

        <div className="practice-timer">
          <output aria-label="Elapsed solving time" aria-live="off">
            {formatPracticeTime(timer.elapsedMs)}
          </output>
          <div className="practice-timer-controls" role="group" aria-label="Practice timer controls">
            <button
              className="editor-button primary"
              type="button"
              disabled={scramble === null || timer.status !== 'idle'}
              onClick={startAttempt}
            >
              Start
            </button>
            <button
              className="editor-button secondary"
              type="button"
              disabled={timer.status !== 'running' || !isCubeSolved(cube)}
              onClick={stopAttempt}
            >
              Stop and save
            </button>
            <button
              className="editor-button secondary"
              type="button"
              disabled={timer.status === 'idle'}
              onClick={resetAttempt}
            >
              Reset attempt
            </button>
          </div>
        </div>

        {timer.status === 'running' && !isCubeSolved(cube) && (
          <p className="practice-timer-hint">
            Apply face turns to solve the cube. Stop and save becomes available when it is solved;
            Reset attempt discards this time.
          </p>
        )}

        <p className="practice-feedback" role="status" aria-live="polite">
          {message ?? 'Timer is ready.'}
        </p>
      </div>

      <div className="practice-history" aria-labelledby="practice-history-title">
        <div className="practice-history-heading">
          <div>
            <h3 id="practice-history-title">Solve history</h3>
            <p>{attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'} saved in this browser.</p>
          </div>
          {attempts.length > 0 && !confirmClear && (
            <button className="text-button" type="button" onClick={() => setConfirmClear(true)}>
              Clear history…
            </button>
          )}
        </div>

        {confirmClear && (
          <div className="practice-confirm" role="group" aria-label="Confirm clear solve history">
            <span>Delete all saved practice times?</span>
            <button className="editor-button secondary" type="button" onClick={clearHistory}>
              Clear history
            </button>
            <button className="editor-button secondary" type="button" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </div>
        )}

        <div className="practice-stats" aria-label="Practice time statistics">
          <div><span>Best</span><strong>{bestTime === null ? '—' : formatPracticeTime(bestTime)}</strong></div>
          <div><span>Average</span><strong>{averageTime === null ? '—' : formatPracticeTime(averageTime)}</strong></div>
        </div>

        {attempts.length === 0 ? (
          <p className="practice-empty">Completed times will appear here.</p>
        ) : (
          <ol className="practice-attempts">
            {attempts.map((attempt, index) => (
              <li key={attempt.id}>
                <span>Attempt {attempts.length - index}</span>
                <time dateTime={new Date(attempt.completedAt).toISOString()}>
                  {formatPracticeTime(attempt.elapsedMs)}
                </time>
                <span className="practice-date">{new Date(attempt.completedAt).toLocaleString()}</span>
                <button
                  className="text-button"
                  type="button"
                  aria-label={`Delete attempt ${attempts.length - index}: ${formatPracticeTime(attempt.elapsedMs)}`}
                  onClick={() => removeAttempt(attempt.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

export default PracticeMode;
