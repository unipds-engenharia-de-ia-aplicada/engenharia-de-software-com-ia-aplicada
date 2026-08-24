import test from "node:test";
import assert from "node:assert/strict";

import {
  PROVIDER_URLS,
  fetchProviderStatus,
  formatProviderStatus,
  type FetchLike,
} from "./check-provider-status.js";

/** All tests inject fake fetch — never hit real statuspages. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function validPayload(indicator = "none", description = "All Systems Operational") {
  return {
    page: { id: "extra", name: "ignored" },
    status: { indicator, description },
  };
}

test("fetchProviderStatus success github returns compact line", async () => {
  const calls: string[] = [];
  const fake: FetchLike = async (input) => {
    calls.push(String(input));
    return jsonResponse(validPayload("none", "All Systems Operational"));
  };

  const result = await fetchProviderStatus("github", { fetch: fake });
  assert.equal(result, formatProviderStatus("github", "none", "All Systems Operational"));
  assert.equal(calls.length, 1);
  assert.equal(calls[0], PROVIDER_URLS.github);
});

test("fetchProviderStatus github uses githubstatus URL", async () => {
  const fake: FetchLike = async (input) => {
    assert.equal(String(input), "https://www.githubstatus.com/api/v2/status.json");
    return jsonResponse(validPayload());
  };
  await fetchProviderStatus("github", { fetch: fake });
});

test("fetchProviderStatus cloudflare uses cloudflarestatus URL and formats", async () => {
  const fake: FetchLike = async (input) => {
    assert.equal(String(input), PROVIDER_URLS.cloudflare);
    assert.match(String(input), /cloudflarestatus\.com/);
    return jsonResponse(validPayload("minor", "Partial System Outage"));
  };

  const result = await fetchProviderStatus("cloudflare", { fetch: fake });
  assert.equal(
    result,
    formatProviderStatus("cloudflare", "minor", "Partial System Outage"),
  );
});

test("fetchProviderStatus timeout retries then returns readable error", async () => {
  let calls = 0;
  const fake: FetchLike = async () => {
    calls += 1;
    const err = new Error("The operation was aborted due to timeout");
    err.name = "TimeoutError";
    throw err;
  };

  const result = await fetchProviderStatus("github", { fetch: fake });
  assert.equal(calls, 2);
  assert.match(result, /não consegui consultar o status de github/);
  assert.match(result, /plantonista/);
});

test("fetchProviderStatus retries once on 5xx then succeeds", async () => {
  let calls = 0;
  const fake: FetchLike = async () => {
    calls += 1;
    if (calls === 1) return jsonResponse({ error: "boom" }, 503);
    return jsonResponse(validPayload("none", "All Systems Operational"));
  };

  const result = await fetchProviderStatus("github", { fetch: fake });
  assert.equal(calls, 2);
  assert.equal(result, formatProviderStatus("github", "none", "All Systems Operational"));
});

test("fetchProviderStatus 4xx returns without retry", async () => {
  let calls = 0;
  const fake: FetchLike = async () => {
    calls += 1;
    return jsonResponse({ error: "missing" }, 404);
  };

  const result = await fetchProviderStatus("cloudflare", { fetch: fake });
  assert.equal(calls, 1);
  assert.equal(result, "status page de cloudflare respondeu HTTP 404");
});

test("fetchProviderStatus invalid body returns error without retry", async () => {
  let calls = 0;
  const fake: FetchLike = async () => {
    calls += 1;
    return jsonResponse({ status: { indicator: 1 } });
  };

  const result = await fetchProviderStatus("github", { fetch: fake });
  assert.equal(calls, 1);
  assert.match(result, /não consegui consultar o status de github/);
  assert.match(result, /invalid statuspage response/);
});

test("fetchProviderStatus ignores extra JSON fields (passthrough)", async () => {
  const fake: FetchLike = async () =>
    jsonResponse({
      page: { id: "0m7hjkm0xr1x", name: "GitHub" },
      status: { indicator: "none", description: "All Systems Operational" },
      components: [{ name: "API" }],
    });

  const result = await fetchProviderStatus("github", { fetch: fake });
  assert.equal(result, formatProviderStatus("github", "none", "All Systems Operational"));
});
