import { useMemo } from "react";
import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { M2, M3, M4 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { blendWithContrast } from "../../utils/blendWithContrast";
import { markdownPreview } from "../../utils/markdownPreview";
import { NoteCardMenu } from "../../components/RightClick/NoteCardMenu";
import type { MinimalNote } from "../../api/models/search";

/** Fixed card dimensions, matching the directory card grid. */
const CARD_WIDTH = 220;
const CARD_HEIGHT = 150;

// Same layout as the directory sections: a wrapping flex grid. Because it
// is NOT a scroll container, a card can grow on hover without being
// clipped (its scale just overlaps the neighbouring gap).
const NOTE_CARD_GRID_SX = {
  display: "flex",
  flexWrap: "wrap",
  gap: M4,
} as const;

// Two-line ellipsis; duplicated for title and body copy.
const clampLines = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  wordBreak: "break-word" as const,
};

export interface RecentNoteCardProps {
  note: MinimalNote;
  /** Optional trailing badge (e.g. an "Unsaved" chip for drafts). */
  badge?: React.ReactNode;
  /** Optional control revealed in the top-right corner on hover. */
  hoverAction?: React.ReactNode;
}

/**
 * Compact, non-draggable note card used by the Home "Recent notes" row.
 * Clicking opens the editor; right-click reuses the shared NoteCardMenu.
 */
export const RecentNoteCard: React.FC<RecentNoteCardProps> = ({
  note,
  badge,
  hoverAction,
}) => {
  const navigate = useNavigate();
  const { theme } = useThemeStore();

  // Same markdown stripping as the left-rail note rows / NoteRowView, so
  // the preview shows bare prose instead of `**markers**` / table pipes.
  const preview = useMemo(
    () => markdownPreview(note.stripped_content),
    [note.stripped_content],
  );

  // Badges (draft status + diff size) need room in the compact card, so
  // trim the preview to a single line and give the badges their own
  // wrapping row. Without this the badge row overflowed the card edge.
  const hasBadge = Boolean(badge);

  return (
    <NoteCardMenu note={note}>
      <Card
        variant="outlined"
        onClick={() => {
          // Let users select the note text without the click opening the
          // note. The browser keeps the selection live until the click, so
          // bail out whenever a non-empty selection is present.
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed) {
            return;
          }
          navigate(`/n/${note.id}`);
        }}
        sx={{
          position: "relative",
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          flexShrink: 0,
          cursor: "pointer",
          transition: "all 0.2s ease-in-out",
          "&:hover": {
            transform: "scale(1.03)",
            boxShadow: theme.shadows[4],
            borderColor: blendWithContrast(
              theme.palette.primary.main,
              theme,
              1 / 2,
            ),
          },
        }}
      >
        {hoverAction && (
          <Box
            sx={{
              position: "absolute",
              top: 2,
              right: 2,
              zIndex: 2,
              opacity: 0,
              // Not clickable until revealed, so a blind tap on the top-right
              // cannot discard the draft.
              pointerEvents: "none",
              transition: "opacity 0.18s ease",
              // Reveal on card hover (and while focused, for keyboard users).
              ".MuiCard-root:hover &, &:focus-within": {
                opacity: 1,
                pointerEvents: "auto",
              },
            }}
          >
            {hoverAction}
          </Box>
        )}
        <CardContent
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            // The app has no global border-box reset, so `height: 100%`
            // + padding would overflow the fixed-height Card (which clips
            // with `overflow: hidden`) and cut off the badge row.
            boxSizing: "border-box",
            // Compact padding/gap so title + one-line preview + the chip
            // row all fit inside CARD_HEIGHT.
            p: M2,
            gap: 0.5,
            "&:last-child": { pb: M2 },
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              ...clampLines,
              WebkitLineClamp: hasBadge ? 1 : 2,
            }}
          >
            {note.title || "Untitled note"}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.text.secondary,
              flex: 1,
              ...clampLines,
              WebkitLineClamp: hasBadge ? 1 : 2,
            }}
          >
            {preview}
          </Typography>
          {hasBadge ? (
            // With badges the caller owns the footer entirely (including
            // any time chip), so we only render the wrapping chip row.
            <Stack
              direction="row"
              sx={{ flexWrap: "wrap", gap: 0.5, minWidth: 0 }}
            >
              {badge}
            </Stack>
          ) : (
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary }}
            >
              {formatDistanceToNow(new Date(note.updated_at), {
                addSuffix: true,
              })}
            </Typography>
          )}
        </CardContent>
      </Card>
    </NoteCardMenu>
  );
};

export interface RecentNotesProps {
  /** Notes to render, newest first. `undefined` shows the loading skeleton. */
  notes?: MinimalNote[];
  /** Maximum number of cards to render. */
  limit?: number;
  /** Optional badge rendered on every card. */
  badge?: React.ReactNode;
  /** Empty-state copy. */
  emptyText?: string;
}

/**
 * Horizontal "continue where you left off" row of recently updated notes.
 *
 * Data is owned by the caller (Home page) so it can be shared with the
 * greeting's today-count without issuing a second request.
 */
export const RecentNotes: React.FC<RecentNotesProps> = ({
  notes,
  limit = 12,
  badge,
  emptyText = "No notes yet. Create one from the Actions panel to see it here.",
}) => {
  const { theme } = useThemeStore();

  if (!notes) {
    return (
      <Box sx={NOTE_CARD_GRID_SX}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={`recent-note-skeleton-${index}`}
            variant="outlined"
            sx={{ width: CARD_WIDTH, height: CARD_HEIGHT, flexShrink: 0 }}
          >
            <CardContent>
              <Skeleton variant="text" width="70%" animation="wave" />
              <Skeleton variant="text" width="100%" animation="wave" />
              <Skeleton variant="text" width="90%" animation="wave" />
              <Skeleton variant="text" width="40%" animation="wave" />
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  if (notes.length === 0) {
    return (
      <Stack
        direction="row"
        spacing={M3}
        sx={{ alignItems: "center", color: theme.palette.text.secondary }}
      >
        <Typography variant="body2">{emptyText}</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={NOTE_CARD_GRID_SX}>
      {notes.slice(0, limit).map((note) => (
        <RecentNoteCard key={note.id} note={note} badge={badge} />
      ))}
    </Box>
  );
};
