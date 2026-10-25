import { useEffect, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * accent = on / selected, warn = attention (e.g. solo, noise),
 * danger = signal is cut or at risk (mute, clip, record).
 */
export type Tone = 'accent' | 'warn' | 'danger';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  children: ReactNode;
  /** Square button for a single letter or icon. */
  square?: boolean | undefined;
  /** 44 px tall for touch screens. */
  touch?: boolean | undefined;
}

export function Button({ square, touch, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={className ? `rl-btn ${className}` : 'rl-btn'}
      data-square={square || undefined}
      data-touch={touch || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface ToggleButtonProps extends Omit<ButtonProps, 'onClick' | 'onChange'> {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  tone?: Tone;
}

export function ToggleButton({ pressed, onChange, tone = 'accent', ...rest }: ToggleButtonProps) {
  return <Button aria-pressed={pressed} data-tone={tone} onClick={() => onChange(!pressed)} {...rest} />;
}

export interface MuteButtonProps {
  muted: boolean;
  onChange: (muted: boolean) => void;
  /** What is muted, for screen readers: "Mute Subbass". */
  target: string;
  touch?: boolean | undefined;
}

/** One click, red when muted, so a cut signal is visible at a glance. */
export function MuteButton({ muted, onChange, target, touch }: MuteButtonProps) {
  return (
    <ToggleButton
      square
      touch={touch}
      tone="danger"
      pressed={muted}
      onChange={onChange}
      aria-label={`Mute ${target}`}
      title={muted ? `Unmute ${target}` : `Mute ${target}`}
    >
      M
    </ToggleButton>
  );
}

export interface ConfirmButtonProps {
  label: string;
  /** Shown after the first click, e.g. "Sure?". */
  confirmLabel: string;
  onConfirm: () => void;
  /** How long the button waits for the second click. */
  timeoutMs?: number;
  touch?: boolean | undefined;
}

/**
 * For actions that are easy to hit by mistake during a show (reset, recall):
 * the first click arms the button, the second within `timeoutMs` runs it.
 * Both labels share one grid cell so the width never changes.
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, timeoutMs = 3000, touch }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), timeoutMs);
    return () => clearTimeout(timer);
  }, [armed, timeoutMs]);
  return (
    <Button
      className="rl-confirm"
      data-tone="danger"
      aria-pressed={armed}
      touch={touch}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (armed) onConfirm();
        setArmed(!armed);
      }}
    >
      <span aria-hidden={armed || undefined}>{label}</span>
      <span aria-hidden={!armed || undefined}>{confirmLabel}</span>
    </Button>
  );
}
