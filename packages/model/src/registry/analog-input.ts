import { INPUT_TRIM, LEVEL } from '../units.js';
import { bool, choice, num } from './params.js';
import type { ModuleDef } from './types.js';

export const analogInput: ModuleDef = {
  blockType: 0x0105,
  name: 'Analog Input',
  role: 'input',
  evidence: 'simulator',
  params: [
    choice(2, 'sensitivity', 'Sensitivity', { 0: 'Pro (0 dB)', 1: 'Consumer (+12 dB)', 2: 'User' }),
    num(3, 'userTrim', 'User gain', LEVEL),
    num(4, 'trim', 'Trim', INPUT_TRIM),
    bool(5, 'mute', 'Mute'),
  ],
  compact: ['trim', 'mute'],
  dspPercent: 0,
};
