import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { ActivityApi } from "../api/ActivityApi";
import type { NoteVersionSummaryReply } from "../api/models/activity";
import { M2, M3, M4 } from "../statics";
import { useSearchNotesStore } from "../zustand/useSearchNotesStore";
import { useNote } from "../api/queries/useNoteQueries";
import { useQueryClient } from "@tanstack/react-query";
import type { Note } from "../api/models/search";

export interface NoteVersionsDrawerProps {
  open: boolean;
  noteId?: string;
  onClose: () => void;
  onSelectVersion: (version: NoteVersionSummaryReply) => void;
  onRestoreVersion: (version: NoteVersionSummaryReply) => void;
  selectedVersion?: NoteVersionSummaryReply | null;
  selectedContent?: string | null;
  currentContent?: string;
  isFetchingVersion?: boolean;
  isRestoring?: boolean;
  limit?: number;
}

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const formatActivityLabel = (activity: NoteVersionSummaryReply): string => {
  const note = useQueryClient().getQueryData<Note>(["note", activity.note_id]);
  const v = activity.version_index;
  return (
    (v === 1 ? "Created " : "") +
    `${note?.title || activity.note_id} ` +
    (v > 1 ? `(v${v})` : "")
  );
};

type DiffLine = {
  type: "added" | "removed" | "unchanged";
  text: string;
};

const buildLineDiff = (current = "", selected = ""): DiffLine[] => {
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
        diff.push({ type: "unchanged", text: currentLine });
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
        diff.push({ type: "added", text: selectedLine });
        j += 1;
        continue;
      }

      if (nextCurrentIndex !== -1) {
        diff.push({ type: "removed", text: currentLine });
        i += 1;
        continue;
      }

      diff.push({ type: "removed", text: currentLine });
      diff.push({ type: "added", text: selectedLine });
      i += 1;
      j += 1;
      continue;
    }

    if (currentLine !== undefined) {
      diff.push({ type: "removed", text: currentLine });
      i += 1;
      continue;
    }

    if (selectedLine !== undefined) {
      diff.push({ type: "added", text: selectedLine });
      j += 1;
    }
  }

  return diff;
};

export const NoteVersionsDrawer: React.FC<NoteVersionsDrawerProps> = ({
  open,
  noteId,
  onClose,
  onSelectVersion,
  onRestoreVersion,
  selectedVersion,
  selectedContent,
  currentContent,
  isFetchingVersion = false,
  isRestoring = false,
  limit = 15,
}) => {
  // Cache the activity API instance.
  const api = useMemo(() => new ActivityApi(), []);
  // Version list state.
  const [activity, setActivity] = useState<NoteVersionSummaryReply[]>([]);
  // Loading and error flags for the versions list.
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  // Controls which preview tab is shown (current vs selected).
  const [previewTab, setPreviewTab] = useState(0);

  useEffect(() => {
    if (!open || !noteId) {
      return;
    }

    let isMounted = true;

    const fetchActivity = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const data = await api.getNoteActivity(noteId, limit, 0);
        if (!isMounted) {
          return;
        }
        setActivity(data);
      } catch (error) {
        console.error("Failed to load versions", error);
        if (!isMounted) {
          return;
        }
        setHasError(true);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchActivity();

    return () => {
      isMounted = false;
    };
  }, [api, limit, noteId, open]);

  useEffect(() => {
    if (!selectedContent) {
      return;
    }
    setPreviewTab(0);
  }, [selectedContent]);

  // Derived content shown in the preview area.
  const previewValue = previewTab === 0 ? currentContent : selectedContent;
  const diffLines = useMemo(
    () =>
      selectedContent !== undefined
        ? buildLineDiff(currentContent ?? "", selectedContent ?? "")
        : [],
    [currentContent, selectedContent],
  );

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: 520,
          maxWidth: "100vw",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          p: M4,
          gap: M3,
        }}
      >
        <Typography variant="h6">Versions</Typography>
        <Typography variant="body2" color="textSecondary">
          Select a version to compare or restore.
        </Typography>
        <Divider />

        {isLoading && (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
            }}
          >
            <CircularProgress size={18} />
            <Typography variant="body2" color="textSecondary">
              Loading versions...
            </Typography>
          </Stack>
        )}
        {hasError && !isLoading && (
          <Typography variant="body2" color="error">
            Failed to load versions.
          </Typography>
        )}
        {!isLoading && !hasError && activity.length === 0 && (
          <Typography variant="body2" color="textSecondary">
            No versions yet.
          </Typography>
        )}

        <List dense sx={{ flex: 1, overflowY: "auto" }}>
          {activity.map((entry) => (
            <ListItem
              key={entry.version_id}
              disablePadding
              secondaryAction={
                <Button
                  size="small"
                  variant="text"
                  disabled={isRestoring || isFetchingVersion}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRestoreVersion(entry);
                  }}
                >
                  Restore
                </Button>
              }
            >
              <ListItemButton
                selected={entry.version_id === selectedVersion?.version_id}
                onClick={() => onSelectVersion(entry)}
              >
                <ListItemText
                  primary={formatActivityLabel(entry)}
                  secondary={formatTimestamp(entry.created_at)}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider />

        <Stack spacing={M2}>
          <Typography variant="subtitle2" color="textSecondary">
            Preview
          </Typography>
          {isFetchingVersion && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="textSecondary">
                Loading version...
              </Typography>
            </Stack>
          )}
          {!isFetchingVersion && !selectedContent && (
            <Typography variant="body2" color="textSecondary">
              Choose a version to preview changes.
            </Typography>
          )}
          {!isFetchingVersion && selectedContent && (
            <Stack spacing={M2}>
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: M2,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    px: M2,
                    py: 1,
                    backgroundColor: "background.paper",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="subtitle2" color="textSecondary">
                    Diff preview
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: M2,
                    maxHeight: 220,
                    overflow: "auto",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.85rem",
                  }}
                >
                  {diffLines.length === 0 && (
                    <Typography variant="body2" color="textSecondary">
                      No changes detected.
                    </Typography>
                  )}
                  {diffLines.map((line, index) => (
                    <Box
                      key={`${line.type}-${index}`}
                      sx={{
                        color:
                          line.type === "added"
                            ? "success.main"
                            : line.type === "removed"
                              ? "error.main"
                              : "textSecondary",
                      }}
                    >
                      {line.type === "added"
                        ? "+ "
                        : line.type === "removed"
                          ? "- "
                          : "  "}
                      {line.text}
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: M2,
                  overflow: "hidden",
                }}
              >
                <Tabs
                  value={previewTab}
                  onChange={(_, value) => setPreviewTab(value)}
                  variant="fullWidth"
                >
                  <Tab label="Current" />
                  <Tab label="Selected" />
                </Tabs>
                <Box
                  sx={{
                    p: M2,
                    maxHeight: 260,
                    overflow: "auto",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.85rem",
                  }}
                >
                  {previewValue || ""}
                </Box>
              </Box>
            </Stack>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
};
