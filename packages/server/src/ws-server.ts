import { API_VERSION, parseClientMessage, type ServerMessage } from '@rackline/api';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Core } from './core.js';

export interface WsServerOptions {
  /** 0 picks a free port. */
  port: number;
  /** Localhost only until the phone remote (docs/architecture.md). */
  host?: string;
}

export interface WsServer {
  /** The port actually bound. */
  readonly port: number;
  close(): Promise<void>;
}

/**
 * Serves `core` to WebSocket clients: `hello` and the whole state on
 * connect, every core broadcast to every client, a rejected intent back to
 * its sender only.
 */
export function startWsServer(core: Core, options: WsServerOptions): Promise<WsServer> {
  const wss = new WebSocketServer({ port: options.port, host: options.host ?? '127.0.0.1' });
  const send = (socket: WebSocket, message: ServerMessage): void => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };
  const unsubscribe = core.subscribe((message) => {
    for (const client of wss.clients) send(client, message);
  });

  wss.on('connection', (socket) => {
    send(socket, { type: 'hello', apiVersion: API_VERSION });
    send(socket, { type: 'state', state: core.state() });
    socket.on('message', (data, isBinary) => {
      const parsed = isBinary ? { ok: false as const, error: 'binary messages are not supported' } : parseClientMessage(data.toString());
      if (!parsed.ok) return send(socket, { type: 'error', message: parsed.error });
      void core.handle(parsed.value).then((error) => error === undefined || send(socket, { type: 'error', message: error }));
    });
  });

  return new Promise((resolve, reject) => {
    wss.once('error', reject);
    wss.once('listening', () => {
      wss.off('error', reject);
      // Later server errors must not crash the core; clients see the dropped connection.
      wss.on('error', (error) => console.error('WebSocket server error:', error));
      const address = wss.address();
      resolve({
        port: typeof address === 'object' && address !== null ? address.port : options.port,
        close: () => {
          unsubscribe();
          for (const client of wss.clients) client.terminate();
          return new Promise((done) => wss.close(() => done()));
        },
      });
    });
  });
}
