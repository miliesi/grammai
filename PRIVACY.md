# grammai privacy policy

Last updated: 20 October 2026 · Extension version 0.6.6

grammai is a writing assistant for spelling, grammar, rewrites and translation. Privacy questions and requests can be sent to [grammai@zaapp.io ](mailto:grammai@zaapp.io).

## Spelling and grammar stay on your device

grammai reads text in supported editable fields to show writing suggestions. English, German and Romanian spelling and grammar checks, language detection, and suggestion placement run inside the extension on your device, using bundled engines and dictionaries. Ordinary checks do not send your text, page URLs or browsing activity to grammai or another server.

The extension uses the current website's hostname for per-site controls. It does not collect browsing history or page contents for advertising or analytics. Password fields and recognizable account and payment fields are excluded from checking; you can also pause grammai globally or on a specific website.

## Optional AI actions use your chosen provider

When you explicitly request a rewrite, translation or AI context check, grammai passes the selected text, or the active field's text when there is no selection, and the requested instruction to an optional local helper. That helper runs your installed, signed-in Claude Code or Codex CLI, which sends the request to Anthropic or OpenAI using your own account. Requested AI output returns through the helper to the extension.

Text you choose to process with AI may contain personal information or private communications. Only request these actions for text you want to share with that provider. The provider's terms, privacy policy, account settings and usage limits apply. grammai does not operate an AI proxy or receive these AI requests on its own servers. The local AI helper installer currently supports macOS.

Sign-in takes place through the provider's official software. The extension does not request, copy or store your provider password, API key or login tokens. Provider software manages its own account credentials and data separately.

## What is stored locally

grammai stores extension preferences, appearance, language settings, personal dictionary words, saved rewrite prompts and paused website hostnames in the browser's local extension storage. These settings are not synced to a grammai account or server. Custom prompts and dictionary entries contain whatever you choose to save.

Active checks, suggestion fragments, requested AI previews and undo information are kept temporarily in memory while the extension is being used. grammai does not save a document history or a database of your drafts. The AI helper uses temporary working directories and requests ephemeral CLI sessions; provider-side handling is governed by the provider.

## Feedback is sent only when you send it

“Send feedback” opens a bundled page where you can report a bug or suggest an idea on GitHub, or choose email. Only the extension version is prefilled; your writing, page URL and diagnostics are not attached automatically.

Choosing GitHub opens a draft issue on github.com/zilvestro/grammai. GitHub issues are public and require a GitHub account. You review and submit the issue on GitHub; anything you add and publish, including screenshots, is public under GitHub's own privacy policy. Opening the feedback page alone makes no external request.

Choosing email opens your mail application with a draft addressed to grammai@zaapp.io. If you send it, grammai support receives your email address, message and anything you add. Support correspondence may be retained as needed to respond and follow up. Contact the same address to request deletion.

## Sponsorship

grammai displays a static sponsor link to Affonso. The logo is bundled with the extension; displaying it sends no request to the sponsor. Visiting the sponsor is your choice and opens its website, where its own privacy policy applies.

## No tracking

grammai includes no analytics trackers, telemetry or automatic crash-report uploads. It does not sell user data, share it for advertising, or use it for credit or lending decisions. User data is used only to provide the writing features you use or request and to respond to support messages. grammai's use of user data complies with the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Your choices and deletion

You can disable checking globally or per website, change language preferences, and remove personal words and saved prompts in the extension settings. You can remove local extension data through your browser or by uninstalling grammai. The optional helper and official AI CLIs are separate programs; removing the extension does not uninstall them or remove their own configuration or provider-managed account data. Manage or revoke provider access through your provider's software and account settings.

## Changes

This policy describes the current extension. If data handling changes, the policy and relevant in-product disclosures will be updated before the changed handling is introduced.
