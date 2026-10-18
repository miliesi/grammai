import { build } from "esbuild";
import { mkdir, rm, cp, readFile, writeFile } from "node:fs/promises";
await import("./prepare-dictionaries.mjs");
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await cp(
  "node_modules/harper.js/dist/harper_wasm_slim_bg.wasm",
  "dist/harper_wasm_slim_bg.wasm",
);
await import("./prepare-german.mjs");
await build({
  entryPoints: [
    "src/background.ts",
    "src/content.ts",
    "src/popup.ts",
    "src/options.ts",
    "src/sidepanel.ts",
    "src/help.ts",
    "src/german-worker.ts",
    "src/grammar-offscreen.ts",
  ],
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome120",
  // Harper also supports Node. Remove its filesystem loader from the browser build.
  define: { process: "undefined" },
  sourcemap: true,
  legalComments: "none",
});
const demo = await readFile("dist/demo.html", "utf8");
await writeFile(
  "dist/demo.html",
  demo.replace("</body>", '<script src="content.js" defer></script></body>'),
);
await (await import("./package-helper.mjs")).packageHelper();
console.log("Built Chrome/Helium extension and local helper → dist/");
