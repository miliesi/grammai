import nspell from "nspell";
import {
  americanDictionary,
  britishDictionary,
} from "./generated/dictionaries";

/**
 * Hunspell checks both common English dialects. Dialect preferences remain an
 * explicit, separate engine rule rather than marking valid English as a typo.
 * Create the checkers only when prose is checked, not when a settings page opens.
 */
let checkers: [nspell, nspell] | undefined;
function dictionaries(): [nspell, nspell] {
  return (checkers ??= [nspell(americanDictionary), nspell(britishDictionary)]);
}

// Common contemporary product/developer words absent from the bundled SCOWL
// vocabulary. Personal vocabulary is handled by the engine, per document.
const extraVocabulary = new Set([
  "ai",
  "api",
  "apis",
  "backend",
  "backends",
  "chatgpt",
  "codex",
  "css",
  "frontend",
  "frontends",
  "github",
  "gmail",
  "graphql",
  "html",
  "javascript",
  "json",
  "localhost",
  "npm",
  "nspell",
  "onboarding",
  "openai",
  "playwright",
  "postgres",
  "postgresql",
  "refactor",
  "refactored",
  "refactoring",
  "repo",
  "repos",
  "saas",
  "signup",
  "sql",
  "svg",
  "tsx",
  "typescript",
  "ui",
  "ux",
  "webhook",
  "webhooks",
  "workflow",
  "workflows",
]);

export interface SpellingResult {
  correct: boolean;
  suggestions: readonly string[];
}

const cache = new Map<string, SpellingResult>();
const CACHE_LIMIT = 2048;
const accepted: SpellingResult = Object.freeze({
  correct: true,
  suggestions: Object.freeze([]),
});

/** Synchronous and cached: never requests text or vocabulary from a server. */
export function inspectSpelling(source: string): SpellingResult {
  const word = source.normalize("NFC").replaceAll("’", "'");
  // Do not split Unicode words into apparent ASCII misspellings or try to spell
  // check code identifiers, acronyms, numeric tokens, or very long pasted data.
  if (
    word.length < 3 ||
    word.length > 48 ||
    !/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(word) ||
    !/^(?:[a-z]+|[A-Z][a-z]+)(?:'[a-z]+)?$/.test(word) ||
    extraVocabulary.has(word.toLowerCase())
  )
    return accepted;
  const remembered = cache.get(word);
  if (remembered) return remembered;
  const [american, british] = dictionaries();
  let result = accepted;
  if (!american.correct(word) && !british.correct(word)) {
    const suggestions = [...new Set(american.suggest(word))]
      .filter((candidate) => candidate.toLowerCase() !== word.toLowerCase())
      .slice(0, 5);
    result = Object.freeze({
      correct: false,
      suggestions: Object.freeze(suggestions),
    });
  }
  // The document may live for hours in a social editor; bound retained tokens.
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(word, result);
  return result;
}

/** Vocabulary membership only; candidate generation belongs to the live engine. */
export function isKnownSpelling(source: string): boolean {
  const word = source.normalize("NFC").replaceAll("’", "'");
  if (
    word.length < 3 ||
    word.length > 48 ||
    !/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(word) ||
    !/^(?:[a-z]+|[A-Z][a-z]+)(?:'[a-z]+)?$/.test(word) ||
    extraVocabulary.has(word.toLowerCase())
  )
    return true;
  const [american, british] = dictionaries();
  return american.correct(word) || british.correct(word);
}
