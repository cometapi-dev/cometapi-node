import { createServer } from "node:http";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
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

async function runFetch(
  handler,
  {
    connectTimeout = "1",
    deadline = "5",
    maxTime = "2",
    prepare,
    retryCount = 2,
    retryDelay = "0",
    terminateAfterMilliseconds,
  } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "cometapi-attestations-test-"));
  temporaryDirectories.push(root);
  const output = join(root, "attestations.json");
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP test server address.");
  }

  const preparedEnvironment = prepare?.({ output, root }) ?? {};
  const child = spawn("bash", [script], {
    detached: terminateAfterMilliseconds !== undefined,
    env: {
      ...process.env,
      ATTESTATIONS_FILE: output,
      ATTESTATIONS_URL: `http://127.0.0.1:${address.port}/attestations`,
      ATTESTATION_CONNECT_TIMEOUT_SECONDS: connectTimeout,
      ATTESTATION_DEADLINE_SECONDS: deadline,
      ATTESTATION_MAX_TIME_SECONDS: maxTime,
      ATTESTATION_RETRY_COUNT: String(retryCount),
      ATTESTATION_RETRY_DELAY_SECONDS: retryDelay,
      ...preparedEnvironment,
    },
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const terminationTimer =
    terminateAfterMilliseconds === undefined
      ? undefined
      : setTimeout(() => {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
          }
        }, terminateAfterMilliseconds);
  const status = await new Promise((resolve) => {
    child.on("close", resolve);
  });
  if (terminationTimer !== undefined) clearTimeout(terminationTimer);
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return { output, status, stderr };
}

function fakeCommand(root, name, contents) {
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  const command = join(bin, name);
  writeFileSync(command, `#!/usr/bin/env bash\n${contents}`);
  chmodSync(command, 0o755);
  return `${bin}:${process.env.PATH ?? ""}`;
}

function candidateFiles(output) {
  return readdirSync(join(output, "..")).filter((name) =>
    name.includes(".download."),
  );
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
    expect(existsSync(`${result.output}.download.1`)).toBe(false);
    expect(candidateFiles(result.output)).toEqual([]);
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
    expect(candidateFiles(result.output)).toEqual([]);
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
    expect(candidateFiles(result.output)).toEqual([]);
  });

  it.each([
    ["connect timeout", { connectTimeout: "0" }],
    ["deadline", { deadline: "0" }],
    ["request timeout", { maxTime: "0" }],
  ])("rejects a disabled %s", async (_name, options) => {
    const result = await runFetch((_request, response) => {
      response.writeHead(200).end("unexpected");
    }, options);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Attestation timeout settings must be positive integers",
    );
  });

  it("rejects a deadline above the ten-minute release bound", async () => {
    const result = await runFetch(
      (_request, response) => {
        response.writeHead(200).end("unexpected");
      },
      { deadline: "601" },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must not exceed 600 seconds");
  });

  it.each([
    ["a noncanonical integer", { connectTimeout: "01" }],
    ["an oversized retry count", { retryCount: 601 }],
  ])("rejects %s", async (_name, options) => {
    const result = await runFetch((_request, response) => {
      response.writeHead(200).end("unexpected");
    }, options);
    expect(result.status).not.toBe(0);
  });

  it("caps an in-flight transfer at the wall-clock deadline", async () => {
    const startedAt = Date.now();
    const result = await runFetch(() => undefined, {
      deadline: "1",
      maxTime: "30",
      retryCount: 59,
    });
    const elapsed = Date.now() - startedAt;
    expect(result.status).not.toBe(0);
    expect(elapsed).toBeLessThan(2_000);
    expect(result.stderr).toContain("Registry attestations did not converge");
  });

  it("rejects and removes a response that completes after the deadline", async () => {
    const result = await runFetch(() => undefined, {
      deadline: "1",
      maxTime: "30",
      prepare: ({ root }) => ({
        PATH: fakeCommand(
          root,
          "curl",
          `output=""
while [[ "$#" -gt 0 ]]; do
  if [[ "$1" == "--output" ]]; then
    output="$2"
    shift 2
  else
    shift
  fi
done
sleep 1.05
printf '%s' '{"attestations":[]}' > "$output"
`,
        ),
      }),
      retryCount: 0,
    });
    expect(result.status).not.toBe(0);
    expect(existsSync(result.output)).toBe(false);
    expect(candidateFiles(result.output)).toEqual([]);
  });

  it("removes the candidate when atomic installation fails", async () => {
    const result = await runFetch(
      (_request, response) => {
        response
          .writeHead(200, { "content-type": "application/json" })
          .end('{"attestations":[]}');
      },
      {
        prepare: ({ root }) => ({
          PATH: fakeCommand(root, "mv", "exit 1\n"),
        }),
        retryCount: 0,
      },
    );
    expect(result.status).not.toBe(0);
    expect(existsSync(result.output)).toBe(false);
    expect(candidateFiles(result.output)).toEqual([]);
  });

  it("rejects a successful install that crosses the deadline", async () => {
    const result = await runFetch(
      (_request, response) => {
        response
          .writeHead(200, { "content-type": "application/json" })
          .end('{"attestations":[]}');
      },
      {
        deadline: "1",
        prepare: ({ root }) => ({
          PATH: fakeCommand(root, "mv", 'sleep 1.05\n/bin/mv "$@"\n'),
        }),
        retryCount: 0,
      },
    );
    expect(result.status).not.toBe(0);
    expect(existsSync(result.output)).toBe(false);
    expect(candidateFiles(result.output)).toEqual([]);
  });

  it("cleans a partial candidate when the process group is interrupted", async () => {
    const result = await runFetch(() => undefined, {
      prepare: ({ root }) => ({
        PATH: fakeCommand(
          root,
          "curl",
          `output=""
while [[ "$#" -gt 0 ]]; do
  if [[ "$1" == "--output" ]]; then
    output="$2"
    shift 2
  else
    shift
  fi
done
printf '%s' 'PARTIAL' > "$output"
sleep 10
`,
        ),
      }),
      retryCount: 0,
      terminateAfterMilliseconds: 250,
    });
    expect(result.status).not.toBe(0);
    expect(existsSync(result.output)).toBe(false);
    expect(candidateFiles(result.output)).toEqual([]);
  });

  it("refuses to replace an existing output file", async () => {
    const result = await runFetch(
      (_request, response) => {
        response.writeHead(200).end("unexpected");
      },
      {
        prepare: ({ output }) => {
          writeFileSync(output, "preserve-me");
        },
      },
    );
    expect(result.status).not.toBe(0);
    expect(readFileSync(result.output, "utf8")).toBe("preserve-me");
    expect(candidateFiles(result.output)).toEqual([]);
  });
});
