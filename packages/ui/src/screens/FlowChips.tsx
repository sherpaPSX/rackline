import type { CSSProperties } from 'react';
import type { Values } from '@rackline/api';
import { Segmented, Select } from '@rackline/ui-kit';
import { useCoreClient } from '../app/core-context.js';
import { channelsAgree, valueOf } from '../racks.js';
import type { FlowLink, SourceChoice } from '../racks.js';

/** Scrolls to a rack drawn by the System screen. */
export function jumpToRack(rackId: string): void {
  const el = document.getElementById(`rack-${rackId}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el?.querySelector<HTMLElement>('.rl-rack-head button')?.focus({ preventScroll: true });
}

function Chip({ link }: { link: FlowLink }) {
  const style = { '--app-flow': link.color ?? 'var(--rl-line)' } as CSSProperties;
  const { rackId } = link;
  return rackId === undefined ? (
    <span className="app-flow-chip" style={style}>
      {link.text}
    </span>
  ) : (
    <button type="button" className="app-flow-chip" style={style} title={`Go to ${link.text}`} onClick={() => jumpToRack(rackId)}>
      {link.text}
    </button>
  );
}

/** Start or end of a rack's chain: where the signal comes from, or where it goes. */
export function FlowEnd({ label, links }: { label: string; links: readonly FlowLink[] }) {
  return (
    <div className="app-flow">
      <span className="app-flow-label">{label}</span>
      {links.map((l) => (
        <Chip key={`${l.rackId ?? ''}${l.text}`} link={l} />
      ))}
    </div>
  );
}

/** End of a rack that ends in a crossover: each band and the racks it feeds. */
export function FlowBands({ bands }: { bands: readonly { band: string; to: readonly FlowLink[] }[] }) {
  return (
    <div className="app-flow">
      <span className="app-flow-label">Bands to</span>
      {bands.map((b) => (
        <div key={b.band} className="app-flow-band" data-unused={b.to.length === 0 || undefined}>
          <span className="app-flow-band-name">{b.band}</span>
          {b.to.length === 0 ? <span className="app-flow-unused">not used</span> : b.to.map((l) => <Chip key={l.text} link={l} />)}
        </div>
      ))}
    </div>
  );
}

/**
 * Start of a rack fed by a Select: pick its source. Every channel's Select
 * switches together; this is a plain parameter, no audio dropout.
 */
export function SourcePicker({ choice, values, owner }: { choice: SourceChoice; values: Values; owner: string }) {
  const client = useCoreClient();
  const current = valueOf(values, choice.blockIds[0] ?? -1, 'input');
  const differ = !channelsAgree(values, choice.blockIds, ['input']);
  const pick = (value: number) => client.setParams(choice.blockIds.map((blockId) => ({ blockId, key: 'input', value })));
  const label = `${owner}: source`;
  return (
    <div className="app-flow app-source" data-differ={differ || undefined} title={differ ? 'The channels use different sources' : undefined}>
      <span className="app-flow-label">From</span>
      {choice.options.length <= 3 ? (
        <Segmented
          label={label}
          options={choice.options.map((o) => ({ value: String(o.value), label: o.link.text }))}
          value={String(current)}
          onChange={(v) => pick(Number(v))}
        />
      ) : (
        <Select label={label} options={choice.options.map((o) => ({ value: o.value, label: o.link.text }))} value={typeof current === 'number' ? current : -1} onChange={pick} />
      )}
    </div>
  );
}
