import { el } from "./shared";

export function feedbackLink(className = "feedback-link") {
  const link = el("a", className, "Send feedback");
  link.href = chrome.runtime.getURL("feedback.html");
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  // Content scripts cannot navigate to private extension pages directly.
  link.onclick = (event) => {
    event.preventDefault();
    void chrome.runtime.sendMessage({ type: "OPEN_FEEDBACK" }).catch(() => {});
  };
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
