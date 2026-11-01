import { describe, expect, it } from 'vitest';
import { decodeMeter, findModule, MODULES } from '../src/index.js';

function meter(blockType: number, key: string) {
  const m = findModule(blockType)?.meters?.find((x) => x.key === key);
  if (m === undefined) throw new Error(`no meter ${key} on ${blockType.toString(16)}`);
  return m;
}

describe('meters', () => {
  it('sit at 0x8000+ with unique keys and indexes per module', () => {
    for (const m of MODULES) {
      const meters = m.meters ?? [];
      expect(new Set(meters.map((x) => x.key)).size, m.name).toBe(meters.length);
      expect(new Set(meters.map((x) => x.index)).size, m.name).toBe(meters.length);
      for (const x of meters) expect(x.index, m.name).toBeGreaterThanOrEqual(0x8000);
    }
  });

  it('map the records of docs/protocol.md', () => {
    expect(meter(0x0105, 'analog')).toMatchObject({ index: 0x8000, unit: 'dBu' });
    expect(meter(0x0105, 'adc')).toMatchObject({ index: 0x8001, unit: 'dBFS' });
    expect(meter(0x0103, 'input')).toMatchObject({ index: 0x8000, unit: 'dBFS' });
    expect(meter(0x0106, 'dac')).toMatchObject({ index: 0x8001, unit: 'dBFS' });
    expect(meter(0x0106, 'analog')).toMatchObject({ index: 0x8002, unit: 'dBu' });
    expect(meter(0x0500, 'reduction')).toMatchObject({ index: 0x8000, reduction: true });
  });

  it('decode levels as full scale minus raw and gain reduction as raw', () => {
    expect(decodeMeter(meter(0x0105, 'analog'), 0)).toBe(24);
    expect(decodeMeter(meter(0x0105, 'analog'), 10)).toBe(14);
    expect(decodeMeter(meter(0x0105, 'adc'), 10)).toBe(-10);
    expect(decodeMeter(meter(0x0500, 'reduction'), 6)).toBe(6);
  });
});
