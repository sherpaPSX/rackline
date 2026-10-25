import type { CSSProperties } from 'react';
import { EQ_PLOT_PAD, EqCurve } from './EqCurve.js';
import type { Filter } from './filters.js';
import { formatHz } from './format.js';
import { Fader } from './Fader.js';
import { linearScale, logScale } from './scale.js';

export interface GraphicEqBand {
  freq: number;
  gainDb: number;
}

export interface GraphicEqProps {
  label: string;
  bands: readonly GraphicEqBand[];
  onChange: (index: number, gainDb: number) => void;
  rangeDb?: number;
  /** Q of each band's peak filter; 1.41 is one octave wide. */
  q?: number;
  touch?: boolean | undefined;
}

const MIN_FREQ = 20;
const MAX_FREQ = 20_000;
const FREQ = logScale(MIN_FREQ, MAX_FREQ);

const shortHz = (hz: number) => (hz >= 1000 ? `${Math.round(hz / 100) / 10}k` : String(Math.round(hz * 10) / 10));
const shortDb = (db: number) => (Math.abs(db) < 0.05 ? '0' : `${db > 0 ? '+' : '−'}${Math.abs(db).toFixed(1)}`);

/**
 * Fixed-frequency EQ: the summed curve with one fader per band, each fader
 * standing exactly under its point on the curve.
 */
export function GraphicEq({ label, bands, onChange, rangeDb = 12, q = 1.41, touch }: GraphicEqProps) {
  const scale = linearScale(-rangeDb, rangeDb);
  const filters: Filter[] = bands.map((b) => ({ kind: 'peak', freq: b.freq, gainDb: b.gainDb, q }));
  const positions = bands.map((b) => FREQ.toPosition(b.freq));
  // Each fader gets 90 % of the gap to its nearest neighbour, so they never overlap.
  const spacing = Math.min(...positions.slice(1).map((p, i) => p - (positions[i] ?? 0)), 0.1);
  // Closer than half an octave (e.g. a 30-band 1/3-octave EQ): faders only, labels every third band.
  const dense = spacing < 0.05;
  const plotWidth = `(100% - ${EQ_PLOT_PAD.left + EQ_PLOT_PAD.right}px)`;
  const at = (position: number) =>
    ({
      left: `calc(${EQ_PLOT_PAD.left}px + ${position} * ${plotWidth})`,
      width: `calc(${spacing * 0.9} * ${plotWidth})`,
    }) as CSSProperties;

  return (
    <div className="rl-geq" role="group" aria-label={label}>
      <EqCurve
        label={`${label} response`}
        dbRange={[-rangeDb, rangeDb]}
        minFreq={MIN_FREQ}
        maxFreq={MAX_FREQ}
        lines={[{ id: 'sum', filters, fill: true }]}
        handles={
          dense
            ? []
            : bands.map((b, i) => ({ id: String(i), freq: b.freq, gainDb: b.gainDb, label: '', name: formatHz(b.freq), fixedFreq: true }))
        }
        onMove={(id, m) => onChange(Number(id), m.gainDb)}
      />
      <div className="rl-geq-faders" data-dense={dense || undefined}>
        {bands.map((b, i) => (
          <div className="rl-geq-band" key={b.freq} style={at(positions[i] ?? 0)}>
            <Fader
              label={`${label} ${formatHz(b.freq)}`}
              valueDb={b.gainDb}
              onChange={(g) => onChange(i, Math.round(g * 10) / 10)}
              scale={scale}
              touch={touch}
              hideValue
            />
            {!dense && <span className="rl-geq-value">{shortDb(b.gainDb)}</span>}
            {(!dense || i % 3 === 1) && <span className="rl-label">{shortHz(b.freq)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
