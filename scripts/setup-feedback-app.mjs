import { createServer } from "node:http";
import { createPrivateKey, randomBytes, sign } from "node:crypto";
import { spawn } from "node:child_process";

const repository = "zilvestro/grammai";
const workerName = "grammai-feedback";
const port = Number(process.env.GRAMMAI_APP_SETUP_PORT || 4176);
const state = randomBytes(32).toString("hex");
const base = `http://127.0.0.1:${port}`;
const headers = {
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "User-Agent": workerName,
  "X-GitHub-Api-Version": "2026-03-10",
};
let app;
let busy = false;
let configured = false;

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const manifest = {
  name: "grammai feedback",
  url: `https://github.com/${repository}`,
  description:
    "Collects public bugs and ideas submitted explicitly through the grammai extension.",
  redirect_url: `${base}/created`,
  setup_url: `${base}/installed/${state}`,
  hook_attributes: {
    url: "https://grammai-feedback.grammai.workers.dev/github-events",
    active: false,
  },
  public: false,
  default_permissions: { issues: "write" },
  default_events: [],
  request_oauth_on_install: false,
};

async function api(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`GitHub request failed (${response.status}).`);
  return response.json();
}
function appJwt() {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: app.id })}`;
  return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), app.key).toString("base64url")}`;
}
function wrangler(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["--yes", "wrangler@4.151.3", ...args, "--name", workerName],
      {
        stdio: ["pipe", "inherit", "inherit"],
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Wrangler configuration failed.")),
    );
    // Credentials travel only through stdin, never argv, logs or a source file.
    child.stdin.on("error", () => {});
    child.stdin.end(input || "");
  });
}
function page(response, content, status = 200) {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action https://github.com; base-uri 'none'; frame-ancestors 'none'",
  });
  response.end(
    `<!doctype html><meta charset="utf-8"><title>grammai feedback bot setup</title><style>body{font:16px/1.6 system-ui;max-width:660px;margin:64px auto;padding:24px}button,a{font:inherit}button{padding:12px 20px;cursor:pointer}code{overflow-wrap:anywhere}</style><h1>grammai feedback bot</h1>${content}`,
  );
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" || request.headers.host !== `127.0.0.1:${port}`)
    return page(response, "<p>Not found.</p>", 404);
  const url = new URL(request.url, base);
  try {
    if (url.pathname === "/" && url.searchParams.get("setup") === state) {
      return page(
        response,
        `<p>Create a private GitHub App with <strong>Issues: Read and write</strong>. No user authorization, code access or webhooks are requested.</p><p>On installation, choose <strong>Only select repositories → zilvestro/grammai</strong>.</p><form method="post" action="https://github.com/settings/apps/new?state=${state}"><input type="hidden" name="manifest" value="${escape(JSON.stringify(manifest))}"><button>Create feedback app on GitHub</button></form>`,
      );
    }
    if (
      url.pathname === "/created" &&
      url.searchParams.get("state") === state &&
      url.searchParams.get("code") &&
      !app &&
      !busy
    ) {
      busy = true;
      try {
        const data = await api(
          `/app-manifests/${encodeURIComponent(url.searchParams.get("code"))}/conversions`,
          { method: "POST" },
        );
        if (
          !data.id ||
          !data.pem ||
          !/^[a-z0-9-]+$/.test(data.slug) ||
          data.owner?.login !== "zilvestro" ||
          data.permissions?.issues !== "write" ||
          Object.keys(data.permissions).some(
            (key) => !["issues", "metadata"].includes(key),
          )
        )
          throw new Error(
            "App registration did not match the expected owner or permissions.",
          );
        app = {
          id: String(data.id),
          slug: data.slug,
          key: createPrivateKey(data.pem)
            .export({ type: "pkcs8", format: "pem" })
            .toString(),
        };
        console.log(
          `App created: ${app.slug}. Install it only on ${repository}.`,
        );
      } finally {
        busy = false;
      }
      return page(
        response,
        `<p>App created. The private key is held only in this setup process.</p><p>Install it on <strong>Only select repositories → zilvestro/grammai</strong>.</p><a href="https://github.com/apps/${app.slug}/installations/new">Install feedback app</a>`,
      );
    }
    if (url.pathname === `/installed/${state}` && app) {
      if (configured)
        return page(response, "<p>Setup complete. You can close this tab.</p>");
      if (busy)
        return page(
          response,
          "<p>Setup is in progress. Wait a moment, then reload.</p>",
        );
      busy = true;
      try {
        const authorization = `Bearer ${appJwt()}`;
        const installation = await api(`/repos/${repository}/installation`, {
          headers: { Authorization: authorization },
        });
        if (
          String(installation.app_id) !== app.id ||
          installation.account?.login !== "zilvestro" ||
          installation.repository_selection !== "selected"
        )
          throw new Error(
            "Install this app using Only select repositories → zilvestro/grammai.",
          );
        // A temporary token checks the complete installation, before the Worker
        // starts issuing its own narrower, issue-only, single-repository tokens.
        const access = await api(
          `/app/installations/${installation.id}/access_tokens`,
          {
            method: "POST",
            headers: { Authorization: authorization },
            body: JSON.stringify({ permissions: { issues: "write" } }),
          },
        );
        const repositories = await api("/installation/repositories", {
          headers: { Authorization: `Bearer ${access.token}` },
        });
        if (
          repositories.total_count !== 1 ||
          repositories.repositories?.[0]?.full_name !== repository
        )
          throw new Error(
            "The app must be installed on zilvestro/grammai only. Adjust its repository access, then reload this page.",
          );
        await wrangler(
          ["secret", "bulk"],
          JSON.stringify({
            GITHUB_APP_ID: app.id,
            GITHUB_APP_INSTALLATION_ID: String(installation.id),
            GITHUB_APP_PRIVATE_KEY: app.key,
          }),
        );
        configured = true;
        app.key = undefined;
        console.log(
          `Bot configured: ${app.slug}[bot]. No report was posted. Finish deploying the app-only Worker and remove the legacy GITHUB_TOKEN secret.`,
        );
        return page(
          response,
          `<p>Done. <strong>${escape(app.slug)}[bot]</strong> is configured for ${repository}. Credentials were passed directly to Cloudflare and were not saved to disk or shown here. No issue was created.</p>`,
        );
      } finally {
        busy = false;
      }
    }
    return page(response, "<p>Not found.</p>", 404);
  } catch (error) {
    // Report only our fixed operational messages; never GitHub response bodies,
    // request URLs (which contain conversion codes), tokens or private keys.
    const message =
      error instanceof Error &&
      /^(GitHub request failed|App registration did not match|Install this app using|The app must be installed|Wrangler configuration failed)/.test(
        error.message,
      )
        ? error.message
        : "Setup could not finish. Check the local terminal and try again.";
    console.error(message);
    return page(response, `<p>${escape(message)}</p>`, 502);
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Open ${base}/?setup=${state}`),
);
server.on("error", () => {
  console.error(
    "Could not start the local setup server. Choose another GRAMMAI_APP_SETUP_PORT.",
  );
  process.exitCode = 1;
});
process.once("SIGINT", () => {
  app = undefined;
  server.close();
});
