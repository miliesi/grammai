# Connect your own AI

Spelling and grammar work immediately after installing grammai. This guide is only for rewrites, translation and AI context checks.

## What you need

- Chrome or Helium on macOS for the current helper installer.
- An installed, signed-in **Claude Code** or **Codex** CLI, with access to the requested model.
- Node.js 22 or newer to run the current helper.

Your provider's account requirements and usage limits apply. A ChatGPT or Claude login in a browser tab alone does not connect grammai to its CLI.

## Use the built-in guide

1. Open grammai's **All settings** and choose **Help & setup**.
2. Expand **Your AI**. grammai checks the local helper and installed CLIs automatically.
3. If the helper is already connected, its installation steps are hidden. Choose your provider in the AI settings.
4. If it is missing, follow the copyable commands in that page. Download the bundled helper ZIP and run the command shown for your installed extension.
5. Generate a rewrite of a non-sensitive sample sentence to verify sign-in and model access.

The guide uses the actual extension ID. A Store installation and an unpacked development copy can have different IDs, so do not copy a developer's ID into a setup command.

If you install another CLI later and the helper cannot find it, open **Show setup instructions** and rerun the helper command to register its location. Normal extension UI updates do not require reinstalling the helper.

## Development checkout

After building the extension and installing/signing in to a CLI:

```sh
npm run install:native
```

The installer registers a host for Chrome, Chromium and Helium on macOS. To target a specific installation, it accepts:

```sh
node scripts/install-native.mjs --extension-id YOUR_EXTENSION_ID
```

Other options are `--extension-path`, `--browser-root` and `--install-dir`. Tests use temporary paths; do not point them at your real browser profile.

## Data and troubleshooting

Only an explicit AI action sends text to your provider. The helper does not add an AI account to grammai or copy your login tokens into the extension.

- **Helper not found:** Run the guide's helper command for the extension ID you are using.
- **CLI not found:** Install the chosen CLI, then refresh its registration through the guide.
- **CLI found, action fails:** Check official CLI sign-in, provider usage limits and model availability. Clear an optional rewrite model to use the CLI default.
- **Windows / Linux:** Local English and German checking works in the extension. The bundled AI helper installer currently supports macOS.
