import { chromium } from "playwright";
import { build } from "esbuild";
import assert from "node:assert/strict";
const bundle = await build({
  entryPoints: ["src/editor-text.ts"],
  bundle: true,
  format: "iife",
  globalName: "QuillEditor",
  write: false,
});
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage();
let cases = 0;
try {
  await page.setContent('<div id="e" contenteditable="true"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const [html, text, needle] of [
    [
      "<div><span>First line.</span></div><div><b>Second</b> line.</div>",
      "First line.\nSecond line.",
      "Second",
    ],
    ["<p>First</p>then", "First\nthen", "then"],
    ["Hello<br><span>world</span>", "Hello\nworld", "world"],
    [
      "<div>Hello</div><div><br></div><div>world</div>",
      "Hello\n\nworld",
      "world",
    ],
    [
      "😀 A <b>nested <i>passage</i></b> here.",
      "😀 A nested passage here.",
      "nested passage",
    ],
  ]) {
    const result = await page.evaluate(
      ({ html, needle }) => {
        const editor = document.querySelector("#e");
        editor.innerHTML = html;
        const text = QuillEditor.editorText(editor);
        const offset = text.indexOf(needle);
        const range = QuillEditor.editorRange(editor, offset, needle.length);
        const selected = QuillEditor.selectedOffsets(editor, range);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        editor.focus();
        const edited = document.execCommand("insertText", false, "replacement");
        return {
          text,
          selected,
          after: QuillEditor.editorText(editor),
          edited,
        };
      },
      { html, needle },
    );
    assert.equal(result.text, text);
    assert.deepEqual(result.selected, {
      offset: text.indexOf(needle),
      length: needle.length,
    });
    assert.equal(result.edited, true);
    assert.equal(result.after, text.replace(needle, "replacement"));
    cases++;
  }
  console.log(`${cases} DOM mapping and native replacement scenarios passed.`);
} finally {
  await browser.close();
}
