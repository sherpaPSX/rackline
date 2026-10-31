import { describe, expect, it } from 'vitest';
import type { ModuleInfo } from '@rackline/api';
import { crossoverBands, crossoverEdges, peqBands, peqFilters, readPeqBand, slopeOf } from '../src/curves.js';
import { psxState } from './fixtures.js';

const state = psxState();
const module = (name: string): ModuleInfo => {
  const m = state.setup?.modules.find((x) => x.name === name);
  if (!m) throw new Error(`no module ${name}`);
  return m;
};
const reader = (blockId: number) => (key: string) => state.values[String(blockId)]?.[key];

describe('curves from module parameters', () => {
  it('reads the bands of a PEQ and skips switched-off and all-pass bands', () => {
    const peq = module('Parametric EQ (2)');
    expect(peqBands(peq)).toEqual([1, 2]);
    // LF left (block 22): band 1 is a −6 dB bell at 292 Hz, band 2 an all-pass that is off.
    const bands = peqBands(peq).map((b) => readPeqBand(peq, reader(22), b));
    expect(bands[1]).toMatchObject({ on: false, typeLabel: 'All-pass (1st order)' });
    expect(peqFilters(bands)).toEqual([{ kind: 'peak', freq: 292, gainDb: -6, q: expect.closeTo(2.7, 1) as unknown as number }]);
  });

  it('maps crossover type labels to slopes', () => {
    expect(slopeOf('LR24')).toEqual({ family: 'linkwitzRiley', order: 4 });
    expect(slopeOf('BW18')).toEqual({ family: 'butterworth', order: 3 });
    expect(slopeOf('Bessel12')).toEqual({ family: 'bessel', order: 2 });
    expect(slopeOf('1st order')).toEqual({ family: 'butterworth', order: 1 });
    expect(slopeOf('Off')).toBeUndefined();
  });

  it('builds the bands of a 3-way and a 2-way crossover', () => {
    const three = module('3-way Crossover');
    expect(crossoverEdges(three).map((e) => e.name)).toEqual(['High HP', 'Mid LP', 'Mid HP', 'Low LP']);
    // Tops crossover, left (block 55): LR24 everywhere.
    const bands = crossoverBands(three, reader(55));
    expect(bands.map((b) => [b.name, b.filters.map((f) => f.kind)])).toEqual([
      ['High', ['highPass']],
      ['Mid', ['highPass', 'lowPass']],
      ['Low', ['lowPass']],
    ]);
    const two = module('2-way Crossover');
    expect(crossoverBands(two, reader(52)).map((b) => b.name)).toEqual(['High', 'Low']);
  });
});
