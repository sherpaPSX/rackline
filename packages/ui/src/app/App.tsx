import { useEffect, useState } from 'react';
import type { AppState } from '@rackline/api';
import { IconButton } from '@rackline/ui-kit';
import { ShowScreen } from '../screens/ShowScreen.js';
import { SystemScreen } from '../screens/SystemScreen.js';
import { useCore, useCoreClient } from './core-context.js';
import { Header } from './Header.js';
import type { Screen } from './Header.js';

function NoSetup({ app }: { app: AppState | undefined }) {
  return (
    <div className="app-screen app-empty">
      <p>{app ? 'No setup loaded. Connect to a device or open a .r26 file in the bar above.' : 'Waiting for the Rackline core…'}</p>
    </div>
  );
}

/** Ctrl/Cmd+Z undoes, with Shift (or Ctrl+Y) redoes, except while typing a value. */
function useUndoKeys() {
  const client = useCoreClient();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'y') {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) client.redo();
        else client.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [client]);
}

export function App() {
  const snap = useCore();
  const client = useCoreClient();
  const [screen, setScreen] = useState<Screen>('show');
  useUndoKeys();
  const app = snap.app;
  const setup = app?.setup;
  // Show, Live and presets need a device; without one the app edits the file.
  const online = app?.connection.status === 'online';
  const shown: Screen = !online ? 'edit' : screen === 'edit' ? 'live' : screen;

  return (
    <div className="app">
      <Header snap={snap} screen={shown} onScreen={setScreen} />
      {snap.errors.length > 0 && (
        <div className="app-errors" role="alert">
          {snap.errors.map((e) => (
            <div key={e.id} className="app-error">
              <span>{e.message}</span>
              <IconButton icon="close" label="Dismiss" onClick={() => client.dismissError(e.id)} />
            </div>
          ))}
        </div>
      )}
      <main className="app-main">
        {!setup || !app ? (
          <NoSetup app={app} />
        ) : shown === 'show' ? (
          <ShowScreen setup={setup} values={app.values} />
        ) : (
          <SystemScreen setup={setup} values={app.values} />
        )}
      </main>
    </div>
  );
}
