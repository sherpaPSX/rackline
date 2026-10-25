import { useState } from 'react';
import type { ModuleInfo, Values } from '@rackline/api';
import { EqCurve, ModuleCard } from '@rackline/ui-kit';
import type { EqCurveLine } from '@rackline/ui-kit';
import { crossoverBands, crossoverEdges } from '../curves.js';
import { valueOf } from '../racks.js';
import { ChannelPicker } from './ChannelPicker.js';
import { ParamControl } from './ParamControl.js';
import { useLinkedModule } from './linked.js';

export interface CrossoverModuleProps {
  /** Per channel: the cascaded crossover blocks, the first one fed by the rack. */
  blockIds: readonly (readonly number[])[];
  modules: readonly ModuleInfo[];
  values: Values;
  rackName: string;
  /** Colors of the racks fed by the first block's bands, high first, when known. */
  bandColors: readonly (string | undefined)[];
}

const DB_RANGE = [-36, 6] as const;

/** One crossover block of a (possibly cascaded) crossover: curve and the type/frequency/polarity of every edge. */
function CrossoverStage({
  module,
  blockIds,
  values,
  owner,
  colors,
}: {
  module: ModuleInfo;
  blockIds: readonly number[];
  values: Values;
  owner: string;
  colors: readonly (string | undefined)[];
}) {
  const linked = useLinkedModule(values, blockIds, module.params.map((p) => p.key));
  const edges = crossoverEdges(module);
  const bands = crossoverBands(module, linked.value);
  const lines: EqCurveLine[] = bands.map((b, i) => ({ id: b.name, filters: b.filters, color: colors[i] ?? 'var(--rl-fg)' }));
  const param = (key: string) => module.params.find((p) => p.key === key);
  return (
    <div className="app-xover-stage">
      <div className="app-row">
        <span className="rl-label">{module.name}</span>
        <ChannelPicker linked={linked} owner={owner} />
      </div>
      <EqCurve
        label={`${owner} bands`}
        dbRange={DB_RANGE}
        lines={lines}
        handles={edges.flatMap((e) => {
          const freq = linked.value(`${e.prefix}Freq`);
          return typeof freq === 'number' ? [{ id: e.prefix, freq, gainDb: -6, label: e.name[0] ?? '', name: `${owner} ${e.name}` }] : [];
        })}
        onMove={(id, m) => linked.set({ [`${id}Freq`]: m.freq })}
      />
      <div className="app-xover-edges">
        {edges.map((e) => (
          <div className="app-xover-edge" key={e.prefix}>
            <span className="app-edge-name">{e.name}</span>
            {(['Type', 'Freq', 'Invert'] as const).map((suffix) => {
              const p = param(`${e.prefix}${suffix}`);
              return (
                p && (
                  <ParamControl
                    key={suffix}
                    param={p}
                    owner={`${owner} ${e.name}`}
                    label={suffix === 'Invert' ? 'Polarity' : suffix === 'Freq' ? 'Freq' : 'Slope'}
                    value={linked.value(p.key)}
                    onChange={(v) => linked.set({ [p.key]: v })}
                  />
                )
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The crossover at the end of a rack. A cascade (3-way + 2-way) shows each block as a stage. */
export function CrossoverModule({ blockIds, modules, values, rackName, bandColors }: CrossoverModuleProps) {
  const [open, setOpen] = useState(false);
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
      <div className="app-stack">
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
              />
            )
          );
        })}
      </div>
    </ModuleCard>
  );
}
