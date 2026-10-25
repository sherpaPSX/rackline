import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discoverDevices } from '../src/index.js';
import { FakeSocket } from './fake-socket.js';

/** An `RA` reply as the simulator sends it: command, IP, MAC, zero padding to 82 bytes. */
function reply(ip: number[], mac: number[], command = 'RA'): Uint8Array {
  const bytes = new Uint8Array(82);
  bytes.set([command.charCodeAt(0), command.charCodeAt(1), ...ip, ...mac]);
  return bytes;
}

describe('discoverDevices', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('broadcasts RA to UDP 5131 and lists each replying device once', async () => {
    const a = reply([192, 168, 69, 22], [0x00, 0x50, 0xc2, 0x12, 0x34, 0x56]);
    const b = reply([10, 0, 0, 5], [0x00, 0x50, 0xc2, 0x00, 0x00, 0x01]);
    const socket = new FakeSocket(() => [
      { data: a, address: '192.168.69.22', port: 5131 },
      { data: a, address: '192.168.69.22', port: 5131 },
      { data: b, address: '10.0.0.5', port: 5131 },
      { data: reply([1, 2, 3, 4], [1, 2, 3, 4, 5, 6], 'RM'), address: '1.2.3.4', port: 5131 },
      { data: new Uint8Array(10), address: '1.2.3.5', port: 5131 },
    ]);

    const found = discoverDevices(socket, { listenMs: 500 });
    await vi.advanceTimersByTimeAsync(500);

    expect(await found).toEqual([
      { ip: '192.168.69.22', mac: '00:50:c2:12:34:56' },
      { ip: '10.0.0.5', mac: '00:50:c2:00:00:01' },
    ]);
    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toMatchObject({ port: 5131, address: '255.255.255.255' });
    expect(Array.from(socket.sent[0]?.data.subarray(0, 2) ?? [])).toEqual([0x52, 0x41]);
    expect(socket.listenerCount).toBe(0);
  });
});
