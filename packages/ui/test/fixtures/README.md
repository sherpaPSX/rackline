# UI test fixtures

`psx-rcf-final-state.json` is the `AppState` the core sends after opening
`packages/protocol/test/fixtures/PSX_RCF_FINAL.r26` (Lukas's RCF rig) with
`openProject`. Regenerate it when the API or the rack import changes:

```ts
const core = new Core({ openDevice: () => Promise.reject(new Error('none')), discover: async () => [] });
await core.handle({ type: 'openProject', fileName: 'PSX_RCF_FINAL.r26', text });
JSON.stringify(core.state(), null, 2);
```

`module-catalog-state.json` is a made-up setup that uses every module the
core knows (`packages/server/test/module-catalog.ts`). `pnpm --filter
@rackline/ui preview` turns it into `dist/modules.html`, a gallery of all
module cards. Regenerate it with `UPDATE_CATALOG=1 pnpm test` after a
registry or API change; a test fails while it is out of date.
