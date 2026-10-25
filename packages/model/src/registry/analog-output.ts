import { bool, level } from './params.js';
import type { ModuleDef } from './types.js';

export const analogOutput: ModuleDef = {
  blockType: 0x0106,
  name: 'Output',
  role: 'output',
  evidence: 'simulator',
  params: [level(2, 'trim', 'Trim'), bool(3, 'mute', 'Mute'), bool(4, 'invert', 'Polarity invert')],
  compact: ['trim', 'mute', 'invert'],
  dspPercent: 0,
};
