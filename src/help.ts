import { feedbackLink } from "./support";
import { getSettings, updateSettings } from "./shared";
import { initializePageTheme } from "./theme";

const manifest = chrome.runtime.getManifest();
const id = chrome.runtime.id;
if (!/^[a-p]{32}$/.test(id)) throw new Error("Invalid extension ID.");
const bundleName = `grammai-helper-${manifest.version}.zip`;
document.querySelector<HTMLAnchorElement>("#download-helper")!.download =
  bundleName;
const helperPath = '"$HOME/Downloads/grammai-helper"';
const unpack = `unzip -o "$HOME/Downloads/${bundleName}" -d ${helperPath}`;
document.querySelector("#helper-command")!.textContent =
  `${unpack} &&\nnode "$HOME/Downloads/grammai-helper/scripts/install-native.mjs" --extension-id ${id}`;
const aiSetup = document.querySelector<HTMLDetailsElement>("#ai")!;
let setupReady = false;
function showRequestedHelp() {
  if (location.hash === "#ai" || location.hash === "#helper")
    aiSetup.open = true;
}
showRequestedHelp();
window.addEventListener("hashchange", showRequestedHelp);
document
  .querySelector("#feedback-link")!
  .append(feedbackLink(manifest.version));

let provider: "claude" | "codex" = "codex";
let providerChanged = false;
function showProvider(next: typeof provider) {
  provider = next;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-provider]",
  ))
    button.ariaPressed = String(button.dataset.provider === provider);
  document.querySelector("#provider-command")!.textContent =
    provider === "codex"
      ? "curl -fsSL https://chatgpt.com/codex/install.sh | sh\ncodex login"
      : "curl -fsSL https://claude.ai/install.sh | bash\nclaude auth login";
  const docs = document.querySelector<HTMLAnchorElement>("#provider-docs")!;
  docs.href =
    provider === "codex"
      ? "https://developers.openai.com/codex/cli"
      : "https://code.claude.com/docs/en/quickstart";
  renderSetup();
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-provider]",
)) {
  button.onclick = async () => {
    providerChanged = true;
    showProvider(button.dataset.provider as typeof provider);
    try {
      await updateSettings({ aiProvider: provider });
    } catch {
      document.querySelector("#connection-status")!.textContent =
        "Could not save the provider. Select it in AI settings.";
    }
  };
}
showProvider(provider);
void getSettings().then((settings) => {
  if (!providerChanged)
    showProvider(settings.aiProvider === "claude" ? "claude" : "codex");
});

const mac = /Mac/.test(navigator.platform);
if (!mac) {
  const note = document.querySelector("#platform-note")!;
  note.textContent =
    "The optional AI helper currently supports macOS. English and German spelling and grammar work here directly in the extension.";
  note.classList.add("unsupported");
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    ".copy-command",
  ))
    button.disabled = true;
  document.querySelector<HTMLAnchorElement>("#download-helper")!.hidden = true;
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-copy]",
)) {
  let timer: ReturnType<typeof setTimeout>;
  button.onclick = async () => {
    const text =
      document.getElementById(button.dataset.copy!)!.textContent ?? "";
    const status = document.querySelector("#copy-status")!;
    try {
      await navigator.clipboard.writeText(text);
      clearTimeout(timer);
      button.textContent = "Copied";
      status.textContent = "Command copied. Paste it into Terminal to run it.";
      timer = setTimeout(() => {
        button.textContent = "Copy";
      }, 1800);
    } catch {
      button.textContent = "Select text";
      const range = document.createRange();
      range.selectNodeContents(document.getElementById(button.dataset.copy!)!);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      status.textContent =
        "Copy was blocked. The command is selected; press Command+C to copy it.";
    }
  };
}
const check = document.querySelector<HTMLButtonElement>("#check-connection")!;
type ConnectionState =
  | "idle"
  | "checking"
  | "connected"
  | "missing"
  | "unknown";
let connection: ConnectionState = "idle";
let providers: { id: string; available: boolean }[] = [];
let showAllSteps = false;
const installation = document.querySelector<HTMLElement>("#ai-installation")!;
const setupToggle = document.querySelector<HTMLButtonElement>("#show-setup")!;
function renderSetup() {
  // Provider preference can render before the setup controls are initialized.
  if (!setupReady) return;
  const selectedAvailable = providers.some(
    (p) => p.id === provider && p.available,
  );
  const connected = connection === "connected";
  const helperNeeded = !connected || showAllSteps;
  document.querySelector<HTMLElement>("#prepare-step")!.hidden = !helperNeeded;
  document.querySelector<HTMLElement>("#helper")!.hidden = !helperNeeded;
  document.querySelector<HTMLElement>("#provider-step")!.hidden =
    selectedAvailable && !showAllSteps;
  installation.hidden =
    !showAllSteps &&
    connection !== "missing" &&
    !(connected && !selectedAvailable);
  setupToggle.hidden =
    connection === "idle" ||
    connection === "checking" ||
    connection === "missing";
  setupToggle.textContent = showAllSteps
    ? "Hide setup instructions"
    : "Show setup instructions";
  setupToggle.ariaExpanded = String(showAllSteps);
  document.querySelector<HTMLElement>("#platform-note")!.hidden =
    mac && (connected || connection === "checking");
}
async function checkConnection() {
  if (connection === "checking") return;
  connection = "checking";
  renderSetup();
  check.disabled = true;
  const status = document.querySelector("#connection-status")!;
  status.textContent = "Checking your local helper…";
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage({ type: "AI_STATUS" }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error("The check timed out. Run step 3 again, then retry."),
            ),
          15000,
        );
      }),
    ]);
    if (!response?.ok)
      throw new Error(
        response?.error ||
          "The helper is not connected. Complete step 3, then retry.",
      );
    if (!Array.isArray(response.providers))
      throw new Error(
        "The AI helper returned an invalid status. Check again or open setup instructions.",
      );
    providers = response.providers.filter(
      (p: any) =>
        p &&
        ["claude", "codex"].includes(p.id) &&
        typeof p.available === "boolean",
    );
    connection = "connected";
    status.textContent = [
      "Helper connected.",
      ...["codex", "claude"].map(
        (id) =>
          `${id === "codex" ? "Codex" : "Claude Code"}: ${providers.some((p: { id: string; available: boolean }) => p.id === id && p.available) ? "found" : "not found"}`,
      ),
      "A rewrite checks sign-in and account access.",
    ].join("\n");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Connection check failed. Try again.";
    connection =
      /not installed|not connected|not found|not registered|forbidden/i.test(
        message,
      )
        ? "missing"
        : "unknown";
    providers = [];
    status.textContent = message;
  } finally {
    clearTimeout(timeout);
    check.disabled = false;
    renderSetup();
  }
}
check.onclick = () => {
  void checkConnection();
};
setupToggle.onclick = () => {
  showAllSteps = !showAllSteps;
  renderSetup();
};
setupReady = true;
renderSetup();
aiSetup.addEventListener("toggle", () => {
  if (aiSetup.open && connection === "idle") void checkConnection();
});
if (aiSetup.open) void checkConnection();
void initializePageTheme();
