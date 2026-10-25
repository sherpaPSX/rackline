import { useRef, useState } from 'react';
import { parseNumber } from './format.js';
import { clamp } from './scale.js';
import type { ValueScale } from './scale.js';

export interface ValueInputProps {
  label: string;
  /** Text the field starts with, already formatted for editing. */
  initial: string;
  scale: ValueScale;
  onCommit: (value: number) => void;
  /** Called when typing ends, committed or cancelled. */
  onClose: () => void;
  className?: string | undefined;
}

/** Strips units so "1.20 kHz" becomes "1.20k", ready to edit. */
export const editableText = (formatted: string) => formatted.replace(/[^\d.,+\-−k]/gi, '');

/**
 * Text field for typing an exact value ("1k2", "-6", "250 Hz").
 * Enter or leaving the field commits, Escape cancels. Text that is not a
 * number is ignored; numbers are clamped to the scale's range.
 */
export function ValueInput({ label, initial, scale, onCommit, onClose, className = 'rl-value-input' }: ValueInputProps) {
  const [text, setText] = useState(initial);
  const done = useRef(false);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const parsed = commit ? parseNumber(text) : null;
    if (parsed !== null) onCommit(clamp(parsed, scale.min, scale.max));
    onClose();
  };
  return (
    <input
      className={className}
      aria-label={label}
      inputMode="decimal"
      value={text}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setText(e.currentTarget.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
    />
  );
}

export interface EditableReadoutProps {
  label: string;
  text: string;
  active: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  scale: ValueScale;
  onCommit: (value: number) => void;
  disabled?: boolean | undefined;
}

/** The value under a knob or fader: click it (or press Enter on the control) to type an exact number. */
export function EditableReadout({ label, text, active, editing, onEditingChange, scale, onCommit, disabled }: EditableReadoutProps) {
  if (editing) {
    return <ValueInput label={label} initial={editableText(text)} scale={scale} onCommit={onCommit} onClose={() => onEditingChange(false)} />;
  }
  return (
    <button
      type="button"
      className="rl-value"
      data-active={active || undefined}
      disabled={disabled}
      tabIndex={-1}
      title={`Type a value for ${label}`}
      onClick={() => onEditingChange(true)}
    >
      {text}
    </button>
  );
}
