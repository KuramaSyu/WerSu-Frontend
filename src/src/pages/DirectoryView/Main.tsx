import { Divider, Paper, Stack, Typography } from "@mui/material";
import { DragDropProvider } from "@dnd-kit/react";
import { useState } from "react";
import { DirectoryActions } from "./DirectoryActions";
import { useLeftPanel } from "../../LayoutProvider";
import { DirectoryBreadCrumbs } from "./DirectoryBreadCrumbs";
import { DirectoryItem } from "./DirectoryItem";
import { useDirectoryFeatures } from "./DirectoryFeatures.hook";
import { M3, M4 } from "../../statics";

/**
 * Renders the directory view UI, including breadcrumb navigation, child
 * directories, and notes for the current directory.
 *
 * Display only - data loading, hierarchy resolution, and action handlers
 * are owned by `useDirectoryFeatures`. The right-panel title actions are
 * mounted by `useDirectoryFeatures` via `useRightPanel`.
 */
export const DirectoryView: React.FC = () => {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );

  const {
    currentNode,
    path,
    childDirectories,
    notesByDirectory,
    notesInDirectory,
    title,
    navigate,
  } = useDirectoryFeatures();

  useLeftPanel(<DirectoryActions currentNode={currentNode} />);

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
      {/*
          DragDropProvider is required because DirectorySideView registers
          droppable targets via dnd-kit hooks. Even if DirectoryView doesn't
          initiate drag operations itself, the provider ensures the directory
          tree can still accept note drops from elsewhere in the app without
          runtime hook errors.
        */}
      <DragDropProvider onDragEnd={() => undefined}>
        <Stack direction="row" spacing={M4} sx={{ alignItems: "flex-start" }}>
          <Paper elevation={2} sx={{ flex: 1, p: M3 }}>
            <Stack spacing={M3}>
              <Stack spacing={0.5}>
                <DirectoryBreadCrumbs
                  path={path}
                  onNavigate={(id) => navigate(`/d/${id}`)}
                />
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {title}
                </Typography>
              </Stack>

              <Stack spacing={2}>
                {childDirectories.length > 0 && (
                  <Stack spacing={1.5}>
                    {childDirectories.map((child, index) => (
                      <DirectoryItem
                        key={child.getId()}
                        variant="directory"
                        index={index}
                        name={child.getName()}
                        directoryId={child.getId()}
                        pageCount={
                          (notesByDirectory[child.getId()] ?? []).length
                        }
                        onClick={() => navigate(`/d/${child.getId()}`)}
                      />
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
                      <DirectoryItem
                        key={note.id}
                        variant="note"
                        index={index}
                        note={note}
                        onClick={() => navigate(`/n/${note.id}`)}
                      />
                    ))
                  )}
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </DragDropProvider>
    </Paper>
  );
};
