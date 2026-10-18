import type { EngineOptions } from "./engine";

let creating: Promise<void> | undefined;
export async function checkGerman(text: string, options: EngineOptions) {
  creating ??= (async () => {
    if (!(await chrome.offscreen.hasDocument()))
      await chrome.offscreen.createDocument({
        url: "grammar-offscreen.html",
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification:
          "Run the bundled German grammar checker locally in a worker without blocking writing.",
      });
  })().finally(() => {
    creating = undefined;
  });
  await creating;
  return chrome.runtime.sendMessage({
    target: "german-offscreen",
    text,
    options: { dictionary: options.dictionary, categories: options.categories },
  });
}
