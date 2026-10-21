export const FACES = ['U', 'D', 'F', 'B', 'L', 'R'] as const;

export type Face = (typeof FACES)[number];
export type StickerColor =
  | 'white'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'orange'
  | 'red';
export type Sticker = StickerColor | null;
export type FaceStickers = Sticker[];
export type CubeState = Record<Face, FaceStickers>;

export const CENTER_COLORS: Record<Face, StickerColor> = {
  U: 'white',
  D: 'yellow',
  F: 'green',
  B: 'blue',
  L: 'orange',
  R: 'red',
};

export const COLORS: { color: StickerColor; label: string; hex: string }[] = [
  { color: 'white', label: 'White', hex: '#f8fafc' },
  { color: 'yellow', label: 'Yellow', hex: '#facc15' },
  { color: 'green', label: 'Green', hex: '#22c55e' },
  { color: 'blue', label: 'Blue', hex: '#3b82f6' },
  { color: 'orange', label: 'Orange', hex: '#f97316' },
  { color: 'red', label: 'Red', hex: '#ef4444' },
];

export const FACE_LABELS: Record<Face, string> = {
  U: 'Up',
  D: 'Down',
  F: 'Front',
  B: 'Back',
  L: 'Left',
  R: 'Right',
};

export function createEmptyCubeState(): CubeState {
  return Object.fromEntries(
    FACES.map((face) => {
      const stickers: FaceStickers = Array(9).fill(null);
      stickers[4] = CENTER_COLORS[face];
      return [face, stickers];
    }),
  ) as CubeState;
}

export function createSolvedCubeState(): CubeState {
  return Object.fromEntries(
    FACES.map((face) => [face, Array<Sticker>(9).fill(CENTER_COLORS[face])]),
  ) as CubeState;
}

export function setSticker(
  cube: CubeState,
  face: Face,
  index: number,
  color: Sticker,
): CubeState {
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    throw new RangeError('Sticker index must be between 0 and 8.');
  }
  if (index === 4 && color !== CENTER_COLORS[face]) {
    throw new Error(`The ${FACE_LABELS[face]} face center must stay ${CENTER_COLORS[face]}.`);
  }

  return {
    ...cube,
    [face]: cube[face].map((sticker, stickerIndex) =>
      stickerIndex === index ? color : sticker,
    ),
  };
}

export function resetFace(cube: CubeState, face: Face): CubeState {
  return {
    ...cube,
    [face]: Array<Sticker>(9).fill(null).map((sticker, index) =>
      index === 4 ? CENTER_COLORS[face] : sticker,
    ),
  };
}
