#!/usr/bin/env node
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
  chmod,
} from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = { browserRoots: [] };
for (let i = 2; i < process.argv.length; i++) {
  const argument = process.argv[i];
  if (
    ![
      "--browser-root",
      "--extension-id",
      "--extension-path",
      "--install-dir",
    ].includes(argument) ||
    !process.argv[i + 1]
  )
    throw new Error(
      "Usage: node scripts/install-native.mjs [--browser-root PATH] [--extension-id ID] [--extension-path DIST] [--install-dir PATH]",
    );
  const value = process.argv[++i];
  if (argument === "--browser-root") options.browserRoots.push(resolve(value));
  else options[argument.slice(2)] = value;
}
if (process.platform !== "darwin" && !options.browserRoots.length)
  throw new Error("The bundled installer currently supports macOS.");
const extensionPath = resolve(
  options["extension-path"] || join(repository, "dist"),
);
const manifest = JSON.parse(
  await readFile(join(extensionPath, "manifest.json"), "utf8"),
);
const hash = createHash("sha256")
  .update(manifest.key ? Buffer.from(manifest.key, "base64") : extensionPath)
  .digest("hex")
  .slice(0, 32);
const extensionId =
  options["extension-id"] ||
  hash.replace(/[0-9a-f]/g, (char) =>
    String.fromCharCode(97 + parseInt(char, 16)),
  );
if (!/^[a-p]{32}$/.test(extensionId)) throw new Error("Invalid extension ID.");
const installDirectory = resolve(
  options["install-dir"] ||
    join(homedir(), "Library/Application Support/Quill/native"),
);
await mkdir(installDirectory, { recursive: true, mode: 0o700 });
await chmod(installDirectory, 0o700);
for (const file of await readdir(join(repository, "native")))
  if (file.endsWith(".mjs"))
    await copyFile(
      join(repository, "native", file),
      join(installDirectory, file),
    );
async function findExecutable(name) {
  const candidates = [
    join(homedir(), ".local/bin", name),
    "/opt/homebrew/bin/" + name,
    "/usr/local/bin/" + name,
    ...(process.env.PATH || "")
      .split(":")
      .filter(Boolean)
      .map((directory) => join(directory, name)),
  ];
  for (const path of candidates)
    try {
      await access(path, constants.X_OK);
      return resolve(path);
    } catch {
      /* Try next installed location. */
    }
  return null;
}
const providers = {
  claude: await findExecutable("claude"),
  codex: await findExecutable("codex"),
};
const configFile = join(installDirectory, "config.json");
await writeFile(
  configFile,
  JSON.stringify({ extensionId, providers }, null, 2) + "\n",
  { mode: 0o600 },
);
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const wrapper = join(installDirectory, "quill-host");
await writeFile(
  wrapper,
  `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(join(installDirectory, "host.mjs"))} ${shellQuote(configFile)} "$@"\n`,
  { mode: 0o700 },
);
await chmod(wrapper, 0o700);
const browserRoots = options.browserRoots.length
  ? options.browserRoots
  : [
      join(homedir(), "Library/Application Support/net.imput.helium"),
      join(homedir(), "Library/Application Support/Google/Chrome"),
      join(homedir(), "Library/Application Support/Chromium"),
    ];
for (const browserRoot of browserRoots) {
  const directory = join(browserRoot, "NativeMessagingHosts");
  await mkdir(directory, { recursive: true });
  const hostManifest = {
    name: "com.quill.assistant",
    description: "grammai local Claude/Codex rewrite bridge",
    path: wrapper,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
  const destination = join(directory, hostManifest.name + ".json");
  try {
    const previous = JSON.parse(await readFile(destination, "utf8"));
    if (
      previous.name !== hostManifest.name ||
      !/^(Quill|grammai) /.test(String(previous.description))
    )
      throw new Error(
        `Refusing to overwrite an unrelated native host: ${destination}`,
      );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await writeFile(destination, JSON.stringify(hostManifest, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log(`Registered ${destination}`);
}
console.log(`Extension: ${extensionId}`);
console.log(
  `Installed providers: ${
    Object.entries(providers)
      .filter(([, path]) => path)
      .map(([id]) => id)
      .join(", ") ||
    "none (install and authenticate a CLI, then rerun this installer)"
  }`,
);
console.log(
  "Reload grammai in chrome://extensions after installing. Text is sent to the selected AI provider only when you request a rewrite or translation.",
);
