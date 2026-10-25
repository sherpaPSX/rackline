import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ModuleInfo, Rack, Setup, Values } from '@rackline/api';
import { Button, MuteButton, RackCard } from '@rackline/ui-kit';
import { useCoreClient } from '../app/core-context.js';
import { peqBands } from '../curves.js';
import { formatParam } from '../params.js';
import { anyMuted, blockById, channelName, flowBands, flowSources, flowTargets, inputStrips, moduleOf, outputIdsOf, rackChannelNames, rackColor, rackTree, valueOf } from '../racks.js';
import { CrossoverModule } from '../modules/CrossoverModule.js';
import { GenericModule } from '../modules/GenericModule.js';
import type { ModuleViewProps } from '../modules/GenericModule.js';
import { OutputPolarity } from '../modules/OutputPolarity.js';
import { PeqModule } from '../modules/PeqModule.js';
import { FlowBands, FlowEnd } from './FlowChips.js';

function ModuleView(props: ModuleViewProps) {
  return peqBands(props.module).length > 0 ? <PeqModule {...props} /> : <GenericModule {...props} />;
}

function UnknownModule({ blockIds, setup }: { blockIds: readonly number[]; setup: Setup }) {
  const name = blockById(setup, blockIds[0] ?? -1)?.name ?? 'Unknown block';
  return (
    <div className="rl-module" data-off>
      <div className="rl-module-head">
        <span className="rl-module-name">{name}</span>
      </div>
      <div className="rl-module-body">
        <span className="app-note">Not supported yet</span>
      </div>
    </div>
  );
}

function RackView({ rack, setup, values }: { rack: Rack; setup: Setup; values: Values }) {
  const client = useCoreClient();
  const [expanded, setExpanded] = useState(true);
  const outputs = outputIdsOf(rack);
  const names = rackChannelNames(setup, rack);
  const outputModule = outputs[0] === undefined ? undefined : moduleOf(setup, outputs[0]);
  const trim = outputModule?.params.find((p) => p.key === 'trim');
  const muted = anyMuted(values, outputs);
  const mixerId = rack.channels[0]?.mixerId;
  const mixerModule = mixerId === undefined ? undefined : moduleOf(setup, mixerId);
  const invert = outputModule?.params.find((p) => p.key === 'invert');
  // The band's Level module carries its output polarity, as in the ui-kit rack; without one, an Output card does.
  const levelIndex = rack.modules.findLastIndex((m) => setup.modules.find((x) => x.blockType === m.blockType)?.params.some((p) => p.key === 'level'));
  const crossover = rack.crossover;
  const targets = flowTargets(setup, rack);
  const crossoverModules = (crossover?.blockIds[0] ?? []).map((id) => moduleOf(setup, id)).filter((m): m is ModuleInfo => m !== undefined);
  // Racks fed by this rack's crossover bands, so the curve uses their colors.
  const bandColors = (crossover?.bands ?? []).map((_, band) => {
    const fed = setup.racks.find((r) => r.channels.some((c) => c.sources.some((t) => t.kind === 'band' && t.rackId === rack.id && t.band === band)));
    return fed && rackColor(setup, fed.id);
  });

  return (
    <RackCard
      name={rack.name}
      color={rackColor(setup, rack.id)}
      detail={rack.channels.length > 1 ? `Stereo · ${names.join(', ')}` : 'Mono'}
      expanded={expanded}
      onExpandedChange={setExpanded}
      actions={
        outputs.length > 0 && (
          <>
            {trim && <span className="rl-value">{formatParam(trim, valueOf(values, outputs[0] ?? -1, 'trim'))}</span>}
            <MuteButton
              muted={muted}
              target={rack.name}
              onChange={(m) => client.setParams(outputs.map((blockId) => ({ blockId, key: 'mute', value: m })))}
            />
          </>
        )
      }
    >
      <FlowEnd label="From" links={flowSources(setup, rack)} />
      {mixerId !== undefined && mixerModule && (
        <ModuleView module={mixerModule} blockIds={[mixerId]} values={values} rackName={rack.name} title="Sum" />
      )}
      {rack.modules.map((m, i) => {
        const module = setup.modules.find((x) => x.blockType === m.blockType);
        return module ? (
          <ModuleView
            key={m.blockIds.join('-')}
            module={module}
            blockIds={m.blockIds}
            values={values}
            rackName={rack.name}
            channelNames={names}
            extra={i === levelIndex && invert && <OutputPolarity param={invert} outputIds={outputs} names={names} values={values} owner={rack.name} />}
          />
        ) : (
          <UnknownModule key={m.blockIds.join('-')} blockIds={m.blockIds} setup={setup} />
        );
      })}
      {crossover && (
        <CrossoverModule blockIds={crossover.blockIds} modules={crossoverModules} values={values} rackName={rack.name} channelNames={names} bandColors={bandColors} />
      )}
      {outputModule && levelIndex < 0 && (
        <ModuleView module={outputModule} blockIds={outputs} values={values} rackName={rack.name} channelNames={names} title="Output" />
      )}
      {crossover && <FlowBands bands={flowBands(setup, rack)} />}
      {targets.length > 0 && <FlowEnd label="To" links={targets} />}
    </RackCard>
  );
}

function InputsView({ setup, values }: { setup: Setup; values: Values }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <RackCard name="Inputs" color="var(--rl-dim)" detail="Sensitivity and trim of the physical inputs" expanded={expanded} onExpandedChange={setExpanded}>
      {inputStrips(setup).map((strip) => {
        const module = moduleOf(setup, strip.blockIds[0] ?? -1);
        return module && <ModuleView key={strip.name} module={module} blockIds={strip.blockIds} values={values} rackName={strip.name} title={strip.name} channelNames={strip.blockIds.map((id) => channelName(setup, id) ?? '')} />;
      })}
    </RackCard>
  );
}

/** System, mode Tune: every rack in signal order, each under the rack that feeds it; values only. */
export function SystemScreen({ setup, values }: { setup: Setup; values: Values }) {
  return (
    <div className="app-screen">
      <div className="app-toolbar">
        <span className="app-mode">Tune</span>
        <Button disabled title="Editing the layout comes in phase 2">
          Edit layout
        </Button>
      </div>
      <InputsView setup={setup} values={values} />
      {rackTree(setup).map(({ rack, depth }) => (
        <section key={rack.id} id={`rack-${rack.id}`} className="app-rack" style={{ '--app-depth': depth } as CSSProperties}>
          <RackView rack={rack} setup={setup} values={values} />
        </section>
      ))}
    </div>
  );
}
