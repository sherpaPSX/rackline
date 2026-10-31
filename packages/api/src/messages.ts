import { z } from "zod";
import {
  AppState,
  Connection,
  FoundDevice,
  Levels,
  ParamValue,
} from "./state.js";

/**
 * Bumped on every incompatible change, so a client served from an older
 * build (a cached phone page) can tell it is outdated.
 */
export const API_VERSION = 2;

/**
 * Client → core. Clients send intents; the core applies them and broadcasts
 * the result to every client, including the sender.
 */
export const ClientMessage = z.discriminatedUnion("type", [
  /** Change one parameter of one block. Continuous controls may send this on every move. */
  z.object({
    type: z.literal("setParam"),
    blockId: z.number().int(),
    key: z.string(),
    value: ParamValue,
  }),
  /** Recall a device preset. */
  z.object({
    type: z.literal("recallPreset"),
    preset: z.number().int().min(1).max(24),
  }),
  /** Look for devices on the network. */
  z.object({ type: z.literal("discover") }),
  /** Read the setup and values from the device at `ip` and keep them live. */
  z.object({ type: z.literal("connect"), ip: z.ipv4() }),
  z.object({ type: z.literal("disconnect") }),
  /** Open an `.r26` project without a device. `text` is the file's content. */
  z.object({
    type: z.literal("openProject"),
    fileName: z.string(),
    text: z.string(),
  }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

/** Core → client. */
export const ServerMessage = z.discriminatedUnion("type", [
  /** First message on every connection. */
  z.object({ type: z.literal("hello"), apiVersion: z.number().int() }),
  /** The whole state: after `hello` and whenever the setup or many values change (connect, preset recall). */
  z.object({ type: z.literal("state"), state: AppState }),
  /** One parameter changed (by any client or the device). */
  z.object({
    type: z.literal("param"),
    blockId: z.number().int(),
    key: z.string(),
    value: ParamValue,
  }),
  z.object({ type: z.literal("connection"), connection: Connection }),
  /** Live levels of every metered block, several times per second while a device is online. */
  z.object({ type: z.literal("meters"), levels: Levels }),
  /** Result of discovery. */
  z.object({ type: z.literal("devices"), devices: z.array(FoundDevice) }),
  /** A request was rejected or failed, in words for the engineer. */
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parse<T>(schema: z.ZodType<T>, text: string): Parsed<T> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "message is not JSON" };
  }
  const result = schema.safeParse(json);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: z.prettifyError(result.error) };
}

/** Validate a message received by the core. */
export const parseClientMessage = (text: string): Parsed<ClientMessage> =>
  parse(ClientMessage, text);

/** Validate a message received by a client. */
export const parseServerMessage = (text: string): Parsed<ServerMessage> =>
  parse(ServerMessage, text);
