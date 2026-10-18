import { spawn } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
const config = JSON.parse(await readFile(process.argv[2], "utf8"));
await rm(config.readyFile, { force: true });
await writeFile(
  config.readyFile.replace("ready.json", "starting.json"),
  JSON.stringify({ startedAt: Date.now() }),
  { mode: 0o600 },
);
const java = spawn(config.java, config.args, { stdio: "ignore", shell: false });
let stopping = false;
function stop() {
  stopping = true;
  java.kill("SIGTERM");
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
java.on("error", () => process.exit(1));
java.on("exit", (code) => process.exit(stopping ? 0 : code || 1));
// German spelling constructs a supplemental dictionary lazily. Warm a real typo,
// not just a clean sentence, before declaring the checker ready after login.
while (!stopping) {
  try {
    const response = await fetch("http://127.0.0.1:17861/v2/check", {
      method: "POST",
      body: new URLSearchParams({
        language: "de-DE",
        text: "Das ist ein Beispeil. Ich habe ein Fehler gemacht.",
      }),
      signal: AbortSignal.timeout(125000),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.matches?.some((m) => m.rule?.issueType === "misspelling")) {
        await writeFile(
          config.readyFile,
          JSON.stringify({
            version: result.software?.version,
            readyAt: Date.now(),
          }),
          { mode: 0o600 },
        );
        break;
      }
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 3000));
}
