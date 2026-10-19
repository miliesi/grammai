// Worker for every language checked by the bundled LingoTweaker engine (the
// file name is kept for the Store package). Each language loads its own data
// pack on first use; the WebAssembly binary is shared.
import { createLtChecker, type LtLanguage } from "./lt-engine";

const packs: Record<LtLanguage, string> = {
  de: "german.pack.gz",
  ro: "romanian.pack.gz",
};

let wasm: Promise<ArrayBuffer> | undefined;
function loadWasm() {
  return (wasm ??= fetch("german.wasm")
    .then((response) => {
      if (!response.ok) throw new Error("Missing packaged grammar assets.");
      return response.arrayBuffer();
    })
    .catch((error) => {
      wasm = undefined;
      throw error;
    }));
}

async function loadPack(language: LtLanguage) {
  const response = await fetch(packs[language]);
  if (!response.ok) throw new Error("Missing packaged grammar assets.");
  const compressed = await response.arrayBuffer();
  const bytes = new Uint8Array(compressed);
  return bytes[0] === 0x1f && bytes[1] === 0x8b
    ? new Uint8Array(
        await new Response(
          new Blob([compressed])
            .stream()
            .pipeThrough(new DecompressionStream("gzip")),
        ).arrayBuffer(),
      )
    : bytes;
}

const checkers = new Map<LtLanguage, ReturnType<typeof createLtChecker>>();
function checkerFor(language: LtLanguage) {
  let checker = checkers.get(language);
  if (!checker) {
    checker = createLtChecker(language, async () => {
      const [wasmBytes, pack] = await Promise.all([
        loadWasm(),
        loadPack(language),
      ]);
      return { wasm: wasmBytes, pack };
    });
    checkers.set(language, checker);
  }
  return checker;
}

self.onmessage = async ({ data }) => {
  try {
    if (typeof data.text !== "string" || data.text.length > 20000)
      throw new Error("Invalid draft length.");
    if (data.language !== "de" && data.language !== "ro")
      throw new Error("Unsupported language.");
    const issues = await checkerFor(data.language).check(
      data.text,
      data.options,
    );
    self.postMessage({ id: data.id, ok: true, issues });
  } catch {
    self.postMessage({
      id: data.id,
      ok: false,
      error: "Local checking could not start. Reload grammai and try again.",
    });
  }
};
