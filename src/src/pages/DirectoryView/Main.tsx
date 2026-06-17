import {
  Box,
  ButtonBase,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DragDropProvider } from "@dnd-kit/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import type { ListDirectoriesQuery } from "../../api/DirectoryApi";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import {
  DirectoryHierarchyBuilder,
  type HirarchyItem,
} from "../../models/HirarchyItem";
import { M2, M3, M4, M5, M6 } from "../../statics";
import type { MinimalNote } from "../../api/models/search";
import { getNoteParentDirectoryIds } from "../../utils/fileGraphUtils";
import { LeftPanel } from "../MainPage/LeftPanel";
// Directory action UI moved to `DirectoryActions` component
import { NoteApi } from "../../api/NoteApi";
import { note_of_date_at_hour } from "../../utils/NoteTitleTemplates";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { UserError } from "../../api/models/UserError";
import { DirectoryActions } from "./DirectoryActions";
import TopBar from "../../components/TopBar";
import { useLatestNotes } from "../../api/queries/useNoteQueries";
// RecentActivityPanel now rendered by DirectoryActions

const findNodeById = (root: HirarchyItem, id: string): HirarchyItem | null => {
  if (root.getId() === id) {
    return root;
  }

  for (const child of root.getChildren()) {
    const found = findNodeById(child, id);
    if (found) {
      return found;
    }
  }

  return null;
};

/**
 * Recursively searches for a node by its ID within a hierarchical structure
 * and returns the path from the root to that node.
 *
 * @param root The starting `HirarchyItem` of the search (the root of the tree or subtree).
 * @param id The unique identifier of the `HirarchyItem` to find.
 * @returns An array of `HirarchyItem`s representing the path from the `root`
 * to the found item. The first element is the `root`, and the last is the
 * item with the matching `id`. Returns an empty array if the `id` is not found
 * in the hierarchy.
 */
const findPathById = (root: HirarchyItem, id: string): HirarchyItem[] => {
  if (root.getId() === id) {
    return [root];
  }

  for (const child of root.getChildren()) {
    const path = findPathById(child, id);
    if (path.length > 0) {
      return [root, ...path];
    }
  }

  return [];
};

/**
 * Organizes an array of notes into a dictionary, grouping them by their parent directory ID.
 *
 * Notes without a specific directory are placed under the "root" key.
 *
 * @param notes - An array of `MinimalNote` objects to be grouped.
 * @returns A record where keys are directory IDs (or "root") and values are arrays of notes belonging to that directory.
 */
const buildNotesByDirectory = (
  notes: MinimalNote[],
): Record<string, MinimalNote[]> => {
  const dict: Record<string, MinimalNote[]> = {};

  notes.forEach((note) => {
    const parentIds = getNoteParentDirectoryIds(note.permissions);
    const targetDirs = parentIds.length === 0 ? ["root"] : parentIds;
    targetDirs.forEach((dir) => {
      if (!dict[dir]) {
        dict[dir] = [];
      }
      dict[dir].push(note);
    });
  });

  return dict;
};

/**
 * Renders the directory view UI, including breadcrumb navigation, child
 * directories, and notes for the current directory.
 *
 * This component:
 * - Loads directory data into the store and builds a hierarchy tree.
 * - Resolves the current directory from the route and computes its breadcrumb path.
 * - Groups notes by directory for efficient rendering.
 * - Provides actions to create a note and rename the current directory.
 * - Displays a left sidebar with navigation, recent activity, and directory tree.
 *
 * Error and status feedback are reported via the info snackbar.
 */
export const DirectoryView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const directoryId = id ?? "root";
  const { directoriesById, setDirectories } = useDirectoryStore();
  const { data: notes } = useLatestNotes();
  const { setMessage } = useInfoStore();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [leftPaneOpen, setLeftPaneOpen] = useState(true);

  // Keep a stable query object so the directory list fetch is memoized
  // across rerenders and doesn't thrash the cache.
  const directoryListQuery = useMemo<ListDirectoriesQuery>(
    () => ({ limit: 500, offset: 0 }),
    [],
  );

  const { data: directories } = useDirectoriesQuery(directoryListQuery, true);

  useEffect(() => {
    if (directories) {
      setDirectories(directories);
    }
  }, [directories, setDirectories]);

  // Build a full hierarchy tree so we can find the current node and its path.
  const directoryHierarchy = useMemo(
    () => new DirectoryHierarchyBuilder(directoriesById).build("Stacks"),
    [directoriesById],
  );

  // Resolve the currently visible node; fall back to root when not found.
  const currentNode = useMemo(
    () => findNodeById(directoryHierarchy, directoryId) ?? directoryHierarchy,
    [directoryHierarchy, directoryId],
  );

  // Precompute breadcrumb path for the current node.
  const path = useMemo(
    () => findPathById(directoryHierarchy, currentNode.getId()),
    [directoryHierarchy, currentNode],
  );

  // Group notes by their parent directory to render the list efficiently.
  const notesByDirectory = useMemo(
    () => buildNotesByDirectory(notes ?? []),
    [notes],
  );

  const childDirectories = currentNode.getChildren();
  const notesInDirectory = notesByDirectory[currentNode.getId()] ?? [];

  const title =
    currentNode.getId() === "root" ? "Directory View" : currentNode.getName();

  /**
   * Creates a new note and (optionally) assigns it to the current directory.
   * The user is then navigated into the note editor.
   */
  const handleCreateNote = async () => {
    try {
      const api = new NoteApi();
      // Backend requires non-empty content, so seed with a single whitespace.
      const note = await api.post(note_of_date_at_hour(), " ");
      if (!note) {
        setMessage(new SnackbarUpdateImpl("Failed to create note", "error"));
        return;
      }

      console.log(
        `currend node id: ${currentNode.getId()}, note dir: ${note.get_dir()}, perms: ${JSON.stringify(note.permissions)}`,
      );
      if (
        currentNode.getId() !== "root" &&
        currentNode.getId() !== note.get_dir()
      ) {
        const moved = await api.patchDirectory(note.id, currentNode.getId());
        if (!moved) {
          setMessage(
            new SnackbarUpdateImpl(
              "Note created, but failed to assign directory",
              "warning",
            ),
          );
        }
      }

      navigate(`/n/${note.id}`);
    } catch (error) {
      if (error instanceof UserError) {
        setMessage(
          new SnackbarUpdateImpl(
            error.title,
            "error",
            undefined,
            error.description,
          ),
        );
        return;
      }
      setMessage(new SnackbarUpdateImpl("Unexpected error", "error"));
    }
  };

  /**
   * Sends the user to the full directory edit page.
   */
  const handleRenameDirectory = () => {
    if (currentNode.getId() === "root") {
      setMessage(
        new SnackbarUpdateImpl("Root directory cannot be edited", "info"),
      );
      return;
    }

    navigate(`/d/${currentNode.getId()}/edit`);
  };

  return (
    <Paper
      elevation={0}
      ref={setScrollElement}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "auto",
      }}
    >
      <TopBar scrollContainer={scrollElement}></TopBar>
      {/* padding for actual padding, topbar and topbar margin */}
      <Box
        sx={{
          pt: `calc(${M4} + ${M5} + ${M3})`,
        }}
      />

      <Box
        sx={{
          px: M4,
          color: "textPrimary",
        }}
      >
        {/*
          DragDropProvider is required because DirectorySideView registers
          droppable targets via dnd-kit hooks. Even if DirectoryView doesn't
          initiate drag operations itself, the provider ensures the directory
          tree can still accept note drops from elsewhere in the app without
          runtime hook errors.
        */}
        <DragDropProvider onDragEnd={() => undefined}>
          <Stack direction="row" spacing={M4} sx={{ alignItems: "flex-start" }}>
            <LeftPanel open={leftPaneOpen} setOpen={setLeftPaneOpen}>
              <DirectoryActions
                currentNode={currentNode}
                navigate={navigate}
                handleCreateNote={handleCreateNote}
                handleRenameDirectory={handleRenameDirectory}
              />
            </LeftPanel>

            <Paper elevation={2} sx={{ flex: 1, p: M3 }}>
              <Stack spacing={M3}>
                <Stack spacing={0.5}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    {path.map((segment, index) => (
                      <Stack
                        key={segment.getId()}
                        direction="row"
                        spacing={1}
                        sx={{
                          alignItems: "center",
                        }}
                      >
                        <ButtonBase
                          onClick={() => navigate(`/d/${segment.getId()}`)}
                          sx={{
                            borderRadius: 1,
                            px: 0.5,
                            py: 0.25,
                            "&:hover": {
                              backgroundColor: "action.hover",
                            },
                          }}
                        >
                          <Typography variant="body2" color="textSecondary">
                            {segment.getName()}
                          </Typography>
                        </ButtonBase>
                        {index < path.length - 1 && (
                          <Typography variant="body2" color="textSecondary">
                            ›
                          </Typography>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {title}
                  </Typography>
                </Stack>

                <Stack spacing={2}>
                  {childDirectories.length > 0 && (
                    <Stack spacing={1.5}>
                      {childDirectories.map((child, index) => (
                        <ButtonBase
                          key={child.getId()}
                          onClick={() => navigate(`/d/${child.getId()}`)}
                          sx={{
                            width: "100%",
                            textAlign: "left",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                              px: 2,
                              py: 1.5,
                              borderRadius: 2,
                              backgroundColor: "background.paper",
                              width: "100%",
                            }}
                          >
                            <Box
                              sx={{
                                width: 4,
                                height: "100%",
                                minHeight: 36,
                                borderRadius: 999,
                                backgroundColor:
                                  index % 2 === 0 ? "#C27C3B" : "#3B7CC2",
                              }}
                            />
                            <Box sx={{ flex: 1 }}>
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 600 }}
                              >
                                {child.getName()}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {(notesByDirectory[child.getId()] ?? []).length}{" "}
                                Pages
                              </Typography>
                            </Box>
                          </Box>
                        </ButtonBase>
                      ))}
                    </Stack>
                  )}

                  <Divider sx={{ opacity: 0.3 }} />

                  <Stack spacing={1.5}>
                    {notesInDirectory.length === 0 ? (
                      <Typography variant="body2" color="textSecondary">
                        No notes yet in this directory.
                      </Typography>
                    ) : (
                      notesInDirectory.map((note, index) => (
                        <ButtonBase
                          key={note.id}
                          onClick={() => navigate(`/n/${note.id}`)}
                          sx={{
                            width: "100%",
                            textAlign: "left",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 2,
                              px: 2,
                              py: 1.5,
                              borderRadius: 2,
                              backgroundColor: "background.paper",
                              width: "100%",
                            }}
                          >
                            <Box
                              sx={{
                                width: 4,
                                minHeight: 44,
                                borderRadius: 999,
                                backgroundColor:
                                  index % 2 === 0 ? "#54A07A" : "#8E6CCB",
                              }}
                            />
                            <Box sx={{ flex: 1 }}>
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 600 }}
                              >
                                {note.title}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="textSecondary"
                                sx={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {note.stripped_content}
                              </Typography>
                            </Box>
                          </Box>
                        </ButtonBase>
                      ))
                    )}
                  </Stack>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </DragDropProvider>
      </Box>
    </Paper>
  );
};
