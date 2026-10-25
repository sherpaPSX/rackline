import { LEVEL, type Linear } from '../units.js';
import type { ParamDef } from './types.js';

/** Small builders so module files read like the index tables in docs/protocol.md. */

export const num = (index: number, key: string, label: string, conversion: Linear, size: 1 | 2 = 1): ParamDef => ({
  index,
  key,
  label,
  size,
  kind: 'number',
  conversion,
});

export const level = (index: number, key: string, label: string): ParamDef => num(index, key, label, LEVEL);

export const bool = (index: number, key: string, label: string): ParamDef => ({
  index,
  key,
  label,
  size: 1,
  kind: 'bool',
});

export const choice = (index: number, key: string, label: string, options: Record<number, string>): ParamDef => ({
  index,
  key,
  label,
  size: 1,
  kind: 'enum',
  options,
});

export const steps = (index: number, key: string, label: string, unit: 'ms' | 'ratio', values: readonly number[]): ParamDef => ({
  index,
  key,
  label,
  size: 1,
  kind: 'steps',
  unit,
  steps: values,
});
