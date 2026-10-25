import type { ReactNode } from 'react';

const DOTS = [4, 8, 12].flatMap((y) => [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} />));

const PATHS = {
  power: (
    <>
      <path d="M8 2.5v5" />
      <path d="M4.6 4.8a4.8 4.8 0 1 0 6.8 0" />
    </>
  ),
  collapse: <path d="M10 4 6 8l4 4" />,
  expand: <path d="m6 4 4 4-4 4" />,
  expandDown: <path d="m4 6 4 4 4-4" />,
  close: <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />,
  plus: <path d="M8 3v10M3 8h10" />,
  grip: (
    <g fill="currentColor" stroke="none">
      {DOTS}
    </g>
  ),
  bell: <path d="M1 11.5h3c2 0 2.4-7 4-7s2 7 4 7h3" />,
  lowShelf: <path d="M1 5h4c2.2 0 2.8 6.5 5 6.5h5" />,
  highShelf: <path d="M1 11.5h5c2.2 0 2.8-6.5 5-6.5h4" />,
  lowPass: <path d="M1 7h7c1.8 0 2.2-3 3.4-3S13.2 12 15 14" />,
  bandPass: <path d="M1 14C4 12 6 4 8 4s4 8 7 10" />,
  highPass: <path d="M1 14c1.8-2 2.4-10 3.6-10S6.2 7 8 7h7" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export interface IconButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  /** Set for toggles (power); leave out for plain actions. */
  pressed?: boolean | undefined;
  touch?: boolean | undefined;
}

/** Borderless icon button for card headers (power, collapse, remove). */
export function IconButton({ icon, label, onClick, pressed, touch }: IconButtonProps) {
  return (
    <button
      type="button"
      className="rl-icon-btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      data-touch={touch || undefined}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
