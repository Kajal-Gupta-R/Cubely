import { useState } from 'react';
import {
  CENTER_COLORS,
  COLORS,
  FACE_LABELS,
  FACES,
  createEmptyCubeState,
  resetFace,
  setSticker,
  type CubeState,
  type Face,
  type StickerColor,
} from './cubeState';
import { validateCube, type ValidationResult } from './cubeValidation';
import './CubeEditor.css';

interface CubeEditorProps {
  cube: CubeState;
  onCubeChange: (cube: CubeState) => void;
}

function getProgress(cube: CubeState): number {
  return FACES.reduce(
    (total, face) => total + cube[face].filter((sticker) => sticker !== null).length - 1,
    0,
  );
}

function CubeEditor({ cube, onCubeChange }: CubeEditorProps) {
  const [activeFace, setActiveFace] = useState<Face>('F');
  const [selectedColor, setSelectedColor] = useState<StickerColor | 'erase' | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [message, setMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const progress = getProgress(cube);

  function updateSticker(index: number) {
    if (index === 4) return;
    if (selectedColor === null) {
      setMessage('Choose a color or the eraser before selecting a sticker.');
      return;
    }
    onCubeChange(setSticker(
      cube,
      activeFace,
      index,
      selectedColor === 'erase' ? null : selectedColor,
    ));
    setValidation(null);
    setMessage('');
  }

  function resetCurrentFace() {
    onCubeChange(resetFace(cube, activeFace));
    setValidation(null);
    setMessage(`${FACE_LABELS[activeFace]} face cleared.`);
  }

  function resetAllFaces() {
    onCubeChange(createEmptyCubeState());
    setValidation(null);
    setSelectedColor(null);
    setConfirmReset(false);
    setMessage('All faces cleared. Center colors are fixed.');
  }

  function checkCube() {
    const result = validateCube(cube);
    setValidation(result);
    setMessage('');
  }

  return (
    <section className="editor-section" id="editor" aria-labelledby="editor-title">
      <div className="editor-heading">
        <span className="section-kicker">START WITH YOUR CUBE</span>
        <h2 id="editor-title">Enter the colors, one face at a time.</h2>
        <p>
          Each face is viewed straight on from outside the cube; side-face top rows face up.
          Fill top-left to bottom-right. The U face’s top row faces back, and the D face’s top row faces front.
        </p>
        <p className="editor-sync-note">
          The preview updates live. Unentered stickers appear as dark cubelet faces.
        </p>
      </div>

      <div className="cube-editor">
        <div className="editor-face-column">
          <div className="editor-face-tabs" role="group" aria-label="Select a cube face">
            {FACES.map((face) => (
              <button
                className={activeFace === face ? 'face-tab active' : 'face-tab'}
                key={face}
                type="button"
                aria-pressed={activeFace === face}
                onClick={() => {
                  setActiveFace(face);
                  setMessage('');
                }}
              >
                <strong>{face}</strong>
                <span>{FACE_LABELS[face]}</span>
              </button>
            ))}
          </div>

          <div className="editor-grid" role="group" aria-label={`${FACE_LABELS[activeFace]} face stickers`}>
            {cube[activeFace].map((color, index) => {
              const isCenter = index === 4;
              const label = isCenter
                ? `${FACE_LABELS[activeFace]} fixed center, ${CENTER_COLORS[activeFace]}`
                : `${FACE_LABELS[activeFace]} sticker ${index + 1}${color ? `, ${color}` : ', empty'}`;
              return (
                <button
                  className={isCenter ? 'editor-sticker center' : 'editor-sticker'}
                  key={`${activeFace}-${index}`}
                  type="button"
                  aria-label={label}
                  title={isCenter ? 'Face centers cannot be changed' : 'Set sticker color'}
                  disabled={isCenter}
                  style={{ backgroundColor: color ? COLORS.find((item) => item.color === color)?.hex : '#111827' }}
                  onClick={() => updateSticker(index)}
                >
                  {!color && <span aria-hidden="true">+</span>}
                  {isCenter && <span className="center-lock" aria-hidden="true">●</span>}
                </button>
              );
            })}
          </div>
          <p className="center-note">The center sticker sets each face’s color and stays locked.</p>
        </div>

        <div className="editor-controls">
          <h3>Choose a sticker color</h3>
          <div className="color-options" role="group" aria-label="Sticker colors">
            {COLORS.map(({ color, label, hex }) => (
              <button
                className={selectedColor === color ? 'color-option selected' : 'color-option'}
                key={color}
                type="button"
                aria-label={`${label} sticker color`}
                aria-pressed={selectedColor === color}
                onClick={() => {
                  setSelectedColor(color);
                  setMessage('');
                }}
              >
                <span className="color-swatch" style={{ backgroundColor: hex }} />
                {label}
              </button>
            ))}
            <button
              className={selectedColor === 'erase' ? 'color-option selected' : 'color-option'}
              type="button"
              aria-label="Eraser"
              aria-pressed={selectedColor === 'erase'}
              onClick={() => {
                setSelectedColor('erase');
                setMessage('Eraser selected. Choose a sticker to clear it.');
              }}
            >
              <span className="color-swatch eraser-swatch" aria-hidden="true">×</span>
              Eraser
            </button>
          </div>

          <div className="editor-progress">
            <div className="progress-label">
              <span>Stickers entered</span>
              <strong>{progress} / 48</strong>
            </div>
            <progress value={progress} max={48} aria-label={`${progress} of 48 non-center stickers entered`} />
            <span>Face centers are prefilled; all 48 other stickers are needed to validate.</span>
          </div>

          <div className="editor-actions">
            <button className="editor-button secondary" type="button" onClick={resetCurrentFace}>
              Reset {FACE_LABELS[activeFace]} face
            </button>
            <button className="editor-button primary" type="button" onClick={checkCube}>
              Check cube
            </button>
          </div>
          {!confirmReset ? (
            <button className="text-button" type="button" onClick={() => setConfirmReset(true)}>
              Reset all faces…
            </button>
          ) : (
            <div className="reset-confirmation" role="group" aria-label="Confirm reset">
              <span>Clear every entered sticker?</span>
              <button type="button" onClick={resetAllFaces}>Clear cube</button>
              <button type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          )}

          {message && <p className="editor-message" role="status">{message}</p>}
          {validation && (
            <div className={validation.valid ? 'validation-result success' : 'validation-result error'} role="status" aria-live="polite">
              <strong>{validation.valid ? 'This is a legal cube state.' : 'This cube needs a correction.'}</strong>
              {!validation.valid && (
                <ul>
                  {validation.issues.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default CubeEditor;
