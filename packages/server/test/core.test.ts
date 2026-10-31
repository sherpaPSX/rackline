import type { ServerMessage } from '@rackline/api';
import { SYSTEM } from '@rackline/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Core, type Device } from '../src/index.js';
import { FakeDevice, PSX_TEXT } from './fixtures.js';

/** Output SUB HORN (block 11, 0x0106): trim at index 2. */
const SUB_HORN_TRIM = { target: 'block', instance: 11, objectType: 0x0106, index: 2 } as const;

function setup(device = new FakeDevice()) {
  const opened: string[] = [];
  const core = new Core({
    openDevice: (ip: string): Promise<Device> => {
      opened.push(ip);
      return Promise.resolve(device);
    },
    discover: () => Promise.resolve([{ ip: device.ip, mac: '00:50:c2:12:34:56' }]),
    throttleMs: 30,
    pollMs: 2000,
  });
  const sent: ServerMessage[] = [];
  core.subscribe((m) => sent.push(m));
  const last = <T extends ServerMessage['type']>(type: T) => sent.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type).at(-1);
  return { core, device, sent, opened, last };
}

describe('Core', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('connects: reads device info, the setup over TFTP and every value', async () => {
    const { core, opened, last } = setup();
    await core.handle({ type: 'connect', ip: '192.168.69.22' });

    expect(opened).toEqual(['192.168.69.22']);
    const state = core.state();
    expect(state.connection).toEqual({ status: 'online', device: { ip: '192.168.69.22', model: 'RPM 26z', firmware: '2.5.3', name: 'PSX' } });
    expect(state.setup?.source).toEqual({ kind: 'device', ip: '192.168.69.22' });
    expect(state.setup?.racks).toHaveLength(7);
    expect(state.values['11']).toEqual({ trim: 0, mute: true, invert: false });
    expect(state.currentPreset).toBe(1);
    expect(last('state')?.state).toEqual(state);
  });

  it('reports a device that does not answer and stays offline', async () => {
    const device = new FakeDevice();
    device.reachable = false;
    const { core } = setup(device);
    await core.handle({ type: 'connect', ip: device.ip });
    expect(core.state().connection).toEqual({ status: 'offline', error: 'no reply from 192.168.69.22' });
    expect(core.state().setup).toBeUndefined();
    expect(device.closed).toBe(true);
  });

  it('sets a parameter: broadcasts the stored value and writes it to the device', async () => {
    const { core, device, last } = setup();
    await core.handle({ type: 'connect', ip: device.ip });
    await core.handle({ type: 'setParam', blockId: 11, key: 'trim', value: -6.3 });
    await vi.advanceTimersByTimeAsync(0);

    expect(last('param')).toEqual({ type: 'param', blockId: 11, key: 'trim', value: -6.5 });
    expect(core.state().values['11']?.trim).toBe(-6.5);
    expect(device.writes).toEqual([{ ...SUB_HORN_TRIM, size: 1, value: 179 }]);
  });

  it('throttles a moving fader and always writes the final value', async () => {
    const { core, device, sent } = setup();
    await core.handle({ type: 'connect', ip: device.ip });
    for (const db of [-1, -2, -3, -4]) await core.handle({ type: 'setParam', blockId: 11, key: 'trim', value: db });
    await vi.advanceTimersByTimeAsync(0);
    expect(device.writes.map((w) => w.value)).toEqual([190]);
    await vi.advanceTimersByTimeAsync(30);
    expect(device.writes.map((w) => w.value)).toEqual([190, 184]);
    expect(sent.filter((m) => m.type === 'param')).toHaveLength(4);
  });

  it('rejects unknown parameters and values of the wrong type', async () => {
    const { core, device, sent } = setup();
    expect(await core.handle({ type: 'setParam', blockId: 11, key: 'trim', value: 0 })).toBe('no setup loaded');
    await core.handle({ type: 'connect', ip: device.ip });
    expect(await core.handle({ type: 'setParam', blockId: 11, key: 'trim', value: true })).toBe(
      'trim: wrong value type for a number parameter',
    );
    expect(sent.some((m) => m.type === 'param')).toBe(false);
    expect(device.writes).toEqual([]);
  });

  it('recalls a preset on the device and reads all values back', async () => {
    const { core, device } = setup();
    device.presets.set(2, [{ ...SUB_HORN_TRIM, size: 1, value: 172 }]);
    await core.handle({ type: 'connect', ip: device.ip });
    await core.handle({ type: 'recallPreset', preset: 2 });
    expect(device.get(SYSTEM.currentPreset)).toBe(2);
    expect(core.state().currentPreset).toBe(2);
    expect(core.state().values['11']?.trim).toBe(-10);
  });

  it('marks the device unreachable, keeps the state and reloads when it answers again', async () => {
    const { core, device, last } = setup();
    await core.handle({ type: 'connect', ip: device.ip });
    device.reachable = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(last('connection')?.connection.status).toBe('unreachable');
    expect(core.state().values['11']?.trim).toBe(0);

    device.set(SUB_HORN_TRIM, 182); // changed meanwhile, e.g. on another computer
    device.reachable = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(core.state().connection.status).toBe('online');
    expect(core.state().values['11']?.trim).toBe(-5);
  });

  it('re-reads the values when a preset is recalled elsewhere', async () => {
    const { core, device } = setup();
    await core.handle({ type: 'connect', ip: device.ip });
    device.set(SUB_HORN_TRIM, 172);
    device.set(SYSTEM.currentPreset, 4);
    await vi.advanceTimersByTimeAsync(2000);
    expect(core.state().currentPreset).toBe(4);
    expect(core.state().values['11']?.trim).toBe(-10);
  });

  it('opens an .r26 without a device: values from preset 0, presets recalled from the file', async () => {
    const { core } = setup();
    await core.handle({ type: 'openProject', fileName: 'PSX_RCF_FINAL.r26', text: PSX_TEXT });
    expect(core.state().connection).toEqual({ status: 'offline' });
    expect(core.state().setup?.source).toEqual({ kind: 'file', fileName: 'PSX_RCF_FINAL.r26' });
    expect(core.state().values['3']).toEqual({ threshold: 0, attack: 10, release: 6 });

    await core.handle({ type: 'setParam', blockId: 11, key: 'mute', value: false });
    expect(core.state().values['11']?.mute).toBe(false);
    await core.handle({ type: 'recallPreset', preset: 1 });
    expect(core.state().currentPreset).toBe(1);
    expect(await core.handle({ type: 'recallPreset', preset: 3 })).toBe('preset 3 is empty in this file');
    expect(await core.handle({ type: 'openProject', fileName: 'x.r26', text: 'nope' })).toBe(
      'cannot open x.r26: not an .r26 file (no <RPM SOFTWAREVERSION>)',
    );
  });

  it('disconnects, closes the device and stops polling', async () => {
    const { core, device } = setup();
    await core.handle({ type: 'connect', ip: device.ip });
    await core.handle({ type: 'disconnect' });
    expect(device.closed).toBe(true);
    expect(core.state()).toEqual({ connection: { status: 'offline' }, devices: [], values: {} });
    device.reachable = false;
    await vi.advanceTimersByTimeAsync(4000);
    expect(core.state().connection.status).toBe('offline');
  });

  it('lists discovered devices', async () => {
    const { core, last } = setup();
    await core.handle({ type: 'discover' });
    expect(last('devices')?.devices).toEqual([{ ip: '192.168.69.22', mac: '00:50:c2:12:34:56' }]);
  });

  it('moves a device from another subnet into this network before connecting', async () => {
    const device = new FakeDevice();
    const opened: string[] = [];
    const core = new Core({
      openDevice: (ip) => {
        opened.push(ip);
        return Promise.resolve(device);
      },
      discover: () => Promise.resolve([{ ip: '10.9.9.9', mac: '00:11:fa:01:1c:5c', reachable: false }]),
      moveIntoNetwork: (d) => Promise.resolve({ ok: true, value: { ip: '192.168.69.22', mac: d.mac, reachable: true } }),
    });
    await core.handle({ type: 'discover' });
    await core.handle({ type: 'connect', ip: '10.9.9.9' });
    expect(opened).toEqual(['192.168.69.22']);
    expect(core.state().devices).toEqual([{ ip: '192.168.69.22', mac: '00:11:fa:01:1c:5c', reachable: true }]);
    expect(core.state().connection.status).toBe('online');
  });

  it('stays offline with the reason when the device cannot be moved', async () => {
    const core = new Core({
      openDevice: () => Promise.reject(new Error('must not open')),
      discover: () => Promise.resolve([{ ip: '10.9.9.9', mac: '00:11:fa:01:1c:5c', reachable: false }]),
      moveIntoNetwork: () => Promise.resolve({ ok: false, error: 'no free address' }),
    });
    await core.handle({ type: 'discover' });
    await core.handle({ type: 'connect', ip: '10.9.9.9' });
    expect(core.state().connection).toEqual({ status: 'offline', error: "cannot bring the device into this computer's network: no free address" });
  });

  it('drops a connect that is overtaken by a disconnect while the socket opens', async () => {
    const device = new FakeDevice();
    let open: (d: Device) => void = () => undefined;
    const core = new Core({ openDevice: () => new Promise((resolve) => (open = resolve)), discover: () => Promise.resolve([]) });
    const connecting = core.handle({ type: 'connect', ip: device.ip });
    await vi.advanceTimersByTimeAsync(0); // connect is now waiting for the socket
    await core.handle({ type: 'disconnect' });
    open(device);
    await connecting;
    expect(core.state().connection.status).toBe('offline');
    expect(device.closed).toBe(true);
  });
});
