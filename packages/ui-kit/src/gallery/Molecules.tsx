/* Gallery specimens for the EQ curve and rack/module cards. Not part of the public API. */
import { useState } from 'react';
import {
  EqCurve,
  GraphicEq,
  Icon,
  Knob,
  Meter,
  centeredScale,
  ModuleCard,
  MuteButton,
  RackCard,
  Segmented,
  ToggleButton,
  formatDb,
  formatHz,
  formatMs,
  linearScale,
  logScale,
} from '../index.js';
import type { EqCurveLine, Filter } from '../index.js';

type BandType = 'peak' | 'lowShelf' | 'highShelf';

interface Band {
  on: boolean;
  type: BandType;
  freq: number;
  gainDb: number;
  q: number;
}

const toFilter = (b: Band): Filter =>
  b.type === 'peak' ? { kind: 'peak', freq: b.freq, gainDb: b.gainDb, q: b.q } : { kind: b.type, freq: b.freq, gainDb: b.gainDb };

/** Fake programme peaks in dBFS for the limiter meters. */
function limiterInput(): number {
  const t = performance.now() / 1000;
  return -10 + 5 * Math.sin(t * 1.1) + 4 * Math.abs(Math.sin(t * 5.3));
}

const active = (bands: readonly Band[]) => bands.filter((b) => b.on).map(toFilter);

const FREQ = logScale(20, 20_000);
/** RPM Level block range; 0 dB stays at 12 o'clock. */
const LEVEL = centeredScale(-30, 16);
const GAIN = linearScale(-15, 15);
const Q = logScale(0.3, 16);

function usePeq() {
  const [bands, setBands] = useState<Band[]>([
    { on: true, type: 'lowShelf', freq: 80, gainDb: 3, q: 0.7 },
    { on: true, type: 'peak', freq: 250, gainDb: -4, q: 2 },
    { on: true, type: 'peak', freq: 1200, gainDb: 1.5, q: 1.4 },
    { on: true, type: 'peak', freq: 3500, gainDb: -2.5, q: 3 },
    { on: true, type: 'highShelf', freq: 10_000, gainDb: 2, q: 0.7 },
    // The band count is fixed by the DSP layout; spare bands stay off until needed.
    { on: false, type: 'peak', freq: 500, gainDb: 0, q: 1.4 },
    { on: false, type: 'peak', freq: 2000, gainDb: 0, q: 1.4 },
    { on: false, type: 'peak', freq: 6000, gainDb: 0, q: 1.4 },
  ]);
  const [selected, setSelected] = useState(1);
  const update = (i: number, patch: Partial<Band>) => setBands((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return { bands, selected, setSelected, update };
}

/** `side` puts the band controls right of the curve, like a device in a rack. */
function PeqEditor({ peq, on = true, side = false }: { peq: ReturnType<typeof usePeq>; on?: boolean; side?: boolean }) {
  const { bands, selected, setSelected, update } = peq;
  const band = bands[selected];
  const lines: EqCurveLine[] = on
    ? [
        ...(band?.on ? [{ id: 'band', filters: [toFilter(band)], color: 'var(--rl-warn)', secondary: true }] : []),
        { id: 'total', filters: active(bands), fill: true },
      ]
    : [{ id: 'flat', filters: [] }];
  return (
    <div className={side ? 'peq-side' : 'stack'}>
      <div className="peq-graph">
        <EqCurve
          label="Parametric EQ response"
          lines={lines}
          handles={bands.map((b, i) => ({ id: String(i), freq: b.freq, gainDb: b.gainDb, label: String(i + 1), name: `Filter ${i + 1}`, off: !b.on }))}
          selectedId={String(selected)}
          onSelect={(id) => setSelected(Number(id))}
          onMove={(id, m) => update(Number(id), m)}
        />
        <div className="peq-bands" role="group" aria-label="Filters on or off">
          {bands.map((b, i) => (
            <ToggleButton
              key={i}
              square
              pressed={b.on}
              aria-label={`Filter ${i + 1} on`}
              data-selected={i === selected || undefined}
              onChange={(v) => {
                update(i, { on: v });
                setSelected(i);
              }}
            >
              {i + 1}
            </ToggleButton>
          ))}
        </div>
      </div>
      {band && (
        <div className={side ? 'peq-controls' : 'row wide'}>
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

const OCTAVES = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16_000];

export function SystemEqSpecimen({ touch }: { touch: boolean }) {
  const [gains, setGains] = useState([3, 2, 1, 0, -1.5, 0, 0.5, -2, 1, 2.5]);
  return (
    <GraphicEq
      label="System EQ"
      bands={OCTAVES.map((freq, i) => ({ freq, gainDb: gains[i] ?? 0 }))}
      onChange={(i, g) => setGains((gs) => gs.map((x, j) => (j === i ? g : x)))}
      touch={touch}
    />
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
  const [peqOpen, setPeqOpen] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>({ peq: true, delay: true, limiter: true, level: true });
  const [delay, setDelay] = useState(4.2);
  const [threshold, setThreshold] = useState(-6);
  const [attack, setAttack] = useState(5);
  const [release, setRelease] = useState(200);
  const [level, setLevel] = useState(-2);
  const [invert, setInvert] = useState(false);
  const peq = usePeq();
  const power = (id: string) => ({ on: on[id] ?? true, onOnChange: (v: boolean) => setOn((o) => ({ ...o, [id]: v })) });

  return (
    <RackCard
      name="Subbass"
      color="var(--rl-band-4)"
      detail="Mono · from Crossover low · Out 6"
      expanded={expanded}
      onExpandedChange={setExpanded}
      actions={
        <>
          <Meter horizontal readLevel={() => (muted ? -Infinity : (on['limiter'] === false ? limiterInput() : Math.min(limiterInput(), threshold)) + level)} />
          <span className="rl-value">{formatDb(level)}</span>
          <MuteButton muted={muted} onChange={setMuted} target="Subbass" touch={touch} />
        </>
      }
    >
      <ModuleCard
        name="Speaker PEQ"
        {...power('peq')}
        expanded={peqOpen}
        onExpandedChange={setPeqOpen}
        summary={
          <div className="mini-curve">
            <EqCurve compact label="Speaker PEQ" lines={[{ id: 't', filters: on['peq'] ? active(peq.bands) : [], fill: true }]} />
          </div>
        }
      >
        <PeqEditor peq={peq} on={on['peq'] ?? true} side />
      </ModuleCard>
      <ModuleCard name="Delay" {...power('delay')}>
        <Knob size={44} label="Time" value={delay} onChange={setDelay} format={formatMs} scale={linearScale(0, 100)} defaultValue={0} />
      </ModuleCard>
      <ModuleCard name="Limiter" {...power('limiter')}>
        <Knob size={44} label="Threshold" value={threshold} onChange={setThreshold} format={formatDb} scale={linearScale(-30, 0)} defaultValue={0} color="var(--rl-warn)" />
        <Knob size={44} label="Attack" value={attack} onChange={setAttack} format={formatMs} scale={logScale(0.5, 100)} defaultValue={5} />
        <Knob size={44} label="Release" value={release} onChange={setRelease} format={formatMs} scale={logScale(10, 2000)} defaultValue={200} />
        <div className="lim-meters">
          <div className="rl-cell">
            <span className="rl-label">In</span>
            <Meter readLevel={limiterInput} floorDb={-40} markDb={threshold} warnDb={threshold} hotDb={0} />
          </div>
          <div className="rl-cell">
            <span className="rl-label">GR</span>
            <Meter reduction floorDb={-20} readLevel={() => (on['limiter'] === false ? 0 : Math.max(0, limiterInput() - threshold))} />
          </div>
        </div>
      </ModuleCard>
      <ModuleCard name="Level" {...power('level')}>
        <Knob size={44} label="Gain" value={level} onChange={setLevel} format={formatDb} scale={LEVEL} defaultValue={0} bipolar />
        <div className="rl-cell">
          <span className="rl-label">Polarity</span>
          <ToggleButton pressed={invert} onChange={setInvert} square aria-label="Invert polarity" touch={touch}>
            Ø
          </ToggleButton>
        </div>
      </ModuleCard>
    </RackCard>
  );
}

/** ISO 1/3-octave centres, 25 Hz to 20 kHz. */
const THIRDS = [25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10_000, 12_500, 16_000, 20_000];

export function Geq30Specimen({ touch }: { touch: boolean }) {
  const [gains, setGains] = useState<number[]>(() => THIRDS.map((f) => (f < 50 ? 3 : f > 8000 ? 2 : f === 400 ? -3 : 0)));
  return (
    <GraphicEq
      label="30-band GEQ"
      bands={THIRDS.map((freq, i) => ({ freq, gainDb: gains[i] ?? 0 }))}
      onChange={(i, g) => setGains((gs) => gs.map((x, j) => (j === i ? g : x)))}
      q={4.32}
      touch={touch}
    />
  );
}
