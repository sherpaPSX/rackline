import { level } from "./params.js";
import type { ModuleDef } from "./types.js";

export const levelModule: ModuleDef = {
  blockType: 0x0180,
  name: "Level",
  role: "processing",
  evidence: "simulator",
  params: [
    level(2, "level", "Level"),
    {
      index: 3,
      key: "options",
      label: "Mute / off at minimum",
      size: 1,
      kind: "flags",
      bits: { mute: 0, offAtMin: 1 },
    },
    level(5, "min", "Minimum"),
    level(6, "max", "Maximum"),
  ],
  compact: ["level", "options"],
  dspPercent: 1,
};
