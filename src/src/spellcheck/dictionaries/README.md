# Vendored spell-check dictionaries

Hunspell affix + word-list pairs for the in-app spell checker
(`src/spellcheck/dictionary.ts`). They are imported with Vite's `?raw`
loader inside a dynamic `import()`, so they only download after a user
enables spell check on a note.

| File | Source | Version |
|---|---|---|
| `en.aff`, `en.dic`, `LICENSE-en.txt` | `dictionary-en` (npm) | 4.0.0 |
| `de.aff`, `de.dic`, `LICENSE-de.txt` | `dictionary-de` (npm) | 3.0.0 |

Both were copied verbatim from the published packages (as `index.aff` /
`index.dic`). Licensing matches this project: `dictionary-en` is
MIT + BSD, `dictionary-de` is GPL-2.0-or-later, and WerSu itself is
AGPL-3.0. Keep the license files next to the data.

## Updating

```sh
npm pack dictionary-de@latest dictionary-en@latest
tar -xzf dictionary-de-*.tgz
cp package/index.aff src/spellcheck/dictionaries/de.aff
cp package/index.dic src/spellcheck/dictionaries/de.dic
cp package/license src/spellcheck/dictionaries/LICENSE-de.txt
```

Repeat for `dictionary-en`. The loader reads plain `.aff` / `.dic`
text, so no other change is needed.