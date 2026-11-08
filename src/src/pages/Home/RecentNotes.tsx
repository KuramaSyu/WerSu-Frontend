import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Paper,
  Popover,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { M1, M2, M3 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useTagStore } from "../../zustand/useTagStore";
import {
  blendWithContrast,
  colorFromString,
} from "../../utils/blendWithContrast";
import { markdownPreview } from "../../utils/markdownPreview";
import { NoteCardMenu } from "../../components/RightClick/NoteCardMenu";
import TranslucentPaper from "../../components/TranslucentPaper";
import { useAllDirectoriesQuery } from "../../api/queries/directoryQueries";
import type { DirectoryReply } from "../../api/models/directory";
import type { MinimalNote, MinimalTag } from "../../api/models/search";
import { themeAttachmentKey } from "../../utils/syncedThemeImages";
import { noteRecencyStamp } from "../../api/queries/recentNoteActivity";

/** Fixed card dimensions, matching the directory card grid. */
const CARD_WIDTH = 220;
const CARD_HEIGHT = 150;

// Two-line ellipsis; duplicated for title and body copy.
const clampLines = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  wordBreak: "break-word" as const,
};

/** Max folder / tag chips rendered before the rest collapse into "+N". */
const MAX_META_CHIPS = 2;

/** Human label for a directory id, falling back through name to id. */
const directoryName = (
  id: string,
  directoriesById: Record<string, DirectoryReply | undefined>,
): string => {
  const directory = directoriesById[id];
  return directory?.display_name || directory?.name || id;
};

/** Human label for a minimal tag, falling back through slug to id. */
const tagName = (
  id: string,
  tagsById: Record<string, MinimalTag | undefined>,
): string => {
  const tag = tagsById[id];
  return tag?.display_name || tag?.slug || id;
};

/**
 * Small outlined chip used for folder / tag labels. When `color` is set
 * (derived from the label's hash) the chip is tinted with it.
 */
const MetaChip: React.FC<{
  label: string;
  color?: string;
  onClick?: () => void;
}> = ({ label, color, onClick }) => (
  <Chip
    label={label}
    size="small"
    variant="outlined"
    onClick={(event) => {
      event.stopPropagation();
      onClick?.();
    }}
    onMouseDown={(event) => event.stopPropagation()}
    sx={{
      fontWeight: 400,
      "& .MuiChip-label": { fontWeight: 400, px: 1 },
      ...(color
        ? {
            color,
            borderColor: alpha(color, 0.5),
            backgroundColor: alpha(color, 0.12),
          }
        : undefined),
    }}
  />
);

export interface RecentNoteRowProps {
  note: MinimalNote;
  /** Directory metadata used to label the note's folders. */
  directoriesById?: Record<string, DirectoryReply | undefined>;
  /** Tag metadata used to label the note's tags. */
  tagsById?: Record<string, MinimalTag | undefined>;
  /** Changed-characters cell (drafts). */
  changed?: React.ReactNode;
  /** Overrides the note's `updated_at` for the time cell. */
  timestamp?: string | number | Date;
  /** Hover-revealed action cell (e.g. draft dismiss). */
  action?: React.ReactNode;
  /** Reserve a leading hover-revealed action column. */
  showActionColumn?: boolean;
  /** Called when a folder chip is clicked (to apply a directory filter). */
  onDirectoryClick?: (directoryId: string) => void;
}

/**
 * Single-line note list row used by the Home sections. Columns share a
 * fixed grid template so folders / tags / time align across rows.
 * Clicking opens the editor; right-click reuses the shared NoteCardMenu;
 * hovering reveals the note's (markdown-stripped) content.
 */
export const RecentNoteRow: React.FC<RecentNoteRowProps> = ({
  note,
  directoriesById = {},
  tagsById = {},
  changed,
  timestamp,
  action,
  showActionColumn = false,
  onDirectoryClick,
}) => {
  const navigate = useNavigate();
  const { theme } = useThemeStore();

  // Same markdown stripping as the left-rail note rows / NoteRowView, so
  // the preview shows bare prose instead of `**markers**` / table pipes.
  const preview = useMemo(
    () => markdownPreview(note.stripped_content),
    [note.stripped_content],
  );

  const directoryIds = note.directory_ids ?? [];
  const tagIds = note.tag_ids ?? [];

  // Cap visible chips so a note with many folders / tags still fits on a
  // single line; the remainder is summarised with a "+N" chip.
  const visibleDirectoryIds = directoryIds.slice(0, MAX_META_CHIPS);
  const hiddenDirectories = directoryIds.length - visibleDirectoryIds.length;
  const visibleTagIds = tagIds.slice(0, MAX_META_CHIPS);
  const hiddenTags = tagIds.length - visibleTagIds.length;

  const stampValue = timestamp ?? note.updated_at;
  const updatedAt = stampValue ? new Date(stampValue) : null;
  const hasUpdatedAt = updatedAt !== null && !Number.isNaN(updatedAt.getTime());

  // Hover popover showing the stripped content. Opening is debounced so
  // skimming across rows does not flash a card for every one.
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const openTimer = useRef<number | null>(null);

  const cancelOpen = () => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  };

  const handleEnter = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.currentTarget;
    cancelOpen();
    openTimer.current = window.setTimeout(() => setAnchorEl(target), 350);
  };

  const handleLeave = () => {
    cancelOpen();
    setAnchorEl(null);
  };

  useEffect(() => {
    return () => {
      if (openTimer.current !== null) {
        window.clearTimeout(openTimer.current);
      }
    };
  }, []);

  return (
    <NoteCardMenu note={note}>
      <>
        <Box
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
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
            width: "100%",
            boxSizing: "border-box",
            cursor: "pointer",
            display: "grid",
            gridTemplateColumns: showActionColumn
              ? "2rem minmax(0, 8fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)"
              : "minmax(0, 8fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
            alignItems: "center",
            columnGap: M2,
            px: M2,
            py: M1,
            transition: "background-color 0.2s ease-in-out",
            "&:hover": {
              backgroundColor: theme.palette.action.hover,
            },
            "&:hover .note-row-action": {
              opacity: 1,
              pointerEvents: "auto",
            },
          }}
        >
          {showActionColumn && (
            <Box
              className="note-row-action"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                opacity: 0,
                pointerEvents: "none",
                transition: "opacity 0.18s ease",
              }}
            >
              {action}
            </Box>
          )}
          <Typography
            variant="subtitle1"
            noWrap
            sx={{ fontWeight: 400, minWidth: 0 }}
          >
            {note.title || "Untitled note"}
          </Typography>
          <Stack
            direction="row"
            spacing={M1}
            sx={{ minWidth: 0, overflow: "hidden" }}
          >
            {visibleDirectoryIds.map((id) => {
              const label = directoryName(id, directoriesById);
              return (
                <MetaChip
                  key={`dir-${id}`}
                  label={label}
                  color={colorFromString(label, theme)}
                  onClick={
                    onDirectoryClick ? () => onDirectoryClick(id) : undefined
                  }
                />
              );
            })}
            {hiddenDirectories > 0 && (
              <MetaChip label={`+${hiddenDirectories}`} />
            )}
          </Stack>
          <Stack
            direction="row"
            spacing={M1}
            sx={{ minWidth: 0, overflow: "hidden" }}
          >
            {visibleTagIds.map((id) => {
              const label = tagName(id, tagsById);
              return (
                <MetaChip
                  key={`tag-${id}`}
                  label={label}
                  color={colorFromString(label, theme)}
                />
              );
            })}
            {hiddenTags > 0 && <MetaChip label={`+${hiddenTags}`} />}
          </Stack>
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {changed}
          </Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              minWidth: 0,
            }}
          >
            {hasUpdatedAt && updatedAt && (
              <Typography
                variant="caption"
                noWrap
                sx={{ color: theme.palette.text.secondary }}
              >
                {formatDistanceToNow(updatedAt, { addSuffix: true })}
              </Typography>
            )}
          </Box>
        </Box>
        <Popover
          open={anchorEl !== null}
          anchorEl={anchorEl}
          onClose={handleLeave}
          anchorOrigin={{ vertical: "top", horizontal: "left" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          hideBackdrop
          disableAutoFocus
          disableEnforceFocus
          disableRestoreFocus
          // Let the row underneath keep receiving hover events so the
          // popover does not flicker as the cursor passes over it.
          sx={{ pointerEvents: "none" }}
          slotProps={{
            paper: {
              sx: {
                backgroundColor: "transparent",
                backgroundImage: "none",
                boxShadow: "none",
                overflow: "visible",
              },
            },
          }}
        >
          <Paper elevation={0} sx={{ maxWidth: 520, p: M2 }}>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {preview || "No content"}
            </Typography>
          </Paper>
        </Popover>
      </>
    </NoteCardMenu>
  );
};

export interface RecentNoteCardProps {
  note: MinimalNote;
  /** Optional trailing badge (e.g. an "Unsaved" chip for drafts). */
  badge?: React.ReactNode;
  /** Optional control revealed in the top-right corner on hover. */
  hoverAction?: React.ReactNode;
}

/**
 * Compact, non-draggable note card used by the Home "Drafts" row.
 * Clicking opens the editor; right-click reuses the shared NoteCardMenu.
 */
export const RecentNoteCard: React.FC<RecentNoteCardProps> = ({
  note,
  badge,
  hoverAction,
}) => {
  const navigate = useNavigate();
  const { theme } = useThemeStore();

  const preview = useMemo(
    () => markdownPreview(note.stripped_content),
    [note.stripped_content],
  );

  const hasBadge = Boolean(badge);

  return (
    <NoteCardMenu note={note}>
      <Card
        variant="outlined"
        onClick={() => {
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
              pointerEvents: "none",
              transition: "opacity 0.18s ease",
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
            boxSizing: "border-box",
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

/** Placeholder row matching a single `RecentNoteRow` while data loads. */
export const NoteRowSkeleton: React.FC = () => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
      px: M2,
      py: M1,
    }}
  >
    <Skeleton variant="text" width="50%" animation="wave" />
  </Box>
);

export interface NoteListProps {
  /** Notes to render, newest first. */
  notes: MinimalNote[];
  /** Empty-state copy. */
  emptyText?: string;
  /** Skip the translucent surface (e.g. when already nested in one). */
  bare?: boolean;
  /** Note ids to render as loading skeletons instead of rows. */
  skeletonIds?: ReadonlySet<string>;
  /** Changed-characters cell content keyed by note id. */
  changedById?: Record<string, React.ReactNode>;
  /** Timestamp override keyed by note id. */
  timestampById?: Record<string, string | number | Date>;
  /** Hover action cell content keyed by note id. */
  actionById?: Record<string, React.ReactNode>;
  /** Reserve a leading hover-revealed action column. */
  showActionColumn?: boolean;
  /** Called when a folder chip is clicked. */
  onDirectoryClick?: (directoryId: string) => void;
}

/**
 * Single-line, divider-separated list of notes on a translucent surface.
 * Shared by the "Recent notes", "Frequently used" and "Drafts" views.
 */
export const NoteList: React.FC<NoteListProps> = ({
  notes,
  emptyText = "No notes yet.",
  bare = false,
  skeletonIds,
  changedById,
  timestampById,
  actionById,
  showActionColumn = false,
  onDirectoryClick,
}) => {
  // Resolve folder / tag ids from the app-wide data rather than the search
  // reply, which may omit entries for ids the notes reference.
  const { byId: directoriesById } = useAllDirectoriesQuery();
  const { theme } = useThemeStore();
  const tagsById = useTagStore((state) => state.tagsById);

  if (notes.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary" sx={{ p: M2 }}>
        {emptyText}
      </Typography>
    );
  }

  const list = (
    <Stack divider={<Divider flexItem />}>
      {notes.map((note) =>
        skeletonIds?.has(note.id) ? (
          <NoteRowSkeleton key={note.id} />
        ) : (
          <RecentNoteRow
            key={note.id}
            note={note}
            directoriesById={directoriesById}
            tagsById={tagsById}
            changed={changedById?.[note.id]}
            timestamp={timestampById?.[note.id]}
            action={actionById?.[note.id]}
            showActionColumn={showActionColumn}
            onDirectoryClick={onDirectoryClick}
          />
        ),
      )}
    </Stack>
  );

  return bare ? (
    list
  ) : (
    <TranslucentPaper
      elevation={0}
      transparentWithoutBackground
      sx={{
        overflow: "hidden",
        backgroundColor: theme.palette.background.default,
      }}
    >
      {list}
    </TranslucentPaper>
  );
};

export interface RecentNotesProps {
  /** Notes to render, newest first. `undefined` shows the loading skeleton. */
  notes?: MinimalNote[];
  /** Maximum number of rows to render. */
  limit?: number;
  /** Empty-state copy. */
  emptyText?: string;
  /** Restrict to notes in any of these directories (subtree-expanded). */
  filterDirectoryIds?: string[];
  /** Only keep notes updated within this many days. */
  maxAgeDays?: number;
  /** Most recent view/edit time per note id (ms since epoch). */
  lastActivityById?: ReadonlyMap<string, number>;
  /** Called when a note's folder chip is clicked. */
  onDirectoryClick?: (directoryId: string) => void;
}

/**
 * "Continue where you left off" single-line list of recently updated
 * notes. Each row shows the title plus the note's folders / tags; the
 * stripped content is revealed in a tooltip on hover.
 *
 * Data is owned by the caller (Home page) so it can be shared with the
 * greeting's today-count without issuing a second request.
 */
export const RecentNotes: React.FC<RecentNotesProps> = ({
  notes,
  limit = 12,
  emptyText = "No notes yet. Create one from the Actions panel to see it here.",
  filterDirectoryIds,
  maxAgeDays,
  lastActivityById,
  onDirectoryClick,
}) => {
  const { theme } = useThemeStore();

  // Show the later of the last view/edit and `updated_at` in each row's
  // time cell, so a read note reads as "viewed X ago" too.
  const timestampById = useMemo(() => {
    if (!notes || !lastActivityById || lastActivityById.size === 0) {
      return undefined;
    }
    const map: Record<string, number> = {};
    for (const note of notes) {
      const stamp = noteRecencyStamp(note, lastActivityById);
      if (Number.isFinite(stamp)) {
        map[note.id] = stamp;
      }
    }
    return map;
  }, [notes, lastActivityById]);

  if (!notes) {
    return (
      <TranslucentPaper
        elevation={0}
        transparentWithoutBackground
        sx={{
          overflow: "hidden",
          backgroundColor: theme.palette.background.default,
        }}
      >
        <Stack divider={<Divider flexItem />}>
          {Array.from({ length: 4 }).map((_, index) => (
            <NoteRowSkeleton key={`recent-note-skeleton-${index}`} />
          ))}
        </Stack>
      </TranslucentPaper>
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

  const filtered = notes.filter((note) => {
    if (filterDirectoryIds && filterDirectoryIds.length > 0) {
      const inDirectory = (note.directory_ids ?? []).some((id) =>
        filterDirectoryIds.includes(id),
      );
      if (!inDirectory) {
        return false;
      }
    }
    if (maxAgeDays !== undefined) {
      const stamp = noteRecencyStamp(note, lastActivityById);
      if (
        Number.isFinite(stamp) &&
        // eslint-disable-next-line react-hooks/purity -- age cutoff needs wall-clock time
        stamp < Date.now() - maxAgeDays * 86_400_000
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <NoteList
      notes={filtered.slice(0, limit)}
      emptyText={emptyText}
      timestampById={timestampById}
      onDirectoryClick={onDirectoryClick}
    />
  );
};
