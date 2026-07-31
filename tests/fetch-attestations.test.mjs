import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("../scripts/fetch-attestations.sh", import.meta.url),
);
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

async function runFetch(handler, { retryCount = 2 } = {}) {
  const root = mkdtempSync(join(tmpdir(), "cometapi-attestations-test-"));
  temporaryDirectories.push(root);
  const output = join(root, "attestations.json");
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP test server address.");
  }

  const child = spawn("bash", [script], {
    env: {
      ...process.env,
      ATTESTATIONS_FILE: output,
      ATTESTATIONS_URL: `http://127.0.0.1:${address.port}/attestations`,
      ATTESTATION_CONNECT_TIMEOUT_SECONDS: "1",
      ATTESTATION_MAX_TIME_SECONDS: "2",
      ATTESTATION_RETRY_COUNT: String(retryCount),
      ATTESTATION_RETRY_DELAY_SECONDS: "0",
      ATTESTATION_RETRY_MAX_TIME_SECONDS: "5",
    },
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const status = await new Promise((resolve) => {
    child.on("close", resolve);
  });
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return { output, status, stderr };
}

describe("attestation registry convergence", () => {
  it("retries an early 404 and atomically installs the successful response", async () => {
    let requests = 0;
    const result = await runFetch((_request, response) => {
      requests += 1;
      if (requests === 1) {
        response.writeHead(404).end("not ready");
        return;
      }
      response
        .writeHead(200, { "content-type": "application/json" })
        .end('{"attestations":[]}');
    });
    expect(result.status, result.stderr).toBe(0);
    expect(requests).toBe(2);
    expect(readFileSync(result.output, "utf8")).toBe('{"attestations":[]}');
    expect(existsSync(`${result.output}.download`)).toBe(false);
  });

  it("does not concatenate a partial failed transfer into a retry", async () => {
    let requests = 0;
    const result = await runFetch((_request, response) => {
      requests += 1;
      if (requests === 1) {
        response.writeHead(200, { "content-length": "100" });
        response.end("PARTIAL");
        return;
      }
      response
        .writeHead(200, { "content-type": "application/json" })
        .end('{"attestations":["valid"]}');
    });
    expect(result.status, result.stderr).toBe(0);
    expect(requests).toBe(2);
    expect(readFileSync(result.output, "utf8")).toBe(
      '{"attestations":["valid"]}',
    );
  });

  it("fails closed when the retry budget is exhausted", async () => {
    let requests = 0;
    const result = await runFetch((_request, response) => {
      requests += 1;
      response.writeHead(404).end("not ready");
    });
    expect(result.status).not.toBe(0);
    expect(requests).toBe(3);
    expect(result.stderr).toContain("Registry attestations did not converge");
    expect(existsSync(result.output)).toBe(false);
  });
});
