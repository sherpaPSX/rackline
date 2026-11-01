import type { CSSProperties } from 'react';
import type { Values } from '@rackline/api';
import { Select } from '@rackline/ui-kit';
import { useCoreClient } from '../app/core-context.js';
import { channelsAgree, valueOf } from '../racks.js';
import type { FlowLink, SourceChoice } from '../racks.js';

/** Scrolls to an input channel or speaker drawn by the System screen. */
export function jumpTo(anchor: string): void {
  const el = document.getElementById(anchor);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el?.querySelector<HTMLElement>('button, select')?.focus({ preventScroll: true });
}

function Chip({ link }: { link: FlowLink }) {
  const style = { '--app-flow': link.color ?? 'var(--rl-line)' } as CSSProperties;
  const { anchor } = link;
  return anchor === undefined ? (
    <span className="app-flow-chip" style={style}>
      {link.text}
    </span>
  ) : (
    <button type="button" className="app-flow-chip" style={style} title={`Go to ${link.text}`} onClick={() => jumpTo(anchor)}>
      {link.text}
    </button>
  );
}

/** A labelled row of links: "From ANALOG → High", "To MF\\HF LF". `then` follows the links after an arrow. */
export function FlowLine({ label, links, then }: { label: string; links: readonly FlowLink[]; then?: string | undefined }) {
  return (
    <span className="app-flow-line">
      <span className="app-flow-label">{label}</span>
      {links.map((l) => (
        <Chip key={`${l.anchor ?? ''}${l.text}`} link={l} />
      ))}
      {then !== undefined && <span className="app-flow-then">→ {then}</span>}
    </span>
  );
}

/** Pick a source with a Select; every channel switches together, no audio dropout. */
export function SourcePicker({ choice, values, owner }: { choice: SourceChoice; values: Values; owner: string }) {
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
