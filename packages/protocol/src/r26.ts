import { parseBlockTable, type BlockTable } from './config.js';
import { isValueSize, targetFromByte, type ParamRecord } from './frame.js';
import { fail, ok, type Result } from './result.js';

/**
 * `.r26` project files saved by Drag Net: flat XML with the configuration's
 * block table as `<RawScript Data="b,b,b,…">` and per-preset parameter values
 * as `<Param d="objectType,target<<8|instance,index,size,value"/>`.
 * See docs/protocol.md §3.
 */
export interface R26Project {
  softwareVersion: string;
  blockTable: BlockTable;
  /** Presets that hold values, by number (0 and 1..24). */
  presets: R26Preset[];
}

export interface R26Preset {
  number: number;
  params: ParamRecord[];
}

export function parseR26(text: string): Result<R26Project> {
  const softwareVersion = /<RPM\s+SOFTWAREVERSION="([^"]*)"/.exec(text)?.[1];
  if (softwareVersion === undefined) return fail('not an .r26 file (no <RPM SOFTWAREVERSION>)');

  const rawScript = /<RawScript\s+Data="([^"]*)"/.exec(text)?.[1];
  if (rawScript === undefined) return fail('no <RawScript> in .r26 file');
  // The list ends with a trailing comma.
  const values = rawScript.split(',').filter((v) => v !== '').map(Number);
  if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 0xff)) return fail('RawScript is not a byte list');
  const blockTable = parseBlockTable(Uint8Array.from(values));
  if (!blockTable.ok) return fail(`RawScript: ${blockTable.error}`);

  const presets: R26Preset[] = [];
  for (const match of text.matchAll(/<Preset\s+Number="(\d+)"\s*(?:\/>|>([\s\S]*?)<\/Preset>)/g)) {
    const params: ParamRecord[] = [];
    for (const param of (match[2] ?? '').matchAll(/<Param\s+d="([^"]*)"/g)) {
      const record = parseParam(param[1] ?? '');
      if (!record.ok) return fail(`preset ${match[1]}: ${record.error}`);
      params.push(record.value);
    }
    if (params.length > 0) presets.push({ number: Number(match[1]), params });
  }

  return ok({ softwareVersion, blockTable: blockTable.value, presets });
}

function parseParam(d: string): Result<ParamRecord> {
  const fields = d.split(',').map(Number);
  if (fields.length !== 5 || fields.some((f) => !Number.isInteger(f) || f < 0)) {
    return fail(`malformed Param d="${d}"`);
  }
  const [objectType, address, index, size, value] = fields as [number, number, number, number, number];
  const target = targetFromByte(address >> 8);
  if (target === undefined) return fail(`unknown target in Param d="${d}"`);
  if (!isValueSize(size)) return fail(`invalid size in Param d="${d}"`);
  return ok({ target, instance: address & 0xff, objectType, index, size, value });
}
