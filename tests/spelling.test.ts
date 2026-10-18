import assert from "node:assert/strict";
import test from "node:test";
import { inspectSpelling } from "../src/spelling";

test("uses the full dictionary for ordinary words and generated inflections", () => {
  for (const word of [
    "accommodations",
    "collaborative",
    "sustainability",
    "asynchronous",
    "communicating",
    "internationalization",
    "unbelievable",
    "reliability",
    "acknowledgments",
    "rewritten",
    "conscientious",
    "parliamentary",
  ])
    assert.equal(inspectSpelling(word).correct, true, word);
});

test("finds dictionary suggestions beyond the engine's common typo table", () => {
  const examples = [
    ["reliablity", "reliability"],
    ["unbeleivable", "unbelievable"],
    ["probabily", "probably"],
    ["rewriten", "rewritten"],
    ["helllo", "hello"],
    ["asynchronus", "asynchronous"],
    ["reccomend", "recommend"],
    ["commmunication", "communication"],
  ];
  for (const [word, expected] of examples) {
    const result = inspectSpelling(word);
    assert.equal(result.correct, false, word);
    assert.equal(result.suggestions[0], expected, word);
    assert.ok(result.suggestions.length <= 5);
  }
});

test("accepts both English dialects and normalizes curly apostrophes", () => {
  for (const word of [
    "color",
    "colour",
    "organizing",
    "organising",
    "catalogue",
    "catalog",
    "jewellery",
    "enrolment",
    "programme",
    "program",
    "wouldn’t",
    "wasn't",
  ])
    assert.equal(inspectSpelling(word).correct, true, word);
});

test("avoids interpreting acronyms, identifiers, Unicode words and modern vocabulary as typos", () => {
  for (const word of [
    "REA",
    "TypeScript",
    "fooBar",
    "snake_case",
    "GPT4",
    "café",
    "naïve",
    "npm",
    "tsx",
    "webhooks",
    "onboarding",
    "refactoring",
    "postgresql",
  ])
    assert.equal(inspectSpelling(word).correct, true, word);
});

test("cached suggestions are immutable and do not leak one caller's mutations", () => {
  const first = inspectSpelling("reliablity");
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.suggestions));
  assert.equal(inspectSpelling("reliablity"), first);
  assert.equal(inspectSpelling("reliability").correct, true);
});
