import type { CubeMove } from './cubeStateManager';
import { clampExplanationIndex, explainCubeMove } from './cubeLearning';

interface MoveLearningProps {
  moves: readonly CubeMove[];
  appliedMoves: number;
  explanationIndex: number;
  onExplanationIndexChange: (index: number) => void;
}

function MoveLearning({
  moves,
  appliedMoves,
  explanationIndex,
  onExplanationIndexChange,
}: MoveLearningProps) {
  if (moves.length === 0) return null;

  const index = clampExplanationIndex(explanationIndex, moves.length);
  const move = moves[index];
  const explanation = explainCubeMove(move);

  return (
    <section className="move-learning" aria-labelledby="move-learning-title">
      <div className="move-learning-heading">
        <span className="section-kicker">LEARN THE MOVES</span>
        <h3 id="move-learning-title">Understand this turn</h3>
        <p>
          Explanation {index + 1} of {moves.length}. Use Next Move to watch one turn, then copy it on your cube.
          Play animates the full solution. Reading ahead does not turn the cube.
          Playback has applied {appliedMoves} of {moves.length} moves.
        </p>
      </div>
      <div className="move-explanation" aria-live="polite" aria-atomic="true">
        <strong>Move {index + 1}: <code>{move}</code></strong>
        <div className="move-visual-guide">
          <svg
            className={`turn-guide turn-guide-${explanation.turnDirection}`}
            viewBox="0 0 132 124"
            role="img"
            aria-label={`Animated ${explanation.turnDirection} turn diagram for the ${explanation.faceName} face`}
          >
            <rect className="turn-guide-face" x="24" y="19" width="84" height="84" rx="5" />
            <path className="turn-guide-grid" d="M52 19v84M80 19v84M24 47h84M24 75h84" />
            <g className="turn-guide-arrow">
              {explanation.turnDirection === 'half-turn' ? (
                <>
                  <path d="M66 8a53 53 0 0 1 0 106" />
                  <path className="turn-guide-arrowhead" d="m60 106 6 8 7-8" />
                </>
              ) : explanation.turnDirection === 'clockwise' ? (
                <>
                  <path d="M66 8a53 53 0 0 1 53 53" />
                  <path className="turn-guide-arrowhead" d="m111 55 8 6-8 7" />
                </>
              ) : (
                <>
                  <path d="M66 8a53 53 0 0 0-53 53" />
                  <path className="turn-guide-arrowhead" d="m21 55-8 6 8 7" />
                </>
              )}
            </g>
          </svg>
          <div>
            <strong>{explanation.turnAmount}</strong>
            <p>View the {explanation.faceName} face straight on. Follow the arrow; keep the other layers still.</p>
            <small>′ means reverse the turn. 2 means turn halfway.</small>
          </div>
        </div>
        <p>{explanation.instruction}</p>
      </div>
      <div className="move-learning-controls">
        <button
          className="editor-button secondary"
          type="button"
          aria-label="Previous move explanation"
          disabled={index === 0}
          onClick={() => onExplanationIndexChange(index - 1)}
        >
          Previous explanation
        </button>
        <button
          className="editor-button secondary"
          type="button"
          aria-label={`Explain next move${index + 1 < moves.length ? ` ${moves[index + 1]}` : ''}`}
          disabled={index >= moves.length - 1}
          onClick={() => onExplanationIndexChange(index + 1)}
        >
          Next explanation
        </button>
        <button
          className="text-button"
          type="button"
          aria-label="Explain the next move in playback"
          disabled={appliedMoves >= moves.length}
          onClick={() => onExplanationIndexChange(clampExplanationIndex(appliedMoves, moves.length))}
        >
          Explain next playback move
        </button>
      </div>
    </section>
  );
}

export default MoveLearning;
