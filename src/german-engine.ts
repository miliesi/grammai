import init, { LtEngine } from "lingotweaker-wasm";
import type { EngineOptions, Issue } from "./engine";
import { germanIssues } from "./german";
import { proseMask } from "./prose";

/** LingoTweaker reports UTF-8 byte ranges; editors use UTF-16 code units. */
export function germanByteMatches(text: string, matches: any[]): any[] {
  const offsets = new Map<number, number>([[0, 0]]);
  let bytes = 0;
  let units = 0;
  for (const character of text) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    units += character.length;
    offsets.set(bytes, units);
  }
  return matches.flatMap((match) => {
    const start = offsets.get(match.range?.start);
    const end = offsets.get(match.range?.end);
    if (start === undefined || end === undefined || end < start) return [];
    return [
      {
        offset: start,
        length: end - start,
        message: match.message,
        shortMessage: match.short_message,
        replacements: match.suggestions,
        rule: { id: match.rule_id, issueType: match.issue_type?.toLowerCase() },
      },
    ];
  });
}

export function createGermanChecker(
  loadAssets: () => Promise<{ wasm: ArrayBuffer; pack: Uint8Array }>,
) {
  let loading: Promise<LtEngine> | undefined;
  const engine = () =>
    (loading ??= (async () => {
      const { wasm, pack } = await loadAssets();
      await init({ module_or_path: wasm });
      const instance = new LtEngine(
        "de-DE",
        pack,
        JSON.stringify({ today: new Date().toISOString() }),
      );
      // Never report an incomplete initialization as a successful grammar check.
      if (
        !instance.active_rule_count() ||
        JSON.parse(instance.compile_failures_json()).length
      ) {
        instance.free();
        throw new Error("German grammar rules could not be loaded.");
      }
      return instance;
    })().catch((error) => {
      loading = undefined;
      throw error;
    }));
  return {
    async check(text: string, options: EngineOptions = {}): Promise<Issue[]> {
      if (!text.trim()) return [];
      const instance = await engine();
      const prose = proseMask(text);
      const result = JSON.parse(instance.check_matches_json(prose));
      if (!Array.isArray(result.matches))
        throw new Error("Invalid grammar result.");
      return germanIssues(
        text,
        germanByteMatches(prose, result.matches),
        options,
      );
    },
  };
}
