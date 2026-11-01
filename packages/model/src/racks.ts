import type { BlockTable, ConfigBlock } from '@rackline/protocol';
import { findModule, type ModuleRole } from './registry/index.js';

/**
 * Racks are a view of the Drag Net block graph (docs/ui-plan.md "Model"): the
 * graph is cut into linear chains at splits and merges, a crossover ends a
 * rack and its bands feed further racks, and parallel left/right chains are
 * folded into one stereo rack. Import never rearranges the DSP.
 */

/** Where a rack channel's signal comes from. `channel` is 0 = left (or mono), 1 = right. */
export type Tap =
  | { kind: 'input'; blockId: number }
  | { kind: 'generator'; blockId: number }
  /** End of another rack's module chain (a split). */
  | { kind: 'rack'; rackId: string; channel: number }
  /** A band of another rack's crossover. */
  | { kind: 'band'; rackId: string; channel: number; band: number };

export interface RackChannel {
  /** One source, or several summed by `mixerId` (a mono sum of a stereo rack is two taps of it). */
  sources: Tap[];
  mixerId?: number;
  /** With a mixer: the mixer input (0-based) of each source; unconnected inputs have no source. */
  mixerInputs?: number[];
  /** Output blocks fed by the end of the chain. */
  outputIds: number[];
}

export interface RackModule {
  blockType: number;
  /** Block per channel, in channel order. */
  blockIds: number[];
}

export interface CrossoverBand {
  name: string;
  /** Block and output index per channel. */
  points: { blockId: number; output: number }[];
}

/**
 * The last module of a rack. A crossover whose band feeds only another
 * crossover (e.g. 3-way → 2-way) is shown as one crossover with more bands.
 */
export interface RackCrossover {
  /** Per channel: the cascaded crossover blocks, the first one fed by the rack. */
  blockIds: number[][];
  /** Bands in DSP output order (high first). */
  bands: CrossoverBand[];
}

export interface Rack {
  id: string;
  /** Suggested from Drag Net block names. */
  name: string;
  /** One channel = mono, two = stereo (left, right). */
  channels: RackChannel[];
  modules: RackModule[];
  crossover?: RackCrossover;
}

export interface RackLayout {
  inputs: ConfigBlock[];
  outputs: ConfigBlock[];
  /** In signal order: every rack comes after the racks it is fed from. */
  racks: Rack[];
}

interface Point {
  blockId: number;
  output: number;
}

/** A single-channel rack while building, before stereo folding. */
interface MonoRack {
  id: string;
  sources: Point[];
  mixer?: ConfigBlock;
  /** Mixer input of each source. */
  mixerInputs?: number[];
  modules: ConfigBlock[];
  crossover?: { blocks: ConfigBlock[]; bands: Point[]; names: string[] };
  outputs: ConfigBlock[];
}

const INPUT_KINDS = new Set([0x4c, 0x2c]);
const OUTPUT_KIND = 0x54;

function roleOf(block: ConfigBlock): ModuleRole {
  const role = findModule(block.blockType)?.role;
  if (role !== undefined) return role;
  // Unknown block types: judge by kind and shape.
  if (INPUT_KINDS.has(block.kind)) return 'input';
  if (block.kind === OUTPUT_KIND) return 'output';
  if (block.inputs.length === 0) return 'generator';
  if (block.inputs.length > 1) return 'mixer';
  if (block.outputs.length > 1) return 'crossover';
  return 'processing';
}

const isSource = (role: ModuleRole): boolean => role === 'input' || role === 'generator';

export function buildRacks(table: BlockTable): RackLayout {
  const blocks = table.blocks;
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const order = new Map(blocks.map((b, i) => [b.id, i]));
  const role = new Map(blocks.map((b) => [b.id, roleOf(b)]));
  const get = (id: number): ConfigBlock => byId.get(id) as ConfigBlock;

  // Wires: who drives a wire and who listens. Physical connector wires (input
  // blocks' inputs, output blocks' outputs) are not part of the graph.
  const producer = new Map<number, Point>();
  const consumers = new Map<number, ConfigBlock[]>();
  for (const b of blocks) {
    const r = role.get(b.id);
    if (r !== 'output') b.outputs.forEach((w, output) => w !== 0 && producer.set(w, { blockId: b.id, output }));
    if (r !== 'input') {
      for (const w of b.inputs) if (w !== 0) consumers.set(w, [...(consumers.get(w) ?? []), b]);
    }
  }
  const listeners = (p: Point): ConfigBlock[] => {
    const wire = get(p.blockId).outputs[p.output] ?? 0;
    return wire === 0 ? [] : (consumers.get(wire) ?? []);
  };
  const driver = (wire: number): Point | undefined => (wire === 0 ? undefined : producer.get(wire));

  /** The next block of a chain: the only listener, if it is a single-input module. */
  const next = (block: ConfigBlock): ConfigBlock | undefined => {
    if (block.outputs.length !== 1) return undefined;
    const [only, ...rest] = listeners({ blockId: block.id, output: 0 });
    if (only === undefined || rest.length > 0) return undefined;
    const r = role.get(only.id);
    return r === 'processing' || r === 'crossover' ? only : undefined;
  };

  /** Crossover blocks fed by another crossover's band and nothing else. */
  const cascaded = (p: Point): ConfigBlock | undefined => {
    const [only, ...rest] = listeners(p);
    const isCrossover = only !== undefined && findModule(only.blockType)?.role === 'crossover';
    return isCrossover && rest.length === 0 && findModule(get(p.blockId).blockType)?.role === 'crossover' ? only : undefined;
  };

  const chained = new Set<number>();
  for (const b of blocks) {
    const r = role.get(b.id);
    const n = r === 'processing' || r === 'mixer' ? next(b) : undefined;
    if (n !== undefined) chained.add(n.id);
    if (r === 'crossover') {
      b.outputs.forEach((_, output) => {
        const c = cascaded({ blockId: b.id, output });
        if (c !== undefined) chained.add(c.id);
      });
    }
  }

  const monoRacks: MonoRack[] = [];
  const endOf = new Map<number, MonoRack>(); // last chain block → rack
  const bandOf = new Map<string, { rack: MonoRack; band: number }>(); // "block:output" → band
  const key = (p: Point): string => `${p.blockId}:${p.output}`;

  const expandCrossover = (root: ConfigBlock): NonNullable<MonoRack['crossover']> => {
    const xo = { blocks: [root], bands: [] as Point[], names: [] as string[] };
    const walk = (block: ConfigBlock): void => {
      const names = findModule(block.blockType)?.bands ?? block.outputs.map((_, i) => `Out ${i + 1}`);
      block.outputs.forEach((_, output) => {
        const p = { blockId: block.id, output };
        const sub = cascaded(p);
        if (sub === undefined) {
          xo.bands.push(p);
          xo.names.push(names[output] ?? `Out ${output + 1}`);
        } else {
          xo.blocks.push(sub);
          walk(sub);
        }
      });
    };
    walk(root);
    if (xo.blocks.length > 1) xo.names = bandNames(xo.names.length, xo.names);
    return xo;
  };

  // 1. Chains starting at every block that does not continue another chain.
  for (const head of blocks) {
    const r = role.get(head.id);
    if (r === undefined || isSource(r) || r === 'output' || chained.has(head.id)) continue;
    const fed = head.inputs.flatMap((w, input) => {
      const p = driver(w);
      return p === undefined ? [] : [{ p, input }];
    });
    const rack: MonoRack = { id: `rack-${head.id}`, sources: fed.map((f) => f.p), modules: [], outputs: [] };
    let block: ConfigBlock | undefined = head;
    if (r === 'mixer') {
      rack.mixer = head;
      rack.mixerInputs = fed.map((f) => f.input);
      block = next(head);
    }
    while (block !== undefined) {
      if (role.get(block.id) === 'crossover') {
        rack.crossover = expandCrossover(block);
        break;
      }
      rack.modules.push(block);
      block = next(block);
    }
    const end = rack.modules.at(-1) ?? rack.mixer;
    if (end !== undefined) endOf.set(end.id, rack);
    rack.crossover?.bands.forEach((p, band) => bandOf.set(key(p), { rack, band }));
    monoRacks.push(rack);
  }

  // 2. Outputs join the rack whose end feeds them; outputs fed straight from an
  //    input, generator or crossover band get a rack without modules.
  const direct = new Map<string, MonoRack>();
  for (const out of blocks.filter((b) => role.get(b.id) === 'output')) {
    const p = driver(out.inputs[0] ?? 0);
    if (p === undefined) continue;
    const owner = endOf.get(p.blockId);
    if (owner !== undefined) {
      owner.outputs.push(out);
      continue;
    }
    let rack = direct.get(key(p));
    if (rack === undefined) {
      rack = { id: `rack-${out.id}`, sources: [p], modules: [], outputs: [] };
      direct.set(key(p), rack);
      monoRacks.push(rack);
    }
    rack.outputs.push(out);
  }

  // 3. Taps, then fold parallel left/right racks into stereo racks.
  const tapOf = (p: Point): MonoTap => {
    const r = role.get(p.blockId);
    if (r === 'input') return { kind: 'input', blockId: p.blockId };
    if (r === 'generator') return { kind: 'generator', blockId: p.blockId };
    const band = bandOf.get(key(p));
    if (band !== undefined) return { kind: 'band', rack: band.rack, band: band.band };
    const rack = endOf.get(p.blockId);
    // A wire driven by a block that is neither a source nor a rack end cannot occur in a valid table.
    if (rack === undefined) throw new Error(`block ${p.blockId} output ${p.output} is not a rack end`);
    return { kind: 'rack', rack };
  };
  const sortedRacks = topoSort(monoRacks, (r) => r.sources.map(tapOf), order);
  const pairs = foldStereo(sortedRacks, tapOf, byId);

  // 4. Final racks in display order.
  return {
    inputs: blocks.filter((b) => role.get(b.id) === 'input'),
    outputs: blocks.filter((b) => role.get(b.id) === 'output'),
    racks: displayOrder(pairs, tapOf, byId),
  };
}

type MonoTap =
  | { kind: 'input'; blockId: number }
  | { kind: 'generator'; blockId: number }
  | { kind: 'rack'; rack: MonoRack }
  | { kind: 'band'; rack: MonoRack; band: number };

/** Positional names for merged crossovers (3-way + 2-way = 4 bands). */
function bandNames(count: number, fallback: string[]): string[] {
  if (count === 4) return ['High', 'High mid', 'Low mid', 'Low'];
  if (count === 5) return ['High', 'High mid', 'Mid', 'Low mid', 'Low'];
  return fallback;
}

function parentsOf(taps: MonoTap[]): MonoRack[] {
  return taps.flatMap((t) => (t.kind === 'rack' || t.kind === 'band' ? [t.rack] : []));
}

/** Racks in an order where every rack follows its parents (ties: block table order). */
function topoSort(racks: MonoRack[], taps: (r: MonoRack) => MonoTap[], order: Map<number, number>): MonoRack[] {
  const first = (r: MonoRack): number => order.get(firstBlock(r).id) ?? 0;
  const pending = [...racks].sort((a, b) => first(a) - first(b));
  const done = new Set<MonoRack>();
  const out: MonoRack[] = [];
  while (pending.length > 0) {
    const i = pending.findIndex((r) => parentsOf(taps(r)).every((p) => done.has(p) || p === r));
    // A feedback loop (not possible in a compiled config): take the next one anyway.
    const [rack] = pending.splice(Math.max(i, 0), 1);
    if (rack === undefined) break;
    done.add(rack);
    out.push(rack);
  }
  return out;
}

function firstBlock(r: MonoRack): ConfigBlock {
  return (r.mixer ?? r.modules[0] ?? r.crossover?.blocks[0] ?? r.outputs[0]) as ConfigBlock;
}

/** What must match for two racks to be the left and right side of one stereo rack. */
function shape(r: MonoRack): string {
  return JSON.stringify([
    r.sources.length,
    r.mixer?.blockType,
    r.modules.map((m) => m.blockType),
    r.crossover?.blocks.map((b) => b.blockType),
    r.outputs.length > 0,
  ]);
}

type Pair = [MonoRack] | [MonoRack, MonoRack];

function foldStereo(racks: MonoRack[], tapOf: (p: Point) => MonoTap, byId: Map<number, ConfigBlock>): Pair[] {
  const side = new Map<MonoRack, { pair: Pair; channel: number }>();
  const pairs: Pair[] = [];

  const isLeftRight = (a: MonoTap, b: MonoTap): boolean => {
    if (a.kind === 'input' && b.kind === 'input') {
      const l = byId.get(a.blockId);
      const r = byId.get(b.blockId);
      return l !== undefined && r !== undefined && l.blockType === r.blockType && l.channel % 2 === 1 && r.channel === l.channel + 1;
    }
    if ((a.kind === 'rack' && b.kind === 'rack') || (a.kind === 'band' && b.kind === 'band' && a.band === b.band)) {
      const l = side.get(a.rack);
      const r = side.get(b.rack);
      return l !== undefined && l.pair === r?.pair && l.channel === 0 && r.channel === 1;
    }
    return false;
  };

  for (const left of racks) {
    if (side.has(left)) continue;
    const lt = left.sources.map(tapOf);
    const right =
      lt.length === 0
        ? undefined
        : racks.find((r) => {
            if (r === left || side.has(r) || shape(r) !== shape(left)) return false;
            const rt = r.sources.map(tapOf);
            return lt.every((t, i) => {
              const u = rt[i];
              return u !== undefined && isLeftRight(t, u);
            });
          });
    const pair: Pair = right === undefined ? [left] : [left, right];
    pair.forEach((r, channel) => side.set(r, { pair, channel }));
    pairs.push(pair);
  }
  return pairs;
}

function displayOrder(pairs: Pair[], tapOf: (p: Point) => MonoTap, byId: Map<number, ConfigBlock>): Rack[] {
  const pairOf = new Map<MonoRack, { pair: Pair; channel: number }>();
  pairs.forEach((pair) => pair.forEach((r, channel) => pairOf.set(r, { pair, channel })));
  const idOf = (pair: Pair): string => pair[0].id;
  const parents = (pair: Pair): Pair[] => {
    const found = new Set<Pair>();
    for (const r of pair) for (const p of parentsOf(r.sources.map(tapOf))) {
      const parent = pairOf.get(p)?.pair;
      if (parent !== undefined && parent !== pair) found.add(parent);
    }
    return [...found];
  };

  // Children of each pair in the order of the point they hang off (rack end first, then bands).
  const children = new Map<Pair, Pair[]>(pairs.map((p) => [p, []]));
  const rank = (pair: Pair): number =>
    Math.min(
      ...pair[0].sources.map((p) => {
        const t = tapOf(p);
        return t.kind === 'band' ? t.band + 1 : 0;
      }),
    );
  for (const pair of pairs) for (const parent of parents(pair)) children.get(parent)?.push(pair);
  for (const list of children.values()) list.sort((a, b) => rank(a) - rank(b));

  const emitted = new Set<Pair>();
  const ordered: Pair[] = [];
  const visit = (pair: Pair): void => {
    if (emitted.has(pair) || !parents(pair).every((p) => emitted.has(p))) return;
    emitted.add(pair);
    ordered.push(pair);
    for (const child of children.get(pair) ?? []) visit(child);
  };
  pairs.filter((p) => parents(p).length === 0).forEach(visit);
  pairs.forEach((p) => emitted.has(p) || ordered.push(p)); // loops, not expected

  const names = new Map<Pair, string>();
  const toTap = (t: MonoTap): Tap => {
    if (t.kind === 'input' || t.kind === 'generator') return t;
    const p = pairOf.get(t.rack);
    const rackId = p === undefined ? t.rack.id : idOf(p.pair);
    const channel = p?.channel ?? 0;
    return t.kind === 'rack' ? { kind: 'rack', rackId, channel } : { kind: 'band', rackId, channel, band: t.band };
  };

  return ordered.map((pair) => {
    const [left] = pair;
    const name = suggestName(pair, (p) => names.get(p), (t) => (t.kind === 'rack' || t.kind === 'band' ? pairOf.get(t.rack)?.pair : undefined), tapOf, byId);
    names.set(pair, name);
    const rack: Rack = {
      id: idOf(pair),
      name,
      channels: pair.map((r) => ({
        sources: r.sources.map((p) => toTap(tapOf(p))),
        ...(r.mixer === undefined ? {} : { mixerId: r.mixer.id, mixerInputs: r.mixerInputs ?? [] }),
        outputIds: r.outputs.map((o) => o.id),
      })),
      modules: left.modules.map((m, i) => ({ blockType: m.blockType, blockIds: pair.map((r) => r.modules[i]?.id ?? 0) })),
    };
    const xo = left.crossover;
    if (xo !== undefined) {
      rack.crossover = {
        blockIds: pair.map((r) => r.crossover?.blocks.map((b) => b.id) ?? []),
        bands: xo.names.map((name, band) => ({
          name,
          points: pair.map((r) => r.crossover?.bands[band] ?? { blockId: 0, output: 0 }),
        })),
      };
    }
    return rack;
  });
}

/**
 * Name from what the rack feeds (output names), else where it comes from
 * (input names, "<rack> mono" for a mono sum), else its first block.
 */
function suggestName(
  pair: Pair,
  nameOf: (p: Pair) => string | undefined,
  parentPair: (t: MonoTap) => Pair | undefined,
  tapOf: (p: Point) => MonoTap,
  byId: Map<number, ConfigBlock>,
): string {
  const channelName = (r: MonoRack): string => {
    if (r.outputs.length > 0) return r.outputs.map((o) => o.name).join(' + ');
    const taps = r.sources.map(tapOf);
    const parents = [...new Set(taps.map(parentPair))];
    const [only] = parents;
    if (taps.length > 1 && parents.length === 1 && only !== undefined && only.length === 2) {
      return `${nameOf(only) ?? ''} mono`.trim();
    }
    const [first] = taps;
    if (first !== undefined && (first.kind === 'input' || first.kind === 'generator') && taps.length === 1) {
      return byId.get(first.blockId)?.name ?? '';
    }
    return firstBlock(r).name;
  };
  const [left, right] = pair;
  return right === undefined ? channelName(left) : commonName(channelName(left), channelName(right));
}

const SIDE_WORDS = /\b(left|right|l|r)\b/gi;

/** "MF\HF - LEFT" + "MF\HF - RIGHT" → "MF\HF"; "Crossover 5" + "Crossover 3" → "Crossover". */
export function commonName(a: string, b: string): string {
  const clean = (s: string): string => s.replace(SIDE_WORDS, ' ').replace(/\s+/g, ' ').replace(/^[\s\-_/\\]+|[\s\-_/\\]+$/g, '');
  const [ca, cb] = [clean(a), clean(b)];
  if (ca === cb && ca !== '') return ca;
  const [na, nb] = [ca.replace(/\s*\d+$/, ''), cb.replace(/\s*\d+$/, '')];
  if (na === nb && na !== '') return na;
  return `${a} / ${b}`;
}
