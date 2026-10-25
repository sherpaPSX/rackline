import { describe, expect, it } from 'vitest';
import { decodeParam, findModule, type ParamDef } from '../src/index.js';
import { dragNetDisplaySamples } from './fixtures.js';

/** The number Drag Net shows: "-6.25 dB" → −6.25, "4.5 : 1" → 4.5, "Off" → −∞, "Infinite s" → ∞. */
function shown(text: string): number | boolean {
  if (text === 'True' || text === 'False') return text === 'True';
  if (text.startsWith('Off')) return -Infinity;
  if (text.startsWith('Infinite') || text === '10000 : 1') return Infinity;
  return Number.parseFloat(text);
}

/** Rows inside the parameter's valid range; Drag Net shows memory garbage past the end of its tables. */
function inRange(param: ParamDef, raw: number): boolean {
  switch (param.kind) {
    case 'number':
      return raw >= param.conversion.rawMin && raw <= param.conversion.rawMax;
    case 'steps':
      return raw < param.steps.length;
    case 'enum':
      return raw in param.options;
    default:
      return raw <= 1;
  }
}

/** Drag Net rounds frequencies to 0.5 Hz and cuts tone levels to one decimal. */
const tolerance = (param: ParamDef): number => (param.kind === 'steps' && param.key === 'lowCut' ? 0.5 : 0.1);

/** AGC gain hold: Drag Net shows "0 s" for every raw 0..30, the mapping follows the help instead (agc.ts). */
const KNOWN_DIFFERENT = new Set(['502:8']);

describe('registry conversions match what Drag Net shows (simulator)', () => {
  const rows = dragNetDisplaySamples();

  it('has samples', () => {
    expect(rows.length).toBeGreaterThan(100);
  });

  for (const [blockType, index, raw, display] of rows) {
    const param = findModule(blockType)?.params.find((p) => p.index === index);
    const key = `${blockType.toString(16)}:${index}`;
    if (KNOWN_DIFFERENT.has(key) && Number.isFinite(shown(display))) continue;
    if (param === undefined || !inRange(param, raw) || param.kind === 'enum' || param.kind === 'flags') continue;
    it(`${key} raw ${raw} = ${display}`, () => {
      const value = decodeParam(param, raw);
      const expected = shown(display);
      if (typeof value === 'boolean' || typeof expected === 'boolean') expect(value).toBe(expected);
      else if (!Number.isFinite(expected)) expect(value).toBe(expected);
      else expect(Math.abs((value as number) - expected)).toBeLessThanOrEqual(tolerance(param));
    });
  }
});
