import { Divider, Paper, Stack, Typography } from "@mui/material";
import { DragDropProvider } from "@dnd-kit/react";
import { useState } from "react";
import { DirectoryLeftPanel } from "./LeftPanel";
import { useLeftPanel, usePanelSize } from "../../LayoutProvider";
import { DirectoryBreadCrumbs } from "./DirectoryBreadCrumbs";
import { DirectoryItem } from "./DirectoryItem";
import { useDirectoryFeatures } from "./DirectoryFeatures.hook";
import { CreateNote } from "../MainPage/CreateNote";
import { CreateDirectoryModal } from "../MainPage/CreateDirectory";
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
  const [createDirectoryOpen, setCreateDirectoryOpen] = useState(false);
  const [createDirectoryParentId, setCreateDirectoryParentId] = useState<
    string | undefined
  >(undefined);
  const [editDirectoryId, setEditDirectoryId] = useState<string | undefined>(
    undefined,
  );

  const {
    currentNode,
    path,
    childDirectories,
    notesInDirectory,
    title,
    navigate,
    cascadePreview,
    handleCreateNote,
    handleCreateSubdirectory,
    handleRenameDirectory,
    handleDeleteDirectory,
  } = useDirectoryFeatures({
    onOpenCreateNote: () => setCreateNoteOpen(true),
    onOpenCreateDirectory: (parentId) => {
      setCreateDirectoryParentId(parentId);
      setCreateDirectoryOpen(true);
    },
    onOpenEditDirectory: (directoryId) => {
      setEditDirectoryId(directoryId);
      setCreateDirectoryOpen(true);
    },
  });

  // Match the home screen's left-panel sizing so the directory tree
  // has the same breathing room as the main page's recent activity
  // panel. `usePanelSize` writes to the layout context; the AppShell
  // reads it to size the grid column.
  usePanelSize({ left: "clamp(20rem, 25vw, 30rem)" });

  console.log("DirectoryView: childDirectories", childDirectories);
  // Same dep-array rationale as `useRightPanel` in the features hook:
  // the left panel reads `currentNode` for the recent-activity target
  // and the description fetch, so re-push on node changes once the
  // store hydrates from the loading fallback.
  useLeftPanel(
    <DirectoryLeftPanel
      currentNode={currentNode}
      cascadePreview={cascadePreview}
      handleCreateNote={handleCreateNote}
      handleCreateSubdirectory={handleCreateSubdirectory}
      handleRenameDirectory={handleRenameDirectory}
      handleDeleteDirectory={handleDeleteDirectory}
    />,
    [currentNode],
  );

  return (
    <Paper
      elevation={0}
      ref={setScrollElement}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        // The inner Paper below owns the scrollbar
        overflow: "hidden",
      }}
    >
      {/* dnd probably not needed anymore */}
      <DragDropProvider onDragEnd={() => undefined}>
        <Stack direction="row" spacing={M4} sx={{ alignItems: "flex-start" }}>
          <Paper
            elevation={2}
            sx={{
              flex: 1,
              p: M3,
              // The directory/note content can grow tall (lots of
              // children or an expanded accordion). Clip here
              height: "100%",
              overflow: "auto",
            }}
          >
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
                {childDirectories.map((child) => (
                  <ChapterAccordion
                    key={child.getId()}
                    index={0}
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
                    // Fetch the full DirectoryReply on mount so the
                    // row badge has accurate counts even before
                    // the user expands the chapter.
                    onNavigate={navigate}
                  />
                ))}

                <Divider sx={{ opacity: 0.3 }} />

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
          </Paper>
        </Stack>
      </DragDropProvider>
      <CreateNote
        open={createNoteOpen}
        onOpenChange={setCreateNoteOpen}
        currentDirectoryId={currentNode.getId()}
      />
      <CreateDirectoryModal
        open={createDirectoryOpen}
        onOpenChange={(open) => {
          setCreateDirectoryOpen(open);
          if (!open) {
            // Clear the id we were operating on once the modal closes
            // so a re-open starts from the live current directory
            // instead of the stale snapshot.
            setEditDirectoryId(undefined);
            setCreateDirectoryParentId(undefined);
          }
        }}
        mode={editDirectoryId ? "edit" : "create"}
        directoryId={editDirectoryId}
        parentId={createDirectoryParentId}
      />
    </Paper>
  );
};
