import type { CSSProperties } from 'react';
import type { FlowLink } from '../racks.js';

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
