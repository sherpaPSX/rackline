import { Segmented } from '@rackline/ui-kit';
import type { ChannelChoice, LinkedModule } from './linked.js';

const OPTIONS = [
  { value: 'LR', label: 'L+R' },
  { value: 'L', label: 'L' },
  { value: 'R', label: 'R' },
] as const satisfies readonly { value: ChannelChoice; label: string }[];

/**
 * Edit both channels of a stereo module or one of them; sits in the module
 * header and turns amber when L and R hold different values.
 */
export function ChannelPicker({ linked, owner }: { linked: LinkedModule; owner: string }) {
  if (!linked.stereo) return null;
  return (
    <div className="app-channels" data-differ={linked.differ || undefined} title={linked.differ ? 'L and R differ' : undefined}>
      <Segmented label={`${owner}: edit channels`} options={OPTIONS} value={linked.choice} onChange={linked.setChoice} />
    </div>
  );
}
