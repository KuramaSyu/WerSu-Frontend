// ---------------------------------------------------------------------------
// LatexDialogController.utils
// Shared types for the LaTeX dialog state machine. The controller
// itself lives in LatexDialogController.tsx; this file only carries
// the LatexDialogOpenParams interface so other modules can import it
// without pulling in React.
// ---------------------------------------------------------------------------

/** Open request payload for the LaTeX dialog. */
export interface LatexDialogOpenParams {
  /** Initial LaTeX source to seed the dialog with. */
  latex: string;
  /** "inline" for inline math, "block" for display math. */
  type: "inline" | "block";
  /** ProseMirror position of the math node being edited; -1 for create. */
  pos: number;
  /** "edit" when opening an existing node, "create" when inserting new math. */
  mode: "edit" | "create";
}
