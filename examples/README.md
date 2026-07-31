# Examples

These examples exercise only the supported 0.1 surface and use the current
default example model, `gpt-5.6-sol`.

- `esm.mjs` verifies ESM import, Responses, and streaming Chat Completions.
- `commonjs.cjs` verifies CommonJS loading, non-streaming Chat Completions, and
  Models.

They require `COMETAPI_KEY` for authorized live use. Do not run them against the
live API without an explicit request budget and authorization. The
`test:examples` gate executes these original files with a fail-closed mocked
transport against the exact packed tarball; mocked execution is package
evidence, not live compatibility evidence.

For the stable `0.1.x` line:

```bash
npm install cometapi
COMETAPI_KEY="your-api-key" node examples/esm.mjs
COMETAPI_KEY="your-api-key" node examples/commonjs.cjs
```

Create a key at <https://www.cometapi.com/console/token>. Never commit or print
the complete value. You are responsible for all usage and charges incurred with
your key.
