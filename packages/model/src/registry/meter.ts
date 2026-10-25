import type { ModuleDef } from './types.js';

/** Meter: a level display only, no parameters. */
export const meter: ModuleDef = {
  blockType: 0x0400,
  name: 'Meter',
  role: 'processing',
  evidence: 'simulator',
  params: [],
  compact: [],
  // Not measured.
  dspPercent: 0.2,
};
