import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@rackline/ui-kit/styles.css';
import '../src/app/app.css';
import { App } from '../src/app/App.js';
import { CoreContext } from '../src/app/core-context.js';
import { CoreClient } from '../src/core-client.js';
import type { OpenSocket } from '../src/core-client.js';
import { AppState } from '@rackline/api';
import psx from '../test/fixtures/psx-rcf-final-state.json';
import catalog from '../test/fixtures/module-catalog-state.json';
import { withSelects } from '../test/select-demo.js';

/** Which preview build.mjs is building: Lukas's rig, or every module on one page. */
declare const __PREVIEW__: 'preview' | 'modules';

// Lukas's file with an input Select, so the preview shows picking the source.
const state = __PREVIEW__ === 'modules' ? AppState.parse(catalog) : withSelects(AppState.parse(psx), { output: false });

const PRETEND = { ip: '192.168.0.100', mac: '00:00:00:00:00:01' };

const online = (currentPreset: number) => ({
  ...state,
  devices: [],
  currentPreset,
  connection: { status: 'online', device: { ip: PRETEND.ip, model: 'RPM 26z', firmware: '2.5.3', name: 'Preview RPM' } },
  setup: state.setup && { ...state.setup, source: { kind: 'device', ip: PRETEND.ip } },
});

// Preview only: an in-page fake core that echoes every edit.
const fake: OpenSocket = (_url, h) => {
  setTimeout(() => {
    h.open();
    h.message(JSON.stringify({ type: 'hello', apiVersion: 1 }));
    h.message(JSON.stringify({ type: 'state', state }));
  }, 0);
  return {
    send: (text) => {
      const m = JSON.parse(text) as { type: string; blockId?: number; key?: string; value?: unknown };
      const send = (msg: object) => setTimeout(() => h.message(JSON.stringify(msg)), 5);
      if (m.type === 'setParam') send({ type: 'param', blockId: m.blockId, key: m.key, value: m.value });
      // A pretend RPM, so both the file (Edit) and the device (Show, Live) can be tried.
      else if (m.type === 'discover') send({ type: 'devices', devices: [PRETEND] });
      else if (m.type === 'connect') send({ type: 'state', state: online(1) });
      else if (m.type === 'disconnect') send({ type: 'state', state });
      else if (m.type === 'recallPreset') send({ type: 'state', state: online((m as { preset?: number }).preset ?? 1) });
      else h.message(JSON.stringify({ type: 'error', message: `Preview: "${m.type}" needs the real app.` }));
    },
    close: () => undefined,
  };
};
const client = new CoreClient({ url: 'preview', openSocket: fake });
const root = document.getElementById('root');
if (!root) throw new Error('no #root');
createRoot(root).render(
  <StrictMode>
    <CoreContext value={client}>
      <App />
    </CoreContext>
  </StrictMode>,
);
