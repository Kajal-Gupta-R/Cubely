import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CENTER_COLORS,
  COLORS,
  FACE_LABELS,
  FACES,
  type CubeState,
  type Face,
  type StickerColor,
} from './cubeState';
import { validateCube } from './cubeValidation';
import {
  buildCubeFromScans,
  classifyStickerColorWithConfidence,
  createColorReferences,
  requestCameraStream,
  rotateFaceSamples,
  stopCameraStream,
  type CubeScans,
  type RGBSample,
  type StickerCorrections,
} from './cubeScanUtils';
import './CubeScanner.css';

interface CubeScannerProps {
  onApplyCube: (cube: CubeState) => void;
  onClose: () => void;
}

function sampleVideoGrid(video: HTMLVideoElement): RGBSample[] {
  if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
    throw new Error('Wait for the camera preview before capturing a face.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser cannot sample camera images.');
  context.drawImage(video, 0, 0);

  return Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const sampleSize = Math.max(2, Math.floor(
      Math.min(canvas.width, canvas.height) * (0.84 / 3) * 0.22,
    ));
    const centerX = Math.floor((0.08 + (column + 0.5) * (0.84 / 3)) * canvas.width);
    const centerY = Math.floor((0.08 + (row + 0.5) * (0.84 / 3)) * canvas.height);
    const left = Math.max(0, Math.min(canvas.width - sampleSize, centerX - Math.floor(sampleSize / 2)));
    const top = Math.max(0, Math.min(canvas.height - sampleSize, centerY - Math.floor(sampleSize / 2)));
    const pixels = context.getImageData(left, top, sampleSize, sampleSize).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    const pixelCount = pixels.length / 4;

    for (let pixel = 0; pixel < pixels.length; pixel += 4) {
      red += pixels[pixel];
      green += pixels[pixel + 1];
      blue += pixels[pixel + 2];
    }

    return {
      red: red / pixelCount,
      green: green / pixelCount,
      blue: blue / pixelCount,
    };
  });
}

function getCameraError(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') {
    return 'Camera access was denied. Allow camera access in your browser settings, or use the manual editor.';
  }
  if (error instanceof Error && error.name === 'NotFoundError') {
    return 'No camera was found. You can still enter the cube with the manual editor.';
  }
  if (error instanceof Error && error.name === 'OverconstrainedError') {
    return 'No compatible camera could be started. Check that a camera is connected and available to the browser, or use the manual editor.';
  }
  return 'The camera could not be started. Check browser permissions and try again.';
}

function CubeScanner({ onApplyCube, onClose }: CubeScannerProps) {
  const [selectedFace, setSelectedFace] = useState<Face>('F');
  const [reviewFace, setReviewFace] = useState<Face>('F');
  const [scans, setScans] = useState<CubeScans>({});
  const [corrections, setCorrections] = useState<StickerCorrections>({});
  const [correctionColor, setCorrectionColor] = useState<StickerColor>('white');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [message, setMessage] = useState('');
  const [uncertainColorsConfirmed, setUncertainColorsConfirmed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const cameraRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    headingRef.current?.focus();
    const videoElement = videoRef.current;
    const appRoot = document.getElementById('root');
    appRoot?.setAttribute('inert', '');
    appRoot?.setAttribute('aria-hidden', 'true');
    return () => {
      mountedRef.current = false;
      cameraRequestRef.current += 1;
      stopCameraStream(streamRef.current);
      streamRef.current = null;
      if (videoElement) videoElement.srcObject = null;
      appRoot?.removeAttribute('inert');
      appRoot?.removeAttribute('aria-hidden');
    };
  }, []);

  const capturedCount = FACES.filter((face) => scans[face] !== undefined).length;
  const allFacesCaptured = capturedCount === FACES.length;
  const colorReferences = allFacesCaptured ? createColorReferences(scans) : null;
  const candidate = allFacesCaptured ? buildCubeFromScans(scans, corrections) : null;
  const validation = candidate ? validateCube(candidate) : null;
  const uncertainStickerCount = colorReferences
    ? FACES.reduce((total, face) => {
      const scan = scans[face];
      if (!scan) return total;
      const samples = rotateFaceSamples(scan.samples, scan.clockwiseTurns);
      return total + samples.filter((sample, index) => (
        index !== 4
        && corrections[face]?.[index] === undefined
        && classifyStickerColorWithConfidence(sample, colorReferences).uncertain
      )).length;
    }, 0)
    : 0;
  const faceScan = scans[reviewFace];
  const reviewSamples = faceScan
    ? rotateFaceSamples(faceScan.samples, faceScan.clockwiseTurns)
    : [];

  function stopCamera() {
    cameraRequestRef.current += 1;
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraStarting(false);
  }

  async function startCamera() {
    if (cameraActive || cameraStarting) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser. Use the manual editor instead.');
      return;
    }

    const requestId = ++cameraRequestRef.current;
    setCameraError('');
    setCameraStarting(true);
    try {
      const stream = await requestCameraStream(navigator.mediaDevices, cameraFacing);
      if (!mountedRef.current || requestId !== cameraRequestRef.current) {
        stopCameraStream(stream);
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCameraStream(stream);
        streamRef.current = null;
        throw new Error('The camera preview is unavailable.');
      }
      video.srcObject = stream;
      await video.play();
      if (!mountedRef.current || requestId !== cameraRequestRef.current) return;
      setCameraActive(true);
    } catch (error) {
      if (requestId === cameraRequestRef.current && mountedRef.current) {
        stopCameraStream(streamRef.current);
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraError(getCameraError(error));
      }
    } finally {
      if (requestId === cameraRequestRef.current && mountedRef.current) {
        setCameraStarting(false);
      }
    }
  }

  function captureFace() {
    const video = videoRef.current;
    if (!cameraActive || !video) return;
    try {
      const samples = sampleVideoGrid(video);
      setScans((current) => ({
        ...current,
        [selectedFace]: { samples, clockwiseTurns: 0 },
      }));
      setReviewFace(selectedFace);
      setCorrections((current) => {
        const next = { ...current };
        delete next[selectedFace];
        return next;
      });
      setUncertainColorsConfirmed(false);
      setMessage(`${FACE_LABELS[selectedFace]} face captured. Review its orientation and sticker colors.`);
      setCameraError('');
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'Could not capture the face.');
    }
  }

  function rotateReviewFace() {
    setScans((current) => {
      const scan = current[reviewFace];
      if (!scan) return current;
      return {
        ...current,
        [reviewFace]: { ...scan, clockwiseTurns: (scan.clockwiseTurns + 1) % 4 },
      };
    });
    setCorrections((current) => {
      const faceCorrections = current[reviewFace];
      if (!faceCorrections) return current;
      const next = { ...current };
      delete next[reviewFace];
      return next;
    });
    setUncertainColorsConfirmed(false);
    setMessage('The sampled face was rotated. Review or re-enter any manual corrections.');
  }

  function correctSticker(index: number) {
    if (index === 4) return;
    setCorrections((current) => ({
      ...current,
      [reviewFace]: {
        ...current[reviewFace],
        [index]: correctionColor,
      },
    }));
    setUncertainColorsConfirmed(false);
    setMessage(`${FACE_LABELS[reviewFace]} sticker ${index + 1} set to ${correctionColor}.`);
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), select:not(:disabled), [tabindex="0"], [tabindex="-1"]',
    )];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className="scanner-backdrop">
      <div
        className="cube-scanner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-title"
        aria-describedby="scanner-instructions"
        ref={dialogRef}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="scanner-heading">
          <div>
            <span className="section-kicker">ON-DEVICE FACE SCAN</span>
            <h2 id="scanner-title" ref={headingRef} tabIndex={-1}>Scan your cube</h2>
          </div>
          <button className="scanner-close" type="button" aria-label="Close cube scanner" onClick={onClose}>×</button>
        </div>
        <p id="scanner-instructions" className="scanner-instructions">
          Allow camera access only when you start the preview. Align one face inside the 3×3 guide and capture each face by its center:
          white U, yellow D, green F, blue B, orange L, red R. Keep the face straight to camera.
          Face tops: U toward the back, D toward the front, and side faces upward. Captures stay in this browser and are never uploaded or saved.
        </p>

        <div className="scanner-layout">
          <div className="scanner-camera-column">
            <label className="scanner-camera-label" htmlFor="scanner-camera-facing">Camera</label>
            <select
              className="scanner-camera-select"
              id="scanner-camera-facing"
              value={cameraFacing}
              disabled={cameraActive || cameraStarting}
              onChange={(event) => setCameraFacing(event.target.value as 'environment' | 'user')}
            >
              <option value="environment">Rear camera</option>
              <option value="user">Front camera</option>
            </select>
            <div className="scanner-video-frame">
              <video
                ref={videoRef}
                muted
                playsInline
                aria-label="Live camera view for aligning one cube face"
              />
              {!cameraActive && (
                <div className="scanner-video-placeholder">
                  <span>{cameraStarting ? 'Starting camera…' : 'Camera is off'}</span>
                  <span>Nothing is captured until you choose a face and press Capture.</span>
                </div>
              )}
              <div className="scanner-guide" aria-hidden="true">
                {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
              </div>
            </div>
            <div className="scanner-actions">
              {!cameraActive ? (
                <button
                  className="editor-button primary"
                  type="button"
                  disabled={cameraStarting}
                  onClick={() => void startCamera()}
                >
                  {cameraStarting ? 'Starting camera…' : 'Start camera'}
                </button>
              ) : (
                <>
                  <button className="editor-button primary" type="button" onClick={captureFace}>
                    Capture {FACE_LABELS[selectedFace]} face
                  </button>
                  <button className="editor-button secondary" type="button" onClick={stopCamera}>Stop camera</button>
                </>
              )}
            </div>
            {cameraError && <p className="scanner-error" role="alert">{cameraError}</p>}
          </div>

          <div className="scanner-review">
            <label htmlFor="scanner-face">Face shown to camera</label>
            <select
              id="scanner-face"
              value={selectedFace}
              onChange={(event) => setSelectedFace(event.target.value as Face)}
            >
              {FACES.map((face) => (
                <option key={face} value={face}>
                  {face} — {FACE_LABELS[face]} ({CENTER_COLORS[face]})
                </option>
              ))}
            </select>
            <p className="scanner-count" role="status">{capturedCount} of 6 faces captured</p>

            <div className="scanner-all-faces" role="group" aria-label="All captured cube faces">
              {FACES.map((face) => {
                const scan = scans[face];
                const samples = scan
                  ? rotateFaceSamples(scan.samples, scan.clockwiseTurns)
                  : [];
                return (
                  <button
                    className={face === reviewFace ? 'scanner-face-card is-selected' : 'scanner-face-card'}
                    key={face}
                    type="button"
                    disabled={!scan}
                    aria-label={scan
                      ? `Review ${FACE_LABELS[face]} face${face === reviewFace ? ', selected' : ''}`
                      : `${FACE_LABELS[face]} face not captured`}
                    aria-pressed={Boolean(scan && face === reviewFace)}
                    onClick={() => {
                      if (scan) setReviewFace(face);
                    }}
                  >
                    <span>{face}</span>
                    <span className="scanner-mini-grid" aria-hidden="true">
                      {samples.map((sample, index) => {
                        const classification = index === 4 || !colorReferences
                          ? null
                          : classifyStickerColorWithConfidence(sample, colorReferences);
                        const corrected = corrections[face]?.[index];
                        const color = index === 4
                          ? CENTER_COLORS[face]
                          : corrected ?? classification?.color;
                        const swatch = color
                          ? COLORS.find((entry) => entry.color === color)?.hex
                          : `rgb(${sample.red}, ${sample.green}, ${sample.blue})`;
                        return (
                          <span
                            className={classification?.uncertain && !corrected ? 'is-uncertain' : ''}
                            key={`${face}-${index}`}
                            style={{ backgroundColor: swatch }}
                          />
                        );
                      })}
                    </span>
                    <small>{scan ? 'Captured' : 'Not scanned'}</small>
                  </button>
                );
              })}
            </div>

            <label htmlFor="scanner-review-face">Review captured face</label>
            <select
              id="scanner-review-face"
              value={reviewFace}
              onChange={(event) => setReviewFace(event.target.value as Face)}
            >
              {FACES.filter((face) => scans[face]).map((face) => (
                <option key={face} value={face}>{FACE_LABELS[face]} ({face})</option>
              ))}
              {capturedCount === 0 && <option value="F">No faces captured yet</option>}
            </select>

            {faceScan ? (
              <>
                <div className="scanner-sticker-grid" role="group" aria-label={`${FACE_LABELS[reviewFace]} scanned stickers`}>
                  {reviewSamples.map((sample, index) => {
                    const color = index === 4
                      ? CENTER_COLORS[reviewFace]
                      : corrections[reviewFace]?.[index] ?? null;
                    const classification = index === 4 || !colorReferences
                      ? null
                      : classifyStickerColorWithConfidence(sample, colorReferences);
                    const swatch = color
                      ? COLORS.find((entry) => entry.color === color)?.hex
                      : COLORS.find((entry) => entry.color === classification?.color)?.hex
                        ?? `rgb(${sample.red}, ${sample.green}, ${sample.blue})`;
                    const stickerLabel = index === 4
                      ? `${FACE_LABELS[reviewFace]} fixed center, ${CENTER_COLORS[reviewFace]}`
                      : color
                        ? `${FACE_LABELS[reviewFace]} sticker ${index + 1}, corrected to ${color}`
                        : `${FACE_LABELS[reviewFace]} sticker ${index + 1}, estimated ${classification?.color ?? 'unknown'} at ${Math.round((classification?.confidence ?? 0) * 100)} percent confidence`;
                    return (
                      <button
                        className={`scanner-sticker${classification?.uncertain && !color ? ' is-uncertain' : ''}`}
                        key={`${reviewFace}-${index}`}
                        type="button"
                        aria-label={stickerLabel}
                        title={index === 4 ? 'Face center is fixed' : 'Set selected correction color'}
                        disabled={index === 4}
                        style={{ backgroundColor: swatch }}
                        onClick={() => correctSticker(index)}
                      >
                        {index === 4 && <span aria-hidden="true">●</span>}
                        {classification && <span className="scanner-confidence" aria-hidden="true">
                          {classification.uncertain ? '?' : `${Math.round(classification.confidence * 100)}%`}
                        </span>}
                      </button>
                    );
                  })}
                </div>
                <button className="editor-button secondary" type="button" onClick={rotateReviewFace}>
                  Rotate reviewed face clockwise
                </button>
                {allFacesCaptured && (
                  <p className="scanner-confidence-note">
                    Low-confidence cells are marked with a dashed outline. Confirm the six-face overview and correct uncertain colors before applying.
                  </p>
                )}
                <label htmlFor="scanner-correction">Manual correction color</label>
                <select
                  id="scanner-correction"
                  value={correctionColor}
                  onChange={(event) => setCorrectionColor(event.target.value as StickerColor)}
                >
                  {COLORS.map(({ color, label }) => <option key={color} value={color}>{label}</option>)}
                </select>
                <p className="scanner-help">Review all sticker colors. Sample colors are estimated from the center stickers; select a color and choose a sticker to correct it.</p>
              </>
            ) : (
              <p className="scanner-help">Captured face colors appear here for review.</p>
            )}
          </div>
        </div>

        {allFacesCaptured && validation && (
          <div className={validation.valid ? 'scanner-validation valid' : 'scanner-validation invalid'}
            role={validation.valid ? 'status' : 'alert'}>
            <strong>{validation.valid ? 'All six scans form a physically legal cube.' : 'The scanned colors need correction.'}</strong>
            {!validation.valid && (
              <ul>{validation.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>
            )}
          </div>
        )}
        {uncertainStickerCount > 0 && (
          <div className="scanner-uncertainty" role="alert">
            {uncertainStickerCount} sticker {uncertainStickerCount === 1 ? 'color is' : 'colors are'} uncertain.
            Review the dashed cells and either correct them or explicitly confirm the estimates below.
          </div>
        )}
        {allFacesCaptured && uncertainStickerCount > 0 && (
          <label className="scanner-uncertainty-confirm">
            <input
              type="checkbox"
              checked={uncertainColorsConfirmed}
              onChange={(event) => setUncertainColorsConfirmed(event.target.checked)}
            />
            I reviewed the low-confidence sticker estimates and accept them.
          </label>
        )}
        {message && <p className="scanner-feedback" role="status">{message}</p>}
        <div className="scanner-footer">
          <button className="editor-button secondary" type="button" onClick={onClose}>Cancel</button>
          <button
            className="editor-button primary"
            type="button"
            disabled={!candidate || !validation?.valid || (uncertainStickerCount > 0 && !uncertainColorsConfirmed)}
            onClick={() => {
              if (candidate && validation?.valid) onApplyCube(candidate);
            }}
          >
            Use scanned cube
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CubeScanner;
