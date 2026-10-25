import { decodeFrame, encodeFrame, readRecord, SYSTEM, type Frame, type ParamRecord } from '@rackline/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlClient } from '../src/index.js';
import { FakeSocket, type Sent } from './fake-socket.js';

const IP = '192.168.69.22';

/** A device that answers every frame like the simulator: reads return `value(record)`, writes echo. */
function device(value: (r: ParamRecord) => number = () => 0) {
  return (sent: Sent) => {
    const request = decodeFrame(sent.data);
    if (!request.ok) return [];
    const reply: Frame = {
      kind: 'reply',
      status: 0,
      records: request.value.records.map((r) => (request.value.kind === 'read' ? { ...r, value: value(r) } : r)),
    };
    return [{ data: encodeFrame(reply), address: IP, port: 5000 }];
  };
}

const trim = (block: number): ParamRecord => readRecord({ target: 'block', instance: block, objectType: 0x0106, index: 2 }, 1);

describe('ControlClient', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('reads in frames of at most 64 records, sent one after another to UDP 5000', async () => {
    const socket = new FakeSocket(device((r) => r.instance));
    const client = new ControlClient(socket, IP);
    const records = Array.from({ length: 70 }, (_, i) => trim(i + 1));

    const result = await client.read(records);

    expect(result.ok && result.value.map((r) => r.value)).toEqual(records.map((r) => r.instance));
    const frames = socket.sent.map((s) => decodeFrame(s.data));
    expect(frames.map((f) => f.ok && [f.value.kind, f.value.records.length])).toEqual([
      ['read', 64],
      ['read', 6],
    ]);
    expect(socket.sent.every((s) => s.port === 5000 && s.address === IP)).toBe(true);
    expect(socket.listenerCount).toBe(0);
  });

  it('resends a frame that got no reply and gives up after the last attempt', async () => {
    let calls = 0;
    const answerSecond = device();
    const socket = new FakeSocket((sent) => (++calls === 2 ? answerSecond(sent) : []));
    const client = new ControlClient(socket, IP, { timeoutMs: 100, attempts: 3 });

    const first = client.read([trim(1)]);
    await vi.advanceTimersByTimeAsync(100);
    expect((await first).ok).toBe(true);
    expect(socket.sent).toHaveLength(2);

    const second = client.read([trim(1)]);
    await vi.advanceTimersByTimeAsync(300);
    expect(await second).toEqual({ ok: false, error: `no reply from ${IP}` });
    expect(socket.sent).toHaveLength(5);
  });

  it('ignores replies from another address or to another request', async () => {
    const answer = device(() => 7);
    const socket = new FakeSocket((sent) => {
      const other = encodeFrame({ kind: 'reply', status: 0, records: [{ ...trim(2), value: 1 }] });
      return [
        ...answer(sent).map((p) => ({ ...p, address: '192.168.69.23' })),
        { data: other, address: IP, port: 5000 },
        ...answer(sent),
      ];
    });
    const result = await new ControlClient(socket, IP).read([trim(1)]);
    expect(result.ok && result.value[0]?.value).toBe(7);
  });

  it('reports a reply with an error status', async () => {
    const socket = new FakeSocket((sent) => {
      const request = decodeFrame(sent.data);
      if (!request.ok) return [];
      return [{ data: encodeFrame({ ...request.value, kind: 'reply', status: 3 }), address: IP, port: 5000 }];
    });
    expect(await new ControlClient(socket, IP).read([trim(1)])).toEqual({ ok: false, error: 'device rejected the frame (status 3)' });
  });

  it('keeps concurrent callers in order, one frame in flight', async () => {
    const socket = new FakeSocket(device((r) => r.instance));
    const client = new ControlClient(socket, IP);
    const results = await Promise.all([client.read([trim(1)]), client.read([trim(2)]), client.write([{ ...trim(3), value: 200 }])]);
    expect(results.map((r) => r.ok && r.value[0]?.value)).toEqual([1, 2, 200]);
    expect(socket.sent.map((s) => decodeFrame(s.data)).map((f) => f.ok && f.value.records[0]?.instance)).toEqual([1, 2, 3]);
  });

  it('writes a preset recall but refuses other system objects such as network settings', async () => {
    const socket = new FakeSocket(device());
    const client = new ControlClient(socket, IP);
    expect((await client.write([{ ...readRecord(SYSTEM.currentPreset, 1), value: 2 }])).ok).toBe(true);

    const network = { target: 'system', instance: 0x13, objectType: 0xfe03, index: 0, size: 4, value: 0 } as const;
    expect(await client.write([network])).toEqual({ ok: false, error: 'refusing to write system object fe03 index 0' });
    expect(socket.sent).toHaveLength(1);
  });

  it('keeps working after a caller passes a record that cannot be encoded', async () => {
    const client = new ControlClient(new FakeSocket(device(() => 5)), IP);
    await expect(client.read([{ ...trim(1), instance: 300 }])).rejects.toThrow('instance 300 out of range');
    expect((await client.read([trim(1)])).ok).toBe(true);
  });
});
