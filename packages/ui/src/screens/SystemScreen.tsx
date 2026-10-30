import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ModuleInfo, Rack, Setup, Values } from '@rackline/api';
import { Button, MuteButton, RackCard } from '@rackline/ui-kit';
import { useCoreClient } from '../app/core-context.js';
import { peqBands } from '../curves.js';
import {
  anyMuted,
  blockById,
  channelName,
  inputAnchor,
  inputStrips,
  inputTargets,
  isOutputSelect,
  moduleOf,
  outputAnchor,
  outputIdsOf,
  outputStrips,
  rackAnchor,
  rackChannelNames,
  rackColor,
  rackTree,
  sourceChoice,
} from '../racks.js';
import { CrossoverModule } from '../modules/CrossoverModule.js';
import { GenericModule } from '../modules/GenericModule.js';
import type { ModuleViewProps } from '../modules/GenericModule.js';
import { PeqModule } from '../modules/PeqModule.js';
import { FlowLine, RackFlow, SourcePicker } from './FlowChips.js';

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
  const names = rackChannelNames(setup, rack, values);
  const choice = sourceChoice(setup, rack);
  const mixerId = rack.channels[0]?.mixerId;
  const mixerModule = mixerId === undefined ? undefined : moduleOf(setup, mixerId);
  const crossover = rack.crossover;
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
      detail={<RackFlow setup={setup} rack={rack} values={values} />}
      expanded={expanded}
      onExpandedChange={setExpanded}
      actions={
        // Quick band mute; trim and polarity live with the outputs.
        outputs.length > 0 && (
          <MuteButton
            muted={anyMuted(values, outputs)}
            target={rack.name}
            onChange={(m) => client.setParams(outputs.map((blockId) => ({ blockId, key: 'mute', value: m })))}
          />
        )
      }
    >
      {!choice && mixerId !== undefined && mixerModule && (
        <ModuleView module={mixerModule} blockIds={[mixerId]} values={values} rackName={rack.name} title="Sum" />
      )}
      {rack.modules.map((m) => {
        const module = setup.modules.find((x) => x.blockType === m.blockType);
        return module ? (
          <ModuleView key={m.blockIds.join('-')} module={module} blockIds={m.blockIds} values={values} rackName={rack.name} channelNames={names} />
        ) : (
          <UnknownModule key={m.blockIds.join('-')} blockIds={m.blockIds} setup={setup} />
        );
      })}
      {crossover && (
        <CrossoverModule blockIds={crossover.blockIds} modules={crossoverModules} values={values} rackName={rack.name} channelNames={names} bandColors={bandColors} />
      )}
    </RackCard>
  );
}

/** Physical inputs, always on top: sensitivity, trim, mute and the racks each one feeds. */
function InputsView({ setup, values }: { setup: Setup; values: Values }) {
  return (
    <section className="app-io" aria-label="Inputs">
      <h2 className="app-h2">Inputs</h2>
      <div className="app-io-tiles">
        {inputStrips(setup).map((strip) => {
          const module = moduleOf(setup, strip.blockIds[0] ?? -1);
          const targets = inputTargets(setup, strip.blockIds);
          return (
            module && (
              <div key={strip.name} id={inputAnchor(strip.blockIds)} className="app-io-tile">
                <ModuleView
                  module={module}
                  blockIds={strip.blockIds}
                  values={values}
                  rackName={strip.name}
                  title={strip.name}
                  channelNames={strip.blockIds.map((id) => channelName(setup, id) ?? '')}
                />
                <div className="app-io-flow">{targets.length > 0 ? <FlowLine label="To" links={targets} /> : <span className="app-note">Not used</span>}</div>
              </div>
            )
          );
        })}
      </div>
    </section>
  );
}

/** Physical outputs, always at the bottom: trim, mute, polarity and the rack playing into each. */
function OutputsView({ setup, values }: { setup: Setup; values: Values }) {
  return (
    <section className="app-io" aria-label="Outputs">
      <h2 className="app-h2">Outputs</h2>
      <div className="app-io-tiles">
        {outputStrips(setup).map((strip) => {
          const module = moduleOf(setup, strip.blockIds[0] ?? -1);
          const rack = setup.racks.find((r) => r.id === strip.rackId);
          const choice = rack && isOutputSelect(setup, rack) ? sourceChoice(setup, rack) : undefined;
          const source = choice ? (
            <span className="app-flow-line">
              <span className="app-flow-label">From</span>
              <SourcePicker choice={choice} values={values} owner={strip.name} />
            </span>
          ) : rack ? (
            <FlowLine label="From" links={[{ text: rack.name, anchor: rackAnchor(rack.id), color: rackColor(setup, rack.id) }]} />
          ) : (
            <span className="app-note">Not connected</span>
          );
          return (
            module && (
              <div key={strip.name} id={outputAnchor(strip.blockIds)} className="app-io-tile">
                <ModuleView
                  module={module}
                  blockIds={strip.blockIds}
                  values={values}
                  rackName={strip.name}
                  title={strip.name}
                  channelNames={strip.blockIds.map((id) => channelName(setup, id) ?? '')}
                />
                <div className="app-io-flow">{source}</div>
              </div>
            )
          );
        })}
      </div>
    </section>
  );
}

/** System, mode Tune: inputs on top, racks as a signal tree, outputs at the bottom; values only. */
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
        <section key={rack.id} id={rackAnchor(rack.id)} className="app-rack" style={{ '--app-depth': depth } as CSSProperties}>
          <RackView rack={rack} setup={setup} values={values} />
        </section>
      ))}
      <OutputsView setup={setup} values={values} />
    </div>
  );
}
