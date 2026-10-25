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

/** One parameter value as Drag Net's report shows it: block type, index, raw value, displayed text. */
export type DisplaySample = [blockType: number, index: number, raw: number, display: string];

interface DisplaySamplesFile {
  rows: DisplaySample[];
  /** Drag Net's parameter names by block type and index, for the modules whose layout depends on their size. */
  names: Record<string, Record<string, string>>;
}

let displaySamples: DisplaySamplesFile | undefined;
const displaySamplesFile = (): DisplaySamplesFile =>
  (displaySamples ??= JSON.parse(readFileSync(path('dragnet-display-samples.json'), 'utf8')) as DisplaySamplesFile);

/** Raw → display pairs from Drag Net reports of configurations served by the simulator. */
export function dragNetDisplaySamples(): DisplaySample[] {
  return displaySamplesFile().rows;
}

/** Index → Drag Net parameter name of every parameter of one block type (empty if not sampled). */
export function dragNetParamNames(blockType: number): Map<number, string> {
  const names = displaySamplesFile().names[blockType] ?? {};
  return new Map(Object.entries(names).map(([index, name]) => [Number(index), name]));
}
