import { describe, expect, it } from 'vitest';
import { API_VERSION, parseClientMessage, parseServerMessage, type AppState, type ServerMessage } from '../src/index.js';

const state: AppState = {
  connection: { status: 'online', device: { ip: '192.168.69.22', model: 'RPM 26z', firmware: '2.5.3', name: 'RPM' } },
  devices: [{ ip: '192.168.69.22', mac: '00:0e:a1:00:00:01' }],
  setup: {
    name: 'RPM 26z Configuration',
    source: { kind: 'device', ip: '192.168.69.22' },
    blocks: [
      { id: 1, blockType: 0x0105, name: 'LEFT ANALOG', channel: 1 },
      { id: 0x19, blockType: 0x0501, name: 'Limiter 1', channel: 0 },
      { id: 0x0b, blockType: 0x0106, name: 'SUB HORN', channel: 1 },
    ],
    inputIds: [1],
    outputIds: [0x0b],
    racks: [
      {
        id: 'rack-25',
        name: 'SUB HORN',
        channels: [{ sources: [{ kind: 'input', blockId: 1 }], outputIds: [0x0b] }],
        modules: [{ blockType: 0x0501, blockIds: [0x19] }],
      },
    ],
    modules: [
      {
        blockType: 0x0501,
        name: 'Limiter',
        role: 'processing',
        evidence: 'simulator',
        params: [
          { key: 'threshold', label: 'Threshold', kind: 'number', unit: 'dBFS', min: -40, max: 0, step: 0.5 },
          { key: 'attack', label: 'Attack', kind: 'steps', unit: 'ms', steps: [0.5, 1, 2] },
        ],
        compact: ['threshold'],
      },
    ],
    dspPercent: 2.3,
  },
  values: { '25': { threshold: -6, attack: 2 }, '11': { options: { mute: false, offAtMin: true } } },
  currentPreset: 1,
};

describe('client messages', () => {
  it('accepts every intent', () => {
    const messages = [
      { type: 'setParam', blockId: 25, key: 'threshold', value: -6.5 },
      { type: 'setParam', blockId: 11, key: 'mute', value: true },
      { type: 'setParam', blockId: 11, key: 'options', value: { mute: true, offAtMin: false } },
      { type: 'recallPreset', preset: 24 },
      { type: 'discover' },
      { type: 'connect', ip: '192.168.69.22' },
      { type: 'disconnect' },
      { type: 'openProject', fileName: 'PSX_RCF_FINAL.r26', text: '<RPM SOFTWAREVERSION="4.200000">' },
    ];
    for (const m of messages) expect(parseClientMessage(JSON.stringify(m))).toEqual({ ok: true, value: m });
  });

  it.each([
    ['not JSON', 'fader up'],
    ['unknown type', JSON.stringify({ type: 'uploadLayout' })],
    ['preset out of range', JSON.stringify({ type: 'recallPreset', preset: 25 })],
    ['preset 0', JSON.stringify({ type: 'recallPreset', preset: 0 })],
    ['bad IP', JSON.stringify({ type: 'connect', ip: '192.168.69' })],
    ['value of wrong type', JSON.stringify({ type: 'setParam', blockId: 25, key: 'threshold', value: '-6' })],
    ['fractional block id', JSON.stringify({ type: 'setParam', blockId: 2.5, key: 'mute', value: true })],
  ])('rejects %s', (_, text) => {
    expect(parseClientMessage(text).ok).toBe(false);
  });
});

describe('server messages', () => {
  it('round-trip through JSON, including a full state', () => {
    const messages: ServerMessage[] = [
      { type: 'hello', apiVersion: API_VERSION },
      { type: 'state', state },
      { type: 'param', blockId: 25, key: 'threshold', value: -3 },
      { type: 'connection', connection: { status: 'unreachable', error: 'no reply from 192.168.69.22' } },
      { type: 'devices', devices: [] },
      { type: 'error', message: 'unknown parameter' },
    ];
    for (const m of messages) expect(parseServerMessage(JSON.stringify(m))).toEqual({ ok: true, value: m });
  });

  it('carries an infinite ratio step as "inf"', () => {
    const msg = {
      type: 'state',
      state: {
        ...state,
        setup: {
          ...state.setup,
          modules: [
            {
              blockType: 0x0500,
              name: 'Compressor',
              role: 'processing',
              evidence: 'simulator',
              params: [{ key: 'ratio', label: 'Ratio', kind: 'steps', unit: 'ratio', steps: [1, 20, 'inf'] }],
              compact: ['ratio'],
            },
          ],
        },
      },
    };
    expect(parseServerMessage(JSON.stringify(msg)).ok).toBe(true);
  });
});
