# Local workflow validation

This repository pins `actionlint` in `.github/actionlint-version`. Run the
checked-in wrapper through:

```bash
npm run actionlint
```

The wrapper rejects a different installed version. For the current pin,
`actionlint -version` must report `1.7.12`. When no `actionlint` is on `PATH`,
the wrapper downloads the supported release archive into the ignored `.cache`
directory and verifies it against `.github/actionlint-checksums.txt` before
execution. Set `ACTIONLINT_BIN` to use a separately installed exact-version
binary.

`actionlint` statically validates workflow syntax, expressions, and embedded
shell. A passing local run does not emulate GitHub-hosted runners, exercise
repository settings, prove secret or environment configuration, perform a live
CometAPI request, or prove npm Trusted Publishing. Those remain separate remote
evidence.
