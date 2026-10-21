import {
  CENTER_COLORS,
  FACES,
  createEmptyCubeState,
  type CubeState,
  type Face,
  type StickerColor,
} from './cubeState';

export interface RGBSample {
  red: number;
  green: number;
  blue: number;
}

export interface FaceScan {
  samples: RGBSample[];
  clockwiseTurns: number;
}

export type CubeScans = Partial<Record<Face, FaceScan>>;
export type StickerCorrections = Partial<Record<Face, Partial<Record<number, StickerColor>>>>;
export type ColorReferences = Record<StickerColor, RGBSample>;
export interface StickerClassification {
  color: StickerColor;
  confidence: number;
  uncertain: boolean;
}

export function stopCameraStream(
  stream: { getTracks: () => Array<{ stop: () => void }> } | null,
): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function requestCameraStream(
  mediaDevices: Pick<MediaDevices, 'getUserMedia'>,
  facingMode: 'environment' | 'user',
): Promise<MediaStream> {
  try {
    return await mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facingMode } },
    });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'OverconstrainedError') throw error;
    return mediaDevices.getUserMedia({ audio: false, video: true });
  }
}

const STICKER_COLORS: StickerColor[] = [
  'white',
  'yellow',
  'green',
  'blue',
  'orange',
  'red',
];

function linearize(channel: number): number {
  const normalized = Math.max(0, Math.min(255, channel)) / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function rgbToLab({ red, green, blue }: RGBSample): [number, number, number] {
  const r = linearize(red);
  const g = linearize(green);
  const b = linearize(blue);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const transform = (value: number) => value > 0.008856
    ? Math.cbrt(value)
    : (7.787 * value) + (16 / 116);
  const fx = transform(x);
  const fy = transform(y);
  const fz = transform(z);

  return [
    (116 * fy) - 16,
    500 * (fx - fy),
    200 * (fy - fz),
  ];
}

function colorDistance(first: RGBSample, second: RGBSample): number {
  const firstLab = rgbToLab(first);
  const secondLab = rgbToLab(second);
  return Math.hypot(
    firstLab[0] - secondLab[0],
    firstLab[1] - secondLab[1],
    firstLab[2] - secondLab[2],
  );
}

export function createColorReferences(scans: CubeScans): ColorReferences {
  if (!FACES.every((face) => scans[face]?.samples.length === 9)) {
    throw new Error('Scan all six complete faces before calibrating sticker colors.');
  }
  return Object.fromEntries(FACES.map((face) => {
    const scan = scans[face];
    if (!scan) throw new Error(`The ${face} face has not been scanned.`);
    const samples = rotateFaceSamples(scan.samples, scan.clockwiseTurns);
    return [CENTER_COLORS[face], samples[4]];
  })) as ColorReferences;
}

export function rotateFaceSamples(
  samples: readonly RGBSample[],
  clockwiseTurns = 1,
): RGBSample[] {
  if (samples.length !== 9) {
    throw new Error('A scanned face must contain exactly nine sticker samples.');
  }
  const turns = ((clockwiseTurns % 4) + 4) % 4;
  let rotated = [...samples];

  for (let turn = 0; turn < turns; turn += 1) {
    const next = Array<RGBSample>(9);
    for (let index = 0; index < 9; index += 1) {
      const row = Math.floor(index / 3);
      const column = index % 3;
      const targetIndex = column * 3 + (2 - row);
      next[targetIndex] = rotated[index];
    }
    rotated = next;
  }

  return rotated;
}

export function classifyStickerColor(
  sample: RGBSample,
  references: ColorReferences,
): StickerColor {
  return classifyStickerColorWithConfidence(sample, references).color;
}

export function classifyStickerColorWithConfidence(
  sample: RGBSample,
  references: ColorReferences,
): StickerClassification {
  const ranked = STICKER_COLORS
    .map((color) => ({ color, distance: colorDistance(sample, references[color]) }))
    .sort((first, second) => first.distance - second.distance);
  const nearest = ranked[0];
  const secondNearest = ranked[1];
  const distanceScore = Math.max(0, 1 - nearest.distance / 55);
  const separationScore = Math.max(
    0,
    (secondNearest.distance - nearest.distance) / Math.max(secondNearest.distance, 1),
  );
  const confidence = Math.min(1, distanceScore * separationScore);

  return {
    color: nearest.color,
    confidence,
    uncertain: confidence < 0.55,
  };
}

export function buildCubeFromScans(
  scans: CubeScans,
  corrections: StickerCorrections = {},
): CubeState {
  if (!FACES.every((face) => scans[face] !== undefined)) {
    throw new Error('Scan all six cube faces before using the scanned cube.');
  }

  const orientedScans = Object.fromEntries(FACES.map((face) => {
    const scan = scans[face];
    if (!scan || scan.samples.length !== 9) {
      throw new Error(`The ${face} face scan must contain exactly nine samples.`);
    }
    return [face, rotateFaceSamples(scan.samples, scan.clockwiseTurns)];
  })) as Record<Face, RGBSample[]>;
  const references = Object.fromEntries(FACES.map((face) => [
    CENTER_COLORS[face],
    orientedScans[face][4],
  ])) as ColorReferences;
  const cube = createEmptyCubeState();

  for (const face of FACES) {
    cube[face] = orientedScans[face].map((sample, index) => (
      index === 4
        ? CENTER_COLORS[face]
        : corrections[face]?.[index] ?? classifyStickerColorWithConfidence(sample, references).color
    ));
  }

  return cube;
}
