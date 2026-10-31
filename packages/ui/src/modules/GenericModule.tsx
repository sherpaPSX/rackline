import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ModuleInfo, Values } from '@rackline/api';
import { Meter, ModuleCard } from '@rackline/ui-kit';
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
  /** Start expanded (the module editor of the system map). */
  initiallyOpen?: boolean | undefined;
  /** More controls at the end of the card, e.g. the band's output polarity in its Level module. */
  extra?: ReactNode;
}

/** Level's limits for remote wall controls: not needed while tuning. */
const HIDDEN = new Set(['min', 'max']);
/** Dynamics show only their key controls until expanded (D27; live meters join them once the core reads meters). */
const COMPACT = /^(Limiter|Compressor)/;
/** More controls than this and a module shows its compact controls until expanded. */
const MANY = 6;

/** Labels short enough for a knob; the full label stays the accessible name. */
const SHORT: Record<string, string> = {
  userTrim: 'User gain',
  outputLevel: 'Out',
  outputMute: 'Out',
  options: 'Mute',
  invert: 'Polarity',
  frequency: 'Freq',
  gainIncrease: 'Gain up',
  gainDecrease: 'Gain down',
  gainNormalize: 'Normalize',
  gainIncreaseTime: 'Up time',
  gainDecreaseTime: 'Down time',
  acousticCoupling: 'Coupling',
  programMute: 'Program',
};

export function shortLabel(key: string): string | undefined {
  const io = /^(input|output)(\d+)(Level|Mute)$/.exec(key);
  if (io) return `${io[1] === 'input' ? 'In' : 'Out'} ${io[2]}`;
  return SHORT[key];
}

/** A parameter that does nothing in the current setting, e.g. the sine frequency while pink noise plays. */
function inactive(key: string, value: (key: string) => unknown): boolean {
  return key === 'frequency' && value('signal') === 0;
}

/** A small module: every parameter visible, in the order the module lists them. */
export function GenericModule({ initiallyOpen, module, blockIds, values, rackName, channelNames, title = module.name, extra }: ModuleViewProps) {
  const [open, setOpen] = useState(initiallyOpen ?? false);
  // A bypass switch is the card's power button, not a control.
  const params = module.params.filter((p) => !HIDDEN.has(p.key) && p.key !== 'bypass');
  const hasBypass = module.params.some((p) => p.key === 'bypass');
  const linked = useLinkedModule(values, blockIds, module.params.map((p) => p.key), channelNames);
  const owner = `${rackName} ${title}`;
  const control = (p: ModuleInfo['params'][number]) => (
    <ParamControl
      key={p.key}
      param={p}
      owner={owner}
      label={shortLabel(p.key) ?? p.label.replace(/\s*\(.*\)$/, '')}
      value={linked.value(p.key)}
      onChange={(value) => linked.set({ [p.key]: value })}
      disabled={inactive(p.key, linked.value)}
    />
  );
  const many = params.length > MANY;
  const compact = COMPACT.test(module.name) || many ? params.filter((p) => module.compact.includes(p.key)) : [];
  return (
    <ModuleCard
      name={title}
      {...(hasBypass ? { on: linked.value('bypass') !== true, onOnChange: (on: boolean) => linked.set({ bypass: !on }) } : {})}
      badge={linked.stereo ? <ChannelPicker linked={linked} owner={owner} /> : undefined}
      {...(compact.length > 0 && compact.length < params.length ? { summary: compact.map(control), expanded: open, onExpandedChange: setOpen } : {})}
    >
      {params.length === 0 && (
        // A meter block; the core does not read levels yet, so it stays empty.
        <div className="rl-cell app-meter-cell">
          <Meter readLevel={() => -Infinity} />
          <span className="rl-label">No level yet</span>
        </div>
      )}
      {many ? <div className="app-many">{params.map(control)}</div> : params.map(control)}
      {extra}
    </ModuleCard>
  );
}
