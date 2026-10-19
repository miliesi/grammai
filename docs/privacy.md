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

The feedback link opens a draft in the user's mail application. It prefills the extension version and no draft text, page URL or diagnostic attachment. Only sending that email shares its content and sender address with grammai support.

See the full [privacy policy](../PRIVACY.md). Store publication also needs that policy at a public HTTPS URL; an extension-internal file alone does not supply the Dashboard's public policy URL.
