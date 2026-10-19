import type { EngineOptions, Issue } from "./engine";
import { ltIssues, type LtProfile } from "./lt-issues";
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

const germanProfile: LtProfile = {
  locale: "de",
  fallbackMessage: "Bitte diese Stelle prüfen.",
  spellingLabel: "Rechtschreibung",
  grammarLabel: "Grammatik",
};

/** LanguageTool and DOM both use UTF-16. Validate and retain exact source spans. */
export function germanIssues(
  text: string,
  matches: any[],
  options: EngineOptions = {},
): Issue[] {
  return ltIssues(
    text,
    matches,
    options,
    germanProfile,
    contextualIssues(text, options),
  );
}
