import { describe, expect, it } from 'vitest';
import { anyMuted, bandStrips, channelName, rackChannelNames, channelsAgree, inputStrips, pairName, rackColor, rackDetail } from '../src/index.js';
import { psxState } from './fixtures.js';

const state = psxState();
const setup = state.setup;
if (!setup) throw new Error('fixture has no setup');
const rack = (name: string) => {
  const r = setup.racks.find((x) => x.name === name);
  if (!r) throw new Error(`no rack ${name}`);
  return r;
};

describe('rack views of PSX_RCF_FINAL', () => {
  it('shows one band strip per rack that feeds outputs, in signal order', () => {
    expect(bandStrips(setup).map((b) => [b.name, b.outputIds])).toEqual([
      ['MF\\HF', [15, 16]],
      ['LF', [13, 14]],
      ['SUB FLEX', [12]],
      ['SUB HORN', [11]],
    ]);
    expect(rackColor(setup, rack('LF').id)).toBe('var(--rl-band-2)');
    expect(rackColor(setup, rack('ANALOG').id)).toBe('var(--rl-dim)');
  });

  it('pairs left/right inputs into one strip', () => {
    expect(inputStrips(setup)).toEqual([
      { name: 'ANALOG', blockIds: [1, 2] },
      { name: 'DIGITAL', blockIds: [9, 10] },
    ]);
    expect(pairName('Mic', 'Laptop')).toBe('Mic / Laptop');
  });

  it('describes width, source and outputs of a rack', () => {
    expect(rackDetail(setup, rack('MF\\HF'))).toBe('Stereo · from Delay High · Out 5, 6');
    expect(rackDetail(setup, rack('ANALOG mono'))).toBe('Mono · from sum of ANALOG');
    expect(rackDetail(setup, rack('SUB HORN'))).toBe('Mono · from ANALOG mono Low mid · Out 1');
    expect(rackDetail(setup, rack('ANALOG'))).toBe('Stereo · from ANALOG');
  });

  it('names stereo channels by the physical inputs and outputs', () => {
    expect([channelName(setup, 1), channelName(setup, 10), channelName(setup, 16)]).toEqual(['In 1', 'In B', 'Out 6']);
    expect(rackChannelNames(setup, rack('MF\\HF'))).toEqual(['Out 5', 'Out 6']);
    // Racks without outputs are traced back to the inputs that feed them.
    expect(rackChannelNames(setup, rack('ANALOG'))).toEqual(['In 1', 'In 2']);
    expect(rackChannelNames(setup, rack('Delay'))).toEqual(['In 1', 'In 2']);
  });

  it('notices when L and R of a stereo module differ', () => {
    // MF\HF speaker PEQ: band 3 gain is +4 dB left, +6 dB right in Lukas's file.
    expect(channelsAgree(state.values, [29, 31], ['band3Freq'])).toBe(true);
    expect(channelsAgree(state.values, [29, 31], ['band3Gain'])).toBe(false);
  });

  it('counts a band as muted when any output is muted', () => {
    expect(anyMuted(state.values, [11])).toBe(true);
    expect(anyMuted(state.values, [13, 14])).toBe(false);
  });
});
