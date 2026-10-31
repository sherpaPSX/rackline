import { fail, ok, type Result } from "@rackline/protocol";
import { findModule, type ParamDef } from "./registry/index.js";
import { fromRaw, toRaw } from "./units.js";

/**
 * A parameter in engineering terms: a number in the parameter's unit (dB,
 * Hz, ms, octaves, ratio), an enum code, a boolean, or named flag bits.
 */
export type ParamValue = number | boolean | Readonly<Record<string, boolean>>;

export function decodeParam(param: ParamDef, raw: number): ParamValue {
  switch (param.kind) {
    case "number":
      return fromRaw(param.conversion, raw);
    case "steps":
      return param.steps[Math.min(raw, param.steps.length - 1)] ?? 0;
    case "enum":
      return raw;
    case "bool":
      return raw !== 0;
    case "flags":
      return Object.fromEntries(
        Object.entries(param.bits).map(([name, bit]) => [
          name,
          ((raw >> bit) & 1) === 1,
        ]),
      );
  }
}

/** Raw record value for `value`; numbers are rounded to the nearest step and clamped to the raw range. */
export function encodeParam(
  param: ParamDef,
  value: ParamValue,
): Result<number> {
  switch (param.kind) {
    case "number":
      return typeof value === "number"
        ? ok(toRaw(param.conversion, value))
        : wrongType(param);
    case "steps":
      return typeof value === "number"
        ? ok(nearestIndex(param.steps, value))
        : wrongType(param);
    case "enum":
      return typeof value === "number" && value in param.options
        ? ok(value)
        : fail(`${param.key}: unknown option ${String(value)}`);
    case "bool":
      return typeof value === "boolean" ? ok(value ? 1 : 0) : wrongType(param);
    case "flags": {
      if (typeof value !== "object") return wrongType(param);
      let raw = 0;
      for (const [name, bit] of Object.entries(param.bits))
        if (value[name] === true) raw |= 1 << bit;
      return ok(raw);
    }
  }
}

const wrongType = (param: ParamDef): Result<never> =>
  fail(`${param.key}: wrong value type for a ${param.kind} parameter`);

function nearestIndex(values: readonly number[], value: number): number {
  const exact = values.indexOf(value);
  if (exact !== -1) return exact;
  let best = 0;
  values.forEach((v, i) => {
    if (Math.abs(v - value) < Math.abs((values[best] ?? 0) - value)) best = i;
  });
  return best;
}

/**
 * Decode the known parameters of one block from raw records (as read from
 * the device or an `.r26` preset). Unknown indexes, such as the preset tag at
 * index 0, are skipped. Returns undefined for unknown block types.
 */
export function decodeBlockValues(
  blockType: number,
  records: readonly { index: number; value: number }[],
): Record<string, ParamValue> | undefined {
  const module = findModule(blockType);
  if (module === undefined) return undefined;
  const values: Record<string, ParamValue> = {};
  for (const record of records) {
    const param = module.params.find((p) => p.index === record.index);
    if (param !== undefined)
      values[param.key] = decodeParam(param, record.value);
  }
  return values;
}
