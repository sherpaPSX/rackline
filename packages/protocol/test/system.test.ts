import { describe, expect, it } from 'vitest';
import { decodeFrame, encodeFrame } from '../src/frame.js';
import { decodeDeviceInfo, deviceInfoReadRecords } from '../src/system.js';
import { fixture } from './fixtures.js';

describe('device info', () => {
  it('reads firmware, model and name in one frame and decodes the reply', () => {
    const records = deviceInfoReadRecords();
    expect(records).toHaveLength(11);
    // Simulator values: firmware 2.5.3, RPM 26z, name "RPM26z".
    const name = [0x52504d32, 0x367a0000, 0, 0, 0, 0, 0, 0];
    const values = [25, 0x60, 3, ...name];
    const reply = encodeFrame({
      kind: 'reply',
      status: 0,
      records: records.map((r, i) => ({ ...r, value: values[i] ?? 0 })),
    });
    const decoded = decodeFrame(reply);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decodeDeviceInfo(decoded.value.records)).toEqual({ model: 'RPM 26z', firmware: '2.5.3', name: 'RPM26z' });
  });

  it('decodes the real RPM 26z reply: cut after the last record, model code 0x62', () => {
    const reply = fixture('rpm26z-device-info-reply.bin');
    expect(reply).toHaveLength(9 + 14 * 12);
    const decoded = decodeFrame(reply);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decodeDeviceInfo(decoded.value.records)).toEqual({ model: 'RPM 26z', firmware: '2.5.3', name: '' });
  });

  it('names missing and unknown model codes', () => {
    expect(decodeDeviceInfo([]).model).toBe('unknown');
    expect(
      decodeDeviceInfo([{ target: 'system', instance: 0x11, objectType: 0xfb05, index: 2, size: 1, value: 0xc0 }]).model,
    ).toBe('unknown (0xc0)');
  });
});
