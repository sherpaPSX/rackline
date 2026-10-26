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
import { withInputSelect } from '../test/select-demo.js';

// The ANALOG rack gets an input Select (analog 1/2 or digital A/B) to show the source picker.
const state = withInputSelect(AppState.parse(psx));

// Preview only: an in-page fake core that echoes every edit, loaded with PSX_RCF_FINAL.r26.
const fake: OpenSocket = (_url, h) => {
  setTimeout(() => {
    h.open();
    h.message(JSON.stringify({ type: 'hello', apiVersion: 1 }));
    h.message(JSON.stringify({ type: 'state', state }));
  }, 0);
  return {
    send: (text) => {
      const m = JSON.parse(text) as { type: string; blockId?: number; key?: string; value?: unknown };
      if (m.type === 'setParam') setTimeout(() => h.message(JSON.stringify({ type: 'param', blockId: m.blockId, key: m.key, value: m.value })), 5);
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
