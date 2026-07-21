import { Divider, Paper, Stack, Typography } from "@mui/material";
import { DragDropProvider } from "@dnd-kit/react";
import { useState } from "react";
import { DirectoryLeftPanel } from "./LeftPanel";
import { useLeftPanel } from "../../LayoutProvider";
import { DirectoryBreadCrumbs } from "./DirectoryBreadCrumbs";
import { DirectoryItem } from "./DirectoryItem";
import { useDirectoryFeatures } from "./DirectoryFeatures.hook";
import { CreateNote } from "../MainPage/CreateNote";
import { M3, M4 } from "../../statics";
import { DirectoryHirarchyItem } from "../../models/HirarchyItem";
import { ChapterAccordion } from "./ChapterAccordion";

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
  const [createNoteOpen, setCreateNoteOpen] = useState(false);

  const {
    currentNode,
    path,
    childDirectories,
    notesInDirectory,
    title,
    navigate,
  } = useDirectoryFeatures({ onOpenCreateNote: () => setCreateNoteOpen(true) });

  console.log("DirectoryView: childDirectories", childDirectories);
  // Same dep-array rationale as `useRightPanel` in the features hook:
  // the left panel reads `currentNode` for the recent-activity target
  // and the description fetch, so re-push on node changes once the
  // store hydrates from the loading fallback.
  useLeftPanel(<DirectoryLeftPanel currentNode={currentNode} />, [currentNode]);

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
                      <ChapterAccordion
                        key={child.getId()}
                        index={index}
                        directory={
                          child instanceof DirectoryHirarchyItem
                            ? child.getDirectory()
                            : {
                                id: child.getId(),
                                name: child.getName(),
                                display_name: child.getName(),
                                parent_dir_ids: child.getParent()
                                  ? [child.getParent()!]
                                  : [],
                                child_dir_ids: [],
                                child_note_ids: [],
                              }
                        }
                        onNavigate={navigate}
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
      <CreateNote
        open={createNoteOpen}
        onOpenChange={setCreateNoteOpen}
        currentDirectoryId={currentNode.getId()}
      />
    </Paper>
  );
};
