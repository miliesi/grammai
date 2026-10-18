import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createGermanChecker, germanByteMatches } from "../src/german-engine";

const checker = createGermanChecker(async () => {
  const [wasm, pack] = await Promise.all([
    readFile("node_modules/lingotweaker-wasm/web/lt_wasm_bg.wasm"),
    readFile("node_modules/lingotweaker-data-de/packs/de.pack.gz"),
  ]);
  return { wasm: Uint8Array.from(wasm).buffer, pack: gunzipSync(pack) };
});

test("the bundled German engine catches spelling, agreement and contextual confusions without native software", async () => {
  for (const [text, original, replacement] of [
    ["Das ist ein Tesst.", "Tesst", "Test"],
    ["Das ist ein Beispil.", "Beispil", "Beispiel"],
    ["Ich habe ein Fehler gemacht.", "ein Fehler", "einen Fehler"],
    ["Ich habe ein gute Idee.", "ein gute Idee", "eine gute Idee"],
    ["Ist das wirklich war?", "war", "wahr"],
    ["Ich hoffe das du morgen kommst.", "hoffe das", "hoffe, dass"],
  ]) {
    const issues = await checker.check(text);
    assert(
      issues.some(
        (i) => i.original === original && i.replacements[0] === replacement,
      ),
      JSON.stringify({ text, issues }),
    );
    assert(!issues.some((i) => i.replacements.some((r) => r.includes("Ist,"))));
  }
});

test("real UTF-8 engine spans become exact UTF-16 editor spans after accents, emoji, code and combining marks", async () => {
  for (const prefix of [
    "😀 ",
    "Grüße 🌿. ",
    "👩🏽‍💻 ",
    "Café. ",
    "中文。 ",
    "`Grüße 🌿` ",
  ]) {
    const text = `${prefix}Das ist ein Beispil.`;
    const issues = await checker.check(text);
    const issue = issues.find((i) => i.original === "Beispil");
    assert(issue, JSON.stringify({ prefix, issues }));
    assert.equal(issue.offset, text.indexOf("Beispil"));
    assert.equal(
      text.slice(issue.offset, issue.offset + issue.length),
      "Beispil",
    );
  }
});

test("correct German and masked technical material remain unchanged", async () => {
  for (const text of [
    "Ist das wirklich wahr?",
    "Wir treffen uns morgen in Berlin.",
    "Ich habe gestern einen schönen Spaziergang gemacht.",
    "Ich weiß, dass das wirklich war.",
    "Ich glaube das nicht.",
    "Ich glaube das, was du sagst.",
    "`Das ist ein Beispil.` https://beispil.example.com",
  ])
    assert.deepEqual(await checker.check(text), [], text);
});

test("personal vocabulary and disabled correctness are honored by the bundled checker", async () => {
  assert.deepEqual(
    await checker.check("Das ist ein Beispil.", { dictionary: ["Beispil"] }),
    [],
  );
  assert.deepEqual(
    await checker.check("Das ist ein Beispil. Ist das wirklich war?", {
      categories: { correctness: false },
    }),
    [],
  );
});

test("byte conversion rejects ranges inside Unicode characters instead of corrupting neighboring text", () => {
  const text = "😀 Grüße";
  assert.deepEqual(
    germanByteMatches(text, [{ range: { start: 1, end: 4 } }]),
    [],
  );
  const match = germanByteMatches(text, [
    {
      range: { start: 5, end: 12 },
      suggestions: [{ value: "Hallo" }],
      rule_id: "TEST",
      issue_type: "misspelling",
    },
  ])[0];
  assert.equal(match.offset, 3);
  assert.equal(match.length, 5);
});
