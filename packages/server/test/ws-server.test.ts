import { API_VERSION, parseServerMessage, type ServerMessage } from '@rackline/api';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { Core, startWsServer, type WsServer } from '../src/index.js';
import { FakeDevice, PSX_TEXT } from './fixtures.js';

/** A WebSocket client on 127.0.0.1 that collects validated server messages. */
async function client(port: number) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const received: ServerMessage[] = [];
  const waiters: (() => void)[] = [];
  socket.on('message', (data) => {
    const parsed = parseServerMessage(data.toString());
    if (!parsed.ok) throw new Error(parsed.error);
    received.push(parsed.value);
    waiters.splice(0).forEach((w) => w());
  });
  await new Promise((resolve) => socket.once('open', resolve));
  /** Resolves once `count` messages have arrived. */
  const messages = async (count: number): Promise<ServerMessage[]> => {
    while (received.length < count) await new Promise<void>((resolve) => waiters.push(resolve));
    return received.slice(0, count);
  };
  return { socket, received, messages, send: (m: unknown) => socket.send(JSON.stringify(m)) };
}

describe('WebSocket server (loopback)', () => {
  let server: WsServer | undefined;
  afterEach(async () => server?.close());

  async function start() {
    const device = new FakeDevice();
    const core = new Core({ openDevice: () => Promise.resolve(device), discover: () => Promise.resolve([]), pollMs: 60_000 });
    server = await startWsServer(core, { port: 0 });
    return { core, device, port: server.port };
  }

  it('greets every client with hello and the whole state', async () => {
    const { port } = await start();
    const a = await client(port);
    expect(await a.messages(2)).toEqual([
      { type: 'hello', apiVersion: API_VERSION },
      { type: 'state', state: { connection: { status: 'offline' }, devices: [], values: {} } },
    ]);
    a.socket.close();
  });

  it('broadcasts the result of one client intent to all clients', async () => {
    const { port, device } = await start();
    const [a, b] = await Promise.all([client(port), client(port)]);
    await Promise.all([a.messages(2), b.messages(2)]);

    a.send({ type: 'connect', ip: device.ip });
    const [connecting, online] = (await b.messages(4)).slice(2);
    expect(connecting?.type === 'state' && connecting.state.connection.status).toBe('connecting');
    expect(online?.type === 'state' && online.state.setup?.racks.length).toBe(7);

    b.send({ type: 'setParam', blockId: 11, key: 'trim', value: -3 });
    expect((await a.messages(5))[4]).toEqual({ type: 'param', blockId: 11, key: 'trim', value: -3 });
    a.socket.close();
    b.socket.close();
  });

  it('answers an invalid or rejected message to its sender only', async () => {
    const { port } = await start();
    const [a, b] = await Promise.all([client(port), client(port)]);
    await Promise.all([a.messages(2), b.messages(2)]);

    a.send({ type: 'uploadLayout' });
    a.send({ type: 'openProject', fileName: 'x.r26', text: 'nope' });
    const [invalid, rejected] = (await a.messages(4)).slice(2);
    expect(invalid?.type).toBe('error');
    expect(rejected).toEqual({ type: 'error', message: 'cannot open x.r26: not an .r26 file (no <RPM SOFTWAREVERSION>)' });

    b.send({ type: 'openProject', fileName: 'PSX_RCF_FINAL.r26', text: PSX_TEXT });
    await Promise.all([a.messages(5), b.messages(3)]);
    expect(b.received.map((m) => m.type)).toEqual(['hello', 'state', 'state']);
    a.socket.close();
    b.socket.close();
  });
});
