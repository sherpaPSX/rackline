import { ATTACK_MS, COMPRESSOR_THRESHOLD, LIMITER_THRESHOLD, RATIO, RELEASE_MS } from '../units.js';
import { num, steps } from './params.js';
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
