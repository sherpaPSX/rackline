import { describe, expect, it } from 'vitest';
import { logFrequencies, qFromOctaves, responseDb } from './filters.js';
import type { Filter } from './filters.js';

const at = (filters: Filter[], hz: number) => responseDb(filters, [hz])[0];

describe('peak', () => {
  it('reaches its gain at the centre and is flat far away', () => {
    const f: Filter = { kind: 'peak', freq: 1000, gainDb: 6, q: 1.4 };
    expect(at([f], 1000)).toBeCloseTo(6, 3);
    expect(Math.abs(at([f], 20) ?? 1)).toBeLessThan(0.05);
  });
  it('is flat at 0 dB gain', () => {
    expect(at([{ kind: 'peak', freq: 1000, gainDb: 0, q: 1 }], 1000)).toBeCloseTo(0, 6);
  });
});

describe('shelves', () => {
  it('low shelf boosts the lows, half the gain at the corner', () => {
    const f: Filter = { kind: 'lowShelf', freq: 200, gainDb: 6 };
    expect(at([f], 20)).toBeCloseTo(6, 1);
    expect(at([f], 200)).toBeCloseTo(3, 1);
    expect(Math.abs(at([f], 15_000) ?? 1)).toBeLessThan(0.05);
  });
  it('high shelf cuts the highs', () => {
    const f: Filter = { kind: 'highShelf', freq: 4000, gainDb: -6 };
    expect(at([f], 18_000)).toBeCloseTo(-6, 0);
    expect(Math.abs(at([f], 50) ?? 1)).toBeLessThan(0.05);
  });
});

describe('crossover slopes', () => {
  it('Butterworth is −3 dB at the cutoff', () => {
    for (const order of [1, 2, 3, 4]) {
      expect(at([{ kind: 'lowPass', freq: 1000, family: 'butterworth', order }], 1000)).toBeCloseTo(-3.01, 1);
    }
  });
  it('Linkwitz-Riley low and high pass are both −6 dB at the cutoff', () => {
    const lp: Filter = { kind: 'lowPass', freq: 1000, family: 'linkwitzRiley', order: 4 };
    const hp: Filter = { kind: 'highPass', freq: 1000, family: 'linkwitzRiley', order: 4 };
    expect(at([lp], 1000)).toBeCloseTo(-6.02, 1);
    expect(at([hp], 1000)).toBeCloseTo(-6.02, 1);
  });
  it('a 24 dB/oct high-pass falls about 24 dB per octave well below the cutoff', () => {
    const hp: Filter = { kind: 'highPass', freq: 1000, family: 'butterworth', order: 4 };
    const drop = (at([hp], 125) ?? 0) - (at([hp], 62.5) ?? 0);
    expect(drop).toBeGreaterThan(23);
    expect(drop).toBeLessThan(25);
  });
  it('Bessel is gentler than Butterworth around the cutoff', () => {
    const b: Filter = { kind: 'lowPass', freq: 1000, family: 'bessel', order: 4 };
    const bw: Filter = { kind: 'lowPass', freq: 1000, family: 'butterworth', order: 4 };
    expect(at([b], 700)).toBeLessThan(at([bw], 700) ?? 0);
  });
});

describe('helpers', () => {
  it('converts one octave to Q 1.41', () => {
    expect(qFromOctaves(1)).toBeCloseTo(1.414, 3);
  });
  it('spaces frequencies logarithmically', () => {
    const f = logFrequencies(4, 20, 20_000);
    expect(f[0]).toBe(20);
    expect(f[1]).toBeCloseTo(200);
    expect(f[3]).toBeCloseTo(20_000);
  });
  it('adds filters in series', () => {
    const p: Filter = { kind: 'peak', freq: 1000, gainDb: 3, q: 1 };
    expect(at([p, p], 1000)).toBeCloseTo(6, 3);
  });
});
