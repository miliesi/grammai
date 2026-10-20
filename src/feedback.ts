import { feedbackEmailUrl } from "./feedback-links";
import { initializePageTheme } from "./theme";

declare const __FEEDBACK_ENDPOINT__: string;
const version = chrome.runtime.getManifest().version;
const form = document.querySelector<HTMLFormElement>("#feedback-form")!;
const fields = document.querySelector<HTMLFieldSetElement>("#feedback-fields")!;
const kind = document.querySelector<HTMLSelectElement>("#feedback-kind")!;
const title = document.querySelector<HTMLInputElement>("#feedback-title")!;
const description = document.querySelector<HTMLTextAreaElement>(
  "#feedback-description",
)!;
const send = document.querySelector<HTMLButtonElement>("#send-feedback")!;
const status = document.querySelector<HTMLElement>("#feedback-status")!;
const success = document.querySelector<HTMLElement>("#feedback-success")!;
const viewIssue = document.querySelector<HTMLAnchorElement>("#view-issue")!;
let sending = false;
class FeedbackError extends Error {}

document.querySelector<HTMLAnchorElement>("#email-feedback")!.href =
  feedbackEmailUrl(version);
document.querySelector("#extension-version")!.textContent =
  `grammai ${version}`;
void initializePageTheme();

kind.addEventListener("change", () => {
  description.placeholder =
    kind.value === "idea"
      ? "What would you like grammai to do? How would it help your writing?"
      : "What happened, and what did you expect? A small example or steps to reproduce will help.";
});

if (!__FEEDBACK_ENDPOINT__) {
  send.disabled = true;
  status.textContent =
    "Direct sending isn't available in this build. You can use email below.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (sending || !__FEEDBACK_ENDPOINT__ || !form.reportValidity()) return;
  const report = {
    kind: kind.value,
    title: title.value.trim(),
    description: description.value.trim(),
    version,
  };
  if (report.title.length < 3 || report.description.length < 10) {
    status.textContent =
      "Please add a short title and a description of at least 10 characters.";
    status.focus();
    return;
  }
  sending = true;
  fields.disabled = true;
  send.textContent = "Sending…";
  status.textContent = "";
  try {
    const response = await fetch(__FEEDBACK_ENDPOINT__, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok)
      throw new FeedbackError(
        typeof result.error === "string"
          ? result.error
          : "Your feedback could not be sent. Please try again later or use email.",
      );
    if (
      response.status !== 201 ||
      !/^https:\/\/github\.com\/zilvestro\/grammai\/issues\/[1-9]\d*$/.test(
        result.url || "",
      )
    )
      throw new FeedbackError(
        "Delivery could not be confirmed. Check existing issues before sending again.",
      );
    viewIssue.href = result.url;
    viewIssue.hidden = false;
    form.hidden = true;
    success.hidden = false;
    status.textContent = "Your feedback was sent. Thank you!";
    status.focus();
  } catch (error) {
    status.textContent =
      error instanceof FeedbackError
        ? error.message
        : "Delivery could not be confirmed. Your text is still here. Check existing issues before sending again, or use email.";
    status.focus();
  } finally {
    sending = false;
    fields.disabled = false;
    send.textContent = "Send feedback";
  }
});

document
  .querySelector<HTMLButtonElement>("#send-another")!
  .addEventListener("click", () => {
    form.reset();
    kind.dispatchEvent(new Event("change"));
    form.hidden = false;
    success.hidden = true;
    viewIssue.removeAttribute("href");
    viewIssue.hidden = true;
    status.textContent = "";
    title.focus();
  });
