import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createLtChecker } from "../src/lt-engine";

test("German and Romanian remain usable after concurrent cold starts, including after a failed initialization", async () => {
  const [wasmFile, germanPack, romanianPack] = await Promise.all([
    readFile("node_modules/lingotweaker-wasm/web/lt_wasm_bg.wasm"),
    readFile("node_modules/lingotweaker-data-de/packs/de.pack.gz"),
    readFile("node_modules/lingotweaker-data-ro/packs/ro.pack.gz"),
  ]);
  const wasm = Uint8Array.from(wasmFile).buffer;
  const dePack = gunzipSync(germanPack);
  const roPack = gunzipSync(romanianPack);
  const german = createLtChecker("de", async () => ({ wasm, pack: dePack }));
  let romanianLoads = 0;
  const romanian = createLtChecker("ro", async () => ({
    wasm: romanianLoads++ === 0 ? new ArrayBuffer(0) : wasm,
    pack: roPack,
  }));
  const germanText = "Ich habe ein Fehler gemacht.";
  const romanianText = "Aceasta este o propozitie gresita.";

  await assert.rejects(romanian.check(romanianText), WebAssembly.CompileError);

  // Both packs are ready before starting, so file/decompression timing cannot
  // accidentally serialize initialization and hide the shared-runtime race.
  await Promise.all([german.check(germanText), romanian.check(romanianText)]);

  // First requests can succeed even when a second initialization invalidates
  // an engine's pointers. Reuse both engines to expose that corruption.
  for (let repeat = 0; repeat < 3; repeat++) {
    const [de, ro] = await Promise.all([
      german.check(germanText),
      romanian.check(romanianText),
    ]);
    assert(
      de.some(
        (issue) =>
          issue.original === "ein Fehler" &&
          issue.replacements[0] === "einen Fehler",
      ),
      JSON.stringify(de),
    );
    assert(
      ro.some(
        (issue) =>
          issue.original === "propozitie" &&
          issue.replacements[0] === "propoziție",
      ),
      JSON.stringify(ro),
    );
  }
});
