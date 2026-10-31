import type { Setup, Values } from '@rackline/api';
import { SystemGrid } from './SystemGrid.js';
import { SystemRacks } from './SystemRacks.js';

/**
 * System: the setup as Drag Net draws it, values only (editing the layout
 * comes in phase 2). Setups without a Drag Net schematic fall back to the
 * racks view.
 */
export function SystemScreen({ setup, values }: { setup: Setup; values: Values }) {
  return (
    <div className="app-screen app-screen-fluid">
      {setup.canvas ? <SystemGrid setup={setup} values={values} canvas={setup.canvas} /> : <SystemRacks setup={setup} values={values} />}
    </div>
  );
}
