import assert from "node:assert/strict";
import { verify } from "node:crypto";
import test from "node:test";
import {
  appConfigured,
  installationToken,
} from "../services/feedback/github-app";
import { appEnv, publicKey } from "./feedback-app-fixture";
import worker, { type FeedbackEnv } from "../services/feedback/worker";

test("app signs a short-lived RS256 JWT and requests an issue-only token for the fixed repository", async (t) => {
  const now = Date.now();
  t.mock.method(
    globalThis,
    "fetch",
    async (url: unknown, init?: RequestInit) => {
      assert.equal(
        url,
        "https://api.github.com/app/installations/67890/access_tokens",
      );
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        repositories: ["grammai"],
        permissions: { issues: "write" },
      });
      const jwt = new Headers(init?.headers).get("Authorization")!.slice(7);
      const [header, payload, signature] = jwt.split(".");
      assert.deepEqual(
        JSON.parse(Buffer.from(header, "base64url").toString()),
        { alg: "RS256", typ: "JWT" },
      );
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
      assert.equal(claims.iss, appEnv.GITHUB_APP_ID);
      assert(claims.iat <= Math.floor(now / 1000));
      assert(claims.iat >= Math.floor(now / 1000) - 65);
      assert(claims.exp > Math.floor(now / 1000));
      assert(claims.exp <= Math.floor(now / 1000) + 600);
      assert(
        verify(
          "RSA-SHA256",
          Buffer.from(`${header}.${payload}`),
          publicKey,
          Buffer.from(signature, "base64url"),
        ),
      );
      return Response.json(
        {
          token: "new-format-token-with-no-fixed-length",
          expires_at: new Date(now + 3600000).toISOString(),
        },
        { status: 201 },
      );
    },
  );
  assert.equal(
    await installationToken(appEnv, "zilvestro/grammai"),
    "new-format-token-with-no-fixed-length",
  );
});

test("app credentials and installation IDs are required; malformed keys and token responses fail closed", async (t) => {
  assert(!appConfigured({}));
  assert(!appConfigured({ ...appEnv, GITHUB_APP_INSTALLATION_ID: "../other" }));
  await assert.rejects(
    installationToken(
      { ...appEnv, GITHUB_APP_PRIVATE_KEY: "not a key" },
      "zilvestro/grammai",
    ),
  );
  for (const body of [
    { token: "", expires_at: new Date(Date.now() + 3600000).toISOString() },
    { token: "bad", expires_at: "invalid" },
    { token: "expired", expires_at: new Date(0).toISOString() },
  ]) {
    const mock = t.mock.method(globalThis, "fetch", async () =>
      Response.json(body, { status: 201 }),
    );
    await assert.rejects(installationToken(appEnv, "zilvestro/grammai"));
    mock.mock.restore();
  }
});

test("app authentication failures never create an issue, upload images or leak secrets, including when a legacy PAT is present", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: unknown) => {
    calls++;
    assert.equal(
      url,
      "https://api.github.com/app/installations/67890/access_tokens",
    );
    return Response.json(
      { message: "PRIVATE_UPSTREAM_DETAILS" },
      { status: 401 },
    );
  });
  const env: FeedbackEnv & { GITHUB_TOKEN: string } = {
    ...appEnv,
    GITHUB_TOKEN: "legacy-personal-token",
    GITHUB_REPOSITORY: "zilvestro/grammai",
    FEEDBACK_LIMIT: {
      async limit() {
        return { success: true };
      },
    },
    GLOBAL_LIMIT: {
      async limit() {
        return { success: true };
      },
    },
  };
  const request = () =>
    new Request("https://feedback.example/v1/feedback", {
      method: "POST",
      headers: {
        Origin: `chrome-extension://${"a".repeat(32)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind: "bug",
        title: "Example report",
        description: "Steps to reproduce an example bug.",
        version: "0.6.6",
      }),
    });
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
  assert.equal(
    await response.text(),
    JSON.stringify({
      error: "Feedback is temporarily unavailable. Please use email.",
    }),
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
  assert.equal(
    calls,
    1,
    "legacy PAT is ignored when app configuration is missing",
  );
});
