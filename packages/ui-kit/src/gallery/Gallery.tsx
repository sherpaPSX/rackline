/*
 * Specimen page of every ui-kit atom, used to review the look.
 * Build: pnpm --filter @rackline/ui-kit gallery → dist/gallery.html
 * Not part of the public API.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Fader,
  Icon,
  IconButton,
  Knob,
  Led,
  Meter,
  MuteButton,
  Segmented,
  ToggleButton,
  ValueBox,
  formatDb,
  formatHz,
  formatMs,
  linearScale,
  logScale,
} from '../index.js';
import type { IconName } from '../index.js';
import { CrossoverSpecimen, PeqSpecimen, RackSpecimen, SystemEqSpecimen } from './Molecules.js';

const COLORS = ['bg', 'panel', 'well', 'line', 'fg', 'dim', 'accent', 'warn', 'danger'] as const;
const BANDS = [1, 2, 3, 4, 5, 6] as const;

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="rack">{children}</div>
      {note && <p className="note">{note}</p>}
    </section>
  );
}

/** Fake program level that moves with the fader, for the demo meters only. */
function fakeLevel(seed: number, gainDb: number, muted: boolean) {
  return () => {
    if (muted || gainDb === -Infinity) return -Infinity;
    const t = performance.now() / 1000;
    return -14 + gainDb + 6 * Math.sin(t * (1.3 + seed)) + 3 * Math.sin(t * 7 + seed * 9);
  };
}

interface Channel {
  name: string;
  band: (typeof BANDS)[number];
  gainDb: number;
  muted: boolean;
}

function Outputs({ touch }: { touch: boolean }) {
  const [channels, setChannels] = useState<Channel[]>([
    { name: 'Mid-high R', band: 1, gainDb: 0, muted: false },
    { name: 'Mid-high L', band: 1, gainDb: 0, muted: false },
    { name: 'Mid-bass R', band: 2, gainDb: -3, muted: false },
    { name: 'Mid-bass L', band: 2, gainDb: -3, muted: false },
    { name: 'BassHorn', band: 3, gainDb: -6, muted: true },
    { name: 'Subbass', band: 4, gainDb: 2, muted: false },
  ]);
  const update = (i: number, patch: Partial<Channel>) =>
    setChannels((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="strips">
      {channels.map((c, i) => (
        <div className="strip" key={c.name} style={{ borderTopColor: `var(--rl-band-${c.band})` }}>
          <span className="strip-name">{c.name}</span>
          <MuteButton muted={c.muted} onChange={(muted) => update(i, { muted })} target={c.name} touch={touch} />
          <Fader
            label={c.name}
            valueDb={c.gainDb}
            onChange={(gainDb) => update(i, { gainDb })}
            touch={touch}
            color={`var(--rl-band-${c.band})`}
            meter={<Meter readLevel={fakeLevel(i * 0.37, c.gainDb, c.muted)} />}
          />
        </div>
      ))}
    </div>
  );
}

const ICONS: IconName[] = ['power', 'collapse', 'expand', 'close', 'plus', 'grip', 'bell', 'lowShelf', 'highShelf', 'lowPass', 'bandPass', 'highPass'];

function Gallery() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [touch, setTouch] = useState(false);
  const [gain, setGain] = useState(-3.5);
  const [freq, setFreq] = useState(1200);
  const [q, setQ] = useState(1.4);
  const [delay, setDelay] = useState(4);
  const [slope, setSlope] = useState<'12' | '18' | '24'>('24');
  const [type, setType] = useState<'bell' | 'lowShelf' | 'highShelf'>('bell');
  const [power, setPower] = useState(true);
  const [link, setLink] = useState(true);
  const [noise, setNoise] = useState(false);
  const [polarity, setPolarity] = useState(false);

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  return (
    <main>
      <header>
        <h1>Rackline UI kit</h1>
        <p className="sub">
          Atoms taken over from Console UI Atoms, plus EQ curves and rack cards, as React components in packages/ui-kit. Drag up and down, Shift for
          fine control, double click for the default, arrow keys. Click a value (or press Enter on a control) to type an exact number. The mouse wheel works only on a focused control.
        </p>
        <div className="row">
          <Segmented
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
          <ToggleButton pressed={touch} onChange={setTouch}>
            Touch size
          </ToggleButton>
        </div>
      </header>

      <Section title="Colors" note="Accent = on / selected. Warn = attention. Danger = signal cut or at risk. Band 1–6 = identity of a rack or crossover band.">
        <div className="swatches">
          {COLORS.map((c) => (
            <div className="swatch" key={c}>
              <i style={{ background: `var(--rl-${c})` }} />
              <span className="rl-label">{c}</span>
            </div>
          ))}
          {BANDS.map((b) => (
            <div className="swatch" key={b}>
              <i style={{ background: `var(--rl-band-${b})` }} />
              <span className="rl-label">band {b}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="typo">
          <div>
            <span className="rl-label">Label · Barlow Semi Condensed 12 caps</span>
          </div>
          <div>
            <span className="rl-value">−6.0 dB · 1.20 kHz · 4.00 ms</span>
          </div>
          <div>
            <span className="title">Subbass</span>
          </div>
        </div>
      </Section>

      <Section title="Outputs: fader, meter, mute" note="Your six outputs. 0 dB sits at 3/4 of the travel (the line). Mute is red when the signal is cut.">
        <Outputs touch={touch} />
      </Section>

      <Section title="Rack card" note="One rack, modules in signal order. Click a module name to expand it in place, the power icon bypasses it. The header keeps level and mute visible when the rack is collapsed.">
        <RackSpecimen touch={touch} />
      </Section>

      <Section title="Parametric EQ" note="Drag a point: sideways = frequency, up/down = gain. The dashed line is the selected filter alone. Double click a point for 0 dB; arrow keys on a focused point.">
        <PeqSpecimen />
      </Section>

      <Section title="System EQ" note="Nine octave faders, 63 Hz to 16 kHz, with the summed curve. Points on the curve move only up and down.">
        <SystemEqSpecimen touch={touch} />
      </Section>

      <Section title="Crossover">
        <CrossoverSpecimen />
      </Section>

      <Section title="Knobs">
        <div className="row wide">
          <Knob label="Gain" value={gain} onChange={setGain} format={formatDb} scale={linearScale(-15, 15)} defaultValue={0} bipolar />
          <Knob label="Freq" value={freq} onChange={setFreq} format={formatHz} scale={logScale(20, 20_000)} defaultValue={1000} />
          <Knob label="Q" value={q} onChange={setQ} format={(x) => x.toFixed(2)} scale={logScale(0.3, 16)} defaultValue={1} />
          <Knob label="Delay" value={delay} onChange={setDelay} format={formatMs} scale={linearScale(0, 100)} defaultValue={0} color="var(--rl-warn)" />
          <Knob label="Disabled" value={0.5} onChange={setQ} format={(x) => x.toFixed(2)} disabled />
        </div>
      </Section>

      <Section title="Value boxes" note="Same values as the knobs above. Double click or Enter to type (1k2, -6), Delete resets.">
        <div className="row wide">
          <div className="rl-cell">
            <span className="rl-label">Gain</span>
            <ValueBox label="Gain" value={gain} onChange={setGain} format={formatDb} scale={linearScale(-15, 15)} defaultValue={0} />
          </div>
          <div className="rl-cell">
            <span className="rl-label">Freq</span>
            <ValueBox label="Freq" value={freq} onChange={setFreq} format={formatHz} scale={logScale(20, 20_000)} defaultValue={1000} />
          </div>
          <div className="rl-cell">
            <span className="rl-label">Delay</span>
            <ValueBox label="Delay" value={delay} onChange={setDelay} format={formatMs} scale={linearScale(0, 100)} defaultValue={0} />
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="row wide">
          <div className="rl-cell">
            <span className="rl-label">Toggle</span>
            <div className="row">
              <ToggleButton pressed={link} onChange={setLink} touch={touch}>
                Link L/R
              </ToggleButton>
              <ToggleButton pressed={polarity} onChange={setPolarity} touch={touch} square aria-label="Invert polarity">
                Ø
              </ToggleButton>
            </div>
          </div>
          <div className="rl-cell">
            <span className="rl-label">Warn tone</span>
            <ToggleButton pressed={noise} onChange={setNoise} tone="warn" touch={touch}>
              Noise
            </ToggleButton>
          </div>
          <div className="rl-cell">
            <span className="rl-label">Segment</span>
            <Segmented
              label="Slope"
              value={slope}
              onChange={setSlope}
              touch={touch}
              options={[
                { value: '12', label: '12' },
                { value: '18', label: '18' },
                { value: '24', label: '24 dB/oct' },
              ]}
            />
          </div>
          <div className="rl-cell">
            <span className="rl-label">Icon segment</span>
            <Segmented
              label="Band type"
              value={type}
              onChange={setType}
              touch={touch}
              options={[
                { value: 'bell', label: 'Bell', icon: <Icon name="bell" /> },
                { value: 'lowShelf', label: 'Low shelf', icon: <Icon name="lowShelf" /> },
                { value: 'highShelf', label: 'High shelf', icon: <Icon name="highShelf" /> },
              ]}
            />
          </div>
          <div className="rl-cell">
            <span className="rl-label">LED</span>
            <div className="row">
              <Led on label="Signal" />
              <Led on tone="warn" label="Limiting" />
              <Led on tone="danger" label="Clip" />
              <Led on={false} label="Off" />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Icons">
        <div className="row">
          <IconButton icon="power" label={power ? 'Turn module off' : 'Turn module on'} pressed={power} onClick={() => setPower(!power)} touch={touch} />
          {ICONS.filter((n) => n !== 'power').map((n) => (
            <IconButton key={n} icon={n} label={n} onClick={() => undefined} touch={touch} />
          ))}
        </div>
      </Section>
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Gallery />);
