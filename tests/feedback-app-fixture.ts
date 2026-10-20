import { generateKeyPairSync } from "node:crypto";
import type { TestContext } from "node:test";

// Generated afresh for tests; no real credential is stored in the repository.
export const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
export const appEnv = {
  GITHUB_APP_ID: "12345",
  GITHUB_APP_INSTALLATION_ID: "67890",
  GITHUB_APP_PRIVATE_KEY: privateKey
    .export({ format: "pem", type: "pkcs8" })
    .toString(),
};
export function mockGitHub(
  t: TestContext,
  issue: (url: unknown, init?: RequestInit) => Promise<Response>,
) {
  return t.mock.method(
    globalThis,
    "fetch",
    async (url: unknown, init?: RequestInit) => {
      if (
        url === "https://api.github.com/app/installations/67890/access_tokens"
      )
        return Response.json(
          {
            token: "test-installation-token",
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          },
          { status: 201 },
        );
      return issue(url, init);
    },
  );
}
