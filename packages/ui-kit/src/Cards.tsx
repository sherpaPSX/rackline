import type { CSSProperties, ReactNode } from 'react';
import { IconButton } from './Icon.js';

export interface RackCardProps {
  name: string;
  /** Identity color of the rack, e.g. var(--rl-band-2). */
  color: string;
  /** One line under the name: source and width, e.g. "Stereo · from Crossover high". */
  detail?: ReactNode;
  /** Controls in the header, right side: mute, fader value, noise. */
  actions?: ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Module chain, in signal order. */
  children: ReactNode;
}

/** A rack: one signal path with its modules in signal order, expandable in place. */
export function RackCard({ name, color, detail, actions, expanded, onExpandedChange, children }: RackCardProps) {
  return (
    <section className="rl-rack" style={{ '--rl-rack': color } as CSSProperties} aria-label={name}>
      <header className="rl-rack-head">
        <IconButton
          icon={expanded ? 'expandDown' : 'expand'}
          label={expanded ? `Collapse ${name}` : `Expand ${name}`}
          onClick={() => onExpandedChange(!expanded)}
        />
        <div className="rl-rack-title">
          <span className="rl-rack-name">{name}</span>
          {detail && <span className="rl-rack-detail">{detail}</span>}
        </div>
        {actions && <div className="rl-rack-actions">{actions}</div>}
      </header>
      {expanded && <div className="rl-rack-chain">{children}</div>}
    </section>
  );
}

export interface ModuleCardProps {
  name: string;
  on: boolean;
  onOnChange: (on: boolean) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Compact form: 2–4 key controls or a small curve. */
  summary: ReactNode;
  /** Expanded form: every parameter, each with exactly one editor. */
  children: ReactNode;
  /** Shown only while editing the layout. */
  onRemove?: (() => void) | undefined;
}

/** One processing module (PEQ, delay, limiter …) in compact or expanded form. */
export function ModuleCard({ name, on, onOnChange, expanded, onExpandedChange, summary, children, onRemove }: ModuleCardProps) {
  return (
    <div className="rl-module" data-off={!on || undefined} data-expanded={expanded || undefined}>
      <div className="rl-module-head">
        <IconButton icon="power" label={on ? `Bypass ${name}` : `Enable ${name}`} pressed={on} onClick={() => onOnChange(!on)} />
        <button type="button" className="rl-module-name" onClick={() => onExpandedChange(!expanded)} aria-expanded={expanded}>
          {name}
        </button>
        {onRemove && <IconButton icon="close" label={`Remove ${name}`} onClick={onRemove} />}
      </div>
      <div className="rl-module-body">{expanded ? children : summary}</div>
    </div>
  );
}
