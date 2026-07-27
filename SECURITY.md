# Security Policy

## Release status

The SDK is in pre-release development. Published support claims begin only
after a package is independently verified from npm.

| Version             | Status                                                |
| ------------------- | ----------------------------------------------------- |
| `0.1.x` prereleases | Best-effort security fixes after verified publication |
| Older versions      | Unsupported                                           |

## Reporting a vulnerability

Do not disclose vulnerabilities, credentials, or exploit details in a public
issue.

The canonical confidential reporting URL is
<https://github.com/cometapi-dev/cometapi-node/security/advisories/new>.
Private Vulnerability Reporting is enabled for Public Preview. Contact
`support@cometapi.com` if the reporting URL is unavailable.

Include:

- Affected version, runtime, and dependency versions
- Reproduction steps or a minimal proof of concept
- Expected and observed impact
- Whether credentials or user data may be exposed
- Any safe mitigation already tested

Do not include a real CometAPI key. Use a clearly fake sentinel in reproductions
and redact request headers and logs.

## Response expectations

CometAPI handles reports privately and coordinates disclosure after a fix or
mitigation is ready. Response times are not guaranteed for prereleases.

## Credential safety

- Create API keys at <https://www.cometapi.com/console/token>.
- Never commit, log, print, record, or package a full key.
- Keep keys out of browser bundles and client-side applications.
- Use repository secrets and protected environments only for authorized trusted
  workflows.
- Pull-request and package-fixture tests must use mocked transport and no
  production credential.
- If a real key is exposed, revoke or rotate it through the CometAPI console and
  remove it from every log, artifact, and secret store.

Users are responsible for all usage and charges incurred with their keys.

## Release security

npm publication normally uses GitHub OIDC Trusted Publishing, a protected npm
environment, provenance, an immutable reviewed tag, and post-publication
installation verification. Registry tokens are forbidden by the publication
workflow. The completed one-time first-alpha bootstrap is documented in
[RELEASING.md](./RELEASING.md) as historical release evidence and is not a
reusable source-controlled publication path.
