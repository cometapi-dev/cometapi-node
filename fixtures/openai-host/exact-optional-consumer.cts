import { CometAPI } from "cometapi";

const client = new CometAPI({ apiKey: "fixture-key" });

// @ts-expect-error Exact optional declarations must reject an explicit provider key.
new CometAPI({ provider: undefined });
// @ts-expect-error Exact optional declarations must reject an explicit workload key.
new CometAPI({ workloadIdentity: undefined });
// @ts-expect-error Exact optional declarations must reject an explicit browser key.
new CometAPI({ dangerouslyAllowBrowser: undefined });
// @ts-expect-error Exact optional declarations must reject an explicit provider key.
client.withOptions({ provider: undefined });
// @ts-expect-error Exact optional declarations must reject an explicit workload key.
client.withOptions({ workloadIdentity: undefined });
// @ts-expect-error Exact optional declarations must reject an explicit browser key.
client.withOptions({ dangerouslyAllowBrowser: undefined });
