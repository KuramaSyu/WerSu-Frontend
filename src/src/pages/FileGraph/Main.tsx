import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  useLeftPanel,
  usePanelSize,
  useRightPanel,
} from "../../LayoutProvider";

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
  const [depth, setDepth] = useState(5);

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
          searchNotesApi.search(RestNotesSearchType.LATEST, "", {
            limit: 2000,
            offset: 0,
          }),
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

  // Subgraph actually rendered by the canvas. In global mode this is the
  // full graph; in local mode we precompute the BFS-reachable node set
  // and strip every node + edge outside of it from the payload. Doing
  // the filter at the data level (rather than dimming at the canvas
  // level) means hidden links are not painted at all, so local mode no
  // longer leaves bare edges floating between dimmed nodes.
  //
  // `getNodesWithinDepth` does an undirected BFS, so depth expands
  // outward in BOTH directions from the focal node: parents (notes /
  // directories that point at the focal node) and children (nodes the
  // focal node points at) are all included.
  //
  // Both the BFS and the link filter below tolerate `source`/`target`
  // being either string ids or node-object references. force-graph
  // mutates the input links in place during init, so by the time the
  // user clicks a node the original string ids may already be gone.
  const linkEndpointId = (endpoint: GraphLink["source"]): string => {
    if (typeof endpoint === "string") return endpoint;
    if (typeof endpoint === "number") return String(endpoint);
    return (endpoint as { id?: string }).id ?? "";
  };
  const displayedGraphData = useMemo(() => {
    if (mode === "global" || !selectedNodeId) {
      return graphData;
    }
    const ids = getNodesWithinDepth(selectedNodeId, graphData.links, depth);
    return {
      nodes: graphData.nodes.filter((n) => ids.has(n.id)),
      links: graphData.links.filter((link) => {
        const source = linkEndpointId(link.source);
        const target = linkEndpointId(link.target);
        return source !== "" && ids.has(source) && ids.has(target);
      }),
    };
  }, [mode, depth, selectedNodeId, graphData]);

  // Re-anchor trigger key. We want the canvas to recenter whenever:
  //
  // - the user toggled into local mode AND has a selection,
  // - the user moved the depth slider,
  // - the user toggled out of local mode (back to the global view).
  //
  // We deliberately do NOT re-anchor on bare selection-clicks in local
  // mode (too jumpy) — the button in the canvas's top-right corner is
  // the manual escape hatch.
  //
  // `modeBump` is incremented by `setModeWithAnchor` so a single
  // render sees both the new mode and a fresh bump count. Reading
  // `modeBump` during render is fine because it's plain state (not a
  // ref); the setter just wraps the user-provided transition with the
  // bump increment.
  const [modeBump, setModeBump] = useState(0);
  const setModeWithAnchor = (next: GraphMode): void => {
    setMode(next);
    setModeBump((bump) => bump + 1);
  };
  const focusKey = `${mode}:${depth}:${modeBump}`;

  // Visible-node set is the union of every node in the displayed payload
  // — i.e. the canvas treats them all as equally visible, so no dimming
  // is applied on top of the data filter above.
  const visibleNodeIds = useMemo(
    () => new Set(displayedGraphData.nodes.map((n) => n.id)),
    [displayedGraphData],
  );

  // Local mode without a selection still renders the full graph so the
  // user can pick a focal node. The tip is rendered as a floating
  // overlay on top of the canvas rather than replacing it.
  const showLocalTip = mode === "local" && !selectedNodeId;

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

  // Right panel owns the tools + details cards; the left rail is empty
  // for this view. Width pinned to 320px to match the original layout.
  // Deps re-push the panel whenever any piece of state that the cards
  // read changes, so the closures inside the panel handlers stay fresh.
  useLeftPanel(null);
  usePanelSize({ right: "21rem" });
  useRightPanel(
    <Stack spacing={2} sx={{ width: "100%", flexShrink: 0, height: "100%" }}>
      <Box
        sx={{
          borderRadius: 4,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.surfaces.panel,
          p: 2,
        }}
      >
        <GraphToolsPanel
          mode={mode}
          onModeChange={setModeWithAnchor}
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
    </Stack>,
    [
      graphData,
      selectedNodeId,
      selectedNote,
      selectedDirectory,
      isDetailsLoading,
      isMutating,
      mode,
      depth,
      linkStatus,
    ],
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
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
          <Box
            sx={{
              position: "relative",
              flex: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <GraphCanvas
              theme={theme}
              data={displayedGraphData}
              visibleNodeIds={visibleNodeIds}
              selectedNodeId={selectedNodeId}
              focusKey={focusKey}
              onSelectNode={(node) => {
                void handleSelectNode(node);
              }}
            />
            {showLocalTip && (
              <Stack
                spacing={0.5}
                sx={{
                  position: "absolute",
                  inset: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <Typography
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    backgroundColor: "background.paper",
                    border: 1,
                    borderColor: "divider",
                    boxShadow: 1,
                  }}
                >
                  Local mode — click a node to focus the local view.
                </Typography>
              </Stack>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
