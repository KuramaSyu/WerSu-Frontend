import { useCallback, type MouseEvent } from "react";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useViewConfig } from "../../zustand/useViewConfig";

/**
 * Double-click / double-tap on the editor body should drop the note
 * into write mode. The read-mode editor is not editable, so a double
 * click has no native text-selection meaning there; we repurpose the
 * gesture to swap into insert mode (the same state the read/write FAB
 * toggles).
 *
 * While already editing, or when the viewer has no write access
 * (`readOnly`), the handler is a no-op so the browser keeps its native
 * double-click behaviour (word selection).
 */
export function useDoubleTapToEditMode(): (event: MouseEvent) => void {
  const editMode = useEditorSettings((s) => s.editMode);
  const setWrite = useEditorSettings((s) => s.setWrite);
  const readOnly = useViewConfig((s) => s.config.readOnly);

  return useCallback(
    (event: MouseEvent) => {
      if (readOnly || editMode) return;
      // A child surface may already own the gesture (e.g. the image
      // node view opens its preview and calls preventDefault), or the
      // double click landed on a link and should follow it instead.
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("a")) return;
      // Keep the browser from selecting text / activating the target
      // while we hand the gesture over to the mode switch.
      event.preventDefault();
      setWrite(true);
    },
    [editMode, readOnly, setWrite],
  );
}
