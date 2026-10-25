import type { ParamInfo, ParamValue, StepValue } from '@rackline/api';
import { centeredScale, clamp, formatDb, formatHz, formatMs, linearScale, logScale } from '@rackline/ui-kit';
import type { ValueScale } from '@rackline/ui-kit';

export type NumberParam = Extract<ParamInfo, { kind: 'number' }>;
export type StepsParam = Extract<ParamInfo, { kind: 'steps' }>;
export type EnumParam = Extract<ParamInfo, { kind: 'enum' }>;

/**
 * Control position mapping for a number parameter: logarithmic for
 * frequency and bandwidth, 0 dB in the middle for gains that go both ways.
 */
export function numberScale(p: NumberParam): ValueScale {
  if ((p.unit === 'Hz' || p.unit === 'oct') && p.min > 0) return logScale(p.min, p.max);
  if ((p.unit === 'dB' || p.unit === 'dBFS') && p.min < 0 && p.max > 0) return centeredScale(p.min, p.max);
  return linearScale(p.min, p.max);
}

/** A steps parameter is edited as an index into its list. */
export const stepsScale = (p: StepsParam): ValueScale => linearScale(0, Math.max(1, p.steps.length - 1));

/** Digits after the point that the step needs, at most 2 (e.g. 0.25 dB → 2, 0.5 → 1). */
function digitsFor(step: number): number {
  for (let d = 0; d < 2; d++) if (Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) < 1e-9) return d;
  return 2;
}

export function formatNumber(unit: NumberParam['unit'], value: number, step = 0.1): string {
  switch (unit) {
    case 'dB':
    case 'dBFS':
      return formatDb(value, Math.max(1, digitsFor(step)));
    case 'Hz':
      return formatHz(value);
    case 'ms':
      return formatMs(value);
    case 'oct':
      return `${value.toFixed(2)} oct`;
    case 'ratio':
      return `${value}:1`;
  }
}

function formatStep(unit: StepsParam['unit'], step: StepValue | undefined): string {
  if (step === undefined) return '–';
  if (step === 'inf') return unit === 'ratio' ? '∞:1' : '∞';
  return formatNumber(unit, step);
}

/** Text of a value as the engineer reads it, e.g. "−6.0 dB", "LR24", "On". */
export function formatParam(p: ParamInfo, value: ParamValue | undefined): string {
  if (value === undefined) return '–';
  switch (p.kind) {
    case 'number':
      return typeof value === 'number' ? formatNumber(p.unit, value, p.step) : '–';
    case 'steps':
      return typeof value === 'number' ? formatStep(p.unit, p.steps[value]) : '–';
    case 'enum':
      return p.options.find((o) => o.value === value)?.label ?? String(value);
    case 'bool':
      return value === true ? 'On' : 'Off';
    case 'flags':
      return typeof value === 'object' ? p.flags.filter((f) => value[f]).join(', ') || 'None' : '–';
  }
}

/**
 * The value as the core will store it: numbers rounded to the step and
 * clamped to the range (never ±∞, which JSON cannot carry), indexes to
 * whole steps. Other kinds pass through.
 */
export function quantize(p: ParamInfo, value: ParamValue): ParamValue {
  if (typeof value !== 'number') return value;
  if (p.kind === 'number') {
    const rounded = Math.round((clamp(value, p.min, p.max) - p.min) / p.step) * p.step + p.min;
    return clamp(Number(rounded.toFixed(9)), p.min, p.max);
  }
  if (p.kind === 'steps') return clamp(Math.round(value), 0, Math.max(0, p.steps.length - 1));
  return value;
}

/** Whether two values are the same setting: numbers within half a step. */
export function sameValue(p: ParamInfo | undefined, a: ParamValue | undefined, b: ParamValue | undefined): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    const tolerance = p?.kind === 'number' ? p.step / 2 : 1e-9;
    return Math.abs(a - b) <= tolerance;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((k) => Boolean(a[k]) === Boolean(b[k]));
  }
  return a === b;
}
