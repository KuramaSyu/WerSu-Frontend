import { useMemo } from "react";
import {
  Box,
  Card,
  Chip,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { formatDistanceToNow } from "date-fns";
import { useDraggable } from "@dnd-kit/react";
import { useNavigate } from "react-router-dom";
import { Note, type MinimalNote } from "../../api/models/search";
import { useMainPageStore } from "../../zustand/useMainPageStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useTagStore } from "../../zustand/useTagStore";
import { tagLabel } from "../../api/models/tag";
import { markdownPreview } from "../../utils/markdownPreview";
import { NoteCardMenu } from "../../components/RightClick/NoteCardMenu";

const TITLE_LINES = 3;
const PREVIEW_LINES = 3;
const MAX_VISIBLE_TAGS = 2;

const clampLines = (lines: number) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  overflowWrap: "anywhere",
}) as const;

const updatedLabelFor = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return formatDistanceToNow(date, { addSuffix: true });
};

const LoadingCard: React.FC<{ sx?: object }> = ({ sx }) => (
  <Card
    variant="outlined"
    sx={{
      position: "relative",
      overflow: "hidden",
      borderRadius: 2,
      cursor: "wait",
      opacity: 0.9,
      ...sx,
    }}
  >
    <Box sx={{ height: 3, backgroundColor: "divider" }} />
    <Box sx={{ px: 2.25, pt: 1.75, pb: 1.5 }}>
      <Stack spacing={1.25}>
        <Skeleton variant="text" width="82%" height={30} animation="wave" />
        <Skeleton variant="text" width="100%" height={20} animation="wave" />
        <Skeleton variant="text" width="94%" height={20} animation="wave" />
        <Skeleton variant="text" width="62%" height={20} animation="wave" />
        <Skeleton variant="rounded" width="46%" height={22} animation="wave" />
      </Stack>
    </Box>
    <Divider />
    <Box sx={{ px: 2, py: 1 }}>
      <Skeleton variant="text" width="52%" height={18} animation="wave" />
    </Box>
  </Card>
);

/**
 * Note card used by the masonry grids.
 *
 * Visual hierarchy is deliberately three-tiered: the title is the only
 * high-contrast text, the excerpt is quiet body copy, and the footer
 * carries metadata plus the secondary open action. The thin top rule
 * gives every card a shared visual anchor without competing with text.
 */
export const NoteCard: React.FC<{
  note: MinimalNote;
  sx?: object;
  loading?: boolean;
  /**
   * Optional click handler. When provided, the card calls it instead of
   * opening the shared popup note modal (used by the tag grid so a card
   * opens the full note page directly).
   */
  onOpen?: (note: MinimalNote) => void;
}> = ({ note, sx, loading = false, onOpen }) => {
  const { ref, isDragging } = useDraggable({
    id: note.id,
    type: "note",
    data: {
      noteId: note.id,
    },
  });
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const { setNoteModalOpen: setModalOpen, setSelectedModalNote: setNote } =
    useMainPageStore();
  const tagsById = useTagStore((state) => state.tagsById);

  const preview = useMemo(
    () => markdownPreview(note.stripped_content, { maxLength: 180 }),
    [note.stripped_content],
  );

  const updatedLabel = useMemo(
    () => updatedLabelFor(note.updated_at),
    [note.updated_at],
  );

  const tagIds = useMemo(
    () => (note.tag_ids ?? []).filter((tagId) => tagsById[tagId] !== undefined),
    [note.tag_ids, tagsById],
  );
  const visibleTagIds = tagIds.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = tagIds.length - visibleTagIds.length;

  if (loading) {
    return <LoadingCard sx={sx} />;
  }

  const openCard = () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return;
    }
    if (onOpen) {
      onOpen(note);
      return;
    }
    setNote(new Note({ ...note, content: "" }));
    setModalOpen(true);
  };

  const openFullNote = () => {
    navigate(`/n/${note.id}`);
  };

  return (
    <NoteCardMenu note={note}>
      <Box
        ref={ref}
        // Right-click must not start a drag or reach the card's click.
        onPointerDown={(event) => {
          if (event.button !== 0) event.stopPropagation();
        }}
      >
        <Card
          variant="outlined"
          role="button"
          tabIndex={0}
          aria-label={`Open note: ${note.title || "Untitled note"}`}
          onClick={openCard}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openCard();
            }
          }}
          sx={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 2,
            borderColor: alpha(theme.palette.text.primary, 0.1),
            backgroundColor: theme.palette.background.paper,
            cursor: isDragging ? "grabbing" : "grab",
            opacity: isDragging ? 0.58 : 1,
            transition: theme.transitions.create(
              ["transform", "box-shadow", "border-color"],
              {
                duration: theme.transitions.duration.short,
                easing: theme.transitions.easing.easeOut,
              },
            ),
            "&:hover": {
              transform: "translateY(-3px)",
              borderColor: alpha(theme.palette.primary.main, 0.48),
              boxShadow: `0 10px 28px ${alpha(
                theme.palette.common.black,
                theme.palette.mode === "dark" ? 0.38 : 0.12,
              )}`,
            },
            "&:focus-visible": {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 2,
            },
            ...sx,
          }}
        >
          {/* Shared visual anchor across every card. */}
          <Box
            sx={{
              height: 3,
              flexShrink: 0,
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            }}
          />

          <Box sx={{ px: 2.25, pt: 2, pb: 1.5, minWidth: 0 }}>
            <Stack spacing={1.1}>
              <Typography
                component="h3"
                variant="h6"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.35,
                  letterSpacing: "-0.01em",
                  color: "text.primary",
                  ...clampLines(TITLE_LINES),
                }}
              >
                {note.title || "Untitled note"}
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  lineHeight: 1.55,
                  minHeight: `${PREVIEW_LINES * 1.55}em`,
                  ...clampLines(PREVIEW_LINES),
                }}
              >
                {preview || "No preview available."}
              </Typography>

              {visibleTagIds.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
                >
                  {visibleTagIds.map((tagId) => (
                    <Chip
                      key={tagId}
                      size="small"
                      variant="outlined"
                      label={tagLabel(tagsById[tagId], tagId)}
                      sx={{
                        height: 22,
                        fontSize: "0.68rem",
                        color: "text.secondary",
                        borderColor: alpha(theme.palette.text.primary, 0.14),
                        "& .MuiChip-label": { px: 0.75 },
                      }}
                    />
                  ))}
                  {hiddenTagCount > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      +{hiddenTagCount}
                    </Typography>
                  )}
                </Stack>
              )}
            </Stack>
          </Box>

          <Box sx={{ flex: 1 }} />
          <Divider />
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              alignItems: "center",
              minHeight: 38,
              px: 1.5,
              py: 0.5,
              backgroundColor: alpha(
                theme.palette.text.primary,
                theme.palette.mode === "dark" ? 0.035 : 0.018,
              ),
            }}
          >
            <ScheduleIcon
              sx={{ fontSize: 14, ml: 0.5, color: "text.disabled" }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flex: 1, minWidth: 0 }}
            >
              {updatedLabel}
            </Typography>
            {!onOpen && (
              <Tooltip title="Open full note">
                <IconButton
                  size="small"
                  aria-label="Open full note"
                  onClick={(event) => {
                    event.stopPropagation();
                    openFullNote();
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  sx={{
                    flexShrink: 0,
                    color: "text.secondary",
                    opacity: 0.72,
                    transition: theme.transitions.create([
                      "opacity",
                      "color",
                      "background-color",
                    ]),
                    "&:hover": {
                      opacity: 1,
                      color: "primary.main",
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    },
                    ".MuiCard-root:hover &": { opacity: 1 },
                  }}
                >
                  <OpenInFullIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Card>
      </Box>
    </NoteCardMenu>
  );
};
