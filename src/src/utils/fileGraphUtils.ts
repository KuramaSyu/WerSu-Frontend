import type { DirectoryReply } from "../api/models/directory";
import type { MinimalNote } from "../api/models/search";
import type { GraphEdge, GraphNode } from "../pages/FileGraph/types";

export interface GraphViewport {
  width: number;
  height: number;
}

/**
 * Returns every parent directory id declared by the note.
 *
 * The backend exposes parents directly as `directory_ids` (replacing
 * the older `parent` / `parent_directory` permission relationships).
 */
export function getNoteParentDirectoryIds(directoryIds?: string[]): string[] {
  if (!directoryIds) {
    return [];
  }
  return [...new Set(directoryIds)];
}

/**
 * Builds a human-readable directory label with display name fallback.
 */
export function getDirectoryLabel(directory: DirectoryReply): string {
  return (
    directory.display_name?.trim() || directory.name || "Untitled Directory"
  );
}

/**
 * Produces a radial layout for directories/notes and returns nodes + edges.
 */
export function buildGraphLayout(
  directories: DirectoryReply[],
  notes: MinimalNote[],
  viewport: GraphViewport,
): { nodes: Map<string, GraphNode>; edges: GraphEdge[] } {
  const width = viewport.width || 1;
  const height = viewport.height || 1;
  const centerX = width / 2;
  const centerY = height / 2;

  const sortedDirectories = [...directories].sort((a, b) =>
    getDirectoryLabel(a).localeCompare(getDirectoryLabel(b)),
  );
  const sortedNotes = [...notes].sort((a, b) => a.title.localeCompare(b.title));

  const dirCount = Math.max(sortedDirectories.length, 1);
  const noteCount = Math.max(sortedNotes.length, 1);

  const baseRadius = Math.min(width, height);
  const directoryRing = baseRadius * 0.28;
  const noteRing = baseRadius * 0.42;

  const nodeMap = new Map<string, GraphNode>();

  sortedDirectories.forEach((directory, index) => {
    const angle = (2 * Math.PI * index) / dirCount - Math.PI / 2;
    const x = centerX + Math.cos(angle) * directoryRing;
    const y = centerY + Math.sin(angle) * directoryRing;
    nodeMap.set(directory.id, {
      id: directory.id,
      label: getDirectoryLabel(directory),
      type: "directory",
      x,
      y,
      radius: 18,
    });
  });

  sortedNotes.forEach((note, index) => {
    const angle = (2 * Math.PI * index) / noteCount - Math.PI / 2;
    const x = centerX + Math.cos(angle) * noteRing;
    const y = centerY + Math.sin(angle) * noteRing;
    nodeMap.set(note.id, {
      id: note.id,
      label: note.title || "Untitled Note",
      type: "note",
      x,
      y,
      radius: 13,
    });
  });

  const edgesList: GraphEdge[] = [];

  sortedDirectories.forEach((directory) => {
    for (const parentId of directory.parent_dir_ids ?? []) {
      edgesList.push({
        id: `dir-${parentId}-${directory.id}`,
        sourceId: parentId,
        targetId: directory.id,
        type: "directory",
      });
    }
  });

  sortedNotes.forEach((note) => {
    const parents = getNoteParentDirectoryIds(note.directory_ids);
    parents.forEach((parentId) => {
      edgesList.push({
        id: `note-${parentId}-${note.id}`,
        sourceId: parentId,
        targetId: note.id,
        type: "note",
      });
    });
  });

  return { nodes: nodeMap, edges: edgesList };
}

/**
 * Returns the set of node ids directly connected to the selected node.
 */
export function getConnectedNodeIds(
  selectedNodeId: string | null,
  edges: GraphEdge[],
): Set<string> | null {
  if (!selectedNodeId) {
    return null;
  }
  const connected = new Set<string>([selectedNodeId]);
  edges.forEach((edge) => {
    if (edge.sourceId === selectedNodeId) {
      connected.add(edge.targetId);
    }
    if (edge.targetId === selectedNodeId) {
      connected.add(edge.sourceId);
    }
  });
  return connected;
}

/**
 * Adds a parent directory id to a note, if missing.
 */
export function updateNoteParentLink(
  note: MinimalNote,
  parentDirectoryId: string,
): MinimalNote {
  const currentIds = note.directory_ids ?? [];
  if (currentIds.includes(parentDirectoryId)) {
    return note;
  }

  return {
    ...note,
    directory_ids: [...currentIds, parentDirectoryId],
  };
}

/**
 * Removes a specific parent directory id from a note.
 */
export function removeNoteParentLink(
  note: MinimalNote,
  parentDirectoryId: string,
): MinimalNote {
  const nextIds = (note.directory_ids ?? []).filter(
    (id) => id !== parentDirectoryId,
  );

  return { ...note, directory_ids: nextIds };
}
