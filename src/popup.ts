import { initializePageTheme } from "./theme";
import { feedbackLink } from "./support";
import { getSettings, updateSettings, type Settings } from "./shared";

type Category = keyof Settings["categories"];
const enabled = document.querySelector<HTMLInputElement>("#enabled")!;
const siteEnabled = document.querySelector<HTMLInputElement>("#site-enabled")!;
const siteLabel = document.querySelector<HTMLElement>("#current-site")!;
const categoryToggles = [
  ...document.querySelectorAll<HTMLInputElement>(".category-toggle"),
];
const status = document.querySelector<HTMLElement>("#status")!;
let settings: Settings;
let domain = "";
let saveQueue = Promise.resolve();

function showStatus(message: string, error = false): void {
  status.textContent = message;
  status.classList.toggle("error", error);
  status.classList.toggle("visually-hidden", !error);
}

function render(): void {
  enabled.checked = settings.enabled;
  siteEnabled.checked =
    Boolean(domain) && !settings.disabledSites.includes(domain);
  siteEnabled.disabled = !domain;
  for (const toggle of categoryToggles)
    toggle.checked = settings.categories[toggle.dataset.category as Category];
}

function save(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  render();
  saveQueue = saveQueue.then(async () => {
    try {
      await updateSettings(patch);
      showStatus("Preferences saved.");
    } catch {
      showStatus("Could not save. Try changing this setting again.", true);
    }
  });
}

async function initialize(): Promise<void> {
  enabled.disabled = siteEnabled.disabled = true;
  for (const toggle of categoryToggles) toggle.disabled = true;
  try {
    const [stored, tabs] = await Promise.all([
      getSettings(),
      chrome.tabs.query({ active: true, currentWindow: true }),
    ]);
    settings = stored;
    const tab = tabs[0];
    try {
      const url = new URL(tab?.url ?? "");
      if (url.protocol === "https:" || url.protocol === "http:")
        domain = url.hostname;
    } catch {
      /* Tabs such as a new tab page have no checkable hostname. */
    }
    siteLabel.textContent = domain || "Open a website to set its preference";
    enabled.disabled = false;
    for (const toggle of categoryToggles) toggle.disabled = false;
    render();
  } catch {
    showStatus("Could not load preferences. Reopen grammai to retry.", true);
  }
}

enabled.addEventListener("change", () => save({ enabled: enabled.checked }));
siteEnabled.addEventListener("change", () => {
  if (!domain) return;
  const disabledSites = settings.disabledSites.filter(
    (site) => site !== domain,
  );
  if (!siteEnabled.checked) disabledSites.push(domain);
  save({ disabledSites });
});
for (const toggle of categoryToggles) {
  toggle.addEventListener("change", () =>
    save({
      categories: {
        ...settings.categories,
        [toggle.dataset.category as Category]: toggle.checked,
      },
    }),
  );
}
document.querySelector<HTMLAnchorElement>("#writing-room")!.href =
  chrome.runtime.getURL("demo.html");
document.querySelector("#feedback-link")!.append(feedbackLink());
void initialize();

void initializePageTheme();
