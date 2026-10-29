import type { CSSProperties } from 'react';
import type { Rack, Setup, Values } from '@rackline/api';
import { Select } from '@rackline/ui-kit';
import { useCoreClient } from '../app/core-context.js';
import { channelsAgree, flowSources, flowTargets, selectsThis, sourceChoice, valueOf } from '../racks.js';
import type { FlowLink, SourceChoice } from '../racks.js';

/** Scrolls to a rack drawn by the System screen. */
export function jumpToRack(rackId: string): void {
  const el = document.getElementById(`rack-${rackId}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el?.querySelector<HTMLElement>('.rl-rack-head button')?.focus({ preventScroll: true });
}

const FIXED = 'Fixed wiring; changing it is Edit layout (phase 2).';

function Chip({ link, values }: { link: FlowLink; values: Values }) {
  const client = useCoreClient();
  const style = { '--app-flow': link.color ?? 'var(--rl-line)' } as CSSProperties;
  const { rackId, select } = link;
  if (select) {
    // The target picks its source with a Select: this chip switches it to this rack.
    const on = selectsThis(values, link);
    return (
      <button
        type="button"
        className="app-flow-chip"
        style={style}
        aria-pressed={on}
        title={on ? `${link.text} plays this rack` : `Switch ${link.text} to this rack`}
        onClick={() => on || client.setParams(select.blockIds.map((blockId) => ({ blockId, key: 'input', value: select.value })))}
      >
        {link.text}
      </button>
    );
  }
  return rackId === undefined ? (
    <span className="app-flow-chip" style={style} title={FIXED}>
      {link.text}
    </span>
  ) : (
    <button type="button" className="app-flow-chip" style={style} title={`Go to ${link.text}. ${FIXED}`} onClick={() => jumpToRack(rackId)}>
      {link.text}
    </button>
  );
}

/** Pick a rack's source with its Select; every channel switches together, no audio dropout. */
function SourcePicker({ choice, values, owner }: { choice: SourceChoice; values: Values; owner: string }) {
  const client = useCoreClient();
  const current = valueOf(values, choice.blockIds[0] ?? -1, 'input');
  const differ = !channelsAgree(values, choice.blockIds, ['input']);
  return (
    <span className="app-source" data-differ={differ || undefined} title={differ ? 'The channels use different sources' : undefined}>
      <Select
        label={`${owner}: source`}
        options={choice.options.map((o) => ({ value: o.value, label: o.link.text }))}
        value={typeof current === 'number' ? current : -1}
        onChange={(value) => client.setParams(choice.blockIds.map((blockId) => ({ blockId, key: 'input', value })))}
      />
    </span>
  );
}

/** The rack header line: width, where the signal comes from and where it goes. */
export function RackFlow({ setup, rack, values }: { setup: Setup; rack: Rack; values: Values }) {
  const choice = sourceChoice(setup, rack);
  const sources = flowSources(setup, rack);
  const targets = flowTargets(setup, rack);
  return (
    <span className="app-rack-flow">
      <span>{rack.channels.length > 1 ? 'Stereo' : 'Mono'}</span>
      <span className="app-flow-label">From</span>
      {choice ? (
        <SourcePicker choice={choice} values={values} owner={rack.name} />
      ) : (
        sources.map((l) => <Chip key={`${l.rackId ?? ''}${l.text}`} link={l} values={values} />)
      )}
      {targets.length > 0 && <span className="app-flow-label">To</span>}
      {targets.map((l) => (
        <Chip key={`${l.rackId ?? ''}${l.text}`} link={l} values={values} />
      ))}
    </span>
  );
}
