# Support

## Supported scope

Support for the 0.1 line is limited to the tested operations and runtimes in
[COMPATIBILITY.md](./COMPATIBILITY.md): Chat Completions, Responses, and Models
on Node.js 22 and 24. Node.js 26 is advisory. Inherited OpenAI methods and
future provider or CometAPI-specific resources are outside this support
contract.

Published support begins after the corresponding package is independently
verified from npm. Builds and mocks are not registry support evidence.

## Getting help

Use the canonical repository issue templates for:

- Reproducible SDK bugs
- Documentation problems
- Compatibility reports
- Focused feature proposals aligned with the roadmap

Open SDK support requests at
<https://github.com/cometapi-dev/cometapi-node/issues> or contact
`support@cometapi.com`. Do not use public issues for vulnerabilities; follow
[SECURITY.md](./SECURITY.md).

Include the package version, Node.js version, OpenAI dependency version, module
format, minimal reproduction, and redacted error output. Never post an API key,
authorization header, customer prompt, or sensitive response.

## Account and billing help

Create and manage API keys at <https://www.cometapi.com/console/token>. The SDK
repository does not adjudicate account access, balances, invoices, quotas, or
provider availability. Contact `support@cometapi.com` for account and billing
help.

You are responsible for all usage and charges incurred with your keys.

## What maintainers need

Useful reports answer:

1. Which supported operation and mode failed?
2. Did it fail in ESM or CommonJS?
3. Can the issue be reproduced with mocked transport?
4. Which exact `cometapi`, `openai`, and Node.js versions are installed?
5. Does `npm ls openai --all` show more than one effective installation?

Response times are not guaranteed for prereleases.
