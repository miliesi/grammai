import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

// Pinned, unmodified assets. Checking never downloads code or language data.
const packageRoot = "node_modules/lingotweaker-data-de";
const manifest = JSON.parse(
  await readFile(`${packageRoot}/manifest.json`, "utf8"),
);
const data = await readFile(
  `${packageRoot}/${manifest.languages.de.pack.file}`,
);
if (
  createHash("sha256").update(data).digest("hex") !==
  manifest.languages.de.pack.sha256
)
  throw new Error("German language pack checksum mismatch.");
await cp(
  `${packageRoot}/${manifest.languages.de.pack.file}`,
  "dist/german.pack.gz",
);
await cp(
  "node_modules/lingotweaker-wasm/web/lt_wasm_bg.wasm",
  "dist/german.wasm",
);
await mkdir("dist/licenses/german-data", { recursive: true });
const pack = gunzipSync(data);
if (pack.subarray(0, 5).toString() !== "LTPK1")
  throw new Error("Invalid German pack.");
let cursor = 9;
const notices = [];
for (let index = 0; index < pack.readUInt32LE(5); index++) {
  const pathLength = pack.readUInt16LE(cursor);
  cursor += 2;
  const name = pack.subarray(cursor, cursor + pathLength).toString();
  cursor += pathLength;
  const offset = Number(pack.readBigUInt64LE(cursor));
  const length = Number(pack.readBigUInt64LE(cursor + 8));
  cursor += 16;
  if (/(?:COPYING|LICENSE|README)/i.test(name)) {
    const filename = name.replaceAll("/", "_");
    await writeFile(
      `dist/licenses/german-data/${filename}`,
      pack.subarray(offset, offset + length),
    );
    notices.push(filename);
  }
}
await writeFile(
  "dist/licenses/german-data/manifest.json",
  JSON.stringify({ ...manifest, notices }, null, 2),
);
