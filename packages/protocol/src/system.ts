import { cString } from './bytes.js';
import type { ParamAddress, ParamRecord } from './frame.js';
import { readRecord, sameAddress } from './frame.js';

/**
 * System objects addressed with target byte 0x04. Only the ones verified with
 * the simulator are listed. See docs/protocol.md §2.
 */
const system = (instance: number, objectType: number, index = 0): ParamAddress => ({
  target: 'system',
  instance,
  objectType,
  index,
});

export const SYSTEM = {
  firmwareMajor: system(0x11, 0xfb05, 0),
  modelCode: system(0x11, 0xfb05, 2),
  firmwareMinor: system(0x11, 0xfb05, 3),
  /** Device name: indexes 0..7, four ASCII bytes each. */
  name: (part: number): ParamAddress => system(0x08, 0xfc01, part),
  /** Current preset. Writing it recalls that preset. */
  currentPreset: system(0x01, 0xfc00),
} as const;

/** Value of `SYSTEM.modelCode` → model name. */
export const MODEL_CODES: Readonly<Record<number, string>> = {
  0x00: 'RPM 88',
  0x20: 'RPM 22',
  0x40: 'RPM 44',
  0x60: 'RPM 26z',
  0x80: 'RPM 2',
  0xa0: 'RPM 2m',
};

const NAME_PARTS = 8;

export interface DeviceInfo {
  /** e.g. `RPM 26z`, `unknown (0xc0)`, or `unknown` when not in the reply. */
  model: string;
  /** e.g. `2.5.3`. */
  firmware: string;
  name: string;
}

/** Records to read (in one frame) for `decodeDeviceInfo`. */
export function deviceInfoReadRecords(): ParamRecord[] {
  return [
    readRecord(SYSTEM.firmwareMajor, 1),
    readRecord(SYSTEM.modelCode, 1),
    readRecord(SYSTEM.firmwareMinor, 1),
    ...Array.from({ length: NAME_PARTS }, (_, i) => readRecord(SYSTEM.name(i), 4)),
  ];
}

/** Decode the reply records of a `deviceInfoReadRecords` request. */
export function decodeDeviceInfo(records: readonly ParamRecord[]): DeviceInfo {
  const lookup = (a: ParamAddress): number | undefined => records.find((r) => sameAddress(r, a))?.value;
  const find = (a: ParamAddress): number => lookup(a) ?? 0;

  const major = find(SYSTEM.firmwareMajor);
  const code = lookup(SYSTEM.modelCode);
  const nameBytes = new Uint8Array(4 * NAME_PARTS);
  const nameView = new DataView(nameBytes.buffer);
  for (let i = 0; i < NAME_PARTS; i++) nameView.setUint32(4 * i, find(SYSTEM.name(i)));
  return {
    model: modelName(code),
    firmware: `${Math.floor(major / 10)}.${major % 10}.${find(SYSTEM.firmwareMinor)}`,
    name: cString(nameBytes),
  };
}

function modelName(code: number | undefined): string {
  if (code === undefined) return 'unknown';
  return MODEL_CODES[code] ?? `unknown (0x${code.toString(16).padStart(2, '0')})`;
}
