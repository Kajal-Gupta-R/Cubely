
import { useState } from 'react';
import './App.css';

const colors = [
  '#f8fafc', '#f8fafc', '#f8fafc',
  '#f8fafc', '#f8fafc', '#f8fafc',
  '#f8fafc', '#f8fafc', '#f8fafc',
];

function CubePreview() {
  const [rotation, setRotation] = useState({ x: -24, y: -32 });

  return (
    <div
      className="cube-stage"
      onPointerMove={(event) => {
        if (event.buttons === 1) {
          setRotation((previous) => ({
            x: previous.x + event.movementY * 0.6,
            y: previous.y + event.movementX * 0.6,
          }));
        }
      }}
    >
      <div
        className="cube"
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        }}
      >
        <div className="face front">
          {colors.map((color, i) => (
            <div className="sticker" key={i} style={{ background: color }} />
          ))}
        </div>
        <div className="face back">
          {Array.from({ length: 9 }, (_, i) => (
            <div className="sticker" key={i} style={{ background: '#22c55e' }} />
          ))}
        </div>
        <div className="face right">
          {Array.from({ length: 9 }, (_, i) => (
            <div className="sticker" key={i} style={{ background: '#ef4444' }} />
          ))}
        </div>
        <div className="face left">
          {Array.from({ length: 9 }, (_, i) => (
            <div className="sticker" key={i} style={{ background: '#f97316' }} />
          ))}
        </div>
        <div className="face top">
          {Array.from({ length: 9 }, (_, i) => (
            <div className="sticker" key={i} style={{ background: '#eab308' }} />
          ))}
        </div>
        <div className="face bottom">
          {Array.from({ length: 9 }, (_, i) => (
            <div className="sticker" key={i} style={{ background: '#ffffff' }} />
          ))}
        </div>
      </div>
      <p className="cube-hint">DRAG TO EXPLORE</p>
    </div>
  );
}

function App() {
  const [showInfo, setShowInfo] = useState(false);

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
        <a className="nav-cta" href="#how-it-works">Start solving ↗</a>
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
            Meet your new cube-solving companion. Explore your cube in 3D,
            discover every move, and turn that scrambled puzzle into a
            satisfying solution.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#how-it-works">
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
              solution one move at a time. The full solver is coming in
              subsequent development phases.
            </p>
          )}
          <div className="hero-stats">
            <div><strong>3 × 3</strong><span>Classic cube</span></div>
            <div><strong>6 faces</strong><span>One puzzle</span></div>
            <div><strong>1 move</strong><span>At a time</span></div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="glow" />
          <CubePreview />
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
            <p>Next, we'll build a guided editor to enter and validate your cube.</p>
          </article>
          <article className="feature-card">
            <span className="feature-number">03 / SOLVE</span>
            <h3>Learn each move</h3>
            <p>Follow a genuine solving sequence with clear, beginner-friendly guidance.</p>
          </article>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <span className="section-kicker">YOUR JOURNEY STARTS HERE</span>
        <h2>One puzzle. A whole new perspective.</h2>
        <p>We're building your solving journey in stages, starting with 3D exploration.</p>
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
