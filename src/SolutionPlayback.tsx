import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { CubeState } from './cubeState';
import type { CubeMove } from './cubeStateManager';
import MoveLearning from './MoveLearning';
import {
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_MOVE_DURATION_MS,
  createPlaybackState,
  invertCubeMove,
  isCubeSolved,
  playbackReducer,
} from './cubePlayback';

interface SolutionPlaybackProps {
  cube: CubeState;
  startCube: CubeState;
  moves: readonly CubeMove[];
  onApplyMove: (move: CubeMove) => CubeState;
  onAnimateMove: (move: CubeMove, durationMs: number) => Promise<void>;
  onCancelAnimation: () => void;
  practiceLocked?: boolean;
}

function SolutionPlayback({
  cube,
  startCube,
  moves,
  onApplyMove,
  onAnimateMove,
  onCancelAnimation,
  practiceLocked = false,
}: SolutionPlaybackProps) {
  const [playback, dispatch] = useReducer(playbackReducer, undefined, createPlaybackState);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [interrupted, setInterrupted] = useState(false);
  const [explanationIndex, setExplanationIndex] = useState(0);
  const busyRef = useRef(false);
  const expectedCube = useRef(startCube);
  const playbackState = useRef(playback);
  const practiceLockedRef = useRef(practiceLocked);

  useEffect(() => {
    playbackState.current = playback;
  }, [playback]);

  useLayoutEffect(() => {
    practiceLockedRef.current = practiceLocked;
  }, [practiceLocked]);

  useEffect(() => () => {
    if (busyRef.current) onCancelAnimation();
  }, [onCancelAnimation]);

  useEffect(() => {
    if (!practiceLocked) return;
    dispatch({ type: 'pause' });
    if (busyRef.current) onCancelAnimation();
  }, [onCancelAnimation, practiceLocked]);

  useEffect(() => {
    if (!busyRef.current && !interrupted && !areSameCube(cube, expectedCube.current)) {
      setInterrupted(true);
      setMessage('Playback stopped because the cube changed. Generate a new solution to continue.');
      dispatch({ type: 'pause' });
    }
  }, [cube, interrupted]);

  const applyAnimatedMove = useCallback(async (
    move: CubeMove,
    cursor: number,
    automatic: boolean,
  ): Promise<void> => {
    if (busyRef.current || interrupted || practiceLockedRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await onAnimateMove(move, PLAYBACK_MOVE_DURATION_MS / playbackState.current.speed);
      if (practiceLockedRef.current) {
        dispatch({ type: 'pause' });
        setMessage('Playback paused because a practice attempt started.');
        return;
      }
      const updatedCube = onApplyMove(move);
      expectedCube.current = updatedCube;
      const solved = isCubeSolved(updatedCube);
      if (automatic) {
        dispatch({ type: 'tick', totalMoves: moves.length, solved });
      } else {
        dispatch({ type: 'next', totalMoves: moves.length, solved });
      }
      if (cursor === moves.length && !solved) {
        setMessage('Playback reached the end, but the cube is not solved. The solution was not verified.');
      }
    } catch (error) {
      dispatch({ type: 'pause' });
      setMessage(error instanceof Error ? error.message : 'Move animation could not complete.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [interrupted, moves.length, onAnimateMove, onApplyMove]);

  const stepForward = useCallback(async (automatic = false): Promise<void> => {
    const cursor = playbackState.current.cursor;
    if (cursor >= moves.length) return;
    await applyAnimatedMove(moves[cursor], cursor + 1, automatic);
  }, [applyAnimatedMove, moves]);

  const onAnimateAndApply = useCallback(async (
    move: CubeMove,
    cursor: number,
  ): Promise<boolean> => {
    if (busyRef.current || interrupted || practiceLockedRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await onAnimateMove(move, PLAYBACK_MOVE_DURATION_MS / playbackState.current.speed);
      if (practiceLockedRef.current) {
        dispatch({ type: 'pause' });
        setMessage('Playback paused because a practice attempt started.');
        return false;
      }
      expectedCube.current = onApplyMove(move);
      dispatch({ type: 'previous' });
    } catch (error) {
      dispatch({ type: 'pause' });
      setMessage(error instanceof Error ? error.message : 'Move animation could not complete.');
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (cursor === 0 && !areSameCube(expectedCube.current, startCube)) {
      setMessage('Restart did not restore the original cube state.');
      return false;
    }
    return true;
  }, [interrupted, onAnimateMove, onApplyMove, startCube]);

  const stepBackward = useCallback(async (): Promise<void> => {
    const cursor = playbackState.current.cursor;
    if (cursor <= 0) return;
    await onAnimateAndApply(invertCubeMove(moves[cursor - 1]), cursor - 1);
  }, [moves, onAnimateAndApply]);

  const restart = useCallback(async (): Promise<void> => {
    if (busyRef.current || interrupted) return;
    dispatch({ type: 'pause' });
    for (let cursor = playback.cursor; cursor > 0; cursor -= 1) {
      const restored = await onAnimateAndApply(invertCubeMove(moves[cursor - 1]), cursor - 1);
      if (!restored) return;
    }
    dispatch({ type: 'restart' });
    if (!areSameCube(expectedCube.current, startCube)) {
      setMessage('Restart did not restore the original cube state.');
    }
  }, [interrupted, moves, playback.cursor, onAnimateAndApply, startCube]);

  useEffect(() => {
    if (playback.status !== 'playing' || busy || interrupted) return undefined;
    const timer = window.setTimeout(() => {
      void stepForward(true);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [busy, interrupted, playback.cursor, playback.speed, playback.status, stepForward]);

  const currentMove = moves[playback.cursor];
  const alreadySolved = moves.length === 0 && isCubeSolved(startCube);

  return (
    <div className="solution-playback" role="group" aria-label="Solution playback">
      <div className="playback-status" aria-live="polite">
        <strong>
          {moves.length === 0
            ? alreadySolved ? 'Cube is already solved.' : 'No moves are available.'
            : playback.status === 'completed'
              ? 'Solution complete — cube verified solved.'
              : `Applied ${playback.cursor} of ${moves.length} moves`}
        </strong>
        {currentMove && (
          <span>Next: Move {playback.cursor + 1}, <code>{currentMove}</code></span>
        )}
        {!currentMove && moves.length > 0 && playback.cursor === moves.length && (
          <span>{isCubeSolved(cube) ? 'Final state: solved' : 'Final state: not solved'}</span>
        )}
      </div>
      {moves.length > 0 && (
        <progress
          className="playback-progress"
          value={playback.cursor}
          max={moves.length}
          aria-label={`${playback.cursor} of ${moves.length} solution moves applied`}
        />
      )}
      <div className="playback-controls">
        <button
          className="editor-button primary"
          type="button"
          disabled={practiceLocked || busy || interrupted || playback.status === 'playing' || playback.cursor >= moves.length}
          onClick={() => dispatch({ type: 'play', totalMoves: moves.length })}
        >
          Play
        </button>
        <button
          className="editor-button secondary"
          type="button"
          disabled={practiceLocked || playback.status !== 'playing'}
          onClick={() => dispatch({ type: 'pause' })}
        >
          Pause
        </button>
        <button
          className="editor-button secondary"
          type="button"
          disabled={practiceLocked || busy || interrupted || playback.cursor === 0}
          onClick={() => void stepBackward()}
        >
          Previous Move
        </button>
        <button
          className="editor-button secondary"
          type="button"
          disabled={practiceLocked || busy || interrupted || playback.cursor >= moves.length}
          onClick={() => void stepForward()}
        >
          Next Move
        </button>
        <button
          className="editor-button secondary"
          type="button"
          disabled={practiceLocked || busy || interrupted || playback.cursor === 0}
          onClick={() => void restart()}
        >
          Restart
        </button>
        <label className="playback-speed">
          Speed
          <select
            aria-label="Playback speed"
            value={playback.speed}
            disabled={practiceLocked || busy}
            onChange={(event) => dispatch({
              type: 'set-speed',
              speed: Number(event.target.value) || DEFAULT_PLAYBACK_SPEED,
            })}
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={1.5}>1.5×</option>
            <option value={2}>2×</option>
          </select>
        </label>
      </div>
      {message && <p className="editor-message" role="status">{message}</p>}
      <MoveLearning
        moves={moves}
        appliedMoves={playback.cursor}
        explanationIndex={explanationIndex}
        onExplanationIndexChange={setExplanationIndex}
      />
      <span className="playback-note">
        Each completed step updates the editor and 3D cube. Playback moves can be undone with cube history.
      </span>
    </div>
  );
}

function areSameCube(first: CubeState, second: CubeState): boolean {
  return (['U', 'D', 'F', 'B', 'L', 'R'] as const).every((face) =>
    first[face].every((sticker, index) => sticker === second[face][index]),
  );
}

export default SolutionPlayback;
