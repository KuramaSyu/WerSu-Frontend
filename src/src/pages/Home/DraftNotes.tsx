import { IconButton, Stack, Tooltip, Typography } from "@mui/material";
import DraftsIcon from "@mui/icons-material/Drafts";
import CloseIcon from "@mui/icons-material/Close";
import { useQueries } from "@tanstack/react-query";
import { noteQueries } from "../../api/queries/useNoteQueries";
import {
  useDraftNoteIds,
  useDraftStates,
} from "../../api/queries/useDraftQueries";
import {
  formatDraftChangeLabel,
  formatDraftSizeChip,
  getDraftUrgency,
  useDraftStore,
  type DraftUrgency,
} from "../../zustand/useDraftStore";
import { NoteList } from "./RecentNotes";
import type { MinimalNote } from "../../api/models/search";

/** Text colour per draft urgency (MUI palette token for the sx `color`). */
const URGENCY_TEXT_COLOR: Record<DraftUrgency, string> = {
  low: "text.secondary",
  medium: "warning.main",
  high: "error.main",
};

const emptyNote = (noteId: string): MinimalNote => ({
  id: noteId,
  title: "",
  author_id: "",
  updated_at: "",
  stripped_content: "",
  directory_ids: [],
  tag_ids: [],
});

export interface DraftNotesProps {
  /** Copy rendered when there are no drafts. When omitted, nothing renders. */
  emptyText?: string;
  /** Render the section header. Defaults to true. */
  showTitle?: boolean;
  /** Restrict to notes in any of these directories (subtree-expanded). */
  filterDirectoryIds?: string[];
  /** Only keep drafts edited within this many days. */
  maxAgeDays?: number;
  /** Called when a draft's folder chip is clicked. */
  onDirectoryClick?: (directoryId: string) => void;
}

/**
 * Notes with unsaved local edits, rendered with the same single-line list
 * style as the other Home lists. A dedicated column shows the number of
 * changed characters per draft.
 *
 * Draft ids come from the local tracker; each note is resolved via the
 * shared note-detail query so folders / tags render.
 */
export const DraftNotes: React.FC<DraftNotesProps> = ({
  emptyText,
  showTitle = true,
  filterDirectoryIds,
  maxAgeDays,
  onDirectoryClick,
}) => {
  const matchesFilters = (note: MinimalNote, noteId: string) => {
    if (filterDirectoryIds && filterDirectoryIds.length > 0) {
      const inDirectory = (note.directory_ids ?? []).some((id) =>
        filterDirectoryIds.includes(id),
      );
      if (!inDirectory) {
        return false;
      }
    }
    if (maxAgeDays !== undefined) {
      const updatedAt = draftsById[noteId]?.updatedAt;
      if (
        updatedAt !== undefined &&
        // eslint-disable-next-line react-hooks/purity -- age cutoff needs wall-clock time
        updatedAt < Date.now() - maxAgeDays * 86_400_000
      ) {
        return false;
      }
    }
    return true;
  };

  const { draftsById } = useDraftStates();
  const draftIds = useDraftNoteIds();
  const clearDraft = useDraftStore((state) => state.clearDraft);

  const noteResults = useQueries({
    queries: draftIds.map((id) => noteQueries.detail(id)),
  });

  const notes: MinimalNote[] = [];
  const skeletonIds = new Set<string>();
  const changedById: Record<string, React.ReactNode> = {};
  const timestampById: Record<string, string | number | Date> = {};
  const actionById: Record<string, React.ReactNode> = {};

  draftIds.forEach((noteId, index) => {
    const result = noteResults[index];
    const note = result?.data;

    if (!note) {
      // Keep the slot while loading; drop rows whose note is gone.
      if (result?.isLoading) {
        notes.push(emptyNote(noteId));
        skeletonIds.add(noteId);
      }
      return;
    }

    if (!matchesFilters(note, noteId)) {
      return;
    }

    notes.push(note);

    const entry = draftsById[noteId];
    if (!entry) {
      return;
    }

    const urgency = getDraftUrgency(entry);

    changedById[noteId] = (
      <Tooltip title={formatDraftChangeLabel(entry.changedChars)}>
        <Typography
          variant="caption"
          sx={{ color: URGENCY_TEXT_COLOR[urgency] }}
        >
          {formatDraftSizeChip(entry.changedChars)}
        </Typography>
      </Tooltip>
    );
    timestampById[noteId] = entry.updatedAt;
    actionById[noteId] = (
      <Tooltip title="Ignore">
        <IconButton
          size="small"
          aria-label="Ignore draft"
          onClick={(event) => {
            event.stopPropagation();
            clearDraft(noteId);
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  });

  if (draftIds.length === 0) {
    if (!emptyText) {
      return null;
    }
    return (
      <Typography variant="body2" color="textSecondary">
        {emptyText}
      </Typography>
    );
  }

  return (
    <Stack direction="column" spacing={2}>
      {showTitle && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <DraftsIcon color="warning" fontSize="small" />
          <Typography variant="h5" color="textPrimary">
            Drafts
          </Typography>
        </Stack>
      )}
      <NoteList
        notes={notes}
        skeletonIds={skeletonIds}
        changedById={changedById}
        timestampById={timestampById}
        actionById={actionById}
        showActionColumn
        onDirectoryClick={onDirectoryClick}
        emptyText="No drafts."
      />
    </Stack>
  );
};

export default DraftNotes;