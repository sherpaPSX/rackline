import { useState } from 'react';
import type { KeyboardEvent, CSSProperties, ReactNode } from 'react';
import { faderScale } from './scale.js';
import type { ValueScale } from './scale.js';
import { formatDb } from './format.js';
import { useDragValue } from './useDragValue.js';
import { EditableReadout } from './ValueInput.js';

export interface FaderProps {
  /** Accessible name, e.g. the rack name. Not drawn; the caller shows the name. */
  label: string;
  valueDb: number;
  onChange: (valueDb: number) => void;
  defaultDb?: number;
  scale?: ValueScale;
  /** Larger cap for touch screens (44 px target). */
  touch?: boolean | undefined;
  color?: string;
  /** Usually a `Meter`, drawn right of the fader at the same height. */
  meter?: ReactNode;
  disabled?: boolean;
  /** Hide the dB readout when the caller shows the value elsewhere. */
  hideValue?: boolean;
}

const DEFAULT_SCALE = faderScale();

export function Fader({
  label,
  valueDb,
  onChange,
  defaultDb = 0,
  scale = DEFAULT_SCALE,
  touch = false,
  color,
  meter,
  disabled = false,
  hideValue = false,
}: FaderProps) {
  const [editing, setEditing] = useState(false);
  const { active, position, props } = useDragValue<HTMLDivElement>(valueDb, onChange, {
    scale,
    defaultValue: defaultDb,
    dragRange: 200,
  });
  const text = formatDb(valueDb);
  const style = { '--rl-k': color, '--rl-pos': position, '--rl-unity': scale.toPosition(0) } as CSSProperties;

  return (
    <div className="rl-cell" data-disabled={disabled || undefined}>
      <div className="rl-fader-row">
        <div
          {...(disabled
          ? {}
          : {
              ...props,
              onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => (e.key === 'Enter' ? setEditing(true) : props.onKeyDown(e)),
            })}
          className="rl-fader"
          data-touch={touch || undefined}
          role="slider"
          aria-label={label}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position * 100)}
          aria-valuetext={text}
          aria-disabled={disabled || undefined}
          style={style}
        >
          <div className="rl-fader-slot" />
          <div className="rl-fader-fill" />
          <div className="rl-fader-unity" />
          <div className="rl-fader-cap" />
        </div>
        {meter}
      </div>
      {(!hideValue || editing) && (
        <EditableReadout
          label={label}
          text={text}
          active={active}
          editing={editing}
          onEditingChange={setEditing}
          scale={scale}
          onCommit={onChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}
