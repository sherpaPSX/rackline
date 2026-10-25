import { describe, expect, it } from 'vitest';
import { decodeDiscoveryReply, encodeFindAll, encodeGetMac, encodeSetIp } from '../src/discovery.js';
import { hex, padded } from './fixtures.js';

describe('discovery', () => {
  it('encodes RA and RM as 82-byte packets with the command in bytes 0..1', () => {
    expect(encodeFindAll()).toEqual(padded(hex('5241'), 82));
    expect(encodeGetMac()).toEqual(padded(hex('524d'), 82));
  });

  it('encodes WI with new IP, target MAC and netmask', () => {
    const packet = encodeSetIp({ mac: '00:50:c2:12:34:56', ip: '192.168.1.50', netmask: '255.255.255.0' });
    expect(packet).toEqual(padded(hex('5749 c0a80132 0050c2123456 ffffff00'), 82));
  });

  it('decodes the reply that Drag Net accepts from the simulator', () => {
    // fake_rpm.py answers RA with factory IP 192.168.69.22 and its MAC.
    const reply = padded(hex('5241 c0a84516 0050c2123456'), 82);
    expect(decodeDiscoveryReply(reply)).toEqual({
      ok: true,
      value: { command: 'RA', ip: '192.168.69.22', mac: '00:50:c2:12:34:56' },
    });
  });

  it('rejects packets of the wrong size or with an unknown command', () => {
    expect(decodeDiscoveryReply(hex('5241')).ok).toBe(false);
    expect(decodeDiscoveryReply(padded(hex('5858'), 82)).ok).toBe(false);
  });

  it('refuses malformed addresses when encoding WI', () => {
    expect(() => encodeSetIp({ mac: '00:50:c2:12:34', ip: '192.168.1.50', netmask: '255.255.255.0' })).toThrow();
    for (const ip of ['192.168.1.256', '192.168..22', '192.168.69.', ' 1.2.3.4', '1.2.3.4.5']) {
      expect(() => encodeSetIp({ mac: '00:50:c2:12:34:56', ip, netmask: '255.255.255.0' })).toThrow();
    }
  });
});
