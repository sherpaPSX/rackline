import { fail, ok, type Result } from './result.js';

/**
 * TFTP (RFC 1350, octet mode) as used for the whole-configuration transfer.
 * The device serves one file named `file` and replies from port 69 itself
 * (no new transfer port). See docs/protocol.md §3.
 *
 * Only reading is implemented: uploading a configuration changes the DSP
 * layout and is out of scope for phase 1.
 */
export const CONFIG_FILE_NAME = 'file';
export const TFTP_BLOCK_SIZE = 512;

export type TftpPacket =
  | { op: 'rrq' | 'wrq'; filename: string; mode: string }
  | { op: 'data'; block: number; data: Uint8Array }
  | { op: 'ack'; block: number }
  | { op: 'error'; code: number; message: string };

const OPCODES = { rrq: 1, wrq: 2, data: 3, ack: 4, error: 5 } as const;

/** Read request for the device's configuration. */
export function encodeReadRequest(filename = CONFIG_FILE_NAME): Uint8Array {
  return Uint8Array.from([0, OPCODES.rrq, ...ascii(filename), 0, ...ascii('octet'), 0]);
}

export function encodeAck(block: number): Uint8Array {
  return Uint8Array.from([0, OPCODES.ack, (block >> 8) & 0xff, block & 0xff]);
}

export function decodeTftpPacket(bytes: Uint8Array): Result<TftpPacket> {
  if (bytes.length < 4) return fail(`TFTP packet too short (${bytes.length} bytes)`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const op = view.getUint16(0);
  switch (op) {
    case OPCODES.rrq:
    case OPCODES.wrq: {
      const [filename, mode] = cStrings(bytes.subarray(2));
      if (filename === undefined || mode === undefined) return fail('malformed TFTP request');
      return ok({ op: op === OPCODES.rrq ? 'rrq' : 'wrq', filename, mode });
    }
    case OPCODES.data:
      if (bytes.length > 4 + TFTP_BLOCK_SIZE) return fail(`TFTP data block too long (${bytes.length} bytes)`);
      return ok({ op: 'data', block: view.getUint16(2), data: bytes.slice(4) });
    case OPCODES.ack:
      return ok({ op: 'ack', block: view.getUint16(2) });
    case OPCODES.error:
      return ok({ op: 'error', code: view.getUint16(2), message: cStrings(bytes.subarray(4))[0] ?? '' });
    default:
      return fail(`unknown TFTP opcode ${op}`);
  }
}

/** What the caller should do after feeding one packet into a download. */
export type DownloadStep =
  /** Send `ack` and wait for the next block. */
  | { type: 'continue'; ack: Uint8Array }
  /** Send `ack`; the file is complete. */
  | { type: 'done'; ack: Uint8Array; file: Uint8Array }
  /** Packet not part of this transfer; keep waiting. */
  | { type: 'ignore' }
  /** Transfer failed; stop. */
  | { type: 'error'; message: string };

/**
 * State of one TFTP read (download). Pure: the caller sends the RRQ, feeds
 * every received packet to `receive` and sends the returned ack. Timeouts and
 * retransmits live in `server`.
 */
export class TftpDownload {
  private readonly blocks: Uint8Array[] = [];
  private finished = false;

  receive(bytes: Uint8Array): DownloadStep {
    if (this.finished) return { type: 'ignore' };
    const decoded = decodeTftpPacket(bytes);
    if (!decoded.ok) return { type: 'ignore' };
    const packet = decoded.value;
    if (packet.op === 'error') {
      this.finished = true;
      return { type: 'error', message: `device error ${packet.code}: ${packet.message}` };
    }
    if (packet.op !== 'data') return { type: 'ignore' };

    const expected = this.blocks.length + 1;
    if (packet.block === expected - 1 && packet.block > 0) {
      // Our ack got lost and the device resent the previous block.
      return { type: 'continue', ack: encodeAck(packet.block) };
    }
    if (packet.block !== expected) return { type: 'ignore' };

    this.blocks.push(packet.data);
    const ack = encodeAck(packet.block);
    if (packet.data.length < TFTP_BLOCK_SIZE) {
      this.finished = true;
      return { type: 'done', ack, file: concat(this.blocks) };
    }
    return { type: 'continue', ack };
  }
}

function ascii(text: string): number[] {
  return Array.from(text, (c) => c.charCodeAt(0) & 0x7f);
}

function cStrings(bytes: Uint8Array): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      parts.push(String.fromCharCode(...bytes.subarray(start, i)));
      start = i + 1;
    }
  }
  return parts;
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
