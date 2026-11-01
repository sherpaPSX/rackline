import type { Block, ModuleInfo, ParamValue, Rack, Setup, Tap, Values } from '@rackline/api';

/**
 * View helpers that turn the setup into what the screens draw. They only
 * read the API's JSON, never the DSP model.
 */

const BAND_COLORS = 6;

/** A rack that feeds outputs: what the engineer calls a band (Subbass, Mid-high …). */
export interface BandStrip {
  rackId: string;
  name: string;
  /** Identity color, the same on every screen. */
  color: string;
  /** Output blocks of all channels: the band fader is their Output Trim. */
  outputIds: number[];
}

/** One input fader: a stereo pair (analog 1/2, digital A/B) or a single input. */
export interface InputStrip {
  name: string;
  blockIds: number[];
}

export const blockById = (setup: Setup, id: number): Block | undefined => setup.blocks.find((b) => b.id === id);

export function moduleOf(setup: Setup, blockId: number): ModuleInfo | undefined {
  const block = blockById(setup, blockId);
  return setup.modules.find((m) => m.blockType === block?.blockType);
}

export const outputIdsOf = (rack: Rack): number[] => rack.channels.flatMap((c) => c.outputIds);

/** Racks that feed outputs, in signal order, each with its band color. */
export function bandStrips(setup: Setup): BandStrip[] {
  return setup.racks
    .filter((r) => outputIdsOf(r).length > 0)
    .map((r, i) => ({ rackId: r.id, name: r.name, color: `var(--rl-band-${(i % BAND_COLORS) + 1})`, outputIds: outputIdsOf(r) }));
}

/** Color of a rack: its band color, or neutral for racks that only feed other racks. */
export function rackColor(setup: Setup, rackId: string): string {
  return bandStrips(setup).find((b) => b.rackId === rackId)?.color ?? 'var(--rl-dim)';
}

const SIDE = /\b(left|right|l|r)\b/gi;

/** "LEFT ANALOG" + "RIGHT - ANALOG" → "ANALOG". */
export function pairName(a: string, b: string): string {
  const clean = (s: string) => s.replace(SIDE, '').replace(/[-–_]/g, ' ').replace(/\s+/g, ' ').trim();
  const ca = clean(a);
  return ca !== '' && ca.toLowerCase() === clean(b).toLowerCase() ? ca : `${a} / ${b}`;
}

/** Inputs in physical order, consecutive inputs of the same type paired as left/right. */
export function inputStrips(setup: Setup): InputStrip[] {
  const inputs = setup.inputIds.map((id) => blockById(setup, id)).filter((b): b is Block => b !== undefined);
  const strips: InputStrip[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const a = inputs[i];
    const b = inputs[i + 1];
    if (!a) continue;
    if (b && b.blockType === a.blockType && a.channel % 2 === 1 && b.channel === a.channel + 1) {
      strips.push({ name: pairName(a.name, b.name), blockIds: [a.id, b.id] });
      i++;
    } else {
      strips.push({ name: a.name, blockIds: [a.id] });
    }
  }
  return strips;
}

const rackName = (setup: Setup, id: string) => setup.racks.find((r) => r.id === id)?.name ?? id;

function tapText(setup: Setup, tap: Tap): string {
  switch (tap.kind) {
    case 'input':
    case 'generator':
      return blockById(setup, tap.blockId)?.name ?? `block ${tap.blockId}`;
    case 'rack':
      return rackName(setup, tap.rackId);
    case 'band': {
      const rack = setup.racks.find((r) => r.id === tap.rackId);
      return `${rack?.name ?? tap.rackId} ${rack?.crossover?.bands[tap.band]?.name ?? `band ${tap.band + 1}`}`;
    }
  }
}

function channelSource(setup: Setup, sources: readonly Tap[]): string {
  const texts = [...new Set(sources.map((t) => tapText(setup, t)))];
  if (sources.length > 1) return texts.length === 1 ? `sum of ${texts[0]}` : texts.join(' + ');
  return texts[0] ?? 'no source';
}

/** Where the rack's signal comes from, e.g. "ANALOG" (inputs 1/2), "sum of ANALOG", "Delay High". */
export function sourceText(setup: Setup, rack: Rack): string {
  const [left, right] = rack.channels.map((c) => channelSource(setup, c.sources));
  return right === undefined ? (left ?? 'no source') : pairName(left ?? '', right);
}

/** One line under the rack name: "Stereo · from Delay High · Out 5, 6". */
export function rackDetail(setup: Setup, rack: Rack): string {
  const outs = outputIdsOf(rack)
    .map((id) => blockById(setup, id)?.channel)
    .filter((c): c is number => c !== undefined && c > 0);
  return [
    rack.channels.length > 1 ? 'Stereo' : 'Mono',
    `from ${sourceText(setup, rack)}`,
    ...(outs.length > 0 ? [`Out ${outs.join(', ')}`] : []),
  ].join(' · ');
}

export const valueOf = (values: Values, blockId: number, key: string): ParamValue | undefined => values[String(blockId)]?.[key];

/** Whether every block holds the same value for `key` (L and R of a linked module). */
export function channelsAgree(values: Values, blockIds: readonly number[], keys: readonly string[]): boolean {
  const [first, ...rest] = blockIds;
  if (first === undefined) return true;
  return keys.every((k) => rest.every((id) => JSON.stringify(valueOf(values, id, k)) === JSON.stringify(valueOf(values, first, k))));
}

/** A band is muted when any of its outputs is muted: a cut signal must never look live. */
export const anyMuted = (values: Values, blockIds: readonly number[], key = 'mute'): boolean =>
  blockIds.some((id) => valueOf(values, id, key) === true);

/** Physical channel of an input or output block as the device labels it: "In 1", "In A", "Out 5". */
export function channelName(setup: Setup, blockId: number): string | undefined {
  const block = blockById(setup, blockId);
  const module = moduleOf(setup, blockId);
  if (!block || block.channel <= 0) return undefined;
  if (module?.role === 'output') return `Out ${block.channel}`;
  if (module?.role !== 'input') return undefined;
  // The RPM 26z labels its digital inputs A and B.
  return `In ${module.name.startsWith('Digital') ? ('AB'[block.channel - 1] ?? block.channel) : block.channel}`;
}

/**
 * Names of a rack's channels, so stereo controls say which physical
 * channel they edit: the outputs it feeds, else the inputs it comes from
 * (traced back through other racks and the selected input of a Select),
 * else L / R.
 */
export function rackChannelNames(setup: Setup, rack: Rack, values: Values = {}): string[] {
  const trace = (r: Rack, channel: number, depth: number): string | undefined => {
    const c = r.channels[channel];
    if (!c || depth > setup.racks.length) return undefined;
    const out = c.outputIds[0];
    if (out !== undefined) return channelName(setup, out);
    const tap = c.sources.length === 1 ? c.sources[0] : selectedSource(setup, c, values);
    if (tap?.kind === 'input') return channelName(setup, tap.blockId);
    if (tap?.kind === 'rack' || tap?.kind === 'band') {
      const from = setup.racks.find((x) => x.id === tap.rackId);
      return from && trace(from, tap.channel, depth + 1);
    }
    return undefined;
  };
  const names = rack.channels.map((_, i) => trace(rack, i, 0));
  const distinct = new Set(names).size === names.length && names.every((n) => n !== undefined);
  return distinct ? (names as string[]) : rack.channels.map((_, i) => (i === 0 ? 'L' : 'R'));
}

/** "In 1" + "In 2" → "In 1+2"; "Out 5" + "Out 6" → "Out 5+6". */
export function joinChannels(names: readonly string[]): string {
  const [first, ...rest] = names;
  if (first === undefined) return '';
  const prefix = first.slice(0, first.lastIndexOf(' ') + 1);
  return prefix !== '' && rest.every((n) => n.startsWith(prefix))
    ? prefix + names.map((n) => n.slice(prefix.length)).join('+')
    : names.join(' + ');
}

/** One end of a connection shown in a header; `anchor` is the element id it jumps to. */
export interface FlowLink {
  text: string;
  /** `rack-<rack id>` or `in-<first block id>`. */
  anchor?: string;
  /** Color of the rack it leads to or comes from. */
  color?: string;
}

export const rackAnchor = (rackId: string): string => `rack-${rackId}`;
export const inputAnchor = (blockIds: readonly number[]): string => `in-${blockIds[0] ?? 0}`;

type Channel = Rack['channels'][number];

/** Whether a block is a Select 1 of N: its input is picked, not summed. */
export const isSelect = (setup: Setup, blockId: number | undefined): boolean =>
  blockId !== undefined && moduleOf(setup, blockId)?.name.startsWith('Select') === true;

/** The `input` value that picks source `i` of a channel's Select. */
const selectValue = (c: Channel, i: number): number => c.mixerInputs?.[i] ?? i;

function selectedSource(setup: Setup, c: Channel, values: Values): Tap | undefined {
  if (!isSelect(setup, c.mixerId)) return undefined;
  const picked = valueOf(values, c.mixerId ?? -1, 'input');
  return c.sources.find((_, i) => selectValue(c, i) === picked) ?? c.sources[0];
}

/** One link for the same tap on every channel: "In 1+2", "ANALOG", "Delay · High". */
function linkOf(setup: Setup, group: readonly Tap[]): FlowLink {
  const tap = group[0];
  if (tap === undefined) return { text: 'no source' };
  if (tap.kind === 'input' || tap.kind === 'generator') {
    const ids = group.map((t) => (t.kind === 'input' || t.kind === 'generator' ? t.blockId : -1));
    const names = ids.map((id) => channelName(setup, id));
    const text = names.every((n) => n !== undefined) ? joinChannels(names as string[]) : tapText(setup, tap);
    const strip = inputStrips(setup).find((st) => st.blockIds.some((id) => ids.includes(id)));
    return strip ? { text, anchor: inputAnchor(strip.blockIds) } : { text };
  }
  const from = setup.racks.find((r) => r.id === tap.rackId);
  const band = tap.kind === 'band' ? from?.crossover?.bands[tap.band]?.name : undefined;
  return { text: band === undefined ? (from?.name ?? tap.rackId) : `${from?.name ?? tap.rackId} · ${band}`, anchor: rackAnchor(tap.rackId), color: rackColor(setup, tap.rackId) };
}

const tapKey = (t: Tap): string => (t.kind === 'input' || t.kind === 'generator' ? t.kind : `${t.kind}:${t.rackId}:${t.kind === 'band' ? t.band : ''}`);

/** Where a rack's signal comes from: "In 1+2", "ANALOG", "Delay · High"; summed sources start with "Σ". */
export function flowSources(setup: Setup, rack: Rack): FlowLink[] {
  const summed = rack.channels.some((c) => c.sources.length > 1);
  const groups = new Map<string, Tap[]>();
  for (const t of rack.channels.flatMap((c) => c.sources)) groups.set(tapKey(t), [...(groups.get(tapKey(t)) ?? []), t]);
  return [...groups.values()].map((group) => {
    const link = linkOf(setup, group);
    return summed ? { ...link, text: `Σ ${link.text}` } : link;
  });
}

/** A rack whose channels start with a Select: the engineer picks its source. */
export interface SourceChoice {
  /** The Select block of every channel; all are set together. */
  blockIds: number[];
  /** `value` is the Select's `input` parameter. */
  options: { value: number; link: FlowLink }[];
}

export function sourceChoice(setup: Setup, rack: Rack): SourceChoice | undefined {
  const [first] = rack.channels;
  if (first === undefined || !rack.channels.every((c) => isSelect(setup, c.mixerId))) return undefined;
  return {
    blockIds: rack.channels.map((c) => c.mixerId ?? -1),
    options: first.sources.map((_, i) => ({
      value: selectValue(first, i),
      link: linkOf(setup, rack.channels.flatMap((c) => c.sources[i] ?? [])),
    })),
  };
}

const feeds = (r: Rack, test: (t: Tap) => boolean): boolean => r.channels.some((c) => c.sources.some(test));

/**
 * A rack that only picks which rack plays into some outputs: a Select per
 * channel feeding outputs directly. It is shown as the source of those
 * outputs, not as a rack.
 */
export const isOutputSelect = (setup: Setup, rack: Rack): boolean =>
  rack.modules.length === 0 && rack.crossover === undefined && outputIdsOf(rack).length > 0 && sourceChoice(setup, rack) !== undefined;

/** One physical output tile: a stereo pair fed by one rack, or a single output. */
export interface OutputStrip {
  name: string;
  blockIds: number[];
  /** The rack playing into it, if any. */
  rackId?: string;
}

/** Physical outputs in channel order, paired when one stereo rack feeds them. */
export function outputStrips(setup: Setup): OutputStrip[] {
  const strips: OutputStrip[] = [];
  const fed = new Set<number>();
  for (const r of setup.racks) {
    const ids = outputIdsOf(r);
    if (ids.length === 0) continue;
    ids.forEach((id) => fed.add(id));
    const paired = r.channels.length > 1 && r.channels.every((c) => c.outputIds.length === 1);
    for (const blockIds of paired ? [ids] : ids.map((id) => [id])) {
      strips.push({ name: joinChannels(blockIds.map((id) => channelName(setup, id) ?? `block ${id}`)), blockIds, rackId: r.id });
    }
  }
  for (const id of setup.outputIds) if (!fed.has(id)) strips.push({ name: channelName(setup, id) ?? `block ${id}`, blockIds: [id] });
  const first = (st: OutputStrip) => Math.min(...st.blockIds.map((id) => blockById(setup, id)?.channel ?? 99));
  return strips.sort((x, y) => first(x) - first(y));
}

/** A rack that only processes inputs before the first split: it belongs to its input channel. */
export const isInputRack = (rack: Rack): boolean =>
  outputIdsOf(rack).length === 0 && rack.channels.every((c) => c.sources.length > 0 && c.sources.every((t) => t.kind === 'input'));

/** The tap a channel plays: its only source, the selected input of a Select, or the first of a sum. */
function feedOf(setup: Setup, c: Channel | undefined, values: Values): Tap | undefined {
  if (!c) return undefined;
  return (c.sources.length > 1 ? selectedSource(setup, c, values) : undefined) ?? c.sources[0];
}

/** A rack on a speaker's path; `channels[i]` is its channel feeding the speaker's channel i. */
export interface PathStep {
  rack: Rack;
  channels: number[];
}

/** One row of the System screen: a speaker with its whole chain, from the input channel to the outputs. */
export interface Speaker {
  /** Row name: the rack's name, or the output Select's name ("Out 5+6") when the rack is switchable. */
  name: string;
  /** The rack playing into the outputs, which names the row (behind an output Select: the selected one). */
  rack: Rack;
  /** Rack whose channels end in the outputs: `rack`, or the output Select in front of them. */
  end: Rack;
  /** Every rack from the input channel to the outputs, in signal order. */
  path: PathStep[];
  /** The input channel's own rack the path starts from, if any. */
  inputRack?: Rack;
  /** Where the path starts: "ANALOG", "Σ ANALOG", "In 1+2". */
  from: FlowLink[];
  /** The crossover band feeding `rack`, e.g. "High". */
  band?: string;
}

function speakerOf(setup: Setup, end: Rack, values: Values): Speaker {
  let at = end;
  let channels = end.channels.map((_, i) => i);
  const path: PathStep[] = isOutputSelect(setup, end) ? [] : [{ rack: end, channels }];
  let inputRack: Rack | undefined;
  for (let n = 0; n < setup.racks.length; n++) {
    const from = at;
    const taps = channels.map((c) => feedOf(setup, from.channels[c], values));
    const tap = taps[0];
    if (tap?.kind !== 'rack' && tap?.kind !== 'band') break;
    const parent = setup.racks.find((r) => r.id === tap.rackId);
    if (!parent) break;
    if (isInputRack(parent)) {
      inputRack = parent;
      break;
    }
    channels = taps.map((t) => (t && 'channel' in t ? t.channel : 0));
    path.unshift({ rack: parent, channels });
    at = parent;
  }
  const rack = path[path.length - 1]?.rack ?? end;
  const tap = feedOf(setup, rack.channels[0], values);
  const band = tap?.kind === 'band' ? setup.racks.find((r) => r.id === tap.rackId)?.crossover?.bands[tap.band]?.name : undefined;
  return { name: end.name, rack, end, path, ...(inputRack && { inputRack }), from: flowSources(setup, path[0]?.rack ?? end), ...(band !== undefined && { band }) };
}

/**
 * Speakers in signal order: every rack playing into outputs (directly or
 * through an output Select) with the racks it is fed through. Racks no
 * speaker plays through follow at the end, so every value stays tunable.
 */
export function speakers(setup: Setup, values: Values = {}): Speaker[] {
  const list = setup.racks.filter((r) => outputIdsOf(r).length > 0).map((r) => speakerOf(setup, r, values));
  const used = new Set(list.flatMap((s) => s.path.map((p) => p.rack.id)));
  for (const r of setup.racks) {
    if (used.has(r.id) || isInputRack(r) || isOutputSelect(setup, r)) continue;
    const s = speakerOf(setup, r, values);
    list.push(s);
    s.path.forEach((p) => used.add(p.rack.id));
  }
  return list;
}

/** Other speakers whose signal also passes through a rack: editing it changes them too. */
export const sharedWith = (list: readonly Speaker[], speaker: Speaker, rackId: string): string[] =>
  list.filter((s) => s !== speaker && s.path.some((p) => p.rack.id === rackId)).map((s) => s.name);

/** One input channel: physical inputs and the rack that processes them before the first split. */
export interface InputChannel {
  name: string;
  strips: InputStrip[];
  rack?: Rack;
}

/** Input channels in physical order; an input no rack processes is a channel of its own. */
export function inputChannels(setup: Setup): InputChannel[] {
  const strips = inputStrips(setup);
  const used = new Set<InputStrip>();
  const list: InputChannel[] = setup.racks.filter(isInputRack).map((rack) => {
    const own = strips.filter((st) => feeds(rack, (t) => t.kind === 'input' && st.blockIds.includes(t.blockId)));
    own.forEach((st) => used.add(st));
    return { name: rack.name, strips: own, rack };
  });
  for (const st of strips) if (!used.has(st)) list.push({ name: st.name, strips: [st] });
  const first = (ch: InputChannel) => Math.min(...ch.strips.map((st) => strips.indexOf(st)));
  return list.sort((a, b) => first(a) - first(b));
}

/** Speakers fed from an input channel, through its rack or straight from its inputs. */
export function inputTargets(setup: Setup, channel: InputChannel, list: readonly Speaker[]): FlowLink[] {
  const ids = channel.strips.flatMap((st) => st.blockIds);
  return list
    .filter((s) =>
      channel.rack
        ? s.inputRack === channel.rack
        : s.inputRack === undefined && feeds(s.path[0]?.rack ?? s.end, (t) => t.kind === 'input' && ids.includes(t.blockId)),
    )
    .map((s) => ({ text: s.name, anchor: rackAnchor(s.end.id), color: rackColor(setup, s.end.id) }));
}

/** Whether every module of a stereo rack holds the same values on both channels. */
export function rackChannelsAgree(setup: Setup, rack: Rack, values: Values): boolean {
  const keysOf = (blockId: number) => moduleOf(setup, blockId)?.params.map((p) => p.key) ?? [];
  const groups = [
    ...rack.modules.map((m) => m.blockIds),
    ...(rack.crossover?.blockIds[0] ?? []).map((_, s) => rack.crossover?.blockIds.map((chain) => chain[s] ?? -1) ?? []),
  ];
  return groups.every((ids) => channelsAgree(values, ids, keysOf(ids[0] ?? -1)));
}
