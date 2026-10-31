import type { Canvas, ModuleInfo, ParamInfo, ParamValue, Pin, Setup, StepValue, Values } from '@rackline/api';
import {
  buildRacks,
  decodeParam,
  encodeParam,
  estimateDspLoad,
  findModule,
  fromRaw,
  type ModuleDef,
  type ParamDef,
  type Rack as ModelRack,
} from '@rackline/model';
import { fail, ok, readRecord, type BlockTable, type ParamRecord, type Result } from '@rackline/protocol';

/**
 * Pure mapping between `model` (registry, racks, raw values) and the JSON
 * shapes of `api`. No I/O.
 */

export function toSetup(table: BlockTable, source: Setup['source']): Setup {
  const layout = buildRacks(table);
  const used = new Set(table.blocks.map((b) => b.blockType));
  return {
    name: table.configName,
    source,
    blocks: table.blocks.map((b) => ({ id: b.id, blockType: b.blockType, name: b.name, channel: b.channel })),
    inputIds: layout.inputs.map((b) => b.id),
    outputIds: layout.outputs.map((b) => b.id),
    racks: layout.racks.map(toRack),
    modules: [...used].flatMap((t) => {
      const def = findModule(t);
      return def === undefined ? [] : [moduleInfo(def)];
    }),
    dspPercent: Math.round(estimateDspLoad(table.blocks).dspPercent * 10) / 10,
    canvas: toCanvas(table),
  };
}

/**
 * Drag Net's schematic: positions from the block table, and a wire wherever
 * an output and an input carry the same wire number (fan-out allowed).
 * Physical connectors only appear on one side, so they make no wire.
 */
export function toCanvas(table: BlockTable): Canvas {
  const drivers = new Map<number, Pin>();
  for (const b of table.blocks) b.outputs.forEach((w, pin) => w !== 0 && drivers.set(w, { blockId: b.id, pin }));
  const wires: Canvas['wires'] = [];
  for (const b of table.blocks) {
    b.inputs.forEach((w, pin) => {
      const from = w === 0 ? undefined : drivers.get(w);
      if (from) wires.push({ from, to: { blockId: b.id, pin } });
    });
  }
  return {
    blocks: table.blocks.map((b) => ({ id: b.id, x: b.x, y: b.y, inputs: b.inputs.length, outputs: b.outputs.length })),
    wires,
  };
}

function toRack(rack: ModelRack): Setup['racks'][number] {
  return {
    id: rack.id,
    name: rack.name,
    channels: rack.channels.map((c) => ({
      sources: c.sources,
      ...(c.mixerId === undefined ? {} : { mixerId: c.mixerId }),
      ...(c.mixerInputs === undefined ? {} : { mixerInputs: c.mixerInputs }),
      outputIds: c.outputIds,
    })),
    modules: rack.modules,
    ...(rack.crossover === undefined
      ? {}
      : { crossover: { blockIds: rack.crossover.blockIds, bands: rack.crossover.bands.map((b) => ({ name: b.name })) } }),
  };
}

export function moduleInfo(def: ModuleDef): ModuleInfo {
  return {
    blockType: def.blockType,
    name: def.name,
    role: def.role,
    evidence: def.evidence,
    params: def.params.map(paramInfo),
    compact: [...def.compact],
  };
}

const stepValue = (s: number): StepValue => (Number.isFinite(s) ? s : s > 0 ? 'inf' : '-inf');

function paramInfo(param: ParamDef): ParamInfo {
  const base = { key: param.key, label: param.label };
  switch (param.kind) {
    case 'number': {
      const c = param.conversion;
      return { ...base, kind: 'number', unit: c.unit, min: fromRaw(c, c.rawMin), max: fromRaw(c, c.rawMax), step: 1 / c.divisor };
    }
    case 'steps':
      return { ...base, kind: 'steps', unit: param.unit, steps: param.steps.map(stepValue) };
    case 'enum':
      return { ...base, kind: 'enum', options: Object.entries(param.options).map(([value, label]) => ({ value: Number(value), label })) };
    case 'bool':
      return { ...base, kind: 'bool' };
    case 'flags':
      return { ...base, kind: 'flags', flags: Object.keys(param.bits) };
  }
}

/**
 * Raw record → API value. A `steps` value travels as its index, because the
 * step tables hold ∞; everything else in engineering units via the registry.
 */
export function toApiValue(param: ParamDef, raw: number): ParamValue {
  return param.kind === 'steps' ? Math.min(raw, param.steps.length - 1) : decodeParam(param, raw);
}

/** API value → raw record value (rounded and clamped by the registry). */
export function fromApiValue(param: ParamDef, value: ParamValue): Result<number> {
  if (param.kind !== 'steps') return encodeParam(param, value);
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < param.steps.length
    ? ok(value)
    : fail(`${param.key}: step index ${String(value)} out of range`);
}

export interface ParamTarget {
  blockId: number;
  blockType: number;
  param: ParamDef;
}

/** Look up a block's parameter by key in a loaded table. */
export function findParam(table: BlockTable, blockId: number, key: string): Result<ParamTarget> {
  const block = table.blocks.find((b) => b.id === blockId);
  if (block === undefined) return fail(`no block ${blockId} in this setup`);
  const param = findModule(block.blockType)?.params.find((p) => p.key === key);
  if (param === undefined) return fail(`block ${block.name} has no parameter ${key}`);
  return ok({ blockId, blockType: block.blockType, param });
}

export function paramRecord(target: ParamTarget, raw = 0): ParamRecord {
  const address = { target: 'block', instance: target.blockId, objectType: target.blockType, index: target.param.index } as const;
  return { ...readRecord(address, target.param.size), value: raw };
}

/** Read requests for every known parameter of every block. */
export function valueReadRecords(table: BlockTable): ParamRecord[] {
  return table.blocks.flatMap((b) => (findModule(b.blockType)?.params ?? []).map((param) => paramRecord({ blockId: b.id, blockType: b.blockType, param })));
}

/** Decode block parameter records (device replies or an `.r26` preset) into `values`, in place. */
export function applyRecords(table: BlockTable, values: Values, records: readonly ParamRecord[]): void {
  for (const r of records) {
    if (r.target !== 'block') continue;
    const block = table.blocks.find((b) => b.id === r.instance && b.blockType === r.objectType);
    const param = block === undefined ? undefined : findModule(block.blockType)?.params.find((p) => p.index === r.index);
    if (param === undefined) continue;
    const blockValues = (values[String(r.instance)] ??= {});
    blockValues[param.key] = toApiValue(param, r.value);
  }
}
