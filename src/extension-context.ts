/** An old content script can outlive the extension that injected it. */
export function createExtensionContext(
  onInvalidated: () => void,
  valid = () => !!chrome.runtime.id,
) {
  let active = true;
  const invalidate = () => {
    if (!active) return;
    active = false;
    onInvalidated();
  };
  const available = () => {
    if (!active) return false;
    try {
      if (valid()) return true;
    } catch {
      // Accessing chrome.runtime itself may throw in a detached context.
    }
    invalidate();
    return false;
  };
  return {
    available,
    async call<T>(operation: () => T | Promise<T>): Promise<T | undefined> {
      if (!available()) return;
      try {
        // Keep invocation inside try: sendMessage can throw synchronously,
        // before a Promise exists for .catch() to handle.
        const result = await operation();
        return available() ? result : undefined;
      } catch (error) {
        if (!available()) return;
        if (
          /extension context invalidated/i.test(
            error instanceof Error ? error.message : String(error),
          )
        ) {
          invalidate();
          return;
        }
        throw error;
      }
    },
  };
}
