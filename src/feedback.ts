import { issueUrl, feedbackEmailUrl } from "./feedback-links";
import { initializePageTheme } from "./theme";

const version = chrome.runtime.getManifest().version;
document.querySelector<HTMLAnchorElement>("#report-bug")!.href = issueUrl(
  "bug",
  version,
);
document.querySelector<HTMLAnchorElement>("#suggest-idea")!.href = issueUrl(
  "idea",
  version,
);
document.querySelector<HTMLAnchorElement>("#email-feedback")!.href =
  feedbackEmailUrl(version);
document.querySelector("#extension-version")!.textContent =
  `grammai ${version}`;
void initializePageTheme();
