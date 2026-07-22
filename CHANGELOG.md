# Changelog

All notable changes to this project will be documented in this file. The format
follows Keep a Changelog, and versions follow Semantic Versioning.

## [Unreleased]

No user-visible changes are currently recorded beyond the initial alpha scope.

## [0.1.0-alpha.1] - Unreleased

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

### Removed

- `CODEOWNERS` and its validation dependencies until a real multi-maintainer
  model exists.
- Unsupported legacy client aliases.
