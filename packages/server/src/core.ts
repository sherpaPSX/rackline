import type { AppState, ClientMessage, Connection, DeviceInfo, FoundDevice, ParamValue, ServerMessage, Setup, Values } from '@rackline/api';
import {
  decodeDeviceInfo,
  deviceInfoReadRecords,
  fail,
  ok,
  parseBlockTable,
  parseR26,
  readRecord,
  SYSTEM,
  type BlockTable,
  type R26Preset,
  type Result,
} from '@rackline/protocol';
import type { Device } from './device.js';
import { applyRecords, decodeLevels, findParam, fromApiValue, meterReadRecords, paramRecord, toApiValue, toSetup, valueReadRecords } from './setup.js';
import { Throttle } from './throttle.js';

export interface CoreOptions {
  openDevice(ip: string): Promise<Device>;
  discover(): Promise<FoundDevice[]>;
  /**
   * Plug-and-play: give a discovered device outside this computer's networks
   * an address it can reach, and return the device as it is now. Called only
   * when the user connects to that device.
   */
  moveIntoNetwork?(device: FoundDevice): Promise<Result<FoundDevice>>;
  /** Minimum time between two writes of the same parameter (default 30 ms). */
  throttleMs?: number;
  /** Liveness check while connected and reconnect attempts while unreachable (default 2 s). */
  pollMs?: number;
  /** Pause between two meter reads while online (default 100 ms). */
  meterMs?: number;
}

interface Loaded {
  table: BlockTable;
  setup: Setup;
  /** Presets of an `.r26` opened without a device. */
  presets: R26Preset[];
}

const PRESET = readRecord(SYSTEM.currentPreset, 1);

/**
 * The single source of truth for device state (docs/architecture.md). Clients
 * send intents through `handle`; every resulting change goes to all
 * subscribers. Only parameter values and preset recalls are written: the core
 * never changes the DSP layout, and changes the device's address only when the
 * user connects to a device outside this computer's networks (plug-and-play).
 */
export class Core {
  private connection: Connection = { status: 'offline' };
  private devices: FoundDevice[] = [];
  private loaded: Loaded | undefined;
  private values: Values = {};
  private currentPreset: number | undefined;
  private device: Device | undefined;
  private poll: ReturnType<typeof setTimeout> | undefined;
  private meterTimer: ReturnType<typeof setTimeout> | undefined;
  /** Bumped whenever the device is dropped, so a connect still opening can tell it was overtaken. */
  private generation = 0;
  private readonly throttle: Throttle;
  private readonly pollMs: number;
  private readonly meterMs: number;
  private readonly listeners = new Set<(message: ServerMessage) => void>();

  constructor(private readonly options: CoreOptions) {
    this.throttle = new Throttle(options.throttleMs ?? 30);
    this.pollMs = options.pollMs ?? 2000;
    this.meterMs = options.meterMs ?? 100;
  }

  /** `listener` gets every broadcast message until the returned function is called. */
  subscribe(listener: (message: ServerMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  state(): AppState {
    return {
      connection: this.connection,
      devices: this.devices,
      ...(this.loaded === undefined ? {} : { setup: this.loaded.setup }),
      values: this.values,
      ...(this.currentPreset === undefined ? {} : { currentPreset: this.currentPreset }),
    };
  }

  /**
   * Apply one client intent. Never throws. Returns why the intent was
   * rejected, for the sender only; everything else is broadcast.
   */
  async handle(message: ClientMessage): Promise<string | undefined> {
    try {
      switch (message.type) {
        case 'setParam':
          return this.setParam(message.blockId, message.key, message.value);
        case 'recallPreset':
          return await this.recallPreset(message.preset);
        case 'discover':
          this.devices = await this.options.discover();
          this.emit({ type: 'devices', devices: this.devices });
          return undefined;
        case 'connect':
          await this.connect(message.ip);
          return undefined;
        case 'disconnect':
          await this.dropDevice();
          this.unload();
          this.emitState();
          return undefined;
        case 'openProject':
          return await this.openProject(message.fileName, message.text);
      }
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }

  async close(): Promise<void> {
    await this.dropDevice();
    this.listeners.clear();
  }

  private setParam(blockId: number, key: string, value: ParamValue): string | undefined {
    if (this.loaded === undefined) return 'no setup loaded';
    const target = findParam(this.loaded.table, blockId, key);
    if (!target.ok) return target.error;
    const raw = fromApiValue(target.value.param, value);
    if (!raw.ok) return raw.error;

    // The value as the device will hold it (rounded to its step, clamped to its range).
    const stored = toApiValue(target.value.param, raw.value);
    (this.values[String(blockId)] ??= {})[key] = stored;
    this.emit({ type: 'param', blockId, key, value: stored });

    const device = this.device;
    this.throttle.run(`${blockId}:${key}`, () => {
      void device?.write([paramRecord(target.value, raw.value)]).then((r) => r.ok || this.lost(device, r.error));
    });
    return undefined;
  }

  private async recallPreset(preset: number): Promise<string | undefined> {
    const loaded = this.loaded;
    if (loaded === undefined) return 'no setup loaded';
    const device = this.device;
    if (device === undefined) {
      const stored = loaded.presets.find((p) => p.number === preset);
      if (stored === undefined) return `preset ${preset} is empty in this file`;
      applyRecords(loaded.table, this.values, stored.params);
      this.currentPreset = preset;
      this.emitState();
      return undefined;
    }
    const written = await device.write([{ ...PRESET, value: preset }]);
    // Recalling changes many values at once: read them all back.
    const values = written.ok ? await readValues(device, loaded.table) : written;
    if (device !== this.device) return undefined;
    if (!values.ok) {
      this.lost(device, values.error);
      return `cannot recall preset ${preset}: ${values.error}`;
    }
    this.values = values.value.values;
    this.currentPreset = values.value.preset;
    this.emitState();
    return undefined;
  }

  private async connect(ip: string): Promise<void> {
    await this.dropDevice();
    this.unload();
    this.connection = { status: 'connecting' };
    this.emitState();
    const generation = this.generation;
    const found = this.devices.find((d) => d.ip === ip);
    if (found?.reachable === false && this.options.moveIntoNetwork !== undefined) {
      const moved = await this.options.moveIntoNetwork(found);
      if (generation !== this.generation) return;
      if (!moved.ok) {
        this.connection = { status: 'offline', error: `cannot bring the device into this computer's network: ${moved.error}` };
        return this.emit({ type: 'connection', connection: this.connection });
      }
      this.devices = this.devices.map((d) => (d.mac === found.mac ? moved.value : d));
      this.emit({ type: 'devices', devices: this.devices });
      ip = moved.value.ip;
    }
    let device: Device;
    try {
      device = await this.options.openDevice(ip);
    } catch (e) {
      this.connection = { status: 'offline', error: `cannot open the network: ${e instanceof Error ? e.message : String(e)}` };
      return this.emit({ type: 'connection', connection: this.connection });
    }
    if (generation !== this.generation) return device.close(); // a later connect or disconnect won
    this.device = device;
    const loaded = await loadDevice(device);
    if (device !== this.device) return; // replaced by a later connect or disconnect
    if (!loaded.ok) {
      await this.dropDevice();
      this.connection = { status: 'offline', error: loaded.error };
      return this.emit({ type: 'connection', connection: this.connection });
    }
    this.useDevice(loaded.value);
    this.emitState();
    this.schedulePoll(device);
    this.scheduleMeters(device);
  }

  private useDevice(loaded: DeviceSnapshot): void {
    this.loaded = { table: loaded.table, setup: toSetup(loaded.table, { kind: 'device', ip: loaded.info.ip }), presets: [] };
    this.values = loaded.values;
    this.currentPreset = loaded.preset;
    this.connection = { status: 'online', device: loaded.info };
  }

  private async openProject(fileName: string, text: string): Promise<string | undefined> {
    const project = parseR26(text);
    if (!project.ok) return `cannot open ${fileName}: ${project.error}`;
    await this.dropDevice();
    const { blockTable: table, presets } = project.value;
    this.loaded = { table, setup: toSetup(table, { kind: 'file', fileName }), presets };
    this.values = {};
    // Preset 0 holds the values Drag Net saved with the project (meaning vs. the device's working state: unverified).
    applyRecords(table, this.values, presets.find((p) => p.number === 0)?.params ?? []);
    this.currentPreset = undefined;
    this.connection = { status: 'offline' };
    this.emitState();
    return undefined;
  }

  /**
   * While connected, read the current preset every `pollMs`: a missing reply
   * marks the device unreachable (state is kept), the first reply after that
   * reloads everything, and a preset recalled elsewhere re-reads the values.
   */
  private schedulePoll(device: Device): void {
    clearTimeout(this.poll);
    this.poll = setTimeout(() => void this.check(device), this.pollMs);
  }

  private async check(device: Device): Promise<void> {
    const reply = await device.read([PRESET]);
    if (device !== this.device) return;
    if (!reply.ok) {
      this.lost(device, reply.error);
      return this.schedulePoll(device);
    }
    const preset = reply.value[0]?.value;
    if (this.connection.status === 'unreachable') {
      // The setup may have been replaced meanwhile (e.g. by Drag Net): load it again.
      const loaded = await loadDevice(device);
      if (device !== this.device) return;
      if (loaded.ok) {
        this.useDevice(loaded.value);
        this.emitState();
      }
    } else if (preset !== this.currentPreset && this.loaded !== undefined) {
      const values = await readValues(device, this.loaded.table);
      if (device !== this.device) return;
      if (values.ok) {
        this.values = values.value.values;
        this.currentPreset = values.value.preset;
        this.emitState();
      } else {
        this.lost(device, values.error);
      }
    }
    this.schedulePoll(device);
  }

  /**
   * While online, read every meter, broadcast the levels, wait `meterMs`,
   * repeat. Reads only; a failed read is skipped (the liveness poll decides
   * whether the device is gone).
   */
  private scheduleMeters(device: Device): void {
    clearTimeout(this.meterTimer);
    this.meterTimer = setTimeout(() => void this.readMeters(device), this.meterMs);
  }

  private async readMeters(device: Device): Promise<void> {
    const table = this.loaded?.table;
    const records = table === undefined ? [] : meterReadRecords(table);
    if (table !== undefined && records.length > 0 && this.connection.status === 'online') {
      const reply = await device.read(records);
      if (device !== this.device) return;
      if (reply.ok && this.loaded?.table === table) this.emit({ type: 'meters', levels: decodeLevels(table, reply.value) });
    }
    this.scheduleMeters(device);
  }

  /** The device stopped answering: keep the state, say so, keep polling. */
  private lost(device: Device, error: string): void {
    if (device !== this.device || this.connection.status === 'unreachable') return;
    this.connection = { ...this.connection, status: 'unreachable', error };
    this.emit({ type: 'connection', connection: this.connection });
  }

  private async dropDevice(): Promise<void> {
    this.generation++;
    clearTimeout(this.poll);
    clearTimeout(this.meterTimer);
    const device = this.device;
    this.device = undefined;
    await device?.close();
  }

  private unload(): void {
    this.loaded = undefined;
    this.values = {};
    this.currentPreset = undefined;
    this.connection = { status: 'offline' };
  }

  private emitState(): void {
    this.emit({ type: 'state', state: this.state() });
  }

  private emit(message: ServerMessage): void {
    for (const listener of this.listeners) listener(message);
  }
}

interface DeviceSnapshot {
  info: DeviceInfo;
  table: BlockTable;
  values: Values;
  preset: number | undefined;
}

/** Everything the core needs from a device: who it is, its setup and every value. */
async function loadDevice(device: Device): Promise<Result<DeviceSnapshot>> {
  const info = await device.read(deviceInfoReadRecords());
  if (!info.ok) return info;
  const config = await device.readConfig();
  if (!config.ok) return fail(`cannot read the setup: ${config.error}`);
  const table = parseBlockTable(config.value);
  if (!table.ok) return fail(`cannot read the setup: ${table.error}`);
  const values = await readValues(device, table.value);
  if (!values.ok) return values;
  return ok({ info: { ip: device.ip, ...decodeDeviceInfo(info.value) }, table: table.value, ...values.value });
}

async function readValues(device: Device, table: BlockTable): Promise<Result<{ values: Values; preset: number | undefined }>> {
  const records = await device.read([PRESET, ...valueReadRecords(table)]);
  if (!records.ok) return records;
  const [preset, ...params] = records.value;
  const values: Values = {};
  applyRecords(table, values, params);
  return ok({ values, preset: preset?.value });
}
