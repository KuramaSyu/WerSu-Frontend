/**
 * UI affordances for the active note editor surface.
 *
 * Owned by `useViewConfig` so a public-note page can flip flags (like
 * `readOnly`) without leaking them into a private-note session, and vice
 * versa. Add new fields here rather than on `useEditorSettings` — that
 * store is for *editing* state (cursor mode, view mode), this one is for
 * *view configuration* (what controls to expose).
 */
export interface ViewConfig {
  /**
   * When `true`, hide the read/write toggle and the save button. Used on
   * read-only public shares where the viewer cannot mutate the note.
   */
  readOnly: boolean;
  // Future flags (not implemented yet):
  // - showLineNumbers
  // - allowedActions: ("share" | "rename" | "move")[]
  // - hideSidePanel
  // - …
}
