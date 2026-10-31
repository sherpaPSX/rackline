import { decodeDiscoveryReply, formatIpv4 } from '@rackline/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveIntoNetwork } from '../src/index.js';
import { FakeSocket, type Sent } from './fake-socket.js';

const HOME = { address: '192.168.0.131', netmask: '255.255.255.0' };
/** Lukas's RPM 26z as it answered RA on his network. */
const RPM = { ip: '192.168.69.71', mac: '00:11:fa:01:1c:5c' };

/** A device that answers RA with its address and takes the address of a WI for its MAC. */
function fakeRpm(options: { takesAddress?: boolean } = {}) {
  let ip = [192, 168, 69, 71];
  const mac = [0x00, 0x11, 0xfa, 0x01, 0x1c, 0x5c];
  return new FakeSocket((sent: Sent) => {
    const command = String.fromCharCode(sent.data[0] ?? 0, sent.data[1] ?? 0);
    if (command === 'WI' && options.takesAddress !== false && Array.from(sent.data.subarray(6, 12)).join() === mac.join()) {
      ip = Array.from(sent.data.subarray(2, 6));
    }
    if (command !== 'RA') return [];
    const reply = new Uint8Array(82);
    reply.set([0x52, 0x41, ...ip, ...mac]);
    return [{ data: reply, address: formatIpv4(Uint8Array.from(ip)), port: 5131 }];
  });
}

describe('moveIntoNetwork', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('leaves a device that is already in a PC network alone', async () => {
    const socket = fakeRpm();
    const device = { ip: '192.168.0.20', mac: RPM.mac };
    expect(await moveIntoNetwork(socket, device, { networks: [HOME], isFree: () => Promise.resolve(true) })).toEqual({ ok: true, value: device });
    expect(socket.sent).toHaveLength(0);
  });

  it('gives a device in another subnet the highest free address and waits until it answers there', async () => {
    const socket = fakeRpm();
    const probed: string[] = [];
    const isFree = (ip: string) => {
      probed.push(ip);
      return Promise.resolve(ip !== '192.168.0.254');
    };
    const moved = moveIntoNetwork(socket, RPM, { networks: [HOME], isFree, listenMs: 100 });
    await vi.advanceTimersByTimeAsync(100);

    expect(await moved).toEqual({ ok: true, value: { ip: '192.168.0.253', mac: RPM.mac } });
    expect(probed).toEqual(['192.168.0.254', '192.168.0.253']);
    const wi = socket.sent[0];
    expect(wi).toMatchObject({ port: 5131, address: '255.255.255.255' });
    expect(decodeDiscoveryReply(wi?.data ?? new Uint8Array())).toEqual({ ok: true, value: { command: 'WI', ip: '192.168.0.253', mac: RPM.mac } });
    expect(Array.from(wi?.data.subarray(12, 16) ?? [])).toEqual([255, 255, 255, 0]);
  });

  it('fails when the device keeps its address or no address is free', async () => {
    const stubborn = moveIntoNetwork(fakeRpm({ takesAddress: false }), RPM, { networks: [HOME], isFree: () => Promise.resolve(true), listenMs: 100, rounds: 3 });
    await vi.advanceTimersByTimeAsync(300);
    expect(await stubborn).toEqual({ ok: false, error: 'the device at 192.168.69.71 did not take the address 192.168.0.254' });

    const full = await moveIntoNetwork(fakeRpm(), RPM, { networks: [HOME], isFree: () => Promise.resolve(false) });
    expect(full.ok).toBe(false);
    expect(await moveIntoNetwork(fakeRpm(), RPM, { networks: [], isFree: () => Promise.resolve(true) })).toEqual({ ok: false, error: 'this computer is not on any network' });
  });
});
