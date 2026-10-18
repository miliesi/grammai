import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionContext } from "../src/extension-context";

test("catches synchronous invalidation before an API returns its Promise", async () => {
  let stopped = 0;
  const context = createExtensionContext(
    () => stopped++,
    () => true,
  );
  assert.equal(
    await context.call(() => {
      throw new Error("Extension context invalidated.");
    }),
    undefined,
  );
  assert.equal(stopped, 1);
  assert.equal(context.available(), false);
  await context.call(() =>
    assert.fail("must never call an invalidated API again"),
  );
  assert.equal(stopped, 1);
});

test("missing or throwing runtime.id triggers cleanup before any API call", async () => {
  for (const valid of [
    () => false,
    () => {
      throw new Error("Context gone");
    },
  ]) {
    let stopped = 0;
    const context = createExtensionContext(() => stopped++, valid);
    await context.call(() => assert.fail("detached API invoked"));
    assert.equal(stopped, 1);
  }
});

test("discards an in-flight result if the extension reloads during the request", async () => {
  let alive = true;
  let stopped = 0;
  let finish!: (result: string) => void;
  const context = createExtensionContext(
    () => stopped++,
    () => alive,
  );
  const pending = context.call(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  alive = false;
  finish("old suggestions");
  assert.equal(await pending, undefined);
  assert.equal(stopped, 1);
});

test("handles an asynchronous invalidation rejection without hiding ordinary errors", async () => {
  const context = createExtensionContext(
    () => {},
    () => true,
  );
  await assert.rejects(
    context.call(() => Promise.reject(new Error("ordinary failure"))),
    /ordinary failure/,
  );
  assert.equal(context.available(), true);
  assert.equal(
    await context.call(() =>
      Promise.reject(new Error("Extension context invalidated.")),
    ),
    undefined,
  );
  assert.equal(context.available(), false);
});
