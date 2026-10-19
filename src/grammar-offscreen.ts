// A dedicated worker keeps rule compilation and checking away from both the
// editor and the extension's UI/AI message handling. Termination frees its WASM
// memory after inactivity; no text or results are persisted.
let worker: Worker | undefined;
let sequence = 0;
let idle: ReturnType<typeof setTimeout> | undefined;
const pending = new Map<
  number,
  { respond: (result: any) => void; timeout: ReturnType<typeof setTimeout> }
>();
const failure = {
  ok: false,
  error: "Local checking could not start. Reload grammai and try again.",
};
function stop() {
  clearTimeout(idle);
  worker?.terminate();
  worker = undefined;
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    request.respond(failure);
  }
  pending.clear();
}
function getWorker() {
  if (worker) return worker;
  worker = new Worker("german-worker.js");
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    clearTimeout(request.timeout);
    request.respond(data);
    if (!pending.size) idle = setTimeout(stop, 60000);
  };
  worker.onerror = (event) => {
    event.preventDefault();
    stop();
  };
  worker.onmessageerror = stop;
  return worker;
}
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.target !== "grammar-offscreen") return;
  if (
    typeof message.text !== "string" ||
    message.text.length > 20000 ||
    (message.language !== "de" && message.language !== "ro")
  ) {
    respond(failure);
    return;
  }
  clearTimeout(idle);
  const id = ++sequence;
  pending.set(id, { respond, timeout: setTimeout(stop, 30000) });
  try {
    getWorker().postMessage({
      id,
      language: message.language,
      text: message.text,
      options: message.options,
    });
  } catch {
    stop();
  }
  return true;
});
