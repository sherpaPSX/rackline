import { describe, expect, it } from 'vitest';
import { anyMuted, bandStrips, channelName, rackChannelNames, rackChannelsAgree, channelsAgree, flowSources, inputChannels, inputTargets, isInputRack, isOutputSelect, outputStrips, inputStrips, isSelect, sharedWith, sourceChoice, speakers, joinChannels, pairName, rackColor, rackDetail } from '../src/index.js';
import type { Speaker } from '../src/index.js';
import { psxState } from './fixtures.js';
import { withSelects } from './select-demo.js';

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

  it('names where a rack\'s signal comes from', () => {
    const text = (links: { text: string }[]) => links.map((l) => l.text);
    expect(text(flowSources(setup, rack('ANALOG')))).toEqual(['In 1+2']);
    expect(text(flowSources(setup, rack('ANALOG mono')))).toEqual(['Σ ANALOG']);
    expect(flowSources(setup, rack('MF\\HF'))).toEqual([{ text: 'Delay · High', anchor: `rack-${rack('Delay').id}`, color: 'var(--rl-dim)' }]);
    expect(flowSources(setup, rack('ANALOG'))).toEqual([{ text: 'In 1+2', anchor: 'in-1' }]);
    expect(joinChannels(['In 1', 'In 2'])).toBe('In 1+2');
    expect(joinChannels(['Out 5'])).toBe('Out 5');
  });

  it('tells which stereo racks hold equal values on both channels', () => {
    const agree = (name: string) => rackChannelsAgree(setup, rack(name), state.values);
    expect([agree('ANALOG'), agree('Delay'), agree('MF\\HF'), agree('LF'), agree('SUB FLEX')]).toEqual([true, true, false, false, true]);
  });

  it('lists physical outputs in channel order, paired by their stereo rack', () => {
    expect(outputStrips(setup)).toEqual([
      { name: 'Out 1', blockIds: [11], rackId: rack('SUB HORN').id },
      { name: 'Out 2', blockIds: [12], rackId: rack('SUB FLEX').id },
      { name: 'Out 3+4', blockIds: [13, 14], rackId: rack('LF').id },
      { name: 'Out 5+6', blockIds: [15, 16], rackId: rack('MF\\HF').id },
    ]);
  });

  it('shows one row per speaker with every rack its signal passes', () => {
    const list = speakers(setup, state.values);
    const row = (sp: Speaker) => `${sp.rack.name}: ${sp.path.map((p) => p.rack.name).join(' → ')} (from ${sp.from.map((l) => l.text).join(', ')} → ${sp.band ?? ''})`;
    expect(list.map(row)).toEqual([
      'MF\\HF: Delay → MF\\HF (from ANALOG → High)',
      'LF: Delay → LF (from ANALOG → Mid)',
      'SUB FLEX: ANALOG mono → SUB FLEX (from Σ ANALOG → High mid)',
      'SUB HORN: ANALOG mono → SUB HORN (from Σ ANALOG → Low mid)',
    ]);
    expect(list.every((sp) => sp.inputRack === rack('ANALOG'))).toBe(true);
    const [mfhf, lf] = list;
    if (!mfhf || !lf) throw new Error('no speakers');
    expect(mfhf.path.map((p) => p.channels)).toEqual([[0, 1], [0, 1]]);
    expect(sharedWith(list, mfhf, rack('Delay').id)).toEqual(['LF']);
    expect(sharedWith(list, mfhf, mfhf.rack.id)).toEqual([]);
  });

  it('puts the processing before the first split into its input channel', () => {
    expect(isInputRack(rack('ANALOG'))).toBe(true);
    expect(isInputRack(rack('ANALOG mono'))).toBe(false);
    const channels = inputChannels(setup);
    expect(channels.map((ch) => [ch.name, ch.rack?.name, ch.strips.map((st) => st.name)])).toEqual([
      ['ANALOG', 'ANALOG', ['ANALOG']],
      ['DIGITAL', undefined, ['DIGITAL']],
    ]);
    const list = speakers(setup, state.values);
    const [analog, digital] = channels;
    if (!analog || !digital) throw new Error('no input channels');
    expect(inputTargets(setup, analog, list).map((l) => l.text)).toEqual(['MF\\HF', 'LF', 'SUB FLEX', 'SUB HORN']);
    expect(inputTargets(setup, digital, list)).toEqual([]);
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

describe('racks that pick their source with a Select', () => {
  const demo = withSelects(state);
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
        { value: 0, link: { text: 'In 1+2', anchor: 'in-1' } },
        { value: 1, link: { text: 'In A+B', anchor: 'in-9' } },
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

  it('shows an output Select as the source of its outputs, not as a rack', () => {
    const find = (name: string) => s.racks.find((r) => r.name === name) ?? analog;
    const out = find('Out 5+6');
    expect(isOutputSelect(s, out)).toBe(true);
    expect(isOutputSelect(s, find('LF'))).toBe(false);
    expect(sourceChoice(s, out)?.options.map((o) => o.link.text)).toEqual(['MF\\HF', 'LF']);
    const rows = (values: typeof demo.values) => speakers(s, values).map((sp) => `${sp.name}: ${sp.path.map((p) => p.rack.name).join(' → ')}`);
    // Out 5+6 plays the selected rack; the other one stays tunable at the end.
    const subs = ['SUB FLEX: ANALOG mono → SUB FLEX', 'SUB HORN: ANALOG mono → SUB HORN'];
    expect(rows(demo.values)).toEqual(['LF: Delay → LF', ...subs, 'Out 5+6: Delay → MF\\HF']);
    const lf = { ...demo.values, '903': { input: 1 }, '904': { input: 1 } };
    expect(rows(lf)).toEqual(['LF: Delay → LF', ...subs, 'Out 5+6: Delay → LF', 'MF\\HF: Delay → MF\\HF']);
    expect(inputChannels(s).map((ch) => [ch.name, ch.strips.map((st) => st.name)])).toEqual([['ANALOG', ['ANALOG', 'DIGITAL']]]);
  });
});

