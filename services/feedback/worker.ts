import {
  appConfigured,
  githubHeaders,
  installationToken,
  type GitHubAppEnv,
} from "./github-app";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface ImageBucket {
  put(
    key: string,
    value: Uint8Array,
    options: { httpMetadata: { contentType: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
  delete(keys: string[]): Promise<void>;
}

export interface FeedbackEnv extends GitHubAppEnv {
  GITHUB_REPOSITORY: string;
  FEEDBACK_LIMIT: RateLimiter;
  GLOBAL_LIMIT: RateLimiter;
  FEEDBACK_IMAGES?: ImageBucket;
}

const MAX_BYTES = 24000;
const IMAGE_BYTES = 2 * 1024 * 1024;
const extensionOrigin = /^chrome-extension:\/\/[a-p]{32}$/;

function validPng(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || !signature.every((value, i) => bytes[i] === value))
    return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452)
    return false;
  const width = view.getUint32(16),
    height = view.getUint32(20);
  return width > 0 && height > 0 && width * height <= 16000000;
}

export default {
  async fetch(request: Request, env: FeedbackEnv): Promise<Response> {
    const url = new URL(request.url);
    // GitHub's image proxy must be able to read these without an extension
    // origin or credentials. No list, arbitrary object path or public PUT API.
    const imagePath = /^\/images\/([a-f0-9-]{36}\.png)$/.exec(url.pathname);
    if (imagePath && (request.method === "GET" || request.method === "HEAD")) {
      try {
        const object = await env.FEEDBACK_IMAGES?.get(imagePath[1]);
        if (!object) return new Response("Not found", { status: 404 });
        return new Response(request.method === "HEAD" ? null : object.body, {
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(object.size),
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch {
        return new Response("Temporarily unavailable", { status: 503 });
      }
    }
    const origin = request.headers.get("Origin") || "";
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    });
    if (extensionOrigin.test(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
    }
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers });
    if (url.pathname !== "/v1/feedback")
      return reply(404, { error: "Not found." });
    // Host-permitted extension GETs may omit Origin. This public capability
    // flag contains no report data and does not accept uploads.
    if (request.method === "GET")
      return reply(200, { images: !!env.FEEDBACK_IMAGES });
    if (!extensionOrigin.test(origin))
      return reply(403, { error: "Open the feedback form in grammai." });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST") {
      headers.set("Allow", "GET, POST, OPTIONS");
      return reply(405, { error: "Use POST to send feedback." });
    }
    if (
      !appConfigured(env) ||
      !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY)
    )
      return reply(503, {
        error: "Feedback is temporarily unavailable. Please use email.",
      });
    const contentType = request.headers.get("Content-Type") || "";
    const multipart =
      contentType.split(";")[0].trim() === "multipart/form-data";
    if (!multipart && contentType.split(";")[0].trim() !== "application/json")
      return reply(415, { error: "Send feedback as JSON or form data." });

    const stored: string[] = [];
    let submittedToGitHub = false;
    try {
      // Anonymous reports have no account ID. Bound both per-network traffic
      // and total submissions before reading a body or calling GitHub.
      const perNetwork = await env.FEEDBACK_LIMIT.limit({
        key: request.headers.get("CF-Connecting-IP") || "unknown",
      });
      if (
        !perNetwork.success ||
        !(await env.GLOBAL_LIMIT.limit({ key: "feedback" })).success
      ) {
        headers.set("Retry-After", "60");
        return reply(429, {
          error: "Too many reports. Please wait a minute and try again.",
        });
      }
      const reader = request.body?.getReader();
      if (!reader) return reply(400, { error: "Add a title and description." });
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > (multipart ? 2 * IMAGE_BYTES + MAX_BYTES : MAX_BYTES)) {
          await reader.cancel();
          return reply(413, {
            error:
              "Your report is too large. Shorten it or use smaller images.",
          });
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      let data;
      let files: FormDataEntryValue[] = [];
      try {
        if (multipart) {
          const form = await new Response(bytes, {
            headers: { "Content-Type": contentType },
          }).formData();
          data = Object.fromEntries(
            ["kind", "title", "description", "version"].map((key) => [
              key,
              form.get(key),
            ]),
          );
          files = form.getAll("images");
        } else data = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return reply(400, { error: "Invalid feedback. Please try again." });
      }
      if (
        !data ||
        (data.kind !== "bug" && data.kind !== "idea") ||
        typeof data.title !== "string" ||
        data.title.trim().length < 3 ||
        data.title.trim().length > 120 ||
        typeof data.description !== "string" ||
        data.description.trim().length < 10 ||
        data.description.trim().length > 6000 ||
        typeof data.version !== "string" ||
        !/^\d+(?:\.\d+){1,3}$/.test(data.version)
      )
        return reply(400, {
          error:
            "Choose a type, a title (3–120 characters) and a description (10–6,000 characters).",
        });

      if (files.length > 2)
        return reply(400, { error: "Attach up to 2 screenshots." });
      if (files.length && !env.FEEDBACK_IMAGES)
        return reply(503, {
          error:
            "Screenshot uploads are unavailable. Remove the images to send your report, or use email.",
        });
      const imageBytes: Uint8Array[] = [];
      for (const file of files) {
        if (
          typeof file === "string" ||
          file.type !== "image/png" ||
          file.size > IMAGE_BYTES
        )
          return reply(400, {
            error: "Each screenshot must be a PNG image of 2 MB or less.",
          });
        const image = new Uint8Array(await file.arrayBuffer());
        if (!validPng(image))
          return reply(400, {
            error: "This screenshot is not a supported PNG image.",
          });
        imageBytes.push(image);
      }
      // Authenticate before saving any images. App failures create no orphan
      // uploads and cannot fall back to publishing as a personal account.
      let token: string;
      try {
        token = await installationToken(env, env.GITHUB_REPOSITORY);
      } catch {
        return reply(503, {
          error: "Feedback is temporarily unavailable. Please use email.",
        });
      }
      for (const image of imageBytes) {
        const key = `${crypto.randomUUID()}.png`;
        // Record the key first so a partially failed upload is also cleaned up.
        stored.push(key);
        await env.FEEDBACK_IMAGES!.put(key, image, {
          httpMetadata: { contentType: "image/png" },
        });
      }
      const screenshots = stored.length
        ? "\n\n### Screenshots\n\n" +
          stored
            .map(
              (key, i) => `![Screenshot ${i + 1}](${url.origin}/images/${key})`,
            )
            .join("\n\n")
        : "";
      submittedToGitHub = true;
      const result = await fetch(
        `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/issues`,
        {
          method: "POST",
          headers: {
            ...githubHeaders,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: data.title.trim(),
            body: `${data.description.trim()}${screenshots}\n\n---\nType: ${data.kind === "bug" ? "Bug report" : "Feature idea"}\ngrammai version: ${data.version}\nSubmitted from the grammai feedback form.`,
            labels: [data.kind === "bug" ? "bug" : "enhancement"],
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (result.status !== 201) {
        // A GitHub 4xx definitively rejects creation. Preserve images after an
        // ambiguous server error: an issue might already reference them.
        if (result.status >= 400 && result.status < 500)
          submittedToGitHub = false;
        return reply(502, {
          error:
            result.status >= 500
              ? "Delivery could not be confirmed. Check existing issues before sending again, or use email."
              : "Your report could not be saved. Please try again later or use email.",
        });
      }
      const issue = (await result.json()) as {
        number?: unknown;
        html_url?: unknown;
      };
      if (
        !Number.isSafeInteger(issue.number) ||
        Number(issue.number) < 1 ||
        issue.html_url !==
          `https://github.com/${env.GITHUB_REPOSITORY}/issues/${issue.number}`
      )
        return reply(502, {
          error:
            "Delivery could not be confirmed. Check existing issues before sending again.",
        });
      return reply(201, { number: issue.number, url: issue.html_url });
    } catch {
      // Do not log drafts, client IPs or the server-side token.
      return reply(503, {
        error:
          "Delivery could not be confirmed. Check existing issues before sending again, or use email.",
      });
    } finally {
      if (stored.length && !submittedToGitHub) {
        try {
          await env.FEEDBACK_IMAGES!.delete(stored);
        } catch {
          /* Do not log report data. */
        }
      }
    }
  },
};
