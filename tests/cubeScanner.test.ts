import { describe, expect, it, vi } from 'vitest';
import { createSolvedCubeState, FACES, type StickerColor } from '../src/cubeState';
import {
  buildCubeFromScans,
  classifyStickerColor,
  classifyStickerColorWithConfidence,
  rotateFaceSamples,
  requestCameraStream,
  stopCameraStream,
  type CubeScans,
  type RGBSample,
} from '../src/cubeScanUtils';
import { validateCube } from '../src/cubeValidation';

const samplesByColor: Record<StickerColor, RGBSample> = {
  white: { red: 245, green: 245, blue: 245 },
  yellow: { red: 245, green: 220, blue: 20 },
  green: { red: 20, green: 170, blue: 65 },
  blue: { red: 30, green: 85, blue: 210 },
  orange: { red: 240, green: 115, blue: 20 },
  red: { red: 210, green: 25, blue: 30 },
};

describe('cube scanner color handling', () => {
  it('classifies a sample against calibrated center colors', () => {
    expect(classifyStickerColor(
      { red: 225, green: 32, blue: 35 },
      { ...samplesByColor },
    )).toBe('red');
  });

  it('reports confidence and flags samples far from their calibrated colors', () => {
    const exact = classifyStickerColorWithConfidence(samplesByColor.red, samplesByColor);
    const uncertain = classifyStickerColorWithConfidence(
      { red: 110, green: 110, blue: 110 },
      samplesByColor,
    );
    expect(exact.confidence).toBe(1);
    expect(exact.uncertain).toBe(false);
    expect(uncertain.uncertain).toBe(true);
  });

  it('rotates the 3-by-3 sample grid clockwise', () => {
    const samples = Array.from({ length: 9 }, (_, index) => ({
      red: index,
      green: 0,
      blue: 0,
    }));
    expect(rotateFaceSamples(samples).map((sample) => sample.red)).toEqual([
      6, 3, 0,
      7, 4, 1,
      8, 5, 2,
    ]);
    expect(rotateFaceSamples(samples, 4)).toEqual(samples);
  });

  it('reconstructs the solved cube from six calibrated face scans', () => {
    const scans: CubeScans = Object.fromEntries(FACES.map((face) => {
      const color = createSolvedCubeState()[face][4] as StickerColor;
      return [face, {
        samples: Array.from({ length: 9 }, () => samplesByColor[color]),
        clockwiseTurns: 0,
      }];
    }));
    const cube = buildCubeFromScans(scans);
    expect(cube).toEqual(createSolvedCubeState());
    expect(validateCube(cube).valid).toBe(true);
  });

  it('preserves manual sticker corrections and fixed centers', () => {
    const scans: CubeScans = Object.fromEntries(FACES.map((face) => [
      face,
      { samples: Array.from({ length: 9 }, () => samplesByColor.white), clockwiseTurns: 0 },
    ]));
    const cube = buildCubeFromScans(scans, { F: { 0: 'red', 4: 'blue' } });
    expect(cube.F[0]).toBe('red');
    expect(cube.F[4]).toBe('green');
  });

  it('requires six complete face scans', () => {
    expect(() => buildCubeFromScans({})).toThrow(/all six/i);
    expect(() => buildCubeFromScans({
      U: { samples: [], clockwiseTurns: 0 },
      D: { samples: [], clockwiseTurns: 0 },
      F: { samples: [], clockwiseTurns: 0 },
      B: { samples: [], clockwiseTurns: 0 },
      L: { samples: [], clockwiseTurns: 0 },
      R: { samples: [], clockwiseTurns: 0 },
    })).toThrow(/exactly nine/i);
  });

  it('stops every camera track during cleanup', () => {
    const stop = vi.fn();
    stopCameraStream({ getTracks: () => [{ stop }, { stop }] });
    stopCameraStream(null);
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('requests the preferred camera without requiring an exact facing mode', async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    await expect(requestCameraStream({ getUserMedia }, 'environment')).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
  });

  it('retries without a facing constraint when the camera rejects that constraint', async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Unsupported facing mode'), {
        name: 'OverconstrainedError',
      }))
      .mockResolvedValueOnce(stream);

    await expect(requestCameraStream({ getUserMedia }, 'user')).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: false,
      video: true,
    });
  });

  it('does not retry camera permission failures', async () => {
    const error = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    const getUserMedia = vi.fn().mockRejectedValue(error);

    await expect(requestCameraStream({ getUserMedia }, 'environment')).rejects.toBe(error);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});
