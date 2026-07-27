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
  /**
   * When `true` (the default), the note editor body is capped at
   * `NOTE_EDITOR_A4_WIDTH` so it reads like a sheet of A4 paper. The
   * 3-dot menu in the action row lets the viewer flip this off to
   * expand the editor to the full canvas width.
   */
  a4Width: boolean;
  // Future flags (not implemented yet):
  // - showLineNumbers
  // - allowedActions: ("share" | "rename" | "move")[]
  // - hideSidePanel
  // - …
}
