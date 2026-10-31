import { z } from "zod";

/**
 * Device state as the core sends it to clients. These shapes mirror the
 * `@rackline/model` types (racks, module registry) in plain JSON, because the
 * UI must not import `model`. The server maps one to the other.
 */

/**
 * A parameter value in engineering units: a number (dB, Hz, ms, octaves, the
 * code of an option, or the index into `steps`), a boolean (mute, invert) or
 * named flag bits.
 */
export const ParamValue = z.union([
  z.number(),
  z.boolean(),
  z.record(z.string(), z.boolean()),
]);
export type ParamValue = z.infer<typeof ParamValue>;

export const Unit = z.enum([
  "dB",
  "dBFS",
  "Hz",
  "ms",
  "s",
  "h",
  "dB/s",
  "oct",
  "ratio",
]);
export type Unit = z.infer<typeof Unit>;

/**
 * `inf` stands for ∞ (compressor ratio, AGC hold) and `-inf` for Off (graphic
 * EQ tone level), which JSON cannot carry as numbers.
 */
export const StepValue = z.union([
  z.number(),
  z.literal("inf"),
  z.literal("-inf"),
]);
export type StepValue = z.infer<typeof StepValue>;

const paramBase = {
  /** Stable key within the module, e.g. `trim`, `band3Gain`. */
  key: z.string(),
  label: z.string(),
};

/** How to show and edit one parameter. The value's type follows `kind`. */
export const ParamInfo = z.discriminatedUnion("kind", [
  /** A number in `unit`, from `min` to `max` in increments of `step`. */
  z.object({
    ...paramBase,
    kind: z.literal("number"),
    unit: Unit,
    min: z.number(),
    max: z.number(),
    step: z.number(),
  }),
  /** The value is an index into `steps` (attack, release and ratio tables). */
  z.object({
    ...paramBase,
    kind: z.literal("steps"),
    unit: Unit,
    steps: z.array(StepValue),
  }),
  /** The value is one option's `value` (filter type, input sensitivity). */
  z.object({
    ...paramBase,
    kind: z.literal("enum"),
    options: z.array(z.object({ value: z.number(), label: z.string() })),
  }),
  z.object({ ...paramBase, kind: z.literal("bool") }),
  /** The value is an object with one boolean per name in `flags`. */
  z.object({
    ...paramBase,
    kind: z.literal("flags"),
    flags: z.array(z.string()),
  }),
]);
export type ParamInfo = z.infer<typeof ParamInfo>;

/**
 * How well a module's mapping is backed: `simulator` = verified with the
 * simulator, `sample` = read from a real file only, `guessed` = by analogy.
 */
export const Evidence = z.enum(["simulator", "sample", "guessed"]);

export const ModuleRole = z.enum([
  "input",
  "output",
  "processing",
  "mixer",
  "crossover",
  "generator",
]);

/** A live level of a block, sent in `meters` messages under `key`. */
export const MeterInfo = z.object({
  key: z.string(),
  label: z.string(),
  /** `dBu` / `dBFS` levels, or `dB` of gain reduction. */
  unit: z.enum(["dBu", "dBFS", "dB"]),
  /** Level at full scale (clip), e.g. +24 dBu or 0 dBFS. 0 for gain reduction. */
  fullScale: z.number(),
  /** Gain reduction: 0 = none, larger = more. */
  reduction: z.boolean(),
});
export type MeterInfo = z.infer<typeof MeterInfo>;

/** A DSP block type the core knows how to tune. */
export const ModuleInfo = z.object({
  blockType: z.number(),
  name: z.string(),
  role: ModuleRole,
  evidence: Evidence,
  params: z.array(ParamInfo),
  /** Keys of the 2–4 parameters shown in the compact module view. */
  compact: z.array(z.string()),
  /** Live levels the device reports for blocks of this type. */
  meters: z.array(MeterInfo),
});
export type ModuleInfo = z.infer<typeof ModuleInfo>;

/** One DSP block of the loaded setup. Its parameters are described by the module with the same `blockType`. */
export const Block = z.object({
  id: z.number(),
  blockType: z.number(),
  /** Name given in Drag Net, e.g. `SUB FLEX`. */
  name: z.string(),
  /** Physical channel of an input or output block (1-based), 0 otherwise. */
  channel: z.number(),
});
export type Block = z.infer<typeof Block>;

/** Where a rack channel's signal comes from. `channel` is 0 = left (or mono), 1 = right. */
export const Tap = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("input"), blockId: z.number() }),
  z.object({ kind: z.literal("generator"), blockId: z.number() }),
  /** End of another rack's module chain. */
  z.object({
    kind: z.literal("rack"),
    rackId: z.string(),
    channel: z.number(),
  }),
  /** A band of another rack's crossover. */
  z.object({
    kind: z.literal("band"),
    rackId: z.string(),
    channel: z.number(),
    band: z.number(),
  }),
]);
export type Tap = z.infer<typeof Tap>;

export const Rack = z.object({
  id: z.string(),
  name: z.string(),
  /** One channel = mono, two = stereo (left, right). */
  channels: z.array(
    z.object({
      /** One source, or several summed by the mixer block `mixerId`. */
      sources: z.array(Tap),
      mixerId: z.number().optional(),
      /** With a mixer: the mixer input (0-based) of each source; for a Select, its `input` value. */
      mixerInputs: z.array(z.number()).optional(),
      outputIds: z.array(z.number()),
    }),
  ),
  /** Module chain in signal order; one block per channel. */
  modules: z.array(
    z.object({ blockType: z.number(), blockIds: z.array(z.number()) }),
  ),
  /** The last module, if the rack ends in a crossover. */
  crossover: z
    .object({
      /** Per channel: the cascaded crossover blocks, the first one fed by the rack. */
      blockIds: z.array(z.array(z.number())),
      /** Bands in DSP output order (high first). */
      bands: z.array(z.object({ name: z.string() })),
    })
    .optional(),
});
export type Rack = z.infer<typeof Rack>;

/** The loaded DSP setup. Its layout never changes while tuning (phase 1). */
export const Setup = z.object({
  /** Configuration name stored in the setup, e.g. `RPM 26z Configuration`. */
  name: z.string(),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("device"), ip: z.string() }),
    /** An `.r26` file opened without a device: changes stay in the core. */
    z.object({ kind: z.literal("file"), fileName: z.string() }),
  ]),
  blocks: z.array(Block),
  /** Input and output block ids in physical order. */
  inputIds: z.array(z.number()),
  outputIds: z.array(z.number()),
  /** In signal order: every rack comes after the racks it is fed from. */
  racks: z.array(Rack),
  /** Every block type used by `blocks` that the core knows. */
  modules: z.array(ModuleInfo),
  /** Estimated DSP load in percent (only the compiler knows the exact figure). */
  dspPercent: z.number(),
});
export type Setup = z.infer<typeof Setup>;

/** Parameter values by block id (as a string, JSON object key), then parameter key. */
export const Values = z.record(z.string(), z.record(z.string(), ParamValue));
export type Values = z.infer<typeof Values>;

/** Live levels by block id (as a string), then meter key; dBu / dBFS or dB of gain reduction. */
export const Levels = z.record(z.string(), z.record(z.string(), z.number()));
export type Levels = z.infer<typeof Levels>;

export const DeviceInfo = z.object({
  ip: z.string(),
  /** e.g. `RPM 26z`. */
  model: z.string(),
  /** e.g. `2.5.3`. */
  firmware: z.string(),
  name: z.string(),
});
export type DeviceInfo = z.infer<typeof DeviceInfo>;

/**
 * - `offline`: no device (nothing loaded, or an `.r26` file is open)
 * - `connecting`: reading the setup and values from the device
 * - `online`: values are live
 * - `unreachable`: the device stopped answering; the core keeps the last
 *   known state and reconnects on its own
 */
export const ConnectionStatus = z.enum([
  "offline",
  "connecting",
  "online",
  "unreachable",
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;

export const Connection = z.object({
  status: ConnectionStatus,
  device: DeviceInfo.optional(),
  /** Why the last connection attempt failed, in words for the engineer. */
  error: z.string().optional(),
});
export type Connection = z.infer<typeof Connection>;

/**
 * A device that answered discovery. `reachable: false`: it is in another
 * subnet than this computer; connecting gives it a free address in this
 * computer's network first (plug-and-play).
 */
export const FoundDevice = z.object({
  ip: z.string(),
  mac: z.string(),
  reachable: z.boolean().optional(),
});
export type FoundDevice = z.infer<typeof FoundDevice>;

/** Everything a client needs to draw the app. Sent whole on connect and after a setup change. */
export const AppState = z.object({
  connection: Connection,
  devices: z.array(FoundDevice),
  setup: Setup.optional(),
  values: Values,
  /** Last recalled preset (1–24), if known. */
  currentPreset: z.number().optional(),
});
export type AppState = z.infer<typeof AppState>;
