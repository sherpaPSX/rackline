import { AppState } from '@rackline/api';
import { findModule } from '@rackline/model';
import { describe, expect, it } from 'vitest';
import { applyRecords, findParam, fromApiValue, moduleInfo, toSetup, valueReadRecords } from '../src/index.js';
import { psxProject } from './fixtures.js';

describe('setup of Lukas config (PSX_RCF_FINAL.r26)', () => {
  const project = psxProject();
  const table = project.blockTable;
  const setup = toSetup(table, { kind: 'file', fileName: 'PSX_RCF_FINAL.r26' });

  it('lists blocks, I/O and the racks from model', () => {
    expect(setup.blocks).toHaveLength(table.blocks.length);
    expect(setup.inputIds).toEqual([1, 2, 9, 10]);
    expect(setup.outputIds).toEqual([11, 12, 13, 14, 15, 16]);
    expect(setup.racks.map((r) => r.name)).toEqual(['ANALOG', 'Delay', 'MF\\HF', 'LF', 'ANALOG mono', 'SUB FLEX', 'SUB HORN']);
    expect(setup.racks[4]?.crossover?.bands.map((b) => b.name)).toEqual(['High', 'High mid', 'Low mid', 'Low']);
    expect(setup.dspPercent).toBe(91.4);
  });

  it('describes every module once, as valid API JSON', () => {
    const types = setup.modules.map((m) => m.blockType);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toContain(0x0501);
    const state = { connection: { status: 'offline' }, devices: [], setup, values: {} };
    expect(AppState.safeParse(JSON.parse(JSON.stringify(state))).success).toBe(true);
  });

  it('gives numbers their range and step in engineering units, steps as values with ∞', () => {
    const limiter = moduleInfo(findModule(0x0501) ?? expect.fail());
    expect(limiter.params[0]).toEqual({ key: 'threshold', label: 'Threshold', kind: 'number', unit: 'dBFS', min: -40, max: 0, step: 0.5 });
    expect(limiter.params[1]).toMatchObject({ kind: 'steps', unit: 'ms', steps: [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 25, 50, 75, 100] });
    const ratio = moduleInfo(findModule(0x0500) ?? expect.fail()).params.find((p) => p.key === 'ratio');
    expect(ratio?.kind === 'steps' && ratio.steps.at(-1)).toBe('inf');
    const delay = moduleInfo(findModule(0x0301) ?? expect.fail()).params[0];
    expect(delay).toMatchObject({ unit: 'ms', min: 0, max: 1365, step: 1 / 48 });
    const peqType = moduleInfo(findModule(0x0603) ?? expect.fail()).params[1];
    expect(peqType).toMatchObject({ kind: 'enum', options: expect.arrayContaining([{ value: 3, label: 'Low cut' }]) as unknown });
  });

  it('decodes preset 0: steps as indexes, the rest in engineering units', () => {
    const values = {};
    applyRecords(table, values, project.presets.find((p) => p.number === 0)?.params ?? []);
    // Limiter 1 (left): threshold raw 192, attack raw 10, release raw 6; Output SUB HORN: trim raw 192, mute 1.
    expect(values).toMatchObject({ '3': { threshold: 0, attack: 10, release: 6 }, '11': { trim: 0, mute: true, invert: false } });
  });

  it('reads every known parameter of every block', () => {
    const records = valueReadRecords(table);
    const limiter = records.filter((r) => r.instance === 3);
    expect(limiter.map((r) => [r.objectType, r.index, r.size])).toEqual([
      [0x0501, 2, 1],
      [0x0501, 3, 1],
      [0x0501, 4, 1],
    ]);
    expect(records.every((r) => r.target === 'block')).toBe(true);
  });

  it('encodes API values, rejecting unknown parameters and bad step indexes', () => {
    const attack = findParam(table, 3, 'attack');
    expect(attack.ok && fromApiValue(attack.value.param, 15)).toEqual({ ok: true, value: 15 });
    expect(attack.ok && fromApiValue(attack.value.param, 16).ok).toBe(false);
    expect(attack.ok && fromApiValue(attack.value.param, 1.5).ok).toBe(false);
    const threshold = findParam(table, 3, 'threshold');
    expect(threshold.ok && fromApiValue(threshold.value.param, -6.3)).toEqual({ ok: true, value: 179 });
    expect(findParam(table, 3, 'gain')).toEqual({ ok: false, error: 'block Limiter 1 has no parameter gain' });
    expect(findParam(table, 200, 'gain')).toEqual({ ok: false, error: 'no block 200 in this setup' });
  });
});
