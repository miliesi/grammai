import assert from "node:assert/strict";
import test from "node:test";
import { detectLanguage } from "../src/language";
import { germanIssues } from "../src/german";

test("detects German and English locally, including mistakes and short messages", () => {
  for (const text of [
    "Das ist ein Tesst.",
    "Ich habe ein Fehler gemacht.",
    "Ist das wirklich nötig?",
    "Ich glaube das er recht hat.",
    "Hallo Welt",
    "Danke!",
    "Wir treffen uns morgen in Berlin.",
    "Das Haus ist schön.",
  ])
    assert.equal(detectLanguage(text), "de", text);
  for (const text of [
    "Is this really neseccary?",
    "Or doe you think is good?",
    "We need reliablity.",
    "Hello world!",
    "This works.",
    "My favorite color is blue.",
    "The doe you think is small is standing beside her fawn.",
  ])
    assert.equal(detectLanguage(text), "en", text);
  assert.equal(detectLanguage("Das ist ein Test.", "en"), "en");
  assert.equal(detectLanguage("Hello world!", "de"), "de");
});

test("German result adapter preserves exact UTF-16 spans and personal words", () => {
  const text = "😀 Ein Tesst.";
  const raw = [
    {
      offset: text.indexOf("Tesst"),
      length: 5,
      message: "Tippfehler",
      rule: { id: "SPELL", issueType: "misspelling" },
      replacements: [{ value: "Test" }],
    },
  ];
  const issue = germanIssues(text, raw)[0];
  assert.equal(issue.original, "Tesst");
  assert.equal(issue.offset, 7);
  assert.equal(issue.replacements[0], "Test");
  assert.deepEqual(germanIssues(text, raw, { dictionary: ["tesst"] }), []);
  assert.deepEqual(
    germanIssues(text, raw, { categories: { correctness: false } }),
    [],
  );
});

test("German insertion-only fixes preserve neighboring text and reject invalid offsets", () => {
  const text = "Hallo Welt";
  const raw = [
    {
      offset: 5,
      length: 0,
      message: "Komma",
      rule: { id: "COMMA" },
      replacements: [{ value: "," }],
    },
    { offset: 999, length: 4 },
  ];
  const issue = germanIssues(text, raw)[0];
  assert.equal(issue.original, " ");
  assert.equal(issue.replacements[0], ", ");
  assert.equal(
    text.slice(0, issue.offset) +
      issue.replacements[0] +
      text.slice(issue.offset + issue.length),
    "Hallo, Welt",
  );
});

test("German contextual corrections override the reported false comma and preserve exact spans", () => {
  for (const text of [
    "Ist das wirklich war?",
    "Ist das wirklich war",
    "😀 Ist das tatsächlich war?",
    "Das ist nicht war.",
    "Wäre es wirklich war?",
  ]) {
    const start = text.indexOf("Ist");
    const raw =
      start < 0
        ? []
        : [
            {
              offset: start,
              length: text.length - start - (text.endsWith("?") ? 1 : 0),
              rule: { id: "KOMMA_ZWISCHEN_HAUPT_UND_NEBENSATZ" },
              replacements: [{ value: "Ist, das wirklich war" }],
            },
          ];
    const issues = germanIssues(text, raw);
    assert.equal(issues.length, 1, text);
    assert.equal(issues[0].original, "war", text);
    assert.deepEqual(issues[0].replacements, ["wahr"]);
    assert.equal(issues[0].offset, text.lastIndexOf("war"));
    assert(!issues.some((i) => i.replacements.some((r) => r.includes("Ist,"))));
  }
});

test("German context rules preserve correct past tense, questions, relative clauses and code", () => {
  for (const text of [
    "Ist das wirklich wahr?",
    "Ich war gestern dort.",
    "Das war wirklich gut.",
    "Ich weiß, dass das wirklich war.",
    "Was damals war, bleibt unklar.",
    "Ich glaube das nicht.",
    "Ich glaube das, was du sagst.",
    "Ich denke, dass er recht hat.",
    "`Ist das wirklich war?`",
    "https://example.com/ist-das-war",
  ])
    assert.deepEqual(germanIssues(text, []), [], text);
  assert.deepEqual(
    germanIssues("Ist das wirklich war?", [], {
      categories: { correctness: false },
    }),
    [],
  );
});

test("German content clauses correct both conjunction and comma without changing pronouns", () => {
  for (const [text, expected] of [
    ["Ich glaube das er recht hat.", "Ich glaube, dass er recht hat."],
    ["Ich hoffe das du morgen kommst.", "Ich hoffe, dass du morgen kommst."],
    ["Ich denke, das es stimmt.", "Ich denke, dass es stimmt."],
    [
      "😀 Wir hoffen das ihr das schafft.",
      "😀 Wir hoffen, dass ihr das schafft.",
    ],
  ]) {
    const issues = germanIssues(text, []);
    assert.equal(issues.length, 1, text);
    const i = issues[0];
    assert.equal(
      text.slice(0, i.offset) +
        i.replacements[0] +
        text.slice(i.offset + i.length),
      expected,
    );
  }
});
