import type { MeterInfo } from "@rackline/api";
import { Meter } from "@rackline/ui-kit";
import { useCoreClient } from "../app/core-context.js";

/** Gain reduction meters run from 0 down to this many dB. */
const REDUCTION_RANGE_DB = 24;

/**
 * Reads one meter of one block from the core client. Levels become dB below
 * full scale, so every level meter clips at its top; no reading = empty.
 */
export function useLevelReader(
  meter: MeterInfo,
  blockId: number,
): () => number {
  const client = useCoreClient();
  return () => {
    const level = client.level(blockId, meter.key);
    if (level === undefined) return meter.reduction ? 0 : -Infinity;
    return meter.reduction ? level : level - meter.fullScale;
  };
}

function ChannelMeter({
  meter,
  blockId,
  horizontal,
}: {
  meter: MeterInfo;
  blockId: number;
  horizontal?: boolean | undefined;
}) {
  const read = useLevelReader(meter, blockId);
  return meter.reduction ? (
    <Meter
      readLevel={read}
      reduction
      floorDb={-REDUCTION_RANGE_DB}
      horizontal={horizontal ?? false}
    />
  ) : (
    <Meter readLevel={read} horizontal={horizontal ?? false} />
  );
}

/** One meter per channel (a linked stereo pair shows both), side by side. */
export function LiveMeters({
  meter,
  blockIds,
  horizontal,
}: {
  meter: MeterInfo;
  blockIds: readonly number[];
  horizontal?: boolean;
}) {
  return (
    <span className="app-meters" data-horizontal={horizontal || undefined}>
      {blockIds.map((id) => (
        <ChannelMeter
          key={id}
          meter={meter}
          blockId={id}
          horizontal={horizontal}
        />
      ))}
    </span>
  );
}

/** A labelled card cell with a module's meter, e.g. a limiter's gain reduction. */
export function MeterCell({
  meter,
  blockIds,
}: {
  meter: MeterInfo;
  blockIds: readonly number[];
}) {
  return (
    <div
      className="rl-cell app-meter-cell"
      role="group"
      aria-label={meter.label}
    >
      <LiveMeters meter={meter} blockIds={blockIds} />
      <span className="rl-label">{meter.reduction ? "GR" : meter.label}</span>
    </div>
  );
}
