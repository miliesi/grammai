const mac = () => /Mac|iPhone|iPad/.test(navigator.platform);
export function shortcutLabels(): [string, string][] {
  const mod = mac() ? "⌘" : "Ctrl+";
  const alt = mac() ? "⌥" : "Alt+";
  return [
    ["Translate", `${mod}⇧L`],
    ["Rewrite", `${mod}⇧K`],
    ["Open assistant", `${mod}⇧Y`],
    ["Next / previous correction", `${alt}↓ / ${alt}↑`],
    ["Accept correction", `${alt}Enter`],
    ["Dismiss correction", `${alt}Backspace`],
    ["Undo grammai edit", `${alt}Z`],
    ["Close", "Esc"],
  ];
}
export function shortcutAction(event: KeyboardEvent) {
  if (event.isComposing || event.repeat) return null;
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey) {
    return (
      ({ l: "translate", k: "rewrite", y: "assistant" } as const)[
        event.key.toLowerCase() as "l" | "k" | "y"
      ] ?? null
    );
  }
  if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
    return (
      (
        {
          ArrowDown: "next",
          ArrowUp: "previous",
          Enter: "accept",
          Backspace: "dismiss",
          KeyZ: "undo",
        } as const
      )[
        event.code as "ArrowDown" | "ArrowUp" | "Enter" | "Backspace" | "KeyZ"
      ] ?? null
    );
  }
  return null;
}
