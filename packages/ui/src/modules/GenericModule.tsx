import type { ModuleInfo, Values } from '@rackline/api';
import { ModuleCard } from '@rackline/ui-kit';
import { ChannelPicker } from './ChannelPicker.js';
import { ParamControl } from './ParamControl.js';
import { useLinkedModule } from './linked.js';

export interface ModuleViewProps {
  module: ModuleInfo;
  /** One block per channel. */
  blockIds: readonly number[];
  values: Values;
  /** Rack name, so screen readers hear "SUB FLEX Delay". */
  rackName: string;
  /** Physical names of the channels (see rackChannelNames). */
  channelNames?: readonly string[] | undefined;
  /** Name on the card; defaults to the module type. */
  title?: string | undefined;
}

/** Labels short enough for a knob; the full label stays the accessible name. */
const SHORT: Record<string, string> = {
  userTrim: 'User gain',
  input1Level: 'In 1',
  input1Mute: 'In 1',
  input2Level: 'In 2',
  input2Mute: 'In 2',
  outputLevel: 'Out',
  outputMute: 'Out',
  options: 'Mute',
  invert: 'Polarity',
  min: 'Min',
  max: 'Max',
};

/** A small module: every parameter visible, in the order the module lists them. */
export function GenericModule({ module, blockIds, values, rackName, channelNames, title = module.name }: ModuleViewProps) {
  const keys = module.params.map((p) => p.key);
  const linked = useLinkedModule(values, blockIds, keys, channelNames);
  const owner = `${rackName} ${title}`;
  return (
    <ModuleCard name={title} badge={linked.stereo ? <ChannelPicker linked={linked} owner={owner} /> : undefined}>
      {module.params.map((p) => (
        <ParamControl
          key={p.key}
          param={p}
          owner={owner}
          label={SHORT[p.key]}
          value={linked.value(p.key)}
          onChange={(value) => linked.set({ [p.key]: value })}
        />
      ))}
    </ModuleCard>
  );
}
