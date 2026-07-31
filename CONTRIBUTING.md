# Contributing

Thank you for helping improve the CometAPI TypeScript and Node.js SDK.

## Scope

The active 0.1 surface is limited to:

- `chat.completions.create`
- `responses.create`
- `models.list`

Chat Completions and Responses include streaming and non-streaming behavior.
Do not add Anthropic, Gemini, CometAPI-specific account resources, media APIs,
browser-side long-lived key support, or provider-neutral translation as an
incidental 0.1 change. Propose future scope through an issue and roadmap update.

## Development setup

Use Node.js 22 or 24 and install exactly from the lock file:

```bash
npm ci
```

Do not commit `node_modules`, generated build output, packed tarballs, local
environment files, or credentials.

## Required checks

Run from the repository root:

```bash
npm run build
npm test
npm run typecheck
npm run lint
npm run format:check
npm run test:secrets
npm run test:package
npm run test:live-contract
npm run test:fixtures
npm run test:compat
npm run check:standalone-content
npm run check:self-contained
npm run check:public-preview
npm run actionlint
npm run verify
```

`npm run verify` is the aggregate offline gate. Pull-request tests use mocked
transport and must not require `COMETAPI_KEY` or access the production API.
`npm run actionlint` obtains the checksum-pinned tool when it is not already
installed, then validates workflow syntax and static policy locally. It is not
evidence that GitHub Actions ran the workflows. Run the self-containment gate
from a clean tracked worktree; it materializes the exact `HEAD` tree and excludes
untracked local files from the isolated verification copy.

## Tests and compatibility claims

Every newly supported operation requires mocked contracts for method, resolved
URL, authentication, serialization, deserialization, option forwarding, custom
`fetch`, client lifecycle, error identity, and credential redaction. Streaming
operations also require event iteration and cancellation tests.

Do not infer support merely because `CometAPI` inherits a method from `OpenAI`.
Update [COMPATIBILITY.md](./COMPATIBILITY.md) only after the corresponding tests
exist and pass. Package behavior must be verified from the exact tarball in ESM
and CommonJS fixtures.

## Documentation

All repository documentation is written in English. Public behavior changes
must update the README, compatibility matrix, examples, roadmap when milestone
scope changes, and changelog. Examples use current model IDs such as
`gpt-5.6-sol` and must not contain real keys.

Keep this repository self-contained. Do not add commands or links that require
files outside the repository root, a sibling SDK, or a private checkout.

## Pull requests

- Keep changes focused and explain user-visible behavior.
- Add or update tests before making a support claim.
- Describe security and compatibility implications.
- Record checks run, checks skipped, and remaining risks.
- Use Conventional Commit style for commit messages so release automation can
  prepare a version and changelog PR.
- Do not include generated artifacts unless a documented release process
  explicitly requires them.

Submitting a pull request does not authorize a live test, remote settings
change, tag, release, or npm publication.
