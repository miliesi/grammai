import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { unzipSync, zipSync, strToU8 } from "fflate";

const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--upstream" || args[2] !== "--output")
  throw new Error(
    "Usage: node scripts/package-source.mjs --upstream PINNED_SOURCE_TAR_GZ --output SOURCE_ZIP",
  );
const upstream = await readFile(args[1]);
if (
  createHash("sha256").update(upstream).digest("hex") !==
  "8bce313f4d174b0a56136498eaa1396d017cac60390fecdd02a03e590c1498dc"
)
  throw new Error(
    "The upstream source archive does not match the pinned release.",
  );
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
// Only committed, reviewed files enter the release. Ignored local files never do.
execFileSync("git", ["diff", "--exit-code", "HEAD"], { stdio: "pipe" });
const tracked = unzipSync(
  execFileSync("git", ["archive", "--format=zip", "HEAD"], {
    maxBuffer: 20 * 1024 * 1024,
  }),
);
const fixedTime = new Date("2020-01-01T00:00:00Z");
const prefix = `grammai-${version}/`;
const files = {};
for (const [name, bytes] of Object.entries(tracked)) {
  if (/^(?:artifacts|research|node_modules|dist|\.claude|awake)\//.test(name))
    throw new Error(`Unexpected private/build directory in source: ${name}`);
  files[prefix + name] = [bytes, { mtime: fixedTime }];
}
files[prefix + "third_party/lingotweaker-0.2.8-source.tar.gz"] = [
  new Uint8Array(upstream),
  { level: 0, mtime: fixedTime },
];
files[prefix + "SOURCE-MANIFEST.json"] = [
  strToU8(
    JSON.stringify(
      {
        version,
        commit,
        repository: "https://github.com/zilvestro/grammai",
        upstream: {
          commit: "819dc354224c9087ff486708adfd413ecb45f466",
          url: "https://codeload.github.com/fiduswriter/LingoTweaker/tar.gz/819dc354224c9087ff486708adfd413ecb45f466",
          sha256: createHash("sha256").update(upstream).digest("hex"),
        },
      },
      null,
      2,
    ) + "\n",
  ),
  { mtime: fixedTime },
];
const output = path.resolve(args[3]);
await mkdir(path.dirname(output), { recursive: true });
const zip = zipSync(files, { level: 9 });
await writeFile(output, zip, { flag: "wx" });
console.log(
  `Created ${path.basename(output)} (${(zip.length / 1e6).toFixed(1)} MB; source commit ${commit}).`,
);
