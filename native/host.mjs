#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createBridge, errorResponse, BridgeError } from "./bridge.mjs";
import { MessageDecoder, encodeMessage } from "./protocol.mjs";

// Chrome supplies the caller origin as an argument. Never accept requests from
// arbitrary web origins, a different extension, or direct unconfigured launches.
let config;
try {
  config = JSON.parse(await readFile(process.argv[2], "utf8"));
  if (
    !/^[a-p]{32}$/.test(config.extensionId) ||
    process.argv[3] !== `chrome-extension://${config.extensionId}/`
  )
    throw new Error("Origin mismatch");
} catch {
  process.stderr.write(
    "grammai native host: untrusted caller or invalid installation.\n",
  );
  process.exit(1);
}
const handle = createBridge(config);
const controller = new AbortController();
let disconnected = false;
function send(message) {
  if (!disconnected) process.stdout.write(encodeMessage(message));
}
const decoder = new MessageDecoder(
  (message) => {
    void handle(message, controller.signal).then(send);
  },
  (message) => {
    send(errorResponse(new BridgeError("INVALID_REQUEST", message)));
    process.stdin.pause();
    process.exitCode = 1;
  },
);
process.stdin.on("data", (chunk) => decoder.push(chunk));
process.stdin.on("end", () => {
  disconnected = true;
  decoder.end();
  controller.abort();
});
process.stdout.on("error", () => {
  disconnected = true;
  controller.abort();
});
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"])
  process.on(signal, () => {
    disconnected = true;
    controller.abort();
    process.exitCode = 0;
    process.stdin.destroy();
  });
