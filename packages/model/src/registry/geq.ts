import { GEQ_GAIN, GEQ_LOW_CUT_HZ, geqToneLevel } from '../units.js';
import { bool, choice, num, steps } from './params.js';
import type { ModuleDef, ParamDef } from './types.js';

/** ISO ⅓-octave centre frequencies of the 30 sliders (indexes 2..31), as Drag Net names them. */
export const GEQ_BANDS_HZ = [
  25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000,
  5000, 6300, 8000, 10000, 12500, 16000, 20000,
] as const;

const bandParams: ParamDef[] = GEQ_BANDS_HZ.map((hz, k) =>
  num(2 + k, `band${k + 1}Gain`, `${hz < 1000 ? hz : `${hz / 1000}k`} Hz`, GEQ_GAIN),
);

/**
 * 30-band Perfect-Q graphic EQ. Costs about 29.5 % DSP per channel on the
 * RPM 26z, so the UI plan uses a 9-filter PEQ for the system EQ instead
 * (docs/dsp-limits.md). High cut (index 36) shows as 0 Hz in Drag Net for
 * every raw value 0..127, so its table is unknown and it is not exposed.
 */
export const graphicEq: ModuleDef = {
  blockType: 0x0613,
  name: '30-Band Graphic EQ',
  role: 'processing',
  evidence: 'simulator',
  params: [
    ...bandParams,
    steps(32, 'lowLevel', 'Low tone', 'dB', geqToneLevel(true)),
    steps(33, 'midLevel', 'Mid tone', 'dB', geqToneLevel(false)),
    steps(34, 'highLevel', 'High tone', 'dB', geqToneLevel(true)),
    steps(35, 'lowCut', 'Low cut', 'Hz', GEQ_LOW_CUT_HZ),
    num(37, 'inputLevel', 'Input level', GEQ_GAIN),
    num(38, 'outputLevel', 'Output level', GEQ_GAIN),
    bool(39, 'bypass', 'Bypass'),
    choice(40, 'range', 'Range', { 0: '±12 dB', 1: '±6 dB' }),
    choice(41, 'eqType', 'EQ type', { 0: 'Perfect-Q', 1: 'Proportional-Q' }),
  ],
  // The compact view of a graphic EQ is its response curve.
  compact: [],
  dspPercent: 29.5,
};
