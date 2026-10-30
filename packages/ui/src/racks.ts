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
  /** `rack-<rack id>`, `in-<first block id>` or `out-<first block id>`. */
  anchor?: string;
  /** Color of the rack it leads to or comes from. */
  color?: string;
}

export const rackAnchor = (rackId: string): string => `rack-${rackId}`;
export const inputAnchor = (blockIds: readonly number[]): string => `in-${blockIds[0] ?? 0}`;
export const outputAnchor = (blockIds: readonly number[]): string => `out-${blockIds[0] ?? 0}`;

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

/**
 * Where a rack's signal goes: its outputs ("Out 5+6"), the racks fed by the
 * end of its chain, and for a crossover each used band ("High → MF\HF").
 * An output Select it can be switched into counts as that output.
 */
export function flowTargets(setup: Setup, rack: Rack): FlowLink[] {
  const outputLinks = (r: Rack): FlowLink[] =>
    outputStrips(setup)
      .filter((st) => st.rackId === r.id)
      .map((st) => ({ text: st.name, anchor: outputAnchor(st.blockIds) }));
  // `prefix` names the crossover band ("High → ").
  const to = (r: Rack, prefix: string): FlowLink[] =>
    isOutputSelect(setup, r)
      ? outputLinks(r).map((l) => ({ ...l, text: prefix + l.text }))
      : [{ text: prefix + r.name, anchor: rackAnchor(r.id), color: rackColor(setup, r.id) }];
  const links = outputLinks(rack);
  for (const r of setup.racks) if (feeds(r, (t) => t.kind === 'rack' && t.rackId === rack.id)) links.push(...to(r, ''));
  (rack.crossover?.bands ?? []).forEach((b, band) => {
    for (const r of setup.racks) {
      if (feeds(r, (t) => t.kind === 'band' && t.rackId === rack.id && t.band === band)) links.push(...to(r, `${b.name} → `));
    }
  });
  return links;
}

/** Racks fed by one input tile (directly or as a Select choice). */
export function inputTargets(setup: Setup, blockIds: readonly number[]): FlowLink[] {
  return setup.racks
    .filter((r) => feeds(r, (t) => t.kind === 'input' && blockIds.includes(t.blockId)))
    .map((r) => ({ text: r.name, anchor: rackAnchor(r.id), color: rackColor(setup, r.id) }));
}

/**
 * Racks as a tree in signal order: each rack follows the rack that feeds it,
 * one level deeper, so the screen reads ANALOG → Delay → MF\HF, LF.
 * A rack fed by several racks hangs under the first one. Output Selects
 * are left out: they show as the source of their outputs.
 */
export function rackTree(setup: Setup): { rack: Rack; depth: number }[] {
  const racks = setup.racks.filter((r) => !isOutputSelect(setup, r));
  const parentOf = (r: Rack): string | undefined => {
    for (const t of r.channels.flatMap((c) => c.sources)) if (t.kind === 'rack' || t.kind === 'band') return t.rackId;
    return undefined;
  };
  const ids = new Set(racks.map((r) => r.id));
  const out: { rack: Rack; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (rack: Rack, depth: number) => {
    if (seen.has(rack.id)) return;
    seen.add(rack.id);
    out.push({ rack, depth });
    for (const child of racks) if (parentOf(child) === rack.id) visit(child, depth + 1);
  };
  for (const r of racks) {
    const parent = parentOf(r);
    if (parent === undefined || !ids.has(parent)) visit(r, 0);
  }
  // Racks caught in a loop have no root; show them flat at the end.
  for (const r of racks) visit(r, 0);
  return out;
}
