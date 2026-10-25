# UI test fixtures

`psx-rcf-final-state.json` is the `AppState` the core sends after opening
`packages/protocol/test/fixtures/PSX_RCF_FINAL.r26` (Lukas's RCF rig) with
`openProject`. Regenerate it when the API or the rack import changes:

```ts
const core = new Core({ openDevice: () => Promise.reject(new Error('none')), discover: async () => [] });
await core.handle({ type: 'openProject', fileName: 'PSX_RCF_FINAL.r26', text });
JSON.stringify(core.state(), null, 2);
```
