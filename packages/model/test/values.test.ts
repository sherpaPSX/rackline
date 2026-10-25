import { describe, expect, it } from 'vitest';
import { decodeBlockValues, decodeParam, encodeParam, findModule, MODULES } from '../src/index.js';
import { psxProject, psxRecords } from './fixtures.js';

function param(blockType: number, key: string) {
  const p = findModule(blockType)?.params.find((x) => x.key === key);
  if (p === undefined) throw new Error(`no ${key} on ${blockType.toString(16)}`);
  return p;
}

describe('module registry', () => {
  it('has unique block types and unique parameter keys and indexes per module', () => {
    expect(new Set(MODULES.map((m) => m.blockType)).size).toBe(MODULES.length);
    for (const m of MODULES) {
      expect(new Set(m.params.map((p) => p.key)).size, m.name).toBe(m.params.length);
      expect(new Set(m.params.map((p) => p.index)).size, m.name).toBe(m.params.length);
      for (const key of m.compact) expect(m.params.map((p) => p.key), m.name).toContain(key);
    }
  });

  it('knows every block type in Lukas config', () => {
    const unknown = psxProject().blockTable.blocks.filter((b) => findModule(b.blockType) === undefined);
    expect(unknown).toEqual([]);
  });

  it('maps PEQ block types to filter counts (0x0601 = 2, 0x0603 = 4, 0x0608 = 9)', () => {
    expect(findModule(0x0601)?.params).toHaveLength(10);
    expect(findModule(0x0603)?.params).toHaveLength(20);
    expect(findModule(0x0608)?.params.at(-1)).toMatchObject({ index: 46, key: 'band9Gain' });
  });

  it('covers every parameter index Lukas config writes, except the preset tags 0 and 1', () => {
    const project = psxProject();
    const preset0 = project.presets.find((p) => p.number === 0)?.params ?? [];
    const missing = new Set<string>();
    for (const r of preset0) {
      if (r.target !== 'block' || r.index < 2) continue;
      const m = findModule(r.objectType);
      if (m?.params.some((p) => p.index === r.index) !== true) missing.add(`${r.objectType.toString(16)}:${r.index}`);
    }
    // Unknown: the index before each crossover filter group (always 1) and Level idx 4 (always 255).
    expect([...missing].sort()).toEqual(['180:4', '60f:2', '60f:6', '610:10', '610:14', '610:2', '610:6']);
  });
});

describe('values from Lukas config (PSX_RCF_FINAL.r26, preset 0)', () => {
  it('decodes a 2-band PEQ (Parametric 1, id 0x13)', () => {
    expect(decodeBlockValues(0x0601, psxRecords(0x13))).toEqual({
      band1Enable: true,
      band1Type: 0,
      band1Freq: 40,
      band1Width: 5.175,
      band1Gain: 3,
      band2Enable: true,
      band2Type: 0,
      band2Freq: 63,
      band2Width: 4.05,
      band2Gain: 2,
    });
  });

  it('decodes the sub 2-way crossover (Crossover 4, id 0x34): low-pass 120 Hz LR24', () => {
    expect(decodeBlockValues(0x060f, psxRecords(0x34))).toEqual({
      lowUpperType: 2,
      lowUpperFreq: 120,
      lowUpperInvert: false,
      highLowerType: 2,
      highLowerFreq: 2900,
      highLowerInvert: false,
    });
  });

  it('decodes the left top 3-way crossover (Crossover 5, id 0x37)', () => {
    expect(decodeBlockValues(0x0610, psxRecords(0x37))).toMatchObject({
      lowUpperFreq: 500,
      midLowerFreq: 200,
      midUpperFreq: 1000,
      highLowerFreq: 700,
    });
  });

  it('decodes delay, level, limiter, mixer and output', () => {
    expect(decodeBlockValues(0x0301, psxRecords(0x1b))).toEqual({ delay: 3.5 });
    expect(decodeBlockValues(0x0180, psxRecords(0x28))).toEqual({
      level: 4,
      options: { mute: false, offAtMin: false },
      min: -30,
      max: 16,
    });
    expect(decodeBlockValues(0x0501, psxRecords(0x2e))).toEqual({ threshold: 0, attack: 10, release: 100 });
    expect(decodeBlockValues(0x0200, psxRecords(0x25))).toMatchObject({ input1Level: 0, input2Level: 0, outputLevel: 2.5 });
    // SUB HORN is muted in preset 0.
    expect(decodeBlockValues(0x0106, psxRecords(0x0b))).toEqual({ trim: 0, mute: true, invert: false });
  });

  it('returns undefined for unknown block types', () => {
    expect(decodeBlockValues(0x0999, [])).toBeUndefined();
  });
});

describe('encodeParam', () => {
  it('inverts decodeParam for every raw value of every Lukas parameter', () => {
    for (const r of psxProject().presets.flatMap((p) => p.params)) {
      const p = r.target === 'block' ? findModule(r.objectType)?.params.find((x) => x.index === r.index) : undefined;
      if (p === undefined) continue;
      expect(encodeParam(p, decodeParam(p, r.value))).toEqual({ ok: true, value: r.value });
    }
  });

  it('rounds to the nearest step and clamps to the raw range', () => {
    expect(encodeParam(param(0x0301, 'delay'), 1.01)).toEqual({ ok: true, value: 48 });
    expect(encodeParam(param(0x0301, 'delay'), 5000)).toEqual({ ok: true, value: 65520 });
    expect(encodeParam(param(0x0180, 'level'), -200)).toEqual({ ok: true, value: 0 });
    expect(encodeParam(param(0x0500, 'threshold'), 40)).toEqual({ ok: true, value: 128 });
    // Data sheet ranges: input trim +16..−20 dB, output trim +16..−30 dB, user gain ±15 dB.
    expect(encodeParam(param(0x0105, 'trim'), 30)).toEqual({ ok: true, value: 112 });
    expect(encodeParam(param(0x0103, 'trim'), -100)).toEqual({ ok: true, value: 76 });
    expect(encodeParam(param(0x0106, 'trim'), -40)).toEqual({ ok: true, value: 132 });
    expect(encodeParam(param(0x0106, 'trim'), 20)).toEqual({ ok: true, value: 224 });
    expect(encodeParam(param(0x0105, 'userTrim'), 20)).toEqual({ ok: true, value: 222 });
    expect(encodeParam(param(0x0500, 'ratio'), 4.2)).toEqual({ ok: true, value: 19 });
    expect(encodeParam(param(0x0500, 'ratio'), Infinity)).toEqual({ ok: true, value: 28 });
    expect(encodeParam(param(0x0180, 'options'), { mute: true, offAtMin: true })).toEqual({ ok: true, value: 3 });
  });

  it('rejects values of the wrong type and unknown enum codes', () => {
    expect(encodeParam(param(0x0106, 'mute'), 1).ok).toBe(false);
    expect(encodeParam(param(0x0106, 'trim'), true).ok).toBe(false);
    expect(encodeParam(param(0x0608, 'band1Type'), 7).ok).toBe(false);
  });
});
