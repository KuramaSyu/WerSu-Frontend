// ---------------------------------------------------------------------------
// collabReconcile
// Conflict detection + resolution for the offline -> reconnect path.
//
// Pragmatic approach (rather than Yjs state-vector arithmetic):
//
//   1. When the user enters offline mode, snapshot the server's
//      markdown (via the REST API). Call this preOfflineCloud.
//   2. The user edits the local ydoc. The editor's current
//      markdown is the local state.
//   3. When the user clicks "go online", we go online. Hocuspocus
//      syncs. The CRDT converges.
//   4. We also fetch the latest server markdown (currentCloud).
//      Compare preOfflineCloud to currentCloud: if they differ,
//      the server changed while we were offline.
//   5. If the server changed AND the user has unsynced local edits,
//      it's a conflict and we show the modal.
//
// The "use cloud" / "use local" choice in the modal does not try to
// do a structural CRDT merge. It either:
//   - Replaces the local ydoc with the server's update (use cloud),
//     discarding local edits.
//   - Saves the local ydoc's content to the server and discards the
//     server's recent changes (use local), pushing local up via
//     the REST PATCH.
// ---------------------------------------------------------------------------

export type ReconnectVerdict = "clean" | "conflict";

export interface ReconnectDiff {
  verdict: ReconnectVerdict;
  localMarkdown: string;
  preOfflineCloud: string;
  currentCloud: string;
  lastLocalEditAt: number | null;
  hasUnsyncedLocalEdits: boolean;
}

export function computeReconnectDiff(args: {
  localMarkdown: string;
  preOfflineCloud: string;
  currentCloud: string;
  hasUnsyncedLocalEdits: boolean;
  lastLocalEditAt: number | null;
}): ReconnectDiff {
  const {
    localMarkdown,
    preOfflineCloud,
    currentCloud,
    hasUnsyncedLocalEdits,
    lastLocalEditAt,
  } = args;
  const serverChangedSinceOffline = preOfflineCloud !== currentCloud;
  const localChangedSinceBaseline = hasUnsyncedLocalEdits;
  const verdict: ReconnectVerdict =
    serverChangedSinceOffline && localChangedSinceBaseline
      ? "conflict"
      : "clean";
  return {
    verdict,
    localMarkdown,
    preOfflineCloud,
    currentCloud,
    lastLocalEditAt,
    hasUnsyncedLocalEdits,
  };
}

export type DiffLineKind = "added" | "removed" | "unchanged";
export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export function buildLineDiff(current: string, selected: string): DiffLine[] {
  const currentLines = current.split("\n");
  const selectedLines = selected.split("\n");
  const diff: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < currentLines.length || j < selectedLines.length) {
    const currentLine = currentLines[i];
    const selectedLine = selectedLines[j];
    if (currentLine !== undefined && selectedLine !== undefined) {
      if (currentLine === selectedLine) {
        diff.push({ kind: "unchanged", text: currentLine });
        i += 1;
        j += 1;
        continue;
      }
      const nextSelectedIndex = selectedLines.indexOf(currentLine, j + 1);
      const nextCurrentIndex = currentLines.indexOf(selectedLine, i + 1);
      if (
        nextSelectedIndex !== -1 &&
        (nextCurrentIndex === -1 ||
          nextSelectedIndex - j <= nextCurrentIndex - i)
      ) {
        diff.push({ kind: "added", text: selectedLine });
        j += 1;
        continue;
      }
      if (nextCurrentIndex !== -1) {
        diff.push({ kind: "removed", text: currentLine });
        i += 1;
        continue;
      }
      diff.push({ kind: "removed", text: currentLine });
      diff.push({ kind: "added", text: selectedLine });
      i += 1;
      j += 1;
      continue;
    }
    if (currentLine !== undefined) {
      diff.push({ kind: "removed", text: currentLine });
      i += 1;
      continue;
    }
    if (selectedLine !== undefined) {
      diff.push({ kind: "added", text: selectedLine });
      j += 1;
    }
  }
  return diff;
}
