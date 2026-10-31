import { useState } from 'react';
import type { ModuleInfo } from '@rackline/api';
import { ConfirmButton, EqCurve, GraphicEq } from '@rackline/ui-kit';
import type { Filter } from '@rackline/ui-kit';
import { ModuleCard } from '@rackline/ui-kit';
import { ChannelPicker } from './ChannelPicker.js';
import type { ModuleViewProps } from './GenericModule.js';
import { useLinkedModule } from './linked.js';
import { ParamControl } from './ParamControl.js';

/** Graphic EQ band keys with their frequency, read from the labels ("1.25k Hz"). */
export function geqBands(module: ModuleInfo): { key: string; freq: number }[] {
  return module.params.flatMap((p) => {
    const key = /^band\d+Gain$/.test(p.key) ? p.key : undefined;
    const m = /^([\d.]+)(k?) Hz$/.exec(p.label);
    return key && m ? [{ key, freq: Number(m[1]) * (m[2] ? 1000 : 1) }] : [];
  });
}

/** ⅓-octave bands: Q of a peak filter one third of an octave wide. */
const THIRD_OCTAVE_Q = 4.32;

/** Controls next to the faders, in this order. */
const SIDE = ['range', 'eqType', 'lowCut', 'inputLevel', 'outputLevel', 'lowLevel', 'midLevel', 'highLevel'];
const SHORT: Record<string, string> = { eqType: 'Type', inputLevel: 'In', outputLevel: 'Out', lowLevel: 'Low', midLevel: 'Mid', highLevel: 'High' };

/** 30-band graphic EQ: compact curve in the chain, faders under the curve when expanded. */
export function GeqModule({ module, blockIds, values, rackName, channelNames, title = 'Graphic EQ' }: ModuleViewProps) {
  const [open, setOpen] = useState(false);
  const linked = useLinkedModule(values, blockIds, module.params.map((p) => p.key), channelNames);
  const owner = `${rackName} ${title}`;
  const bands = geqBands(module).map((b) => ({ ...b, gainDb: typeof linked.value(b.key) === 'number' ? (linked.value(b.key) as number) : 0 }));
  const filters: Filter[] = bands.map((b) => ({ kind: 'peak', freq: b.freq, gainDb: b.gainDb, q: THIRD_OCTAVE_Q }));
  const rangeDb = linked.value('range') === 1 ? 6 : 12;
  const bypass = module.params.some((p) => p.key === 'bypass');

  return (
    <ModuleCard
      name={title}
      {...(bypass ? { on: linked.value('bypass') !== true, onOnChange: (on: boolean) => linked.set({ bypass: !on }) } : {})}
      badge={linked.stereo ? <ChannelPicker linked={linked} owner={owner} /> : undefined}
      expanded={open}
      onExpandedChange={setOpen}
      wide
      summary={
        <div className="app-mini-curve">
          <EqCurve compact label={`${owner} response`} lines={[{ id: 'total', filters, fill: true }]} dbRange={[-rangeDb, rangeDb]} />
        </div>
      }
    >
      <div className="app-geq">
        <div className="app-geq-faders">
          <GraphicEq label={owner} curveHeight={110} bands={bands} q={THIRD_OCTAVE_Q} rangeDb={rangeDb} onChange={(i, g) => linked.set({ [bands[i]?.key ?? '']: g })} />
        </div>
        <div className="app-geq-side">
          {SIDE.flatMap((key) => {
            const p = module.params.find((x) => x.key === key);
            return p ? [<ParamControl key={key} param={p} owner={owner} label={SHORT[key]} value={linked.value(key)} onChange={(v) => linked.set({ [key]: v })} />] : [];
          })}
          <ConfirmButton label="Flat" confirmLabel="Sure?" onConfirm={() => linked.set(Object.fromEntries(bands.map((b) => [b.key, 0])))} />
        </div>
      </div>
    </ModuleCard>
  );
}
