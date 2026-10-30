import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ModuleInfo, Rack, Setup, Values } from '@rackline/api';
import { Button, IconButton, MuteButton, RackCard } from '@rackline/ui-kit';
import { useCoreClient } from '../app/core-context.js';
import { peqBands } from '../curves.js';
import {
  anyMuted,
  blockById,
  channelName,
  flowSources,
  inputAnchor,
  inputChannels,
  inputTargets,
  joinChannels,
  moduleOf,
  outputStrips,
  rackAnchor,
  rackChannelNames,
  rackChannelsAgree,
  rackColor,
  sharedWith,
  sourceChoice,
  speakers,
} from '../racks.js';
import type { InputChannel, PathStep, Speaker } from '../racks.js';
import { CrossoverModule } from '../modules/CrossoverModule.js';
import { GenericModule } from '../modules/GenericModule.js';
import type { ModuleViewProps } from '../modules/GenericModule.js';
import { PeqModule } from '../modules/PeqModule.js';
import { FlowLine, SourcePicker } from './FlowChips.js';

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

/**
 * One card in a row's chain. `ids[i]` is the block for the row's channel i;
 * `shared` names the other speakers that play through it.
 */
type ChainItem = { key: string; shared: string[]; anchor?: string } & (
  | { kind: 'module'; ids: number[]; title?: string; channelTitles?: string[] }
  | { kind: 'crossover'; rack: Rack; ids: number[][] }
);

/** The cards of one rack on a row, its channels mapped to the row's channels. */
function rackItems(setup: Setup, { rack, channels }: PathStep, shared: string[]): ChainItem[] {
  const mixerIds = channels.map((c) => rack.channels[c]?.mixerId ?? -1);
  const sum: ChainItem[] =
    mixerIds[0] !== -1 && !sourceChoice(setup, rack) ? [{ kind: 'module', key: `sum-${rack.id}`, ids: mixerIds, title: 'Sum', shared }] : [];
  const modules: ChainItem[] = rack.modules.map((m) => ({ kind: 'module', key: m.blockIds.join('-'), ids: channels.map((c) => m.blockIds[c] ?? -1), shared }));
  const { crossover } = rack;
  const xover: ChainItem[] = crossover ? [{ kind: 'crossover', key: `xo-${rack.id}`, rack, ids: channels.map((c) => crossover.blockIds[c] ?? []), shared }] : [];
  return [...sum, ...modules, ...xover];
}

/** Colors of the speakers fed by each band of a rack's crossover, so the curve matches the rows. */
function bandColors(setup: Setup, rack: Rack): (string | undefined)[] {
  return (rack.crossover?.bands ?? []).map((_, band) => {
    const fed = setup.racks.find((r) => r.channels.some((c) => c.sources.some((t) => t.kind === 'band' && t.rackId === rack.id && t.band === band)));
    return fed && rackColor(setup, fed.id);
  });
}

function ItemView({ item, channels, names, owner, setup, values }: { item: ChainItem; channels: readonly number[]; names: readonly string[]; owner: string; setup: Setup; values: Values }) {
  const laneNames = channels.map((c) => names[c] ?? '');
  let card: ReactNode;
  if (item.kind === 'crossover') {
    const ids = channels.map((c) => item.ids[c] ?? []);
    const modules = (ids[0] ?? []).map((id) => moduleOf(setup, id)).filter((m): m is ModuleInfo => m !== undefined);
    card = <CrossoverModule blockIds={ids} modules={modules} values={values} rackName={item.rack.name} channelNames={laneNames} bandColors={bandColors(setup, item.rack)} />;
  } else {
    // A mono block feeding both channels of a linked row is edited once.
    const ids = [...new Set(channels.map((c) => item.ids[c] ?? -1))];
    const module = moduleOf(setup, ids[0] ?? -1);
    card = module ? (
      <ModuleView
        module={module}
        blockIds={ids}
        values={values}
        rackName={owner}
        channelNames={ids.length > 1 ? laneNames : []}
        title={item.channelTitles ? joinChannels(channels.map((c) => item.channelTitles?.[c] ?? '')) : item.title}
      />
    ) : (
      <UnknownModule blockIds={ids} setup={setup} />
    );
  }
  if (item.shared.length === 0) return item.anchor ? <div id={item.anchor}>{card}</div> : card;
  const note = `Also plays ${item.shared.join(', ')}`;
  return (
    <div className="app-shared" title={`${note}: editing it changes them too`}>
      {card}
      <span className="app-shared-note">{note}</span>
    </div>
  );
}

interface ChainRowProps {
  anchor: string;
  name: string;
  color: string;
  detail: ReactNode;
  /** Physical name of each channel: "Out 5", "Out 6". */
  names: readonly string[];
  items: readonly ChainItem[];
  /** Whether both channels hold the same values, so the row starts linked. */
  agree: boolean;
  /** Outputs the quick mute cuts. */
  outputs?: readonly number[];
  setup: Setup;
  values: Values;
}

/** An input channel or speaker: its whole chain on one row, or one lane per channel when unlinked. */
function ChainRow({ anchor, name, color, detail, names, items, agree, outputs = [], setup, values }: ChainRowProps) {
  const client = useCoreClient();
  const [expanded, setExpanded] = useState(true);
  // Stereo rows start linked when both channels agree; the engineer can split or join them.
  const [link, setLink] = useState<boolean | null>(null);
  const stereo = names.length > 1;
  const linked = !stereo || (link ?? agree);
  const chain = (channels: readonly number[]) =>
    items.map((item) => <ItemView key={item.key} item={item} channels={channels} names={names} owner={name} setup={setup} values={values} />);
  return (
    <section id={anchor} className="app-row-card" data-split={!linked || undefined}>
      <RackCard
        name={name}
        color={color}
        detail={detail}
        expanded={expanded}
        onExpandedChange={setExpanded}
        actions={
          <>
            {stereo && (
              <IconButton
                icon="link"
                pressed={linked}
                label={linked ? `${names.join(' and ')} linked: click to edit them one by one` : `Link ${names.join(' and ')}: edits set both`}
                onClick={() => setLink(!linked)}
              />
            )}
            {outputs.length > 0 && (
              <MuteButton
                muted={anyMuted(values, outputs)}
                target={name}
                onChange={(m) => client.setParams(outputs.map((blockId) => ({ blockId, key: 'mute', value: m })))}
              />
            )}
          </>
        }
      >
        {linked
          ? chain(names.map((_, c) => c))
          : names.map((n, c) => (
              <div key={c} className="app-lane">
                <span className="app-lane-name">{n}</span>
                {chain([c])}
              </div>
            ))}
      </RackCard>
    </section>
  );
}

/** Header line: width, then the given flow lines. */
function Detail({ stereo, children }: { stereo: boolean; children: ReactNode }) {
  return (
    <span className="app-rack-flow">
      <span>{stereo ? 'Stereo' : 'Mono'}</span>
      {children}
    </span>
  );
}

/** An input channel: sensitivity, trim and mute of its inputs, then its processing before the first split. */
function InputRow({ channel, list, setup, values }: { channel: InputChannel; list: readonly Speaker[]; setup: Setup; values: Values }) {
  const { rack, strips } = channel;
  const width = rack?.channels.length ?? strips[0]?.blockIds.length ?? 1;
  const names = rack ? rackChannelNames(setup, rack, values) : (strips[0]?.blockIds.map((id) => channelName(setup, id) ?? '') ?? []);
  const inputs: ChainItem[] = strips.map((st) => ({
    kind: 'module',
    key: `in-${st.blockIds.join('-')}`,
    ids: Array.from({ length: width }, (_, c) => st.blockIds[c] ?? st.blockIds[0] ?? -1),
    title: strips.length > 1 || rack ? `${st.name} input` : 'Input',
    anchor: inputAnchor(st.blockIds),
    shared: [],
  }));
  const own = rack ? rackItems(setup, { rack, channels: rack.channels.map((_, c) => c) }, []) : [];
  const choice = rack && sourceChoice(setup, rack);
  const targets = inputTargets(setup, channel, list);
  const ids = strips.flatMap((st) => st.blockIds);
  const physical = joinChannels(ids.map((id) => channelName(setup, id) ?? ''));
  return (
    <ChainRow
      anchor={rack ? rackAnchor(rack.id) : inputAnchor(ids)}
      name={channel.name}
      color="var(--rl-dim)"
      names={names}
      items={[...inputs, ...own]}
      agree={rack ? rackChannelsAgree(setup, rack, values) : true}
      setup={setup}
      values={values}
      detail={
        <Detail stereo={width > 1}>
          {choice ? (
            <span className="app-flow-line">
              <span className="app-flow-label">From</span>
              <SourcePicker choice={choice} values={values} owner={channel.name} />
            </span>
          ) : (
            <span>{physical}</span>
          )}
          {targets.length > 0 ? <FlowLine label="To" links={targets} /> : <span className="app-note">Not used</span>}
        </Detail>
      }
    />
  );
}

/** A speaker: the racks its signal passes, then its outputs with trim, polarity and mute. */
function SpeakerRow({ speaker, list, setup, values }: { speaker: Speaker; list: readonly Speaker[]; setup: Setup; values: Values }) {
  const { rack, end } = speaker;
  const names = rackChannelNames(setup, end, values);
  const outputs = end.channels.flatMap((c) => c.outputIds);
  const outItems: ChainItem[] = Array.from({ length: Math.max(0, ...end.channels.map((c) => c.outputIds.length)) }, (_, j) => {
    const ids = end.channels.map((c) => c.outputIds[j] ?? -1);
    return { kind: 'module', key: `out-${ids.join('-')}`, ids, channelTitles: ids.map((id) => channelName(setup, id) ?? ''), shared: [] };
  });
  const items = [...speaker.path.flatMap((step) => rackItems(setup, step, sharedWith(list, speaker, step.rack.id))), ...outItems];
  const choice = end !== rack ? sourceChoice(setup, end) : undefined;
  return (
    <ChainRow
      anchor={rackAnchor(end.id)}
      name={speaker.name}
      color={rackColor(setup, end.id)}
      names={names}
      items={items}
      agree={speaker.path.every((p) => rackChannelsAgree(setup, p.rack, values))}
      outputs={outputs}
      setup={setup}
      values={values}
      detail={
        <Detail stereo={names.length > 1}>
          {outputs.length > 0 ? <span>{joinChannels(outputs.map((id) => channelName(setup, id) ?? ''))}</span> : <span className="app-note">No outputs</span>}
          {choice ? (
            <span className="app-flow-line">
              <span className="app-flow-label">From</span>
              <SourcePicker choice={choice} values={values} owner={joinChannels(names)} />
            </span>
          ) : (
            <FlowLine label="From" links={speaker.from.length > 0 ? speaker.from : flowSources(setup, rack)} then={speaker.band} />
          )}
        </Detail>
      }
    />
  );
}

/** Outputs nothing plays into: still trim, polarity and mute. */
function UnusedOutputs({ setup, values }: { setup: Setup; values: Values }) {
  const strips = outputStrips(setup).filter((st) => st.rackId === undefined);
  if (strips.length === 0) return null;
  return (
    <section className="app-io" aria-label="Unused outputs">
      <h2 className="app-h2">Unused outputs</h2>
      <div className="app-io-tiles">
        {strips.map((st) => {
          const module = moduleOf(setup, st.blockIds[0] ?? -1);
          return module && <ModuleView key={st.name} module={module} blockIds={st.blockIds} values={values} rackName={st.name} title={st.name} />;
        })}
      </div>
    </section>
  );
}

/** System, mode Tune: input channels on top, then one row per speaker with its whole chain; values only. */
export function SystemScreen({ setup, values }: { setup: Setup; values: Values }) {
  const list = speakers(setup, values);
  return (
    <div className="app-screen">
      <div className="app-toolbar">
        <span className="app-mode">Tune</span>
        <Button disabled title="Editing the layout comes in phase 2">
          Edit layout
        </Button>
      </div>
      <h2 className="app-h2">Inputs</h2>
      {inputChannels(setup).map((ch) => (
        <InputRow key={ch.name} channel={ch} list={list} setup={setup} values={values} />
      ))}
      <h2 className="app-h2">Speakers</h2>
      {list.map((s) => (
        <SpeakerRow key={s.end.id} speaker={s} list={list} setup={setup} values={values} />
      ))}
      <UnusedOutputs setup={setup} values={values} />
    </div>
  );
}
