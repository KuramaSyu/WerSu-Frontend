import { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DraftsIcon from "@mui/icons-material/Drafts";
import CloseIcon from "@mui/icons-material/Close";
import { useNote } from "../../api/queries/useNoteQueries";
import { useDraftNoteIds, useDraftStates } from "../../api/queries/useDraftQueries";
import {
  formatDraftChangeLabel,
  formatDraftSizeChip,
  getDraftUrgency,
  useDraftStore,
  type DraftUrgency,
} from "../../zustand/useDraftStore";
import { M4 } from "../../statics";
import { RecentNoteCard } from "./RecentNotes";

const CARD_WIDTH = 220;
const CARD_HEIGHT = 150;

// Same wrapping grid as the directory sections, so cards grow on hover
// without being clipped by a scroll container.
const DRAFT_CARD_GRID_SX = {
  display: "flex",
  flexWrap: "wrap",
  gap: M4,
} as const;

/** Compact skeleton matching a single `RecentNoteCard`. */
const DraftNoteSkeleton: React.FC = () => (
  <Card
    variant="outlined"
    sx={{ width: CARD_WIDTH, height: CARD_HEIGHT, flexShrink: 0 }}
  >
    <CardContent>
      <Skeleton variant="text" width="70%" animation="wave" />
      <Skeleton variant="text" width="100%" animation="wave" />
      <Skeleton variant="text" width="40%" animation="wave" />
    </CardContent>
  </Card>
);

const URGENCY_CHIP_COLOR: Record<DraftUrgency, "default" | "warning" | "error"> =
  {
    low: "default",
    medium: "warning",
    high: "error",
  };

/** Short relative time for a chip (e.g. "5m ago"). */
const formatCompactAge = (timestamp: number): string => {
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const DraftNoteCard: React.FC<{ noteId: string }> = ({ noteId }) => {
  const { data: note, isLoading, isError } = useNote(noteId);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const entry = useDraftStore((s) => s.drafts[noteId]);

  if (isLoading) {
    return <DraftNoteSkeleton />;
  }
  // A draft whose note is gone / no longer accessible is dropped from
  // the row rather than rendered as a broken card.
  if (isError || !note) {
    return null;
  }

  // Badge colours surface urgency; tooltips carry the detail.
  const urgency = entry ? getDraftUrgency(entry) : "low";

  return (
    <RecentNoteCard
      note={note}
      badge={
        <>
          {entry && entry.changedChars > 0 && (
            <Tooltip title={formatDraftChangeLabel(entry.changedChars)}>
              <Chip
                label={formatDraftSizeChip(entry.changedChars)}
                size="small"
                variant="outlined"
                color={URGENCY_CHIP_COLOR[urgency]}
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              />
            </Tooltip>
          )}
          {entry && (
            <Tooltip title={new Date(entry.updatedAt).toLocaleString()}>
              <Chip
                label={formatCompactAge(entry.updatedAt)}
                size="small"
                variant="outlined"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              />
            </Tooltip>
          )}
        </>
      }
      hoverAction={
        <Tooltip title="Ignore">
          <IconButton
            size="small"
            aria-label="Ignore draft"
            onClick={(event) => {
              event.stopPropagation();
              clearDraft(noteId);
            }}
            onMouseDown={(event) => event.stopPropagation()}
            sx={{ backgroundColor: "background.paper" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      }
    />
  );
};

/**
 * Home section listing notes with unsaved local edits.
 *
 * Draft ids come from the local tracker; each card resolves its own
 * note (title / preview) via `useNote`, because an unsaved note's
 * server `updated_at` is stale and it would not reliably appear in the
 * "latest notes" list.
 *
 * Renders nothing when there are no drafts, so the section only shows
 * when it is relevant.
 */
export const DraftNotes: React.FC = () => {
  const { draftsById, isLoading } = useDraftStates();
  const draftIds = useDraftNoteIds();

  const count = useMemo(
    () => Object.keys(draftsById).length,
    [draftsById],
  );

  if (count === 0) {
    return null;
  }

  return (
    <Stack direction="column" spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <DraftsIcon color="warning" fontSize="small" />
        <Typography variant="h5" color="textPrimary">
          Drafts
        </Typography>
      </Stack>
      <Box sx={DRAFT_CARD_GRID_SX}>
        {isLoading
          ? Array.from({ length: count }).map((_, index) => (
              <DraftNoteSkeleton key={`draft-skeleton-${index}`} />
            ))
          : draftIds.map((noteId) => (
              <DraftNoteCard key={noteId} noteId={noteId} />
            ))}
      </Box>
    </Stack>
  );
};
