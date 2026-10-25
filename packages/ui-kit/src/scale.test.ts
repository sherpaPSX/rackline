import { describe, expect, it } from 'vitest';
import { faderScale, linearScale, logScale } from './scale.js';
import { formatDb, formatHz, formatMs, parseNumber } from './format.js';
import { editableText } from './ValueInput.js';

describe('linearScale', () => {
  const s = linearScale(-12, 12);
  it('maps the ends and the middle', () => {
    expect(s.toPosition(-12)).toBe(0);
    expect(s.toPosition(0)).toBe(0.5);
    expect(s.fromPosition(1)).toBe(12);
  });
  it('clamps out-of-range input', () => {
    expect(s.toPosition(40)).toBe(1);
    expect(s.fromPosition(-1)).toBe(-12);
  });
});

describe('logScale', () => {
  const s = logScale(20, 20_000);
  it('puts each decade at an equal distance', () => {
    expect(s.toPosition(200)).toBeCloseTo(1 / 3);
    expect(s.toPosition(2000)).toBeCloseTo(2 / 3);
  });
  it('round-trips', () => {
    expect(s.fromPosition(s.toPosition(1234))).toBeCloseTo(1234);
  });
});

describe('faderScale', () => {
  const s = faderScale();
  it('puts unity at 3/4 of the travel', () => {
    expect(s.toPosition(0)).toBe(0.75);
    expect(s.fromPosition(0.75)).toBe(0);
  });
  it('reaches max at the top and −∞ at the bottom', () => {
    expect(s.fromPosition(1)).toBe(6);
    expect(s.fromPosition(0)).toBe(-Infinity);
    expect(s.toPosition(-Infinity)).toBe(0);
  });
  it('gives the top part more travel per dB', () => {
    const upper = s.toPosition(6) - s.toPosition(0);
    const lower = s.toPosition(0) - s.toPosition(-6);
    expect(upper).toBeGreaterThan(lower);
  });
  it('round-trips inside the range', () => {
    for (const db of [-40, -10, -0.5, 3]) expect(s.fromPosition(s.toPosition(db))).toBeCloseTo(db);
  });
});

describe('format', () => {
  it('formats dB with sign and true minus', () => {
    expect(formatDb(3)).toBe('+3.0 dB');
    expect(formatDb(-6.25)).toBe('−6.3 dB');
    expect(formatDb(-0.01)).toBe('0.0 dB');
    expect(formatDb(-Infinity)).toBe('−∞ dB');
  });
  it('formats Hz and ms', () => {
    expect(formatHz(63)).toBe('63 Hz');
    expect(formatHz(1200)).toBe('1.20 kHz');
    expect(formatHz(16_000)).toBe('16.0 kHz');
    expect(formatMs(4)).toBe('4.00 ms');
    expect(formatMs(120)).toBe('120.0 ms');
  });
});

describe('parseNumber', () => {
  it.each([
    ['-6', -6],
    ['−6 dB', -6],
    ['+2,5', 2.5],
    ['1.2k', 1200],
    ['1k2', 1200],
    ['250 Hz', 250],
    ['.5', 0.5],
  ])('parses %s', (text, value) => {
    expect(parseNumber(text)).toBeCloseTo(value);
  });
  it('rejects text that is not a number', () => {
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });
});

describe('editableText', () => {
  it('turns a readout into text that parses back to the same value', () => {
    for (const shown of [formatHz(1200), formatDb(-4), formatMs(4.2)]) {
      expect(parseNumber(editableText(shown))).not.toBeNull();
    }
    expect(parseNumber(editableText(formatHz(1200)))).toBeCloseTo(1200);
  });
});
