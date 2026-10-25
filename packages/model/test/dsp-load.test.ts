import { describe, expect, it } from 'vitest';
import { estimateDspLoad } from '../src/index.js';
import { psxProject, templateTable } from './fixtures.js';

describe('estimateDspLoad', () => {
  it('estimates Lukas config close to the 97 % and 7 delay blocks Drag Net measured', () => {
    const estimate = estimateDspLoad(psxProject().blockTable.blocks);
    expect(estimate.dspPercent).toBeCloseTo(91.4, 1);
    expect(estimate.delayBlocks).toBe(7);
    expect(estimate.maxPeqFilters).toBe(4);
    expect(estimate.unknownBlocks).toEqual([]);
  });

  it('counts the template', () => {
    const estimate = estimateDspLoad(templateTable().blocks);
    // Generator 4, 3× PEQ(9) 18.45, compressor 3, 3 delays 6, 2-way 4.8, 2 levels, 2 limiters 4.6, mixer 0.5.
    expect(estimate.dspPercent).toBeCloseTo(43.35, 2);
    expect(estimate.delayBlocks).toBe(3);
    expect(estimate.maxPeqFilters).toBe(9);
  });

  it('lists unknown blocks instead of guessing their cost', () => {
    const block = { id: 1, blockType: 0x0999, x: 0, y: 0, kind: 4, channel: 0, name: 'GEQ', inputs: [1], outputs: [2] };
    expect(estimateDspLoad([block])).toEqual({ dspPercent: 0, delayBlocks: 0, maxPeqFilters: 0, unknownBlocks: [block] });
  });
});
