import type { BlockTable, ConfigBlock } from '@rackline/protocol';
import { describe, expect, it } from 'vitest';
import { buildRacks, commonName, type RackLayout } from '../src/index.js';
import { psxProject, templateTable } from './fixtures.js';

/** Every block id a layout uses, to check nothing is lost or doubled. */
function usedBlocks(layout: RackLayout): number[] {
  return layout.racks.flatMap((r) => [
    ...r.channels.flatMap((c) => [...(c.mixerId === undefined ? [] : [c.mixerId]), ...c.outputIds]),
    ...r.modules.flatMap((m) => m.blockIds),
    ...(r.crossover?.blockIds.flat() ?? []),
  ]);
}

const summary = (layout: RackLayout) =>
  layout.racks.map((r) => ({
    name: r.name,
    channels: r.channels.length,
    modules: r.modules.map((m) => m.blockIds),
    crossover: r.crossover?.bands.map((b) => b.name),
    outputs: r.channels.map((c) => c.outputIds),
  }));

describe('racks from Lukas config (PSX_RCF_FINAL.r26)', () => {
  const layout = buildRacks(psxProject().blockTable);

  it('cuts the graph into stereo system, tops and band racks and a mono sub branch', () => {
    expect(summary(layout)).toEqual([
      // LEFT/RIGHT ANALOG → Limiter → PEQ(4) → Delay, then split.
      { name: 'ANALOG', channels: 2, modules: [[3, 4], [0x26, 0x27], [0x36, 0x38]], crossover: undefined, outputs: [[], []] },
      // Tops: Delay → 3-way.
      { name: 'Delay', channels: 2, modules: [[0x11, 0x1a]], crossover: ['High', 'Mid', 'Low'], outputs: [[], []] },
      { name: 'MF\\HF', channels: 2, modules: [[0x21, 0x22], [0x1d, 0x1f], [0x2a, 0x2d], [0x31, 0x33]], crossover: undefined, outputs: [[0x0f], [0x10]] },
      { name: 'LF', channels: 2, modules: [[0x16, 0x1e], [0x2b, 0x2c], [0x30, 0x32]], crossover: undefined, outputs: [[0x0d], [0x0e]] },
      // Mixer 3 sums L+R; Crossover 1 (3-way) high band → Crossover 4 (2-way) = one 4-band crossover.
      { name: 'ANALOG mono', channels: 1, modules: [], crossover: ['High', 'High mid', 'Low mid', 'Low'], outputs: [[]] },
      { name: 'SUB FLEX', channels: 1, modules: [[0x1b], [0x13], [0x28], [0x2e]], crossover: undefined, outputs: [[0x0c]] },
      { name: 'SUB HORN', channels: 1, modules: [[0x15], [0x29], [0x2f]], crossover: undefined, outputs: [[0x0b]] },
    ]);
  });

  it('links racks by taps', () => {
    const [system, tops, mfhf, , sum, flex, horn] = layout.racks;
    expect(tops?.channels.map((c) => c.sources)).toEqual([
      [{ kind: 'rack', rackId: system?.id, channel: 0 }],
      [{ kind: 'rack', rackId: system?.id, channel: 1 }],
    ]);
    expect(mfhf?.channels[1]?.sources).toEqual([{ kind: 'band', rackId: tops?.id, channel: 1, band: 0 }]);
    expect(sum?.channels).toEqual([
      {
        sources: [
          { kind: 'rack', rackId: system?.id, channel: 0 },
          { kind: 'rack', rackId: system?.id, channel: 1 },
        ],
        mixerId: 0x25,
        mixerInputs: [0, 1],
        outputIds: [],
      },
    ]);
    expect(sum?.crossover?.blockIds).toEqual([[0x14, 0x34]]);
    expect(sum?.crossover?.bands.map((b) => b.points[0])).toEqual([
      { blockId: 0x34, output: 0 },
      { blockId: 0x34, output: 1 },
      { blockId: 0x14, output: 1 },
      { blockId: 0x14, output: 2 },
    ]);
    expect(flex?.channels[0]?.sources).toEqual([{ kind: 'band', rackId: sum?.id, channel: 0, band: 1 }]);
    expect(horn?.channels[0]?.sources).toEqual([{ kind: 'band', rackId: sum?.id, channel: 0, band: 2 }]);
  });

  it('uses every processing block and every output exactly once', () => {
    const blocks = psxProject().blockTable.blocks.filter((b) => b.kind !== 0x4c && b.kind !== 0x2c);
    expect(usedBlocks(layout).sort((a, b) => a - b)).toEqual(blocks.map((b) => b.id).sort((a, b) => a - b));
    expect(layout.inputs.map((b) => b.name)).toEqual(['LEFT ANALOG', 'RIGHT - ANALOG', 'LEFT DIGITAL', 'RIGHT - DIGITAL']);
    expect(layout.outputs).toHaveLength(6);
  });
});

describe('racks from the RPM26z_01 template', () => {
  it('makes a mono rack summing input and generator, ending in a 2-way, with two band racks', () => {
    const layout = buildRacks(templateTable());
    expect(summary(layout)).toEqual([
      { name: 'Mixer 1', channels: 1, modules: [[7], [8], [0x11]], crossover: ['High', 'Low'], outputs: [[]] },
      { name: 'Output 1', channels: 1, modules: [[0x13], [0x15], [0x17], [0x19]], crossover: undefined, outputs: [[0x0b]] },
      { name: 'Output 2', channels: 1, modules: [[0x14], [0x16], [0x18], [0x1a]], crossover: undefined, outputs: [[0x0c]] },
    ]);
    expect(layout.racks[0]?.channels[0]?.sources).toEqual([
      { kind: 'input', blockId: 1 },
      { kind: 'generator', blockId: 4 },
    ]);
  });
});

/** A block table from compact block specs; wires are plain numbers. */
function table(blocks: Partial<ConfigBlock>[]): BlockTable {
  return {
    header: { scriptRevision: 1, platformId: 26, hardwareRevision: 0, remainingSize: 0 },
    blocks: blocks.map((b, i) => ({ id: i + 1, blockType: 0x0301, x: 0, y: 0, kind: 4, channel: 0, name: `B${i + 1}`, inputs: [], outputs: [], ...b })),
    configName: '',
    endRecordExtra: new Uint8Array(),
    tableEnd: 0,
  };
}
const analogIn = (channel: number, wire: number): Partial<ConfigBlock> => ({ blockType: 0x0105, kind: 0x4c, channel, name: `In ${channel}`, inputs: [channel], outputs: [wire] });
const out = (channel: number, wire: number): Partial<ConfigBlock> => ({ blockType: 0x0106, kind: 0x54, channel, name: `Out ${channel}`, inputs: [wire], outputs: [0x10 + channel] });

describe('rack building rules', () => {
  it('keeps the mixer input of every source, so a Select with an unconnected input maps to the right wire', () => {
    const layout = buildRacks(
      table([
        analogIn(1, 0x101),
        analogIn(2, 0x102),
        analogIn(3, 0x103),
        analogIn(4, 0x104),
        { blockType: 0x0211, name: 'Select L', inputs: [0x101, 0, 0x103], outputs: [0x105] }, // 5: Select 1 of 3
        { blockType: 0x0211, name: 'Select R', inputs: [0x102, 0, 0x104], outputs: [0x106] }, // 6
        out(1, 0x105),
        out(2, 0x106),
      ]),
    );
    expect(layout.racks.map((r) => r.channels)).toEqual([
      [
        { sources: [{ kind: 'input', blockId: 1 }, { kind: 'input', blockId: 3 }], mixerId: 5, mixerInputs: [0, 2], outputIds: [7] },
        { sources: [{ kind: 'input', blockId: 2 }, { kind: 'input', blockId: 4 }], mixerId: 6, mixerInputs: [0, 2], outputIds: [8] },
      ],
    ]);
  });

  it('gives an output fed straight from an input a rack without modules', () => {
    const layout = buildRacks(table([analogIn(1, 0x101), out(1, 0x101), out(2, 0x101)]));
    expect(layout.racks).toEqual([
      { id: 'rack-2', name: 'Out 1 + Out 2', channels: [{ sources: [{ kind: 'input', blockId: 1 }], outputIds: [2, 3] }], modules: [] },
    ]);
  });

  it('splits at an input feeding two chains and pairs them as stereo with the other input', () => {
    const layout = buildRacks(
      table([
        analogIn(1, 0x101),
        analogIn(2, 0x102),
        { name: 'Delay L', inputs: [0x101], outputs: [0x103] }, // 3
        { name: 'Delay R', inputs: [0x102], outputs: [0x104] }, // 4
        { blockType: 0x0501, inputs: [0x101], outputs: [0x105] }, // 5: limiter on L only
        out(1, 0x103),
        out(2, 0x104),
        out(3, 0x105),
      ]),
    );
    expect(summary(layout)).toEqual([
      { name: 'Out', channels: 2, modules: [[3, 4]], crossover: undefined, outputs: [[6], [7]] },
      { name: 'Out 3', channels: 1, modules: [[5]], crossover: undefined, outputs: [[8]] },
    ]);
  });

  it('does not pair chains of different shape', () => {
    const layout = buildRacks(
      table([analogIn(1, 0x101), analogIn(2, 0x102), { inputs: [0x101], outputs: [0x103] }, { blockType: 0x0501, inputs: [0x102], outputs: [0x104] }, out(1, 0x103), out(2, 0x104)]),
    );
    expect(layout.racks.map((r) => r.channels.length)).toEqual([1, 1]);
  });

  it('keeps blocks of unknown type as modules', () => {
    const layout = buildRacks(table([analogIn(1, 0x101), { blockType: 0x0999, name: 'GEQ', inputs: [0x101], outputs: [0x102] }, out(1, 0x102)]));
    expect(layout.racks[0]?.modules).toEqual([{ blockType: 0x0999, blockIds: [2] }]);
  });

  it('ignores unconnected processing chains without failing', () => {
    const layout = buildRacks(table([{ inputs: [0], outputs: [0] }]));
    expect(layout.racks).toEqual([{ id: 'rack-1', name: 'B1', channels: [{ sources: [], outputIds: [] }], modules: [{ blockType: 0x0301, blockIds: [1] }] }]);
  });
});

describe('commonName', () => {
  it('folds left/right names', () => {
    expect(commonName('MF\\HF - LEFT', 'MF\\HF - RIGHT')).toBe('MF\\HF');
    expect(commonName('LEFT ANALOG', 'RIGHT - ANALOG')).toBe('ANALOG');
    expect(commonName('Crossover 5', 'Crossover 3')).toBe('Crossover');
    expect(commonName('Kick', 'Snare')).toBe('Kick / Snare');
  });
});
