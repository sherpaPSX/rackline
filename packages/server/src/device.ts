import type { ParamRecord, Result } from '@rackline/protocol';
import { ControlClient, type ControlOptions } from './control.js';
import { downloadConfig, type TftpOptions } from './tftp.js';
import { openUdpSocket } from './udp.js';

/** One RPM as the core sees it. Tests replace it with an in-memory device. */
export interface Device {
  readonly ip: string;
  read(records: readonly ParamRecord[]): Promise<Result<ParamRecord[]>>;
  /** Refuses system objects other than the preset recall (see `ControlClient`). */
  write(records: readonly ParamRecord[]): Promise<Result<ParamRecord[]>>;
  /** The configuration file over TFTP (header, block table, DSP program). */
  readConfig(): Promise<Result<Uint8Array>>;
  close(): Promise<void>;
}

export interface RpmOptions {
  control?: ControlOptions;
  tftp?: TftpOptions;
}

/** A real (or simulated) RPM on the network. */
export async function openRpm(ip: string, options: RpmOptions = {}): Promise<Device> {
  const socket = await openUdpSocket();
  const control = new ControlClient(socket, ip, options.control);
  return {
    ip,
    read: (records) => control.read(records),
    write: (records) => control.write(records),
    readConfig: async () => {
      // TFTP replies come to the requesting port, so each download gets its own socket.
      const tftp = await openUdpSocket();
      try {
        return await downloadConfig(tftp, ip, options.tftp);
      } finally {
        await tftp.close();
      }
    },
    close: () => socket.close(),
  };
}
