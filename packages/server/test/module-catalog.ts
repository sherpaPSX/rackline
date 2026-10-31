import type { AppState, ParamInfo, ParamValue, Rack, Setup, Values } from '@rackline/api';
import { findModule, MODULES } from '@rackline/model';
import { moduleInfo } from '../src/index.js';

/**
 * A made-up setup that uses every module the core knows, so the UI can show
 * all module cards on one page (`packages/ui` module gallery). Not a real
 * RPM layout: DSP limits are ignored.
 */

type Spec = { type: number; name: string; channel?: number };

const T = {
  analogIn: 0x0105,
  digitalIn: 0x0103,
  out: 0x0106,
  level: 0x0180,
  delay: 0x0301,
  comp: 0x0500,
  limiter: 0x0501,
  monoSc: 0x0509,
  stereoSc: 0x050a,
  agc: 0x0502,
  anc: 0x0503,
  peq4: 0x0603,
  peq9: 0x0608,
  x2: 0x060f,
  x3: 0x0610,
  geq: 0x0613,
  fbs: 0x0a01,
  gen: 0x0700,
  mix2: 0x0200,
  mix4: 0x0202,
  matrix2: 0x0801,
  matrix6: 0x0817,
  automix: 0x0b0c,
  meter: 0x0400,
} as const;

function defaultValue(p: ParamInfo): ParamValue {
  switch (p.kind) {
    case 'number': {
      const preferred = p.unit === 'Hz' ? 1000 : p.unit === 'oct' ? 1 : p.unit === 'ratio' ? 2 : 0;
      return Math.min(p.max, Math.max(p.min, preferred));
    }
    case 'steps':
      return Math.floor(p.steps.length / 2);
    case 'enum':
      return p.options[0]?.value ?? 0;
    case 'bool':
      return false;
    case 'flags':
      return Object.fromEntries(p.flags.map((f) => [f, false]));
  }
}

function diagonal(size: number): Record<string, ParamValue> {
  const cells = Array.from({ length: size * size }, (_, k) => [Math.floor(k / size) + 1, (k % size) + 1] as const);
  return Object.fromEntries(cells.map(([o, i]) => [`out${o}In${i}Mute`, o !== i]));
}

/** Values that make the curves and meters look like a tuned system. */
const SHOWCASE: Record<string, Record<string, ParamValue>> = {
  'TOPS PEQ': {
    band1Enable: true, band1Type: 0, band1Freq: 80, band1Width: 1.5, band1Gain: -3,
    band2Enable: true, band2Type: 0, band2Freq: 400, band2Width: 0.5, band2Gain: -4.5,
    band3Enable: true, band3Type: 0, band3Freq: 2500, band3Width: 1, band3Gain: 2,
    band4Enable: true, band4Type: 2, band4Freq: 10000, band4Width: 1, band4Gain: 3,
  },
  'TOPS Delay': { delay: 4 },
  'TOPS Limiter': { threshold: -6 },
  'TOPS Compressor': { threshold: -18 },
  'TOPS Level': { level: -2.5 },
  'TOPS Crossover': {
    lowUpperType: 2, lowUpperFreq: 200, midLowerType: 2, midLowerFreq: 200,
    midUpperType: 2, midUpperFreq: 1200, highLowerType: 2, highLowerFreq: 1200,
  },
  'SUB Crossover': { lowUpperType: 2, lowUpperFreq: 90, highLowerType: 2, highLowerFreq: 90 },
  'SUB Delay': { delay: 3.5 },
  'HIGH PEQ': {
    band1Enable: true, band1Type: 5, band1Freq: 3000, band1Width: 1, band1Gain: 4,
    band2Enable: true, band2Type: 0, band2Freq: 6300, band2Width: 0.3, band2Gain: -5,
  },
  // Matrices route input n to output n only.
  'ROUTING Matrix 2': diagonal(2),
  'ROUTING Matrix 6': diagonal(6),
  'SPEECH Automix': Object.fromEntries([1, 2, 3, 4].map((i) => [`out1In${i}Assign`, true])),
  Generator: { level: -20, mute: true },
  'SPEECH Graphic EQ': Object.fromEntries(
    [0, 0, -1, -2, -3, -2, 0, 0, 1, 0, -1.5, -3, -4, -2, 0, 0, 0, 1, 2, 2.5, 1, 0, -1, -2, -3, -2, -1, 0, -3, -6].map((g, k) => [`band${k + 1}Gain`, g]),
  ),
};

export function moduleCatalogState(): AppState {
  const blocks: Setup['blocks'] = [];
  const values: Values = {};
  const add = (s: Spec): number => {
    const id = blocks.length + 1;
    blocks.push({ id, blockType: s.type, name: s.name, channel: s.channel ?? 0 });
    const def = findModule(s.type);
    if (def === undefined) throw new Error(`unknown block type ${s.type}`);
    const info = moduleInfo(def);
    values[String(id)] = { ...Object.fromEntries(info.params.map((p) => [p.key, defaultValue(p)])), ...SHOWCASE[s.name] };
    return id;
  };
  const stereo = (type: number, name: string) => [add({ type, name }), add({ type, name })];
  const mono = (type: number, name: string) => [add({ type, name })];

  const inputIds = [
    add({ type: T.analogIn, name: 'Analog 1', channel: 1 }),
    add({ type: T.analogIn, name: 'Analog 2', channel: 2 }),
    add({ type: T.digitalIn, name: 'Digital A', channel: 1 }),
    add({ type: T.digitalIn, name: 'Digital B', channel: 2 }),
  ];
  const outputIds = [1, 2, 3, 4, 5, 6].map((c) => add({ type: T.out, name: `Out ${c}`, channel: c }));
  const [a1, a2, dA, dB] = inputIds as [number, number, number, number];
  const out = (k: number) => outputIds[k - 1] ?? 0;
  const generator = add({ type: T.gen, name: 'Generator' });

  const racks: Rack[] = [];
  const chain = (...modules: number[][]): Rack['modules'] =>
    modules.map((ids) => ({ blockType: blocks[(ids[0] ?? 1) - 1]?.blockType ?? 0, blockIds: ids }));

  // Main PA path: dynamics, PEQ, delay, level, 3-way crossover into the band racks.
  const tops = chain(
    stereo(T.limiter, 'TOPS Limiter'),
    stereo(T.comp, 'TOPS Compressor'),
    stereo(T.peq4, 'TOPS PEQ'),
    stereo(T.delay, 'TOPS Delay'),
    stereo(T.level, 'TOPS Level'),
  );
  const topsX = stereo(T.x3, 'TOPS Crossover');
  racks.push({
    id: 'tops',
    name: 'TOPS',
    channels: [
      { sources: [{ kind: 'input', blockId: a1 }], outputIds: [] },
      { sources: [{ kind: 'input', blockId: a2 }], outputIds: [] },
    ],
    modules: tops,
    crossover: { blockIds: topsX.map((id) => [id]), bands: [{ name: 'High' }, { name: 'Mid' }, { name: 'Low' }] },
  });
  const band = (id: string, name: string, b: number, outs: [number, number], modules: Rack['modules']): Rack => ({
    id,
    name,
    channels: [0, 1].map((ch) => ({ sources: [{ kind: 'band', rackId: 'tops', channel: ch, band: b }], outputIds: [out(outs[ch] ?? 1)] })),
    modules,
  });
  racks.push(band('high', 'HIGH', 0, [5, 6], chain(stereo(T.peq9, 'HIGH PEQ'), stereo(T.delay, 'HIGH Delay'), stereo(T.level, 'HIGH Level'), stereo(T.limiter, 'HIGH Limiter'))));
  racks.push(band('mid', 'MID', 1, [3, 4], chain(stereo(T.peq4, 'MID PEQ'), stereo(T.level, 'MID Level'), stereo(T.limiter, 'MID Limiter'))));

  // Mono sub: analog 1 + 2 summed by a Mix 2 × 1, 2-way crossover, low band to out 2.
  const subMix = add({ type: T.mix2, name: 'SUB Mix' });
  const subX = mono(T.x2, 'SUB Crossover');
  racks.push({
    id: 'sub',
    name: 'SUB',
    channels: [{ sources: [{ kind: 'input', blockId: a1 }, { kind: 'input', blockId: a2 }], mixerId: subMix, mixerInputs: [0, 1], outputIds: [] }],
    modules: chain(mono(T.delay, 'SUB Delay'), mono(T.meter, 'SUB Meter')),
    crossover: { blockIds: [subX], bands: [{ name: 'High' }, { name: 'Low' }] },
  });
  racks.push({
    id: 'sub-low',
    name: 'SUB LOW',
    channels: [{ sources: [{ kind: 'band', rackId: 'sub', channel: 0, band: 1 }], outputIds: [out(1), out(2)] }],
    modules: chain(mono(T.peq4, 'SUB PEQ'), mono(T.level, 'SUB Level'), mono(T.limiter, 'SUB Limiter')),
  });

  // Routing modules on the digital inputs.
  racks.push({
    id: 'routing',
    name: 'ROUTING',
    channels: [{ sources: [{ kind: 'input', blockId: dA }], outputIds: [] }],
    modules: chain(mono(T.mix4, 'ROUTING Mix'), mono(T.matrix2, 'ROUTING Matrix 2'), mono(T.matrix6, 'ROUTING Matrix 6')),
  });

  // Speech and install modules.
  racks.push({
    id: 'speech',
    name: 'SPEECH',
    channels: [{ sources: [{ kind: 'input', blockId: dB }], outputIds: [] }],
    modules: chain(
      mono(T.geq, 'SPEECH Graphic EQ'),
      mono(T.fbs, 'SPEECH Feedback'),
      mono(T.agc, 'SPEECH AGC'),
      mono(T.monoSc, 'SPEECH Ducker'),
      mono(T.stereoSc, 'SPEECH Stereo Ducker'),
      mono(T.anc, 'SPEECH Noise Comp'),
      mono(T.automix, 'SPEECH Automix'),
    ),
  });

  racks.push({
    id: 'noise',
    name: 'NOISE',
    channels: [{ sources: [{ kind: 'generator', blockId: generator }], outputIds: [] }],
    modules: [],
  });

  const used = new Set(blocks.map((b) => b.blockType));
  const setup: Setup = {
    name: 'Rackline module catalog',
    source: { kind: 'file', fileName: 'module-catalog.r26' },
    blocks,
    inputIds,
    outputIds,
    racks,
    modules: MODULES.filter((m) => used.has(m.blockType)).map(moduleInfo),
    dspPercent: 0,
  };
  return { connection: { status: 'offline' }, devices: [], setup, values };
}
