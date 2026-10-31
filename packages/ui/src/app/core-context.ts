import { createContext, useContext, useSyncExternalStore } from "react";
import type { CoreClient, ClientSnapshot } from "../core-client.js";

export const CoreContext = createContext<CoreClient | null>(null);

export function useCoreClient(): CoreClient {
  const client = useContext(CoreContext);
  if (!client) throw new Error("useCoreClient needs a CoreContext provider");
  return client;
}

/** The client's state; re-renders on every change. */
export function useCore(): ClientSnapshot {
  const client = useCoreClient();
  return useSyncExternalStore(client.subscribe, client.getSnapshot);
}
