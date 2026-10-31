import {
  decodeFrame,
  encodeFrame,
  fail,
  isReplyTo,
  MAX_RECORDS_PER_FRAME,
  ok,
  PORTS,
  sameAddress,
  SYSTEM,
  type Frame,
  type ParamRecord,
  type Result,
} from "@rackline/protocol";
import type { UdpSocket } from "./udp.js";

export interface ControlOptions {
  /** How long to wait for each reply. */
  timeoutMs?: number;
  /** Sends per frame before giving up (Drag Net also retries). */
  attempts?: number;
}

/**
 * System objects the core may write. Everything else under target 0x04
 * (network settings `fe03`, store, transfer start/end) changes the device
 * beyond tuning and is refused here, whatever the caller asks.
 */
const WRITABLE_SYSTEM = [SYSTEM.currentPreset];

const REJECTED = "device rejected the frame";

/** Whether a read or write failed because the device refused a record (wrong index or size), not because it did not answer. */
export const isRejection = (error: string): boolean =>
  error.startsWith(REJECTED);

/**
 * Parameter reads and writes to one device over UDP 5000 (docs/protocol.md
 * §2). One frame is in flight at a time; each waits `timeoutMs` for its reply
 * and is resent up to `attempts` times.
 */
export class ControlClient {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly timeoutMs: number;
  private readonly attempts: number;

  constructor(
    private readonly socket: UdpSocket,
    readonly ip: string,
    options: ControlOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 500;
    this.attempts = options.attempts ?? 3;
  }

  /** Read the values of `records` (their `value` is ignored). Returns the records with values filled in. */
  read(records: readonly ParamRecord[]): Promise<Result<ParamRecord[]>> {
    return this.transfer("read", records);
  }

  /** Write `records`. Resolves once the device confirmed every frame. */
  write(records: readonly ParamRecord[]): Promise<Result<ParamRecord[]>> {
    const forbidden = records.find(
      (r) =>
        r.target === "system" &&
        !WRITABLE_SYSTEM.some((a) => sameAddress(a, r)),
    );
    if (forbidden !== undefined) {
      const hex = forbidden.objectType.toString(16).padStart(4, "0");
      return Promise.resolve(
        fail(`refusing to write system object ${hex} index ${forbidden.index}`),
      );
    }
    return this.transfer("write", records);
  }

  private async transfer(
    kind: "read" | "write",
    records: readonly ParamRecord[],
  ): Promise<Result<ParamRecord[]>> {
    const replies: ParamRecord[] = [];
    for (let i = 0; i < records.length; i += MAX_RECORDS_PER_FRAME) {
      const reply = await this.enqueue({
        kind,
        status: 0,
        records: records.slice(i, i + MAX_RECORDS_PER_FRAME),
      });
      if (!reply.ok) return reply;
      replies.push(...reply.value.records);
    }
    return ok(replies);
  }

  /** Frames go out one after another, also across concurrent callers. */
  private enqueue(frame: Frame): Promise<Result<Frame>> {
    const run = this.queue.then(() => this.exchange(frame));
    // A throwing frame (programmer error) must not block the frames after it.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async exchange(request: Frame): Promise<Result<Frame>> {
    const bytes = encodeFrame(request);
    for (let attempt = 0; attempt < this.attempts; attempt++) {
      const reply = await this.sendAndWait(bytes, request);
      if (reply === undefined) continue;
      if (reply.status !== 0)
        return fail(`${REJECTED} (status ${reply.status})`);
      return ok(reply);
    }
    return fail(`no reply from ${this.ip}`);
  }

  private sendAndWait(
    bytes: Uint8Array,
    request: Frame,
  ): Promise<Frame | undefined> {
    return new Promise((resolve) => {
      const finish = (frame: Frame | undefined): void => {
        clearTimeout(timer);
        unsubscribe();
        resolve(frame);
      };
      const timer = setTimeout(() => finish(undefined), this.timeoutMs);
      const unsubscribe = this.socket.onPacket((packet) => {
        if (packet.address !== this.ip) return;
        const frame = decodeFrame(packet.data);
        if (frame.ok && isReplyTo(request, frame.value)) finish(frame.value);
      });
      this.socket
        .send(bytes, PORTS.control, this.ip)
        .catch(() => finish(undefined));
    });
  }
}
