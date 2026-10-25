import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfirmButton, EqCurve, Fader, Knob, Meter, MuteButton, RackCard, Segmented, formatDb, formatHz, logScale } from './index.js';

const noop = () => undefined;

describe('controls render accessible markup', () => {
  it('Knob exposes its value as text', () => {
    const html = renderToStaticMarkup(
      createElement(Knob, { label: 'Freq', value: 1000, onChange: noop, format: formatHz, scale: logScale(20, 20_000) }),
    );
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-valuetext="1.00 kHz"');
  });

  it('Fader shows dB and puts the cap at the unity position for 0 dB', () => {
    const html = renderToStaticMarkup(createElement(Fader, { label: 'Subbass', valueDb: 0, onChange: noop }));
    expect(html).toContain(`aria-valuetext="${formatDb(0)}"`);
    expect(html).toContain('--rl-pos:0.75');
  });

  it('Meter draws the threshold mark at its level', () => {
    const html = renderToStaticMarkup(createElement(Meter, { readLevel: () => -20, floorDb: -40, markDb: -10 }));
    expect(html).toContain('bottom:75%');
    const gr = renderToStaticMarkup(createElement(Meter, { readLevel: () => 3, reduction: true }));
    expect(gr).toContain('data-reduction="true"');
    const h = renderToStaticMarkup(createElement(Meter, { readLevel: () => -20, floorDb: -40, markDb: -10, horizontal: true }));
    expect(h).toContain('left:75%');
  });

  it('ConfirmButton renders both labels so its width never changes', () => {
    const html = renderToStaticMarkup(createElement(ConfirmButton, { label: 'Flat', confirmLabel: 'Sure?', onConfirm: noop }));
    expect(html).toContain('>Flat</span>');
    expect(html).toContain('aria-hidden="true">Sure?</span>');
  });

  it('MuteButton is pressed and named after its target', () => {
    const html = renderToStaticMarkup(createElement(MuteButton, { muted: true, onChange: noop, target: 'Subbass' }));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Mute Subbass"');
    expect(html).toContain('data-tone="danger"');
  });

  it('Segmented marks the selected option', () => {
    const html = renderToStaticMarkup(
      createElement(Segmented, {
        label: 'Slope',
        value: '24',
        onChange: noop,
        options: [
          { value: '12', label: '12 dB/oct' },
          { value: '24', label: '24 dB/oct' },
        ],
      }),
    );
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true"[^>]*>24 dB\/oct/);
  });
});

describe('EqCurve and cards', () => {
  it('EqCurve labels its handles with frequency and gain', () => {
    const html = renderToStaticMarkup(
      createElement(EqCurve, {
        label: 'PEQ',
        lines: [{ id: 'sum', filters: [{ kind: 'peak', freq: 250, gainDb: -4, q: 2 }] }],
        handles: [{ id: '1', freq: 250, gainDb: -4, label: '1', name: 'Filter 1' }],
        onMove: noop,
      }),
    );
    expect(html).toContain('aria-label="Filter 1"');
    expect(html).toContain(`aria-valuetext="250 Hz, ${formatDb(-4)}"`);
  });

  it('EqCurve marks a switched-off handle', () => {
    const html = renderToStaticMarkup(
      createElement(EqCurve, {
        label: 'PEQ',
        lines: [],
        handles: [{ id: '6', freq: 500, gainDb: 0, label: '6', name: 'Filter 6', off: true }],
        onMove: noop,
      }),
    );
    expect(html).toContain('data-off="true"');
    expect(html).toContain(', off"');
  });

  it('RackCard hides its modules when collapsed', () => {
    const rack = (expanded: boolean) =>
      renderToStaticMarkup(
        createElement(RackCard, { name: 'Subbass', color: 'red', expanded, onExpandedChange: noop, children: createElement('i', null, 'module') }),
      );
    expect(rack(true)).toContain('module');
    expect(rack(false)).not.toContain('module');
  });
});
