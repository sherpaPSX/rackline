import { CONTROL_FRAME_SIZE, MAX_RECORDS_PER_FRAME } from './constants.js';
import { fail, ok, type Result } from './result.js';

/**
 * Parameter frames on UDP 5000. A frame is always 905 bytes and carries up to
 * 64 records of 14 bytes, big-endian. See docs/protocol.md §2.
 */
export type FrameKind = 'read' | 'write' | 'reply';

/** Byte 0 of a record: DSP block parameter or system object. */
export type RecordTarget = 'block' | 'system';

/** Size of a value in bytes. */
export type ValueSize = 1 | 2 | 4;

/** Which parameter a record addresses. */
export interface ParamAddress {
  target: RecordTarget;
  /** Block instance ID, or the subtype of a system object. */
  instance: number;
  /** Block type (e.g. 0x0105 analog input) or system object ID (e.g. 0xfb05). */
  objectType: number;
  /** Parameter index. 0 is the preset tag, meters start at 0x8000. */
  index: number;
}

export interface ParamRecord extends ParamAddress {
  size: ValueSize;
  /** Raw unsigned value; conversion to dB/Hz/ms lives in `model`. */
  value: number;
}

export interface Frame {
  kind: FrameKind;
  /** Status word of a reply, 0 = OK. Always 0 in requests. */
  status: number;
  records: ParamRecord[];
}

const KIND_BYTE: Record<FrameKind, number> = { read: 0, write: 1, reply: 2 };
const KIND_BY_BYTE = invert(KIND_BYTE);
const TARGET_BYTE: Record<RecordTarget, number> = { block: 0x00, system: 0x04 };
const TARGET_BY_BYTE = invert(TARGET_BYTE);
const RECORDS_OFFSET = 9;
const RECORD_SIZE = 14;

/** Encode a frame. Throws on out-of-range input (programmer error). */
export function encodeFrame(frame: Frame): Uint8Array {
  if (frame.records.length > MAX_RECORDS_PER_FRAME) {
    throw new RangeError(`a frame holds at most ${MAX_RECORDS_PER_FRAME} records`);
  }
  const bytes = new Uint8Array(CONTROL_FRAME_SIZE);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, KIND_BYTE[frame.kind]);
  view.setUint16(1, checkRange(frame.status, 0xffff, 'status'));
  view.setUint8(8, frame.records.length);
  frame.records.forEach((record, i) => {
    const o = RECORDS_OFFSET + RECORD_SIZE * i;
    view.setUint8(o, TARGET_BYTE[record.target]);
    view.setUint8(o + 1, checkRange(record.instance, 0xff, 'instance'));
    view.setUint16(o + 2, checkRange(record.objectType, 0xffff, 'objectType'));
    view.setUint16(o + 4, checkRange(record.index, 0xffff, 'index'));
    view.setUint16(o + 8, record.size);
    view.setUint32(o + 10, checkRange(record.value, 2 ** (8 * record.size) - 1, 'value'));
  });
  return bytes;
}

/** Decode a frame received from the network. */
export function decodeFrame(bytes: Uint8Array): Result<Frame> {
  if (bytes.length !== CONTROL_FRAME_SIZE) {
    return fail(`frame must be ${CONTROL_FRAME_SIZE} bytes, got ${bytes.length}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kind = KIND_BY_BYTE.get(view.getUint8(0));
  if (kind === undefined) return fail(`unknown frame kind ${view.getUint8(0)}`);
  const count = view.getUint8(8);
  if (count > MAX_RECORDS_PER_FRAME) return fail(`record count ${count} exceeds ${MAX_RECORDS_PER_FRAME}`);

  const records: ParamRecord[] = [];
  for (let i = 0; i < count; i++) {
    const o = RECORDS_OFFSET + RECORD_SIZE * i;
    const target = targetFromByte(view.getUint8(o));
    if (target === undefined) return fail(`record ${i}: unknown target byte ${view.getUint8(o)}`);
    const size = view.getUint16(o + 8);
    if (!isValueSize(size)) return fail(`record ${i}: invalid value size ${size}`);
    records.push({
      target,
      instance: view.getUint8(o + 1),
      objectType: view.getUint16(o + 2),
      index: view.getUint16(o + 4),
      size,
      value: view.getUint32(o + 10) % 2 ** (8 * size),
    });
  }
  return ok({ kind, status: view.getUint16(1), records });
}

/** A read request for one parameter. */
export function readRecord(address: ParamAddress, size: ValueSize): ParamRecord {
  return { ...address, size, value: 0 };
}

/**
 * Whether `reply` answers `request`. Drag Net matches on the first record's
 * address (frame offsets 9, 11 and 13); the caller also checks the source IP.
 */
export function isReplyTo(request: Frame, reply: Frame): boolean {
  const a = request.records[0];
  const b = reply.records[0];
  return reply.kind === 'reply' && a !== undefined && b !== undefined && sameAddress(a, b);
}

export function sameAddress(a: ParamAddress, b: ParamAddress): boolean {
  return a.target === b.target && a.instance === b.instance && a.objectType === b.objectType && a.index === b.index;
}

/** Record byte 0 → target, `undefined` if unknown. */
export function targetFromByte(byte: number): RecordTarget | undefined {
  return TARGET_BY_BYTE.get(byte);
}

export function isValueSize(n: number): n is ValueSize {
  return n === 1 || n === 2 || n === 4;
}

function invert<K extends string>(map: Record<K, number>): Map<number, K> {
  return new Map((Object.keys(map) as K[]).map((k) => [map[k], k]));
}

function checkRange(value: number, max: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${name} ${value} out of range 0..${max}`);
  }
  return value;
}
