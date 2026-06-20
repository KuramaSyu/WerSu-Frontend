import { DragDropProvider, type DragDropEvents } from "@dnd-kit/react";
import { Box, IconButton, Stack } from "@mui/material";

import { useEffect, useMemo, useRef, useState } from "react";
import CreateIcon from "@mui/icons-material/Create";
import AddIcon from "@mui/icons-material/Add";
import { M1, M2, M3, M4, M5, M6 } from "../../statics";
import { NoteApi } from "../../api/NoteApi";
import { CardGrid } from "./CardGrid";
import { Note, type NoteData } from "../../api/models/search";
import {} from "../../zustand/useSearchNotesStore";
import type { ListDirectoriesQuery } from "../../api/DirectoryApi";
import { DirectoryApi } from "../../api/DirectoryApi";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { DirectorySideView } from "./DirectorySideView";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

import { LeftPanel } from "./LeftPanel";
import NewNoteSpeedDial from "../../components/NewNoteSpeedDial";
import { getNoteParentDirectoryIds } from "../../utils/fileGraphUtils";
import { useLatestNotes, useMoveNote } from "../../api/queries/useNoteQueries";
import { useLayout } from "../../LayoutProvider";
import { useNavigate } from "react-router-dom";
import { PopupNoteModal } from "./Modals/PopupNoteModal";
import { set } from "zod";
import { EmptyLandingPage } from "./EmptyLandingPage";

export const MainContent: React.FC = () => {
  const { directoriesById, setDirectories, clearDirectories, upsertDirectory } =
    useDirectoryStore();
  const { mutate: moveNote } = useMoveNote();
  const { data: latestNotes, isLoading } = useLatestNotes();
  const { setMessage } = useInfoStore();
  const [leftPaneOpen, setLeftPaneOpen] = useState(true);
  const navigate = useNavigate();
  const { setLeftPanel, setLeftPanelOpen } = useLayout();

  useEffect(() => {
    setLeftPaneOpen(true);
    setLeftPanel(
      <LeftPanel open={leftPaneOpen} setOpen={setLeftPaneOpen}>
        <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
          <IconButton
            size="small"
            color="primary"
            onClick={() => void handleCreateDirectory()}
          >
            <AddIcon />
          </IconButton>
        </Stack>
        <DirectorySideView isLoading={directoriesLoading} />
      </LeftPanel>,
    );
    return () => setLeftPanel(undefined);
  }, []);

  type DragEndEvent = Parameters<DragDropEvents["dragend"]>[0];

  /**
   * Handles successful dnd-kit drop operations from notes into directory nodes.
   * This persists the move via REST, updates client state, and emits snackbar
   * feedback at the bottom-right through the global info store.
   */
  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const source = event.operation.source;
    const target = event.operation.target;

    if (!source || !target) {
      return;
    }

    if (source.type !== "note" || target.type !== "directory") {
      return;
    }

    const noteId = String(source.id);
    const directoryId =
      typeof target.data?.directoryId === "string"
        ? target.data.directoryId
        : String(target.id);
    const directoryName =
      typeof target.data?.directoryName === "string"
        ? target.data.directoryName
        : directoryId;

    const normalizedDirectoryId =
      directoryId === "root" ? undefined : directoryId;

    const moved = await new NoteApi().patchDirectory(
      noteId,
      normalizedDirectoryId,
    );
    if (!moved) {
      setMessage(new SnackbarUpdateImpl("Failed to move note", "error"));
      return;
    }

    moveNote({ noteId, directoryId: normalizedDirectoryId });
    // Use an explicit destination name so drag-drop results are immediately clear.
    setMessage(
      new SnackbarUpdateImpl(`Note moved to ${directoryName}`, "success"),
    );
  };

  const handleCreateDirectory = async (): Promise<void> => {
    const nextName = window.prompt("New directory name");
    if (!nextName || nextName.trim() === "") {
      return;
    }

    const trimmedName = nextName.trim();

    const created = await new DirectoryApi().create({
      name: trimmedName,
      display_name: trimmedName,
    });

    if (!created) {
      setMessage(new SnackbarUpdateImpl("Failed to create directory", "error"));
      return;
    }

    upsertDirectory(created);
    setMessage(new SnackbarUpdateImpl("Directory created", "success"));
    navigate(`/d/${created.id}`);
  };

  // Arrange notes into a Dict[directoryId, List[Note]] with multi-parent support.
  const notesByDirectory = useMemo(() => {
    console.time("Grouping notes by directory in MainContent");
    const dict: Record<string, Note[]> = {};
    Object.values(latestNotes ?? []).forEach((noteData) => {
      const notedata: NoteData = {
        ...noteData,
        content: noteData.stripped_content,
        permissions: noteData.permissions ?? [],
      };
      const note = new Note(notedata);
      const parentIds = getNoteParentDirectoryIds(note.permissions);

      const targetDirs = parentIds.length === 0 ? ["root"] : parentIds;
      targetDirs.forEach((dir) => {
        if (!dict[dir]) {
          dict[dir] = [];
        }
        dict[dir].push(note);
      });
    });
    console.timeEnd("Grouping notes by directory in MainContent");
    return dict;
  }, [latestNotes]);

  // Only fetch directory metadata if at least one note points to a non-root
  // directory. This avoids unnecessary network traffic on root-only views.
  const hasDirectoryReferences = useMemo(
    () =>
      Object.keys(notesByDirectory).some(
        (directoryId) => directoryId !== "root",
      ),
    [notesByDirectory],
  );

  // Keep a stable query object so TanStack Query can reliably reuse the same
  // cache key and deduplicate requests across rerenders.
  const directoryListQuery = useMemo<ListDirectoriesQuery>(
    () => ({ limit: 500, offset: 0 }),
    [],
  );

  const { data: directories, isLoading: directoriesLoading } =
    useDirectoriesQuery(directoryListQuery, hasDirectoryReferences);

  // Mirror the server-state cache into the local entity map store used by the
  // UI. This gives components O(1) ID lookups and a single shared source for
  // directory labels.
  useEffect(() => {
    if (!hasDirectoryReferences) {
      clearDirectories();
      return;
    }

    if (directories) {
      setDirectories(directories);
    }
  }, [hasDirectoryReferences, directories, clearDirectories, setDirectories]);

  // Temporary debug logging for grouped notes; safe to remove once directory
  // grouping behavior is validated.
  // useEffect(() => {
  //   console.log(
  //     `notesByDirectory ${JSON.stringify(notesByDirectory, null, 2)}`,
  //   );
  // }, [notesByDirectory]);

  return (
    <>
      <Box
        sx={{
          height: "100%",
          width: "100%",
          alignSelf: "center",
          fontFamily: "Open Sans",
          display: "flex",
          // overflow: "auto",
        }}
      >
        <Box
          sx={{
            // height: "calc(100% - 8rem)",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <NewNoteSpeedDial />
          <DragDropProvider onDragEnd={(event) => void handleDragEnd(event)}>
            <Stack direction={"row"} sx={{ alignItems: "center" }}>
              <Box sx={{ width: "100%" }}>
                {Object.entries(notesByDirectory).map(([dir, notes]) => {
                  const dirMeta = directoriesById[dir];
                  const forceLoading = dir !== "root" && !dirMeta;
                  const displayTitle =
                    dir === "root"
                      ? "Root"
                      : dirMeta?.display_name || dirMeta?.name || dir;

                  return (
                    <Box
                      key={dir}
                      sx={{
                        position: "relative",
                        width: "auto",
                      }}
                    >
                      <CardGrid
                        notes={notes}
                        title={forceLoading ? "Loading..." : displayTitle}
                        loading={forceLoading}
                      />
                    </Box>
                  );
                })}
              </Box>
            </Stack>
          </DragDropProvider>
        </Box>
        {!isLoading && latestNotes?.length === 0 && <EmptyLandingPage />}
        <PopupNoteModal />
      </Box>
    </>
  );
};
