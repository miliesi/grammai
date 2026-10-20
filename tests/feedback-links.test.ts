import assert from "node:assert/strict";
import test from "node:test";
import { feedbackEmailUrl } from "../src/feedback-links";

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
