interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface FeedbackEnv {
  GITHUB_TOKEN?: string;
  GITHUB_REPOSITORY: string;
  FEEDBACK_LIMIT: RateLimiter;
  GLOBAL_LIMIT: RateLimiter;
}

const MAX_BYTES = 24000;
const extensionOrigin = /^chrome-extension:\/\/[a-p]{32}$/;

export default {
  async fetch(request: Request, env: FeedbackEnv): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    });
    if (extensionOrigin.test(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
    }
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers });
    if (new URL(request.url).pathname !== "/v1/feedback")
      return reply(404, { error: "Not found." });
    if (!extensionOrigin.test(origin))
      return reply(403, { error: "Open the feedback form in grammai." });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST") {
      headers.set("Allow", "POST, OPTIONS");
      return reply(405, { error: "Use POST to send feedback." });
    }
    if (!env.GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY))
      return reply(503, {
        error: "Feedback is temporarily unavailable. Please use email.",
      });
    if (
      request.headers.get("Content-Type")?.split(";")[0].trim() !==
      "application/json"
    )
      return reply(415, { error: "Send feedback as JSON." });

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
        if (size > MAX_BYTES) {
          await reader.cancel();
          return reply(413, { error: "Please shorten your report." });
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
      try {
        data = JSON.parse(new TextDecoder().decode(bytes));
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

      const result = await fetch(
        `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/issues`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "grammai-feedback",
            "X-GitHub-Api-Version": "2026-03-10",
          },
          body: JSON.stringify({
            title: data.title.trim(),
            body: `${data.description.trim()}\n\n---\nType: ${data.kind === "bug" ? "Bug report" : "Feature idea"}\ngrammai version: ${data.version}\nSubmitted from the grammai feedback form.`,
            labels: [data.kind === "bug" ? "bug" : "enhancement"],
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (result.status !== 201)
        return reply(502, {
          error:
            "Your report could not be saved. Please try again later or use email.",
        });
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
    }
  },
};
