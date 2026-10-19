import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

// Pinned, unmodified LingoTweaker assets (the file keeps its name for
// compatibility; it prepares every language the engine checks).
// Checking never downloads code or language data.
const languages = [
  { code: "de", name: "German", pack: "german", licenses: "german-data" },
  { code: "ro", name: "Romanian", pack: "romanian", licenses: "romanian-data" },
];

await cp(
  "node_modules/lingotweaker-wasm/web/lt_wasm_bg.wasm",
  "dist/german.wasm",
);

for (const { code, name, pack: packName, licenses } of languages) {
  const packageRoot = `node_modules/lingotweaker-data-${code}`;
  const manifest = JSON.parse(
    await readFile(`${packageRoot}/manifest.json`, "utf8"),
  );
  const data = await readFile(
    `${packageRoot}/${manifest.languages[code].pack.file}`,
  );
  if (
    createHash("sha256").update(data).digest("hex") !==
    manifest.languages[code].pack.sha256
  )
    throw new Error(`${name} language pack checksum mismatch.`);
  await cp(
    `${packageRoot}/${manifest.languages[code].pack.file}`,
    `dist/${packName}.pack.gz`,
  );
  await mkdir(`dist/licenses/${licenses}`, { recursive: true });
  const pack = gunzipSync(data);
  if (pack.subarray(0, 5).toString() !== "LTPK1")
    throw new Error(`Invalid ${name} pack.`);
  let cursor = 9;
  const notices = [];
  for (let index = 0; index < pack.readUInt32LE(5); index++) {
    const pathLength = pack.readUInt16LE(cursor);
    cursor += 2;
    const file = pack.subarray(cursor, cursor + pathLength).toString();
    cursor += pathLength;
    const offset = Number(pack.readBigUInt64LE(cursor));
    const length = Number(pack.readBigUInt64LE(cursor + 8));
    cursor += 16;
    if (/(?:COPYING|LICENSE|README)/i.test(file)) {
      const filename = file.replaceAll("/", "_");
      await writeFile(
        `dist/licenses/${licenses}/${filename}`,
        pack.subarray(offset, offset + length),
      );
      notices.push(filename);
    }
  }
  await writeFile(
    `dist/licenses/${licenses}/data-notices.json`,
    JSON.stringify({ ...manifest, notices }, null, 2),
  );
}
