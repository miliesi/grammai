# How text moves through grammai

## Ordinary spelling and grammar

A supported editable field is read by the content script. The extension sends a bounded excerpt through its internal messaging system for local checking. English is checked in the background worker; German and Romanian are checked by the bundled engine in a dedicated worker inside an offscreen document. Suggestions return to the matching editor session.

No grammai service, external grammar endpoint or AI request is involved. The extension does not save draft history. Transient suggestions, previews and undo state live in memory and are checked against the editor version before use.

## Stored preferences

Browser-local extension storage holds appearance, language preferences, enabled categories, personal dictionary words, saved rewrite prompts and paused website hostnames. These values are not synced to a grammai account or server.

## Explicit AI actions

A rewrite, translation or AI context request passes the selected passage, or the active field without a selection, and its instruction to the local helper. The chosen official CLI communicates with its provider using the user's account. Provider terms, privacy controls and usage limits apply.

The extension does not copy provider passwords, API keys or login tokens. A detected CLI only confirms local availability; a successful action verifies sign-in and model access.

## Feedback

The feedback link opens a bundled form. Only pressing Send feedback sends the explicitly entered type, title and description, plus the extension version, to the configured Cloudflare Worker. The worker validates bounded JSON input, rate limits anonymous submissions and creates a public issue in the fixed GitHub repository. It uses a server-side token; no GitHub credential is included in extension builds, and no user GitHub account is needed. Source and Store installations share this endpoint and use their actual runtime IDs for the local feedback page. The build grants network access only to the endpoint's HTTPS origin. An unconfigured build disables direct submission and offers email instead.

The worker uses connecting IPs only as transient rate-limit keys, does not forward them to GitHub, and does not deliberately log reports or secrets. Cloudflare processes ordinary network metadata. Only the supplied message and extension version reach GitHub; editor text, website URLs, extension IDs and automatic diagnostics are not included. Published reports are public. Email remains a separate user-sent mail draft.
