import { encodeReadRequest, fail, ok, PORTS, TftpDownload, type Result } from '@rackline/protocol';
import type { UdpSocket } from './udp.js';

export interface TftpOptions {
  /** How long to wait for each data block. */
  timeoutMs?: number;
  /** Resends of the last packet (request or ack) before giving up. */
  attempts?: number;
}

/**
 * Download the device's configuration file over TFTP (docs/protocol.md §3).
 * Use a socket of its own: replies come back to its local port.
 */
export function downloadConfig(socket: UdpSocket, ip: string, options: TftpOptions = {}): Promise<Result<Uint8Array>> {
  const timeoutMs = options.timeoutMs ?? 1000;
  const attempts = options.attempts ?? 5;
  const download = new TftpDownload();

  return new Promise((resolve) => {
    let last: { data: Uint8Array; port: number } = { data: encodeReadRequest(), port: PORTS.tftp };
    let misses = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: Result<Uint8Array>): void => {
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };
    const send = (): void => {
      clearTimeout(timer);
      timer = setTimeout(onTimeout, timeoutMs);
      socket.send(last.data, last.port, ip).catch(() => undefined);
    };
    const onTimeout = (): void => {
      misses++;
      if (misses >= attempts) finish(fail(`no TFTP reply from ${ip}`));
      else send();
    };

    const unsubscribe = socket.onPacket((packet) => {
      if (packet.address !== ip) return;
      const step = download.receive(packet.data);
      switch (step.type) {
        case 'ignore':
          return;
        case 'error':
          return finish(fail(step.message));
        case 'continue':
          misses = 0;
          last = { data: step.ack, port: packet.port };
          return send();
        case 'done':
          socket.send(step.ack, packet.port, ip).catch(() => undefined);
          return finish(ok(step.file));
      }
    });
    send();
  });
}
