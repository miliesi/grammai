import assert from "node:assert/strict";
import test from "node:test";
import { analyzeText, checkText } from "../src/engine";

test("corrects the reported necessary typo with exact ranges in questions", () => {
  for (const typo of [
    "nessecary",
    "neccesary",
    "nessessary",
    "nessisary",
    "neccessary",
    "necesary",
  ]) {
    const text = `Is this really ${typo}?`;
    const issues = checkText(text);
    assert.equal(issues.length, 1, typo);
    assert.equal(issues[0].offset, 15);
    assert.equal(issues[0].length, typo.length);
    assert.equal(issues[0].kind, "spelling");
    assert.deepEqual(issues[0].replacements, ["necessary"]);
    assert.equal(
      text.slice(issues[0].offset, issues[0].offset + issues[0].length),
      typo,
    );
    assert.deepEqual(checkText(text.replace(typo, "necessary")), []);
  }
});

test("provides dictionary-backed corrections for previously unlisted misspellings", () => {
  const text =
    "😀 We value reliablity and commmunication. This is unbeleivable and probabily needs to be rewriten.";
  const issues = checkText(text);
  assert.deepEqual(
    issues.map(({ original, replacements }) => [original, replacements[0]]),
    [
      ["reliablity", "reliability"],
      ["commmunication", "communication"],
      ["unbeleivable", "unbelievable"],
      ["probabily", "probably"],
      ["rewriten", "rewritten"],
    ],
  );
  let corrected = text;
  for (const issue of [...issues].reverse()) {
    assert.equal(
      text.slice(issue.offset, issue.offset + issue.length),
      issue.original,
    );
    corrected =
      corrected.slice(0, issue.offset) +
      issue.replacements[0] +
      corrected.slice(issue.offset + issue.length);
  }
  assert.deepEqual(checkText(corrected), []);
});

test("new spelling coverage honors personal words, categories and technical boundaries", () => {
  const text = "The asynchronus service can reccomend changes.";
  assert.deepEqual(
    checkText(text, { dictionary: ["ASYNCHRONUS", "reccomend"] }),
    [],
  );
  assert.deepEqual(checkText(text, { categories: { correctness: false } }), []);
  assert.deepEqual(
    checkText(
      "Read @reccomend and #asynchronus in asynchronus2, reccomend_count and getReccomend.",
    ),
    [],
  );
  assert.deepEqual(
    checkText(
      "We use a café, naïve examples, TypeScript, JSON, npm, tsx and webhooks.",
    ),
    [],
  );
  assert.deepEqual(
    checkText(
      "We discussed the programme, catalogue, enrolment and jewellery.",
    ),
    [],
  );
});

test("keeps replacement ranges aligned with UTF-16 DOM offsets", () => {
  const text = "😀 I recieved teh report. We is ready.";
  const issues = checkText(text);
  assert.deepEqual(
    issues.map(({ original, replacements }) => [original, replacements[0]]),
    [
      ["recieved", "received"],
      ["teh", "the"],
      ["We is", "We are"],
    ],
  );
  for (const issue of issues)
    assert.equal(
      text.slice(issue.offset, issue.offset + issue.length),
      issue.original,
    );
  let corrected = text;
  for (const issue of [...issues].reverse()) {
    corrected =
      corrected.slice(0, issue.offset) +
      issue.replacements[0] +
      corrected.slice(issue.offset + issue.length);
  }
  assert.equal(corrected, "😀 I received the report. We are ready.");
  assert.deepEqual(
    checkText(text).map((issue) => issue.id),
    issues.map((issue) => issue.id),
  );
});

test("keeps names and acronyms, and distinguishes unknown vocabulary from certain errors", () => {
  assert.deepEqual(
    checkText("Alex and Xiomara use REA to study heteroscedasticity.", {
      dictionary: ["heteroscedasticity"],
    }),
    [],
  );
  assert.deepEqual(checkText("TEH is our internal project name."), []);
  const unknown = checkText("We study heteroscedasticity.");
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].shortMessage, "Unknown word");
  assert.deepEqual(unknown[0].replacements, []);
});

test("ignores URLs, emails, code and identifiers without shifting later ranges", () => {
  const text =
    "Open https://teh.example.com/recieve or email teh@example.com.\n" +
    '`const x = "teh"` and snake_case identifiers are fine.\n' +
    '```js\nconst adress = "recieve";\n```\nWe recieved news.';
  const issues = checkText(text);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].original, "recieved");
  assert.equal(issues[0].offset, text.lastIndexOf("recieved"));
});

test("personal dictionary suppresses a word, preserving unrelated suggestions", () => {
  const issues = checkText("Teh team recieved news.", { dictionary: ["teh"] });
  assert.deepEqual(
    issues.map((issue) => issue.original),
    ["recieved"],
  );
});

test("dialect spelling is opt-in and preserves capitalization", () => {
  assert.deepEqual(checkText("My favorite colour is blue."), []);
  const british = checkText("My favorite color is blue.", { dialect: "en-GB" });
  assert.deepEqual(
    british.map((issue) => issue.replacements[0]),
    ["favourite", "colour"],
  );
  const american = checkText("Colour is important.", { dialect: "en-US" });
  assert.deepEqual(
    american.map((issue) => issue.replacements[0]),
    ["Color"],
  );
});

test("detects grammatical phrases, contractions and article sounds", () => {
  const text =
    "I dont have a umbrella. She have an university degree and a hour to spare.";
  const issues = checkText(text);
  assert.deepEqual(
    issues.map((issue) => [issue.original, issue.replacements[0]]),
    [
      ["dont", "don't"],
      ["a", "an"],
      ["She have", "She has"],
      ["an", "a"],
      ["a", "an"],
    ],
  );
});

test("leaves grammatical repeats, subjunctives and legitimate articles alone", () => {
  const text =
    "I had had enough. I knew that that was right. If she were here, we would go. An hour is enough. A university is nearby. An unknown person arrived.";
  assert.deepEqual(checkText(text), []);
});

test("finds repeated words and punctuation while respecting ordinary punctuation", () => {
  const issues = checkText("The the team is  ready ,but we can wait!!!");
  assert.deepEqual(
    issues.map((issue) => issue.ruleId),
    [
      "repeated-word",
      "extra-space",
      "space-before-punctuation",
      "space-after-punctuation",
      "excessive-exclamation",
    ],
  );
  assert.deepEqual(
    checkText(
      "Dr. smith used version 2.4. Email us at 9:30. Well-known names are fine.",
    ),
    [],
  );
});

test("capitalizes clear sentence beginnings without overlapping pronoun suggestions", () => {
  const issues = checkText("this works. another sentence! i agree.");
  assert.deepEqual(
    issues.map((issue) => [issue.original, issue.replacements[0]]),
    [
      ["t", "T"],
      ["a", "A"],
      ["i", "I"],
    ],
  );
});

test("offers concise alternatives and makes passive voice advisory", () => {
  const text =
    "In order to finish, we planned on a daily basis. The report was written by Sam.";
  const issues = checkText(text);
  assert.deepEqual(
    issues.map((issue) => issue.category),
    ["clarity", "clarity", "clarity"],
  );
  assert.equal(issues[0].replacements[0], "To");
  assert.deepEqual(issues.at(-1)?.replacements, []);
  assert.deepEqual(checkText(text, { categories: { clarity: false } }), []);
});

test("provides useful local statistics and bounded scores", () => {
  assert.deepEqual(analyzeText(""), {
    words: 0,
    sentences: 0,
    readingMinutes: 0,
    score: 100,
    tone: "Neutral",
  });
  const clean = analyzeText(
    "Thank you for the report. We appreciate your help!",
  );
  assert.equal(clean.words, 9);
  assert.equal(clean.sentences, 2);
  assert.equal(clean.tone, "Friendly");
  assert.equal(clean.score, 100);
  assert.ok(analyzeText("Teh report is definately ready.").score < clean.score);
  assert.equal(analyzeText("word ".repeat(500)).readingMinutes, 3);
});

test("handles common demo misspellings and bounded possessive confusion with exact edits", () => {
  const text =
    "Their are realy useful ideas. Their is a report. Please send you're feedback.";
  const issues = checkText(text);
  assert.deepEqual(
    issues.map((issue) => [issue.original, issue.replacements[0]]),
    [
      ["Their are", "There are"],
      ["realy", "really"],
      ["Their is", "There is"],
      ["you're feedback", "your feedback"],
    ],
  );
  let corrected = text;
  for (const issue of [...issues].reverse()) {
    assert.equal(
      text.slice(issue.offset, issue.offset + issue.length),
      issue.original,
    );
    corrected =
      corrected.slice(0, issue.offset) +
      issue.replacements[0] +
      corrected.slice(issue.offset + issue.length);
  }
  assert.equal(
    corrected,
    "There are really useful ideas. There is a report. Please send your feedback.",
  );
  assert.deepEqual(checkText(corrected), []);
});

test("keeps valid pronouns, proper names and literal code intact", () => {
  const text =
    "They're happy with your feedback. You're welcome to share your thoughts. " +
    "We met Realy in Berlin. Their team is ready. Read `Their are realy good ideas; send you're feedback`.";
  assert.deepEqual(checkText(text), []);
  const curly = checkText("Please send you’re feedback.");
  assert.equal(curly[0].replacements[0], "your feedback");
});

test("engagement alternatives are optional and honor the category setting", () => {
  const text = "Very good work. This is very important.";
  const issues = checkText(text);
  assert.deepEqual(
    issues.map((issue) => [
      issue.category,
      issue.original,
      issue.replacements[0],
    ]),
    [
      ["engagement", "Very good", "Great"],
      ["engagement", "very important", "essential"],
    ],
  );
  assert.ok(
    issues.every(
      (issue) =>
        issue.kind === "style" &&
        issue.message.includes("if it matches your meaning"),
    ),
  );
  assert.deepEqual(checkText(text, { categories: { engagement: false } }), []);
});

test("delivery can suggest direct phrasing and preserve uncertainty as an advisory", () => {
  const text =
    "I just wanted to share the report. I think maybe we can finish today.";
  const issues = checkText(text);
  assert.deepEqual(
    issues.map((issue) => [issue.category, issue.original, issue.replacements]),
    [
      ["delivery", "I just wanted to", ["I wanted to"]],
      ["delivery", "I think maybe", []],
    ],
  );
  assert.deepEqual(checkText(text, { categories: { delivery: false } }), []);
  assert.deepEqual(
    checkText("I wanted to share the report. I think we can finish today."),
    [],
  );
});
