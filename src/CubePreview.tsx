import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RotateCcw, RotateCw } from 'lucide-react';
import {
  BoxGeometry,
  MeshStandardMaterial,
  type Material,
} from 'three';
import { COLORS, type CubeState, type Face } from './cubeState';
import { mapCubeStateToCubelets, type CubeCoordinate } from './cube3d';
import './CubePreview.css';

const STICKER_ROTATION: Record<Face, [number, number, number]> = {
  U: [-Math.PI / 2, 0, 0],
  D: [Math.PI / 2, 0, 0],
  F: [0, 0, 0],
  B: [0, Math.PI, 0],
  L: [0, -Math.PI / 2, 0],
  R: [0, Math.PI / 2, 0],
};

function stickerPosition(
  position: CubeCoordinate,
  face: Face,
): [number, number, number] {
  const [x, y, z] = position;
  const offset = 0.482;
  switch (face) {
    case 'U': return [x, offset, z];
    case 'D': return [x, -offset, z];
    case 'F': return [x, y, offset];
    case 'B': return [x, y, -offset];
    case 'L': return [-offset, y, z];
    case 'R': return [offset, y, z];
  }
}

function CubeScene({
  cube,
  autoRotate,
  controlsRef,
}: {
  cube: CubeState;
  autoRotate: boolean;
  controlsRef: RefObject<{ reset: () => void } | null>;
}) {
  const cubelets = useMemo(() => mapCubeStateToCubelets(cube), [cube]);
  const geometry = useMemo(() => new BoxGeometry(0.92, 0.92, 0.92), []);
  const stickerGeometry = useMemo(() => new BoxGeometry(0.78, 0.78, 0.025), []);
  const coreMaterial = useMemo(
    () => new MeshStandardMaterial({ color: '#080b14', roughness: 0.52, metalness: 0.12 }),
    [],
  );
  const stickerMaterials = useMemo(
    () => new Map(COLORS.map(({ color, hex }) => [
      color,
      new MeshStandardMaterial({ color: hex, roughness: 0.34, metalness: 0.02 }),
    ])),
    [],
  );

  useEffect(() => () => {
    geometry.dispose();
    stickerGeometry.dispose();
    coreMaterial.dispose();
    stickerMaterials.forEach((material: Material) => material.dispose());
  }, [coreMaterial, geometry, stickerGeometry, stickerMaterials]);

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[5, 8, 7]} intensity={2.6} />
      <group rotation={[-0.32, -0.48, 0]}>
        {cubelets.map(({ position, stickers }) => (
          <group key={position.join(',')} position={position}>
            <mesh
              geometry={geometry}
              material={coreMaterial}
              castShadow
              receiveShadow
              dispose={null}
            />
            {stickers.map(({ face, index, color }) => {
              if (color === null) return null;
              const material = stickerMaterials.get(color);
              if (!material) return null;
              return (
                <mesh
                  key={`${face}-${index}`}
                  geometry={stickerGeometry}
                  material={material}
                  position={stickerPosition(position, face)}
                  rotation={STICKER_ROTATION[face]}
                  dispose={null}
                />
              );
            })}
          </group>
        ))}
      </group>
      <OrbitControls
        ref={(controls) => {
          controlsRef.current = controls;
        }}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={4.3}
        maxDistance={9}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI - 0.12}
        autoRotate={autoRotate}
        autoRotateSpeed={1.25}
      />
    </>
  );
}

function CubePreview({ cube }: { cube: CubeState }) {
  const [autoRotate, setAutoRotate] = useState(false);
  const controlsRef = useRef<{ reset: () => void } | null>(null);

  return (
    <div className="cube-stage" role="group" aria-label="Interactive 3D cube preview">
      <Canvas
        aria-label="3D Rubik's Cube; drag to rotate"
        camera={{ position: [4.1, 3.2, 5.2], fov: 38 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        fallback={(
          <div className="cube-render-error" role="status">
            3D preview is unavailable in this browser.
          </div>
        )}
      >
        <Suspense fallback={null}>
          <CubeScene cube={cube} autoRotate={autoRotate} controlsRef={controlsRef} />
        </Suspense>
      </Canvas>

      <div className="cube-controls">
        <button
          className="cube-control-button"
          type="button"
          onClick={() => controlsRef.current?.reset()}
          aria-label="Reset cube view"
          title="Reset view"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Reset view
        </button>
        <button
          className={autoRotate ? 'cube-control-button active' : 'cube-control-button'}
          type="button"
          onClick={() => setAutoRotate((current) => !current)}
          aria-pressed={autoRotate}
          aria-label={autoRotate ? 'Turn auto-rotation off' : 'Turn auto-rotation on'}
          title={autoRotate ? 'Turn auto-rotation off' : 'Turn auto-rotation on'}
        >
          <RotateCw size={15} aria-hidden="true" />
          Auto-rotate {autoRotate ? 'on' : 'off'}
        </button>
      </div>
      <p className="cube-hint">DRAG TO ROTATE</p>
    </div>
  );
}

export default CubePreview;
