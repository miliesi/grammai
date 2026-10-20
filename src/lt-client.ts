import type { EngineOptions } from "./engine";
import type { LtLanguage } from "./lt-engine";

let creating: Promise<void> | undefined;
/** Check German or Romanian text with the bundled engine in the offscreen worker. */
export async function checkLocal(
  language: LtLanguage,
  text: string,
  options: EngineOptions,
) {
  creating ??= (async () => {
    if (!(await chrome.offscreen.hasDocument()))
      await chrome.offscreen.createDocument({
        url: "grammar-offscreen.html",
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification:
          "Run the bundled German and Romanian grammar checkers locally in a worker without blocking writing.",
      });
  })().finally(() => {
    creating = undefined;
  });
  await creating;
  return chrome.runtime.sendMessage({
    target: "grammar-offscreen",
    language,
    text,
    options: { dictionary: options.dictionary, categories: options.categories },
  });
}
