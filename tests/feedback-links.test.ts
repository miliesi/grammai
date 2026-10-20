import assert from "node:assert/strict";
import test from "node:test";
import { issueUrl, feedbackEmailUrl } from "../src/feedback-links";

test("bug and idea drafts target the public repository and their matching templates", () => {
  for (const [kind, template, heading] of [
    ["bug", "bug_report.md", "## What happened?"],
    ["idea", "feature_request.md", "## The writing problem"],
  ] as const) {
    const url = new URL(issueUrl(kind, "0.6.6"));
    assert.equal(url.origin, "https://github.com");
    assert.equal(url.pathname, "/zilvestro/grammai/issues/new");
    assert.equal(url.searchParams.get("template"), template);
    const body = url.searchParams.get("body")!;
    assert(body.startsWith(heading));
    assert(body.includes("- grammai version: 0.6.6\n"));
    assert.deepEqual([...url.searchParams.keys()], ["template", "body"]);
    assert(
      url.href.length < 2000,
      "keep issue links short enough to open reliably",
    );
  }
});

test("email feedback remains available without a GitHub account", () => {
  const url = new URL(feedbackEmailUrl("0.6.6"));
  assert.equal(url.protocol, "mailto:");
  assert.equal(url.pathname, "grammai@zaapp.io");
  assert.equal(url.searchParams.get("subject"), "grammai feedback");
  assert.equal(
    url.searchParams.get("body"),
    "What could be better?\n\n\n---\ngrammai 0.6.6\n",
  );
});
