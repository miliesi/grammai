export const MAX_REQUEST_BYTES = 100_000;
export const MAX_RESPONSE_BYTES = 900_000;

export function encodeMessage(message) {
  const payload = Buffer.from(JSON.stringify(message));
  if (payload.length > MAX_RESPONSE_BYTES)
    throw new Error("Response too large");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length);
  return Buffer.concat([header, payload]);
}

// Chrome may split either the four-byte header or the JSON across pipe reads.
export class MessageDecoder {
  constructor(onMessage, onError) {
    this.onMessage = onMessage;
    this.onError = onError;
    this.buffer = Buffer.alloc(0);
    this.failed = false;
  }
  push(chunk) {
    if (this.failed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      const size = this.buffer.readUInt32LE(0);
      if (!size || size > MAX_REQUEST_BYTES)
        return this.fail("Invalid native message size.");
      if (this.buffer.length < 4 + size) return;
      const payload = this.buffer.subarray(4, 4 + size);
      this.buffer = this.buffer.subarray(4 + size);
      try {
        this.onMessage(JSON.parse(payload.toString("utf8")));
      } catch {
        return this.fail("Invalid native message JSON.");
      }
    }
  }
  end() {
    if (this.buffer.length) this.fail("Incomplete native message.");
  }
  fail(message) {
    this.failed = true;
    this.buffer = Buffer.alloc(0);
    this.onError(message);
  }
}
