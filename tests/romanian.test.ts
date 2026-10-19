import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createLtChecker } from "../src/lt-engine";
import { detectLanguage } from "../src/language";
import { normalizeRomanian, romanianIssues } from "../src/romanian";

const checker = createLtChecker("ro", async () => {
  const [wasm, pack] = await Promise.all([
    readFile("node_modules/lingotweaker-wasm/web/lt_wasm_bg.wasm"),
    readFile("node_modules/lingotweaker-data-ro/packs/ro.pack.gz"),
  ]);
  return { wasm: Uint8Array.from(wasm).buffer, pack: gunzipSync(pack) };
});

const apply = (
  text: string,
  issue: { offset: number; length: number },
  r: string,
) => text.slice(0, issue.offset) + r + text.slice(issue.offset + issue.length);

test("detects Romanian next to English and German, including short messages", () => {
  for (const text of [
    "Aceasta este o propoziție corectă.",
    "Ne vedem mâine la București.",
    "Bună ziua, ce mai faci?",
    "Mulțumesc frumos!",
    "Casa este foarte frumoasă.",
    "Aceasta este o propozitie fara diacritice.",
  ])
    assert.equal(detectLanguage(text), "ro", text);
  assert.equal(detectLanguage("This is a short English sentence."), "en");
  assert.equal(detectLanguage("Das ist ein kurzer deutscher Satz."), "de");
  assert.equal(detectLanguage("Aceasta este o propoziție.", "en"), "en");
  assert.equal(detectLanguage("Hello world!", "ro"), "ro");
});

test("the bundled Romanian engine catches missing diacritics and punctuation spacing", async () => {
  const text = "Aceasta este o propozitie gresita.";
  const issues = await checker.check(text);
  const propozitie = issues.find((i) => i.original === "propozitie");
  const gresita = issues.find((i) => i.original === "gresita");
  assert(propozitie && gresita, JSON.stringify(issues));
  assert.equal(propozitie.replacements[0], "propoziție");
  assert(gresita.replacements.includes("greșită"));
  assert.equal(propozitie.kind, "spelling");

  const spaced = "Vreau să merg la magazin ,dar nu am bani.";
  const comma = (await checker.check(spaced)).find((i) =>
    i.ruleId.includes("COMMA_PARENTHESIS_WHITESPACE"),
  );
  assert(comma, "missing comma spacing issue");
  assert.equal(
    apply(spaced, comma, comma.replacements[0]),
    "Vreau să merg la magazin, dar nu am bani.",
  );
});

test("legacy cedilla letters become one comma-below correction per word", async () => {
  for (const [text, original, expected] of [
    ["Am mers la şcoală ieri.", "şcoală", "școală"],
    ["Ţara noastră este frumoasă.", "Ţara", "Țara"],
    ["ŞCOALA ESTE MARE.", "ŞCOALA", "ȘCOALA"],
    ["Mulţumesc pentru ajutor.", "Mulţumesc", "Mulțumesc"],
  ]) {
    const issues = await checker.check(text);
    const issue = issues.find((i) => i.original === original);
    assert(issue, JSON.stringify({ text, issues }));
    assert.equal(issue.ruleId, "ro-comma-below");
    assert.deepEqual(issue.replacements, [expected]);
    assert.equal(
      issues.filter((i) => i.offset === issue.offset).length,
      1,
      text,
    );
  }
  assert.equal(normalizeRomanian("şŞţŢ"), "șȘțȚ");
});

test("Romanian spans stay exact UTF-16 offsets after emoji, accents and code", async () => {
  for (const prefix of [
    "😀 ",
    "Ștefan 🌿. ",
    "👩🏽‍💻 ",
    "Café. ",
    "中文。 ",
    "`şcoală` ",
  ]) {
    const text = `${prefix}Am mers la şcoală și am citit o propozitie.`;
    const issues = await checker.check(text);
    for (const original of ["şcoală", "propozitie"]) {
      const issue = issues.find((i) => i.original === original);
      assert(issue, JSON.stringify({ prefix, original, issues }));
      assert.equal(issue.offset, text.lastIndexOf(original));
      assert.equal(
        text.slice(issue.offset, issue.offset + issue.length),
        original,
      );
    }
  }
});

test("correct Romanian and masked technical material remain unchanged", async () => {
  for (const text of [
    "Aceasta este o propoziție corectă.",
    "Ne vedem mâine la București, la ora zece.",
    "Mulțumesc pentru ajutor și pentru răbdare.",
    "`şcoala` https://scoala.example.com",
  ])
    assert.deepEqual(await checker.check(text), [], text);
});

test("personal vocabulary and disabled correctness are honored", async () => {
  assert.deepEqual(
    await checker.check("Aceasta este o propozitie.", {
      dictionary: ["Propozitie"],
    }),
    [],
  );
  assert.deepEqual(
    await checker.check("Am mers la şcoală.", { dictionary: ["şcoală"] }),
    [],
  );
  assert.deepEqual(
    await checker.check("Am mers la şcoală și am scris o propozitie.", {
      categories: { correctness: false },
    }),
    [],
  );
});

test("Romanian result adapter validates offsets and keeps insertion fixes anchored", () => {
  const text = "Am mers acasa";
  const raw = [
    {
      offset: 8,
      length: 5,
      message: "Diacritice",
      rule: { id: "SPELL", issueType: "misspelling" },
      replacements: [{ value: "casa" }, { value: "acasă" }],
    },
    { offset: 999, length: 4 },
  ];
  const issues = romanianIssues(text, raw);
  assert.equal(issues.length, 1);
  // Same letters but for the diacritic rank ahead of an unrelated word.
  assert.equal(issues[0].replacements[0], "acasă");
});
