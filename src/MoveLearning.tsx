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
          Explanation {index + 1} of {moves.length}. Reading ahead does not turn the cube.
          Playback has applied {appliedMoves} of {moves.length} moves.
        </p>
      </div>
      <div className="move-explanation" aria-live="polite" aria-atomic="true">
        <strong>Move {index + 1}: <code>{move}</code></strong>
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
