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

`actionlint` statically validates workflow syntax and expressions. Its optional
ShellCheck integration supplies additional embedded-shell diagnostics only when
ShellCheck is available on the host. A passing local run does not emulate
GitHub-hosted runners, exercise repository settings, prove secret or environment
configuration, perform a live CometAPI request, or prove npm Trusted Publishing.
Those remain separate remote evidence.

## Dependency update review

Dependabot keeps production updates on their existing compatibility policy and
limits development version updates to minor and patch releases. Toolchain
major upgrades need a coordinated change that verifies compiler, linter,
bundler, test runner, and Node.js type compatibility with `npm ci` and
`npm run verify`. Do not use `--force` or `--legacy-peer-deps` to suppress peer
dependency conflicts. Security updates remain eligible; the version-update
filter does not suppress them. See the official
[Dependabot allow reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#allow).

Packed fixtures declare the supported OpenAI range and select the exact install
version from the root lock file at runtime. Update their source declarations
only when intentionally changing the minimum supported range; lock-file patch
updates do not require copying the new version into each fixture.

GitHub Actions version updates are grouped into one review. Every action
remains pinned to a full commit SHA. The Publish contract additionally pins the
parsed executable workflow with `PUBLISH_WORKFLOW_CONTRACT_SHA256` in
`scripts/release-workflow-validation.mjs`. An action SHA change in
`publish.yml` must fail that contract until a maintainer reviews the upstream
action changes and updates the digest in the same change. This is an expected
release safety check, not a transient failure to retry.

After reviewing the complete Publish workflow diff and each action's upstream
changes, calculate the candidate digest from the repository root:

```bash
node --input-type=module <<'EOF'
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const workflow = parse(readFileSync(".github/workflows/publish.yml", "utf8"));
console.log(createHash("sha256").update(JSON.stringify(workflow)).digest("hex"));
EOF
```

Update the constant only after confirming that the reviewed action pins and
all release gates remain correct. Run `npm run verify` to cover the workflow
mutation regressions and pinned `actionlint` validation. Do not remove the
digest check or relax release permissions, immutable-tag checks, environment
approvals, live request budgets, or publication replay limits. Existing open
Dependabot branches retain their old contents until refreshed or replaced;
changing the update policy does not repair those branches by itself.
