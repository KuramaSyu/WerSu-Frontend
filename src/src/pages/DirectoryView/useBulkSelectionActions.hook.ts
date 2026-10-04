import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getNoteApi } from "../../api/NoteApi";
import { DirectoryApi } from "../../api/DirectoryApi";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { removeDirectory } from "../../api/queries/directoryQueries";
import { useUserKey } from "../../api/queries/useUser";
import {
  useDirectorySelectionStore,
  type SelectionEntry,
} from "../../zustand/useDirectorySelectionStore";

export interface BulkSelectionActions {
  /**
   * Move every selected note + directory under the given parent id.
   * Pass null to clear parents (top level).
   */
  moveTo: (targetDirectoryId: string | null) => Promise<void>;
  /**
   * Copy every selected note into the given parent. Directories
   * cannot be deep-copied via the current API, so this is a no-op
   * plus an info toast when the selection contains any directory.
   */
  copyTo: (targetDirectoryId: string | null) => Promise<void>;
  /** Delete everything in the selection. */
  deleteSelected: () => Promise<void>;
  /** True when at least one selected item is a directory. */
  hasDirectory: boolean;
  /** True when at least one selected item is a note. */
  hasNote: boolean;
  /** Convenience: number of selected items. */
  count: number;
}

const partition = (
  entries: SelectionEntry[],
): { notes: string[]; directories: string[] } => {
  const notes: string[] = [];
  const directories: string[] = [];
  for (const entry of entries) {
    if (entry.kind === "note") notes.push(entry.id);
    else directories.push(entry.id);
  }
  return { notes, directories };
};

/**
 * Implements the bulk operations exposed by the selection action bar.
 * Every method is a no-op on an empty selection and pushes a snackbar
 * to surface success/failure counts.
 */
export function useBulkSelectionActions(): BulkSelectionActions {
  const noteApi = getNoteApi();
  const directoryApi = new DirectoryApi();
  const queryClient = useQueryClient();
  const userKey = useUserKey();
  const { setMessage } = useInfoStore();

  const selectedMap = useDirectorySelectionStore((s) => s.selected);
  const clearSelection = useDirectorySelectionStore((s) => s.clear);

  const { notes: noteIds, directories: directoryIds, entries } = useMemo(() => {
    const list = Object.values(selectedMap);
    return { ...partition(list), entries: list };
  }, [selectedMap]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notes"] });
    queryClient.invalidateQueries({ queryKey: ["directories"] });
    queryClient.invalidateQueries({ queryKey: ["activity"] });
  }, [queryClient]);

  const moveTo = useCallback(
    async (targetDirectoryId: string | null) => {
      const target = targetDirectoryId
        ? [targetDirectoryId]
        : [];
      let okNotes = 0;
      let failedNotes = 0;
      let okDirs = 0;
      let failedDirs = 0;

      for (const id of noteIds) {
        try {
          const ok = await noteApi.patchDirectory(id, target);
          if (ok) okNotes += 1;
          else failedNotes += 1;
        } catch {
          failedNotes += 1;
        }
      }
      for (const id of directoryIds) {
        try {
          const updated = await directoryApi.setParent(id, target);
          if (updated) okDirs += 1;
          else failedDirs += 1;
        } catch {
          failedDirs += 1;
        }
      }

      invalidateAll();
      clearSelection();
      const totalOk = okNotes + okDirs;
      const totalFail = failedNotes + failedDirs;
      if (totalOk > 0 && totalFail === 0) {
        setMessage(
          new SnackbarUpdateImpl(
            `Moved ${totalOk} item${totalOk === 1 ? "" : "s"}`,
            "success",
          ),
        );
      } else if (totalOk > 0) {
        setMessage(
          new SnackbarUpdateImpl(
            `Moved ${totalOk} item${totalOk === 1 ? "" : "s"}; ${totalFail} failed`,
            "warning",
          ),
        );
      } else {
        setMessage(
          new SnackbarUpdateImpl("Move failed", "error"),
        );
      }
    },
    [
      clearSelection,
      directoryApi,
      directoryIds,
      invalidateAll,
      noteApi,
      noteIds,
      setMessage,
    ],
  );

  const copyTo = useCallback(
    async (targetDirectoryId: string | null) => {
      if (directoryIds.length > 0) {
        setMessage(
          new SnackbarUpdateImpl(
            "Copying directories is not supported yet",
            "info",
          ),
        );
        return;
      }
      const target = targetDirectoryId ? [targetDirectoryId] : [];
      let ok = 0;
      let failed = 0;
      for (const id of noteIds) {
        try {
          const note = await noteApi.get(id);
          if (!note) {
            failed += 1;
            continue;
          }
          // Combine the new parent with any existing parents so the
          // copy is reachable from both the new location and the
          // original. Use a Set to dedupe.
          const merged = Array.from(new Set([...note.directory_ids, ...target]));
          await noteApi.post(
            note.title,
            note.content,
            merged.length > 0 ? { directory_ids: merged } : undefined,
          );
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      invalidateAll();
      clearSelection();
      if (ok > 0 && failed === 0) {
        setMessage(
          new SnackbarUpdateImpl(
            `Copied ${ok} note${ok === 1 ? "" : "s"}`,
            "success",
          ),
        );
      } else if (ok > 0) {
        setMessage(
          new SnackbarUpdateImpl(
            `Copied ${ok}; ${failed} failed`,
            "warning",
          ),
        );
      } else {
        setMessage(new SnackbarUpdateImpl("Copy failed", "error"));
      }
    },
    [
      clearSelection,
      directoryIds.length,
      invalidateAll,
      noteApi,
      noteIds,
      setMessage,
    ],
  );

  const deleteSelected = useCallback(async () => {
    let okNotes = 0;
    let failedNotes = 0;
    let okDirs = 0;
    let failedDirs = 0;
    for (const id of noteIds) {
      try {
        const ok = await noteApi.delete(id);
        if (ok) okNotes += 1;
        else failedNotes += 1;
      } catch {
        failedNotes += 1;
      }
    }
    for (const id of directoryIds) {
      try {
        const deleted = await directoryApi.delete(id);
        if (deleted) {
          okDirs += 1;
          removeDirectory(queryClient, id);
          queryClient.invalidateQueries({
            queryKey: ["directory", id, userKey],
          });
        } else {
          failedDirs += 1;
        }
      } catch {
        failedDirs += 1;
      }
    }
    invalidateAll();
    clearSelection();
    const totalOk = okNotes + okDirs;
    const totalFail = failedNotes + failedDirs;
    if (totalOk > 0 && totalFail === 0) {
      setMessage(
        new SnackbarUpdateImpl(
          `Deleted ${totalOk} item${totalOk === 1 ? "" : "s"}`,
          "success",
        ),
      );
    } else if (totalOk > 0) {
      setMessage(
        new SnackbarUpdateImpl(
          `Deleted ${totalOk}; ${totalFail} failed`,
          "warning",
        ),
      );
    } else {
      setMessage(new SnackbarUpdateImpl("Delete failed", "error"));
    }
  }, [
    clearSelection,
    directoryApi,
    directoryIds,
    invalidateAll,
    noteApi,
    noteIds,
    queryClient,
    setMessage,
    userKey,
  ]);

  return {
    moveTo,
    copyTo,
    deleteSelected,
    hasDirectory: directoryIds.length > 0,
    hasNote: noteIds.length > 0,
    count: entries.length,
  };
}
