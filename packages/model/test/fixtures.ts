import { readFileSync } from 'node:fs';
import { parseBlockTable, parseR26, type BlockTable, type R26Project } from '@rackline/protocol';

/** The real samples live with the protocol tests (see packages/protocol/test/fixtures/README.md). */
const path = (name: string): URL => new URL(`../../protocol/test/fixtures/${name}`, import.meta.url);

let psx: R26Project | undefined;

/** Lukas's RCF rig (parsed once). */
export function psxProject(): R26Project {
  if (psx === undefined) {
    const parsed = parseR26(readFileSync(path('PSX_RCF_FINAL.r26'), 'latin1'));
    if (!parsed.ok) throw new Error(parsed.error);
    psx = parsed.value;
  }
  return psx;
}

/** Drag Net's RPM26z_01 template as downloaded from the simulator. */
export function templateTable(): BlockTable {
  const parsed = parseBlockTable(new Uint8Array(readFileSync(path('rpm26z_01-config-table.bin'))));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

/** Raw records of one block in preset 0 of Lukas's project. */
export function psxRecords(blockId: number): { index: number; value: number }[] {
  const preset = psxProject().presets.find((p) => p.number === 0);
  return (preset?.params ?? []).filter((r) => r.target === 'block' && r.instance === blockId);
}
