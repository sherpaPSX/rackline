import { useState } from 'react';
import type { ValueScale } from './scale.js';
import { parseNumber } from './format.js';
import { useDragValue } from './useDragValue.js';

export interface ValueBoxProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  scale: ValueScale;
  defaultValue: number;
  /** Position change per arrow key; finer than a knob by default. */
  step?: number;
}

/**
 * Compact numeric field: drag up/down or use arrow keys, double click or
 * Enter to type an exact value ("1k2", "-6"). Escape cancels typing,
 * Delete resets to the default.
 */
export function ValueBox({ label, value, onChange, format, scale, defaultValue, step = 0.002 }: ValueBoxProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const { active, props } = useDragValue<HTMLDivElement>(value, onChange, {
    scale,
    defaultValue,
    dragRange: 400,
    step,
  });
  const text = format(value);

  if (editing !== null) {
    const commit = () => {
      const parsed = parseNumber(editing);
      if (parsed !== null) onChange(Math.min(scale.max, Math.max(scale.min, parsed)));
      setEditing(null);
    };
    return (
      <input
        className="rl-vbox"
        aria-label={label}
        value={editing}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setEditing(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(null);
        }}
      />
    );
  }

  return (
    <div
      {...props}
      className="rl-vbox"
      data-active={active || undefined}
      role="slider"
      aria-label={label}
      aria-valuemin={scale.min}
      aria-valuemax={scale.max}
      aria-valuenow={value}
      aria-valuetext={text}
      onDoubleClick={() => setEditing(text.replace(/[^\d.,+\-−k]/gi, ''))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') setEditing('');
        else if (e.key === 'Delete') onChange(defaultValue);
        else props.onKeyDown(e);
      }}
    >
      {text}
    </div>
  );
}
