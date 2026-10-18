# Development reference

Use Node.js 22 or newer. The project uses TypeScript, esbuild and Manifest V3, without a UI framework in the extension runtime.

```sh
npm ci
npm run typecheck
npm test
npm run test:native
npm run build
```

Load `dist` as an unpacked extension. `npm run demo` serves a writing room for testing, while the installed extension provides checking. The included extension-page writing room also works without a server.

## Layout

| Path                       | Responsibility                                                            |
| -------------------------- | ------------------------------------------------------------------------- |
| `src/content.ts`           | Editor sessions, highlights, replacement, selection actions and inline UI |
| `src/editor-text.ts`       | Editable text and DOM-range mapping                                       |
| `src/background.ts`        | Message routing, English checking and optional native requests            |
| `src/live-engine.ts`       | Local Harper checks and result adaptation                                 |
| `src/german-engine.ts`     | German WASM loading and UTF-8 to UTF-16 adaptation                        |
| `src/grammar-offscreen.ts` | Dedicated German worker lifecycle                                         |
| `src/rewrite-ui.ts`        | Shared rewrite and translation views                                      |
| `native/`                  | Optional native helper and CLI requests                                   |
| `public/`                  | Extension manifest, pages, icons and license notices                      |
| `scripts/`                 | Build, installation and release tooling                                   |
| `tests/`                   | Engine, transport, browser and editor regressions                         |

## Local checking

English uses Harper 2.13.0 and Hunspell vocabulary. German uses an unmodified LingoTweaker 0.2.8 WebAssembly binary and language pack with LanguageTool-derived rules and dictionaries. Language detection uses ELD locally.

German rule compilation runs in a dedicated worker owned by an offscreen document, keeping the editor and extension UI responsive. After 60 seconds without a German request, the worker terminates to release WASM memory. Its next request initializes it again. This engine uses more memory than the English engine; a cold check is slower than subsequent updates.

All engines and language resources ship inside the extension. No runtime code or dictionary is fetched from a CDN. The build verifies the pinned German pack checksum and extracts upstream license notices.

The old Java LanguageTool server files are retained for historical native compatibility. Current grammar checking does not use that server or its installer.

## Editing correctness

All browser/editor spans use UTF-16. The German engine's UTF-8 byte spans must be converted before applying edits. Replacements verify the exact original text and editor version; stale results must not change a new draft.

Detected Draft.js editors receive edits through controlled paste/deletion handlers rather than direct DOM mutation. This avoids divergent DOM and editor state after translation. Keep typing, Backspace, select-all/delete and undo checks when changing this path.

## Optional AI helper

Chrome Native Messaging connects the extension to the local helper. The installer discovers official CLIs and registers the installed extension's specific origin. Text is passed through stdin, never interpolated into a shell command. The helper uses a temporary working directory, disables tools and user customizations for editing requests, and removes temporary files afterwards.

See [AI setup](ai-setup.md) for installation and [Privacy](privacy.md) for the data flow.

## Browser checks

Browser tests use temporary profiles. Set `QUILL_BROWSER=helium` to use an installed macOS Helium app; otherwise the scripts use Playwright Chromium.

```sh
npm run test:e2e
npm run test:editors
QUILL_BROWSER=helium npm run test:experience
QUILL_BROWSER=helium npm run test:draft
QUILL_BROWSER=helium npm run test:ux
QUILL_BROWSER=helium npm run test:onboarding
QUILL_BROWSER=helium npm run test:zero-install
```

`test:experience` uses an explicit deterministic CLI fixture to check the editing workflow. `test:zero-install` disables network access and native messaging while checking both languages. `test:rewrite`, `test:languages` and `test:ai` use installed, signed-in AI CLIs with synthetic text and consume normal provider usage.

To test an extracted Store package instead of `dist`:

```sh
GRAMMAI_EXTENSION_PATH=/absolute/path/to/extracted/package QUILL_BROWSER=helium npm run test:zero-install
```
