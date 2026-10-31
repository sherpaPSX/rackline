import type { LinkedModule } from "./linked.js";

/** "In 1" → "1", "Out 5" → "5". */
const short = (name: string) => name.replace(/^(In|Out) /, "");

/**
 * Amber "1 ≠ 2" on a linked stereo module whose channels hold different
 * values: an edit sets both. Unlinking the rack edits them one by one.
 */
export function ChannelsBadge({ linked }: { linked: LinkedModule }) {
  if (!linked.stereo || !linked.differ) return null;
  const [a = "L", b = "R"] = linked.names;
  return (
    <span
      className="app-differ"
      title={`${a} and ${b} differ: an edit sets both. Unlink the rack to edit them one by one.`}
    >
      {short(a)} ≠ {short(b)}
    </span>
  );
}
