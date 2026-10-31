import { API_VERSION, parseServerMessage } from "@rackline/api";
import type {
  AppState,
  ClientMessage,
  Levels,
  ParamInfo,
  ParamValue,
  ServerMessage,
} from "@rackline/api";
import { quantize, sameValue } from "./params.js";
import { UndoHistory } from "./undo.js";
import type { ParamChange } from "./undo.js";

/** The UI's own link to the core (not the core's link to the device). */
export type CoreLink = "connecting" | "open" | "closed";

export interface ClientSnapshot {
  link: CoreLink;
  /** Undefined until the first `state` arrives. */
  app: AppState | undefined;
  /** Rejected intents and failures, newest last, for the engineer to read and dismiss. */
  errors: readonly { id: number; message: string }[];
  canUndo: boolean;
  canRedo: boolean;
}

export interface SocketHandlers {
  open(): void;
  message(text: string): void;
  close(): void;
}

export interface CoreSocket {
  send(text: string): void;
  close(): void;
}

export type OpenSocket = (url: string, handlers: SocketHandlers) => CoreSocket;

export interface CoreClientOptions {
  url: string;
  openSocket: OpenSocket;
  now?: () => number;
  /** Schedules a reconnect; returns a cancel function. */
  later?: (run: () => void, ms: number) => () => void;
}

export interface ParamEdit {
  blockId: number;
  key: string;
  value: ParamValue;
}

const RECONNECT_MS = 1000;
/** Levels older than this are not shown (the core stopped sending them). */
const LEVELS_STALE_MS = 1000;
const MAX_ERRORS = 3;

const defaultLater = (run: () => void, ms: number) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

/**
 * Keeps the app state in sync with the core over the WebSocket API.
 *
 * Edits show at once (optimistic) and go to the core as intents. The core
 * echoes every value it stored; echoes of values this client sent are
 * dropped while newer local values exist, so a dragged fader never jumps
 * back. Any other broadcast (another window, the device, clamping) wins.
 */
export class CoreClient {
  private snapshot: ClientSnapshot = {
    link: "connecting",
    app: undefined,
    errors: [],
    canUndo: false,
    canRedo: false,
  };
  private readonly listeners = new Set<() => void>();
  private readonly history = new UndoHistory();
  /** Values sent per `blockId:key` and not echoed yet, oldest first. */
  private readonly inFlight = new Map<string, ParamValue[]>();
  private socket: CoreSocket | undefined;
  private cancelReconnect: (() => void) | undefined;
  private nextErrorId = 1;
  /** Latest live levels; kept out of the snapshot so meters do not re-render React. */
  private levels: Levels = {};
  private levelsAt = -Infinity;
  private closed = false;
  private readonly now: () => number;
  private readonly later: NonNullable<CoreClientOptions["later"]>;

  constructor(private readonly options: CoreClientOptions) {
    this.now = options.now ?? Date.now;
    this.later = options.later ?? defaultLater;
    this.open();
  }

  /** For `useSyncExternalStore`: a new object after every change. */
  getSnapshot = (): ClientSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Description of a block's parameter, from the module of its block type. */
  paramInfo(blockId: number, key: string): ParamInfo | undefined {
    const setup = this.snapshot.app?.setup;
    const block = setup?.blocks.find((b) => b.id === blockId);
    return setup?.modules
      .find((m) => m.blockType === block?.blockType)
      ?.params.find((p) => p.key === key);
  }

  /**
   * Set parameters, e.g. both channels of a linked stereo module. Values are
   * rounded like the core will store them; the edit is one undo step.
   */
  setParams(edits: readonly ParamEdit[]): void {
    this.apply(edits, true);
  }

  setParam(blockId: number, key: string, value: ParamValue): void {
    this.apply([{ blockId, key, value }], true);
  }

  /**
   * Latest level of a block's meter (dBu / dBFS, or dB of gain reduction),
   * undefined without a fresh reading. Meters call this every animation frame.
   */
  level(blockId: number, key: string): number | undefined {
    if (this.now() - this.levelsAt > LEVELS_STALE_MS) return undefined;
    return this.levels[String(blockId)]?.[key];
  }

  undo(): void {
    const edits = this.history.undo();
    if (edits) this.apply(edits, false);
  }

  redo(): void {
    const edits = this.history.redo();
    if (edits) this.apply(edits, false);
  }

  /** Send an intent that is not a parameter change (connect, recall preset …). */
  send(message: Exclude<ClientMessage, { type: "setParam" }>): void {
    this.transmit(message);
  }

  dismissError(id: number): void {
    this.update({ errors: this.snapshot.errors.filter((e) => e.id !== id) });
  }

  close(): void {
    this.closed = true;
    this.cancelReconnect?.();
    this.socket?.close();
  }

  private apply(edits: readonly ParamEdit[], record: boolean): void {
    const app = this.snapshot.app;
    if (!app) return;
    const changes: ParamChange[] = [];
    let values = app.values;
    for (const edit of edits) {
      const info = this.paramInfo(edit.blockId, edit.key);
      if (!info) continue;
      const value = quantize(info, edit.value);
      const id = String(edit.blockId);
      const before = values[id]?.[edit.key];
      if (before !== undefined && sameValue(info, before, value)) continue;
      if (before !== undefined)
        changes.push({
          blockId: edit.blockId,
          key: edit.key,
          before,
          after: value,
        });
      values = { ...values, [id]: { ...values[id], [edit.key]: value } };
      const target = `${id}:${edit.key}`;
      this.inFlight.set(target, [...(this.inFlight.get(target) ?? []), value]);
      this.transmit({
        type: "setParam",
        blockId: edit.blockId,
        key: edit.key,
        value,
      });
    }
    if (values === app.values) return;
    if (record) this.history.record(changes, this.now());
    this.update({ app: { ...app, values } });
  }

  private transmit(message: ClientMessage): void {
    if (this.snapshot.link !== "open" || !this.socket) {
      this.pushError("Not connected to the Rackline core.");
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  private open(): void {
    this.update({ link: "connecting" });
    this.socket = this.options.openSocket(this.options.url, {
      open: () => this.update({ link: "open" }),
      message: (text) => this.receive(text),
      close: () => {
        this.socket = undefined;
        this.inFlight.clear();
        this.update({ link: "closed" });
        if (!this.closed)
          this.cancelReconnect = this.later(() => this.open(), RECONNECT_MS);
      },
    });
  }

  private receive(text: string): void {
    const parsed = parseServerMessage(text);
    if (!parsed.ok)
      return this.pushError(
        `Unreadable message from the core: ${parsed.error}`,
      );
    this.handle(parsed.value);
  }

  private handle(message: ServerMessage): void {
    const app = this.snapshot.app;
    switch (message.type) {
      case "hello":
        if (message.apiVersion !== API_VERSION) {
          this.pushError(
            `This window speaks API ${API_VERSION}, the core ${message.apiVersion}. Reload the window.`,
          );
        }
        return;
      case "state":
        // A new setup or a preset recall: earlier steps may no longer apply.
        this.history.clear();
        this.inFlight.clear();
        this.levels = {};
        return this.update({ app: message.state });
      case "param":
        return this.receiveParam(message.blockId, message.key, message.value);
      case "connection":
        return (
          app &&
          this.update({ app: { ...app, connection: message.connection } })
        );
      case "meters":
        this.levels = message.levels;
        this.levelsAt = this.now();
        return;
      case "devices":
        return (
          app && this.update({ app: { ...app, devices: message.devices } })
        );
      case "error":
        this.inFlight.clear();
        return this.pushError(message.message);
    }
  }

  private receiveParam(blockId: number, key: string, value: ParamValue): void {
    const app = this.snapshot.app;
    if (!app) return;
    const target = `${blockId}:${key}`;
    const sent = this.inFlight.get(target);
    if (sent) {
      const info = this.paramInfo(blockId, key);
      const index = sent.findIndex((v) => sameValue(info, v, value));
      if (index >= 0) {
        const rest = sent.slice(index + 1);
        if (rest.length > 0) {
          // A newer local value is still on its way; keep showing it.
          this.inFlight.set(target, rest);
          return;
        }
        this.inFlight.delete(target);
      } else {
        this.inFlight.delete(target);
      }
    }
    const id = String(blockId);
    this.update({
      app: {
        ...app,
        values: { ...app.values, [id]: { ...app.values[id], [key]: value } },
      },
    });
  }

  private pushError(message: string): void {
    const errors = [
      ...this.snapshot.errors,
      { id: this.nextErrorId++, message },
    ].slice(-MAX_ERRORS);
    this.update({ errors });
  }

  private update(patch: Partial<ClientSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    };
    for (const listener of this.listeners) listener();
  }
}

/** `OpenSocket` on the browser's WebSocket. */
export const browserSocket: OpenSocket = (url, handlers) => {
  const ws = new WebSocket(url);
  ws.onopen = () => handlers.open();
  ws.onmessage = (event) => {
    if (typeof event.data === "string") handlers.message(event.data);
  };
  ws.onclose = () => handlers.close();
  return { send: (text) => ws.send(text), close: () => ws.close() };
};
