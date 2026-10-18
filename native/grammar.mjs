const endpoint = "http://127.0.0.1:17861/v2/check";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
/** The browser can only reach this service through its registered native host. */
export async function checkGerman(text, signal) {
  const data = join(homedir(), "Library/Application Support/Quill/languages");
  try {
    await readFile(join(data, "ready.json"));
  } catch {
    try {
      const state = JSON.parse(
        await readFile(join(data, "starting.json"), "utf8"),
      );
      if (Date.now() - state.startedAt < 180000)
        return {
          ok: false,
          retryAfterMs: 2000,
          error: {
            code: "GERMAN_WARMING",
            message: "German checker is starting…",
          },
        };
    } catch {}
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: new URLSearchParams({ language: "de-DE", text, level: "default" }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(6000)])
        : AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("Check failed");
    const result = await response.json();
    if (!Array.isArray(result.matches)) throw new Error("Invalid check result");
    return {
      ok: true,
      matches: result.matches,
      language: "de",
      engine: "LanguageTool",
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "GERMAN_UNAVAILABLE",
        message:
          "German checker unavailable. Run npm run install:languages and npm run install:native, then reload grammai.",
      },
    };
  }
}
