import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export interface CreateModalHandles {
  /** Open the new-note modal. */
  setCreateNoteOpen: (open: boolean) => void;
  /** Open the new-directory modal. */
  setCreateDirectoryOpen: (open: boolean) => void;
}

/**
 * Wires the `?action=create-note|create-directory` query param into
 * the page's create modals. Pages that mount `CreateNote` /
 * `CreateDirectoryModal` call this so external callers can deep-link
 * straight into "open the new-note modal" without prop-drilling.
 *
 * After opening the matching modal the param is stripped from the
 * URL with `replace: true` so the back button doesn't return the
 * user to a pre-opened modal state.
 */
export function useCreateModalsFromUrl(handles: CreateModalHandles): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const target = searchParams.get("action");

  useEffect(() => {
    if (target === null) {
      return;
    }
    if (target === "create-note") {
      handles.setCreateNoteOpen(true);
    } else if (target === "create-directory") {
      handles.setCreateDirectoryOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  }, [target, handles, searchParams, setSearchParams]);
}
