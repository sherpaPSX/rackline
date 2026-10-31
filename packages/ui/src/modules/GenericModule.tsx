import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ModuleInfo, Values } from '@rackline/api';
import { ModuleCard } from '@rackline/ui-kit';
import { ChannelsBadge } from './ChannelsBadge.js';
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
  /** More controls at the end of the card, e.g. the band's output polarity in its Level module. */
  extra?: ReactNode;
}

/** Level's limits for remote wall controls: not needed while tuning. */
const HIDDEN = new Set(['min', 'max']);
/** Dynamics show only their key controls until expanded (D27; live meters join them once the core reads meters). */
const COMPACT = /^(Limiter|Compressor)/;

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
};

/** A small module: every parameter visible, in the order the module lists them. */
export function GenericModule({ module, blockIds, values, rackName, channelNames, title = module.name, extra }: ModuleViewProps) {
  const [open, setOpen] = useState(false);
  const params = module.params.filter((p) => !HIDDEN.has(p.key));
  const linked = useLinkedModule(values, blockIds, params.map((p) => p.key), channelNames);
  const owner = `${rackName} ${title}`;
  const control = (p: ModuleInfo['params'][number]) => (
    <ParamControl
      key={p.key}
      param={p}
      owner={owner}
      label={SHORT[p.key]}
      value={linked.value(p.key)}
      onChange={(value) => linked.set({ [p.key]: value })}
    />
  );
  const compact = COMPACT.test(module.name) ? params.filter((p) => module.compact.includes(p.key)) : [];
  return (
    <ModuleCard
      name={title}
      badge={linked.stereo ? <ChannelsBadge linked={linked} /> : undefined}
      {...(compact.length > 0 && compact.length < params.length ? { summary: compact.map(control), expanded: open, onExpandedChange: setOpen } : {})}
    >
      {params.map(control)}
      {extra}
    </ModuleCard>
  );
}
