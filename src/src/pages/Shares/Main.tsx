import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FolderIcon from "@mui/icons-material/Folder";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ShareIcon from "@mui/icons-material/Share";
import { M1, M2, M3 } from "../../statics";
import { usePanelSize, useLeftPanel, useRightPanel } from "../../LayoutProvider";
import TranslucentPaper from "../../components/TranslucentPaper";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useShares, useDeleteShares } from "../../api/queries/sharingQueries";
import { useNotesByScope } from "../../api/queries/useNotesByScope";
import { useDirectory } from "../../api/queries/useDirectoryQuery";
import { useShelf } from "../../api/queries/shelfQueries";
import { ShareCard } from "../NotePage/ShareCard";
import { SharesLeftPanel } from "./LeftPanel";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";
import type { NoteShareReply } from "../../api/models/sharing";

/**
 * App-wide share management page.
 *
 * Reads optional `shelf` and `directory` query params to scope the list:
 *   /shares                     -> every share
 *   /shares?shelf=<id>          -> shares of notes on that shelf
 *   /shares?directory=<id>      -> shares of notes in that directory
 *
 * The shares API only filters by note id, so the scope is resolved by
 * fetching the notes in that shelf/directory through the search endpoint
 * and intersecting the two sets.
 */
export const SharesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setMessage = useInfoStore((s) => s.setMessage);
  const { theme } = useThemeStore();
  const setSelectedShelfId = useSelectedShelfStore((s) => s.setSelectedShelfId);

  const shelfId = searchParams.get("shelf") ?? undefined;
  const directoryId = searchParams.get("directory") ?? undefined;
  const hasScope = Boolean(shelfId || directoryId);

  // Keep the app-wide shelf selection pointed at the shelf in use here
  // so the topbar shelf menu shows it as selected too.
  useEffect(() => {
    if (shelfId) setSelectedShelfId(shelfId);
  }, [shelfId, setSelectedShelfId]);

  // Rewrite the scope params in place; an empty scope drops to /shares.
  const navigateToScope = useCallback(
    (nextShelfId: string | null, nextDirectoryId: string | null) => {
      const params = new URLSearchParams();
      if (nextShelfId) params.set("shelf", nextShelfId);
      if (nextDirectoryId) params.set("directory", nextDirectoryId);
      const search = params.toString();
      navigate(search ? `/shares?${search}` : "/shares");
    },
    [navigate],
  );

  const handleSelectShelf = useCallback(
    (id?: string) => navigateToScope(id ?? null, directoryId ?? null),
    [navigateToScope, directoryId],
  );
  const handleSelectDirectory = useCallback(
    (id?: string) => navigateToScope(shelfId ?? null, id ?? null),
    [navigateToScope, shelfId],
  );

  // Left rail mirrors the directory view: scope summary + changers.
  useLeftPanel(
    <SharesLeftPanel
      shelfId={shelfId}
      directoryId={directoryId}
      onSelectShelf={handleSelectShelf}
      onSelectDirectory={handleSelectDirectory}
    />,
    [shelfId, directoryId, handleSelectShelf, handleSelectDirectory],
  );
  useRightPanel(null);
  usePanelSize({ left: "clamp(20rem, 25vw, 30rem)" });

  const sharesQuery = useShares({});
  const notesQuery = useNotesByScope({ shelfId, directoryId });

  const directoryQuery = useDirectory(hasScope ? directoryId : undefined);
  const shelfQuery = useShelf({ id: shelfId ?? "" });

  const deleteShares = useDeleteShares({
    onSuccess: () => {
      setMessage(new SnackbarUpdateImpl("Share deleted", "success"));
    },
    onError: (error) => {
      setMessage(
        new SnackbarUpdateImpl(
          `Error deleting share: ${error.message}`,
          "error",
        ),
      );
    },
  });

  const shares = useMemo<NoteShareReply[]>(
    () => sharesQuery.data ?? [],
    [sharesQuery.data],
  );

  const notesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const note of notesQuery.data ?? []) {
      map.set(note.id, note.title);
    }
    return map;
  }, [notesQuery.data]);

  const scopedNoteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const note of notesQuery.data ?? []) {
      ids.add(note.id);
    }
    return ids;
  }, [notesQuery.data]);

  const visibleShares = useMemo(
    () =>
      hasScope
        ? shares.filter((share) => scopedNoteIds.has(share.note_id))
        : shares,
    [hasScope, shares, scopedNoteIds],
  );

  // Group by note so several shares of the same note cluster together.
  const groups = useMemo(() => {
    const byNote = new Map<string, NoteShareReply[]>();
    for (const share of visibleShares) {
      const bucket = byNote.get(share.note_id);
      if (bucket) {
        bucket.push(share);
      } else {
        byNote.set(share.note_id, [share]);
      }
    }
    return [...byNote.entries()]
      .map(([noteId, noteShares]) => ({
        noteId,
        title: notesById.get(noteId) ?? "Untitled note",
        shares: noteShares,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [visibleShares, notesById]);

  const scopeLabel = useMemo(() => {
    if (directoryId) {
      return (
        directoryQuery.data?.display_name ??
        directoryQuery.data?.name ??
        "Book/Chapter"
      );
    }
    if (shelfId) {
      return (
        shelfQuery.data?.display_name ??
        shelfQuery.data?.slug ??
        "Shelf"
      );
    }
    return null;
  }, [directoryId, shelfId, directoryQuery.data, shelfQuery.data]);

  const isLoading =
    sharesQuery.isLoading || (hasScope && notesQuery.isLoading);

  const handleRequestDelete = (shareId: string) => {
    deleteShares.mutate({ share_ids: [shareId] });
  };

  return (
    // Centered, max-width canvas mirroring `DirectoryView`. The top
    // element is a `TranslucentPaper` so themes with a background image
    // shine through instead of being covered by an opaque Paper.
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "clamp(20rem, 100%, 90rem)",
        alignSelf: "center",
      }}
    >
      <TranslucentPaper
        elevation={0}
        sx={{
          flex: 1,
          p: M3,
          borderRadius: theme.shape.borderRadius,
        }}
      >
        <Stack spacing={M3}>
          <Stack
            direction="row"
            spacing={M2}
            sx={{ alignItems: "center", minWidth: 0 }}
          >
            <Tooltip title="Go home">
              <IconButton
                size="small"
                onClick={() => navigate("/")}
                aria-label="go home"
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <ShareIcon fontSize="small" color="primary" />
            <Typography variant="h5" sx={{ fontWeight: 600 }} noWrap>
              Shares
            </Typography>
            {scopeLabel && (
              <Chip
                size="small"
                icon={
                  directoryId ? (
                    <FolderIcon fontSize="small" />
                  ) : (
                    <MenuBookIcon fontSize="small" />
                  )
                }
                label={scopeLabel}
                variant="outlined"
              />
            )}
            <Typography variant="body2" color="text.secondary" noWrap>
              {isLoading
                ? "Loading…"
                : `${visibleShares.length} share${
                    visibleShares.length === 1 ? "" : "s"
                  }`}
            </Typography>
          </Stack>

          {isLoading ? (
            <Stack
              sx={{
                py: 6,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress size={28} />
            </Stack>
          ) : sharesQuery.isError ? (
            <Alert severity="error">
              {sharesQuery.error instanceof Error
                ? sharesQuery.error.message
                : "Failed to load shares."}
            </Alert>
          ) : groups.length === 0 ? (
            <Stack
              spacing={M1}
              sx={{
                py: 6,
                alignItems: "center",
                justifyContent: "center",
                color: "text.secondary",
              }}
            >
              <ShareIcon fontSize="large" />
              <Typography variant="body1">No shares here yet.</Typography>
              <Typography variant="body2">
                {hasScope
                  ? "Notes in this scope have no active share links."
                  : "Share a note to see its link listed here."}
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={M3}>
              {groups.map((group) => (
                <Box key={group.noteId}>
                  <Stack
                    direction="row"
                    spacing={M1}
                    sx={{ alignItems: "center", mb: M1, minWidth: 0 }}
                  >
                    <DescriptionOutlinedIcon
                      fontSize="small"
                      color="action"
                    />
                    <Typography
                      variant="subtitle1"
                      onClick={() => navigate(`/n/${group.noteId}`)}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      {group.title}
                    </Typography>
                  </Stack>
                  <Stack spacing={M1}>
                    {group.shares.map((share) => (
                      <ShareCard
                        key={share.id}
                        share={share}
                        onRequestDelete={handleRequestDelete}
                      />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </TranslucentPaper>
    </Box>
  );
};

export default SharesPage;
