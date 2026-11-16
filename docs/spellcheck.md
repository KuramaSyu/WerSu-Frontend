# Spell check (per note)

Red squiggles in the editor used to come from the **browser's** native
checker, which keys the whole `contenteditable` to the language of the
`lang` attribute (this app ships `<html lang="en">`). German text was
therefore always underlined.

Native checking is now off for the editor and replaced by an opt-in,
per-note checker with German and English dictionaries.

## Behaviour

| State | Underlines | Source |
|---|---|---|
| default (no stored preference) | none | native `spellcheck="false"` |
| enabled, `de` | German dictionary | lazy-loaded nspell + `de.dic` |
| enabled, `en` | English dictionary | lazy-loaded nspell + `en.dic` |

- The setting is **per note and per user**: `spellcheck@note:<noteId>`
  in the user's preference scope.
- The 3-dot menu in the note top bar opens **Spellcheck**; the modal has
  an enable switch (off by default) and a language select. Enabling
  without picking a language keeps Save disabled.
- Dictionaries load only when a note enables the feature. `nspell`,
  `de.dic` (~1.1 MB) and `en.dic` (~550 kB) are separate lazy chunks, built
  from the vendored files in `src/src/spellcheck/dictionaries/`.
- Right-clicking a flagged word puts the checker's suggestions at the top
  of the editor context menu; picking one replaces the word and leaves
  the caret after it.
- Code blocks and inline code are never checked. URLs, e-mail
  addresses, acronyms and single letters are skipped.

## Storage

`src/src/api/models/spellcheck.ts`

```json
{ "version": 1, "enabled": true, "language": "de" }
```

- `scope: "user"`, `target_id: <user id>`, `key: "spellcheck@note:<noteId>"`.
- Written with `PATCH /api/preferences` (shallow merge).
- A missing row, an empty `{}`, or unreadable JSON falls back to "off".

The read/write path is layered:

```
component (SpellcheckDialog / SpellcheckController)
    -> src/hooks/useSpellcheckPreference.ts            defaulted value + save()
    -> src/api/queries/spellcheckQueries.ts           TanStack query + mutation
    -> src/api/SpellcheckApi.ts                       SpellcheckApi interface
         SpellcheckWithPreferencesApi (default)       composes PreferencesApi
    -> src/api/PreferencesApi.ts -> /api/preferences
```

`SpellcheckWithPreferencesApi` takes any `PreferencesApi` in its
constructor, so a test registers a stub via
`registerSpellcheckApi(createSpellcheckApi(stub))` and no component or
hook changes. `SpellcheckApi` owns the key format; call sites only pass
`{ userId, noteId }`.

**Caveat:** the backend allows at most 50 keyed rows per owner. A user who
enables spell check on more than 50 notes exhausts that budget. If that
becomes a problem, move to one keyed row (`spellcheck`) whose payload maps
`noteId -> preference`; only `spellcheckPreferenceKey` and the parse call
need to change.

## Pieces

| File | Job |
|---|---|
| `src/src/spellcheck/dictionary.ts` | Lazy `import()` of nspell + raw `.aff`/`.dic`, per-language cache |
| `src/src/spellcheck/words.ts` | Text → word ranges (offsets, skip rules) |
| `src/src/spellcheck/decorations.ts` | Document → `DecorationSet` (skips code/maths) |
| `src/src/spellcheck/SpellcheckExtension.ts` | Tiptap plugin: debounced rescan, meta transactions |
| `src/src/spellcheck/spellcheckStore.ts` | Active setting + checker + suggestions |
| `src/src/spellcheck/suggestions.ts` | Word under a right-click point |
| `src/src/components/Editor/SpellcheckController.tsx` | Note preference → store + DOM `lang`/`spellcheck` |
| `src/src/components/Editor/SpellcheckDialog.tsx` | Settings modal |
| `src/src/hooks/useSpellcheckPreference.ts` | Defaulted value + save callback for the editor |
| `src/src/api/models/spellcheck.ts` | Preference type, default, key format, defensive parser |
| `src/src/api/SpellcheckApi.ts` | `SpellcheckApi` + `SpellcheckWithPreferencesApi` |
| `src/src/api/queries/spellcheckQueries.ts` | TanStack read/write hooks |

## Fake mode (MSW)

The fake backend implements `/api/preferences` (GET/POST/PATCH/DELETE)
with the real shallow-merge semantics and the 50-key limit, so enabling
spell check on a note works with `UseFakeApi` on and the real backend
stopped. Rows live in `FakeDb.preferences` and reset on page reload.
See `src/src/mocks/preferencesHandlers.test.ts`.

## Notes

- The browser's native suggestions ("Add to dictionary") are gone while
  this checker is used. A personal dictionary is not implemented yet;
  `nspell.add(word)` is the hook if it is wanted.
- `lang` on the editable element is set to the selected language for
  accessibility; it no longer drives spell checking.
- Only the rich editor decorates. The markdown source editor and the
  legacy `NoteEditModal` keep native checking off.