import { feedbackEmailUrl } from "./feedback-links";
import { initializePageTheme } from "./theme";
import { prepareScreenshot } from "./feedback-images";

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
let preparingImages = false;
let imageCheck: Promise<void> | undefined;
const imageDetails =
  document.querySelector<HTMLDetailsElement>("#feedback-images")!;
const imageInput = document.querySelector<HTMLInputElement>("#feedback-files")!;
const imageStatus = document.querySelector<HTMLElement>("#image-status")!;
const previews = document.querySelector<HTMLUListElement>("#image-previews")!;
const images: Array<{ blob: Blob; url: string }> = [];
class FeedbackError extends Error {}

function renderImages() {
  previews.replaceChildren();
  images.forEach((image, index) => {
    const item = document.createElement("li");
    const preview = document.createElement("img");
    preview.src = image.url;
    preview.alt = `Screenshot ${index + 1}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = `Remove screenshot ${index + 1}`;
    remove.addEventListener("click", () => {
      URL.revokeObjectURL(image.url);
      images.splice(index, 1);
      imageStatus.textContent = "";
      renderImages();
    });
    item.append(preview, remove);
    previews.append(item);
  });
}

imageDetails.addEventListener("toggle", () => {
  if (!imageDetails.open || imageCheck || !__FEEDBACK_ENDPOINT__) return;
  // Check storage availability only when the user opens the optional section.
  imageCheck = (async () => {
    imageStatus.textContent = "Checking screenshot uploads…";
    try {
      const response = await fetch(__FEEDBACK_ENDPOINT__, {
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(10000),
      });
      const capabilities = await response.json();
      if (!response.ok || capabilities.images !== true)
        throw new Error("Unavailable");
      imageInput.disabled = false;
      imageStatus.textContent = "";
    } catch {
      imageStatus.textContent =
        "Screenshot uploads aren't available right now. You can send images by email below.";
      imageCheck = undefined;
    }
  })();
});

imageInput.addEventListener("change", async () => {
  const selected = Array.from(imageInput.files || []);
  imageInput.value = "";
  if (sending || preparingImages || !selected.length) return;
  if (images.length + selected.length > 2) {
    imageStatus.textContent =
      "You can attach up to 2 screenshots. Remove one before adding another.";
    return;
  }
  preparingImages = true;
  imageInput.disabled = true;
  send.disabled = true;
  imageStatus.textContent = "Preparing images…";
  const prepared: Blob[] = [];
  try {
    for (const file of selected) prepared.push(await prepareScreenshot(file));
    images.push(
      ...prepared.map((blob) => ({ blob, url: URL.createObjectURL(blob) })),
    );
    renderImages();
    imageStatus.textContent = "";
  } catch (error) {
    imageStatus.textContent =
      error instanceof Error
        ? error.message
        : "This image could not be opened.";
  } finally {
    preparingImages = false;
    imageInput.disabled = false;
    send.disabled = !__FEEDBACK_ENDPOINT__;
  }
});

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
  imageDetails.hidden = true;
  send.disabled = true;
  status.textContent =
    "Direct sending isn't available in this build. You can use email below.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    sending ||
    preparingImages ||
    !__FEEDBACK_ENDPOINT__ ||
    !form.reportValidity()
  )
    return;
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
    let body: string | FormData = JSON.stringify(report);
    if (images.length) {
      const multipart = new FormData();
      for (const [key, value] of Object.entries(report))
        multipart.set(key, value);
      images.forEach((image, index) =>
        multipart.append("images", image.blob, `screenshot-${index + 1}.png`),
      );
      body = multipart;
    }
    const response = await fetch(__FEEDBACK_ENDPOINT__, {
      method: "POST",
      headers: images.length
        ? undefined
        : { "Content-Type": "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      body,
      signal: AbortSignal.timeout(30000),
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
    images.forEach((image) => URL.revokeObjectURL(image.url));
    images.length = 0;
    renderImages();
    imageStatus.textContent = "";
    kind.dispatchEvent(new Event("change"));
    form.hidden = false;
    success.hidden = true;
    viewIssue.removeAttribute("href");
    viewIssue.hidden = true;
    status.textContent = "";
    title.focus();
  });
