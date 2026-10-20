import { chromium } from "playwright";
import { expect } from "playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startServer } from "../scripts/serve.mjs";
import { openAssistant } from "./ui-helpers.mjs";

const profile = await mkdtemp(path.join(tmpdir(), "grammai-feedback-"));
const extension = path.resolve(process.env.GRAMMAI_EXTENSION_PATH || "dist");
const server = await startServer(0);
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
  viewport: { width: 1280, height: 900 },
});
context.setDefaultTimeout(15000);
const errors = [],
  requests = [];
context.on("weberror", (event) => errors.push(event.error().message));
context.on("request", (request) => {
  if (/^https?:/.test(request.url()) && !request.url().includes("127.0.0.1"))
    requests.push(request.url());
});
// Verify navigation and the exact draft without creating a public test issue.
await context.route("https://github.com/**", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: "<title>GitHub issue draft</title><p>Review your report on GitHub</p>",
  }),
);
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).hostname;
  const version = await worker.evaluate(
    () => chrome.runtime.getManifest().version,
  );
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const editor = page.getByRole("textbox", {
    name: "Writing editor",
    exact: true,
  });
  const sentinel = "This is definately PRIVATE_DRAFT_SENTINEL_987.";
  await editor.fill(sentinel);
  const assistant = page.locator("quill-assistant");
  await expect(assistant.locator(".underline").first()).toBeVisible();
  await openAssistant(page, editor, assistant);
  const [feedback] = await Promise.all([
    context.waitForEvent("page"),
    assistant.getByRole("link", { name: "Send feedback", exact: true }).click(),
  ]);
  await feedback.waitForLoadState("domcontentloaded");
  await expect(feedback).toHaveURL(`chrome-extension://${id}/feedback.html`);
  await expect(
    feedback.getByRole("heading", { name: "Help improve grammai." }),
  ).toBeVisible();
  assert.equal(await editor.inputValue(), sentinel);
  assert(!(await feedback.content()).includes("PRIVATE_DRAFT_SENTINEL"));
  assert.deepEqual(
    requests,
    [],
    "opening feedback must stay inside the extension",
  );
  console.log(
    "PASS the in-editor link opens bundled feedback without collecting the draft or visiting GitHub",
  );

  for (const filename of [
    "popup.html",
    "options.html",
    "help.html",
    "sidepanel.html",
  ]) {
    const surface = await context.newPage();
    await surface.goto(`chrome-extension://${id}/${filename}`);
    const [opened] = await Promise.all([
      context.waitForEvent("page"),
      surface.getByRole("link", { name: "Send feedback", exact: true }).click(),
    ]);
    await opened.waitForLoadState("domcontentloaded");
    await expect(opened).toHaveURL(`chrome-extension://${id}/feedback.html`);
    await opened.close();
    await surface.close();
  }
  assert.deepEqual(requests, []);
  console.log(
    "PASS feedback opens from the popup, settings, help and sidebar using the current installation ID",
  );

  for (const [label, template] of [
    ["Report a bug", "bug_report.md"],
    ["Suggest an idea", "feature_request.md"],
  ]) {
    const [draft] = await Promise.all([
      context.waitForEvent("page"),
      feedback.getByRole("link", { name: label, exact: true }).click(),
    ]);
    await draft.waitForLoadState("domcontentloaded");
    const url = new URL(draft.url());
    assert.equal(url.origin, "https://github.com");
    assert.equal(url.pathname, "/zilvestro/grammai/issues/new");
    assert.equal(url.searchParams.get("template"), template);
    assert(
      url.searchParams.get("body").includes(`- grammai version: ${version}\n`),
    );
    assert(!url.href.includes("PRIVATE_DRAFT_SENTINEL"));
    assert(!url.href.includes("127.0.0.1"));
    assert(!url.href.includes(id));
    assert.deepEqual([...url.searchParams.keys()], ["template", "body"]);
    await draft.close();
  }
  assert.equal(requests.length, 2);
  console.log(
    "PASS bug and idea actions open separate GitHub drafts with only version metadata",
  );

  const mail = new URL(
    await feedback
      .getByRole("link", { name: "Email grammai@zaapp.io" })
      .getAttribute("href"),
  );
  assert.equal(mail.protocol, "mailto:");
  assert.equal(mail.pathname, "grammai@zaapp.io");
  assert.equal(
    mail.searchParams.get("body"),
    `What could be better?\n\n\n---\ngrammai ${version}\n`,
  );
  await expect(feedback.locator("#github-note")).toContainText("public");
  await expect(feedback.locator("#github-note")).toContainText(
    "GitHub account",
  );
  console.log(
    "PASS public GitHub reporting is explained and email remains available without a GitHub account",
  );

  await mkdir("artifacts", { recursive: true });
  await feedback.screenshot({
    path: "artifacts/feedback-light.png",
    fullPage: true,
  });
  await feedback.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(feedback.locator("html")).toHaveAttribute("data-theme", "dark");
  await feedback.screenshot({
    path: "artifacts/feedback-dark.png",
    fullPage: true,
  });
  await feedback.setViewportSize({ width: 390, height: 844 });
  assert(
    await feedback.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await feedback.screenshot({
    path: "artifacts/feedback-mobile.png",
    fullPage: true,
  });
  await feedback.getByRole("button", { name: "Switch to light mode" }).click();
  await feedback.setViewportSize({ width: 1280, height: 900 });

  let html = await feedback.content();
  for (const name of ["ui.css", "feedback.css"])
    html = html.replace(
      new RegExp(`<link[^>]+href="${name}"[^>]*>`),
      `<style>${await readFile(`public/${name}`, "utf8")}</style>`,
    );
  html = html
    .replace(/<script[^>]*src="feedback.js"[^>]*><\/script>/g, "")
    .replace('src="brand/icon.png"', 'src="feedback-icon.png"');
  await writeFile("artifacts/feedback-preview.html", html);
  await writeFile(
    "artifacts/feedback-icon.png",
    await readFile("public/brand/icon.png"),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS feedback follows the theme, fits narrow screens and produces no browser errors",
  );
  console.log(`Feedback checks passed for ${id} (${extension}).`);
} finally {
  await context.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
