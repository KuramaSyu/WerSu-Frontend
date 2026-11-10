/**
 * UI affordances for the active note editor surface.
 *
 * Owned by `useViewConfig` so a public-note page can flip flags (like
 * `readOnly`) without leaking them into a private-note session, and vice
 * versa. Add new fields here rather than on `useEditorSettings` — that
 * store is for *editing* state (cursor mode, view mode), this one is for
 * *view configuration* (what controls to expose).
 */

/**
 * Body width preset, cycled by a top-bar width toggle.
 *
 *   - `normal` — the default reading column.
 *   - `wide`   — wider than normal, capped below the full canvas.
 *   - `full`   — the entire available width.
 *
 * Shared by the note editor and the shelf settings page; each surface
 * owns its own state and width table.
 */
export type WidthMode = "normal" | "wide" | "full";

/**
 * Alias kept for the note editor's existing imports. New code should
 * prefer {@link WidthMode}.
 *
 *   - `normal` — A4-paper width, the default reading column.
 *   - `wide`   — wider than paper, capped below the full canvas.
 *   - `full`   — the entire available width.
 */
export type NoteWidthMode = WidthMode;

export interface ViewConfig {
  /**
   * When `true`, hide the read/write toggle and the save button. Used on
   * read-only public shares where the viewer cannot mutate the note.
   */
  readOnly: boolean;
  /**
   * Current editor body width preset. The top-bar width toggle cycles
   * `normal -> wide -> full -> normal`.
   */
  widthMode: NoteWidthMode;
  // Future flags (not implemented yet):
  // - showLineNumbers
  // - allowedActions: ("share" | "rename" | "move")[]
  // - hideSidePanel
  // - …
}
