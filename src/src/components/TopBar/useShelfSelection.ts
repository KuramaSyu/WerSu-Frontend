import { useEffect } from "react";
import { useShelves } from "../../api/queries/shelfQueries";
import type { ShelfReply } from "../../api/models/shelf";
import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";

export interface ShelfSelection {
  shelves: ShelfReply[] | undefined;
  isLoading: boolean;
  selectedShelfId: string | null;
  activeShelf: ShelfReply | null;
  setSelectedShelfId: (id: string | null) => void;
}

/**
 * Shared shelf-selection data for the top bar shelf menu and the
 * mobile user menu's Shelf section.
 *
 * - reads the shelf list through TanStack Query (`include_books=true`
 *   so callers can show binding counts without a second request)
 * - resolves the currently selected shelf for the trigger label
 * - auto-selects the first shelf on a cold start, but only until the
 *   user has made an explicit choice. Picking "All shelves" counts as
 *   an explicit choice, so we never snap away from it.
 */
export function useShelfSelection(): ShelfSelection {
  const selectedShelfId = useSelectedShelfStore((s) => s.selectedShelfId);
  const hasChosenShelf = useSelectedShelfStore((s) => s.hasChosenShelf);
  const setSelectedShelfId = useSelectedShelfStore(
    (s) => s.setSelectedShelfId,
  );
  const { data: shelves, isLoading } = useShelves({ include_books: true });

  useEffect(() => {
    if (
      !hasChosenShelf &&
      selectedShelfId === null &&
      shelves &&
      shelves.length > 0
    ) {
      setSelectedShelfId(shelves[0].id);
    }
  }, [shelves, selectedShelfId, hasChosenShelf, setSelectedShelfId]);

  const activeShelf =
    shelves?.find((shelf) => shelf.id === selectedShelfId) ?? null;

  return {
    shelves,
    isLoading,
    selectedShelfId,
    activeShelf,
    setSelectedShelfId,
  };
}
