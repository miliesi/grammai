import type { Issue } from "./engine";
import { proseMask } from "./prose";

/** Lightweight UI statistics. Linting runs separately in the extension worker. */
export function textStatistics(text: string, issues: Issue[] = []) {
  const prose = proseMask(text);
  const words = [...prose.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)]
    .length;
  const sentences = words
    ? Math.max(
        1,
        prose
          .split(/[.!?]+(?:["”')\]]+)?(?:\s+|$)|\n\s*\n/)
          .filter((part) => /\p{L}/u.test(part)).length,
      )
    : 0;
  const penalty = issues.reduce(
    (sum, issue) => sum + (issue.kind === "style" ? 2 : 5),
    0,
  );
  const score = Math.max(
    0,
    Math.round(100 - penalty / Math.max(1, words / 100)),
  );
  let tone = "Neutral";
  if (
    /\b(?:thank(?:s| you)|happy|glad|delighted|appreciate|pleased)\b/i.test(
      prose,
    )
  )
    tone = "Friendly";
  else if (
    /\b(?:unfortunately|concerned|worried|regret|disappointed)\b/i.test(prose)
  )
    tone = "Concerned";
  else if (/\b(?:dear|sincerely|regards|hereby|pursuant)\b/i.test(prose))
    tone = "Formal";
  else if (/\b(?:gonna|wanna|hey|yeah|lol|awesome)\b/i.test(prose))
    tone = "Informal";
  else if (
    /\b(?:confident|certain|definitely|will achieve|guarantee)\b/i.test(prose)
  )
    tone = "Confident";
  return {
    words,
    sentences,
    readingMinutes: words ? Math.max(1, Math.ceil(words / 238)) : 0,
    score,
    tone,
  };
}
