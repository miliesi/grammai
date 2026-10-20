import type { EngineOptions, Issue } from "./engine";
import { ltIssues, type LtProfile } from "./lt-issues";
import { proseMask } from "./prose";

const COMMA_BELOW: Record<string, string> = {
  ş: "ș",
  Ş: "Ș",
  ţ: "ț",
  Ţ: "Ț",
};

/**
 * Romanian is still often typed with the legacy cedilla letters ş/ţ instead of
 * the standard comma-below ș/ț. Both pairs are single UTF-16 units and two
 * UTF-8 bytes, so normalizing never moves a span the engine reports.
 */
export function normalizeRomanian(text: string): string {
  return text.replace(/[şŞţŢ]/g, (letter) => COMMA_BELOW[letter]);
}

function foldDiacritics(letter: string): string {
  return letter.normalize("NFD").replace(/\p{M}/gu, "");
}

const romanianProfile: LtProfile = {
  locale: "ro",
  fallbackMessage: "Verificați acest fragment.",
  spellingLabel: "Ortografie",
  grammarLabel: "Gramatică",
  // "scoala" is closer to "școala" than to an unrelated word of the same length.
  substitutionCost: (from, to) =>
    from === to ? 0 : foldDiacritics(from) === foldDiacritics(to) ? 0.25 : 1,
};

/** One issue per word that uses a legacy cedilla letter. */
function cedillaIssues(text: string, options: EngineOptions): Issue[] {
  if (options.categories?.correctness === false) return [];
  const dictionary = new Set(
    (options.dictionary ?? []).map((word) => word.toLocaleLowerCase("ro")),
  );
  const prose = proseMask(text);
  const issues: Issue[] = [];
  for (const match of prose.matchAll(/\p{L}*[şŞţŢ]\p{L}*/gu)) {
    const offset = match.index!;
    const original = match[0];
    if (text.slice(offset, offset + original.length) !== original) continue;
    if (dictionary.has(original.toLocaleLowerCase("ro"))) continue;
    issues.push({
      id: `ro-comma-below:${offset}:${original}`,
      ruleId: "ro-comma-below",
      offset,
      length: original.length,
      original,
      replacements: [normalizeRomanian(original)],
      message:
        "Ortografia standard folosește ș și ț (cu virgulă), nu ş și ţ (cu sedilă).",
      shortMessage: "Diacritice",
      category: "correctness",
      kind: "spelling",
    });
  }
  return issues;
}

/** Adapt LanguageTool-style Romanian matches, whose spans are UTF-16 offsets into `text`. */
export function romanianIssues(
  text: string,
  matches: any[],
  options: EngineOptions = {},
): Issue[] {
  return ltIssues(
    text,
    matches,
    options,
    romanianProfile,
    cedillaIssues(text, options),
  );
}
