const HOST = "com.quill.assistant";
const requests = new Map<
  string,
  { port: chrome.runtime.Port; tabId?: number }
>();
export function cancelNative(id: string, tabId?: number) {
  const pending = requests.get(id);
  if (pending && pending.tabId === tabId) {
    requests.delete(id);
    pending.port.disconnect();
  }
}
export async function nativeRequest(
  payload: Record<string, unknown>,
  requestId = crypto.randomUUID(),
  tabId?: number,
): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connectNative(HOST);
    } catch {
      resolve({
        ok: false,
        error:
          "grammai’s local helper is not installed. Open the setup guide to connect your AI.",
      });
      return;
    }
    requests.set(requestId, { port, tabId });
    let settled = false;
    const finish = (response: Record<string, any>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      requests.delete(requestId);
      port.disconnect();
      resolve(response);
    };
    const timer = setTimeout(
      () =>
        finish({
          ok: false,
          error:
            "The local AI request timed out. Try again or choose another provider in Settings.",
        }),
      125000,
    );
    port.onMessage.addListener((response) => {
      if (!response || typeof response !== "object")
        finish({
          ok: false,
          error: "The local AI bridge returned an invalid response.",
        });
      else
        finish({
          ...response,
          error:
            typeof response.error === "object"
              ? response.error?.message
              : response.error,
        });
    });
    port.onDisconnect.addListener(() => {
      const reason = chrome.runtime.lastError?.message ?? "";
      finish({
        ok: false,
        error: /not found|forbidden|not registered/i.test(reason)
          ? "grammai’s local helper is not connected. Open the setup guide and run the helper installation command."
          : reason
            ? "The local AI bridge disconnected. Check the connection in Settings."
            : "The rewrite was cancelled.",
      });
    });
    try {
      port.postMessage(payload);
    } catch {
      finish({ ok: false, error: "Could not contact the local AI bridge." });
    }
  });
}
