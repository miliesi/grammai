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

“Send feedback” opens a bundled form for bugs and ideas. Opening the form makes no external request. When you press **Send feedback**, the title, description and report type you enter, plus the extension version and any screenshots you choose to attach, are sent to grammai's feedback endpoint hosted by Cloudflare. Your editor text, page URL, browsing history and diagnostics are not collected or attached automatically.

The endpoint creates a **public GitHub issue** in github.com/zilvestro/grammai using a server-side credential. You do not need a GitHub account and are not redirected to GitHub to submit. Published reports are public under GitHub's own privacy policy. Do not include private text, account details or tokens in the form.

Cloudflare processes the request and its network metadata. The endpoint uses the connecting IP for short-lived rate limiting; it does not put IP addresses in GitHub issues or deliberately log report bodies, IPs or credentials. Cloudflare's own data handling also applies.

Choosing email opens your mail application with a draft addressed to grammai@zaapp.io. If you send it, grammai support receives your email address, message and anything you add. Support correspondence may be retained as needed to respond and follow up. Contact the same address about your report or to request deletion.

## Sponsorship

grammai displays a static sponsor link to Affonso. The logo is bundled with the extension; displaying it sends no request to the sponsor. Visiting the sponsor is your choice and opens its website, where its own privacy policy applies.

## No tracking

grammai includes no analytics trackers, telemetry or automatic crash-report uploads. It does not sell user data, share it for advertising, or use it for credit or lending decisions. User data is used only to provide the writing features you use or request and to respond to support messages. grammai's use of user data complies with the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Your choices and deletion

You can disable checking globally or per website, change language preferences, and remove personal words and saved prompts in the extension settings. You can remove local extension data through your browser or by uninstalling grammai. The optional helper and official AI CLIs are separate programs; removing the extension does not uninstall them or remove their own configuration or provider-managed account data. Manage or revoke provider access through your provider's software and account settings.

## Changes

This policy describes the current extension. If data handling changes, the policy and relevant in-product disclosures will be updated before the changed handling is introduced.

Optional screenshots are redrawn on your device as PNG files before submission to remove original filenames and embedded image metadata. Opening the screenshot section checks upload availability with Cloudflare; choosing or previewing an image does not upload it. Attached images are stored in Cloudflare R2 and made publicly readable so GitHub can display them in the issue. Images remain stored until removed by a maintainer; deleting an issue does not automatically delete its images. To request removal, email grammai@zaapp.io with the issue link. Do not attach private or sensitive content.
