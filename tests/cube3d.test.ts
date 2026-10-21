import { describe, expect, it } from 'vitest';
import { COLORS, createEmptyCubeState, setSticker, type Face } from '../src/cubeState';
import { getCubeViewRotationForKey, mapCubeStateToCubelets } from '../src/cube3d';

describe('keyboard cube view rotation', () => {
  it('maps arrow keys to incremental camera rotations', () => {
    const angle = Math.PI / 12;
    expect(getCubeViewRotationForKey('ArrowLeft')).toEqual({
      horizontalRadians: angle,
      verticalRadians: 0,
    });
    expect(getCubeViewRotationForKey('ArrowRight')).toEqual({
      horizontalRadians: -angle,
      verticalRadians: 0,
    });
    expect(getCubeViewRotationForKey('ArrowUp')).toEqual({
      horizontalRadians: 0,
      verticalRadians: angle,
    });
    expect(getCubeViewRotationForKey('ArrowDown')).toEqual({
      horizontalRadians: 0,
      verticalRadians: -angle,
    });
    expect(getCubeViewRotationForKey('Enter')).toBeNull();
  });
});

function expectedPosition(face: Face, index: number): readonly [number, number, number] {
  const row = Math.floor(index / 3);
  const column = index % 3;
  switch (face) {
    case 'U': return [column - 1, 1, row - 1];
    case 'D': return [column - 1, -1, 1 - row];
    case 'F': return [column - 1, 1 - row, 1];
    case 'B': return [1 - column, 1 - row, -1];
    case 'L': return [-1, 1 - row, column - 1];
    case 'R': return [1, 1 - row, 1 - column];
  }
}

describe('mapCubeStateToCubelets', () => {
  it('maps all 54 face stickers exactly once across 27 cubelets', () => {
    const cube = createEmptyCubeState();
    const mapped = mapCubeStateToCubelets(cube);

    expect(mapped).toHaveLength(27);
    expect(mapped.reduce((total, cubelet) => total + cubelet.stickers.length, 0)).toBe(54);
    for (const face of ['U', 'D', 'F', 'B', 'L', 'R'] as const) {
      expect(mapped.flatMap((cubelet) =>
        cubelet.stickers.filter((sticker) => sticker.face === face),
      )).toHaveLength(9);
    }
  });

  it('preserves face-grid colors and indices at each mapped cubelet position', () => {
    const cube = createEmptyCubeState();
    const faces: Face[] = ['U', 'D', 'F', 'B', 'L', 'R'];
    faces.forEach((face, faceIndex) => {
      cube[face] = Array.from({ length: 9 }, (_, index) =>
        COLORS[(faceIndex + index) % COLORS.length].color,
      );
    });

    const mapped = mapCubeStateToCubelets(cube);
    const actual = mapped.flatMap((cubelet) =>
      cubelet.stickers.map((sticker) => ({
        position: cubelet.position,
        face: sticker.face,
        index: sticker.index,
        color: sticker.color,
      })),
    );

    for (const sticker of actual) {
      expect(sticker.color).toBe(cube[sticker.face][sticker.index]);
    }

    const lookup = (face: Face, index: number) =>
      actual.filter((sticker) => sticker.face === face && sticker.index === index);
    for (const face of faces) {
      for (let index = 0; index < 9; index += 1) {
        const mappedSticker = lookup(face, index);
        expect(mappedSticker).toHaveLength(1);
        expect(mappedSticker[0].position).toEqual(expectedPosition(face, index));
      }
    }
  });

  it('maps front, back, left, right, up, and down centers to their matching surfaces', () => {
    const mapped = mapCubeStateToCubelets(createEmptyCubeState());
    const centerPosition: Record<Face, readonly [number, number, number]> = {
      U: [0, 1, 0],
      D: [0, -1, 0],
      F: [0, 0, 1],
      B: [0, 0, -1],
      L: [-1, 0, 0],
      R: [1, 0, 0],
    };

    for (const [face, position] of Object.entries(centerPosition) as [Face, readonly [number, number, number]][]) {
      const centerCubelet = mapped.find((cubelet) =>
        cubelet.position.every((coordinate, axis) => coordinate === position[axis]),
      );
      expect(centerCubelet?.stickers).toContainEqual({
        face,
        index: 4,
        color: createEmptyCubeState()[face][4],
      });
    }
  });

  it('reflects an editor sticker change at its matching rendered position', () => {
    const cube = setSticker(createEmptyCubeState(), 'F', 0, 'red');
    const mapped = mapCubeStateToCubelets(cube);
    const topLeftFrontCubelet = mapped.find(({ position }) =>
      position[0] === -1 && position[1] === 1 && position[2] === 1,
    );

    expect(topLeftFrontCubelet?.stickers).toContainEqual({
      face: 'F',
      index: 0,
      color: 'red',
    });
  });
});
