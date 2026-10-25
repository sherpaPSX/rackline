import { readFileSync } from 'node:fs';
import { decodeTftpPacket } from '@rackline/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadConfig } from '../src/index.js';
import { FakeSocket, type Sent } from './fake-socket.js';

const IP = '192.168.69.22';
/** Captured RPM26z_01 config (block table part), see packages/protocol/test/fixtures/README.md. */
const FILE = new Uint8Array(readFileSync(new URL('../../protocol/test/fixtures/rpm26z_01-config-table.bin', import.meta.url)));

const data = (block: number): Uint8Array =>
  Uint8Array.from([0, 3, block >> 8, block & 0xff, ...FILE.subarray((block - 1) * 512, block * 512)]);

/** Serves FILE like the simulator: block 1 on RRQ, block n+1 on ack n, from port 69. */
function tftpDevice(drop: (sent: Sent, n: number) => boolean = () => false) {
  let n = 0;
  return (sent: Sent) => {
    n++;
    if (drop(sent, n)) return [];
    const packet = decodeTftpPacket(sent.data);
    if (!packet.ok) return [];
    const next = packet.value.op === 'rrq' ? 1 : packet.value.op === 'ack' ? packet.value.block + 1 : 0;
    if (next === 0 || (next - 1) * 512 > FILE.length) return [];
    return [{ data: data(next), address: IP, port: 69 }];
  };
}

describe('downloadConfig', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('downloads the captured config byte for byte and acks every block', async () => {
    const socket = new FakeSocket(tftpDevice());
    const result = await downloadConfig(socket, IP);

    expect(result.ok && result.value).toEqual(FILE);
    const blocks = Math.floor(FILE.length / 512) + 1;
    expect(socket.sent.map((s) => decodeTftpPacket(s.data)).map((p) => p.ok && p.value.op)).toEqual(['rrq', ...Array<string>(blocks).fill('ack')]);
    expect(socket.sent.every((s) => s.port === 69 && s.address === IP)).toBe(true);
    expect(socket.listenerCount).toBe(0);
  });

  it('resends the last ack when a block does not arrive', async () => {
    const socket = new FakeSocket(tftpDevice((_, n) => n === 2));
    const download = downloadConfig(socket, IP, { timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    const result = await download;
    expect(result.ok && result.value).toEqual(FILE);
    const acks = socket.sent.map((s) => decodeTftpPacket(s.data)).map((p) => p.ok && p.value.op === 'ack' && p.value.block);
    expect(acks.slice(0, 4)).toEqual([false, 1, 1, 2]);
  });

  it('gives up when the device does not answer', async () => {
    const socket = new FakeSocket();
    const download = downloadConfig(socket, IP, { timeoutMs: 100, attempts: 3 });
    await vi.advanceTimersByTimeAsync(300);
    expect(await download).toEqual({ ok: false, error: `no TFTP reply from ${IP}` });
    expect(socket.sent).toHaveLength(3);
  });

  it('stops on a TFTP error from the device', async () => {
    const error = Uint8Array.from([0, 5, 0, 1, ...Buffer.from('File not found'), 0]);
    const socket = new FakeSocket(() => [{ data: error, address: IP, port: 69 }]);
    expect(await downloadConfig(socket, IP)).toEqual({ ok: false, error: 'device error 1: File not found' });
  });
});
