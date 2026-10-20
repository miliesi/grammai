export interface GitHubAppEnv {
  GITHUB_APP_ID?: string;
  GITHUB_APP_INSTALLATION_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
}

export const githubHeaders = {
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "User-Agent": "grammai-feedback",
  "X-GitHub-Api-Version": "2026-03-10",
};

export function appConfigured(env: GitHubAppEnv): boolean {
  return !!(
    env.GITHUB_APP_ID &&
    /^\d+$/.test(env.GITHUB_APP_INSTALLATION_ID || "") &&
    env.GITHUB_APP_PRIVATE_KEY
  );
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Only installation authentication is supported. No personal-token fallback:
// every issue must be attributed to the app's bot, never to its owner.
export async function installationToken(
  env: GitHubAppEnv,
  repository: string,
): Promise<string> {
  if (!appConfigured(env)) throw new Error("App is not configured");
  const pem = env.GITHUB_APP_PRIVATE_KEY!.trim();
  if (!pem.startsWith("-----BEGIN PRIVATE KEY-----"))
    throw new Error("Expected a PKCS8 private key");
  const der = Uint8Array.from(
    atob(pem.replace(/-----[A-Z ]+-----|\s/g, "")),
    (character) => character.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) =>
    base64url(new TextEncoder().encode(JSON.stringify(value)));
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iat: now - 60,
    exp: now + 540,
    iss: env.GITHUB_APP_ID,
  })}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const response = await fetch(
    `https://api.github.com/app/installations/${env.GITHUB_APP_INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      headers: {
        ...githubHeaders,
        Authorization: `Bearer ${unsigned}.${base64url(new Uint8Array(signature))}`,
      },
      // Narrow each short-lived token even if installation access is expanded.
      body: JSON.stringify({
        repositories: [repository.split("/")[1]],
        permissions: { issues: "write" },
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (response.status !== 201) throw new Error("App authentication failed");
  const result = (await response.json()) as {
    token?: unknown;
    expires_at?: unknown;
  };
  if (
    typeof result.token !== "string" ||
    !result.token ||
    typeof result.expires_at !== "string" ||
    !(Date.parse(result.expires_at) > Date.now() + 60000)
  )
    throw new Error("Invalid installation token response");
  return result.token;
}
