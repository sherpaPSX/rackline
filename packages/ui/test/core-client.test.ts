import { describe, expect, it } from 'vitest';
import { API_VERSION } from '@rackline/api';
import type { ClientMessage, ServerMessage } from '@rackline/api';
import { CoreClient } from '../src/index.js';
import type { SocketHandlers } from '../src/index.js';
import { psxState } from './fixtures.js';

/** A client on a fake socket with a manual clock and reconnect timer. */
function setup() {
  const sent: ClientMessage[] = [];
  let handlers: SocketHandlers | undefined;
  let opened = 0;
  let pendingReconnect: (() => void) | undefined;
  let time = 0;
  const client = new CoreClient({
    url: 'ws://test',
    openSocket: (_url, h) => {
      handlers = h;
      opened++;
      return { send: (text) => sent.push(JSON.parse(text) as ClientMessage), close: () => h.close() };
    },
    now: () => time,
    later: (run) => {
      pendingReconnect = run;
      return () => (pendingReconnect = undefined);
    },
  });
  const server = (m: ServerMessage) => handlers?.message(JSON.stringify(m));
  const connect = () => {
    handlers?.open();
    server({ type: 'hello', apiVersion: API_VERSION });
    server({ type: 'state', state: psxState() });
  };
  return {
    client,
    sent,
    server,
    connect,
    drop: () => handlers?.close(),
    reconnect: () => pendingReconnect?.(),
    opened: () => opened,
    tick: (ms: number) => (time += ms),
    value: (blockId: number, key: string) => client.getSnapshot().app?.values[String(blockId)]?.[key],
  };
}

describe('CoreClient', () => {
  it('loads the state the core sends on connect', () => {
    const t = setup();
    expect(t.client.getSnapshot().link).toBe('connecting');
    t.connect();
    const snap = t.client.getSnapshot();
    expect(snap.link).toBe('open');
    expect(snap.app?.setup?.racks).toHaveLength(7);
  });

  it('shows an edit at once and sends it rounded like the core', () => {
    const t = setup();
    t.connect();
    t.client.setParam(13, 'trim', -6.3);
    expect(t.value(13, 'trim')).toBe(-6.5);
    expect(t.sent).toEqual([{ type: 'setParam', blockId: 13, key: 'trim', value: -6.5 }]);
  });

  it('keeps the newest local value while older echoes arrive', () => {
    const t = setup();
    t.connect();
    t.client.setParam(13, 'trim', -1);
    t.client.setParam(13, 'trim', -2);
    t.client.setParam(13, 'trim', -3);
    t.server({ type: 'param', blockId: 13, key: 'trim', value: -1 });
    expect(t.value(13, 'trim')).toBe(-3);
    t.server({ type: 'param', blockId: 13, key: 'trim', value: -2 });
    t.server({ type: 'param', blockId: 13, key: 'trim', value: -3 });
    expect(t.value(13, 'trim')).toBe(-3);
    // Another window moves the same fader later: that value wins.
    t.server({ type: 'param', blockId: 13, key: 'trim', value: 4 });
    expect(t.value(13, 'trim')).toBe(4);
  });

  it('takes the stored value from the echo of its own last edit', () => {
    const t = setup();
    t.connect();
    t.client.setParam(17, 'delay', 1);
    t.server({ type: 'param', blockId: 17, key: 'delay', value: 1.0000001 });
    expect(t.value(17, 'delay')).toBe(1.0000001);
  });

  it('undoes a linked stereo edit as one step and redoes it', () => {
    const t = setup();
    t.connect();
    t.client.setParams([
      { blockId: 13, key: 'trim', value: -3 },
      { blockId: 14, key: 'trim', value: -3 },
    ]);
    t.tick(50);
    t.client.setParams([
      { blockId: 13, key: 'trim', value: -4 },
      { blockId: 14, key: 'trim', value: -4 },
    ]);
    expect(t.client.getSnapshot().canUndo).toBe(true);
    t.sent.length = 0;
    t.client.undo();
    expect(t.value(13, 'trim')).toBe(0);
    expect(t.value(14, 'trim')).toBe(0);
    expect(t.sent).toHaveLength(2);
    expect(t.client.getSnapshot()).toMatchObject({ canUndo: false, canRedo: true });
    t.client.redo();
    expect(t.value(14, 'trim')).toBe(-4);
  });

  it('skips edits that change nothing and parameters it does not know', () => {
    const t = setup();
    t.connect();
    t.client.setParam(13, 'trim', 0);
    t.client.setParam(13, 'nonsense', 1);
    t.client.setParam(999, 'trim', 1);
    expect(t.sent).toEqual([]);
    expect(t.client.getSnapshot().canUndo).toBe(false);
  });

  it('forgets undo steps when the core sends a new state (preset recall, new setup)', () => {
    const t = setup();
    t.connect();
    t.client.setParam(13, 'trim', -3);
    t.server({ type: 'state', state: psxState() });
    expect(t.client.getSnapshot().canUndo).toBe(false);
    expect(t.value(13, 'trim')).toBe(0);
  });

  it('applies connection and device updates and keeps errors to read', () => {
    const t = setup();
    t.connect();
    t.server({ type: 'connection', connection: { status: 'unreachable' } });
    t.server({ type: 'devices', devices: [{ ip: '192.168.69.22', mac: '00:11:22:33:44:55' }] });
    t.server({ type: 'error', message: 'preset 7 is empty in this file' });
    const snap = t.client.getSnapshot();
    expect(snap.app?.connection.status).toBe('unreachable');
    expect(snap.app?.devices).toHaveLength(1);
    expect(snap.errors.map((e) => e.message)).toEqual(['preset 7 is empty in this file']);
    const [error] = snap.errors;
    if (error) t.client.dismissError(error.id);
    expect(t.client.getSnapshot().errors).toEqual([]);
  });

  it('warns when the core speaks another API version', () => {
    const t = setup();
    t.server({ type: 'hello', apiVersion: API_VERSION + 1 });
    expect(t.client.getSnapshot().errors[0]?.message).toMatch(/Reload the window/);
  });

  it('reconnects after the core goes away and refuses to send meanwhile', () => {
    const t = setup();
    t.connect();
    t.drop();
    expect(t.client.getSnapshot().link).toBe('closed');
    t.client.send({ type: 'discover' });
    expect(t.sent).toEqual([]);
    expect(t.client.getSnapshot().errors.at(-1)?.message).toMatch(/Not connected/);
    t.reconnect();
    expect(t.opened()).toBe(2);
    t.connect();
    t.client.send({ type: 'discover' });
    expect(t.sent).toEqual([{ type: 'discover' }]);
  });

  it('stops reconnecting once closed', () => {
    const t = setup();
    t.connect();
    t.client.close();
    t.reconnect();
    expect(t.opened()).toBe(1);
  });
});
