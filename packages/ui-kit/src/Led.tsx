import type { Tone } from './Button.js';

export interface LedProps {
  on: boolean;
  tone?: Tone;
  /** What the light means, e.g. "Limiting". */
  label: string;
}

export function Led({ on, tone = 'accent', label }: LedProps) {
  return <span className="rl-led" role="img" aria-label={`${label}: ${on ? 'on' : 'off'}`} data-on={on || undefined} data-tone={tone} />;
}
