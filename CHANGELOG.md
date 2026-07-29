# Changelog

All notable changes to this project will be documented in this file. The format
follows Keep a Changelog, and versions follow Semantic Versioning.

## [0.1.1](https://github.com/cometapi-dev/cometapi-node/compare/v0.1.0...v0.1.1) (2026-07-29)


### Bug Fixes

* classify Release Please push state ([505c7e9](https://github.com/cometapi-dev/cometapi-node/commit/505c7e9ef9186be5c5518e62de6899908adcf921))
* classify Release Please push state ([a7a03de](https://github.com/cometapi-dev/cometapi-node/commit/a7a03de7a6f805dafafdba421c5b75feed37495c))
* enforce options boundary and patch release flow ([91ce99c](https://github.com/cometapi-dev/cometapi-node/commit/91ce99ca4f50e9b9f51f992eab8f3e1ab8bf0d36))
* enforce options boundary and patch release flow ([abf21ba](https://github.com/cometapi-dev/cometapi-node/commit/abf21ba9954c7ca08e7c4c1824ecb4e33c56072e))
* finalize Release Please patch state ([3180b52](https://github.com/cometapi-dev/cometapi-node/commit/3180b52794e1eb92bbc4dd54e76e087c61c24ea1))
* finalize Release Please patch state ([453135e](https://github.com/cometapi-dev/cometapi-node/commit/453135e45e81541b1da998d5abc87240f1f51880))
* harden options and Release Please patch flow ([5b03072](https://github.com/cometapi-dev/cometapi-node/commit/5b0307238ce9148082557d5cad5f7e6c220166ee))
* harden Release Please patch releases ([a33c128](https://github.com/cometapi-dev/cometapi-node/commit/a33c128fa60c58fdcbbc6562d4ad5c1112aaba72))
* limit Release Please push trigger ([fbd5a22](https://github.com/cometapi-dev/cometapi-node/commit/fbd5a2243be6b83082c40ba41e1693295bed527e))
* match Release Please root title ([0963e0e](https://github.com/cometapi-dev/cometapi-node/commit/0963e0eeed47a10f4a76b32c108911a8de2f0d01))
* match Release Please root title ([300ffac](https://github.com/cometapi-dev/cometapi-node/commit/300ffac2ec5c891820bd824385c49f1d232ed428))
* recover exact Release Please runs ([4ffee49](https://github.com/cometapi-dev/cometapi-node/commit/4ffee49fb78bb9661c6e30dab72451951cbf7a7a))
* require refreshed release candidate ([ab5aa26](https://github.com/cometapi-dev/cometapi-node/commit/ab5aa26d997e9653ef5c860cf7968d443caba53e))
* snapshot supported client options once ([6ee0fdf](https://github.com/cometapi-dev/cometapi-node/commit/6ee0fdfdbd9062f60fc3784fef3dbfe6162464fb))

## [0.1.0](https://github.com/cometapi-dev/cometapi-node/compare/v0.1.0-alpha.3...v0.1.0) (2026-07-28)

### Bug Fixes

- prepare 0.1.0 stable release ([#27](https://github.com/cometapi-dev/cometapi-node/issues/27)) ([f5f6731](https://github.com/cometapi-dev/cometapi-node/commit/f5f6731ba9a5bb0fbfdc1ed256c3e66e3c03ca96))

## [0.1.0-alpha.3] - 2026-07-27

### Fixed

- Accepted the fixed authentication sentinel value injected by
  `actions/setup-node` for npm Trusted Publishing while continuing to reject
  real registry token credentials.
- Replaced the unpublished immutable alpha.2 release after its publication
  guard failed before invoking npm.

## [0.1.0-alpha.2] - 2026-07-27

### Changed

- Removed the one-time alpha.1 token bootstrap and manual recovery workflow
  after configuring npm Trusted Publishing.
- Required the release workflow to publish through OIDC without registry token
  credentials while preserving exact-artifact and provenance verification.

## [0.1.0-alpha.1] - 2026-07-27

### Added

- `CometAPI` as the public TypeScript and Node.js client.
- Tested 0.1 contracts for Chat Completions, Responses, and Models.
- Streaming and non-streaming Chat Completions and Responses behavior.
- ESM and CommonJS package entry points and declarations.
- Mocked contracts, packed-artifact fixtures, OpenAI dependency deduplication,
  and `APIError` identity verification.
- Standalone repository documentation and release verification commands.

### Changed

- Targeted the official OpenAI JavaScript dependency range `^6.47.0`.
- Aligned configuration validation with the official `OpenAIError` family while
  preserving the official `APIError` family for HTTP failures.
- Derived release validation from `package.json` and required agreement with the
  lock root, Release Please manifest or bootstrap state, changelog, tag, GitHub
  release, and packed metadata at the applicable release stage.
- Applied the canonical CometAPI author, copyright, homepage, repository, bugs,
  support, conduct, and security identity.
- Made Public Preview and publication validation fail closed on canonical
  identity, public-safe standalone content, and release-ready status at the
  applicable gate.
- Added standalone-content scanning to the aggregated Public Preview gate and
  encoded the protected, opt-in npm token bootstrap for `0.1.0-alpha.1` only.
- Hardened pre-visibility evidence by scanning tracked files and reachable Git
  history for credential patterns, verifying an exact clean `HEAD` copy,
  requiring substantive public documentation, and exercising every documented
  live-smoke stream failure state with mocked transport.
- Made the release workflow the sole npm dist-tag source: prereleases use
  `next`, stable releases use `latest`, and the package manifest has no static
  dist-tag.
- Limited the supported `engines` range to Node.js 22 and 24. Node.js 26 remains
  advisory outside that range; Node.js 18 and 20 remain unsupported.
- Limited the trusted live smoke to exactly three sequential requests, at most
  16 output tokens per request, a 60-second timeout per request, concurrency
  one, and an immediate stop on the first failure.
- Completed the Public Preview repository transition, protected configuration,
  and authorized live-smoke verification before Registry Alpha publication.

### Removed

- `CODEOWNERS` and its validation dependencies until a real multi-maintainer
  model exists.
- Unsupported legacy client aliases.
