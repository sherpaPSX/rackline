import { Button } from '@rackline/ui-kit';
import type { Setup, Values } from '@rackline/api';
import { SystemGrid } from './SystemGrid.js';
import { SystemRacks } from './SystemRacks.js';

/**
 * System, mode Tune: the setup as Drag Net draws it, values only. Setups
 * without a Drag Net schematic fall back to the racks view.
 */
export function SystemScreen({ setup, values }: { setup: Setup; values: Values }) {
  return (
    <div className="app-screen app-screen-fluid">
      <div className="app-toolbar">
        <span className="app-mode">Tune</span>
        <Button disabled title="Editing the layout comes in phase 2">
          Edit layout
        </Button>
      </div>
      {setup.canvas ? <SystemGrid setup={setup} values={values} canvas={setup.canvas} /> : <SystemRacks setup={setup} values={values} />}
    </div>
  );
}
