/* Gallery specimens for the EQ curve and rack/module cards. Not part of the public API. */
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  EqCurve,
  Fader,
  Icon,
  Knob,
  ModuleCard,
  MuteButton,
  RackCard,
  Segmented,
  formatDb,
  formatHz,
  formatMs,
  linearScale,
  logScale,
} from '../index.js';
import type { EqCurveLine, Filter } from '../index.js';

type BandType = 'peak' | 'lowShelf' | 'highShelf';

interface Band {
  type: BandType;
  freq: number;
  gainDb: number;
  q: number;
}

const toFilter = (b: Band): Filter =>
  b.type === 'peak' ? { kind: 'peak', freq: b.freq, gainDb: b.gainDb, q: b.q } : { kind: b.type, freq: b.freq, gainDb: b.gainDb };

const FREQ = logScale(20, 20_000);
const GAIN = linearScale(-15, 15);
const Q = logScale(0.3, 16);

function usePeq() {
  const [bands, setBands] = useState<Band[]>([
    { type: 'lowShelf', freq: 80, gainDb: 3, q: 0.7 },
    { type: 'peak', freq: 250, gainDb: -4, q: 2 },
    { type: 'peak', freq: 1200, gainDb: 1.5, q: 1.4 },
    { type: 'peak', freq: 3500, gainDb: -2.5, q: 3 },
    { type: 'highShelf', freq: 10_000, gainDb: 2, q: 0.7 },
  ]);
  const [selected, setSelected] = useState(1);
  const update = (i: number, patch: Partial<Band>) => setBands((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return { bands, selected, setSelected, update };
}

function PeqEditor({ peq, on = true }: { peq: ReturnType<typeof usePeq>; on?: boolean }) {
  const { bands, selected, setSelected, update } = peq;
  const band = bands[selected];
  const lines: EqCurveLine[] = on
    ? [
        ...(band ? [{ id: 'band', filters: [toFilter(band)], color: 'var(--rl-warn)', secondary: true }] : []),
        { id: 'total', filters: bands.map(toFilter), fill: true },
      ]
    : [{ id: 'flat', filters: [] }];
  return (
    <div className="stack">
      <EqCurve
        label="Parametric EQ response"
        lines={lines}
        handles={bands.map((b, i) => ({ id: String(i), freq: b.freq, gainDb: b.gainDb, label: String(i + 1), name: `Filter ${i + 1}` }))}
        selectedId={String(selected)}
        onSelect={(id) => setSelected(Number(id))}
        onMove={(id, m) => update(Number(id), m)}
      />
      {band && (
        <div className="row wide">
          <Segmented
            label="Filter type"
            value={band.type}
            onChange={(type) => update(selected, { type })}
            options={[
              { value: 'lowShelf', label: 'Low shelf', icon: <Icon name="lowShelf" /> },
              { value: 'peak', label: 'Band', icon: <Icon name="bell" /> },
              { value: 'highShelf', label: 'High shelf', icon: <Icon name="highShelf" /> },
            ]}
          />
          <Knob size={44} label="Freq" value={band.freq} onChange={(freq) => update(selected, { freq })} format={formatHz} scale={FREQ} defaultValue={1000} />
          <Knob size={44} label="Gain" value={band.gainDb} onChange={(gainDb) => update(selected, { gainDb })} format={formatDb} scale={GAIN} defaultValue={0} bipolar />
          <Knob size={44} label="Q" value={band.q} onChange={(q) => update(selected, { q })} format={(x) => x.toFixed(2)} scale={Q} defaultValue={1.4} disabled={band.type !== 'peak'} />
        </div>
      )}
    </div>
  );
}

export function PeqSpecimen() {
  const peq = usePeq();
  return <PeqEditor peq={peq} />;
}

const OCTAVES = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16_000];
const GEQ_GAIN = linearScale(-12, 12);

export function SystemEqSpecimen({ touch }: { touch: boolean }) {
  const [gains, setGains] = useState([2, 1, 0, -1.5, 0, 0.5, -2, 1, 2.5]);
  const set = (i: number, g: number) => setGains((gs) => gs.map((x, j) => (j === i ? Math.round(g * 10) / 10 : x)));
  const filters: Filter[] = OCTAVES.map((freq, i) => ({ kind: 'peak', freq, gainDb: gains[i] ?? 0, q: 1.41 }));
  return (
    <div className="stack">
      <EqCurve
        label="System EQ response"
        dbRange={[-12, 12]}
        lines={[{ id: 'sum', filters, fill: true }]}
        handles={OCTAVES.map((freq, i) => ({ id: String(i), freq, gainDb: gains[i] ?? 0, label: '', name: formatHz(freq), fixedFreq: true }))}
        onMove={(id, m) => set(Number(id), m.gainDb)}
      />
      <div className="geq">
        {OCTAVES.map((f, i) => (
          <div className="geq-band" key={f}>
            <Fader label={`System EQ ${formatHz(f)}`} valueDb={gains[i] ?? 0} onChange={(g) => set(i, g)} scale={GEQ_GAIN} touch={touch} />
            <span className="rl-label">{f >= 1000 ? `${f / 1000}k` : f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CrossoverSpecimen() {
  const [low, setLow] = useState(120);
  const [high, setHigh] = useState(1200);
  const lr = (kind: 'lowPass' | 'highPass', freq: number): Filter => ({ kind, freq, family: 'linkwitzRiley', order: 4 });
  return (
    <div className="stack">
      <EqCurve
        label="Crossover bands"
        dbRange={[-36, 6]}
        lines={[
          { id: 'low', filters: [lr('lowPass', low)], color: 'var(--rl-band-4)' },
          { id: 'mid', filters: [lr('highPass', low), lr('lowPass', high)], color: 'var(--rl-band-2)' },
          { id: 'high', filters: [lr('highPass', high)], color: 'var(--rl-band-1)' },
        ]}
        handles={[
          { id: 'low', freq: low, gainDb: -6, label: 'L', name: 'Low / mid split', fixedFreq: false },
          { id: 'high', freq: high, gainDb: -6, label: 'H', name: 'Mid / high split', fixedFreq: false },
        ]}
        onMove={(id, m) => (id === 'low' ? setLow(Math.min(m.freq, high / 2)) : setHigh(Math.max(m.freq, low * 2)))}
      />
      <p className="note">Linkwitz-Riley 24 dB/oct. Drag a split point sideways; the band colors match the racks they feed.</p>
    </div>
  );
}

export function RackSpecimen({ touch }: { touch: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [muted, setMuted] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({ peq: true, delay: true, limiter: true, level: true });
  const [delay, setDelay] = useState(4.2);
  const [threshold, setThreshold] = useState(-6);
  const [level, setLevel] = useState(-2);
  const peq = usePeq();

  const card = (id: string, name: string, summary: ReactNode, body: ReactNode) => (
    <ModuleCard
      key={id}
      name={name}
      on={on[id] ?? true}
      onOnChange={(v) => setOn((o) => ({ ...o, [id]: v }))}
      expanded={open === id}
      onExpandedChange={(e) => setOpen(e ? id : null)}
      summary={summary}
    >
      {body}
    </ModuleCard>
  );

  return (
    <RackCard
      name="Subbass"
      color="var(--rl-band-4)"
      detail="Mono · from Crossover low · Out 6"
      expanded={expanded}
      onExpandedChange={setExpanded}
      actions={
        <>
          <span className="rl-value">{formatDb(level)}</span>
          <MuteButton muted={muted} onChange={setMuted} target="Subbass" touch={touch} />
        </>
      }
    >
      {card(
        'peq',
        'Speaker PEQ',
        <div className="mini-curve">
          <EqCurve compact label="Speaker PEQ" lines={[{ id: 't', filters: on['peq'] ? peq.bands.map(toFilter) : [], fill: true }]} />
        </div>,
        <PeqEditor peq={peq} on={on['peq'] ?? true} />,
      )}
      {card(
        'delay',
        'Delay',
        <Knob size={44} label="Time" value={delay} onChange={setDelay} format={formatMs} scale={linearScale(0, 100)} defaultValue={0} />,
        <Knob label="Time" value={delay} onChange={setDelay} format={formatMs} scale={linearScale(0, 100)} defaultValue={0} />,
      )}
      {card(
        'limiter',
        'Limiter',
        <Knob size={44} label="Threshold" value={threshold} onChange={setThreshold} format={formatDb} scale={linearScale(-30, 0)} defaultValue={0} color="var(--rl-warn)" />,
        <Knob label="Threshold" value={threshold} onChange={setThreshold} format={formatDb} scale={linearScale(-30, 0)} defaultValue={0} color="var(--rl-warn)" />,
      )}
      {card(
        'level',
        'Level',
        <Knob size={44} label="Gain" value={level} onChange={setLevel} format={formatDb} scale={linearScale(-20, 10)} defaultValue={0} bipolar />,
        <Knob label="Gain" value={level} onChange={setLevel} format={formatDb} scale={linearScale(-20, 10)} defaultValue={0} bipolar />,
      )}
    </RackCard>
  );
}
