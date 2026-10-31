import { useState } from 'react';
import type { ModuleInfo, ParamValue, Values } from '@rackline/api';
import { EqCurve, ModuleCard } from '@rackline/ui-kit';
import type { EqCurveLine } from '@rackline/ui-kit';
import { crossoverBands, crossoverEdges } from '../curves.js';
import { valueOf } from '../racks.js';
import { ChannelsBadge } from './ChannelsBadge.js';
import { ParamControl, ParamField } from './ParamControl.js';
import { useLinkedModule } from './linked.js';

export interface CrossoverModuleProps {
  /** Per channel: the cascaded crossover blocks, the first one fed by the rack. */
  blockIds: readonly (readonly number[])[];
  modules: readonly ModuleInfo[];
  values: Values;
  rackName: string;
  channelNames: readonly string[];
  /** Colors of the racks fed by the first block's bands, high first, when known. */
  bandColors: readonly (string | undefined)[];
  initiallyOpen?: boolean | undefined;
}

const DB_RANGE = [-36, 6] as const;
/** Curve height of an expanded crossover or EQ: low enough that the rack row stays short. */
export const EXPANDED_CURVE_H = 150;

/** One crossover block of a (possibly cascaded) crossover: curve and the type/frequency/polarity of every edge. */
function CrossoverStage({
  module,
  blockIds,
  values,
  owner,
  colors,
  channelNames,
}: {
  module: ModuleInfo;
  blockIds: readonly number[];
  values: Values;
  owner: string;
  colors: readonly (string | undefined)[];
  channelNames: readonly string[];
}) {
  const linked = useLinkedModule(values, blockIds, module.params.map((p) => p.key), channelNames);
  const edges = crossoverEdges(module);
  const bands = crossoverBands(module, linked.value);
  const lines: EqCurveLine[] = bands.map((b, i) => ({ id: b.name, filters: b.filters, color: colors[i] ?? 'var(--rl-fg)' }));
  const param = (key: string) => module.params.find((p) => p.key === key);
  return (
    <div className="app-xover-stage">
      <div className="app-xover-graph">
      <div className="app-row">
        <span className="rl-label">{module.name}</span>
        <ChannelsBadge linked={linked} />
      </div>
      <EqCurve
        height={EXPANDED_CURVE_H}
        label={`${owner} bands`}
        dbRange={DB_RANGE}
        lines={lines}
        handles={edges.flatMap((e) => {
          const freq = linked.value(`${e.prefix}Freq`);
          return typeof freq === 'number' ? [{ id: e.prefix, freq, gainDb: -6, label: e.name[0] ?? '', name: `${owner} ${e.name}` }] : [];
        })}
        onMove={(id, m) => linked.set({ [`${id}Freq`]: m.freq })}
      />
      </div>
      {/* One column per edge: slope, frequency, polarity. Columns sit side by side so the rack stays low. */}
      <div className="app-xover-edges">
        {edges.map((e) => {
          const props = (suffix: string) => {
            const p = param(`${e.prefix}${suffix}`);
            return p && { param: p, owner: `${owner} ${e.name}`, value: linked.value(p.key), onChange: (v: ParamValue) => linked.set({ [p.key]: v }) };
          };
          const type = props('Type');
          const freq = props('Freq');
          const invert = props('Invert');
          return (
            <div className="app-xover-edge" key={e.prefix}>
              <span className="app-edge-name">{e.name}</span>
              {type && <ParamField {...type} />}
              {freq && <ParamControl {...freq} label="Freq" />}
              {invert && <ParamField {...invert} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The crossover at the end of a rack. A cascade (3-way + 2-way) shows each block as a stage. */
export function CrossoverModule({ initiallyOpen, blockIds, modules, values, rackName, channelNames, bandColors }: CrossoverModuleProps) {
  const [open, setOpen] = useState(initiallyOpen ?? false);
  const owner = `${rackName} crossover`;
  // Stage s of the cascade: block s of every channel.
  const stages = (blockIds[0] ?? []).map((_, s) => blockIds.map((chain) => chain[s]).filter((id): id is number => id !== undefined));
  const first = stages[0] ?? [];
  // Band colors only line up with a single block; a cascade's first block has fewer bands.
  const colors = stages.length === 1 ? bandColors : [];
  const firstModule = modules[0];
  const read = (key: string) => (first[0] === undefined ? undefined : valueOf(values, first[0], key));
  const summaryLines: EqCurveLine[] = firstModule
    ? crossoverBands(firstModule, read).map((b, i) => ({ id: b.name, filters: b.filters, color: colors[i] ?? 'var(--rl-fg)' }))
    : [];
  return (
    <ModuleCard
      name={stages.length > 1 ? `Crossover (${stages.length} stages)` : 'Crossover'}
      expanded={open}
      onExpandedChange={setOpen}
      wide
      summary={
        <div className="app-mini-curve">
          <EqCurve compact label={`${owner} bands`} dbRange={DB_RANGE} lines={summaryLines} />
        </div>
      }
    >
      <div className="app-xover-stages">
        {stages.map((ids, s) => {
          const module = modules[s];
          return (
            module && (
              <CrossoverStage
                key={ids.join('-')}
                module={module}
                blockIds={ids}
                values={values}
                owner={stages.length > 1 ? `${owner} stage ${s + 1}` : owner}
                colors={colors}
                channelNames={channelNames}
              />
            )
          );
        })}
      </div>
    </ModuleCard>
  );
}
