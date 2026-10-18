import {
  LocalLinter,
  Dialect,
  SuggestionKind,
  type BinaryModule,
} from "harper.js";
import { checkText, type EngineOptions, type Issue } from "./engine";
import { isKnownSpelling } from "./spelling";
import { proseMask } from "./prose";

/** All execution belongs in the extension worker, never in the page's input loop. */
export function createLiveChecker(binary: BinaryModule) {
  let linter: LocalLinter | undefined;
  let dialect = "";
  let queue: Promise<unknown> = Promise.resolve();

  const check = async (
    text: string,
    options: EngineOptions = {},
  ): Promise<Issue[]> => {
    const base = checkText(text, { ...options, externalSpelling: true });
    if (!text.trim()) return base;
    const nextDialect = options.dialect === "en-GB" ? "en-GB" : "en-US";
    if (!linter || nextDialect !== dialect) {
      await linter?.dispose();
      linter = new LocalLinter({
        binary,
        dialect: nextDialect === "en-GB" ? Dialect.British : Dialect.American,
      });
      // Our repetition/spacing checks preserve grammatical repetitions and layout.
      // Oxford commas are an editorial preference, not a universal correction.
      await linter.setLintConfig({
        RepeatedWords: false,
        RedundantThat: false,
        NoFrenchSpaces: false,
        OxfordComma: false,
        NoOxfordComma: false,
      });
      dialect = nextDialect;
    }
    const prose = proseMask(text);
    // 2.13 exposes UTF-16 spans. Keep a validated scalar fallback because older
    // Harper documentation describes scalar spans. Never guess a replacement range.
    const offsets = [0];
    for (const character of prose)
      offsets.push(offsets.at(-1)! + character.length);
    const dictionary = new Set(
      (options.dictionary ?? []).map((word) => word.toLowerCase()),
    );
    const extra: Issue[] = [];
    const lints = await linter.lint(prose, {
      language: "plaintext",
      dedup: false,
    });
    for (const lint of lints) {
      const span = lint.span();
      const suggestions = lint.suggestions();
      try {
        const problem = lint.get_problem_text();
        const direct = prose.slice(span.start, span.end) === problem;
        const offset = direct ? span.start : offsets[span.start];
        const end = direct ? span.end : offsets[span.end];
        if (offset === undefined || end === undefined || end <= offset)
          continue;
        const original = text.slice(offset, end);
        if (
          original !== problem ||
          prose.slice(offset, end) !== original ||
          dictionary.has(original.toLowerCase())
        )
          continue;
        const kind = lint.lint_kind();
        if (
          kind === "Repetition" &&
          /^(?:had\s+had|that\s+that)$/i.test(original)
        )
          continue;
        const spelling = kind === "Spelling";
        const style = [
          "Style",
          "Readability",
          "Redundancy",
          "Enhancement",
        ].includes(kind);
        const category = style ? "clarity" : "correctness";
        if (options.categories?.[category] === false) continue;
        // Retain our permissive US/UK vocabulary and technical-word protections.
        if (
          spelling &&
          (isKnownSpelling(original) ||
            (/^[A-Z][a-z]+$/.test(original) &&
              /\p{L}[^.!?]*\s+$/u.test(prose.slice(0, offset))))
        )
          continue;
        const replacements = [
          ...new Set(
            suggestions.map((suggestion) => {
              const replacement = suggestion.get_replacement_text();
              return suggestion.kind() === SuggestionKind.InsertAfter
                ? original + replacement
                : replacement;
            }),
          ),
        ]
          .filter((replacement) => replacement !== original)
          .slice(0, 5);
        const ruleId = `harper-${kind.toLowerCase()}`;
        extra.push({
          id: `${ruleId}:${offset}:${end - offset}:${original}`,
          ruleId,
          offset,
          length: end - offset,
          original,
          replacements,
          message:
            spelling && !replacements.length
              ? "This word is not in the bundled dictionaries. It may be a name, specialist term, or misspelling."
              : lint.message(),
          shortMessage: spelling
            ? replacements.length
              ? "Possible spelling mistake"
              : "Unknown word"
            : lint.lint_kind_pretty(),
          category,
          kind: spelling ? "spelling" : style ? "style" : "grammar",
        });
      } finally {
        span.free();
        for (const suggestion of suggestions) suggestion.free();
        lint.free();
      }
    }
    // Keep familiar high-confidence fixes. A spelling diagnosis without candidates
    // is enriched by Harper's broader candidate search rather than hidden.
    for (const issue of extra) {
      const overlaps = base.filter(
        (other) =>
          issue.offset < other.offset + other.length &&
          issue.offset + issue.length > other.offset,
      );
      if (!overlaps.length) base.push(issue);
      else if (
        issue.kind === "spelling" &&
        issue.replacements.length &&
        overlaps.every(
          (other) =>
            (other.kind === "spelling" && !other.replacements.length) ||
            other.ruleId === "sentence-capitalization",
        )
      ) {
        for (const other of overlaps) base.splice(base.indexOf(other), 1);
        base.push(issue);
      }
    }
    return base.sort(
      (a, b) => a.offset - b.offset || a.ruleId.localeCompare(b.ruleId),
    );
  };
  return {
    check(text: string, options: EngineOptions = {}) {
      // Mutable dialect configuration must not race between tabs or frames.
      const result = queue.then(() => check(text, options));
      queue = result.catch(() => {});
      return result;
    },
    async dispose() {
      await queue;
      await linter?.dispose();
      linter = undefined;
    },
  };
}
