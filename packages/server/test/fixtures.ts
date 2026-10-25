import { readFileSync } from 'node:fs';
import { fail, ok, parseR26, serializeBlockTable, SYSTEM, type ParamAddress, type ParamRecord, type R26Project, type Result } from '@rackline/protocol';
import type { Device } from '../src/index.js';

const path = (name: string): URL => new URL(`../../protocol/test/fixtures/${name}`, import.meta.url);

export const PSX_TEXT = readFileSync(path('PSX_RCF_FINAL.r26'), 'latin1');

export function psxProject(): R26Project {
  const parsed = parseR26(PSX_TEXT);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

const key = (a: ParamAddress): string => `${a.target}:${a.instance}:${a.objectType}:${a.index}`;

/**
 * In-memory RPM 26z holding Lukas's PSX setup with the values of preset 0,
 * named `PSX`, firmware 2.5.3, preset 1 active. Recalling a preset sets
 * every value in `presets[n]`.
 */
export class FakeDevice implements Device {
  readonly ip = '192.168.69.22';
  reachable = true;
  closed = false;
  readonly writes: ParamRecord[] = [];
  readonly store = new Map<string, number>();
  presets = new Map<number, ParamRecord[]>();
  private readonly project = psxProject();

  constructor() {
    for (const r of this.project.presets.find((p) => p.number === 0)?.params ?? []) this.store.set(key(r), r.value);
    this.set(SYSTEM.firmwareMajor, 25);
    this.set(SYSTEM.modelCode, 0x60);
    this.set(SYSTEM.firmwareMinor, 3);
    this.set(SYSTEM.name(0), 0x50535800); // "PSX\0"
    this.set(SYSTEM.currentPreset, 1);
  }

  set(address: ParamAddress, value: number): void {
    this.store.set(key(address), value);
  }

  get(address: ParamAddress): number | undefined {
    return this.store.get(key(address));
  }

  read(records: readonly ParamRecord[]): Promise<Result<ParamRecord[]>> {
    if (!this.reachable) return Promise.resolve(fail(`no reply from ${this.ip}`));
    return Promise.resolve(ok(records.map((r) => ({ ...r, value: this.store.get(key(r)) ?? 0 }))));
  }

  write(records: readonly ParamRecord[]): Promise<Result<ParamRecord[]>> {
    if (!this.reachable) return Promise.resolve(fail(`no reply from ${this.ip}`));
    for (const r of records) {
      this.writes.push(r);
      this.store.set(key(r), r.value);
      if (key(r) === key(SYSTEM.currentPreset)) for (const p of this.presets.get(r.value) ?? []) this.store.set(key(p), p.value);
    }
    return Promise.resolve(ok([...records]));
  }

  readConfig(): Promise<Result<Uint8Array>> {
    if (!this.reachable) return Promise.resolve(fail(`no TFTP reply from ${this.ip}`));
    return Promise.resolve(ok(serializeBlockTable(this.project.blockTable)));
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}
