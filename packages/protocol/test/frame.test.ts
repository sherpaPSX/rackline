import { describe, expect, it } from 'vitest';
import { decodeFrame, encodeFrame, isReplyTo, readRecord, type Frame, type ParamRecord } from '../src/frame.js';
import { hex, padded } from './fixtures.js';

// Preset 0 of PSX_RCF_FINAL.r26: `<Param d="1552,8,4,2,500"/>`,
// 3-way crossover (0x0610) instance 8, index 4 (low band frequency) = 500 Hz.
const crossoverFreq: ParamRecord = {
  target: 'block',
  instance: 8,
  objectType: 0x0610,
  index: 4,
  size: 2,
  value: 500,
};
const crossoverFreqBytes = '00 08 0610 0004 0000 0002 000001f4';

describe('parameter frames', () => {
  it('encodes a write frame as 905 bytes with the record at offset 9', () => {
    const frame = encodeFrame({ kind: 'write', status: 0, records: [crossoverFreq] });
    expect(frame).toEqual(padded(hex(`01 0000 0000000000 01 ${crossoverFreqBytes}`), 905));
  });

  it('encodes a read of the current preset (system object 04 01 fc00)', () => {
    const record = readRecord({ target: 'system', instance: 0x01, objectType: 0xfc00, index: 0 }, 1);
    const frame = encodeFrame({ kind: 'read', status: 0, records: [record] });
    expect(frame).toEqual(padded(hex('00 0000 0000000000 01 04 01 fc00 0000 0000 0001 00000000'), 905));
  });

  it('decodes a device reply and round-trips', () => {
    const reply = padded(hex(`02 0000 0000000000 01 ${crossoverFreqBytes}`), 905);
    const decoded = decodeFrame(reply);
    expect(decoded).toEqual({ ok: true, value: { kind: 'reply', status: 0, records: [crossoverFreq] } });
    if (decoded.ok) expect(encodeFrame(decoded.value)).toEqual(reply);
  });

  it('matches a reply to its request by the first record address', () => {
    const request: Frame = { kind: 'read', status: 0, records: [readRecord(crossoverFreq, 2)] };
    const reply: Frame = { kind: 'reply', status: 0, records: [crossoverFreq] };
    expect(isReplyTo(request, reply)).toBe(true);
    expect(isReplyTo(request, { ...reply, records: [{ ...crossoverFreq, index: 8 }] })).toBe(false);
    expect(isReplyTo(request, request)).toBe(false);
  });

  it('rejects malformed frames', () => {
    expect(decodeFrame(new Uint8Array(904)).ok).toBe(false);
    expect(decodeFrame(padded(hex('07'), 905)).ok).toBe(false);
    expect(decodeFrame(padded(hex('02 0000 0000000000 41'), 905)).ok).toBe(false);
    expect(decodeFrame(padded(hex('02 0000 0000000000 01 00 08 0610 0004 0000 0003 00000000'), 905)).ok).toBe(false);
  });

  it('refuses values that do not fit and more than 64 records', () => {
    expect(() => encodeFrame({ kind: 'write', status: 0, records: [{ ...crossoverFreq, size: 1 }] })).toThrow();
    const many = Array.from({ length: 65 }, () => crossoverFreq);
    expect(() => encodeFrame({ kind: 'write', status: 0, records: many })).toThrow();
  });
});
