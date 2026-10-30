import { useRef, useState } from 'react';
import type { AppState } from '@rackline/api';
import { Button, ConfirmButton, Select, TextField } from '@rackline/ui-kit';
import { useCoreClient } from '../app/core-context.js';

const PRESETS = Array.from({ length: 24 }, (_, i) => ({ value: i + 1, label: `Preset ${i + 1}` }));
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const validIp = (ip: string) => IPV4.test(ip) && ip.split('.').every((n) => Number(n) <= 255);

/** Files: which device or file the app works with, and device presets. */
export function FilesScreen({ app }: { app: AppState }) {
  const client = useCoreClient();
  const [ip, setIp] = useState(app.connection.device?.ip ?? '');
  const [preset, setPreset] = useState(app.currentPreset ?? 1);
  const fileInput = useRef<HTMLInputElement>(null);
  const { connection, setup } = app;
  const connected = connection.status !== 'offline';

  return (
    <div className="app-screen">
      <section className="app-panel" aria-labelledby="files-device">
        <h2 className="app-h2" id="files-device">
          Device
        </h2>
        {connected ? (
          <div className="app-row">
            <span>
              {connection.device ? `${connection.device.model} “${connection.device.name}” at ${connection.device.ip}, firmware ${connection.device.firmware}` : 'Connecting…'}
            </span>
            <Button onClick={() => client.send({ type: 'disconnect' })}>Disconnect</Button>
          </div>
        ) : (
          <>
            <div className="app-row">
              <Button onClick={() => client.send({ type: 'discover' })}>Find devices</Button>
              <TextField label="Device IP address" placeholder="192.168.1.20" value={ip} onChange={setIp} inputMode="decimal" size={16} />
              <Button disabled={!validIp(ip)} onClick={() => client.send({ type: 'connect', ip })}>
                Connect
              </Button>
            </div>
            {app.devices.length > 0 && (
              <ul className="app-list">
                {app.devices.map((d) => (
                  <li key={d.mac} className="app-row">
                    <span className="app-mono">{d.ip}</span>
                    <span className="app-note">{d.mac}</span>
                    <Button onClick={() => client.send({ type: 'connect', ip: d.ip })}>Connect</Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {connection.error && <p className="app-error-text">{connection.error}</p>}
      </section>

      <section className="app-panel" aria-labelledby="files-project">
        <h2 className="app-h2" id="files-project">
          Project file
        </h2>
        <div className="app-row">
          <Button onClick={() => fileInput.current?.click()}>Open .r26 file</Button>
          <input
            ref={fileInput}
            type="file"
            accept=".r26"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) void file.text().then((text) => client.send({ type: 'openProject', fileName: file.name, text }));
            }}
          />
          {setup?.source.kind === 'file' && <span>Open: {setup.source.fileName}</span>}
        </div>
        <p className="app-note">
          Opening a file works without a device; changes stay in the app. Saving files and comparing a file with the device come later.
        </p>
      </section>

      {setup && (
        <section className="app-panel" aria-labelledby="files-presets">
          <h2 className="app-h2" id="files-presets">
            Presets
          </h2>
          <div className="app-row">
            <Select label="Preset to recall" options={PRESETS} value={preset} onChange={setPreset} />
            <ConfirmButton label={`Recall ${preset}`} confirmLabel="Sure?" onConfirm={() => client.send({ type: 'recallPreset', preset })} />
            <span className="app-note">{app.currentPreset ? `Current: preset ${app.currentPreset}` : 'Current preset unknown'}</span>
          </div>
          <p className="app-note">Recalling replaces every value and clears undo.</p>
        </section>
      )}
    </div>
  );
}
