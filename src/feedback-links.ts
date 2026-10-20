/** Public issue drafts include only the extension version, never editor data. */
export function issueUrl(kind: "bug" | "idea", version: string): string {
  const bug = kind === "bug";
  const body = bug
    ? `## What happened?

## Expected behavior

## Steps and a small sample

Use an anonymized example. For grammar reports, include a similar sentence that should remain unchanged.

## Environment

- grammai version: ${version}
- Browser and version:
- Operating system:
- Website / editor (no private URLs):
- AI provider, if relevant (no account credentials):

## Editing after the action

Can you still type, use Backspace, select all and delete, and undo?

Please remove private text, emails and tokens from screenshots and logs.
`
    : `## The writing problem

What are you trying to do, and what gets in the way?

## Proposed behavior

A concrete example helps. How would you like it to work?

## Alternatives / scope

## Environment

- grammai version: ${version}
`;
  const url = new URL("https://github.com/zilvestro/grammai/issues/new");
  url.searchParams.set(
    "template",
    bug ? "bug_report.md" : "feature_request.md",
  );
  url.searchParams.set("body", body);
  return url.href;
}

export function feedbackEmailUrl(version: string): string {
  const params = new URLSearchParams({
    subject: "grammai feedback",
    body: `What could be better?\n\n\n---\ngrammai ${version}\n`,
  });
  return `mailto:grammai@zaapp.io?${params}`;
}
