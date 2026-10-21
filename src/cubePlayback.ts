import {
  CENTER_COLORS,
  FACES,
  type CubeState,
} from './cubeState';
import { applyCubeMove, type CubeMove } from './cubeStateManager';

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'completed';

export interface CubePlaybackState {
  cursor: number;
  status: PlaybackStatus;
  speed: number;
}

export type CubePlaybackAction =
  | { type: 'play'; totalMoves: number }
  | { type: 'pause' }
  | { type: 'next'; totalMoves: number; solved: boolean }
  | { type: 'previous' }
  | { type: 'restart' }
  | { type: 'set-speed'; speed: number }
  | { type: 'tick'; totalMoves: number; solved: boolean };

export const MIN_PLAYBACK_SPEED = 0.5;
export const MAX_PLAYBACK_SPEED = 2;
export const DEFAULT_PLAYBACK_SPEED = 1;
export const PLAYBACK_MOVE_DURATION_MS = 700;

export function createPlaybackState(): CubePlaybackState {
  return { cursor: 0, status: 'idle', speed: DEFAULT_PLAYBACK_SPEED };
}

export function playbackReducer(
  state: CubePlaybackState,
  action: CubePlaybackAction,
): CubePlaybackState {
  switch (action.type) {
    case 'play':
      if (action.totalMoves === 0 || state.cursor >= action.totalMoves) return state;
      return { ...state, status: 'playing' };
    case 'pause':
      return state.status === 'playing' ? { ...state, status: 'paused' } : state;
    case 'next': {
      if (state.cursor >= action.totalMoves) return state;
      const cursor = state.cursor + 1;
      return {
        ...state,
        cursor,
        status: cursor === action.totalMoves && action.solved ? 'completed' : 'paused',
      };
    }
    case 'previous':
      return state.cursor === 0
        ? state
        : { ...state, cursor: state.cursor - 1, status: 'paused' };
    case 'restart':
      return { ...state, cursor: 0, status: 'idle' };
    case 'set-speed':
      return {
        ...state,
        speed: Math.max(MIN_PLAYBACK_SPEED, Math.min(MAX_PLAYBACK_SPEED, action.speed)),
      };
    case 'tick':
      if (state.cursor >= action.totalMoves) return state;
      if (state.cursor + 1 === action.totalMoves) {
        return {
          ...state,
          cursor: action.totalMoves,
          status: action.solved ? 'completed' : 'paused',
        };
      }
      return { ...state, cursor: state.cursor + 1 };
  }
}

export function invertCubeMove(move: CubeMove): CubeMove {
  if (move.endsWith('2')) return move;
  return move.endsWith("'") ? move.slice(0, 1) as CubeMove : `${move}'` as CubeMove;
}

export function cubeAtPlaybackCursor(
  start: CubeState,
  moves: readonly CubeMove[],
  cursor: number,
): CubeState {
  return moves.slice(0, cursor).reduce(applyCubeMove, start);
}

export function isCubeSolved(cube: CubeState): boolean {
  return FACES.every((face) =>
    cube[face].every((sticker) => sticker === CENTER_COLORS[face]),
  );
}

export function replayPlaybackMoves(
  start: CubeState,
  moves: readonly CubeMove[],
): CubeState {
  return moves.reduce(applyCubeMove, start);
}
