import { describe, expect, it } from 'vitest';
import { fixture, hex } from './fixtures.js';
import { decodeTftpPacket, encodeAck, encodeReadRequest, TftpDownload } from '../src/tftp.js';

const config = fixture('rpm26z_01-config-table.bin');

function dataPacket(block: number, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + data.length);
  out.set([0, 3, block >> 8, block & 0xff]);
  out.set(data, 4);
  return out;
}

function blocksOf(file: Uint8Array): Uint8Array[] {
  const count = Math.floor(file.length / 512) + 1;
  return Array.from({ length: count }, (_, i) => dataPacket(i + 1, file.subarray(i * 512, (i + 1) * 512)));
}

describe('TFTP', () => {
  it('encodes the read request Drag Net sends (file "file", mode octet)', () => {
    expect(encodeReadRequest()).toEqual(hex('0001 66696c6500 6f6374657400'));
    expect(decodeTftpPacket(encodeReadRequest())).toEqual({
      ok: true,
      value: { op: 'rrq', filename: 'file', mode: 'octet' },
    });
  });

  it('downloads the captured config split into 512-byte blocks', () => {
    const download = new TftpDownload();
    const packets = blocksOf(config);
    expect(packets).toHaveLength(2);
    expect(download.receive(packets[0] ?? new Uint8Array())).toEqual({ type: 'continue', ack: encodeAck(1) });
    expect(download.receive(packets[1] ?? new Uint8Array())).toEqual({ type: 'done', ack: encodeAck(2), file: config });
  });

  it('ends a file whose size is a multiple of 512 with an empty block', () => {
    const file = config.subarray(0, 512);
    const download = new TftpDownload();
    const steps = blocksOf(file).map((p) => download.receive(p));
    expect(steps.map((s) => s.type)).toEqual(['continue', 'done']);
    expect(steps[1]).toMatchObject({ file });
  });

  it('re-acks a duplicated block and ignores out-of-order ones', () => {
    const [first, second] = blocksOf(config);
    const download = new TftpDownload();
    download.receive(first ?? new Uint8Array());
    expect(download.receive(first ?? new Uint8Array())).toEqual({ type: 'continue', ack: encodeAck(1) });
    expect(download.receive(dataPacket(3, new Uint8Array(10)))).toEqual({ type: 'ignore' });
    expect(download.receive(second ?? new Uint8Array())).toMatchObject({ type: 'done', file: config });
    expect(download.receive(second ?? new Uint8Array())).toEqual({ type: 'ignore' });
  });

  it('stops on a TFTP error from the device', () => {
    const error = hex('0005 0001 46696c65206e6f7420666f756e6400');
    expect(new TftpDownload().receive(error)).toEqual({ type: 'error', message: 'device error 1: File not found' });
  });
});
