import type { ParamInfo, ParamValue } from '@rackline/api';
import { Knob, MuteButton, Select, ToggleButton, ValueBox } from '@rackline/ui-kit';
import { formatParam, numberScale, stepsScale } from '../params.js';
import type { NumberParam } from '../params.js';

export interface ParamControlProps {
  param: ParamInfo;
  value: ParamValue | undefined;
  onChange: (value: ParamValue) => void;
  /** What the control belongs to, for screen readers: "SUB FLEX Delay". */
  owner: string;
  /** Shorter visible label than the parameter's own. */
  label?: string | undefined;
  disabled?: boolean | undefined;
}

/** Value a double click returns to. */
export function defaultOf(p: NumberParam): number {
  const preferred = p.unit === 'Hz' ? 1000 : p.unit === 'oct' ? 1 : 0;
  return Math.min(p.max, Math.max(p.min, preferred));
}

/** The one editor of a parameter, chosen by its kind and unit. */
export function ParamControl({ param: p, value, onChange, owner, label = p.label, disabled }: ParamControlProps) {
  const name = `${owner} ${p.label}`;
  switch (p.kind) {
    case 'number': {
      const n = typeof value === 'number' ? value : defaultOf(p);
      const format = (v: number) => formatParam(p, v);
      if (p.unit === 'ms') {
        // Delay needs fine steps (0.1 ms per arrow key, 0.01 with Shift) and typing.
        return (
          <div className="rl-cell" data-disabled={disabled || undefined}>
            <span className="rl-label">{label}</span>
            <ValueBox
              label={name}
              value={n}
              onChange={onChange}
              format={format}
              scale={numberScale(p)}
              defaultValue={defaultOf(p)}
              step={0.1 / (p.max - p.min)}
            />
          </div>
        );
      }
      return (
        <Knob
          size={44}
          label={label}
          value={n}
          onChange={onChange}
          format={format}
          scale={numberScale(p)}
          defaultValue={defaultOf(p)}
          bipolar={p.min < 0 && p.max > 0}
          disabled={disabled ?? false}
        />
      );
    }
    case 'steps':
      return (
        <Knob
          size={44}
          label={label}
          value={typeof value === 'number' ? value : 0}
          onChange={onChange}
          format={(i) => formatParam(p, Math.round(i))}
          scale={stepsScale(p)}
          disabled={disabled ?? false}
        />
      );
    case 'enum':
      return (
        <div className="rl-cell">
          <span className="rl-label">{label}</span>
          <Select
            label={name}
            options={p.options}
            value={typeof value === 'number' ? value : (p.options[0]?.value ?? 0)}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
      );
    case 'bool':
      return (
        <div className="rl-cell">
          <span className="rl-label">{label}</span>
          {p.key.toLowerCase().endsWith('mute') ? (
            <MuteButton muted={value === true} onChange={onChange} target={owner} />
          ) : (
            <ToggleButton square pressed={value === true} onChange={onChange} aria-label={name}>
              {p.key.toLowerCase().endsWith('invert') ? 'Ø' : 'On'}
            </ToggleButton>
          )}
        </div>
      );
    case 'flags': {
      const flags = typeof value === 'object' ? value : {};
      // A mute flag is the only one needed while tuning (Level's "off at minimum" is for remote controls).
      const shown = p.flags.includes('mute') ? ['mute'] : p.flags;
      return (
        <div className="rl-cell">
          <span className="rl-label">{label}</span>
          <div className="app-row">
            {shown.map((f) =>
              f === 'mute' ? (
                <MuteButton key={f} muted={flags[f] === true} onChange={(on) => onChange({ ...flags, [f]: on })} target={owner} />
              ) : (
                <ToggleButton key={f} pressed={flags[f] === true} onChange={(on) => onChange({ ...flags, [f]: on })} aria-label={`${name} ${f}`}>
                  {f === 'offAtMin' ? 'Off at min' : f}
                </ToggleButton>
              ),
            )}
          </div>
        </div>
      );
    }
  }
}

/**
 * The same editor in table form (matrix cells, per-input rows): a value box
 * instead of a knob, no label (the row and column headers name it).
 */
export function ParamField({ param: p, value, onChange, owner, disabled }: Omit<ParamControlProps, 'label'>) {
  const name = `${owner} ${p.label}`;
  switch (p.kind) {
    case 'number': {
      const n = typeof value === 'number' ? value : defaultOf(p);
      return (
        <div className="app-field" data-disabled={disabled || undefined}>
          <ValueBox label={name} value={n} onChange={onChange} format={(v) => formatParam(p, v)} scale={numberScale(p)} defaultValue={defaultOf(p)} />
        </div>
      );
    }
    case 'steps':
      return (
        <div className="app-field" data-disabled={disabled || undefined}>
          <ValueBox
            label={name}
            value={typeof value === 'number' ? value : 0}
            onChange={(i) => onChange(Math.round(i))}
            format={(i) => formatParam(p, Math.round(i))}
            scale={stepsScale(p)}
            defaultValue={0}
            step={1 / Math.max(1, p.steps.length - 1)}
          />
        </div>
      );
    case 'enum':
      return (
        <Select
          label={name}
          options={p.options}
          value={typeof value === 'number' ? value : (p.options[0]?.value ?? 0)}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'bool':
      return p.key.toLowerCase().endsWith('mute') ? (
        <MuteButton muted={value === true} onChange={onChange} target={`${owner} ${p.label.replace(/ mute$/i, '')}`} />
      ) : (
        <ToggleButton square pressed={value === true} onChange={onChange} aria-label={name}>
          {p.key.toLowerCase().endsWith('invert') ? 'Ø' : 'On'}
        </ToggleButton>
      );
    case 'flags':
      return <ParamControl param={p} value={value} onChange={onChange} owner={owner} label="" />;
  }
}
