
import { lazy, Suspense, useState } from 'react';
import './App.css';
import CubeEditor from './CubeEditor';
import { solveCube } from './cubeSolver';
import { useCubeState } from './useCubeState';

const CubePreview = lazy(() => import('./CubePreview'));

function App() {
  const [showInfo, setShowInfo] = useState(false);
  const cubeState = useCubeState();
  const { cube } = cubeState;

  return (
    <main className="app-shell">
      <nav className="navbar">
        <a className="brand" href="#home">
          <span className="brand-icon">C</span>
          cubely<span className="brand-dot">.</span>
        </a>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#learn">Learn</a>
        </div>
        <a className="nav-cta" href="#editor">Start solving ↗</a>
      </nav>

      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            YOUR PERSONAL CUBE COMPANION
          </div>
          <h1>
            Every twist
            <br />
            brings you <span>closer.</span>
          </h1>
          <p className="hero-description">
            Meet your new cube-solving companion. Rotate your cube in 3D,
            enter the stickers below, and build toward a satisfying solution.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#editor">
              Solve my cube <span>↗</span>
            </a>
            <button
              className="secondary-button"
              onClick={() => setShowInfo(!showInfo)}
            >
              {showInfo ? 'Hide details −' : 'Discover Cubely +'}
            </button>
          </div>
          {showInfo && (
            <p className="info-note">
              Build your cube, validate its colors, and follow a verified
              solution sequence. Move playback is planned for a later phase.
            </p>
          )}
          <div className="hero-stats">
            <div><strong>3 × 3</strong><span>Classic cube</span></div>
            <div><strong>6 faces</strong><span>One puzzle</span></div>
            <div><strong>Verified</strong><span>Move sequence</span></div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="glow" />
          <Suspense fallback={<div className="cube-stage-loading" role="status">Loading 3D preview…</div>}>
            <CubePreview cube={cube} />
          </Suspense>
          <div className="floating-label label-top">
            <span className="label-dot cyan" />
            3D INTERACTIVE
          </div>
          <div className="floating-label label-bottom">
            <span className="label-dot purple" />
            YOUR NEXT CHALLENGE
          </div>
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
        onSave={cubeState.saveCurrentCube}
        onRestore={cubeState.restoreSavedCube}
        onClearSaved={cubeState.clearSavedCube}
        saved={cubeState.saved}
        storageMessage={cubeState.storageMessage}
        onSolve={solveCube}
      />

      <section className="features" id="features">
        <div className="section-heading">
          <span>THE CUBELY EXPERIENCE</span>
          <h2>Scramble less. Understand more.</h2>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-number">01 / EXPLORE</span>
            <h3>See every angle</h3>
            <p>Explore a dimensional cube and get familiar with its six faces.</p>
          </article>
          <article className="feature-card">
            <span className="feature-number">02 / BUILD</span>
            <h3>Enter your colors</h3>
            <p>Enter all six faces and check whether the arrangement is physically possible.</p>
          </article>
          <article className="feature-card">
            <span className="feature-number">03 / SOLVE</span>
            <h3>Get a verified solution</h3>
            <p>Generate a genuine standard-notation move sequence. Playback is planned for a later phase.</p>
          </article>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <span className="section-kicker">YOUR JOURNEY STARTS HERE</span>
        <h2>Begin with a clear picture of your cube.</h2>
        <p>Enter the stickers, check the cube’s legality, and generate a verified solution sequence.</p>
        <a className="primary-button" href="#learn">Explore the basics ↗</a>
      </section>

      <section className="learn-section" id="learn">
        <span className="section-kicker">THE LANGUAGE OF THE CUBE</span>
        <h2>Six faces. A few simple symbols.</h2>
        <div className="notation-grid">
          {[
            ['R', 'Right face'],
            ['L', 'Left face'],
            ['U', 'Upper face'],
            ['D', 'Down face'],
            ['F', 'Front face'],
            ['B', 'Back face'],
          ].map(([move, label]) => (
            <div className="notation-card" key={move}>
              <strong>{move}</strong><span>{label}</span>
            </div>
          ))}
        </div>
        <p className="notation-note">
          An apostrophe, as in R′, means a counterclockwise quarter-turn
          when looking directly at that face. The number 2 means a half-turn.
        </p>
      </section>

      <footer className="footer">
        <a className="brand" href="#home">
          <span className="brand-icon">C</span>
          cubely<span className="brand-dot">.</span>
        </a>
        <p>Twist. Solve. Experience.</p>
        <span>Made for curious minds.</span>
      </footer>
    </main>
  );
}

export default App;
