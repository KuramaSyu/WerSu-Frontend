import { Box, Divider, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import type { ListDirectoriesQuery } from "../../api/DirectoryApi";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import {
  DirectoryHierarchyBuilder,
  type HirarchyItem,
} from "../../models/HirarchyItem";
import { M3, M4, M5 } from "../../statics";
import type {
  MinimalNote,
  PermissionRelationshipReply,
} from "../../api/models/search";

const getNoteDirectoryId = (
  permissions?: PermissionRelationshipReply[],
): string | undefined => {
  if (!permissions) {
    return undefined;
  }

  for (const permission of permissions) {
    const isParentRelation =
      permission.relation === "parent" ||
      permission.relation === "parent_directory";
    const isDirectorySubject =
      permission.subject.object_type === "PERMISSION_OBJECT_TYPE_DIRECTORY";

    if (isParentRelation && isDirectorySubject) {
      return permission.subject.object_id;
    }
  }

  return undefined;
};

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

const buildNotesByDirectory = (
  notes: MinimalNote[],
): Record<string, MinimalNote[]> => {
  const dict: Record<string, MinimalNote[]> = {};

  notes.forEach((note) => {
    const dir = getNoteDirectoryId(note.permissions) ?? "root";
    if (!dict[dir]) {
      dict[dir] = [];
    }
    dict[dir].push(note);
  });

  return dict;
};

export const DirectoryView: React.FC = () => {
  const { id } = useParams();
  const directoryId = id ?? "root";
  const { directoriesById, setDirectories } = useDirectoryStore();
  const { notes } = useSearchNotesStore();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );

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

  const directoryHierarchy = useMemo(
    () => new DirectoryHierarchyBuilder(directoriesById).build("Stacks"),
    [directoriesById],
  );

  const currentNode = useMemo(
    () => findNodeById(directoryHierarchy, directoryId) ?? directoryHierarchy,
    [directoryHierarchy, directoryId],
  );

  const path = useMemo(
    () => findPathById(directoryHierarchy, currentNode.getId()),
    [directoryHierarchy, currentNode],
  );

  const notesByDirectory = useMemo(() => buildNotesByDirectory(notes), [notes]);

  const childDirectories = currentNode.getChildren();
  const notesInDirectory = notesByDirectory[currentNode.getId()] ?? [];

  const title =
    currentNode.getId() === "root" ? "Directory View" : currentNode.getName();

  return (
    <Box
      ref={setScrollElement}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "auto",
      }}
    >
      <TopBar scrollContainer={scrollElement}></TopBar>
      <Box
        sx={{
          pt: `calc(${M5} + ${M4})`,
          px: M5,
          pb: M5,
          color: "text.primary",
        }}
      >
        <Stack spacing={M3}>
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              {path.map((segment, index) => (
                <Typography
                  key={segment.getId()}
                  variant="body2"
                  color="text.secondary"
                >
                  {segment.getName()}
                  {index < path.length - 1 ? " › " : ""}
                </Typography>
              ))}
            </Stack>
            <Typography variant="h4" fontWeight={600}>
              {title}
            </Typography>
          </Stack>

          <Stack spacing={2}>
            {childDirectories.length > 0 && (
              <Stack spacing={1.5}>
                {childDirectories.map((child, index) => (
                  <Box
                    key={child.getId()}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      backgroundColor: "background.paper",
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
                    <Box flex={1}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {child.getName()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(notesByDirectory[child.getId()] ?? []).length} Pages
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}

            <Divider sx={{ opacity: 0.3 }} />

            <Stack spacing={1.5}>
              {notesInDirectory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No notes yet in this directory.
                </Typography>
              ) : (
                notesInDirectory.map((note, index) => (
                  <Box
                    key={note.id}
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 2,
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      backgroundColor: "background.paper",
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
                    <Box flex={1}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {note.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
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
                ))
              )}
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};
