import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Fader, Knob, MuteButton, Segmented, formatDb, formatHz, logScale } from './index.js';

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
