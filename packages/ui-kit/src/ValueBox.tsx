import { useState } from 'react';
import type { ValueScale } from './scale.js';
import { ValueInput, editableText } from './ValueInput.js';
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
    return (
      <ValueInput
        className="rl-vbox"
        label={label}
        initial={editing}
        scale={scale}
        onCommit={onChange}
        onClose={() => setEditing(null)}
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
      onDoubleClick={() => setEditing(editableText(text))}
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
