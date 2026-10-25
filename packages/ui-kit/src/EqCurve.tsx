import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from 'react';
import { logFrequencies, responseDb } from './filters.js';
import type { Filter } from './filters.js';
import { formatDb, formatHz } from './format.js';
import { clamp, logScale } from './scale.js';

export interface EqCurveLine {
  id: string;
  filters: readonly Filter[];
  /** CSS color; defaults to the accent. */
  color?: string | undefined;
  /** Thin dashed line, e.g. a single band behind the summed curve. */
  secondary?: boolean | undefined;
  /** Fill the area between the curve and 0 dB. */
  fill?: boolean | undefined;
}

export interface EqHandle {
  id: string;
  freq: number;
  gainDb: number;
  /** Short text inside the dot, e.g. the band number. */
  label: string;
  /** Name for screen readers, e.g. "Filter 3, 1.20 kHz". */
  name: string;
  /** Only gain can be dragged (fixed-frequency graphic EQ). */
  fixedFreq?: boolean | undefined;
  /** Band switched off: drawn dim and dashed, still movable. */
  off?: boolean | undefined;
}

export interface HandleMove {
  freq: number;
  gainDb: number;
}

export interface EqCurveProps {
  label: string;
  lines: readonly EqCurveLine[];
  handles?: readonly EqHandle[];
  selectedId?: string | undefined;
  onSelect?: (id: string) => void;
  onMove?: (id: string, move: HandleMove) => void;
  /** Gain range shown, bottom and top in dB. */
  dbRange?: readonly [number, number];
  minFreq?: number;
  maxFreq?: number;
  /** Drawn height in px; the width follows the container. */
  height?: number;
  /** Small preview without axis labels, e.g. inside a compact module card. */
  compact?: boolean;
}

/** Plot insets in px; exported so controls below the plot can line up with its frequency axis. */
export const EQ_PLOT_PAD = { left: 34, right: 10, top: 10, bottom: 20 };
const PAD_COMPACT = { left: 0, right: 0, top: 2, bottom: 2 };
const POINTS = 240;
/** Width used before the first measurement (and for server rendering). */
const INITIAL_WIDTH = 640;
const FREQ_TICKS: [number, string][] = [
  [20, '20'],
  [50, '50'],
  [100, '100'],
  [200, '200'],
  [500, '500'],
  [1000, '1k'],
  [2000, '2k'],
  [5000, '5k'],
  [10_000, '10k'],
  [20_000, '20k'],
];
/** Frequency labels kept on narrow plots (phone). */
const NARROW_TICKS = new Set([100, 1000, 10_000]);
/** Arrow keys move a handle by 1/12 octave or 0.5 dB; with Shift by 1/48 octave or 0.1 dB. */
const KEY_STEPS: Record<string, { octaves: number; db: number }> = {
  ArrowUp: { octaves: 0, db: 1 },
  ArrowDown: { octaves: 0, db: -1 },
  ArrowRight: { octaves: 1, db: 0 },
  ArrowLeft: { octaves: -1, db: 0 },
};

/** Grid spacing in dB giving at most six divisions. */
function gridStep(span: number): number {
  return [3, 5, 6, 10, 12, 15, 20].find((step) => span / step <= 6) ?? span;
}

/** Width of the element in CSS px, so labels keep their size at any width. */
function useWidth(ref: RefObject<Element | null>): number {
  const [width, setWidth] = useState(INITIAL_WIDTH);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/**
 * Frequency response plot with optional draggable handles. Curves are
 * computed on the client from filter parameters, so they follow the pointer
 * without a round trip. Drag a handle: horizontal = frequency, vertical =
 * gain. Double click a handle resets its gain to 0 dB.
 */
export function EqCurve({
  label,
  lines,
  handles = [],
  selectedId,
  onSelect,
  onMove,
  dbRange = [-15, 15],
  minFreq = 20,
  maxFreq = 20_000,
  height,
  compact = false,
}: EqCurveProps) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<string | null>(null);
  const W = useWidth(svg);
  const H = height ?? (compact ? 56 : 220);
  const pad = compact ? PAD_COMPACT : EQ_PLOT_PAD;
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const [minDb, maxDb] = dbRange;
  const freqScale = useMemo(() => logScale(minFreq, maxFreq), [minFreq, maxFreq]);
  const freqs = useMemo(() => logFrequencies(POINTS, minFreq, maxFreq), [minFreq, maxFreq]);

  const x = (hz: number) => pad.left + freqScale.toPosition(hz) * plotW;
  const y = (db: number) => pad.top + ((maxDb - clamp(db, minDb, maxDb)) / (maxDb - minDb)) * plotH;
  const path = (dbs: number[]) => dbs.map((db, i) => `${i ? 'L' : 'M'}${x(freqs[i] ?? minFreq).toFixed(1)} ${y(db).toFixed(1)}`).join('');

  const drawn = useMemo(
    () => lines.map((l) => ({ ...l, d: responseDb(l.filters, freqs) })),
    [lines, freqs],
  );

  const step = gridStep(maxDb - minDb);
  const gridDb: number[] = [];
  if (compact) gridDb.push(0);
  else for (let db = Math.ceil(minDb / step) * step; db <= maxDb; db += step) gridDb.push(db);

  const toValues = (e: PointerEvent<SVGSVGElement>): HandleMove => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    return {
      freq: freqScale.fromPosition((px - pad.left) / plotW),
      gainDb: Math.round((maxDb - ((py - pad.top) / plotH) * (maxDb - minDb)) * 10) / 10,
    };
  };

  const move = (h: EqHandle, to: HandleMove) =>
    onMove?.(h.id, {
      freq: h.fixedFreq ? h.freq : clamp(to.freq, minFreq, maxFreq),
      gainDb: clamp(to.gainDb, minDb, maxDb),
    });

  const nearest = (hz: number) => {
    const p = freqScale.toPosition(hz);
    let best: EqHandle | undefined;
    for (const h of handles) {
      if (!best || Math.abs(freqScale.toPosition(h.freq) - p) < Math.abs(freqScale.toPosition(best.freq) - p)) best = h;
    }
    return best;
  };

  const interactive = handles.length > 0 && onMove !== undefined;

  const onKey = (h: EqHandle) => (e: KeyboardEvent<SVGGElement>) => {
    const step = KEY_STEPS[e.key];
    if (!step) return;
    e.preventDefault();
    const octaves = step.octaves * (e.shiftKey ? 1 / 48 : 1 / 12);
    const db = step.db * (e.shiftKey ? 0.1 : 0.5);
    move(h, { freq: h.freq * 2 ** octaves, gainDb: Math.round((h.gainDb + db) * 10) / 10 });
  };

  return (
    <svg
      ref={svg}
      className="rl-eq"
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label={label}
      data-interactive={interactive || undefined}
      onPointerDown={
        interactive
          ? (e) => {
              const v = toValues(e);
              const h = nearest(v.freq);
              if (!h) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              dragging.current = h.id;
              onSelect?.(h.id);
            }
          : undefined
      }
      onPointerMove={(e) => {
        const h = handles.find((k) => k.id === dragging.current);
        if (h && e.currentTarget.hasPointerCapture(e.pointerId)) move(h, toValues(e));
      }}
      onLostPointerCapture={() => {
        dragging.current = null;
      }}
    >
      <rect className="rl-eq-bg" x={pad.left} y={pad.top} width={plotW} height={plotH} />
      {FREQ_TICKS.filter(([f]) => f >= minFreq && f <= maxFreq).map(([f, t]) => (
        <g key={f}>
          <line className="rl-eq-grid" x1={x(f)} x2={x(f)} y1={pad.top} y2={pad.top + plotH} />
          {!compact && (W >= 480 || NARROW_TICKS.has(f)) && (
            <text className="rl-eq-tick" x={x(f)} y={H - 5} textAnchor="middle">
              {t}
            </text>
          )}
        </g>
      ))}
      {gridDb.map((db) => (
        <g key={db}>
          <line className="rl-eq-grid" data-zero={db === 0 || undefined} x1={pad.left} x2={pad.left + plotW} y1={y(db)} y2={y(db)} />
          {!compact && (
            <text className="rl-eq-tick" x={pad.left - 6} y={y(db) + 3} textAnchor="end">
              {db > 0 ? `+${db}` : db < 0 ? `−${-db}` : '0'}
            </text>
          )}
        </g>
      ))}
      {drawn.map((l) => {
        const d = path(l.d);
        const style = l.color ? ({ '--rl-k': l.color } as CSSProperties) : undefined;
        return (
          <g key={l.id} style={style}>
            {l.fill && <path className="rl-eq-area" d={`${d}L${pad.left + plotW} ${y(0)}L${pad.left} ${y(0)}Z`} />}
            <path className="rl-eq-line" data-secondary={l.secondary || undefined} d={d} />
          </g>
        );
      })}
      {handles.map((h) => {
        const cx = x(h.freq);
        const cy = y(h.gainDb);
        const text = `${formatHz(h.freq)}, ${formatDb(h.gainDb)}${h.off ? ', off' : ''}`;
        return (
          <g
            key={h.id}
            className="rl-eq-handle"
            data-selected={h.id === selectedId || undefined}
            data-off={h.off || undefined}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? 'slider' : undefined}
            aria-label={h.name}
            aria-valuetext={text}
            aria-valuenow={h.gainDb}
            aria-valuemin={minDb}
            aria-valuemax={maxDb}
            onFocus={() => onSelect?.(h.id)}
            onKeyDown={interactive ? onKey(h) : undefined}
            onDoubleClick={() => move(h, { freq: h.freq, gainDb: 0 })}
          >
            <circle cx={cx} cy={cy} r={h.id === selectedId ? 10 : 8.5} />
            <text x={cx} y={cy + 3.5} textAnchor="middle">
              {h.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
