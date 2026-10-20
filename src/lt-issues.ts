import type { EngineOptions, Issue } from "./engine";
import { proseMask } from "./prose";

/** Language-specific wording and ranking used when adapting LanguageTool-style matches. */
export interface LtProfile {
  /** BCP 47 tag used for case-insensitive personal-dictionary matching. */
  locale: string;
  fallbackMessage: string;
  spellingLabel: string;
  grammarLabel: string;
  /** Cost (0-1) of replacing one character with another when ranking spelling suggestions. */
  substitutionCost?: (from: string, to: string) => number;
}

function spellingDistance(
  source: string,
  candidate: string,
  profile: LtProfile,
): number {
  const a = Array.from(source.toLocaleLowerCase(profile.locale)),
    b = Array.from(candidate.toLocaleLowerCase(profile.locale));
  const substitute =
    profile.substitutionCost ?? ((x: string, y: string) => (x === y ? 0 : 1));
  const rows = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + substitute(a[i - 1], b[j - 1]),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  const duplicateDeletion = a.some(
    (letter, index) =>
      index > 0 &&
      letter === a[index - 1] &&
      [...a.slice(0, index), ...a.slice(index + 1)].join("") === b.join(""),
  );
  return (
    rows[a.length][b.length] +
    (a[0] === b[0] ? 0 : 0.5) -
    (duplicateDeletion ? 0.25 : 0)
  );
}

/**
 * LanguageTool and DOM both use UTF-16. Validate and retain exact source spans.
 * `seed` holds issues found by language-specific rules; engine matches that
 * overlap them are dropped.
 */
export function ltIssues(
  text: string,
  matches: any[],
  options: EngineOptions,
  profile: LtProfile,
  seed: Issue[] = [],
): Issue[] {
  const dictionary = new Set(
    (options.dictionary ?? []).map((word) =>
      word.toLocaleLowerCase(profile.locale),
    ),
  );
  const issues: Issue[] = [...seed];
  const prose = proseMask(text);
  for (const match of matches) {
    if (
      !Number.isInteger(match.offset) ||
      !Number.isInteger(match.length) ||
      match.offset < 0 ||
      match.length < 0 ||
      match.offset + match.length > text.length
    )
      continue;
    let offset = match.offset,
      length = match.length;
    let replacements: string[] = Array.isArray(match.replacements)
      ? match.replacements
          .filter((r: any) => typeof r.value === "string")
          .map((r: any) => r.value)
          .slice(0, 30)
      : [];
    // Turn insertion-only suggestions into an anchored replacement for the UI.
    if (length === 0) {
      if (!text.length) continue;
      if (offset < text.length) {
        length = 1;
        replacements = replacements.map((r) => r + text[offset]);
      } else {
        offset--;
        length = 1;
        replacements = replacements.map((r) => text[offset] + r);
      }
    }
    const original = text.slice(offset, offset + length);
    if (prose.slice(offset, offset + length) !== original) continue;
    const spelling = match.rule?.issueType === "misspelling";
    if (spelling && original.length <= 48)
      replacements.sort(
        (a, b) =>
          spellingDistance(original, a, profile) -
          spellingDistance(original, b, profile),
      );
    replacements = replacements.slice(0, 5);
    if (spelling && dictionary.has(original.toLocaleLowerCase(profile.locale)))
      continue;
    const category = ["style", "register", "locale-violation"].includes(
      match.rule?.issueType,
    )
      ? "clarity"
      : "correctness";
    if (options.categories?.[category] === false) continue;
    if (
      issues.some(
        (i) => offset < i.offset + i.length && offset + length > i.offset,
      )
    )
      continue;
    const ruleId = `lt-${match.rule?.id ?? "grammar"}`;
    issues.push({
      id: `${ruleId}:${offset}:${length}:${original}`,
      ruleId,
      offset,
      length,
      original,
      replacements,
      message:
        typeof match.message === "string"
          ? match.message
          : profile.fallbackMessage,
      shortMessage:
        match.shortMessage ||
        (spelling ? profile.spellingLabel : profile.grammarLabel),
      category,
      kind: spelling
        ? "spelling"
        : category === "clarity"
          ? "style"
          : "grammar",
    });
  }
  return issues.sort((a, b) => a.offset - b.offset);
}
