import { PORTS } from '@rackline/protocol';
import { Core } from './core.js';
import { openRpm, type RpmOptions } from './device.js';
import { discoverDevices } from './discovery.js';
import { openUdpSocket } from './udp.js';
import { startWsServer, type WsServer } from './ws-server.js';

/** Default WebSocket port of the core. */
export const DEFAULT_PORT = 5180;

export interface RacklineOptions {
  port?: number;
  host?: string;
  /** Where discovery broadcasts `RA` (default 255.255.255.255). */
  broadcastAddress?: string;
  rpm?: RpmOptions;
}

export interface Rackline {
  core: Core;
  server: WsServer;
  close(): Promise<void>;
}

/** The core on real sockets: what the desktop app (and later the phone page) talks to. */
export async function startRackline(options: RacklineOptions = {}): Promise<Rackline> {
  const core = new Core({
    openDevice: (ip) => openRpm(ip, options.rpm),
    discover: async () => {
      // Replies always go to UDP 5132, so discovery needs that port for its duration.
      const socket = await openUdpSocket({ port: PORTS.discoveryHost, broadcast: true });
      try {
        return await discoverDevices(socket, options.broadcastAddress === undefined ? {} : { broadcastAddress: options.broadcastAddress });
      } finally {
        await socket.close();
      }
    },
  });
  const server = await startWsServer(core, { port: options.port ?? DEFAULT_PORT, ...(options.host === undefined ? {} : { host: options.host }) });
  return {
    core,
    server,
    close: async () => {
      await server.close();
      await core.close();
    },
  };
}
