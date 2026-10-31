import { latin1, latin1Bytes } from './bytes.js';
import { fail, ok, type Result } from './result.js';

/**
 * The configuration file (`file` over TFTP, also `RawScript` in `.r26`):
 * a 10-byte header, the block table with wiring, then the compiled DSP
 * program. Only the header and block table are decoded. See docs/protocol.md §3.
 */
export interface ConfigHeader {
  scriptRevision: number;
  /** 26 for RPM 26z. */
  platformId: number;
  hardwareRevision: number;
  /** Size of the whole file minus the first 8 bytes. */
  remainingSize: number;
  /**
   * Header bytes 8..9. Usually the block count + 5, but a config with an FBS,
   * Automix and two Matrix blocks compiled by Drag Net has 14 blocks and 20
   * here, so the meaning is unverified and the value is kept as is.
   */
  countField: number;
}

export interface ConfigBlock {
  /** Block instance ID used in parameter records. */
  id: number;
  /** Block type used in parameter records, e.g. 0x0105 analog input. */
  blockType: number;
  /** Position on the Drag Net canvas (grid units). */
  x: number;
  y: number;
  /** Category: 0x4c analog in, 0x2c digital in, 0x54 output, 0x04 processing (unverified meaning). */
  kind: number;
  /** Physical channel of an I/O block (1-based), 0 for processing blocks. */
  channel: number;
  name: string;
  /**
   * Wire numbers per input/output. 0x00xx = physical connector, 0x01xx =
   * internal link, 0 = unconnected. Equal numbers on an output and an input
   * form a connection.
   */
  inputs: number[];
  outputs: number[];
}

export interface BlockTable {
  header: ConfigHeader;
  blocks: ConfigBlock[];
  /** Name stored in the end-of-table record, e.g. `RPM 26z Configuration`. */
  configName: string;
  /** Raw extra bytes of the end-of-table record (layout partly unknown). */
  endRecordExtra: Uint8Array;
  /** Byte offset right after the end-of-table record (start of the DSP program part). */
  tableEnd: number;
}

const END_OF_TABLE_TYPE = 0xfd01;
const RECORD_MARKER = 0x0001;
/** x, y, reserved, kind, channel (2 bytes each) and the name length byte. */
const EXTRA_FIXED_SIZE = 11;
/** Bytes before the name in the end-of-table record's extra. */
const END_RECORD_NAME_OFFSET = 5;

class OutOfBounds extends Error {}

class Reader {
  private readonly view: DataView;
  offset = 0;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private need(n: number): void {
    if (this.offset + n > this.bytes.length) throw new OutOfBounds(`unexpected end of data at byte ${this.offset}`);
  }

  u8(): number {
    this.need(1);
    return this.view.getUint8(this.offset++);
  }

  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.offset);
    this.offset += 2;
    return v;
  }

  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.offset);
    this.offset += 4;
    return v;
  }

  /** A view into the input (not a copy). */
  take(n: number): Uint8Array {
    this.need(n);
    const out = this.bytes.subarray(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }
}

/** Parse the header and block table of a configuration file. */
export function parseBlockTable(bytes: Uint8Array): Result<BlockTable> {
  try {
    return parse(new Reader(bytes));
  } catch (e) {
    if (e instanceof OutOfBounds) return fail(e.message);
    throw e;
  }
}

function parse(r: Reader): Result<BlockTable> {
  const scriptRevision = r.u8();
  r.u8(); // unknown, 0 in all samples
  const header: ConfigHeader = {
    scriptRevision,
    platformId: r.u8(),
    hardwareRevision: r.u8(),
    remainingSize: r.u32(),
    countField: r.u16(),
  };

  const blocks: ConfigBlock[] = [];
  for (;;) {
    const start = r.offset;
    if (r.u8() !== 0) return fail(`bad record start at byte ${start}`);
    const id = r.u8();
    const blockType = r.u16();
    if (r.u16() !== RECORD_MARKER) return fail(`bad record marker at byte ${start}`);
    const extraSize = r.u16();

    if (blockType === END_OF_TABLE_TYPE) {
      const endRecordExtra = r.take(extraSize).slice();
      return ok({
        header,
        blocks,
        configName: latin1(endRecordExtra.subarray(END_RECORD_NAME_OFFSET)).replace(/\0+$/, ''),
        endRecordExtra,
        tableEnd: r.offset,
      });
    }

    const x = r.u16();
    const y = r.u16();
    r.u16(); // reserved, 0 in all samples
    const kind = r.u16();
    const channel = r.u16();
    const nameLength = r.u8();
    if (extraSize !== EXTRA_FIXED_SIZE + nameLength) {
      return fail(`block ${id}: extra size ${extraSize} does not match name length ${nameLength}`);
    }
    const name = latin1(r.take(nameLength));
    const inputCount = r.u16();
    const outputCount = r.u16();
    const inputs = Array.from({ length: inputCount }, () => r.u16());
    const outputs = Array.from({ length: outputCount }, () => r.u16());
    blocks.push({ id, blockType, x, y, kind, channel, name, inputs, outputs });
  }
}

/**
 * Inverse of `parseBlockTable`: header and block table up to `tableEnd`.
 * Writes `header.countField` unchanged; a caller that adds or removes blocks
 * must update it (blocks + 5 for files made by the editor's project format).
 */
export function serializeBlockTable(table: BlockTable): Uint8Array {
  const out: number[] = [];
  const u8 = (v: number): void => void out.push(v & 0xff);
  const u16 = (v: number): void => (u8(v >> 8), u8(v));

  u8(table.header.scriptRevision);
  u8(0);
  u8(table.header.platformId);
  u8(table.header.hardwareRevision);
  u16(table.header.remainingSize >>> 16);
  u16(table.header.remainingSize);
  u16(table.header.countField);

  for (const b of table.blocks) {
    u8(0);
    u8(b.id);
    u16(b.blockType);
    u16(RECORD_MARKER);
    u16(EXTRA_FIXED_SIZE + b.name.length);
    [b.x, b.y, 0, b.kind, b.channel].forEach(u16);
    u8(b.name.length);
    latin1Bytes(b.name).forEach(u8);
    u16(b.inputs.length);
    u16(b.outputs.length);
    [...b.inputs, ...b.outputs].forEach(u16);
  }

  u8(0);
  u8(0);
  u16(END_OF_TABLE_TYPE);
  u16(RECORD_MARKER);
  u16(table.endRecordExtra.length);
  table.endRecordExtra.forEach(u8);
  return Uint8Array.from(out);
}
