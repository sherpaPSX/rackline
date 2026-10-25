import { bool, level } from './params.js';
import type { ModuleDef } from './types.js';

export const mix2x1: ModuleDef = {
  blockType: 0x0200,
  name: 'Mix 2 × 1',
  role: 'mixer',
  evidence: 'simulator',
  params: [
    level(2, 'input1Level', 'Input 1 level'),
    bool(3, 'input1Mute', 'Input 1 mute'),
    level(4, 'input2Level', 'Input 2 level'),
    bool(5, 'input2Mute', 'Input 2 mute'),
    level(6, 'outputLevel', 'Output level'),
    bool(7, 'outputMute', 'Output mute'),
  ],
  compact: ['input1Level', 'input2Level', 'outputLevel'],
  dspPercent: 0.5,
};
