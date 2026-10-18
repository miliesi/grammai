import { createGermanChecker } from "./german-engine";

const checker = createGermanChecker(async () => {
  const [wasmResponse, packResponse] = await Promise.all([
    fetch("german.wasm"),
    fetch("german.pack.gz"),
  ]);
  if (!wasmResponse.ok || !packResponse.ok)
    throw new Error("Missing packaged grammar assets.");
  const compressed = await packResponse.arrayBuffer();
  const bytes = new Uint8Array(compressed);
  const pack =
    bytes[0] === 0x1f && bytes[1] === 0x8b
      ? new Uint8Array(
          await new Response(
            new Blob([compressed])
              .stream()
              .pipeThrough(new DecompressionStream("gzip")),
          ).arrayBuffer(),
        )
      : bytes;
  return { wasm: await wasmResponse.arrayBuffer(), pack };
});

self.onmessage = async ({ data }) => {
  try {
    if (typeof data.text !== "string" || data.text.length > 20000)
      throw new Error("Invalid draft length.");
    const issues = await checker.check(data.text, data.options);
    self.postMessage({ id: data.id, ok: true, issues });
  } catch {
    self.postMessage({
      id: data.id,
      ok: false,
      error: "German checking could not start. Reload grammai and try again.",
    });
  }
};
