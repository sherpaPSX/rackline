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
  if (sources.length > 1) return texts.length === 1 ? `L+R of ${texts[0]}` : texts.join(' + ');
  return texts[0] ?? 'no source';
}

/** Where the rack's signal comes from, e.g. "ANALOG" (inputs 1/2), "L+R of ANALOG", "Delay High". */
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
