import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import CubeEditor from './CubeEditor';
import { solveCube } from './cubeSolver';
import type { CubeMove } from './cubeStateManager';
import type { CubeAnimationRequest } from './CubePreview';
import { useCubeState } from './useCubeState';

const CubePreview = lazy(() => import('./CubePreview'));

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shouldLoadCubePreview, setShouldLoadCubePreview] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );
  const [animationRequest, setAnimationRequest] = useState<CubeAnimationRequest | null>(null);
  const animationToken = useRef(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const pendingAnimation = useRef<{ token: number; resolve: () => void; reject: (error: Error) => void } | null>(null);
  const cubeState = useCubeState();
  const { cube } = cubeState;

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setShouldLoadCubePreview(true);
      observer.disconnect();
    }, { rootMargin: '160px' });
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  const animateMove = useCallback((move: CubeMove, durationMs: number) =>
    new Promise<void>((resolve, reject) => {
      if (pendingAnimation.current) {
        pendingAnimation.current.reject(new Error('Another cube animation is already running.'));
      }
      const token = ++animationToken.current;
      pendingAnimation.current = { token, resolve, reject };
      setShouldLoadCubePreview(true);
      setAnimationRequest({ token, move, durationMs });
    }), []);

  const completeAnimation = useCallback((token: number) => {
    const pending = pendingAnimation.current;
    if (!pending || pending.token !== token) return;
    pendingAnimation.current = null;
    setAnimationRequest(null);
    pending.resolve();
  }, []);

  const cancelAnimation = useCallback(() => {
    const pending = pendingAnimation.current;
    pendingAnimation.current = null;
    setAnimationRequest(null);
    pending?.reject(new Error('Playback was interrupted before the move completed.'));
  }, []);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#workspace" aria-label="Cubely home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>cubely<span className="brand-period">.</span></span>
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-navigation"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span>{mobileMenuOpen ? 'Close' : 'Menu'}</span>
          <span aria-hidden="true">{mobileMenuOpen ? '×' : '☰'}</span>
        </button>
        <nav
          id="primary-navigation"
          className={mobileMenuOpen ? 'primary-navigation is-open' : 'primary-navigation'}
          aria-label="Main navigation"
        >
          <a href="#workspace" onClick={closeMobileMenu}>Workspace</a>
          <a href="#practice-mode" onClick={closeMobileMenu}>Practice</a>
          <a href="#learn" onClick={closeMobileMenu}>Learn</a>
        </nav>
        <a className="header-action" href="#editor" onClick={closeMobileMenu}>
          Enter stickers <span aria-hidden="true">↘</span>
        </a>
      </header>

      <main>
        <section className="workspace" id="workspace" aria-labelledby="workspace-title">
          <div className="workspace-heading">
            <div>
              <p className="section-kicker"><span className="live-indicator" />YOUR CUBE WORKSPACE</p>
              <h1 id="workspace-title">From scramble to solution.</h1>
              <p className="workspace-intro">
                Scan your cube or enter its stickers, check that the state is legal, then follow a verified solve.
              </p>
            </div>
            <div className="privacy-pill">
              <span aria-hidden="true">◈</span>
              <span>Cube data stays in this browser</span>
            </div>
          </div>

          <div className="workspace-grid">
            <section className="preview-panel" aria-labelledby="preview-title">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">LIVE MODEL</p>
                  <h2 id="preview-title">Your cube</h2>
                </div>
                <span className="sync-badge"><span />Synced</span>
              </div>
              <div className="preview-stage" ref={previewRef}>
                {shouldLoadCubePreview ? (
                  <Suspense fallback={<div className="cube-stage-loading" role="status">Loading 3D preview…</div>}>
                    <CubePreview
                      cube={cube}
                      animation={animationRequest}
                      onAnimationComplete={completeAnimation}
                    />
                  </Suspense>
                ) : (
                  <div className="cube-stage-loading" role="status">
                    The interactive model loads as it comes into view.
                  </div>
                )}
              </div>
              <div className="preview-caption">
                <span>Drag to orbit</span>
                <span className="caption-divider" />
                <span>Arrow keys to rotate</span>
              </div>
            </section>

            <CubeEditor
              cube={cube}
              onCubeChange={cubeState.updateCube}
              canUndo={cubeState.canUndo}
              canRedo={cubeState.canRedo}
              onUndo={cubeState.undo}
              onRedo={cubeState.redo}
              onApplyMove={cubeState.applyMove}
              onApplyScramble={cubeState.applyScramble}
              onSave={cubeState.saveCurrentCube}
              onRestore={cubeState.restoreSavedCube}
              onClearSaved={cubeState.clearSavedCube}
              saved={cubeState.saved}
              storageMessage={cubeState.storageMessage}
              onSolve={solveCube}
              onAnimateMove={animateMove}
              onCancelAnimation={cancelAnimation}
            />
          </div>
        </section>

        <section className="learning-panel" id="learn" aria-labelledby="learn-title">
          <details>
            <summary>
              <span className="learn-icon" aria-hidden="true">?</span>
              <span>
                <strong id="learn-title">Cube notation, made simple</strong>
                <small>Quick reference for the symbols used in your solution</small>
              </span>
              <span className="details-indicator" aria-hidden="true">+</span>
            </summary>
            <div className="notation-content">
              <p>Each letter names a face. Imagine looking straight at that face from outside the cube.</p>
              <div className="notation-grid">
                {[
                  ['R', 'Right'], ['L', 'Left'], ['U', 'Up'],
                  ['D', 'Down'], ['F', 'Front'], ['B', 'Back'],
                ].map(([move, name]) => (
                  <div className="notation-item" key={move}>
                    <strong>{move}</strong><span>{name}</span>
                  </div>
                ))}
              </div>
              <p className="notation-note">
                A plain letter (R) turns clockwise; an apostrophe (R′) turns counterclockwise; 2 (R2) is a half-turn.
                The solution panel explains every move in context.
              </p>
            </div>
          </details>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#workspace" aria-label="Cubely home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>cubely<span className="brand-period">.</span></span>
        </a>
        <p>A private, browser-based cube workspace.</p>
        <a href="#learn">Notation guide</a>
      </footer>
    </div>
  );
}

export default App;
