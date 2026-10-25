import type { CSSProperties } from 'react';
import { linearScale } from './scale.js';
import type { ValueScale } from './scale.js';
import { useDragValue } from './useDragValue.js';

export interface KnobProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  /** Defaults to linear 0..1. Use `logScale` for frequency. */
  scale?: ValueScale;
  defaultValue?: number;
  /** Draw the arc from the centre (gain, pan) instead of from the left. */
  bipolar?: boolean;
  size?: number;
  /** CSS color for the arc, e.g. a band color token. */
  color?: string;
  disabled?: boolean;
}

const R = 17;
const C = 22;
const START = -135;
const END = 135;

function point(angle: number): [number, number] {
  const r = ((angle - 90) * Math.PI) / 180;
  return [C + R * Math.cos(r), C + R * Math.sin(r)];
}

function arc(from: number, to: number): string {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M${x1} ${y1}A${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

const TRACK = arc(START, END);

export function Knob({
  label,
  value,
  onChange,
  format,
  scale = linearScale(0, 1),
  defaultValue = scale.min,
  bipolar = false,
  size = 52,
  color,
  disabled = false,
}: KnobProps) {
  const { active, position, props } = useDragValue<SVGSVGElement>(value, onChange, { scale, defaultValue });
  const angle = START + position * (END - START);
  const from = bipolar ? 0 : START;
  const r = ((angle - 90) * Math.PI) / 180;
  const text = format(value);
  const style = color ? ({ '--rl-k': color } as CSSProperties) : undefined;

  return (
    <div className="rl-cell" data-disabled={disabled || undefined}>
      <span className="rl-label">{label}</span>
      <svg
        {...(disabled ? {} : props)}
        className="rl-knob"
        viewBox="0 0 44 44"
        width={size}
        height={size}
        role="slider"
        aria-label={label}
        aria-valuemin={scale.min}
        aria-valuemax={scale.max}
        aria-valuenow={value}
        aria-valuetext={text}
        aria-disabled={disabled || undefined}
        style={style}
      >
        <path d={TRACK} className="rl-knob-track" />
        {Math.abs(angle - from) > 0.5 && <path d={arc(Math.min(from, angle), Math.max(from, angle))} className="rl-knob-arc" />}
        <circle cx={C} cy={C} r={11} className="rl-knob-cap" />
        <line
          x1={C + 4 * Math.cos(r)}
          y1={C + 4 * Math.sin(r)}
          x2={C + 10 * Math.cos(r)}
          y2={C + 10 * Math.sin(r)}
          className="rl-knob-pointer"
        />
      </svg>
      <span className="rl-value" data-active={active || undefined}>
        {text}
      </span>
    </div>
  );
}
