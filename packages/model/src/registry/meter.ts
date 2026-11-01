import { levelMeter } from '../meters.js';
import type { ModuleDef } from './types.js';

/** Meter: a level display only, no parameters. */
export const meter: ModuleDef = {
  blockType: 0x0400,
  name: 'Meter',
  role: 'processing',
  evidence: 'simulator',
  params: [],
  compact: [],
  // Guessed: index and scale like the converter meters; the device answers no index 0 … 9.
  meters: [levelMeter(0x8000, 'level', 'Level', 'dBFS')],
  // Not measured.
  dspPercent: 0.2,
};
