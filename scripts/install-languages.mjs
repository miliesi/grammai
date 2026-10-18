#!/usr/bin/env node
import {
  access,
  mkdir,
  writeFile,
  copyFile,
  readFile,
  rm,
} from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
if (process.platform !== "darwin")
  throw new Error("The German checker installer currently supports macOS.");
const home = homedir();
const data = join(home, "Library/Application Support/Quill/languages");
let java, jar;
try {
  const formula = (name) =>
    execFileSync("brew", ["--prefix", name], { encoding: "utf8" }).trim();
  java = join(
    formula("openjdk@17"),
    "libexec/openjdk.jdk/Contents/Home/bin/java",
  );
  jar = join(formula("languagetool"), "libexec/languagetool-server.jar");
} catch {
  throw new Error("Install Homebrew and run: brew install languagetool");
}
try {
  await access(java, constants.X_OK);
  await access(jar, constants.R_OK);
} catch {
  throw new Error(
    "Install the local German engine first: brew install languagetool",
  );
}
await mkdir(data, { recursive: true, mode: 0o700 });
const properties = join(data, "server.properties");
await writeFile(
  properties,
  `maxTextLength=20000\nmaxTextHardLength=20000\nmaxCheckTimeMillis=120000\nmaxCheckThreads=2\nmaxWorkQueueSize=8\ncacheSize=500\ncacheTTLSeconds=120\npipelineCaching=true\nmaxPipelinePoolSize=2\n`,
  { mode: 0o600 },
);
const label = "com.quill.languages";
const directory = join(home, "Library/LaunchAgents");
await mkdir(directory, { recursive: true });
const plist = join(directory, `${label}.plist`);
const xml = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const javaArgs = [
  "-Xms64m",
  "-Xmx512m",
  "-cp",
  jar,
  "org.languagetool.server.HTTPServer",
  "--config",
  properties,
  "--port",
  "17861",
];
const readyFile = join(data, "ready.json");
const configPath = join(data, "service.json");
const serverScript = join(data, "server.mjs");
await copyFile(
  fileURLToPath(new URL("../native/language-server.mjs", import.meta.url)),
  serverScript,
);
await writeFile(
  configPath,
  JSON.stringify({ java, args: javaArgs, readyFile }),
  { mode: 0o600 },
);
const args = [process.execPath, serverScript, configPath];
await writeFile(
  plist,
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map((s) => `<string>${xml(s)}</string>`).join("")}</array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ProcessType</key><string>Background</string><key>ThrottleInterval</key><integer>10</integer><key>StandardOutPath</key><string>/dev/null</string><key>StandardErrorPath</key><string>/dev/null</string></dict></plist>\n`,
  { mode: 0o600 },
);
const domain = `gui/${process.getuid()}`;
await rm(readyFile, { force: true });
try {
  execFileSync("/bin/launchctl", ["bootout", `${domain}/${label}`], {
    stdio: "pipe",
  });
} catch {}
for (let attempt = 0; attempt < 20; attempt++) {
  try {
    execFileSync("/bin/launchctl", ["bootstrap", domain, plist], {
      stdio: "pipe",
    });
    break;
  } catch (error) {
    if (attempt === 19) throw error;
    await new Promise((r) => setTimeout(r, 100));
  }
}
// The persistent helper prewarms the real spelling path after every login.
const deadline = Date.now() + 150000;
let result;
while (Date.now() < deadline) {
  try {
    result = JSON.parse(await readFile(readyFile, "utf8"));
    if (result.readyAt && Date.now() - result.readyAt < 150000) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!result?.readyAt)
  throw new Error("The German checker is still warming up. Retry shortly.");
console.log(
  `German checker ready: LanguageTool ${result.version} on localhost:17861.`,
);
console.log(
  `Starts and prewarms at login through ${plist}. No cloud checks; no public listener or browser CORS access.`,
);
