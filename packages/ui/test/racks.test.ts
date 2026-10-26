import { describe, expect, it } from 'vitest';
import { anyMuted, bandStrips, channelName, rackChannelNames, channelsAgree, flowBands, flowSources, flowTargets, inputStrips, isSelect, sourceChoice, joinChannels, pairName, rackColor, rackDetail, rackTree } from '../src/index.js';
import { psxState } from './fixtures.js';
import { withInputSelect } from './select-demo.js';

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

  it('draws the signal flow: sources, targets and crossover bands', () => {
    const text = (links: { text: string }[]) => links.map((l) => l.text);
    expect(text(flowSources(setup, rack('ANALOG')))).toEqual(['In 1+2']);
    expect(text(flowSources(setup, rack('ANALOG mono')))).toEqual(['Σ ANALOG']);
    expect(flowSources(setup, rack('MF\\HF'))).toEqual([{ text: 'Delay · High', rackId: rack('Delay').id, color: 'var(--rl-dim)' }]);
    expect(text(flowTargets(setup, rack('ANALOG')))).toEqual(['Delay', 'ANALOG mono']);
    expect(flowTargets(setup, rack('MF\\HF'))).toEqual([{ text: 'Out 5+6' }]);
    expect(flowBands(setup, rack('ANALOG mono')).map((b) => [b.band, text(b.to)])).toEqual([
      ['High', []],
      ['High mid', ['SUB FLEX']],
      ['Low mid', ['SUB HORN']],
      ['Low', []],
    ]);
    expect(joinChannels(['In 1', 'In 2'])).toBe('In 1+2');
    expect(joinChannels(['Out 5'])).toBe('Out 5');
  });

  it('orders racks as a tree, each under the rack that feeds it', () => {
    expect(rackTree(setup).map((n) => `${'  '.repeat(n.depth)}${n.rack.name}`)).toEqual([
      'ANALOG',
      '  Delay',
      '    MF\\HF',
      '    LF',
      '  ANALOG mono',
      '    SUB FLEX',
      '    SUB HORN',
    ]);
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

describe('a rack that picks its input with a Select', () => {
  const demo = withInputSelect(state);
  const s = demo.setup;
  if (!s) throw new Error('no setup');
  const analog = s.racks.find((r) => r.name === 'ANALOG');
  if (!analog) throw new Error('no ANALOG');

  it('offers each source as one choice for both channels', () => {
    expect(isSelect(s, 901)).toBe(true);
    expect(isSelect(s, 37)).toBe(false);
    expect(sourceChoice(s, analog)).toEqual({
      blockIds: [901, 902],
      options: [
        { value: 0, link: { text: 'In 1+2' } },
        { value: 1, link: { text: 'In A+B' } },
      ],
    });
    expect(sourceChoice(setup, rack('ANALOG mono'))).toBeUndefined();
  });

  it('names channels after the selected input, down the chain', () => {
    const delay = s.racks.find((r) => r.name === 'Delay');
    if (!delay) throw new Error('no Delay');
    expect(rackChannelNames(s, analog, demo.values)).toEqual(['In 1', 'In 2']);
    const digital = { ...demo.values, '901': { input: 1 }, '902': { input: 1 } };
    expect(rackChannelNames(s, delay, digital)).toEqual(['In A', 'In B']);
  });
});

