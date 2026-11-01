import { levelMeter } from '../meters.js';
import { bool, level } from './params.js';
import type { ModuleDef } from './types.js';

export const analogOutput: ModuleDef = {
  blockType: 0x0106,
  name: 'Output',
  role: 'output',
  evidence: 'simulator',
  params: [level(2, 'trim', 'Trim'), bool(3, 'mute', 'Mute'), bool(4, 'invert', 'Polarity invert')],
  compact: ['trim', 'mute', 'invert'],
  // The converter level first: the UI shows the first meter where there is room for one.
  meters: [levelMeter(0x8001, 'dac', 'Before D/A', 'dBFS'), levelMeter(0x8002, 'analog', 'Analog out', 'dBu')],
  dspPercent: 0,
};
