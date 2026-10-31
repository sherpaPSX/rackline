import { useEffect, useRef, useState } from 'react';
import type { AppState } from '@rackline/api';
import { Button, ConfirmButton, Led, Segmented, Select, TextField } from '@rackline/ui-kit';
import type { SegmentOption } from '@rackline/ui-kit';
import type { ClientSnapshot } from '../core-client.js';
import { useCoreClient } from './core-context.js';

export type Screen = 'show' | 'live' | 'edit';

/**
 * Modes (Lukas, 2026-10-31): Show is the light view (volume and EQ) and
 * Live tunes every module on the grid; both need a connected device. Edit
 * works on a file without one: values for now, moving modules and wiring
 * in phase 2 (compile + upload with a dropout).
 */
function modes(online: boolean): SegmentOption<Screen>[] {
  const needsDevice = online ? {} : { disabled: true, hint: 'Connect a device first' };
  return [
    { value: 'show', label: 'Show', ...needsDevice },
    { value: 'live', label: 'Live', ...needsDevice },
    { value: 'edit', label: 'Edit', disabled: online, hint: online ? 'Disconnect to edit a file; editing the layout comes in phase 2' : 'Edit the open file' },
  ];
}

const PRESETS = Array.from({ length: 24 }, (_, i) => ({ value: i + 1, label: `Preset ${i + 1}` }));
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const validIp = (ip: string) => IPV4.test(ip) && ip.split('.').every((n) => Number(n) <= 255);

/** Connection to the core and the device in a few words, with a light that is red when values are not live. */
function linkStatus(snap: ClientSnapshot): { text: string; tone: 'accent' | 'warn' | 'danger'; on: boolean } {
  if (snap.link !== 'open' || !snap.app) return { text: snap.link === 'connecting' ? 'Starting…' : 'Core not running', tone: 'danger', on: true };
  const { connection, setup } = snap.app;
  switch (connection.status) {
    case 'online':
      return { text: [connection.device?.name || connection.device?.model || 'Device', connection.device?.ip].filter(Boolean).join(' · '), tone: 'accent', on: true };
    case 'connecting':
      return { text: 'Connecting…', tone: 'warn', on: true };
    case 'unreachable':
      return { text: 'Device unreachable', tone: 'danger', on: true };
    case 'offline':
      return { text: setup?.source.kind === 'file' ? `File · ${setup.source.fileName}` : 'No device', tone: 'warn', on: setup !== undefined };
  }
}

/** Device state in the header; a click opens finding, connecting and disconnecting. */
function DeviceMenu({ snap, app }: { snap: ClientSnapshot; app: AppState | undefined }) {
  const client = useCoreClient();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [ip, setIp] = useState(app?.connection.device?.ip ?? '');
  const box = useRef<HTMLDivElement>(null);
  const status = linkStatus(snap);
  const connection = app?.connection;
  const connected = connection !== undefined && connection.status !== 'offline';
  const hasApp = app !== undefined;

  // Plug-and-play: look for devices whenever the app has none.
  useEffect(() => {
    if (hasApp && !connected) client.send({ type: 'discover' });
  }, [client, hasApp, connected]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="app-device" ref={box}>
      <button type="button" className="app-device-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} disabled={!app}>
        <Led on={status.on} tone={status.tone} label="Connection" />
        <span className="app-status-text">{status.text}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && app && connection && (
        <div className="app-device-menu" role="dialog" aria-label="Device">
          {connected ? (
            <>
              <span>{connection.device ? `${connection.device.model} “${connection.device.name}” at ${connection.device.ip}, firmware ${connection.device.firmware}` : 'Connecting…'}</span>
              <Button onClick={() => client.send({ type: 'disconnect' })}>Disconnect</Button>
            </>
          ) : (
            <>
              {app.devices.length > 0 ? (
                <ul className="app-list">
                  {app.devices.map((d) => (
                    <li key={d.mac} className="app-row">
                      <span className="app-mono">{d.ip}</span>
                      <span className="app-note">{d.mac}</span>
                      {d.reachable === false && <span className="app-note">Other network: Connect gives it a free address in yours</span>}
                      <Button onClick={() => client.send({ type: 'connect', ip: d.ip })}>Connect</Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="app-note">No device found yet. Check that the RPM is on and plugged into the same network.</p>
              )}
              <div className="app-row">
                <Button onClick={() => client.send({ type: 'discover' })}>Find devices</Button>
                {!manual && <Button onClick={() => setManual(true)}>Connect by IP address</Button>}
              </div>
              {manual && (
                <div className="app-row">
                  <TextField label="Device IP address" placeholder="192.168.1.20" value={ip} onChange={setIp} inputMode="decimal" size={16} />
                  <Button disabled={!validIp(ip)} onClick={() => client.send({ type: 'connect', ip })}>
                    Connect
                  </Button>
                </div>
              )}
            </>
          )}
          {connection.error && <p className="app-error-text">{connection.error}</p>}
        </div>
      )}
    </div>
  );
}

/** Preset to recall; recalling replaces every value and clears undo, so it asks first. */
function PresetPicker({ app }: { app: AppState }) {
  const client = useCoreClient();
  const [preset, setPreset] = useState(app.currentPreset ?? 1);
  return (
    <div className="app-row">
      <Select label="Preset to recall" options={PRESETS} value={preset} onChange={setPreset} />
      <ConfirmButton label="Recall" confirmLabel="Sure?" onConfirm={() => client.send({ type: 'recallPreset', preset })} />
    </div>
  );
}

/** Opens a Drag Net .r26 file; works without a device, changes stay in the app. */
function OpenFile() {
  const client = useCoreClient();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button onClick={() => input.current?.click()} title="Open a .r26 file; works without a device">
        Open .r26
      </Button>
      <input
        ref={input}
        type="file"
        accept=".r26"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void file.text().then((text) => client.send({ type: 'openProject', fileName: file.name, text }));
        }}
      />
    </>
  );
}

/**
 * The fixed app header: device and its state, presets, file, the screen
 * switch and undo. Everything about which device or file the app works with
 * lives here, so there is no separate Files screen.
 */
export function Header({ snap, screen, onScreen }: { snap: ClientSnapshot; screen: Screen; onScreen: (s: Screen) => void }) {
  const client = useCoreClient();
  const app = snap.app;
  const online = app?.connection.status === 'online';
  return (
    <header className="app-top">
      <span className="app-brand">Rackline</span>
      <DeviceMenu snap={snap} app={app} />
      {app?.setup && online && <PresetPicker key={app.currentPreset} app={app} />}
      {app && <OpenFile />}
      <span className="app-top-gap" />
      <Segmented label="Screen" options={modes(online)} value={screen} onChange={onScreen} />
      {app?.setup && (
        <span className="app-note" title="Estimated DSP load">
          DSP {Math.round(app.setup.dspPercent)} %
        </span>
      )}
      <div className="app-row">
        <Button disabled={!snap.canUndo} onClick={() => client.undo()} title="Undo (Ctrl+Z)">
          Undo
        </Button>
        <Button disabled={!snap.canRedo} onClick={() => client.redo()} title="Redo (Ctrl+Shift+Z)">
          Redo
        </Button>
      </div>
    </header>
  );
}
