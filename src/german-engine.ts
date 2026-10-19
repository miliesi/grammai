import { createLtChecker, ltByteMatches } from "./lt-engine";

/** German entry points, kept for the existing tests and callers. */
export const germanByteMatches = ltByteMatches;

export function createGermanChecker(
  loadAssets: () => Promise<{ wasm: ArrayBuffer; pack: Uint8Array }>,
) {
  return createLtChecker("de", loadAssets);
}
