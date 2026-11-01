import { DELAY } from '../units.js';
import { num } from './params.js';
import type { ModuleDef } from './types.js';

export const delay: ModuleDef = {
  blockType: 0x0301,
  name: 'Delay',
  role: 'processing',
  evidence: 'simulator',
  params: [num(2, 'delay', 'Delay', DELAY, 2)],
  compact: ['delay'],
  dspPercent: 2,
  // One block per Delay module in every measured config; a module set to more
  // than 500 ms may take several (unverified).
  delayBlocks: 1,
};
