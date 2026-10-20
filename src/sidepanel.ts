import { feedbackLink } from "./support";
import { initializePageTheme } from "./theme";
import {
  el,
  undoButton,
  categoryLabels,
  updateSettings,
  getSettings,
  type Snapshot,
  type Settings,
} from "./shared";
import type { Category, Issue } from "./engine";
import type { RewriteStyle } from "./shared";
import { rewritePane, translationPane, rewriteStyles } from "./rewrite-ui";
const rewriteStyle = el("style");
rewriteStyle.textContent = rewriteStyles;
document.head.append(rewriteStyle);
let settings: Settings;
let mode: "suggestions" | "rewrite" | "translate" = "suggestions";
const main = document.querySelector<HTMLElement>("#main")!;
let state: Snapshot | null = null;
let currentTab: number | undefined;
let filter: Category | "all" = "all";
let feedback = "";
function button(label: string, className: string, callback: () => void) {
  const b = el("button", className, label);
  b.type = "button";
  b.addEventListener("click", callback);
  return b;
}
async function load() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab?.id;
  state =
    currentTab !== undefined
      ? await chrome.runtime.sendMessage({
          type: "GET_STATE",
          tabId: currentTab,
        })
      : null;
  settings = await getSettings();
  render();
  if (currentTab !== undefined)
    chrome.tabs
      .sendMessage(currentTab, { type: "REQUEST_STATE" })
      .catch(() => {});
}
async function act(type: string, issue: Issue) {
  if (!state) return;
  const result = await chrome.runtime.sendMessage({
    type,
    issueId: issue.id,
    editorId: state.editorId,
    version: state.version,
    tabId: currentTab,
  });
  if (!result?.ok) {
    feedback = result?.error || "Select the text field to refresh suggestions.";
    render();
  }
}
async function rewriteAction(
  type: string,
  style?: RewriteStyle,
  customPromptId?: string,
) {
  if (!state) return;
  const result = await chrome.runtime.sendMessage({
    type,
    style,
    customPromptId,
    tabId: currentTab,
    editorId: state.editorId,
    version: state.version,
  });
  if (!result?.ok) {
    feedback = result?.error || "Select the text field to refresh suggestions.";
    render();
  }
}
function render() {
  const control = undoButton(!!state?.canUndo, () => {
    void rewriteAction("UNDO");
  });
  const previous = document.querySelector(".undo-control");
  if (previous) previous.replaceWith(control);
  else document.querySelector("#settings")?.before(control);
  const editing = document.activeElement;
  if (
    editing?.closest(".prompt-manager") &&
    (editing instanceof HTMLInputElement ||
      editing instanceof HTMLTextAreaElement)
  )
    return;
  main.replaceChildren();
  const tabs = el("div", "rewrite-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Writing tools");
  for (const option of ["suggestions", "rewrite", "translate"] as const) {
    const tab = button(
      option === "suggestions"
        ? "Suggestions"
        : option === "rewrite"
          ? "Rewrite"
          : "Translate",
      "rewrite-tab",
      () => {
        mode = option;
        render();
      },
    );
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(mode === option));
    tabs.append(tab);
  }
  main.append(tabs);
  if (mode === "rewrite" || mode === "translate") {
    const callbacks = {
      generate: (style: RewriteStyle, id?: string) =>
        rewriteAction("REWRITE_START", style, id),
      promptsChanged: async () => {
        settings = await getSettings();
        render();
      },
      apply: () => rewriteAction("REWRITE_APPLY"),
      cancel: () => rewriteAction("REWRITE_CANCEL"),
    };
    main.append(
      mode === "translate"
        ? translationPane(
            state?.rewrite,
            callbacks,
            !!state?.enabled && !!state.words,
          )
        : rewritePane(
            state?.rewrite,
            callbacks,
            !!state?.enabled && !!state.words,
            settings?.customPrompts,
          ),
    );
    if (feedback) main.append(el("p", "status", feedback));
    return;
  }

  if (!state || !state.enabled) {
    const empty = el("div", "empty");
    empty.append(
      el("h1", "", state ? "Checking is paused" : "Select a text field"),
    );
    main.append(empty);
    return;
  }
  const filters = el("div", "filters");
  for (const f of [
    "all",
    "correctness",
    "clarity",
    "engagement",
    "delivery",
  ] as const) {
    const count =
      f === "all"
        ? state.issues.length
        : state.issues.filter((i) => i.category === f).length;
    if (!count) continue;
    const b = button(
      `${f === "all" ? "All" : categoryLabels[f]} ${count}`,
      "chip",
      () => {
        filter = f;
        render();
      },
    );
    b.setAttribute("aria-pressed", String(filter === f));
    filters.append(b);
  }
  if (state.issues.length > 1) main.append(filters);
  const issues = state.issues.filter(
    (i) => filter === "all" || i.category === filter,
  );
  const heading = el("div", "heading");
  heading.append(
    el("strong", "", "Review suggestions"),
    el("span", "count", `${issues.length} suggestions`),
  );
  main.append(heading);
  if (feedback) main.append(el("p", "status", feedback));
  if (state.limited)
    main.append(
      el("p", "notice", "Checking the first 20,000 characters of this field."),
    );
  if (!issues.length) {
    const empty = el("div", "empty");
    empty.append(
      el(
        "h1",
        "",
        state.checking
          ? "Checking…"
          : state.checkError
            ? "Check unavailable"
            : "No suggestions",
      ),
    );
    if (state.checkError) empty.append(el("p", "", state.checkError));
    main.append(empty);
  }
  for (const issue of issues) {
    const card = el("article", "card");
    card.append(el("h2", "", issue.shortMessage));
    const diff = el("div", "diff");
    diff.append(el("span", "old", issue.original));
    if (issue.replacements.length)
      diff.append(
        el("span", "arrow", "→"),
        el("span", "new", issue.replacements[0] || "Remove"),
      );
    card.append(diff);
    const actions = el("div", "actions");
    if (issue.replacements.length)
      actions.append(
        button("Accept", "accept", () => {
          void act("APPLY", issue);
        }),
      );
    actions.append(
      button("Dismiss", "text-button", () => {
        void act("DISMISS", issue);
      }),
      button("Show in text", "text-button", () => {
        void act("FOCUS_ISSUE", issue);
      }),
    );
    card.append(actions);
    if (issue.kind === "spelling")
      card.append(
        button("＋ Add to dictionary", "text-button dictionary", async () => {
          const settings = await getSettings();
          await updateSettings({
            dictionary: [...new Set([...settings.dictionary, issue.original])],
          });
          feedback = "Added to your dictionary.";
        }),
      );
    if (issue.message) {
      const why = el("details", "explanation");
      why.append(el("summary", "", "Why?"), el("p", "", issue.message));
      card.append(why);
    }
    main.append(card);
  }
  main.append(
    button(
      "Check context",
      "text-button context-action",
      () => void rewriteAction("REWRITE_START", "fix"),
    ),
  );
}
chrome.runtime.onMessage.addListener((m) => {
  if (m.type === "STATE_CLEARED" && m.tabId === currentTab) {
    state = null;
    render();
    return;
  }
  if (m.type === "STATE_CHANGED" && m.state.tabId === currentTab) {
    if (m.state.rewrite && !m.state.rewrite.style.startsWith("translate-"))
      mode = "rewrite";
    state = m.state;
    render();
  }
});
chrome.tabs.onActivated.addListener(() => {
  feedback = "";
  void load();
});
chrome.tabs.onUpdated.addListener((id, info) => {
  if (id === currentTab && info.status === "loading") {
    state = null;
    render();
  }
});
document.querySelector("#settings")?.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.settings) {
    settings = await getSettings();
    render();
  }
});
void load();

void initializePageTheme({ toggle: false });

document.querySelector("#feedback-link")!.append(feedbackLink());
