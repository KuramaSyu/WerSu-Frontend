import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { PermissionsApi } from "../../api/PermissionsApi";
import { useThemeStore } from "../../zustand/useThemeStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { M1, M2 } from "../../statics";
import { GraphCanvas } from "./components/GraphCanvas";
import { GraphDetailsPanel } from "./components/GraphDetailsPanel";
import { GraphToolsPanel } from "./components/GraphToolsPanel";
import type { GraphEdge, GraphNode } from "./types";
import {
  buildGraphLayout,
  getConnectedNodeIds,
  removeNoteParentLink,
  updateNoteParentLink,
} from "../../utils/fileGraphUtils";

const directoryApi = new DirectoryApi();
const searchNotesApi = new SearchNotesApi();
const noteApi = new NoteApi();
const permissionsApi = new PermissionsApi();
/**
 * Renders the Obsidian-style file graph page.
 */
export function FileGraphPage(): React.ReactElement {
  const { theme } = useThemeStore();
  const { setMessage } = useInfoStore();
  const navigate = useNavigate();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  // Holds the container element so we can observe size changes.
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  // Viewport size drives the radial graph layout.
  const [directories, setDirectories] = useState<DirectoryReply[]>([]);
  // Cached directories for rendering and parent changes.
  const [notes, setNotes] = useState<MinimalNote[]>([]);
  // Cached notes so the graph can show note nodes and parents.
  const [isLoading, setIsLoading] = useState(true);
  // Tracks overall loading state for initial graph data.
  const [error, setError] = useState<string | null>(null);
  // Displays top-level load errors.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Selected node drives details panel + connected highlight.
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  // Selected edge drives delete UI in the details panel.
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  // Loaded note content when a note node is selected.
  const [selectedDirectory, setSelectedDirectory] =
    // Loaded directory info when a directory node is selected.
    useState<DirectoryReply | null>(null);
  useState<DirectoryReply | null>(null);
  // Avoids showing stale content while details are loading.
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  // Draw mode enables link creation via drag gesture.
  const [drawMode, setDrawMode] = useState(false);
  // Source node id for an in-progress draw action.
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);
  // Pointer position while drawing a link.
  const [linkPointer, setLinkPointer] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // UI status for link create/delete operations.
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  // Zoom controls for the SVG viewport.
  const [zoom, setZoom] = useState(1);
  // Pan offset for the SVG viewport.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // SVG ref is used for pointer capture and coordinate transforms.
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Drag state is stored in a ref to avoid re-render on each move.
  const dragStateRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  // Keeps the layout in sync with the container size.
  useEffect(() => {
    if (!container) {
      return;
    }

    const element = container;

    function update(): void {
      const rect = element.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    }

    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(element);

    return () => observer.disconnect();
  }, [container]);

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
        setNotes(notesResult);
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

  // Memoize layout so rendering doesn't rebuild the graph on every state change.
  const { nodes, edges } = useMemo(() => {
    return buildGraphLayout(directories, notes, viewport);
  }, [directories, notes, viewport]);

  // Convert the node map to an array for rendering.
  const nodeList = useMemo(() => {
    return Array.from(nodes.values());
  }, [nodes]);
  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : undefined;
  const selectedEdge = selectedEdgeId
    ? edges.find((edge) => edge.id === selectedEdgeId)
    : undefined;
  const linkingFromNode = linkingFromId ? nodes.get(linkingFromId) : undefined;

  // Memoize connected nodes for grey-out styling.
  const connectedNodeIds = useMemo(() => {
    return getConnectedNodeIds(selectedNodeId, edges);
  }, [edges, selectedNodeId]);

  // Memoize transform string to avoid recalculating in the render tree.
  const viewportTransform = useMemo(() => {
    return `translate(${offset.x}, ${offset.y}) scale(${zoom})`;
  }, [offset.x, offset.y, zoom]);

  /**
   * Loads node metadata and updates selection state.
   */
  async function handleNodeClick(node: GraphNode): Promise<void> {
    setSelectedEdgeId(null);
    setSelectedNodeId(node.id);
    setSelectedNote(null);
    setSelectedDirectory(null);

    if (node.type === "directory") {
      const directory = directories.find((item) => item.id === node.id) ?? null;
      setSelectedDirectory(directory);
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
   * Converts pointer coordinates into graph space.
   */
  function getSvgPoint(event: React.PointerEvent<SVGSVGElement>): {
    x: number;
    y: number;
  } {
    const svg = svgRef.current;
    if (!svg) {
      return { x: 0, y: 0 };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - offset.x) / zoom,
      y: (event.clientY - rect.top - offset.y) / zoom,
    };
  }

  /**
   * Returns the closest node under a pointer position.
   */
  function findHitNode(point: { x: number; y: number }): GraphNode | null {
    let closest: GraphNode | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const node of nodeList) {
      const dx = node.x - point.x;
      const dy = node.y - point.y;
      const distance = Math.hypot(dx, dy);
      const hitRadius = node.radius + 8;
      if (distance <= hitRadius && distance < closestDistance) {
        closest = node;
        closestDistance = distance;
      }
    }

    return closest;
  }

  /**
   * Creates or updates parent relationships based on draw-mode linking.
   */
  async function applyLink(parentId: string, target: GraphNode): Promise<void> {
    setLinkStatus(null);

    if (target.id === parentId) {
      return;
    }

    if (target.type === "directory") {
      const updated = await directoryApi.setParent(target.id, parentId);
      if (!updated) {
        setLinkStatus("Failed to update directory parent.");
        return;
      }
      setDirectories((prev) =>
        prev.map((directory) =>
          directory.id === target.id
            ? { ...directory, parent_id: parentId }
            : directory,
        ),
      );
      setLinkStatus("Directory parent updated.");
      return;
    }

    try {
      const created = await permissionsApi.post({
        object_id: target.id,
        object_type: "note",
        relationship: {
          relation: "parent_directory",
          resource: {
            object_id: target.id,
            object_type: "note",
          },
          subject: {
            object_id: parentId,
            object_type: "directory",
          },
        },
      });

      if (!created) {
        setLinkStatus("Failed to add note parent.");
        setMessage(
          new SnackbarUpdateImpl(
            "Permission update failed",
            "error",
            undefined,
            "Could not add a new parent directory for this note.",
          ),
        );
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLinkStatus("Failed to add note parent.");
      setMessage(
        new SnackbarUpdateImpl(
          "Permission denied",
          "error",
          undefined,
          message,
        ),
      );
      return;
    }

    setNotes((prev) =>
      prev.map((note) =>
        note.id === target.id ? updateNoteParentLink(note, parentId) : note,
      ),
    );
    setLinkStatus("Note parent added.");
  }

  /**
   * Removes parent relationships when the user deletes an edge.
   */
  async function deleteEdge(edge: GraphEdge): Promise<void> {
    if (edge.type === "directory") {
      const updated = await directoryApi.setParent(edge.targetId, null);
      if (!updated) {
        setMessage(
          new SnackbarUpdateImpl(
            "Delete failed",
            "error",
            undefined,
            "Could not remove the directory parent.",
          ),
        );
        return;
      }
      setDirectories((prev) =>
        prev.map((directory) =>
          directory.id === edge.targetId
            ? { ...directory, parent_id: null }
            : directory,
        ),
      );
      setSelectedEdgeId(null);
      return;
    }

    try {
      const deleted = await permissionsApi.delete({
        object_id: edge.targetId,
        object_type: "note",
        relationship: {
          relation: "parent_directory",
          resource: {
            object_id: edge.targetId,
            object_type: "note",
          },
          subject: {
            object_id: edge.sourceId,
            object_type: "directory",
          },
        },
      });

      if (!deleted) {
        setMessage(
          new SnackbarUpdateImpl(
            "Delete failed",
            "error",
            undefined,
            "Could not remove the note parent directory.",
          ),
        );
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessage(
        new SnackbarUpdateImpl(
          "Permission denied",
          "error",
          undefined,
          message,
        ),
      );
      return;
    }

    setNotes((prev) =>
      prev.map((note) =>
        note.id === edge.targetId
          ? removeNoteParentLink(note, edge.sourceId)
          : note,
      ),
    );
    setSelectedEdgeId(null);
  }

  /**
   * Selects an edge to show delete actions.
   */
  function handleEdgeClick(edge: GraphEdge): void {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setSelectedNote(null);
    setSelectedDirectory(null);
  }

  /**
   * Handles mouse-wheel zoom gestures.
   */
  function handleWheel(event: React.WheelEvent<SVGSVGElement>): void {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const factor = direction > 0 ? 1.1 : 0.9;
    setZoom((current) => {
      const next = Math.min(2.5, Math.max(0.5, current * factor));
      return Number(next.toFixed(3));
    });
  }

  /**
   * Starts panning when draw mode is disabled.
   */
  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>): void {
    if (drawMode) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const state = dragStateRef.current;
    state.isDragging = true;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.originX = offset.x;
    state.originY = offset.y;
    (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
  }

  /**
   * Updates panning or draw line while the pointer moves.
   */
  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>): void {
    if (drawMode) {
      if (linkingFromId) {
        const point = getSvgPoint(event);
        setLinkPointer(point);
      }
      return;
    }
    const state = dragStateRef.current;
    if (!state.isDragging) {
      return;
    }
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    setOffset({ x: state.originX + dx, y: state.originY + dy });
  }

  /**
   * Completes panning or draw gestures on pointer release.
   */
  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>): void {
    if (drawMode) {
      if (linkingFromId) {
        const point = getSvgPoint(event);
        const target = findHitNode(point);
        if (target) {
          void applyLink(linkingFromId, target);
        }
      }
      setLinkingFromId(null);
      setLinkPointer(null);
      return;
    }
    dragStateRef.current.isDragging = false;
    (event.currentTarget as SVGSVGElement).releasePointerCapture(
      event.pointerId,
    );
  }

  /**
   * Starts a draw-mode link from a directory node.
   */
  function handleNodePointerDown(
    event: React.PointerEvent,
    node: GraphNode,
  ): void {
    if (!drawMode) {
      return;
    }

    if (node.type !== "directory") {
      return;
    }

    event.stopPropagation();
    setLinkingFromId(node.id);
    setLinkPointer({ x: node.x, y: node.y });

    if (svgRef.current) {
      svgRef.current.setPointerCapture(event.pointerId);
    }
  }

  /**
   * Double click navigates to the directory or note page.
   */
  function handleNodeDoubleClick(node: GraphNode): void {
    navigate(node.type === "directory" ? `/d/${node.id}` : `/n/${node.id}`);
  }

  /**
   * Toggles draw mode and clears active draw state.
   */
  function handleToggleDrawMode(): void {
    setDrawMode((prev) => !prev);
    setLinkingFromId(null);
    setLinkPointer(null);
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
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
        }}
      >
        {isLoading ? (
          <Stack
            spacing={2}
            alignItems="center"
            justifyContent="center"
            sx={{ height: "100%", flex: 1 }}
          >
            <CircularProgress />
            <Typography>Loading graph…</Typography>
          </Stack>
        ) : error ? (
          <Stack
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{ height: "100%", flex: 1 }}
          >
            <Typography color="error">{error}</Typography>
            <Typography variant="body2">
              Check your connection and try again.
            </Typography>
          </Stack>
        ) : nodeList.length === 0 ? (
          <Stack
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{ height: "100%", flex: 1 }}
          >
            <Typography>No directories or notes yet.</Typography>
          </Stack>
        ) : (
          <GraphCanvas
            containerRef={setContainer}
            svgRef={svgRef}
            theme={theme}
            nodes={nodes}
            nodeList={nodeList}
            edges={edges}
            connectedNodeIds={connectedNodeIds}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            drawMode={drawMode}
            linkingFromNode={linkingFromNode}
            linkPointer={linkPointer}
            isPanning={dragStateRef.current.isDragging}
            viewportTransform={viewportTransform}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onNodePointerDown={handleNodePointerDown}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onEdgeClick={handleEdgeClick}
          />
        )}
        <Stack spacing={2} sx={{ width: 320, flexShrink: 0 }}>
          <Box
            sx={{
              borderRadius: 4,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              p: 2,
            }}
          >
            <GraphToolsPanel
              drawMode={drawMode}
              onToggleDrawMode={handleToggleDrawMode}
              linkStatus={linkStatus}
            />
          </Box>
          <GraphDetailsPanel
            selectedNode={selectedNode}
            selectedNote={selectedNote}
            selectedDirectory={selectedDirectory}
            isDetailsLoading={isDetailsLoading}
            selectedEdge={selectedEdge}
            onDeleteEdge={deleteEdge}
          />
        </Stack>
      </Box>
    </Box>
  );
}
