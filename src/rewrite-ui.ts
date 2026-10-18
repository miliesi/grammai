import { setupLink } from "./support";
import {
  el,
  isTranslation,
  type CustomPrompt,
  type RewriteView,
  type RewriteStyle,
} from "./shared";
import { promptManager } from "./prompt-manager";
export const rewriteStyles = `
.rewrite-generator{display:grid;gap:10px}.rewrite-generator.alternate{border-top:1px solid var(--line);padding-top:14px;margin-top:2px}.rewrite-generator>button{justify-self:start}.rewrite-regenerate{appearance:none;min-height:36px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--fg);font:inherit;font-size:12px;font-weight:550;padding:8px 12px;cursor:pointer}.rewrite-regenerate:hover{background:var(--hover)}.rewrite-box .rewrite-style{appearance:none;min-height:36px;max-width:none;padding-right:36px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;background-size:12px 12px}
.rewrite-box .setup-link{display:block;width:fit-content;margin:10px 0 0;font-size:11px;color:var(--muted);text-decoration:none}.rewrite-box .setup-link:hover{color:var(--fg);text-decoration:underline}.rewrite-box .setup-link:focus-visible{outline:2px solid var(--focus);outline-offset:3px}.rewrite-tabs{display:flex;gap:3px;padding:0 12px 7px;border-bottom:1px solid var(--line)}.rewrite-tab{flex:1;border:0;border-radius:7px;background:transparent;color:var(--muted);padding:7px 10px;font:inherit;font-size:12px;cursor:pointer}.rewrite-tab[aria-selected=true]{background:var(--subtle);color:var(--fg);font-weight:550}.rewrite-tab:hover{background:var(--hover)}.rewrite-box{display:flex;flex-direction:column;gap:12px;padding:16px}.rewrite-box label,.prompt-manager label{display:block;font-size:12px;font-weight:550;margin:0}.rewrite-style,.prompt-field{box-sizing:border-box;font:inherit;font-size:12px;width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);margin:6px 0 0}.rewrite-style:focus-visible,.prompt-field:focus-visible{outline:2px solid var(--focus);outline-offset:2px}.rewrite-hint,.rewrite-note{font-size:12px;line-height:1.6;color:var(--muted);margin:8px 0 12px}.rewrite-error{color:var(--fg);font-size:12px;line-height:1.6;margin:0 0 12px;padding:9px 11px;border:1px solid var(--line);border-radius:8px}.rewrite-preview{font-size:14px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:9px;background:var(--subtle);padding:12px;margin:0;color:var(--fg)}.rewrite-source{max-height:100px;margin-top:8px;font-size:12px;color:var(--muted);background:var(--bg)}.rewrite-label{font-size:11px;font-weight:550;color:var(--muted);margin:0}.rewrite-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.rewrite-primary{appearance:none;min-height:36px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font:inherit;font-size:12px;font-weight:550;padding:8px 12px;cursor:pointer}.rewrite-primary:hover{background:var(--green-dark)}.rewrite-secondary{appearance:none;border:0;background:transparent;color:var(--muted);font:inherit;font-size:11px;cursor:pointer;padding:6px 0}.rewrite-secondary:hover{color:var(--fg)}.rewrite-primary:disabled{opacity:.4;cursor:default}.rewrite-quick{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0}.rewrite-choice{border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:9px 10px;font:inherit;font-size:12px;text-align:left;color:var(--fg);cursor:pointer}.rewrite-choice:hover{background:var(--subtle)}.rewrite-choice:active{transform:scale(.98)}.rewrite-quick button:disabled{opacity:.4;cursor:default}.prompt-details{border-top:1px solid var(--line);margin-top:0;padding-top:10px}.prompt-details summary{font-size:11px;color:var(--muted);cursor:pointer}.prompt-manager{margin-top:12px}.prompt-row{display:flex;align-items:center;gap:10px;font-size:12px;padding:5px 0}.prompt-row strong{flex:1;overflow-wrap:anywhere}.prompt-manager textarea{resize:vertical;min-height:80px}.rewrite-progress{display:flex;align-items:center;gap:8px}.rewrite-spinner{width:13px;height:13px;border:1.5px solid var(--line);border-top-color:var(--fg);border-radius:50%;animation:grammai-spin .7s linear infinite}@keyframes grammai-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.rewrite-spinner{animation:none}}
`;
const choices: [RewriteStyle, string][] = [
  ["improve", "Improve writing"],
  ["fix", "Fix grammar & spelling"],
  ["rephrase", "Rephrase"],
  ["concise", "Make concise"],
  ["formal", "More professional"],
  ["friendly", "More friendly"],
  ["confident", "More confident"],
  ["simple", "Simplify"],
];
// Preserve the user's menu choice across live-check updates.
let preferred: string = "improve";
export function rewritePane(
  view: RewriteView | undefined,
  callbacks: {
    generate: (style: RewriteStyle, customPromptId?: string) => void;
    apply: () => void;
    cancel: () => void;
    promptsChanged?: () => void;
  },
  available = true,
  prompts: CustomPrompt[] = [],
) {
  const box = el("div", "rewrite-box");
  if (!available)
    box.append(el("p", "rewrite-note", "Select some text to start."));
  if (view?.phase === "loading") {
    const progress = el("div", "rewrite-progress");
    progress.setAttribute("role", "status");
    progress.append(
      el("span", "rewrite-spinner"),
      el(
        "p",
        "rewrite-note",
        isTranslation(view.style) ? "Translating…" : "Rewriting…",
      ),
    );
    box.append(
      progress,
      action("Cancel", "rewrite-secondary", callbacks.cancel),
    );
    return box;
  }
  if (view?.error) {
    const error = el("p", "rewrite-error", view.error);
    error.setAttribute("role", "alert");
    box.append(error, setupLink("ai", "Open setup guide"));
  }
  if (view?.phase === "ready" && view.result !== undefined) {
    const source = el("details");
    source.append(
      el("summary", "rewrite-secondary", "Show original"),
      el("div", "rewrite-preview rewrite-source", view.original),
    );
    box.append(
      source,
      el(
        "div",
        "rewrite-label",
        isTranslation(view.style) ? "Translation" : "Suggested rewrite",
      ),
      el("div", "rewrite-preview", view.result),
    );
    const actions = el("div", "rewrite-actions");
    actions.append(
      action(
        isTranslation(view.style) ? "Use this translation" : "Use this rewrite",
        "rewrite-primary",
        callbacks.apply,
      ),
      action("Discard", "rewrite-secondary", callbacks.cancel),
    );
    box.append(actions);
  } else {
    const quick = el("div", "rewrite-quick");
    for (const [value, text] of choices.filter(([value]) =>
      ["improve", "concise", "formal", "friendly"].includes(value),
    )) {
      const button = action(text, "rewrite-choice", () => {
        preferred = value;
        callbacks.generate(value);
      });
      button.disabled = !available;
      quick.append(button);
    }
    for (const prompt of prompts) {
      const button = action(prompt.name, "rewrite-choice", () => {
        preferred = `custom:${prompt.id}`;
        callbacks.generate("custom", prompt.id);
      });
      button.disabled = !available;
      quick.append(button);
    }
    box.append(quick);
  }
  const label = el(
    "label",
    "",
    view?.phase === "ready" ? "Another version" : "Style",
  );
  const select = el("select", "rewrite-style");
  select.setAttribute("aria-label", "Rewrite style");
  for (const [value, text] of [
    ...choices,
    ...prompts.map((p) => [`custom:${p.id}`, p.name]),
  ]) {
    const option = el("option", "", text);
    option.value = value;
    select.append(option);
  }
  select.value = view?.customPromptId
    ? `custom:${view.customPromptId}`
    : (view?.style ?? preferred);
  if (!select.value) select.value = "improve";
  label.append(select);
  const generate = action(
    "Generate rewrite",
    view?.phase === "ready" ? "rewrite-regenerate" : "rewrite-primary",
    () => {
      const value = select.value;
      callbacks.generate(
        value.startsWith("custom:") ? "custom" : (value as RewriteStyle),
        value.startsWith("custom:") ? value.slice(7) : undefined,
      );
    },
  );
  generate.disabled = !available;
  const updateLabel = () => {
    preferred = select.value;
    generate.textContent = isTranslation(select.value as RewriteStyle)
      ? "Translate & replace"
      : view?.phase === "ready"
        ? "Generate another version"
        : "Generate rewrite";
  };
  updateLabel();
  select.onchange = updateLabel;
  const generator = el(
    "div",
    view?.phase === "ready"
      ? "rewrite-generator alternate"
      : "rewrite-generator",
  );
  generator.append(label, generate);
  box.append(generator);
  if (callbacks.promptsChanged) {
    const details = el("details", "prompt-details");
    details.append(
      el("summary", "", "Your prompts"),
      promptManager(prompts, callbacks.promptsChanged),
    );
    box.append(details);
  }
  box.append(setupLink("ai", "AI settings"));
  return box;
}
export function translationPane(
  view: RewriteView | undefined,
  callbacks: Parameters<typeof rewritePane>[1],
  available = true,
) {
  const box = el("div", "rewrite-box");
  const translation = view && isTranslation(view.style) ? view : undefined;
  if (translation?.phase === "loading") {
    const progress = el("div", "rewrite-progress");
    progress.setAttribute("role", "status");
    progress.append(
      el("span", "rewrite-spinner"),
      el("span", "rewrite-note", "Translating…"),
    );
    box.append(
      progress,
      action("Cancel", "rewrite-secondary", callbacks.cancel),
    );
    return box;
  }
  if (translation?.error) {
    const error = el("p", "rewrite-error", translation.error);
    error.setAttribute("role", "alert");
    box.append(error, setupLink("ai", "Open setup guide"));
  }
  if (translation?.phase === "ready" && translation.result !== undefined) {
    box.append(
      el("div", "rewrite-preview", translation.result),
      action("Use this translation", "rewrite-primary", callbacks.apply),
      action("Discard", "rewrite-secondary", callbacks.cancel),
    );
    return box;
  }
  const label = el("label", "", "Translate to");
  const select = el("select", "rewrite-style");
  select.setAttribute("aria-label", "Translation language");
  for (const [value, text] of [
    ["translate-auto", "English ↔ Deutsch"],
    ["translate-en", "English"],
    ["translate-de", "Deutsch"],
  ]) {
    const option = el("option", "", text);
    option.value = value;
    select.append(option);
  }
  label.append(select);
  const translate = action("Translate", "rewrite-primary", () =>
    callbacks.generate(select.value as RewriteStyle),
  );
  translate.disabled = !available;
  box.append(label, translate);
  if (!available)
    box.append(el("p", "rewrite-note", "Select some text to start."));
  box.append(setupLink("ai", "AI settings"));
  return box;
}
function action(label: string, cls: string, cb: () => void) {
  const button = el("button", cls, label);
  button.type = "button";
  button.addEventListener("click", cb);
  return button;
}
