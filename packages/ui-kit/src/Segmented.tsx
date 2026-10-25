import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  /** Visible text; with an icon it is the accessible name only. */
  label: string;
  icon?: ReactNode;
}

export interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  touch?: boolean | undefined;
}

/** Pick one of a few options (filter type, slope, mode). */
export function Segmented<T extends string>({ label, options, value, onChange, touch }: SegmentedProps<T>) {
  return (
    <div className="rl-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          className="rl-btn"
          aria-checked={o.value === value}
          aria-label={o.icon ? o.label : undefined}
          title={o.icon ? o.label : undefined}
          data-square={o.icon ? true : undefined}
          data-touch={touch || undefined}
          onClick={() => onChange(o.value)}
        >
          {o.icon ?? o.label}
        </button>
      ))}
    </div>
  );
}
