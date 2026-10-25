import { describe, expect, it } from 'vitest';
import { parseBlockTable, serializeBlockTable } from '../src/config.js';
import { fixture } from './fixtures.js';

const captured = fixture('rpm26z_01-config-table.bin');

describe('config block table (captured RPM26z_01 TFTP config)', () => {
  const parsed = parseBlockTable(captured);
  if (!parsed.ok) throw new Error(parsed.error);
  const table = parsed.value;

  it('reads the header', () => {
    // The full captured file is 19592 bytes = 8 + remainingSize.
    expect(table.header).toEqual({ scriptRevision: 1, platformId: 26, hardwareRevision: 0, remainingSize: 19584 });
  });

  it('reads all 24 blocks with IDs, types and names', () => {
    expect(table.blocks).toHaveLength(24);
    expect(table.blocks.map((b) => [b.id, b.blockType, b.name]).slice(0, 4)).toEqual([
      [1, 0x0105, 'Input 1'],
      [2, 0x0105, 'Input 2'],
      [4, 0x0700, 'Generator 1'],
      [7, 0x0608, 'Parametric 1'],
    ]);
    expect(table.blocks.find((b) => b.name === 'Crossover 1')).toEqual({
      id: 0x12,
      blockType: 0x060f,
      x: 42,
      y: 2,
      kind: 4,
      channel: 0,
      name: 'Crossover 1',
      inputs: [261],
      outputs: [262, 263],
    });
    expect(table.blocks.find((b) => b.name === 'Output 1')).toMatchObject({ kind: 0x54, channel: 1, outputs: [0x11] });
  });

  it('reads the end-of-table record', () => {
    expect(table.configName).toBe('RPM 26z Configuration');
    expect(table.tableEnd).toBe(900);
  });

  it('serializes back to the same bytes', () => {
    expect(serializeBlockTable(table)).toEqual(captured);
  });

  it('fails cleanly on truncated or corrupted data', () => {
    expect(parseBlockTable(captured.subarray(0, 500)).ok).toBe(false);
    const corrupted = captured.slice();
    corrupted[10] = 7;
    expect(parseBlockTable(corrupted).ok).toBe(false);
    expect(parseBlockTable(new Uint8Array(0)).ok).toBe(false);
  });
});
