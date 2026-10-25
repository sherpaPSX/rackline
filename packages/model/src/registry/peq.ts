import { FREQUENCY, PEQ_BANDWIDTH, PEQ_GAIN } from '../units.js';
import { bool, choice, num } from './params.js';
import type { ModuleDef, ParamDef } from './types.js';

/** Type 3 appears in Lukas's presets but was never mapped; "Low cut" is a guess by symmetry with 4 = High cut. */
export const PEQ_FILTER_TYPES = {
  0: 'Band',
  1: 'Low shelf',
  2: 'High shelf',
  3: 'Low cut',
  4: 'High cut',
  5: 'Horn EQ',
  6: 'All-pass',
};

/** RPM PEQs hold 1 to 15 filters; the count is fixed at compile time. */
export const PEQ_MAX_FILTERS = 15;
const PEQ_BASE_TYPE = 0x0600;
/** Filter counts seen in real samples; the other type numbers follow the same pattern but are guessed. */
const SEEN_FILTER_COUNTS = [2, 4, 9];

/** Filter n (1-based) uses indexes 5n−3 … 5n+1. */
function filterParams(n: number): ParamDef[] {
  const i = 5 * n;
  return [
    bool(i - 3, `band${n}Enable`, `Filter ${n} on`),
    choice(i - 2, `band${n}Type`, `Filter ${n} type`, PEQ_FILTER_TYPES),
    num(i - 1, `band${n}Freq`, `Filter ${n} frequency`, FREQUENCY, 2),
    num(i, `band${n}Width`, `Filter ${n} bandwidth`, PEQ_BANDWIDTH),
    num(i + 1, `band${n}Gain`, `Filter ${n} gain`, PEQ_GAIN),
  ];
}

/** Parametric EQ with `filters` filters: block type 0x0600 + filters − 1. */
export function peq(filters: number): ModuleDef {
  return {
    blockType: PEQ_BASE_TYPE + filters - 1,
    name: `Parametric EQ (${filters})`,
    role: 'processing',
    evidence: filters === 9 ? 'simulator' : SEEN_FILTER_COUNTS.includes(filters) ? 'sample' : 'guessed',
    params: Array.from({ length: filters }, (_, k) => filterParams(k + 1)).flat(),
    // The compact view of a PEQ is its response curve, not single controls.
    compact: [],
    dspPercent: 1.2 + 0.55 * filters,
  };
}

/** Number of filters of a PEQ block type, or undefined if it is not a PEQ. */
export function peqFilterCount(blockType: number): number | undefined {
  const n = blockType - PEQ_BASE_TYPE + 1;
  return n >= 1 && n <= PEQ_MAX_FILTERS ? n : undefined;
}
