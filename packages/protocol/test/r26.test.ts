import { describe, expect, it } from 'vitest';
import { serializeBlockTable } from '../src/config.js';
import { fixtureText } from './fixtures.js';
import { parseR26 } from '../src/r26.js';

const text = fixtureText('PSX_RCF_FINAL.r26');

describe('.r26 project (PSX_RCF_FINAL.r26)', () => {
  const parsed = parseR26(text);
  if (!parsed.ok) throw new Error(parsed.error);
  const project = parsed.value;

  it('reads the block table from RawScript, matching the <Block> elements', () => {
    const { header, blocks, configName } = project.blockTable;
    // <Header ScriptRevision="1" PlatformID="26" HardwareRevision="0" RemainingSize="20524"/>
    expect(header).toEqual({ scriptRevision: 1, platformId: 26, hardwareRevision: 0, remainingSize: 20524 });
    expect(configName).toBe('RPM 26z Configuration');

    const xmlBlocks = [...text.matchAll(/<Block PID="(\d+)" Btype="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(blocks).toHaveLength(44);
    expect(blocks.map((b) => [b.id, b.blockType])).toEqual(xmlBlocks);
    expect(blocks.find((b) => b.id === 8)).toMatchObject({ name: 'Crossover 3', blockType: 0x0610, outputs: [438, 442, 0] });
    expect(blocks.filter((b) => b.blockType === 0x0106).map((b) => b.name)).toEqual([
      'SUB HORN',
      'SUB FLEX',
      'LF - LEFT',
      'LF - RIGHT',
      'MF\\HF - LEFT',
      'MF\\HF - RIGHT',
    ]);
  });

  it('round-trips the RawScript block table', () => {
    const raw = /<RawScript Data="([^"]*)"/.exec(text)?.[1] ?? '';
    const bytes = raw.split(',').filter((v) => v !== '').map(Number);
    const table = serializeBlockTable(project.blockTable);
    expect(Array.from(table)).toEqual(bytes.slice(0, project.blockTable.tableEnd));
  });

  it('reads preset parameters as records', () => {
    expect(project.presets.map((p) => p.number)).toEqual([0, 1, 2, 4, 24]);
    expect(project.presets.reduce((n, p) => n + p.params.length, 0)).toBe(1818);
    const preset0 = project.presets[0]?.params ?? [];
    // <Param d="1552,8,4,2,500"/>: crossover 3 low band at 500 Hz.
    expect(preset0).toContainEqual({ target: 'block', instance: 8, objectType: 0x0610, index: 4, size: 2, value: 500 });
    // <Param d="57345,1152,2,1,0"/>: system object 04 80 e001.
    expect(preset0[0]).toEqual({ target: 'system', instance: 0x80, objectType: 0xe001, index: 2, size: 1, value: 0 });
  });

  it('rejects files that are not .r26', () => {
    expect(parseR26('<xml/>').ok).toBe(false);
    expect(parseR26('<RPM SOFTWAREVERSION="4.2"><RawScript Data="1,2,x"/></RPM>').ok).toBe(false);
  });
});
