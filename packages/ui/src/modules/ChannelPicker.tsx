import { Segmented } from '@rackline/ui-kit';
import type { ChannelChoice, LinkedModule } from './linked.js';

/** "In 1" → "1", "Out 5" → "5": the button text; the full name goes to screen readers. */
const short = (name: string) => name.replace(/^(In|Out) /, '');

/**
 * Edit both channels of a stereo module or one of them, named by their
 * physical channels; sits in the module header and turns amber when the
 * channels hold different values.
 */
export function ChannelPicker({ linked, owner }: { linked: LinkedModule; owner: string }) {
  if (!linked.stereo) return null;
  const [a = 'L', b = 'R'] = linked.names;
  const options: { value: ChannelChoice; label: string }[] = [
    { value: 'LR', label: `${short(a)}+${short(b)}` },
    { value: 'L', label: short(a) },
    { value: 'R', label: short(b) },
  ];
  return (
    <div className="app-channels" data-differ={linked.differ || undefined} title={linked.differ ? `${a} and ${b} differ` : `${a} / ${b}`}>
      <Segmented label={`${owner}: edit ${a}, ${b} or both`} options={options} value={linked.choice} onChange={linked.setChoice} />
    </div>
  );
}
