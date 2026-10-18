import { el } from "./shared";

export function feedbackLink(version: string, className = "feedback-link") {
  const link = el("a", className, "Send feedback");
  const subject = "grammai feedback";
  const body = `What could be better?\n\n\n---\ngrammai ${version}\n`;
  // Only the app version is included. Drafts, page URLs and diagnostics stay out.
  link.href = `mailto:grammai@zaapp.io?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return link;
}
export function setupLink(topic: "ai" | "german" = "ai", label = "AI setup") {
  const link = el("a", "setup-link", label);
  link.href = chrome.runtime.getURL(`help.html#${topic}`);
  link.target = "_blank";
  link.rel = "noopener";
  // A content-script link cannot navigate directly to a private extension page.
  // Let the background open our own guide without exposing it to every website.
  link.onclick = (event) => {
    event.preventDefault();
    void chrome.runtime
      .sendMessage({ type: "OPEN_HELP", topic })
      .catch(() => {});
  };
  return link;
}
