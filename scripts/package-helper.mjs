import { readFile, readdir, writeFile } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function packageHelper() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const files = {};
  for (const name of await readdir(path.join(root, "native"))) {
    if (name.endsWith(".mjs"))
      files[`native/${name}`] = new Uint8Array(
        await readFile(path.join(root, "native", name)),
      );
  }
  for (const name of ["install-native.mjs"])
    files[`scripts/${name}`] = new Uint8Array(
      await readFile(path.join(root, "scripts", name)),
    );
  files["dist/manifest.json"] = new Uint8Array(
    await readFile(path.join(root, "public/manifest.json")),
  );
  files["LICENSE"] = new Uint8Array(await readFile(path.join(root, "LICENSE")));
  files["SOURCE.txt"] = new Uint8Array(
    await readFile(path.join(root, "public/SOURCE.txt")),
  );
  files["README.txt"] = strToU8(
    `grammai optional AI helper\n\nRequires macOS and Node.js 22 or newer.\nOpen grammai's AI setup guide in your extension for the installation command.\nThe command passes that extension's ID explicitly; do not use the path-derived development ID.\n\nThis helper is only for optional AI actions through an installed, signed-in Claude Code or Codex CLI. The provider's account limits apply.\nEnglish and German spelling and grammar run inside the extension without this helper or any additional software.\nThis package contains no account credentials, API keys, or language model.\n\nFeedback: grammai@zaapp.io\n`,
  );
  await writeFile(
    path.join(root, "dist/grammai-helper.zip"),
    zipSync(files, { level: 9 }),
  );
}
