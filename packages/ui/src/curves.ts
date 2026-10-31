import type { ModuleInfo, ParamValue } from "@rackline/api";
import { qFromOctaves } from "@rackline/ui-kit";
import type { Filter, FilterFamily } from "@rackline/ui-kit";

/**
 * Turns PEQ and crossover parameters into generic filter shapes for the
 * ui-kit curve. The shapes are drawn from the option labels the core sends;
 * how the RPM realises each type is not verified, so curves are a guide.
 */

type Read = (key: string) => ParamValue | undefined;

const optionLabel = (
  module: ModuleInfo,
  key: string,
  value: ParamValue | undefined,
): string | undefined => {
  const p = module.params.find((q) => q.key === key);
  return p?.kind === "enum"
    ? p.options.find((o) => o.value === value)?.label
    : undefined;
};

/** Band numbers of a parametric EQ (1-based), or none if the module is not one. */
export function peqBands(module: ModuleInfo): number[] {
  return module.params.flatMap((p) => {
    const m = /^band(\d+)Freq$/.exec(p.key);
    return m ? [Number(m[1])] : [];
  });
}

/** Filter types that change level and so have a gain control. */
export const peqHasGain = (typeLabel: string | undefined): boolean =>
  typeLabel === "Band" ||
  typeLabel === "Low shelf" ||
  typeLabel === "High shelf" ||
  typeLabel === undefined;

export interface PeqBand {
  band: number;
  on: boolean;
  typeLabel: string | undefined;
  freq: number;
  gainDb: number;
  widthOct: number;
}

export function readPeqBand(
  module: ModuleInfo,
  read: Read,
  band: number,
): PeqBand {
  const num = (key: string, fallback: number) => {
    const v = read(`band${band}${key}`);
    return typeof v === "number" ? v : fallback;
  };
  return {
    band,
    on: read(`band${band}Enable`) !== false,
    typeLabel: optionLabel(module, `band${band}Type`, read(`band${band}Type`)),
    freq: num("Freq", 1000),
    gainDb: num("Gain", 0),
    widthOct: num("Width", 1),
  };
}

/** The magnitude shape of one band; undefined for all-pass and unknown types (flat). */
export function peqFilter(b: PeqBand): Filter | undefined {
  switch (b.typeLabel) {
    case undefined:
    case "Band":
      return {
        kind: "peak",
        freq: b.freq,
        gainDb: b.gainDb,
        q: qFromOctaves(b.widthOct),
      };
    case "Low shelf":
      return { kind: "lowShelf", freq: b.freq, gainDb: b.gainDb };
    case "High shelf":
      return { kind: "highShelf", freq: b.freq, gainDb: b.gainDb };
    case "Low cut":
      return {
        kind: "highPass",
        freq: b.freq,
        family: "butterworth",
        order: 2,
      };
    case "High cut":
      return { kind: "lowPass", freq: b.freq, family: "butterworth", order: 2 };
    default:
      return undefined;
  }
}

export const peqFilters = (bands: readonly PeqBand[]): Filter[] =>
  bands.filter((b) => b.on).flatMap((b) => peqFilter(b) ?? []);

/** "LR24" → Linkwitz-Riley 4th order; "1st order" → 1st order; "Off" → no filter. */
export function slopeOf(
  label: string | undefined,
): { family: FilterFamily; order: number } | undefined {
  if (label === "1st order") return { family: "butterworth", order: 1 };
  const m = /^(LR|BW|Bessel)(\d+)$/.exec(label ?? "");
  if (!m) return undefined;
  const family: FilterFamily =
    m[1] === "LR" ? "linkwitzRiley" : m[1] === "BW" ? "butterworth" : "bessel";
  return { family, order: Number(m[2]) / 6 };
}

/** One filter edge of a crossover band, e.g. the low band's upper edge (a low-pass). */
export interface CrossoverEdge {
  /** Parameter key prefix: `lowUpper`, `midLower` … */
  prefix: string;
  /** Short name: "Low LP". */
  name: string;
  kind: "lowPass" | "highPass";
}

const EDGES: CrossoverEdge[] = [
  { prefix: "highLower", name: "High HP", kind: "highPass" },
  { prefix: "midUpper", name: "Mid LP", kind: "lowPass" },
  { prefix: "midLower", name: "Mid HP", kind: "highPass" },
  { prefix: "lowUpper", name: "Low LP", kind: "lowPass" },
];

/** Edges the crossover module has, high band first. */
export const crossoverEdges = (module: ModuleInfo): CrossoverEdge[] =>
  EDGES.filter((e) => module.params.some((p) => p.key === `${e.prefix}Freq`));

export interface CrossoverBand {
  name: string;
  filters: Filter[];
}

/** The bands of one crossover block, high first, each with the filters of its edges. */
export function crossoverBands(
  module: ModuleInfo,
  read: Read,
): CrossoverBand[] {
  const edge = (prefix: string, kind: "lowPass" | "highPass"): Filter[] => {
    const slope = slopeOf(
      optionLabel(module, `${prefix}Type`, read(`${prefix}Type`)),
    );
    const freq = read(`${prefix}Freq`);
    return slope && typeof freq === "number" ? [{ kind, freq, ...slope }] : [];
  };
  const prefixes = new Set(crossoverEdges(module).map((e) => e.prefix));
  const bands: CrossoverBand[] = [
    { name: "High", filters: edge("highLower", "highPass") },
  ];
  if (prefixes.has("midLower"))
    bands.push({
      name: "Mid",
      filters: [
        ...edge("midLower", "highPass"),
        ...edge("midUpper", "lowPass"),
      ],
    });
  bands.push({ name: "Low", filters: edge("lowUpper", "lowPass") });
  return bands;
}
