import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@rackline/ui-kit/styles.css';
import './app/app.css';
import { App } from './app/App.js';
import { CoreContext } from './app/core-context.js';
import { CoreClient, browserSocket } from './core-client.js';

/** The core's address: `?core=ws://…` overrides the default port on this host. */
function coreUrl(): string {
  const param = new URLSearchParams(location.search).get('core');
  return param ?? `ws://${location.hostname || '127.0.0.1'}:5180`;
}

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root');
const client = new CoreClient({ url: coreUrl(), openSocket: browserSocket });
createRoot(root).render(
  <StrictMode>
    <CoreContext value={client}>
      <App />
    </CoreContext>
  </StrictMode>,
);
