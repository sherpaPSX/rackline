import { Segmented, ToggleButton } from '@rackline/ui-kit';
import type { ChannelChoice, LinkedModule } from './linked.js';

/** "In 1" → "1", "Out 5" → "5": the button text; the full name goes to screen readers. */
const short = (name: string) => name.replace(/^(In|Out) /, '');

/**
 * Edit both channels of a stereo module or one of them, named by their
 * physical channels. While both are linked and equal it is one quiet
 * "1+2" button (press to edit one channel); when they differ it shows all
 * choices, in amber.
 */
export function ChannelPicker({ linked, owner }: { linked: LinkedModule; owner: string }) {
  if (!linked.stereo) return null;
  const [a = 'L', b = 'R'] = linked.names;
  const options: { value: ChannelChoice; label: string }[] = [
    { value: 'LR', label: `${short(a)}+${short(b)}` },
    { value: 'L', label: short(a) },
    { value: 'R', label: short(b) },
  ];
  if (linked.choice === 'LR' && !linked.differ) {
    return (
      <div className="app-channels">
        <ToggleButton
          pressed={false}
          onChange={() => linked.setChoice('L')}
          aria-label={`${owner}: ${a} and ${b} linked, edit one channel`}
          title={`${a} and ${b} linked. Click to edit one channel.`}
        >
          {options[0]?.label}
        </ToggleButton>
      </div>
    );
  }
  return (
    <div className="app-channels" data-differ={linked.differ || undefined} title={linked.differ ? `${a} and ${b} differ` : `${a} / ${b}`}>
      <Segmented label={`${owner}: edit ${a}, ${b} or both`} options={options} value={linked.choice} onChange={linked.setChoice} />
    </div>
  );
}
