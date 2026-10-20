import assert from "node:assert/strict";
import test from "node:test";
import worker, { type FeedbackEnv } from "../services/feedback/worker";

import { appEnv, mockGitHub } from "./feedback-app-fixture";

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
  ...appEnv,
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
  mockGitHub(t, async (url: unknown, init?: RequestInit) => {
    calls.push({ url, init });
    return Response.json(
      {
        number: 42,
        html_url: "https://github.com/zilvestro/grammai/issues/42",
      },
      { status: 201 },
    );
  });
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
      "Bearer test-installation-token",
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
    (
      await worker.fetch(request(), {
        ...env,
        GITHUB_APP_PRIVATE_KEY: undefined,
      })
    ).status,
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
  mockGitHub(t, async () =>
    Response.json({ message: "SECRET_INTERNAL_ERROR" }, { status: 422 }),
  );
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 502);
  const text = await response.text();
  assert(!text.includes("SECRET_INTERNAL_ERROR"));
  assert(!text.includes(env.GITHUB_APP_PRIVATE_KEY!));
});

const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=",
    "base64",
  ),
);
function multipartRequest(
  images: Blob[] = [new Blob([png], { type: "image/png" })],
) {
  const form = new FormData();
  Object.entries(report).forEach(([key, value]) => form.set(key, value));
  images.forEach((file) =>
    form.append("images", file, "private-original-name.png"),
  );
  return new Request("https://feedback.example/v1/feedback", {
    method: "POST",
    headers: { Origin: origin },
    body: form,
  });
}
function imageBucket() {
  const objects = new Map<string, Uint8Array>();
  const bucket: NonNullable<FeedbackEnv["FEEDBACK_IMAGES"]> = {
    async put(key, bytes) {
      objects.set(key, bytes);
    },
    async get(key) {
      const bytes = objects.get(key);
      return bytes
        ? {
            body: new Blob([Uint8Array.from(bytes)]).stream(),
            size: bytes.length,
          }
        : null;
    },
    async delete(keys) {
      keys.forEach((key) => objects.delete(key));
    },
  };
  return { bucket, objects };
}

test("screenshots are stored under random public URLs and embedded in the GitHub issue", async (t) => {
  const { bucket, objects } = imageBucket();
  let payload = "";
  mockGitHub(t, async (_url: unknown, init?: RequestInit) => {
    payload = String(init!.body);
    return Response.json(
      {
        number: 42,
        html_url: "https://github.com/zilvestro/grammai/issues/42",
      },
      { status: 201 },
    );
  });
  const imageEnv = { ...env, FEEDBACK_IMAGES: bucket };
  assert.equal(
    (
      await worker.fetch(
        multipartRequest([
          new Blob([png], { type: "image/png" }),
          new Blob([png], { type: "image/png" }),
        ]),
        imageEnv,
      )
    ).status,
    201,
  );
  assert.equal(objects.size, 2);
  assert(!payload.includes("private-original-name"));
  for (const [key, bytes] of objects) {
    assert.match(key, /^[a-f0-9-]{36}\.png$/);
    assert(payload.includes(`https://feedback.example/images/${key}`));
    const image = await worker.fetch(
      new Request(`https://feedback.example/images/${key}`),
      imageEnv,
    );
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("Content-Type"), "image/png");
    assert.equal(image.headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepEqual(new Uint8Array(await image.arrayBuffer()), bytes);
    const head = await worker.fetch(
      new Request(`https://feedback.example/images/${key}`, { method: "HEAD" }),
      imageEnv,
    );
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  }
  assert.equal(
    (
      await worker.fetch(
        new Request("https://feedback.example/images/../../other"),
        imageEnv,
      )
    ).status,
    404,
  );
});

test("screenshots reject unsafe, oversized and excess files before uploading or calling GitHub", async (t) => {
  const { bucket, objects } = imageBucket();
  t.mock.method(globalThis, "fetch", async () =>
    assert.fail("unexpected upstream call"),
  );
  const imageEnv = { ...env, FEEDBACK_IMAGES: bucket };
  for (const files of [
    [new Blob(['<svg onload="alert(1)"/>'], { type: "image/svg+xml" })],
    [new Blob(["<html>not a PNG</html>"], { type: "image/png" })],
    [new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/png" })],
    Array.from({ length: 3 }, () => new Blob([png], { type: "image/png" })),
  ])
    assert.equal(
      (await worker.fetch(multipartRequest(files), imageEnv)).status,
      400,
    );
  assert.equal((await worker.fetch(multipartRequest(), env)).status, 503);
  assert.equal(objects.size, 0);
});

test("uploads are removed after definite rejection or upload failure, retained after ambiguous delivery", async (t) => {
  const { bucket, objects } = imageBucket();
  const imageEnv = { ...env, FEEDBACK_IMAGES: bucket };
  let mode = "rejected";
  mockGitHub(t, async () => {
    if (mode === "timeout") throw new Error("timeout");
    return new Response(null, { status: mode === "rejected" ? 422 : 502 });
  });
  assert.equal((await worker.fetch(multipartRequest(), imageEnv)).status, 502);
  assert.equal(objects.size, 0);
  mode = "timeout";
  assert.equal((await worker.fetch(multipartRequest(), imageEnv)).status, 503);
  assert.equal(
    objects.size,
    1,
    "keep images when GitHub might have created the issue",
  );
  objects.clear();
  const failing = {
    ...bucket,
    async put(key: string, bytes: Uint8Array) {
      objects.set(key, bytes);
      throw new Error("storage failure");
    },
  };
  assert.equal(
    (
      await worker.fetch(multipartRequest(), {
        ...env,
        FEEDBACK_IMAGES: failing,
      })
    ).status,
    503,
  );
  assert.equal(objects.size, 0);
});

test("capability check reflects storage availability without requiring credentials", async () => {
  for (const enabled of [false, true]) {
    const response = await worker.fetch(
      new Request("https://feedback.example/v1/feedback", {
        headers: { Origin: origin },
      }),
      {
        ...env,
        GITHUB_APP_PRIVATE_KEY: undefined,
        FEEDBACK_IMAGES: enabled ? imageBucket().bucket : undefined,
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { images: enabled });
    const withoutOrigin = await worker.fetch(
      new Request("https://feedback.example/v1/feedback"),
      { ...env, FEEDBACK_IMAGES: enabled ? imageBucket().bucket : undefined },
    );
    assert.equal(withoutOrigin.status, 200);
    assert.deepEqual(await withoutOrigin.json(), { images: enabled });
  }
});
