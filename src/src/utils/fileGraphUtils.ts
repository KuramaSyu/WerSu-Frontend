import type { DirectoryReply } from "../api/models/directory";
import type {
  MinimalNote,
  PermissionRelationshipReply,
} from "../api/models/search";
import type { GraphEdge, GraphNode } from "../pages/FileGraph/types";

export interface GraphViewport {
  width: number;
  height: number;
}

/**
 * Returns all parent directory ids for a note based on permission relationships.
 */
export function getNoteParentDirectoryIds(
  permissions?: PermissionRelationshipReply[],
): string[] {
  if (!permissions) {
    return [];
  }

  return permissions
    .filter((permission) => {
      const isParentRelation =
        permission.relation === "parent" ||
        permission.relation === "parent_directory";
      const isDirectorySubject =
        permission.subject.object_type === "PERMISSION_OBJECT_TYPE_DIRECTORY";
      return isParentRelation && isDirectorySubject;
    })
    .map((permission) => permission.subject.object_id);
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
    if (directory.parent_id) {
      edgesList.push({
        id: `dir-${directory.parent_id}-${directory.id}`,
        sourceId: directory.parent_id,
        targetId: directory.id,
        type: "directory",
      });
    }
  });

  sortedNotes.forEach((note) => {
    const parents = getNoteParentDirectoryIds(note.permissions);
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
 * Adds a parent directory relationship to a note, if missing.
 */
export function updateNoteParentLink(
  note: MinimalNote,
  parentDirectoryId: string,
): MinimalNote {
  const nextPermissions = [...(note.permissions ?? [])];
  const exists = nextPermissions.some(
    (permission) =>
      (permission.relation === "parent" ||
        permission.relation === "parent_directory") &&
      permission.subject.object_type === "PERMISSION_OBJECT_TYPE_DIRECTORY" &&
      permission.subject.object_id === parentDirectoryId,
  );

  if (exists) {
    return note;
  }

  return {
    ...note,
    permissions: [
      ...nextPermissions,
      {
        relation: "parent_directory",
        resource: {
          object_id: note.id,
          object_type: "PERMISSION_OBJECT_TYPE_NOTE",
        },
        subject: {
          object_id: parentDirectoryId,
          object_type: "PERMISSION_OBJECT_TYPE_DIRECTORY",
        },
      },
    ],
  };
}

/**
 * Removes a specific parent directory relationship from a note.
 */
export function removeNoteParentLink(
  note: MinimalNote,
  parentDirectoryId: string,
): MinimalNote {
  const nextPermissions = (note.permissions ?? []).filter(
    (permission) =>
      !(
        (permission.relation === "parent" ||
          permission.relation === "parent_directory") &&
        permission.subject.object_type === "PERMISSION_OBJECT_TYPE_DIRECTORY" &&
        permission.subject.object_id === parentDirectoryId
      ),
  );

  return { ...note, permissions: nextPermissions };
}
