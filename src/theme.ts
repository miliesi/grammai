import { getSettings, updateSettings, type Settings } from "./shared";

export const themeStyles = `
:root,:host{color-scheme:light;--bg:#fff;--fg:#171717;--muted:#737373;--line:#e7e7e7;--subtle:#f6f6f6;--hover:#ededed;--accent:#171717;--on-accent:#fff;--shadow:0 8px 32px #00000012,0 1px 4px #00000008;--green:var(--accent);--green-dark:#333;--focus:#858585}
:root[data-theme=dark],:host([data-theme=dark]){color-scheme:dark;--bg:#191919;--fg:#ededed;--muted:#a1a1a1;--line:#343434;--subtle:#232323;--hover:#303030;--accent:#ededed;--on-accent:#171717;--shadow:0 8px 32px #00000040,0 1px 4px #00000030;--green-dark:#ccc}
`;
export function resolvedTheme(theme: Settings["theme"]) {
  return theme === "system"
    ? matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : theme;
}
export function themeButton(theme: Settings["theme"], change: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon theme-toggle";
  const dark = resolvedTheme(theme) === "dark";
  button.title = button.ariaLabel = `Switch to ${dark ? "light" : "dark"} mode`;
  // Inline SVG keeps the same weight and alignment in every host page.
  button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${dark ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>' : '<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>'}</svg>`;
  button.onclick = change;
  return button;
}
export async function initializePageTheme({ toggle = true } = {}) {
  const style = document.createElement("style");
  style.textContent = themeStyles;
  document.head.append(style);
  let settings = await getSettings();
  const render = () => {
    document.documentElement.dataset.theme = resolvedTheme(settings.theme);
    if (!toggle) return;
    const old = document.querySelector(".theme-toggle");
    const next = themeButton(settings.theme, async () => {
      settings = await updateSettings({
        theme: resolvedTheme(settings.theme) === "dark" ? "light" : "dark",
      });
      render();
    });
    const appearance = document.querySelector<HTMLSelectElement>("#appearance");
    if (appearance) appearance.value = settings.theme;
    if (old) {
      const focused = old === document.activeElement;
      old.replaceWith(next);
      if (focused) next.focus({ preventScroll: true });
    } else
      document
        .querySelector(".head-actions, .app-header, header")
        ?.append(next);
  };
  render();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
  chrome.storage.onChanged.addListener(async (changes) => {
    if (changes.settings) {
      settings = await getSettings();
      render();
    }
  });
}
