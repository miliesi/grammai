import type { EngineOptions, Issue } from "./engine";
import { proseMask } from "./prose";

/** Narrow contextual rules supplement the local engine's real-word coverage.
 * Match complete constructions, never every occurrence of an ambiguous word.
 */
function contextualIssues(text: string, options: EngineOptions): Issue[] {
  if (options.categories?.correctness === false) return [];
  const prose = proseMask(text);
  const issues: Issue[] = [];
  const add = (
    ruleId: string,
    offset: number,
    original: string,
    replacement: string,
    message: string,
  ) => {
    issues.push({
      id: `${ruleId}:${offset}:${original}`,
      ruleId,
      offset,
      length: original.length,
      original,
      replacements: [replacement],
      message,
      shortMessage: "Wortverwechslung im Kontext",
      category: "correctness",
      kind: "grammar",
    });
  };
  // Predicative truth after a present/subjunctive copula. A past-tense clause
  // such as "Ich weiß, dass das wirklich war" has no leading copula and stays intact.
  for (const match of prose.matchAll(
    /\b(?:ist|sind|sei|seien|wäre|wären|bleibt|bleiben)\s+(?:(?:das|dies|dieses|es|alles|etwas|nichts)\s+)?(?:(?:wirklich|tatsächlich|absolut|völlig|wohl|offenbar|anscheinend|leider|nicht|gar|so|sehr|auch|doch|immer|noch|nur|einfach|überhaupt)\s+)*war(?=\s*(?:[.!?,;:]|$))/giu,
  )) {
    if (text.slice(match.index!, match.index! + match[0].length) !== match[0])
      continue;
    const offset = match.index! + match[0].length - 3;
    add(
      "de-context-war-wahr",
      offset,
      text.slice(offset, offset + 3),
      text.slice(offset, offset + 3) === "WAR" ? "WAHR" : "wahr",
      "Hier ist „wahr“ im Sinn von „zutreffend“ gemeint. „War“ ist die Vergangenheit von „sein“.",
    );
  }
  // A reporting/thinking verb followed by das + subject + a finite verb is
  // a content clause. Restrict subjects and predicates to avoid relative clauses.
  for (const match of prose.matchAll(
    /\b(?:glaube|glaubst|glaubt|glauben|denke|denkst|denkt|denken|hoffe|hoffst|hofft|hoffen|weiß|wissen|wusste|vermute|vermuten|finde|findet|meine|meint|sage|sagte|sagen)\s*(,?)\s+das\s+(?:ich|du|er|sie|es|wir|ihr)\b[^.!?;\n]{0,100}?\b(?:bin|bist|ist|sind|seid|war|waren|hat|hast|habe|haben|habt|hatte|wird|werden|wirst|kann|kannst|können|kommt|kommst|komme|kommen|stimmt|geht|funktioniert|klappt|schafft|schaffen|macht|machen)\b/giu,
  )) {
    if (text.slice(match.index!, match.index! + match[0].length) !== match[0])
      continue;
    const prefix = /^\p{L}+[\s,]+das\b/u.exec(match[0]);
    if (!prefix) continue;
    const start = match.index!;
    const original = text.slice(start, start + prefix[0].length);
    const verb = /^\p{L}+/u.exec(original)![0];
    add(
      "de-context-das-dass",
      start,
      original,
      `${verb}, dass`,
      "Der Inhalt wird mit „dass“ als Nebensatz angeschlossen. Davor steht ein Komma.",
    );
  }
  return issues;
}

function spellingDistance(source: string, candidate: string): number {
  const a = Array.from(source.toLocaleLowerCase("de")),
    b = Array.from(candidate.toLocaleLowerCase("de"));
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
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
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

/** LanguageTool and DOM both use UTF-16. Validate and retain exact source spans. */
export function germanIssues(
  text: string,
  matches: any[],
  options: EngineOptions = {},
): Issue[] {
  const dictionary = new Set(
    (options.dictionary ?? []).map((word) => word.toLocaleLowerCase("de")),
  );
  const issues: Issue[] = contextualIssues(text, options);
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
        (a, b) => spellingDistance(original, a) - spellingDistance(original, b),
      );
    replacements = replacements.slice(0, 5);
    if (spelling && dictionary.has(original.toLocaleLowerCase("de"))) continue;
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
          : "Bitte diese Stelle prüfen.",
      shortMessage:
        match.shortMessage || (spelling ? "Rechtschreibung" : "Grammatik"),
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
