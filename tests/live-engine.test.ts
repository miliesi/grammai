import test from "node:test";
import assert from "node:assert/strict";
import { slimBinary } from "harper.js/slimBinary";
import { createLiveChecker } from "../src/live-engine";
const checker = createLiveChecker(slimBinary);
test.after(async () => checker.dispose());

test("diagnoses the entire reported draft, not just capitalization", async () => {
  const text =
    "is this really necessary? Or doe you think is good?  neseccary? \n";
  const issues = await checker.check(text);
  for (const [original, replacement] of [
    ["doe", "do"],
    ["is", "it is"],
    ["neseccary", "necessary"],
  ]) {
    assert(
      issues.some(
        (issue) =>
          issue.original === original && issue.replacements[0] === replacement,
      ),
      `${original} → ${replacement}`,
    );
  }
  for (const issue of issues)
    assert.equal(
      text.slice(issue.offset, issue.offset + issue.length),
      issue.original,
    );
  let corrected = text;
  // Multiple passes also exercise overlaps and sentence-initial spelling fixes.
  for (let pass = 0; pass < 3; pass++) {
    const corrections = await checker.check(corrected);
    for (const issue of [...corrections].reverse()) {
      if (issue.replacements.length)
        corrected =
          corrected.slice(0, issue.offset) +
          issue.replacements[0] +
          corrected.slice(issue.offset + issue.length);
    }
  }
  assert.equal(
    corrected,
    "Is this really necessary? Or do you think it is good? Necessary? \n",
  );
  assert.deepEqual(await checker.check(corrected), []);
});

test("recognizes unlisted spelling and grammatical inflections", async () => {
  for (const [text, original, replacement] of [
    ["We need neseccary changes.", "neseccary", "necessary"],
    ["Neseccary changes are useful.", "Neseccary", "Necessary"],
    ["She go to school.", "go", "goes"],
    ["He walk to work.", "walk", "walks"],
    ["We need reliablity.", "reliablity", "reliability"],
  ]) {
    const issues = await checker.check(text);
    assert(
      issues.some(
        (i) => i.original === original && i.replacements[0] === replacement,
      ),
      JSON.stringify(issues),
    );
  }
});

test("keeps correct context, proper names, repetitions and technical content", async () => {
  for (const text of [
    "The doe is standing beside her fawn.",
    "The doe you think is small is standing beside her fawn.",
    "Who do you think is good? What do you think is necessary?",
    "Is this really necessary? Or do you think it is good?",
    "I had had enough. I knew that that was right. If she were here, we would go.",
    "An hour is enough. A university is nearby. An unknown person arrived.",
    "We met Alex and Xiomara. We use PostgreSQL, TypeScript, GitHub and OpenAI.",
    "Read `doe you think is good? neseccary` at https://neseccary.example.com or mail doe@example.com.",
  ])
    assert.deepEqual(await checker.check(text), [], text);
});

test("does not silently lose unknown words without replacement candidates", async () => {
  const issues = await checker.check("We study heteroscedasticity.");
  const issue = issues.find((i) => i.original === "heteroscedasticity");
  assert(issue);
  assert.equal(issue.shortMessage, "Unknown word");
  assert.deepEqual(issue.replacements, []);
  assert.deepEqual(
    await checker.check("We study heteroscedasticity.", {
      dictionary: ["heteroscedasticity"],
    }),
    [],
  );
});

test("keeps exact DOM ranges after emoji, combining marks and non-Latin text", async () => {
  for (const prefix of ["😀 ", "👩🏽‍💻 ", "𝄞 ", "Café and café. ", "中文。 "]) {
    const text = `${prefix}We need neseccary changes.`;
    const issue = (await checker.check(text)).find(
      (i) => i.original === "neseccary",
    );
    assert(issue, prefix);
    assert.equal(issue.offset, text.indexOf("neseccary"), prefix);
    assert.equal(
      text.slice(issue.offset, issue.offset + issue.length),
      "neseccary",
    );
  }
});

test("keeps optional comma styles out of correctness suggestions", async () => {
  // Oxford commas remain optional instead of being labeled an error.
  assert.deepEqual(
    await checker.check("We use apples, pears and oranges."),
    [],
  );
});

test("serializes dialect configuration and honors categories across concurrent checks", async () => {
  const text = "We need neseccary changes. She go to school.";
  const [american, disabled, british] = await Promise.all([
    checker.check(text, { dialect: "en-US" }),
    checker.check(text, {
      dialect: "en-GB",
      categories: { correctness: false },
    }),
    checker.check("My favorite color is blue.", { dialect: "en-GB" }),
  ]);
  assert(american.some((i) => i.original === "neseccary"));
  assert.deepEqual(disabled, []);
  assert(british.some((i) => i.replacements[0] === "favourite"));
  assert(british.some((i) => i.replacements[0] === "colour"));
});
