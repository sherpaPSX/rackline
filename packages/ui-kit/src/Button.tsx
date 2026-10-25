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
