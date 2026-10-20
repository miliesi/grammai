export function feedbackEmailUrl(version: string): string {
  const params = new URLSearchParams({
    subject: "grammai feedback",
    body: `What could be better?\n\n\n---\ngrammai ${version}\n`,
  });
  return `mailto:grammai@zaapp.io?${params}`;
}
