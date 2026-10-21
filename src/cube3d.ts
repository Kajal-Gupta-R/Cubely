import { type CubeState, type Face, type Sticker } from './cubeState';

export type CubeCoordinate = readonly [x: number, y: number, z: number];

export interface CubeletSticker {
  face: Face;
  index: number;
  color: Sticker;
}

export interface CubeletView {
  position: CubeCoordinate;
  stickers: CubeletSticker[];
}

function faceletIndex(face: Face, position: CubeCoordinate): number {
  const [x, y, z] = position;
  let row: number;
  let column: number;

  switch (face) {
    case 'U':
      row = z + 1;
      column = x + 1;
      break;
    case 'D':
      row = 1 - z;
      column = x + 1;
      break;
    case 'F':
      row = 1 - y;
      column = x + 1;
      break;
    case 'B':
      row = 1 - y;
      column = 1 - x;
      break;
    case 'L':
      row = 1 - y;
      column = z + 1;
      break;
    case 'R':
      row = 1 - y;
      column = 1 - z;
      break;
  }

  return row * 3 + column;
}

function getSticker(
  cube: CubeState,
  face: Face,
  position: CubeCoordinate,
): CubeletSticker {
  const index = faceletIndex(face, position);
  return { face, index, color: cube[face][index] };
}

/**
 * Maps row-major face grids (viewed from outside the cube) onto the exterior
 * of the 27 cubelets. U's top row faces back; D's top row faces front.
 */
export function mapCubeStateToCubelets(cube: CubeState): CubeletView[] {
  const cubelets: CubeletView[] = [];

  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        const position: CubeCoordinate = [x, y, z];
        const stickers: CubeletSticker[] = [];
        if (y === 1) stickers.push(getSticker(cube, 'U', position));
        if (y === -1) stickers.push(getSticker(cube, 'D', position));
        if (z === 1) stickers.push(getSticker(cube, 'F', position));
        if (z === -1) stickers.push(getSticker(cube, 'B', position));
        if (x === -1) stickers.push(getSticker(cube, 'L', position));
        if (x === 1) stickers.push(getSticker(cube, 'R', position));
        cubelets.push({ position, stickers });
      }
    }
  }

  return cubelets;
}
