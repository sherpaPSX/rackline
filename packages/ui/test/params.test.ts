import { describe, expect, it } from 'vitest';
import type { ParamInfo } from '@rackline/api';
import { formatParam, numberScale, quantize, sameValue } from '../src/index.js';
import type { NumberParam } from '../src/index.js';
import { psxState } from './fixtures.js';

const setup = psxState().setup;
const param = (moduleName: string, key: string): ParamInfo => {
  const p = setup?.modules.find((m) => m.name === moduleName)?.params.find((q) => q.key === key);
  if (!p) throw new Error(`${moduleName}.${key} missing in fixture`);
  return p;
};
const number = (moduleName: string, key: string): NumberParam => {
  const p = param(moduleName, key);
  if (p.kind !== 'number') throw new Error('not a number parameter');
  return p;
};

describe('parameter values', () => {
  it('rounds to the step and clamps like the core', () => {
    const trim = param('Output', 'trim');
    expect(quantize(trim, -6.3)).toBe(-6.5);
    expect(quantize(trim, 40)).toBe(16);
    // A fader pulled to the bottom reads −∞, which JSON cannot carry.
    expect(quantize(trim, -Infinity)).toBe(-30);
    const delay = param('Delay', 'delay');
    expect(quantize(delay, 0.23)).toBeCloseTo(11 / 48, 9);
    expect(quantize(param('Limiter', 'attack'), 3.6)).toBe(4);
    expect(quantize(param('Output', 'mute'), true)).toBe(true);
  });

  it('formats in engineering units', () => {
    expect(formatParam(param('Output', 'trim'), -6.5)).toBe('−6.5 dB');
    expect(formatParam(param('Parametric EQ (4)', 'band1Gain'), 1.25)).toBe('+1.25 dB');
    expect(formatParam(param('3-way Crossover', 'lowUpperFreq'), 1200)).toBe('1.20 kHz');
    expect(formatParam(param('3-way Crossover', 'lowUpperType'), 2)).toBe('LR24');
    expect(formatParam(param('Delay', 'delay'), 1365)).toBe('1365.0 ms');
    expect(formatParam(param('Level', 'options'), { mute: true, offAtMin: false })).toBe('mute');
    expect(formatParam(param('Limiter', 'attack'), undefined)).toBe('–');
  });

  it('puts frequency on a log scale and 0 dB in the middle of a lopsided range', () => {
    expect(numberScale(number('3-way Crossover', 'lowUpperFreq')).toPosition(632.5)).toBeCloseTo(0.5, 2);
    expect(numberScale(number('Output', 'trim')).toPosition(0)).toBe(0.5);
    expect(numberScale(number('Delay', 'delay')).toPosition(682.5)).toBe(0.5);
  });

  it('treats values within half a step as the same setting', () => {
    const delay = param('Delay', 'delay');
    expect(sameValue(delay, 11 / 48, 0.229)).toBe(true);
    expect(sameValue(delay, 11 / 48, 12 / 48)).toBe(false);
    expect(sameValue(param('Level', 'options'), { mute: true }, { mute: true, offAtMin: false })).toBe(true);
  });
});
