import { peqBands } from '../curves.js';
import { FeedbackModule } from './FeedbackModule.js';
import { GenericModule } from './GenericModule.js';
import type { ModuleViewProps } from './GenericModule.js';
import { GeqModule, geqBands } from './GeqModule.js';
import { GridModule, gridSize } from './GridModule.js';
import { PeqModule } from './PeqModule.js';

/** The card for a module, chosen by the shape of its parameters. */
export function ModuleView(props: ModuleViewProps) {
  const { module } = props;
  if (gridSize(module.params).inputs > 0) return <GridModule {...props} />;
  if (geqBands(module).length > 0) return <GeqModule {...props} />;
  if (peqBands(module).length > 0) {
    // The feedback suppressor holds PEQ filters too, but the device sets them.
    return module.params.some((p) => p.key === 'freeze') ? <FeedbackModule {...props} /> : <PeqModule {...props} />;
  }
  return <GenericModule {...props} />;
}
