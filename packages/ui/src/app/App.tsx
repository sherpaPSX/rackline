import { useEffect, useState } from "react";
import type { AppState } from "@rackline/api";
import { Button, IconButton, Led, Segmented } from "@rackline/ui-kit";
import type { ClientSnapshot } from "../core-client.js";
import { FilesScreen } from "../screens/FilesScreen.js";
import { ShowScreen } from "../screens/ShowScreen.js";
import { SystemScreen } from "../screens/SystemScreen.js";
import { useCore, useCoreClient } from "./core-context.js";

type Screen = "show" | "system" | "files";

const SCREENS = [
  { value: "show", label: "Show" },
  { value: "system", label: "System" },
  { value: "files", label: "Files" },
] as const satisfies readonly { value: Screen; label: string }[];

/** Connection to the core and the device in a few words, with a light that is red when values are not live. */
function linkStatus(snap: ClientSnapshot): {
  text: string;
  tone: "accent" | "warn" | "danger";
  on: boolean;
} {
  if (snap.link !== "open" || !snap.app)
    return {
      text: snap.link === "connecting" ? "Starting…" : "Core not running",
      tone: "danger",
      on: true,
    };
  const { connection, setup } = snap.app;
  switch (connection.status) {
    case "online":
      return {
        text: [
          connection.device?.name || connection.device?.model || "Device",
          connection.device?.ip,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: "accent",
        on: true,
      };
    case "connecting":
      return { text: "Connecting…", tone: "warn", on: true };
    case "unreachable":
      return { text: "Device unreachable", tone: "danger", on: true };
    case "offline":
      return {
        text:
          setup?.source.kind === "file"
            ? `File · ${setup.source.fileName}`
            : "No device",
        tone: "warn",
        on: setup !== undefined,
      };
  }
}

function TopBar({
  snap,
  screen,
  onScreen,
}: {
  snap: ClientSnapshot;
  screen: Screen;
  onScreen: (s: Screen) => void;
}) {
  const client = useCoreClient();
  const status = linkStatus(snap);
  const app = snap.app;
  return (
    <header className="app-top">
      <span className="app-brand">Rackline</span>
      <Segmented
        label="Screen"
        options={SCREENS}
        value={screen}
        onChange={onScreen}
      />
      <div className="app-status" role="status">
        <Led on={status.on} tone={status.tone} label="Connection" />
        <span className="app-status-text">{status.text}</span>
        {app?.currentPreset !== undefined && (
          <span className="app-note">P{app.currentPreset}</span>
        )}
        {app?.setup && (
          <span className="app-note" title="Estimated DSP load">
            DSP {Math.round(app.setup.dspPercent)} %
          </span>
        )}
      </div>
      <div className="app-row">
        <Button
          disabled={!snap.canUndo}
          onClick={() => client.undo()}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </Button>
        <Button
          disabled={!snap.canRedo}
          onClick={() => client.redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </Button>
      </div>
    </header>
  );
}

function NoSetup({
  app,
  onFiles,
}: {
  app: AppState | undefined;
  onFiles: () => void;
}) {
  return (
    <div className="app-screen app-empty">
      <p>
        {app
          ? "No setup loaded. Connect to a device or open a .r26 file."
          : "Waiting for the Rackline core…"}
      </p>
      {app && <Button onClick={onFiles}>Go to Files</Button>}
    </div>
  );
}

/** Ctrl/Cmd+Z undoes, with Shift (or Ctrl+Y) redoes, except while typing a value. */
function useUndoKeys() {
  const client = useCoreClient();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.target instanceof HTMLInputElement)
        return;
      const key = e.key.toLowerCase();
      if (key === "z" || key === "y") {
        e.preventDefault();
        if (key === "y" || e.shiftKey) client.redo();
        else client.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [client]);
}

export function App() {
  const snap = useCore();
  const client = useCoreClient();
  const [screen, setScreen] = useState<Screen>("show");
  useUndoKeys();
  const app = snap.app;
  const setup = app?.setup;

  return (
    <div className="app">
      <TopBar snap={snap} screen={screen} onScreen={setScreen} />
      {snap.errors.length > 0 && (
        <div className="app-errors" role="alert">
          {snap.errors.map((e) => (
            <div key={e.id} className="app-error">
              <span>{e.message}</span>
              <IconButton
                icon="close"
                label="Dismiss"
                onClick={() => client.dismissError(e.id)}
              />
            </div>
          ))}
        </div>
      )}
      <main className="app-main">
        {screen === "files" && app ? (
          <FilesScreen app={app} />
        ) : !setup || !app ? (
          <NoSetup app={app} onFiles={() => setScreen("files")} />
        ) : screen === "show" ? (
          <ShowScreen setup={setup} values={app.values} />
        ) : (
          <SystemScreen setup={setup} values={app.values} />
        )}
      </main>
    </div>
  );
}
