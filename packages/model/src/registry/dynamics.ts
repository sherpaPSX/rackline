import { ATTACK_MS, COMPRESSOR_THRESHOLD, dbRange, LIMITER_THRESHOLD, rate, RATIO, RELEASE_MS, SC_RATIO } from '../units.js';
import { reductionMeter } from '../meters.js';
import { bool, num, steps } from './params.js';
import type { ModuleDef } from './types.js';

export const compressor: ModuleDef = {
  blockType: 0x0500,
  name: 'Compressor',
  role: 'processing',
  evidence: 'simulator',
  params: [
    num(2, 'threshold', 'Threshold', COMPRESSOR_THRESHOLD),
    steps(3, 'attack', 'Attack', 'ms', ATTACK_MS),
    steps(4, 'release', 'Release', 'ms', RELEASE_MS),
    steps(5, 'ratio', 'Ratio', 'ratio', RATIO),
  ],
  compact: ['threshold', 'ratio'],
  meters: [reductionMeter(0x8000)],
  dspPercent: 3,
};

export const limiter: ModuleDef = {
  blockType: 0x0501,
  name: 'Limiter',
  role: 'processing',
  evidence: 'simulator',
  params: [
    num(2, 'threshold', 'Threshold', LIMITER_THRESHOLD),
    steps(3, 'attack', 'Attack', 'ms', ATTACK_MS),
    steps(4, 'release', 'Release', 'ms', RELEASE_MS),
  ],
  compact: ['threshold'],
  dspPercent: 2.3,
};

/**
 * Side-chain compressors (ducking): mono 0x0509 (inputs In, S-C), stereo
 * 0x050a (In 1, S-C 1, In 2, S-C 2). Drag Net shows attack and release in
 * dB/s (raw = dB/s); its help speaks of 0.5 … 100 ms and 1 ms … 5 s, so the
 * help describes another unit and the range is not known. Knee 0 … 20 dB
 * (help) as dB = raw − 96.
 */
function sideChainCompressor(blockType: number, name: string): ModuleDef {
  return {
    blockType,
    name,
    role: 'processing',
    evidence: 'simulator',
    params: [
      num(2, 'threshold', 'Threshold', COMPRESSOR_THRESHOLD),
      steps(3, 'ratio', 'Ratio', 'ratio', SC_RATIO),
      num(4, 'attack', 'Attack', rate(0, 255)),
      num(5, 'release', 'Release', rate(0, 255)),
      num(6, 'knee', 'Knee', dbRange(0, 20)),
      bool(7, 'bypass', 'Bypass'),
    ],
    compact: ['threshold', 'ratio'],
    // Not measured; assumed like the compressor.
    dspPercent: 3,
  };
}

export const monoSideChainCompressor = sideChainCompressor(0x0509, 'Mono S-C Compressor');
export const stereoSideChainCompressor = sideChainCompressor(0x050a, 'Stereo S-C Compressor');
