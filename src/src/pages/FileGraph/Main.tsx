import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../../components/TopBar";
import { DirectoryApi } from "../../api/DirectoryApi";
import type { DirectoryReply } from "../../api/models/directory";
import {
  type MinimalNote,
  type Note,
  RestNotesSearchType,
} from "../../api/models/search";
import { SearchNotesApi } from "../../api/SearchNotesApi";
import { NoteApi } from "../../api/NoteApi";
import { useThemeStore } from "../../zustand/useThemeStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { M1, M2 } from "../../statics";
import { GraphCanvas } from "./components/GraphCanvas";
import { GraphDetailsPanel } from "./components/GraphDetailsPanel";
import {
  type GraphLink,
  type GraphNode,
  buildGraphData,
  getNodesWithinDepth,
  removeNoteParentLink,
  updateNoteParentLink,
} from "../../utils/fileGraphUtils";
import { GraphToolsPanel, type GraphMode } from "./components/GraphToolsPanel";

const directoryApi = new DirectoryApi();
const searchNotesApi = new SearchNotesApi();
const noteApi = new NoteApi();

/**
 * Renders the Obsidian-style file graph page.
 */
export function FileGraphPage(): React.ReactElement {
  const { theme } = useThemeStore();
  const { setMessage } = useInfoStore();
  const navigate = useNavigate();

  const [directories, setDirectories] = useState<DirectoryReply[]>([]);
  const [notes, setNotes] = useState<MinimalNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedDirectory, setSelectedDirectory] =
    useState<DirectoryReply | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Local-vs-global state.
  const [mode, setMode] = useState<GraphMode>("global");
  const [depth, setDepth] = useState(2);

  // Status line shown after link mutations.
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Loads directories and notes once when the graph view mounts.
  useEffect(() => {
    let isActive = true;

    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const [directoriesResult, notesResult] = await Promise.all([
          directoryApi.list(),
          searchNotesApi.search(RestNotesSearchType.LATEST, "", 2000, 0),
        ]);

        if (!isActive) {
          return;
        }

        setDirectories(directoriesResult);
        setNotes(notesResult.notes);
      } catch (err) {
        if (!isActive) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load";
        setError(message);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  // Graph payload is derived from inputs.
  const graphData = useMemo(
    () => buildGraphData(directories, notes),
    [directories, notes],
  );

  // Visible-node set: all (global) or BFS-reachable (local).
  const visibleNodeIds = useMemo(() => {
    if (mode === "global") {
      return new Set(graphData.nodes.map((n) => n.id));
    }
    if (!selectedNodeId) {
      return new Set(graphData.nodes.map((n) => n.id));
    }
    return getNodesWithinDepth(selectedNodeId, graphData.links, depth);
  }, [mode, depth, selectedNodeId, graphData]);

  // Selected node + outgoing edges (used by the details panel).
  const selectedNode: GraphNode | undefined = useMemo(
    () => graphData.nodes.find((n) => n.id === selectedNodeId),
    [graphData.nodes, selectedNodeId],
  );

  const outgoingLinks: GraphLink[] = useMemo(() => {
    if (!selectedNodeId) return [];
    return graphData.links.filter((link) => link.target === selectedNodeId);
  }, [graphData.links, selectedNodeId]);

  /**
   * Loads the selected node's metadata (note or directory).
   */
  async function handleSelectNode(node: GraphNode): Promise<void> {
    setSelectedNodeId(node.id);
    setSelectedNote(null);
    setSelectedDirectory(null);
    setLinkStatus(null);

    if (node.type === "directory") {
      setSelectedDirectory(
        directories.find((item) => item.id === node.id) ?? null,
      );
      return;
    }

    setIsDetailsLoading(true);
    try {
      const note = await noteApi.get(node.id);
      setSelectedNote(note ?? null);
    } catch (err) {
      console.error("Failed to load note", err);
      setSelectedNote(null);
    } finally {
      setIsDetailsLoading(false);
    }
  }

  /**
   * Navigates to the directory or note page for the given node.
   */
  function handleOpenNode(node: GraphNode): void {
    navigate(node.type === "directory" ? `/d/${node.id}` : `/n/${node.id}`);
  }

  /**
   * Adds a parent directory to the currently selected node.
   */
  async function handleAddParent(directoryId: string): Promise<void> {
    if (!selectedNode) {
      return;
    }
    setIsMutating(true);
    setLinkStatus(null);
    try {
      if (selectedNode.type === "directory") {
        const updated = await directoryApi.setParent(selectedNode.id, [
          directoryId,
        ]);
        if (!updated) {
          setLinkStatus("Failed to update directory parent.");
          return;
        }
        setDirectories((prev) =>
          prev.map((directory) =>
            directory.id === selectedNode.id
              ? { ...directory, parent_dir_ids: [directoryId] }
              : directory,
          ),
        );
        setLinkStatus("Directory parent updated.");
        return;
      }

      const existing = notes.find((n) => n.id === selectedNode.id);
      const previousParents = existing?.directory_ids ?? [];
      const nextParents = Array.from(
        new Set([...previousParents, directoryId]),
      );
      const ok = await noteApi.patchDirectory(selectedNode.id, nextParents);
      if (!ok) {
        setLinkStatus("Failed to add note parent.");
        return;
      }
      setNotes((prev) =>
        prev.map((note) =>
          note.id === selectedNode.id
            ? updateNoteParentLink(note, directoryId)
            : note,
        ),
      );
      setLinkStatus("Note parent added.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLinkStatus(`Failed to add parent: ${message}`);
      setMessage(
        new SnackbarUpdateImpl("Update failed", "error", undefined, message),
      );
    } finally {
      setIsMutating(false);
    }
  }

  /**
   * Removes a single edge from the graph.
   */
  async function handleRemoveLink(link: GraphLink): Promise<void> {
    setIsMutating(true);
    setLinkStatus(null);
    try {
      // For directory links: edge.target is the directory owning the parent.
      if (link.type === "directory") {
        const updated = await directoryApi.setParent(link.target, null);
        if (!updated) {
          setLinkStatus("Failed to remove directory parent.");
          return;
        }
        setDirectories((prev) =>
          prev.map((directory) =>
            directory.id === link.target
              ? { ...directory, parent_dir_ids: [] }
              : directory,
          ),
        );
        setLinkStatus("Directory parent removed.");
        return;
      }

      const existing = notes.find((n) => n.id === link.target);
      const previousParents = existing?.directory_ids ?? [];
      const nextParents = previousParents.filter((id) => id !== link.source);
      const ok = await noteApi.patchDirectory(link.target, nextParents);
      if (!ok) {
        setLinkStatus("Failed to remove note parent.");
        return;
      }
      setNotes((prev) =>
        prev.map((note) =>
          note.id === link.target
            ? removeNoteParentLink(note, link.source)
            : note,
        ),
      );
      setLinkStatus("Note parent removed.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLinkStatus(`Failed to remove link: ${message}`);
      setMessage(
        new SnackbarUpdateImpl("Update failed", "error", undefined, message),
      );
    } finally {
      setIsMutating(false);
    }
  }

  // Directory nodes (used by the picker in the details panel).
  const directoryNodes = useMemo(
    () => graphData.nodes.filter((n) => n.type === "directory"),
    [graphData.nodes],
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        paddingTop: M1,
      }}
    >
      <TopBar />
      <Box
        sx={{
          flex: 1,
          display: "flex",
          gap: M2,
          mt: M2,
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {isLoading ? (
          <Stack
            spacing={2}
            sx={{
              height: "100%",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress />
            <Typography>Loading graph…</Typography>
          </Stack>
        ) : error ? (
          <Stack
            spacing={1}
            sx={{
              height: "100%",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography color="error">{error}</Typography>
            <Typography variant="body2">
              Check your connection and try again.
            </Typography>
          </Stack>
        ) : graphData.nodes.length === 0 ? (
          <Stack
            spacing={1}
            sx={{
              height: "100%",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography>No directories or notes yet.</Typography>
          </Stack>
        ) : (
          <GraphCanvas
            theme={theme}
            data={graphData}
            visibleNodeIds={visibleNodeIds}
            selectedNodeId={selectedNodeId}
            onSelectNode={(node) => {
              void handleSelectNode(node);
            }}
          />
        )}
        <Stack spacing={2} sx={{ width: 320, flexShrink: 0, minHeight: 0 }}>
          <Box
            sx={{
              borderRadius: 4,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              p: 2,
            }}
          >
            <GraphToolsPanel
              mode={mode}
              onModeChange={setMode}
              depth={depth}
              onDepthChange={setDepth}
              linkStatus={linkStatus}
            />
          </Box>
          <GraphDetailsPanel
            selectedNode={selectedNode}
            selectedNote={selectedNote}
            selectedDirectory={selectedDirectory}
            isDetailsLoading={isDetailsLoading}
            outgoingLinks={outgoingLinks}
            directories={directoryNodes}
            isMutating={isMutating}
            onAddParent={(id) => {
              void handleAddParent(id);
            }}
            onRemoveLink={(link) => {
              void handleRemoveLink(link);
            }}
            onOpen={handleOpenNode}
          />
        </Stack>
      </Box>
    </Box>
  );
}
