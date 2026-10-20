import assert from "node:assert/strict";
import test from "node:test";
import worker, { type FeedbackEnv } from "../services/feedback/worker";

const origin = `chrome-extension://${"a".repeat(32)}`;
const report = {
  kind: "bug",
  title: "An example bug",
  description: "Steps to reproduce the problem.",
  version: "0.6.6",
};
const limiter = {
  async limit() {
    return { success: true };
  },
};
const env: FeedbackEnv = {
  GITHUB_TOKEN: "test-only-token",
  GITHUB_REPOSITORY: "zilvestro/grammai",
  FEEDBACK_LIMIT: limiter,
  GLOBAL_LIMIT: limiter,
};
const request = (
  data: unknown = report,
  headers: Record<string, string> = {},
) =>
  new Request("https://feedback.example/v1/feedback", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.1",
      ...headers,
    },
    body: JSON.stringify(data),
  });

test("explicit feedback creates a GitHub issue without forwarding extra client fields", async (t) => {
  const calls: Array<{ url: unknown; init?: RequestInit }> = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: unknown, init?: RequestInit) => {
      calls.push({ url, init });
      return Response.json(
        {
          number: 42,
          html_url: "https://github.com/zilvestro/grammai/issues/42",
        },
        { status: 201 },
      );
    },
  );
  for (const kind of ["bug", "idea"]) {
    const response = await worker.fetch(
      request({
        ...report,
        kind,
        editorText: "PRIVATE_DRAFT",
        pageUrl: "PRIVATE_URL",
      }),
      env,
    );
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.deepEqual(await response.json(), {
      number: 42,
      url: "https://github.com/zilvestro/grammai/issues/42",
    });
    const call = calls.at(-1)!;
    assert.equal(
      call.url,
      "https://api.github.com/repos/zilvestro/grammai/issues",
    );
    assert.equal(
      new Headers(call.init!.headers).get("Authorization"),
      "Bearer test-only-token",
    );
    const payload = JSON.parse(String(call.init!.body));
    assert.equal(payload.title, report.title);
    assert.deepEqual(payload.labels, [kind === "bug" ? "bug" : "enhancement"]);
    assert(payload.body.includes(report.description));
    assert(payload.body.includes("grammai version: 0.6.6"));
    assert(!JSON.stringify(payload).includes("PRIVATE_"));
    assert(!JSON.stringify(payload).includes("192.0.2.1"));
  }
});

test("invalid and oversized reports never reach GitHub", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", async () =>
    assert.fail("unexpected GitHub request"),
  );
  for (const data of [
    null,
    { ...report, title: " " },
    { ...report, kind: "other" },
    { ...report, description: "short" },
    { ...report, version: "not-a-version" },
  ])
    assert.equal((await worker.fetch(request(data), env)).status, 400);
  assert.equal(
    (
      await worker.fetch(
        request({ ...report, description: "a".repeat(25000) }),
        env,
      )
    ).status,
    413,
  );
  assert.equal(
    (await worker.fetch(request(report, { "Content-Type": "text/plain" }), env))
      .status,
    415,
  );
  assert.equal(upstream.mock.callCount(), 0);
});

test("rate limits and missing credentials stop reports without disclosing secrets", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", async () =>
    assert.fail("unexpected GitHub request"),
  );
  assert.equal(
    (await worker.fetch(request(), { ...env, GITHUB_TOKEN: undefined })).status,
    503,
  );
  for (const binding of ["FEEDBACK_LIMIT", "GLOBAL_LIMIT"] as const) {
    const response = await worker.fetch(request(), {
      ...env,
      [binding]: {
        async limit() {
          return { success: false };
        },
      },
    });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "60");
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test("preflight supports different extension IDs, but normal websites cannot submit", async () => {
  for (const id of ["a".repeat(32), "p".repeat(32)]) {
    const response = await worker.fetch(
      new Request("https://feedback.example/v1/feedback", {
        method: "OPTIONS",
        headers: { Origin: `chrome-extension://${id}` },
      }),
      env,
    );
    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      `chrome-extension://${id}`,
    );
  }
  assert.equal(
    (
      await worker.fetch(
        request(report, { Origin: "https://unrelated.example" }),
        env,
      )
    ).status,
    403,
  );
});

test("upstream failures return a safe error rather than GitHub details or tokens", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ message: "SECRET_INTERNAL_ERROR" }, { status: 422 }),
  );
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 502);
  const text = await response.text();
  assert(!text.includes("SECRET_INTERNAL_ERROR"));
  assert(!text.includes(env.GITHUB_TOKEN!));
});
