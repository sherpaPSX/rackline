import { describe, expect, it } from 'vitest';
import { decodeBlockValues, findModule, type ModuleDef } from '../src/index.js';
import { MATRIX_BLOCK_TYPES, SAMPLED_SIZES } from '../src/registry/mixer.js';
import { dragNetParamNames } from './fixtures.js';

/** Block types whose full parameter list was reported by Drag Net (simulator). */
const SAMPLED = [
  ...SAMPLED_SIZES.flatMap((n) => [0x0200 + n - 2, 0x0210 + n - 2]),
  ...Object.values(MATRIX_BLOCK_TYPES),
  0x0a01,
  0x0b0c,
];

/** Drag Net parameters deliberately left out: view flags, status values and the undecoded detect mode. */
const notExposed = (name: string): boolean =>
  /^(View|Target Gain|Gain Margin|Last Changed|DetectMode)/.test(name);

describe('mix, select, matrix, auto mixer and feedback suppressor layouts match Drag Net (simulator)', () => {
  for (const blockType of SAMPLED) {
    const module = findModule(blockType) as ModuleDef;
    const names = dragNetParamNames(blockType);

    it(`${blockType.toString(16)}: every Drag Net parameter is mapped except view flags and status values`, () => {
      expect(module).toBeDefined();
      expect(names.size).toBeGreaterThan(0);
      const mapped = new Set(module.params.map((p) => p.index));
      const unmapped = [...names].filter(([index]) => !mapped.has(index)).map(([, name]) => name);
      expect(unmapped.filter((name) => !notExposed(name))).toEqual([]);
      for (const p of module.params) expect(names.has(p.index), p.key).toBe(true);
    });
  }

  it('names matrix crosspoints output-major like Drag Net', () => {
    const names = dragNetParamNames(0x0817);
    const param = (key: string) => findModule(0x0817)?.params.find((p) => p.key === key)?.index ?? -1;
    expect(names.get(param('out1In2Level'))).toBe('Level: Out1:In2');
    expect(names.get(param('out6In6Mute'))).toBe('Mute: Out6:In6');
    expect(names.get(param('input1Level'))).toBe('Level: In1');
    expect(names.get(param('output6Invert'))).toBe('Invert: Out6');
    expect(names.get(param('autoCancel'))).toBe('AutoCancel');
  });

  it('decodes the output level and the selected input', () => {
    expect(decodeBlockValues(0x0208, [{ index: 22, value: 192 }])).toEqual({ outputLevel: 0 });
    expect(decodeBlockValues(0x0218, [{ index: 2, value: 9 }])).toEqual({ input: 9 });
  });
});
