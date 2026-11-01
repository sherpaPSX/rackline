import { parseArgs } from 'node:util';
import { DEFAULT_PORT, startRackline } from './start.js';

/**
 * Development entry: `pnpm --filter @rackline/server start [--port 5180]
 * [--connect 192.168.69.22] [--broadcast 127.0.0.1]`. The desktop app starts
 * the core through `startRackline` instead.
 */
const { values } = parseArgs({
  options: {
    port: { type: 'string', default: String(DEFAULT_PORT) },
    connect: { type: 'string' },
    broadcast: { type: 'string' },
  },
});

const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid --port ${values.port}`);

const rackline = await startRackline({
  port,
  ...(values.broadcast === undefined ? {} : { broadcastAddress: values.broadcast }),
});
console.log(`Rackline core on ws://127.0.0.1:${rackline.server.port}`);
rackline.core.subscribe((m) => {
  if (m.type === 'connection') console.log('connection:', m.connection.status, m.connection.error ?? '');
});
if (values.connect !== undefined) {
  await rackline.core.handle({ type: 'connect', ip: values.connect });
  const { connection, setup } = rackline.core.state();
  console.log('connection:', connection.status, connection.error ?? '', setup === undefined ? '' : `${setup.racks.length} racks`);
}
process.on('SIGINT', () => void rackline.close().finally(() => process.exit(0)));
