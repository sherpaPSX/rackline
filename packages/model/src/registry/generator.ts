import { FREQUENCY, GENERATOR_LEVEL } from '../units.js';
import { bool, choice, num } from './params.js';
import type { ModuleDef } from './types.js';

export const generator: ModuleDef = {
  blockType: 0x0700,
  name: 'Signal Generator',
  role: 'generator',
  evidence: 'simulator',
  params: [
    choice(2, 'signal', 'Signal', { 0: 'Pink noise', 1: 'Sine' }),
    num(3, 'level', 'Level', GENERATOR_LEVEL),
    num(4, 'frequency', 'Sine frequency', FREQUENCY, 2),
    bool(5, 'mute', 'Mute'),
  ],
  compact: ['signal', 'level', 'mute'],
  dspPercent: 4,
};
