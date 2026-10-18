# Third-party software and data

The original grammai code is licensed under **GPL-3.0-only**. Third-party code and data keep their upstream licenses and attribution requirements.

- **Harper 2.13.0:** English WebAssembly grammar engine, Apache-2.0. Notices: `public/licenses/harper-*`.
- **nspell and English Hunspell/SCOWL dictionaries:** spelling checks and vocabulary, under their respective included licenses. Notices: `public/licenses/nspell.txt`, `dictionary-en.txt`, and `dictionary-en-gb.txt`.
- **ELD 2.1.0:** local language detection, Apache-2.0. Notice: `public/licenses/eld-APACHE-2.0.txt`.
- **LingoTweaker 0.2.8:** an independent Rust/WebAssembly port using LanguageTool-derived rules and data, LGPL-2.1-or-later. The engine and German pack are shipped unmodified as separate files. Source commit: `819dc354224c9087ff486708adfd413ecb45f466` in [fiduswriter/LingoTweaker](https://github.com/fiduswriter/LingoTweaker/tree/819dc354224c9087ff486708adfd413ecb45f466).
- **German language data:** includes CC-BY-SA-4.0 POS data, GPL-licensed igerman98/frami Hunspell data, Apache-2.0 compound word lists and other upstream resources. Complete attributions and license texts are retained in `public/licenses/lingotweaker-THIRD_PARTY_NOTICES.md`. The build extracts the pack's original license files into `dist/licenses/german-data/`.

`npm ci` installs the exact dependency tree recorded in `package-lock.json`, including development-only test/build tooling. React and Draft.js are used for editor regression tests and are not bundled into the extension runtime.

The source release also includes the pinned upstream LingoTweaker source archive alongside grammai's source and build instructions. Keep it available with the corresponding binary release. Do not remove upstream notices when repackaging a release.

Project logos and names in these notices identify their respective projects; grammai is independent and is not endorsed by them.

The Affonso mark (`public/brand/affonso-mark.svg`) is the sponsor’s official brand asset, obtained from https://files.affonso.io/assets/affonso-mark.svg. It is used for sponsor attribution; the grammai code license does not grant rights to third-party trademarks.
